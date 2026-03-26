import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc
} from "firebase/firestore";

// ─── ÍCONES ───────────────────────────────────────────────────────────────────
const Ico = ({ n, s = 16 }) => ({
    x: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    plus: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    spin: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" strokeOpacity=".2" /><path d="M12 2a10 10 0 0110 10" strokeLinecap="round" /></svg>,
    search: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
    trash: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>,
    edit: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
    check: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>,
}[n] || null);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const normalizar = (str) =>
    (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const buscarComCoringa = (texto, query) => {
    const partes = query.split("%").map(normalizar).filter(Boolean);
    const alvo = normalizar(texto);
    return partes.every(p => alvo.includes(p));
};

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────
const CATEGORIAS = [
    { id: "orientacoes_gerais", label: "Orientações Gerais", cor: "blue" },
    { id: "orientacoes_treino", label: "Orientações Treino", cor: "red" },
    { id: "orientacoes_aerobicos", label: "Orientações Aeróbicos", cor: "green" },
    { id: "orientacoes_aem", label: "Orientações Alongamentos", cor: "yellow" },
    { id: "instrucoes_aerobicos", label: "Instruções Aeróbicos", cor: "green" },
    { id: "observacoes_alongamentos", label: "Observações Alongamentos", cor: "yellow" },
    { id: "instrucoes_treino", label: "Instruções Treino", cor: "red" },
    { id: "frequencia_aerobicos", label: "Frequência Aeróbicos", cor: "green" },
    { id: "repeticoes_treino", label: "Repetições Treino", cor: "blue" },
    { id: "descanso_treino", label: "Descanso Treino", cor: "yellow" },
    { id: "estrategia", label: "Estratégia", cor: "blue" },
    { id: "dias_semana", label: "Dias da Semana", cor: "green" },
    { id: "descricoes_gerais", label: "Descrições Gerais", cor: "yellow" },
    { id: "observacoes_dieta", label: "Observações (Dieta)", cor: "red" },
    { id: "legendas_refeicoes", label: "Legendas das Refeições", cor: "blue" },
];

const CORES = {
    blue: { tab: "bg-blue-500/20 text-blue-400 border-blue-500/40", badge: "bg-blue-500/10 text-blue-400 border border-blue-500/30", dot: "bg-blue-400" },
    green: { tab: "bg-green-500/20 text-green-400 border-green-500/40", badge: "bg-green-500/10 text-green-400 border border-green-500/30", dot: "bg-green-400" },
    yellow: { tab: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40", badge: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30", dot: "bg-yellow-400" },
    red: { tab: "bg-[#850000]/20 text-red-400 border-[#850000]/40", badge: "bg-[#850000]/10 text-red-400 border border-[#850000]/30", dot: "bg-red-400" },
};

const buscarSugestoes = async (categoria) => {
    const q = query(
        collection(db, "sugestoes"),
        where("categoria", "==", categoria)
    );

    const snap = await getDocs(q);

    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
            (a.texto || "").localeCompare((b.texto || ""), "pt-BR", {
                sensitivity: "base",
                numeric: true
            })
        );
};

const deletarSugestao = async (id) => {
    await deleteDoc(doc(db, "sugestoes", id));
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Legendas() {
    const [abaAtiva, setAbaAtiva] = useState(CATEGORIAS[0].id);
    const [sugestoes, setSugestoes] = useState({});
    const [loading, setLoading] = useState({});
    const [busca, setBusca] = useState("");
    const [novoTexto, setNovoTexto] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [confirmarDelete, setConfirmarDelete] = useState(null);
    // NOVOS ESTADOS AQUI:
    const [editando, setEditando] = useState(null);
    const [textoEditado, setTextoEditado] = useState("");

    const handleSalvarEdicao = async (id) => {
        if (!textoEditado.trim()) {
            setEditando(null);
            return;
        }
    
        const textoLimpo = textoEditado.trim();
    
        try {
            await updateDoc(doc(db, "sugestoes", id), { texto: textoLimpo });
    
            setSugestoes(s => ({
                ...s,
                [abaAtiva]: (s[abaAtiva] || [])
                    .map(item =>
                        item.id === id ? { ...item, texto: textoLimpo } : item
                    )
                    .sort((a, b) =>
                        (a.texto || "").localeCompare((b.texto || ""), "pt-BR", {
                            sensitivity: "base",
                            numeric: true
                        })
                    )
            }));
    
            setEditando(null);
            setFeedback("Editado!");
            setTimeout(() => setFeedback(""), 2500);
        } catch (e) {
            console.error("Erro ao editar no Firebase:", e);
            alert("Erro ao editar no Firebase:\n" + e.message);
        }
    };

    const categoriaAtual = CATEGORIAS.find(c => c.id === abaAtiva);
    const cor = CORES[categoriaAtual.cor];

    // Carrega sugestões da categoria ativa
    useEffect(() => {
        let ativo = true;

        const carregarCategoriaAtiva = async () => {
            // Ativa o loading apenas se não houver dados em cache para evitar piscar a tela
            if (!sugestoes[abaAtiva]) {
                setLoading(l => ({ ...l, [abaAtiva]: true }));
            }

            try {
                const dados = await buscarSugestoes(abaAtiva);
                if (ativo) {
                    setSugestoes(s => ({ ...s, [abaAtiva]: dados }));
                }
            } catch (e) {
                console.error("Erro ao buscar no Firebase:", e);
            } finally {
                if (ativo) {
                    setLoading(l => ({ ...l, [abaAtiva]: false }));
                }
            }
        };

        carregarCategoriaAtiva();

        return () => {
            ativo = false; // Cancela atualizações na tela se o usuário mudar de aba rápido
        };
    }, [abaAtiva]);

    const lista = (sugestoes[abaAtiva] || []).filter(s =>
        busca.trim() ? buscarComCoringa(s.texto, busca) : true
    );

    const handleAdicionar = async () => {
        if (!novoTexto.trim() || salvando) return;
    
        const textoLimpo = novoTexto.trim();
    
        const jaExiste = (sugestoes[abaAtiva] || []).some(
            s => (s.texto || "").trim() === textoLimpo
        );
    
        if (jaExiste) {
            setFeedback("Texto já existe nesta categoria.");
            setTimeout(() => setFeedback(""), 2500);
            return;
        }
    
        setSalvando(true);
        setFeedback("");
    
        try {
            const novaRef = await addDoc(collection(db, "sugestoes"), {
                categoria: abaAtiva,
                texto: textoLimpo
            });
    
            setSugestoes(s => ({
                ...s,
                [abaAtiva]: [
                    ...(s[abaAtiva] || []),
                    { id: novaRef.id, categoria: abaAtiva, texto: textoLimpo }
                ].sort((a, b) =>
                    (a.texto || "").localeCompare((b.texto || ""), "pt-BR", {
                        sensitivity: "base",
                        numeric: true
                    })
                )
            }));
    
            setNovoTexto("");
            setFeedback("Salvo!");
            setTimeout(() => setFeedback(""), 2500);
        } catch (e) {
            console.error("Erro ao salvar no Firebase:", e);
            alert("Erro ao salvar no Firebase:\n" + e.message);
        } finally {
            setSalvando(false);
        }
    };

    const handleDeletar = async (id) => {
        await deletarSugestao(id);
        setSugestoes(s => ({ ...s, [abaAtiva]: (s[abaAtiva] || []).filter(x => x.id !== id) }));
        setConfirmarDelete(null);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdicionar();
    };

    return (
        <div className="min-h-screen bg-[#202024] text-white">
            {/* CABEÇALHO */}
            <div className="px-8 pt-8 pb-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white">Banco de Textos</h1>
                    <p className="text-gray-400 text-sm mt-0.5">Gerencie as sugestões salvas para cada campo</p>
                </div>

                {/* ABAS */}
                <div className="flex gap-2 flex-wrap">
                    {CATEGORIAS.map(cat => {
                        const c = CORES[cat.cor];
                        const total = (sugestoes[cat.id] || []).length;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => { setAbaAtiva(cat.id); setBusca(""); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${abaAtiva === cat.id ? c.tab : "border-[#323238] text-gray-400 hover:text-white hover:bg-[#323238]"}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${c.dot}`}></span>
                                {cat.label}
                                {total > 0 && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.badge}`}>{total}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* CONTEÚDO */}
            <div className="px-8 pb-8 flex flex-col gap-4 max-w-4xl">

                {/* CAMPO ADICIONAR */}
                <div className="bg-[#29292e] border border-[#323238] rounded-2xl p-5 flex flex-col gap-3">
                    <h3 className="text-white font-semibold text-sm">Adicionar novo texto</h3>
                    <textarea
                        value={novoTexto}
                        onChange={e => setNovoTexto(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Digite o texto para "${categoriaAtual.label}"...\n\nDica: Ctrl+Enter para salvar`}
                        rows={4}
                        className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 w-full outline-none focus:border-[#850000]/60 transition placeholder-gray-600 resize-none"
                    />
                    <div className="flex items-center justify-between">
                        <span className={`text-xs transition ${feedback ? "opacity-100" : "opacity-0"} ${feedback === "Salvo!" ? "text-green-400" : "text-yellow-400"}`}>
                            {feedback || "—"}
                        </span>
                        <button
                            onClick={handleAdicionar}
                            disabled={salvando || !novoTexto.trim()}
                            className="flex items-center gap-2 bg-[#850000] hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
                        >
                            {salvando ? <><Ico n="spin" s={14} /> Salvando...</> : <><Ico n="plus" s={14} /> Adicionar</>}
                        </button>
                    </div>
                </div>

                {/* BUSCA */}
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><Ico n="search" s={14} /></span>
                    <input
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        placeholder="Buscar... use % como coringa (ex: %rest%pause)"
                        className="w-full bg-[#29292e] border border-[#323238] text-gray-200 text-sm rounded-lg pl-9 pr-4 py-2.5 outline-none focus:border-[#850000]/60 placeholder-gray-600"
                    />
                </div>

                {/* LISTA */}
                <div className="bg-[#29292e] border border-[#323238] rounded-2xl overflow-hidden">
                    {loading[abaAtiva] ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
                            <Ico n="spin" s={18} /> Carregando...
                        </div>
                    ) : lista.length === 0 ? (
                        <div className="py-12 text-center text-gray-600 text-sm">
                            {busca ? "Nenhum resultado para essa busca." : "Nenhum texto cadastrado ainda."}
                        </div>
                    ) : (
                        <>
                            <div className="px-5 py-3 border-b border-[#323238] flex items-center justify-between">
                                <span className="text-gray-500 text-xs">{lista.length} texto{lista.length !== 1 ? "s" : ""}</span>
                                {busca && <span className="text-gray-600 text-xs">filtrando por "{busca}"</span>}
                            </div>
                            <div className="divide-y divide-[#323238]/60">
                            {lista.map(s => (
                                    <div key={s.id} className="flex items-start gap-3 px-5 py-4 hover:bg-[#1a1a1a]/50 transition group">
                                        
                                        {/* MODO EDIÇÃO VS MODO LEITURA */}
                                        {editando === s.id ? (
                                            <div className="flex-1 flex flex-col gap-2">
                                                <textarea
                                                    value={textoEditado}
                                                    onChange={(e) => setTextoEditado(e.target.value)}
                                                    className="w-full bg-[#1a1a1a] border border-[#850000]/60 text-gray-200 text-sm rounded-lg px-3 py-2 outline-none resize-none leading-relaxed"
                                                    rows={4}
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2 mt-1">
                                                    <button onClick={() => setEditando(null)} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded border border-[#323238] transition">Cancelar</button>
                                                    <button onClick={() => handleSalvarEdicao(s.id)} className="text-xs bg-[#850000] hover:bg-red-700 text-white font-semibold px-4 py-1.5 rounded transition">Salvar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="flex-1 text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">{s.texto}</p>
                                        )}

                                        {/* BOTÕES DE AÇÃO (LIXEIRA E LÁPIS) */}
                                        {editando !== s.id && (
                                            confirmarDelete === s.id ? (
                                                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                                    <span className="text-xs text-gray-400">Excluir?</span>
                                                    <button onClick={() => handleDeletar(s.id)} className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded border border-red-500/30 hover:border-red-400/50 transition">Sim</button>
                                                    <button onClick={() => setConfirmarDelete(null)} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded border border-[#323238] transition">Não</button>
                                                </div>
                                            ) : (
                                                <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-2 shrink-0 mt-0.5">
                                                    <button
                                                        onClick={() => { setTextoEditado(s.texto); setEditando(s.id); setConfirmarDelete(null); }}
                                                        className="text-gray-500 hover:text-blue-400 transition"
                                                        title="Editar"
                                                    >
                                                        <Ico n="edit" s={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmarDelete(s.id)}
                                                        className="text-gray-500 hover:text-red-400 transition"
                                                        title="Remover"
                                                    >
                                                        <Ico n="trash" s={15} />
                                                    </button>
                                                </div>
                                            )
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}