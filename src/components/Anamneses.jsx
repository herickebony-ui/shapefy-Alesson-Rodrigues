// src/components/Anamneses.jsx
import { useState, useEffect, useCallback } from "react";
import {
    Search, FileText, ChevronLeft, ChevronRight,
    RefreshCw, AlertCircle, Loader, Plus, Trash2,
    Check, XCircle, Save, Edit2, Clock, User
} from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";

const fns = getFunctions();
const listarTodasAnamnesesFn = httpsCallable(fns, "listarTodasAnamneses");
const buscarAnamneseDetalheFn = httpsCallable(fns, "buscarAnamneseDetalhe");
const salvarAnamneseFn = httpsCallable(fns, "salvarAnamnese");
const excluirAnamneseFn = httpsCallable(fns, "excluirAnamnese");
const listarAlunosFn = httpsCallable(fns, "listarAlunos");
const listarFormulariosAnamneseFn = httpsCallable(fns, "listarFormulariosAnamnese");
const vincularAnamneseFn = httpsCallable(fns, "vincularAnamnese");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (d) => {
    if (!d) return "—";
    const parts = String(d).split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
};

// ─── Badge de Status ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        "Respondido": "bg-green-500/10 text-green-300 border-green-500/20",
        "Pendente": "bg-amber-500/10 text-amber-300 border-amber-500/20",
        "Enviado": "bg-blue-500/10 text-blue-300 border-blue-500/20",
    };
    return (
        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${map[status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
            {status || "—"}
        </span>
    );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = () => (
    <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#29292e] border border-[#323238] rounded-xl animate-pulse" />
        ))}
    </div>
);

// ─── Modal: Visualizar/Editar Anamnese ────────────────────────────────────────
const ModalAnamneseDetalhe = ({ anamneseId, onClose, onSalvo, onExcluir }) => {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [perguntas, setPerguntas] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [excluindo, setExcluindo] = useState(false);

    useEffect(() => {
        buscarAnamneseDetalheFn({ anamneseId })
            .then(r => {
                const d = r.data?.data || r.data;
                setDados(d);
                setPerguntas(d?.perguntas_e_respostas || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [anamneseId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await salvarAnamneseFn({ anamneseId, perguntas });
            const fresco = await buscarAnamneseDetalheFn({ anamneseId });
            const d = fresco.data?.data || fresco.data;
            setDados(d);
            setPerguntas(d?.perguntas_e_respostas || []);
            setSaved(true);
            setEditMode(false);
            setTimeout(() => setSaved(false), 2000);
            if (onSalvo) onSalvo();
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleExcluir = async () => {
        if (!window.confirm(`Excluir anamnese "${dados?.titulo}"? Esta ação não pode ser desfeita.`)) return;
        setExcluindo(true);
        try {
            await excluirAnamneseFn({ anamneseId });
            onExcluir();
            onClose();
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        } finally {
            setExcluindo(false);
        }
    };

    const setResposta = (idx, valor) => {
        setPerguntas(prev => prev.map((p, i) => i === idx ? { ...p, resposta: valor } : p));
    };

    const renderConteudo = () => {
        if (!perguntas.length) return null;
        return perguntas.map((item, i) => {
            if (item.tipo === "Section Break") {
                return (
                    <div key={i} className="pt-8 pb-4 first:pt-0">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-[#323238]" />
                            <p className="text-base font-bold text-red-800 uppercase tracking-widest whitespace-nowrap px-3">{item.pergunta}</p>
                            <div className="flex-1 h-px bg-[#323238]" />
                        </div>
                    </div>
                );
            }
            const linhas = item.resposta ? item.resposta.split("\n").length : 1;
            return (
                <div key={i} className="py-4 border-b border-[#323238] last:border-0">
                    <p className="text-white text-[14px] font-bold mb-2 px-2 leading-relaxed">{item.pergunta}</p>
                    <textarea
                        value={item.resposta || ""}
                        onChange={e => { setResposta(i, e.target.value); }}
                        onFocus={() => { if (!editMode) setEditMode(true); }}
                        rows={linhas}
                        className="w-full bg-transparent border border-transparent hover:bg-[#252525]/40 focus:bg-[#1a1a1a] focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 rounded-lg px-2 py-2 text-gray-300 text-[14px] font-normal italic outline-none resize-none transition-all leading-relaxed"
                        placeholder="Clique para responder..."
                    />
                </div>
            );
        });
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[#323238] shrink-0">
                    <div>
                        <h3 className="text-white font-bold">{dados?.titulo || "Anamnese"}</h3>
                        {dados && <p className="text-gray-400 text-xs mt-0.5">{dados.nome_completo} · {formatDate(dados.date)}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        {saved && <span className="text-green-400 text-xs flex items-center gap-1"><Check size={12} /> Salvo</span>}
                        {!loading && (editMode ? (
                            <>
                                <button onClick={() => { setEditMode(false); setPerguntas(dados?.perguntas_e_respostas || []); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#323238] text-gray-400 hover:text-white text-xs font-medium transition-colors">
                                    <XCircle size={13} /> Cancelar
                                </button>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#850000] hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50">
                                    {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />} Salvar
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setEditMode(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white text-xs font-medium transition-colors">
                                    <Edit2 size={13} /> Editar
                                </button>
                                <button onClick={handleExcluir} disabled={excluindo}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-transparent border border-[#850000]/40 text-[#850000] hover:bg-[#850000]/10 text-xs font-medium transition-colors disabled:opacity-50">
                                    {excluindo ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />} Excluir
                                </button>
                            </>
                        ))}
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-1">&times;</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {loading
                        ? <div className="flex justify-center py-16"><Loader size={24} className="animate-spin text-[#850000]" /></div>
                        : <div>{renderConteudo()}</div>
                    }
                </div>
            </div>
        </div>
    );
};

// ─── Modal: Vincular Anamnese ─────────────────────────────────────────────────
const ModalVincular = ({ onClose, onSucesso }) => {
    const [busca, setBusca] = useState("");
    const [alunos, setAlunos] = useState([]);
    const [alunoSel, setAlunoSel] = useState(null);
    const [formularios, setFormularios] = useState([]);
    const [formSel, setFormSel] = useState(null);
    const [loadingAlunos, setLoadingAlunos] = useState(false);
    const [loadingForms, setLoadingForms] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [enviarAluno, setEnviarAluno] = useState(true);
    const [erro, setErro] = useState(null);

    useEffect(() => {
        listarFormulariosAnamneseFn()
            .then(r => setFormularios(r.data?.list || []))
            .catch(e => setErro("Erro ao carregar formulários: " + e.message))
            .finally(() => setLoadingForms(false));
    }, []);

    const buscarAlunos = useCallback(async (texto) => {
        if (texto.length < 2) { setAlunos([]); return; }
        setLoadingAlunos(true);
        try {
            const res = await listarAlunosFn({ search: texto, limit: 10 });
            setAlunos(res.data?.list || []);
        } catch (e) { console.error(e); }
        finally { setLoadingAlunos(false); }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => buscarAlunos(busca), 400);
        return () => clearTimeout(t);
    }, [busca, buscarAlunos]);

    const handleVincular = async () => {
        if (!alunoSel || !formSel) { setErro("Selecione aluno e formulário."); return; }
        setSalvando(true);
        try {
            await vincularAnamneseFn({ alunoId: alunoSel.name, formulario: formSel, enviarAluno });
            onSucesso();
            onClose();
        } catch (e) {
            setErro("Erro ao vincular: " + e.message);
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[#323238] shrink-0">
                    <h3 className="text-white font-bold">Vincular Anamnese</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {erro && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"><AlertCircle size={14} /> {erro}</div>}

                    {/* Busca de aluno */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Aluno *</label>
                        {alunoSel ? (
                            <div className="flex items-center justify-between p-3 bg-[#850000]/10 border border-[#850000]/40 rounded-lg">
                                <span className="text-white text-sm font-medium">{alunoSel.nome_completo}</span>
                                <button onClick={() => { setAlunoSel(null); setBusca(""); }} className="text-gray-400 hover:text-white"><XCircle size={14} /></button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input value={busca} onChange={e => setBusca(e.target.value)}
                                    placeholder="Buscar por nome..."
                                    className="w-full h-10 pl-9 pr-4 bg-[#29292e] border border-[#323238] text-white text-sm rounded-lg outline-none focus:border-[#850000]/60 transition-colors placeholder-gray-600" />
                                {loadingAlunos && <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                                {alunos.length > 0 && (
                                    <div className="absolute top-full mt-1 left-0 right-0 bg-[#29292e] border border-[#323238] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                        {alunos.map(a => (
                                            <button key={a.name} onClick={() => { setAlunoSel(a); setBusca(""); setAlunos([]); }}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#323238] transition border-b border-[#323238]/50 last:border-0">
                                                {a.nome_completo}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Formulários */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Formulário *</label>
                        {loadingForms ? (
                            <div className="flex justify-center py-4"><Loader size={18} className="animate-spin text-[#850000]" /></div>
                        ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {formularios.map(f => (
                                    <button key={f.name} onClick={() => setFormSel(f.name)}
                                        className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${formSel === f.name ? "bg-[#850000]/10 border-[#850000]/40 text-white" : "bg-[#29292e] border-[#323238] text-gray-300 hover:border-gray-500"}`}>
                                        <div className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${formSel === f.name ? "border-[#850000] bg-[#850000]" : "border-gray-600"}`}>
                                            {formSel === f.name && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                        </div>
                                        <span className="text-sm">{f.titulo || f.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Toggle enviar ao aluno */}
                    <button onClick={() => setEnviarAluno(v => !v)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all w-full ${enviarAluno ? "bg-[#850000]/10 border-[#850000]/40 text-red-400" : "bg-[#29292e] border-[#323238] text-gray-500"}`}>
                        <div className={`w-3 h-3 rounded-full ${enviarAluno ? "bg-[#850000]" : "bg-gray-600"}`} />
                        {enviarAluno ? "Enviará para o aluno preencher" : "Não enviar ao aluno"}
                    </button>
                </div>
                <div className="flex justify-end gap-3 p-4 border-t border-[#323238] shrink-0">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
                    <button onClick={handleVincular} disabled={!alunoSel || !formSel || salvando}
                        className="px-4 py-2 rounded-lg bg-[#850000] hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-40 flex items-center gap-2">
                        {salvando ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />} Vincular
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Componente Principal ─────────────────────────────────────────────────────
const LIMIT = 30;

export default function Anamneses() {
    const [anamneses, setAnamneses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [filtroStatus, setFiltroStatus] = useState("");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [anamneseSel, setAnamneseSel] = useState(null);
    const [showVincular, setShowVincular] = useState(false);

    const carregar = useCallback(async (p = 1) => {
        setLoading(true); setError(null);
        try {
            const res = await listarTodasAnamnesesFn({ page: p, limit: LIMIT });
            setAnamneses(res.data?.list || []);
            setHasMore(res.data?.hasMore || false);
            setPage(p);
        } catch (e) {
            setError(e.message || "Erro ao buscar anamneses.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { carregar(1); }, [carregar]);

    const visiveis = anamneses.filter(a => {
        if (filtroStatus && a.status !== filtroStatus) return false;
        if (search && !a.nome_completo?.toLowerCase().includes(search.toLowerCase()) &&
            !a.titulo?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="text-white">
            {anamneseSel && (
                <ModalAnamneseDetalhe
                    anamneseId={anamneseSel}
                    onClose={() => setAnamneseSel(null)}
                    onSalvo={() => carregar(page)}
                    onExcluir={() => { setAnamneses(prev => prev.filter(a => a.name !== anamneseSel)); setAnamneseSel(null); }}
                />
            )}
            {showVincular && (
                <ModalVincular
                    onClose={() => setShowVincular(false)}
                    onSucesso={() => { setShowVincular(false); carregar(1); }}
                />
            )}

            <div className="max-w-screen-xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Anamneses</h1>
                        <p className="text-gray-400 text-sm mt-1">Todos os formulários · mais recentes primeiro</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => carregar(1)} disabled={loading}
                            className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                        </button>
                        <button onClick={() => setShowVincular(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#850000] hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-lg">
                            <Plus size={15} /> Vincular Anamnese
                        </button>
                    </div>
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <div className="relative flex-1 min-w-52">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por aluno ou título..."
                            className="w-full h-10 pl-10 pr-4 bg-[#1a1a1a] border border-[#323238] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#850000]/60 transition-colors" />
                    </div>
                    <div className="flex gap-2">
                        {["Enviado", "Pendente", "Respondido"].map(s => (
                            <button key={s} onClick={() => setFiltroStatus(filtroStatus === s ? "" : s)}
                                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${filtroStatus === s ? "bg-[#850000]/20 border-[#850000]/50 text-red-400" : "bg-[#29292e] border-[#323238] text-gray-400 hover:text-white"}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista */}
                {error ? (
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                        <AlertCircle size={18} className="shrink-0" />
                        <p className="text-sm">{error}</p>
                        <button onClick={() => carregar(1)} className="ml-auto text-xs underline shrink-0">Tentar novamente</button>
                    </div>
                ) : loading ? <Skeleton /> : visiveis.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-[#29292e] border border-[#323238] flex items-center justify-center">
                            <FileText size={28} className="text-gray-600" />
                        </div>
                        <p className="text-white font-medium">Nenhuma anamnese encontrada</p>
                    </div>
                ) : (
                    <div className="bg-[#29292e] border border-[#323238] rounded-xl overflow-hidden">
                        {visiveis.map((a, i) => (
                            <div key={a.name}
                                className={`flex items-center gap-4 px-4 py-3.5 hover:bg-[#323238] transition-colors group cursor-pointer ${i < visiveis.length - 1 ? "border-b border-[#323238]" : ""}`}
                                onClick={() => setAnamneseSel(a.name)}
                            >
                                <div className="h-9 w-9 rounded-lg bg-[#1a1a1a] border border-[#323238] flex items-center justify-center shrink-0">
                                    <FileText size={14} className="text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium text-sm truncate">{a.titulo || "Anamnese"}</p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-gray-500 text-xs flex items-center gap-1">
                                            <User size={10} /> {a.nome_completo || "—"}
                                        </span>
                                        <span className="text-gray-600 text-xs flex items-center gap-1">
                                            <Clock size={10} /> {formatDate(a.date)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <StatusBadge status={a.status} />
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!window.confirm(`Excluir "${a.titulo}"?`)) return;
                                            try {
                                                await excluirAnamneseFn({ anamneseId: a.name });
                                                setAnamneses(prev => prev.filter(x => x.name !== a.name));
                                            } catch (err) {
                                                alert("Erro ao excluir: " + err.message);
                                            }
                                        }}
                                        className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-[#1a1a1a] rounded-lg transition"
                                        title="Excluir"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Paginação */}
                {!loading && !error && anamneses.length > 0 && (
                    <div className="flex items-center justify-between mt-6">
                        <p className="text-gray-500 text-sm">Página {page} · {visiveis.length} anamnese{visiveis.length !== 1 ? "s" : ""}</p>
                        <div className="flex items-center gap-2">
                            <button onClick={() => carregar(page - 1)} disabled={page === 1}
                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                                <ChevronLeft size={15} />
                            </button>
                            <span className="text-sm text-gray-400 px-2">Página {page}</span>
                            <button onClick={() => carregar(page + 1)} disabled={!hasMore}
                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}