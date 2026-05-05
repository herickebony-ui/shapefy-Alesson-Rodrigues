const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

const FRAPPE_URL = "https://shapefy.online/api/resource";
const FRAPPE_BASE = FRAPPE_URL;

const getHeaders = (apiKey, apiSecret) => ({
    "Authorization": `token ${apiKey || process.env.FRAPPE_API_KEY}:${apiSecret || process.env.FRAPPE_API_SECRET}`,
    "Content-Type": "application/json"
});

// ============================================================================
// FICHAS DE TREINO — COLE ESTE BLOCO INTEIRO NO FINAL DO SEU index.js
// (cole antes do final do arquivo, depois do último exports existente)
// ============================================================================
exports.buscarFichas = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        
        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };
        
        try {
            const campos = JSON.stringify([
                "name", "nome_completo", "aluno", "data_de_inicio", "data_de_fim",
                "objetivo", "nivel", "tipo_de_ciclo", "dias_da_semana",
                "treino_a_label", "treino_b_label", "treino_c_label",
                "treino_d_label", "treino_e_label", "treino_f_label",
"estrutura_calculada", "creation"
            ]);

            // ─── LÓGICA DE PAGINAÇÃO (O QUE FALTAVA) ───
            const page = parseInt(data.page) || 1;
            const limit = parseInt(data.limit) || 50; 
            const start = (page - 1) * limit; // Calcula onde começar a buscar (Offset)

            // ─── FILTROS PARA O BANCO (Server-Side) ───
            let filtros = [["Ficha", "profissional", "=", "arteamconsultoria@gmail.com"]];
            
            // Aqui garantimos que a busca acontece no BANCO INTEIRO, não na lista local
            if (data.nivel) filtros.push(["Ficha", "nivel", "=", data.nivel]);
            if (data.objetivo) filtros.push(["Ficha", "objetivo", "=", data.objetivo]);
            if (data.aluno) filtros.push(["Ficha", "nome_completo", "like", `%${data.aluno}%`]);

            // Monta a URL com limit_start (pular) e limit_page_length (pegar)
            const params = `?fields=${campos}&order_by=creation desc&limit_start=${start}&limit_page_length=${limit}&filters=${JSON.stringify(filtros)}`;
            
            const response = await fetch(`https://shapefy.online/api/resource/Ficha${params}`, { method: "GET", headers });
            
            if (!response.ok) throw new Error(`Erro ${response.status}: ${await response.text()}`);
            
            const json = await response.json();
const fichas = json.data || [];

// Busca o sexo de todos os alunos retornados em uma única requisição
const alunoIds = [...new Set(fichas.map(f => f.aluno).filter(Boolean))];
let sexoMap = {};

if (alunoIds.length > 0) {
    const filtrosAluno = JSON.stringify([["Aluno", "name", "in", alunoIds]]);
    const camposAluno = JSON.stringify(["name", "sexo"]);
    const urlAluno = `https://shapefy.online/api/resource/Aluno?fields=${camposAluno}&filters=${filtrosAluno}&limit_page_length=500`;
    const resAluno = await fetch(urlAluno, { method: "GET", headers });
    if (resAluno.ok) {
        const jsonAluno = await resAluno.json();
        (jsonAluno.data || []).forEach(a => { sexoMap[a.name] = a.sexo; });
    }
}

// Injeta o sexo em cada ficha
const listaFinal = fichas.map(f => ({ 
    ...f, 
    sexo: sexoMap[f.aluno] || ""
}));

return { 
    success: true, 
    list: listaFinal,
    hasMore: fichas.length === limit 
};
        } catch (e) {
            console.error("❌ buscarFichas:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.buscarFichaDetalhe = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        if (!data.id) throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        try {
            const response = await fetch(`https://shapefy.online/api/resource/Ficha/${encodeURIComponent(data.id)}`, {
                method: "GET",
                headers: { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" }
            });
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            const json = await response.json();
            return { success: true, data: json.data };
        } catch (e) {
            console.error("❌ buscarFichaDetalhe:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.salvarFicha = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        if (!data.ficha) throw new functions.https.HttpsError("invalid-argument", "Dados obrigatórios.");
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };
        try {
	    // Calcula e injeta a estrutura no objeto antes de salvar
if (data.ficha?.dias_da_semana) {
    const treinos = data.ficha.dias_da_semana
    .map(d => d.treino)
    .filter(t => t && t !== "Off" && t !== "")
    .map(t => t.replace("Treino ", ""));
data.ficha.estrutura_calculada = treinos.join("");
}			
            const isEdit = !!data.id;
            const url = isEdit
                ? `https://shapefy.online/api/resource/Ficha/${encodeURIComponent(data.id)}`
                : `https://shapefy.online/api/resource/Ficha`;
            const response = await fetch(url, { method: isEdit ? "PUT" : "POST", headers, body: JSON.stringify(data.ficha) });
            if (!response.ok) throw new Error(`Erro ${response.status}: ${await response.text()}`);
            const json = await response.json();
            console.log(`✅ Ficha ${isEdit ? "atualizada" : "criada"}: ${json.data?.name}`);
            return { success: true, data: json.data };
        } catch (e) {
            console.error("❌ salvarFicha:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.duplicarFicha = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        if (!data.id) throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };
        try {
            const getRes = await fetch(`https://shapefy.online/api/resource/Ficha/${encodeURIComponent(data.id)}`, { method: "GET", headers });
            if (!getRes.ok) throw new Error(`Erro ao buscar original: ${getRes.status}`);
            const original = (await getRes.json()).data;
            const copia = { ...original };
            delete copia.name; delete copia.creation; delete copia.modified;
            delete copia.modified_by; delete copia.owner; delete copia.numero_do_treino_para_aquele_aluno;
            copia.data_de_inicio = ""; copia.data_de_fim = "";
            if (data.novoAluno) { copia.aluno = data.novoAluno; copia.nome_completo = data.novoAlunoNome || ""; }
            const postRes = await fetch(`https://shapefy.online/api/resource/Ficha`, { method: "POST", headers, body: JSON.stringify(copia) });
            if (!postRes.ok) throw new Error(`Erro ao criar cópia: ${postRes.status}: ${await postRes.text()}`);
            const nova = (await postRes.json()).data;
            console.log(`✅ Duplicada: ${data.id} → ${nova.name}`);
            return { success: true, data: nova };
        } catch (e) {
            console.error("❌ duplicarFicha:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.buscarAlunosFicha = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        try {
            const busca = data.busca || "";
            let filtros = [["Aluno", "profissional", "=", "arteamconsultoria@gmail.com"]];
            if (busca) filtros.push(["Aluno", "nome_completo", "like", `%${busca}%`]);
            const params = `?fields=["name","nome_completo"]&filters=${JSON.stringify(filtros)}&limit_page_length=50`;
            const response = await fetch(`https://shapefy.online/api/resource/Aluno${params}`, {
                method: "GET",
                headers: { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" }
            });
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            const json = await response.json();
            return { success: true, list: json.data || [] };
        } catch (e) {
            console.error("❌ buscarAlunosFicha:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.buscarGruposMusculares = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        try {
            const response = await fetch(
                `https://shapefy.online/api/resource/Grupo Muscular?fields=["name"]&limit_page_length=100`,
                { method: "GET", headers: { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" } }
            );
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            const json = await response.json();
            return { success: true, list: (json.data || []).map(g => g.name) };
        } catch (e) {
            console.error("❌ buscarGruposMusculares:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.buscarExerciciosTreino = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        try {
            const campos = JSON.stringify(["name", "nome_do_exercicio", "grupo_muscular", "video", "plataforma_do_vídeo", "intensidade_json"
]);
            let filtros = [["Treino Exercicio", "enabled", "=", 1], ["Treino Exercicio", "owner", "in", "arteamconsultoria@gmail.com,teste@shapefy.com,Administrator"]];
            if (data.grupo_muscular) filtros.push(["Treino Exercicio", "grupo_muscular", "=", data.grupo_muscular]);
            const params = `?fields=${campos}&filters=${JSON.stringify(filtros)}&limit_page_length=500`;
            const response = await fetch(`https://shapefy.online/api/resource/Treino Exercicio${params}`, {
                method: "GET",
                headers: { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" }
            });
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            const json = await response.json();
            return { success: true, list: json.data || [] };
        } catch (e) {
            console.error("❌ buscarExerciciosTreino:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.buscarAlongamentos = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        try {
            // CORREÇÃO: URL codificada e retorno do objeto completo
            const response = await fetch(
                `https://shapefy.online/api/resource/Alongamento?fields=["name","nome_do_exercício","video","plataforma_do_vídeo"]&filters=[["Alongamento","enabled","=",1],["Alongamento","owner","=","arteamconsultoria@gmail.com"]]&limit_page_length=200`,
                { method: "GET", headers: { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" } }
            );
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            const json = await response.json();
            return { success: true, list: json.data || [] }; // Retorna Objetos
        } catch (e) {
            console.error("❌ buscarAlongamentos:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.buscarAerobicos = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        try {
            // CORREÇÃO: "Exercicio%20Aerobico" (com %20) para corrigir o Erro 500
            const campos = encodeURIComponent(JSON.stringify(["exercicio_aerobico", "video", "plataforma_do_vídeo"]));
const filtros = encodeURIComponent(JSON.stringify([["Exercicio Aerobico", "enabled", "=", 1], ["Exercicio Aerobico", "owner", "in", ["arteamconsultoria@gmail.com", "teste@shapefy.com", "Administrator"]]]));
const response = await fetch(
    `https://shapefy.online/api/resource/Exercicio%20Aerobico?fields=${campos}&filters=${filtros}&limit_page_length=200`,
    { method: "GET", headers: { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" } }
);
if (!response.ok) throw new Error(`Erro ${response.status}: ${await response.text()}`);
const json = await response.json();
return { success: true, list: json.data || [] };
} catch (e) {
    console.error("❌ buscarAerobicos:", e);
    throw new functions.https.HttpsError("internal", e.message);
}
});
exports.excluirFicha = functions
    .runWith({
        secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET", "FRAPPE_API_KEY_ADMIN", "FRAPPE_API_SECRET_ADMIN"],
        timeoutSeconds: 120,
    })
    .https.onCall(async (data, context) => {
        if (!data.id) throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");
        const fichaId = data.id;

        const apiKey = process.env.FRAPPE_API_KEY_ADMIN || process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET_ADMIN || process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");

        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };
        const FRAPPE = "https://shapefy.online/api/resource";

        // CASCADE: limpar Treino Realizado vinculados a esta Ficha
        let treinosRealizadosDeletados = 0;
        try {
            const filterByFicha = encodeURIComponent(JSON.stringify([["ficha", "=", fichaId]]));
            const listUrl = `${FRAPPE}/Treino%20Realizado?filters=${filterByFicha}&fields=${encodeURIComponent('["name"]')}&limit_page_length=500`;
            const listRes = await fetch(listUrl, { method: "GET", headers });
            if (listRes.ok) {
                const list = (await listRes.json()).data || [];
                for (const item of list) {
                    try {
                        const delRes = await fetch(`${FRAPPE}/Treino%20Realizado/${encodeURIComponent(item.name)}`, { method: "DELETE", headers });
                        if (delRes.ok || delRes.status === 404) treinosRealizadosDeletados++;
                    } catch (e) {
                        console.warn(`DELETE Treino Realizado/${item.name}: ${e.message}`);
                    }
                }
                console.log(`✓ Cascade: ${treinosRealizadosDeletados}/${list.length} Treino Realizado da Ficha ${fichaId}`);
            }
        } catch (e) {
            console.warn(`Cascade Treino Realizado falhou: ${e.message}`);
        }

        try {
            const response = await fetch(`${FRAPPE}/Ficha/${encodeURIComponent(fichaId)}`, {
                method: "DELETE",
                headers
            });

            if (!response.ok) {
                if (response.status === 404) return { success: true, message: "Ficha não encontrada ou já excluída.", cleaned: { treinos_realizados: treinosRealizadosDeletados } };
                throw new Error(`Erro ao excluir no Frappe: ${response.status} - ${await response.text()}`);
            }

            const json = await response.json();
            console.log(`✅ Ficha excluída: ${fichaId} (cascade: ${treinosRealizadosDeletados} treinos realizados)`);

            return { success: true, data: json, cleaned: { treinos_realizados: treinosRealizadosDeletados } };
        } catch (e) {
            console.error("❌ excluirFicha:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.salvarExercicio = functions.runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET", "FRAPPE_API_KEY_ADMIN", "FRAPPE_API_SECRET_ADMIN"] }).https.onCall(async (data) => {
    const apiKey = process.env.FRAPPE_API_KEY, apiSecret = process.env.FRAPPE_API_SECRET;
    const { id, exercicio } = data;
    if (!exercicio?.nome_do_exercicio) throw new functions.https.HttpsError("invalid-argument", "Nome obrigatório.");
    const intensidades = Array.isArray(exercicio.intensidade) ? exercicio.intensidade : [];
    const payload = {
        nome_do_exercicio: exercicio.nome_do_exercicio,
        grupo_muscular: exercicio.grupo_muscular || "",
        enabled: exercicio.enabled ?? 1,
        video: exercicio.video || "",
        "plataforma_do_vídeo": exercicio["plataforma_do_vídeo"] || "YouTube",
        intensidade_json: JSON.stringify(intensidades.map(i => ({ grupo_muscular: i.grupo_muscular, intensidade: String(i.intensidade) })), null, 1),
        intensidade: intensidades.map((item, idx) => ({ grupo_muscular: item.grupo_muscular, intensidade: String(item.intensidade), idx: idx + 1 }))
    };
    try {
        const url = id ? `${FRAPPE_BASE}/Treino Exercicio/${encodeURIComponent(id)}` : `${FRAPPE_BASE}/Treino Exercicio`;
        const response = await fetch(url, { method: id ? "PUT" : "POST", headers: getHeaders(apiKey, apiSecret), body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`Frappe ${response.status}: ${await response.text()}`);
        return { success: true, data: (await response.json()).data };
    } catch (e) { throw new functions.https.HttpsError("internal", e.message); }
});

exports.excluirExercicio = functions.runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET", "FRAPPE_API_KEY_ADMIN", "FRAPPE_API_SECRET_ADMIN"] }).https.onCall(async (data) => {
    if (!data.id) throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");
    const apiKey = process.env.FRAPPE_API_KEY_ADMIN || process.env.FRAPPE_API_KEY;
    const apiSecret = process.env.FRAPPE_API_SECRET_ADMIN || process.env.FRAPPE_API_SECRET;
    try {
        const response = await fetch(`${FRAPPE_BASE}/Treino Exercicio/${encodeURIComponent(data.id)}`, { method: "DELETE", headers: getHeaders(apiKey, apiSecret) });
        if (!response.ok && response.status !== 404) throw new Error(`Frappe ${response.status}: ${await response.text()}`);
        return { success: true };
    } catch (e) { throw new functions.https.HttpsError("internal", e.message); }
});

exports.buscarExercicioDetalhe = functions.runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET", "FRAPPE_API_KEY_ADMIN", "FRAPPE_API_SECRET_ADMIN"] }).https.onCall(async (data) => {
    if (!data.id) throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");
    const apiKey = process.env.FRAPPE_API_KEY_ADMIN || process.env.FRAPPE_API_KEY;
    const apiSecret = process.env.FRAPPE_API_SECRET_ADMIN || process.env.FRAPPE_API_SECRET;
    try {
        const response = await fetch(`${FRAPPE_BASE}/Treino Exercicio/${encodeURIComponent(data.id)}`, { method: "GET", headers: getHeaders(apiKey, apiSecret) });
        if (!response.ok) throw new Error(`Frappe ${response.status}`);
        return { success: true, data: (await response.json()).data };
    } catch (e) { throw new functions.https.HttpsError("internal", e.message); }
});

exports.migrarEstruturaPichas = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"], timeoutSeconds: 540 })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };

        let start = 0;
        const limit = 50;
        let total = 0;
        let erros = 0;

        while (true) {
            // Busca lote de fichas
            const params = `?fields=["name","dias_da_semana"]&filters=[["Ficha","profissional","=","arteamconsultoria@gmail.com"]]&limit_start=${start}&limit_page_length=${limit}`;
            const res = await fetch(`https://shapefy.online/api/resource/Ficha${params}`, { method: "GET", headers });
            if (!res.ok) break;

            const json = await res.json();
            const fichas = json.data || [];
            if (fichas.length === 0) break;

            // Para cada ficha, calcula e atualiza só o campo estrutura_calculada
            for (const f of fichas) {
                try {
                    // Busca detalhe para ter dias_da_semana completo
                    const det = await fetch(`https://shapefy.online/api/resource/Ficha/${f.name}?fields=["name","dias_da_semana"]`, { method: "GET", headers });
                    const detJson = await det.json();
                    const dias = detJson.data?.dias_da_semana || [];

                    const treinos = dias
    .map(d => d.treino)
    .filter(t => t && t !== "Off" && t !== "")
    .map(t => t.replace("Treino ", ""));
const estrutura = treinos.join("");

                    // Atualiza apenas o campo calculado
                    await fetch(`https://shapefy.online/api/resource/Ficha/${f.name}`, {
                        method: "PUT",
                        headers,
                        body: JSON.stringify({ estrutura_calculada: estrutura })
                    });
                    total++;
                } catch (e) {
                    console.error(`Erro na ficha ${f.name}:`, e.message);
                    erros++;
                }
            }

            if (fichas.length < limit) break;
            start += limit;
        }

        return { success: true, atualizadas: total, erros };
    });