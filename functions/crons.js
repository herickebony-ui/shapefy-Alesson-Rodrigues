const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const axios = require("axios");
const { addDays, format } = require("date-fns");
const { normalizePhone, getPhoneVariant } = require("./utils/phone");

if (!admin.apps.length) {
    admin.initializeApp();
}
let db;
const ensureDb = () => {
    if (!db) {
        db = admin.firestore();
        try { db.settings({ databaseId: 'default' }); } catch (e) {}
    }
    return db;
};

// ============================================================================
// 1. LEMBRETES DIÁRIOS (CRON JOB) — CORRIGIDO (EmailJS params)
// ============================================================================
exports.dispararLembretesDiarios = functions
    .runWith({
        secrets: ["EMAILJS_SERVICE_ID", "EMAILJS_TEMPLATE_ID", "EMAILJS_PUBLIC_KEY", "EMAILJS_PRIVATE_KEY"],
        timeoutSeconds: 540,
        memory: "512MB"
    })
    .pubsub.schedule("every day 09:00")
    .timeZone("America/Sao_Paulo")
    .onRun(async () => {
        ensureDb();

        // ✅ Re-lê EMAILJS do runtime (secrets só ficam disponíveis após runWith)
        const EMAILJS = {
            SERVICE_ID: process.env.EMAILJS_SERVICE_ID,
            TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID,
            PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY,
            PRIVATE_KEY: process.env.EMAILJS_PRIVATE_KEY,
        };
        const EMAILJS_MISSING_RUNTIME = ["SERVICE_ID", "TEMPLATE_ID", "PUBLIC_KEY", "PRIVATE_KEY"].filter(k => !EMAILJS[k]);
        if (EMAILJS_MISSING_RUNTIME.length) {
            console.log("⏭️ Pulando envio de Email: EmailJS não configurado no runtime:", EMAILJS_MISSING_RUNTIME.join(", "));
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

                promises.push(
                    enviarComDelay()
                      .then(() => {
                        // ✅ Log de sucesso
                        return db.collection("communication_audit").add({
                          studentId,
                          studentName: nome,
                          email: email,
                          channel: "email",
                          status: "sent",
                          sentAt: admin.firestore.FieldValue.serverTimestamp(),
                          targetDate: dataAlvoString
                        });
                      })
                      .catch((err) => {
                        // ❌ Log de erro
                        return db.collection("communication_audit").add({
                          studentId,
                          studentName: nome,
                          email: email,
                          channel: "email",
                          status: "error",
                          error: String(err?.response?.data || err?.message || "Erro desconhecido"),
                          failedAt: admin.firestore.FieldValue.serverTimestamp(),
                          targetDate: dataAlvoString
                        });
                      })
                  );
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
// 6. PROCESSADOR DE FILA DE NOTIFICAÇÕES (Task Assignment - Buffer 3min)
// ============================================================================
exports.processTaskNotificationQueue = functions.pubsub
    .schedule("every 1 minutes")
    .timeZone("America/Bahia")
    .onRun(async () => {

	 
	  const db = admin.firestore(); 	 
	       
        console.log("=== PROCESSANDO FILA DE NOTIFICAÇÕES (TAREFAS) ===");

        try {
            // 1. Busca Configuração do WhatsApp
            const megaSnap = await db.doc("settings/whatsapp_config").get();
            const mega = megaSnap.data() || {};
            
            // Validação básica da API
            if (!mega.host || !mega.instanceKey || !mega.token) {
                console.log("⚠️ MegaAPI não configurada. Pulando notificações.");
                return null;
            }

            let cleanHost = String(mega.host || "").trim();
            if (!cleanHost.startsWith("http")) cleanHost = `https://${cleanHost}`;
            cleanHost = cleanHost.replace(/\/$/, "");

            // 2. Busca itens pendentes cujo horário já chegou ("scheduledFor" <= AGORA)
            const now = admin.firestore.Timestamp.now();
            const queueRef = db.collection('notification_queue');
            
            const snapshot = await queueRef
                .where('status', '==', 'pending')
                .where('scheduledFor', '<=', now)
                .get();

            if (snapshot.empty) return null;

            console.log(`🔔 Encontrados ${snapshot.size} itens na fila de espera.`);

            const batch = db.batch();

            for (const docSnapshot of snapshot.docs) {
                const item = docSnapshot.data();
                const queueId = docSnapshot.id;

                try {
                    // 3. VALIDAÇÃO DE SEGURANÇA E LEITURA DE DADOS FRESCOS
                    const taskRef = db.collection('tasks').doc(item.taskId);
                    const taskSnap = await taskRef.get();

                    // CASO A: Tarefa foi excluída nesses 3 minutos
                    if (!taskSnap.exists) {
                        console.log(`❌ Tarefa ${item.taskId} excluída. Cancelando envio.`);
                        batch.update(docSnapshot.ref, { 
                            status: 'cancelled_task_deleted', 
                            processedAt: admin.firestore.FieldValue.serverTimestamp() 
                        });
                        continue;
                    }

                    const taskData = taskSnap.data();
                    const assignedArr = Array.isArray(taskData.assignedTo) ? taskData.assignedTo : [];

                    // CASO B: O responsável mudou
                    const isStillOwner = assignedArr.some(u => u.id === item.targetUserId);

                    if (!isStillOwner) {
                        console.log(`⚠️ Responsável mudou. ${item.targetUserId} não está mais na tarefa. Pulando.`);
                        batch.update(docSnapshot.ref, { 
                            status: 'skipped_responsible_changed', 
                            processedAt: admin.firestore.FieldValue.serverTimestamp() 
                        });
                        continue;
                    }

                    // --- MUDANÇA CRUCIAL AQUI (MODO INTELIGENTE) ---
                    // Em vez de usar o payload antigo, usamos os dados FRESCOS do taskData que acabamos de baixar.
                    
                    // 1. Descobre a "Ação" atualizada (Tags ou Título)
                    const freshDemandTypes = taskData.demandTypes || [];
                    const freshTitle = taskData.title || "Sem título";
                    
                    // Lógica: Se tiver tags, usa tags. Se não, usa título.
                    const finalTaskTitle = (freshDemandTypes.length > 0) 
                        ? freshDemandTypes.join(", ") 
                        : freshTitle;

                    // 2. Pega dados atualizados de aluno e observação
                    const finalStudentName = taskData.studentData ? taskData.studentData.name : "";
                    const finalComment = taskData.shortDescription || ""; 
                    
                    // 3. Mantém a data original do agendamento (frontend já mandou formatada) 
                    // ou você pode formatar 'taskData.dueDate' aqui se quiser garantir atualização de prazo também
                    const { dueDate } = item.messagePayload; 
                    
                    // --------------------------------------------------

                    const assigner = item.assignerName || "Alguém";
                    const type = item.type || "task_assigned";

                    let messageText = "";

                    if (type === "comment_mention") {
                        // Para menções, mantemos a lógica original pois o comentário é estático
                        const lines = [];
                        lines.push(`*💬 ${assigner} comentou em tarefa*`);
                        lines.push("");
                        if (finalStudentName) {
                            lines.push(`Aluno: ${finalStudentName}`);
                        } else {
                            lines.push(`Tarefa: ${finalTaskTitle}`);
                        }
                        lines.push(`"${item.messagePayload.comment}"`); // Comentário do chat é específico
                        messageText = lines.join("\n");

                    } else if (type === "due_reminder") {
                        const lines = [];
                        lines.push("*⚠️ Lembrete de vencimento*");
                        lines.push("");
                        if (finalStudentName) {
                            lines.push(`Aluno: ${finalStudentName}`);
                            lines.push(`Ação: ${finalTaskTitle}`);
                        } else {
                            lines.push(`Tarefa: ${finalTaskTitle}`);
                        }
                        lines.push(`Prazo: ${dueDate}`);
                        messageText = lines.join("\n");

                    } else {
                        // TAREFA ATRIBUÍDA (O Principal)
                        const lines = [];
                        lines.push("*✅ Nova tarefa atribuída*");
                        lines.push("");
                        
                        if (finalStudentName) {
                            lines.push(`Aluno: ${finalStudentName}`);
                            // AQUI ESTÁ A CORREÇÃO: Usando finalTaskTitle (que contém as Tags)
                            lines.push(`Ação: ${finalTaskTitle}`);
                        } else {
                            lines.push(`Tarefa: ${finalTaskTitle}`);
                        }
                        
                        if (finalComment) lines.push(`Obs: ${finalComment}`);
                        
                        lines.push(`Prazo: ${dueDate}`);
                        lines.push(`Por: ${assigner}`);
                        messageText = lines.join("\n");
                    }

                    // 5. Prepara o número
                    let targetPhone = String(item.targetPhone || "").replace(/\D/g, "");
                    if (targetPhone.length >= 10 && targetPhone.length <= 11) targetPhone = "55" + targetPhone;

                    // 6. Envio
                    const phonesToTry = [targetPhone];
                    if (targetPhone.length === 13 && targetPhone.startsWith('55') && ['6','7','8','9'].includes(targetPhone.charAt(4))) {
                        const ddd = targetPhone.substring(2, 4);
                        const resto = targetPhone.substring(5);
                        phonesToTry.push(`55${ddd}${resto}`);
                    }

                    const sendPromises = phonesToTry.map(phone =>
                        axios.post(`${cleanHost}/rest/sendMessage/${mega.instanceKey}/text`, {
                            messageData: { to: phone, text: messageText }
                        }, {
                            headers: {
                                Authorization: `Bearer ${mega.token}`,
                                "Content-Type": "application/json"
                            }
                        }).catch(err => console.log(`Falha para ${phone}: ${err.message}`))
                    );

                    await Promise.allSettled(sendPromises);

                    console.log(`✅ Notificação enviada para ${item.targetName} (${targetPhone}) com Ação: ${finalTaskTitle}`);
                    
                    batch.update(docSnapshot.ref, { 
                        status: 'sent', 
                        processedAt: admin.firestore.FieldValue.serverTimestamp() 
                    });

                } catch (error) {
                    console.error(`Erro ao processar item ${queueId}:`, error.message);
                    batch.update(docSnapshot.ref, {
                        status: 'error',
                        errorLog: error.message,
                        processedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            await batch.commit();
            return null;

        } catch (error) {
            console.error("Erro fatal no processador de fila:", error);
            return null;
        }
    });
// ============================================================================
// 7. LEMBRETE DE VENCIMENTO (2 HORAS ANTES)
// ============================================================================
exports.processTaskDueReminders = functions.pubsub
    .schedule("every 15 minutes")
    .timeZone("America/Bahia")
    .onRun(async () => {
        ensureDb();

        try {
            const megaSnap = await db.doc("settings/whatsapp_config").get();
            const mega = megaSnap.data() || {};
            if (!mega.host || !mega.instanceKey || !mega.token) return null;

            let cleanHost = String(mega.host || "").trim();
            if (!cleanHost.startsWith("http")) cleanHost = `https://${cleanHost}`;
            cleanHost = cleanHost.replace(/\/$/, "");

            // Janela: entre agora e daqui 2 horas
            const now = new Date();
            const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

            const tasksSnap = await db.collection("tasks")
                .where("status", "==", "pending")
                .where("dueDate", ">=", now.toISOString())
                .where("dueDate", "<=", twoHoursFromNow.toISOString())
                .get();

            if (tasksSnap.empty) return null;

            for (const taskDoc of tasksSnap.docs) {
                const task = taskDoc.data();
                const taskId = taskDoc.id;

                // Checa se já enviou lembrete pra essa tarefa
                if (task.reminderSent === true) continue;

                const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [];
                if (assignees.length === 0) continue;

                const dueDate = new Date(task.dueDate);
                const dueDateStr = dueDate.toLocaleDateString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit"
                });

                const studentName = task.studentData?.name || "";
                const taskTitle = task.title || "Sem título";

                for (const user of assignees) {
                    if (!user.id) continue;

                    // Busca telefone do usuário
                    const userSnap = await db.collection("users").doc(user.id).get();
                    if (!userSnap.exists) continue;

                    const userData = userSnap.data();
                    const phone = userData.whatsapp || userData.phone || userData.celular || "";
                    let targetPhone = String(phone).replace(/\D/g, "");
                    if (targetPhone.length >= 10 && targetPhone.length <= 11) targetPhone = "55" + targetPhone;
                    if (targetPhone.length < 12) continue;

                    const lines = [];
                    lines.push(`⏰ *Lembrete de vencimento*`);
                    if (studentName) {
                        lines.push(`👤 *Aluno:* ${studentName}`);
                        lines.push(`📝 *Ação:* ${taskTitle}`);
                    } else {
                        lines.push(`📝 *Tarefa:* ${taskTitle}`);
                    }
                    lines.push(`📅 *Vence em:* ${dueDateStr}`);
                    lines.push(`\nAcesse o sistema para conferir.`);

                    try {
                        await axios.post(`${cleanHost}/rest/sendMessage/${mega.instanceKey}/text`, {
                            messageData: {
                                to: targetPhone,
                                text: lines.join("\n")
                            }
                        }, {
                            headers: {
                                Authorization: `Bearer ${mega.token}`,
                                "Content-Type": "application/json"
                            }
                        });
                    } catch (err) {
                        console.error(`Erro lembrete ${user.id}:`, err.message);
                    }
                }

                // Marca que já enviou lembrete (não repete)
                await taskDoc.ref.update({ reminderSent: true });
            }

            return null;
        } catch (error) {
            console.error("Erro no lembrete:", error);
            return null;
        }
    });
// ============================================================================
// PATCH — dispararLembretesWhatsApp
// Substitua TODA a função pelo bloco abaixo no seu crons.js
// Ctrl+F: "exports.dispararLembretesWhatsApp"
// ============================================================================

exports.dispararLembretesWhatsApp = functions.runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"], timeoutSeconds: 540, memory: "256MB" }).pubsub
    .schedule("every 15 minutes")
    .timeZone("America/Bahia")
    .onRun(async () => {
        ensureDb();
        console.log("=== ROTINA WHATSAPP (VALIDAÇÃO REAL DE NÚMERO) ===");

        const frappeApiKey = process.env.FRAPPE_API_KEY;
        const frappeApiSecret = process.env.FRAPPE_API_SECRET;
        const FRAPPE_BASE = "https://shapefy.online/api/resource";
        const buscarAlunoFrappe = async (studentId) => {
            try {
                const url = `${FRAPPE_BASE}/Aluno/${encodeURIComponent(studentId)}`;
                const res = await axios.get(url, {
                    headers: {
                        "Authorization": `token ${frappeApiKey}:${frappeApiSecret}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 10000
                });
                return res.data?.data || null;
            } catch (err) {
                console.error(`Erro ao buscar aluno ${studentId} no Frappe:`, err.message);
                return null;
            }
        };

        try {
            // 1) Carrega config
            const configSnap = await db.doc("settings/feedback_reminder_template").get();
            if (!configSnap.exists) return null;

            const config = configSnap.data() || {};
            if (!config.enabled) return null;

            // ✅ FIX CANAL: só WhatsApp autoriza esta rotina. SMS é canal separado.
            // Bug anterior: || sms === true fazia a rotina de WA rodar mesmo com só SMS ligado.
            const whatsappEnabled = config?.sendChannels?.whatsapp === true;
            if (!whatsappEnabled) return null;

            // 2) Configurações de tempo
            const timeZone = config.timeZone || "America/Bahia";
            const daysBefore = Number(config.whatsappDaysBefore ?? 1);

            const now = new Date();
            const nowHourTZ = Number(new Intl.DateTimeFormat("en-US", {
                timeZone, hour: "2-digit", hour12: false
            }).format(now));

            // Trava de horário (5h - 20h)
            if (nowHourTZ < 8 || nowHourTZ >= 18) {
                console.log(`💤 Fora do horário (${nowHourTZ}h). Janela: 8h-18h`);
                return null;
            }

            const minDelay = Number(config.minDelay ?? 180);
            const maxDelay = Number(config.maxDelay ?? 360);
            const BATCH_LIMIT = 3;

            // 3) Data alvo
            const todayISO = new Intl.DateTimeFormat("en-CA", {
                timeZone, year: "numeric", month: "2-digit", day: "2-digit"
            }).format(now);
            const base = new Date(`${todayISO}T12:00:00Z`);
            const targetISO = format(addDays(base, daysBefore), "yyyy-MM-dd");

            console.log(`WhatsApp | Processando lote | Data alvo: ${targetISO}`);

            // 4) Carrega MegaAPI
            const megaSnap = await db.doc("settings/whatsapp_config").get();
            const mega = megaSnap.data() || {};
            if (!mega.host || !mega.instanceKey || !mega.token) return null;

            const cleanHost = (() => {
                let h = String(mega.host || "").trim();
                if (!h.startsWith("http")) h = `https://${h}`;
                return h.replace(/\/$/, "");
            })();

            // ============================================================
            // 📞 HELPERS DE NÚMERO — lib unificada (BR + internacional)
            // ============================================================

            const resolveWhatsAppNumber = (raw) => {
                const main = normalizePhone(raw);
                if (!main) return null;
                const variant = getPhoneVariant(main);
                return variant || main;
            };

            // ============================================================

            const sendMegaText = async (to, text) => {
                const url = `${cleanHost}/rest/sendMessage/${mega.instanceKey}/text`;
                return axios.post(
                    url,
                    { messageData: { to, text } },
                    {
                        headers: { Authorization: `Bearer ${mega.token}`, "Content-Type": "application/json" },
                        timeout: 15000  // ✅ FIX: evita função Firebase travada se MegaAPI não responder
                    }
                );
            };

            // 5) Busca candidatos
            const ids = new Set();
            const q1 = await db.collection("feedback_schedules")
                .where("pendingFeedbackDates", "array-contains", targetISO).get();
            q1.docs.forEach(d => ids.add(d.id));
            const q2 = await db.collection("feedback_schedules")
                .where("pendingTrainingDates", "array-contains", targetISO).get();
            q2.docs.forEach(d => ids.add(d.id));

            console.log(`Total de candidatos hoje: ${ids.size}`);

            // 6) Processa o lote
            let sentCount = 0;

            for (const studentId of ids) {
                if (sentCount >= BATCH_LIMIT) {
                    console.log(`🛑 Limite de lote (${BATCH_LIMIT}) atingido.`);
                    break;
                }

                const logRef = db.collection("whatsapp_reminder_logs").doc(`${studentId}_${targetISO}_WA`);
                const logSnap = await logRef.get();
                if (logSnap.exists) continue;

                const scheduleSnap = await db.collection("feedback_schedules").doc(studentId).get();


                if (!scheduleSnap.exists) continue;


                const student = await buscarAlunoFrappe(studentId);


                if (!student) {


                    console.log(`⚠️ Aluno ${studentId} não encontrado no Frappe — pulando`);


                    continue;


                }


                const nome = student.nome_completo || "Aluno";
                const firstName = String(nome).split(" ")[0] || "Aluno";

                // ✅ FIX RESILIÊNCIA: try/catch isolado por aluno.
                // Se a MegaAPI der timeout ou 5xx, o erro é contido aqui.
                // O lote continua — um aluno instável não aborta os outros.
                // Log NÃO é criado → próxima execução do cron tenta novamente.
                let toNumber;
                try {
                    toNumber = await resolveWhatsAppNumber(student.telefone);
                } catch (resolveErr) {
                    console.error(`⚠️ Falha ao validar número de ${firstName} (retryável):`, resolveErr.message);
                    continue;
                }

                if (!toNumber) {
                    await logRef.set({
                        studentId,
                        studentName: nome,
                        targetDate: targetISO,
                        status: "invalid_number",
                        error: "Número não encontrado no WhatsApp",
                        attempts: 1,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    await db.collection("communication_audit").add({
                        studentId,
                        studentName: nome,
                        phone: student.telefone || null,
                        channel: "whatsapp",
                        status: "invalid_number",
                        failedAt: admin.firestore.FieldValue.serverTimestamp(),
                        targetDate: targetISO
                    });
                    console.log(`⚠️ Número inválido para ${firstName} — pulando`);
                    continue;
                }

                // Identifica tipo do feedback
                const scheduleData = scheduleSnap.data() || {};
                const datas = Array.isArray(scheduleData.dates) ? scheduleData.dates : [];
                const itemDoFeedback = datas.find(d => d?.date === targetISO);
                const tipoFeedback = itemDoFeedback?.type || "feedback";

                // Escolhe variação conforme tipo
                let variacoes = [];
                if (tipoFeedback === "training") {
                    variacoes = [config.smsTemplateTraining1 || "", config.smsTemplateTraining2 || ""].filter(Boolean);
                } else {
                    variacoes = [config.smsTemplateFeedback1 || "", config.smsTemplateFeedback2 || ""].filter(Boolean);
                }
                if (variacoes.length === 0) {
                    variacoes = [config.smsTemplate || "Olá {{NOME}}! Lembrete de {{DATA}}. {{LINK}}"];
                }

                const templateEscolhido = variacoes[Math.floor(Math.random() * variacoes.length)];
                const msg = String(templateEscolhido)
                    .replaceAll("{{NOME}}", firstName)
                    .replaceAll("{{DATA}}", format(new Date(`${targetISO}T12:00:00Z`), "dd/MM"))
                    .replaceAll("{{LINK}}", config.link || "");

                try {
                    // ✅ FIX RACE CONDITION: create() falha se o doc já existe
                    // Se dois crons rodarem ao mesmo tempo, apenas um avança — o outro lança e é ignorado
                    try {
                        await logRef.create({
                            studentId,
                            studentName: nome,
                            targetDate: targetISO,
                            status: "sending",
                            resolvedPhone: toNumber,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    } catch (createErr) {
                        if (createErr.code === 6) { // ALREADY_EXISTS
                            console.log(`⏭️ Log já existe para ${firstName} (${targetISO}), pulando`);
                            continue;
                        }
                        throw createErr;
                    }

                    // ✅ Envia APENAS para o número validado (sem tiro duplo)
                    await sendMegaText(toNumber, msg);

                    await logRef.update({
                        status: "sent",
                        sentAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    await db.collection("communication_audit").add({
                        studentId,
                        studentName: nome,
                        phone: toNumber,
                        channel: "whatsapp",
                        status: "sent",
                        messageType: tipoFeedback,
                        sentAt: admin.firestore.FieldValue.serverTimestamp(),
                        targetDate: targetISO
                    });

                    sentCount++;
                    console.log(`✅ [${sentCount}/${BATCH_LIMIT}] Enviado para ${firstName} (${toNumber})`);

                    // Delay humano entre envios
                    if (sentCount < BATCH_LIMIT) {
                        const tempoEspera = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
                        await new Promise(resolve => setTimeout(resolve, tempoEspera));
                    }

                } catch (err) {
                    console.error(`Erro ao enviar para ${firstName}:`, err.message);
                    await logRef.update({
                        status: "error",
                        error: String(err?.response?.data || err?.message)
                    });
                    await db.collection("communication_audit").add({
                        studentId,
                        studentName: nome,
                        phone: toNumber,
                        channel: "whatsapp",
                        status: "error",
                        error: String(err?.response?.data || err?.message),
                        failedAt: admin.firestore.FieldValue.serverTimestamp(),
                        targetDate: targetISO
                    });
                }
            }

            console.log(`🏁 Lote finalizado. Enviados: ${sentCount}`);
            return null;

        } catch (error) {
            console.error("Erro fatal cron:", error);
            return null;
        }
    });

exports.dispararFeedbacksAgendados = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"], timeoutSeconds: 300, memory: "512MB" })
    .pubsub.schedule("every day 08:00")
    .timeZone("America/Sao_Paulo")
    .onRun(async () => {
        const db = admin.firestore();
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        const headers = {
            "Authorization": `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json"
        };
        const FRAPPE = "https://shapefy.online/api/resource";

        // Amanhã no formato YYYY-MM-DD
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const amanhaISO = amanha.toISOString().split("T")[0];

        console.log(`🔍 Verificando feedbacks para: ${amanhaISO}`);

        const snap = await db.collection("feedback_schedules").get();
        let criados = 0, ignorados = 0, erros = 0;

        for (const docSnap of snap.docs) {
            const studentId = docSnap.id;
            const schedule = docSnap.data();
            const dates = schedule.dates || [];

            // Verifica se tem feedback amanhã pendente
            const temFeedbackAmanha = dates.some(d =>
                d.type === "feedback" &&
                d.status === "pending" &&
                d.date === amanhaISO
            );
            if (!temFeedbackAmanha) continue;

            // Busca dados do aluno no Firestore
            const studentDoc = await db.collection("students").doc(studentId).get();
            if (!studentDoc.exists) { console.warn(`⚠️ Aluno ${studentId} não encontrado`); continue; }
            const student = studentDoc.data();
            const email = student.email;
            if (!email) continue;

            try {
                // Busca aluno no Frappe pelo email
                const filtros = encodeURIComponent(JSON.stringify([
                    ["Aluno", "email", "=", email],
                    ["Aluno", "profissional", "=", "arteamconsultoria@gmail.com"]
                ]));
                const campos = encodeURIComponent(JSON.stringify(["name", "nome_completo", "email", "dieta", "treino"]));
                const searchRes = await fetch(`${FRAPPE}/Aluno?filters=${filtros}&fields=${campos}&limit_page_length=1`, { headers });
                if (!searchRes.ok) throw new Error(`Aluno não encontrado no Frappe: ${searchRes.status}`);
                const alunoFrappe = (await searchRes.json()).data?.[0];
                if (!alunoFrappe) { console.warn(`⚠️ Aluno com email ${email} não encontrado no Frappe`); continue; }

                // Determina o formulário pelo plano
                const formulario = alunoFrappe.treino === 1 ? "lh7dq5haei" : "jov7i98or1";
                const titulo = alunoFrappe.treino === 1 ? "Feedback — Plano Premium" : "Feedback — Plano Ouro";

                // Verifica se feedback já existe para evitar duplicata
                const checkFiltros = encodeURIComponent(JSON.stringify([
                    ["Feedback", "aluno", "=", alunoFrappe.name],
                    ["Feedback", "date", "=", amanhaISO]
                ]));
                const checkRes = await fetch(`${FRAPPE}/Feedback?filters=${checkFiltros}&fields=["name"]&limit_page_length=1`, { headers });
                if (checkRes.ok) {
                    const checkJson = await checkRes.json();
                    if (checkJson.data?.length > 0) {
                        console.log(`⏭️ Feedback já existe para ${alunoFrappe.nome_completo} em ${amanhaISO}`);
                        ignorados++;
                        continue;
                    }
                }                

                // Cria o Feedback no Frappe
                const novoFeedback = {
    formulario,
    titulo,
    aluno: alunoFrappe.name,
    nome_completo: alunoFrappe.nome_completo,
    profissional: "arteamconsultoria@gmail.com",
    date: amanhaISO,
    status: "Enviado",
    automatico: 0,
    email: alunoFrappe.email,
};
                const createRes = await fetch(`${FRAPPE}/Feedback`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(novoFeedback)
                });

                if (!createRes.ok) {
                    const errText = await createRes.text();
                    throw new Error(`Frappe ${createRes.status}: ${errText}`);
                }

                const created = (await createRes.json()).data;
                console.log(`✅ Feedback criado: ${created.name} → ${alunoFrappe.nome_completo} para ${amanhaISO}`);
                criados++;

            } catch (e) {
                console.error(`❌ Erro para ${student.name || studentId}:`, e.message);
                erros++;
            }
        }

        console.log(`📊 Resultado: ${criados} criados | ${ignorados} ignorados | ${erros} erros`);
        return null;
    });