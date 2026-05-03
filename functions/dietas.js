const functions = require("firebase-functions/v1");

// ============================================================================
// DIETAS — COLE ESTE BLOCO INTEIRO NO FINAL DO SEU index.js
// ============================================================================

exports.buscarDietas = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;

        if (!apiKey || !apiSecret)
            throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");

        const headers = {
            "Authorization": `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json",
        };

        try {
            const campos = JSON.stringify([
    "name", "nome_completo", "aluno", "profissional",
    "date", "final_date", "strategy", "week_days",
    "total_calories", "docstatus",
    "creation", "modified", "modified_by", "owner",
    "meal_1", "meal_2", "meal_3", "meal_4",
    "meal_5", "meal_6", "meal_7", "meal_8",
]);

            // ─── PAGINAÇÃO ───────────────────────────────────────────────
            const page  = parseInt(data.page)  || 1;
            const limit = parseInt(data.limit) || 20;
            const start = (page - 1) * limit;

            // ─── FILTROS SERVER-SIDE ─────────────────────────────────────
            // Troque o email abaixo pelo do profissional logado ou passe via data.profissional
            const profissional = data.profissional || "herickebony@gmail.com";
            let filtros = [["Dieta", "profissional", "=", profissional]];

            if (data.aluno)    filtros.push(["Dieta", "nome_completo", "like", `%${data.aluno}%`]);
            if (data.strategy) filtros.push(["Dieta", "strategy", "=", data.strategy]);
            if (data.docstatus !== undefined && data.docstatus !== null)
                filtros.push(["Dieta", "docstatus", "=", data.docstatus]);

            const params = new URLSearchParams({
                fields:            campos,
                filters:           JSON.stringify(filtros),
                order_by:          "date desc",
                limit_start:       start,
                limit_page_length: limit,
            });

            const response = await fetch(
                `https://shapefy.online/api/resource/Dieta?${params}`,
                { method: "GET", headers }
            );

            if (!response.ok)
                throw new Error(`Erro ${response.status}: ${await response.text()}`);

            const json   = await response.json();
            const dietas = json.data || [];

            return {
                success: true,
                list:    dietas,
                hasMore: dietas.length === limit,
            };
        } catch (e) {
            console.error("❌ buscarDietas:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.excluirDieta = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        if (!data.id) throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        try {
            const response = await fetch(
                `https://shapefy.online/api/resource/Dieta/${encodeURIComponent(data.id)}`,
                { method: "DELETE", headers: { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" } }
            );
            if (!response.ok && response.status !== 404) throw new Error(`Erro ${response.status}: ${await response.text()}`);
            console.log(`✅ Dieta excluída: ${data.id}`);
            return { success: true };
        } catch (e) {
            console.error("❌ excluirDieta:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

// ─────────────────────────────────────────────────────────────────────────────

exports.buscarDietaDetalhe = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        if (!data.id)
            throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");

        const apiKey    = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;

        if (!apiKey || !apiSecret)
            throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");

        try {
            const response = await fetch(
                `https://shapefy.online/api/resource/Dieta/${encodeURIComponent(data.id)}`,
                {
                    method:  "GET",
                    headers: {
                        "Authorization": `token ${apiKey}:${apiSecret}`,
                        "Content-Type":  "application/json",
                    },
                }
            );

            if (!response.ok)
                throw new Error(`Erro ${response.status}: ${await response.text()}`);

            const json = await response.json();
            return { success: true, data: json.data };
        } catch (e) {
            console.error("❌ buscarDietaDetalhe:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

// ─────────────────────────────────────────────────────────────────────────────

exports.buscarAlimentos = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey    = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;

        if (!apiKey || !apiSecret)
            throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");

        const headers = {
            "Authorization": `token ${apiKey}:${apiSecret}`,
            "Content-Type":  "application/json",
        };

        try {
            // AQUI ESTÁ O SEGREDO: Puxando todos os campos (inclusive vitaminas/minerais)
            const campos = JSON.stringify(["*"]);

            const page  = parseInt(data.page)  || 1;
            const limit = parseInt(data.limit) || 100;
            const start = (page - 1) * limit;

            const owners = ["herickebony@gmail.com", "teste@shapefy.com", "Administrator"];
            let filtros = [["Alimento", "owner", "in", owners]];
            if (data.search)     filtros.push(["Alimento", "name", "like", `%${data.search}%`]);
            if (data.food_group) filtros.push(["Alimento", "food_group", "=", data.food_group]);

            const params = new URLSearchParams({
                fields:            campos,
                filters:           JSON.stringify(filtros),
                order_by:          "name asc",
                limit_start:       start,
                limit_page_length: limit,
            });

            const response = await fetch(
                `https://shapefy.online/api/resource/Alimento?${params}`,
                { method: "GET", headers }
            );

            if (!response.ok)
                throw new Error(`Erro ${response.status}: ${await response.text()}`);

            const json = await response.json();
            return {
                success: true,
                list:    json.data || [],
                hasMore: (json.data || []).length === limit,
            };
        } catch (e) {
            console.error("❌ buscarAlimentos:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

// ─────────────────────────────────────────────────────────────────────────────

exports.buscarGruposAlimentares = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey    = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;

        if (!apiKey || !apiSecret)
            throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");

        try {
            const params = new URLSearchParams({
                fields:            JSON.stringify(["name", "group_name"]),
                order_by:          "group_name asc",
                limit_page_length: 200,
            });

            const response = await fetch(
                `https://shapefy.online/api/resource/Grupo Alimentar?${params}`,
                {
                    method:  "GET",
                    headers: {
                        "Authorization": `token ${apiKey}:${apiSecret}`,
                        "Content-Type":  "application/json",
                    },
                }
            );

            if (!response.ok)
                throw new Error(`Erro ${response.status}: ${await response.text()}`);

            const json = await response.json();
            return { success: true, list: json.data || [] };
        } catch (e) {
            console.error("❌ buscarGruposAlimentares:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });
// ============================================================================
// ADICIONE ESTA FUNCTION AO FINAL DO SEU functions/index.js
// ============================================================================
exports.salvarDieta = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        if (!data.campos) throw new functions.https.HttpsError("invalid-argument", "Campos obrigatórios.");
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        
        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };
        const isNova = !data.id;

// Atualiza o Total Geral na nutrients_table com o valor correto
if (data.campos.nutrients_table && Array.isArray(data.campos.nutrients_table)) {
    const totalIdx = data.campos.nutrients_table.findIndex(r => r.food_option === "Total Geral");
    if (totalIdx !== -1 && data.campos.total_calories) {
        data.campos.nutrients_table[totalIdx].calories = data.campos.total_calories;
    }
}

        try {
            for (let i = 1; i <= 8; i++) {
                for (let j = 1; j <= 10; j++) {
                    const field = `meal_${i}_option_${j}_items`;
                    if (data.campos[field] && Array.isArray(data.campos[field])) {
                        data.campos[field] = data.campos[field].map((item, index) => ({
                            ...item,
                            idx: index + 1
                        }));
                    }
                }
            }

            const url = isNova
                ? `https://shapefy.online/api/resource/Dieta`
                : `https://shapefy.online/api/resource/Dieta/${encodeURIComponent(data.id)}`;

            const response = await fetch(url, {
                method: isNova ? "POST" : "PUT",
                headers,
                body: JSON.stringify(data.campos),
            });

            if (!response.ok) throw new Error(`Erro ${response.status}: ${await response.text()}`);
            
            const json = await response.json();
            console.log(`✅ Dieta ${isNova ? "criada" : "salva"}: ${json.data?.name}`);
console.log(`🔥 total_calories enviado: ${data.campos.total_calories} | retornado pelo Frappe: ${json.data?.total_calories}`);
            return { success: true, data: json.data };

        } catch (e) {
            console.error("❌ salvarDieta:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

// ============================================================================
// REFEIÇÕES PRONTAS
// ============================================================================
exports.buscarRefeicoesProntas = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        try {
    const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };
    const searchFiltro = data.search ? [["Refeicoes", "full_name", "like", `%${data.search}%`]] : [];

    const makeUrl = (extraFiltro) => `https://shapefy.online/api/resource/Refeicoes?${new URLSearchParams({
        fields: JSON.stringify(["name", "full_name"]),
        filters: JSON.stringify([["Refeicoes", "enabled", "=", 1], extraFiltro, ...searchFiltro]),
        limit_page_length: 50,
    })}`;

    const [res1, res2] = await Promise.all([
        fetch(makeUrl(["Refeicoes", "profissional", "=", "herickebony@gmail.com"]), { headers }),
        fetch(makeUrl(["Refeicoes", "owner", "=", "herickebony@gmail.com"]), { headers }),
    ]);

    const [json1, json2] = await Promise.all([res1.json(), res2.json()]);
    const combined = [...(json1.data || []), ...(json2.data || [])];
    const unique = combined.filter((item, idx, arr) => arr.findIndex(i => i.name === item.name) === idx);

    return { success: true, list: unique };
 } catch (e) {
            console.error("❌ buscarRefeicoesProntas:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });

exports.salvarRefeicaoPronta = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        if (!data.full_name) throw new functions.https.HttpsError("invalid-argument", "Nome obrigatório.");
        if (!data.table_foods || !data.table_foods.length) throw new functions.https.HttpsError("invalid-argument", "Alimentos obrigatórios.");
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };
        const camposRemover = ["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "parent", "parentfield", "parenttype", "doctype", "__uid", "_base"];
        const table_foods = data.table_foods.map(item => {
            const limpo = { ...item };
            camposRemover.forEach(c => delete limpo[c]);
            return limpo;
        });
        try {
	    console.log("📦 data recebido:", JSON.stringify(data));
    console.log("📤 body enviado:", JSON.stringify({ full_name: data.full_name, enabled: 1, public: 0, profissional: "herickebony@gmail.com", table_foods })); 		
            const response = await fetch(`https://shapefy.online/api/resource/Refeicoes`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    full_name: data.full_name,
                    enabled: 1,
                    public: 0,
                    profissional: "herickebony@gmail.com",
                    table_foods
                })
            });
            if (!response.ok) throw new Error(`Erro ${response.status}: ${await response.text()}`);
            const json = await response.json();
            console.log("📥 resposta Frappe:", JSON.stringify(json.data));
            console.log(`✅ Refeição pronta salva: ${json.data?.name}`);
            return { success: true, data: json.data };
        } catch (e) {
            console.error("❌ salvarRefeicaoPronta:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });
// ─────────────────────────────────────────────────────────────────────────────
exports.buscarRefeicaoProntaDetalhe = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");

        try {
            const response = await fetch(`https://shapefy.online/api/resource/Refeicoes/${encodeURIComponent(data.id)}`, {
                method: "GET", headers: { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" }
            });
            if (!response.ok) throw new Error(`Erro ${response.status}: ${await response.text()}`);
            const json = await response.json();
            return { success: true, data: json.data };
        } catch (e) {
            console.error("❌ buscarRefeicaoProntaDetalhe:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });
// ─────────────────────────────────────────────────────────────────────────────
exports.duplicarDieta = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data, context) => {
        if (!data.id) throw new functions.https.HttpsError("invalid-argument", "ID obrigatório.");
        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        if (!apiKey || !apiSecret) throw new functions.https.HttpsError("failed-precondition", "Credenciais ausentes.");
        const headers = { "Authorization": `token ${apiKey}:${apiSecret}`, "Content-Type": "application/json" };

        try {
            // 1. Busca a dieta original completa
            const getRes = await fetch(`https://shapefy.online/api/resource/Dieta/${encodeURIComponent(data.id)}`, { method: "GET", headers });
            if (!getRes.ok) throw new Error(`Erro ao buscar original: ${getRes.status}`);
            const original = (await getRes.json()).data;

            // 2. Copia e limpa campos de controle
            const camposRemover = ["name", "creation", "modified", "modified_by", "owner", "docstatus", "idx", "amended_from"];
            const copia = { ...original };
            camposRemover.forEach(c => delete copia[c]);
	     
            // Aplica datas se fornecidas
if (data.dataInicial !== undefined) copia.date = data.dataInicial || "";
if (data.dataFinal !== undefined) copia.final_date = data.dataFinal || "";				

            // 3. Se vier novoAluno, busca dados atualizados dele
            const alunoId = data.novoAluno || original.aluno;
            const alunoRes = await fetch(`https://shapefy.online/api/resource/Aluno/${encodeURIComponent(alunoId)}`, { method: "GET", headers });
            if (alunoRes.ok) {
                const aluno = (await alunoRes.json()).data;
                copia.aluno = aluno.name;
                copia.nome_completo = aluno.nome_completo;
                copia.sexo = aluno.sexo || copia.sexo;
                copia.age = aluno.age || copia.age;
                copia.weight = aluno.weight || copia.weight;
                copia.height = aluno.height ? aluno.height * 100 : copia.height;
            }

            // 4. Limpa campos de controle das child tables (refeições)
            const camposChildRemover = ["name", "owner", "creation", "modified", "modified_by", "docstatus", "parent", "parentfield", "parenttype"];
            for (let i = 1; i <= 8; i++) {
                for (let j = 1; j <= 10; j++) {
                    const field = `meal_${i}_option_${j}_items`;
                    if (copia[field]) {
                        copia[field] = copia[field].map(item => {
                            const limpo = { ...item };
                            camposChildRemover.forEach(c => delete limpo[c]);
                            return limpo;
                        });
                    }
                }
            }

            // 5. Cria a cópia
            const postRes = await fetch(`https://shapefy.online/api/resource/Dieta`, { method: "POST", headers, body: JSON.stringify(copia) });
            if (!postRes.ok) throw new Error(`Erro ao criar cópia: ${postRes.status}: ${await postRes.text()}`);
            const nova = (await postRes.json()).data;
            console.log(`✅ Dieta duplicada: ${data.id} → ${nova.name}`);
            return { success: true, data: nova };
        } catch (e) {
            console.error("❌ duplicarDieta:", e);
            throw new functions.https.HttpsError("internal", e.message);
        }
    });