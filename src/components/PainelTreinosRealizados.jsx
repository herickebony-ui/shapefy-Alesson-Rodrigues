import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
// ⚠️ ATENÇÃO AQUI: Se der erro de importação, tente "../services/firebase" ou "../firebase"
// O erro da imagem 13 diz que "../services/firebase" não existe.
// Vou assumir que o correto é "../firebase" baseado no seu Dashboard.jsx
import { functions } from "../firebase";

import {
    ChevronLeft, ChevronRight, Save, Activity,
    Calendar, Clock, Dumbbell, ArrowLeft, Search,
    User, CheckCircle, TrendingUp, MessageSquare // <--- ADICIONEI OS ÍCONES QUE FALTAVAM AQUI
} from 'lucide-react';

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function PainelTreinosRealizados() {
    const [view, setView] = useState('list'); // 'list' ou 'detail'
    const [listaTreinos, setListaTreinos] = useState([]);
    const [treinoSelecionado, setTreinoSelecionado] = useState(null);
    const [detalhesCarregados, setDetalhesCarregados] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingDetalhe, setLoadingDetalhe] = useState(false);
    const [saving, setSaving] = useState(false);

    const scrollRef = React.useRef(null);
    const scrollPosRef = React.useRef(0);
    const [filtroNome, setFiltroNome] = useState('');
    const [filtroFicha, setFiltroFicha] = useState('');
    const [filtroDataInicio, setFiltroDataInicio] = useState('');
    const [filtroDataFim, setFiltroDataFim] = useState('');
    const [checkedTreinos, setCheckedTreinos] = useState(() => {
        try { return JSON.parse(localStorage.getItem('checkedTreinos') || '{}'); } catch { return {}; }
    });

    const normalizeText = (text) => {
        if (!text) return '';
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    };

    const toggleCheck = (treinoName, e) => {
        e.stopPropagation();
        setCheckedTreinos(prev => {
            const updated = { ...prev, [treinoName]: !prev[treinoName] };
            localStorage.setItem('checkedTreinos', JSON.stringify(updated));
            return updated;
        });
    };

    // 1. CARREGAR A LISTA
    useEffect(() => {
        carregarLista();
    }, []);

    const carregarLista = async () => {
        setLoading(true);
        try {
            const buscar = httpsCallable(functions, 'buscarTreinosRealizados');
            const resp = await buscar({ status: '' });
            if (resp.data.success) {
                setListaTreinos(resp.data.list);
            }
        } catch (error) {
            console.error("Erro ao buscar lista", error);
        } finally {
            setLoading(false);
        }
    };

    // --- LÓGICA INTELIGENTE (Filtro Virtual) ---
    const treinosFiltrados = React.useMemo(() => {
        return listaTreinos.filter(t => {
            const nomeOk = normalizeText(t.nome_completo).includes(normalizeText(filtroNome));
            const fichaOk = !filtroFicha || normalizeText(t.treino_label || t.treino || '').includes(normalizeText(filtroFicha));
            const dataTreino = t.data_e_hora_do_inicio ? t.data_e_hora_do_inicio.substring(0, 10) : '';
            const dataInicioOk = !filtroDataInicio || dataTreino >= filtroDataInicio;
            const dataFimOk = !filtroDataFim || dataTreino <= filtroDataFim;
            return nomeOk && fichaOk && dataInicioOk && dataFimOk;
        });
    }, [listaTreinos, filtroNome, filtroFicha, filtroDataInicio, filtroDataFim]);

    // 2. ABRIR DETALHES
    const abrirTreino = async (treinoBase, manterScroll = false) => {
        setTreinoSelecionado(treinoBase);
        setView('detail');

        if (!manterScroll) {
            setLoadingDetalhe(true);
            setDetalhesCarregados(null);
            scrollPosRef.current = 0;
        }

        try {
            const buscar = httpsCallable(functions, 'buscarTreinosRealizados');
            const resp = await buscar({ id: treinoBase.name });
            if (resp.data.success) {
                setDetalhesCarregados(resp.data.data);
            }
        } catch (error) {
            console.error("Erro ao detalhar", error);
            alert("Erro ao abrir detalhes.");
        } finally {
            setLoadingDetalhe(false);
            if (manterScroll) {
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollPosRef.current;
                    }
                }, 150);
            }
        }
    };

    // 3. NAVEGAÇÃO (Respeita o Filtro)
    const navegar = (direcao) => {
        if (!treinoSelecionado) return;
        const indexAtual = treinosFiltrados.findIndex(t => t.name === treinoSelecionado.name);
        if (indexAtual === -1) return;
        const novoIndex = indexAtual + direcao;
        if (novoIndex >= 0 && novoIndex < treinosFiltrados.length) {
            if (scrollRef.current) {
                scrollPosRef.current = scrollRef.current.scrollTop;
            }
            abrirTreino(treinosFiltrados[novoIndex], true);
        }
    };

    // 4. SALVAR FEEDBACK
    const salvarFeedback = async (novoTexto) => {
        if (!detalhesCarregados) return;
        setSaving(true);
        try {
            const salvar = httpsCallable(functions, 'salvarFeedbackTreino');
            await salvar({
                treinoId: detalhesCarregados.name,
                feedbackTexto: novoTexto
            });
            setDetalhesCarregados(prev => ({ ...prev, feedback_do_profissional: novoTexto }));
            alert("Feedback salvo com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar", error);
            alert("Erro ao salvar feedback.");
        } finally {
            setSaving(false);
        }
    };

    // --- VIEW: LISTA ---
    if (view === 'list') {
        return (
            <div className="w-full h-full p-6 animate-in fade-in duration-500 bg-ebony-bg text-ebony-text">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <span className="p-2 bg-ebony-primary rounded-lg shadow-[0_0_15px_rgba(133,0,0,0.5)]">
                                <Dumbbell className="w-6 h-6 text-white" />
                            </span>
                            Treinos Realizados
                        </h1>
                        <p className="text-ebony-muted text-sm mt-1 font-medium">
                            Monitoramento de execução e carga em tempo real.
                        </p>
                    </div>
                    <button
                        onClick={carregarLista}
                        className="px-5 py-2.5 bg-ebony-surface border border-ebony-border hover:border-ebony-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-lg hover:shadow-ebony-primary/20 flex items-center gap-2"
                    >
                        <Activity className="w-4 h-4" /> Atualizar
                    </button>
                </div>

                <div className="mb-6 flex flex-col md:flex-row flex-wrap gap-3 w-full">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-ebony-muted" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar aluno por nome..."
                            className="w-full pl-10 pr-4 py-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none transition-colors text-sm font-medium"
                            value={filtroNome}
                            onChange={(e) => setFiltroNome(e.target.value)}
                        />
                    </div>
                    <div className="relative w-full md:w-48">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Dumbbell className="h-4 w-4 text-ebony-muted" />
                        </div>
                        <input
                            type="text"
                            placeholder="Filtrar ficha..."
                            className="w-full pl-10 pr-4 py-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none transition-colors text-sm font-medium"
                            value={filtroFicha}
                            onChange={(e) => setFiltroFicha(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative">
                            <label className="absolute -top-2 left-2 text-[9px] text-ebony-muted font-bold uppercase tracking-wider bg-ebony-bg px-1 z-10">De</label>
                            <input
                                type="date"
                                className="w-full md:w-40 px-3 py-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none transition-colors text-sm font-medium"
                                value={filtroDataInicio}
                                onChange={(e) => setFiltroDataInicio(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <label className="absolute -top-2 left-2 text-[9px] text-ebony-muted font-bold uppercase tracking-wider bg-ebony-bg px-1 z-10">Até</label>
                            <input
                                type="date"
                                className="w-full md:w-40 px-3 py-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none transition-colors text-sm font-medium"
                                value={filtroDataFim}
                                onChange={(e) => setFiltroDataFim(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col justify-center items-center h-64 opacity-50">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ebony-primary mb-4"></div>
                        <p className="text-ebony-muted text-xs uppercase tracking-widest animate-pulse">Sincronizando com Frappe...</p>
                    </div>
                ) : (
                    <div className="bg-ebony-surface rounded-xl shadow-2xl border border-ebony-border overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-ebony-deep border-b border-ebony-border">
                                <tr>
                                    <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider">Aluno</th>
                                    <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider">Treino / Ficha</th>
                                    <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider">ID</th>
                                    <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider">Data</th>
                                    <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider">Duração</th>
                                    <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider text-center">Status</th>
                                    <th className="p-4 text-right text-[10px] font-bold text-ebony-muted uppercase tracking-wider">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ebony-border/40">
                                {treinosFiltrados.map((treino) => (                                                                    
                                    <tr
                                        key={treino.name}
                                        onClick={() => abrirTreino(treino)}
                                        className={`hover:bg-white/5 transition-colors cursor-pointer group ${checkedTreinos[treino.name] ? 'bg-green-500/[0.04]' : ''}`}
                                    >
                                        <td className="p-4 text-sm">                                        
                                            <div className="flex items-center gap-2.5">
                                                <button
                                                    onClick={(e) => toggleCheck(treino.name, e)}
                                                    className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${checkedTreinos[treino.name]
                                                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                                        : 'border-ebony-border hover:border-ebony-muted text-transparent hover:text-ebony-muted'
                                                        }`}
                                                >
                                                    <CheckCircle size={12} />
                                                </button>
                                                <span className={`font-bold group-hover:text-ebony-primary transition-colors ${checkedTreinos[treino.name] ? 'text-gray-500' : 'text-white'}`}>
                                                    {treino.nome_completo}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-ebony-deep rounded border border-ebony-border font-mono text-xs text-blue-300">
                                                {treino.treino_label || treino.treino}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-black/20 rounded font-mono text-[10px] text-ebony-muted">
                                            {treino.ficha || '—'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-ebony-muted text-xs">
                                            <div className="flex flex-col">
                                                <span className="text-gray-300 font-medium">
                                                    {new Date(treino.data_e_hora_do_inicio).toLocaleDateString('pt-BR')}
                                                </span>
                                                <span className="text-[10px] opacity-70">
                                                    {new Date(treino.data_e_hora_do_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-300 font-mono text-xs flex items-center gap-2">
                                            <Clock size={14} className="text-ebony-muted" />
                                            {treino.tempo_total_de_treino}
                                        </td>
                                        <td className="p-4 text-center">
                                            <StatusBadge status={treino.status} />
                                        </td>
                                        <td className="p-4 text-right">
                                            <ChevronRight className="w-5 h-5 text-ebony-muted group-hover:text-white inline-block transition-transform group-hover:translate-x-1" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {treinosFiltrados.length === 0 && (
                            <div className="p-12 text-center">
                                <Dumbbell className="w-12 h-12 text-ebony-border mx-auto mb-3 opacity-20" />
                                <p className="text-ebony-muted text-sm">Nenhum treino encontrado.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // --- VIEW: DETALHES ---
    return (
        <div className="w-full h-full flex flex-col bg-ebony-bg text-ebony-text animate-in slide-in-from-right-8 duration-300">

            {/* HEADER FIXO SLIM */}
            <div className="shrink-0 bg-ebony-bg/95 backdrop-blur-md z-20 border-b border-ebony-border px-6 py-3 flex items-center justify-between">
                <button
                    onClick={() => setView('list')}
                    className="flex items-center gap-2 text-ebony-muted hover:text-white transition-colors text-xs font-bold uppercase tracking-wide"
                >
                    <ArrowLeft size={16} /> Voltar
                </button>

                <div className="flex items-center gap-4">
                    {filtroNome && (
                        <span className="text-[10px] text-ebony-muted uppercase tracking-widest hidden md:block border border-ebony-border px-2 py-1 rounded">
                            Filtro: "{filtroNome}"
                        </span>
                    )}
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 custom-scrollbar">
                {/* BOTÕES FLUTUANTES NAS LATERAIS */}
                {!loadingDetalhe && detalhesCarregados && (
                    <>
                        <button
                            onClick={() => navegar(-1)}
                            disabled={treinosFiltrados.findIndex(t => t.name === treinoSelecionado?.name) <= 0}
                            className="fixed left-20 md:left-24 top-1/2 -translate-y-1/2 z-30 p-2 md:p-3 bg-ebony-surface/90 backdrop-blur border border-ebony-border rounded-full shadow-xl hover:bg-ebony-deep hover:border-ebony-primary/50 disabled:opacity-20 disabled:cursor-not-allowed text-white transition-all"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => navegar(1)}
                            disabled={treinosFiltrados.findIndex(t => t.name === treinoSelecionado?.name) >= treinosFiltrados.length - 1}
                            className="fixed right-2 md:right-4 top-1/2 -translate-y-1/2 z-30 p-2 md:p-3 bg-ebony-surface/90 backdrop-blur border border-ebony-border rounded-full shadow-xl hover:bg-ebony-deep hover:border-ebony-primary/50 disabled:opacity-20 disabled:cursor-not-allowed text-white transition-all"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </>
                )}
                {loadingDetalhe || !detalhesCarregados ? (
                    <div className="flex flex-col justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ebony-primary mb-3"></div>
                        <p className="text-ebony-muted text-xs font-bold uppercase tracking-widest animate-pulse">Carregando...</p>
                    </div>
                ) : (
                    <div className="max-w-6xl mx-auto space-y-4">

                        {/* 1. INFO DO ALUNO (BARRA FINA) */}
                        <div className="bg-ebony-surface px-4 py-2.5 rounded-xl border border-ebony-border shadow-sm flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                                <User className="w-4 h-4 text-ebony-muted shrink-0" />
                                <h1 className="text-sm font-black text-white leading-none">{detalhesCarregados.nome_completo}</h1>
                            </div>
                        </div>

                        {/* 2. FEEDBACKS LADO A LADO (COMPACTO) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-ebony-surface p-2.5 rounded-xl border border-ebony-border">
                                <h3 className="text-ebony-muted text-[10px] uppercase font-bold tracking-widest mb-1.5 flex items-center gap-2">
                                    <Activity size={12} /> Feedback do Aluno
                                </h3>
                                <div className="bg-ebony-deep/50 p-2 rounded-lg border border-ebony-border text-gray-300 text-xs italic overflow-y-auto" style={{ minHeight: '3.6em', maxHeight: '10em' }}>
                                    {detalhesCarregados.feedback_do_aluno ? <span className="text-yellow-500/90 not-italic">"{detalhesCarregados.feedback_do_aluno}"</span> : <span className="opacity-40 not-italic">Nenhum feedback.</span>}
                                </div>
                            </div>

                            <div className="bg-ebony-surface p-2.5 rounded-xl border border-ebony-border focus-within:border-ebony-primary/50 transition-colors">
                                <div className="flex items-center justify-between mb-1.5">
                                    <h3 className="text-ebony-primary text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                                        <CheckCircle size={12} /> Seu Feedback
                                    </h3>
                                    <button
                                        onClick={() => {
                                            const val = document.getElementById('feedback-input').value;
                                            salvarFeedback(val);
                                        }}
                                        disabled={saving}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-ebony-primary hover:bg-red-900 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                                    >
                                        {saving ? <div className="animate-spin w-3 h-3 border-2 border-white rounded-full border-t-transparent" /> : <><Save size={10} /> Salvar</>}
                                    </button>
                                </div>
                                <textarea
                                    className="w-full bg-ebony-deep text-white p-2 rounded-lg border border-ebony-border focus:border-ebony-primary focus:ring-0 outline-none text-xs resize-none overflow-hidden"
                                    defaultValue={detalhesCarregados.feedback_do_profissional || ""}
                                    placeholder="Digite seu feedback..."
                                    id="feedback-input"
                                    rows={3}
                                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                />
                            </div>
                        </div>

                        {/* 3. TABELAS (AGORA PUXANDO NOMES CORRETOS) */}
                        <SectionTable
                            title="Musculação"
                            items={detalhesCarregados.planilha_de_treino || []}
                            type="strength"
                            icon={<Dumbbell size={16} className="text-white" />}
                            headerExtra={
                                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wide text-ebony-muted">
                                    <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(detalhesCarregados.data_e_hora_do_inicio).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1 bg-ebony-primary/20 text-white px-2 py-0.5 rounded border border-ebony-primary/30"><Clock size={11} /> {detalhesCarregados.tempo_total_de_treino}</span>
                                    <span className="flex items-center gap-1 text-ebony-primary"><Dumbbell size={11} /> {detalhesCarregados.treino_label}</span>
                                </div>
                            }
                        />

                        <SectionTable
                            title="Cardio"
                            items={detalhesCarregados.aerobicos || []}
                            type="simple"
                            icon={<Activity size={16} className="text-white" />}
                        />

                        <SectionTable
                            title="Alongamentos"
                            items={detalhesCarregados.planilha_de_alongamentos_ || []}
                            type="simple"
                            icon={<TrendingUp size={16} className="text-white" />}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

const StatusBadge = ({ status, minimal = false }) => {
    const isFinalizado = ['Finalizado', 'Concluído', 'Realizado'].includes(status);

    if (minimal) {
        return (
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${isFinalizado ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]' : 'bg-yellow-500'}`} title={status} />
        );
    }

    return (
        <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border shadow-lg flex items-center gap-2 ${isFinalizado
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isFinalizado ? 'bg-green-400' : 'bg-yellow-400'}`} />
            {status || 'Pendente'}
        </span>
    );
};

const SectionTable = ({ title, items, type, icon, headerExtra }) => {
    if (!items || !Array.isArray(items) || items.length === 0) return null;

    return (
        <div className="bg-ebony-surface rounded-xl overflow-hidden border border-ebony-border shadow-md">
            <div className="bg-ebony-deep px-5 py-3 border-b border-ebony-border flex items-center gap-2">
                {icon}
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h2>
                {headerExtra && <div className="ml-2 hidden md:flex">{headerExtra}</div>}
                <span className="ml-auto text-[10px] text-white font-bold font-mono bg-ebony-primary/30 border border-ebony-primary/40 px-2 py-0.5 rounded">
                    {items.length}
                </span>
            </div>

            <div className="divide-y divide-ebony-border/30">
                {items.map((item, idx) => {
                    if (!item) return null;

                    // --- CORREÇÃO DE NOMES SUMIDOS ---
                    // O Frappe muda o nome do campo dependendo da tabela filha.
                    console.log("ITEM COMPLETO:", JSON.stringify(item));
                    const exerciseName =
                        item.exercicio ||         // Padrão
                        item.exercicios ||        // Plural (comum em aeróbicos)
                        item.activity ||          // Atividade
                        item.nome_do_exercicio || // Variação
                        item.name ||              // Fallback técnico
                        "Exercício sem nome";

                    return (
                        <div key={idx} className="p-3 hover:bg-white/[0.02] transition-colors group">
                            {/* Nome do Exercício */}
                            <div className="flex items-center gap-2.5">
                                <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor] shrink-0 ${!!item.realizado ? 'bg-green-500 text-green-500' : 'bg-red-500 text-red-500'}`}></div>
                                <h4 className={`text-sm font-bold truncate ${!!item.realizado ? 'text-white' : 'text-ebony-muted line-through decoration-red-900/50'}`}>
                                    {exerciseName}
                                </h4>
                            </div>

                            {/* Cargas / Séries (aparece para todos os tipos) */}
                            <div className="mt-1 ml-4 flex flex-wrap gap-1.5">
                                <RenderSeriesCompact seriesString={item.series} />
                            </div>

                            {/* Feedback do aluno (linha abaixo) */}
                            {item.feedback_do_aluno && (
                                <div className="mt-1 ml-4">
                                    <span className="text-[10px] text-yellow-500/90 italic flex items-center gap-1.5">
                                        <MessageSquare size={10} className="shrink-0" />
                                        "{item.feedback_do_aluno}"
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- RENDERIZADOR DE CARGAS (Ultra Compacto) ---
const RenderSeriesCompact = ({ seriesString }) => {
    if (!seriesString) {
        return <span className="text-[10px] text-ebony-muted italic">não preenchida</span>;
    }

    try {
        let series = typeof seriesString === 'object' ? seriesString : JSON.parse(seriesString);
        if (typeof series === 'string') series = JSON.parse(series);
        if (!Array.isArray(series) || series.length === 0) {
            return <span className="text-[10px] text-ebony-muted italic">não preenchida</span>;
        }

        const seriesValidas = series.filter(s => s.carga || s.repeticoes);
        if (seriesValidas.length === 0) {
            return <span className="text-[10px] text-ebony-muted italic">não preenchida</span>;
        }

        return seriesValidas.map((s, i) => (
            <div key={i} className="flex items-center gap-1 bg-ebony-deep border border-ebony-border rounded px-1.5 py-0.5 text-[10px] select-none hover:border-ebony-primary/50 transition-colors">
                {s.carga > 0 ? (
                    <>
                        <span className="text-white font-bold font-mono">{s.carga}kg</span>
                        <span className="text-ebony-muted text-[8px]">x</span>
                        <span className="text-ebony-muted font-medium">{s.repeticoes}</span>
                    </>
                ) : (
                    <span className="text-ebony-muted font-medium">{s.repeticoes} reps</span>
                )}
            </div>
        ));
    } catch (e) {
        return <span className="text-[10px] text-ebony-muted italic">não preenchida</span>;
    }
};