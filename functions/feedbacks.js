const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

const FRAPPE_URL = "https://shapefy.online/api/resource";
const FRAPPE_BASE = FRAPPE_URL;

const getHeaders = () => {
    const apiKey = process.env.FRAPPE_API_KEY;
    const apiSecret = process.env.FRAPPE_API_SECRET;
    return { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };
};

exports.sincronizarStatusFrappe = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data) => {
        const { frappeFeedbackId, novoStatus } = data;
        if (!frappeFeedbackId || !novoStatus) throw new functions.https.HttpsError("invalid-argument", "ID e status são obrigatórios.");
        const response = await fetch(`${FRAPPE_URL}/Feedback/${frappeFeedbackId}`, { method: "PUT", headers: getHeaders(), body: JSON.stringify({ status: novoStatus }) });
        if (!response.ok) throw new functions.https.HttpsError("internal", `Frappe retornou ${response.status}`);
        return { success: true, frappeFeedbackId, novoStatus };
    });

exports.buscarFeedbacks = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data) => {
        const headers = getHeaders();
        try {
            if (data.id) {
                const response = await fetch(`${FRAPPE_URL}/Feedback/${data.id}`, { method: "GET", headers });
                if (!response.ok) throw new Error(`Erro Frappe: ${response.status}`);
                const json = await response.json();
                let rotations = {};
                try {
                    const doc = await admin.firestore().collection('feedback_settings').doc(data.id).get();
                    if (doc.exists) rotations = doc.data().rotations || {};
                } catch (e) { console.error("⚠️ Erro ao buscar rotações:", e); }
                return { success: true, data: { ...json.data, rotations } };
            }
            const campos = JSON.stringify(["name","formulario","titulo","aluno","nome_completo","date","status","email","verificar","creation","modified"]);
            let listaFiltros = [["Feedback", "status", "in", ["Respondido", "Finalizado"]]];
            if (data.formulario) listaFiltros.push(["Feedback", "formulario", "=", data.formulario]);
            const params = `?fields=${campos}&order_by=creation desc&limit_page_length=0&filters=${JSON.stringify(listaFiltros)}`;
            const response = await fetch(`${FRAPPE_URL}/Feedback${params}`, { method: "GET", headers });
            if (!response.ok) throw new Error(`Erro ao listar: ${response.status}`);
            const json = await response.json();
            return { success: true, list: json.data || [] };
        } catch (error) {
            console.error("❌ Erro em buscarFeedbacks:", error);
            throw new functions.https.HttpsError("internal", error.message);
        }
    });

exports.salvarRotacao = functions.https.onCall(async (data) => {
    if (!data.id || data.index === undefined || data.rotation === undefined)
        throw new functions.https.HttpsError("invalid-argument", "Dados incompletos.");
    try {
        await admin.firestore().collection('feedback_settings').doc(data.id).set(
            { rotations: { [data.index]: data.rotation } }, { merge: true }
        );
        return { success: true };
    } catch (error) {
        throw new functions.https.HttpsError("internal", "Erro ao salvar rotação.");
    }
});

exports.atualizarStatusFeedback = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data) => {
        if (!data.id || !data.status) throw new functions.https.HttpsError("invalid-argument", "ID e status são obrigatórios.");
        try {
            const response = await fetch(`${FRAPPE_URL}/Feedback/${data.id}`, { method: "PUT", headers: getHeaders(), body: JSON.stringify({ status: data.status }) });
            if (!response.ok) throw new Error(`Erro ao atualizar: ${response.status}`);
            const json = await response.json();
            return { success: true, data: json.data };
        } catch (error) {
            throw new functions.https.HttpsError("internal", error.message);
        }
    });

exports.buscarTreinosRealizados = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data) => {
        const headers = getHeaders();
        try {
            if (data.id) {
                const camposDetalhe = JSON.stringify(["name","nome_completo","aluno","treino_label","data_e_hora_do_inicio","tempo_total_de_treino","status","feedback_do_aluno","feedback_do_profissional","planilha_de_treino","aerobicos","planilha_de_alongamentos_"]);
const response = await fetch(`${FRAPPE_URL}/Treino%20Realizado/${data.id}?fields=${camposDetalhe}`, { method: "GET", headers });
                if (!response.ok) throw new Error(`Erro Frappe: ${response.status}`);
                return { success: true, data: (await response.json()).data };
            }
            const campos = JSON.stringify(["name","nome_completo","aluno","treino_label","data_e_hora_do_inicio","tempo_total_de_treino","status","intensidade_do_treino","ficha"]);
            let listaFiltros = [["Treino Realizado", "profissional", "=", "herickebony@gmail.com"]];
            if (data.status) listaFiltros.push(["Treino Realizado", "status", "=", data.status]);
            if (data.aluno) listaFiltros.push(["Treino Realizado", "aluno", "like", `%${data.aluno}%`]);
            const params = `?fields=${campos}&order_by=data_e_hora_do_inicio desc&limit_page_length=${data.limit_length || 500}&limit_start=${data.limit_start || 0}&filters=${JSON.stringify(listaFiltros)}`;
            const response = await fetch(`${FRAPPE_URL}/Treino%20Realizado${params}`, { method: "GET", headers });
            if (!response.ok) throw new Error(`Erro ao listar: ${response.status}`);
            return { success: true, list: (await response.json()).data || [] };
        } catch (error) {
            throw new functions.https.HttpsError("internal", error.message);
        }
    });

exports.salvarFeedbackTreino = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data) => {
        if (!data.treinoId) throw new functions.https.HttpsError("invalid-argument", "ID do treino é obrigatório.");
        try {
            const response = await fetch(`${FRAPPE_URL}/Treino Realizado/${data.treinoId}`, { method: "PUT", headers: getHeaders(), body: JSON.stringify({ feedback_do_profissional: data.feedbackTexto }) });
            if (!response.ok) throw new Error(`Erro Frappe: ${response.status}`);
            return { success: true, data: (await response.json()).data };
        } catch (error) {
            throw new functions.https.HttpsError("internal", "Não foi possível salvar o feedback.");
        }
    });

exports.trocarFotosFeedback = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data) => {
        const { id, index1, index2 } = data;
        if (!id || index1 === undefined || index2 === undefined)
            throw new functions.https.HttpsError("invalid-argument", "ID e índices são obrigatórios.");
        const headers = getHeaders();
        try {
            const getRes = await fetch(`${FRAPPE_URL}/Feedback/${id}`, { method: "GET", headers });
            if (!getRes.ok) throw new Error(`Erro ao buscar feedback: ${getRes.status}`);
            const perguntas = (await getRes.json()).data?.perguntas_e_respostas || [];
            const item1 = perguntas[index1];
            const item2 = perguntas[index2];
            if (!item1 || !item2) throw new functions.https.HttpsError("invalid-argument", `Índices inválidos: ${index1}, ${index2}`);
            if (item1.tipo !== "Attach Image" || item2.tipo !== "Attach Image")
                throw new functions.https.HttpsError("invalid-argument", "Ambos precisam ser Attach Image.");
            const put1 = await fetch(`${FRAPPE_URL}/Feedback%20Resposta/${item1.name}`, { method: "PUT", headers, body: JSON.stringify({ resposta: item2.resposta || "" }) });
            if (!put1.ok) throw new Error(`Erro item1: ${put1.status} - ${await put1.text()}`);
            const put2 = await fetch(`${FRAPPE_URL}/Feedback%20Resposta/${item2.name}`, { method: "PUT", headers, body: JSON.stringify({ resposta: item1.resposta || "" }) });
            if (!put2.ok) throw new Error(`Erro item2: ${put2.status} - ${await put2.text()}`);
            console.log(`✅ Fotos trocadas: ${id}`);
            return { success: true };
        } catch (error) {
            console.error("❌ trocarFotosFeedback:", error);
            throw new functions.https.HttpsError("internal", error.message);
        }
    });

exports.uploadArquivoFrappe = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data) => {
        const { base64, filename, mimeType } = data;
        if (!base64 || !filename)
            throw new functions.https.HttpsError("invalid-argument", "base64 e filename obrigatórios.");

        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;

        const fileBuffer = Buffer.from(base64, 'base64');
        const mime = mimeType || 'image/jpeg';
        const boundary = `----FormBoundary${Date.now()}`;

        const partsText = [
            `--${boundary}\r\nContent-Disposition: form-data; name="is_private"\r\n\r\n0`,
            `--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\nHome/Attachments`,
        ].join('\r\n') + '\r\n';

        const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`;
        const fileFooter = `\r\n--${boundary}--\r\n`;

        const body = Buffer.concat([
            Buffer.from(partsText, 'utf8'),
            Buffer.from(fileHeader, 'utf8'),
            fileBuffer,
            Buffer.from(fileFooter, 'utf8'),
        ]);

        const response = await fetch('https://shapefy.online/api/method/upload_file', {
            method: 'POST',
            headers: {
                'Authorization': `token ${apiKey}:${apiSecret}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length.toString(),
            },
            body
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new functions.https.HttpsError("internal", `Upload falhou: ${response.status} - ${errText}`);
        }

        const json = await response.json();
        const filePath = json.message?.file_url;
        if (!filePath) throw new functions.https.HttpsError("internal", "Frappe não retornou file_url.");

        return { success: true, filePath };
    });

exports.criarAvaliacaoInicial = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data) => {
        const { alunoId, nomeCompleto, email, peso, fotoPaths } = data;
        console.log("🔍 criarAvaliacaoInicial recebido:", { alunoId, peso, fotoPaths: Object.keys(fotoPaths || {}) });
        if (!alunoId || !nomeCompleto)
            throw new functions.https.HttpsError("invalid-argument", "alunoId e nomeCompleto obrigatórios.");

        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        const headers = {
            "Authorization": `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json"
        };

        const FORMULARIO_ID = '0iqb3of5ud';

        // Busca template do formulário para montar perguntas_e_respostas fielmente
        const formRes = await fetch(`https://shapefy.online/api/resource/Formulario%20Feedback/${FORMULARIO_ID}`, { headers });
        if (!formRes.ok) throw new functions.https.HttpsError("internal", "Erro ao buscar formulário.");
        const perguntas = (await formRes.json()).data.perguntas || [];

        const perguntasERespostas = perguntas.map(p => ({
            pergunta: p.pergunta,
            reqd: p.reqd || 0,
            tipo: p.tipo,
            opcoes: p.opcoes || '',
            // Peso vai no campo Data; fotos vão pelo name da pergunta
            resposta: p.tipo === 'Texto Curto' ? (peso || '') : (fotoPaths?.[p.name] || '')
        }));

        const today = new Date().toISOString().split('T')[0];

        const payload = {
            formulario: FORMULARIO_ID,
            titulo: 'Avaliação Inicial',
            aluno: alunoId,
            nome_completo: nomeCompleto,
            profissional: 'herickebony@gmail.com',
            email: email || '',
            date: today,
            status: 'Finalizado',
            automatico: 0,
            perguntas_e_respostas: perguntasERespostas
        };

        const res = await fetch('https://shapefy.online/api/resource/Feedback', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new functions.https.HttpsError("internal", `Frappe ${res.status}: ${errText}`);
        }

        const json = await res.json();
        console.log(`✅ Avaliação Inicial criada: ${json.data?.name} — ${nomeCompleto}`);
        return { success: true, feedbackId: json.data?.name };
    });

exports.salvarFeedbackProfissional = functions.runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] }).https.onCall(async (data) => {
    if (!data.id) throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");
    try {
        const response = await fetch(`${FRAPPE_BASE}/Feedback/${data.id}`, { method: "PUT", headers: getHeaders(), body: JSON.stringify({ feedback_do_profissional: data.texto }) });
        if (!response.ok) throw new Error(`Frappe ${response.status}`);
        return { success: true };
    } catch (e) { throw new functions.https.HttpsError("internal", e.message); }
});