// src/components/dietaService.js
// Serviço de Dietas — chama Firebase Functions (nunca o Frappe diretamente)

import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();

// ─── Instâncias das Functions ─────────────────────────────────────────────────

const _buscarDietas            = httpsCallable(functions, "buscarDietas");
const _buscarDietaDetalhe      = httpsCallable(functions, "buscarDietaDetalhe");
const _salvarDieta             = httpsCallable(functions, "salvarDieta");
const _buscarAlimentos         = httpsCallable(functions, "buscarAlimentos");
const _buscarGruposAlimentares = httpsCallable(functions, "buscarGruposAlimentares");

// ─── Helper ───────────────────────────────────────────────────────────────────

// const _buscarDietas = async (opts = {}) => {
//     // 1. Configuração de campos e paginação
//     const campos = JSON.stringify([
//         "name", "nome_completo", "aluno", "profissional",
//         "date", "final_date", "strategy", "week_days",
//         "total_calories", "docstatus",
//         "meal_1", "meal_2", "meal_3", "meal_4",
//         "meal_5", "meal_6", "meal_7", "meal_8",
//     ]);

//     const page = parseInt(opts.page) || 1;
//     const limit = parseInt(opts.limit) || 20;
//     const start = (page - 1) * limit;

//     // 2. Construção dos filtros
//     // Se o profissional não for passado, o Frappe filtrará pelo Owner ou permissões de User
//     let filtros = [];
//     if (opts.profissional) {
//         filtros.push(["Dieta", "profissional", "=", opts.profissional]);
//     }
//     if (opts.aluno) {
//         filtros.push(["Dieta", "nome_completo", "like", `%${opts.aluno}%`]);
//     }
//     if (opts.strategy) {
//         filtros.push(["Dieta", "strategy", "=", opts.strategy]);
//     }
//     if (opts.docstatus !== undefined && opts.docstatus !== null) {
//         filtros.push(["Dieta", "docstatus", "=", opts.docstatus]);
//     }

//     const params = new URLSearchParams({
//         fields: campos,
//         filters: JSON.stringify(filtros),
//         order_by: "date desc",
//         limit_start: start,
//         limit_page_length: limit,
//     });

//     // 3. Chamada com credentials: "include"
//     const response = await fetch(
//         `https://shapefy.online/api/resource/Dieta?${params}`,
//         {
//             method: "GET",
//             headers: {
//                 "Content-Type": "application/json",
//                 "Accept": "application/json",
//             },
//             // Envia os cookies de sessão (sid) automaticamente
//             credentials: "include", 
//         }
//     );

//     if (!response.ok) {
//         // Se der 403, provavelmente a sessão expirou ou o usuário não tem permissão
//         const errorMsg = await response.text();
//         throw new Error(`Erro na busca: ${response.status} - ${errorMsg}`);
//     }

//     const json = await response.json();
//     const data = json.data || [];

//     return {
//         list: data,
//         hasMore: data.length === limit,
//     };
// };

// const _buscarDietaDetalhe = async (opts = {}) => {
//     if (!opts.id) {
//         throw new Error("O ID da dieta é obrigatório.");
//     }

//     // No Frappe, a rota para um documento específico é /api/resource/DocType/NomeDoDoc
//     const url = `https://shapefy.online/api/resource/Dieta/${encodeURIComponent(opts.id)}`;

//     const response = await fetch(url, {
//         method: "GET",
//         headers: {
//             "Content-Type": "application/json",
//             "Accept": "application/json",
//         },
//         // Mantém a sessão ativa do usuário logado
//         credentials: "include",
//     });

//     if (!response.ok) {
//         const errorText = await response.text();
//         throw new Error(`Erro ao buscar detalhes (${response.status}): ${errorText}`);
//     }

//     const json = await response.json();

//     // O Frappe retorna o objeto do documento dentro da chave 'data'
//     return json.data;
// };

const call = async (fn, payload = {}) => {
    const result = await fn(payload);
    if (!result.data?.success) throw new Error("Resposta inválida da função.");
    return result.data;
};

// ─── API Pública ──────────────────────────────────────────────────────────────

/** Lista dietas com filtros e paginação. */
export const listarDietas = async (opts = {}) => {
    const data = await call(_buscarDietas, opts);
    return { list: data.list, hasMore: data.hasMore };
};
export const buscarRefeicoesProntas = async (data) => {
    const fn = httpsCallable(functions, 'buscarRefeicoesProntas');
    const res = await fn(data);
    return res.data;
};

export const buscarRefeicaoProntaDetalhe = async (id) => {
    const fn = httpsCallable(functions, 'buscarRefeicaoProntaDetalhe');
    const res = await fn({ id });
    return res.data;
};
/**
 * Busca o documento completo de uma Dieta (com todos os child tables).
 * @param {string} id - ID do documento Frappe
 */
export const buscarDietaDetalhe = async (id) => {
    const fn = httpsCallable(functions, "buscarDietaDetalhe");
    const res = await fn({ id });
    return res.data;
};
export const buscarAlunoDetalhe = async (id) => {
    const fn = httpsCallable(functions, "buscarAlunoDetalhe");
    const res = await fn({ id });
    return res.data;
};

/**
 * Salva (PUT) campos de uma dieta existente no Frappe.
 * @param {string} id     - ID do documento Frappe
 * @param {Object} campos - Campos a atualizar ex: { obs, general_description }
 */

export const buscarAlimentos = async (filtros = {}) => {
    const data = await call(_buscarAlimentos, filtros);
    return data;
};

export const excluirDieta = async (id) => {
    const fn = httpsCallable(functions, "excluirDieta");
    const res = await fn({ id });
    return res.data;
};

export const salvarDieta = async (id, campos) => {
    const data = await call(_salvarDieta, { id, campos });
    return data;
};

/** Lista alimentos com busca e paginação. */
export const listarAlimentos = async (opts = {}) => {
    const data = await call(_buscarAlimentos, opts);
    return { list: data.list, hasMore: data.hasMore };
};
export const duplicarDieta = async (id, novoAluno = null, dataInicial = null, dataFinal = null) => {
    const fn = httpsCallable(functions, "duplicarDieta");
    const res = await fn({ id, novoAluno, dataInicial, dataFinal });
    return res.data;
};

export const salvarRefeicaoPronta = async (full_name, table_foods) => {
    const fn = httpsCallable(functions, "salvarRefeicaoPronta");
    const res = await fn({ full_name, table_foods });
    return res.data;
};

/** Lista todos os grupos alimentares. */
export const listarGruposAlimentares = async () => {
    const data = await call(_buscarGruposAlimentares);
    return data.list;
};