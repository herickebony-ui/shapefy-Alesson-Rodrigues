// src/components/AlunosHub.jsx
import { useState, useEffect, useCallback } from "react";
import {
    Search, User, ChevronRight, ChevronLeft, RefreshCw,
    AlertCircle, Loader, Dumbbell,
    Salad, FileText, Phone, Mail, Instagram, Scale,
    Ruler, Calendar, Target, Activity, Pill, Heart,
    Clock, Edit2, Save, XCircle, Plus, Check
} from "lucide-react";
import {
    listarAlunos,
    listarAnamnesesPorAluno,
    buscarAnamneseDetalhe,
    salvarAluno,
    listarFormulariosAnamnese,
    vincularAnamnese,
    salvarAnamnese,
} from "./alunoService";
import { listarDietas, buscarAlunoDetalhe } from "./dietaService";
import { getFunctions, httpsCallable } from "firebase/functions";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) => v || "—";
const formatDate = (d) => {
    if (!d) return "—";
    const parts = String(d).split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ nome, foto, size = "md" }) => {
    const sizes = { sm: "h-9 w-9 text-sm", md: "h-12 w-12 text-base", lg: "h-16 w-16 text-xl" };
    const initials = nome?.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() || "?";
    if (foto) return <img src={foto} alt={nome} className={`${sizes[size]} rounded-full object-cover shrink-0`} />;
    return (
        <div className={`${sizes[size]} rounded-full bg-[#850000]/20 border border-[#850000]/30 flex items-center justify-center font-bold text-red-400 shrink-0`}>
            {initials}
        </div>
    );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const Badge = ({ status }) => {
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

// ─── Input Editável ───────────────────────────────────────────────────────────
const EditField = ({ label, value, onChange, icon: Icon, type = "text", multiline = false }) => (
    <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-[#323238] flex items-center justify-center shrink-0 mt-0.5">
            <Icon size={14} className="text-gray-400" />
        </div>
        <div className="flex-1">
            <p className="text-gray-500 text-xs mb-1">{label}</p>
            {multiline ? (
                <textarea
                    value={value || ""}
                    onChange={e => onChange(e.target.value)}
                    rows={3}
                    className="w-full bg-[#1a1a1a] border border-[#323238] focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none transition-colors"
                />
            ) : (
                <input
                    type={type}
                    value={value || ""}
                    onChange={e => onChange(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#323238] focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors"
                />
            )}
        </div>
    </div>
);

// ─── InfoRow (leitura) ────────────────────────────────────────────────────────
const InfoRow = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-[#323238] flex items-center justify-center shrink-0 mt-0.5">
            <Icon size={14} className="text-gray-400" />
        </div>
        <div>
            <p className="text-gray-500 text-xs">{label}</p>
            <p className="text-white text-sm font-medium">{fmt(value)}</p>
        </div>
    </div>
);

// ─── Aba: Perfil (editável) ───────────────────────────────────────────────────
const TabPerfil = ({ alunoId }) => {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        // Busca dados completos direto da Firebase Function (que retorna json.data completo)
        const fns = getFunctions();
        const fnCompleto = httpsCallable(fns, "buscarAlunoDetalhe");
        fnCompleto({ id: alunoId })
            .then(res => {
                const d = res.data?.data || res.data || {};
                setDados(d);
                setForm(d);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [alunoId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const camposEditaveis = {
                email: form.email,
                telefone: form.telefone,
                instagram: form.instagram,
                "profissão": form["profissão"] || form.profissao || "",
                weight: form.weight,
                height: form.height,
                age: form.age,
                objetivo: form.objetivo,
                doencas: form.doencas,
                medicamento: form.medicamento,
                frequencia_atividade: form.frequencia_atividade,
                sexo: form.sexo,
                orientacoes_globais: form.orientacoes_globais,
            };
            await salvarAluno(alunoId, camposEditaveis);
            setDados(prev => ({ ...prev, ...camposEditaveis }));
            setEditMode(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const set = (field) => (val) => setForm(f => ({ ...f, [field]: val }));

    if (loading) return <div className="flex justify-center py-16"><Loader size={24} className="animate-spin text-[#850000]" /></div>;
    if (!dados) return <p className="text-red-400 text-center py-10">Erro ao carregar perfil.</p>;

    return (
        <div className="space-y-5">
            {/* Header com toggle edição */}
            <div className="flex items-center gap-4 p-4 bg-[#1a1a1a] rounded-xl border border-[#323238]">
                <Avatar nome={dados.nome_completo} foto={dados.foto} size="lg" />
                <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-lg truncate">{dados.nome_completo}</h3>
                    <p className="text-gray-400 text-sm">{dados.profissão || dados.profissao || "Profissão não informada"}</p>
                    <div className="flex items-center gap-2 mt-1">
                        {dados.dieta === 1 && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-orange-500/10 text-orange-300 border-orange-500/20 uppercase">Dieta</span>}
                        {dados.treino === 1 && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-500/10 text-blue-300 border-blue-500/20 uppercase">Treino</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {saved && <span className="text-green-400 text-xs flex items-center gap-1"><Check size={12} /> Salvo</span>}
                    {editMode ? (
                        <>
                            <button onClick={() => { setEditMode(false); setForm(dados); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#323238] text-gray-400 hover:text-white text-xs font-medium transition-colors">
                                <XCircle size={13} /> Cancelar
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#850000] hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50">
                                {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />} Salvar
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setEditMode(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white text-xs font-medium transition-colors">
                            <Edit2 size={13} /> Editar
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Contato */}
                <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl p-4 space-y-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contato</p>
                    {editMode ? (
                        <>
                            <EditField icon={User} label="Profissão" value={form["profissão"] || form.profissao || ""} onChange={val => setForm(f => ({ ...f, "profissão": val }))} />
                            <EditField icon={Mail} label="E-mail" value={form.email} onChange={set("email")} type="email" />
                            <EditField icon={Phone} label="Telefone" value={form.telefone} onChange={set("telefone")} />
                            <EditField icon={Instagram} label="Instagram" value={form.instagram} onChange={set("instagram")} />
                        </>
                    ) : (
                        <>
                            <InfoRow icon={User} label="Profissão" value={dados["profissão"] || dados.profissao} />
                            <InfoRow icon={Mail} label="E-mail" value={dados.email} />
                            <InfoRow icon={Phone} label="Telefone" value={dados.telefone} />
                            <InfoRow icon={Instagram} label="Instagram" value={dados.instagram} />
                        </>
                    )}
                </div>

                {/* Corpo */}
                <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl p-4 space-y-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Corpo</p>
                    {editMode ? (
                        <>
                            <EditField icon={Calendar} label="Idade" value={form.age} onChange={set("age")} type="number" />
                            <EditField icon={Scale} label="Peso (kg)" value={form.weight} onChange={set("weight")} type="number" />
                            <EditField icon={Ruler} label="Altura (cm)" value={form.height} onChange={set("height")} type="number" />
                        </>
                    ) : (
                        <>
                            <InfoRow icon={User} label="Sexo" value={dados.sexo} />
                            <InfoRow icon={Calendar} label="Idade" value={dados.age ? `${dados.age} anos` : null} />
                            <InfoRow icon={Scale} label="Peso" value={dados.weight ? `${dados.weight} kg` : null} />
                            <InfoRow icon={Ruler} label="Altura" value={dados.height ? `${dados.height} cm` : null} />
                        </>
                    )}
                </div>

                {/* Saúde */}
                {editMode ? (
                    <>
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#323238] flex items-center justify-center shrink-0 mt-0.5">
                                <User size={14} className="text-gray-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-500 text-xs mb-1">Sexo</p>
                                <select value={form.sexo || ""} onChange={e => set("sexo")(e.target.value)}
                                    className="w-full bg-[#1a1a1a] border border-[#323238] focus:border-[#850000]/60 rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors">
                                    <option value="">— Selecionar —</option>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Feminino">Feminino</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-[#323238] flex items-center justify-center shrink-0 mt-0.5">
                                <Activity size={14} className="text-gray-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-gray-500 text-xs mb-1">Nível de Atividade</p>
                                <select value={form.frequencia_atividade || ""} onChange={e => set("frequencia_atividade")(e.target.value)}
                                    className="w-full bg-[#1a1a1a] border border-[#323238] focus:border-[#850000]/60 rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors">
                                    <option value="">— Selecionar —</option>
                                    <option value="Sedentário">Sedentário</option>
                                    <option value="Levemente Ativo">Levemente Ativo</option>
                                    <option value="Moderadamente Ativo">Moderadamente Ativo</option>
                                    <option value="Muito Ativo">Muito Ativo</option>
                                    <option value="Extremamente Ativo">Extremamente Ativo</option>
                                </select>
                            </div>
                        </div>
                        <EditField icon={Heart} label="Doenças" value={form.doencas} onChange={set("doencas")} multiline />
                        <EditField icon={Pill} label="Medicamentos" value={form.medicamento} onChange={set("medicamento")} multiline />
                        <EditField icon={Target} label="Objetivo" value={form.objetivo} onChange={set("objetivo")} multiline />
                    </>
                ) : (
                    <>
                        <InfoRow icon={User} label="Sexo" value={dados.sexo} />
                        <InfoRow icon={Activity} label="Nível de Atividade" value={dados.frequencia_atividade} />
                        <InfoRow icon={Heart} label="Doenças" value={dados.doencas} />
                        <InfoRow icon={Pill} label="Medicamentos" value={dados.medicamento} />
                        <InfoRow icon={Target} label="Objetivo" value={dados.objetivo} />
                    </>
                )}

                {/* Orientações Globais */}
                <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Orientações Globais</p>
                    {editMode ? (
                        <textarea
                            value={form.orientacoes_globais || ""}
                            onChange={e => set("orientacoes_globais")(e.target.value)}
                            rows={5}
                            className="w-full bg-[#0f0f0f] border border-[#323238] focus:border-[#850000]/60 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none transition-colors"
                            placeholder="Orientações gerais para o aluno..."
                        />
                    ) : (
                        <p className="text-gray-300 text-sm whitespace-pre-line leading-relaxed">
                            {dados.orientacoes_globais || <span className="text-gray-600">Nenhuma orientação cadastrada.</span>}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Aba: Dietas ──────────────────────────────────────────────────────────────
const TabDietas = ({ aluno, onAbrirDieta }) => {
    const [dietas, setDietas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        listarDietas({ aluno: aluno.nome_completo, limit: 50 })
            .then(r => setDietas(r.list || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [aluno]);

    const getStatus = (d) => {
        const hoje = new Date().toISOString().split("T")[0];
        if (!d.date && !d.final_date) return { label: "Rascunho", cls: "bg-gray-500/10 text-gray-400 border-gray-500/20" };
        if (d.date && (!d.final_date || d.final_date >= hoje)) return { label: "Ativa", cls: "bg-green-500/10 text-green-300 border-green-500/20" };
        return { label: "Inativa", cls: "bg-red-500/10 text-red-400 border-red-500/20" };
    };

    if (loading) return <div className="flex justify-center py-16"><Loader size={24} className="animate-spin text-[#850000]" /></div>;
    if (dietas.length === 0) return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Salad size={32} className="text-gray-600" />
            <p className="text-gray-400">Nenhuma dieta cadastrada para este aluno.</p>
        </div>
    );

    return (
        <div className="space-y-2">
            {dietas.map(d => {
                const status = getStatus(d);
                return (
                    <button key={d.name} onClick={() => onAbrirDieta(d.name)}
                        className="w-full text-left bg-[#1a1a1a] border border-[#323238] rounded-xl p-4 hover:bg-[#252525] hover:border-gray-500 transition-all group flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <p className="text-white font-medium text-sm truncate">{d.strategy || "Dieta sem estratégia"}</p>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${status.cls}`}>{status.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-gray-500 text-xs">{formatDate(d.date)} → {d.final_date ? formatDate(d.final_date) : "em aberto"}</span>
                                {d.total_calories && <span className="text-orange-400 text-xs font-medium">{d.total_calories} kcal</span>}
                            </div>
                        </div>
                        <ChevronRight size={15} className="text-gray-600 group-hover:text-gray-300 transition-colors shrink-0" />
                    </button>
                );
            })}
        </div>
    );
};

// ─── Aba: Fichas de Treino ────────────────────────────────────────────────────
const TabTreinos = ({ aluno, onAbrirFicha }) => {
    const [fichas, setFichas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fns = getFunctions();
        // ✅ buscarFichas com filtro por nome do aluno
        const fn = httpsCallable(fns, "buscarFichas");
        fn({ aluno: aluno.nome_completo, limit: 50 })
            .then(res => setFichas(res.data?.list || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [aluno]);

    if (loading) return <div className="flex justify-center py-16"><Loader size={24} className="animate-spin text-[#850000]" /></div>;
    if (fichas.length === 0) return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Dumbbell size={32} className="text-gray-600" />
            <p className="text-gray-400">Nenhuma ficha de treino cadastrada.</p>
        </div>
    );

    return (
        <div className="space-y-2">
            {fichas.map(f => (
                <button key={f.name} onClick={() => onAbrirFicha(f.name)}
                    className="w-full text-left bg-[#1a1a1a] border border-[#323238] rounded-xl p-4 hover:bg-[#252525] hover:border-gray-500 transition-all group flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{f.nome_completo || f.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            {f.objetivo && <span className="text-gray-500 text-xs">{f.objetivo}</span>}
                            {f.nivel && <span className="text-gray-500 text-xs">· {f.nivel}</span>}
                            {f.estrutura_calculada && <span className="text-blue-400 text-xs font-mono font-bold">{f.estrutura_calculada}</span>}
                        </div>
                        <span className="text-gray-600 text-xs">{formatDate(f.data_de_inicio)} → {f.data_de_fim ? formatDate(f.data_de_fim) : "em aberto"}</span>
                    </div>
                    <ChevronRight size={15} className="text-gray-600 group-hover:text-gray-300 transition-colors shrink-0" />
                </button>
            ))}
        </div>
    );
};

// ─── Modal: Visualizar Anamnese (flat) ────────────────────────────────────────
const ModalAnamneseDetalhe = ({ anamneseId, onClose, onSalvo }) => {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [perguntas, setPerguntas] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        buscarAnamneseDetalhe(anamneseId)
            .then(r => {
                setDados(r.data);
                setPerguntas(r.data?.perguntas_e_respostas || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [anamneseId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await salvarAnamnese(anamneseId, perguntas);
            // Re-busca dados frescos do Frappe após salvar
            const fresco = await buscarAnamneseDetalhe(anamneseId);
            setDados(fresco.data);
            setPerguntas(fresco.data?.perguntas_e_respostas || []);
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

            // Auto-ajusta o tamanho da caixa de texto organicamente conforme o conteúdo
            const linhas = item.resposta ? item.resposta.split("\n").length : 1;

            return (
                <div key={i} className="py-4 border-b border-[#323238] last:border-0 group">
                    {/* Pergunta: Agora sem 'uppercase', mantendo em negrito e branco */}
                    <p className="text-white text-[14px] font-bold mb-2 px-2 leading-relaxed">
                        {item.pergunta}
                    </p>

                    {/* Resposta: Texto em cinza claro (text-gray-300) e peso normal (font-normal) para diferenciar da pergunta */}
                    <textarea
                        value={item.resposta || ""}
                        onChange={e => {
                            setResposta(i, e.target.value);
                        }}
                        onFocus={() => {
                            if (!editMode) setEditMode(true);
                        }}
                        rows={linhas}
                        className={`w-full bg-transparent border border-transparent 
                            hover:bg-[#252525]/40 focus:bg-[#1a1a1a] focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 
                            rounded-lg px-2 py-2 text-gray-300 text-[14px] font-normal italic outline-none resize-none transition-all leading-relaxed
                            ${!item.resposta ? "italic text-gray-600" : ""}`}
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
                            <button onClick={() => setEditMode(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white text-xs font-medium transition-colors">
                                <Edit2 size={13} /> Editar
                            </button>
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
const ModalVincularAnamnese = ({ alunoId, onClose, onSucesso }) => {
    const [formularios, setFormularios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selecionado, setSelecionado] = useState(null);
    const [salvando, setSalvando] = useState(false);
    const [enviarAluno, setEnviarAluno] = useState(true);
    const [erro, setErro] = useState(null);

    useEffect(() => {
        listarFormulariosAnamnese()
            .then(r => setFormularios(r.list || []))
            .catch(e => setErro("Não foi possível carregar formulários: " + e.message))
            .finally(() => setLoading(false));
    }, []);

    const handleVincular = async () => {
        if (!selecionado) return;
        setSalvando(true);
        try {
            await vincularAnamnese(alunoId, selecionado, enviarAluno);
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
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-md flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[#323238]">
                    <h3 className="text-white font-bold">Vincular Anamnese</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <div className="p-4 space-y-3">
                    {erro && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            <AlertCircle size={14} /> {erro}
                        </div>
                    )}
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader size={20} className="animate-spin text-[#850000]" /></div>
                    ) : formularios.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-6">Nenhum formulário disponível no sistema.</p>
                    ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-gray-400 text-xs">Selecione o formulário:</p>
                                <button
                                    onClick={() => setEnviarAluno(v => !v)}
                                    className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-medium transition-all ${enviarAluno
                                        ? "bg-[#850000]/10 border-[#850000]/40 text-red-400"
                                        : "bg-[#29292e] border-[#323238] text-gray-500"
                                        }`}
                                >
                                    <div className={`w-3 h-3 rounded-full ${enviarAluno ? "bg-[#850000]" : "bg-gray-600"}`} />
                                    {enviarAluno ? "Enviará para o aluno" : "Não enviar ao aluno"}
                                </button>
                            </div>
                            {formularios.map(f => (
                                <button key={f.name} onClick={() => setSelecionado(f.name)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${selecionado === f.name
                                        ? "bg-[#850000]/10 border-[#850000]/40 text-white"
                                        : "bg-[#29292e] border-[#323238] text-gray-300 hover:border-gray-500"
                                        }`}>
                                    <div className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selecionado === f.name ? "border-[#850000] bg-[#850000]" : "border-gray-600"}`}>
                                        {selecionado === f.name && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                    </div>
                                    <span className="text-sm">{f.titulo || f.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3 p-4 border-t border-[#323238]">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white text-sm transition-colors">Cancelar</button>
                    <button onClick={handleVincular} disabled={!selecionado || salvando}
                        className="px-4 py-2 rounded-lg bg-[#850000] hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-40 flex items-center gap-2">
                        {salvando ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />} Vincular
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Aba: Anamnese ────────────────────────────────────────────────────────────
const TabAnamnese = ({ alunoId }) => {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [anamneseSelecionada, setAnamneseSelecionada] = useState(null);
    const [showVincular, setShowVincular] = useState(false);

    const carregar = useCallback(() => {
        setLoading(true);
        listarAnamnesesPorAluno(alunoId)
            .then(r => {
                const lista = r.list || [];
                console.log("Anamneses vindas do banco:", lista);

                const apenasEnviadas = lista.filter(a => {
                    // Verifica se o checkbox do Frappe está marcado (1)
                    const checkMarcado = a.enviar_para_o_aluno_preencher === 1 || a.enviar_aluno === 1;

                    // Verifica o status ignorando maiúsculas e minúsculas
                    const statusValido = a.status && ["enviado", "pendente", "respondido"].includes(String(a.status).toLowerCase());

                    return checkMarcado || statusValido;
                });

                setList(apenasEnviadas);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [alunoId]);

    useEffect(() => { carregar(); }, [carregar]);

    return (
        <>
            {anamneseSelecionada && <ModalAnamneseDetalhe anamneseId={anamneseSelecionada} onClose={() => setAnamneseSelecionada(null)} onSalvo={carregar} />}
            {showVincular && <ModalVincularAnamnese alunoId={alunoId} onClose={() => setShowVincular(false)} onSucesso={carregar} />}

            <div className="flex items-center justify-between mb-4">
                <p className="text-gray-400 text-sm">{list.length} anamnese{list.length !== 1 ? "s" : ""}</p>
                <button onClick={() => setShowVincular(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#850000] hover:bg-red-700 text-white text-xs font-bold transition-colors">
                    <Plus size={13} /> Vincular Anamnese
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader size={24} className="animate-spin text-[#850000]" /></div>
            ) : list.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <FileText size={32} className="text-gray-600" />
                    <p className="text-gray-400">Nenhuma anamnese registrada.</p>
                    <p className="text-gray-600 text-xs">Clique em "Vincular Anamnese" para enviar um formulário.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {list.map(a => (
                        <button key={a.name} onClick={() => setAnamneseSelecionada(a.name)}
                            className="w-full text-left bg-[#1a1a1a] border border-[#323238] rounded-xl p-4 hover:bg-[#252525] hover:border-gray-500 transition-all group flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-[#29292e] border border-[#323238] flex items-center justify-center shrink-0">
                                    <FileText size={14} className="text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">{a.titulo || "Anamnese"}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-gray-500 text-xs flex items-center gap-1"><Clock size={10} />{formatDate(a.date)}</span>
                                        <Badge status={a.status} />
                                    </div>
                                </div>
                            </div>
                            <ChevronRight size={15} className="text-gray-600 group-hover:text-gray-300 transition-colors shrink-0" />
                        </button>
                    ))}
                </div>
            )}
        </>
    );
};

// ─── Modal Principal ──────────────────────────────────────────────────────────
const ABAS = [
    { key: "perfil", label: "Perfil", icon: User },
    { key: "dietas", label: "Dietas", icon: Salad },
    { key: "treinos", label: "Treinos", icon: Dumbbell },
    { key: "anamnese", label: "Anamnese", icon: FileText },
];

const ModalAluno = ({ aluno, onClose, onAbrirDieta, onAbrirFicha }) => {
    const [abaAtiva, setAbaAtiva] = useState("perfil");
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-4 p-4 border-b border-[#323238] shrink-0">
                    <Avatar nome={aluno.nome_completo} foto={aluno.foto} size="md" />
                    <div className="flex-1 min-w-0">
                        <h2 className="text-white font-bold text-lg truncate">{aluno.nome_completo}</h2>
                        <p className="text-gray-400 text-xs">{aluno.email || "—"}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none shrink-0">&times;</button>
                </div>
                <div className="flex border-b border-[#323238] shrink-0 overflow-x-auto">
                    {ABAS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setAbaAtiva(key)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${abaAtiva === key ? "border-[#850000] text-white" : "border-transparent text-gray-400 hover:text-white"
                                }`}>
                            <Icon size={14} />{label}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {abaAtiva === "perfil" && <TabPerfil alunoId={aluno.name} />}
                    {abaAtiva === "dietas" && <TabDietas aluno={aluno} onAbrirDieta={onAbrirDieta} />}
                    {abaAtiva === "treinos" && <TabTreinos aluno={aluno} onAbrirFicha={onAbrirFicha} />}
                    {abaAtiva === "anamnese" && <TabAnamnese alunoId={aluno.name} />}
                </div>
            </div>
        </div>
    );
};

// ─── Componente Principal ─────────────────────────────────────────────────────
const LIMIT = 20;
export default function AlunosHub({ onAbrirDieta, onAbrirFicha }) {
    const [alunos, setAlunos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [alunoSelecionado, setAlunoSelecionado] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => { setQuery(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    const fetchAlunos = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const result = await listarAlunos({ search: query, page, limit: LIMIT });
            setAlunos(result.list || []);
            setHasMore(result.hasMore || false);
        } catch (e) {
            setError(e.message || "Erro ao buscar alunos.");
        } finally {
            setLoading(false);
        }
    }, [query, page]);

    useEffect(() => { fetchAlunos(); }, [fetchAlunos]);

    return (
        <div className="text-white">
            {alunoSelecionado && (
                <ModalAluno
                    aluno={alunoSelecionado}
                    onClose={() => setAlunoSelecionado(null)}
                    onAbrirDieta={(id) => { setAlunoSelecionado(null); onAbrirDieta?.(id); }}
                    onAbrirFicha={(id) => { setAlunoSelecionado(null); onAbrirFicha?.(id); }}
                />
            )}
            <div className="max-w-screen-xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Alunos</h1>
                        <p className="text-gray-400 text-sm mt-1">Hub central dos seus pacientes · mais recentes primeiro</p>
                    </div>
                    <button onClick={fetchAlunos} disabled={loading}
                        className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="relative mb-6 max-w-md">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    <input type="text" placeholder="Buscar por nome..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 bg-[#1a1a1a] border border-[#323238] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 transition-colors" />
                </div>

                {error ? (
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                        <AlertCircle size={18} className="shrink-0" />
                        <p className="text-sm">{error}</p>
                        <button onClick={fetchAlunos} className="ml-auto text-xs underline shrink-0">Tentar novamente</button>
                    </div>
                ) : loading ? <Skeleton /> : alunos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-[#29292e] border border-[#323238] flex items-center justify-center">
                            <User size={28} className="text-gray-600" />
                        </div>
                        <div className="text-center">
                            <p className="text-white font-medium mb-1">{query ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}</p>
                            <p className="text-gray-500 text-sm">{query ? `Sem resultados para "${query}"` : "Os alunos do Frappe aparecerão aqui"}</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-[#29292e] border border-[#323238] rounded-xl overflow-hidden">
                        {alunos.map((aluno, i) => (
                            <button key={aluno.name} onClick={() => setAlunoSelecionado(aluno)}
                                className={`w-full text-left flex items-center gap-4 px-4 py-3.5 hover:bg-[#323238] transition-colors group ${i < alunos.length - 1 ? "border-b border-[#323238]" : ""}`}>
                                <Avatar nome={aluno.nome_completo} foto={aluno.foto} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium text-sm truncate">{aluno.nome_completo}</p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        {aluno.email && <p className="text-gray-500 text-xs truncate">{aluno.email}</p>}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {aluno.dieta === 1 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase">D</span>}
                                            {aluno.treino === 1 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">T</span>}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight size={15} className="text-gray-600 group-hover:text-gray-300 transition-colors shrink-0" />
                            </button>
                        ))}
                    </div>
                )}

                {!loading && !error && alunos.length > 0 && (
                    <div className="flex items-center justify-between mt-6">
                        <p className="text-gray-500 text-sm">Página {page} · {alunos.length} aluno{alunos.length !== 1 ? "s" : ""}</p>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                                <ChevronLeft size={15} />
                            </button>
                            <span className="text-sm text-gray-400 px-2">Página {page}</span>
                            <button onClick={() => setPage(p => p + 1)} disabled={!hasMore}
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