const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

const RESPONSAVEL_PADRAO = {
    id: "FCaPyMt55NYfzPsaTyD1oKmLmAs2",
    name: "Caio Sousa Pereira",
    email: "caiosousa952@gmail.com"
};

async function criarTarefa(db, studentId, title, studentData, columnId, tags, shortDesc, fullDesc, originId = null) {
    const now = new Date();
    const ref = await db.collection("tasks").add({
        title, studentData, demandTypes: tags, columnId,
        shortDescription: shortDesc || "", description: fullDesc || "",
        status: "pending", completed: false,
        priority: columnId === "col_novos_alunos" ? "Novos Alunos" : "Automatizadas",
        studentId, studentName: title, frappeFeedbackId: originId,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdAtISO: now.toISOString(),
        createdAtBR: now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        createdAtUnix: now.getTime(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: "Sistema (Robô)", origin: "Automação"
    });
    return ref.id;
}

async function criarTarefaTrocaTreino(db, studentId, nomeAluno, studentData, feedbackId, dueDateISO) {
    const now = new Date();
    const ref = await db.collection("tasks").add({
        title: nomeAluno, studentData, studentId, studentName: nomeAluno,
        columnId: "col_semana", priority: "Essa Semana",
        status: "pending", completed: false,
        demandTypes: ["Montar Treino"], assignedTo: [RESPONSAVEL_PADRAO],
        dueDate: dueDateISO,
        shortDescription: "Feedback de treino respondido - montar novo treino",
        description: `**Troca de Treino Solicitada!**\n\nO aluno ${nomeAluno} respondeu o feedback de treino.\n\n→ Analisar respostas no Shapefy\n→ Montar novo treino\n→ Enviar para o aluno`,
        frappeFeedbackId: feedbackId, origin: "Automação Webhook",
        createdAtISO: now.toISOString(),
        createdAtBR: now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        createdAtUnix: now.getTime(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: "Sistema (Robô)", lastEditedBy: "Sistema (Robô)", lastEditedAt: now.toISOString()
    });
    return ref.id;
}

exports.receberWebhookShapefy = functions.https.onRequest(async (req, res) => {
    const db = admin.firestore();
    try {
        if (req.method !== "POST") return res.status(405).send("Método não permitido.");
        const dados = req.body || {};
        const emailAluno = dados.email, statusRaw = dados.status, feedbackId = dados.feedback_id;
        const rawEventDate = dados.modified || dados.ultima_atualizacao || dados.data || "";
        if (!feedbackId) return res.status(400).send("ID do Feedback é obrigatório.");
        if (!statusRaw) return res.status(400).send("Status é obrigatório.");
        const toISODate = (raw) => {
            if (!raw) return null;
            const s = String(raw).trim();
            if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [dd, mm, yyyy] = s.split(/[\/\s]/); return `${yyyy}-${mm}-${dd}`; }
            const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) return `${m[1]}-${m[2]}-${m[3]}`;
            const d = new Date(s);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
            return null;
        };
        const isoEventDate = toISODate(rawEventDate);
        const nowISO = new Date().toISOString();
        const statusNorm = String(statusRaw).trim().toLowerCase();
        const isRespondido = statusNorm === "respondido";
        const isFinalizado = ["finalizado", "concluído", "concluido", "done"].includes(statusNorm);
        const isEnviado = statusNorm === "enviado";
        if (!emailAluno) return res.status(400).send("Email obrigatório.");
        const studentsSnap = await db.collection("students").where("email", "==", emailAluno).limit(1).get();
        if (studentsSnap.empty) {
            await db.collection("unidentified_feedbacks").add({ studentEmail: emailAluno, studentName: dados.nome_aluno || "Desconhecido", frappeFeedbackId: feedbackId, frappePayload: dados, receivedAt: admin.firestore.FieldValue.serverTimestamp(), status: "waiting_link", reason: "Email não encontrado no banco de alunos" });
            return res.json({ success: true, action: "limbo" });
        }
        const studentDoc = studentsSnap.docs[0];
        const studentId = studentDoc.id, studentData = studentDoc.data() || {};
        const scheduleRef = db.collection("feedback_schedules").doc(studentId);
        const scheduleSnap = await scheduleRef.get();
        if (!scheduleSnap.exists) return res.status(200).send("Sem calendário configurado.");
        const datas = Array.isArray(scheduleSnap.data()?.dates) ? [...scheduleSnap.data().dates] : [];
        const dayDiffAbs = (a, b) => Math.abs((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / (1000 * 60 * 60 * 24));
        let idx = datas.findIndex(d => String(d?.frappeFeedbackId || "") === String(feedbackId));
        if (idx === -1 && isoEventDate) {
            let best = -1, bestDiff = Infinity;
            for (let i = 0; i < datas.length; i++) {
                if (!datas[i]?.date) continue;
                const diff = dayDiffAbs(datas[i].date, isoEventDate);
                if (diff <= 7 && diff < bestDiff) { bestDiff = diff; best = i; }
            }
            idx = best;
        }
        if (idx === -1) return res.json({ success: true, action: "no_match_date" });
        const itemAlvo = datas[idx];
        const basePatch = { received: true, receivedAt: itemAlvo.receivedAt || nowISO, frappeFeedbackId: feedbackId, frappeStatus: statusRaw, frappeEventDate: isoEventDate || null, frappeEventRaw: String(rawEventDate || "") };
        if (isFinalizado) { datas[idx] = { ...itemAlvo, ...basePatch, status: "done", completedAt: nowISO, completedDate: isoEventDate || itemAlvo.date }; }
        else if (isRespondido) { datas[idx] = { ...itemAlvo, ...basePatch, status: "pending" }; delete datas[idx].completedAt; delete datas[idx].completedDate; }
        else if (isEnviado) { datas[idx] = { ...itemAlvo, frappeFeedbackId: feedbackId, frappeStatus: statusRaw, frappeEventDate: isoEventDate || null, frappeEventRaw: String(rawEventDate || ""), received: false, status: "pending" }; delete datas[idx].receivedAt; }
        else { datas[idx] = { ...itemAlvo, ...basePatch }; }
        const pendingFeedbackDates = datas.filter(d => d?.date && d.type === "feedback" && d.status !== "done").map(d => d.date);
        const pendingTrainingDates = datas.filter(d => d?.date && d.type === "training" && d.status !== "done").map(d => d.date);
        await scheduleRef.update({ dates: datas, pendingFeedbackDates, pendingTrainingDates, updatedAt: nowISO });
        if (isRespondido && itemAlvo.type === "training") {
            const tarefaExistente = await db.collection("tasks").where("frappeFeedbackId", "==", feedbackId).limit(1).get();
            if (tarefaExistente.empty) {
                const nomeAluno = studentData.name || dados.nome_aluno || "Aluno";
                const vencimento = new Date(); vencimento.setDate(vencimento.getDate() + 3); vencimento.setHours(12, 0, 0, 0);
                await criarTarefaTrocaTreino(db, studentId, nomeAluno, { id: studentId, ...studentData }, feedbackId, vencimento.toISOString());
            }
        }
        return res.json({ success: true, action: isFinalizado ? "closed" : (isRespondido ? "reopened" : "updated"), matchedScheduleDate: itemAlvo.date, eventDate: isoEventDate });
    } catch (error) { console.error("Erro webhook:", error); return res.status(500).send("Erro interno."); }
});

exports.monitorarNovosContratos = functions.firestore.document("contracts/{contractId}").onCreate(async (snap) => {
    const db = admin.firestore();
    const contractData = snap.data();
    const studentId = contractData.studentId, studentName = contractData.studentName || "Novo Aluno";
    try {
        const studentDoc = await db.collection("students").doc(studentId).get();
        const dadosBadge = studentDoc.exists ? { id: studentId, ...studentDoc.data() } : { id: studentId, name: studentName };
        await criarTarefa(db, studentId, studentName, dadosBadge, "col_novos_alunos", ["Nova Aluna", "Onboarding", "Tarefa Automatizada"], "Iniciar Onboarding", `**Novo Contrato Gerado!**\n\nStatus: ${contractData.status}\nData: ${new Date().toLocaleDateString('pt-BR')}`);
    } catch (error) { console.error("Erro ao criar tarefa de contrato:", error); }
});

exports.monitorarRenovacoesFinanceiras = functions.firestore.document("payments/{paymentId}").onCreate(async (snap) => {
    const db = admin.firestore();
    const paymentData = snap.data();
    if (!paymentData.renewedFromPaymentId) return null;
    const studentId = paymentData.studentId, studentName = paymentData.studentName || "Aluno", planName = paymentData.planType || "Plano";
    try {
        const studentDoc = await db.collection("students").doc(studentId).get();
        const dadosBadge = studentDoc.exists ? { id: studentId, ...studentDoc.data() } : { id: studentId, name: studentName };
        await criarTarefa(db, studentId, studentName, dadosBadge, "col_automatizadas", ["Renovação", "Enviar Contrato"], `Renovação: ${planName}`, `**Plano Renovado!**\n\nPlano: ${planName}\nValor: R$ ${paymentData.netValue}`);
    } catch (error) { console.error("Erro ao criar tarefa de renovação:", error); }
});