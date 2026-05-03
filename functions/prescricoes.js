const functions = require("firebase-functions/v1");
const fetch = require("node-fetch");

const FRAPPE_URL = "https://shapefy.online";

const getHeaders = (apiKey, apiSecret) => ({
  "Content-Type": "application/json",
  Authorization: `token ${apiKey}:${apiSecret}`,
});

// Salva prescrição vinculada ao aluno no Frappe
exports.salvarPrescricao = functions
  .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
  .https.onCall(async (data) => {
    const { alunoId, nomeCompleto, profissional, date, items, notes } = data;

    const apiKey = process.env.FRAPPE_API_KEY;
    const apiSecret = process.env.FRAPPE_API_SECRET;

    const payload = {
      aluno: alunoId,
      nome_completo: nomeCompleto,
      profissional: profissional || "arteamconsultoria@gmail.com",
      published: 1,
      date: date,
      description: notes || "",
      prescriptions: items.map((item) => ({
        manipulated: item.name,
        // Junta os campos de forma objetiva: "Dose - Horário"
        description: `${item.dose || ""} - ${item.time || ""}`.replace(/^ - | - $/g, ''),
      })),
    };

    try {
const res = await fetch(`${FRAPPE_URL}/api/resource/Prescricao%20Paciente`, {
        method: "POST",
        headers: getHeaders(apiKey, apiSecret),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new functions.https.HttpsError("internal", json.message || "Erro ao salvar no Frappe");

      return { success: true, name: json.data.name };
    } catch (error) {
      throw new functions.https.HttpsError("internal", error.message || "Erro interno na function");
    }
});

// Lista prescrições de um aluno
exports.listarPrescricoes = functions
  .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
  .https.onCall(async (data) => {
    const { alunoId } = data;
    const apiKey = process.env.FRAPPE_API_KEY;
    const apiSecret = process.env.FRAPPE_API_SECRET;

    const res = await fetch(
      `${FRAPPE_URL}/api/resource/Prescricao Paciente?filters=[["aluno","=","${alunoId}"]]&fields=["name","date","description","prescriptions"]&order_by=date desc`,
      { headers: getHeaders(apiKey, apiSecret) }
    );

    const json = await res.json();
    if (!res.ok) throw new functions.https.HttpsError("internal", "Erro ao listar");

    return json.data;
});


// Lista todas as prescrições do profissional
exports.listarTodasPrescricoes = functions
  .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
  .https.onCall(async (data) => {
    const apiKey = process.env.FRAPPE_API_KEY;
    const apiSecret = process.env.FRAPPE_API_SECRET;
    const page = data?.page || 1;
    const limit = data?.limit || 30;
    const offset = (page - 1) * limit;
    const search = data?.search || "";

    const campos = encodeURIComponent(JSON.stringify([
      "name", "date", "nome_completo", "aluno", "creation", "description"
    ]));

    const filtrosArr = [["profissional", "=", "arteamconsultoria@gmail.com"]];
    if (search) filtrosArr.push(["nome_completo", "like", `%${search}%`]);
    const filtros = encodeURIComponent(JSON.stringify(filtrosArr));

    const res = await fetch(
      `${FRAPPE_URL}/api/resource/Prescricao%20Paciente?fields=${campos}&filters=${filtros}&order_by=creation%20desc&limit_page_length=${limit + 1}&limit_start=${offset}`,

      { headers: getHeaders(apiKey, apiSecret) }
    );
    const json = await res.json();
    if (!res.ok) throw new functions.https.HttpsError("internal", "Erro ao listar prescrições");
    const list = json.data || [];
    const hasMore = list.length > limit;
    return { list: hasMore ? list.slice(0, limit) : list, hasMore };
  });

exports.buscarPrescricaoDetalhe = functions
  .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
  .https.onCall(async (data) => {
    const { prescricaoId } = data;
    const apiKey = process.env.FRAPPE_API_KEY;
    const apiSecret = process.env.FRAPPE_API_SECRET;

    const res = await fetch(
      `${FRAPPE_URL}/api/resource/Prescricao%20Paciente/${encodeURIComponent(prescricaoId)}`,
      { headers: getHeaders(apiKey, apiSecret) }
    );
    const json = await res.json();
    if (!res.ok) throw new functions.https.HttpsError("internal", "Erro ao buscar prescrição");
    return json.data;
  });

exports.deletarPrescricao = functions
    .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
    .https.onCall(async (data) => {
        const { prescricaoId } = data;
        if (!prescricaoId) {
            throw new functions.https.HttpsError("invalid-argument", "prescricaoId é obrigatório.");
        }

        const apiKey = process.env.FRAPPE_API_KEY;
        const apiSecret = process.env.FRAPPE_API_SECRET;
        const headers = {
            "Authorization": `token ${apiKey}:${apiSecret}`,
            "Content-Type": "application/json"
        };

        const url = `https://shapefy.online/api/resource/Prescricao%20Paciente/${encodeURIComponent(prescricaoId)}`;

        const res = await fetch(url, { method: "DELETE", headers });

        if (!res.ok && res.status !== 404) {
            const txt = await res.text();
            throw new functions.https.HttpsError("internal", `Frappe ${res.status}: ${txt}`);
        }

        return { success: true };
    });