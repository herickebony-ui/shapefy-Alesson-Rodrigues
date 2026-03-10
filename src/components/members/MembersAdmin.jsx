import React, { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  query,
  orderBy,
  where,
  setDoc,
  getDocs
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

import { db, storage } from "../../firebase";
import useRealtime from "../../hooks/useRealtime";

import {
  Plus, Trash2, Save, Upload, BookOpen, Layers, Lock, ChevronUp, ChevronDown, Pencil, MoveVertical,
  Play, Download, Copy
} from "lucide-react";
import StudentHub from "./StudentHub";
import MembersArea from "./MembersArea";
import VideoPlayerGlobal from "../VideoPlayerGlobal";
import RichTextEditor from "../RichTextEditor";

// --- COMPONENTES: MODAIS NATIVOS (Titanium Style) ---
const ConfirmModal = ({ isOpen, title, msg, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#29292e] border border-[#323238] p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
        <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-6">{msg}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="text-gray-300 font-bold text-sm px-4 py-2 hover:bg-[#323238] rounded-lg transition">Cancelar</button>
          <button onClick={onConfirm} className="bg-[#850000] text-white font-bold text-sm px-4 py-2 rounded-lg hover:bg-red-900 transition">Confirmar</button>
        </div>
      </div>
    </div>
  )
};

const DrawerModal = ({ isOpen, title, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex justify-end">
      <button
        onClick={onClose}
        className="absolute inset-0 w-full h-full cursor-default"
        aria-label="Fechar"
      />

      <div className="relative w-full max-w-xl h-full bg-[#29292e] border-l border-[#323238] shadow-2xl overflow-y-auto">
        <div className="p-4 border-b border-[#323238] flex items-center justify-between">
          <div className="font-black text-gray-100">{title}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            Fechar
          </button>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

const PromptModal = ({ isOpen, title, value, onChange, onConfirm, onCancel }) => {

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#29292e] border border-[#323238] p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
        <h3 className="text-white font-bold text-lg mb-4">{title}</h3>
        <input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onConfirm()}
          className="w-full bg-[#121214] border border-[#323238] p-3 rounded-lg text-white mb-6 focus:border-[#850000] outline-none transition"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="text-gray-300 font-bold text-sm px-4 py-2 hover:bg-[#323238] rounded-lg transition">Cancelar</button>
          <button onClick={onConfirm} className="bg-[#850000] text-white font-bold text-sm px-4 py-2 rounded-lg hover:bg-red-900 transition">Salvar</button>
        </div>
      </div>
    </div>
  )
};
const TitaniumCard = ({ title, icon: Icon, children }) => (
  <div className="bg-[#29292e] border border-[#323238] rounded-xl p-4">
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon className="w-4 h-4 text-gray-400" />}
      <h3 className="text-gray-100 font-black text-sm">{title}</h3>
    </div>
    {children}
  </div>
);

export default function MembersAdmin() {
  // ✅ IMPORTANTE: aqui eu estou assumindo que existe coleção "plans".
  // Se teus planos estiverem em outra coleção, tu vai ajustar depois.
  // 🔥 Refs/queries MEMOIZADOS (evita “piscar carregando”)
  const plansRef = useMemo(() => collection(db, "plans"), []);
  const accessLevelsRef = useMemo(() => collection(db, "access_levels"), []);
  const modulesRef = useMemo(() => collection(db, "modules"), []);
  const sectionsRef = useMemo(() => collection(db, "sections"), []);
  const lessonsRef = useMemo(() => collection(db, "lessons"), []);

  const accessLevelsQ = useMemo(
    () => query(accessLevelsRef, orderBy("createdAt", "desc")),
    [accessLevelsRef]
  );

  const modulesQ = useMemo(
    () => query(modulesRef, orderBy("order", "asc")),
    [modulesRef]
  );

  const { data: plans, loading: loadingPlans } = useRealtime(plansRef);
  const { data: accessLevels, loading: loadingAccess } = useRealtime(accessLevelsQ);
  const { data: modules, loading: loadingModules } = useRealtime(modulesQ);

  const [showStudentPreview, setShowStudentPreview] = useState(false);
  const [previewAccessLevelId, setPreviewAccessLevelId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const selectedModule = useMemo(
    () => (modules || []).find((m) => m.id === selectedModuleId) || null,
    [modules, selectedModuleId]
  );

  // 1. Busca Seções do Módulo
  const sectionsQuery = useMemo(() => {
    if (!selectedModuleId) return null;
    return query(sectionsRef, where("moduleId", "==", selectedModuleId), orderBy("order", "asc"));
  }, [selectedModuleId, sectionsRef]);

  const { data: sections, loading: loadingSections } = useRealtime(sectionsQuery);

  // 2. Busca Aulas (Se tiver seção selecionada, busca dela. Senão, não busca nada por enquanto)
  const lessonsQuery = useMemo(() => {
    if (!selectedSectionId) return null;
    return query(lessonsRef, where("sectionId", "==", selectedSectionId));
  }, [selectedSectionId, lessonsRef]);

  const { data: lessons, loading: loadingLessons } = useRealtime(lessonsQuery);
  // --- CONFIGURAÇÕES GLOBAIS (Capa e Posição) ---
  const settingsRef = useMemo(() => doc(db, "settings", "members_area_config"), []);
  const { data: settings } = useRealtime(settingsRef);

  const [coverPosition, setCoverPosition] = useState(50);

  // Atualiza o slider localmente quando os dados chegam do banco
  React.useEffect(() => {
    if (settings?.coverPosition !== undefined) {
      setCoverPosition(settings.coverPosition);
    }
  }, [settings]);

  async function saveCoverPosition(newPos) {
    setCoverPosition(newPos); // update visual instantâneo
    // Debounce simples ou save direto (aqui direto para garantir)
    await setDoc(doc(db, "settings", "members_area_config"), { coverPosition: newPos }, { merge: true });
  }

  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const selectedLesson = useMemo(
    () => (lessons || []).find((l) => l.id === selectedLessonId) || null,
    [lessons, selectedLessonId]
  );

  // ✅ Auto-seleciona a primeira aula quando carrega (pra abrir o editor)
  React.useEffect(() => {
    if (!selectedModuleId) return;
    if (selectedLessonId) return;

    if ((lessons || []).length > 0) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [selectedModuleId, lessons, selectedLessonId]);


  const [newAccessName, setNewAccessName] = useState("");
  const [newAccessPlanIds, setNewAccessPlanIds] = useState([]);
  const [showPlansPicker, setShowPlansPicker] = useState(false);

  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleOrder, setNewModuleOrder] = useState(1);
  const [newModuleAccessLevels, setNewModuleAccessLevels] = useState([]);
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const [lessonDraft, setLessonDraft] = useState({
    title: "",
    videoUrl: "",
    thumbnailUrl: "",
    coverPosition: 50,
    order: 1,
    sectionTitle: "Geral",
    sectionOrder: 1,
    contentType: "video", // video | pdf | link | text
    externalUrl: "",
    isPublished: true,
    descriptionHtml: "",
    attachments: [],
  });


  React.useEffect(() => {
    if (!selectedLesson) {
      setLessonDraft({
        title: "",
        videoUrl: "",
        thumbnailUrl: "",
        coverPosition: 50,
        order: 1,
        sectionTitle: "Geral",
        sectionOrder: 1,
        contentType: "video",
        externalUrl: "",
        isPublished: true,
        descriptionHtml: "",
        attachments: [],
      });
      return;
    }

    setLessonDraft({
      title: selectedLesson.title || "",
      videoUrl: selectedLesson.videoUrl || "",
      thumbnailUrl: selectedLesson.thumbnailUrl || "",
      coverPosition: selectedLesson.coverPosition ?? 50,
      order: selectedLesson.order || 1,
      sectionTitle: selectedLesson.sectionTitle || "Geral",
      sectionOrder: selectedLesson.sectionOrder || 1,
      contentType: selectedLesson.contentType || "video",
      externalUrl: selectedLesson.externalUrl || "",
      isPublished: selectedLesson.isPublished !== false,
      descriptionHtml: selectedLesson.descriptionHtml || "",
      attachments: selectedLesson.attachments || [],
    });
  }, [selectedLesson]);


  // -- NOVOS ESTADOS PARA MODAIS --
  const [dialog, setDialog] = useState({ type: null, id: null, title: '' });
  // EDITAR MÓDULO (nome + níveis permitidos)
  const [isModuleEditorOpen, setIsModuleEditorOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [moduleDraft, setModuleDraft] = useState({ title: "", allowedAccessLevels: [] });

  async function saveModule() {
    if (!editingModuleId) return;
    const nextTitle = (moduleDraft.title || "").trim();
    if (!nextTitle) return alert("Título do módulo é obrigatório.");

    await updateDoc(doc(db, "modules", editingModuleId), {
      title: nextTitle,
      allowedAccessLevels: moduleDraft.allowedAccessLevels || [],
      updatedAt: serverTimestamp(),
    });

    setIsModuleEditorOpen(false);
    setEditingModuleId(null);
  }
  const [isLessonEditorOpen, setIsLessonEditorOpen] = useState(false);
  const [promptInput, setPromptInput] = useState("");

  // Função Central de Confirmação
  const executeDialogAction = async () => {
    // 1) Criar Aula
    if (dialog.type === "create_lesson") {
      if (!promptInput.trim()) return;

      const ref = await addDoc(collection(db, "lessons"), {
        moduleId: selectedModuleId,
        sectionId: selectedSectionId, // <--- VINCULA À SEÇÃO ATUAL
        title: promptInput.trim(),
        videoUrl: "",
        thumbnailUrl: "",
        externalUrl: "",
        order: Math.max(0, ...(lessons || []).map(l => Number(l.order) || 0)) + 1,
        isPublished: true,
        descriptionHtml: "",
        attachments: [],
        coverPosition: 50,
        createdAt: serverTimestamp(),
      });

      setSelectedLessonId(ref.id);
      setIsLessonEditorOpen(true);
    }

    // 3) Exclusões
    if (dialog.type === "del_level") await deleteDoc(doc(db, "access_levels", dialog.id));
    if (dialog.type === "del_module") {
      await deleteDoc(doc(db, "modules", dialog.id));
      if (selectedModuleId === dialog.id) { setSelectedModuleId(null); setSelectedLessonId(null); }
    }
    if (dialog.type === "del_lesson") {
      await deleteDoc(doc(db, "lessons", dialog.id));
      if (selectedLessonId === dialog.id) setSelectedLessonId(null);
    }

    setDialog({ type: null, id: null, title: "" });
    setPromptInput("");
  };

  const toggleMulti = (arr, value) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  async function createAccessLevel() {
    if (!newAccessName.trim()) return alert("Nome do nível é obrigatório.");
    if (!newAccessPlanIds.length) return alert("Selecione ao menos 1 plano.");

    await addDoc(accessLevelsRef, {
      name: newAccessName.trim(),
      planIds: newAccessPlanIds,
      createdAt: serverTimestamp(),
    });

    setNewAccessName("");
    setNewAccessPlanIds([]);
  }
  async function createModule() {
    if (!newModuleTitle.trim()) return alert("Título do módulo é obrigatório.");
    if (!newModuleAccessLevels.length) return alert("Selecione ao menos 1 nível permitido.");

    await addDoc(modulesRef, {
      title: newModuleTitle.trim(),
      order: Math.max(0, ...(modules || []).map(m => Number(m.order) || 0)) + 1,
      allowedAccessLevels: newModuleAccessLevels,
      createdAt: serverTimestamp(),
    });

    setNewModuleTitle("");
    setNewModuleAccessLevels([]);
  }

  // --- FUNÇÕES DE SEÇÃO (NOVO) ---
  async function createSection() {
    if (!newSectionTitle.trim()) return alert("Título da seção é obrigatório.");
    if (!selectedModuleId) return alert("Selecione um módulo primeiro.");

    await addDoc(sectionsRef, {
      moduleId: selectedModuleId,
      title: newSectionTitle.trim(),
      coverUrl: "",
      order: Math.max(0, ...(sections || []).map(s => Number(s.order) || 0)) + 1,
      createdAt: serverTimestamp(),
    });
    setNewSectionTitle("");
  }

  async function deleteSection(id) {
    if (!window.confirm("Tem certeza? As aulas desta seção perderão a referência.")) return;
    await deleteDoc(doc(db, "sections", id));
    if (selectedSectionId === id) setSelectedSectionId(null);
  }
  // --- NOVO: ESTADOS PARA EDIÇÃO DE SEÇÃO ---
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");

  // --- NOVO: FUNÇÕES PARA EDITAR SEÇÃO ---
  function openEditSection(section) {
    setEditingSectionId(section.id);
    setEditingSectionTitle(section.title);
  }

  async function saveSectionTitle() {
    if (!editingSectionId || !editingSectionTitle.trim()) return;

    try {
      await updateDoc(doc(db, "sections", editingSectionId), {
        title: editingSectionTitle.trim()
      });
      setEditingSectionId(null);
      setEditingSectionTitle("");
    } catch (err) {
      console.error("Erro ao renomear seção:", err);
      alert("Erro ao renomear seção.");
    }
  }
  async function uploadSectionCover(file, sectionId) {
    if (!file || !sectionId) return;
    try {
      const path = `sections/${sectionId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);
      const url = await new Promise((resolve, reject) => {
        task.on("state_changed", null, reject, async () => resolve(await getDownloadURL(task.snapshot.ref)));
      });
      await updateDoc(doc(db, "sections", sectionId), { coverUrl: url });
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar capa da seção.");
    }
  }

  async function moveModule(moduleId, direction) {
    // Força ordenação numérica para evitar bugs
    const list = [...(modules || [])].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    const idx = list.findIndex(m => m.id === moduleId);
    if (idx < 0) return;

    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) return;

    const a = list[idx];
    const b = list[swapWith];

    const aOrder = Number(a.order) || 0;
    const bOrder = Number(b.order) || 0;

    // Se ordens forem iguais, reajusta
    let newOrderA = bOrder;
    let newOrderB = aOrder;

    if (aOrder === bOrder) {
      newOrderA = bOrder + (direction === "up" ? -1 : 1);
      newOrderB = aOrder;
    }

    await Promise.all([
      updateDoc(doc(db, "modules", a.id), { order: newOrderA }),
      updateDoc(doc(db, "modules", b.id), { order: newOrderB }),
    ]);
  }

  async function duplicateModule(m) {
    if (!m?.id) return;
  
    if (!window.confirm(`Duplicar o módulo "${m.title}" com seções e aulas?`)) return;
  
    try {
      // 1) cria novo módulo
      const newOrder =
        Math.max(0, ...(modules || []).map(mm => Number(mm.order) || 0)) + 1;
  
      const newModuleRef = await addDoc(collection(db, "modules"), {
        title: `${m.title} (cópia)`,
        order: newOrder,
        allowedAccessLevels: Array.isArray(m.allowedAccessLevels) ? m.allowedAccessLevels : [],
        createdAt: serverTimestamp(),
      });
  
      const newModuleId = newModuleRef.id;
  
      // 2) busca seções do módulo original (SEM orderBy pra não exigir índice)
      const oldSectionsSnap = await getDocs(
        query(collection(db, "sections"), where("moduleId", "==", m.id))
      );
  
      const oldSections = oldSectionsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  
      // 3) duplica seções + aulas
      for (const oldSec of oldSections) {
        // cria nova seção copiando tudo que existir (exceto ids)
        const { id: _oldSecId, moduleId: _oldModuleId, createdAt: _c1, updatedAt: _u1, ...secData } = oldSec;
  
        const newSecRef = await addDoc(collection(db, "sections"), {
          ...secData,
          moduleId: newModuleId,
          createdAt: serverTimestamp(),
        });
  
        // busca aulas da seção antiga (SEM orderBy pra não exigir índice)
        const oldLessonsSnap = await getDocs(
          query(collection(db, "lessons"), where("sectionId", "==", oldSec.id))
        );
  
        const oldLessons = oldLessonsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  
        for (const oldL of oldLessons) {
          const {
            id: _oldLessonId,
            sectionId: _oldSectionId,
            moduleId: _oldLessonModuleId,
            createdAt: _c2,
            updatedAt: _u2,
            ...lessonData
          } = oldL;
  
          await addDoc(collection(db, "lessons"), {
            ...lessonData,
            moduleId: newModuleId,      // ✅ IMPORTANTE
            sectionId: newSecRef.id,    // ✅ aponta para a nova seção
            createdAt: serverTimestamp()
          });
        }
      }
  
      alert("Módulo duplicado com sucesso!");
  
      // opcional: já abrir o novo módulo na UI
      setSelectedModuleId(newModuleId);
      setSelectedSectionId(null);
      setSelectedLessonId(null);
  
    } catch (err) {
      console.error("duplicateModule error:", err);
      alert("Erro ao duplicar módulo. Abre o console (F12) e me manda a mensagem do erro.");
    }
  }
   

  async function moveLesson(lessonId, direction) {
    const list = [...(lessons || [])].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    const idx = list.findIndex((l) => l.id === lessonId);
    if (idx < 0) return;
  
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) return;
  
    const a = list[idx];
    const b = list[swapWith];
  
    const aOrder = Number(a.order) || 0;
    const bOrder = Number(b.order) || 0;
  
    let newOrderA = bOrder;
    let newOrderB = aOrder;
  
    if (aOrder === bOrder) {
      newOrderA = bOrder + (direction === "up" ? -1 : 1);
      newOrderB = aOrder;
    }
  
    await Promise.all([
      updateDoc(doc(db, "lessons", a.id), { order: newOrderA }),
      updateDoc(doc(db, "lessons", b.id), { order: newOrderB }),
    ]);
  }
  


  function deleteModule(id) {
    setDialog({ type: 'del_module', id, title: 'Excluir módulo e suas aulas?' });
  }

  function editModule(m) {
    setEditingModuleId(m?.id || null);
    setModuleDraft({
      title: m?.title || "",
      allowedAccessLevels: Array.isArray(m?.allowedAccessLevels) ? m.allowedAccessLevels : [],
    });
    setIsModuleEditorOpen(true);
  }


  function deleteAccessLevel(id) {
    setDialog({ type: 'del_level', id, title: 'Excluir nível de acesso?' });
  }

  function createLesson() {
    if (!selectedModuleId) return alert("Selecione um módulo primeiro.");
    setPromptInput("");
    setDialog({ type: 'create_lesson', title: 'Título da Nova Aula' });
  }

  function deleteLesson(id) {
    setDialog({ type: 'del_lesson', id, title: 'Excluir esta aula?' });
  }

  async function saveLesson() {
    if (!selectedLessonId) return;
    // Forçamos contentType fixo ou misto, pois agora a aula pode ter tudo
    await updateDoc(doc(db, "lessons", selectedLessonId), {
      coverPosition: Number(lessonDraft.coverPosition ?? 50),
      title: lessonDraft.title,
      videoUrl: lessonDraft.videoUrl || "",
      thumbnailUrl: lessonDraft.thumbnailUrl || "",
      externalUrl: lessonDraft.externalUrl || "",
      // Removido contentType específico, agora a renderização decide o que mostrar
      sectionTitle: (lessonDraft.sectionTitle || "Geral").trim() || "Geral",
      sectionOrder: Number(lessonDraft.sectionOrder) || 1, // Forçando número
      isPublished: lessonDraft.isPublished !== false,
      descriptionHtml: lessonDraft.descriptionHtml || "",
      attachments: lessonDraft.attachments || [],
      order: Number(lessonDraft.order) || 1, // Forçando número
      updatedAt: serverTimestamp(),
    });
    alert("Conteúdo salvo com sucesso!");
    setIsLessonEditorOpen(false);
  }

  async function uploadGlobalCover(file) {
    if (!file) return;
    try {
      const path = `settings/cover_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);
      const url = await new Promise((resolve, reject) => {
        task.on("state_changed", null, reject, async () => resolve(await getDownloadURL(task.snapshot.ref)));
      });
      // Salva em um documento de configurações globais (cria se não existir)
      await setDoc(doc(db, "settings", "members_area_config"), { coverUrl: url }, { merge: true });
      alert("Capa da área de membros atualizada!");
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar capa.");
    }
  }
  // --------------------------------

  async function uploadThumbnail(file) {
    if (!selectedLessonId) return alert("Selecione um conteúdo primeiro.");
    if (!file) return;

    try {
      const path = `members/thumbnails/${selectedLessonId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);

      const url = await new Promise((resolve, reject) => {
        task.on("state_changed", null, reject, async () =>
          resolve(await getDownloadURL(task.snapshot.ref))
        );
      });

      setLessonDraft((prev) => ({ ...prev, thumbnailUrl: url }));
    } catch (err) {
      console.error("uploadThumbnail error:", err);
      alert("Erro no upload da thumbnail. Veja o console.");
    }
  }


  async function uploadAttachment(file) {
    if (!selectedLessonId) return alert("Selecione uma aula primeiro.");
    if (!file) return;

    const path = `members/lessons/${selectedLessonId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    const url = await new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        null,
        (err) => reject(err),
        async () => resolve(await getDownloadURL(task.snapshot.ref))
      );
    });

    const next = [
      ...(lessonDraft.attachments || []),
      { name: file.name, url, createdAt: Date.now() },
    ];
    setLessonDraft((prev) => ({ ...prev, attachments: next }));
  }

  const loadingAll = loadingPlans || loadingAccess || loadingModules || loadingLessons;

  return (
    <div className="min-h-screen bg-[#202024] text-gray-100 p-4 md:p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-black flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-400" />
            Members Admin
          </h1>
          {loadingAll && <span className="text-xs text-gray-400">Sincronizando...</span>}
        </div>

        {/* === ATALHOS DO ADMIN (SIMPLIFICADO) === */}
        {/* === NOVO TOPO: PERSONALIZAÇÃO DA CAPA === */}
        <div className="bg-[#29292e] border border-[#323238] rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 md:items-start">

            {/* Preview da Capa */}
            <div className="w-full md:w-2/3">
            <div className="text-[11px] text-gray-400 font-black mb-2">Prévia (recorte do mobile)</div>

            <div className="relative w-full max-w-[420px] h-44 bg-[#121214] rounded-2xl overflow-hidden border border-[#323238] shadow-lg">
              {settings?.coverUrl ? (
                <>
                  <img
                    src={settings.coverUrl}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ objectPosition: `center ${coverPosition}%` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-gray-500">Sem capa</div>
              )}
            </div>
          </div>


            {/* Controles */}
            <div className="w-full md:w-1/3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-gray-100 text-sm">Capa da Área de Membros</h3>
                <span className="text-[10px] text-gray-500 font-medium">Recomendado: 1920x600px (Banner)</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsAccessModalOpen(true)} className="px-3 py-1.5 bg-[#121214] border border-[#323238] rounded-lg text-xs font-bold text-gray-300 hover:text-white">Níveis</button>
                <button onClick={() => setShowStudentPreview(true)} className="px-3 py-1.5 bg-[#121214] border border-[#323238] rounded-lg text-xs font-bold text-gray-300 hover:text-white">Preview Aluno</button>
              </div>
            </div>

              <div className="flex gap-3 items-center">
                <label className="cursor-pointer bg-[#850000] hover:brightness-110 text-white px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition">
                  <Upload className="w-4 h-4" /> Alterar Capa
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadGlobalCover(e.target.files?.[0])} />
                </label>

                {/* Slider de Posição (Código que você pediu) */}
                <div className="flex-1 flex items-center gap-2 bg-[#121214] p-2 rounded-lg border border-[#323238]">
                  <MoveVertical className="w-4 h-4 text-gray-500" />
                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={coverPosition}
                      onChange={(e) => saveCoverPosition(Number(e.target.value))}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#850000]"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 w-8 text-right">{coverPosition}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === LAYOUT PRINCIPAL (GRID DASHBOARD) === */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* COLUNA 1 — MÓDULOS (SIDEBAR FIXA) */}
          <div className="lg:col-span-4 space-y-4 sticky top-4 h-fit">
            <TitaniumCard title="Módulos" icon={Layers}>
              <div className="text-[11px] text-gray-400 font-black mb-2">PASSO 1 — Criar Módulo</div>

              <div className="space-y-3">
                <input
                  className="bg-[#121214] border border-[#323238] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#850000]/40 w-full"
                  placeholder="Título do módulo"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                />

                <button
                  onClick={createModule}
                  className="w-full bg-[#850000] hover:brightness-110 transition px-3 py-3 rounded-lg text-sm font-black flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Criar Módulo
                </button>

                <div className="bg-[#121214] border border-[#323238] rounded-lg p-3">
                  <div className="text-xs text-gray-400 font-black mb-2">
                    Níveis permitidos (obrigatório):
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(accessLevels || []).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setNewModuleAccessLevels((prev) => toggleMulti(prev, a.id))}
                        className={`text-xs px-2 py-1 rounded-full border transition ${newModuleAccessLevels.includes(a.id)
                          ? "bg-[#850000] border-[#850000] text-gray-100"
                          : "bg-[#29292e] border-[#323238] text-gray-400 hover:text-gray-100"
                          }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">
                    Selecionados: <b className="text-gray-300">{newModuleAccessLevels.length}</b>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#323238]">
                <div className="text-[11px] text-gray-400 font-black mb-2">PASSO 2 — Selecionar Módulo</div>

                {!modules?.length ? (
                  <div className="text-sm text-gray-400">
                    Nenhum módulo ainda.
                  </div>
                ) : (
                  <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {(modules || []).map((m) => {
                      const active = m.id === selectedModuleId;
                      // ATENÇÃO: Usando DIV aqui para evitar erro de <button> dentro de <button>
                      return (
                        <div
                          key={m.id}
                          className={`w-full flex items-center justify-between px-3 py-3 rounded-lg border transition mb-2 cursor-pointer ${active
                            ? "bg-[#850000]/20 border-[#850000]/40 text-gray-100"
                            : "bg-[#121214] border-[#323238] text-gray-400 hover:text-gray-100"
                            }`}
                          onClick={() => { setSelectedModuleId(m.id); setSelectedLessonId(null); }}
                        >
                          <div className="font-black text-sm truncate select-none">{m.title}</div>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => moveModule(m.id, "up")} className="p-2 rounded hover:bg-[#323238] text-gray-400 hover:text-white" title="Subir"><ChevronUp className="w-4 h-4" /></button>
                            <button type="button" onClick={() => moveModule(m.id, "down")} className="p-2 rounded hover:bg-[#323238] text-gray-400 hover:text-white" title="Descer"><ChevronDown className="w-4 h-4" /></button>
                            <button type="button" onClick={() => editModule(m)} className="p-2 rounded hover:bg-[#323238] text-gray-400 hover:text-white" title="Editar"><Pencil className="w-4 h-4" /></button>
                            <button
                              type="button"
                              onClick={() => duplicateModule(m)}
                              className="p-2 rounded hover:bg-[#323238] text-gray-400 hover:text-white"
                              title="Duplicar"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => deleteModule(m.id)} className="p-2 rounded hover:bg-[#323238] text-gray-400 hover:text-red-400" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TitaniumCard>
          </div>

          {/* COLUNA 2 — CONTEÚDOS (PRINCIPAL) */}
          <div className="lg:col-span-8">
            <TitaniumCard title={selectedSectionId ? "Gerenciar Aulas" : "Gerenciar Seções (Pastas)"} icon={BookOpen}>
              {!selectedModuleId ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-sm border-2 border-dashed border-[#323238] rounded-xl">
                  <Layers className="w-10 h-10 mb-3 opacity-20" />
                  Selecione um módulo na esquerda para começar.
                </div>
              ) : !selectedSectionId ? (
                // === VISTA DAS SEÇÕES (CARDS) ===
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex items-center gap-4 border-b border-[#323238] pb-4">
                    <div className="flex-1">
                      <div className="text-xs text-[#850000] font-bold uppercase tracking-wider mb-1">MÓDULO SELECIONADO</div>
                      <div className="text-2xl font-black text-white">{selectedModule?.title}</div>
                    </div>
                  </div>

                  {/* Criar Nova Seção */}
                  <div className="flex gap-2">
                    <input
                      value={newSectionTitle}
                      onChange={e => setNewSectionTitle(e.target.value)}
                      placeholder="Título da Nova Seção (ex: Comece por Aqui)"
                      className="flex-1 bg-[#121214] border border-[#323238] rounded-lg px-4 py-3 text-sm focus:border-[#850000] outline-none"
                    />
                    <button onClick={createSection} className="bg-[#29292e] hover:bg-[#323238] border border-[#323238] text-white px-6 font-bold rounded-lg text-sm transition">
                      + Criar Seção
                    </button>
                  </div>

                  {/* Grid de Seções (ESTILO KIWIFY/NETFLIX - CAPAS VERTICAIS) */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                    {(sections || []).map(section => (
                      <div key={section.id} className="group relative bg-[#121214] border border-[#323238] rounded-xl overflow-hidden hover:border-[#850000] transition-all shadow-lg aspect-[2/3]">

                        {/* 1. IMAGEM DE CAPA (Fundo) */}
                        <div className="absolute inset-0 bg-[#202024]">
                          {section.coverUrl ? (
                            <img src={section.coverUrl} alt="Capa" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition duration-500" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray p-4 text-center">
                              <Layers className="w-8 h-8 mb-2 opacity-30" />
                              <span className="text-[10px] font-bold uppercase">Sem Capa</span>
                              <span className="text-[9px] font-bold uppercase">600x900px</span>
                            </div>
                          )}
                        </div>

                        {/* 2. GRADIENTE PARA LEITURA */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

                        {/* 3. TÍTULO E INFO (Rodapé do Card) */}
                        <div className="absolute bottom-0 left-0 w-full p-3 z-20 pointer-events-none">
                          <div className="text-white font-black text-sm leading-tight uppercase line-clamp-2 mb-1 drop-shadow-md">
                            {section.title}
                          </div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> Clique para acessar
                          </div>
                        </div>

                        {/* 4. BOTÃO INVISÍVEL PARA ACESSAR (Cobre o card para entrar na pasta) */}
                        <button
                          onClick={() => setSelectedSectionId(section.id)}
                          className="absolute inset-0 w-full h-full z-10 cursor-pointer"
                          title="Clique para abrir e ver as aulas"
                        />

                        {/* 5. AÇÕES FLUTUANTES (Administrativo - Topo Direita) */}
                        <div className="absolute top-2 right-2 z-30 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          {/* Botão de Upload de Capa */}
                          <label className="cursor-pointer p-2 bg-black/70 hover:bg-[#850000] text-white rounded-lg backdrop-blur-sm transition border border-white/10" title="Alterar Capa">
                            <Upload className="w-4 h-4" />
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => uploadSectionCover(e.target.files?.[0], section.id)} />
                          </label>
                          {/* --- NOVO: Botão de Editar Título --- */}
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditSection(section); }}
                            className="p-2 bg-black/70 hover:bg-blue-600 text-white rounded-lg backdrop-blur-sm transition border border-white/10"
                            title="Renomear Seção"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {/* Botão de Excluir */}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
                            className="p-2 bg-black/70 hover:bg-red-600 text-white rounded-lg backdrop-blur-sm transition border border-white/10"
                            title="Excluir Seção"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                      </div>
                    ))}

                    {(!sections || sections.length === 0) && (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 border border-dashed border-[#323238] rounded-xl bg-[#121214]/50">
                        <Layers className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-xs">Nenhuma seção neste módulo.</span>
                        <span className="text-[10px] mt-1">Crie uma acima para começar.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // === VISTA DAS AULAS (DENTRO DA SEÇÃO) ===
                <div className="animate-in slide-in-from-right-4">
                  <div className="flex items-center justify-between gap-4 border-b border-[#323238] pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setSelectedSectionId(null)} className="p-2 hover:bg-[#323238] rounded-lg text-gray-400 hover:text-white transition">
                        <ChevronDown className="w-5 h-5 rotate-90" /> {/* Ícone virado para ser 'Voltar' */}
                      </button>
                      <div>
                        <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5">Editando Seção</div>
                        <div className="text-xl font-black text-white">
                          {sections?.find(s => s.id === selectedSectionId)?.title || "Seção"}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={createLesson}
                      className="bg-[#850000] hover:brightness-110 transition px-4 py-2.5 rounded-lg text-sm font-black flex items-center gap-2 shadow-lg shadow-red-900/20"
                    >
                      <Plus className="w-4 h-4" /> Nova Aula
                    </button>
                  </div>

                  {/* Lista de Aulas Simples (Sem agrupamento extra) */}
                  <div className="space-y-2">
                    {(lessons || [])
                      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
                      .map((l) => (
                        <div key={l.id} className="group flex items-center justify-between px-4 py-3 bg-[#121214] border border-[#323238] rounded-xl hover:border-[#850000]/30 transition">
                          <div className="flex items-center gap-3 flex-1 overflow-hidden">
                            <div className="w-8 h-8 rounded bg-[#202024] flex items-center justify-center text-gray-500 font-bold text-xs">
                              {l.order}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-gray-200 font-bold text-sm truncate">{l.title}</div>
                              <div className="flex gap-2 text-[10px] text-gray-500 mt-0.5">
                                {l.videoUrl && <span>• Vídeo</span>}
                                {l.attachments?.length > 0 && <span>• Anexos</span>}
                                {!l.isPublished && <span className="text-yellow-600 font-bold">• RASCUNHO</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveLesson(l.id, "up")} className="p-2 text-gray-500 hover:text-white"><ChevronUp className="w-4 h-4" /></button>
                            <button onClick={() => moveLesson(l.id, "down")} className="p-2 text-gray-500 hover:text-white"><ChevronDown className="w-4 h-4" /></button>
                            <button onClick={() => deleteLesson(l.id)} className="p-2 text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                            <button onClick={() => { setSelectedLessonId(l.id); setIsLessonEditorOpen(true); }} className="px-3 py-1.5 bg-[#323238] rounded text-xs font-bold ml-2 hover:text-white">Editar</button>
                          </div>
                        </div>
                      ))}
                    {(!lessons || lessons.length === 0) && (
                      <div className="text-center py-12 text-gray-500 text-sm">
                        Nenhuma aula nesta seção ainda.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TitaniumCard>
          </div>
        </div>

      </div>
      {isAccessModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#29292e] border border-[#323238] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="p-4 border-b border-[#323238] flex items-center justify-between">
              <div className="font-black text-gray-100">Níveis de Acesso</div>
              <button onClick={() => setIsAccessModalOpen(false)} className="text-gray-400 hover:text-white">Fechar</button>
            </div>

            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    className="bg-[#121214] border border-[#323238] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#850000]/40"
                    placeholder="Nome do nível (ex: Premium - Treino + Dieta)"
                    value={newAccessName}
                    onChange={(e) => setNewAccessName(e.target.value)}
                  />
                  <button
                    onClick={createAccessLevel}
                    className="bg-[#850000] hover:brightness-110 transition px-3 py-2 rounded-lg text-sm font-black flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Criar
                  </button>
                </div>

                <div className="bg-[#121214] border border-[#323238] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-400 font-black">Vincular planos:</div>

                    <button
                      onClick={() => setShowPlansPicker(true)}
                      className="text-xs font-black bg-[#29292e] border border-[#323238] hover:border-[#850000]/40 transition px-3 py-1.5 rounded-lg"
                    >
                      Selecionar planos
                    </button>
                  </div>

                  <div className="text-xs text-gray-400">
                    Selecionados: {newAccessPlanIds.length ? newAccessPlanIds.length : "nenhum"}
                  </div>
                </div>

                <div className="space-y-2">
                  {(accessLevels || []).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between bg-[#121214] border border-[#323238] rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-black text-sm truncate">{a.name}</div>
                        <div className="text-xs text-gray-400 truncate">
                          Planos: {(a.planIds || []).length}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteAccessLevel(a.id)}
                        className="text-gray-400 hover:text-red-400 transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DO SISTEMA */}
      <DrawerModal
        isOpen={isModuleEditorOpen}
        title="Editar Módulo"
        onClose={() => { setIsModuleEditorOpen(false); setEditingModuleId(null); }}
      >
        <div className="space-y-4">
          <div className="text-xs text-gray-400 font-black">Nome do módulo</div>
          <input
            className="w-full bg-[#121214] border border-[#323238] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#850000]/40 text-gray-100"
            value={moduleDraft.title}
            onChange={(e) => setModuleDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="Título do módulo"
          />

          <div className="bg-[#121214] border border-[#323238] rounded-lg p-3">
            <div className="text-xs text-gray-400 font-black mb-2">Níveis permitidos</div>

            <div className="flex flex-wrap gap-2">
              {(accessLevels || []).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    setModuleDraft((p) => ({
                      ...p,
                      allowedAccessLevels: toggleMulti(p.allowedAccessLevels || [], a.id),
                    }))
                  }
                  className={`text-xs px-2 py-1 rounded-full border transition ${(moduleDraft.allowedAccessLevels || []).includes(a.id)
                      ? "bg-[#850000] border-[#850000] text-gray-100"
                      : "bg-[#29292e] border-[#323238] text-gray-400 hover:text-gray-100"
                    }`}
                >
                  {a.name}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-gray-500 mt-2">
              Selecionados: <b className="text-gray-300">{(moduleDraft.allowedAccessLevels || []).length}</b>
            </div>
          </div>

          <button
            type="button"
            onClick={saveModule}
            className="w-full bg-[#850000] hover:brightness-110 transition px-3 py-3 rounded-lg text-sm font-black flex items-center justify-center gap-2"
          >
            Salvar alterações
          </button>
        </div>
      </DrawerModal>
      <PromptModal
        isOpen={dialog.type === 'create_lesson'}
        title={dialog.title}
        value={promptInput}
        onChange={setPromptInput}
        onConfirm={executeDialogAction}
        onCancel={() => setDialog({ type: null })}
      />
      <DrawerModal
        isOpen={isLessonEditorOpen}
        title={selectedLessonId ? "Editar Conteúdo" : "Novo Conteúdo"}
        onClose={() => setIsLessonEditorOpen(false)}
      >
        {!selectedLessonId ? (
          <div className="text-sm text-gray-400">Selecione um conteúdo para editar.</div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="text-xs text-gray-400">
                Módulo: <b className="text-gray-100">{selectedModule?.title || "—"}</b>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="md:col-span-2 bg-[#121214] border border-[#323238] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#850000]/40"
                  placeholder="Título do conteúdo"
                  value={lessonDraft.title}
                  onChange={(e) => setLessonDraft((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between gap-3 bg-[#121214] border border-[#323238] rounded-lg p-3">
              <div className="text-xs text-gray-400">
                Seção: <b className="text-gray-100">{sections?.find(s => s.id === selectedSectionId)?.title || "—"}</b>
              </div>
                <button
                  type="button"
                  onClick={() => setLessonDraft((p) => ({ ...p, isPublished: !(p.isPublished !== false) }))}
                  className={`rounded-lg px-3 py-2 text-sm font-black border transition ${
                    lessonDraft.isPublished !== false
                      ? "bg-[#850000]/20 border-[#850000]/40 text-gray-100"
                      : "bg-[#121214] border-[#323238] text-gray-400 hover:text-gray-100"
                  }`}
                  title="Alternar publicado/rascunho"
                >
                  {lessonDraft.isPublished !== false ? "Publicado" : "Rascunho"}
                </button>
              </div>


              {/* Campo de Link sempre visível agora */}
              <input
                className="bg-[#121214] border border-[#323238] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#850000]/40"
                placeholder="Link externo (opcional - ex: Drive/Meet)"
                value={lessonDraft.externalUrl || ""}
                onChange={(e) => setLessonDraft((p) => ({ ...p, externalUrl: e.target.value }))}
              />

              <input
                className="bg-[#121214] border border-[#323238] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#850000]/40"
                placeholder="Video URL (YouTube/Vimeo/mp4)"
                value={lessonDraft.videoUrl}
                onChange={(e) => setLessonDraft((p) => ({ ...p, videoUrl: e.target.value }))}
              />

              {lessonDraft.videoUrl?.trim() && (
                <div className="bg-[#121214] border border-[#323238] rounded-xl overflow-hidden">
                  <div className="aspect-video">
                    <VideoPlayerGlobal url={lessonDraft.videoUrl} />
                  </div>
                </div>
              )}

            <div className="flow-editor-dark rounded-lg overflow-hidden">
              <RichTextEditor
                isA4={false}
                value={lessonDraft.descriptionHtml}
                onChange={(html) => setLessonDraft((p) => ({ ...p, descriptionHtml: html }))}
              />
            </div>

              {/* BLOCO THUMBNAIL DA AULA COM AJUSTE DE POSIÇÃO */}
              <div className="bg-[#121214] border border-[#323238] rounded-lg p-3">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs text-gray-400 font-black">Thumbnail da Aula</div>
                  <div className="text-[10px] text-gray-500">Recomendado: 1280x720px (16:9)</div>
                </div>
                <label className="cursor-pointer text-xs font-black bg-[#29292e] border border-[#323238] hover:border-[#850000]/40 transition px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <Upload className="w-3 h-3" /> Alterar Imagem
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadThumbnail(e.target.files?.[0])} />
                </label>
              </div>

                {lessonDraft.thumbnailUrl ? (
                  <div className="space-y-3">
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border border-[#323238]">
                      <img
                        src={lessonDraft.thumbnailUrl}
                        alt="thumbnail"
                        className="w-full h-full object-cover transition-all duration-300"
                        style={{ objectPosition: `center ${lessonDraft.coverPosition ?? 50}%` }}
                      />
                    </div>

                    {/* Slider de Posição da Aula */}
                    <div className="flex items-center gap-2 bg-[#29292e] p-2 rounded-lg border border-[#323238]">
                      <MoveVertical className="w-4 h-4 text-gray-500" />
                      <div className="flex-1">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={lessonDraft.coverPosition ?? 50}
                          onChange={(e) => setLessonDraft(p => ({ ...p, coverPosition: Number(e.target.value) }))}
                          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#850000]"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 w-8 text-right">{lessonDraft.coverPosition ?? 50}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-4 border border-dashed border-[#323238] rounded-lg">
                    Sem thumbnail definida.
                  </div>
                )}
              </div>

              <div className="bg-[#121214] border border-[#323238] rounded-lg p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-gray-400 font-black">Anexos / Downloads</div>

                  <label className="cursor-pointer text-xs font-black bg-[#29292e] border border-[#323238] hover:border-[#850000]/40 transition px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <Upload className="w-4 h-4 text-gray-400" />
                    Upload
                    <input type="file" className="hidden" onChange={(e) => uploadAttachment(e.target.files?.[0])} />
                  </label>
                </div>

                <div className="mt-3 space-y-2">
                  {(lessonDraft.attachments || []).map((a, idx) => (
                    <div
                      key={`${a.url}_${idx}`}
                      className="flex items-center justify-between bg-[#29292e] border border-[#323238] rounded-lg px-3 py-2"
                    >
                      <div className="text-sm text-gray-100 truncate">{a.name}</div>
                      <button
                        onClick={() =>
                          setLessonDraft((p) => ({
                            ...p,
                            attachments: p.attachments.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-gray-400 hover:text-red-400 transition"
                        title="Remover do draft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {!lessonDraft.attachments?.length && <div className="text-xs text-gray-400">Nenhum anexo.</div>}
                </div>
              </div>

              <button
                onClick={saveLesson}
                className="bg-[#850000] hover:brightness-110 transition px-3 py-2 rounded-lg text-sm font-black flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> Salvar Conteúdo
              </button>
            </div>
          </>
        )}
      </DrawerModal>
      <ConfirmModal
        isOpen={['del_level', 'del_module', 'del_lesson'].includes(dialog.type)}
        title={dialog.title}
        msg="Esta ação não pode ser desfeita."
        onConfirm={executeDialogAction}
        onCancel={() => setDialog({ type: null })}
      />
      {/* --- NOVO: MODAL PARA RENOMEAR SEÇÃO --- */}
      <PromptModal
        isOpen={!!editingSectionId}
        title="Renomear Seção"
        value={editingSectionTitle}
        onChange={setEditingSectionTitle}
        onConfirm={saveSectionTitle}
        onCancel={() => { setEditingSectionId(null); setEditingSectionTitle(""); }}
      />
      {showPlansPicker && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#29292e] border border-[#323238] rounded-xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b border-[#323238] flex items-center justify-between">
              <div className="text-gray-100 font-black">Selecionar Planos</div>
              <button onClick={() => setShowPlansPicker(false)} className="text-gray-400 hover:text-white">
                Fechar
              </button>
            </div>

            <div className="p-4">
              {loadingPlans ? (
                <div className="text-sm text-gray-400">Carregando planos…</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(plans || []).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setNewAccessPlanIds((prev) => toggleMulti(prev, p.id))}
                      className={`text-xs px-2 py-1 rounded-full border transition ${newAccessPlanIds.includes(p.id)
                        ? "bg-[#850000] border-[#850000] text-gray-100"
                        : "bg-[#121214] border-[#323238] text-gray-400 hover:text-gray-100"
                        }`}
                    >
                      {p.name || p.title || p.id}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#323238] flex justify-end">
              <button
                onClick={() => setShowPlansPicker(false)}
                className="bg-[#850000] hover:brightness-110 transition px-4 py-2 rounded-lg text-sm font-black text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {showStudentPreview && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#29292e] border border-[#323238] rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">

            <div className="p-4 border-b border-[#323238] flex items-center justify-between">
              <div>
                <div className="text-gray-100 font-black">Pré-visualizar Área de Membros</div>
                <div className="text-gray-400 text-xs">Escolhe um nível de acesso e vê como o aluno vai enxergar.</div>
              </div>

              <button
                onClick={() => setShowStudentPreview(false)}
                className="text-gray-400 hover:text-white transition"
              >
                Fechar
              </button>
            </div>

            <div className="p-4 border-b border-[#323238] flex flex-col md:flex-row gap-3 items-center">
              <select
                value={previewAccessLevelId}
                onChange={(e) => setPreviewAccessLevelId(e.target.value)}
                className="w-full bg-[#121214] border border-[#323238] rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-[#850000]/40"
              >
                <option value="">Selecione um nível de acesso…</option>
                {(accessLevels || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#202024]">
              {previewAccessLevelId ? (
                <MembersArea
                  go={() => { }}
                  studentId={null}
                  previewAccessLevelIds={[previewAccessLevelId]}
                />
              ) : (
                <div className="p-6 text-gray-400">Selecione um nível de acesso para pré-visualizar.</div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
