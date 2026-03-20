import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, writeBatch } from "firebase/firestore";
const db = getFirestore();

// ─── CONEXÃO COM O FIREBASE (igual ao resto do seu sistema) ───────────────────
const fns = getFunctions();
const buscarFichasFn = httpsCallable(fns, "buscarFichas");
const buscarFichaDetalheFn = httpsCallable(fns, "buscarFichaDetalhe");
const salvarFichaFn = httpsCallable(fns, "salvarFicha");
const duplicarFichaFn = httpsCallable(fns, "duplicarFicha");
const excluirFichaFn = httpsCallable(fns, "excluirFicha");
const buscarAlunosFichaFn = httpsCallable(fns, "buscarAlunosFicha");
const buscarGruposFn = httpsCallable(fns, "buscarGruposMusculares");
const buscarExerciciosFn = httpsCallable(fns, "buscarExerciciosTreino");
const salvarExercicioFn = httpsCallable(fns, "salvarExercicio");
const excluirExercicioFn = httpsCallable(fns, "excluirExercicio");
const buscarExercicioDetalheFn = httpsCallable(fns, "buscarExercicioDetalhe");
const buscarAlongamentosFn = httpsCallable(fns, "buscarAlongamentos");
const buscarAerobicosFn = httpsCallable(fns, "buscarAerobicos");

// ─── ÍCONES INLINE ────────────────────────────────────────────────────────────
const Ico = ({ n, s = 16 }) => ({
    eye: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
    copy: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>,
    edit: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
    plus: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    x: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    trash: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>,
    prev: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>,
    next: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>,
    search: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
    drag: <svg width={s} height={s} fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="7" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="17" r="1.5" /><circle cx="15" cy="17" r="1.5" /></svg>,
    spin: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" strokeOpacity=".2" /><path d="M12 2a10 10 0 0110 10" strokeLinecap="round" /></svg>,
    dupe: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>,
    info: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
    chart: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    bolt: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
    up: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15" /></svg>,
    down: <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>,
}[n] || null);

// ─── SUGESTÕES (Firestore) ────────────────────────────────────────────────────
const buscarSugestoes = async (categoria) => {
    const q = query(collection(db, "sugestoes"), where("categoria", "==", categoria));
    const snap = await getDocs(q);

    return snap.docs
        .map(d => ({ id: d.id, texto: d.data().texto }))
        .sort((a, b) =>
            (a.texto || "").localeCompare((b.texto || ""), "pt-BR", {
                sensitivity: "base",
                numeric: true
            })
        );
};
const salvarSugestao = async (categoria, texto) => {
    if (!texto?.trim()) return;
    const q = query(collection(db, "sugestoes"), where("categoria", "==", categoria), where("texto", "==", texto.trim()));
    const snap = await getDocs(q);
    if (snap.empty) await addDoc(collection(db, "sugestoes"), { categoria, texto: texto.trim() });
};
const deletarSugestao = async (id) => {
    await deleteDoc(doc(db, "sugestoes", id));
};

// ─── HELPERS DE LOCALSTORAGE COM EXPIRAÇÃO (2 horas) ─────────────────────────
const EXPIRACAO_MS = 2 * 60 * 60 * 1000;

const setLocalStorageComExpiracao = (chave, valor) => {
    localStorage.setItem(chave, valor);
    localStorage.setItem(`${chave}_ts`, Date.now().toString());
};

const getLocalStorageComExpiracao = (chave) => {
    const valor = localStorage.getItem(chave);
    const ts = localStorage.getItem(`${chave}_ts`);
    if (!valor) return null;
    if (ts && Date.now() - parseInt(ts) > EXPIRACAO_MS) {
        localStorage.removeItem(chave);
        localStorage.removeItem(`${chave}_ts`);
        return null;
    }
    return valor;
};

const removeLocalStorageComExpiracao = (chave) => {
    localStorage.removeItem(chave);
    localStorage.removeItem(`${chave}_ts`);
};

// ─── HELPERS DE BUSCA ─────────────────────────────────────────────────────────
const normalizar = (str) =>
    (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const buscarComCoringa = (texto, query) => {
    const partes = query.split("%").map(normalizar).filter(Boolean);
    const alvo = normalizar(texto);
    return partes.every(p => alvo.includes(p));
};

// ─── HELPER DE DATAS (Pode colocar fora do componente ou no topo) ───
const somarDias = (dataStr, dias) => {
    if (!dataStr) return "";
    const d = new Date(dataStr + "T00:00:00"); // Fix fuso horário
    d.setDate(d.getDate() + dias);
    return d.toISOString().split("T")[0];
};

const getSegundaFeira = (dataStr) => {
    if (!dataStr) return null;
    const d = new Date(dataStr + "T00:00:00");
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajusta para segunda
    return new Date(d.setDate(diff));
};

const formatarDataBr = (dateObj) => {
    return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const TextareaExpansivel = ({ value, onChange, categoria, placeholder = "", resetKey, className = "" }) => {
    const [expanded, setExpanded] = useState(false);
    const [sugestoes, setSugestoes] = useState([]);
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const textareaRef = useRef(null);
    const ref = useRef(null);

    const collapseTextarea = useCallback(() => {
        setOpen(false);
        setFocused(false);
        setExpanded(false);
        if (textareaRef.current) {
            textareaRef.current.style.height = "2rem";
        }
    }, []);

    useEffect(() => {
        collapseTextarea();
    }, [resetKey, collapseTextarea]);

    useEffect(() => {
        buscarSugestoes(categoria).then(setSugestoes).catch(console.error);
    }, [categoria]);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                collapseTextarea();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [collapseTextarea]);

    const calcPos = () => {
        if (textareaRef.current) {
            const rect = textareaRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const dropHeight = 200;

            if (spaceBelow < dropHeight) {
                setPos({ top: rect.top - dropHeight - 4, left: rect.left, width: Math.max(rect.width, 300) });
            } else {
                setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 300) });
            }
        }
    };

    const filtradas = sugestoes.filter(s => {
        const q = value?.trim();
        if (!q) return focused;
        const textoIgual = normalizar(s.texto) === normalizar(q);
        if (textoIgual) return false;
        return buscarComCoringa(s.texto, q);
    });

    const handleBlur = () => {
        setTimeout(() => {
            collapseTextarea();
        }, 200);
    };

    const remover = async (id) => {
        await deletarSugestao(id);
        setSugestoes(s => s.filter(x => x.id !== id));
    };

    return (
        <div ref={ref} className={`relative ${className}`}>
            <textarea
                ref={textareaRef}
                value={value || ""}
                title={!expanded ? (value || "") : ""}
                onChange={e => {
                    onChange(e.target.value);
                    calcPos();
                    setOpen(true);

                    if (textareaRef.current && expanded) {
                        textareaRef.current.style.height = "auto";
                        textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
                    }
                }}
                onFocus={() => {
                    setFocused(true);
                    setExpanded(true);
                    calcPos();
                    setOpen(true);

                    setTimeout(() => {
                        if (textareaRef.current) {
                            textareaRef.current.style.height = "auto";
                            textareaRef.current.style.height = Math.max(textareaRef.current.scrollHeight, 32) + "px";
                        }
                    }, 0);
                }}
                onBlur={handleBlur}
                placeholder={placeholder}
                rows={1}
                className={`bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-1.5 w-full outline-none focus:border-[#850000]/60 resize-none leading-tight transition-all duration-200 ${expanded ? "min-h-[2rem]" : "h-8 overflow-hidden"}`}
            />

            {open && filtradas.length > 0 && createPortal(
                <div
                    style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}
                    className="bg-[#29292e] border border-[#323238] rounded-lg shadow-2xl max-h-48 overflow-y-auto"
                >
                    {filtradas.map(s => (
                        <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-[#323238] transition border-b border-[#323238]/50 last:border-0">
                            <button onMouseDown={() => { onChange(s.texto); setOpen(false); }} className="flex-1 text-left text-xs text-gray-200 truncate pr-2">{s.texto}</button>
                            <button onMouseDown={() => remover(s.id)} className="text-gray-600 hover:text-red-400 shrink-0"><Ico n="x" s={11} /></button>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};
// ─── SEARCHABLE COMBO ─────────────────────────────────────────────────────────
const TextareaComSugestoes = ({ value, onChange, categoria, placeholder = "", rows = 3, inputClassName = "", className = "" }) => {
    const [sugestoes, setSugestoes] = useState([]);
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const textareaRef = useRef(null);
    const ref = useRef(null);

    useEffect(() => {
        buscarSugestoes(categoria).then(setSugestoes).catch(console.error);
    }, [categoria]);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setFocused(false); } };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const calcPos = () => {
        if (textareaRef.current) {
            const rect = textareaRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 300) });
        }
    };

    const filtradas = sugestoes.filter(s => {
        const q = value?.trim();
        if (!q) return focused;
        const textoIgual = normalizar(s.texto) === normalizar(q);
        if (textoIgual) return false;
        return buscarComCoringa(s.texto, q);
    });

    const handleBlur = async () => {
        setTimeout(() => { setOpen(false); setFocused(false); }, 200);
    };

    const remover = async (id) => {
        await deletarSugestao(id);
        setSugestoes(s => s.filter(x => x.id !== id));
    };

    return (
        <div ref={ref} className={`relative ${className}`}>
            <textarea
                ref={textareaRef}
                value={value || ""}
                onChange={e => { onChange(e.target.value); calcPos(); setOpen(true); }}
                onFocus={() => { setFocused(true); calcPos(); setOpen(true); }}
                onBlur={handleBlur}
                placeholder={placeholder}
                rows={rows}
                className={inputClassName || "bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 w-full outline-none focus:border-[#850000]/60 transition placeholder-gray-600 resize-none"}
            />
            {open && filtradas.length > 0 && createPortal(
                <div
                    style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}
                    className="bg-[#29292e] border border-[#323238] rounded-lg shadow-2xl max-h-48 overflow-y-auto"
                >
                    {filtradas.map(s => (
                        <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-[#323238] transition border-b border-[#323238]/50 last:border-0">
                            <button onMouseDown={() => { onChange(s.texto); setOpen(false); }} className="flex-1 text-left text-xs text-gray-200 truncate pr-2">{s.texto}</button>
                            <button onMouseDown={() => remover(s.id)} className="text-gray-600 hover:text-red-400 shrink-0"><Ico n="x" s={11} /></button>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
};

// ─── CONFIG GLOBAL DE GRUPOS MUSCULARES ──────────────────────────────────────
const GRUPOS_CONFIG = [
    { key: "quadriceps", label: "Quads.", color: "text-white", bg: "bg-violet-500/15" },
    { key: "isquiotibiais", label: "Isquios.", color: "text-white", bg: "bg-violet-500/15" },
    { key: "gluteomaximo", label: "G. Máx.", color: "text-white", bg: "bg-violet-500/15" },
    { key: "gluteomedio", label: "G. Méd.", color: "text-white", bg: "bg-violet-500/15" },
    { key: "adutores", label: "Adut.", color: "text-white", bg: "bg-violet-500/15" },
    { key: "panturrilhas", label: "Pantur.", color: "text-white", bg: "bg-violet-500/15" },
    { key: "costas", label: "Costas", color: "text-white", bg: "bg-blue-500/15" },
    { key: "trapezio", label: "Trapézio", color: "text-white", bg: "bg-blue-500/15" },
    { key: "peitoral", label: "Peitoral", color: "text-white", bg: "bg-orange-500/15" },
    { key: "deltoidesanterior", label: "Delts. Ant.", color: "text-white", bg: "bg-cyan-500/15" },
    { key: "deltoideslateral", label: "Delts. Lat.", color: "text-white", bg: "bg-cyan-500/15" },
    { key: "deltoidesposterior", label: "Delts. Post.", color: "text-white", bg: "bg-cyan-500/15" },
    { key: "biceps", label: "Bíceps", color: "text-white", bg: "bg-yellow-500/15" },
    { key: "triceps", label: "Tríceps", color: "text-white", bg: "bg-yellow-500/15" },
    { key: "abdomen", label: "Abd.", color: "text-white", bg: "bg-emerald-500/15" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const detectEstrutura = (dias) => {
    if (!dias?.length) return "—";
    const unicos = [...new Set(dias.map(d => d.treino).filter(t => t && t !== "Off" && t !== ""))];
    return unicos.map(t => t.replace("Treino ", "")).join("") || "—";
};

const calcVolume = (ficha, intensidadeMap = {}) => {
    const vol = {};

    // Conta quantos dias da semana cada treino aparece (ex: Treino A = 3 dias)
    const diasPorTreino = {};
    (ficha.dias_da_semana || []).forEach(d => {
        if (d.treino && d.treino !== "Off" && d.treino !== "") {
            const key = d.treino.replace("Treino ", "").toLowerCase();
            diasPorTreino[key] = (diasPorTreino[key] || 0) + 1;
        }
    });

    ["a", "b", "c", "d", "e", "f"].forEach(t => {
        const dias = diasPorTreino[t] || 0;
        if (dias === 0) return;
        (ficha[`planilha_de_treino_${t}`] || []).forEach(ex => {
            const series = parseInt(ex.series) || 0;
            if (!series || !ex.exercicio) return;
            let intensidades = [];
            try {
                const raw = ex.intensidade;
                if (typeof raw === "string") {
                    try { intensidades = raw && raw !== "[]" ? JSON.parse(raw) : []; } catch { intensidades = []; }
                } else { intensidades = raw || []; }
            } catch { }
            if (!intensidades.length) intensidades = intensidadeMap[ex.exercicio] || [];
            intensidades.forEach(({ grupo_muscular, intensidade }) => {
                // CORREÇÃO: Normaliza vírgula para ponto antes de converter
                const val = parseFloat(String(intensidade).replace(",", ".")) || 0;
                if (val > 0 && grupo_muscular)
                    vol[grupo_muscular] = (vol[grupo_muscular] || 0) + (series * val * dias);
            });
        });
    });

    return vol;
};

const statusFicha = (f) => {
    if (!f.data_de_inicio || !f.data_de_fim) return "concluido";
    const hoje = new Date().toISOString().split("T")[0];
    if (f.data_de_fim < hoje) return "concluido";
    const em7dias = new Date();
    em7dias.setDate(em7dias.getDate() + 7);
    const limite = em7dias.toISOString().split("T")[0];
    if (f.data_de_fim <= limite) return "vencendo";
    return "ativo";
};

const uid = () =>
    (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const arrayMove = (arr, from, to) => {
    const a = [...arr];
    if (from === to) return a;
    const [item] = a.splice(from, 1);
    // Se removeu antes do destino, o destino “anda” 1 pra trás
    const finalTo = to > from ? to - 1 : to;
    a.splice(finalTo, 0, item);
    return a;
};

const stripLocalId = (obj) => {
    const { _id, ...rest } = obj || {};
    return rest;
};

// ─── COMPONENTES VISUAIS ──────────────────────────────────────────────────────
const Badge = ({ children, color = "gray" }) => {
    const c = { gray: "bg-[#323238] text-gray-300", red: "bg-[#850000]/20 text-red-400 border border-[#850000]/30", green: "bg-green-500/10 text-green-400 border border-green-500/30", blue: "bg-blue-500/10 text-blue-400 border border-blue-500/30", yellow: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30" };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c[color]}`}>{children}</span>;
};

const FInput = ({ label, value, onChange, type = "text", placeholder = "", required, className = "" }) => (
    <div className={`flex flex-col gap-1 ${className}`}>
        {label && <label className="text-xs text-gray-400 font-medium">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
        <input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/20 transition placeholder-gray-600" />
    </div>
);

const FSel = ({ label, value, onChange, options = [], placeholder = "Selecionar...", required, className = "" }) => (
    <div className={`flex flex-col gap-1 ${className}`}>
        {label && <label className="text-xs text-gray-400 font-medium">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
        <select value={value || ""} onChange={e => onChange(e.target.value)}
            className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#850000]/60 transition appearance-none cursor-pointer">
            <option value="">{placeholder}</option>
            {options.map(o => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
        </select>
    </div>
);

const FTextarea = ({ label, value, onChange, placeholder = "", rows = 3, className = "" }) => (
    <div className={`flex flex-col gap-1 ${className}`}>
        {label && <label className="text-xs text-gray-400 font-medium">{label}</label>}
        <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
            className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#850000]/60 transition placeholder-gray-600 resize-none" />
    </div>
);


// ─── SEARCHABLE COMBO (Corrigido: Z-Index alto para não cortar) ────────────────
const SearchableCombo = ({ value, onChange = () => { }, options = [], placeholder = "Digite para buscar...", className = "", disabled = false }) => {
    const [q, setQ] = useState(value || "");
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const inputRef = useRef(null);
    const ref = useRef(null);
    const mouseDownInside = useRef(false);

    useEffect(() => { setQ(value || ""); }, [value]);

    useEffect(() => {
        const handler = (e) => {
            if (mouseDownInside.current) { mouseDownInside.current = false; return; }
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const calcPos = () => {
        if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
        }
    };

    const filtered = options.filter(o => {
        if (!q) return true;
        if (q.includes('%')) return buscarComCoringa(o, q);
        return normalizar(o).includes(normalizar(q));
    }).slice(0, 50);

    return (
        <div ref={ref} className={`relative ${className} h-full`}>
            <input
                ref={inputRef}
                disabled={disabled}
                value={q}
                onChange={e => {
                    setQ(e.target.value);
                    calcPos();
                    setOpen(true);
                    if (e.target.value === "") onChange("");
                }}
                onFocus={() => { if (!disabled) { calcPos(); setOpen(true); } }}
                placeholder={placeholder}
                className="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-1.5 w-full outline-none focus:border-[#850000]/60 placeholder-gray-600 h-8 disabled:opacity-50"
            />
            {open && filtered.length > 0 && createPortal(
                <div
                    onMouseDown={() => { mouseDownInside.current = true; }}
                    style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}
                    className="bg-[#1c1c1f] border border-[#323238] rounded-xl shadow-2xl overflow-hidden"
                >
                    <div className="px-3 py-2 border-b border-[#323238]/60 bg-[#29292e]">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{filtered.length} opções</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                        {filtered.map((o, idx) => (
                            <button key={o} onMouseDown={(e) => { e.stopPropagation(); if (typeof onChange === "function") onChange(o); setQ(o); setOpen(false); }}
                                className={`w-full text-left px-3 py-2.5 text-xs text-gray-200 hover:bg-[#850000]/20 hover:text-white transition-all flex items-center gap-2 border-b border-[#323238]/30 last:border-0 ${idx % 2 === 0 ? "bg-[#1c1c1f]" : "bg-[#202024]"}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#850000]/60 shrink-0"></span>
                                {o}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
// ─── COMPONENTE: BANNER DE ORIENTAÇÕES GLOBAIS (Fixo no Treino/Dieta) ─────────
// ─── COMPONENTE: BANNER DE ORIENTAÇÕES GLOBAIS (Fixo no Treino/Dieta) ─────────
const BannerOrientacoes = ({ alunoId }) => {
    const [orientacoes, setOrientacoes] = useState("");
    const [loading, setLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [textoTemp, setTextoTemp] = useState("");

    // Novo estado para controlar expandir/recolher (começa fechado)
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!alunoId) return;
        setLoading(true);
        const fns = getFunctions();
        const fnCompleto = httpsCallable(fns, "buscarAlunoDetalhe");
        fnCompleto({ id: alunoId })
            .then(res => {
                const d = res.data?.data || res.data || {};
                setOrientacoes(d.orientacoes_globais || "");
                setTextoTemp(d.orientacoes_globais || "");
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [alunoId]);

    const handleSave = async () => {
        if (!ficha.aluno) { setErro("Selecione um aluno antes de salvar."); return; }
        setSaving(true); setErro(""); setSalvo(false);
        try {
            const fns = getFunctions();
            const salvarAlunoFn = httpsCallable(fns, "salvarAluno");
            await salvarAlunoFn({ id: alunoId, campos: { orientacoes_globais: textoTemp } });
            setOrientacoes(textoTemp);
            setEditMode(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!alunoId) return null;
    if (loading) return <div className="animate-pulse h-8 bg-[#850000]/10 border-b border-[#850000]/30 w-full shrink-0"></div>;

    const IcoInfo = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
    const IcoCopy = () => <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>;
    const IcoEdit = () => <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
    const IcoChevronDown = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>;
    const IcoChevronUp = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>;

    return (
        <div className="bg-[#850000]/10 border-b border-[#850000]/30 shrink-0 w-full relative z-40 mb-6 -mt-2 transition-all">
            <div className={`px-5 flex gap-2 items-start transition-all ${expanded ? 'py-2.5' : 'py-1.5'}`}>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        {/* Título agora é um botão que expande/recolhe */}
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="flex items-center gap-1.5 text-[10px] font-bold italic text-gray hover:text-gray-200 uppercase tracking-widest transition-colors outline-none"
                        >
                            <span className="text-red-800 transition-transform">
                                {expanded ? <IcoChevronUp /> : <IcoChevronDown />}
                            </span>
                            Anotações Globais do Aluno
                        </button>

                        <div className="flex items-center gap-3">
                            {saved && <span className="text-green-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"><IcoCopy /> Salvo</span>}
                            {editMode ? (
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditMode(false); setTextoTemp(orientacoes); }} className="text-gray-400 hover:text-white text-[10px] transition-colors underline">Cancelar</button>
                                    <button onClick={handleSave} disabled={saving} className="text-red-400 hover:text-red-300 text-[10px] font-bold transition-colors disabled:opacity-50 underline">{saving ? "..." : "Salvar"}</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setEditMode(true); setExpanded(true); }}
                                    className="text-gray-400 hover:text-red-400 text-[9px] uppercase font-bold tracking-wider transition-colors flex items-center gap-1"
                                >
                                    <IcoEdit /> Editar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Área de conteúdo que só aparece se estiver expandida */}
                    {expanded && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            {editMode ? (
                                <textarea
                                    value={textoTemp}
                                    onChange={e => setTextoTemp(e.target.value)}
                                    rows={3}
                                    className="w-full bg-black/40 border border-red-500/30 focus:border-red-500/70 rounded px-2 py-1 text-red-400 text-xs outline-none resize-none transition-colors"
                                    placeholder="Escreva as restrições ou contexto importante..."
                                />
                            ) : (
                                <p className="text-red-400 text-xs leading-tight max-h-16 overflow-y-auto custom-scrollbar pr-2 whitespace-pre-line">
                                    {orientacoes || <span className="text-red-400/50 italic">Sem contexto cadastrado.</span>}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
// ─── TÉCNICAS ─────────────────────────────────────────────────────────────────
const TECNICAS = ["Bi-Set", "Tri-Set", "Drop Set", "Super Série", "Rest-Pause", "Cluster", "Pirâmide", "AMRAP", "Isometria", "Falha Muscular"];
const TecnicaBtn = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition border ${value ? "bg-[#850000]/20 border-[#850000]/40 text-red-400" : "border-[#323238] text-gray-500 hover:text-gray-300"}`}>
                <Ico n="bolt" s={11} />
                {value ? <span className="max-w-[60px] truncate">{value}</span> : "Técnica"}
            </button>
            {open && (
                <div className="absolute top-full mt-1 left-0 bg-[#29292e] border border-[#323238] rounded-lg shadow-xl z-50 min-w-[140px]">
                    <button onMouseDown={() => { onChange(""); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-[#323238] italic">Nenhuma</button>
                    {TECNICAS.map(t => (
                        <button key={t} onMouseDown={() => { onChange(t); setOpen(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#323238] transition ${value === t ? "text-red-400 font-semibold" : "text-gray-200"}`}>{t}</button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── MODAL DETALHES DO EXERCÍCIO ──────────────────────────────────────────────
const DetalhesExercicio = ({ ex, onSave, onClose, intensidadeMap = {} }) => {
    const [local, setLocal] = useState({ ...ex });
    const upd = (f, v) => setLocal(l => ({ ...l, [f]: v }));

    const TITULOS_COMBINADO = ["Bi-set", "Tri-set", "Superset"];

    let intensidades = [];
    try {
        const raw = local.intensidade;
        if (typeof raw === "string") {
            try { intensidades = raw && raw !== "[]" ? JSON.parse(raw) : []; } catch { intensidades = []; }
        } else { intensidades = raw || []; }
    } catch { }
    if (!intensidades.length) intensidades = intensidadeMap[local.exercicio] || [];

    const [intens, setIntens] = useState(intensidades);
    const [nomearSeries, setNomearSeries] = useState(!!local.tipo_de_serie);

    const addIntensLinha = () => setIntens(prev => [...prev, { grupo_muscular: "", intensidade: "1" }]);
    const updIntensLinha = (i, f, v) => setIntens(prev => prev.map((item, idx) => idx === i ? { ...item, [f]: v } : item));
    const removeIntensLinha = (i) => setIntens(prev => prev.filter((_, idx) => idx !== i));

    const TIPOS_SERIE = ["Aquecimento", "Preparatória", "Trabalho", "Válida", "Transição", "Top Set", "Máxima"];

    const handleNomearCheck = (checked) => {
        setNomearSeries(checked);
        if (checked) {
            const n = parseInt(local.series) || 0;
            upd("tipo_de_serie", Array(n).fill("Trabalho").join(","));
        } else {
            upd("tipo_de_serie", "");
        }
    };

    const seriesArr = (local.tipo_de_serie || "").split(",").map(s => s.trim()).filter(Boolean);
    const updSerie = (i, val) => {
        const arr = [...seriesArr];
        arr[i] = val;
        upd("tipo_de_serie", arr.join(","));
    };

    const handleSave = () => {
        onSave({ ...local, intensidade: JSON.stringify(intens) });
        onClose();
    };

    return (
        <Modal open onClose={onClose} title={local.exercicio || "Detalhes"} size="md">
            <div className="flex flex-col gap-3">

                {/* Combinado */}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!local.primeiro} onChange={e => upd("primeiro", e.target.checked ? 1 : 0)} className="accent-[#850000]" />
                        Primeiro Combinado
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!local.ultimo} onChange={e => upd("ultimo", e.target.checked ? 1 : 0)} className="accent-[#850000]" />
                        Último Combinado
                    </label>
                    {(local.primeiro || local.ultimo) && (
                        <select value={local.titulo_do_exercicio_combinado || ""} onChange={e => upd("titulo_do_exercicio_combinado", e.target.value)}
                            className="ml-auto bg-[#1a1a1a] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-1 outline-none">
                            <option value="">Tipo...</option>
                            {TITULOS_COMBINADO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    )}
                </div>

                {/* Linha: Grupo + Reps + Descanso */}
                <div className="grid grid-cols-3 gap-2">
                    <FInput label="Grupo Muscular" value={local.grupo_muscular} onChange={v => upd("grupo_muscular", v)} />
                    <FInput label="Repetições" value={local.repeticoes} onChange={v => upd("repeticoes", v)} placeholder="Ex: 8-12" />
                    <FInput label="Descanso" value={local.descanso} onChange={v => upd("descanso", v)} placeholder="Ex: 90s" />
                </div>

                {/* Linha: Séries + Carga + Nomear Séries (checkbox) */}
                <div className="grid grid-cols-3 gap-2 items-end">
                    <FInput label="Séries" value={local.series} onChange={v => upd("series", v)} type="number" />
                    <FInput label="Carga (kg)" value={local.carga_sugerida} onChange={v => upd("carga_sugerida", v)} type="number" />
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 font-medium opacity-0">x</label>
                        <label className="flex items-center gap-2 cursor-pointer h-[38px] px-3 bg-[#1a1a1a] border border-[#323238] rounded-lg text-xs text-gray-300 hover:text-white transition">
                            <input
                                type="checkbox"
                                checked={nomearSeries}
                                onChange={e => handleNomearCheck(e.target.checked)}
                                className="accent-[#850000]"
                            />
                            Nomear Séries
                        </label>
                    </div>
                </div>

                {/* Tipo de série (só aparece se nomear estiver ativo) */}
                {nomearSeries && (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-gray-400 font-medium">Tipo de cada Série</label>
                        <div className="border border-[#323238] rounded-xl overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-[#1a1a1a] border-b border-[#323238] text-gray-500">
                                        <th className="w-12 py-1.5 px-3 text-left">Série</th>
                                        <th className="text-left py-1.5 px-3">Tipo de Série</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: parseInt(local.series) || 0 }).map((_, i) => (
                                        <tr key={i} className="border-b border-[#323238]/40 last:border-0">
                                            <td className="px-3 py-1 text-gray-500 font-mono">{String(i + 1).padStart(2, "0")}</td>
                                            <td className="px-3 py-1">
                                                <select
                                                    value={seriesArr[i] || ""}
                                                    onChange={e => updSerie(i, e.target.value)}
                                                    className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-1 w-full outline-none focus:border-[#850000]/60 appearance-none"
                                                >
                                                    <option value=""></option>
                                                    {TIPOS_SERIE.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Linha: Vídeo + Plataforma */}
                <div className="grid grid-cols-2 gap-2">
                    <FInput label="ID do Vídeo" value={local.video} onChange={v => upd("video", v)} placeholder="Ex: dQw4w9WgXcQ" />
                    <FSel label="Plataforma" value={local["plataforma_do_vídeo"]} onChange={v => upd("plataforma_do_vídeo", v)} options={["YouTube", "Instagram", "TikTok"]} />
                </div>

                {/* Instruções */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400 font-medium">Instruções</label>
                    <textarea value={local.observacao || ""} onChange={e => upd("observacao", e.target.value)} rows={2}
                        className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#850000]/60 transition resize-none placeholder-gray-600"
                        placeholder="Instruções do exercício..." />
                </div>

                {/* Intensidade */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Intensidade</label>
                        <button onClick={addIntensLinha} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white border border-[#323238] px-2 py-0.5 rounded-lg transition">
                            <Ico n="plus" s={10} /> Add
                        </button>
                    </div>
                    <div className="border border-[#323238] rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-[#1a1a1a] border-b border-[#323238] text-gray-500">
                                    <th className="text-left py-1.5 px-3">Grupo Muscular</th>
                                    <th className="text-left py-1.5 px-3">Intensidade</th>
                                    <th className="w-6"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {intens.length === 0 && (
                                    <tr><td colSpan={3} className="py-3 text-center text-gray-600 text-xs">Nenhuma intensidade.</td></tr>
                                )}
                                {intens.map((item, i) => (
                                    <tr key={i} className="border-b border-[#323238]/40 last:border-0">
                                        <td className="px-3 py-1">
                                            <input type="text" value={item.grupo_muscular} onChange={e => updIntensLinha(i, "grupo_muscular", e.target.value)}
                                                placeholder="Grupo..." className="bg-transparent text-gray-200 text-xs w-full outline-none border-b border-[#323238] focus:border-[#850000]/60 py-0.5" />
                                        </td>
                                        <td className="px-3 py-1">
                                            <input type="text" value={item.intensidade} onChange={e => updIntensLinha(i, "intensidade", e.target.value)}
                                                placeholder="1" className="bg-transparent text-gray-200 text-xs w-16 outline-none border-b border-[#323238] focus:border-[#850000]/60 py-0.5" />
                                        </td>
                                        <td className="px-2">
                                            <button onClick={() => removeIntensLinha(i)} className="text-gray-600 hover:text-red-400"><Ico n="x" s={10} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 pt-1 border-t border-[#323238]">
                    <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-400 hover:text-white border border-[#323238] rounded-lg transition">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-1.5 text-sm bg-[#850000] hover:bg-red-700 text-white font-semibold rounded-lg transition">Salvar</button>
                </div>
            </div>
        </Modal>
    );
};

// ─── MODAL DETALHES DO AERÓBICO ───────────────────────────────────────────────
const DetalhesAerobico = ({ aerobico, onSave, onClose }) => {
    const [local, setLocal] = useState({ ...aerobico });
    const upd = (f, v) => setLocal(l => ({ ...l, [f]: v }));
    return (
        <Modal open onClose={onClose} title="Detalhes do Aeróbico" size="md">
            <div className="flex flex-col gap-4">
                <div className="bg-[#1a1a1a] rounded-lg px-4 py-2 text-sm text-gray-300 font-medium">
                    {local.exercicios || "—"}
                </div>
                <FInput label="Frequência" value={local.frequencia} onChange={v => upd("frequencia", v)} placeholder="Ex: 2x na semana" />
                <div className="grid grid-cols-2 gap-3">
                    <FInput label="ID do Vídeo" value={local.video} onChange={v => upd("video", v)} placeholder="Ex: bz5w9k9IyH0" />
                    <FSel label="Plataforma do Vídeo" value={local["plataforma_do_vídeo"]} onChange={v => upd("plataforma_do_vídeo", v)} options={["YouTube", "Instagram", "TikTok"]} />
                </div>
                <p className="text-[11px] text-gray-500 -mt-2">Informe apenas o ID do vídeo (ex: dQw4w9WgXcQ).</p>
                <FTextarea label="Instruções" value={local.instrucao || local.instrucoes || ""} onChange={v => upd("instrucao", v)} placeholder="Descreva as instruções..." rows={4} />
                <div className="flex justify-end gap-2 pt-2 border-t border-[#323238]">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#323238] rounded-lg transition">Cancelar</button>
                    <button onClick={() => { onSave(local); onClose(); }} className="px-4 py-2 text-sm bg-[#850000] hover:bg-red-700 text-white font-semibold rounded-lg transition">Salvar</button>
                </div>
            </div>
        </Modal>
    );
};

// ─── MODAL DETALHES DO ALONGAMENTO ────────────────────────────────────────────
const DetalhesAlongamento = ({ alongamento, onSave, onClose }) => {
    const [local, setLocal] = useState({ ...alongamento });
    const upd = (f, v) => setLocal(l => ({ ...l, [f]: v }));
    return (
        <Modal open onClose={onClose} title="Detalhes do Alongamento" size="md">
            <div className="flex flex-col gap-4">
                <div className="bg-[#1a1a1a] rounded-lg px-4 py-2 text-sm text-gray-300 font-medium">
                    {local.exercicio || "—"}
                </div>
                <FInput label="Séries" value={local.series} onChange={v => upd("series", v)} type="number" placeholder="Ex: 2" />
                <div className="grid grid-cols-2 gap-3">
                    <FInput label="ID do Vídeo" value={local.video} onChange={v => upd("video", v)} placeholder="Ex: 2xM0B7vrOMw" />
                    <FSel label="Plataforma do Vídeo" value={local["plataforma_do_vídeo"]} onChange={v => upd("plataforma_do_vídeo", v)} options={["YouTube", "Instagram", "TikTok"]} />
                </div>
                <p className="text-[11px] text-gray-500 -mt-2">Informe apenas o ID do vídeo (ex: dQw4w9WgXcQ).</p>
                <FTextarea label="Observações" value={local.observacoes || ""} onChange={v => upd("observacoes", v)} placeholder="Descreva as instruções..." rows={4} />
                <div className="flex justify-end gap-2 pt-2 border-t border-[#323238]">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#323238] rounded-lg transition">Cancelar</button>
                    <button onClick={() => { onSave(local); onClose(); }} className="px-4 py-2 text-sm bg-[#850000] hover:bg-red-700 text-white font-semibold rounded-lg transition">Salvar</button>
                </div>
            </div>
        </Modal>
    );
};

// Autocomplete de alunos — busca via Cloud Function enquanto você digita
const AlunoAC = ({ label, value, onChange, required }) => {
    const [q, setQ] = useState(value || "");
    const [opts, setOpts] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoad] = useState(false);

    useEffect(() => { setQ(value || ""); }, [value]);

    const handle = async (texto) => {
        setQ(texto);
        if (texto.length < 2) { setOpts([]); setOpen(false); return; }
        setLoad(true);
        try {
            const res = await buscarAlunosFichaFn({ busca: texto });
            setOpts((res.data?.list || []).map(a => ({ id: a.name, nome: a.nome_completo })));
            setOpen(true);
        } catch (e) { console.error(e); }
        finally { setLoad(false); }
    };

    return (
        <div className="flex flex-col gap-1 relative">
            {label && <label className="text-xs text-gray-400 font-medium">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>}
            <div className="relative">
                <input value={q} onChange={e => handle(e.target.value)} onBlur={() => setTimeout(() => setOpen(false), 200)}
                    placeholder="Digite o nome do aluno..."
                    className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 w-full outline-none focus:border-[#850000]/60 transition placeholder-gray-600" />
                {loading && <span className="absolute right-3 top-2.5 text-gray-500"><Ico n="spin" s={14} /></span>}
            </div>
            {open && opts.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-[#29292e] border border-[#323238] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {opts.map(o => (
                        <button key={o.id} onMouseDown={() => { onChange(o.id, o.nome); setQ(o.nome); setOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#323238] transition">{o.nome}</button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── MODAL ────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, size = "xl" }) => {
    if (!open) return null;
    const w = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className={`relative bg-[#29292e] border border-[#323238] rounded-2xl shadow-2xl w-full ${w} max-h-[90vh] flex flex-col`} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#323238] shrink-0">
                    <h2 className="text-white font-bold text-lg">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#323238] transition"><Ico n="x" s={18} /></button>
                </div>
                <div className="overflow-y-auto flex-1 p-6">{children}</div>
            </div>
        </div>
    );
};

// ─── MODAL VISUALIZAÇÃO RÁPIDA ────────────────────────────────────────────────
const VisualizacaoRapida = ({ fichaId, nomeAluno, open, onClose, intensidadeMap = {} }) => {
    const [ficha, setFicha] = useState(null);
    const [loading, setLoad] = useState(false);
    const [aba, setAba] = useState("a");

    useEffect(() => {
        if (!fichaId || !open) return;
        setLoad(true);
        setFicha(null);
        buscarFichaDetalheFn({ id: fichaId })
            .then(r => { setFicha(r.data?.data); setAba("a"); })
            .catch(console.error)
            .finally(() => setLoad(false));
    }, [fichaId, open]);

    const treinos = ficha ? ["a", "b", "c", "d", "e", "f"].filter(t => (ficha[`planilha_de_treino_${t}`] || []).length > 0) : [];

    return (
        <Modal open={open} onClose={onClose} title={nomeAluno || "Ficha"} size="xl">
            {loading
                ? <div className="flex justify-center py-12"><Ico n="spin" s={28} /></div>
                : ficha ? (
                    <>
                        {/* VOLUME */}
                        {(() => {
                            const vol = calcVolume(ficha, intensidadeMap);
                            const CONFIG_MUSCULOS = GRUPOS_CONFIG;
                            const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
                            const volNorm = {};
                            Object.entries(vol).forEach(([k, v]) => {
                                volNorm[norm(k)] = (volNorm[norm(k)] || 0) + v;
                            });
                            return (
                                <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl px-4 py-2 mb-5 flex flex-col gap-1">
                                    {[CONFIG_MUSCULOS.slice(0, 8), CONFIG_MUSCULOS.slice(8)].map((linha, li) => (
                                        <div key={li} className="flex items-center justify-center gap-4 flex-wrap">
                                            <span className="text-gray-500 text-[10px] font-bold tracking-widest uppercase shrink-0">
                                                {li === 0 ? "VOLUME:" : <span className="opacity-0">VOLUME:</span>}
                                            </span>
                                            {linha.map(item => {
                                                const valor = volNorm[item.key] || 0;
                                                return (
                                                    <div key={item.key} className={`flex items-center gap-1.5 shrink-0 px-1.5 py-0.5 rounded ${item.bg}`}>
                                                        <span className={`text-[10px] uppercase tracking-tight font-medium ${valor > 0 ? item.color : "text-gray-600"}`}>
                                                            {item.label}
                                                        </span>
                                                        <span className={`text-xs font-bold ${valor > 0 ? "text-white" : "text-gray-600"}`}>
                                                            {valor.toFixed(1)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        <div className="flex gap-2 mb-5 flex-wrap">
                            {treinos.map(t => (
                                <button key={t} onClick={() => setAba(t)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${aba === t ? "bg-[#850000] text-white" : "bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#323238]"}`}>
                                    {ficha[`treino_${t}_label`] || `Treino ${t.toUpperCase()}`}
                                </button>
                            ))}
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-400 text-xs border-b border-[#323238]">
                                    <th className="text-left py-2 pr-4">Grupo Muscular</th>
                                    <th className="text-left py-2 pr-4">Exercício</th>
                                    <th className="text-center py-2 pr-4 w-16">Séries</th>
                                    <th className="text-center py-2 pr-4 w-20">Reps</th>
                                    <th className="text-center py-2 w-20">Descanso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(ficha[`planilha_de_treino_${aba}`] || []).map((ex, i) => (
                                    <tr key={i} className="border-b border-[#323238]/50 hover:bg-[#1a1a1a] transition">
                                        <td className="py-2.5 pr-4 text-gray-400 text-xs">{ex.grupo_muscular}</td>
                                        <td className="py-2.5 pr-4 text-gray-200 font-medium">{ex.exercicio}</td>
                                        <td className="py-2.5 pr-4 text-center text-gray-300">{ex.series}</td>
                                        <td className="py-2.5 pr-4 text-center text-gray-300">{ex.repeticoes || "—"}</td>
                                        <td className="py-2.5 text-center text-gray-400 text-xs">{ex.descanso || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                ) : <p className="text-gray-500 text-center py-8">Não foi possível carregar a ficha.</p>
            }
        </Modal>
    );
};

// ─── RODAPÉ DE VOLUME (Fixo: Mostra todos, inclusive zeros) ───────────────────
const RodapeVolume = ({ ficha, intensidadeMap = {}, volumeAnterior = null }) => {
    const vol = calcVolume(ficha, intensidadeMap);
    const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
    const volumesNorm = {};
    Object.entries(vol).forEach(([k, v]) => { volumesNorm[norm(k)] = (volumesNorm[norm(k)] || 0) + v; });
    const volAntNorm = {};
    if (volumeAnterior) {
        Object.entries(volumeAnterior).forEach(([k, v]) => { volAntNorm[norm(k)] = (volAntNorm[norm(k)] || 0) + v; });
    }
    const metade = Math.ceil(GRUPOS_CONFIG.length / 2);
    return (
        <div className="shrink-0 bg-[#1a1a1a] border-t border-[#323238] px-6 py-1.5 flex flex-col gap-0.5">
            {[GRUPOS_CONFIG.slice(0, metade), GRUPOS_CONFIG.slice(metade)].map((linha, li) => (
                <div key={li} className="flex items-center justify-center gap-3 flex-wrap">
                    <span className="text-gray-500 text-[10px] font-bold tracking-widest uppercase shrink-0">
                        {li === 0 ? "VOLUME:" : <span className="opacity-0">VOLUME:</span>}
                    </span>
                    {linha.map((item) => {
                        const valor = volumesNorm[item.key] || 0;
                        const anterior = volAntNorm[item.key] || 0;
                        const delta = volumeAnterior ? valor - anterior : null;
                        return (
                            <div key={item.key} className={`flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded ${item.bg}`}>
                                <span className={`text-[10px] uppercase tracking-tight font-medium ${item.color}`}>
                                    {item.label}
                                </span>
                                <span className={`text-xs font-bold ${valor > 0 ? "text-white" : "text-gray-600"}`}>
                                    {valor.toFixed(1)}
                                </span>
                                {delta !== null && delta !== 0 && (
                                    <span className={`text-[9px] font-bold ${delta > 0 ? "text-emerald-500" : "text-red-400"}`}>
                                        {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

// ─── TABELA DE EXERCÍCIOS (Corrigido: Lookup Normalizado e Sem Erro de Hooks) ──
const TabelaExercicios = ({ exercicios, onChange, gruposMusculares, exerciciosPorGrupo, intensidadeMap = {}, mapaDetalhes = {} }) => {
    const [detalheIdx, setDetalheIdx] = useState(null);

    // 1. CRIAÇÃO DO ÍNDICE NORMALIZADO (Isso roda apenas quando a lista original muda)
    // Transforma: { "Quadríceps": [...] } em { "quadriceps": [...] }
    const exerciciosMapNorm = useMemo(() => {
        const map = {};
        Object.keys(exerciciosPorGrupo).forEach(rawKey => {
            const keyNorm = normalizar(rawKey);
            if (!map[keyNorm]) map[keyNorm] = [];
            // Mescla arrays para garantir que todas as variações caiam no mesmo bucket
            map[keyNorm] = [...map[keyNorm], ...exerciciosPorGrupo[rawKey]];
        });
        return map;
    }, [exerciciosPorGrupo]);

    // Lista completa (fallback)
    const todosExercicios = useMemo(() => {
        const all = Object.values(exerciciosPorGrupo).flat();
        return [...new Set(all)];
    }, [exerciciosPorGrupo]);

    const moveEx = (i, dir) => {
        const arr = [...exercicios];
        const to = i + dir;
        if (to < 0 || to >= arr.length) return;
        [arr[i], arr[to]] = [arr[to], arr[i]];
        onChange(arr);
    };

    const novoEx = () => ({
        _id: uid(),
        grupo_muscular: "", exercicio: "", carga_sugerida: 0,
        series: 3, repeticoes: "", descanso: "", observacao: "",
        video: "", "plataforma_do_vídeo": "YouTube", tipo_de_serie: "",
        primeiro: 0, ultimo: 0, titulo_do_exercicio_combinado: ""
    });

    const add = () => onChange([...exercicios, novoEx()]);
    const remove = (i) => onChange(exercicios.filter((_, idx) => idx !== i));
    const dupe = (i) => {
        const arr = [...exercicios];
        arr.splice(i + 1, 0, { ...exercicios[i], _id: uid() });
        onChange(arr);
    };

    const upd = (i, field, val) => {
        const arr = [...exercicios];
        arr[i] = { ...arr[i], [field]: val };

        if (field === "exercicio") {
            arr[i].intensidade = "[]";
            const info = mapaDetalhes[val];
            if (info) {
                if (!arr[i].grupo_muscular) {
                    arr[i].grupo_muscular = info.grupo_muscular;
                }
                arr[i].video = info.video || "";
                arr[i]["plataforma_do_vídeo"] = info["plataforma_do_vídeo"] || "YouTube";
            }
        }
        // Se mudou o grupo manualmente, limpa o exercício
        if (field === "grupo_muscular") { arr[i].exercicio = ""; }
        onChange(arr);
    };

    // Mapa de cores para combinados
    let comboActive = false;
    const combinadosMap = exercicios.map(ex => {
        let isPart = false;
        if (ex.primeiro) comboActive = true;
        if (comboActive) isPart = true;
        if (ex.ultimo) comboActive = false;
        return isPart;
    });

    return (
        <div>
            {detalheIdx !== null && (
                <DetalhesExercicio ex={exercicios[detalheIdx]} intensidadeMap={intensidadeMap}
                    onSave={updated => { const arr = [...exercicios]; arr[detalheIdx] = updated; onChange(arr); }}
                    onClose={() => setDetalheIdx(null)} />
            )}
            <div className="rounded-xl border border-[#323238] bg-[#1a1a1a]">
                <table className="w-full text-sm min-w-[700px]">
                    <thead>
                        <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-[#323238]">
                            <th className="w-8 py-2 px-2"></th>
                            <th className="text-left py-2 px-2 w-36">Grupo Muscular</th>
                            <th className="text-left py-2 px-2 w-56">Exercício</th>
                            <th className="text-center py-2 px-2 w-12">Séries</th>
                            <th className="text-center py-2 px-2 w-24">Reps</th>
                            <th className="text-center py-2 px-2 w-24">Descanso</th>
                            <th className="text-left py-2 px-2">Instruções</th>
                            <th className="text-center py-2 px-2 w-32">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {exercicios.length === 0 && (
                            <tr><td colSpan={8} className="text-center text-gray-600 py-8 text-sm">Nenhum exercício adicionado.</td></tr>
                        )}
                        {exercicios.map((ex, i) => {
                            const isInCombo = combinadosMap[i];

                            // CORREÇÃO AQUI: Removemos o useMemo de dentro do loop.
                            // Fazemos o lookup direto. Como exerciciosMapNorm já está pronto, é muito rápido.
                            let opcoesExercicios = todosExercicios;
                            if (ex.grupo_muscular) {
                                const key = normalizar(ex.grupo_muscular);
                                const found = exerciciosMapNorm[key];
                                if (found) opcoesExercicios = [...new Set(found)];
                            }

                            return (
                                <tr
                                    key={ex._id || i}
                                    className={`border-b border-[#323238] transition group hover:bg-[#202024]
                                    ${isInCombo ? "bg-[#850000]/10 border-l-2 border-l-[#850000]" : "border-l-2 border-l-transparent"}`}>

                                    <td className="px-2 text-center w-10 align-middle">
                                        <div className="flex flex-row items-center justify-center gap-1">
                                            <div className="flex flex-col items-center">
                                                <button onClick={() => moveEx(i, -1)} disabled={i === 0} className="text-gray-500 hover:text-white disabled:opacity-20"><Ico n="up" s={12} /></button>
                                                <button onClick={() => moveEx(i, 1)} disabled={i === exercicios.length - 1} className="text-gray-500 hover:text-white disabled:opacity-20"><Ico n="down" s={12} /></button>
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-500 font-mono">{i + 1}</span>
                                        </div>
                                    </td>
                                    {/* Grupo Muscular (Coluna 2) - REMOVIDO o h-16 */}
                                    <td className="px-2 py-1 align-middle relative z-10">
                                        <SearchableCombo value={ex.grupo_muscular}
                                            options={gruposMusculares} placeholder="Grupo" className="w-full"
                                            onChange={v => upd(i, "grupo_muscular", v)}
                                        />
                                    </td>

                                    {/* Exercício (Coluna 3) */}
                                    <td className="px-2 py-1 align-middle relative z-50 whitespace-normal break-words">
                                        <SearchableCombo
                                            key={`ex-${i}-${ex.grupo_muscular}`}
                                            value={ex.exercicio}
                                            onChange={v => upd(i, "exercicio", v)}
                                            options={opcoesExercicios}
                                            placeholder="Exercício..."
                                            className="w-full"
                                        />
                                    </td>

                                    {/* Inputs Numéricos (Séries/Reps/Descanso) - Usando h-8 */}
                                    <td className="px-2 py-1 align-middle">
                                        <input type="number" value={ex.series} onChange={e => upd(i, "series", e.target.value)}
                                            className="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-1 w-full text-center outline-none focus:border-[#850000]/60 h-8" />
                                    </td>

                                    <td className="px-2 py-1 align-middle">
                                        <TextareaComSugestoes value={ex.repeticoes || ""} onChange={v => upd(i, "repeticoes", v)} categoria="repeticoes_treino" rows={1}
                                            inputClassName="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-1 w-full text-center outline-none focus:border-[#850000]/60 resize-none h-8 leading-8 overflow-hidden"
                                        />
                                    </td>

                                    <td className="px-2 py-1 align-middle">
                                        <TextareaComSugestoes value={ex.descanso || ""} onChange={v => upd(i, "descanso", v)} categoria="descanso_treino" rows={1}
                                            inputClassName="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-1 w-full text-center outline-none focus:border-[#850000]/60 resize-none h-8 leading-8 overflow-hidden"
                                        />
                                    </td>

                                    <td className="px-2 py-1 align-middle">
                                        <TextareaExpansivel
                                            value={ex.observacao || ""}
                                            onChange={v => upd(i, "observacao", v)}
                                            categoria="instrucoes_treino"
                                            placeholder="Instruções..."
                                            resetKey={0}
                                            className="w-full"
                                        />
                                    </td>
                                    <td className="px-1 py-1 align-top">
                                        <div className="flex flex-col gap-1 justify-center h-full pt-0.5">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => upd(i, "primeiro", ex.primeiro ? 0 : 1)}
                                                    className={`text-[10px] font-bold px-2 h-7 rounded border transition ${ex.primeiro ? "bg-green-500/20 text-green-400 border-green-500/50" : "border-[#323238] text-gray-500 hover:border-gray-500"}`}>
                                                    1º
                                                </button>
                                                <button onClick={() => upd(i, "ultimo", ex.ultimo ? 0 : 1)}
                                                    className={`text-[10px] font-bold px-2 h-7 rounded border transition ${ex.ultimo ? "bg-red-500/20 text-red-400 border-red-500/50" : "border-[#323238] text-gray-500 hover:border-gray-500"}`}>
                                                    Ult
                                                </button>

                                                <div className="w-px h-5 bg-[#323238] mx-1"></div>

                                                <button onClick={() => setDetalheIdx(i)} title="Detalhes" className="text-gray-500 hover:text-blue-400"><Ico n="info" s={15} /></button>
                                                <button onClick={() => dupe(i)} title="Duplicar" className="text-gray-500 hover:text-yellow-400"><Ico n="dupe" s={15} /></button>
                                                <button onClick={() => remove(i)} title="Remover" className="text-gray-500 hover:text-red-400"><Ico n="trash" s={15} /></button>
                                            </div>

                                            {isInCombo && (
                                                <select value={ex.titulo_do_exercicio_combinado} onChange={e => upd(i, "titulo_do_exercicio_combinado", e.target.value)}
                                                    className="bg-[#202024] border border-[#323238] text-[10px] text-gray-300 rounded px-1 py-1 w-full outline-none mt-1">
                                                    <option value="">Tipo...</option>
                                                    {["Bi-set", "Tri-set", "Superset"].map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <button onClick={add} className="mt-3 flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-dashed border-[#323238] hover:border-[#850000]/50 px-4 py-2 rounded-lg transition w-full justify-center">
                <Ico n="plus" s={14} /> Adicionar Exercício
            </button>
        </div>
    );
};

// ─── GERENCIADOR DE TREINOS ───────────────────────────────────────────────────
const TREINOS = ["a", "b", "c", "d", "e", "f"];
const labelTreino = (t, ficha) => ficha[`treino_${t}_label`] || `Treino ${t.toUpperCase()}`;

const GerenciadorTreinos = ({ ficha, upd, onClose }) => {
    const [acao, setAcao] = useState("copiar");
    const [origem, setOrigem] = useState("");
    const [destino, setDestino] = useState("");
    const [feedback, setFeedback] = useState("");

    const executar = () => {
        if (!origem) return setFeedback("Selecione o treino de origem.");
        if (acao !== "excluir" && !destino) return setFeedback("Selecione o treino de destino.");
        if ((acao === "copiar" || acao === "mover" || acao === "inverter") && origem === destino)
            return setFeedback("Origem e destino não podem ser iguais.");

        const chaveOrigem = `planilha_de_treino_${origem}`;
        const chaveDestino = `planilha_de_treino_${destino}`;
        const limpar = (ex) => {
            const { name, _id, ...resto } = ex;
            return { ...resto, _id: uid() };
        };
        const exOrigem = (ficha[chaveOrigem] || []).map(limpar);
        const exDestino = (ficha[chaveDestino] || []).map(limpar);

        if (acao === "copiar") {
            upd(chaveDestino, [...exDestino, ...exOrigem]);
            setFeedback(`✅ Exercícios do ${labelTreino(origem, ficha)} copiados para ${labelTreino(destino, ficha)}.`);
        } else if (acao === "mover") {
            upd(chaveDestino, [...exDestino, ...exOrigem]);
            upd(chaveOrigem, []);
            setFeedback(`✅ Exercícios movidos de ${labelTreino(origem, ficha)} para ${labelTreino(destino, ficha)}.`);
        } else if (acao === "inverter") {
            upd(chaveOrigem, exDestino);
            upd(chaveDestino, exOrigem);
            setFeedback(`✅ ${labelTreino(origem, ficha)} e ${labelTreino(destino, ficha)} invertidos.`);
        } else if (acao === "excluir") {
            if (!window.confirm(`Excluir todos os exercícios do ${labelTreino(origem, ficha)}?`)) return;
            upd(chaveOrigem, []);
            setFeedback(`✅ ${labelTreino(origem, ficha)} limpo.`);
        }
    };

    const treinosComExercicios = TREINOS.filter(t => (ficha[`planilha_de_treino_${t}`] || []).length > 0);

    return (
        <Modal open onClose={onClose} title="Gerenciador de Treinos" size="sm">
            <div className="flex flex-col gap-4">
                <FSel
                    label="Ação"
                    value={acao}
                    onChange={v => { setAcao(v); setFeedback(""); }}
                    options={[
                        { value: "copiar", label: "Copiar exercícios" },
                        { value: "mover", label: "Mover exercícios" },
                        { value: "inverter", label: "Inverter treinos" },
                        { value: "excluir", label: "Limpar treino" },
                    ]}
                />

                <FSel
                    label={acao === "inverter" ? "Treino A (inverter com)" : "Copiar/Mover/Limpar exercícios do"}
                    value={origem}
                    onChange={v => { setOrigem(v); setFeedback(""); }}
                    placeholder="Selecionar treino..."
                    options={TREINOS.map(t => ({ value: t, label: `${labelTreino(t, ficha)}${(ficha[`planilha_de_treino_${t}`] || []).length > 0 ? ` (${ficha[`planilha_de_treino_${t}`].length} ex.)` : " (vazio)"}` }))}
                />

                {acao !== "excluir" && (
                    <FSel
                        label={acao === "inverter" ? "Treino B (inverter com)" : "Para"}
                        value={destino}
                        onChange={v => { setDestino(v); setFeedback(""); }}
                        placeholder="Selecionar treino..."
                        options={TREINOS.filter(t => t !== origem).map(t => ({ value: t, label: `${labelTreino(t, ficha)}${(ficha[`planilha_de_treino_${t}`] || []).length > 0 ? ` (${ficha[`planilha_de_treino_${t}`].length} ex.)` : " (vazio)"}` }))}
                    />
                )}

                {feedback && (
                    <p className={`text-xs px-3 py-2 rounded-lg ${feedback.startsWith("✅") ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                        {feedback}
                    </p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-[#323238]">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#323238] rounded-lg transition">Fechar</button>
                    <button onClick={executar} className="px-4 py-2 text-sm bg-[#850000] hover:bg-red-700 text-white font-semibold rounded-lg transition">Executar</button>
                </div>
            </div>
        </Modal>
    );
};
const novaFicha = () => ({
        aluno: "", nome_completo: "", data_de_inicio: "", data_de_fim: "",
        objetivo: "", nivel: "", tipo_de_ciclo: "", orientacoes: "",
        orientacoes_aerobicos: "", orientacoes_aem: "",
        orientacoes_treino_a: "", orientacoes_treino_b: "", orientacoes_treino_c: "",
        orientacoes_treino_d: "", orientacoes_treino_e: "", orientacoes_treino_f: "",
        dias_da_semana: [
        { dia_da_semana: "Segunda", treino: "Off" }, { dia_da_semana: "Terca", treino: "Off" },
        { dia_da_semana: "Quarta", treino: "Off" }, { dia_da_semana: "Quinta", treino: "Off" },
        { dia_da_semana: "Sexta", treino: "Off" }, { dia_da_semana: "Sabado", treino: "Off" },
        { dia_da_semana: "Domingo", treino: "Off" },
    ],
    periodizacao: [],
    periodizacao_dos_aerobicos: [],
    planilha_de_alongamentos_e_mobilidade: [],
    planilha_de_treino_a: [], planilha_de_treino_b: [], planilha_de_treino_c: [],
    planilha_de_treino_d: [], planilha_de_treino_e: [], planilha_de_treino_f: [],
    treino_a_label: "", treino_b_label: "", treino_c_label: "",
    treino_d_label: "", treino_e_label: "", treino_f_label: "",
});

// ─── MODAL DE DUPLICAÇÃO (Selecionar Aluno) ───────────────────────────────────
const ModalDuplicarFicha = ({ open, onClose, onConfirm, fichaOrigem }) => {
    const [aluno, setAluno] = useState({ id: "", nome: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) setAluno({ id: "", nome: "" }); // Reseta ao abrir
    }, [open]);

    const handleConfirm = async () => {
        if (!aluno.id) return alert("Selecione um aluno para duplicar a ficha.");
        setLoading(true);
        await onConfirm(aluno.id, aluno.nome);
        setLoading(false);
    };

    return (
        <Modal open={open} onClose={onClose} title="Duplicar Ficha Para..." size="sm">
            <div className="flex flex-col gap-4">
                <div className="bg-[#1a1a1a] p-3 rounded-lg border border-[#323238]">
                    <p className="text-xs text-gray-500 mb-1">Ficha de Origem:</p>
                    <p className="text-sm text-white font-medium">{fichaOrigem?.nome_completo}</p>
                    <p className="text-xs text-gray-400 mt-1">{fichaOrigem?.objetivo || "Sem objetivo"} • {detectEstrutura(fichaOrigem?.dias_da_semana)}</p>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-sm text-gray-300">Selecione o Novo Aluno:</label>
                    <AlunoAC
                        value={aluno.nome}
                        onChange={(id, nome) => setAluno({ id, nome })}
                    />
                    <p className="text-[10px] text-gray-500">
                        * Todas as datas, exercícios, cargas e observações serão copiados exatamente iguais.
                    </p>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-[#323238] mt-2">
                    <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#323238] rounded-lg transition">
                        Cancelar
                    </button>
                    <button onClick={handleConfirm} disabled={loading} className="px-4 py-2 text-sm bg-[#850000] hover:bg-red-700 text-white font-semibold rounded-lg transition flex items-center gap-2">
                        {loading ? <><Ico n="spin" s={14} /> Copiando...</> : "Confirmar Cópia"}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// ─── MODAL DE EXCLUSÃO (Confirmação) ──────────────────────────────────────────
const ModalExcluirFicha = ({ open, onClose, onConfirm, ficha }) => {
    const [loading, setLoading] = useState(false);

    if (!open || !ficha) return null;

    const handleConfirm = async () => {
        setLoading(true);
        await onConfirm(ficha);
        setLoading(false);
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose} title="Excluir Ficha" size="sm">
            <div className="flex flex-col gap-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                    <div className="text-red-400 mt-0.5"><Ico n="trash" s={20} /></div>
                    <div>
                        <h3 className="text-red-400 font-bold text-sm">Tem certeza?</h3>
                        <p className="text-gray-400 text-xs mt-1">
                            Você está prestes a excluir a ficha de <strong className="text-gray-200">{ficha.nome_completo}</strong>.
                            Essa ação <span className="text-red-400 underline">não pode ser desfeita</span>.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-[#323238]">
                    <button onClick={onClose} disabled={loading}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#323238] rounded-lg transition">
                        Cancelar
                    </button>
                    <button onClick={handleConfirm} disabled={loading}
                        className="px-4 py-2 text-sm bg-red-900/80 hover:bg-red-800 text-red-100 border border-red-800 font-semibold rounded-lg transition flex items-center gap-2">
                        {loading ? <><Ico n="spin" s={14} /> Excluindo...</> : "Sim, Excluir"}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// ─── FORMULÁRIO MULTI-STEP (tela de montagem) ────────────────────────────────
const FormularioFicha = ({ fichaInicial, onClose, onSave, exerciciosDesabilitados = {} }) => {
    const isEdit = !!fichaInicial?.name;
    const [step, setStep] = useState(() => {
        const saved = localStorage.getItem("fichaStep");
        return saved ? parseInt(saved) : 0;
    });
    const [saving, setSaving] = useState(false);
    const [erro, setErro] = useState("");
    const [salvo, setSalvo] = useState(false);

    // 👇 ESTADO DO NÚMERO DE SEMANAS (Aqui é o lugar certo!)
    const [numSemanas, setNumSemanas] = useState(
        (fichaInicial?.periodizacao?.length > 0) ? fichaInicial.periodizacao.length : 4
    );

    // Função Mágica de Geração
    const gerarPeriodizacao = () => {
        if (!ficha.data_de_inicio) return alert("Selecione uma data de início primeiro.");

        const semanas = parseInt(numSemanas) || 4;

        // 1. Calcula Data Fim (Data Inicio + (Semanas * 7) - 1 dia)
        // Ex: Começa Seg 01, 1 semana = Termina Dom 07
        const novaDataFim = somarDias(ficha.data_de_inicio, (semanas * 7) - 1);
        upd("data_de_fim", novaDataFim);

        // 2. Gera a Tabela
        const tabelaAtual = ficha.periodizacao || [];
        const novaTabela = [];

        for (let i = 0; i < semanas; i++) {
            // Lógica Inteligente: Mantém dados existentes se a linha já existir
            // Se for linha nova, copia a configuração da ÚLTIMA linha existente (pra agilizar)
            const existe = tabelaAtual[i];
            const base = existe || (i > 0 ? novaTabela[i - 1] : { series: "3", repeticoes: "10-12" });

            novaTabela.push({
                semana: String(i + 1).padStart(2, '0'),
                series: base.series,
                repeticoes: base.repeticoes
            });
        }

        upd("periodizacao", novaTabela);
    };

    const [volumeAnterior, setVolumeAnterior] = useState(null);
    const [aerobicoResetKey, setAerobicoResetKey] = useState(0);
    const [alongamentoResetKey, setAlongamentoResetKey] = useState(0);
    // ESTADOS PARA OS MODAIS
    const [detalheAerobicoIdx, setDetalheAerobicoIdx] = useState(null);
    const [gerenciadorAberto, setGerenciadorAberto] = useState(false);

    const [detalheAlongamentoIdx, setDetalheAlongamentoIdx] = useState(null);

    // DADOS CARREGADOS
    const [grupos, setGrupos] = useState([]);
    const [porGrupo, setPorGrupo] = useState({});

    // MAPAS DE DETALHES (Para preenchimento automático)
    const [mapaTreinos, setMapaTreinos] = useState({});      // { "Nome Ex": { video, plataforma, grupo... } }
    const [mapaAlong, setMapaAlong] = useState({});          // { "Nome Along": { video, plataforma... } }
    const [mapaAerob, setMapaAerob] = useState({});          // { "Nome Aerob": { video, instrucao... } }

    const [intensMap, setIntensMap] = useState({});
    const [alongs, setAlongs] = useState([]); // Lista de nomes para o dropdown
    const [aerobs, setAerobs] = useState([]); // Lista de nomes para o dropdown

    const [ficha, setFicha] = useState({ ...novaFicha(), ...(fichaInicial || {}) });
    // Atualiza data_de_fim automaticamente quando numSemanas ou data_de_inicio muda
    const initialNumSemanas = useRef(numSemanas);
    const initialDataInicio = useRef(ficha.data_de_inicio);

    useEffect(() => {
        const semanasIgual = numSemanas === initialNumSemanas.current;
        const dataIgual = ficha.data_de_inicio === initialDataInicio.current;
        if (semanasIgual && dataIgual) return; // Valores não mudaram — ignora
        if (ficha.data_de_inicio && numSemanas && parseInt(numSemanas) > 0) {
            const nova = somarDias(ficha.data_de_inicio, (parseInt(numSemanas) * 7) - 1);
            upd("data_de_fim", nova);
        }
    }, [numSemanas, ficha.data_de_inicio]);
    const upd = (field, val) => setFicha(f => ({ ...f, [field]: val }));

    useEffect(() => {
        localStorage.setItem("fichaStep", step);
    }, [step]);

    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [ficha]);

    // Carrega listas e monta os mapas
    useEffect(() => {
        // Busca ficha anterior do mesmo aluno para comparação de volume
        if (fichaInicial?.aluno) {
            buscarFichasFn({ page: 1, limit: 10, aluno: fichaInicial.nome_completo })
                .then(async r => {
                    const lista = r.data?.list || [];
                    const anterior = lista
                        .filter(f => f.aluno === fichaInicial.aluno && f.name !== fichaInicial.name)
                        .sort((a, b) => new Date(b.creation) - new Date(a.creation))[0];
                    if (anterior) {
                        const det = await buscarFichaDetalheFn({ id: anterior.name });
                        const dados = det.data?.data;
                        if (dados) setVolumeAnterior(calcVolume(dados));
                    }
                })
                .catch(console.error);
        }
        buscarGruposFn().then(r => setGrupos(r.data?.list || [])).catch(console.error);

        buscarExerciciosFn({}).then(r => {
            const lista = r.data?.list || [];
            const mapG = {}; // Dropdown por grupo
            const mapI = {}; // Intensidade
            const mapD = {}; // Detalhes completos

            lista.forEach(e => {
                const grupo = e.grupo_muscular || "";
                if (!mapG[grupo]) mapG[grupo] = [];
                mapG[grupo].push(e.nome_do_exercicio);

                try {
                    const intensidades = typeof e.intensidade_json === "string" ? JSON.parse(e.intensidade_json) : (e.intensidade_json || []);
                    mapI[e.nome_do_exercicio] = intensidades;
                } catch { }

                mapD[e.nome_do_exercicio] = {
                    grupo_muscular: e.grupo_muscular,
                    video: e.video,
                    "plataforma_do_vídeo": e["plataforma_do_vídeo"]
                };
            });
            // Remove exercícios desabilitados
            Object.keys(mapG).forEach(grupo => {
                mapG[grupo] = mapG[grupo].filter(nome => !exerciciosDesabilitados[nome]);
            });
            Object.keys(mapG).forEach(grupo => {
                mapG[grupo] = mapG[grupo].filter(nome => !exerciciosDesabilitados[nome]);
            });
            setPorGrupo(mapG);
            setIntensMap(mapI);
            setMapaTreinos(mapD);
        }).catch(console.error);

        // CORREÇÃO: Mapeamento de Alongamentos vindo como Objetos
        buscarAlongamentosFn().then(r => {
            const lista = r.data?.list || [];
            const nomes = [];
            const detalhes = {};
            lista.forEach(item => {
                // Backend agora retorna objeto completo. O nome está em "nome_do_exercício"
                const nome = item["nome_do_exercício"];
                if (nome) {
                    nomes.push(nome);
                    detalhes[nome] = {
                        video: item.video,
                        "plataforma_do_vídeo": item["plataforma_do_vídeo"]
                    };
                }
            });
            setAlongs(nomes);
            setMapaAlong(detalhes);
        }).catch(console.error);

        // CORREÇÃO: Mapeamento de Aeróbicos vindo como Objetos
        buscarAerobicosFn().then(r => {
            const lista = r.data?.list || [];
            const nomes = [];
            const detalhes = {};
            lista.forEach(item => {
                const nome = item.exercicio_aerobico || item.name;
                if (nome) {
                    nomes.push(nome);
                    detalhes[nome] = {
                        video: item.video,
                        "plataforma_do_vídeo": item["plataforma_do_vídeo"],
                        instrucao: item.instrucao || item.instrucoes
                    };
                }
            });
            setAerobs(nomes);
            setMapaAerob(detalhes);
        }).catch(console.error);
    }, []);

    // Definição dos steps (abas de navegação)
    const steps = [
        { id: "config", label: "Dados da Ficha" },
        { id: "aerobico", label: "Aeróbicos" },
        { id: "alongamento", label: "Alongamentos" },
        ...["a", "b", "c", "d", "e", "f"].map(t => ({ id: `treino_${t}`, label: ficha[`treino_${t}_label`] || `Treino ${t.toUpperCase()}` })),
    ];

    // Salva a ficha via Cloud Function → Frappe
    const handleSave = async () => {
        if (!ficha.aluno) { setErro("Selecione um aluno antes de salvar."); return; }
        setSaving(true); setErro("");
        try {
            const comIdx = (arr) => (arr || []).map((item, i) => {
                const { _id, ...rest } = item;
                // Garante que intensidade sempre vai como string para o Frappe
                if (rest.intensidade && typeof rest.intensidade !== "string") {
                    rest.intensidade = JSON.stringify(rest.intensidade);
                }
                return { ...rest, idx: i + 1 };
            });

            const fichaLimpa = {
                ...ficha,
                data_de_fim: ficha.data_de_fim,
                periodizacao_dos_aerobicos: comIdx((ficha.periodizacao_dos_aerobicos || []).filter(a => a.exercicios?.trim()).map(a => ({ ...a, frequencia: a.frequencia?.trim() || "—" }))),
                planilha_de_alongamentos_e_mobilidade: comIdx((ficha.planilha_de_alongamentos_e_mobilidade || []).filter(a => a.exercicio?.trim())),
                planilha_de_treino_a: comIdx(ficha.planilha_de_treino_a),
                planilha_de_treino_b: comIdx(ficha.planilha_de_treino_b),
                planilha_de_treino_c: comIdx(ficha.planilha_de_treino_c),
                planilha_de_treino_d: comIdx(ficha.planilha_de_treino_d),
                planilha_de_treino_e: comIdx(ficha.planilha_de_treino_e),
                planilha_de_treino_f: comIdx(ficha.planilha_de_treino_f),
            };
            const res = await salvarFichaFn({ ficha: fichaLimpa, id: isEdit ? fichaInicial.name : undefined });
            if (res.data?.success) {
                localStorage.setItem("fichaStep", step);
                const dadosSalvos = res.data.data || {};
                setFicha(f => ({
                    ...f,
                    name: dadosSalvos.name || f.name,
                    modified: dadosSalvos.modified || f.modified,
                    modified_by: dadosSalvos.modified_by || f.modified_by,
                }));
               // Salva sugestões em background — não bloqueia o save
Promise.resolve().then(async () => {
    try {
        const textos = [
            { cat: "orientacoes_gerais", vals: [ficha.orientacoes] },
            { cat: "instrucoes_aerobicos", vals: (ficha.periodizacao_dos_aerobicos || []).map(a => a.instrucao || a.instrucoes) },
            { cat: "observacoes_alongamentos", vals: (ficha.planilha_de_alongamentos_e_mobilidade || []).map(a => a.observacoes) },
            { cat: "instrucoes_treino", vals: ["a", "b", "c", "d", "e", "f"].flatMap(t => (ficha[`planilha_de_treino_${t}`] || []).map(ex => ex.observacao)) },
            { cat: "frequencia_aerobicos", vals: (ficha.periodizacao_dos_aerobicos || []).map(a => a.frequencia) },
            { cat: "repeticoes_treino", vals: ["a", "b", "c", "d", "e", "f"].flatMap(t => (ficha[`planilha_de_treino_${t}`] || []).map(ex => ex.repeticoes)) },
            { cat: "descanso_treino", vals: ["a", "b", "c", "d", "e", "f"].flatMap(t => (ficha[`planilha_de_treino_${t}`] || []).map(ex => ex.descanso)) },
        ];
        for (const { cat, vals } of textos) {
            for (const v of vals) {
                if (v?.trim()) await salvarSugestao(cat, v.trim()).catch(() => {});
            }
        }
    } catch (e) { console.error("Sugestões:", e); }
});
setSalvo(true);
setTimeout(() => setSalvo(false), 3000);
onSave(res.data.data);
            } else setErro("Erro ao salvar. Tente novamente.");
        } catch (e) {
            console.error(e);
            setErro(e.message || "Erro ao salvar a ficha.");
        } finally { setSaving(false); }
    };

    const renderStep = () => {
        const s = steps[step];

        if (s.id === "config") return (
            <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
                <div className="flex flex-col gap-4">
                    <h3 className="text-white font-semibold text-sm border-b border-[#323238] pb-2">Informações da Ficha</h3>

                    {/* LINHA 1: Aluno e Objetivo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AlunoAC label="Aluno" value={ficha.nome_completo} required onChange={(id, nome) => { upd("aluno", id); upd("nome_completo", nome); }} />
                        <FSel label="Objetivo" value={ficha.objetivo} onChange={v => upd("objetivo", v)}
                            options={["Recomposição corporal", "Hipertrofia", "Emagrecimento", "Condicionamento", "Saúde geral"]} />
                    </div>

                    {/* LINHA 2: Configuração de Datas Inteligente */}
                    <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#323238] flex flex-col gap-3">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Planejamento Temporal</span>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">

                            <FInput label="Data de Início" value={ficha.data_de_inicio} onChange={v => upd("data_de_inicio", v)} type="date" />

                            {/* Campo de Semanas com Botão Integrado */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400 font-medium">Duração (Semanas)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={numSemanas}
                                        onChange={e => setNumSemanas(e.target.value)}
                                        className="bg-[#29292e] border border-[#323238] text-gray-200 text-sm rounded-lg pl-3 w-full outline-none focus:border-[#850000]/60"
                                    />
                                    <button
                                        onClick={gerarPeriodizacao}
                                        title="Gerar Datas e Tabela"
                                        className="bg-[#850000] hover:bg-red-700 text-white p-2 rounded-lg transition shrink-0"
                                    >
                                        <Ico n="bolt" s={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400 font-medium">
                                    Data Fim <span className="text-gray-600 text-[10px] font-normal">(editável)</span>
                                </label>
                                <input
                                    type="date"
                                    value={ficha.data_de_fim || ""}
                                    onChange={e => upd("data_de_fim", e.target.value)}
                                    className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#850000]/60 transition"
                                />
                            </div>

                            <div className="hidden md:block"></div> {/* Espaçador */}
                        </div>
                    </div>

                    {/* Resto dos campos (Nível, Ciclo, Orientações) */}
                    <div className="grid grid-cols-2 gap-3">
                        <FSel label="Nível" value={ficha.nivel} onChange={v => upd("nivel", v)} options={["Iniciante", "Intermediário", "Avançado"]} />
                        <FSel label="Ciclo" value={ficha.tipo_de_ciclo} onChange={v => upd("tipo_de_ciclo", v)} options={["Macrociclo", "Mesociclo", "Microciclo"]} />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 font-medium">Orientações Gerais</label>
                        <TextareaComSugestoes value={ficha.orientacoes} onChange={v => upd("orientacoes", v)} categoria="orientacoes_gerais" placeholder="Orientações..." rows={3} />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* Tabela de Dias da Semana (Mantida igual) */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-white font-semibold text-sm border-b border-[#323238] pb-2">Distribuição Semanal</h3>
                        <div className="bg-[#1a1a1a] rounded-xl border border-[#323238] overflow-hidden">
                            {ficha.dias_da_semana.map((dia, i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-[#323238] last:border-0 h-10">
                                    <span className="text-gray-300 text-sm w-24">{dia.dia_da_semana}</span>
                                    <select value={dia.treino} onChange={e => { const d = [...ficha.dias_da_semana]; d[i] = { ...d[i], treino: e.target.value }; upd("dias_da_semana", d); }}
                                        className="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-[#850000]/60 w-36">
                                        <option value="Off">Off</option>
                                        {["Treino A", "Treino B", "Treino C", "Treino D", "Treino E", "Treino F"].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* TABELA DE PERIODIZAÇÃO (Agora com Datas Inteligentes Visuais) */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-white font-semibold text-sm border-b border-[#323238] pb-2">Periodização</h3>
                        <div className="bg-[#1a1a1a] rounded-xl border border-[#323238] overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-gray-500 border-b border-[#323238]">
                                        <th className="py-2 px-3 text-left w-12">Sem.</th>
                                        <th className="py-2 px-2 text-left text-[10px] text-gray-600 font-normal uppercase tracking-wider">Período (Seg-Dom)</th>
                                        <th className="py-2 px-3 text-center">Séries</th>

                                        {/* AQUI É SÓ O TÍTULO */}
                                        <th className="py-2 px-3 text-center">Reps</th>

                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(ficha.periodizacao || []).map((p, i) => {
                                        // CÁLCULO VISUAL DA DATA (Sem salvar no banco, apenas visual)
                                        let periodoTexto = "—";
                                        if (ficha.data_de_inicio) {
                                            const seg = getSegundaFeira(ficha.data_de_inicio);
                                            if (seg) {
                                                const inicioSemana = new Date(seg);
                                                inicioSemana.setDate(seg.getDate() + (i * 7));

                                                const fimSemana = new Date(inicioSemana);
                                                fimSemana.setDate(inicioSemana.getDate() + 6);

                                                periodoTexto = `${formatarDataBr(inicioSemana)} - ${formatarDataBr(fimSemana)}`;
                                            }
                                        }

                                        return (
                                            <tr key={i} className="border-b border-[#323238]/50 group h-10 hover:bg-[#202024]">
                                                <td className="px-3 text-gray-400 font-mono">{String(i + 1).padStart(2, '0')}</td>

                                                {/* Coluna de Data Visual */}
                                                <td className="px-2 text-gray-500 text-[10px]">{periodoTexto}</td>

                                                <td className="px-2 py-1">
                                                    <input value={p.series || ""} onChange={e => { const a = [...ficha.periodizacao]; a[i] = { ...a[i], series: e.target.value }; upd("periodizacao", a); }}
                                                        className="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded px-2 py-1 w-full outline-none text-center" />
                                                </td>
                                                <td className="px-2 py-1">
                                                    <TextareaComSugestoes
                                                        value={p.repeticoes || ""}
                                                        onChange={v => {
                                                            const a = [...ficha.periodizacao];
                                                            a[i] = { ...a[i], repeticoes: v };
                                                            upd("periodizacao", a);
                                                        }}
                                                        categoria="repeticoes_treino"
                                                        rows={1}
                                                        // Estilo para parecer um input de tabela (sem resize, altura fixa)
                                                        inputClassName="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded px-2 py-1 w-full outline-none text-center resize-none overflow-hidden h-[26px] leading-tight"
                                                    />
                                                </td>
                                                <td className="px-2 text-center">
                                                    <button onClick={() => upd("periodizacao", ficha.periodizacao.filter((_, idx) => idx !== i))}
                                                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"><Ico n="x" s={11} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {/* Botão de Adicionar Manual (caso queira ir além do gerado) */}
                            <button onClick={() => {
                                const atual = ficha.periodizacao || [];
                                const ultimo = atual.length > 0 ? atual[atual.length - 1] : { series: "3", repeticoes: "10" };
                                upd("periodizacao", [...atual, { semana: String(atual.length + 1).padStart(2, '0'), series: ultimo.series, repeticoes: ultimo.repeticoes }]);
                            }} className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1 transition border-t border-[#323238]/30">
                                <Ico n="plus" s={10} /> Add Semana Manual
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );

        // ── STEP 2: AERÓBICOS ──────────────────────────────────────────────────────
        if (s.id === "aerobico") return (
                        <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
                            <div className="flex flex-col gap-1 bg-[#1a1a1a] p-4 rounded-xl border border-[#323238] shadow-sm">
                                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Orientações de Aeróbicos</label>
                                <TextareaComSugestoes value={ficha.orientacoes_aerobicos} onChange={v => upd("orientacoes_aerobicos", v)} categoria="orientacoes_aerobicos" placeholder="Instruções gerais sobre o cardio do aluno..." rows={2} />
                            </div>
                            {/* MODAL DETALHES PARA AERÓBICO */}
                {detalheAerobicoIdx !== null && (
                    <DetalhesAerobico
                        aerobico={ficha.periodizacao_dos_aerobicos[detalheAerobicoIdx]}
                        onSave={updated => { const arr = [...ficha.periodizacao_dos_aerobicos]; arr[detalheAerobicoIdx] = updated; upd("periodizacao_dos_aerobicos", arr); }}
                        onClose={() => setDetalheAerobicoIdx(null)}
                    />
                )}
                <div className="rounded-xl border border-[#323238] bg-[#1a1a1a]">
                    <table className="w-full text-sm min-w-[700px]">
                        <thead>
                            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-[#323238]">
                                <th className="w-10 py-2 px-2"></th>
                                <th className="text-left py-2 px-2 w-[25%]">Exercício</th>   {/* Reduzido de 30% */}
                                <th className="text-left py-2 px-2 w-[15%]">Frequência</th>  {/* Reduzido de 20% */}
                                <th className="text-left py-2 px-2 w-[50%]">Instruções</th>  {/* Aumentado de 40% */}
                                <th className="py-2 px-2 w-[10%]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(ficha.periodizacao_dos_aerobicos || []).map((a, i) => {
                                const arrKey = "periodizacao_dos_aerobicos";
                                const set = (f, v) => {
                                    const arr = [...ficha[arrKey]];
                                    arr[i] = { ...arr[i], [f]: v };
                                    if (f === "exercicios") {
                                        const info = mapaAerob[v];
                                        if (info) {
                                            arr[i].video = info.video || "";
                                            arr[i]["plataforma_do_vídeo"] = info["plataforma_do_vídeo"] || "YouTube";

                                            // Preenche instrução automática APENAS se estiver vazio
                                            const atualInstr = (arr[i].instrucao || arr[i].instrucoes || "").trim();
                                            if (!atualInstr) {
                                                arr[i].instrucao = info.instrucao || "";
                                            }
                                        }
                                    }

                                    upd(arrKey, arr);
                                };
                                const dupe = () => { const arr = [...ficha[arrKey]]; arr.splice(i + 1, 0, { ...a, _id: uid() }); upd(arrKey, arr); };
                                return (
                                    <tr key={a._id || i}
                                        className="border-b border-[#323238] hover:bg-[#202024] transition group"
                                    >
                                        <td className="px-2 text-center w-14 align-middle">
                                            <div className="flex flex-row items-center justify-center gap-1">
                                                <div className="flex flex-col items-center">
                                                    <button onClick={() => { const arr = [...ficha.periodizacao_dos_aerobicos]; if (i === 0) return;[arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; upd("periodizacao_dos_aerobicos", arr); }} disabled={i === 0} className="text-gray-500 hover:text-white disabled:opacity-20"><Ico n="up" s={13} /></button>
                                                    <button onClick={() => { const arr = [...ficha.periodizacao_dos_aerobicos]; if (i === arr.length - 1) return;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; upd("periodizacao_dos_aerobicos", arr); }} disabled={i === ficha.periodizacao_dos_aerobicos.length - 1} className="text-gray-500 hover:text-white disabled:opacity-20"><Ico n="down" s={13} /></button>
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-500 font-mono">{i + 1}</span>
                                            </div>
                                        </td>
                                        {/* Coluna Exercício */}
                                        <td className="px-2 py-1 align-middle relative z-10">
                                            <SearchableCombo value={a.exercicios || ""} onChange={(v) => set("exercicios", v)}
                                                options={aerobs} placeholder="Buscar..." className="w-full"
                                            // Nota: O SearchableCombo já foi ajustado globalmente para h-8 no passo 1
                                            />
                                        </td>

                                        {/* Coluna Frequência */}
                                        <td className="px-2 py-1 align-middle">
                                            <TextareaComSugestoes value={a.frequencia || ""} onChange={v => set("frequencia", v)} categoria="frequencia_aerobicos" rows={1}
                                                inputClassName="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 w-full outline-none focus:border-[#850000]/60 resize-none overflow-hidden leading-tight h-8"
                                            />
                                        </td>

                                        {/* Coluna Instruções */}
                                        <td className="px-2 py-1 align-top">
                                            <TextareaExpansivel
                                                value={a.instrucao || a.instrucoes || ""}
                                                onChange={v => set("instrucao", v)}
                                                categoria="instrucoes_aerobicos"
                                                placeholder="Instruções..."
                                                resetKey={aerobicoResetKey}
                                                className="w-full"
                                            />
                                        </td>

                                        <td className="px-2 py-3 text-center align-middle">
                                            <div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition pt-1">
                                                <button
                                                    onClick={() => setDetalheAerobicoIdx(i)}
                                                    title="Detalhes (Vídeo)"
                                                    className="p-1 text-gray-500 hover:text-blue-400"
                                                >
                                                    <Ico n="info" s={16} />
                                                </button>
                                                <button
                                                    onClick={dupe}
                                                    title="Duplicar"
                                                    className="p-1 text-gray-500 hover:text-yellow-400"
                                                >
                                                    <Ico n="dupe" s={16} />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        upd(
                                                            "periodizacao_dos_aerobicos",
                                                            ficha.periodizacao_dos_aerobicos.filter((_, idx) => idx !== i)
                                                        )
                                                    }
                                                    className="p-1 text-gray-500 hover:text-red-400"
                                                >
                                                    <Ico n="trash" s={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <button onClick={() => {
                    upd("periodizacao_dos_aerobicos", [...(ficha.periodizacao_dos_aerobicos || []), { _id: uid(), exercicios: "", frequencia: "", instrucao: "" }]);
                    setAerobicoResetKey(k => k + 1);
                }}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-dashed border-[#323238] hover:border-[#850000]/50 px-4 py-2 rounded-lg transition w-full justify-center">
                    <Ico n="plus" s={14} /> Adicionar Aeróbico
                </button>
            </div>
        );

        // ── STEP 3: ALONGAMENTOS ───────────────────────────────────────────────────
        if (s.id === "alongamento") return (
                        <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
                            <div className="flex flex-col gap-1 bg-[#1a1a1a] p-4 rounded-xl border border-[#323238] shadow-sm">
                                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Orientações de Along. e Mobilidade</label>
                                <TextareaComSugestoes value={ficha.orientacoes_aem} onChange={v => upd("orientacoes_aem", v)} categoria="orientacoes_aem" placeholder="Dicas e cuidados gerais de mobilidade..." rows={2} />
                            </div>
                            {/* MODAL DETALHES PARA ALONGAMENTO */}
                {detalheAlongamentoIdx !== null && (
                    <DetalhesAlongamento
                        alongamento={ficha.planilha_de_alongamentos_e_mobilidade[detalheAlongamentoIdx]}
                        onSave={updated => { const arr = [...ficha.planilha_de_alongamentos_e_mobilidade]; arr[detalheAlongamentoIdx] = updated; upd("planilha_de_alongamentos_e_mobilidade", arr); }}
                        onClose={() => setDetalheAlongamentoIdx(null)}
                    />
                )}
                <div className="rounded-xl border border-[#323238] bg-[#1a1a1a]">
                    <table className="w-full text-sm min-w-[700px]">
                        <thead>
                            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-[#323238]">
                                <th className="w-10 py-2 px-2"></th>
                                <th className="text-left py-2 px-2 w-[35%]">Exercício</th>   {/* Reduzido de 40% */}
                                <th className="text-center py-2 px-2 w-[10%]">Séries</th>    {/* Reduzido de 15% */}
                                <th className="text-left py-2 px-2 w-[45%]">Observação</th>  {/* Aumentado de 35% */}
                                <th className="py-2 px-2 w-[10%]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(ficha.planilha_de_alongamentos_e_mobilidade || []).map((a, i) => {
                                const arrKey = "planilha_de_alongamentos_e_mobilidade";
                                const set = (f, v) => {
                                    const arr = [...ficha[arrKey]];
                                    arr[i] = { ...arr[i], [f]: v };
                                    if (f === "exercicio") {
                                        const info = mapaAlong[v];
                                        if (info) {
                                            arr[i].video = info.video || "";
                                            arr[i]["plataforma_do_vídeo"] = info["plataforma_do_vídeo"] || "YouTube";
                                        }
                                    }
                                    upd(arrKey, arr);
                                };
                                const dupe = () => { const arr = [...ficha[arrKey]]; arr.splice(i + 1, 0, { ...a, _id: uid() }); upd(arrKey, arr); };
                                return (
                                    <tr key={a._id || i}
                                        className="border-b border-[#323238] hover:bg-[#202024] transition group"
                                    >
                                        <td className="px-2 text-center w-14">
                                            <div className="flex flex-row items-center justify-center gap-1">
                                                <div className="flex flex-col items-center">
                                                    <button onClick={() => { const arr = [...ficha.planilha_de_alongamentos_e_mobilidade]; if (i === 0) return;[arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; upd("planilha_de_alongamentos_e_mobilidade", arr); }} disabled={i === 0} className="text-gray-500 hover:text-white disabled:opacity-20"><Ico n="up" s={13} /></button>
                                                    <button onClick={() => { const arr = [...ficha.planilha_de_alongamentos_e_mobilidade]; if (i === arr.length - 1) return;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; upd("planilha_de_alongamentos_e_mobilidade", arr); }} disabled={i === ficha.planilha_de_alongamentos_e_mobilidade.length - 1} className="text-gray-500 hover:text-white disabled:opacity-20"><Ico n="down" s={13} /></button>
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-500 font-mono">{i + 1}</span>
                                            </div>
                                        </td>
                                        {/* Coluna Exercício */}
                                        <td className="px-2 py-1 align-top relative z-10">
                                            <SearchableCombo value={a.exercicio || ""} onChange={(v) => set("exercicio", v)}
                                                options={alongs} placeholder="Buscar..." className="w-full"
                                            />
                                        </td>

                                        {/* Coluna Séries (Pequena e centralizada) */}
                                        <td className="px-2 py-1 align-top">
                                            <input type="number" value={a.series || ""} onChange={(e) => set("series", e.target.value)}
                                                className="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-1 w-full text-center outline-none focus:border-[#850000]/60 h-8"
                                            />
                                        </td>

                                        {/* Coluna Observações (Grande) */}
                                        <td className="px-2 py-1 align-top">
                                            <TextareaExpansivel
                                                value={a.observacoes || ""}
                                                onChange={v => set("observacoes", v)}
                                                categoria="observacoes_alongamentos"
                                                placeholder="Observações..."
                                                resetKey={alongamentoResetKey}
                                                className="w-full"
                                            />
                                        </td>

                                        <td className="px-2 py-3 text-center align-middle">
                                            <div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition pt-1">
                                                <button
                                                    onClick={() => setDetalheAlongamentoIdx(i)}
                                                    title="Detalhes (Vídeo)"
                                                    className="p-1 text-gray-500 hover:text-blue-400"
                                                >
                                                    <Ico n="info" s={16} />
                                                </button>
                                                <button
                                                    onClick={dupe}
                                                    title="Duplicar"
                                                    className="p-1 text-gray-500 hover:text-yellow-400"
                                                >
                                                    <Ico n="dupe" s={16} />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        upd(
                                                            "planilha_de_alongamentos_e_mobilidade",
                                                            ficha.planilha_de_alongamentos_e_mobilidade.filter((_, idx) => idx !== i)
                                                        )
                                                    }
                                                    className="p-1 text-gray-500 hover:text-red-400"
                                                >
                                                    <Ico n="trash" s={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <button onClick={() => upd("planilha_de_alongamentos_e_mobilidade", [...(ficha.planilha_de_alongamentos_e_mobilidade || []), { _id: uid(), exercicio: "", series: 3, observacoes: "" }])}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-dashed border-[#323238] hover:border-[#850000]/50 px-4 py-2 rounded-lg transition w-full justify-center">
                    <Ico n="plus" s={14} /> Adicionar Alongamento
                </button>
            </div>
        );

        // ── STEPS 4+: TREINOS A, B, C, D, E, F ────────────────────────────────────
        const t = s.id.replace("treino_", "");
        return (
            <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <FInput label={`Nome do Treino ${t.toUpperCase()} (opcional)`} value={ficha[`treino_${t}_label`]}
                        onChange={v => upd(`treino_${t}_label`, v)} placeholder="Ex: Inferior A, Upper..." className="md:col-span-1" />
                    <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Orientações do Treino {t.toUpperCase()}</label>
                        <TextareaComSugestoes value={ficha[`orientacoes_treino_${t}`]} onChange={v => upd(`orientacoes_treino_${t}`, v)} categoria={`orientacoes_treino_${t}`} placeholder="Instruções sobre RIR, falha, foco do dia..." rows={1} />
                    </div>
                </div>
                <TabelaExercicios key={t} exercicios={ficha[`planilha_de_treino_${t}`] || []}
                    onChange={exs => upd(`planilha_de_treino_${t}`, exs)}
                    gruposMusculares={grupos}
                    exerciciosPorGrupo={porGrupo}
                    intensidadeMap={intensMap}
                    mapaDetalhes={mapaTreinos}
                />
            </div>
        );
    };

    return (
        <div className="absolute inset-0 z-[60] bg-[#202024] flex flex-col">
            {/* CABEÇALHO */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-[#323238] bg-[#29292e] shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition"><Ico n="prev" s={20} /></button>
                    <div>
                        <h1 className="text-white font-bold text-lg">{isEdit ? "Editar Ficha" : "Nova Ficha"}</h1>
                        {ficha.nome_completo && <p className="text-gray-400 text-sm">{ficha.nome_completo}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {gerenciadorAberto && <GerenciadorTreinos ficha={ficha} upd={upd} onClose={() => setGerenciadorAberto(false)} />}
                    {erro && <p className="text-red-400 text-sm">{erro}</p>}
                    <button onClick={() => setGerenciadorAberto(true)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-[#323238] hover:border-[#850000]/50 px-4 py-2 rounded-lg transition">
                        <Ico n="copy" s={14} /> Gerenciar Treinos
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 bg-[#850000] hover:bg-red-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-50">
                        {saving ? <><Ico n="spin" s={16} /> Salvando...</> : salvo ? "✅ Salvo!" : "Salvar Ficha"}
                    </button>
                </div>
            </div>

            {/* NAVEGAÇÃO HORIZONTAL (STEPS) */}
            <div className="flex items-center gap-1 px-8 py-3 border-b border-[#323238] bg-[#29292e] overflow-x-auto shrink-0">
                {steps.map((s, i) => (
                    <button key={s.id} onClick={() => setStep(i)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${i === step ? "bg-[#850000] text-white shadow-lg shadow-red-900/20" : "text-gray-400 hover:text-white hover:bg-[#323238]"}`}>
                        <span className="text-xs mr-1.5 opacity-40">{i + 1}</span>{s.label}
                    </button>
                ))}
            </div>

            {/* CONTEÚDO DO STEP */}
            <div className="flex-1 overflow-y-auto px-8 py-6">{renderStep()}</div>

            {/* BOTÕES ANTERIOR / PRÓXIMO */}
            <div className="shrink-0 flex justify-between items-center px-8 py-3 bg-[#202024] border-t border-[#323238]">
                <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition">
                    <Ico n="prev" s={16} /> Anterior
                </button>
                <span className="text-gray-600 text-xs">{step + 1} / {steps.length}</span>
                <button onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))} disabled={step === steps.length - 1}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition">
                    Próximo <Ico n="next" s={16} />
                </button>
            </div>

            {/* BANNER FIXO DE CONTEXTO VITAL INJETADO AQUI */}
            {ficha.aluno && <BannerOrientacoes alunoId={ficha.aluno} />}

            {/* RODAPÉ DE VOLUME */}
            <RodapeVolume ficha={ficha} intensidadeMap={intensMap} volumeAnterior={volumeAnterior} />
        </div>
    );
};

const GRUPOS_MUSCULARES_LISTA = [
    "Quadríceps", "Isquiotibiais", "Glúteo Máximo", "Glúteo Médio",
    "Adutores", "Panturrilhas", "Costas", "Trapézio", "Peitoral",
    "Deltóides Anterior", "Deltóides Lateral", "Deltóides Posterior",
    "Bíceps", "Tríceps", "Abdômen"
];

const ModalExercicio = ({ open, onClose, exercicioId, onSalvo }) => {
    const vazio = {
        nome_do_exercicio: "",
        grupo_muscular: "",
        enabled: 1,
        video: "",
        "plataforma_do_vídeo": "YouTube",
        intensidade: []
    };

    const [form, setForm] = useState(vazio);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [erro, setErro] = useState("");

    // Carrega detalhe se for edição
    useEffect(() => {
        if (!open) return;
        if (!exercicioId) { setForm(vazio); return; }

        setLoading(true);
        const fns = getFunctions();
        const fn = httpsCallable(fns, "buscarExercicioDetalhe");
        fn({ id: exercicioId })
            .then(res => {
                const d = res.data?.data || {};
                // Usa o array `intensidade` (child table do Frappe)
                const intens = Array.isArray(d.intensidade)
                    ? d.intensidade.map(i => ({ grupo_muscular: i.grupo_muscular, intensidade: i.intensidade }))
                    : [];
                setForm({
                    nome_do_exercicio: d.nome_do_exercicio || "",
                    grupo_muscular: d.grupo_muscular || "",
                    enabled: d.enabled ?? 1,
                    video: d.video || "",
                    "plataforma_do_vídeo": d["plataforma_do_vídeo"] || "YouTube",
                    intensidade: intens
                });
            })
            .catch(e => setErro(e.message))
            .finally(() => setLoading(false));
    }, [open, exercicioId]);

    const upd = (field, val) => setForm(f => ({ ...f, [field]: val }));

    // Intensidade helpers
    const addIntens = () => setForm(f => ({
        ...f,
        intensidade: [...f.intensidade, { grupo_muscular: "", intensidade: "1" }]
    }));

    const updIntens = (i, field, val) => setForm(f => {
        const arr = [...f.intensidade];
        arr[i] = { ...arr[i], [field]: val };
        return { ...f, intensidade: arr };
    });

    const removeIntens = (i) => setForm(f => ({
        ...f,
        intensidade: f.intensidade.filter((_, idx) => idx !== i)
    }));

    const salvar = async () => {
        if (!form.nome_do_exercicio.trim()) { setErro("Nome obrigatório."); return; }
        setSaving(true); setErro("");
        try {
            const fns = getFunctions();
            const fn = httpsCallable(fns, "salvarExercicio");
            const res = await fn({ id: exercicioId || null, exercicio: form });
            if (res.data?.success) {
                onSalvo(res.data.data);
                onClose();
            } else {
                setErro("Erro ao salvar.");
            }
        } catch (e) {
            setErro(e.message || "Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className="relative bg-[#29292e] border border-[#323238] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#323238] shrink-0">
                    <h2 className="text-white font-bold text-base">
                        {exercicioId ? "Editar Exercício" : "Novo Exercício"}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#323238] transition">
                        <Ico n="x" s={16} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Ico n="spin" s={24} /></div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">

                        {/* Nome */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400 font-medium">Nome do Exercício <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={form.nome_do_exercicio}
                                onChange={e => upd("nome_do_exercicio", e.target.value)}
                                placeholder="Ex: Leg Press 45°"
                                className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#850000]/60 transition placeholder-gray-600"
                            />
                        </div>

                        {/* Grupo Muscular Principal */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400 font-medium">Grupo Muscular Principal</label>
                            <select
                                value={form.grupo_muscular}
                                onChange={e => upd("grupo_muscular", e.target.value)}
                                className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#850000]/60 appearance-none"
                            >
                                <option value="">Selecionar...</option>
                                {GRUPOS_MUSCULARES_LISTA.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>

                        {/* Vídeo */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400 font-medium">ID do Vídeo</label>
                                <input
                                    type="text"
                                    value={form.video}
                                    onChange={e => upd("video", e.target.value)}
                                    placeholder="Ex: dQw4w9WgXcQ"
                                    className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#850000]/60 transition placeholder-gray-600"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400 font-medium">Plataforma</label>
                                <select
                                    value={form["plataforma_do_vídeo"]}
                                    onChange={e => upd("plataforma_do_vídeo", e.target.value)}
                                    className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#850000]/60 appearance-none"
                                >
                                    <option value="YouTube">YouTube</option>
                                    <option value="Instagram">Instagram</option>
                                    <option value="TikTok">TikTok</option>
                                </select>
                            </div>
                        </div>

                        {/* Ativo/Inativo */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => upd("enabled", form.enabled ? 0 : 1)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${form.enabled ? "bg-[#850000]" : "bg-[#323238]"}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.enabled ? "left-5" : "left-0.5"}`} />
                            </button>
                            <span className="text-xs text-gray-400">{form.enabled ? "Exercício ativo" : "Exercício inativo"}</span>
                        </div>

                        {/* Intensidade por Grupo Muscular */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Intensidade por Grupo Muscular</label>
                                <button
                                    onClick={addIntens}
                                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white border border-[#323238] hover:border-[#850000]/40 px-2 py-1 rounded-lg transition"
                                >
                                    <Ico n="plus" s={11} /> Adicionar
                                </button>
                            </div>

                            <p className="text-[10px] text-gray-600">
                                Define o quanto cada grupo muscular é recrutado. Use 1 para primário, 0.5 para secundário.
                            </p>

                            {form.intensidade.length === 0 ? (
                                <p className="text-gray-600 text-xs text-center py-3 border border-dashed border-[#323238] rounded-lg">
                                    Nenhuma intensidade configurada — o volume não será calculado.
                                </p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {form.intensidade.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <select
                                                value={item.grupo_muscular}
                                                onChange={e => updIntens(i, "grupo_muscular", e.target.value)}
                                                className="flex-1 bg-[#1a1a1a] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-2 outline-none focus:border-[#850000]/60 appearance-none"
                                            >
                                                <option value="">Grupo muscular...</option>
                                                {GRUPOS_MUSCULARES_LISTA.map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                            <input
                                                type="text"
                                                value={item.intensidade}
                                                onChange={e => updIntens(i, "intensidade", e.target.value)}
                                                placeholder="Ex: 1"
                                                className="w-20 bg-[#1a1a1a] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-2 outline-none focus:border-[#850000]/60 text-center"
                                            />
                                            <button
                                                onClick={() => removeIntens(i)}
                                                className="text-gray-600 hover:text-red-400 p-1 transition"
                                            >
                                                <Ico n="x" s={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {erro && (
                            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                {erro}
                            </p>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#323238] flex gap-2 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 text-sm text-gray-400 hover:text-white border border-[#323238] rounded-lg transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={salvar}
                        disabled={saving}
                        className="flex-1 py-2 text-sm bg-[#850000] hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <><Ico n="spin" s={14} /> Salvando...</> : "Salvar Exercício"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const GerenciarExercicios = ({ open, onClose, onSalvar }) => {
    const [exercicios, setExercicios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [modalEx, setModalEx] = useState({ open: false, id: null });
    const [excluindoId, setExcluindoId] = useState(null);
    const [desabilitados, setDesabilitados] = useState({}); // { "nome_exercicio": true }
    const [busca, setBusca] = useState("");
    const [filtroGrupo, setFiltroGrupo] = useState("");
    const [grupos, setGrupos] = useState([]);

    // Carrega exercícios e blacklist ao abrir
    useEffect(() => {
        if (!open) return;
        const carregar = async () => {
            setLoading(true);
            try {
                const res = await buscarExerciciosFn({});
                const lista = res.data?.list || [];
                setExercicios(lista);
                const gs = [...new Set(lista.map(e => e.grupo_muscular).filter(Boolean))].sort();
                setGrupos(gs);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
            // Carrega blacklist em background sem bloquear
            try {
                const snap = await getDocs(collection(db, "exercicios_desabilitados")).catch(() => ({ docs: [] }));
                const map = {};
                snap.docs.forEach(d => { map[d.id] = true; });
                setDesabilitados(map);
            } catch (e) { console.error(e); }
        };
        carregar();
    }, [open]);

    const excluirEx = async (ex) => {
        if (!window.confirm(`Excluir "${ex.nome_do_exercicio}"? Esta ação não pode ser desfeita.`)) return;
        setExcluindoId(ex.name);
        try {
            const fns = getFunctions();
            const fn = httpsCallable(fns, "excluirExercicio");
            await fn({ id: ex.name });
            setExercicios(prev => prev.filter(e => e.name !== ex.name));
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        } finally {
            setExcluindoId(null);
        }
    };

    // Toggle individual
    const toggle = (nome) => {
        setDesabilitados(prev => ({
            ...prev,
            [nome]: !prev[nome]
        }));
    };

    // Selecionar/Desselecionar todos visíveis
    const toggleTodos = (valor) => {
        const visiveis = exerciciosFiltrados.map(e => e.nome_do_exercicio);
        setDesabilitados(prev => {
            const novo = { ...prev };
            visiveis.forEach(nome => {
                if (valor) novo[nome] = true;
                else delete novo[nome];
            });
            return novo;
        });
    };

    // Salva no Firestore
    const salvar = async () => {
        setSalvando(true);
        try {
            const batch = writeBatch(db);

            // Apaga todos os desabilitados existentes
            const snap = await getDocs(collection(db, "exercicios_desabilitados"));
            snap.docs.forEach(d => batch.delete(d.ref));

            // Recria com os atuais
            Object.entries(desabilitados).forEach(([nome, desab]) => {
                if (desab) {
                    batch.set(doc(db, "exercicios_desabilitados", nome), {
                        nome,
                        desabilitadoEm: new Date().toISOString()
                    });
                }
            });

            await batch.commit();
            onSalvar(desabilitados);
            onClose();
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSalvando(false);
        }
    };

    const exerciciosFiltrados = exercicios.filter(e => {
        if (filtroGrupo && e.grupo_muscular !== filtroGrupo) return false;
        if (busca && !normalizar(e.nome_do_exercicio).includes(normalizar(busca))) return false;
        return true;
    });

    const exerciciosVisiveis = exerciciosFiltrados.slice(0, 100);

    const totalDesabilitados = Object.values(desabilitados).filter(Boolean).length;
    const totalVisiveis = exerciciosFiltrados.filter(e => !desabilitados[e.nome_do_exercicio]).length;

    if (!open) return null;

    return (
        <>
            <ModalExercicio
                open={modalEx.open}
                exercicioId={modalEx.id}
                onClose={() => setModalEx({ open: false, id: null })}
                onSalvo={(novo) => {
                    if (modalEx.id) {
                        setExercicios(prev => prev.map(e => e.name === modalEx.id ? { ...e, ...novo } : e));
                    } else {
                        setExercicios(prev => [{ ...novo }, ...prev]);
                    }
                    setModalEx({ open: false, id: null });
                }}
            />
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                <div
                    className="relative bg-[#29292e] border border-[#323238] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[#323238] shrink-0">
                        <div>
                            <h2 className="text-white font-bold text-lg">Gerenciar Exercícios</h2>
                            <p className="text-gray-500 text-xs mt-0.5">
                                {totalDesabilitados > 0
                                    ? `${totalDesabilitados} exercício${totalDesabilitados !== 1 ? 's' : ''} oculto${totalDesabilitados !== 1 ? 's' : ''}`
                                    : "Todos os exercícios visíveis"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setModalEx({ open: true, id: null })}
                                className="flex items-center gap-1.5 text-sm bg-[#850000] hover:bg-red-700 text-white font-semibold px-4 py-1.5 rounded-lg transition"
                            >
                                <Ico n="plus" s={14} /> Novo
                            </button>
                            <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#323238] transition">
                                <Ico n="x" s={18} />
                            </button>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="px-6 py-3 border-b border-[#323238] flex gap-3 shrink-0 flex-wrap">
                        <div className="relative flex-1 min-w-48">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                                <Ico n="search" s={14} />
                            </span>
                            <input
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                                placeholder="Buscar exercício..."
                                className="w-full bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg pl-9 pr-4 py-2 outline-none focus:border-[#850000]/60 placeholder-gray-600"
                            />
                        </div>
                        <select
                            value={filtroGrupo}
                            onChange={e => setFiltroGrupo(e.target.value)}
                            className="bg-[#1a1a1a] border border-[#323238] text-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#850000]/60 appearance-none min-w-40"
                        >
                            <option value="">Todos os grupos</option>
                            {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    {/* Ações em lote */}
                    <div className="px-6 py-2 border-b border-[#323238]/50 flex items-center justify-between shrink-0">
                        <span className="text-gray-500 text-xs">
                            {exerciciosFiltrados.length} exercício{exerciciosFiltrados.length !== 1 ? 's' : ''} encontrado{exerciciosFiltrados.length !== 1 ? 's' : ''}
                            {' · '}{totalVisiveis} visível{totalVisiveis !== 1 ? 'is' : ''}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => toggleTodos(false)}
                                className="text-xs px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition font-semibold"
                            >
                                Ativar todos
                            </button>
                            <button
                                onClick={() => toggleTodos(true)}
                                className="text-xs px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition font-semibold"
                            >
                                Ocultar todos
                            </button>
                        </div>
                    </div>

                    {/* Lista */}
                    <div className="flex-1 overflow-y-auto px-6 py-3">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Ico n="spin" s={24} />
                            </div>
                        ) : exerciciosFiltrados.length === 0 ? (
                            <p className="text-gray-500 text-center py-8 text-sm">Nenhum exercício encontrado.</p>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {exerciciosVisiveis.map(ex => {
                                    {exerciciosFiltrados.length > 100 && (
                                        <p className="text-center text-gray-600 text-xs py-3">
                                            Mostrando 100 de {exerciciosFiltrados.length}. Use a busca para filtrar.
                                        </p>
                                    )}
                                    const desabilitado = !!desabilitados[ex.nome_do_exercicio];
                                    return (
                                        <div
                                            key={ex.nome_do_exercicio}
                                            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition group ${desabilitado
                                                ? "bg-[#1a1a1a] border-[#323238] opacity-50"
                                                : "bg-[#202024] border-[#323238] hover:border-[#850000]/40"
                                                }`}
                                        >
                                            {/* Toggle + Nome */}
                                            <div
                                                className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                                                onClick={() => toggle(ex.nome_do_exercicio)}
                                            >
                                                <div className={`w-9 h-5 rounded-full transition-colors shrink-0 relative ${desabilitado ? "bg-[#323238]" : "bg-[#850000]"}`}>
                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${desabilitado ? "left-0.5" : "left-4"}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-medium truncate ${desabilitado ? "text-gray-600 line-through" : "text-gray-200"}`}>
                                                        {ex.nome_do_exercicio}
                                                    </p>
                                                    <p className="text-[10px] text-gray-600 mt-0.5">{ex.grupo_muscular || "Sem grupo"}</p>
                                                </div>
                                            </div>

                                            {/* Ações */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${desabilitado ? "text-gray-600" : "text-green-500/70"}`}>
                                                    {desabilitado ? "Oculto" : "Visível"}
                                                </span>
                                                {ex.owner === "arteamconsultoria@gmail.com" && (
                                                    <>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); setModalEx({ open: true, id: ex.name }); }}
                                                            className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-[#323238] rounded-lg transition"
                                                            title="Editar"
                                                        >
                                                            <Ico n="edit" s={13} />
                                                        </button>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); excluirEx(ex); }}
                                                            disabled={excluindoId === ex.name}
                                                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-[#323238] rounded-lg transition disabled:opacity-40"
                                                            title="Excluir"
                                                        >
                                                            {excluindoId === ex.name ? <Ico n="spin" s={13} /> : <Ico n="trash" s={13} />}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-[#323238] flex justify-between items-center shrink-0">
                        <p className="text-gray-600 text-xs">
                            Alterações afetam apenas a montagem de fichas.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#323238] rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={salvar}
                                disabled={salvando}
                                className="px-5 py-2 text-sm bg-[#850000] hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {salvando ? <><Ico n="spin" s={14} /> Salvando...</> : "Salvar"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

// ─── LISTA DE FICHAS (tela principal) ─────────────────────────────────────────
export default function Fichas({ initialFichaId = null }) {
    const [fichas, setFichas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false); // Spinner do botão Carregar Mais

    // Filtros e Paginação
    const [busca, setBusca] = useState("");
    const [filtroNivel, setFiltroNivel] = useState("");
    const [filtroStatus, setFiltroStatus] = useState(""); // Esse continua local (calculado)
    const [filtroLetras, setFiltroLetras] = useState([]);      // 👈 NOVO
    const [filtroTotalDias, setFiltroTotalDias] = useState(""); // 👈 NOVO
    const [letraSel, setLetraSel] = useState("");               // 👈 NOVO
    const [filtroModalAberto, setFiltroModalAberto] = useState(false);
    const [filtroSexo, setFiltroSexo] = useState("");
    const [filtroDataInicioFrom, setFiltroDataInicioFrom] = useState("");
    const [filtroDataInicioTo, setFiltroDataInicioTo] = useState("");
    const [filtroDataFimFrom, setFiltroDataFimFrom] = useState("");
    const [filtroDataFimTo, setFiltroDataFimTo] = useState("");

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // ... outros estados (duplicarState, excluirState, etc...) mantidos iguais ...
    const [duplicarState, setDuplicarState] = useState({ open: false, ficha: null });
    const [excluirState, setExcluirState] = useState({ open: false, ficha: null });
    const [vizId, setVizId] = useState(null);
    const [historicoAluno, setHistoricoAluno] = useState(null); // { id, nome }
    const [historicoAba, setHistoricoAba] = useState("fichas");
    const [historicoVolumes, setHistoricoVolumes] = useState({});
    const [historicoLoading, setHistoricoLoading] = useState(false);
    const [historicoFichasDoAluno, setHistoricoFichasDoAluno] = useState([]);
    const [historicoLoadingFichas, setHistoricoLoadingFichas] = useState(false);
    const [vizNome, setVizNome] = useState("");
    const [editarFicha, setEditarFicha] = useState(null);
    const [fichaInicial, setFichaInicial] = useState(initialFichaId);
    const [intensMapGlobal, setIntensMapGlobal] = useState({});
    const [exerciciosDesabilitados, setExerciciosDesabilitados] = useState({});
    const [gerenciarExOpen, setGerenciarExOpen] = useState(false);
    const [abrirNova, setAbrirNova] = useState(false);

    // Reabre ficha salva ao recarregar página
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const fichaIdUrl = urlParams.get("fichaId");
        const idParaAbrir = initialFichaId || fichaIdUrl || getLocalStorageComExpiracao("fichaEditandoId");
        if (idParaAbrir) {
            buscarFichaDetalheFn({ id: idParaAbrir })
                .then(r => { if (r.data?.data) setEditarFicha(r.data.data); })
                .catch(() => localStorage.removeItem("fichaEditandoId"));
        }
    }, [initialFichaId]);

    // Carrega intensidadeMap global para cálculo de volume no histórico
    useEffect(() => {
        buscarExerciciosFn({}).then(r => {
            const lista = r.data?.list || [];
            const mapI = {};
            lista.forEach(e => {
                try {
                    const intensidades = typeof e.intensidade_json === "string"
                        ? JSON.parse(e.intensidade_json)
                        : (e.intensidade_json || []);
                    mapI[e.nome_do_exercicio] = intensidades;
                } catch { }
            });
            setIntensMapGlobal(mapI);
        }).catch(console.error);
        // Carrega blacklist de exercícios desabilitados
        getDocs(collection(db, "exercicios_desabilitados"))
            .then(snap => {
                const map = {};
                snap.docs.forEach(d => { map[d.id] = true; });
                setExerciciosDesabilitados(map);
            })
            .catch(console.error);
    }, []);
    // FUNÇÃO PRINCIPAL DE BUSCA (Paginada)
    const carregar = useCallback(async (pagina = 1) => {
        if (pagina === 1) setLoading(true);
        else setLoadingMore(true);

        try {
            const temFiltroAtivo = filtroLetras.length > 0 || filtroTotalDias || filtroSexo || filtroStatus || filtroDataInicioFrom || filtroDataInicioTo || filtroDataFimFrom || filtroDataFimTo;
            const res = await buscarFichasFn({
                page: pagina,
                limit: temFiltroAtivo ? 300 : 50,
                aluno: busca,
                nivel: filtroNivel
            });

            const lista = res.data?.list || [];
            const listaOrdenada = lista.sort((a, b) => new Date(b.creation).getTime() - new Date(a.creation).getTime());
            setFichas(prev => pagina === 1 ? listaOrdenada : [...prev, ...listaOrdenada]);
            setHasMore(lista.length === 50);
            setPage(pagina);
        } catch (e) {
            console.error("Erro ao carregar:", e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [busca, filtroNivel, filtroLetras, filtroTotalDias, filtroSexo, filtroStatus, filtroDataInicioFrom, filtroDataInicioTo, filtroDataFimFrom, filtroDataFimTo]);

    // Efeito para recarregar quando muda o filtro de busca ou nível (Reseta para pág 1)
    useEffect(() => {
        // Debounce simples para não buscar a cada letra digitada instantaneamente
        const timeout = setTimeout(() => {
            carregar(1);
        }, 500);
        return () => clearTimeout(timeout);
    }, [busca, filtroNivel, filtroDataInicioFrom, filtroDataInicioTo, filtroDataFimFrom, filtroDataFimTo, carregar]);

    // Filtros Locais (Status e Estrutura são calculados no front, então filtramos o que já foi baixado)
    const fichasVisiveis = fichas.filter(f => {
        // Se há busca por nome, ignora todos os filtros
        if (busca.trim()) return true;

        if (filtroStatus && statusFicha(f) !== filtroStatus) return false;
        if (filtroSexo && f.sexo !== filtroSexo) return false;
        const estrutura = f.estrutura_calculada || "";
        if (filtroTotalDias && estrutura.length !== parseInt(filtroTotalDias)) return false;
        if (filtroLetras.length > 0) {
            // Verifica cada letra com a frequência exata
            for (const { letra, freq } of filtroLetras) {
                const count = estrutura.split("").filter(l => l === letra).length;
                if (count !== freq) return false;
            }
            // Verifica que não existem outras letras além das selecionadas
            const letrasPermitidas = filtroLetras.map(f => f.letra);
            const temLetraExtra = estrutura.split("").some(l => !letrasPermitidas.includes(l));
            if (temLetraExtra) return false;
            // Verifica tamanho total exato
            const totalEsperado = filtroLetras.reduce((sum, f) => sum + f.freq, 0);
            if (estrutura.length !== totalEsperado) return false;
        }
        if (filtroDataInicioFrom) {
            if (!f.data_de_inicio || f.data_de_inicio < filtroDataInicioFrom) return false;
        }
        if (filtroDataInicioTo) {
            if (!f.data_de_inicio || f.data_de_inicio > filtroDataInicioTo) return false;
        }
        if (filtroDataFimFrom) {
            if (!f.data_de_fim || f.data_de_fim < filtroDataFimFrom) return false;
        }
        if (filtroDataFimTo) {
            if (!f.data_de_fim || f.data_de_fim > filtroDataFimTo) return false;
        }
        return true;
    });

    const executarDuplicacao = async (novoAlunoId, novoAlunoNome) => {
        const fichaOrigem = duplicarState.ficha;
        try {
            // 1. Busca os dados COMPLETOS (para garantir que temos todos os exercícios)
            const res = await buscarFichaDetalheFn({ id: fichaOrigem.name });
            const dadosCompletos = res.data?.data || fichaOrigem;

            // 2. Prepara o objeto para a NOVA ficha (Deep Clone)
            // Removemos 'name', 'modified', 'creation' para o Frappe criar novos.
            const { name, modified, creation, modified_by, owner, docstatus, ...resto } = dadosCompletos;

            // 3. Função para gerar novos IDs nos itens internos (importante para o React não se perder nas keys)
            const renovarIds = (lista) => (lista || []).map(item => ({ ...item, _id: uid() }));

            const novaFichaObj = {
                ...resto,
                aluno: novoAlunoId,
                nome_completo: novoAlunoNome,
                // Mantemos as datas conforme você pediu ("puxar tudo")
                data_de_inicio: dadosCompletos.data_de_inicio,
                data_de_fim: dadosCompletos.data_de_fim,
                // Renova IDs internos das tabelas
                periodizacao: renovarIds(dadosCompletos.periodizacao),
                periodizacao_dos_aerobicos: renovarIds(dadosCompletos.periodizacao_dos_aerobicos),
                planilha_de_alongamentos_e_mobilidade: renovarIds(dadosCompletos.planilha_de_alongamentos_e_mobilidade),
                planilha_de_treino_a: renovarIds(dadosCompletos.planilha_de_treino_a),
                planilha_de_treino_b: renovarIds(dadosCompletos.planilha_de_treino_b),
                planilha_de_treino_c: renovarIds(dadosCompletos.planilha_de_treino_c),
                planilha_de_treino_d: renovarIds(dadosCompletos.planilha_de_treino_d),
                planilha_de_treino_e: renovarIds(dadosCompletos.planilha_de_treino_e),
                planilha_de_treino_f: renovarIds(dadosCompletos.planilha_de_treino_f),
            };

            // 4. Salva como uma NOVA ficha
            const saveRes = await salvarFichaFn({ ficha: novaFichaObj });

            if (saveRes.data?.success) {
                setDuplicarState({ open: false, ficha: null });
                await carregar(1);
                alert(`✅ Ficha duplicada com sucesso para ${novoAlunoNome}!`);

                // Opcional: Se quiser já abrir a ficha nova para edição, descomente abaixo:
                // const novaSalva = saveRes.data.data;
                // localStorage.setItem("fichaEditandoId", novaSalva.name);
                // setEditarFicha(novaSalva);
            } else {
                alert("Erro ao salvar a cópia da ficha.");
            }

        } catch (e) {
            console.error(e);
            alert("Erro ao duplicar: " + e.message);
        }
    };

    const executarExclusao = async (fichaParaExcluir) => {
        try {
            // Chama a Cloud Function que deleta no Frappe
            await excluirFichaFn({ id: fichaParaExcluir.name });

            // Se der certo, remove da lista local
            setFichas(prev => prev.filter(f => f.name !== fichaParaExcluir.name));
            setExcluirState({ open: false, ficha: null });
            alert("✅ Ficha excluída com sucesso!");
        } catch (e) {
            console.error("Erro ao excluir:", e);
            alert("Erro ao excluir: " + e.message);
        }
    };

    const handleEditar = async (f, novaGuia = false) => {
        if (novaGuia) {
            const url = new URL(window.location.href);
            url.searchParams.set("fichaId", f.name);
            window.open(url.toString(), "_blank");
            return;
        }
        try {
            const res = await buscarFichaDetalheFn({ id: f.name });
            const dados = res.data?.data || f;
            setLocalStorageComExpiracao("fichaEditandoId", dados.name || f.name);
            setEditarFicha(dados);
        } catch (e) {
            console.error(e);
            setEditarFicha(f);
        }
    };

    // A função antiga chamava direto o backend. A nova só abre o modal.
    const handleDuplicar = (f) => {
        setDuplicarState({ open: true, ficha: f });
    };

    // 👇 ADICIONE O HANDLE AQUI (Logo após o handleDuplicar)
    const handleExcluir = (f) => {
        setExcluirState({ open: true, ficha: f });
    };

    // Abre o formulário de edição ou criação
    if (editarFicha || abrirNova) {
        return (
            <FormularioFicha
                fichaInicial={editarFicha}
                exerciciosDesabilitados={exerciciosDesabilitados}  // ← ADICIONE
                onClose={() => { localStorage.removeItem("fichaStep"); removeLocalStorageComExpiracao("fichaEditandoId"); setEditarFicha(null); setAbrirNova(false); }}
                onSave={(dadosSalvos) => { if (dadosSalvos) { setLocalStorageComExpiracao("fichaEditandoId", dadosSalvos.name); setEditarFicha(dadosSalvos); } carregar(); }}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#202024] text-white">
            {/* CABEÇALHO DA LISTA */}
            <div className="px-8 pt-8 pb-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Fichas de Treino</h1>
                        <p className="text-gray-400 text-sm mt-0.5">
                            {loading ? "Carregando..." : `${fichas.length} fichas cadastradas`}
                        </p>
                    </div>
                    <button
                        onClick={() => setGerenciarExOpen(true)}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-[#323238] hover:border-[#850000]/40 px-4 py-2.5 rounded-lg transition"
                    >
                        <Ico n="edit" s={14} /> Gerenciar Exercícios
                    </button>
                    <button onClick={() => setAbrirNova(true)}
                        className="flex items-center gap-2 bg-[#850000] hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-lg shadow-red-900/20">
                        <Ico n="plus" s={16} /> Nova Ficha
                    </button>
                </div>

                {/* FILTROS */}
                <div className="flex gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-52">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><Ico n="search" s={14} /></span>
                        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por aluno..."
                            className="w-full bg-[#29292e] border border-[#323238] text-gray-200 text-sm rounded-lg pl-9 pr-4 py-2.5 outline-none focus:border-[#850000]/60 placeholder-gray-600" />
                    </div>
                    {(() => {
                        const total = [filtroNivel, filtroStatus, filtroTotalDias, filtroSexo].filter(Boolean).length + filtroLetras.length;
                        return (
                            <button onClick={() => setFiltroModalAberto(true)}
                                className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border transition ${total > 0 ? "bg-[#850000]/20 border-[#850000]/50 text-red-400" : "bg-[#29292e] border-[#323238] text-gray-300 hover:text-white"}`}>
                                <Ico n="search" s={14} />
                                Filtros {total > 0 && <span className="bg-[#850000] text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{total}</span>}
                            </button>
                        );
                    })()}
                    {(busca || filtroNivel || filtroStatus || filtroLetras.length > 0 || filtroTotalDias || filtroSexo) && (
                        <button onClick={() => {
                            setBusca(""); setFiltroNivel(""); setFiltroStatus(""); setFiltroLetras([]);
                            setFiltroTotalDias(""); setFiltroSexo(""); setFiltroModalAberto(false);
                            setFiltroDataInicioFrom(""); setFiltroDataInicioTo("");
                            setFiltroDataFimFrom(""); setFiltroDataFimTo("");
                        }}
                            className="text-gray-400 hover:text-white text-sm px-3 py-2.5 rounded-lg border border-[#323238] hover:border-[#850000]/40 transition">
                            Limpar
                        </button>
                    )}
                </div>
            </div>

            {/* TABELA */}
            <div className="px-8 pb-8">
                <div className="bg-[#29292e] border border-[#323238] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[950px]">
                            <thead>
                                <tr className="bg-[#1a1a1a] text-gray-400 text-xs border-b border-[#323238] uppercase tracking-wide">
                                    <th className="text-left py-3.5 px-5 font-semibold">Aluno</th>
                                    <th className="text-left py-3.5 px-4 font-semibold">Objetivo</th>
                                    <th className="text-left py-3.5 px-4 font-semibold">Nível</th>
                                    <th className="text-left py-3.5 px-4 font-semibold">Estrutura</th>
                                    <th className="text-left py-3.5 px-4 font-semibold">Período</th>
                                    <th className="text-left py-3.5 px-4 font-semibold">Status</th>
                                    <th className="py-3.5 px-4 w-28"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Loading Inicial (Página 1) */}
                                {loading && page === 1 ? (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center text-gray-500">
                                            <span className="flex items-center justify-center gap-2">
                                                <Ico n="spin" s={18} /> Carregando fichas...
                                            </span>
                                        </td>
                                    </tr>
                                ) : fichasVisiveis.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center text-gray-500">
                                            Nenhuma ficha encontrada
                                        </td>
                                    </tr>
                                ) : (
                                    (() => {
                                        const fichasOrdenadas = [...fichasVisiveis]
                                            .sort((a, b) => new Date(b.creation).getTime() - new Date(a.creation).getTime())
                                        const alunosComMultiplasFichas = fichasOrdenadas.reduce((acc, f) => {
                                            acc[f.aluno] = (acc[f.aluno] || 0) + 1;
                                            return acc;
                                        }, {});
                                        return fichasOrdenadas.map(f => {
                                            const status = statusFicha(f);
                                            const isRenovado = alunosComMultiplasFichas[f.aluno] > 1;
                                            const fichasMesmoAluno = fichasOrdenadas.filter(x => x.aluno === f.aluno);
                                            const isMaisRecente = isRenovado && new Date(f.creation).getTime() === Math.max(...fichasMesmoAluno.map(x => new Date(x.creation).getTime()));
                                            return (
                                                <tr key={f.name} className="border-t border-[#323238]/60 hover:bg-[#1a1a1a]/50 transition group">
                                                    {/* Coluna Nome */}
                                                    <td className="py-3.5 px-5">
                                                        <button onClick={(e) => handleEditar(f, e.metaKey || e.ctrlKey)} title="⌘+Clique para abrir em nova aba" className="text-white font-medium text-sm hover:text-red-400 transition text-left">
                                                            {f.nome_completo || "—"}
                                                            {isMaisRecente && (
                                                                <span className="ml-2 text-[9px] font-semibold text-emerald-500/70 uppercase tracking-wider">● renovado</span>
                                                            )}
                                                        </button>
                                                        {f.creation && (
                                                            <p className="text-gray-600 text-[10px] mt-0.5">
                                                                criado em: {new Date(f.creation).toLocaleDateString('pt-BR')}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-gray-300 text-sm">{f.objetivo || "—"}</td>
                                                    <td className="py-3.5 px-4">
                                                        {f.nivel ? <Badge color={f.nivel === "Avançado" ? "red" : f.nivel === "Intermediário" ? "yellow" : "blue"}>{f.nivel}</Badge> : "—"}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className="font-mono text-sm font-bold text-gray-200 tracking-widest">
                                                            {f.estrutura_calculada || "—"}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-gray-400 text-xs">
                                                        {f.data_de_inicio
                                                            ? `${f.data_de_inicio.split("-").reverse().join("/")} → ${f.data_de_fim ? f.data_de_fim.split("-").reverse().join("/") : "..."}`
                                                            : "—"}
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <Badge color={status === "ativo" ? "green" : status === "vencendo" ? "yellow" : "gray"}>
                                                            {status === "ativo" ? "Ativo" : status === "vencendo" ? "Vence em breve" : "Concluído"}
                                                        </Badge>
                                                    </td>
                                                    {/* Coluna Ações */}
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                                            <button onClick={() => { setVizId(f.name); setVizNome(f.nome_completo); }} title="Visualizar"
                                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#323238] rounded-lg transition">
                                                                <Ico n="eye" s={15} />
                                                            </button>
                                                            <button onClick={() => setHistoricoAluno({ id: f.aluno, nome: f.nome_completo })} title="Histórico de fichas"
                                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#323238] rounded-lg transition">
                                                                <Ico n="chart" s={15} />
                                                            </button>
                                                            <button onClick={() => handleDuplicar(f)} title="Duplicar"
                                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#323238] rounded-lg transition">
                                                                <Ico n="copy" s={15} />
                                                            </button>
                                                            <button onClick={() => handleEditar(f)} title="Editar"
                                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-[#323238] rounded-lg transition">
                                                                <Ico n="edit" s={15} />
                                                            </button>
                                                            <button onClick={() => handleExcluir(f)} title="Excluir"
                                                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#323238] rounded-lg transition ml-1">
                                                                <Ico n="trash" s={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* BOTÃO CARREGAR MAIS (Dentro da caixa arredondada, no rodapé) */}
                    {!loading && hasMore && (
                        <div className="border-t border-[#323238] p-2 bg-[#252529]">
                            <button
                                onClick={() => carregar(page + 1)}
                                disabled={loadingMore}
                                className="w-full py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-[#323238] rounded-lg transition flex items-center justify-center gap-2"
                            >
                                {loadingMore ? <><Ico n="spin" s={12} /> Carregando...</> : "Carregar mais fichas"}
                            </button>
                        </div>
                    )}

                </div>

                {/* Contador no rodapé */}
                {!loading && (
                    <p className="text-gray-600 text-xs text-center mt-4">
                        Exibindo {fichasVisiveis.length} ficha{fichasVisiveis.length !== 1 ? "s" : ""}
                    </p>
                )}
            </div>
            {/* MODAL DE FILTROS */}
            {filtroModalAberto && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setFiltroModalAberto(false)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <div className="relative bg-[#29292e] border border-[#323238] rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg flex flex-col gap-5 p-6" onClick={e => e.stopPropagation()}>

                        <div className="flex items-center justify-between">
                            <h3 className="text-white font-bold text-base">Filtros</h3>
                            <button onClick={() => setFiltroModalAberto(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#323238] transition"><Ico n="x" s={16} /></button>
                        </div>

                        {/* SEXO */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Sexo</label>
                            <div className="flex gap-2">
                                {["Masculino", "Feminino"].map(s => (
                                    <button key={s} onClick={() => setFiltroSexo(filtroSexo === s ? "" : s)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${filtroSexo === s ? "bg-[#850000]/20 border-[#850000]/50 text-red-400" : "border-[#323238] text-gray-400 hover:text-white"}`}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* NÍVEL */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Nível</label>
                            <div className="flex gap-2">
                                {["Iniciante", "Intermediário", "Avançado"].map(n => (
                                    <button key={n} onClick={() => setFiltroNivel(filtroNivel === n ? "" : n)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${filtroNivel === n ? "bg-[#850000]/20 border-[#850000]/50 text-red-400" : "border-[#323238] text-gray-400 hover:text-white"}`}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* STATUS */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Status</label>
                            <div className="flex gap-2">
                                {[{ v: "ativo", l: "Ativo" }, { v: "vencendo", l: "Vence em breve" }, { v: "concluido", l: "Concluído" }].map(s => (
                                    <button key={s.v} onClick={() => setFiltroStatus(filtroStatus === s.v ? "" : s.v)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${filtroStatus === s.v ? "bg-[#850000]/20 border-[#850000]/50 text-red-400" : "border-[#323238] text-gray-400 hover:text-white"}`}>
                                        {s.l}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* FILTRO DE PERÍODO */}
                        <div className="flex flex-col gap-3 border border-[#323238]/50 rounded-xl p-3 bg-[#1a1a1a]/30">
                            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Data de Início</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-gray-500">De</label>
                                    <input type="date" value={filtroDataInicioFrom} onChange={e => setFiltroDataInicioFrom(e.target.value)}
                                        className="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-[#850000]/60" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-gray-500">Até</label>
                                    <input type="date" value={filtroDataInicioTo} onChange={e => setFiltroDataInicioTo(e.target.value)}
                                        className="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-[#850000]/60" />
                                </div>
                            </div>
                            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-1">Data de Fim</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-gray-500">De</label>
                                    <input type="date" value={filtroDataFimFrom} onChange={e => setFiltroDataFimFrom(e.target.value)}
                                        className="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-[#850000]/60" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-gray-500">Até</label>
                                    <input type="date" value={filtroDataFimTo} onChange={e => setFiltroDataFimTo(e.target.value)}
                                        className="bg-[#29292e] border border-[#323238] text-gray-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-[#850000]/60" />
                                </div>
                            </div>
                        </div>
                        {/* TOTAL DE DIAS NA SEMANA */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total de dias na semana</label>
                            <div className="flex gap-2 flex-wrap">
                                {[2, 3, 4, 5, 6].map(n => (
                                    <button key={n} onClick={() => setFiltroTotalDias(filtroTotalDias === String(n) ? "" : String(n))}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${filtroTotalDias === String(n) ? "bg-[#850000]/20 border-[#850000]/50 text-red-400" : "border-[#323238] text-gray-400 hover:text-white"}`}>
                                        {n}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* FILTRO POR LETRA + FREQUÊNCIA (Acumulativo) */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Estrutura do Treino</label>
                            {/* Letras já adicionadas */}
                            {filtroLetras.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-1">
                                    {filtroLetras.map(({ letra, freq }) => (
                                        <div key={letra} className="flex items-center gap-1 bg-[#850000]/20 border border-[#850000]/40 rounded-lg px-2 py-1">
                                            <span className="text-red-400 text-xs font-bold">{letra} {freq}x</span>
                                            <button onClick={() => setFiltroLetras(prev => prev.filter(f => f.letra !== letra))}
                                                className="text-red-400/60 hover:text-red-400 ml-1"><Ico n="x" s={10} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Seletor de letra */}
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    {["A", "B", "C", "D", "E", "F"]
                                        .filter(l => !filtroLetras.find(f => f.letra === l))
                                        .map(l => (
                                            <button key={l} onClick={() => setLetraSel(letraSel === l ? "" : l)}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${letraSel === l ? "bg-[#323238] border-gray-500 text-white" : "border-[#323238] text-gray-400 hover:text-white"}`}>
                                                {l}
                                            </button>
                                        ))}
                                </div>
                                {letraSel && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] text-gray-500">Frequência do Treino {letraSel}:</span>
                                        <div className="flex gap-2 flex-wrap">
                                            {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                                <button key={n} onClick={() => {
                                                    setFiltroLetras(prev => [...prev, { letra: letraSel, freq: n }]);
                                                    setLetraSel("");
                                                }}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#323238] text-gray-400 hover:bg-[#850000]/20 hover:text-red-400 hover:border-[#850000]/50 transition">
                                                    {n}x
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>


                        {/* RODAPÉ */}
                        <div className="flex gap-2 pt-2 border-t border-[#323238]">
                            <button onClick={() => {
                                setFiltroNivel(""); setFiltroStatus(""); setFiltroLetras([]); setFiltroTotalDias("");
                                setFiltroSexo(""); setLetraSel("");
                                setFiltroDataInicioFrom(""); setFiltroDataInicioTo("");
                                setFiltroDataFimFrom(""); setFiltroDataFimTo("");
                            }}
                                className="flex-1 py-2 text-sm text-gray-400 hover:text-white border border-[#323238] rounded-lg transition">
                                Limpar tudo
                            </button>
                            <button onClick={() => setFiltroModalAberto(false)}
                                className="flex-1 py-2 text-sm bg-[#850000] hover:bg-red-700 text-white font-semibold rounded-lg transition">
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {historicoAluno && (() => {
                const carregarTodasFichasDoAluno = async () => {
                    if (historicoFichasDoAluno.length > 0 || historicoLoadingFichas) return;
                    setHistoricoLoadingFichas(true);
                    try {
                        const res = await buscarFichasFn({ page: 1, limit: 500, aluno: historicoAluno.nome });
                        const todas = (res.data?.list || [])
                            .filter(f => f.aluno === historicoAluno.id)
                            .sort((a, b) => new Date(b.creation) - new Date(a.creation));
                        setHistoricoFichasDoAluno(todas);
                    } catch (e) { console.error(e); }
                    finally { setHistoricoLoadingFichas(false); }
                };
                const carregarHistoricoVolumes = async () => {
                    if (historicoLoading) return;
                    setHistoricoLoading(true);
                    try {
                        // Busca TODAS as fichas do aluno independente do que está carregado na lista
                        const res = await buscarFichasFn({ page: 1, limit: 500, aluno: historicoAluno.nome });
                        const todasFichas = (res.data?.list || [])
                            .filter(f => f.aluno === historicoAluno.id)
                            .sort((a, b) => new Date(a.creation) - new Date(b.creation));

                        const detalhes = await Promise.all(
                            todasFichas.map(f => buscarFichaDetalheFn({ id: f.name }))
                        );
                        const vols = {};
                        detalhes.forEach((res, i) => {
                            const dados = res.data?.data;
                            if (dados) vols[todasFichas[i].name] = calcVolume(dados, intensMapGlobal);
                        });
                        setHistoricoVolumes(vols);

                        // Atualiza a lista local de fichas do aluno para a tabela usar
                        setHistoricoFichasDoAluno(todasFichas);
                    } catch (e) { console.error(e); }
                    finally { setHistoricoLoading(false); }
                };

                const CONFIG_MUSCULOS = GRUPOS_CONFIG;
                const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
                const fichasDoAluno = historicoFichasDoAluno.length > 0
                    ? historicoFichasDoAluno
                    : fichas.filter(f => f.aluno === historicoAluno.id).sort((a, b) => new Date(a.creation) - new Date(b.creation));
                const volsNorm = fichasDoAluno.map(f => {
                    const vol = historicoVolumes[f.name] || {};
                    const n = {};
                    Object.entries(vol).forEach(([k, v]) => { n[norm(k)] = (n[norm(k)] || 0) + v; });
                    return n;
                });
                const musculosComDado = CONFIG_MUSCULOS.filter(m => volsNorm.some(v => (v[m.key] || 0) > 0));

                return (
                    <Modal open onClose={() => { setHistoricoAluno(null); setHistoricoAba("fichas"); setHistoricoVolumes({}); setHistoricoFichasDoAluno([]); setHistoricoLoadingFichas(false); }}
                        title={`Fichas — ${historicoAluno.nome}`} size="lg">
                        <div className="flex gap-2 mb-5 border-b border-[#323238] pb-3">
                            <button onClick={() => setHistoricoAba("fichas")}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${historicoAba === "fichas" ? "bg-[#850000] text-white" : "text-gray-400 hover:text-white border border-[#323238]"}`}>
                                Fichas
                            </button>
                            <button onClick={() => { setHistoricoAba("volume"); carregarHistoricoVolumes(); }}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${historicoAba === "volume" ? "bg-[#850000] text-white" : "text-gray-400 hover:text-white border border-[#323238]"}`}>
                                Comparativo de Volume
                            </button>
                        </div>

                        {historicoAba === "fichas" && (() => {
                            if (historicoFichasDoAluno.length === 0 && !historicoLoadingFichas) {
                                carregarTodasFichasDoAluno();
                            }
                            return historicoLoadingFichas ? (
                                <div className="flex justify-center py-12"><Ico n="spin" s={24} /></div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {historicoFichasDoAluno.map(f => {
                                        const status = statusFicha(f);
                                        return (
                                            <div key={f.name}
                                                className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border border-[#323238] rounded-xl hover:border-[#850000]/40 transition cursor-pointer group"
                                                title="⌘+Clique para abrir em nova aba"
                                                onClick={(e) => { handleEditar(f, e.metaKey || e.ctrlKey); if (!e.metaKey && !e.ctrlKey) setHistoricoAluno(null); }}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-white text-sm font-medium group-hover:text-red-400 transition">
                                                        {f.data_de_inicio ? f.data_de_inicio.split("-").reverse().join("/") : "—"}
                                                        {" → "}
                                                        {f.data_de_fim ? f.data_de_fim.split("-").reverse().join("/") : "..."}
                                                    </span>
                                                    <span className="text-gray-500 text-[10px]">
                                                        criado em: {new Date(f.creation).toLocaleDateString('pt-BR')} · {f.estrutura_calculada || "sem estrutura"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge color={status === "ativo" ? "green" : status === "vencendo" ? "yellow" : "gray"}>
                                                        {status === "ativo" ? "Ativo" : status === "vencendo" ? "Vence em breve" : "Concluído"}
                                                    </Badge>
                                                    <Ico n="next" s={14} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        {historicoAba === "volume" && (
                            historicoLoading ? (
                                <div className="flex justify-center py-12"><Ico n="spin" s={24} /></div>
                            ) : musculosComDado.length === 0 ? (
                                <p className="text-gray-500 text-center py-8 text-sm">Nenhum dado de volume encontrado.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-[#323238]">
                                                <th className="text-left py-2 px-3 text-gray-500 font-semibold uppercase tracking-wider w-24">Grupo</th>
                                                {fichasDoAluno.map((f, i) => (
                                                    <th key={f.name} className="text-center py-2 px-2 text-gray-400 font-medium min-w-[80px]">
                                                        <div>{f.data_de_inicio ? f.data_de_inicio.split("-").reverse().slice(0, 2).join("/") : `#${i + 1}`}</div>
                                                        <div className="text-[9px] text-gray-600">{f.estrutura_calculada || "—"}</div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {musculosComDado.map(m => (
                                                <tr key={m.key} className="border-b border-[#323238]/40 hover:bg-[#1a1a1a] transition">
                                                    <td className={`py-2 px-3 font-medium text-xs ${m.color}`}>{m.label}</td>
                                                    {volsNorm.map((vol, i) => {
                                                        const valor = vol[m.key] || 0;
                                                        const anterior = i > 0 ? (volsNorm[i - 1][m.key] || 0) : null;
                                                        const delta = anterior !== null ? valor - anterior : null;
                                                        return (
                                                            <td key={i} className="py-2 px-2 text-center">
                                                                <span className={`font-bold ${valor > 0 ? "text-white" : "text-gray-700"}`}>
                                                                    {valor > 0 ? valor.toFixed(1) : "—"}
                                                                </span>
                                                                {delta !== null && delta !== 0 && (
                                                                    <span className={`block text-[9px] font-bold ${delta > 0 ? "text-emerald-500" : "text-red-400"}`}>
                                                                        {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}
                    </Modal>
                );
            })()}
            {/* MODAL DE VISUALIZAÇÃO RÁPIDA */}
            <VisualizacaoRapida fichaId={vizId} nomeAluno={vizNome} open={!!vizId} onClose={() => { setVizId(null); setVizNome(""); }} intensidadeMap={intensMapGlobal} />

            {/* MODAL DE DUPLICAÇÃO */}
            <ModalDuplicarFicha
                open={duplicarState.open}
                fichaOrigem={duplicarState.ficha}
                onClose={() => setDuplicarState({ open: false, ficha: null })}
                onConfirm={executarDuplicacao}
            />
            <GerenciarExercicios
                open={gerenciarExOpen}
                onClose={() => setGerenciarExOpen(false)}
                onSalvar={(blacklist) => setExerciciosDesabilitados(blacklist)}
            />
            {/* 👇 ADICIONE O MODAL AQUI */}
            <ModalExcluirFicha
                open={excluirState.open}
                ficha={excluirState.ficha}
                onClose={() => setExcluirState({ open: false, ficha: null })}
                onConfirm={executarExclusao}
            />
            {/* ANIMAÇÃO DO SPINNER (injetada via style) */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}