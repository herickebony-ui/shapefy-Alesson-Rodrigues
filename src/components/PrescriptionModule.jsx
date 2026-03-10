import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import StudentNameWithBadge from "./StudentNameWithBadge";
import {
  HeartPulse, FileText, Database, Settings, CheckCircle,
  IdCard, Pill, Plus, Save, Trash2, GripVertical, X,
  FileSignature, Search, Pen, GripHorizontal, FlaskConical, Upload,
  History, RotateCcw, Eye
} from 'lucide-react';

const PrescriptionModule = ({ students = [] }) => {
  // --- ESTADOS GERAIS ---
  const [activeTab, setActiveTab] = useState('prescricao');
  const [toastMsg, setToastMsg] = useState('');
  const [loading, setLoading] = useState(false);

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
  // 6. GERADOR DE PDF (O CORAÇÃO DO SISTEMA)
  // ==================================================================================
  const generatePDF = async () => {
    if (currentPrescription.length === 0) return alert("Receita vazia!");
    if (!patientData.name) return alert("Nome do Paciente obrigatório");

    // Salvar Histórico no Firebase (Opcional, conforme pedido)
    try {
      await addDoc(collection(db, "prescriptions_history"), {
        studentName: patientData.name,
        date: new Date().toISOString(),
        items: currentPrescription,
        validity: patientData.validity
      });
      console.log("Histórico salvo na nuvem.");
    } catch (e) { console.error("Erro histórico", e); }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const primaryColor = [133, 0, 0]; // Cor Vinho (#850000)

    // --- 1. CABEÇALHO (COMPACTADO) ---
    // Começa mais no topo (era 15)
    let headerY = 10;
    let logoHeight = 0;

    if (config.logo) {
      try {
        // Diminuí a logo de 30 para 24 para ganhar espaço
        const imgWidth = 24;
        const imgHeight = imgWidth * (config.logoRatio || 1);
        const x = (pageWidth - imgWidth) / 2;
        doc.addImage(config.logo, 'PNG', x, headerY, imgWidth, imgHeight);
        logoHeight = imgHeight;
      } catch (e) { }
    } else {
      logoHeight = 5;
    }

    // Profissional
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    // Subi um pouco a posição Y (era 15)
    doc.text(config.name || "Profissional", pageWidth - 15, 12, { align: "right" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    if (config.reg) doc.text(`Registro: ${config.reg}`, pageWidth - 15, 16, { align: "right" });

    // Linha divisória mais próxima da logo
    let lineY = headerY + logoHeight + 4;
    if (lineY < 25) lineY = 25;

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(15, lineY, pageWidth - 15, lineY);

    // Título "PRESCRIÇÕES" mais próximo da linha (era +15)
    let titleY = lineY + 10;
    doc.setTextColor(0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PRESCRIÇÕES", pageWidth / 2, titleY, { align: "center" });

    // Dados do Paciente mais próximos do título (era +15)
    let yPos = titleY + 10;
    const dateFormatted = new Date(patientData.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold"); doc.text("Paciente:", 20, yPos);
    doc.setFont("helvetica", "normal"); doc.text(patientData.name, 38, yPos);

    doc.setFont("helvetica", "bold"); doc.text("Data:", 140, yPos);
    doc.setFont("helvetica", "normal"); doc.text(dateFormatted, 152, yPos);
    yPos += 5; // Reduzi entrelinha (era +6)

    const labelValidade = "Validade da Prescrição:";
    doc.setFont("helvetica", "bold"); doc.text(labelValidade, 20, yPos);
    const wValidade = doc.getTextWidth(labelValidade);
    doc.setFont("helvetica", "normal"); doc.text(patientData.validity, 20 + wValidade + 2, yPos);

    if (patientData.dispense) {
      const labelAviar = "Aviar formulações para:";
      const startX = 130;
      doc.setFont("helvetica", "bold"); doc.text(labelAviar, startX, yPos);
      const wAviar = doc.getTextWidth(labelAviar);
      doc.setFont("helvetica", "normal"); doc.text(patientData.dispense, startX + wAviar + 2, yPos);
    }

    // Espaço antes de começar os itens (era +15, reduzi drasticamente)
    yPos += 10;

    // --- 2. CONTEÚDO (ITENS) ---
    // Agrupa itens pelo horário
    const orderedTimes = [...new Set(currentPrescription.map(item => item.time))];
    const grouped = {};
    currentPrescription.forEach(item => {
      if (!grouped[item.time]) grouped[item.time] = [];
      grouped[item.time].push(item);
    });

    orderedTimes.forEach(time => {
      const items = grouped[time];
      if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; } // Margem superior menor na nova pág

      // Título do Horário (ex: AO ACORDAR)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...primaryColor);
      doc.text(time.toUpperCase(), 20, yPos);

      // Espaço menor entre Título e o primeiro item (era +6)
      yPos += 5;

      const startBarY = yPos - 3;

      items.forEach((item) => {
        const maxTextWidth = pageWidth - 50;

        // --- NOME (NEGRITO) ---
        doc.setTextColor(0); // Garante preto
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);

        const prefix = `• ${item.name}`;
        const nameLines = doc.splitTextToSize(prefix, maxTextWidth);
        const nameHeight = nameLines.length * 5;

        // --- POSOLOGIA (NORMAL) ---
        doc.setFont("helvetica", "normal");
        const doseText = item.dose || "";
        const doseLines = doc.splitTextToSize(doseText, maxTextWidth);
        const doseHeight = doseLines.length * 5;

        // --- CÁLCULO DE ESPAÇO ---
        // Reduzi o espaçamento final de +3 para +1.5 (AQUI ESTÁ A COMPRESSÃO ENTRE ITENS)
        const totalItemHeight = nameHeight + doseHeight + 1.5;

        if (yPos + totalItemHeight > pageHeight - 30) {
          const currentBarHeight = yPos - startBarY - 2;
          if (currentBarHeight > 0) {
            doc.setFillColor(...primaryColor);
            doc.roundedRect(19.65, startBarY, 0.7, currentBarHeight, 0.35, 0.35, 'F');
          }
          doc.addPage();
          yPos = 20;
        }

        // Desenha
        doc.setFont("helvetica", "bold");
        doc.text(nameLines, 24, yPos);
        yPos += nameHeight;

        doc.setFont("helvetica", "normal");
        doc.text(doseLines, 24, yPos);

        // Espaço final compactado
        yPos += doseHeight + 1.5;
      });

      // Barra lateral
      if (startBarY < pageHeight && yPos > 20) {
        const finalBarHeight = (yPos - 1.5) - startBarY; // Ajuste fino no tamanho da barra
        if (finalBarHeight > 0) {
          doc.setFillColor(...primaryColor);
          doc.roundedRect(19.65, startBarY, 0.7, finalBarHeight, 0.35, 0.35, 'F');
        }
      }
      // Espaço entre grupos de horário (era +5, reduzi para +3)
      yPos += 3;
    });

    // --- 3. RODAPÉ E ASSINATURA ---
    if (generalNotes) {
      if (yPos > pageHeight - 50) doc.addPage();
      doc.setDrawColor(200);
      doc.setLineWidth(0.5);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 8;
      doc.setFont("helvetica", "bold"); doc.text("Observações:", 20, yPos);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      const splitNotes = doc.splitTextToSize(generalNotes, 170);
      doc.text(splitNotes, 20, yPos);
    }

    const footerY = pageHeight - 30;

    if (config.signature) {
      try {
        const sigScale = parseFloat(config.signatureScale) || 1.0;
        const offX = parseFloat(config.signatureOffsetX) || 0;
        const offY = parseFloat(config.signatureOffsetY) || 0;

        const sigWidth = 40 * sigScale;
        const sigHeight = sigWidth * (config.signatureRatio || 0.5);

        const x = (pageWidth - sigWidth) / 2 + offX;
        const y = (footerY - sigHeight - 2) - offY;

        doc.addImage(config.signature, 'PNG', x, y, sigWidth, sigHeight);
      } catch (e) {
        console.log("Erro ao renderizar assinatura", e);
      }
    }

    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(60, footerY, 150, footerY);
    doc.setFontSize(10); doc.text(config.name || "Assinatura", 105, footerY + 5, { align: "center" });
    if (config.reg) { doc.setFontSize(8); doc.text(config.reg, 105, footerY + 10, { align: "center" }); }

    doc.save(`Prescricao_${patientData.name.replace(/\s/g, '_')}.pdf`);
    showToast("PDF Gerado com sucesso!");
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
              onClick={() => setActiveTab('prescricao')}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'prescricao'
                ? 'bg-ebony-surface text-white shadow-sm border border-ebony-border'
                : 'text-ebony-muted hover:text-white hover:bg-ebony-surface'
                }`}
            >
              <FileText className="w-4 h-4" /> Prescrição
            </button>

            <button
              onClick={() => { setActiveTab('historico'); loadHistory(); }}
              className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'historico'
                ? 'bg-ebony-surface text-white shadow-sm border border-ebony-border'
                : 'text-ebony-muted hover:text-white hover:bg-ebony-surface'
                }`}
            >
              <History className="w-4 h-4" /> Histórico
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
          <div className="space-y-6 animate-in fade-in">

            {/* DADOS DO PACIENTE - HORIZONTAL */}
            <div className="bg-ebony-surface p-5 rounded-xl shadow-sm border border-ebony-border border-l-4 border-l-ebony-primary">
              <h2 className="text-xs font-bold text-ebony-muted uppercase mb-4 flex items-center gap-2">
                <IdCard className="w-4 h-4 text-ebony-muted" /> Dados do Paciente
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* CAMPO DE NOME COM AUTOCOMPLETE */}
                <div className="relative">
                  <label className="block text-[10px] font-bold text-ebony-primary uppercase mb-1">Nome do Paciente</label>
                  <input
                    type="text"
                    placeholder="Nome do Paciente"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                    value={patientData.name}
                    onChange={e => {
                      setPatientData({ ...patientData, name: e.target.value });
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    autoComplete="off"
                  />

                  {/* INDICADOR VISUAL */}
                  {patientData.name && (
                    <div className="absolute right-2 top-8 pointer-events-none">
                      {students.some(s => s.name.toLowerCase() === patientData.name.toLowerCase()) ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <span className="text-yellow-400 text-xs">+</span>
                      )}
                    </div>
                  )}

                  {/* LISTA FLUTUANTE */}
                  {showSuggestions && (
                    <ul className="absolute z-50 bg-ebony-surface border border-ebony-border w-full max-h-40 overflow-y-auto rounded-b-lg shadow-lg mt-1">
                      {students
                        .filter(s => s.name.toLowerCase().includes(patientData.name.toLowerCase()))
                        .map(student => (
                          <li
                            key={student.id}
                            className="p-2 text-sm hover:bg-ebony-border/30 cursor-pointer text-white border-b border-ebony-border"
                            onClick={() => {
                              setPatientData({ ...patientData, name: student.name });
                              setShowSuggestions(false);
                            }}
                          >
                            <StudentNameWithBadge
                              student={student}
                              nameFallback={student.name}
                              className="text-sm text-white"
                              showText={false}
                            />
                          </li>
                        ))
                      }
                      {patientData.name && !students.some(s => s.name.toLowerCase() === patientData.name.toLowerCase()) && (
                        <li
                          className="p-2 text-sm hover:bg-ebony-border/30 cursor-pointer border-b border-ebony-border bg-ebony-primary/10"
                          onClick={() => setShowSuggestions(false)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-ebony-primary">+</span>
                            <span className="text-white">Usar "<strong>{patientData.name}</strong>" (novo)</span>
                          </div>
                        </li>
                      )}
                      {students.filter(s => s.name.toLowerCase().includes(patientData.name.toLowerCase())).length === 0 &&
                        !patientData.name && (
                          <li className="p-2 text-xs text-ebony-muted italic">Digite para buscar pacientes.</li>
                        )}
                    </ul>
                  )}
                </div>

                {/* DATA */}
                <div>
                  <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Data</label>
                  <input
                    type="date"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none text-sm"
                    value={patientData.date}
                    onChange={e => setPatientData({ ...patientData, date: e.target.value })}
                  />
                </div>

                {/* VALIDADE */}
                <div>
                  <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Validade</label>
                  <input
                    type="text"
                    placeholder="Ex: 30 dias"
                    list="validityList"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                    value={patientData.validity}
                    onChange={e => setPatientData({ ...patientData, validity: e.target.value })}
                  />
                  <datalist id="validityList">
                    <option value="30 dias" /><option value="60 dias" /><option value="Indeterminada" />
                  </datalist>
                </div>

                {/* AVIAR PARA */}
                <div>
                  <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Aviar para</label>
                  <input
                    type="text"
                    placeholder="Ex: 60 dias"
                    list="dispenseList"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                    value={patientData.dispense}
                    onChange={e => setPatientData({ ...patientData, dispense: e.target.value })}
                  />
                  <datalist id="dispenseList">
                    <option value="30 dias" /><option value="60 dias" /><option value="Uso contínuo" />
                  </datalist>
                </div>
              </div>
            </div>

            {/* ADICIONAR ITEM */}
            <div className="bg-ebony-surface p-5 rounded-xl shadow-sm border border-ebony-border">
              <h2 className="text-xs font-bold text-ebony-muted uppercase mb-4 flex items-center gap-2">
                <Pill className="w-4 h-4 text-ebony-muted" /> Adicionar Item
              </h2>

              <div className="space-y-4">
                {/* BUSCA NO BANCO */}
                <div className="bg-ebony-deep p-3 rounded-lg border border-ebony-border">
                  <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Buscar no Banco</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2 top-2.5 text-ebony-muted" />
                    <input
                      type="text"
                      placeholder="Digite para buscar..."
                      className="w-full pl-8 p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                      value={inventorySearch}
                      onChange={(e) => {
                        setInventorySearch(e.target.value);
                        setShowInventoryList(true);
                      }}
                      onFocus={() => setShowInventoryList(true)}
                      onBlur={() => setTimeout(() => setShowInventoryList(false), 200)}
                    />
                    {inventorySearch && (
                      <button onClick={() => setInventorySearch('')} className="absolute right-2 top-2.5 text-ebony-muted hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    {/* LISTA DE SUGESTÕES */}
                    {showInventoryList && inventorySearch && (
                      <ul className="absolute z-50 bg-ebony-surface border border-ebony-border w-full max-h-60 overflow-y-auto rounded-b-lg shadow-lg mt-1 left-0">
                        {inventory
                          .filter(item => {
                            const searchTerm = inventorySearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            const itemName = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            const itemUse = (item.use || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            const itemDesc = (item.internalDescription || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                            return itemName.includes(searchTerm) ||
                              itemUse.includes(searchTerm) ||
                              itemDesc.includes(searchTerm);
                          })
                          .map(item => (
                            <li
                              key={item.id}
                              className="p-3 text-sm hover:bg-ebony-border/30 cursor-pointer text-white border-b border-ebony-border"
                              onClick={() => handleSelectInventoryItem(item)}
                            >
                              <div className="flex flex-col space-y-1">
                                {/* NOME DA SUBSTÂNCIA */}
                                <span className="font-bold text-white text-sm">{item.name}</span>

                                {/* USO TERAPÊUTICO */}
                                {item.use && (
                                  <span className="text-xs text-ebony-primary uppercase font-semibold">
                                    {item.use}
                                  </span>
                                )}

                                {/* DESCRIÇÃO INTERNA */}
                                {item.internalDescription && (
                                  <div className="text-xs text-ebony-muted italic leading-relaxed bg-ebony-deep/50 p-2 rounded border-l-2 border-ebony-primary/30">
                                    <span className="text-ebony-primary">📝</span> {item.internalDescription}
                                  </div>
                                )}
                              </div>
                            </li>
                          ))
                        }
                        {inventory.filter(item => item.name.toLowerCase().includes(inventorySearch.toLowerCase())).length === 0 && (
                          <li className="p-2 text-xs text-ebony-muted italic">Nada encontrado no banco.</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>

                {/* CAMPOS HORIZONTAIS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* MOMENTO DE USO */}
                  <div>
                    <label className="block text-[10px] font-bold text-ebony-primary uppercase mb-1">Momento de Uso</label>
                    <input
                      type="text"
                      list="timesList"
                      placeholder="Ex: Ao Acordar"
                      className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none font-semibold text-sm"
                      value={formItem.time}
                      onChange={e => setFormItem({ ...formItem, time: e.target.value })}
                    />
                    <datalist id="timesList">
                      <option value="Ao Acordar" /><option value="Café da Manhã" /><option value="Almoço" /><option value="Pré-Treino" /><option value="Pós-Treino" /><option value="Jantar" /><option value="Antes de Dormir" />
                    </datalist>
                  </div>

                  {/* SUBSTÂNCIA */}
                  <div>
                    <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Substância + Dosagem</label>
                    <input
                      type="text"
                      className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                      value={formItem.name}
                      onChange={e => setFormItem({ ...formItem, name: e.target.value })}
                    />
                  </div>
                  {/* USO PADRÃO */}
                  <div>
                    <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Uso Padrão</label>
                    <input
                      type="text"
                      placeholder="Ex: 1 cápsula 2x ao dia"
                      className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                      value={formItem.dose}
                      onChange={e => setFormItem({ ...formItem, dose: e.target.value })}
                    />
                  </div>
                  {/* USO TERAPÊUTICO */}
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Uso Terapêutico</label>
                    <input
                      type="text"
                      placeholder="Ex: Libido / Sono"
                      className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                      value={formItem.use}
                      onChange={e => setFormItem({ ...formItem, use: e.target.value })}
                      onFocus={() => formItem.use === '' && setShowNewTagInput(true)}
                      onBlur={() => setTimeout(() => setShowNewTagInput(false), 200)}
                    />

                    {/* LISTA DE SUGESTÕES */}
                    {showNewTagInput && usageTags.length > 0 && (
                      <ul className="absolute z-50 bg-ebony-surface border border-ebony-border w-full max-h-40 overflow-y-auto rounded-b-lg shadow-lg mt-1">
                        {usageTags
                          .filter(tag => tag.toLowerCase().includes(formItem.use.toLowerCase()))
                          .map(tag => (
                            <li key={tag} className="flex items-center justify-between p-2 text-sm hover:bg-ebony-border/30 border-b border-ebony-border last:border-0">
                              <span
                                className="flex-1 text-white cursor-pointer"
                                onClick={() => {
                                  setFormItem({ ...formItem, use: tag });
                                  setShowNewTagInput(false);
                                }}
                              >
                                {tag}
                              </span>
                              <div className="flex gap-1 ml-2">
                                <button
                                  onClick={() => {
                                    const newName = prompt(`Renomear "${tag}" para:`, tag);
                                    if (newName && newName !== tag) editTag(tag, newName);
                                  }}
                                  className="text-xs px-1 py-0.5 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                                  title="Editar (afeta todos os registros)"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => removeTag(tag)}
                                  className="text-xs px-1 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                                  title="Excluir (afeta todos os registros)"
                                >
                                  ×
                                </button>
                              </div>
                            </li>
                          ))
                        }
                      </ul>
                    )}
                  </div>
                </div>

                {/* DESCRIÇÃO INTERNA DO MANIPULADO */}
                <div>
                  <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">Descrição Interna do Manipulado</label>
                  <textarea
                    rows="2"
                    placeholder="Ex: Contém 50mg de Tribulus + 25mg de Maca Peruana..."
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none resize-y text-sm min-h-[40px]"
                    value={formItem.internalDescription}
                    onChange={e => setFormItem({ ...formItem, internalDescription: e.target.value })}
                  />
                  <p className="text-[9px] text-ebony-muted mt-1 italic">* Campo interno, não aparece no PDF</p>
                </div>

                {/* BOTÕES */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={addToPrescription}
                    className="flex-1 bg-ebony-primary hover:bg-red-900 text-white font-bold py-2 rounded-lg shadow-lg transition flex items-center justify-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                  <button
                    onClick={saveCurrentToDb}
                    className="w-12 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface font-bold py-2 rounded-lg shadow-sm transition flex items-center justify-center"
                    title="Salvar no Banco"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* VISUALIZAÇÃO - LARGURA TOTAL */}
            <div className="bg-ebony-surface rounded-xl shadow-lg border border-ebony-border min-h-[600px] flex flex-col relative overflow-hidden">
              {/* Header Papel */}
              <div className="p-6 border-b border-ebony-border flex justify-between items-end bg-ebony-surface">
                <div>
                  <h2 className="text-xl font-bold text-white">Visualização</h2>
                  <p className="text-xs text-ebony-muted mt-1">Arraste os itens para reordenar.</p>
                </div>
                <button
                  onClick={clearPrescription}
                  className="text-ebony-muted text-xs font-bold hover:bg-ebony-deep px-3 py-1 rounded-lg transition flex items-center gap-1 border border-ebony-border"
                >
                  <Trash2 className="w-3 h-3" /> LIMPAR
                </button>
              </div>

              {/* LISTA DE ITENS */}
              <div className="flex-grow overflow-y-auto p-0">
                {currentPrescription.length === 0 ? (
                  <div className="text-center py-20 opacity-40">
                    <FileSignature className="w-16 h-16 mx-auto mb-4 text-ebony-muted" />
                    <p className="text-ebony-muted font-medium">Nenhum item adicionado.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-ebony-deep sticky top-0 z-10 shadow-sm">
                      <tr className="text-xs text-ebony-muted uppercase border-b border-ebony-border">
                        <th className="py-3 px-4 w-10 text-center text-ebony-muted">
                          <GripVertical className="w-4 h-4 mx-auto" />
                        </th>
                        <th className="py-3 px-2 w-3/12">Momento</th>
                        <th className="py-3 px-2 w-4/12">Item</th>
                        <th className="py-3 px-2 w-4/12">Uso</th>
                        <th className="py-3 px-2 w-16 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ebony-border">
                      {currentPrescription.map((item, index) => (
                        <tr
                          key={item.uid}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragEnter={(e) => handleDragEnter(e, index)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          className="hover:bg-ebony-border/30 transition group cursor-grab active:cursor-grabbing"
                        >
                          <td className="py-3 px-4 text-center text-ebony-muted group-hover:text-white">
                            <GripHorizontal className="w-4 h-4 mx-auto" />
                          </td>
                          <td className="py-3 px-2 align-top font-bold text-white text-sm">{item.time}</td>
                          <td className="py-3 px-2 align-top text-sm font-medium text-white">{item.name}</td>
                          <td className="py-3 px-2 align-top text-xs text-ebony-muted italic">{item.dose}</td>
                          <td className="py-3 px-2 text-center align-top whitespace-nowrap">
                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => editPrescriptionItem(item.uid)} className="text-ebony-muted hover:text-white">
                                <Pen className="w-3 h-3" />
                              </button>
                              <button onClick={() => removePrescriptionItem(item.uid)} className="text-ebony-muted hover:text-white">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* RODAPÉ DO PAPEL */}
              <div className="p-6 bg-ebony-surface border-t border-ebony-border">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-ebony-muted uppercase">Observações Finais</label>
                  <div className="flex gap-2">
                    <select
                      className="text-xs bg-ebony-deep border border-ebony-border text-white rounded-lg p-1 max-w-[150px] shadow-sm focus:border-ebony-primary outline-none"
                      onChange={(e) => {
                        const model = obsModels.find(m => m.id === e.target.value);
                        if (model) setGeneralNotes(model.text);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Carregar Modelo...</option>
                      {obsModels.map(m => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowModelSave(true)}
                      className="text-xs bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface px-2 py-1 rounded-lg transition flex items-center gap-1"
                      title="Salvar texto atual como modelo"
                    >
                      <Save className="w-3 h-3" /> Salvar Modelo
                    </button>
                  </div>
                </div>

                {showModelSave && (
                  <div className="mb-2 flex gap-2 animate-in slide-in-from-top-2">
                    <input
                      type="text"
                      placeholder="Nome do Modelo (Ex: Padrão Hormonal)"
                      className="flex-1 text-sm bg-ebony-deep border border-ebony-border text-white rounded-lg p-1 px-2 shadow-sm focus:border-ebony-primary outline-none"
                      value={newModelName}
                      onChange={e => setNewModelName(e.target.value)}
                    />
                    <button onClick={saveObsModel} className="bg-ebony-primary hover:bg-red-900 text-white text-xs px-3 rounded-lg font-bold transition">
                      OK
                    </button>
                    <button onClick={() => setShowModelSave(false)} className="bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface text-xs px-3 rounded-lg font-bold transition">
                      X
                    </button>
                  </div>
                )}

                <textarea
                  rows="4"
                  className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none"
                  value={generalNotes}
                  onChange={e => setGeneralNotes(e.target.value)}
                  placeholder="Digite as observações ou selecione um modelo acima..."
                ></textarea>

                <button
                  onClick={generatePDF}
                  className="mt-4 w-full bg-ebony-primary hover:bg-red-900 text-white font-bold py-4 rounded-lg shadow-lg flex justify-center items-center transition transform hover:-translate-y-1 gap-2"
                >
                  <FileText className="w-5 h-5" /> Baixar PDF da Receita
                </button>
              </div>
            </div>

          </div>
        )}

        {/* --- ABA 2: BANCO --- */}
        {activeTab === 'banco' && (
          <div className="animate-in fade-in space-y-6">
            <div className="bg-ebony-surface p-6 rounded-xl shadow-sm border border-ebony-border border-l-4 border-l-ebony-primary">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-ebony-muted" /> Cadastro Manual
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* USO TERAPÊUTICO */}
                <div className="md:col-span-3 relative">
                  <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Uso Terapêutico</label>
                  <input
                    type="text"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm outline-none"
                    value={dbItem.use}
                    onChange={e => setDbItem({ ...dbItem, use: e.target.value })}
                    placeholder="Ex: Sono"
                    onFocus={() => setShowNewTagInput(true)}
                    onBlur={() => setTimeout(() => setShowNewTagInput(false), 200)}
                  />

                  {/* LISTA DE SUGESTÕES */}
                  {showNewTagInput && usageTags.length > 0 && (
                    <ul className="absolute z-50 bg-ebony-surface border border-ebony-border w-full max-h-40 overflow-y-auto rounded-b-lg shadow-lg mt-1">
                      {usageTags
                        .filter(tag => tag.toLowerCase().includes(dbItem.use.toLowerCase()))
                        .map(tag => (
                          <li key={tag} className="flex items-center justify-between p-2 text-sm hover:bg-ebony-border/30 border-b border-ebony-border last:border-0">
                            <span
                              className="flex-1 text-white cursor-pointer"
                              onClick={() => {
                                setDbItem({ ...dbItem, use: tag });
                                setShowNewTagInput(false);
                              }}
                            >
                              {tag}
                            </span>
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => {
                                  const newName = prompt(`Renomear "${tag}" para:`, tag);
                                  if (newName && newName !== tag) editTag(tag, newName);
                                }}
                                className="text-xs px-1 py-0.5 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                                title="Editar (afeta todos os registros)"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => removeTag(tag)}
                                className="text-xs px-1 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                                title="Excluir (afeta todos os registros)"
                              >
                                ×
                              </button>
                            </div>
                          </li>
                        ))
                      }
                    </ul>
                  )}
                </div>

                {/* MOMENTO PADRÃO */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-ebony-primary uppercase mb-1">Momento Padrão</label>
                  <input
                    type="text"
                    list="timesListBanco"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm outline-none"
                    value={dbItem.defaultTime}
                    onChange={e => setDbItem({ ...dbItem, defaultTime: e.target.value })}
                    placeholder="Ex: Ao Acordar"
                  />
                  <datalist id="timesListBanco">
                    <option value="Ao Acordar" /><option value="Café da Manhã" /><option value="Almoço" /><option value="Pré-Treino" /><option value="Pós-Treino" /><option value="Jantar" /><option value="Antes de Dormir" />
                  </datalist>
                </div>

                {/* SUBSTÂNCIA */}
                <div className="md:col-span-6">
                  <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Substância</label>
                  <input
                    type="text"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm outline-none"
                    value={dbItem.name}
                    onChange={e => setDbItem({ ...dbItem, name: e.target.value })}
                  />
                </div>

                {/* USO PADRÃO */}
                <div className="md:col-span-6">
                  <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Uso Padrão</label>
                  <input
                    type="text"
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm outline-none"
                    value={dbItem.dose}
                    onChange={e => setDbItem({ ...dbItem, dose: e.target.value })}
                  />
                </div>

                {/* DESCRIÇÃO INTERNA */}
                <div className="md:col-span-6">
                  <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Descrição Interna do Manipulado</label>
                  <textarea
                    rows="2"
                    placeholder="Ex: Contém 50mg de Tribulus + 25mg de Maca Peruana..."
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none resize-y text-sm min-h-[40px]"
                    value={dbItem.internalDescription}
                    onChange={e => setDbItem({ ...dbItem, internalDescription: e.target.value })}
                  />
                  <p className="text-[9px] text-ebony-muted mt-1 italic">* Campo interno, não aparece no PDF</p>
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
                    <th className="p-4 w-2/12">Uso Terapêutico</th>
                    <th className="p-4 w-3/12">Substância</th>
                    <th className="p-4 w-3/12">Uso Padrão</th>
                    <th className="p-4 w-3/12">Descrição Interna</th>
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
                        <td className="p-4 text-ebony-muted font-semibold text-xs uppercase">{item.use || '-'}</td>
                        <td className="p-4 font-medium text-white">{item.name}</td>
                        <td className="p-4 text-ebony-muted text-sm">{item.dose}</td>
                        <td className="p-4 text-ebony-muted text-xs max-w-xs">
                          {item.internalDescription ? (
                            <div className="truncate" title={item.internalDescription}>
                              {item.internalDescription}
                            </div>
                          ) : (
                            <span className="italic">-</span>
                          )}
                        </td>
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
                  {new Date(previewItem.date).toLocaleDateString('pt-BR')} - {previewItem.studentName}
                </p>
              </div>
              <button onClick={() => setPreviewItem(null)} className="p-2 hover:bg-ebony-deep rounded-full transition border border-ebony-border">
                <X className="w-5 h-5 text-ebony-muted" />
              </button>
            </div>

            {/* Lista de Itens (Scrollável) */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {previewItem.items && previewItem.items.map((it, idx) => (
                  <div key={idx} className="flex gap-4 border-b border-ebony-border pb-3 last:border-0">
                    <div className="w-24 flex-shrink-0">
                      <span className="text-[10px] font-bold text-white uppercase bg-ebony-deep border border-ebony-border px-2 py-1 rounded">
                        {it.time}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">{it.name}</p>
                      <p className="text-xs text-ebony-muted mt-1">{it.dose}</p>
                    </div>
                  </div>
                ))}
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