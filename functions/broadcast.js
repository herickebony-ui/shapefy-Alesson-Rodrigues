const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const axios = require("axios");

if (!admin.apps.length) {
    admin.initializeApp();
}
let db;
const ensureDb = () => {
    if (!db) db = admin.firestore();
    return db;
};

// ============================================================================
// 📞 HELPERS DE NÚMERO — VALIDAÇÃO REAL VIA MEGAAPI
// ============================================================================

/**
 * Normaliza qualquer número bruto para 13 dígitos limpos (sem @s.whatsapp.net).
 * Cobre: com/sem 55, com/sem 9, 10/11 dígitos locais.
 * Retorna null se inválido.
 */
const normalizePhone = (raw) => {
    let clean = String(raw || "").replace(/\D/g, "");
    if (!clean || clean.length < 10) return null;

    // Adiciona DDI se ausente
    if (clean.length === 10 || clean.length === 11) clean = "55" + clean;

    // 12 dígitos = 55 + DDD + 8 locais → adiciona o 9
    if (clean.length === 12 && clean.startsWith("55")) {
        clean = clean.slice(0, 4) + "9" + clean.slice(4);
    }

    if (clean.length !== 13) return null;
    return clean;
};

/**
 * Gera a variante do número (com ↔ sem o 9).
 * Se o número local tem 9 dígitos começando com 9 → remove o 9.
 * Se tem 8 dígitos → não gera variante (já normalizePhone adicionou o 9).
 */
const getPhoneVariant = (clean) => {
    const local = clean.substring(4); // após 55DD
    if (local.startsWith("9") && local.length === 9) {
        return clean.slice(0, 4) + local.slice(1); // remove o 9
    }
    return null;
};

/**
 * Verifica se um número existe no WhatsApp via MegaAPI.
 * Endpoint: GET /rest/instance/isOnWhatsApp/{instanceKey}?phoneNumber=xxx@s.whatsapp.net
 */
const checkIsOnWhatsApp = async (cleanHost, instanceKey, token, number) => {
    try {
        const res = await axios.get(
            `${cleanHost}/rest/instance/isOnWhatsApp/${instanceKey}`,
            {
                params: { jid: `${number}@s.whatsapp.net` },
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000
            }
        );
        // Único caso que marca inválido: API respondeu 200 com exists: false
        // Qualquer outro status não é culpa do número
        return res.data?.exists === true;
    } catch (err) {
        if (err.response) {
            const status = err.response.status;
            const msg = err.response.data?.message || err.message;
            // 401 → token inválido
            // 403 → instância desconectada/banida
            // 4xx/5xx → problema de instância ou provedor, NÃO do número
            // TODOS retryáveis — não marca como invalid_number
            throw new Error(`Erro MegaAPI (${status} - ${msg}): problema na instância, não no número`);
        }
        // Sem resposta: timeout, DNS, rede → retryável
        throw new Error(`Falha de rede ao validar número: ${err.message}`);
    }
};

/**
 * Resolve o número WhatsApp válido para um aluno.
 * Tenta o principal, depois a variante com/sem 9.
 * Retorna o número formatado "xxx@s.whatsapp.net" ou null se inválido.
 */
const resolveWhatsAppNumber = async (cleanHost, instanceKey, token, raw) => {
    const main = normalizePhone(raw);
    if (!main) return null;

    if (await checkIsOnWhatsApp(cleanHost, instanceKey, token, main)) {
        return `${main}@s.whatsapp.net`;
    }

    const variant = getPhoneVariant(main);
    if (variant && await checkIsOnWhatsApp(cleanHost, instanceKey, token, variant)) {
        return `${variant}@s.whatsapp.net`;
    }

    return null; // nenhum formato existe no WhatsApp
};

// ============================================================================
// 🚀 BROADCAST — CRIAÇÃO DO JOB
// ============================================================================

exports.createBroadcastJob = functions.https.onCall(async (data, context) => {
    ensureDb();

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const { messages } = data;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Mensagens são obrigatórias');
    }

    try {
        const studentsSnap = await db.collection("students").get();

        const validStudents = studentsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(student => {
                const finStatus = student.finStatus;
                return finStatus === "Ativo" ||
                    finStatus === "Renova" ||
                    finStatus === "Pago e não iniciado";
            });

        if (validStudents.length === 0) {
            throw new functions.https.HttpsError('not-found', 'Nenhum aluno com status válido encontrado');
        }

        const studentsList = validStudents
            .filter(student => student.whatsapp || student.phone)
            .sort(() => Math.random() - 0.5);

        if (studentsList.length === 0) {
            throw new functions.https.HttpsError('not-found', 'Nenhum aluno com WhatsApp encontrado');
        }

        const jobId = `broadcast_${Date.now()}`;

        await db.collection("broadcast_queue").doc(jobId).set({
            messages: messages.filter(m => m.trim()),
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: context.auth.uid,
            progress: {
                sent: 0,
                failed: 0,
                invalid: 0,
                total: studentsList.length,
                currentBatch: 0
            },
            config: {
                batchSize: 3,
                minDelay: 45,
                maxDelay: 60
            },
            nextProcessAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const batch = db.batch();
        studentsList.forEach(student => {
            const itemRef = db.collection(`broadcast_queue/${jobId}/items`).doc(student.id);
            batch.set(itemRef, {
                studentId: student.id,
                studentName: student.name || "Aluno",
                phone: student.whatsapp || student.phone,
                status: "pending",
                attempts: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();

        return {
            success: true,
            jobId,
            totalStudents: studentsList.length,
            message: "Broadcast criado! Processamento iniciará automaticamente."
        };

    } catch (error) {
        console.error("Erro ao criar job:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ============================================================================
// ⏱️ BROADCAST — PROCESSAMENTO VIA CRON
// ============================================================================

exports.processBroadcastQueue = functions.pubsub
    .schedule("every 5 minutes")
    .timeZone("America/Bahia")
    .onRun(async () => {
        ensureDb();

        const now = new Date();
        const brHour = Number(new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Bahia",
            hour: "2-digit",
            hour12: false
        }).format(now));

        if (brHour < 5 || brHour >= 21) {
            console.log(`⏰ Fora do horário (${brHour}h). Janela: 5h-21h`);
            return null;
        }

        try {
            const jobsSnap = await db.collection("broadcast_queue")
                .where("status", "in", ["pending", "processing"])
                .where("nextProcessAt", "<=", admin.firestore.Timestamp.now())
                .limit(2)
                .get();

            for (const jobDoc of jobsSnap.docs) {
                await processJobBatch(jobDoc.id, jobDoc.data());
            }

        } catch (error) {
            console.error("Erro no cron:", error);
        }

        return null;
    });

// ============================================================================
// 🔧 PROCESSAMENTO DO LOTE — COM VALIDAÇÃO REAL DE NÚMERO
// ============================================================================

async function processJobBatch(jobId, jobData) {
    ensureDb();
    try {
        // Carrega config do WhatsApp
        const megaSnap = await db.doc("settings/whatsapp_config").get();
        const megaConfig = megaSnap.data() || {};

        if (!megaConfig.host || !megaConfig.instanceKey || !megaConfig.token) {
            console.error("MegaAPI não configurada");
            return;
        }

        let cleanHost = megaConfig.host.trim();
        if (!cleanHost.startsWith('http')) cleanHost = `https://${cleanHost}`;
        cleanHost = cleanHost.replace(/\/$/, "");

        // Recupera itens travados em "sending" há mais de 10 minutos
        const tenMinAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 60 * 1000);
        const stuckSnap = await db.collection(`broadcast_queue/${jobId}/items`)
            .where("status", "==", "sending")
            .get();

        for (const stuckDoc of stuckSnap.docs) {
            const stuckData = stuckDoc.data();
            // sendingAt é salvo agora — detector funciona corretamente
            const updatedAt = stuckData.sendingAt || stuckData.createdAt;
            if (updatedAt?.toMillis && updatedAt.toMillis() < tenMinAgo.toMillis()) {
                await stuckDoc.ref.update({ status: "pending" });
                console.log(`🔄 Item ${stuckDoc.id} destravado`);
            }
        }

        // Busca próximo lote (ordenado para ser determinístico)
        const pendingSnap = await db.collection(`broadcast_queue/${jobId}/items`)
            .where("status", "==", "pending")
            .orderBy("createdAt", "asc")
            .limit(jobData.config?.batchSize || 3)
            .get();

        if (pendingSnap.empty) {
            await db.doc(`broadcast_queue/${jobId}`).update({
                status: "completed",
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Job ${jobId} finalizado`);
            return;
        }

        await db.doc(`broadcast_queue/${jobId}`).update({ status: "processing" });

        let batchSent = 0;
        let batchFailed = 0;
        let batchInvalid = 0;

        for (const itemDoc of pendingSnap.docs) {
            const item = itemDoc.data();
            const firstName = (item.studentName || "").split(" ")[0] || "Aluno";

            try {
                // ✅ FIX RACE CONDITION: transação atômica garante que só uma execução
                // processa este item, mesmo se dois crons rodarem ao mesmo tempo
                const alreadyClaimed = await db.runTransaction(async (tx) => {
                    const fresh = await tx.get(itemDoc.ref);
                    if (fresh.data()?.status !== "pending") return true; // outro cron pegou
                    tx.update(itemDoc.ref, {
                        status: "sending",
                        sendingAt: admin.firestore.FieldValue.serverTimestamp(),
                        attempts: admin.firestore.FieldValue.increment(1)
                    });
                    return false;
                });
                if (alreadyClaimed) {
                    console.log(`⏭️ Item ${itemDoc.id} já processado por outra execução, pulando`);
                    continue;
                }

                // ✅ FIX RESILIÊNCIA: resolveWhatsAppNumber está dentro do try/catch por aluno.
                // Se der timeout ou erro de rede, cai aqui → marca "failed" → lote continua.
                // Não aborta o lote inteiro por falha de um único aluno.
                const toNumber = await resolveWhatsAppNumber(
                    cleanHost,
                    megaConfig.instanceKey,
                    megaConfig.token,
                    item.phone
                );

                if (!toNumber) {
                    await itemDoc.ref.update({
                        status: "invalid_number",
                        error: "Número não encontrado no WhatsApp (principal e variante testados)"
                    });
                    batchInvalid++;
                    console.log(`⚠️ Número inválido para ${firstName}`);
                    continue;
                }
                // Nota: se resolveWhatsAppNumber lançar (falha de rede), cai no catch abaixo
                // e fica como "failed" (retentável), não "invalid_number" (definitivo)

                // Monta mensagem personalizada
                const selectedMessage = jobData.messages[Math.floor(Math.random() * jobData.messages.length)];
                const personalizedMessage = selectedMessage.replaceAll("{{NOME}}", firstName);

                // Envia para o número validado
                const response = await axios.post(
                    `${cleanHost}/rest/sendMessage/${megaConfig.instanceKey}/text`,
                    { messageData: { to: toNumber, text: personalizedMessage } },
                    {
                        headers: {
                            Authorization: `Bearer ${megaConfig.token}`,
                            "Content-Type": "application/json"
                        },
                        timeout: 15000
                    }
                );

                if (response.status === 200) {
                    await itemDoc.ref.update({
                        status: "sent",
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                        resolvedPhone: toNumber
                    });
                    batchSent++;
                    console.log(`✅ Enviado para ${firstName} (${toNumber})`);
                } else {
                    throw new Error(`Status inesperado: ${response.status}`);
                }

            } catch (error) {
                console.error(`Erro para ${item.studentName}:`, error.message);
                await itemDoc.ref.update({
                    status: "failed",
                    error: error.message
                });
                batchFailed++;
            }

            // Delay humano entre envios dentro do lote
            const isLastItem = pendingSnap.docs.indexOf(itemDoc) === pendingSnap.docs.length - 1;
            if (!isLastItem) {
                const delay = Math.floor(Math.random() * (
                    (jobData.config?.maxDelay || 60) - (jobData.config?.minDelay || 45) + 1
                )) + (jobData.config?.minDelay || 45);
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
        }

        // Atualiza progresso
        await db.doc(`broadcast_queue/${jobId}`).update({
            "progress.sent": admin.firestore.FieldValue.increment(batchSent),
            "progress.failed": admin.firestore.FieldValue.increment(batchFailed),
            "progress.invalid": admin.firestore.FieldValue.increment(batchInvalid),
            "progress.currentBatch": admin.firestore.FieldValue.increment(1)
        });

        // Agenda próxima execução (8-12 min)
        const nextDelay = Math.floor(Math.random() * 5 + 8) * 60 * 1000;
        await db.doc(`broadcast_queue/${jobId}`).update({
            nextProcessAt: admin.firestore.Timestamp.fromMillis(Date.now() + nextDelay),
            status: "pending"
        });

        console.log(`📊 Lote: ${batchSent} enviados | ${batchFailed} falhas | ${batchInvalid} inválidos`);

    } catch (error) {
        console.error(`Erro no job ${jobId}:`, error);
        await db.doc(`broadcast_queue/${jobId}`).update({
            status: "error",
            error: error.message
        });
    }
}

// ============================================================================
// 📊 STATUS DO BROADCAST
// ============================================================================

exports.getBroadcastStatus = functions.https.onCall(async (data, context) => {
    ensureDb();
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Não autenticado');
    }

    try {
        const jobsSnap = await db.collection("broadcast_queue")
            .orderBy("createdAt", "desc")
            .limit(20)
            .get();

        const jobs = [];
        for (const doc of jobsSnap.docs) {
            const jobData = doc.data();

            const itemsSnap = await db.collection(`broadcast_queue/${doc.id}/items`)
                .orderBy("sentAt", "desc")
                .limit(50)
                .get();

            const items = itemsSnap.docs.map(itemDoc => ({
                id: itemDoc.id,
                ...itemDoc.data()
            }));

            jobs.push({ id: doc.id, ...jobData, items });
        }

        return { success: true, jobs };

    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});