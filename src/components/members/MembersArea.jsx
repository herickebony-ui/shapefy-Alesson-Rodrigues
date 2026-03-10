import React, { useMemo, useState, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { collection, query, where, orderBy, doc, setDoc, serverTimestamp, limit } from "firebase/firestore";
import useRealtime from "../../hooks/useRealtime";

import VideoPlayerGlobal from "../VideoPlayerGlobal";
import { ChevronDown, Lock, Download, Play, X, CheckCircle, BookOpen, Layers } from "lucide-react";

// === HELPER: Extrai thumbnail do YouTube ===
const getVideoThumbnail = (videoUrl, fallback = null) => {
  if (!videoUrl) return fallback;
  
  // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const ytMatch = videoUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch?.[1]) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  // Vimeo: vimeo.com/ID ou player.vimeo.com/video/ID
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch?.[1]) {
    // Vimeo não tem thumbnail direta, retorna fallback
    return fallback;
  }

  return fallback;
};
// === COMPONENTE MODAL DE LISTA DE AULAS ===
const SectionModal = ({
  section,
  onClose,
  onSelectLesson,
  progressMap,
  sectionsInModule = [],
  onSelectSection,
}) => {
  if (!section) return null;

  const currentId = section?.id || "";
  const canSwitch = Array.isArray(sectionsInModule) && sectionsInModule.length > 1;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-[#27272a] flex items-start justify-between bg-[#202024]">
          <div className="min-w-0">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Conteúdo</div>
            <h3 className="text-xl font-black text-white leading-tight truncate">{section.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{section.lessons.length} aulas disponíveis</p>

            {canSwitch && (
              <div className="mt-3">
                <select
                  value={currentId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const next = (sectionsInModule || []).find((s) => s.id === nextId) || null;
                    if (next && onSelectSection) onSelectSection(next);
                  }}
                  className="w-full bg-[#121214] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-[#850000]/40"
                >
                  {(sectionsInModule || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-[#27272a] hover:bg-[#850000] rounded-full text-gray-400 hover:text-white transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {section.lessons.map((lesson, idx) => {
            const isDone = !!progressMap?.[lesson.id]?.done;

            const hasVideo = !!String(lesson?.videoUrl || "").trim();
            const hasLink = !!String(lesson?.externalUrl || "").trim();
            const hasFiles = Array.isArray(lesson?.attachments) && lesson.attachments.length > 0;

            const typeLabel = hasVideo ? "Vídeo" : hasLink ? "Link" : hasFiles ? "PDF / Arquivos" : "Texto";

            return (
              <button
                key={lesson.id}
                onClick={() => onSelectLesson(lesson)}
                className="w-full flex items-center gap-4 p-4 hover:bg-[#27272a] rounded-xl transition group text-left border border-transparent hover:border-[#3f3f46]"
              >
                <div className="shrink-0 relative w-16 h-10 bg-black rounded-md overflow-hidden border border-[#3f3f46] flex items-center justify-center">
                {(lesson.thumbnailUrl || getVideoThumbnail(lesson.videoUrl)) ? (
                <img
                  src={lesson.thumbnailUrl || getVideoThumbnail(lesson.videoUrl)}
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100"
                  alt=""
                />
                  ) : (
                    <div className="text-gray-600">
                      <Play className="w-4 h-4" />
                    </div>
                  )}
                  {isDone && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-200 group-hover:text-white truncate">
                    {idx + 1}. {lesson.title}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    {typeLabel}
                    {isDone && <span className="text-green-500 font-bold">• Concluído</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function MembersArea({ go, studentId, previewAccessLevelIds = [] }) {
  // 1. Definições Básicas e Aluno
  const studentRef = useMemo(() => {
    if (!studentId) return null;
    return doc(db, "students", studentId);
  }, [studentId]);

  const { data: student, loading: loadingStudent } = useRealtime(studentRef);

  const settingsRef = useMemo(() => doc(db, "settings", "members_area_config"), []);
  const { data: settings } = useRealtime(settingsRef);

  const isPreview =
    !studentId &&
    Array.isArray(previewAccessLevelIds) &&
    previewAccessLevelIds.length > 0;

  const finOk = isPreview ? true : student?.finStatus === "Ativo";
  const planId = isPreview ? null : (student?.planId || null);

  // 2. Busca Níveis de Acesso e Módulos
  const accessLevelsQ = useMemo(() => {
    if (isPreview) return null;
    if (!planId) return null;
    return query(collection(db, "access_levels"), where("planIds", "array-contains", planId));
  }, [isPreview, planId]);

  const { data: allowedAccessLevels, loading: loadingAccess } = useRealtime(accessLevelsQ);

  const allowedAccessIds = useMemo(() => {
    if (isPreview) return previewAccessLevelIds;
    return (allowedAccessLevels || []).map((a) => a.id);
  }, [isPreview, JSON.stringify(previewAccessLevelIds), allowedAccessLevels]);

  const modulesQ = useMemo(() => {
    if (!allowedAccessIds.length) return null;
    return query(
      collection(db, "modules"),
      where("allowedAccessLevels", "array-contains-any", allowedAccessIds)
    );
  }, [JSON.stringify(allowedAccessIds)]);

  const { data: modules, loading: loadingModules } = useRealtime(modulesQ);

  const modulesSorted = useMemo(() => {
    const list = [...(modules || [])];
    list.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    return list;
  }, [modules]);

  // ==============================================================================
  // 3. ESTADOS (DEVEM VIR ANTES DAS QUERIES QUE DEPENDEM DELES)
  // ==============================================================================
  const [openModuleId, setOpenModuleId] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [resumeLessonId, setResumeLessonId] = useState(null);
  const [showHome, setShowHome] = useState(true);
  const [activeSection, setActiveSection] = useState(null); // Controla qual Modal está aberto
  // CARROSSEIS (swipe + botões)
  const continueCarouselRef = useRef(null);
  const moduleCarouselsRef = useRef({});

  const scrollCarousel = (el, dir = 1) => {
    if (!el) return;
    const step = Math.round(el.clientWidth * 0.85); // anda quase "1 tela"
    try {
      el.scrollBy({ left: dir * step, behavior: "smooth" });
    } catch (e) {
      el.scrollLeft += dir * step;
    }
  };

  const scrollContinue = (dir) => scrollCarousel(continueCarouselRef.current, dir);

  const scrollModule = (moduleId, dir) => {
    const el = moduleCarouselsRef.current?.[moduleId] || null;
    scrollCarousel(el, dir);
  };
  // --- LINHA RECUPERADA ---
  const resumeKey = useMemo(() => (studentId ? `members_resume_${studentId}` : null), [studentId]);

  // ==============================================================================
  // 4. BUSCAS DEPENDENTES (SEÇÕES E AULAS)
  // ==============================================================================

  // 4. BUSCAS GLOBAIS (FEED VERTICAL)
  // Buscamos todas as seções e aulas para montar a "Vitrine" completa
  const allSectionsRef = useMemo(() => collection(db, "sections"), []);
  const allLessonsRef = useMemo(() => collection(db, "lessons"), []);

  const { data: allSections, loading: loadingSections } = useRealtime(query(allSectionsRef, orderBy("order", "asc")));
  const { data: allLessons, loading: loadingLessons } = useRealtime(query(allLessonsRef, orderBy("order", "asc")));


  // AGRUPAMENTO INTELIGENTE (Módulos -> Seções -> Aulas)
  const feedModules = useMemo(() => {
    if (!modulesSorted || modulesSorted.length === 0) return [];
    if (!Array.isArray(allSections) || !Array.isArray(allLessons)) return [];

    return modulesSorted.map(mod => {
      // 1. Pega as seções deste módulo
      const modSections = allSections
        .filter(s => s.moduleId === mod.id)
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

      // 2. Insere as aulas dentro de cada seção
      const sectionsWithContent = modSections.map(sec => {
        const secLessons = allLessons
          .filter(l => l.sectionId === sec.id && l.isPublished !== false) // Filtra rascunhos
          .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

        return { ...sec, lessons: secLessons };
      });

      // Retorna o módulo completo apenas se tiver conteúdo ou se você quiser mostrar módulos vazios
      return { ...mod, sections: sectionsWithContent };
    });
  }, [modulesSorted, JSON.stringify(allSections), JSON.stringify(allLessons)]);

  // Mantemos compatibilidade com o Player (seleciona a aula atual na lista geral)
  const selectedLesson = useMemo(() => {
    if (!selectedLessonId || !allLessons) return null;
    return allLessons.find(l => l.id === selectedLessonId) || null;
  }, [allLessons, selectedLessonId]);
  const sectionById = useMemo(() => {
    const m = {};
    (allSections || []).forEach((s) => {
      if (s?.id) m[s.id] = s;
    });
    return m;
  }, [allSections]);

  const moduleById = useMemo(() => {
    const m = {};
    (modulesSorted || []).forEach((mod) => {
      if (mod?.id) m[mod.id] = mod;
    });
    return m;
  }, [modulesSorted]);

  const selectedSection = useMemo(() => {
    const sid = selectedLesson?.sectionId || null;
    return sid ? (sectionById[sid] || null) : null;
  }, [selectedLesson?.sectionId, sectionById]);

  const selectedModuleId = useMemo(() => {
    return selectedSection?.moduleId || null;
  }, [selectedSection?.moduleId]);

  const selectedModule = useMemo(() => {
    return selectedModuleId ? (moduleById[selectedModuleId] || null) : null;
  }, [selectedModuleId, moduleById]);

  const activeModule = useMemo(() => {
    const mid = activeSection?.moduleId || null;
    if (!mid) return null;
    return (feedModules || []).find((m) => m.id === mid) || null;
  }, [feedModules, activeSection?.moduleId]);

  const activeModuleSections = useMemo(() => {
    return activeModule?.sections || [];
  }, [activeModule]);

  const progressQ = useMemo(() => {
    if (!studentId) return null;
    return query(collection(db, "students", studentId, "members_progress"));
  }, [studentId]);

  const { data: progressRows } = useRealtime(progressQ);
  const recentProgressQ = useMemo(() => {
    if (!studentId) return null;
    return query(
      collection(db, "students", studentId, "members_progress"),
      orderBy("updatedAt", "desc"),
      limit(30)
    );
  }, [studentId]);

  const { data: recentProgressRows, loading: loadingRecentProgress } = useRealtime(recentProgressQ);

  const continueRows = useMemo(() => (recentProgressRows || []).slice(0, 2), [recentProgressRows]);

  const latestByModule = useMemo(() => {
    const by = {};
    (recentProgressRows || []).forEach((r) => {
      if (!r?.moduleId) return;
      if (by[r.moduleId]) return;
      by[r.moduleId] = r;
    });
    return by;
  }, [recentProgressRows]);

  const progressMap = useMemo(() => {
    const m = {};
    (progressRows || []).forEach((r) => {
      m[r.id] = r;
    });
    return m;
  }, [progressRows]);

  const currentModule = useMemo(() => {
    return (feedModules || []).find((m) => m.id === openModuleId) || null;
  }, [feedModules, openModuleId]);

  const sections = useMemo(() => {
    return currentModule?.sections || [];
  }, [currentModule]);

  const sortedLessons = useMemo(() => {
    const list = [];
    (sections || []).forEach((sec) => {
      (sec.lessons || []).forEach((l) => {
        list.push({ ...l, sectionTitle: sec.title });
      });
    });
    return list;
  }, [sections]);


  useEffect(() => {
    if (openModuleId) return;
    if (!(modulesSorted || []).length) return;

    let resume = null;
    if (resumeKey) {
      try {
        resume = JSON.parse(localStorage.getItem(resumeKey) || "null");
      } catch (e) {
        resume = null;
      }
    }

    const resumeModuleId = resume?.openModuleId;
    const exists = resumeModuleId && (modules || []).some((m) => m.id === resumeModuleId);

    if (exists) {
      setOpenModuleId(resumeModuleId);
      setResumeLessonId(resume?.lessonId || null);
      setSelectedLessonId(null);
      return;
    }

    setOpenModuleId(modulesSorted[0].id);
    setSelectedLessonId(null);
  }, [modules, openModuleId, resumeKey]);

  useEffect(() => {
    if (!studentId) return;
    if (!selectedLesson?.id) return;

    const moduleId = selectedModuleId || null;
    const moduleTitle = selectedModule?.title || "";

    setDoc(
      doc(db, "students", studentId, "members_progress", selectedLesson.id),
      {
        moduleId,
        lessonId: selectedLesson.id,
        lessonTitle: selectedLesson.title || "",
        moduleTitle,
        thumbnailUrl: selectedLesson.thumbnailUrl || "",
        contentType: selectedLesson.contentType || "",
        videoUrl: selectedLesson.videoUrl || "",
        externalUrl: selectedLesson.externalUrl || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (resumeKey) {
      try {
        localStorage.setItem(
          resumeKey,
          JSON.stringify({
            lessonId: selectedLesson.id,
            at: Date.now(),
          })
        );
      } catch (e) { }
    }
  }, [studentId, selectedLesson?.id, selectedModuleId, selectedModule?.title, resumeKey]);

  if (!isPreview && loadingStudent) {
    return (
      <div className="min-h-screen bg-[#202024] text-gray-100 p-6 flex items-center justify-center">
        <div className="text-sm text-gray-400">Carregando…</div>
      </div>
    );
  }

  if (!isPreview && !student) {
    return (
      <div className="min-h-screen bg-[#202024] text-gray-100 p-6 flex items-center justify-center">
        <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6 max-w-md w-full">
          <div className="font-black mb-2">Aluno não encontrado</div>
          <div className="text-sm text-gray-400">
            Não encontrei seu cadastro em <b>students</b> com ID: <b>{studentId}</b>.
          </div>
        </div>
      </div>
    );
  }

  if (!isPreview && !finOk) {
    return (
      <div className="min-h-screen bg-[#202024] text-gray-100 p-6 flex items-center justify-center">
        <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6 max-w-md w-full text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#121214] border border-[#323238] flex items-center justify-center">
            <Lock className="w-6 h-6 text-gray-400" />
          </div>
          <div className="font-black text-lg">Acesso bloqueado</div>
          <div className="text-sm text-gray-400 mt-2">
            Status financeiro: <b>{student.finStatus}</b>
          </div>
          <button
            onClick={() => go && go("student_hub")}
            className="mt-4 bg-[#850000] hover:brightness-110 transition px-3 py-2 rounded-lg text-sm font-black w-full"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const toggleSection = (title) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: prev[title] === false ? true : false, // undefined = aberto por padrão
    }));
  };

  const markDone = async (lesson, nextDone) => {
    if (!studentId) return;

    const prevDone = !!progressMap?.[lesson.id]?.done;

    const sec = lesson?.sectionId ? (sectionById[lesson.sectionId] || null) : null;
    const moduleId = sec?.moduleId || selectedModuleId || null;
    const moduleTitle = moduleId ? (moduleById[moduleId]?.title || "") : "";

    // todas as aulas do módulo (para % correto)
    const mod = moduleId ? (feedModules || []).find((m) => m.id === moduleId) : null;
    const moduleLessons = [];
    (mod?.sections || []).forEach((s) => {
      (s.lessons || []).forEach((l) => moduleLessons.push(l));
    });

    const total = moduleLessons.length;

    let doneCount = moduleLessons.filter((l) => !!progressMap?.[l.id]?.done).length;
    if (nextDone && !prevDone) doneCount += 1;
    if (!nextDone && prevDone) doneCount = Math.max(0, doneCount - 1);

    const pct = total ? Math.round((doneCount / total) * 100) : 0;

    await setDoc(
      doc(db, "students", studentId, "members_progress", lesson.id),
      {
        moduleId,
        moduleTitle,
        lessonId: lesson.id,
        done: !!nextDone,
        updatedAt: serverTimestamp(),
        sectionTitle: sec?.title || lesson.sectionTitle || "Geral",
        lessonTitle: lesson.title || "",

        moduleTotal: total,
        moduleDone: doneCount,
        moduleProgressPct: pct,
      },
      { merge: true }
    );
  };


  const persistResume = (moduleId, lessonId) => {
    if (!resumeKey) return;
    try {
      localStorage.setItem(
        resumeKey,
        JSON.stringify({
          openModuleId: moduleId || null,
          lessonId: lessonId || null,
          at: Date.now(),
        })
      );
    } catch (e) { }
  };
  const resumeNow = () => {
    if (!resumeKey) return;

    let resume = null;
    try {
      resume = JSON.parse(localStorage.getItem(resumeKey) || "null");
    } catch (e) {
      resume = null;
    }

    if (!resume?.openModuleId) return;

    setShowHome(false);
    setOpenModuleId(resume.openModuleId);
    setSelectedLessonId(null);
    setResumeLessonId(resume?.lessonId || null);
    setExpandedSections({});
  };
  const loadingAll = loadingAccess || loadingModules || loadingSections || loadingLessons;

  const moduleTotal = (sortedLessons || []).length;
  const moduleDone = (sortedLessons || []).filter((l) => !!progressMap?.[l.id]?.done).length;
  const moduleProgressPct = moduleTotal ? Math.round((moduleDone / moduleTotal) * 100) : 0;

  const selectedDone = selectedLesson?.id ? !!progressMap?.[selectedLesson.id]?.done : false;

  return (
    <div className="min-h-screen bg-[#202024] text-gray-100">
      {/* HEADER FIXO */}
      <div className="sticky top-0 z-50 bg-[#202024]/90 backdrop-blur-md border-b border-[#27272a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => go && go("student_hub")}
            className="text-sm font-black text-gray-400 hover:text-white transition"
          >
            ← Voltar ao Painel
          </button>

          {selectedLessonId && (
            <button
              type="button"
              onClick={() => {
                const sectionId = selectedLesson?.sectionId;
                let foundSection = null;
                
                if (sectionId) {
                  for (const mod of (feedModules || [])) {
                    const sec = (mod.sections || []).find(s => s.id === sectionId);
                    if (sec) {
                      foundSection = sec;
                      break;
                    }
                  }
                }
                
                setSelectedLessonId(null);
                
                if (foundSection) {
                  setActiveSection(foundSection);
                }
                
                try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-black transition border bg-[#121214] border-[#323238] text-gray-200 hover:border-[#850000]/40"
              title="Voltar"
            >
              Voltar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {loadingAll && <div className="hidden md:block text-xs text-gray-400">sync…</div>}

          {!selectedLessonId && (
            <button
              type="button"
              onClick={() => {
                if (!resumeKey) return;
                let resume = null;
                try { resume = JSON.parse(localStorage.getItem(resumeKey) || "null"); } catch (e) { resume = null; }
                if (!resume?.lessonId) return;
                setSelectedLessonId(resume.lessonId);
                try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { }
              }}
              disabled={!studentId}
              className={`px-4 py-2 rounded-lg text-xs font-black transition border ${studentId
                ? "bg-[#850000] border-[#850000] hover:brightness-110 text-white"
                : "bg-[#121214] border-[#323238] text-gray-500 cursor-not-allowed"
                }`}
              title={!studentId ? "Preview não salva progresso" : "Retomar última aula"}
            >
              Retomar
            </button>
          )}
        </div>
      </div>


      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* FEED */}
        {!selectedLessonId ? (
          <div className="space-y-10">
            {/* CAPA GLOBAL */}
            {/* TOPO (texto) */}
            <div className="bg-[#29292e] border border-[#323238] rounded-xl p-4 md:p-5">
              <div className="text-xs text-gray-400 font-black uppercase tracking-wider">
                {isPreview ? "Pré-visualização" : "Área de Membros"}
              </div>
              <div className="text-2xl md:text-3xl font-black text-white">
                {isPreview
                  ? "Simulação de acesso"
                  : `Bem-vindo, ${(student?.name || student?.nome || "Aluno").split(" ")[0]}`}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Escolha um conteúdo abaixo para começar.
              </div>
            </div>

            {/* CAPA (imagem separada) */}
            {settings?.coverUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-[#27272a] shadow-2xl h-44 md:h-60">
                <img
                  src={settings.coverUrl}
                  alt="Capa"
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                  style={{ objectPosition: `center ${settings?.coverPosition ?? 50}%` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
              </div>
            )}


            {/* CONTINUAR ASSISTINDO */}
            {!!continueRows?.length && (
              <div className="bg-[#29292e] border border-[#323238] rounded-xl p-4 relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-black">Continuar assistindo</div>

                  {/* Setas (desktop/sempre visível) */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => scrollContinue(-1)}
                      className="w-9 h-9 rounded-full bg-[#121214] border border-[#323238] text-gray-200 hover:border-[#850000]/40 transition"
                      title="Voltar"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollContinue(1)}
                      className="w-9 h-9 rounded-full bg-[#121214] border border-[#323238] text-gray-200 hover:border-[#850000]/40 transition"
                      title="Avançar"
                    >
                      ›
                    </button>
                  </div>
                </div>

                {/* Trilho horizontal (swipe no celular) */}
                <div
                  ref={continueCarouselRef}
                  className="flex gap-3 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory
        [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {continueRows.map((r) => {
                    const pct = Number(r.moduleProgressPct || 0);

                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedLessonId(r.lessonId || null);
                          try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { }
                        }}
                        className="snap-start min-w-[240px] max-w-[240px] text-left bg-[#121214] border border-[#323238] rounded-xl overflow-hidden hover:border-[#850000]/40 transition"
                        disabled={!studentId}
                        title={!studentId ? "Preview não salva progresso" : "Continuar"}
                      >
                        {/* Thumb */}
                        <div className="h-28 bg-black/40 border-b border-[#323238] relative">
                        {(r.thumbnailUrl || getVideoThumbnail(r.videoUrl)) ? (
                        <img
                          src={r.thumbnailUrl || getVideoThumbnail(r.videoUrl)}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-80"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm font-black">
                          SEM CAPA
                        </div>
                      )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        </div>

                        {/* Texto + barra */}
                        <div className="p-3">
                          <div className="text-[11px] text-gray-400 font-black uppercase truncate">
                            {r.moduleTitle || "Módulo"}
                          </div>
                          <div className="text-sm text-gray-100 font-black truncate">
                            {r.lessonTitle || "Aula"}
                          </div>

                          <div className="mt-3 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-1.5 bg-[#850000]" style={{ width: `${pct}%` }} />
                          </div>

                          <div className="mt-2 text-[11px] text-gray-400 font-black">
                            {typeof r.moduleDone === "number" && typeof r.moduleTotal === "number"
                              ? `${r.moduleDone}/${r.moduleTotal} • ${pct}%`
                              : "Clique para continuar"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}


            {/* FEED VERTICAL: MÓDULO -> CAPAS (SEÇÕES) */}
            <div className="space-y-12">
              {(feedModules || []).map((mod) => {
                const secs = mod.sections || [];
                if (!secs.length) return null;

                return (
                  <div key={mod.id} className="space-y-4">
                    <div className="flex items-end gap-3 px-2 border-l-4 border-[#850000]">
                      <h2 className="text-2xl md:text-3xl font-black text-white uppercase leading-none">{mod.title}</h2>
                    </div>

                    <div className="relative">
                      {/* Setas do carrossel */}
                      <div className="absolute -top-12 right-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => scrollModule(mod.id, -1)}
                          className="w-9 h-9 rounded-full bg-[#121214] border border-[#323238] text-gray-200 hover:border-[#850000]/40 transition"
                          title="Voltar"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollModule(mod.id, 1)}
                          className="w-9 h-9 rounded-full bg-[#121214] border border-[#323238] text-gray-200 hover:border-[#850000]/40 transition"
                          title="Avançar"
                        >
                          ›
                        </button>
                      </div>

                      {/* Trilho horizontal */}
                      <div
                        ref={(el) => { moduleCarouselsRef.current[mod.id] = el; }}
                        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory
      [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {secs.map((sec) => (
                          <div
                            key={sec.id}
                            className="snap-start group relative bg-[#121214] border border-[#323238] rounded-xl overflow-hidden hover:border-[#850000] transition-all shadow-lg aspect-[2/3] min-w-[170px] max-w-[170px]"
                          >
                            <div className="absolute inset-0 bg-[#202024]">
                              {sec.coverUrl ? (
                                <img
                                  src={sec.coverUrl}
                                  alt={sec.title}
                                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 p-4 text-center">
                                  <Layers className="w-8 h-8 mb-2 opacity-30" />
                                  <span className="text-[10px] font-bold uppercase">Sem Capa</span>
                                </div>
                              )}
                            </div>

                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

                            <div className="absolute bottom-0 left-0 w-full p-3 z-20 pointer-events-none">
                              <div className="text-white font-black text-sm leading-tight uppercase mb-1 drop-shadow-md" style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}>
                                {sec.title || "Sem título"}
                              </div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <BookOpen className="w-3 h-3" /> {sec.lessons?.length || 0} Aulas
                              </div>
                            </div>

                            <button
                              className="absolute inset-0 w-full h-full z-30 cursor-pointer"
                              onClick={() => setActiveSection(sec)}
                              title="Clique para ver as aulas"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* PLAYER */
          <div className="max-w-5xl mx-auto animate-in slide-in-from-right-4">
            <div className="bg-[#29292e] border border-[#323238] rounded-xl overflow-hidden">
              <div className="relative p-6 border-b border-[#323238] overflow-hidden">
                {selectedLesson?.thumbnailUrl ? (
                  <img
                    src={selectedLesson.thumbnailUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-40 transition-all duration-500"
                  />
                ) : null}

                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-300 font-black uppercase tracking-wider">
                      {selectedModule?.title || "Módulo"}
                    </div>

                    <div className="text-2xl md:text-3xl font-black text-white truncate">
                      {selectedLesson?.title || "Aula"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" />
                </div>
              </div>

              <div className="p-4">
                {selectedLesson && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs text-gray-400 font-black">
                      {!!progressMap?.[selectedLesson.id]?.done ? "✅ Concluída" : "⏳ Em andamento"}
                    </div>

                    <button
                      type="button"
                      disabled={!studentId}
                      onClick={() => markDone(selectedLesson, !progressMap?.[selectedLesson.id]?.done)}
                      className={`px-4 py-2 rounded-lg text-sm font-black border transition ${!studentId
                        ? "bg-[#121214] border-[#323238] text-gray-500 cursor-not-allowed"
                        : !!progressMap?.[selectedLesson.id]?.done
                          ? "bg-[#121214] border-[#323238] text-gray-200 hover:border-[#850000]/40"
                          : "bg-[#850000] border-[#850000] text-white hover:brightness-110"
                        }`}
                      title={!studentId ? "Preview não marca progresso" : "Alternar conclusão"}
                    >
                      {!!progressMap?.[selectedLesson.id]?.done ? "Desmarcar" : "Marcar como concluída"}
                    </button>
                  </div>
                )}

                <div className="space-y-6">
                  {selectedLesson?.videoUrl && (
                    <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#323238]">
                      <VideoPlayerGlobal url={selectedLesson.videoUrl} />
                    </div>
                  )}

                  {selectedLesson?.externalUrl && (
                    <a
                      href={selectedLesson.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-[#121214] border border-[#323238] hover:border-[#850000]/50 transition px-4 py-3 rounded-lg text-sm font-black text-gray-100"
                    >
                      🔗 Acessar Link Externo / Material Extra
                    </a>
                  )}

                  {!selectedLesson?.videoUrl &&
                    !selectedLesson?.externalUrl &&
                    !selectedLesson?.descriptionHtml &&
                    (!selectedLesson?.attachments || !selectedLesson.attachments.length) && (
                      <div className="p-6 text-center text-gray-500 text-sm border border-dashed border-[#323238] rounded-xl">
                        Esta aula não possui conteúdo visual (apenas texto ou anexos abaixo).
                      </div>
                    )}
                </div>
              </div>
            </div>

            <div className="bg-[#29292e] border border-[#323238] rounded-xl p-4 space-y-4 mt-4">
              <div>
                <div className="font-black mb-2">Descrição</div>
                {selectedLesson?.descriptionHtml ? (
                  <div
                    className="text-sm leading-relaxed [&>*]:text-gray-200 [&_*]:text-gray-200"
                    style={{ color: '#e5e5e5' }}
                    dangerouslySetInnerHTML={{ __html: selectedLesson.descriptionHtml }}
                  />
                ) : (
                  <div className="text-sm text-gray-400">Sem descrição ainda.</div>
                )}
              </div>

              <div>
                <div className="font-black mb-2">Downloads</div>
                {(selectedLesson?.attachments || []).length ? (
                  <div className="space-y-2">
                    {selectedLesson.attachments.map((a, idx) => (
                      <a
                        key={`${a.url}_${idx}`}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between bg-[#121214] border border-[#323238] rounded-lg px-3 py-2 hover:border-[#850000]/40 transition"
                      >
                        <div className="text-sm text-gray-100 truncate">{a.name}</div>
                        <Download className="w-4 h-4 text-gray-400" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">Nenhum arquivo disponível.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}
      <SectionModal
        section={activeSection}
        onClose={() => setActiveSection(null)}
        progressMap={progressMap}
        sectionsInModule={activeModuleSections}
        onSelectSection={(sec) => setActiveSection(sec)}
        onSelectLesson={(lesson) => {
          setActiveSection(null);
          setSelectedLessonId(lesson.id);
          if (resumeKey) {
            try {
              localStorage.setItem(resumeKey, JSON.stringify({ lessonId: lesson.id, at: Date.now() }));
            } catch (e) { }
          }
          try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { }
        }}
      />
    </div>
  );

}
