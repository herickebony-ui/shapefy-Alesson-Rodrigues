import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();

export const listarAlunos = async ({ search = "", page = 1, limit = 20 } = {}) => {
    const fn = httpsCallable(functions, "listarAlunos");
    const result = await fn({ search, page, limit });
    return result.data;
};

export const listarAnamnesesPorAluno = async (alunoId) => {
    const fn = httpsCallable(functions, "listarAnamnesesPorAluno");
    const result = await fn({ alunoId });
    return result.data;
};

export const buscarAnamneseDetalhe = async (anamneseId) => {
    const fn = httpsCallable(functions, "buscarAnamneseDetalhe");
    const result = await fn({ anamneseId });
    return result.data;
};

export const salvarAluno = async (id, campos) => {
    const fn = httpsCallable(functions, "salvarAluno");
    const result = await fn({ id, campos });
    return result.data;
};

export const listarFormulariosAnamnese = async () => {
    const fn = httpsCallable(functions, "listarFormulariosAnamnese");
    const result = await fn();
    return result.data;
};

export const vincularAnamnese = async (alunoId, formulario, enviarAluno = true) => {
    const fn = httpsCallable(functions, "vincularAnamnese");
    const result = await fn({ alunoId, formulario, enviarAluno });
    return result.data;
};

export const salvarAnamnese = async (anamneseId, perguntas) => {
    const fn = httpsCallable(functions, "salvarAnamnese");
    const result = await fn({ anamneseId, perguntas });
    return result.data;
};