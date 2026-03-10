// src/components/DietasListagem.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import {
    Search, Plus, ChevronRight, ChevronLeft,
    Flame, Calendar, User, LayoutGrid, List,
    RefreshCw, AlertCircle, Copy, ClipboardList, ArrowLeft,
    Trash2, SlidersHorizontal, Eye, Loader,
} from "lucide-react";
import { listarDietas, duplicarDieta, excluirDieta, buscarDietaDetalhe, salvarDieta } from "./dietaService";
import DietaDetalhe, { ModalDuplicarDieta } from "./DietaDetalhe";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
    const ymd = toYMD(dateStr);
    if (!ymd) return "—";
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
};
// Normaliza qualquer coisa pra YYYY-MM-DD (pra comparação funcionar)
const toYMD = (v) => {
    if (v == null) return "";

    // Date object
    if (v instanceof Date && !isNaN(v.getTime())) {
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, "0");
        const d = String(v.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    const s = String(v).trim();
    if (!s) return "";

    // 1) YYYY-MM-DD / YYYY/MM/DD (+ qualquer hora depois)
    let m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (m) {
        const y = m[1];
        const mm = String(m[2]).padStart(2, "0");
        const dd = String(m[3]).padStart(2, "0");
        return `${y}-${mm}-${dd}`;
    }

    // 2) DD/MM/YYYY ou DD-MM-YYYY
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) {
        const dd = String(m[1]).padStart(2, "0");
        const mm = String(m[2]).padStart(2, "0");
        const y = m[3];
        return `${y}-${mm}-${dd}`;
    }

    return "";
};


// ─── Cores por estratégia ─────────────────────────────────────────────────────

const STRATEGY_COLORS = {
    "01": { border: "border-blue-500/30", glow: "shadow-[0_0_15px_rgba(59,130,246,0.07)]", text: "text-blue-400" },
    "02": { border: "border-purple-500/30", glow: "shadow-[0_0_15px_rgba(168,85,247,0.07)]", text: "text-purple-400" },
    "03": { border: "border-emerald-500/30", glow: "shadow-[0_0_15px_rgba(52,211,153,0.07)]", text: "text-emerald-400" },
    "04": { border: "border-amber-500/30", glow: "shadow-[0_0_15px_rgba(251,191,36,0.07)]", text: "text-amber-400" },
};
const DEFAULT_STYLE = { border: "border-[#323238]", glow: "", text: "text-gray-400" };
const getStrategyStyle = (strategy) =>
    STRATEGY_COLORS[strategy?.slice(0, 2)] ?? DEFAULT_STYLE;

// ─── Status badge ─────────────────────────────────────────────────────────────

const getStatus = (dieta) => {
    const start = toYMD(dieta?.date);
    const end = toYMD(dieta?.final_date);
    const hoje = new Date().toISOString().split("T")[0];

    if (!start && !end) {
        return { label: "Rascunho", color: "bg-amber-500/10 text-amber-300 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.5)]" };
    }
    if (!start && end) {
        return { label: "Sem início", color: "bg-slate-500/10 text-slate-300 border-slate-500/20 shadow-[0_0_8px_rgba(148,163,184,0.35)]" };
    }
    if (start && !end) {
        return { label: "Ativa", color: "bg-green-500/10 text-green-300 border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.5)]" };
    }

    // Tem início e fim — verifica se ainda está no prazo
    return end >= hoje
        ? { label: "Ativa",   color: "bg-green-500/10 text-green-300 border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.5)]" }
        : { label: "Inativa", color: "bg-red-500/10 text-red-300 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.5)]" };
};

const StatusBadge = ({ dieta }) => {
    const { label, color } = getStatus(dieta);
    return (
        <span className={`inline-flex items-center justify-center text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider w-max ${color}`}>
            {label}
        </span>
    );
};

// ─── Card (grade) ─────────────────────────────────────────────────────────────

const CardDieta = ({ dieta, onClick }) => {
    const s = getStrategyStyle(dieta.strategy);
    return (
        <button
            onClick={() => onClick(dieta.name)}
            className={`group w-full text-left bg-[#29292e] border ${s.border} ${s.glow} rounded-xl p-5 transition-all duration-200 hover:bg-[#2f2f35] hover:scale-[1.015] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#850000]/50`}
        >
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-base truncate leading-tight">
                        {dieta.nome_completo || "Paciente sem nome"}
                    </p>
                    <p className="text-gray-400 text-xs mt-1 flex items-center gap-1.5">
                        <User size={11} />
                        <span className="truncate">{dieta.aluno}</span>
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1.5">
                        <span>criado em: {formatDate(dieta.creation)}</span>
                    </p>
                </div>
                <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-300 transition-colors mt-0.5 shrink-0" />
            </div>

            {dieta.strategy && (
                <p className={`text-xs font-medium mb-3 truncate ${s.text}`}>{dieta.strategy}</p>
            )}

            <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5 text-orange-400">
                    <Flame size={13} />
                    <span className="text-sm font-semibold">{dieta.total_calories ?? "—"}</span>
                    <span className="text-gray-500 text-xs">kcal</span>
                </div>
                {dieta.week_days && (
                    <div className="flex items-center gap-1.5 text-gray-400">
                        <Calendar size={12} />
                        <span className="text-xs">{dieta.week_days}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#323238]">
                <StatusBadge dieta={dieta} />
                <div className="flex flex-col text-right">
                    <span className="text-gray-500 text-[10px]">Início: {formatDate(dieta.date)}</span>
                    <span className="text-gray-500 text-[10px]">Fim: {formatDate(dieta.final_date)}</span>
                </div>
            </div>
        </button>
    );
};

// ─── Row (lista) ──────────────────────────────────────────────────────────────

const RowDieta = ({ dieta, onClick, onDuplicar, onExcluir, onVisualizar, onDatasAtualizadas }) => {
    const s = getStrategyStyle(dieta.strategy);
    const [editando, setEditando] = useState(false);
    const [datas, setDatas] = useState({ date: toYMD(dieta.date) || "", final_date: toYMD(dieta.final_date) || "" });
    const [salvando, setSalvando] = useState(false);
    const popoverRef = useRef(null);

    useEffect(() => {
        if (!editando) return;
        const handler = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setEditando(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [editando]);

    const handleSalvar = async (e) => {
        e.stopPropagation();
        setSalvando(true);
        try {
            await salvarDieta(dieta.name, { date: datas.date || null, final_date: datas.final_date || null });
            onDatasAtualizadas(dieta.name, datas);
            setEditando(false);
        } catch (err) {
            alert("Erro ao salvar datas: " + err.message);
        } finally {
            setSalvando(false);
        }
    };

    return (
        <tr
            onClick={() => onClick(dieta.name)}
            className="group border-b border-[#323238] hover:bg-[#2f2f35] cursor-pointer transition-colors"
        >
            <td className="px-4 py-3.5 min-w-[200px]">
                <p className="text-white font-medium text-sm truncate">{dieta.nome_completo || "—"}</p>
                <p className="text-gray-500 text-xs mt-0.5 truncate">{dieta.aluno}</p>
                <p className="text-gray-500 text-xs mt-0.5">criado em: {formatDate(dieta.creation)}</p>
            </td>
            <td className="px-4 py-3.5 min-w-[140px]">
                <span className={`text-xs font-medium ${s.text}`}>{dieta.strategy || "—"}</span>
            </td>
            <td className="px-4 py-3.5 min-w-[100px]">
                <div className="flex items-center gap-1.5 text-orange-400">
                    <Flame size={12} />
                    <span className="text-sm font-medium">{dieta.total_calories ?? "—"}</span>
                    <span className="text-gray-500 text-xs">kcal</span>
                </div>
            </td>
            <td className="px-4 py-3.5 min-w-[140px]">
                <span className="text-gray-400 text-sm">{dieta.week_days || "—"}</span>
            </td>
            <td className="px-4 py-3.5 min-w-[100px]"><StatusBadge dieta={dieta} /></td>

            {/* Datas clicáveis */}
            <td className="px-4 py-3.5 min-w-[200px]" colSpan={2}>
                <div className="relative" ref={popoverRef}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setEditando(v => !v); }}
                        className="flex items-center gap-2 text-gray-400 hover:text-white text-xs transition-colors group/btn"
                    >
                        <Calendar size={11} className="shrink-0" />
                        <span>{formatDate(dieta.date) !== "—" ? formatDate(dieta.date) : "—"}</span>
                        <span className="text-gray-600">→</span>
                        <span>{formatDate(dieta.final_date) !== "—" ? formatDate(dieta.final_date) : "—"}</span>
                        <span className="opacity-0 group-hover/btn:opacity-100 transition-opacity text-[10px] text-[#850000]">editar</span>
                    </button>

                    {editando && (
                        <div
                            onClick={e => e.stopPropagation()}
                            className="absolute z-50 top-7 left-0 bg-[#1a1a1a] border border-[#323238] rounded-xl p-4 shadow-2xl w-72 space-y-3"
                        >
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Editar período</p>
                            <div className="flex flex-col gap-2">
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Início</label>
                                    <input
                                        type="date"
                                        value={datas.date}
                                        onChange={e => setDatas(p => ({ ...p, date: e.target.value }))}
                                        className="w-full h-8 px-3 bg-[#29292e] border border-[#323238] text-white text-xs rounded-lg outline-none focus:border-[#850000]/60"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Fim</label>
                                    <input
                                        type="date"
                                        value={datas.final_date}
                                        onChange={e => setDatas(p => ({ ...p, final_date: e.target.value }))}
                                        className="w-full h-8 px-3 bg-[#29292e] border border-[#323238] text-white text-xs rounded-lg outline-none focus:border-[#850000]/60"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button onClick={() => setEditando(false)}
                                    className="flex-1 h-8 text-xs text-gray-400 hover:text-white border border-[#323238] rounded-lg transition-colors">
                                    Cancelar
                                </button>
                                <button onClick={handleSalvar} disabled={salvando}
                                    className="flex-1 h-8 text-xs bg-[#850000] hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                                    {salvando ? <RefreshCw size={11} className="animate-spin" /> : null}
                                    {salvando ? "Salvando..." : "Salvar"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </td>

            <td className="px-4 py-3.5 min-w-[100px]">
                <div className="flex items-center gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); onVisualizar(dieta.name); }}
                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-white border border-[#323238] hover:border-gray-500 rounded-lg transition-colors" title="Visualizar dieta">
                        <Eye size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDuplicar(dieta.name, dieta.nome_completo); }}
                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-white border border-[#323238] hover:border-gray-500 rounded-lg transition-colors" title="Duplicar dieta">
                        <Copy size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onExcluir(dieta.name, dieta.nome_completo); }}
                        className="h-7 w-7 flex items-center justify-center text-[#850000] hover:text-white border border-[#850000]/30 hover:bg-[#850000] rounded-lg transition-colors" title="Excluir dieta">
                        <Trash2 size={12} />
                    </button>
                </div>
            </td>
            <td className="px-4 py-3.5 min-w-[40px]">
                <ChevronRight size={15} className="text-gray-600 group-hover:text-gray-300 transition-colors" />
            </td>
        </tr>
    );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = ({ view }) =>
    view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[#29292e] border border-[#323238] rounded-xl p-5 animate-pulse space-y-3">
                    <div className="h-4 bg-[#323238] rounded w-3/4" />
                    <div className="h-3 bg-[#323238] rounded w-1/2" />
                    <div className="h-3 bg-[#323238] rounded w-2/3" />
                    <div className="flex gap-3">
                        <div className="h-3 bg-[#323238] rounded w-20" />
                        <div className="h-3 bg-[#323238] rounded w-24" />
                    </div>
                    <div className="h-px bg-[#323238]" />
                    <div className="flex justify-between">
                        <div className="h-5 bg-[#323238] rounded w-16" />
                        <div className="h-3 bg-[#323238] rounded w-20" />
                    </div>
                </div>
            ))}
        </div>
    ) : (
        <div className="bg-[#29292e] border border-[#323238] rounded-xl overflow-hidden">
            {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-14 border-b border-[#323238] animate-pulse" />
            ))}
        </div>
    );

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ search }) => (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#29292e] border border-[#323238] flex items-center justify-center">
            <ClipboardList size={28} className="text-gray-600" />
        </div>
        <div className="text-center">
            <p className="text-white font-medium mb-1">
                {search ? "Nenhuma dieta encontrada" : "Nenhuma dieta cadastrada"}
            </p>
            <p className="text-gray-500 text-sm">
                {search
                    ? `Sem resultados para "${search}"`
                    : "As dietas cadastradas no Frappe aparecerão aqui"}
            </p>
        </div>
    </div>
);


// ─── Componente Principal ─────────────────────────────────────────────────────

const LIMIT = 50;

const REFEICOES_LABELS = {
    1: "Café da Manhã",
    2: "Lanche da Manhã",
    3: "Almoço",
    4: "Lanche da Tarde",
    5: "Jantar",
    6: "Ceia",
    7: "Refeição 7",
    8: "Refeição 8",
};

const ModalFiltros = ({ filtros, onChange, onClose, onLimpar }) => {
    const [local, setLocal] = useState({ ...filtros });
    const toggle = (key, val) => setLocal(p => ({ ...p, [key]: p[key] === val ? null : val }));
    const toggleRefeicao = (n) => setLocal(p => {
        const arr = p.refeicoes || [];
        return { ...p, refeicoes: arr.includes(n) ? arr.filter(x => x !== n) : [...arr, n] };
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-[#323238]">
                    <h2 className="text-lg font-bold text-white">Filtros</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
                </div>
                <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto">

                    {/* Status */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {["Rascunho", "Ativa", "Inativa"].map(s => (
                                <button key={s} onClick={() => toggle("status", s)}
                                    className={`px-4 py-1.5 rounded-lg text-sm border transition ${local.status === s ? "bg-[#850000]/20 border-[#850000]/50 text-red-400" : "border-[#323238] text-gray-400 hover:text-white"}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Calorias */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Calorias</p>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-1 block">Mínimo</label>
                                <input type="number" value={local.kcalMin || ""} onChange={e => setLocal(p => ({ ...p, kcalMin: e.target.value }))}
                                    placeholder="Ex: 1200"
                                    className="w-full h-9 px-3 bg-[#29292e] border border-[#323238] text-white text-sm rounded-lg outline-none focus:border-[#850000]/60" />
                            </div>
                            <span className="text-gray-500 mt-5">—</span>
                            <div className="flex-1">
                                <label className="text-xs text-gray-500 mb-1 block">Máximo</label>
                                <input type="number" value={local.kcalMax || ""} onChange={e => setLocal(p => ({ ...p, kcalMax: e.target.value }))}
                                    placeholder="Ex: 2500"
                                    className="w-full h-9 px-3 bg-[#29292e] border border-[#323238] text-white text-sm rounded-lg outline-none focus:border-[#850000]/60" />
                            </div>
                        </div>
                    </div>

                    {/* Refeições */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Refeições Incluídas</p>
                        <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => {
                                const ativo = (local.refeicoes || []).includes(n);
                                return (
                                    <button key={n} onClick={() => toggleRefeicao(n)}
                                        className={`px-3 py-1.5 rounded-lg text-xs border transition ${ativo ? "bg-[#850000]/20 border-[#850000]/50 text-red-400" : "border-[#323238] text-gray-400 hover:text-white"}`}>
                                        {REFEICOES_LABELS[n]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                </div>
                <div className="p-4 border-t border-[#323238] flex justify-between gap-3">
                    <button onClick={() => { setLocal({ status: null, kcalMin: "", kcalMax: "", refeicoes: [] }); onLimpar(); onClose(); }}
                        className="px-5 py-2 text-gray-400 hover:text-white text-sm border border-[#323238] rounded-lg transition">
                        Limpar tudo
                    </button>
                    <button onClick={() => { onChange(local); onClose(); }}
                        className="px-5 py-2 bg-[#850000] hover:bg-red-700 text-white text-sm font-medium rounded-lg transition">
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
};

const REFEICAO_NOMES = {
    1: "Café da Manhã", 2: "Lanche da Manhã", 3: "Almoço",
    4: "Lanche da Tarde", 5: "Jantar", 6: "Ceia", 7: "Refeição 7", 8: "Refeição 8"
};

const fmt = (v, dec = 1) => v != null ? Number(v).toFixed(dec) : "0";

const VisualizacaoDietaModal = ({ dietaId, onClose }) => {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!dietaId) return;
        setLoading(true);
        buscarDietaDetalhe(dietaId).then(res => {
            setDados(res.data || res);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [dietaId]);

    const totais = (() => {
        if (!dados) return null;
        let prot = 0, carb = 0, lip = 0, kcal = 0, fib = 0;
        for (let i = 1; i <= 8; i++) {
            if (dados[`meal_${i}`] === 1) {
                for (let j = 1; j <= 10; j++) {
                    if (dados[`meal_${i}_option_${j}`] === 1) {
                        const itens = dados[`meal_${i}_option_${j}_items`] || [];
                        itens.forEach(item => {
                            if (!item.substitute) {
                                prot += Number(item.protein || 0);
                                carb += Number(item.carbohydrate || 0);
                                lip += Number(item.lipid || 0);
                                kcal += Number(item.calories || 0);
                                fib += Number(item.fiber || 0);
                            }
                        });
                        break;
                    }
                }
            }
        }
        const peso = Number(dados?.weight) || 1;
        return { prot, carb, lip, kcal, fib, relProt: prot / peso, relCarb: carb / peso, relLip: lip / peso, relFib: fib / peso };
    })();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[#323238] shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white">{dados?.nome_completo || "Carregando..."}</h2>
                        {dados && (
                            <p className="text-gray-400 text-xs mt-0.5">
                                {dados.strategy} · {dados.week_days} · {formatDate(dados.date)} → {formatDate(dados.final_date) || "em aberto"}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader size={28} className="animate-spin text-[#850000]" />
                        </div>
                    ) : !dados ? (
                        <p className="text-red-400 text-center py-10">Erro ao carregar dieta.</p>
                    ) : (
                        [1, 2, 3, 4, 5, 6, 7, 8].map(n => {
                            if (dados[`meal_${n}`] !== 1) return null;
                            const opcoesAtivas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(j => dados[`meal_${n}_option_${j}`] === 1);
                            return (
                                <div key={n} className="bg-[#29292e] border border-[#323238] rounded-xl overflow-hidden">
                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-[#323238]">
                                        <span className="h-2 w-2 rounded-full bg-[#850000] shrink-0" />
                                        <span className="text-white font-semibold text-sm">
                                            {dados[`meal_${n}_label`] || REFEICAO_NOMES[n]}
                                        </span>
                                    </div>
                                    <div className="p-3 space-y-3">
                                        {opcoesAtivas.map(j => {
                                            const items = dados[`meal_${n}_option_${j}_items`] || [];
                                            const legend = dados[`meal_${n}_option_${j}_legend`];
                                            const label = dados[`meal_${n}_option_${j}_label`] || `Opção ${j}`;
                                            const macros = items.reduce((acc, item) => {
                                                if (!item.substitute) {
                                                    acc.prot += Number(item.protein || 0);
                                                    acc.carb += Number(item.carbohydrate || 0);
                                                    acc.lip += Number(item.lipid || 0);
                                                    acc.kcal += Number(item.calories || 0);
                                                }
                                                return acc;
                                            }, { prot: 0, carb: 0, lip: 0, kcal: 0 });

                                            return (
                                                <div key={j} className="bg-[#1a1a1a] border border-[#323238] rounded-lg p-3">
                                                    <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
                                                    {legend && <p className="text-gray-500 text-xs mb-2">{legend}</p>}
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="text-gray-500 border-b border-[#323238]">
                                                                <th className="text-left pb-1.5 font-medium">Alimento</th>
                                                                <th className="text-center pb-1.5 font-medium w-16">Qtd.</th>
                                                                <th className="text-center pb-1.5 font-medium w-12">Unid.</th>
                                                                <th className="text-center pb-1.5 font-medium w-12">Prot.</th>
                                                                <th className="text-center pb-1.5 font-medium w-12">Carb.</th>
                                                                <th className="text-center pb-1.5 font-medium w-12">Gord.</th>
                                                                <th className="text-center pb-1.5 font-medium w-14">Kcal</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {items.filter(item => !item.substitute).map((item, idx) => (
                                                                <tr key={idx} className={`border-b border-[#323238]/40 last:border-0 ${item.substitute ? "bg-red-500/5" : ""}`}>
                                                                    <td className="py-1.5 text-gray-300 flex items-center gap-1.5">
                                                                        {item.substitute === 1 && (
                                                                            <span className="text-[9px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-1 py-0.5 rounded uppercase shrink-0">OU</span>
                                                                        )}
                                                                        {item.food}
                                                                    </td>
                                                                    <td className="py-1.5 text-center text-gray-300">{item.ref_weight}</td>
                                                                    <td className="py-1.5 text-center text-gray-500">{item.unit}</td>
                                                                    <td className="py-1.5 text-center text-gray-300">{item.protein}</td>
                                                                    <td className="py-1.5 text-center text-gray-300">{item.carbohydrate}</td>
                                                                    <td className="py-1.5 text-center text-gray-300">{item.lipid}</td>
                                                                    <td className="py-1.5 text-center text-gray-300">{item.calories}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    <div className="mt-2 pt-2 border-t border-[#323238] flex gap-4 text-xs text-gray-400">
                                                        <span>Prot: <strong className="text-white">{fmt(macros.prot, 0)}g</strong></span>
                                                        <span>Carb: <strong className="text-white">{fmt(macros.carb, 0)}g</strong></span>
                                                        <span>Líp: <strong className="text-white">{fmt(macros.lip, 0)}g</strong></span>
                                                        <span>Kcal: <strong className="text-white">{fmt(macros.kcal, 0)}</strong></span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer com totais */}
                {totais && (
                    <div className="shrink-0 border-t border-[#323238] bg-[#111] px-4 py-3 rounded-b-xl">
                        <div className="flex flex-wrap items-center gap-4 text-xs justify-center">
                            <span className="text-gray-400 font-bold uppercase tracking-widest">Totais:</span>
                            <span className="text-gray-300">Prot: <strong className="text-white">{fmt(totais.prot, 0)}g</strong></span>
                            <span className="text-gray-300">Líp: <strong className="text-white">{fmt(totais.lip, 0)}g</strong></span>
                            <span className="text-gray-300">Carb: <strong className="text-white">{fmt(totais.carb, 0)}g</strong></span>
                            <span className="text-gray-300">Fib: <strong className="text-white">{fmt(totais.fib, 0)}g</strong></span>
                            <span className="bg-[#850000]/20 text-red-300 border border-[#850000]/30 px-2 py-0.5 rounded font-medium">
                                Kcal: <strong className="text-white">{fmt(totais.kcal, 0)}</strong>
                            </span>
                            <span className="text-gray-500">|</span>
                            <span className="text-gray-400">PTN: <strong className="text-white">{fmt(totais.relProt, 1)}</strong></span>
                            <span className="text-gray-400">LIP: <strong className="text-white">{fmt(totais.relLip, 1)}</strong></span>
                            <span className="text-gray-400">CHO: <strong className="text-white">{fmt(totais.relCarb, 1)}</strong></span>
                            <span className="text-gray-400">FIB: <strong className="text-white">{fmt(totais.relFib, 1)}</strong></span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default function DietasListagem({ initialDietaId = null }) {
    // Navegação interna — sem React Router
    const [dietaSelecionada, setDietaSelecionada] = useState(initialDietaId);
    const [novaDieta, setNovaDieta] = useState(false);
    const [filtros, setFiltros] = useState({ status: null, kcalMin: "", kcalMax: "", refeicoes: [] });
    const [modalFiltros, setModalFiltros] = useState(false);
    const [vizId, setVizId] = useState(null);

    const [modalDuplicar, setModalDuplicar] = useState(null); // { id, nome }
    const [dietas, setDietas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [view, setView] = useState("list");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const isLoadMore = useRef(false);

    useEffect(() => {
        const t = setTimeout(() => { isLoadMore.current = false; setQuery(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    const fetchDietas = useCallback(async () => {
        const appending = isLoadMore.current;
        isLoadMore.current = false;
        if (appending) setLoadingMore(true);
        else setLoading(true);
        setError(null);
        try {
            const temFiltro = query || filtros.status || filtros.kcalMin || filtros.kcalMax || (filtros.refeicoes?.length > 0);

            const { list, hasMore: more } = await listarDietas({
                aluno: query || undefined,
                page: temFiltro ? 1 : page,
                limit: temFiltro ? 9999 : LIMIT,
            });
            const sorted = [...list].sort((a, b) => (b.creation || "").localeCompare(a.creation || ""));
            if (appending) {
                setDietas(prev => [...prev, ...sorted]);
            } else {
                setDietas(sorted);
            }
            setHasMore(more && !temFiltro);
        } catch (err) {
            setError(err.message ?? "Erro ao buscar dietas");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [query, page, filtros]);

    const handleCarregarMais = useCallback(() => {
        isLoadMore.current = true;
        setPage(p => p + 1);
    }, []);

    const dietasFiltradas = dietas.filter(d => {
        if (filtros.status) {
            const s = getStatus(d).label;
            if (s !== filtros.status) return false;
        }
        if (filtros.kcalMin && Number(d.total_calories) < Number(filtros.kcalMin)) return false;
        if (filtros.kcalMax && Number(d.total_calories) > Number(filtros.kcalMax)) return false;
        if (filtros.refeicoes?.length > 0) {
            const todasAtivas = [1, 2, 3, 4, 5, 6, 7, 8];
            const match = todasAtivas.every(n => {
                const deveEstar = filtros.refeicoes.includes(n);
                const estaAtiva = Number(d[`meal_${n}`]) === 1;
                return deveEstar === estaAtiva;
            });
            if (!match) return false;
        }
        return true;
    });

    useEffect(() => { fetchDietas(); }, [fetchDietas]);

    const handleDatasAtualizadas = useCallback((id, novasDatas) => {
        setDietas(prev => prev.map(d => d.name === id ? { ...d, ...novasDatas } : d));
    }, []);    

    if (dietaSelecionada) {
        return <DietaDetalhe 
            dietaId={dietaSelecionada} 
            onVoltar={(updatedCalories) => {
                if (updatedCalories && typeof updatedCalories === 'number') {
                    setDietas(prev => prev.map(d => 
                        d.name === dietaSelecionada 
                            ? { ...d, total_calories: updatedCalories } 
                            : d
                    ));
                }
                setDietaSelecionada(null);
            }} 
        />;
    }
    if (novaDieta) {
        return <DietaDetalhe dietaId={null} onVoltar={() => { setNovaDieta(false); fetchDietas(); }} />;
    }    

    const handleDuplicarRapido = (id, nome) => {
        setModalDuplicar({ id, nome });
    };
    const handleExcluirRapido = async (id, nome) => {
        if (!window.confirm(`Excluir dieta de ${nome}?`)) return;
        try {
            await excluirDieta(id);
            fetchDietas();
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        }
    };

    return (
        <div className="text-white">
            {modalDuplicar && (
                <ModalDuplicarDieta
                    dietaId={modalDuplicar.id}
                    nomeAtual={modalDuplicar.nome}
                    onClose={() => setModalDuplicar(null)}
                    onDuplicado={() => { setModalDuplicar(null); fetchDietas(); }}
                />
            )}
            {vizId && <VisualizacaoDietaModal dietaId={vizId} onClose={() => setVizId(null)} />}
            {modalFiltros && (  // ← AQUI dentro do return
                <ModalFiltros
                    filtros={filtros}
                    onChange={(f) => { isLoadMore.current = false; setPage(1); setFiltros(f); }}
                    onClose={() => setModalFiltros(false)}
                    onLimpar={() => { isLoadMore.current = false; setPage(1); setFiltros({ status: null, kcalMin: "", kcalMax: "", refeicoes: [] }); }}
                />
            )}
            <div className="max-w-screen-xl mx-auto">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Dietas</h1>
                        <p className="text-gray-400 text-sm mt-1">Gerencie os planos alimentares dos pacientes</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchDietas}
                            disabled={loading}
                            className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white hover:bg-[#2f2f35] transition-colors disabled:opacity-50"
                            title="Atualizar"
                        >
                            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                        </button>
                        <button
                            onClick={() => setModalFiltros(true)}
                            className={`h-9 w-9 flex items-center justify-center rounded-lg border transition-colors ${(filtros.status || filtros.kcalMin || filtros.kcalMax || filtros.refeicoes?.length > 0)
                                ? "bg-[#850000]/20 border-[#850000]/50 text-red-400"
                                : "bg-[#29292e] border-[#323238] text-gray-400 hover:text-white"
                                }`}
                            title="Filtros"
                        >
                            <SlidersHorizontal size={15} />
                        </button>
                        <div className="flex items-center bg-[#29292e] border border-[#323238] rounded-lg p-1 gap-0.5">
                            {[
                                { key: "grid", icon: <LayoutGrid size={14} />, title: "Grade" },
                                { key: "list", icon: <List size={14} />, title: "Lista" },
                            ].map(({ key, icon, title }) => (
                                <button
                                    key={key}
                                    onClick={() => setView(key)}
                                    title={title}
                                    className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${view === key ? "bg-[#850000] text-white" : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setNovaDieta(true)}
                            className="inline-flex items-center gap-2 h-9 px-4 bg-[#850000] hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <Plus size={15} />
                            Nova Dieta
                        </button>
                    </div>
                </div>

                {/* ── Busca ── */}
                <div className="relative mb-6 max-w-md">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar por nome do paciente…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 bg-[#1a1a1a] border border-[#323238] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 transition-colors"
                    />
                </div>

                {/* ── Conteúdo ── */}
                {error ? (
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                        <AlertCircle size={18} className="shrink-0" />
                        <div>
                            <p className="font-medium text-sm">Erro ao carregar dietas</p>
                            <p className="text-xs mt-0.5 opacity-80">{error}</p>
                        </div>
                        <button onClick={fetchDietas} className="ml-auto text-xs underline hover:no-underline shrink-0">
                            Tentar novamente
                        </button>
                    </div>
                ) : loading ? (
                    <Skeleton view={view} />
                ) : dietasFiltradas.length === 0 ? (
                    <EmptyState search={query} />
                ) : view === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {dietasFiltradas.map((d) => (
                            <CardDieta key={d.name} dieta={d} onClick={setDietaSelecionada} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-[#29292e] border border-[#323238] rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[#323238] bg-[#1a1a1a]">
                                        {[
                                            { label: "Paciente", cls: "min-w-[200px]" },
                                            { label: "Estratégia", cls: "min-w-[140px]" },
                                            { label: "Calorias", cls: "min-w-[100px]" },
                                            { label: "Dias", cls: "min-w-[140px]" },
                                            { label: "Status", cls: "min-w-[100px]" },
                                            { label: "Início", cls: "min-w-[100px]" },
                                            { label: "Fim", cls: "min-w-[100px]" },
                                            { label: "Ações", cls: "min-w-[120px]" },
                                            { label: "", cls: "min-w-[40px]" },
                                        ].map(({ label, cls }, i) => (
                                            <th key={i} className={`px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider ${cls}`}>
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {dietasFiltradas.map((d) => (
                                        <RowDieta key={d.name} dieta={d} onClick={setDietaSelecionada} onDuplicar={handleDuplicarRapido} onExcluir={handleExcluirRapido} onVisualizar={setVizId} onDatasAtualizadas={handleDatasAtualizadas} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Paginação ── */}
                {!error && dietasFiltradas.length > 0 && (
                    <div className="flex flex-col items-center gap-3 mt-6">
                        {hasMore && !loading && (
                            <button
                                onClick={handleCarregarMais}
                                disabled={loadingMore}
                                className="inline-flex items-center gap-2 h-9 px-6 bg-[#29292e] hover:bg-[#2f2f35] border border-[#323238] text-gray-300 hover:text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loadingMore
                                    ? <RefreshCw size={14} className="animate-spin" />
                                    : <ChevronRight size={14} />}
                                {loadingMore ? "Carregando..." : "Carregar mais dietas"}
                            </button>
                        )}
                        <p className="text-gray-500 text-xs">
                            Exibindo {dietasFiltradas.length} dieta{dietasFiltradas.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
