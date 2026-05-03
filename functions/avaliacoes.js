// functions/avaliacoes.js
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const BASE        = "https://shapefy.online/api/resource";
const DOCTYPE     = "Avaliacao%20da%20Composicao%20Corporal";
const DOCTYPE_RAW = "Avaliacao da Composicao Corporal";

const getHdrs = () => ({
  Authorization: `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`,
  "Content-Type": "application/json",
});

// Campos leves para a listagem
const LIST_FIELDS = JSON.stringify([
  "name", "aluno", "nome_completo", "date", "weight", "fat_mass", "lean_mass",
  "faulkner_body_fat", "guedes_body_fat", "jp3_body_fat", "jp4_body_fat", "jp7_body_fat",
  "skinfold_triceps", "skinfold_subscapular", "skinfold_suprailiac", "skinfold_abdominal",
]);

// Campos completos para o compare view
const DETAIL_FIELDS = JSON.stringify([
  "name", "aluno", "date", "weight", "fat_mass", "lean_mass", "bmi", "bmi_status",
  "whr", "whtr",
  "faulkner_body_fat", "guedes_body_fat", "jp3_body_fat", "jp4_body_fat", "jp7_body_fat",
  "skinfold_triceps", "skinfold_subscapular", "skinfold_suprailiac", "skinfold_abdominal",
  "skinfold_chest", "skinfold_midaxillary", "skinfold_thigh",
  "neck_circumference", "shoulder_circumference", "chest_circumference",
  "waist_circumference", "abdomen_circumference", "hip_circumference",
  "left_arm_relaxed", "left_arm_flexed", "left_forearm",
  "right_arm_relaxed", "right_arm_flexed", "right_forearm",
  "left_thigh", "left_calf", "right_thigh", "right_calf",
  "wrist_circumference", "ankle_circumference",
  "nome_completo", "sex", "height", "age", "profissional",
]);

// ─── listarAvaliacoes ──────────────────────────────────────────────────────────
// Retorna lista de avaliações. Aceita filtro opcional por aluno (Frappe ID).
exports.listarAvaliacoes = functions
  .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
  .https.onCall(async (data = {}) => {
    const hdrs = getHdrs();
    const fields  = encodeURIComponent(LIST_FIELDS);
    const limit = data.limit || 100;
    const offset = data.offset || 0;
    const filters = [];
    if (data.aluno) filters.push([DOCTYPE_RAW, 'aluno', '=', data.aluno]);
    if (data.nome)  filters.push([DOCTYPE_RAW, 'nome_completo', 'like', `%${data.nome}%`]);
    let url = `${BASE}/${DOCTYPE}?fields=${fields}&limit_page_length=${limit}&order_by=date%20desc&limit_start=${offset}`;

    if (filters.length) url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;

    const res = await fetch(url, { headers: hdrs });
    if (!res.ok) throw new functions.https.HttpsError("internal", `Frappe ${res.status}`);
    const json = await res.json();
    return { success: true, data: json.data || [] };
  });

// ─── buscarAvaliacoesPorAluno ──────────────────────────────────────────────────
// Retorna TODAS as avaliações de um aluno, com todos os campos,
// ordenadas por data crescente (para gráficos de evolução).
exports.buscarAvaliacoesPorAluno = functions
  .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
  .https.onCall(async (data = {}) => {
    if (!data.aluno)
      throw new functions.https.HttpsError("invalid-argument", "aluno obrigatório");

    const hdrs    = getHdrs();
    const fields  = encodeURIComponent(DETAIL_FIELDS);
    const filters = encodeURIComponent(JSON.stringify([[DOCTYPE_RAW, "aluno", "=", data.aluno]]));
    const url = `${BASE}/${DOCTYPE}?fields=${fields}&filters=${filters}&limit_page_length=50&order_by=date%20asc`;

    const res = await fetch(url, { headers: hdrs });
    if (!res.ok) throw new functions.https.HttpsError("internal", `Frappe ${res.status}`);
    const json = await res.json();
    return { success: true, data: json.data || [] };
  });

// ─── criarAvaliacao ────────────────────────────────────────────────────────────
// Cria uma nova avaliação no Frappe.
// O campo `payload` deve conter todos os campos do doctype.
exports.criarAvaliacao = functions
  .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
  .https.onCall(async (data = {}) => {
    if (!data.payload)
      throw new functions.https.HttpsError("invalid-argument", "payload obrigatório");

    const hdrs = getHdrs();
    const res = await fetch(`${BASE}/${DOCTYPE}`, {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify(data.payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new functions.https.HttpsError("internal", `Frappe ${res.status}: ${txt}`);
    }
    const json = await res.json();
    return { success: true, data: json.data };
  });

// ─── excluirAvaliacao ──────────────────────────────────────────────────────────
exports.excluirAvaliacao = functions
  .runWith({ secrets: ["FRAPPE_API_KEY", "FRAPPE_API_SECRET"] })
  .https.onCall(async (data = {}) => {
    if (!data.name)
      throw new functions.https.HttpsError("invalid-argument", "name obrigatório");

    const hdrs = getHdrs();
    const res = await fetch(`${BASE}/${DOCTYPE}/${encodeURIComponent(data.name)}`, {
      method: "DELETE",
      headers: hdrs,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new functions.https.HttpsError("internal", `Frappe ${res.status}: ${txt}`);
    }
    return { success: true };
  });
