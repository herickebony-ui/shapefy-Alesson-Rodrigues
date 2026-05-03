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
let db;
const ensureDb = () => {
  if (!db) db = admin.firestore();
  return db;
};


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

const alunos = require("./alunos");
exports.listarAlunos              = alunos.listarAlunos;
exports.listarAnamnesesPorAluno   = alunos.listarAnamnesesPorAluno;
exports.buscarAnamneseDetalhe     = alunos.buscarAnamneseDetalhe;
exports.salvarAluno               = alunos.salvarAluno;
exports.listarFormulariosAnamnese = alunos.listarFormulariosAnamnese;
exports.vincularAnamnese          = alunos.vincularAnamnese;
exports.salvarAnamnese = alunos.salvarAnamnese;
exports.listarTodasAnamneses = alunos.listarTodasAnamneses;
exports.excluirAnamnese = alunos.excluirAnamnese;

const crons = require("./crons");
exports.dispararFeedbacksAgendados = crons.dispararFeedbacksAgendados;
exports.dispararLembretesDiarios    = crons.dispararLembretesDiarios;
exports.dispararLembretesWhatsApp   = crons.dispararLembretesWhatsApp;
exports.processTaskDueReminders     = crons.processTaskDueReminders;
exports.processTaskNotificationQueue = crons.processTaskNotificationQueue;

const webhooks = require("./webhooks");
exports.receberWebhookShapefy          = webhooks.receberWebhookShapefy;
exports.monitorarNovosContratos        = webhooks.monitorarNovosContratos;
exports.monitorarRenovacoesFinanceiras = webhooks.monitorarRenovacoesFinanceiras;

const broadcast = require("./broadcast");
exports.createBroadcastJob      = broadcast.createBroadcastJob;
exports.processBroadcastQueue   = broadcast.processBroadcastQueue;
exports.getBroadcastStatus      = broadcast.getBroadcastStatus;

const fichas = require("./fichas");
exports.buscarFichas           = fichas.buscarFichas;
exports.buscarFichaDetalhe     = fichas.buscarFichaDetalhe;
exports.salvarFicha            = fichas.salvarFicha;
exports.duplicarFicha          = fichas.duplicarFicha;
exports.buscarAlunosFicha      = fichas.buscarAlunosFicha;
exports.buscarGruposMusculares = fichas.buscarGruposMusculares;
exports.buscarExerciciosTreino = fichas.buscarExerciciosTreino;
exports.buscarAlongamentos     = fichas.buscarAlongamentos;
exports.buscarAerobicos        = fichas.buscarAerobicos;
exports.excluirFicha           = fichas.excluirFicha;
exports.migrarEstruturaPichas  = fichas.migrarEstruturaPichas;
exports.salvarExercicio        = fichas.salvarExercicio;
exports.excluirExercicio       = fichas.excluirExercicio;
exports.buscarExercicioDetalhe = fichas.buscarExercicioDetalhe;

// ============================================================================
exports.buscarAlunoDetalhe = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        if (!data.id) throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };
        try {
            const response = await fetch(
                `https://shapefy.online/api/resource/Aluno/${encodeURIComponent(data.id)}`,
                { method: "GET", headers }
            );
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            const json = await response.json();
            return { success: true, data: json.data };
        } catch (e) {
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

const dietas = require("./dietas");
Object.assign(exports, dietas);

// ============================================================================
// CRIAR MEMBRO DA EQUIPE (Admin SDK — cria no Firebase Auth + Firestore)
// ============================================================================
// ADICIONAR ESTE BLOCO NO FINAL DO functions/index.js (em ambos os projetos)
// ============================================================================

exports.criarMembroEquipe = functions.https.onCall(async (data, context) => {
    // Só admin pode criar membros
    // if (!context.auth) {
    //     throw new functions.https.HttpsError("unauthenticated", "Não autenticado.");
    // }

    const { name, email, password, role } = data;

    if (!name || !email || !password || !role) {
        throw new functions.https.HttpsError("invalid-argument", "Todos os campos são obrigatórios.");
    }

    if (password.length < 6) {
        throw new functions.https.HttpsError("invalid-argument", "Senha deve ter no mínimo 6 caracteres.");
    }

    try {
        // 1. Cria o usuário no Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: name,
        });

        // 2. Salva o perfil no Firestore (coleção "users")
        await admin.firestore().collection("users").doc(userRecord.uid).set({
            name: name,
            email: email,
            role: role,
            whatsapp: "",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: context.auth?.uid || "admin",
        });

        console.log(`✅ Membro criado: ${name} (${email}) — cargo: ${role}`);
        return { success: true, uid: userRecord.uid };

    } catch (error) {
        console.error("❌ Erro ao criar membro:", error);

        // Traduz erros comuns do Firebase Auth
        if (error.code === "auth/email-already-exists") {
            throw new functions.https.HttpsError("already-exists", "Este e-mail já está cadastrado.");
        }
        if (error.code === "auth/invalid-email") {
            throw new functions.https.HttpsError("invalid-argument", "E-mail inválido.");
        }

        throw new functions.https.HttpsError("internal", error.message);
    }
});

exports.vincularAlunosFirebaseFrappe = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"], timeoutSeconds: 540, memory: "512MB" })
    .https.onCall(async (data, context) => {
        const db = admin.firestore();
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };

        const snap = await db.collection("students").get();
        let vinculados = 0, naoEncontrados = 0, jaVinculados = 0, erros = 0;
        const naoEncontradosList = [];

        for (const docSnap of snap.docs) {
            const student = docSnap.data();
            const email = student.email?.toLowerCase().trim();

            if (!email) { naoEncontrados++; naoEncontradosList.push({ id: docSnap.id, name: student.name, motivo: "sem email" }); continue; }
            if (student.alunoFrappeId) { jaVinculados++; continue; }

            try {
                const filtros = encodeURIComponent(JSON.stringify([["Aluno", "email", "=", email]]));
                const campos = encodeURIComponent(JSON.stringify(["name", "nome_completo", "email"]));
                const res = await fetch(`https://shapefy.online/api/resource/Aluno?filters=${filtros}&fields=${campos}&limit_page_length=1`, { headers });

                if (!res.ok) throw new Error(`Frappe ${res.status}`);
                const json = await res.json();
                const aluno = json.data?.[0];

                if (!aluno) {
                    naoEncontrados++;
                    naoEncontradosList.push({ id: docSnap.id, name: student.name, email, motivo: "não encontrado no Frappe" });
                    continue;
                }

                await db.collection("students").doc(docSnap.id).update({ alunoFrappeId: aluno.name });
                console.log(`✅ Vinculado: ${student.name} → ${aluno.name}`);
                vinculados++;

            } catch (e) {
                console.error(`❌ Erro: ${student.name}`, e.message);
                erros++;
            }
        }

        return { success: true, vinculados, jaVinculados, naoEncontrados, erros, naoEncontradosList };
    });

exports.criarAlunoFrappe = functions
.runWith({ secrets: ["FRAPPE_API_KEY_ADMIN", "FRAPPE_API_SECRET_ADMIN"] })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY_ADMIN;
        const apiSecret = process.env.FRAPPE_API_SECRET_ADMIN;
        const headers = {
            "Authorization": `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json"
        };

        // Verifica se já existe pelo email
        const filtros = encodeURIComponent(JSON.stringify([["Aluno", "email", "=", data.email]]));
        const checkRes = await fetch(`https://shapefy.online/api/resource/Aluno?filters=${filtros}&fields=["name"]&limit_page_length=1`, { headers });
        if (checkRes.ok) {
            const checkJson = await checkRes.json();
            if (checkJson.data?.[0]) {
                return { success: true, alunoId: checkJson.data[0].name, jaExistia: true };
            }
        }

        // Calcula idade a partir do birthDate (YYYY-MM-DD)
let age = 0;
if (data.birthDate) {
    const birth = new Date(data.birthDate);
    const today = new Date();
    age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
}

const payload = {
    nome_completo: data.nome_completo,
    email: data.email,
    telefone: data.telefone || "",
    cpf: "",
    "profissão": data["profissão"] || "",
    "endereço": data["endereço"] || "",
    profissional: "arteamconsultoria@gmail.com",
    enabled: 1,
    age
};

        const res = await fetch(`https://shapefy.online/api/resource/Aluno`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new functions.https.HttpsError("internal", `Frappe ${res.status}: ${errText}`);
        }

        const json = await res.json();
        console.log(`✅ Aluno criado no Frappe: ${json.data?.name}`);
        return { success: true, alunoId: json.data?.name };
    });

const feedbacks = require("./feedbacks");
exports.sincronizarStatusFrappe   = feedbacks.sincronizarStatusFrappe;
exports.buscarFeedbacks           = feedbacks.buscarFeedbacks;
exports.salvarRotacao             = feedbacks.salvarRotacao;
exports.atualizarStatusFeedback   = feedbacks.atualizarStatusFeedback;
exports.buscarTreinosRealizados   = feedbacks.buscarTreinosRealizados;
exports.salvarFeedbackTreino      = feedbacks.salvarFeedbackTreino;
exports.trocarFotosFeedback       = feedbacks.trocarFotosFeedback;
exports.uploadArquivoFrappe       = feedbacks.uploadArquivoFrappe;
exports.criarAvaliacaoInicial     = feedbacks.criarAvaliacaoInicial;
exports.salvarFeedbackProfissional = feedbacks.salvarFeedbackProfissional;

exports.excluirAluno = functions
    .runWith({
        secrets: ["FRAPPE_API_KEY_ADMIN", "FRAPPE_API_SECRET_ADMIN"],
        timeoutSeconds: 120,
    })
    .https.onCall(async (data) => {
        if (!data.id) throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");
        const alunoId = data.id;

        const apiKey = process.env.FRAPPE_API_KEY_ADMIN, apiSecret = process.env.FRAPPE_API_SECRET_ADMIN;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais admin ausentes.");
        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };
        const FRAPPE = "https://shapefy.online/api/resource";
        const filterByAluno = encodeURIComponent(JSON.stringify([["aluno", "=", alunoId]]));

        const listFrappe = async (doctype, fields = '["name","nome_completo"]') => {
            const url = `${FRAPPE}/${encodeURIComponent(doctype)}?filters=${filterByAluno}&fields=${encodeURIComponent(fields)}&limit_page_length=500`;
            try {
                const res = await fetch(url, { method: "GET", headers });
                if (!res.ok) {
                    console.warn(`listFrappe ${doctype}: ${res.status}`);
                    return [];
                }
                return (await res.json()).data || [];
            } catch (e) {
                console.warn(`listFrappe ${doctype}: ${e.message}`);
                return [];
            }
        };

        // 1) BLOQUEADORES: Ficha, Dieta, Anamnese
        const [fichas, dietas, anamneses] = await Promise.all([
            listFrappe("Ficha"),
            listFrappe("Dieta"),
            listFrappe("Anamnese", '["name","titulo","date"]'),
        ]);

        if (fichas.length || dietas.length || anamneses.length) {
            return {
                success: false,
                blocked: true,
                blockers: { fichas, dietas, anamneses },
                message: "Aluno tem vínculos bloqueantes. Remova fichas, dietas e anamneses antes de excluir.",
            };
        }

        // 2) CASCADE FRAPPE — limpa o resto silenciosamente
        const cleanFrappe = async (doctype) => {
            const list = await listFrappe(doctype, '["name"]');
            let deleted = 0;
            for (const item of list) {
                try {
                    const res = await fetch(`${FRAPPE}/${encodeURIComponent(doctype)}/${encodeURIComponent(item.name)}`, { method: "DELETE", headers });
                    if (res.ok || res.status === 404) deleted++;
                    else console.warn(`DELETE ${doctype}/${item.name}: ${res.status}`);
                } catch (e) {
                    console.warn(`DELETE ${doctype}/${item.name}: ${e.message}`);
                }
            }
            return deleted;
        };

        const [feedbacks, treinosRealizados, prescricoes, avaliacoes] = await Promise.all([
            cleanFrappe("Feedback"),
            cleanFrappe("Treino Realizado"),
            cleanFrappe("Prescricao Paciente"),
            cleanFrappe("Avaliacao da Composicao Corporal"),
        ]);

        // 3) CASCADE FIRESTORE
        const db = admin.firestore();
        const cleanedFs = { students: 0, feedback_schedules: 0, members_progress: 0, tasks: 0, contracts: 0, payments: 0 };

        try {
            const mpSnap = await db.collection(`students/${alunoId}/members_progress`).limit(500).get();
            if (!mpSnap.empty) {
                const batch = db.batch();
                mpSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                cleanedFs.members_progress = mpSnap.size;
            }
        } catch (e) {
            console.warn(`members_progress cleanup: ${e.message}`);
        }

        await db.doc(`students/${alunoId}`).delete().then(() => { cleanedFs.students = 1; }).catch(() => {});
        await db.doc(`feedback_schedules/${alunoId}`).delete().then(() => { cleanedFs.feedback_schedules = 1; }).catch(() => {});

        const cleanCollection = async (coll) => {
            try {
                const snap = await db.collection(coll).where("studentId", "==", alunoId).limit(500).get();
                if (snap.empty) return 0;
                const batch = db.batch();
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                return snap.size;
            } catch (e) {
                console.warn(`cleanCollection ${coll}: ${e.message}`);
                return 0;
            }
        };

        cleanedFs.tasks = await cleanCollection("tasks");
        cleanedFs.contracts = await cleanCollection("contracts");
        cleanedFs.payments = await cleanCollection("payments");

        // 4) DELETE Aluno no Frappe
        try {
            const res = await fetch(`${FRAPPE}/Aluno/${encodeURIComponent(alunoId)}`, { method: "DELETE", headers });
            if (!res.ok && res.status !== 404) {
                throw new Error(`Frappe Aluno DELETE ${res.status}: ${await res.text()}`);
            }
        } catch (e) {
            throw new functions.https.HttpsError("internal", e.message);
        }

        return {
            success: true,
            cleaned: {
                frappe: { feedbacks, treinos_realizados: treinosRealizados, prescricoes, avaliacoes_composicao: avaliacoes },
                firestore: cleanedFs,
            },
        };
    });

exports.excluirMembroEquipe = functions.https.onCall(async (data, context) => {
    const { uid } = data;
    if (!uid) throw new functions.https.HttpsError("invalid-argument", "UID obrigatório.");
    try {
        await admin.auth().deleteUser(uid);
    } catch (e) {
        if (e.code !== 'auth/user-not-found') {
            throw new functions.https.HttpsError("internal", e.message);
        }
    }
    await admin.firestore().collection("users").doc(uid).delete();
    return { success: true };
});

const prescricoes = require('./prescricoes');
exports.deletarPrescricao = prescricoes.deletarPrescricao;
exports.salvarPrescricao = prescricoes.salvarPrescricao;
exports.listarPrescricoes = prescricoes.listarPrescricoes;
exports.listarTodasPrescricoes = prescricoes.listarTodasPrescricoes;
exports.buscarPrescricaoDetalhe = prescricoes.buscarPrescricaoDetalhe;


const avaliacoes = require("./avaliacoes");
exports.listarAvaliacoes         = avaliacoes.listarAvaliacoes;
exports.buscarAvaliacoesPorAluno = avaliacoes.buscarAvaliacoesPorAluno;
exports.criarAvaliacao           = avaliacoes.criarAvaliacao;
exports.excluirAvaliacao = avaliacoes.excluirAvaliacao;
