// functions/alunos.js
// ─── Como usar no index.js ────────────────────────────────────────────────────
// const alunos = require("./alunos");
// exports.listarAlunos              = alunos.listarAlunos;
// exports.listarAnamnesesPorAluno   = alunos.listarAnamnesesPorAluno;
// exports.buscarAnamneseDetalhe     = alunos.buscarAnamneseDetalhe;
// exports.salvarAluno               = alunos.salvarAluno;
// exports.listarFormulariosAnamnese = alunos.listarFormulariosAnamnese;
// exports.vincularAnamnese          = alunos.vincularAnamnese;
// ─────────────────────────────────────────────────────────────────────────────

const functions = require("firebase-functions/v1");

const FRAPPE_BASE = "https://shapefy.online/api/resource";
const PROFISSIONAL = "herickebony@gmail.com";

const getHeaders = () => {
    const apiKey = process.env.FRAPPE_API_KEY;
    const apiSecret = process.env.FRAPPE_API_SECRET;
    if (!apiKey || !apiSecret)
        throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
    return {
        "Authorization": `token ${apiKey}:${apiSecret}`,
        "Content-Type": "application/json",
    };
};

const withSecrets = { secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] };

// ── 1. Listar Alunos (ordenado por creation desc) ───────────────────────────
exports.listarAlunos = functions
    .runWith(withSecrets)
    .https.onCall(async (data) => {
        try {
            const search = data?.search || "";
            const page = data?.page || 1;
            const limit = data?.limit || 100;
            const offset = (page - 1) * limit;

            const campos = encodeURIComponent(JSON.stringify([
                "name", "nome_completo", "email", "telefone",
                "objetivo", "enabled", "sexo", "age",
                "weight", "height", "dieta", "treino", "foto", "instagram", "creation", "senha_de_acesso"
            ]));

            const filtros = [
                ["Aluno", "profissional", "=", PROFISSIONAL],
                ["Aluno", "enabled", "=", 1],
            ];
            if (search) filtros.push(["Aluno", "nome_completo", "like", `%${search}%`]);

            const filtrosEnc = encodeURIComponent(JSON.stringify(filtros));
            // ✅ Últimos cadastros primeiro
            const url = `${FRAPPE_BASE}/Aluno?fields=${campos}&filters=${filtrosEnc}&limit_page_length=${limit + 1}&limit_start=${offset}&order_by=creation desc`;

            const res = await fetch(url, { method: "GET", headers: getHeaders() });
            if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
            const json = await res.json();
            const list = json.data || [];
            const hasMore = list.length > limit;
            return { success: true, list: hasMore ? list.slice(0, limit) : list, hasMore };
        } catch (e) {
            console.error("❌ listarAlunos:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

// ── 2. Listar Anamneses de um Aluno ────────────────────────────────────────
exports.listarAnamnesesPorAluno = functions
    .runWith(withSecrets)
    .https.onCall(async (data) => {
        if (!data?.alunoId)
            throw new functions.https.HttpsError("invalid-argument", "alunoId é obrigatório.");
        try {
            const campos = encodeURIComponent(JSON.stringify([
                "name", "titulo", "date", "status", "formulario", "nome_completo", "enviar_aluno"
            ]));
            const filtros = encodeURIComponent(JSON.stringify([
    ["Anamnese", "aluno", "=", data.alunoId]
]));
            const url = `${FRAPPE_BASE}/Anamnese?fields=${campos}&filters=${filtros}&order_by=date desc`;
const res = await fetch(url, { method: "GET", headers: getHeaders() });
            if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
            const json = await res.json();
            return { success: true, list: json.data || [] };
        } catch (e) {
            console.error("❌ listarAnamnesesPorAluno:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

// ── 3. Buscar Detalhe da Anamnese ──────────────────────────────────────────
exports.buscarAnamneseDetalhe = functions
    .runWith(withSecrets)
    .https.onCall(async (data) => {
        if (!data?.anamneseId)
            throw new functions.https.HttpsError("invalid-argument", "anamneseId é obrigatório.");
        try {
            const url = `${FRAPPE_BASE}/Anamnese/${encodeURIComponent(data.anamneseId)}`;
            const res = await fetch(url, { method: "GET", headers: getHeaders() });
            if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
            const json = await res.json();
            return { success: true, data: json.data };
        } catch (e) {
            console.error("❌ buscarAnamneseDetalhe:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

// ── 4. Salvar Aluno (PUT — campos editáveis) ────────────────────────────────
exports.salvarAluno = functions
    .runWith(withSecrets)
    .https.onCall(async (data) => {
        const id = data?.id || data?.alunoId;
        if (!id) throw new functions.https.HttpsError("invalid-argument", "ID do aluno obrigatório.");
        if (!data?.campos) throw new functions.https.HttpsError("invalid-argument", "Campos obrigatórios.");
        try {
            const url = `${FRAPPE_BASE}/Aluno/${encodeURIComponent(id)}`;
            const res = await fetch(url, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify(data.campos)
            });
            if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
            const json = await res.json();
            console.log(`✅ Aluno ${id} atualizado`);
            return { success: true, data: json.data };
        } catch (e) {
            console.error("❌ salvarAluno:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

// ── 5. Listar Formulários de Anamnese disponíveis ──────────────────────────
exports.listarFormulariosAnamnese = functions
    .runWith(withSecrets)
    .https.onCall(async () => {
        try {
            const campos = encodeURIComponent(JSON.stringify(["name", "titulo"]));
            const url = `${FRAPPE_BASE}/Formulario%20de%20Anamnese?fields=${campos}&limit_page_length=50`;
            const res = await fetch(url, { method: "GET", headers: getHeaders() });
            if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
            const json = await res.json();
            return { success: true, list: json.data || [] };
        } catch (e) {
            console.error("❌ listarFormulariosAnamnese:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

// ── 6. Vincular/Criar nova Anamnese para o Aluno ───────────────────────────
exports.vincularAnamnese = functions
    .runWith(withSecrets)
    .https.onCall(async (data) => {
        if (!data?.alunoId || !data?.formulario)
            throw new functions.https.HttpsError("invalid-argument", "alunoId e formulario são obrigatórios.");
        try {
            // Busca dados do aluno
            const urlAluno = `${FRAPPE_BASE}/Aluno/${encodeURIComponent(data.alunoId)}`;
            const resAluno = await fetch(urlAluno, { method: "GET", headers: getHeaders() });
            if (!resAluno.ok) throw new Error(`Aluno não encontrado: ${resAluno.status}`);
            const aluno = (await resAluno.json()).data;
            // Busca o formulário para copiar as perguntas
            const urlForm = `${FRAPPE_BASE}/Formulario%20de%20Anamnese/${encodeURIComponent(data.formulario)}`;
            const resForm = await fetch(urlForm, { method: "GET", headers: getHeaders() });
            if (!resForm.ok) throw new Error(`Formulário não encontrado: ${resForm.status}`);
            const form = (await resForm.json()).data;
            // Cria nova Anamnese linkada ao aluno
            const novaAnamnese = {
                aluno: data.alunoId,
                nome_completo: aluno.nome_completo,
                formulario: data.formulario,
                titulo: form.titulo || data.formulario,
                date: new Date().toISOString().split("T")[0],
                status: "Enviado",
                profissional: PROFISSIONAL,
                enviar_aluno: 1,  // ← aluno verá no app para preencher                
            };
            const resCreate = await fetch(`${FRAPPE_BASE}/Anamnese`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify(novaAnamnese)
            });
            if (!resCreate.ok) throw new Error(`Erro ao criar: ${resCreate.status}: ${await resCreate.text()}`);
            const nova = (await resCreate.json()).data;
            console.log(`✅ Anamnese ${nova.name} criada para aluno ${data.alunoId}`);
            return { success: true, data: nova };
        } catch (e) {
            console.error("❌ vincularAnamnese:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });
// ── 7. Salvar Anamnese (PUT — respostas preenchidas) ───────────────────────
exports.salvarAnamnese = functions
    .runWith(withSecrets)
    .https.onCall(async (data) => {
        if (!data?.anamneseId || !data?.perguntas)
            throw new functions.https.HttpsError("invalid-argument", "anamneseId e perguntas são obrigatórios.");
        try {
            const url = `${FRAPPE_BASE}/Anamnese/${encodeURIComponent(data.anamneseId)}`;

            // Busca as linhas atuais para pegar name e doctype de cada uma
            const resAtual = await fetch(url, { method: "GET", headers: getHeaders() });
            if (!resAtual.ok) throw new Error(`Erro ao buscar anamnese: ${resAtual.status}`);
            const dadosAtuais = (await resAtual.json()).data;
            const linhasAtuais = dadosAtuais?.perguntas_e_respostas || [];

            const childDoctype = linhasAtuais[0]?.doctype;
            if (!childDoctype) throw new Error("Child doctype não encontrado.");

            // Atualiza CADA linha individualmente — sem tocar na child table do pai
            await Promise.all(
    linhasAtuais.map((linha, i) => {
        const novaResposta = data.perguntas[i]?.resposta ?? linha.resposta;
        const rowUrl = `${FRAPPE_BASE}/${encodeURIComponent(childDoctype)}/${encodeURIComponent(linha.name)}`;
        return fetch(rowUrl, {
            method: "PUT",
            headers: getHeaders(),
            body: JSON.stringify({ resposta: novaResposta })
        });
    })
);

            // Atualiza só o status do pai — SEM child table
            const res = await fetch(url, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify({ status: "Respondido" })
            });
            if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
            const json = await res.json();
            return { success: true, data: json.data };
        } catch (e) {
            console.error("❌ salvarAnamnese:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });