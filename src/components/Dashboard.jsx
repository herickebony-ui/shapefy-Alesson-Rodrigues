import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import {
  collection, doc, updateDoc, setDoc, getDocs, deleteDoc, addDoc,
  query, where, orderBy, getDoc, onSnapshot,
  writeBatch, arrayRemove
} from "firebase/firestore";
import {
  Copy, HelpCircle, Users, FileText, Settings,
  Plus, Trash2, Edit, Save, X, Search, FileSignature,
  Palette, CheckCircle, Loader, Share2, ArrowLeft, LogOut,
  Bell, Check, CheckSquare, Wallet, History, Link as LinkIcon, ChevronRight,
  MoreVertical, MessageSquare, ClipboardList, LayoutList, Calendar
} from 'lucide-react';
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
const PrescriptionModule = lazy(() => import('./PrescriptionModule'));
const PainelTreinosRealizados = lazy(() => import('./PainelTreinosRealizados'));
const PainelFeedbacks = lazy(() => import('./PainelFeedbacks'));
const Fichas = lazy(() => import('./Fichas'));
const Legendas = lazy(() => import('./Legendas'));
const DietasListagem = lazy(() => import('./Dietaslistagem'));
const AlunosHub = lazy(() => import('./AlunosHub'));
const Anamneses = lazy(() => import('./Anamneses'));
const ExamsModule = lazy(() => import('./ExamsModule'));

import {
  CalendarRange, Activity, Pill, User, LayoutDashboard, Monitor,
  Menu, ChevronLeft, PanelLeftClose, PanelLeftOpen, Megaphone,
  Dumbbell
} from 'lucide-react';

import { db } from '../firebase';
import { generateSlug, logContractEvent } from '../utils/utils';

const FinancialModule = lazy(() => import('./FinancialModule'));
const DashboardFlowsTab = lazy(() => import('./DashboardFlowsTab'));
const ProfileModule = lazy(() => import('./ProfileModule'));
const TeamModule = lazy(() => import('./TeamModule'));
const StudentsTab = lazy(() => import('./StudentsTab'));
const StudentFormModal = lazy(() => import('./StudentFormModal'));
const ContractManager = lazy(() => import('./ContractManager'));
const QuickFinancialModal = lazy(() => import('./QuickFinancialModal'));
const OperationsHub = lazy(() => import('./OperationsHub'));
const HeaderTitanium = lazy(() => import('./HeaderTitanium'));
const CardTitanium = lazy(() => import('./CardTitanium'));
const ButtonPrimary = lazy(() => import('./ButtonPrimary'));
const InputTitanium = lazy(() => import('./InputTitanium'));
const MembersAdmin = lazy(() => import("./members/MembersAdmin"));
const FeedbackModule = lazy(() => import('./FeedbackModule'));

// --- COMPONENTE DASHBOARD (ADMIN) ---
const Dashboard = ({
  onSelectPlan,
  onCreatePlan,
  plans,
  onDeletePlan,
  onDuplicatePlan,
  onUpdatePlanMeta, onUpdatePlanColor,
  students,
  onCreateStudent,
  onDeleteStudent,
  onReloadData,
  onToggleDelivery,
}) => {

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false); // Para abrir/fechar o menu do sino
  const auth = getAuth();
  const contractRef = useRef();
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // Trava para evitar erro no F5

  // 1. Monitora o Login e destrava o sistema
  useEffect(() => {
    const authInstance = getAuth();
    const unsub = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user || null);
      setIsAuthReady(true); // <--- AQUI: Libera o sistema só após conectar
    });
    return () => unsub();
  }, []);

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'alunos_hub';
});

useEffect(() => {
    const titles = {
        financial: 'Financeiro',
        profile: 'Perfil',
        tasks: 'Tarefas',
        feedbacks: 'Feedbacks Consultoria',
        feedback_calendar: 'Calendário de Feedbacks',
        alunos_hub: 'Alunos',
        communication: 'Comunicação',
        prescriptions: 'Prescrições',
        feedbacks_recebidos: 'Feedbacks Recebidos',
        workouts: 'Treinos',
        fichas: 'Fichas',
        dietas: 'Dieta',
        legendas: 'Legendas',
        anamneses: 'Anamneses',
        exams: 'Exames',
        team: 'Equipe',
        members_admin: 'Membros',
        students: 'Alunos',
        templates: 'Templates',
    };
    document.title = titles[activeTab] || 'Shapefy';
}, [activeTab]);
  
  // 3. Atualiza a URL quando clica no botão
  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  // --- EFEITO PARA SALVAR SEMPRE QUE MUDAR ---
  useEffect(() => {
    localStorage.setItem("lastActiveTab", activeTab);
  }, [activeTab]);
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [dietaIdInicial, setDietaIdInicial] = useState(null);
  const [fichaIdInicial, setFichaIdInicial] = useState(null);
  const [userRole, setUserRole] = useState(null);// NOVO:
const [rolePermissions, setRolePermissions] = useState(null); // 'admin' ou 'consultant'
  
  // --- ESTADO DA SIDEBAR (MINI vs FULL) ---
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false); // Começa fechada (Mini)

  useEffect(() => {
    if (!currentUser) return;
  
    let cancelled = false;
  
    const fetchRoleAndPermissions = async () => {
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const settingsRef = doc(db, "settings", "role_permissions");
  
        const userSnap = await getDoc(userRef).catch(() => null);
        if (cancelled) return;
  
        if (!userSnap || !userSnap.exists()) {
          setUserRole(null);
          setRolePermissions(null);
          return;
        }
  
        const role = userSnap.data()?.role || null;
        setUserRole(role);
  
        if (role === "admin") {
          setRolePermissions(null);
          return;
        }
  
        const permSnap = await getDoc(settingsRef).catch(() => null);
        if (cancelled) return;
  
        setRolePermissions(permSnap && permSnap.exists() ? permSnap.data() : null);
      } catch (error) {
        console.error("Erro ao carregar permissões:", error);
        if (!cancelled) {
          setUserRole(null);
          setRolePermissions(null);
        }
      }
    };
  
    fetchRoleAndPermissions();
  
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // Helper: verifica se o cargo atual pode acessar uma tela
  const canAccess = (telaId) => {
    if (!userRole) return true; // ainda carregando → mostra tudo por ora
    if (userRole === 'admin') return true;
    if (!rolePermissions) return true; // sem permissões salvas → libera
    return !!rolePermissions[userRole]?.[telaId];
  };

  // Mapa: tab ID do Dashboard → ID de permissão do TeamModule
  const TAB_PERM = {
    alunos_hub:        'hub_alunos',
    fichas:            'fichas_treino',
    dietas:            'dietas',
    feedbacks_recebidos:'feedbacks_recebidos',
    workouts:          'treinos_realizados',
    legendas:          'banco_textos',
    feedbacks:         'feedbacks_visao',
    feedback_calendar: 'cronograma',
    tasks:             'gestao_tarefas',
    communication:     'comunicacao',
    exams:             'exames',
    prescriptions:     'prescricoes', 
    financial:         'financeiro',
    templates:         'contratos',
    flows:             'fluxos',
    members_admin:     'area_membros',
    team:              'equipe',
  };

  // Remove tudo que não é número e tira o '55' do início, se existir
  const cleanPhone = (phone) => {
    let cleaned = String(phone || "").replace(/\D/g, "");
    if (cleaned.startsWith("55") && cleaned.length > 11) {
      cleaned = cleaned.substring(2);
    }
    return cleaned;
  };

  const studentsById = useMemo(() => {
    const m = {};
    (students || []).forEach(s => { m[s.id] = s; });
    return m;
  }, [students]);

  const plansById = useMemo(() => {
    const m = {};
    (plans || []).forEach(p => { m[p.id] = p; });
    return m;
  }, [plans]);



  // --- ESTADOS DE FLUXOS ---
  const [newPlanName, setNewPlanName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editName, setEditName] = useState("");
  const [duplicatingPlan, setDuplicatingPlan] = useState(null);
  const [duplicateName, setDuplicateName] = useState("");
  // --- ESTADOS PARA O MODAL DE DUPLICAR MODELO ---
  const [duplicatingTemplate, setDuplicatingTemplate] = useState(null); // Guarda o modelo que será copiado
  const [duplicateTemplateName, setDuplicateTemplateName] = useState(""); // Guarda o nome novo que você está digitando

  // --- ESTADOS DE ALUNOS & CONVITE ---
  const [isInviting, setIsInviting] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null); // ID do aluno sendo editado/aprovado

  // ... outros estados ...
  const [showQuickFinModal, setShowQuickFinModal] = useState(false);
  const [targetStudentForFin, setTargetStudentForFin] = useState(null);

  // Campos básicos do convite
  const [newStudentName, setNewStudentName] = useState("");
  // --- COLE ISSO NO INÍCIO DO COMPONENTE (JUNTO COM OS OUTROS useStates) ---

  // Se você já tiver o newStudentPhone, pode apagar essa linha para não duplicar
  const [newStudentPhone, setNewStudentPhone] = useState("");

  // ESSAS SÃO AS DUAS QUE FALTAM E ESTÃO DANDO ERRO:
  const [newStudentWhatsapp, setNewStudentWhatsapp] = useState("");
  const [isSameNumber, setIsSameNumber] = useState(true);



  // Estado para editar os dados extras do aluno (CPF, RG, etc.)
  const [extraData, setExtraData] = useState({ cpf: '', rg: '', cep: '', street: '', number: '', neighborhood: '', city: '', state: '', email: '', address: '', birthDate: '', profession: '' });

  // --- ESTADOS DE MODELOS (TEMPLATES) ---
  const [templates, setTemplates] = useState([]);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState({ id: '', name: '', content: '', fields: [] });
  const [newField, setNewField] = useState({ key: '', label: '', type: 'text', owner: 'admin' });

  const handleSaveTemplate = async () => {
    if (!currentTemplate.name) return alert("Dê um nome ao modelo.");
    try {
      const id = currentTemplate.id || generateSlug(currentTemplate.name);
      await setDoc(doc(db, "contract_templates", id), {
        name: currentTemplate.name,
        content: currentTemplate.content,
        fields: currentTemplate.fields || [],
        updatedAt: new Date().toISOString()
      });
      alert("Modelo salvo!");
      setIsEditingTemplate(false);
      const q = await getDocs(collection(db, "contract_templates"));
      setTemplates(q.docs.map(d => ({ ...d.data(), id: d.id })));
    } catch (e) { alert("Erro ao salvar template"); console.error(e); }
  };
  // 1. Abre o Modal e prepara o nome sugerido
  const openDuplicateModal = (template) => {
    setDuplicatingTemplate(template);
    setDuplicateTemplateName(`${template.name} (Cópia)`);
  };

  // 2. Executa a Duplicação (Ao clicar no botão preto do modal)
  const handleConfirmDuplicate = async () => {
    if (!duplicateTemplateName.trim()) return alert("O nome não pode estar vazio.");

    try {
      const template = duplicatingTemplate;

      // Gera o ID baseado no que você escreveu no input
      const newId = generateSlug(duplicateTemplateName);

      // Monta o novo objeto
      const newTemplate = {
        ...template,
        name: duplicateTemplateName,
        updatedAt: new Date().toISOString()
      };

      delete newTemplate.id; // Remove ID antigo

      // Salva com o ID personalizado
      await setDoc(doc(db, "contract_templates", newId), newTemplate);

      // Atualiza lista
      const q = await getDocs(collection(db, "contract_templates"));
      setTemplates(q.docs.map(d => ({ ...d.data(), id: d.id })));

      alert(`✅ Modelo duplicado!\nID gerado: ${newId}`);
      setDuplicatingTemplate(null); // Fecha o modal

    } catch (e) {
      console.error("Erro ao duplicar:", e);
      alert("Erro ao duplicar modelo.");
    }
  };
  // --- FUNÇÃO DE EXCLUIR MODELO ---
  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("⚠️ Tem certeza que deseja excluir este modelo permanentemente?")) return;

    try {
      await deleteDoc(doc(db, "contract_templates", templateId));

      // Atualiza a lista removendo o item excluído (sem precisar recarregar tudo)
      setTemplates(prev => prev.filter(t => t.id !== templateId));

      alert("🗑️ Modelo excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir modelo.");
    }
  };
  // --- FUNÇÃO DE LOGOUT ---
  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      // O App.jsx vai perceber que o user é null e vai te jogar pra tela de Login automaticamente
    } catch (error) {
      alert("Erro ao sair: " + error.message);
    }
  };

  const addFieldToTemplate = () => {
    if (!newField.key || !newField.label) return alert("Preencha Chave e Rótulo");
    const cleanKey = newField.key.replace(/[{}]/g, '').trim();
    setCurrentTemplate({ ...currentTemplate, fields: [...currentTemplate.fields, { ...newField, key: cleanKey }] });
    setNewField({ key: '', label: '', type: 'text', owner: 'admin' });
  };

  const removeFieldFromTemplate = (idx) => {
    const newFields = [...currentTemplate.fields];
    newFields.splice(idx, 1);
    setCurrentTemplate({ ...currentTemplate, fields: newFields });
  };
  const handleFinancialSuccess = (wasPaid = true) => {
    const studentToProceed = targetStudentForFin;

    setTimeout(() => {
      // Se houve pagamento (wasPaid = true), pergunta se quer contrato
      if (wasPaid) {
        if (window.confirm(`Financeiro processado! Deseja abrir o contrato de ${studentToProceed?.name} agora?`)) {
          openApproveModal(studentToProceed);
        }
      }
      // Se PULOU (wasPaid = false), APENAS LOGA. 
      // (AQUI ESTAVA O ERRO: você chamava openApproveModal aqui também)
      else {
        console.log("Fluxo financeiro pulado/encerrado.");
      }

      setTargetStudentForFin(null);
      // Se tiver a função de fechar o modal financeiro, chame-a aqui, ex:
      setShowQuickFinModal(false);

      if (onReloadData) onReloadData();
    }, 300);
  };

  // --- ESCUTAR NOTIFICAÇÕES (CORRIGIDO PARA EMAIL) ---
  useEffect(() => {
    // Precisa ter usuário e e-mail carregados
    if (!currentUser || !currentUser.email) return;

    // Busca notificações onde o DESTINATÁRIO (recipientEmail) é o meu email
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", currentUser.email),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(notifs);
    }, (error) => {
      console.error("Erro busca notificações:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Função para marcar como lida
  const markAsRead = async (notifId) => {
    await updateDoc(doc(db, "notifications", notifId), { read: true });
  };
  // --- EFEITOS (LOADERS) ---
  useEffect(() => {
    if (activeTab === 'templates' || isInviting) {
      const loadTemplates = async () => {
        try {
          const database = db;
          if (!database) return;
          const q = await getDocs(collection(database, "contract_templates"));
          const data = q.docs.map(d => ({ ...d.data(), id: d.id }));
          setTemplates(data);
          console.log("Templates carregados:", data.length);
        } catch (e) { console.error("Erro ao buscar templates:", e); }
      };
      loadTemplates();
    }
  }, [activeTab, isInviting]);

  // --- FUNÇÕES DE FLUXO ---
  const handleCreate = () => {
    if (!newPlanName) return;
    const id = generateSlug(newPlanName);
    const exists = plans.some(p => p.id === id);
    if (exists) { alert("Já existe um fluxo com este nome/ID."); return; }
    onCreatePlan(id, newPlanName);
  };

  const copyLink = (id) => {
    const url = `${window.location.origin}/?id=${id}`;
    navigator.clipboard.writeText(url);
    alert("Link copiado: " + url);
  };

  // --- FUNÇÃO: COPIAR LINK DO ALUNO (sempre usando o domínio oficial) ---
  const copyStudentLink = (studentId) => {
    const baseUrl = (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/$/, "");
    const url = `${baseUrl}/?token=${studentId}`;

    navigator.clipboard.writeText(url);
    alert("Link de acesso do aluno copiado:\n" + url);
  };

  const saveEdit = () => {
    if (!editName) return alert("Nome obrigatório");
    onUpdatePlanMeta(editingPlan.id, editingPlan.id, editName);
    setEditingPlan(null);
  };

  const confirmDuplicate = () => {
    if (!duplicateName) return alert("Nome da cópia obrigatório");
    onDuplicatePlan(duplicatingPlan.id, duplicateName);
    setDuplicatingPlan(null);
  };

  // --- FUNÇÕES DE ALUNO (CONVITE INTELIGENTE & APROVAÇÃO) ---

  // Função para abrir o modal com os dados do aluno que veio do site
  // --- FUNÇÕES DE ALUNO (CONVITE INTELIGENTE & APROVAÇÃO) ---

  const openApproveModal = (student) => {
    setEditingStudentId(student.id);
    setNewStudentName(student.name || "");
    setNewStudentPhone(student.phone || "");
    setNewStudentWhatsapp(student.whatsapp || student.phone || "");
    setIsSameNumber(true);
    setExtraData({
      cpf: student.cpf || '',
      rg: student.rg || '',
      email: student.email || '',
      birthDate: student.birthDate || '',
      profession: student.profession || '',
      address: student.address || '',
      cep: student.cep || '',
      street: student.street || '',
      number: student.number || '',
      neighborhood: student.neighborhood || '',
      city: student.city || '',
      state: student.state || ''
    });
    setIsInviting(true);
  };

  // --- FUNÇÃO DE EXCLUSÃO OPERACIONAL (Mantém Histórico) ---
  const handleDeleteFullStudent = async (studentId) => {
    if (!window.confirm("🗑️ Tem certeza?\n\nO aluno será removido da lista ativa e dos agendamentos de feedback.\n\nO histórico financeiro e de contratos SERÁ MANTIDO para segurança.")) return;

    try {
      // Apaga no Frappe primeiro
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fns = getFunctions();
      const excluirAluno = httpsCallable(fns, 'excluirAluno');
      await excluirAluno({ id: studentId }).catch(e => console.warn("Frappe delete:", e.message));

      const batch = writeBatch(db);

      // 1. Apagar Perfil Principal (Para sumir da lista de alunos)
      const studentRef = doc(db, "students", studentId);
      batch.delete(studentRef);

      // 2. Apagar Cronograma de Feedback (PARA MATAR O FANTASMA DA LISTA DE FEEDBACKS)
      const feedbackRef = doc(db, "feedback_schedules", studentId);
      batch.delete(feedbackRef);

      // --- O QUE ESTAMOS MANTENDO (COMENTADO) ---
      // Mantemos tasks, contracts e payments para você não perder o histórico.

      // 3. (OPCIONAL) Se quiser limpar tarefas pendentes do Kanban para não poluir, 
      // descomente as linhas abaixo. Se quiser manter registro do que foi feito, deixe comentado.
      /*
      const qTasks = query(collection(db, "tasks"), where("studentId", "==", studentId), where("completed", "==", false));
      const tasksSnap = await getDocs(qTasks);
      tasksSnap.forEach((doc) => batch.delete(doc.ref));
      */

      // EXECUTA A LIMPEZA
      await batch.commit();

      alert("✅ Aluno removido da operação (Histórico mantido).");

      if (onReloadData) onReloadData();

    } catch (error) {
      console.error("Erro ao excluir aluno:", error);
      alert("Erro ao excluir registros: " + error.message);
    }
  };

  // --- FUNÇÃO DE CHECK NA NOTIFICAÇÃO ---
  const toggleNotificationRead = async (e, notif) => {
    e.stopPropagation(); // Impede que abra a tarefa ao clicar no check
    try {
      const docRef = doc(db, "notifications", notif.id);
      await updateDoc(docRef, { read: !notif.read });
    } catch (err) {
      console.error("Erro ao marcar notificação:", err);
    }
  };
  const handleNotificationClick = (notif) => {
    if (notif.taskId) {
      // REMOVIDO: Não marca mais como lida automaticamente. 
      // Agora só marca se você clicar no botão de check.

      // 1. Define a tarefa pendente para o Kanban abrir
      setPendingTaskId(notif.taskId);

      // 2. Muda para a aba 'ops' (Hub)
      setActiveTab('ops');

      // 3. Fecha o menu
      setShowNotifications(false);
    }
  };

  // --- TELA DE CARREGAMENTO (Proteção contra erro no F5) ---
  if (!isAuthReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#121214] text-white">
        <div className="flex flex-col items-center gap-4 animate-in fade-in">
          <Loader className="w-10 h-10 animate-spin text-[#850000]" />
          <p className="text-xs text-gray-500 font-mono tracking-widest uppercase">
            Carregando Sistema...
          </p>
        </div>
      </div>
    );
  }

  // --- RENDERIZAÇÃO DO DASHBOARD ---
  return (
    <div className="flex h-screen bg-ebony-bg font-sans text-ebony-text overflow-hidden selection:bg-ebony-primary selection:text-white">

      {/* === MOBILE DRAWER (GAVETA) === */}
      {/* Só aparece no celular quando clica no menu */}
      {isSidebarExpanded && (
        <div
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsSidebarExpanded(false)}
        />
      )}

      {/* === BOTÃO FLUTUANTE MOBILE (Setinha para abrir) === */}
      {!isSidebarExpanded && (
        <button
          onClick={() => setIsSidebarExpanded(true)}
          className="fixed top-36 left-0 z-[70] md:hidden p-2 bg-ebony-surface border border-ebony-border border-l-0 rounded-r-lg shadow-lg text-ebony-muted hover:text-white transition-all"
        >
          <PanelLeftOpen size={18} />
        </button>
      )}

      {/* === SIDEBAR LATERAL (TITANIUM) === */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-[60] flex flex-col flex-shrink-0
          bg-ebony-surface border-r border-ebony-border shadow-2xl transition-all duration-300 ease-in-out
          ${isSidebarExpanded ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'}
        `}
      >
        {/* 1. Header da Sidebar (Logo) */}
        <div className={`h-16 flex items-center ${isSidebarExpanded ? 'justify-between px-4' : 'justify-center'} border-b border-ebony-border bg-ebony-deep/50`}>
          {isSidebarExpanded ? (
            <div className="flex items-center gap-2 text-white font-bold tracking-wider animate-in fade-in">
              <div className="p-1.5 bg-ebony-primary rounded-md shadow-neon-red">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm">AR TEAM</span>
            </div>
          ) : (
            <div className="p-2 bg-ebony-primary rounded-xl shadow-neon-red animate-in zoom-in">
              <Activity className="w-5 h-5 text-white" />
            </div>
          )}

          {/* Botão de Recolher (Desktop e Mobile) */}
          <button
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="p-1.5 text-ebony-muted hover:text-white rounded-lg hover:bg-ebony-deep transition-colors"
          >
            {isSidebarExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>

        {/* 2. Menu de Navegação */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-3 space-y-2 custom-scrollbar">

          {/* Helper Component para Ícones */}
          {[
            { id: 'alunos_hub',          label: 'Hub de Alunos',        icon: Users },
            { id: 'fichas',              label: 'Fichas de Treino',      icon: Dumbbell },
            { id: 'dietas',              label: 'Dietas',                icon: ClipboardList },
            { id: 'feedbacks_recebidos', label: 'Feedbacks Recebidos',   icon: MessageSquare },
            { id: 'workouts',            label: 'Treinos Realizados',    icon: Dumbbell },
            { id: 'legendas',            label: 'Banco de Textos',       icon: FileText },
            { id: 'anamneses',           label: 'Anamneses',             icon: FileText },
            { id: 'students',            label: 'Alunos',                icon: Users },
            { id: 'financial',           label: 'Financeiro',            icon: Wallet },
            { id: 'feedbacks',           label: 'Feedbacks Visão Geral', icon: MessageSquare },
            { id: 'feedback_calendar',   label: 'Cronograma de Feedbacks', icon: CalendarRange },
            { type: 'divider', label: 'Gestão' },
            { id: 'tasks',               label: 'Gestão de Tarefas',     icon: CheckSquare },
            { id: 'exams',               label: 'Exames',                icon: Activity },
            { id: 'prescriptions',       label: 'Prescrições',           icon: Pill },
            { id: 'templates',           label: 'Contratos',             icon: FileText },
            { id: 'flows',               label: 'Fluxos',                icon: LayoutDashboard },
            userRole === 'admin' && { id: 'team', label: 'Equipe', icon: Users },
          ].map((item, idx) => {
            if (!item) return null;
            if (item.id && !canAccess(TAB_PERM[item.id] || item.id)) return null;

            // Renderiza Divisórias
            if (item.type === 'divider') {
              return isSidebarExpanded ? (
                <p key={idx} className="px-3 pt-4 pb-1 text-[10px] font-bold text-ebony-muted/60 uppercase tracking-widest animate-in fade-in">
                  {item.label}
                </p>
              ) : (
                <div key={idx} className="my-4 border-t border-ebony-border/50 mx-2" />
              );
            }

            // Renderiza Botões
            // Renderiza Botões
            const isActive = activeTab === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  // Se segurar Command (Mac) / Ctrl (Windows) ou usar a rodinha do mouse, o navegador abre nova guia sozinho
                  if (e.ctrlKey || e.metaKey || e.button === 1) return;

                  // Se for um clique normal, altera a tela atual sem piscar a página
                  e.preventDefault();
                  setActiveTab(item.id);
                  if (window.innerWidth < 768) setIsSidebarExpanded(false);
                }}
                className={`
                  relative group w-full flex items-center rounded-xl transition-all duration-200
                  ${isSidebarExpanded ? 'px-3 py-3 gap-3' : 'justify-center py-3'}
                  ${isActive
                    ? 'bg-gradient-to-r from-ebony-primary to-red-900 text-white shadow-lg shadow-ebony-primary/20 border border-white/10'
                    : 'text-ebony-muted hover:text-white hover:bg-ebony-deep/80'
                  }
                `}
              >
                <item.icon className={`${isSidebarExpanded ? 'w-5 h-5' : 'w-6 h-6'} transition-transform group-hover:scale-110`} />

                {isSidebarExpanded && (
                  <span className="text-sm font-medium whitespace-nowrap animate-in fade-in slide-in-from-left-2">
                    {item.label}
                  </span>
                )}

                {/* Tooltip Flutuante (Modo Mini) */}
                {!isSidebarExpanded && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-ebony-surface border border-ebony-border rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl pointer-events-none">
                    {item.label}
                    {/* Triângulo do tooltip */}
                    <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-ebony-border" />
                  </div>
                )}
              </a>
            );
          })}
        </nav>

        {/* 3. Footer Sidebar (Sair) */}
        <div className="p-3 border-t border-ebony-border bg-ebony-deep/30">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center rounded-xl transition-colors text-ebony-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 ${isSidebarExpanded ? 'px-4 py-2 gap-3' : 'justify-center py-2'}`}
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
            {isSidebarExpanded && <span className="text-xs font-bold uppercase">Sair</span>}
          </button>
        </div>
      </aside>

      {/* === ÁREA DE CONTEÚDO PRINCIPAL (DIREITA) === */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-ebony-bg">

        {/* === HEADER TITANIUM MINIMAL === */}
        <header className="flex flex-col md:flex-row md:items-center justify-between px-8 py-6 border-b border-ebony-border bg-ebony-bg/95 backdrop-blur shrink-0 z-50 gap-4">

          {/* LADO ESQUERDO: Identidade e Título */}
          <div className="flex flex-col gap-1">

            {/* Breadcrumbs (Migalhas) */}
            <span className="text-ebony-muted text-[10px] font-bold tracking-widest uppercase flex items-center gap-2">
              ArTeam <span className="text-ebony-border">/</span> {activeTab === 'students' ? 'Principal' : activeTab}
            </span>

            <div className="flex items-center gap-4 mt-1">
              {/* O Retângulo Vermelho (Âncora Visual) */}
              <div className="w-1.5 h-10 bg-ebony-primary rounded-sm shadow-[0_0_15px_rgba(220,38,38,0.4)] animate-in fade-in slide-in-from-left-2"></div>

              {/* Textos */}
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase leading-none">
                  Gestão Consultoria
                </h1>
                <p className="text-[10px] md:text-xs text-gray-400 font-medium tracking-wide uppercase mt-0.5">
                  Consultoria ArTeam
                </p>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: Ações (Mantendo a lógica funcional) */}
          <div className="flex items-center justify-end gap-3 md:gap-6">

            {/* Notificações */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 relative rounded-full hover:bg-ebony-surface border border-transparent hover:border-ebony-border transition-all text-ebony-muted hover:text-white group"
              >
                <Bell size={20} className="group-hover:text-ebony-primary transition-colors" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-2 right-2.5 w-2 h-2 bg-ebony-primary rounded-full animate-pulse shadow-neon-red"></span>
                )}
              </button>

              {/* Dropdown de Notificações */}
              {showNotifications && (
                // FIX 1: Z-Index aumentado para 9999 para ficar por cima de tudo
                <div className="fixed right-2 left-2 md:left-auto md:right-4 top-44 md:top-20 md:w-96 bg-ebony-surface rounded-xl shadow-2xl border border-ebony-border z-[9999] overflow-hidden ring-1 ring-white/5 animate-in zoom-in-95 duration-200 origin-top-right max-h-[70vh]">

                  <div className="p-3 border-b border-ebony-border bg-ebony-deep flex justify-between items-center">
                    <h4 className="text-white text-xs font-bold uppercase tracking-wider">Notificações</h4>
                    <span className="text-[10px] bg-ebony-primary/20 text-ebony-primary px-2 py-0.5 rounded border border-ebony-primary/30">
                      {notifications.filter(n => !n.read).length} Pendentes
                    </span>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 && <p className="text-xs text-ebony-muted text-center py-6">Tudo limpo por aqui.</p>}

                    {notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 border-b border-ebony-border/50 cursor-pointer transition-all flex gap-3 items-start group
                        ${n.read ? 'bg-ebony-surface opacity-60 hover:opacity-100' : 'bg-ebony-deep/30 hover:bg-ebony-deep/50'}
                      `}
                      >
                        {/* FIX 2: Botão de Check interativo */}
                        <button
                          onClick={(e) => toggleNotificationRead(e, n)}
                          className={`mt-0.5 shrink-0 transition-all rounded-full p-0.5
                          ${n.read
                              ? 'text-green-500 hover:text-green-400'
                              : 'text-ebony-muted hover:text-white'
                            }`}
                          title={n.read ? "Marcar como não lida" : "Marcar como lida"}
                        >
                          {n.read ? (
                            <CheckCircle className="w-4 h-4 fill-current" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-current hover:bg-white/10"></div>
                          )}
                        </button>

                        <div className="flex-1">
                          {/* Adicionei 'whitespace-pre-wrap' para respeitar o Enter e 'line-clamp-3' para não ficar gigante */}
                          <p className={`text-xs leading-relaxed whitespace-pre-wrap line-clamp-3 ${n.read ? 'text-ebony-muted line-through decoration-ebony-border' : 'text-white font-medium'}`}>
                            {n.message}
                          </p>
                          <p className="text-[9px] text-ebony-muted mt-1.5 flex items-center gap-1">
                            {new Date(n.createdAt).toLocaleDateString('pt-BR')} às {new Date(n.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Divisória Vertical */}
            <div className="h-8 w-px bg-ebony-border hidden md:block"></div>

            {/* Perfil do Admin */}
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
            >
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-white leading-tight group-hover:text-ebony-primary transition-colors">Administrador</p>
                <p className="text-[10px] text-ebony-muted font-mono">{currentUser?.email?.split('@')[0]}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-black border border-ebony-border group-hover:border-ebony-primary/50 flex items-center justify-center text-white shadow-lg transition-all">
                <User size={18} />
              </div>
            </button>
          </div>
        </header>

        {/* CONTAINER DE ROLAGEM DO CONTEÚDO */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 scrollbar-thin scrollbar-thumb-ebony-border scrollbar-track-transparent">
          {/* Mudei de max-w-7xl para w-full e removi o mx-auto pois agora ele ocupa tudo */}
          <div className="w-full h-full pb-20">
            <Suspense fallback={<div className="flex w-full pt-32 items-center justify-center text-ebony-muted font-mono text-xs uppercase tracking-widest"><Loader className="w-6 h-6 animate-spin text-ebony-primary mr-3" /> Carregando módulo...</div>}>

            {activeTab === 'flows' && (
              <DashboardFlowsTab
                editingPlan={editingPlan}
                setEditingPlan={setEditingPlan}
                editName={editName}
                setEditName={setEditName}
                saveEdit={saveEdit}
                duplicatingPlan={duplicatingPlan}
                setDuplicatingPlan={setDuplicatingPlan}
                duplicateName={duplicateName}
                setDuplicateName={setDuplicateName}
                confirmDuplicate={confirmDuplicate}
                isCreating={isCreating}
                setIsCreating={setIsCreating}
                newPlanName={newPlanName}
                setNewPlanName={setNewPlanName}
                handleCreate={handleCreate}
                plans={plans}
                onSelectPlan={onSelectPlan}
                onUpdatePlanColor={onUpdatePlanColor}
                copyLink={copyLink}
                onDeletePlan={onDeletePlan}
              />
            )}
            {/* --- ABA FINANCEIRO (ADICIONE ISTO) --- */}
            {activeTab === 'financial' && canAccess('financeiro') && (
              <div className="animate-in fade-in duration-300">
                <FinancialModule onReloadData={onReloadData} />
              </div>
            )}
            {/* COLE O PERFIL AQUI, FORA DOS OUTROS */}
            {activeTab === 'profile' && (
              <div className="animate-in fade-in duration-300">
                <ProfileModule />
              </div>
            )}
            {/* --- GESTÃO DE TAREFAS --- */}
            {activeTab === 'tasks' && canAccess('gestao_tarefas') && (
              <div className="animate-in fade-in duration-300">
                <OperationsHub
                  students={students}
                  pendingTaskId={pendingTaskId}
                  setPendingTaskId={setPendingTaskId}
                  initialTab="tasks"
                  hideNavigation={true} // <--- ESCONDE O MENU SUPERIOR
                />
              </div>
            )}

            {/* --- GESTÃO DE FEEDBACKS (VISÃO GERAL E CALENDÁRIO) --- */}
            {(activeTab === 'feedbacks' || activeTab === 'feedback_calendar') && canAccess('feedbacks_visao') && (
  <div className="animate-in fade-in duration-300">
    <FeedbackModule
      initialView={activeTab === 'feedback_calendar' ? 'calendar' : 'dashboard'}
    />
  </div>
)}
            {activeTab === 'anamneses' && (
  <div className="animate-in fade-in duration-300">
    <Anamneses />
  </div>
)}
            {activeTab === 'alunos_hub' && (
              <div className="animate-in fade-in duration-300">
                <AlunosHub
                  onAbrirDieta={(id) => { setDietaIdInicial(id); setActiveTab('dietas'); }}
                  onAbrirFicha={(id) => { setFichaIdInicial(id); setActiveTab('fichas'); }}
                />
              </div>
            )}
            {/* --- GESTÃO DE COMUNICAÇÃO --- */}
            {activeTab === 'communication' && canAccess('comunicacao') && (
              <div className="animate-in fade-in duration-300">
                <OperationsHub
                  students={students}
                  initialTab="communication"
                  hideNavigation={true}
                />
              </div>
            )}
            {activeTab === 'prescriptions' && canAccess('prescricoes') && (
              <div className="animate-in fade-in duration-300">
                {/* Passamos a lista de alunos que JÁ EXISTE no Dashboard */}
                <PrescriptionModule students={students} />
              </div>
            )}
            {activeTab === 'feedbacks_recebidos' && canAccess('feedbacks_recebidos') && (
              <div className="animate-in fade-in duration-300">
                <PainelFeedbacks />
              </div>
            )}
            {/* --- NOVA TELA DE TREINOS --- */}
            {activeTab === 'workouts' && canAccess('treinos_realizados') && (
              <div className="animate-in fade-in duration-300">
                <PainelTreinosRealizados />
              </div>
            )}
            {activeTab === 'fichas' && canAccess('fichas_treino') && (
              <div className="animate-in fade-in duration-300">
                <Fichas initialFichaId={fichaIdInicial} />
              </div>
            )}
           {activeTab === 'dietas' && canAccess('dietas') && (
              <div className="animate-in fade-in duration-300">
                <DietasListagem initialDietaId={dietaIdInicial} />
              </div>
            )}
            {activeTab === 'legendas' && canAccess('banco_textos') && (
              <div className="animate-in fade-in duration-300">
                <Legendas />
              </div>
            )}
            {activeTab === 'exams' && canAccess('exames') && (
              <div className="animate-in fade-in duration-300">
                <ExamsModule students={students} />
              </div>
            )}
            {activeTab === 'team' && canAccess('equipe') && (
              <div className="animate-in fade-in duration-300">
                <TeamModule />
              </div>
            )}
            {activeTab === 'members_admin' && (
              <div className="animate-in fade-in duration-300">
                <MembersAdmin />
              </div>
            )}
            {/* ... bloco dos alunos ... */}
            {activeTab === 'students' && (
              <div className="animate-in fade-in duration-300">
                <StudentsTab                  
                  plans={plans}
                  onReloadData={onReloadData}
                  onToggleDelivery={onToggleDelivery}
                  onOpenStudent={openApproveModal}
                  onOpenHistory={(student) => contractRef.current?.handleOpenHistory(student)}
                  onOpenFinancial={(student) => {
                    setTargetStudentForFin(student);
                    setShowQuickFinModal(true);
                  }}
                  onSmartPDF={(student) => contractRef.current?.handleSmartPDF(student)}
                  onDeleteStudent={handleDeleteFullStudent}
                  copyStudentLink={copyStudentLink}
                  studentsById={studentsById}
                  onNewStudent={() => {
                    setEditingStudentId(null);
                    setNewStudentName("");
                    setNewStudentPhone("");
                    setNewStudentWhatsapp("");
                    setIsSameNumber(true);
                    setExtraData({ cpf: '', rg: '', email: '', address: '', birthDate: '', profession: '' });
                    setIsInviting(true);
                  }}
                />
              </div>
            )}

            {activeTab === 'templates' && canAccess('contratos') && (
              <div className="animate-in fade-in duration-300">
                {!isEditingTemplate ? (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-white">Meus Modelos de Contrato</h2>

                      <button
                        onClick={() => {
                          setCurrentTemplate({ id: '', name: '', content: '', fields: [] });
                          setIsEditingTemplate(true);
                        }}
                        className="bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 transition-colors"
                      >
                        <Plus className="w-5 h-5" /> Novo Modelo
                      </button>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      {templates.map(t => (
                        <div
                          key={t.id}
                          className="bg-ebony-surface p-6 rounded-xl border border-ebony-border shadow-sm hover:bg-ebony-border/20 transition-all"
                        >
                          <h3 className="font-bold text-lg mb-2 text-white">{t.name}</h3>
                          <p className="text-xs text-ebony-muted mb-4">ID: {t.id}</p>
                          <p className="text-sm text-ebony-muted mb-4">
                            {t.fields?.length || 0} variáveis configuradas.
                          </p>

                          {/* --- BOTÕES DE AÇÃO: EDITAR | DUPLICAR | EXCLUIR --- */}
                          <div className="flex gap-2 mt-auto pt-4">
                            {/* 1. EDITAR */}
                            <button
                              onClick={() => {
                                setCurrentTemplate(t);
                                setIsEditingTemplate(true);
                              }}
                              className="flex-1 py-2 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg text-sm font-bold transition-colors"
                            >
                              Editar
                            </button>

                            {/* 2. DUPLICAR */}
                            <button
                              onClick={() => openDuplicateModal(t)}
                              className="px-3 py-2 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg transition-colors"
                              title="Duplicar Modelo"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            {/* 3. EXCLUIR */}
                            <button
                              onClick={() => handleDeleteTemplate(t.id)}
                              className="px-3 py-2 bg-transparent border border-ebony-border text-red-400 hover:text-red-300 hover:bg-ebony-deep rounded-lg transition-colors"
                              title="Excluir Modelo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-ebony-surface rounded-xl shadow-xl border border-ebony-border flex flex-col h-[85vh] overflow-hidden">
                    <div className="p-4 border-b border-ebony-border flex justify-between items-center bg-ebony-deep">
                      <div className="flex items-center gap-4 flex-1">
                        <button onClick={() => setIsEditingTemplate(false)}>
                          <ArrowLeft className="w-5 h-5 text-ebony-muted" />
                        </button>
                        <input
                          type="text"
                          placeholder="Nome do Modelo"
                          value={currentTemplate.name}
                          onChange={e => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                          className="bg-transparent font-bold text-lg outline-none w-full text-white placeholder-gray-600"
                        />
                      </div>

                      <button
                        onClick={handleSaveTemplate}
                        className="bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg px-6 py-2 flex items-center gap-2 transition-colors"
                      >
                        <Save className="w-4 h-4" /> Salvar Modelo
                      </button>
                    </div>

                    <div className="flex-1 overflow-hidden h-full flex flex-col md:flex-row">
                      <div className="w-full md:w-2/3 p-6 overflow-y-auto border-r border-ebony-border">
                        <label className="block text-xs font-bold text-ebony-muted uppercase mb-2">
                          Texto do Contrato
                        </label>
                        <RichTextEditor
                          isA4={true}
                          value={currentTemplate.content}
                          onChange={(html) => setCurrentTemplate({ ...currentTemplate, content: html })}
                        />
                      </div>

                      <div className="w-full md:w-1/3 p-6 bg-ebony-bg overflow-y-auto">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                          <Settings className="w-4 h-4" /> Variáveis
                        </h3>

                        {/* --- BLOCO NOVO: A COLA DE VARIÁVEIS AUTOMÁTICAS --- */}
                        <div className="bg-ebony-surface p-4 rounded-xl border border-ebony-border mb-6 shadow-sm">
                          <h4 className="text-xs font-bold text-ebony-primary uppercase mb-2 flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" /> Automáticas (Já inclusas)
                          </h4>
                          <p className="text-[10px] text-ebony-muted mb-3 leading-tight">
                            O sistema preenche estes dados sozinho com base no cadastro do aluno. Use exatamente assim:
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            {['{{nome}}', '{{cpf}}', '{{rg}}', '{{endereco}}', '{{email}}', '{{telefone}}', '{{profissao}}', '{{nascimento}}'].map(tag => (
                              <div
                                key={tag}
                                className="bg-ebony-deep border border-ebony-border rounded px-2 py-1 text-[10px] font-mono text-white font-bold text-center cursor-pointer hover:bg-ebony-border/30 transition-colors"
                                onClick={() => { navigator.clipboard.writeText(tag); alert(`Copiado: ${tag}`) }}
                                title="Clique para copiar"
                              >
                                {tag}
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* --------------------------------------------------- */}

                        {/* Card: NOVA VARIÁVEL (Corrigido) */}
                        <div className="bg-ebony-surface p-4 rounded-xl border border-ebony-border mb-6 shadow-sm">
                          <h4 className="text-xs font-bold text-ebony-muted uppercase mb-3">Dados do Plano</h4>
                          <div className="space-y-3">

                            {/* Chave */}
                            <div>
                              <label className="text-[10px] font-bold text-ebony-muted uppercase">Chave</label>
                              <div className="flex items-center gap-1">
                                <span className="text-ebony-muted font-mono text-sm">{`{{`}</span>
                                <input
                                  type="text"
                                  value={newField.key}
                                  onChange={e => setNewField({ ...newField, key: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                                  className="flex-1 p-1 border-b border-ebony-border outline-none font-mono text-sm bg-transparent text-white"
                                />
                                <span className="text-ebony-muted font-mono text-sm">{`}}`}</span>
                              </div>
                            </div>

                            {/* Nome Label */}
                            <div>
                              <label className="text-[10px] font-bold text-ebony-muted uppercase">Nome (Label)</label>
                              <input
                                type="text"
                                value={newField.label}
                                onChange={e => setNewField({ ...newField, label: e.target.value })}
                                className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                              />
                            </div>

                            {/* Tipo */}
                            <div className="grid grid-cols-1 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-ebony-muted uppercase">Tipo</label>
                                <select
                                  value={newField.type}
                                  onChange={e => setNewField({ ...newField, type: e.target.value })}
                                  className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                                >
                                  <option value="text">Texto</option>
                                  <option value="number">Número</option>
                                  <option value="money">Dinheiro</option>
                                  <option value="date">Data</option>
                                </select>
                              </div>
                            </div>

                            <button
                              onClick={addFieldToTemplate}
                              className="w-full py-2 bg-ebony-primary hover:bg-red-900 text-white rounded-lg text-sm font-bold shadow-lg transition-colors mt-2"
                            >
                              Adicionar
                            </button>
                          </div>
                        </div>

                        {/* Lista de Variáveis Existentes (Restaurada) */}
                        <div className="space-y-2">
                          {currentTemplate.fields && currentTemplate.fields.map((field, idx) => (
                            <div
                              key={idx}
                              className="bg-ebony-surface p-3 rounded-lg border border-ebony-border flex justify-between items-center"
                            >
                              <div>
                                <div className="font-mono text-xs font-bold text-ebony-primary bg-ebony-deep inline-block px-1 rounded mb-1 border border-ebony-border">
                                  {`{{${field.key}}}`}
                                </div>
                                <div className="text-xs text-ebony-muted">{field.label}</div>
                              </div>
                              <button
                                onClick={() => removeFieldFromTemplate(idx)}
                                className="text-ebony-muted hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>

                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {duplicatingTemplate && (
              <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-ebony-surface rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200 border border-ebony-border">
                  <h3 className="text-xl font-bold text-white mb-4">Duplicar Modelo</h3>

                  <div className="space-y-4">
                    <div>
                      <input
                        autoFocus
                        type="text"
                        value={duplicateTemplateName}
                        onChange={(e) => setDuplicateTemplateName(e.target.value)}
                        className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none transition-all"
                        placeholder="Nome da Cópia"
                      />
                      {/* PREVIEW DO ID EM TEMPO REAL */}
                      <p className="mt-2 text-xs font-mono text-ebony-muted">
                        ID será:{' '}
                        <span className="bg-ebony-deep px-1 rounded text-white border border-ebony-border">
                          {generateSlug(duplicateTemplateName) || "..."}
                        </span>
                      </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => setDuplicatingTemplate(null)}
                        className="px-4 py-2 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg font-bold transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmDuplicate}
                        className="px-6 py-2 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-colors"
                      >
                        <Copy className="w-4 h-4" /> Duplicar
                      </button>
                    </div>
                  </div>
                </div>
              </div>            
          )}
            </Suspense>
          </div>
        </div>
      </main>

      <ContractManager
        ref={contractRef}
        onReloadData={onReloadData}
      />

      <StudentFormModal
        isInviting={isInviting}
        setIsInviting={setIsInviting}
        editingStudentId={editingStudentId}
        setEditingStudentId={setEditingStudentId}
        students={students}
        plans={plans}
        templates={templates}
        plansById={plansById}
        onReloadData={onReloadData}
        onOpenFinancial={(student) => {
          setTargetStudentForFin(student);
          setShowQuickFinModal(true);
        }}
        isSameNumber={isSameNumber}
        setIsSameNumber={setIsSameNumber}
        newStudentName={newStudentName}
        setNewStudentName={setNewStudentName}
        newStudentPhone={newStudentPhone}
        setNewStudentPhone={setNewStudentPhone}
        newStudentWhatsapp={newStudentWhatsapp}
        setNewStudentWhatsapp={setNewStudentWhatsapp}
        extraData={extraData}
        setExtraData={setExtraData}
      />
      {/* MODAL FINANCEIRO RÁPIDO (Global - Fora do Main para sobrepor tudo) */}
      {showQuickFinModal && targetStudentForFin && (
        <QuickFinancialModal
          student={targetStudentForFin}
          plans={plans}
          students={students} // <-- TROCA "students" pelo nome da tua lista real de alunos
          onClose={() => {
            setShowQuickFinModal(false);
            setTargetStudentForFin(null);
          }}
          onSuccess={handleFinancialSuccess}
        />
      )}
    </div> // Fecha container principal (flex h-screen)
  );
};

export default Dashboard;