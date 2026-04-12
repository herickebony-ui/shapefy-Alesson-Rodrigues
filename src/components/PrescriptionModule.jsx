import React, { useState, useEffect, useRef } from 'react';
import { db, functions } from '../firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const fnSalvarPrescricao = httpsCallable(functions, 'salvarPrescricao');
const fnListarAlunos = httpsCallable(functions, 'listarAlunos');
const fnListarTodasPrescricoes = httpsCallable(functions, 'listarTodasPrescricoes');
const fnDeletarPrescricao = httpsCallable(functions, 'deletarPrescricao');
const fnBuscarPrescricaoDetalhe = httpsCallable(functions, 'buscarPrescricaoDetalhe');
import StudentNameWithBadge from "./StudentNameWithBadge";
import { addDoc } from 'firebase/firestore'; // NOVO: Para salvar o histórico
import {
  HeartPulse, FileText, Database, Settings, CheckCircle,
  IdCard, Pill, Plus, Save, Trash2, GripVertical, X,
  FileSignature, Search, Pen, GripHorizontal, FlaskConical, Upload,
  History, RotateCcw, Eye, Copy
} from 'lucide-react';

const PrescriptionModule = ({ students = [] }) => {
  // --- ESTADOS GERAIS ---
  const [activeTab, setActiveTab] = useState('prescricao');
  const [toastMsg, setToastMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [alunosBuscaAtiva, setAlunosBuscaAtiva] = useState([]);

  // --- ESTADOS DO BANCO (FIREBASE) ---
  const [inventory, setInventory] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [showInventoryList, setShowInventoryList] = useState(false);

  // NOVO: ID para controlar a edição (evitar duplicidade)
  const [editingId, setEditingId] = useState(null);

  // NOVO: Estados para Modelos de Observação
  const [obsModels, setObsModels] = useState([]);
  // NOVO: Sistema de Tags para Uso Terapêutico
  const [usageTags, setUsageTags] = useState([]);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [showModelSave, setShowModelSave] = useState(false); // Modalzinho de salvar
  const [newModelName, setNewModelName] = useState('');

  // --- ESTADOS DA PRESCRIÇÃO ATUAL ---
  const [currentPrescription, setCurrentPrescription] = useState([]);
  const [patientData, setPatientData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    validity: '',
    dispense: ''
  });
  const [formItem, setFormItem] = useState({
    name: '',
    dose: '',
    time: '',
    use: '', // Uso terapêutico (interno)
    internalDescription: '' // NOVO: Descrição interna do manipulado
  });
  const [generalNotes, setGeneralNotes] = useState('');

  // --- ESTADOS DO HISTÓRICO ---
  const [historyList, setHistoryList] = useState([]);

  // Estado para o Modal de Preview
  const [previewItem, setPreviewItem] = useState(null);

  // --- ESTADOS DA LISTA DE PRESCRIÇÕES ---
  const [prescricoesList, setPrescricoesList] = useState([]);
  const [prescricoesLoading, setPrescricoesLoading] = useState(false);
  const [prescricaoDetalhe, setPrescricaoDetalhe] = useState(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [modoNova, setModoNova] = useState(false);
  const [searchPrescricao, setSearchPrescricao] = useState('');
  const [pagePrescricao, setPagePrescricao] = useState(1);
  const [hasMorePrescricoes, setHasMorePrescricoes] = useState(false);
  const LIMIT_PRESCRICOES = 20;

  const carregarPrescricoes = async (search = searchPrescricao, page = pagePrescricao) => {
    setPrescricoesLoading(true);
    try {
      const res = await fnListarTodasPrescricoes({ limit: LIMIT_PRESCRICOES, page, search });
      setPrescricoesList(res.data?.list || []);
      setHasMorePrescricoes(res.data?.hasMore || false);
    } catch (e) {
      console.error("Erro ao listar prescrições:", e);
    } finally {
      setPrescricoesLoading(false);
    }
  };

  // Recarrega quando busca ou página mudam
  useEffect(() => {
    carregarPrescricoes(searchPrescricao, pagePrescricao);
  }, [searchPrescricao, pagePrescricao]);
  const abrirDetalhe = async (prescricao) => {
    setDetalheLoading(true);
    setPrescricaoDetalhe(prescricao);
    try {
      // Busca os itens completos via Frappe REST direto pela function de listar por aluno
      const res = await fnListarTodasPrescricoes({ limit: 1 });
      // Busca detalhe completo
      const apiRes = await fetch ? null : null; // detalhe via listarPrescricoes filtrando por name
    } catch (e) {
      console.error(e);
    } finally {
      setDetalheLoading(false);
    }
  };

  const excluirPrescricao = async (id, nomeAluno) => {
    if (!confirm(`Excluir prescrição de ${nomeAluno}?`)) return;
    try {
      await fnDeletarPrescricao({ prescricaoId: id });
      setPrescricoesList(prev => prev.filter(p => p.name !== id));
      setPrescricaoDetalhe(null);
      showToast("Prescrição excluída.");
    } catch (e) {
      alert("Erro ao excluir: " + e.message);
    }
  };

  const duplicarPrescricao = (p) => {
    setPatientData(prev => ({ ...prev, name: p.nome_completo, alunoId: p.aluno, date: new Date().toISOString().split('T')[0] }));
    setCurrentPrescription(
      (p.prescriptions || []).map((item, i) => ({
        uid: Date.now() + i,
        name: item.manipulated,
        dose: item.description,
        time: '',
      }))
    );
    setGeneralNotes(p.description || '');
    setPrescricaoDetalhe(null);
    setModoNova(true);
    showToast("Prescrição duplicada! Edite e salve.");
  };

  // Função para Deletar Histórico
  const deleteHistoryItem = async (id) => {
    if (!confirm("Tem certeza que deseja apagar este registro do histórico permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "prescriptions_history", id));
      setHistoryList(prev => prev.filter(item => item.id !== id));
      showToast("Registro excluído.");
    } catch (e) { console.error(e); }
  }

  // Função para carregar o histórico
  const loadHistory = async () => {
    try {
      const q = await getDocs(collection(db, "prescriptions_history"));
      // Ordena do mais recente para o mais antigo via Javascript
      const list = q.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setHistoryList(list);
    } catch (e) { console.error(e); }
  };

  // Função para Reutilizar (Clonar) uma receita antiga
  const restorePrescription = (histItem) => {
    if (currentPrescription.length > 0) {
      if (!confirm("Isso vai substituir os itens atuais. Deseja continuar?")) return;
    }

    setPatientData(prev => ({ ...prev, name: histItem.studentName, validity: histItem.validity || '' }));
    setCurrentPrescription(histItem.items || []);
    setActiveTab('prescricao'); // Joga o usuário de volta para a tela de edição
    showToast("Receita carregada! Pode editar e gerar o PDF.");
  };

  // --- ESTADOS DO FORMULÁRIO DE BANCO (CADASTRO) ---
  const [dbItem, setDbItem] = useState({
    use: '',
    name: '',
    dose: '',
    defaultTime: '',
    internalDescription: ''
  });

  // --- ESTADOS DE CONFIGURAÇÃO (LOCAL STORAGE PARA PERSISTÊNCIA RÁPIDA) ---
  const [config, setConfig] = useState({
    name: '',
    reg: '',
    logo: null,
    logoRatio: 1,
    signature: null,
    signatureRatio: 0.5,
    signatureScale: 1.0,
    signatureOffsetX: 0,
    signatureOffsetY: 0
  });

  // --- DRAG AND DROP REF ---
  const dragItem = useRef();
  const dragOverItem = useRef();

  // ==================================================================================
  // ==================================================================================
  // 1. INICIALIZAÇÃO (CARREGAR DADOS)
  // ==================================================================================
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Carrega Estoque
        const qInventory = await getDocs(collection(db, "prescription_inventory"));
        const itemsInventory = qInventory.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInventory(itemsInventory);

        // 2. NOVO: Carrega Modelos de Observação
        const qModels = await getDocs(collection(db, "prescription_obs_models"));
        const itemsModels = qModels.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setObsModels(itemsModels);

        // 3. NOVO: Carrega Tags únicas de Uso Terapêutico
        const uniqueUsages = [...new Set(itemsInventory
          .map(item => item.use)
          .filter(use => use && use.trim() !== '')
        )].sort();
        setUsageTags(uniqueUsages);

      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };

    // Carrega Configurações do LocalStorage
    const savedConfig = JSON.parse(localStorage.getItem('shapefy_config'));
    if (savedConfig) setConfig(prev => ({ ...prev, ...savedConfig }));

    loadData();
    carregarPrescricoes();
  }, []);

  // Salva Configurações sempre que mudar
  const saveConfigToLocal = () => {
    localStorage.setItem('shapefy_config', JSON.stringify(config));
    showToast("Configurações salvas!");
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // ==================================================================================
  // 2. LÓGICA DA PRESCRIÇÃO
  // ==================================================================================

  // NOVA LÓGICA: Selecionar item da lista de busca inteligente
  const handleSelectInventoryItem = (item) => {
    setFormItem({
      name: item.name || '',
      dose: item.dose || '',
      use: item.use || '',
      time: item.defaultTime || '' // Puxa o momento de uso salvo no banco
    });
    setInventorySearch(item.name); // Mostra o nome no campo de busca
    setShowInventoryList(false); // Esconde a lista
  };

  // Adicionar item à lista
  const addToPrescription = () => {
    if (!formItem.name || !formItem.time) return alert("Preencha Nome e Momento de Uso.");

    const newItem = {
      uid: Date.now(),
      ...formItem
    };

    setCurrentPrescription([...currentPrescription, newItem]);

    // Limpa apenas campos específicos, mantém o momento se quiser agilizar
    setFormItem({ name: '', dose: '', time: '', use: '' });
    setInventorySearch(''); // Limpa a busca para o próximo item
  };

  // Remover item
  const removePrescriptionItem = (uid) => {
    setCurrentPrescription(prev => prev.filter(i => i.uid !== uid));
  };

  // Editar item (Carrega de volta pro form e remove da lista)
  const editPrescriptionItem = (uid) => {
    const item = currentPrescription.find(i => i.uid === uid);
    if (item) {
      setFormItem({ name: item.name, dose: item.dose, time: item.time, use: item.use });
      removePrescriptionItem(uid);
      showToast("Item carregado para edição!");
    }
  };

  // Limpar tudo
  const clearPrescription = () => {
    if (window.confirm("Limpar toda a receita?")) {
      setCurrentPrescription([]);
      setGeneralNotes('');
      showToast("Receita limpa!");
    }
  };

  // Salvar item atual no Banco (Atalho)
  const saveCurrentToDb = async () => {
    if (!formItem.name) return alert("Preencha o nome para salvar.");
    try {
      const docRef = await addDoc(collection(db, "prescription_inventory"), {
        name: formItem.name,
        dose: formItem.dose,
        use: formItem.use,
        defaultTime: formItem.time
      });

      setInventory([...inventory, {
        id: docRef.id,
        name: formItem.name,
        dose: formItem.dose,
        use: formItem.use,
        defaultTime: formItem.time
      }]);

      // NOVO: Atualiza as tags quando salva via atalho
      if (formItem.use && formItem.use.trim() !== '' && !usageTags.includes(formItem.use.trim())) {
        setUsageTags([...usageTags, formItem.use.trim()].sort());
      }

      showToast("Salvo no Banco!");
    } catch (e) {
      console.error("Erro Real:", e);
      // AQUI ESTÁ A MUDANÇA: O alerta vai mostrar o erro técnico
      alert("Falha no Firebase: " + e.message);
    }
  };
  // ==================================================================================
  // 3. LÓGICA DO BANCO DE DADOS (TAB 2)
  // ==================================================================================

  const handleAddToDb = async () => {
    if (!dbItem.name) return alert("Nome obrigatório");
    setLoading(true);
    try {
      if (editingId) {
        // --- MODO EDIÇÃO (ATUALIZAR) ---
        const docRef = doc(db, "prescription_inventory", editingId);
        await updateDoc(docRef, {
          name: dbItem.name,
          dose: dbItem.dose,
          use: dbItem.use,
          defaultTime: dbItem.defaultTime || '',
          internalDescription: dbItem.internalDescription || ''
        });

        // Atualiza a lista local sem precisar recarregar tudo
        setInventory(prev => prev.map(item => item.id === editingId ? { ...item, ...dbItem } : item));

        // NOVO: Atualiza as tags quando edita um item
        const currentUsageTags = [...new Set(inventory.map(item => item.use).filter(use => use && use.trim() !== ''))];
        if (dbItem.use && dbItem.use.trim() !== '' && !currentUsageTags.includes(dbItem.use.trim())) {
          setUsageTags([...currentUsageTags, dbItem.use.trim()].sort());
        }
        showToast("Item atualizado com sucesso!");
        setEditingId(null); // Sai do modo edição
      } else {
        // --- MODO CRIAÇÃO (ADICIONAR NOVO) ---
        const docRef = await addDoc(collection(db, "prescription_inventory"), {
          name: dbItem.name,
          dose: dbItem.dose,
          use: dbItem.use,
          defaultTime: dbItem.defaultTime || '',
          internalDescription: dbItem.internalDescription || ''
        });
        const newItem = { id: docRef.id, ...dbItem };
        setInventory([...inventory, newItem]);

        // NOVO: Atualiza as tags quando salva um item novo
        if (dbItem.use && dbItem.use.trim() !== '' && !usageTags.includes(dbItem.use.trim())) {
          setUsageTags([...usageTags, dbItem.use.trim()].sort());
          showToast("Item adicionado ao banco e nova categoria criada!");
        } else {
          showToast("Item adicionado ao banco!");
        }
        showToast("Item adicionado ao banco!");
      }

      // Limpa o formulário
      setDbItem({ name: '', dose: '', use: '', defaultTime: '', internalDescription: '' });

    } catch (e) {
      console.error(e);
      alert("Erro ao salvar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDbItem = async (id) => {
    if (!window.confirm("Excluir permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "prescription_inventory", id));
      setInventory(prev => prev.filter(i => i.id !== id));
      showToast("Item excluído.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditDbItem = (id) => {
    const item = inventory.find(i => i.id === id);
    if (item) {
      setDbItem({
        name: item.name,
        dose: item.dose,
        use: item.use || '',
        defaultTime: item.defaultTime || '',
        internalDescription: item.internalDescription || ''
      });
      setEditingId(id); // <--- IMPORTANTE: Define que estamos editando este ID
      showToast("Editando item: " + item.name);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  // Coloque logo abaixo de handleEditDbItem
  const cancelEdit = () => {
    setDbItem({ name: '', dose: '', use: '', defaultTime: '', internalDescription: '' });
    setEditingId(null);
    showToast("Edição cancelada.");
  };

  // --- LÓGICA DE MODELOS DE OBSERVAÇÃO ---
  const saveObsModel = async () => {
    if (!newModelName || !generalNotes) return alert("Preencha o nome do modelo e o texto.");
    try {
      // Salva na coleção 'prescription_obs_models'
      const docRef = await addDoc(collection(db, "prescription_obs_models"), {
        title: newModelName,
        text: generalNotes
      });

      // Atualiza a lista visual com o ID real que veio do banco
      setObsModels([...obsModels, { id: docRef.id, title: newModelName, text: generalNotes }]);

      setShowModelSave(false);
      setNewModelName('');
      showToast("Modelo salvo no Banco de Dados!");
    } catch (e) {
      console.error(e);
      alert("Erro de Permissão: Libere a coleção 'prescription_obs_models' no seu Firebase.");
    }
  };
  const deleteObsModel = async (id) => {
    if (!confirm("Excluir este modelo do banco?")) return;
    try {
      await deleteDoc(doc(db, "prescription_obs_models", id));
      setObsModels(prev => prev.filter(m => m.id !== id));
      showToast("Modelo excluído.");
    } catch (e) { console.error(e); }
  }
  // --- FUNÇÕES DO SISTEMA DE TAGS ---
  const addNewTag = () => {
    if (!newTagName.trim()) return alert("Digite o nome da nova categoria.");
    if (usageTags.includes(newTagName.trim())) return alert("Esta categoria já existe.");

    const newTag = newTagName.trim();
    setUsageTags([...usageTags, newTag].sort());
    setSelectedTags([...selectedTags, newTag]);
    setNewTagName('');
    setShowNewTagInput(false);
    showToast("Nova categoria criada!");
  };

  const removeTag = (tagToRemove) => {
    const itemsUsingTag = inventory.filter(item => item.use === tagToRemove).length;
    if (itemsUsingTag > 0) {
      if (!confirm(`Esta categoria está sendo usada em ${itemsUsingTag} item(s). Remover mesmo assim?`)) return;
    }

    setUsageTags(usageTags.filter(tag => tag !== tagToRemove));
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
    showToast("Categoria removida!");
  };

  const editTag = async (oldTag, newTag) => {
    if (!newTag.trim()) return alert("Digite o novo nome.");
    if (usageTags.includes(newTag.trim()) && newTag.trim() !== oldTag) {
      return alert("Já existe uma categoria com este nome.");
    }

    try {
      // Atualiza todos os itens que usam esta tag no Firebase
      const itemsToUpdate = inventory.filter(item => item.use === oldTag);
      const updatePromises = itemsToUpdate.map(item =>
        updateDoc(doc(db, "prescription_inventory", item.id), { use: newTag.trim() })
      );

      await Promise.all(updatePromises);

      // Atualiza estados locais
      setUsageTags(usageTags.map(tag => tag === oldTag ? newTag.trim() : tag).sort());
      setSelectedTags(selectedTags.map(tag => tag === oldTag ? newTag.trim() : tag));
      setInventory(inventory.map(item =>
        item.use === oldTag ? { ...item, use: newTag.trim() } : item
      ));

      showToast(`Categoria "${oldTag}" renomeada para "${newTag.trim()}" em ${itemsToUpdate.length} item(s)!`);
    } catch (e) {
      console.error(e);
      alert("Erro ao renomear categoria: " + e.message);
    }
  };

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // ==================================================================================
  // 4. LÓGICA DE DRAG AND DROP (Reordenar)
  // ==================================================================================
  const handleDragStart = (e, position) => {
    dragItem.current = position;
  };
  const handleDragEnter = (e, position) => {
    dragOverItem.current = position;
  };
  const handleDragEnd = () => {
    const copyListItems = [...currentPrescription];
    const dragItemContent = copyListItems[dragItem.current];
    copyListItems.splice(dragItem.current, 1);
    copyListItems.splice(dragOverItem.current, 0, dragItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setCurrentPrescription(copyListItems);
  };

  // ==================================================================================
  // 5. CONFIGURAÇÃO (IMAGENS)
  // ==================================================================================
  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          if (type === 'logo') {
            setConfig(prev => ({ ...prev, logo: event.target.result, logoRatio: img.height / img.width }));
          } else {
            setConfig(prev => ({ ...prev, signature: event.target.result, signatureRatio: img.height / img.width }));
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  // ==================================================================================
  // 6. SALVAR PRESCRIÇÃO (FRAPPE + HISTÓRICO FIREBASE)
  // ==================================================================================
  const salvarPrescricao = async () => {
    if (currentPrescription.length === 0) return alert("Receita vazia!");
    if (!patientData.name) return alert("Nome do Paciente obrigatório");

    setLoading(true);
    try {
      // 1. Envia para o Frappe via Cloud Function
      await fnSalvarPrescricao({
        alunoId: patientData.alunoId,
        nomeCompleto: patientData.name,
        profissional: 'arteamconsultoria@gmail.com',
        date: patientData.date,
        items: currentPrescription,
        notes: generalNotes,
      });

      // 2. Salva no Histórico do Firebase (para a aba Histórico continuar funcionando)
      const historyItem = {
        studentName: patientData.name,
        date: patientData.date,
        validity: patientData.validity || '',
        items: currentPrescription,
        notes: generalNotes,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, "prescriptions_history"), historyItem);

      // Atualiza a lista visual do histórico imediatamente
      setHistoryList(prev => [{ id: docRef.id, ...historyItem }, ...prev]);

      showToast("Prescrição enviada para o aplicativo do aluno!");

      // Limpa os dados da tela após o sucesso
      setCurrentPrescription([]);
      setGeneralNotes('');
      setPatientData(prev => ({ ...prev, name: '', alunoId: '', validity: '', dispense: '' }));

    } catch (e) {
      console.error("Erro ao salvar:", e);
      alert("Erro ao enviar prescrição: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================================================================================
  // RENDERIZAÇÃO (JSX)
  // ==================================================================================
  return (
    <div className="min-h-screen bg-ebony-bg font-sans text-ebony-text p-4 md:p-8 overflow-x-hidden">

      {/* TOAST DE NOTIFICAÇÃO */}
      {toastMsg && (
        <div className="fixed top-20 right-5 bg-ebony-primary text-white px-6 py-3 rounded-lg shadow-xl z-50 flex items-center animate-in fade-in slide-in-from-right border border-ebony-border">
          <CheckCircle className="w-5 h-5 mr-2" /> <span>{toastMsg}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto">

        {/* CABEÇALHO */}
        <div className="bg-ebony-surface rounded-xl shadow-sm border border-ebony-border p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-ebony-deep border border-ebony-border p-2 rounded-lg">
              <HeartPulse className="w-6 h-6 text-ebony-muted" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Módulo de Prescrição</h1>
              <p className="text-xs text-ebony-muted">Ebony System</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row bg-ebony-deep p-1 rounded-lg border border-ebony-border w-full md:w-auto">
            <button
              onClick={() => { setActiveTab('prescricao'); setModoNova(false); setPrescricaoDetalhe(null); carregarPrescricoes(); }}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'prescricao'
                ? 'bg-ebony-surface text-white shadow-sm border border-ebony-border'
                : 'text-ebony-muted hover:text-white hover:bg-ebony-surface'
                }`}
            >
              <FileText className="w-4 h-4" /> Prescrição
            </button>

            <button
              onClick={() => setActiveTab('banco')}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'banco'
                ? 'bg-ebony-surface text-white shadow-sm border border-ebony-border'
                : 'text-ebony-muted hover:text-white hover:bg-ebony-surface'
                }`}
            >
              <Database className="w-4 h-4" /> Banco
            </button>

            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'config'
                ? 'bg-ebony-surface text-white shadow-sm border border-ebony-border'
                : 'text-ebony-muted hover:text-white hover:bg-ebony-surface'
                }`}
            >
              <Settings className="w-4 h-4" /> Config
            </button>
          </div>
        </div>

        {activeTab === 'prescricao' && (
          <div className="animate-in fade-in">

            {/* MODO LISTA */}
            {!modoNova && !prescricaoDetalhe && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Prescrições</h2>
                    <p className="text-xs text-ebony-muted mt-1">Histórico de prescrições enviadas</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ebony-muted pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Buscar aluno..."
                        value={searchPrescricao}
                        onChange={e => { setSearchPrescricao(e.target.value); setPagePrescricao(1); }}
                        className="pl-9 pr-3 py-2 text-sm bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary placeholder-gray-600 w-44"
                      />
                    </div>
                    <button
                      onClick={() => { setModoNova(true); setCurrentPrescription([]); setGeneralNotes(''); setPatientData({ name: '', alunoId: '', date: new Date().toISOString().split('T')[0], validity: '', dispense: '' }); }}
                      className="bg-ebony-primary hover:bg-red-900 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" /> Nova Prescrição
                    </button>
                  </div>
                </div>

                {/* TABELA DE PRESCRIÇÕES */}
                <div className="bg-ebony-surface rounded-xl border border-ebony-border overflow-hidden">
                  {prescricoesLoading ? (
                    <div className="text-center py-16 text-ebony-muted text-sm">Carregando...</div>
                  ) : prescricoesList.length === 0 ? (
                    <div className="text-center py-16 opacity-40">
                      <FileText className="w-10 h-10 mx-auto mb-2 text-ebony-muted" />
                      <p className="text-ebony-muted text-sm">Nenhuma prescrição ainda.</p>
                      <p className="text-xs text-ebony-muted mt-1">Clique em "Nova Prescrição" para começar.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-ebony-deep text-ebony-muted uppercase text-xs border-b border-ebony-border">
                        <tr>
                          <th className="p-4">Paciente</th>
                          <th className="p-4">Data</th>
                          <th className="p-4">Observação</th>
                          <th className="p-4 text-right w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ebony-border">
                        {prescricoesList.map(p => (
                          <tr key={p.name}
                            className="hover:bg-ebony-border/20 transition cursor-pointer group"
                            onClick={async () => {
                              try {
                                const res = await fnBuscarPrescricaoDetalhe({ prescricaoId: p.name });
                                const detalhe = res.data;
                                // Preenche o formulário com os dados da prescrição
                                setPatientData({
                                  name: detalhe.nome_completo,
                                  alunoId: detalhe.aluno,
                                  date: detalhe.date,
                                  validity: '',
                                  dispense: ''
                                });
                                setCurrentPrescription(
                                  (detalhe.prescriptions || []).map((item, i) => ({
                                    uid: Date.now() + i,
                                    name: item.manipulated,
                                    dose: item.description,
                                    time: '',
                                  }))
                                );
                                setGeneralNotes(detalhe.description || '');
                                setModoNova(true);
                              } catch (e) {
                                console.error("Erro ao carregar prescrição:", e);
                              }
                            }}
                          >
                            <td className="p-4 font-bold text-white">{p.nome_completo || '-'}</td>
                            <td className="p-4 text-ebony-muted">
                              {new Date(p.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            </td>
                            <td className="p-4 text-ebony-muted text-xs max-w-xs truncate">{p.description || '-'}</td>
                            <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const res = await fnBuscarPrescricaoDetalhe({ prescricaoId: p.name });
                                    setPreviewItem(res.data);
                                  } catch (err) { console.error(err); }
                                }}
                                className="p-1.5 text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg transition"
                                title="Pré-visualizar"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const res = await fnBuscarPrescricaoDetalhe({ prescricaoId: p.name });
                                    const detalhe = res.data;
                                    // ...
                                    showToast("Prescrição duplicada! Edite e salve.");
                                  } catch (err) { console.error(err); }
                                }}
                                className="p-1.5 text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg transition"
                                title="Duplicar"
                              >
                              <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!window.confirm(`Excluir prescrição de ${p.nome_completo}?`)) return;
                                  try {
                                    await fnDeletarPrescricao({ prescricaoId: p.name });
                                    setPrescricoesList(prev => prev.filter(x => x.name !== p.name));
                                    showToast("Prescrição excluída.");
                                  } catch (err) {
                                    alert("Erro ao excluir: " + err.message);
                                  }
                                }}
                                className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-ebony-deep rounded-lg transition"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                {/* PAGINAÇÃO */}
                {!prescricoesLoading && prescricoesList.length > 0 && (
                    <div className="flex items-center justify-between p-3 border-t border-ebony-border bg-ebony-deep">
                      <p className="text-xs text-ebony-muted">
                        Página {pagePrescricao} · {prescricoesList.length} resultado{prescricoesList.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPagePrescricao(p => Math.max(1, p - 1))}
                          disabled={pagePrescricao === 1}
                          className="px-3 py-1 text-xs rounded-lg border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface disabled:opacity-30 transition"
                        >
                          ← Anterior
                        </button>
                        <button
                          onClick={() => setPagePrescricao(p => p + 1)}
                          disabled={!hasMorePrescricoes}
                          className="px-3 py-1 text-xs rounded-lg border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface disabled:opacity-30 transition"
                        >
                          Próxima →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODO DETALHE */}
            {!modoNova && prescricaoDetalhe && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setPrescricaoDetalhe(null)}
                    className="text-ebony-muted hover:text-white text-sm flex items-center gap-1 border border-ebony-border px-3 py-1.5 rounded-lg transition">
                    ← Voltar
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-white">{prescricaoDetalhe.nome_completo}</h2>
                    <p className="text-xs text-ebony-muted">{new Date(prescricaoDetalhe.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                  </div>
                </div>

                <div className="bg-ebony-surface rounded-xl border border-ebony-border overflow-hidden">
                  <div className="p-4 border-b border-ebony-border flex justify-between items-center">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Pill className="w-4 h-4 text-ebony-muted" /> Itens da Prescrição
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => duplicarPrescricao(prescricaoDetalhe)}
                        className="text-xs border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Duplicar
                      </button>
                      <button
                        onClick={() => excluirPrescricao(prescricaoDetalhe.name, prescricaoDetalhe.nome_completo)}
                        className="text-xs border border-red-900 text-red-400 hover:bg-red-900 hover:text-white px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir
                      </button>
                    </div>
                  </div>

                  {(prescricaoDetalhe.prescriptions || []).length === 0 ? (
                    <div className="p-8 text-center text-ebony-muted text-sm">Sem itens registrados.</div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-ebony-deep text-xs text-ebony-muted uppercase border-b border-ebony-border">
                        <tr>
                          <th className="p-4">Manipulado</th>
                          <th className="p-4">Descrição</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ebony-border">
                        {prescricaoDetalhe.prescriptions.map((item, i) => (
                          <tr key={i} className="hover:bg-ebony-border/20">
                            <td className="p-4 font-bold text-white">{item.manipulated}</td>
                            <td className="p-4 text-ebony-muted text-sm">{item.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {prescricaoDetalhe.description && (
                    <div className="p-4 border-t border-ebony-border">
                      <p className="text-xs font-bold text-ebony-muted uppercase mb-1">Observações</p>
                      <p className="text-sm text-white">{prescricaoDetalhe.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODO NOVA PRESCRIÇÃO (formulário atual) */}
            {modoNova && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setModoNova(false)}
                    className="text-ebony-muted hover:text-white text-sm flex items-center gap-1 border border-ebony-border px-3 py-1.5 rounded-lg transition">
                    ← Voltar
                  </button>
                  <h2 className="text-lg font-bold text-white">Nova Prescrição</h2>
                </div>

                {/* PACIENTE */}
                <div className="bg-ebony-surface p-5 rounded-xl border border-ebony-border border-l-4 border-l-ebony-primary">
                  <h2 className="text-xs font-bold text-ebony-muted uppercase mb-3 flex items-center gap-2">
                    <IdCard className="w-4 h-4" /> Paciente
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative md:col-span-2">
                      <label className="block text-[10px] font-bold text-ebony-primary uppercase mb-1">Nome do Paciente *</label>
                      <input
                        type="text"
                        placeholder="Buscar paciente..."
                        className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg text-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                        value={patientData.name}
                        autoComplete="off"
                        onChange={async (e) => {
                          const val = e.target.value;
                          setPatientData({ ...patientData, name: val, alunoId: '' });
                          setShowSuggestions(true);
                          if (val.length >= 2) {
                            try {
                              const res = await fnListarAlunos({ search: val, limit: 20 });
                              setAlunosBuscaAtiva(res.data?.list || []);
                            } catch (err) { console.error(err); }
                          }
                        }}
                        onFocus={async () => {
                          setShowSuggestions(true);
                          if (alunosBuscaAtiva.length === 0) {
                            try {
                              const res = await fnListarAlunos({ limit: 200 });
                              setAlunosBuscaAtiva(res.data?.list || []);
                            } catch (err) { console.error(err); }
                          }
                        }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      />
                      {patientData.alunoId && <span className="absolute right-3 top-8 text-green-400 text-xs">✓ vinculado</span>}
                      {showSuggestions && alunosBuscaAtiva.length > 0 && (
                        <ul className="absolute z-50 bg-ebony-surface border border-ebony-border w-full max-h-48 overflow-y-auto rounded-b-lg shadow-lg mt-1">
                          {alunosBuscaAtiva
                            .filter(s => {
                              const search = patientData.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                              const nome = (s.nome_completo || s.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                              return nome.includes(search);
                            })
                            .map(student => (
                              <li key={student.name}
                                className="p-2 text-sm text-white hover:bg-ebony-border/30 cursor-pointer border-b border-ebony-border last:border-0"
                                onClick={() => {
                                  setPatientData({ ...patientData, name: student.nome_completo || student.name, alunoId: student.name });
                                  setShowSuggestions(false);
                                }}>
                                <span className="font-medium">{student.nome_completo || student.name}</span>
                                {student.email && <span className="text-ebony-muted text-xs ml-2">{student.email}</span>}
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Data</label>
                      <input type="date"
                        className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg text-sm outline-none focus:border-ebony-primary"
                        value={patientData.date}
                        onChange={e => setPatientData({ ...patientData, date: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* ADICIONAR ITEM */}
                <div className="bg-ebony-surface p-5 rounded-xl border border-ebony-border">
                  <h2 className="text-xs font-bold text-ebony-muted uppercase mb-3 flex items-center gap-2">
                    <Pill className="w-4 h-4" /> Adicionar Item
                  </h2>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-ebony-primary uppercase mb-1">Momento de Uso</label>
                        <input type="text" list="timesList" placeholder="Ex: Ao Acordar"
                          className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg text-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                          value={formItem.time} onChange={e => setFormItem({ ...formItem, time: e.target.value })} />
                        <datalist id="timesList">
                          <option value="Ao Acordar" /><option value="Café da Manhã" /><option value="Almoço" />
                          <option value="Pré-Treino" /><option value="Pós-Treino" /><option value="Jantar" /><option value="Antes de Dormir" />
                        </datalist>
                      </div>
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Substância</label>
                        <input type="text" placeholder="Digite para buscar..."
                          className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg text-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                          value={formItem.name} autoComplete="off"
                          onChange={e => { setFormItem({ ...formItem, name: e.target.value }); setShowInventoryList(true); }}
                          onFocus={() => setShowInventoryList(true)}
                          onBlur={() => setTimeout(() => setShowInventoryList(false), 200)} />
                        {showInventoryList && formItem.name && (
                          <ul className="absolute z-50 bg-ebony-surface border border-ebony-border w-full max-h-48 overflow-y-auto rounded-b-lg shadow-lg mt-1 left-0">
                            {inventory.filter(item => {
                              const s = formItem.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                              return (item.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(s);
                            }).map(item => (
                              <li key={item.id} className="p-3 hover:bg-ebony-border/30 cursor-pointer border-b border-ebony-border last:border-0"
                                onClick={() => handleSelectInventoryItem(item)}>
                                <p className="font-bold text-white text-sm">{item.name}</p>
                                {item.defaultTime && <p className="text-xs text-ebony-primary">{item.defaultTime}</p>}
                                {item.dose && <p className="text-xs text-ebony-muted">{item.dose}</p>}
                              </li>
                            ))}
                            {inventory.filter(i => (i.name || '').toLowerCase().includes(formItem.name.toLowerCase())).length === 0 && (
                              <li className="p-2 text-xs text-ebony-muted italic">Nada encontrado.</li>
                            )}
                          </ul>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Posologia</label>
                        <input type="text" placeholder="Ex: 1 cápsula 2x ao dia"
                          className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg text-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                          value={formItem.dose} onChange={e => setFormItem({ ...formItem, dose: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addToPrescription}
                        className="flex-1 bg-ebony-primary hover:bg-red-900 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> Adicionar à Lista
                      </button>
                      <button onClick={saveCurrentToDb} title="Salvar no Banco"
                        className="w-10 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface rounded-lg flex items-center justify-center">
                        <Save className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* LISTA + ENVIAR */}
                <div className="bg-ebony-surface rounded-xl border border-ebony-border overflow-hidden">
                  <div className="p-4 border-b border-ebony-border flex justify-between items-center">
                    <h2 className="font-bold text-white flex items-center gap-2">
                      <FileSignature className="w-4 h-4 text-ebony-muted" />
                      Lista ({currentPrescription.length} {currentPrescription.length === 1 ? 'item' : 'itens'})
                    </h2>
                    {currentPrescription.length > 0 && (
                      <button onClick={clearPrescription} className="text-ebony-muted text-xs hover:text-white flex items-center gap-1 border border-ebony-border px-2 py-1 rounded-lg">
                        <Trash2 className="w-3 h-3" /> Limpar
                      </button>
                    )}
                  </div>
                  {currentPrescription.length === 0 ? (
                    <div className="text-center py-10 opacity-40">
                      <Pill className="w-8 h-8 mx-auto mb-2 text-ebony-muted" />
                      <p className="text-ebony-muted text-sm">Nenhum item adicionado.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-ebony-deep text-xs text-ebony-muted uppercase border-b border-ebony-border">
                        <tr>
                          <th className="py-2 px-3 w-8"></th>
                          <th className="py-2 px-3">Momento</th>
                          <th className="py-2 px-3">Item</th>
                          <th className="py-2 px-3">Posologia</th>
                          <th className="py-2 px-3 w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ebony-border">
                        {currentPrescription.map((item, index) => (
                          <tr key={item.uid} draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className="hover:bg-ebony-border/20 group cursor-grab">
                            <td className="py-2 px-3 text-ebony-muted"><GripHorizontal className="w-4 h-4" /></td>
                            <td className="py-2 px-3 font-bold text-white text-sm">{item.time}</td>
                            <td className="py-2 px-3 text-white text-sm">{item.name}</td>
                            <td className="py-2 px-3 text-ebony-muted text-xs">{item.dose}</td>
                            <td className="py-2 px-3">
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                                <button onClick={() => editPrescriptionItem(item.uid)} className="text-ebony-muted hover:text-white"><Pen className="w-3 h-3" /></button>
                                <button onClick={() => removePrescriptionItem(item.uid)} className="text-ebony-muted hover:text-white"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="p-4 border-t border-ebony-border space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-ebony-muted uppercase">Observações</label>
                        <select className="text-xs bg-ebony-deep border border-ebony-border text-white rounded p-1 outline-none"
                          onChange={(e) => { const m = obsModels.find(m => m.id === e.target.value); if (m) setGeneralNotes(m.text); }}
                          defaultValue="">
                          <option value="" disabled>Carregar modelo...</option>
                          {obsModels.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                        </select>
                      </div>
                      <textarea rows="3"
                        className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg text-sm outline-none focus:border-ebony-primary placeholder-gray-600 resize-none"
                        value={generalNotes} onChange={e => setGeneralNotes(e.target.value)}
                        placeholder="Observações para o aluno (opcional)..." />
                    </div>
                    <button
                      onClick={async () => {
                        await salvarPrescricao();
                        setModoNova(false);
                        carregarPrescricoes();
                      }}
                      disabled={loading}
                      className="w-full bg-ebony-primary hover:bg-red-900 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 transition">
                      <FileText className="w-5 h-5" />
                      {loading ? 'Salvando...' : 'Salvar e Enviar para o App'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* --- ABA 2: BANCO --- */}
        {activeTab === 'banco' && (
          <div className="animate-in fade-in space-y-6">
            <div className="bg-ebony-surface p-6 rounded-xl shadow-sm border border-ebony-border border-l-4 border-l-ebony-primary">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-ebony-muted" /> Cadastro Manual
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ebony-primary uppercase mb-1">Momento Padrão</label>
                  <input
                    type="text"
                    list="timesListBanco"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg text-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                    value={dbItem.defaultTime}
                    onChange={e => setDbItem({ ...dbItem, defaultTime: e.target.value })}
                    placeholder="Ex: Ao Acordar"
                  />
                  <datalist id="timesListBanco">
                    <option value="Ao Acordar" /><option value="Café da Manhã" /><option value="Almoço" />
                    <option value="Pré-Treino" /><option value="Pós-Treino" /><option value="Jantar" />
                    <option value="Antes de Dormir" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Substância</label>
                  <input
                    type="text"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg text-sm outline-none focus:border-ebony-primary"
                    value={dbItem.name}
                    onChange={e => setDbItem({ ...dbItem, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Posologia</label>
                  <input
                    type="text"
                    placeholder="Ex: 1 cápsula 2x ao dia"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg text-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                    value={dbItem.dose}
                    onChange={e => setDbItem({ ...dbItem, dose: e.target.value })}
                  />
                </div>
              </div>

              {/* BOTÕES */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddToDb}
                  disabled={loading}
                  className="flex-1 font-semibold py-2 px-6 rounded-lg transition text-sm flex items-center justify-center gap-2 text-white shadow-lg bg-ebony-primary hover:bg-red-900"
                >
                  {loading ? 'Processando...' : (
                    editingId ? <><Pen className="w-4 h-4" /> Atualizar Item</> : <><Save className="w-4 h-4" /> Salvar Novo</>
                  )}
                </button>

                {editingId && (
                  <button
                    onClick={cancelEdit}
                    className="bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface font-semibold py-2 px-4 rounded-lg transition text-sm"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* TABELA */}
            <div className="bg-ebony-surface rounded-xl shadow-sm border border-ebony-border overflow-hidden">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-ebony-deep text-ebony-muted font-bold border-b border-ebony-border uppercase text-xs">
                  <tr>
                    <th className="p-4 w-3/12">Momento</th>
                    <th className="p-4 w-4/12">Substância</th>
                    <th className="p-4 w-4/12">Posologia</th>
                    <th className="p-4 w-1/12 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-ebony-border">
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-ebony-muted">
                        Banco vazio. Adicione itens acima.
                      </td>
                    </tr>
                  ) : (
                    inventory.sort((a, b) => (a.use || "").localeCompare(b.use || "")).map(item => (
                      <tr key={item.id} className="hover:bg-ebony-border/30 transition">
                        <td className="p-4 text-ebony-muted text-sm">{item.defaultTime || '-'}</td>
                        <td className="p-4 font-medium text-white">{item.name}</td>
                        <td className="p-4 text-ebony-muted text-sm">{item.dose || '-'}</td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <button onClick={() => handleEditDbItem(item.id)} className="text-ebony-muted hover:text-white mr-3" title="Editar">
                            <Pen className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteDbItem(item.id)} className="text-ebony-muted hover:text-white" title="Excluir">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- ABA 4: HISTÓRICO --- */}
        {activeTab === 'historico' && (
          <div className="animate-in fade-in space-y-6">
            <div className="bg-ebony-surface p-6 rounded-xl shadow-sm border border-ebony-border border-l-4 border-l-ebony-primary">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <History className="w-5 h-5 text-ebony-muted" /> Histórico de Prescrições
              </h2>
              <p className="text-sm text-ebony-muted mb-4">Veja as receitas geradas anteriormente e reutilize com um clique.</p>

              <div className="overflow-hidden rounded-lg border border-ebony-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-ebony-deep text-ebony-muted font-bold border-b border-ebony-border uppercase text-xs">
                    <tr>
                      <th className="p-4">Data</th>
                      <th className="p-4">Paciente</th>
                      <th className="p-4">Qtd. Itens</th>
                      <th className="p-4 text-right">Ação</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-ebony-border bg-ebony-surface">
                    {historyList.length === 0 ? (
                      <tr><td colSpan="4" className="p-8 text-center text-ebony-muted">Nenhum histórico encontrado.</td></tr>
                    ) : (
                      historyList.map(item => (
                        <tr key={item.id} className="hover:bg-ebony-border/30 transition">
                          <td className="p-4 text-ebony-muted">
                            {new Date(item.date).toLocaleDateString('pt-BR')} <br />
                            <span className="text-[10px] opacity-70">{new Date(item.date).toLocaleTimeString('pt-BR').slice(0, 5)}</span>
                          </td>
                          <td className="p-4 font-bold text-white">{item.studentName}</td>
                          <td className="p-4 text-ebony-muted">
                            <span className="bg-ebony-deep border border-ebony-border text-ebony-muted px-2 py-1 rounded-lg text-xs font-bold">
                              {item.items?.length || 0} itens
                            </span>
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            {/* Botão Ver (Preview) */}
                            <button
                              onClick={() => setPreviewItem(item)}
                              className="p-2 text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg transition"
                              title="Visualizar Itens"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Botão Restaurar */}
                            <button
                              onClick={() => restorePrescription(item)}
                              className="p-2 text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg transition"
                              title="Reutilizar esta receita"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            {/* Botão Excluir */}
                            <button
                              onClick={() => deleteHistoryItem(item.id)}
                              className="p-2 text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg transition"
                              title="Apagar do histórico"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- ABA 3: CONFIG --- */}
        {activeTab === 'config' && (
          <div className="animate-in fade-in max-w-2xl mx-auto">
            <div className="bg-ebony-surface p-8 rounded-xl shadow-md border border-ebony-border border-t-4 border-t-ebony-primary">
              <h2 className="text-xl font-bold text-white mb-6 border-b border-ebony-border pb-2">
                Configurações do PDF
              </h2>

              <div className="space-y-8">
                {/* LOGO */}
                <div>
                  <label className="block text-sm font-bold text-white mb-2">1. Logo da Marca</label>
                  <div className="flex items-center space-x-4">
                    <div className="h-28 w-28 bg-ebony-deep border-2 border-dashed border-ebony-border rounded-lg flex items-center justify-center overflow-hidden">
                      {config.logo ? (
                        <img src={config.logo} alt="Logo" className="object-contain h-full w-full" />
                      ) : (
                        <span className="text-ebony-muted text-xs">Sem Logo</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="cursor-pointer bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition">
                        <Upload className="w-4 h-4" /> Escolher Imagem
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logo')} />
                      </label>
                      <p className="text-xs text-ebony-muted mt-2">A logo será ajustada automaticamente no topo do PDF.</p>
                    </div>
                  </div>
                </div>

                {/* ASSINATURA */}
                <div className="border-t border-ebony-border pt-6">
                  <label className="block text-sm font-bold text-white mb-2">2. Assinatura Digital</label>
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-32 w-64 bg-ebony-deep border border-dashed border-ebony-border rounded-lg flex items-center justify-center overflow-hidden relative">
                        <div className="absolute bottom-4 left-4 right-4 h-px bg-ebony-border z-0"></div>
                        <div className="relative z-10 w-full h-full flex items-center justify-center">
                          {config.signature ? (
                            <img
                              src={config.signature}
                              alt="Assinatura"
                              className="object-contain max-h-full max-w-full"
                              style={{ transform: `translate(${config.signatureOffsetX * 2}px, ${config.signatureOffsetY * -2}px) scale(${config.signatureScale})` }}
                            />
                          ) : (
                            <span className="text-ebony-muted text-xs">Sem Assinatura</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="cursor-pointer bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2 transition">
                          <Upload className="w-4 h-4" /> Enviar Assinatura
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'signature')} />
                        </label>
                        <p className="text-xs text-ebony-muted mt-2">Use PNG com fundo transparente.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-ebony-deep p-4 rounded-lg border border-ebony-border">
                      <div>
                        <label className="text-xs font-bold text-ebony-muted block mb-1">Tamanho</label>
                        <input type="range" min="0.5" max="2.5" step="0.1" className="w-full accent-[var(--ebony-primary)]" value={config.signatureScale} onChange={(e) => setConfig({ ...config, signatureScale: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-ebony-muted block mb-1">Posição X</label>
                        <input type="range" min="-50" max="50" step="1" className="w-full accent-[var(--ebony-primary)]" value={config.signatureOffsetX} onChange={(e) => setConfig({ ...config, signatureOffsetX: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-ebony-muted block mb-1">Posição Y</label>
                        <input type="range" min="-30" max="30" step="1" className="w-full accent-[var(--ebony-primary)]" value={config.signatureOffsetY} onChange={(e) => setConfig({ ...config, signatureOffsetY: e.target.value })} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-ebony-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Seu Nome</label>
                    <input type="text" className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none" value={config.name} onChange={e => setConfig({ ...config, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Registro Profissional</label>
                    <input type="text" className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none" value={config.reg} onChange={e => setConfig({ ...config, reg: e.target.value })} />
                  </div>
                </div>

                <button onClick={saveConfigToLocal} className="w-full bg-ebony-primary hover:bg-red-900 text-white font-bold py-3 rounded-lg shadow-lg transition">
                  Salvar Configurações
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL DE PREVIEW DO HISTÓRICO --- */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-ebony-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-ebony-border">

            {/* Cabeçalho do Modal */}
            <div className="bg-ebony-surface p-4 border-b border-ebony-border flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-white">Visualizar Receita</h3>
                <p className="text-xs text-ebony-muted">
                  {new Date(previewItem.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} — {previewItem.nome_completo || previewItem.studentName}                </p>
              </div>
              <button onClick={() => setPreviewItem(null)} className="p-2 hover:bg-ebony-deep rounded-full transition border border-ebony-border">
                <X className="w-5 h-5 text-ebony-muted" />
              </button>
            </div>

            {/* Lista de Itens (Scrollável) */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {(previewItem.prescriptions || previewItem.items || []).map((it, idx) => (
                  <div key={idx} className="flex gap-4 border-b border-ebony-border pb-3 last:border-0">
                    <div>
                      <p className="font-bold text-sm text-white">{it.manipulated || it.name}</p>
                      <p className="text-xs text-ebony-muted mt-1">{it.description || it.dose}</p>
                    </div>
                  </div>
                ))}
                {previewItem.description && (
                  <div className="mt-4 pt-4 border-t border-ebony-border">
                    <p className="text-xs font-bold text-ebony-muted uppercase mb-1">Observações</p>
                    <p className="text-sm text-white">{previewItem.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-ebony-surface border-t border-ebony-border flex justify-end gap-2">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 text-sm font-bold text-ebony-muted hover:bg-ebony-deep rounded-lg transition border border-ebony-border"
              >
                Fechar
              </button>
              <button
                onClick={() => { restorePrescription(previewItem); setPreviewItem(null); }}
                className="px-4 py-2 text-sm font-bold text-white bg-ebony-primary hover:bg-red-900 rounded-lg transition flex items-center gap-2 shadow-lg"
              >
                <RotateCcw className="w-4 h-4" /> Usar esta Receita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionModule;