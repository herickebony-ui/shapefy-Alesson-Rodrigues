// FORÇANDO A IMPORTAÇÃO DA V1 (Garante que .pubsub.schedule funcione)
const functions = require("firebase-functions/v1");
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}
const admin = require("firebase-admin");
const axios = require("axios");
const { addDays, format } = require("date-fns");

// Inicialização única
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// CONFIGURAÇÕES DO EMAILJS
const EMAILJS = {
    SERVICE_ID: process.env.EMAILJS_SERVICE_ID,
    TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID,
    PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY,
    PRIVATE_KEY: process.env.EMAILJS_PRIVATE_KEY,
};

const EMAILJS_MISSING = ["SERVICE_ID", "TEMPLATE_ID", "PUBLIC_KEY", "PRIVATE_KEY"].filter((k) => !EMAILJS[k]);

if (EMAILJS_MISSING.length) {
    console.warn("⚠️ EmailJS não configurado (faltando):", EMAILJS_MISSING.map(k => `EMAILJS_${k}`).join(", "));
    // NÃO dar throw aqui, senão o deploy não consegue carregar o código.
}

// ============================================================================
// CONFIGURAÇÃO DO RESPONSÁVEL PADRÃO (CAIO)
// ============================================================================
const RESPONSAVEL_PADRAO = {
    id: "FCaPyMt55NYfzPsaTyD1oKmLmAs2",
    name: "Caio Sousa Pereira",
    email: "caiosousa952@gmail.com"
};

// ============================================================================
// 1. LEMBRETES DIÁRIOS (CRON JOB) — CORRIGIDO (EmailJS params)
// ============================================================================
exports.dispararLembretesDiarios = functions.pubsub
    .schedule("every day 09:00")
    .timeZone("America/Sao_Paulo")
    .onRun(async () => {
        if (EMAILJS_MISSING.length) {
            console.log("⏭️ Pulando envio de Email: EmailJS não configurado no ambiente.");
            return null;
        }
        console.log("=== ROTINA DE LEMBRETES DIÁRIOS ===");
        try {
            const configRef = await db.doc("settings/feedback_reminder_template").get();
            if (!configRef.exists) return null;

            const config = configRef.data() || {};
            if (!config.enabled) return null;

            const hoje = new Date();
            const diasAntecedencia = 1; // sempre 1 dia antes
            const dataAlvo = addDays(hoje, diasAntecedencia);
            const dataAlvoString = format(dataAlvo, "yyyy-MM-dd");

            console.log("Data alvo:", dataAlvoString);

            const snapshot = await db.collection("feedback_schedules").get();
            const promises = [];

            for (const doc of snapshot.docs) {
                const dados = doc.data() || {};
                const studentId = doc.id;

                const temFeedback = (dados.dates || []).find(
                    (i) => i && i.status !== "done" && i.date === dataAlvoString
                );

                if (!temFeedback) continue;

                const studentDoc = await db.collection("students").doc(studentId).get();
                if (!studentDoc.exists) continue;

                const studentData = studentDoc.data() || {};
                const email = studentData.email;
                if (!email) continue;

                if (!config.sendChannels?.email) continue;

                const nome = studentData.name || "Aluno";
                const firstName = (nome.split(" ")[0] || "Aluno");

                const subject = (config.emailSubjectTemplate || "Lembrete")
                    .replace("{{DATA}}", format(dataAlvo, "dd/MM"));

                let msg = (config.emailTemplate || "")
                    .replaceAll("{{NOME}}", firstName)
                    .replaceAll("{{DATA}}", format(dataAlvo, "dd/MM"))
                    .replaceAll("{{LINK}}", config.link || "");

                // ✅ PARAMS CORRETOS (batem com teu template do EmailJS)
                const templateParams = {
                    subject: subject,
                    conteudo_dinamico: msg,
                    email_destino: email,                     // To Email: {{email_destino}}
                    nome_instrutor: "Consultoria Ebony Team",  // From Name: {{nome_instrutor}}
                    email: "consultoria.ebonyteam@gmail.com",  // Reply To: {{email}}
                };

                console.log("📨 Enviando para:", email, "| aluno:", studentId);

                // ✅ ENVIA COM DELAY (evita bloqueio)
                const enviarComDelay = async () => {
                    // Delay aleatório de 2-5 segundos entre cada email
                    const delay = Math.floor(Math.random() * 3000) + 2000;
                    await new Promise(resolve => setTimeout(resolve, delay));

                    return axios.post("https://api.emailjs.com/api/v1.0/email/send", {
                        service_id: EMAILJS.SERVICE_ID,
                        template_id: EMAILJS.TEMPLATE_ID,
                        user_id: EMAILJS.PUBLIC_KEY,
                        accessToken: EMAILJS.PRIVATE_KEY,
                        template_params: templateParams,
                    });
                };

                promises.push(enviarComDelay());
            }

            await Promise.allSettled(promises);
            console.log("✅ Total de e-mails disparados:", promises.length);
            return null;

        } catch (error) {
            console.error("Erro lembretes:", error?.response?.data || error?.message || error);
            return null;
        }
    });

// ============================================================================
// 1B. LEMBRETES WHATSAPP (CRON) — COM "TIRO DUPLO" (RESOLVE O PROBLEMA DO 9º DÍGITO)
// ============================================================================
exports.dispararLembretesWhatsApp = functions.pubsub
    .schedule("every hour")
    .timeZone("America/Bahia")
    .onRun(async () => {
        console.log("=== ROTINA WHATSAPP (MODO LOTES + TIRO DUPLO) ===");

        try {
            // 1) Carrega config
            const configSnap = await db.doc("settings/feedback_reminder_template").get();
            if (!configSnap.exists) return null;

            const config = configSnap.data() || {};
            if (!config.enabled) return null;

            const whatsappEnabled = config?.sendChannels?.whatsapp === true || config?.sendChannels?.sms === true;
            if (!whatsappEnabled) return null;

            // 2) Configurações de Tempo
            const timeZone = config.timeZone || "America/Bahia";
            const daysBefore = Number(config.whatsappDaysBefore ?? 1);
            const startHour = Number(config.whatsappSendHour ?? 9);
            const endHour = startHour + 8;

            const now = new Date();
            const nowHourTZ = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hour12: false }).format(now));

            // ✅ TRAVA DE HORÁRIO ATIVA (5h - 20h)
            if (nowHourTZ < 5 || nowHourTZ >= 20) {
                console.log(`💤 Fora do horário permitido (${nowHourTZ}h). Janela: 5h - 20h`);
                return null;
            }

            const minDelay = Number(config.minDelay ?? 90);
            const maxDelay = Number(config.maxDelay ?? 180);
            const BATCH_LIMIT = 8;

            // 4) Data Alvo
            const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
            const base = new Date(`${todayISO}T12:00:00Z`);
            const targetISO = format(addDays(base, daysBefore), "yyyy-MM-dd");

            console.log(`WhatsApp | Processando Lote | Data Alvo: ${targetISO}`);

            // 5) Carrega MegaAPI
            const megaSnap = await db.doc("settings/whatsapp_config").get();
            const mega = megaSnap.data() || {};
            if (!mega.host || !mega.instanceKey || !mega.token) return null;

            const normalizeToWhatsApp = (raw) => {
                let clean = String(raw || "").replace(/\D/g, "");
                if (!clean) return null;
                if (clean.length >= 10 && clean.length <= 11) clean = "55" + clean;
                return `${clean}@s.whatsapp.net`;
            };

            const cleanHost = (() => {
                let h = String(mega.host || "").trim();
                if (!h.startsWith("http")) h = `https://${h}`;
                return h.replace(/\/$/, "");
            })();

            // Helper de envio (Usa o payload messageData que validamos no frontend)
            const sendMegaText = async (to, text) => {
                const url = `${cleanHost}/rest/sendMessage/${mega.instanceKey}/text`;
                // Payload validado:
                return axios.post(url, { messageData: { to, text } }, { headers: { Authorization: `Bearer ${mega.token}`, "Content-Type": "application/json" } });
            };

            // 6) Busca Candidatos
            const ids = new Set();
            const q1 = await db.collection("feedback_schedules").where("pendingFeedbackDates", "array-contains", targetISO).get();
            q1.docs.forEach((d) => ids.add(d.id));
            const q2 = await db.collection("feedback_schedules").where("pendingTrainingDates", "array-contains", targetISO).get();
            q2.docs.forEach((d) => ids.add(d.id));

            console.log(`Total de candidatos hoje: ${ids.size}`);

            // 7) Dispara o LOTE
            let sentCount = 0;

            for (const studentId of ids) {
                if (sentCount >= BATCH_LIMIT) {
                    console.log(`🛑 Limite de lote (${BATCH_LIMIT}) atingido.`);
                    break;
                }

                const logRef = db.collection("whatsapp_reminder_logs").doc(`${studentId}_${targetISO}_WA`);
                const logSnap = await logRef.get();
                if (logSnap.exists) continue;

                const scheduleRef = db.collection("feedback_schedules").doc(studentId);
                const scheduleSnap = await scheduleRef.get();
                const studentSnap = await db.collection("students").doc(studentId).get();

                if (!scheduleSnap.exists || !studentSnap.exists) continue;

                const student = studentSnap.data();
                const nome = student.name || "Aluno";
                const firstName = (String(nome).split(" ")[0] || "Aluno");

                // Formata o número original (com sufixo @s.whatsapp.net)
                const toOriginal = normalizeToWhatsApp(student.whatsapp || student.phone);

                if (!toOriginal) {
                    await logRef.set({ status: "skipped_no_phone", attempts: 1 });
                    continue;
                }

                // ✅ IDENTIFICA O TIPO DO FEEDBACK (training ou feedback)
                const scheduleData = scheduleSnap.data() || {};
                const datas = Array.isArray(scheduleData.dates) ? scheduleData.dates : [];
                const itemDoFeedback = datas.find(d => d?.date === targetISO);
                const tipoFeedback = itemDoFeedback?.type || "feedback"; // padrão: feedback

                // ✅ ESCOLHE VARIAÇÃO CONFORME O TIPO
                let variacoes = [];
                if (tipoFeedback === "training") {
                    // Se for TREINO, usa variações 1 e 2 de treino
                    variacoes = [
                        config.smsTemplateTraining1 || "",
                        config.smsTemplateTraining2 || ""
                    ].filter(Boolean);
                } else {
                    // Se for FEEDBACK NORMAL, usa variações 1 e 2 de feedback
                    variacoes = [
                        config.smsTemplateFeedback1 || "",
                        config.smsTemplateFeedback2 || ""
                    ].filter(Boolean);
                }

                // Se não tiver nenhuma variação configurada, usa o template antigo como fallback
                if (variacoes.length === 0) {
                    variacoes = [config.smsTemplate || "Olá {{NOME}}! Lembrete de {{DATA}}. {{LINK}}"];
                }

                const templateEscolhido = variacoes[Math.floor(Math.random() * variacoes.length)];

                const msg = String(templateEscolhido)
                    .replaceAll("{{NOME}}", firstName)
                    .replaceAll("{{DATA}}", format(new Date(`${targetISO}T12:00:00Z`), "dd/MM"))
                    .replaceAll("{{LINK}}", config.link || "");

                try {
                    await logRef.set({
                        studentId,
                        targetDate: targetISO,
                        status: "sending",
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // === AQUI ESTÁ A MUDANÇA: O TIRO DUPLO ===
                    const envios = [];

                    // 1. Tenta o original (Ex: 5573999998888@...)
                    envios.push(sendMegaText(toOriginal, msg));

                    // 2. Verifica se precisa tentar SEM o 9º dígito
                    // Remove o sufixo para checar o tamanho
                    const cleanNumber = toOriginal.replace('@s.whatsapp.net', '');

                    // Se tiver 13 dígitos (55 + 2 DDD + 9 + 8)
                    if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
                        const ddd = cleanNumber.substring(2, 4); // Ex: 73
                        const resto = cleanNumber.substring(5);  // Pula o 9
                        const toNoNine = `55${ddd}${resto}@s.whatsapp.net`;

                        console.log(`🔫 Tiro Duplo para ${firstName}: Tentando também sem o 9 (${toNoNine})`);
                        envios.push(sendMegaText(toNoNine, msg));
                    }

                    // Dispara todos (Promise.allSettled não trava se um falhar)
                    await Promise.allSettled(envios);
                    // ==========================================

                    await logRef.update({
                        status: "sent",
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    sentCount++;
                    console.log(`✅ [${sentCount}/${BATCH_LIMIT}] Processado para ${firstName}`);

                    const tempoEspera = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
                    if (sentCount < BATCH_LIMIT) {
                        await new Promise((resolve) => setTimeout(resolve, tempoEspera));
                    }

                } catch (err) {
                    console.error(`Erro ao enviar para ${firstName}:`, err.message);
                    await logRef.update({
                        status: "error",
                        error: String(err?.response?.data || err?.message)
                    });
                }
            }

            console.log(`🏁 Lote finalizado. Total enviados: ${sentCount}`);
            return null;

        } catch (error) {
            console.error("Erro fatal cron:", error);
            return null;
        }
    });
// ============================================================================
// 2. WEBHOOK SHAPEFY (RECEBIMENTO, FINALIZAÇÃO E "LIMBO")
// ============================================================================
exports.receberWebhookShapefy = functions.https.onRequest(async (req, res) => {
    try {
        if (req.method !== "POST") return res.status(405).send("Método não permitido.");
        const dados = req.body || {};

        const emailAluno = dados.email;
        const statusRaw = dados.status;
        const feedbackId = dados.feedback_id;

        // ✅ data real do evento: preferir "modified" (última atualização no Frappe)
        const rawEventDate = dados.modified || dados.ultima_atualizacao || dados.data || "";

        if (!feedbackId) return res.status(400).send("ID do Feedback é obrigatório.");
        if (!statusRaw) return res.status(400).send("Status é obrigatório.");

        // -----------------------------
        // Helpers de data (bem robustos)
        // -----------------------------
        const toISODate = (raw) => {
            if (!raw) return null;
            const s = String(raw).trim();

            // dd/mm/yyyy
            if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
                const [dd, mm, yyyy] = s.split(/[\/\s]/);
                return `${yyyy}-${mm}-${dd}`;
            }

            // yyyy-mm-dd (ou yyyy-mm-dd HH:mm:ss)
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) return `${m[1]}-${m[2]}-${m[3]}`;

            // tenta parse geral
            const d = new Date(s);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

            return null;
        };

        const isoEventDate = toISODate(rawEventDate); // YYYY-MM-DD
        const nowISO = new Date().toISOString();

        const statusNorm = String(statusRaw).trim().toLowerCase();
        const isRespondido = statusNorm === "respondido";
        const isFinalizado = ["finalizado", "concluído", "concluido", "done"].includes(statusNorm);

        console.log("📩 Webhook:", { feedbackId, status: statusRaw, isoEventDate, rawEventDate });

        // -----------------------------------------
        // 1) Localiza/alinha o aluno pelo email
        // -----------------------------------------
        if (!emailAluno) return res.status(400).send("Email obrigatório.");

        const studentsSnap = await db.collection("students").where("email", "==", emailAluno).limit(1).get();
        if (studentsSnap.empty) {
            await db.collection("unidentified_feedbacks").add({
                studentEmail: emailAluno,
                studentName: dados.nome_aluno || "Desconhecido",
                frappeFeedbackId: feedbackId,
                frappePayload: dados,
                receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: "waiting_link",
                reason: "Email não encontrado no banco de alunos"
            });
            return res.json({ success: true, action: "limbo" });
        }

        const studentDoc = studentsSnap.docs[0];
        const studentId = studentDoc.id;
        const studentData = studentDoc.data() || {};

        // -----------------------------------------
        // 2) Carrega schedule do aluno
        // -----------------------------------------
        const scheduleRef = db.collection("feedback_schedules").doc(studentId);
        const scheduleSnap = await scheduleRef.get();
        if (!scheduleSnap.exists) return res.status(200).send("Sem calendário configurado.");

        const scheduleData = scheduleSnap.data() || {};
        const datas = Array.isArray(scheduleData.dates) ? [...scheduleData.dates] : [];

        // -----------------------------------------
        // 3) Achar a LINHA CERTA pra mexer:
        //    3.1 primeiro por frappeFeedbackId (mais seguro)
        //    3.2 senão, por janela ±7 dias usando isoEventDate (modified)
        // -----------------------------------------
        const dayDiffAbs = (aISO, bISO) => {
            const a = new Date(aISO + "T12:00:00");
            const b = new Date(bISO + "T12:00:00");
            return Math.abs((a - b) / (1000 * 60 * 60 * 24));
        };

        let idx = datas.findIndex(d => String(d?.frappeFeedbackId || "") === String(feedbackId));

        if (idx === -1 && isoEventDate) {
            let best = -1;
            let bestDiff = Infinity;

            for (let i = 0; i < datas.length; i++) {
                const d = datas[i];
                if (!d?.date) continue;

                const diff = dayDiffAbs(d.date, isoEventDate);

                // ✅ regra: só aceita se estiver dentro de 7 dias pra mais/menos
                if (diff <= 7 && diff < bestDiff) {
                    bestDiff = diff;
                    best = i;
                }
            }

            idx = best;
        }

        if (idx === -1) {
            console.warn("⚠️ Nenhuma data do cronograma bateu com a janela ±7 dias.", { feedbackId, isoEventDate });
            return res.json({ success: true, action: "no_match_date" });
        }

        const itemAlvo = datas[idx];

        // -----------------------------------------
        // 4) Atualiza a linha do schedule conforme status do Frappe
        // -----------------------------------------
        const basePatch = {
            received: true,
            receivedAt: nowISO,
            frappeFeedbackId: feedbackId,
            frappeStatus: statusRaw,
            frappeEventDate: isoEventDate || null,
            frappeEventRaw: String(rawEventDate || "")
        };

        if (isFinalizado) {
            datas[idx] = {
                ...itemAlvo,
                ...basePatch,
                status: "done",
                completedAt: nowISO,
                completedDate: isoEventDate || itemAlvo.date
            };
        } else if (isRespondido) {
            // ✅ reabrir: volta pra pending e limpa campos de conclusão
            datas[idx] = {
                ...itemAlvo,
                ...basePatch,
                status: "pending",
                completedAt: admin.firestore.FieldValue.delete(),
                completedDate: admin.firestore.FieldValue.delete()
            };
            // (obs: FieldValue.delete não funciona dentro do array assim)
            // então vamos remover manualmente:
            delete datas[idx].completedAt;
            delete datas[idx].completedDate;
        } else {
            // outros status: só marca recebido e deixa como está
            datas[idx] = { ...itemAlvo, ...basePatch };
        }

        // -----------------------------------------
        // 5) Recalcula pendingFeedbackDates / pendingTrainingDates
        // -----------------------------------------
        const pendingFeedbackDates = datas
            .filter(d => d?.date && d.type === "feedback" && d.status !== "done")
            .map(d => d.date);

        const pendingTrainingDates = datas
            .filter(d => d?.date && d.type === "training" && d.status !== "done")
            .map(d => d.date);

        await scheduleRef.update({
            dates: datas,
            pendingFeedbackDates,
            pendingTrainingDates,
            updatedAt: nowISO
        });

        // -----------------------------------------
        // 6) ✅ CRIAR TAREFA DE TROCA DE TREINO
        //    Só cria se: status = "respondido" E type = "training"
        // -----------------------------------------
        let tarefaCriada = false;

        if (isRespondido && itemAlvo.type === "training") {
            // Verifica se já existe tarefa para este feedbackId (evita duplicatas)
            const tarefaExistente = await db.collection("tasks")
                .where("frappeFeedbackId", "==", feedbackId)
                .limit(1)
                .get();

            if (tarefaExistente.empty) {
                const nomeAluno = studentData.name || dados.nome_aluno || "Aluno";

                // Calcula vencimento: 3 dias depois às 12:00
                const vencimento = new Date();
                vencimento.setDate(vencimento.getDate() + 3);
                vencimento.setHours(12, 0, 0, 0);

                await criarTarefaTrocaTreino(
                    studentId,
                    nomeAluno,
                    { id: studentId, ...studentData },
                    feedbackId,
                    vencimento.toISOString()
                );

                tarefaCriada = true;
                console.log("✅ Tarefa de troca de treino criada para:", nomeAluno);
            } else {
                console.log("⏭️ Tarefa já existe para este feedbackId:", feedbackId);
            }
        }

        return res.json({
            success: true,
            action: isFinalizado ? "closed" : (isRespondido ? "reopened" : "updated"),
            matchedScheduleDate: itemAlvo.date,
            eventDate: isoEventDate
        });

    } catch (error) {
        console.error("Erro webhook:", error);
        return res.status(500).send("Erro interno.");
    }
});


// ============================================================================
// 3. ROBÔ DE NOVOS ALUNOS (Recuperado)
// ============================================================================
exports.monitorarNovosContratos = functions.firestore
    .document("contracts/{contractId}")
    .onCreate(async (snap, context) => {
        const contractData = snap.data();
        const studentId = contractData.studentId;
        const studentName = contractData.studentName || "Novo Aluno";

        console.log(`🤖 [Novo Contrato] Detectado para: ${studentName}`);

        try {
            const studentDoc = await db.collection("students").doc(studentId).get();
            const dadosBadge = studentDoc.exists ? { id: studentId, ...studentDoc.data() } : { id: studentId, name: studentName };

            await criarTarefa(
                studentId,
                studentName,
                dadosBadge,
                "col_novos_alunos",
                ["Nova Aluna", "Onboarding", "Tarefa Automatizada"],
                "Iniciar Onboarding",
                `**Novo Contrato Gerado!**\n\nO contrato foi criado e o link enviado.\nStatus: ${contractData.status}\nData: ${new Date().toLocaleDateString('pt-BR')}`
            );
            console.log("✅ Tarefa de Onboarding criada.");
        } catch (error) {
            console.error("Erro ao criar tarefa de contrato:", error);
        }
    });

// ============================================================================
// 4. ROBÔ DE RENOVAÇÃO (Recuperado)
// ============================================================================
exports.monitorarRenovacoesFinanceiras = functions.firestore
    .document("payments/{paymentId}")
    .onCreate(async (snap, context) => {
        const paymentData = snap.data();
        if (!paymentData.renewedFromPaymentId) {
            return null;
        }

        const studentId = paymentData.studentId;
        const studentName = paymentData.studentName || "Aluno";
        const planName = paymentData.planType || "Plano";

        console.log(`🤖 [Renovação Detectada] ${studentName} - ${planName}`);

        try {
            const studentDoc = await db.collection("students").doc(studentId).get();
            const dadosBadge = studentDoc.exists ? { id: studentId, ...studentDoc.data() } : { id: studentId, name: studentName };

            await criarTarefa(
                studentId,
                studentName,
                dadosBadge,
                "col_automatizadas",
                ["Renovação", "Enviar Contrato"],
                `Renovação: ${planName}`,
                `**Plano Renovado no Financeiro!**\n\nPlano: ${planName}\nValor: R$ ${paymentData.netValue}\n\n-> Atualizar datas no sistema\n-> Enviar novo contrato`
            );
            console.log("✅ Tarefa de Renovação criada.");
        } catch (error) {
            console.error("Erro ao criar tarefa de renovação:", error);
        }
    });

// ============================================================================
// FUNÇÃO AUXILIAR UNIFICADA (Serve para todos os Robôs)
// ============================================================================
async function criarTarefa(studentId, title, studentData, columnId, tags, shortDesc, fullDesc, originId = null) {
    const now = new Date();
    const createdAtISO = now.toISOString();
    const createdAtBR = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const createdAtUnix = now.getTime();

    const ref = await db.collection("tasks").add({
        title: title,
        studentData: studentData,
        demandTypes: tags,
        columnId: columnId,

        shortDescription: shortDesc || "",
        description: fullDesc || "",

        status: "pending",
        completed: false,
        priority: columnId === "col_novos_alunos" ? "Novos Alunos" : "Automatizadas",

        studentId: studentId,
        studentName: title,

        frappeFeedbackId: originId,

        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),

        createdAtISO: createdAtISO,
        createdAtBR: createdAtBR,
        createdAtUnix: createdAtUnix,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: "Sistema (Robô)",
        origin: "Automação"
    });

    console.log("✅ Task criada no Firestore:", ref.id, "| frappeFeedbackId:", originId);
    return ref.id;
}

// ============================================================================
// ✅ NOVA FUNÇÃO: CRIAR TAREFA DE TROCA DE TREINO (ESPECÍFICA)
// ============================================================================
async function criarTarefaTrocaTreino(studentId, nomeAluno, studentData, feedbackId, dueDateISO) {
    const now = new Date();
    const createdAtISO = now.toISOString();
    const createdAtBR = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const createdAtUnix = now.getTime();

    const ref = await db.collection("tasks").add({
        title: nomeAluno,
        studentData: studentData,
        studentId: studentId,
        studentName: nomeAluno,

        columnId: "col_semana",
        priority: "Essa Semana",
        status: "pending",
        completed: false,

        demandTypes: ["Montar Treino"],
        assignedTo: [RESPONSAVEL_PADRAO],

        dueDate: dueDateISO,

        shortDescription: "Feedback de treino respondido - montar novo treino",
        description: `**Troca de Treino Solicitada!**\n\nO aluno ${nomeAluno} respondeu o feedback de treino.\n\n→ Analisar respostas no Shapefy\n→ Montar novo treino\n→ Enviar para o aluno`,

        frappeFeedbackId: feedbackId,
        origin: "Automação Webhook",

        createdAtISO: createdAtISO,
        createdAtBR: createdAtBR,
        createdAtUnix: createdAtUnix,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: "Sistema (Robô)",
        lastEditedBy: "Sistema (Robô)",
        lastEditedAt: createdAtISO
    });

    console.log("✅ Tarefa de Troca de Treino criada:", ref.id, "| Aluno:", nomeAluno);
    return ref.id;
}