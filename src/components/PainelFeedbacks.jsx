import React, { useState, useEffect, useMemo, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { functions, db, auth } from "../firebase";
import {
  ChevronLeft, ChevronRight, Activity,
  Calendar, ArrowLeft, Search, User,
  CheckCircle, MessageSquare, FileText,
  Star, Eye, EyeOff, Filter, RefreshCw,
  Columns, X, Clock
} from 'lucide-react';

const FRAPPE_URL = "https://shapefy.online";
const ITEMS_PER_PAGE = 20;

// === SUBCOMPONENTE: IMAGEM INTERATIVA (ESTILO CANVA) ===
const ImagemInterativa = ({ id, index, src, rotation90, onRotate90 }) => {
  // Chave única para salvar os ajustes dessa foto específica no navegador
  const storageKey = `shapefy_img_${id}_${index}`;

  // Tenta carregar os ajustes salvos na memória do navegador
  const savedSettings = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; }
  }, [storageKey]);

  const [scale, setScale] = useState(savedSettings?.scale || 1);
  const [pos, setPos] = useState(savedSettings?.pos || { x: 0, y: 0 });
  const [align, setAlign] = useState(savedSettings?.align || 0); // Rotação fina

  const [isDragging, setIsDragging] = useState(false);
  const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });

  // Salva automaticamente no navegador sempre que você ajusta algo (com delay de 500ms para performance)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scale !== 1 || pos.x !== 0 || pos.y !== 0 || align !== 0) {
        localStorage.setItem(storageKey, JSON.stringify({ scale, pos, align }));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [scale, pos, align, storageKey]);

  // Controles do Mouse
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartDrag({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPos({ x: e.clientX - startDrag.x, y: e.clientY - startDrag.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Limpar ajustes
  const resetarAjustes = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
    setAlign(0);
    localStorage.removeItem(storageKey);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Controles */}
      <div className="flex flex-col w-full gap-3 px-1 bg-ebony-deep/40 p-3 rounded-lg border border-ebony-border/50">

        {/* Linha 1: Botão 90º e Reset */}
        <div className="flex items-center justify-between w-full">
          <button
            onClick={onRotate90}
            className="text-[10px] flex items-center gap-1 bg-ebony-surface px-3 py-1.5 rounded border border-ebony-border hover:border-ebony-primary text-white transition-all shrink-0 font-bold"
          >
            <RefreshCw size={10} /> Virar 90° ({rotation90}°)
          </button>

          {(scale !== 1 || pos.x !== 0 || pos.y !== 0 || align !== 0) && (
            <button
              onClick={resetarAjustes}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors bg-red-400/10 px-2 py-1.5 rounded font-bold"
            >
              Resetar
            </button>
          )}
        </div>

        {/* Linha 2: Sliders de Zoom e Alinhamento */}
        <div className="flex items-center gap-4 w-full">
          {/* Zoom Suave */}
          <div className="flex flex-col gap-1.5 flex-1">
            <span className="text-[9px] text-ebony-muted uppercase font-bold flex justify-between">
              Zoom <span>{scale.toFixed(2)}x</span>
            </span>
            <input
              type="range"
              min="0.5" max="3" step="0.01" // Step 0.01 garante a suavidade
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full accent-ebony-primary h-1 bg-ebony-border rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Alinhamento Fino */}
          <div className="flex flex-col gap-1.5 flex-1">
            <span className="text-[9px] text-ebony-muted uppercase font-bold flex justify-between">
              Alinhar <span>{align}°</span>
            </span>
            <input
              type="range"
              min="-45" max="45" step="0.5" // Permite girar milimetricamente
              value={align}
              onChange={(e) => setAlign(parseFloat(e.target.value))}
              className="w-full accent-blue-500 h-1 bg-ebony-border rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Container da Imagem */}
      <div
        className="overflow-hidden flex justify-center items-center bg-black/20 rounded-lg p-0 h-[80vw] md:h-[400px] w-full relative group"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt="Feedback"
          draggable={false}
          className="max-h-full max-w-full rounded-lg object-contain"
          style={{
            // Aplica a rotação de 90 graus MAIS a rotação de alinhamento fino
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale}) rotate(${rotation90 + align}deg)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        />
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-white/10 rounded-lg pointer-events-none transition-colors" />
      </div>
      <span className="text-[9px] text-ebony-muted text-center w-full">Clique e arraste para reposicionar a foto</span>
    </div>
  );
};

const FeedbackProfissional = ({ feedbackInicial, feedbackId, functions }) => {
  const [feedbackTexto, setFeedbackTexto] = React.useState(feedbackInicial || '');
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const salvar = httpsCallable(functions, 'salvarFeedbackProfissional');
      await salvar({ id: feedbackId, texto: feedbackTexto });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar feedback.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="bg-ebony-surface rounded-xl border border-ebony-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-ebony-muted uppercase tracking-wider">Feedback do Profissional</h3>
        {salvo && <span className="text-green-400 text-xs font-bold flex items-center gap-1"><CheckCircle size={12} /> Salvo!</span>}
      </div>
      <textarea
        rows={4}
        value={feedbackTexto}
        onChange={(e) => setFeedbackTexto(e.target.value)}
        placeholder="Digite seu feedback para o aluno..."
        className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary placeholder-gray-600 text-sm resize-none transition-colors"
      />
      <button
        onClick={handleSalvar}
        disabled={salvando}
        className="px-4 py-2 bg-ebony-primary hover:bg-red-900 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        {salvando ? <RefreshCw size={12} className="animate-spin" /> : null}
        {salvando ? 'Salvando...' : 'Salvar Feedback'}
      </button>
    </div>
  );
};

export default function PainelFeedbacks() {
  // === ESTADOS ===
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'compare'
  const [listaFeedbacks, setListaFeedbacks] = useState([]);
  const [feedbackSelecionado, setFeedbackSelecionado] = useState(null);
  const [detalhesCarregados, setDetalhesCarregados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  // NOVO: Estado para guardar as rotações vindas do backend
  const [rotations, setRotations] = useState({});


  // Filtros
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Filtro de formulário salvo (persiste no localStorage)
  const [formulariosSalvos, setFormulariosSalvos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('feedbackFormulariosSalvos') || '[]'); } catch { return []; }
  });
  const [inputFormulario, setInputFormulario] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Comparação
  const [modoComparar, setModoComparar] = useState(false);
  const [selecionadosComparar, setSelecionadosComparar] = useState([]);
  const [dadosComparacao, setDadosComparacao] = useState([]);
  const [loadingComparacao, setLoadingComparacao] = useState(false);

  // Status update no detalhe
  const [statusLocal, setStatusLocal] = useState('');
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [modoTrocarFoto, setModoTrocarFoto] = useState(false);
  const [fotosSelecionadasTroca, setFotosSelecionadasTroca] = useState([]);
  const [salvandoTroca, setSalvandoTroca] = useState(false);

  const scrollRef = useRef(null);
  const scrollPosRef = useRef(0);

  // === FUNÇÃO DE VIRAR FOTO (CORRIGIDA PARA ID) ===
  const toggleRotation = async (id, idx) => {
    const key = `${id}_${idx}`; // Chave única: ID do Feedback + Índice da Pergunta
    const currentRotation = rotations[key] || 0;
    const newRotation = currentRotation + 90;

    // 1. Atualização Otimista
    setRotations(prev => ({ ...prev, [key]: newRotation }));

    // 2. Salva no Backend
    try {
      const salvar = httpsCallable(functions, 'salvarRotacao');
      await salvar({ id: id, index: idx, rotation: newRotation });
    } catch (error) {
      console.error("Erro ao salvar rotação", error);
    }
  };

  // === HELPERS ===
  const normalizeText = (text) => {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  const formatDateTime = (dt) => {
    if (!dt) return '—';
    try {
      const d = new Date(dt.replace(' ', 'T'));
      return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return dt; }
  };

  const toggleComparar = (fb, e) => {
    e.stopPropagation();
    setSelecionadosComparar(prev => {
      const jaSelecionado = prev.find(f => f.name === fb.name);
      const novoArray = jaSelecionado
        ? prev.filter(f => f.name !== fb.name)
        : [...prev, fb];

      // UX: Se tiver itens selecionados, ativa o modo comparar automaticamente
      if (novoArray.length > 0) setModoComparar(true);

      return novoArray;
    });
  };

  const compararUltimos3 = async (fb, e) => {
    e.stopPropagation();
    const doMesmoAluno = listaFeedbacks
      .filter(f => f.nome_completo === fb.nome_completo)
      .sort((a, b) => (b.modified || b.date || '').localeCompare(a.modified || a.date || ''))
      .slice(0, 3);

    if (doMesmoAluno.length < 2) {
      alert('Este aluno tem menos de 2 feedbacks para comparar.');
      return;
    }

    setSelecionadosComparar(doMesmoAluno);
    setLoadingComparacao(true);
    setView('compare');

    try {
      const buscar = httpsCallable(functions, 'buscarFeedbacks');
      const promises = doMesmoAluno.map(f => buscar({ id: f.name }));
      const results = await Promise.all(promises);
      const dados = results.map(r => r.data.data).filter(Boolean);
      dados.sort((a, b) => (a.modified || a.date || '').localeCompare(b.modified || b.date || ''));

      const rotsBatch = {};
      dados.forEach(d => {
        const rots = d.rotations || {};
        Object.keys(rots).forEach(k => { rotsBatch[`${d.name}_${k}`] = rots[k]; });
      });
      setRotations(prev => ({ ...prev, ...rotsBatch }));
      setDadosComparacao(dados);
    } catch (error) {
      console.error("Erro na comparação rápida:", error);
      alert("Erro ao carregar feedbacks para comparação.");
      setView('list');
    } finally {
      setLoadingComparacao(false);
    }
  };
  // === FORMULÁRIOS SALVOS ===
  const adicionarFormulario = async () => {
    const val = inputFormulario.trim();
    if (!val || formulariosSalvos.includes(val)) return;

    const updated = [...formulariosSalvos, val];
    setFormulariosSalvos(updated);
    localStorage.setItem('feedbackFormulariosSalvos', JSON.stringify(updated));
    setInputFormulario('');

    try {
      const user = auth.currentUser;
      if (!user) return;
      const ref = doc(db, "users", user.uid, "settings", "painel_feedbacks");
      await setDoc(ref, { formulariosSalvos: updated }, { merge: true });
    } catch (e) {
      console.error("Erro ao salvar formulariosSalvos no Firestore:", e);
    }
  };


  const removerFormulario = async (id) => {
    const updated = formulariosSalvos.filter(f => f !== id);
    setFormulariosSalvos(updated);
    localStorage.setItem('feedbackFormulariosSalvos', JSON.stringify(updated));

    try {
      const user = auth.currentUser;
      if (!user) return;
      const ref = doc(db, "users", user.uid, "settings", "painel_feedbacks");
      await setDoc(ref, { formulariosSalvos: updated }, { merge: true });
    } catch (e) {
      console.error("Erro ao salvar formulariosSalvos no Firestore:", e);
    }
  };


  // === CARREGAR FORMULÁRIOS FIXADOS DO FIRESTORE (PERSISTE MESMO SEM CACHE) ===
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) return;

        const ref = doc(db, "users", user.uid, "settings", "painel_feedbacks");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() || {};
          if (Array.isArray(data.formulariosSalvos)) {
            setFormulariosSalvos(data.formulariosSalvos);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar formulariosSalvos do Firestore:", e);
      }
    });

    return () => unsub();
  }, []);


  // === CARREGAR LISTA ===
  useEffect(() => { carregarLista(); }, []);

  // === CARREGAR LISTA (ORDEM PADRÃO: DECRESCENTE) ===
  const carregarLista = async () => {
    setLoading(true);
    try {
      const buscar = httpsCallable(functions, 'buscarFeedbacks');
      const resp = await buscar({});
      if (resp.data.success) {
        // VOLTANDO AO PADRÃO: Mais recentes no topo (dateB - dateA)
        // VOLTANDO AO PADRÃO: Mais recentes no topo considerando Data e Hora exatas
        const ordenada = resp.data.list.sort((a, b) => {
          // Pega o 'modified' (que tem a hora exata). Se falhar, tenta 'creation' ou 'date'
          const timeA = a.modified || a.creation || a.date || "";
          const timeB = b.modified || b.creation || b.date || "";

          // Como o padrão do banco é YYYY-MM-DD HH:MM:SS, a comparação alfabética ordena perfeitamente
          return timeB.localeCompare(timeA);
        });
        setListaFeedbacks(ordenada);
      }
    } catch (error) {
      console.error("Erro ao buscar feedbacks", error);
    } finally {
      setLoading(false);
    }
  };

  // === FILTRO + PAGINAÇÃO ===
  const feedbacksFiltrados = useMemo(() => {
    return listaFeedbacks.filter(f => {
      const nomeOk = normalizeText(f.nome_completo).includes(normalizeText(filtroNome));
      const formularioOk = formulariosSalvos.length === 0 || formulariosSalvos.includes(f.formulario);
      const dataFeedback = f.date || '';
      const dataInicioOk = !filtroDataInicio || dataFeedback >= filtroDataInicio;
      const dataFimOk = !filtroDataFim || dataFeedback <= filtroDataFim;
      const statusOk = filtroNome.trim() !== '' || (filtroStatus ? f.status === filtroStatus : true);
      return nomeOk && formularioOk && dataInicioOk && dataFimOk && statusOk;
    });
  }, [listaFeedbacks, filtroNome, formulariosSalvos, filtroDataInicio, filtroDataFim, filtroStatus]);

  const feedbacksPaginados = useMemo(() => {
    return feedbacksFiltrados.slice(0, paginaAtual * ITEMS_PER_PAGE);
  }, [feedbacksFiltrados, paginaAtual]);

  const temMais = feedbacksPaginados.length < feedbacksFiltrados.length;

  // Reset página ao mudar filtro
  useEffect(() => { setPaginaAtual(1); }, [filtroNome, formulariosSalvos, filtroDataInicio, filtroDataFim]);

  // === ABRIR FEEDBACK (CARREGAR ROTAÇÃO COM ID) ===
  const abrirFeedback = async (feedbackBase, manterScroll = false) => {
    setFeedbackSelecionado(feedbackBase);
    setView('detail');
    setStatusLocal(feedbackBase.status || 'Respondido');

    if (!manterScroll) {
      setLoadingDetalhe(true);
      setDetalhesCarregados(null);
      scrollPosRef.current = 0;
    }

    try {
      const buscar = httpsCallable(functions, 'buscarFeedbacks');
      const resp = await buscar({ id: feedbackBase.name });
      if (resp.data.success) {
        setDetalhesCarregados(resp.data.data);
        setStatusLocal(resp.data.data.status || 'Respondido');

        // NOVO: Mapeia rotações para o formato "ID_Index"
        const rotsVindas = resp.data.data.rotations || {};
        const rotsFormatadas = {};
        Object.keys(rotsVindas).forEach(k => {
          rotsFormatadas[`${resp.data.data.name}_${k}`] = rotsVindas[k];
        });
        setRotations(prev => ({ ...prev, ...rotsFormatadas }));
      }
    } catch (error) {
      console.error("Erro ao detalhar", error);
    } finally {
      setLoadingDetalhe(false);
      if (manterScroll) {
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollPosRef.current;
        }, 150);
      }
    }
  };

  // === NAVEGAR ENTRE FEEDBACKS ===
  const navegar = (direcao) => {
    if (!feedbackSelecionado) return;
    const indexAtual = feedbacksFiltrados.findIndex(f => f.name === feedbackSelecionado.name);
    if (indexAtual === -1) return;
    const novoIndex = indexAtual + direcao;
    if (novoIndex >= 0 && novoIndex < feedbacksFiltrados.length) {
      if (scrollRef.current) scrollPosRef.current = scrollRef.current.scrollTop;
      abrirFeedback(feedbacksFiltrados[novoIndex], true);
    }
  };

  const selecionarFotoParaTroca = (feedbackId, idx) => {
    const key = `${feedbackId}_${idx}`;
    setFotosSelecionadasTroca(prev => {
      const jaExiste = prev.find(f => f.key === key);
      if (jaExiste) return prev.filter(f => f.key !== key);
      if (prev.length >= 2) return prev;
      return [...prev, { key, feedbackId, idx }];
    });
  };

  const confirmarTrocaFotos = async () => {
    const [f1, f2] = fotosSelecionadasTroca;
    if (!f1 || !f2) return;
    if (f1.feedbackId !== f2.feedbackId) {
      alert('Só é possível trocar fotos dentro do mesmo feedback.');
      return;
    }

    setSalvandoTroca(true);

    // Atualização otimista — detalhe
    if (detalhesCarregados) {
      const novas = [...detalhesCarregados.perguntas_e_respostas];
      const url1 = novas[f1.idx]?.resposta;
      const url2 = novas[f2.idx]?.resposta;
      novas[f1.idx] = { ...novas[f1.idx], resposta: url2 };
      novas[f2.idx] = { ...novas[f2.idx], resposta: url1 };
      setDetalhesCarregados({ ...detalhesCarregados, perguntas_e_respostas: novas });
    }

    // Atualização otimista — comparação
    setDadosComparacao(prev => prev.map(fb => {
      if (fb.name !== f1.feedbackId) return fb;
      const novas = [...fb.perguntas_e_respostas];
      const url1 = novas[f1.idx]?.resposta;
      const url2 = novas[f2.idx]?.resposta;
      novas[f1.idx] = { ...novas[f1.idx], resposta: url2 };
      novas[f2.idx] = { ...novas[f2.idx], resposta: url1 };
      return { ...fb, perguntas_e_respostas: novas };
    }));

    setFotosSelecionadasTroca([]);
    setModoTrocarFoto(false);

    try {
      const trocar = httpsCallable(functions, 'trocarFotosFeedback');
      await trocar({ id: f1.feedbackId, index1: f1.idx, index2: f2.idx });
    } catch (err) {
      console.error('Erro ao trocar fotos:', err);
      alert('Erro ao salvar a troca no servidor.');
    } finally {
      setSalvandoTroca(false);
    }
  };
  // === SALVAR STATUS NO FRAPPE ===
  const salvarStatus = async (novoStatus) => {
    if (!feedbackSelecionado) return;
    setSalvandoStatus(true);
    try {
      const atualizar = httpsCallable(functions, 'atualizarStatusFeedback');
      await atualizar({ id: feedbackSelecionado.name, status: novoStatus });
      setStatusLocal(novoStatus);
      setListaFeedbacks(prev => prev.map(f =>
        f.name === feedbackSelecionado.name ? { ...f, status: novoStatus } : f
      ));
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao salvar status no Frappe.");
    } finally {
      setSalvandoStatus(false);
    }
  };

  // === COMPARAR (CARREGAR ROTAÇÕES DE TODOS) ===
  const iniciarComparacao = async () => {
    if (selecionadosComparar.length < 2) return; // Botão já controla isso, mas por segurança
    setLoadingComparacao(true);
    setView('compare');
    try {
      const buscar = httpsCallable(functions, 'buscarFeedbacks');
      const promises = selecionadosComparar.map(fb => buscar({ id: fb.name }));
      const results = await Promise.all(promises);

      const dados = results.map(r => r.data.data).filter(Boolean);
      dados.sort((a, b) => (a.modified || a.date || '').localeCompare(b.modified || b.date || ''));

      // Carrega rotações de TODOS os feedbacks da comparação
      const rotsBatch = {};
      dados.forEach(d => {
        const rots = d.rotations || {};
        Object.keys(rots).forEach(k => {
          rotsBatch[`${d.name}_${k}`] = rots[k];
        });
      });
      setRotations(prev => ({ ...prev, ...rotsBatch })); // Funde com o estado atual

      setDadosComparacao(dados);
    } catch (error) {
      console.error("Erro na comparação:", error);
      alert("Erro ao carregar feedbacks para comparação.");
      setView('list');
    } finally {
      setLoadingComparacao(false);
    }
  };

  // ================================================================
  // VIEW: COMPARAÇÃO
  // ================================================================
  if (view === 'compare') {
    const base = dadosComparacao[0]?.perguntas_e_respostas || [];

    return (
      <div className="w-full h-full flex flex-col bg-ebony-bg text-ebony-text animate-in fade-in duration-300">
        <div className="shrink-0 bg-ebony-bg/95 backdrop-blur-md z-20 border-b border-ebony-border px-6 py-3 flex items-center justify-between">
          <button onClick={() => { setView('list'); setModoComparar(false); setSelecionadosComparar([]); }} className="flex items-center gap-2 text-ebony-muted hover:text-white transition-colors text-xs font-bold uppercase tracking-wide">
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ebony-muted font-bold uppercase tracking-wider">
              Comparando {dadosComparacao.length} feedbacks
            </span>
            {!modoTrocarFoto ? (
              <button
                onClick={() => { setModoTrocarFoto(true); setFotosSelecionadasTroca([]); }}
                className="px-3 py-1.5 bg-ebony-surface border border-ebony-border hover:border-orange-500/50 text-orange-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
              >
                🔄 Trocar Fotos
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-orange-300 font-bold">{fotosSelecionadasTroca.length}/2 selecionadas</span>
                <button
                  onClick={confirmarTrocaFotos}
                  disabled={fotosSelecionadasTroca.length !== 2 || salvandoTroca}
                  className="px-3 py-1.5 bg-orange-500/20 border border-orange-500/40 text-orange-300 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
                >
                  {salvandoTroca ? 'Salvando...' : 'Confirmar Troca'}
                </button>
                <button
                  onClick={() => { setModoTrocarFoto(false); setFotosSelecionadasTroca([]); }}
                  className="px-2 py-1.5 bg-ebony-surface border border-ebony-border hover:border-red-500/50 text-red-400 rounded-lg text-xs font-bold transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {loadingComparacao ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ebony-primary"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              {/* Header */}
              <div className="bg-ebony-surface px-4 py-3 rounded-xl border border-ebony-border mb-4">
                <h1 className="text-sm font-black text-white">
                  {dadosComparacao[0]?.nome_completo} — {dadosComparacao[0]?.titulo}
                </h1>
                <p className="text-[10px] text-ebony-muted mt-1">Avaliações: {dadosComparacao.length}</p>
              </div>

              {/* Tabela */}
              <div className="bg-ebony-surface rounded-xl border border-ebony-border overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-ebony-deep border-b border-ebony-border">
                      <th className="p-3 text-[10px] font-bold text-ebony-muted uppercase tracking-wider sticky left-0 bg-ebony-deep z-10 min-w-[200px] w-48">Pergunta</th>
                      {dadosComparacao.map((fb, i) => (
                        <th key={i} className="p-3 text-[10px] font-bold text-white uppercase tracking-wider text-center min-w-[200px]">
                          {(fb.modified || fb.date)
                            ? new Date((fb.modified || fb.date).split(' ')[0] + 'T00:00:00').toLocaleDateString('pt-BR')
                            : '—'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ebony-border/40">
                    {base.map((item, idx) => {
                      if (item.tipo === 'Section Break') {
                        return (
                          <tr key={idx} className="bg-ebony-deep/50">
                            <td colSpan={dadosComparacao.length + 1} className="p-3">
                              <h3 className="text-xs font-bold text-white uppercase tracking-wider bg-ebony-primary/10 border-l-4 border-ebony-primary px-4 py-3 rounded-r-lg flex items-center gap-2">
                                <Activity size={12} className="text-ebony-primary" />
                                {item.pergunta}
                              </h3>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="p-3 text-xs text-white font-bold sticky left-0 bg-ebony-surface z-10 border-r border-ebony-border/30">
                            {item.pergunta}
                          </td>
                          {dadosComparacao.map((fb, fi) => {
                            const resposta = fb.perguntas_e_respostas?.[idx];
                            if (!resposta || !resposta.resposta) return <td key={fi} className="p-3 text-center text-ebony-muted text-xs">—</td>;

                            if (resposta.tipo === 'Attach Image') {
                              const rotationKey = `${fb.name}_${idx}`;
                              const rotation = rotations[rotationKey] || 0;

                              return (
                                <td key={fi} className="p-3 text-center align-top">
                                  <div className="relative">
                                    <ImagemInterativa
                                      id={fb.name}
                                      index={idx}
                                      src={`${FRAPPE_URL}${resposta.resposta}`}
                                      rotation90={rotation}
                                      onRotate90={() => toggleRotation(fb.name, idx)}
                                    />
                                    {modoTrocarFoto && (() => {
                                      const key = `${fb.name}_${idx}`;
                                      const ordemSel = fotosSelecionadasTroca.findIndex(f => f.key === key);
                                      const selecionada = ordemSel !== -1;
                                      return (
                                        <div
                                          onClick={() => selecionarFotoParaTroca(fb.name, idx)}
                                          className={`absolute inset-0 rounded-lg cursor-pointer flex items-start justify-end p-2 transition-all z-10 ${selecionada ? 'bg-orange-500/20 border-2 border-orange-400' : 'bg-black/30 border-2 border-dashed border-orange-400/40 hover:bg-orange-500/10'}`}
                                        >
                                          {selecionada && (
                                            <span className="bg-orange-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                                              {ordemSel + 1}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                              );
                            }

                            if (resposta.tipo === 'Rating') {
                              const val = parseInt(resposta.resposta) || 0;
                              const max = parseInt(resposta.opcoes) || 5;
                              return (
                                <td key={fi} className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-0.5">
                                    {Array.from({ length: max }, (_, i) => (
                                      <Star key={i} size={14} className={i < val ? 'text-yellow-400 fill-yellow-400' : 'text-ebony-border'} />
                                    ))}
                                    <span className="text-ebony-muted text-[10px] ml-1">{val}/{max}</span>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={fi} className="p-3 text-xs text-white text-center whitespace-pre-wrap">
                                {resposta.resposta}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================================================================
  // VIEW: LISTA
  // ================================================================
  if (view === 'list') {
    return (
      <div className="w-full h-full p-6 animate-in fade-in duration-500 bg-ebony-bg text-ebony-text">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              <span className="p-2 bg-ebony-primary rounded-lg shadow-[0_0_15px_rgba(133,0,0,0.5)]">
                <MessageSquare className="w-6 h-6 text-white" />
              </span>
              Feedbacks Recebidos
            </h1>
            <p className="text-ebony-muted text-sm mt-1 font-medium">
              {feedbacksFiltrados.length} feedback(s) encontrado(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* BOTÃO COMPARAR */}
            {!modoComparar ? (
              <button
                onClick={() => setModoComparar(true)}
                className="px-4 py-2.5 bg-ebony-surface border border-ebony-border hover:border-blue-500/50 text-blue-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <Columns className="w-4 h-4" /> Comparar
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-300 font-bold">{selecionadosComparar.length} selecionado(s)</span>
                <button
                  onClick={iniciarComparacao}
                  disabled={selecionadosComparar.length < 2}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  <Columns className="w-4 h-4" /> Comparar ({selecionadosComparar.length})
                </button>
                <button
                  onClick={() => { setModoComparar(false); setSelecionadosComparar([]); }}
                  className="px-3 py-2.5 bg-ebony-surface border border-ebony-border hover:border-red-500/50 text-red-400 rounded-lg text-xs font-bold transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <button
              onClick={carregarLista}
              className="px-5 py-2.5 bg-ebony-surface border border-ebony-border hover:border-ebony-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-lg hover:shadow-ebony-primary/20 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Atualizar
            </button>
          </div>
        </div>

        {/* FILTRO DE FORMULÁRIOS SALVOS */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="ID do formulário (ex: lh7dq5haei)"
                className="w-full pl-3 pr-3 py-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none transition-colors text-xs font-mono"
                value={inputFormulario}
                onChange={(e) => setInputFormulario(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') adicionarFormulario(); }}
              />
            </div>
            <button
              onClick={adicionarFormulario}
              className="px-3 py-2 bg-ebony-surface border border-ebony-border hover:border-ebony-primary text-white rounded-lg text-xs font-bold transition-all"
            >
              Fixar
            </button>
          </div>
          {formulariosSalvos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formulariosSalvos.map(id => (
                <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ebony-deep border border-ebony-border rounded-lg text-xs font-mono text-blue-300">
                  {id}
                  <button onClick={() => removerFormulario(id)} className="text-ebony-muted hover:text-red-400 transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
              <span className="text-[10px] text-ebony-muted self-center">← Mostrando apenas estes formulários</span>
            </div>
          )}
        </div>

        {/* FILTROS */}
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
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3 py-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none transition-colors text-sm font-medium"
          >
            <option value="">Todos os status</option>
            <option value="Respondido">Respondido</option>
            <option value="Finalizado">Finalizado</option>
          </select>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative">
              <label className="absolute -top-2 left-2 text-[9px] text-ebony-muted font-bold uppercase tracking-wider bg-ebony-bg px-1 z-10">De</label>
              <input type="date" className="w-full md:w-40 px-3 py-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none transition-colors text-sm font-medium" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
            </div>
            <div className="relative">
              <label className="absolute -top-2 left-2 text-[9px] text-ebony-muted font-bold uppercase tracking-wider bg-ebony-bg px-1 z-10">Até</label>
              <input type="date" className="w-full md:w-40 px-3 py-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none transition-colors text-sm font-medium" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
            </div>
          </div>
        </div>

        {/* TABELA */}
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 opacity-50">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ebony-primary mb-4"></div>
            <p className="text-ebony-muted text-xs uppercase tracking-widest animate-pulse">Sincronizando...</p>
          </div>
        ) : (
          <div className="bg-ebony-surface rounded-xl shadow-2xl border border-ebony-border overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-ebony-deep border-b border-ebony-border">
                <tr>
                  <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider w-10 text-center">
                    {/* Checkbox geral ou título, se necessário. Por enquanto vazio para alinhar com os checkboxes das linhas */}
                  </th>
                  <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider">Aluno</th>
                  <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider min-w-[250px]">Formulário</th>
                  <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider">Respondido em</th>
                  <th className="p-4 text-[10px] font-bold text-ebony-muted uppercase tracking-wider text-center">Status</th>
                  <th className="p-4 text-right text-[10px] font-bold text-ebony-muted uppercase tracking-wider">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ebony-border/40">
                {feedbacksPaginados.map((fb) => {
                  const isSelecionadoComparar = selecionadosComparar.some(f => f.name === fb.name);
                  return (
                    <tr
                      key={fb.name}
                      onClick={() => abrirFeedback(fb)}
                      className={`hover:bg-white/5 transition-colors cursor-pointer group ${isSelecionadoComparar ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}`}
                    >
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-row items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => toggleComparar(fb, e)}
                            className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all mx-auto ${isSelecionadoComparar
                              ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                              : 'border-ebony-border hover:border-blue-400 text-transparent hover:text-blue-400'
                              }`}
                          >
                            <CheckCircle size={12} />
                          </button>
                          <button
                            onClick={(e) => compararUltimos3(fb, e)}
                            title="Comparar últimos 3 feedbacks"
                            className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded hover:bg-blue-500/20 font-bold transition-all opacity-0 group-hover:opacity-100 whitespace-nowrap"
                          >
                            ⚡ 3
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-sm">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-white group-hover:text-ebony-primary transition-colors">
                            {fb.nome_completo}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-ebony-deep rounded border border-ebony-border font-mono text-xs text-blue-300">
                          {fb.titulo || fb.formulario}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-white text-xs font-bold">
                            {fb.modified ? (() => {
                              try {
                                const datePart = (fb.modified.split(' ')[0] || '');
                                return new Date(datePart + 'T00:00:00').toLocaleDateString('pt-BR');
                              } catch { return '—'; }
                            })() : '—'}
                          </span>



                          <span className="text-ebony-muted text-[10px] mt-0.5 flex items-center gap-1">
                            <Clock size={9} />
                            {fb.modified ? (() => {
                              try {
                                const timePart = (fb.modified.split(' ')[1] || '');
                                return timePart.slice(0, 5); // HH:MM do modified
                              } catch { return ''; }
                            })() : ''}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={fb.status || 'Respondido'}
                          onChange={async (e) => {
                            const novoStatus = e.target.value;
                            // Atualização otimista local
                            setListaFeedbacks(prev => prev.map(item =>
                              item.name === fb.name ? { ...item, status: novoStatus } : item
                            ));
                            try {
                              const atualizar = httpsCallable(functions, 'atualizarStatusFeedback');
                              await atualizar({ id: fb.name, status: novoStatus });
                            } catch (err) {
                              console.error("Erro ao atualizar status na lista", err);
                              alert("Erro ao salvar status.");
                            }
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border outline-none cursor-pointer appearance-none text-center w-full ${fb.status === 'Finalizado'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            }`}
                        >
                          <option value="Respondido" className="bg-ebony-deep text-purple-400">Respondido</option>
                          <option value="Finalizado" className="bg-ebony-deep text-green-400">Finalizado</option>
                        </select>
                      </td>
                      {/* Coluna Verificado removida */}
                      <td className="p-4 text-right">
                        <ChevronRight className="w-5 h-5 text-ebony-muted group-hover:text-white inline-block transition-transform group-hover:translate-x-1" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {feedbacksPaginados.length === 0 && (
              <div className="p-12 text-center">
                <MessageSquare className="w-12 h-12 text-ebony-border mx-auto mb-3 opacity-20" />
                <p className="text-ebony-muted text-sm">Nenhum feedback encontrado.</p>
              </div>
            )}

            {/* BOTÃO CARREGAR MAIS */}
            {temMais && (
              <div className="p-4 border-t border-ebony-border text-center">
                <button
                  onClick={() => setPaginaAtual(prev => prev + 1)}
                  className="px-6 py-2.5 bg-ebony-deep border border-ebony-border hover:border-ebony-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:shadow-lg"
                >
                  Carregar mais feedbacks ({feedbacksFiltrados.length - feedbacksPaginados.length} restantes)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ================================================================
  // VIEW: DETALHES
  // ================================================================
  return (
    <div className="w-full h-full flex flex-col bg-ebony-bg text-ebony-text animate-in slide-in-from-right-8 duration-300">

      {/* HEADER */}
      <div className="shrink-0 bg-ebony-bg/95 backdrop-blur-md z-20 border-b border-ebony-border px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-ebony-muted hover:text-white transition-colors text-xs font-bold uppercase tracking-wide"
        >
          <ArrowLeft size={16} /> Voltar
        </button>

        {/* STATUS DROPDOWN */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-ebony-muted font-bold uppercase tracking-wider hidden md:block">Status:</span>
          <select
            value={statusLocal}
            onChange={(e) => salvarStatus(e.target.value)}
            disabled={salvandoStatus}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border outline-none cursor-pointer transition-all ${statusLocal === 'Finalizado'
              ? 'bg-green-500/10 text-green-400 border-green-500/30'
              : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
              } ${salvandoStatus ? 'opacity-50' : ''}`}
          >
            <option value="Respondido">Respondido</option>
            <option value="Finalizado">Finalizado</option>
          </select>
          {salvandoStatus && <RefreshCw size={14} className="text-ebony-muted animate-spin" />}

          {!modoTrocarFoto ? (
            <button
              onClick={() => { setModoTrocarFoto(true); setFotosSelecionadasTroca([]); }}
              className="px-3 py-1.5 bg-ebony-surface border border-ebony-border hover:border-orange-500/50 text-orange-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
            >
              🔄 Trocar Fotos
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-orange-300 font-bold">{fotosSelecionadasTroca.length}/2 selecionadas</span>
              <button
                onClick={confirmarTrocaFotos}
                disabled={fotosSelecionadasTroca.length !== 2 || salvandoTroca}
                className="px-3 py-1.5 bg-orange-500/20 border border-orange-500/40 text-orange-300 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
              >
                {salvandoTroca ? 'Salvando...' : 'Confirmar Troca'}
              </button>
              <button
                onClick={() => { setModoTrocarFoto(false); setFotosSelecionadasTroca([]); }}
                className="px-2 py-1.5 bg-ebony-surface border border-ebony-border hover:border-red-500/50 text-red-400 rounded-lg text-xs font-bold transition-all"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 custom-scrollbar">

        {/* BOTÕES FLUTUANTES */}
        {!loadingDetalhe && detalhesCarregados && (
          <>
            <button
              onClick={() => navegar(-1)}
              disabled={feedbacksFiltrados.findIndex(f => f.name === feedbackSelecionado?.name) <= 0}
              className="fixed left-20 md:left-24 top-1/2 -translate-y-1/2 z-30 p-2 md:p-3 bg-ebony-surface/90 backdrop-blur border border-ebony-border rounded-full shadow-xl hover:bg-ebony-deep hover:border-ebony-primary/50 disabled:opacity-20 disabled:cursor-not-allowed text-white transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => navegar(1)}
              disabled={feedbacksFiltrados.findIndex(f => f.name === feedbackSelecionado?.name) >= feedbacksFiltrados.length - 1}
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
          <div className="max-w-4xl mx-auto space-y-4">

            {/* INFO DO ALUNO */}
            <div className="bg-ebony-surface px-4 py-2.5 rounded-xl border border-ebony-border shadow-sm flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-ebony-muted shrink-0" />
                <h1 className="text-sm font-black text-white leading-none">{detalhesCarregados.nome_completo}</h1>
              </div>
              <div className="flex items-center gap-3 text-ebony-muted text-[10px] font-bold uppercase tracking-wide flex-wrap">
                <span className="flex items-center gap-1"><Calendar size={11} /> {detalhesCarregados.date ? new Date(detalhesCarregados.date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                <span className="flex items-center gap-1 text-blue-300"><FileText size={11} /> {detalhesCarregados.titulo}</span>
                <span className="flex items-center gap-1">{detalhesCarregados.email}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {formatDateTime(detalhesCarregados.modified)}</span>
              </div>
            </div>

            {/* FEEDBACK DO PROFISSIONAL */}
            <FeedbackProfissional
              feedbackInicial={detalhesCarregados.feedback_do_profissional}
              feedbackId={detalhesCarregados.name}
              functions={functions}
            />

            {/* PERGUNTAS E RESPOSTAS - NOVO LAYOUT TABELA */}
            <div className="bg-ebony-surface rounded-xl border border-ebony-border overflow-hidden">
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-ebony-border/40">
                  {detalhesCarregados.perguntas_e_respostas?.map((item, idx) => {
                    // TIPO 1: QUEBRA DE SEÇÃO (Cabeçalho da Tabela)
                    if (item.tipo === 'Section Break') {
                      return (
                        <tr key={idx} className="bg-ebony-deep">
                          <td colSpan={2} className="p-4">
                            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                              {item.pergunta}
                            </h2>
                          </td>
                        </tr>
                      );
                    }

                    // TIPO 2: FOTO (Mantém layout vertical para ocupar espaço, mas dentro da tabela)
                    if (item.tipo === 'Attach Image') {
                      const rotationKey = `${detalhesCarregados.name}_${idx}`;
                      const rotation = rotations[rotationKey] || 0;
                      return (
                        <tr key={idx} className="hover:bg-white/5 transition-colors block md:table-row">
  <td className="px-4 pt-4 pb-1 w-full md:w-1/3 align-top md:border-r border-ebony-border/30 block md:table-cell">
    <h3 className="text-white text-xs font-bold leading-relaxed">{item.pergunta}</h3>
  </td>
  <td className="px-2 pb-4 md:p-4 align-top block md:table-cell w-full">
                            {item.resposta ? (
                              <div className="relative">
                                <ImagemInterativa
                                  id={detalhesCarregados.name}
                                  index={idx}
                                  src={`${FRAPPE_URL}${item.resposta}`}
                                  rotation90={rotation}
                                  onRotate90={() => toggleRotation(detalhesCarregados.name, idx)}
                                />
                                {modoTrocarFoto && (() => {
                                  const key = `${detalhesCarregados.name}_${idx}`;
                                  const ordemSel = fotosSelecionadasTroca.findIndex(f => f.key === key);
                                  const selecionada = ordemSel !== -1;
                                  return (
                                    <div
                                      onClick={() => selecionarFotoParaTroca(detalhesCarregados.name, idx)}
                                      className={`absolute inset-0 rounded-lg cursor-pointer flex items-start justify-end p-2 transition-all z-10 ${selecionada ? 'bg-orange-500/20 border-2 border-orange-400' : 'bg-black/30 border-2 border-dashed border-orange-400/40 hover:bg-orange-500/10'}`}
                                    >
                                      {selecionada && (
                                        <span className="bg-orange-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                                          {ordemSel + 1}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <span className="text-ebony-muted text-xs italic">Não enviada</span>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    // TIPO 3: TEXTO / RATING / SELECT (Layout Lado a Lado)
                    return (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        {/* COLUNA DA ESQUERDA: PERGUNTA */}
                        <td className="p-4 w-1/3 align-top border-r border-ebony-border/30">
                          <h3 className="text-white text-xs font-bold leading-relaxed">
                            {item.pergunta}
                          </h3>
                        </td>

                        {/* COLUNA DA DIREITA: RESPOSTA */}
                        <td className="p-4 align-top text-sm text-ebony-text leading-relaxed">
                          {item.tipo === 'Rating' ? (
                            <div className="flex items-center gap-1">
                              {Array.from({ length: parseInt(item.opcoes) || 5 }, (_, i) => (
                                <Star key={i} size={16} className={i < (parseInt(item.resposta) || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-ebony-border'} />
                              ))}
                              <span className="text-ebony-muted text-xs ml-2 font-mono">({item.resposta}/{item.opcoes})</span>
                            </div>
                          ) : (
                            item.resposta || <span className="text-ebony-muted italic opacity-50">Não respondida</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}