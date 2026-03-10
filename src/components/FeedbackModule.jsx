import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; // <--- ADICIONADO
import {
    doc, getDoc, setDoc, serverTimestamp, collection,
    getDocs, query, where, deleteDoc, onSnapshot
} from 'firebase/firestore';
import { db, functions as firebaseFunctions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import StudentNameWithBadge from "./StudentNameWithBadge";
import {
    Calendar, ChevronLeft, ChevronRight, User,
    Dumbbell, CheckCircle2, Circle, Save,
    AlertCircle, Copy, Search, Settings,
    ArrowRight, Clock, ListChecks,
    StickyNote, Undo, Filter, RefreshCw,
    MessageSquare, X, Palmtree, Trash2, LayoutDashboard,
    Bold, Link as LinkIcon, Check, Plus, Trash,
    LayoutList, Kanban, Eye, ChevronsLeft, ChevronsRight // <--- ÍCONES ADICIONADOS
} from 'lucide-react';
// --- CONFIGURAÇÃO DE CALENDÁRIO ---
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const HOLIDAYS_FIXED = {
    '01-01': 'Confraternização Universal', '21-04': 'Tiradentes', '01-05': 'Dia do Trabalho',
    '07-09': 'Independência', '12-10': 'Nossa Sra. Aparecida', '02-11': 'Finados',
    '15-11': 'Proclamação', '25-12': 'Natal'
};

// --- MODELO DE MENSAGEM PADRÃO ---
const DEFAULT_TEMPLATE = `O SEU ACOMPANHAMENTO VAI ATÉ: {{FIM_PLANO}}

A ficha de treino é atualizada até a próxima segunda-feira após o envio do feedback.
Se houver atraso no feedback, o novo plano poderá atrasar.
Caso você não conclua todas as semanas, a atualização será feita em até 5 dias úteis após o último feedback.

1.0 — CRONOGRAMA DE FEEDBACKS
O feedback deve ser enviado quinzenalmente, sempre às segundas-feiras, nas seguintes datas: 
{{LISTA_DATAS}}

- Responda o Feedback pelo Aplicativo ShapeFy 
shapefy.online (http://shapefy.online/)

2.0 — FOTOS PARA AVALIAÇÃO
- Envie as fotos no padrão descrito no link abaixo, utilizando o formulário dentro do aplicativo:
CLIQUE AQUI E ACESSE AS INSTRUÇÕES (https://teamebony.com.br/wp-content/uploads/2025/03/PROTOCOLO-DE-FOTOS-P-AVALIACAO-FISICA.pdf)

Senha de acesso do teu app:`;

const FeedbackModule = ({ students = [], initialView }) => {
    // Agora a visão ativa é controlada diretamente pela prop que vem da Sidebar
    const [activeView, setActiveView] = useState(initialView || 'dashboard');

    useEffect(() => {
        if (initialView) {
            setActiveView(initialView);
        }
    }, [initialView]);

    const [historyView, setHistoryView] = useState('table');
    // 'table' | 'timeline'

    // --- ESTADOS GERAIS ---
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());

    // --- ESTADOS DE VISUALIZAÇÃO (NOVO) ---
    const [dashboardViewMode, setDashboardViewMode] = useState('list'); // 'list' ou 'kanban'
    const [quickHistoryData, setQuickHistoryData] = useState(null); // Para o modal rápido

    // --- GERENCIAMENTO DE FÉRIAS (AGORA COM FIREBASE) ---
    const [showVacationModal, setShowVacationModal] = useState(false);
    const [newVacationStart, setNewVacationStart] = useState('');
    const [newVacationEnd, setNewVacationEnd] = useState('');
    const [vacationRanges, setVacationRanges] = useState([]); // Começa vazio

    // --- ESTADOS DA MENSAGEM (TEMPLATE) ---
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [messageTemplate, setMessageTemplate] = useState(() => {
        return localStorage.getItem('ebony_msg_template') || DEFAULT_TEMPLATE;
    });
    const [templateNameInput, setTemplateNameInput] = useState('');
    const [savedTemplates, setSavedTemplates] = useState([
        { id: 'default', name: 'Modelo Padrão', text: DEFAULT_TEMPLATE }
    ]);
    const textareaRef = React.useRef(null);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    // --- SISTEMA DE NOTIFICAÇÃO (TOAST) ---
    const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
    const showToast = (msg, type = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };


    // Carregar férias do Firebase ao iniciar
    useEffect(() => {
        const loadVacations = async () => {
            try {
                // Vamos salvar num documento fixo chamado 'vacations' dentro da coleção 'settings'
                const docRef = doc(db, "settings", "vacations");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setVacationRanges(docSnap.data().ranges || []);
                }
            } catch (error) {
                console.error("Erro ao carregar férias:", error);
            }
        };
        loadVacations();
    }, []);

    // --- CARREGAR TEMPLATES DO FIREBASE ---
    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const docRef = doc(db, "settings", "msg_templates");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().list) {
                    setSavedTemplates(docSnap.data().list);
                }
            } catch (error) {
                console.error("Erro ao carregar templates:", error);
            }
        };
        loadTemplates();
    }, []);

    // --- DADOS DO AGENDAMENTO (SCHEDULE) ---
    const [schedule, setSchedule] = useState({
        planStart: '',
        planDuration: 3,
        planEnd: '',
        cycleStartDate: '', // MARCO ZERO (só cálculo de ciclo)
        dates: []
    });

    // --- ESTADO DO DASHBOARD GERAL ---
    const [generalDashboard, setGeneralDashboard] = useState({ late: [], today: [], upcoming: [], notSent: [] });
    const [missingScheduleStudents, setMissingScheduleStudents] = useState([]);
    const [showMissingScheduleModal, setShowMissingScheduleModal] = useState(false);
    const [missingSearch, setMissingSearch] = useState("");

    const [allFeedbacks, setAllFeedbacks] = useState([]);
    const [activeFilter, setActiveFilter] = useState('week');


    // --- MANIPULAÇÃO DE FÉRIAS ---
    const handleAddVacation = async () => {
        if (!newVacationStart || !newVacationEnd) return alert("Preencha início e fim.");

        const newRange = { id: Date.now(), start: newVacationStart, end: newVacationEnd };
        const updated = [...vacationRanges, newRange];

        // 1. Atualiza na tela imediatamente (pra não travar)
        setVacationRanges(updated);
        setNewVacationStart('');
        setNewVacationEnd('');

        // 2. Salva no Firebase em segundo plano
        try {
            await setDoc(doc(db, "settings", "vacations"), { ranges: updated });
        } catch (error) {
            console.error("Erro ao salvar férias:", error);
            alert("Erro ao salvar no banco. Verifique sua conexão.");
        }
    };

    const handleRemoveVacation = async (id) => {
        if (!window.confirm("Remover este período de férias?")) return;

        const updated = vacationRanges.filter(v => v.id !== id);

        // 1. Remove da tela
        setVacationRanges(updated);

        // 2. Atualiza o banco
        try {
            await setDoc(doc(db, "settings", "vacations"), { ranges: updated });
        } catch (error) {
            console.error("Erro ao remover férias:", error);
            alert("Erro ao atualizar o banco.");
        }
    };

    // --- FUNÇÕES DO SISTEMA DE TEMPLATES ---
    const handleSaveNewTemplate = async () => {
        if (!templateNameInput.trim()) return alert("Dê um nome para o modelo.");

        const newTemplate = { id: Date.now(), name: templateNameInput, text: messageTemplate };
        const newList = [...savedTemplates, newTemplate];

        // 1. Atualiza visualmente na hora (Optimistic UI)
        setSavedTemplates(newList);
        setTemplateNameInput('');

        // 2. Salva no Firebase
        try {
            await setDoc(doc(db, "settings", "msg_templates"), { list: newList });
        } catch (error) {
            console.error("Erro ao salvar template:", error);
            alert("Erro ao salvar no banco de dados.");
        }
    };

    const handleLoadTemplate = (e) => {
        const id = e.target.value;
        if (!id) return;
        const selected = savedTemplates.find(t => String(t.id) === String(id));
        if (selected && window.confirm(`Carregar modelo "${selected.name}"? O texto atual será substituído.`)) {
            setMessageTemplate(selected.text);
        }
        e.target.value = "";
    };

    const handleDeleteTemplate = async (id) => {
        if (id === 'default') return alert("Não pode apagar o padrão.");

        if (window.confirm("Apagar este modelo salvo?")) {
            const newList = savedTemplates.filter(t => t.id !== id);

            // 1. Atualiza visual
            setSavedTemplates(newList);

            // 2. Atualiza no Firebase
            try {
                await setDoc(doc(db, "settings", "msg_templates"), { list: newList });
            } catch (error) {
                console.error("Erro ao deletar:", error);
                alert("Erro ao atualizar o banco.");
            }
        }
    };

    const applyBold = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = messageTemplate;
        const selectedText = text.substring(start, end);

        const newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end);

        setMessageTemplate(newText);
        setTimeout(() => textarea.focus(), 0);
    };

    const openLinkInput = () => {
        const textarea = textareaRef.current;
        if (!textarea || textarea.selectionStart === textarea.selectionEnd) {
            alert("Selecione o texto que será o link primeiro.");
            return;
        }
        setShowLinkInput(true);
    };

    const applyLink = () => {
        if (!linkUrl) return;

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = messageTemplate;
        const selectedText = text.substring(start, end);

        const newText = text.substring(0, start) + `[${selectedText}](${linkUrl})` + text.substring(end);

        setMessageTemplate(newText);
        setShowLinkInput(false);
        setLinkUrl('');
    };

    // --- CARREGAR DASHBOARD GERAL (AO VIVO com onSnapshot) ---
    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "feedback_schedules"),
            (querySnapshot) => {
                try {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);

                    const stats = { late: [], today: [], upcoming: [], notSent: [] };
                    const fullList = [];

                    const scheduleHasDatesByStudentId = {};

                    querySnapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        const studentId = String(docSnap.id);
                        const studentName = data.studentName || "Aluno";
                        const st = (students || []).find(s => String(s.id) === studentId);

                        const isFinActive = isFinancialActive(st);
                        const validDates = Array.isArray(data.dates) ? data.dates : [];
                        
                        // Define se tem datas (ignorando as marcações de marco zero)
                        const hasDates = validDates.some(d => d.type !== 'start');
                        scheduleHasDatesByStudentId[studentId] = hasDates;

                        validDates.forEach((d) => {
                            if (d.type === 'start') return; // Marco zero não vai pra lista

                            const fDate = new Date(d.date + "T12:00:00");
                            fDate.setHours(0, 0, 0, 0);

                            const itemObj = { ...d, studentName, studentId, dateObj: fDate };

                            // CORREÇÃO DO BUG: Sempre joga na fullList para o Histórico aparecer!
                            fullList.push(itemObj);

                            // Mas SÓ JOGA NOS ALERTAS (Atrasado, Hoje, Próximos) se estiver Ativo no Financeiro
                            if (isFinActive && d.status !== "done") {
                                const diffMs = now - fDate;
                                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                                const overdueDays = diffMs > 0 ? Math.floor(diffDays) : 0;

                                const isOverdue = diffMs > 0 && d.received !== true;
                                const isLateWindow = isOverdue && overdueDays <= 7;
                                const isNotSent = isOverdue && overdueDays > 7;

                                if (isLateWindow) {
                                    stats.late.push(itemObj);
                                } else if (isNotSent) {
                                    stats.notSent.push(itemObj);
                                } else if (Math.abs(diffDays) < 0.1) {
                                    stats.today.push(itemObj);
                                } else if (diffDays < 0 && diffDays >= -7) {
                                    stats.upcoming.push(itemObj);
                                }
                            }
                        });
                    });

                    const missing = (students || [])
                        .filter(isFinancialActive)
                        .filter((s) => !scheduleHasDatesByStudentId[String(s.id)])
                        .sort((a, b) => String(a.finDueDate || "").localeCompare(String(b.finDueDate || "")));

                    setMissingScheduleStudents(missing);

                    const sorter = (a, b) => (a.date || "").localeCompare(b.date || "");
                    stats.late.sort(sorter);
                    stats.today.sort(sorter);
                    stats.upcoming.sort(sorter);
                    fullList.sort(sorter);

                    setGeneralDashboard(stats);
                    setAllFeedbacks(fullList);
                } catch (e) {
                    console.error("Erro dashboard (snapshot):", e);
                }
            },
            (error) => console.error("Erro onSnapshot feedback_schedules:", error)
        );

        return () => unsub();
    }, [students]);

    // --- CARREGAR DADOS DO ALUNO SELECIONADO (OTIMIZADO E BLINDADO) ---
    useEffect(() => {
        // 1. TRAVA DE SEGURANÇA: Se não tem aluno selecionado ou o ID é inválido, PARA TUDO.
        if (!selectedStudent || !selectedStudent.id) {
            setSchedule({ planStart: '', planDuration: 3, planEnd: '', cycleStartDate: '', dates: [] });
            return;
        }

        let isMounted = true; // Previne erro ao trocar de tela rápido

        const loadScheduleAndFinancial = async () => {
            setLoading(true);
            try {
                const studentId = String(selectedStudent.id); // Garante que é string
                const docRef = doc(db, "feedback_schedules", studentId);

                // A. Busca Agendamento Existente e Financeiro em PARALELO (Mais rápido)
                const [docSnap, financialData] = await Promise.all([
                    getDoc(docRef),
                    fetchLatestFinancialVigency(studentId)
                ]);

                if (!isMounted) return; // Se mudou de tela, ignora o resultado

                // B. Monta a base do agendamento
                let baseSchedule = {
                    planStart: new Date().toISOString().split('T')[0],
                    planDuration: 3,
                    planEnd: '',
                    cycleStartDate: '',
                    dates: []
                };

                if (docSnap.exists()) {
                    baseSchedule = { ...baseSchedule, ...docSnap.data() };
                }

                // C. Mescla com dados do Financeiro (se houver)
                const fullStudent = (students || []).find(s => String(s.id) === studentId) || selectedStudent;
                const hasFinancial = !!fullStudent?.finPlanName || !!fullStudent?.finDueDate;

                if (hasFinancial && financialData && financialData.planEnd) {
                    baseSchedule = {
                        ...baseSchedule,
                        planStart: financialData.planStart || baseSchedule.planStart,
                        planDuration: financialData.planDuration || baseSchedule.planDuration || 3,
                        planEnd: financialData.planEnd
                    };
                }

                setSchedule(baseSchedule);

            } catch (error) {
                console.error("Erro ao carregar agenda:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadScheduleAndFinancial();

        // Função de limpeza (Cleanup)
        return () => {
            isMounted = false;
        };
    }, [selectedStudent]); // Removemos 'students' da dependência para evitar loop infinito se a lista atualizar


    const handleSave = async () => {
        if (!selectedStudent) return;
        setLoading(true);
        try {
            // 1. Garante que as datas estão em ordem cronológica
            const safeDates = Array.isArray(schedule?.dates) ? [...schedule.dates] : [];
            safeDates.sort((a, b) => a.date.localeCompare(b.date));

            // 2. REGRA: Marcos Zeros NÃO entram em pendências/cobrança
            const activeDates = safeDates.filter(d => d.type !== 'start');


            const pendingFeedbackDates = activeDates
                .filter((d) => d && d.date && d.type === "feedback" && d.status !== "done")
                .map((d) => d.date);

            const pendingTrainingDates = activeDates
                .filter((d) => d && d.date && d.type === "training" && d.status !== "done")
                .map((d) => d.date);

            await setDoc(
                doc(db, "feedback_schedules", selectedStudent.id),
                {
                    ...schedule,
                    dates: safeDates, // Salva todas para o histórico visual
                    studentName: selectedStudent.name,
                    pendingFeedbackDates, // Salva apenas as reais para cobrança
                    pendingTrainingDates,
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );

            alert("Cronograma salvo!\nO Start não gera cobrança e não aparece na Visão Geral.");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
        } finally {
            setLoading(false);
        }
    };


    const getFilteredList = () => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return allFeedbacks.filter(item => {
            const itemDate = item.dateObj;
            if (activeFilter === 'week') {
                const nextWeek = new Date(now);
                nextWeek.setDate(now.getDate() + 7);
                return itemDate >= now && itemDate <= nextWeek;
            }
            if (activeFilter === 'month') return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            return true;
        });
    };

    const toggleDate = (dateStr) => {
        const existingIndex = schedule.dates.findIndex(d => d.date === dateStr);
        let newDates = [...schedule.dates];

        if (existingIndex >= 0) {
            newDates.splice(existingIndex, 1);
        } else {
            newDates.push({ date: dateStr, type: 'feedback', status: 'pending' });
        }

        newDates.sort((a, b) => a.date.localeCompare(b.date));
        setSchedule({ ...schedule, dates: newDates });
    };

    const toggleType = (dateStr) => {
        setSchedule(prev => ({
            ...prev,
            dates: prev.dates.map(d => d.date === dateStr ? { ...d, type: d.type === 'feedback' ? 'training' : 'feedback' } : d)
        }));
    };

    const toggleStatus = (dateStr) => {
        setSchedule(prev => ({
            ...prev,
            dates: prev.dates.map(d => d.date === dateStr ? { ...d, status: d.status === 'pending' ? 'done' : 'pending' } : d)
        }));
    };

    const [marcoMenu, setMarcoMenu] = useState({ open: false, x: 0, y: 0, dateStr: '' });

    const handleSetStart = (e, dateStr) => {
        e.preventDefault();
        e.stopPropagation?.();
        setMarcoMenu({ open: true, x: e.clientX, y: e.clientY, dateStr });
    };

    const applyMarcoZero = (dateStr) => {
        if (!dateStr) return;
        setSchedule(prev => {
            const exists = Array.isArray(prev.dates) && prev.dates.some(d => d.date === dateStr);
            let newDates = prev.dates || [];
            
            if (!exists) {
                newDates = [...newDates, { date: dateStr, type: 'start', status: 'pending' }];
            } else {
                newDates = newDates.map(d => d.date === dateStr ? { ...d, type: 'start' } : d);
            }
            
            newDates.sort((a, b) => a.date.localeCompare(b.date));
            return { ...prev, dates: newDates };
        });
        setMarcoMenu({ open: false, x: 0, y: 0, dateStr: '' });
    };

    const clearMarcoZero = () => {
        setSchedule(prev => {
            const dateStr = marcoMenu.dateStr;
            const newDates = (prev.dates || []).map(d => (d.date === dateStr && d.type === 'start') ? { ...d, type: 'feedback' } : d);
            return { ...prev, dates: newDates };
        });
        setMarcoMenu({ open: false, x: 0, y: 0, dateStr: '' });
    };


    const processedList = useMemo(() => {
        const sorted = [...(schedule.dates || [])].sort((a, b) => a.date.localeCompare(b.date));
        const legacyMarcoZero = String(schedule?.cycleStartDate || "").slice(0, 10);

        return sorted.map((item, index) => {
            // COMPATIBILIDADE: Reconhece o formato novo OU o legado do banco de dados
            const isStartPoint = item.type === 'start' || (legacyMarcoZero && item.date === legacyMarcoZero);

            let diffWeeks = '-';
            let cycleDurationText = null;
            
            if (index > 0) {
                const current = new Date(item.date);
                const prev = new Date(sorted[index - 1].date);
                const diffTime = Math.abs(current - prev);
                diffWeeks = Math.floor(Math.ceil((diffTime / (1000 * 60 * 60 * 24) + 1)) / 7) + 's';
            }
            
            if (isStartPoint || item.type === 'training') {
                const nextMarker = sorted.slice(index + 1).find(d => d.type === 'training' || d.type === 'start' || d.date === legacyMarcoZero);
                if (nextMarker && nextMarker.type === 'training') {
                    const current = new Date(item.date);
                    const next = new Date(nextMarker.date);
                    const diffTime = Math.abs(next - current);
                    let weeks = Math.round(diffTime / (1000 * 60 * 60 * 24) / 7);
                    if (isStartPoint) weeks += 1;
                    cycleDurationText = `${weeks} semanas`;
                } else if (nextMarker && (nextMarker.type === 'start' || nextMarker.date === legacyMarcoZero)) {
                    cycleDurationText = "Até renovar";
                } else {
                    cycleDurationText = "Ciclo a definir";
                }
            }
            
            const dObj = new Date(item.date + 'T12:00:00');
            const dateFormatted = dObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

            return { ...item, dateFormatted, diffWeeks, cycleDurationText, isStartPoint };
        });
    }, [schedule.dates, schedule.cycleStartDate]);

    const historyDates = useMemo(() => {
        const arr = Array.isArray(schedule?.dates) ? [...schedule.dates] : [];
        const filtered = arr.filter(d => d.type !== 'start'); // Filtra todos os marcos zeros
        return filtered.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    }, [schedule?.dates]);

    // --- CÁLCULO DOS TOTAIS (Dashboardzinho e Rodapé) ---
    const summaryStats = useMemo(() => {
        const fullList = processedList || [];
        
        // Acha o índice do ÚLTIMO Start (usando a flag inteligente de compatibilidade)
        let startIdx = -1;
        for (let i = fullList.length - 1; i >= 0; i--) {
            if (fullList[i].isStartPoint) { startIdx = i; break; }
        }
        if (startIdx === -1) startIdx = 0;
        
        // Corta o array para olhar só do Start atual pra frente
        const currentDates = fullList.slice(startIdx);
        if (currentDates.length === 0) return { encontros: 0, trocas: 0, semanas: 0 };

        const encontros = currentDates.length; // O Start entra na contagem total
        const trocas = currentDates.filter(d => d.type === 'training').length;

        let semanas = 0;
        if (currentDates.length > 1) {
            const start = new Date(currentDates[0].date);
            const end = new Date(currentDates[currentDates.length - 1].date);
            const diffTime = Math.abs(end - start);
            semanas = Math.round(diffTime / (1000 * 60 * 60 * 24) / 7);
        }
        return { encontros, trocas, semanas };
    }, [processedList]);

    // --- LÓGICA DA AGENDA (TURBINADA) ---
    const [viewMode, setViewMode] = useState('general');
    const [timeFilter, setTimeFilter] = useState('week');
    const [tableSearch, setTableSearch] = useState('');
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [currentNote, setCurrentNote] = useState({ text: '', item: null });

    // --- CONFIGURAÇÃO GLOBAL DE PRAZOS ---
    const [showDeadlineConfig, setShowDeadlineConfig] = useState(false);
    const [deadlineSettings, setDeadlineSettings] = useState({ feedbackDays: 3, trainingDays: 4 });

    // Carregar configuração ao iniciar
    useEffect(() => {
        const loadDeadlines = async () => {
            try {
                const docRef = doc(db, "settings", "deadline_config");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setDeadlineSettings(docSnap.data());
                }
            } catch (error) { console.error("Erro config prazos:", error); }
        };
        loadDeadlines();
    }, []);

    const handleSaveDeadlineConfig = async () => {
        try {
            await setDoc(doc(db, "settings", "deadline_config"), deadlineSettings);
            setShowDeadlineConfig(false);
            alert("Regras de prazo atualizadas!");
        } catch (error) {
            alert("Erro ao salvar regras.");
        }
    };

    const studentsById = useMemo(() => {
        const m = {};
        (students || []).forEach(s => { m[s.id] = s; });
        return m;
    }, [students]);

    const toISO = (v) => {
        if (!v) return null;
        if (typeof v === "string") return v.slice(0, 10);
        if (v?.toDate) return v.toDate().toISOString().slice(0, 10);
        return null;
    };

    const monthsBetween = (startISO, endISO) => {
        if (!startISO || !endISO) return null;
        const s = new Date(startISO + "T12:00:00");
        const e = new Date(endISO + "T12:00:00");
        return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    };

    const fetchLatestFinancialVigency = async (studentId) => {
        if (!studentId) return null;

        // pega todos os lançamentos do aluno e escolhe o “mais atual”
        const q = query(collection(db, "payments"), where("studentId", "==", studentId));
        const snap = await getDocs(q);

        if (snap.empty) return null;

        const recs = [];
        snap.forEach(d => recs.push({ id: d.id, ...d.data() }));

        // escolhe o melhor pelo maior dueDate (igual a lógica do financeiro)
        recs.sort((a, b) => {
            const aDue = (toISO(a.dueDate) || "");
            const bDue = (toISO(b.dueDate) || "");
            if (bDue !== aDue) return bDue.localeCompare(aDue);

            const aPay = (toISO(a.payDate) || "");
            const bPay = (toISO(b.payDate) || "");
            return bPay.localeCompare(aPay);
        });

        const best = recs[0];

        const startISO = toISO(best.startDate);
        const dueISO = toISO(best.dueDate);

        // se não tem vencimento, não mexe (ex: pago e não iniciou ainda)
        if (!dueISO) return null;

        let duration = Number(best.durationMonths) || null;
        if (!duration && startISO) {
            const m = monthsBetween(startISO, dueISO);
            duration = (m && m > 0) ? m : null;
        }

        return {
            planStart: startISO || null,
            planEnd: dueISO,
            planDuration: duration || null
        };
    };

    const todayISO = () => new Date().toISOString().slice(0, 10);

    const isFinancialActive = (s) => {
        if (!s) return false;

        // se não existe controle financeiro, não bloqueia
        if (!s.finStatus && !s.finDueDate) return true;

        const st = String(s?.finStatus || "").trim().toLowerCase();
        const due = String(s?.finDueDate || "").slice(0, 10);

        if (st !== "ativo") return false;
        if (!due) return false;
        return due >= todayISO();
    };

    const formatBR = (iso) => {
        if (!iso) return "-";
        return new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR");
    };


    const getDeadline = (dateStr) => {
        const d = new Date(dateStr + 'T12:00:00');
        d.setDate(d.getDate() + 4);
        return d.toLocaleDateString('pt-BR');
    };

    const handleSaveNote = async () => {
        if (!currentNote.item) return;
        const item = currentNote.item;
        try {
            const docRef = doc(db, "feedback_schedules", item.studentId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const newDates = data.dates.map(d => d.date === item.date ? { ...d, note: currentNote.text } : d);
                const pendingFeedbackDates = newDates
                    .filter((d) => d && d.date && d.type === "feedback" && d.status !== "done")
                    .map((d) => d.date);

                const pendingTrainingDates = newDates
                    .filter((d) => d && d.date && d.type === "training" && d.status !== "done")
                    .map((d) => d.date);

                await setDoc(docRef, {
                    ...data,
                    dates: newDates,
                    pendingFeedbackDates,
                    pendingTrainingDates,
                    updatedAt: new Date().toISOString()
                });

                // Atualiza localmente
                const updateLocalList = (list) => list.map(f => (f.studentId === item.studentId && f.date === item.date) ? { ...f, note: currentNote.text } : f);
                setAllFeedbacks(prev => updateLocalList(prev));
                setGeneralDashboard(prev => ({ ...prev, late: updateLocalList(prev.late), today: updateLocalList(prev.today), upcoming: updateLocalList(prev.upcoming) }));
                setNoteModalOpen(false);
            }
        } catch (error) { console.error("Erro nota:", error); }
    };



    // --- CHECK / DESFAZER (SEM CONFIRMAÇÃO - INSTANTÂNEO) ---
    const toggleFeedbackStatus = async (item) => {
        const isUndo = item.status === 'done';

        // Feedback visual instantâneo
        showToast(isUndo ? "Status revertido para pendente." : "Feedback concluído com sucesso!", isUndo ? "info" : "success");

        // Sincroniza com o Frappe (se tiver ID do feedback)
        if (item.frappeFeedbackId) {
            try {
                const sincronizar = httpsCallable(firebaseFunctions, 'sincronizarStatusFrappe');
                await sincronizar({
                    frappeFeedbackId: item.frappeFeedbackId,
                    novoStatus: isUndo ? 'Respondido' : 'Finalizado'
                });
            } catch (err) {
                console.error("Erro ao sincronizar com Frappe:", err);
            }
        }

        try {
            // Atualiza visualmente ANTES de salvar no banco (Optimistic UI)
            const newStatus = isUndo ? 'pending' : 'done';
            setAllFeedbacks(prev => prev.map(f =>
                (f.studentId === item.studentId && f.date === item.date) ? { ...f, status: newStatus } : f
            ));

            // Salva no Banco em segundo plano
            const docRef = doc(db, "feedback_schedules", item.studentId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const newDates = data.dates.map(d =>
                    d.date === item.date ? { ...d, status: newStatus } : d
                );
                const pendingFeedbackDates = newDates
                    .filter((d) => d && d.date && d.type === "feedback" && d.status !== "done")
                    .map((d) => d.date);

                const pendingTrainingDates = newDates
                    .filter((d) => d && d.date && d.type === "training" && d.status !== "done")
                    .map((d) => d.date);

                await setDoc(docRef, {
                    ...data,
                    dates: newDates,
                    pendingFeedbackDates,
                    pendingTrainingDates,
                    updatedAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error("Erro status:", error);
            showToast("Erro ao salvar no banco.", "error");
        }
    };

    const getTableList = () => {
        let list = allFeedbacks.filter(item => item.studentName.toLowerCase().includes(tableSearch.toLowerCase()));
        const now = new Date(); now.setHours(0, 0, 0, 0);

        if (viewMode === 'completed') return list.filter(i => i.status === 'done').sort((a, b) => b.date.localeCompare(a.date));

        list = list.filter(i => i.status !== 'done');
        if (viewMode === 'late') return list.filter(i => i.dateObj < now).sort((a, b) => a.date.localeCompare(b.date));
        if (viewMode === 'planning') return list.filter(i => i.type === 'training').sort((a, b) => a.date.localeCompare(b.date));

        return list.sort((a, b) => a.date.localeCompare(b.date));
    };
    const copyToClipboard = (e) => {
        // Trava de segurança para garantir o contexto do clique do usuário
        if (e && e.preventDefault) e.preventDefault();
        
        try {
            const fullList = processedList || [];
            
            // Pega apenas do último Start em diante (Reconhece o legado e o novo)
            let startIdx = -1;
            for (let i = fullList.length - 1; i >= 0; i--) {
                if (fullList[i].isStartPoint) { startIdx = i; break; }
            }
            if (startIdx === -1) startIdx = 0;

            const currentCycleItems = fullList.slice(startIdx);

            if (currentCycleItems.length === 0) {
                alert("Não há datas para copiar neste ciclo.");
                return;
            }

            // Identifica o Start atual
            const startItem = currentCycleItems[0].isStartPoint ? currentCycleItems[0] : null;
            
            const startCycleText = startItem?.cycleDurationText && !String(startItem.cycleDurationText).includes('definir')
                ? startItem.cycleDurationText
                : "";

            // Remove o Start da lista visual das bolinhas
            const visibleItems = startItem ? currentCycleItems.slice(1) : currentCycleItems;

            const totalDefinedCycles =
                (startCycleText ? 1 : 0) +
                visibleItems.filter(i =>
                    i?.type === 'training' &&
                    i?.cycleDurationText &&
                    !String(i.cycleDurationText).includes('definir')
                ).length;

            let currentCycleCount = 0;
            let headerLine = "";

            // Se tem texto de duração no Start, monta o cabeçalho
            if (startCycleText) {
                currentCycleCount++;
                headerLine = `Ciclo ${currentCycleCount}/${totalDefinedCycles} — ${startCycleText}`;
            }

            const listLines = visibleItems.map((item) => {
                if (item.type === 'training') {
                    if (item.cycleDurationText && !String(item.cycleDurationText).includes('definir')) {
                        currentCycleCount++;
                        return `• ${item.dateFormatted} - Ciclo ${currentCycleCount}/${totalDefinedCycles} — ${item.cycleDurationText}`;
                    } else if (item.cycleDurationText) {
                        return `• ${item.dateFormatted} - ${item.cycleDurationText}`;
                    }
                }
                return `• ${item.dateFormatted}`;
            }).filter(Boolean);

            // Insere o Cabeçalho no topo da lista
            if (headerLine) {
                listLines.unshift(headerLine);
            }

            const listText = listLines.join('\n');

            let fimPlanoText = "INDEFINIDO";
            if (schedule.planEnd) {
                const d = new Date(schedule.planEnd + 'T12:00:00');
                const day = String(d.getDate()).padStart(2, '0');
                const month = MONTHS[d.getMonth()] ? MONTHS[d.getMonth()].toUpperCase() : "";
                const year = d.getFullYear();
                fimPlanoText = `${day}/${month}/${year}`;
            }

            let finalMsg = messageTemplate || "";
            const firstName = selectedStudent?.name ? selectedStudent.name.split(' ')[0].toUpperCase() : 'ALUNO';

            finalMsg = finalMsg.replace('{{NOME}}', firstName);
            finalMsg = finalMsg.replace('{{FIM_PLANO}}', fimPlanoText);
            finalMsg = finalMsg.replace('{{LISTA_DATAS}}', listText);

            // ==========================================
            // MÁGICA DE CÓPIA (SÍNCRONA E BLINDADA)
            // ==========================================
            let copiadoComSucesso = false;

            // Tentativa 1: O Método "Raiz" Síncrono (Mais seguro em mobiles/rede local)
            const textArea = document.createElement("textarea");
            textArea.value = finalMsg;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();
            textArea.setSelectionRange(0, 99999); // Necessário para iPhones
            
            try {
                copiadoComSucesso = document.execCommand('copy');
            } catch (err) {
                copiadoComSucesso = false;
            }
            document.body.removeChild(textArea);

            if (copiadoComSucesso) {
                showToast("Mensagem copiada para a área de transferência!", "success");
                return;
            }

            // Tentativa 2: API Moderna (Se a 1ª falhou mas estamos em ambiente HTTPS seguro)
            if (navigator.clipboard) {
                navigator.clipboard.writeText(finalMsg).then(() => {
                    showToast("Mensagem copiada para a área de transferência!", "success");
                }).catch((err) => {
                    console.error("Erro na API de Clipboard:", err);
                    alert("Seu navegador bloqueou a cópia. Pressione OK para continuar.");
                });
            } else {
                alert("O seu navegador não suporta cópia automática.");
            }

        } catch (error) {
            console.error("Erro crítico na formatação da mensagem:", error);
            alert("Ocorreu um erro interno ao preparar o texto. Recarregue a página e tente novamente.");
        }
    };


    const getHolidayName = (d, m) => {
        const k = `${String(d).padStart(2, '0')}-${String(m + 1).padStart(2, '0')}`;
        return HOLIDAYS_FIXED[k];
    };

    const isVacation = (dateStr) => {
        const target = new Date(dateStr);
        return vacationRanges.some(r => target >= new Date(r.start + 'T00:00:00') && target <= new Date(r.end + 'T23:59:59'));
    };
    // --- FUNÇÃO HISTÓRICO RÁPIDO (COM PROTEÇÃO) ---
    const handleOpenQuickHistory = async (studentId, studentName) => {
        if (!studentId) return;
        setLoading(true);
        try {
            const docRef = doc(db, "feedback_schedules", studentId);
            const docSnap = await getDoc(docRef);
            let dates = [];
            if (docSnap.exists()) {
                const data = docSnap.data();
                const marcoZero = String(data?.cycleStartDate || "").slice(0, 10);
                const raw = data.dates || [];
                dates = marcoZero ? raw.filter(d => String(d?.date || "") !== marcoZero) : raw;
            }
            // crescente (mais antigo -> mais novo)
            dates.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

            // ADICIONAMOS O ID AQUI PARA PODER EDITAR DEPOIS
            setQuickHistoryData({ studentId, studentName, dates });
        } catch (error) {
            console.error("Erro histórico:", error);
        } finally {
            setLoading(false);
        }
    };
    // --- SALVAR NOTA PELO HISTÓRICO ---
    const handleSaveHistoryNote = async (studentId, dateStr, newText) => {
        try {
            const docRef = doc(db, "feedback_schedules", studentId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                // Atualiza a nota na data específica
                const newDates = data.dates.map(d =>
                    d.date === dateStr ? { ...d, note: newText } : d
                );

                await setDoc(docRef, { ...data, dates: newDates }, { merge: true });

                // Atualiza o modal visualmente sem fechar
                setQuickHistoryData(prev => ({
                    ...prev,
                    dates: newDates.sort((a, b) => (a.date || "").localeCompare(b.date || ""))
                }));
            }
        } catch (error) {
            console.error("Erro ao salvar nota:", error);
            alert("Erro ao salvar nota.");
        }
    };
    const handleRenewCycle = () => {
        if (!selectedStudent) return;

        if (!window.confirm(
            `Renovar ciclo de ${selectedStudent.name}?\n\n` +
            `✅ O histórico completo será preservado.\n` +
            `🔄 A vigência do plano será zerada.\n` +
            `📌 Defina o novo Start com o botão direito no calendário.`
        )) return;

        setSchedule(prev => ({
            ...prev,
            planStart: '',
            planDuration: 3,
            planEnd: ''
        }));

        showToast("Ciclo renovado! Defina a nova vigência e o novo Start.", "success");
    };
    // --- FUNÇÃO DELETAR REGISTRO COMPLETO ---
    const handleDeleteSchedule = async () => {
        if (!selectedStudent) return;

        if (!window.confirm(`⚠️ PERIGO: TEM CERTEZA?\n\nIsso apagará TODO o histórico, datas e agendamentos de feedback do aluno: ${selectedStudent.name}.\n\nEssa ação não pode ser desfeita.`)) return;

        setLoading(true);
        try {
            // 1. Apaga do Banco de Dados (Firebase)
            await deleteDoc(doc(db, "feedback_schedules", selectedStudent.id));

            // 2. Limpa o estado local do Calendário (Zera a tela atual)
            setSchedule({ planStart: '', planDuration: 3, planEnd: '', cycleStartDate: '', dates: [] });

            // 3. Limpa da Visão Geral (Remove das tabelas e cards sem precisar recarregar)
            const removeById = (list) => list.filter(item => item.studentId !== selectedStudent.id);

            setAllFeedbacks(prev => removeById(prev));
            setGeneralDashboard(prev => ({
                late: removeById(prev.late),
                today: removeById(prev.today),
                upcoming: removeById(prev.upcoming)
            }));

            alert("Registro de feedbacks excluído com sucesso!");
        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir do banco de dados.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-ebony-bg min-h-screen p-4 md:p-8 animate-in fade-in relative overflow-x-hidden">
            {/* --- TOAST NOTIFICATION (PORTAL) --- */}
            {toast.show && createPortal(
                                <div className="fixed top-6 right-6 z-[99999] animate-in slide-in-from-right fade-in duration-300">
                                    <div className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${toast.type === 'success' ? 'bg-green-900/90 border-green-500/50 text-white' :
                                        toast.type === 'info' ? 'bg-blue-900/90 border-blue-500/50 text-white' :
                                            'bg-red-900/90 border-red-500/50 text-white'
                                        }`}>
                                        {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                                        {toast.type === 'info' && <RefreshCw className="w-5 h-5 text-blue-400" />}
                                        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                                        <span className="font-bold text-sm">{toast.msg}</span>
                                    </div>
                                </div>,
                                document.body
                            )}
            {/* --- MODAL DE MENSAGEM (COM EDITOR) --- */}
            {showTemplateModal && (
                <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
                    <div className="bg-ebony-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-ebony-border">
                        {/* Header */}
                        <div className="p-4 border-b border-ebony-border flex justify-between items-center bg-ebony-surface">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-ebony-muted" /> Modelo de Mensagem
                            </h3>
                            <button
                                onClick={() => setShowTemplateModal(false)}
                                className="text-ebony-muted hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 h-[600px] flex flex-col min-h-0 overflow-hidden relative">
                            {/* --- GERENCIADOR DE TEMPLATES --- */}
                            <div className="mb-3 bg-ebony-deep p-3 rounded-lg border border-ebony-border flex flex-col gap-2">
                                {/* Linha 1: Select e Input */}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select
                                        onChange={handleLoadTemplate}
                                        defaultValue=""
                                        className="flex-1 p-2 text-xs bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 font-bold"
                                    >
                                        <option value="" disabled>📂 Carregar modelo salvo...</option>
                                        {savedTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>

                                    <div className="flex gap-2 flex-1">
                                        <input
                                            type="text"
                                            placeholder="Nome para salvar novo..."
                                            className="flex-1 p-2 text-xs bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none"
                                            value={templateNameInput}
                                            onChange={e => setTemplateNameInput(e.target.value)}
                                        />
                                        <button
                                            onClick={handleSaveNewTemplate}
                                            className="p-2 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg transition flex items-center justify-center"
                                            title="Salvar Modelo"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Linha 2: Chips dos modelos salvos */}
                                {savedTemplates.length > 1 && (
                                    <div className="flex gap-2 overflow-x-auto pt-1 pb-1 scrollbar-hide">
                                        {savedTemplates.filter(t => t.id !== 'default').map(t => (
                                            <div
                                                key={t.id}
                                                className="flex items-center gap-1 bg-ebony-surface border border-ebony-border px-2 py-1 rounded-md text-[10px] whitespace-nowrap shadow-sm"
                                            >
                                                <span className="font-bold text-ebony-muted">{t.name}</span>
                                                <button
                                                    onClick={() => handleDeleteTemplate(t.id)}
                                                    className="text-ebony-muted hover:text-white"
                                                >
                                                    <Trash className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-ebony-muted bg-ebony-deep p-3 rounded-lg border border-ebony-border mb-4">
                                Use as variáveis: <strong className="text-white">{'{{NOME}}'}</strong>,{" "}
                                <strong className="text-white">{'{{FIM_PLANO}}'}</strong> e{" "}
                                <strong className="text-white">{'{{LISTA_DATAS}}'}</strong>.
                            </p>

                            {/* BARRA DE FERRAMENTAS */}
                            <div className="flex items-center gap-2 mb-2 bg-ebony-deep p-1.5 rounded-lg border border-ebony-border w-fit">
                                <button
                                    onClick={applyBold}
                                    className="p-1.5 text-ebony-muted hover:text-white hover:bg-ebony-surface rounded transition"
                                    title="Negrito (**texto**)"
                                >
                                    <Bold className="w-4 h-4" />
                                </button>
                                <div className="w-px h-4 bg-ebony-border mx-1"></div>
                                <button
                                    onClick={openLinkInput}
                                    className="p-1.5 text-ebony-muted hover:text-white hover:bg-ebony-surface rounded transition"
                                    title="Inserir Link"
                                >
                                    <LinkIcon className="w-4 h-4" />
                                </button>
                            </div>

                            {/* INPUT FLUTUANTE DE LINK */}
                            {showLinkInput && (
                                <div className="absolute top-44 left-6 z-10 bg-ebony-surface shadow-xl border border-ebony-border p-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 w-80">
                                    <LinkIcon className="w-4 h-4 text-ebony-muted" />
                                    <input
                                        type="text"
                                        className="flex-1 text-sm outline-none bg-transparent text-white placeholder-gray-600"
                                        placeholder="Cole a URL aqui..."
                                        value={linkUrl}
                                        onChange={e => setLinkUrl(e.target.value)}
                                        autoFocus
                                    />
                                    <button
                                        onClick={applyLink}
                                        className="p-1 bg-ebony-primary hover:bg-red-900 text-white rounded transition"
                                    >
                                        <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => setShowLinkInput(false)}
                                        className="p-1 text-ebony-muted hover:text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            {/* ÁREA DE TEXTO */}
                            <textarea
                                ref={textareaRef}
                                className="w-full flex-1 p-4 bg-ebony-deep border border-ebony-border rounded-lg text-sm font-mono text-white placeholder-gray-600 focus:ring-2 focus:ring-ebony-primary outline-none resize-none leading-relaxed"
                                value={messageTemplate}
                                onChange={(e) => setMessageTemplate(e.target.value)}
                            ></textarea>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-ebony-border flex justify-end bg-ebony-surface">
                            <button
                                onClick={() => { localStorage.setItem('ebony_msg_template', messageTemplate); setShowTemplateModal(false); }}
                                className="px-6 py-2 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg text-sm transition"
                            >
                                Salvar Alteração
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DE FÉRIAS --- */}
            {showVacationModal && (
                <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
                    <div className="bg-ebony-surface rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 border border-ebony-border">
                        <div className="p-4 border-b border-ebony-border flex justify-between items-center bg-ebony-surface">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Palmtree className="w-5 h-5 text-ebony-muted" /> Minhas Férias
                            </h3>
                            <button onClick={() => setShowVacationModal(false)} className="text-ebony-muted hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-ebony-muted uppercase">Início</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm"
                                        value={newVacationStart}
                                        onChange={e => setNewVacationStart(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-ebony-muted uppercase">Fim</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm"
                                        value={newVacationEnd}
                                        onChange={e => setNewVacationEnd(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleAddVacation}
                                className="w-full bg-ebony-primary hover:bg-red-900 text-white font-bold py-2 rounded-lg shadow-lg transition"
                            >
                                Adicionar Período
                            </button>

                            <div className="border-t border-ebony-border pt-2 mt-2">
                                <h4 className="text-xs font-bold text-ebony-muted mb-2">Períodos Cadastrados:</h4>
                                <ul className="space-y-2 max-h-40 overflow-y-auto">
                                    {vacationRanges.length === 0 && (
                                        <p className="text-xs text-ebony-muted italic">Nenhuma férias cadastrada.</p>
                                    )}

                                    {vacationRanges.map(v => (
                                        <li
                                            key={v.id}
                                            className="flex justify-between items-center bg-ebony-deep p-2 rounded-lg border border-ebony-border text-xs"
                                        >
                                            <span className="text-white font-bold">
                                                {new Date(v.start + 'T12:00:00').toLocaleDateString('pt-BR')} até{' '}
                                                {new Date(v.end + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </span>
                                            <button
                                                onClick={() => handleRemoveVacation(v.id)}
                                                className="text-ebony-muted hover:text-white"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            <div className="w-full space-y-6">

                {/* --- HEADER COM NAVEGAÇÃO (CENTRALIZADO) --- */}
                <div className="flex flex-col gap-6 mb-6">

                    {/* 1. TÍTULO E SUBTÍTULO (ALINHADO A ESQUERDA) */}
                    <div className="flex items-center gap-3 px-1">
                        <div className="p-2 bg-gradient-to-br from-ebony-deep to-transparent rounded-xl border border-ebony-border/50 shadow-sm">
                            <LayoutDashboard className="w-6 h-6 text-ebony-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Gestão de Ciclos</h1>
                            <p className="text-xs text-ebony-muted font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Planejamento e Retenção
                            </p>
                        </div>
                    </div>                    
                </div>

                {activeView === 'dashboard' && (
                    <div className="space-y-6 animate-in fade-in duration-300">

                        {/* --- CONTROLE DE VISUALIZAÇÃO (TOGGLE) --- */}
                        <div className="flex justify-end mb-2">
                            <div className="bg-ebony-deep p-1 rounded-lg border border-ebony-border flex shadow-sm">
                                <button
                                    onClick={() => setDashboardViewMode('list')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${dashboardViewMode === 'list'
                                        ? 'bg-ebony-surface text-white shadow-md border border-ebony-border/50'
                                        : 'text-ebony-muted hover:text-white'
                                        }`}
                                >
                                    <LayoutList className="w-4 h-4" /> Lista
                                </button>
                                <button
                                    onClick={() => setDashboardViewMode('kanban')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${dashboardViewMode === 'kanban'
                                        ? 'bg-ebony-surface text-white shadow-md border border-ebony-border/50'
                                        : 'text-ebony-muted hover:text-white'
                                        }`}
                                >
                                    <Kanban className="w-4 h-4" /> Resumo
                                </button>
                            </div>
                        </div>

                        {/* 1. VISÃO KANBAN (OPCIONAL) */}
                        {dashboardViewMode === 'kanban' && (
                            <div className="bg-ebony-surface p-6 rounded-xl border border-ebony-border shadow-lg animate-in slide-in-from-top-4">
                                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <ListChecks className="w-5 h-5 text-ebony-primary" /> Resumo da Semana
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {/* CARD: ALUNOS SEM CRONOGRAMA */}
                                    <div className="bg-ebony-deep rounded-xl p-4 border border-ebony-border flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-white font-bold text-xs uppercase mb-2 flex justify-between items-center">
                                                Sem Cronograma
                                                <span className="bg-ebony-surface text-ebony-text px-2 py-0.5 rounded-full text-[10px] border border-ebony-border">
                                                    {missingScheduleStudents.length}
                                                </span>
                                            </h3>
                                            <p className="text-[11px] text-ebony-muted leading-relaxed">
                                                Ativos no financeiro, mas sem datas definidas no cronograma.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowMissingScheduleModal(true)}
                                            className="mt-4 w-full px-3 py-2 bg-transparent border border-ebony-border text-ebony-muted font-bold rounded-lg hover:bg-ebony-surface hover:text-white transition-all duration-300 text-[11px] uppercase tracking-wider"
                                        >
                                            Ver lista
                                        </button>
                                    </div>

                                    {/* CARD ATRASADOS */}
                                    <div className="bg-ebony-deep rounded-xl p-4 border border-ebony-border">
                                        <h3 className="text-white font-bold text-xs uppercase mb-3 flex justify-between items-center">
                                            Atrasados
                                            <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full text-[10px]">
                                                {generalDashboard.late.length}
                                            </span>
                                        </h3>
                                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                            {generalDashboard.late.length === 0 ? <p className="text-[11px] text-ebony-muted italic opacity-50">Nada atrasado.</p> : generalDashboard.late.map((item, i) => (
                                                <div key={i} onClick={() => { setActiveView('calendar'); setSelectedStudent({ id: item.studentId, name: item.studentName }); }} className="relative group bg-ebony-surface p-3 rounded-lg border border-red-500/10 hover:border-red-500/40 cursor-pointer transition-all">
                                                    <div className="absolute left-0 top-0 h-full w-1 bg-red-500/50"></div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-white text-[11px] truncate">{item.studentName}</span>
                                                        <div className="text-[10px] text-red-400 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* CARD HOJE */}
                                    <div className="bg-ebony-deep rounded-xl p-4 border border-ebony-border">
                                        <h3 className="text-white font-bold text-xs uppercase mb-3 flex justify-between items-center">
                                            Para Hoje
                                            <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full text-[10px]">
                                                {generalDashboard.today.length}
                                            </span>
                                        </h3>
                                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                            {generalDashboard.today.length === 0 ? <p className="text-[11px] text-ebony-muted italic opacity-50">Tudo limpo.</p> : generalDashboard.today.map((item, i) => (
                                                <div key={i} onClick={() => { setActiveView('calendar'); setSelectedStudent({ id: item.studentId, name: item.studentName }); }} className="relative group bg-ebony-surface p-3 rounded-lg border border-yellow-500/10 hover:border-yellow-500/40 cursor-pointer transition-all">
                                                    <span className="font-bold text-white text-[11px]">{item.studentName}</span>
                                                    <div className="flex justify-between items-center mt-2">
                                                        <span className="text-[9px] text-yellow-400 font-black bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">HOJE</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* CARD PRÓXIMOS */}
                                    <div className="bg-ebony-deep rounded-xl p-4 border border-ebony-border">
                                        <h3 className="text-white font-bold text-xs uppercase mb-3 flex justify-between items-center">
                                            Próximos 7 Dias
                                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full text-[10px]">
                                                {generalDashboard.upcoming.length}
                                            </span>
                                        </h3>
                                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                            {generalDashboard.upcoming.length === 0 ? <p className="text-[11px] text-ebony-muted italic opacity-50">Sem demandas.</p> : generalDashboard.upcoming.map((item, i) => (
                                                <div key={i} onClick={() => { setActiveView('calendar'); setSelectedStudent({ id: item.studentId, name: item.studentName }); }} className="relative group bg-ebony-surface p-3 rounded-lg border border-ebony-border hover:border-blue-500/40 cursor-pointer transition-all">
                                                    <span className="font-bold text-white text-[11px]">{item.studentName}</span>
                                                    <div className="text-[10px] text-ebony-muted mt-1 font-medium">{new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- AGENDA COMPLETA --- */}
                        <div className="bg-ebony-surface p-6 rounded-xl shadow-sm border border-ebony-border mt-6 relative z-0">

                            {/* MODAL DE NOTAS (PREMIUM DESIGN) */}
                            {noteModalOpen && (
                                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                                    <div className="bg-ebony-surface shadow-2xl rounded-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 border border-ebony-border">
                                        <div className="bg-ebony-surface p-4 border-b border-ebony-border flex justify-between items-center">
                                            <h4 className="font-bold text-white flex items-center gap-2">
                                                <div className="bg-ebony-deep border border-ebony-border p-1.5 rounded-md">
                                                    <StickyNote className="w-4 h-4 text-ebony-muted" />
                                                </div>
                                                Notas do Aluno
                                            </h4>
                                            <button
                                                onClick={() => setNoteModalOpen(false)}
                                                className="text-ebony-muted hover:text-white transition p-1 hover:bg-ebony-deep rounded-full border border-ebony-border"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="p-6">
                                            <p className="text-xs text-ebony-muted mb-2 font-medium uppercase tracking-wide">
                                                Observações para {currentNote.item?.studentName}:
                                            </p>

                                            <textarea
                                                className="w-full h-40 p-4 bg-ebony-deep border border-ebony-border rounded-xl text-sm text-white focus:ring-2 focus:ring-ebony-primary focus:border-ebony-primary outline-none resize-none leading-relaxed shadow-inner placeholder-gray-600"
                                                placeholder="Digite aqui alguma observação importante sobre esse feedback..."
                                                value={currentNote.text}
                                                onChange={e => setCurrentNote({ ...currentNote, text: e.target.value })}
                                                autoFocus
                                            ></textarea>

                                            <div className="flex justify-end gap-3 mt-6">
                                                <button
                                                    onClick={() => setNoteModalOpen(false)}
                                                    className="px-5 py-2.5 bg-transparent border border-ebony-border text-ebony-muted text-sm font-bold hover:bg-ebony-deep hover:text-white rounded-xl transition"
                                                >
                                                    Cancelar
                                                </button>

                                                <button
                                                    onClick={handleSaveNote}
                                                    className="px-6 py-2.5 bg-ebony-primary hover:bg-red-900 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-xl transition transform active:scale-95"
                                                >
                                                    Salvar Nota
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}                            
                            {showMissingScheduleModal && createPortal(
                                <div className="fixed inset-0 bg-black/50 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm">
                                    <div className="bg-ebony-surface rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-ebony-border animate-in zoom-in-95 duration-200">
                                        <div className="p-4 border-b border-ebony-border flex items-center justify-between bg-ebony-surface">
                                            <h4 className="font-bold text-white">
                                                Alunos sem Cronograma ({missingScheduleStudents.length})
                                            </h4>
                                            <button
                                                onClick={() => setShowMissingScheduleModal(false)}
                                                className="text-ebony-muted hover:text-white"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="p-4">
                                            <div className="relative mb-3">
                                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-ebony-muted" />
                                                <input
                                                    value={missingSearch}
                                                    onChange={(e) => setMissingSearch(e.target.value)}
                                                    placeholder="Buscar aluno..."
                                                    className="w-full pl-9 p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm font-bold outline-none"
                                                />
                                            </div>

                                            <div className="max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
                                                {missingScheduleStudents
                                                    .filter(s => s.name.toLowerCase().includes(missingSearch.toLowerCase()))
                                                    .map((s) => (
                                                        <div
                                                            key={s.id}
                                                            className="p-3 border border-ebony-border rounded-xl flex items-center justify-between gap-3 bg-ebony-deep"
                                                        >
                                                            <div className="min-w-0">
                                                                <StudentNameWithBadge
                                                                    student={s}
                                                                    nameFallback={s.name}
                                                                    className="font-bold text-white"
                                                                    showText={false}
                                                                />
                                                                <div className="text-[11px] text-ebony-muted truncate">
                                                                    {s.finPlanName || s.planName || "Sem plano"}
                                                                </div>
                                                                <div className="text-[10px] text-ebony-muted">
                                                                    Vence: <span className="font-bold text-white">{formatBR(s.finDueDate)}</span> • {s.finStatus}
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={() => {
                                                                    setSelectedStudent({ id: s.id, name: s.name });
                                                                    setSearchQuery(s.name);
                                                                    setActiveView("calendar");
                                                                    setShowMissingScheduleModal(false);
                                                                }}
                                                                className="px-3 py-2 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg transition text-xs shrink-0 shadow-lg"
                                                            >
                                                                Criar cronograma
                                                            </button>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* CABEÇALHO DUPLO (ABAS + BOTÕES DE TEMPO) */}
                            {/* MODAL DE CONFIGURAÇÃO DE PRAZOS */}
                            {showDeadlineConfig && (
                                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
                                    <div className="bg-ebony-surface rounded-xl shadow-2xl p-6 w-full max-w-sm border border-ebony-border">
                                        <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                                            <RefreshCw className="w-5 h-5 text-ebony-muted" /> Regras de Prazo
                                        </h3>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">
                                                    Dias para Feedback Normal
                                                </label>
                                                <input
                                                    type="number"
                                                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 font-bold outline-none"
                                                    value={deadlineSettings.feedbackDays}
                                                    onChange={e => setDeadlineSettings({ ...deadlineSettings, feedbackDays: Number(e.target.value) })}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">
                                                    Dias para Troca de Treino
                                                </label>
                                                <input
                                                    type="number"
                                                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 font-bold outline-none"
                                                    value={deadlineSettings.trainingDays}
                                                    onChange={e => setDeadlineSettings({ ...deadlineSettings, trainingDays: Number(e.target.value) })}
                                                />
                                            </div>

                                            <button
                                                onClick={handleSaveDeadlineConfig}
                                                className="w-full py-3 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg transition"
                                            >
                                                Salvar Regras
                                            </button>

                                            <button
                                                onClick={() => setShowDeadlineConfig(false)}
                                                className="w-full py-2 bg-transparent border border-ebony-border text-ebony-muted text-xs font-bold hover:bg-ebony-deep hover:text-white rounded-lg transition"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CABEÇALHO DA TABELA + BOTÃO DE CONFIGURAÇÃO */}
                            <div className="flex flex-col gap-4 mb-4">
                                <div className="flex flex-col xl:flex-row justify-between items-end gap-4">

                                    {/* Lado Esquerdo: Busca e Título */}
                                    <div className="flex items-center gap-4 w-full xl:w-auto">
                                        <div className="relative flex-1 sm:w-64">
                                            <Search className="absolute left-2.5 top-2 w-4 h-4 text-ebony-muted" />
                                            <input
                                                type="text"
                                                placeholder="Buscar na lista..."
                                                className="w-full pl-9 p-1.5 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm outline-none transition-colors"
                                                value={tableSearch}
                                                onChange={e => setTableSearch(e.target.value)}
                                            />
                                        </div>

                                        {/* Botão de Engrenagem (Configuração) */}
                                        <button
                                            onClick={() => setShowDeadlineConfig(true)}
                                            className="p-2 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg transition shadow-sm"
                                            title="Configurar Regras de Prazo"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Lado Direito: Filtros Táticos Titanium */}
                                    <div className="flex flex-wrap gap-1.5 bg-ebony-deep p-1.5 rounded-xl w-full xl:w-auto border border-ebony-border shadow-inner">

                                        {/* 1. GERAL (Neutro) */}
                                        <button
                                            onClick={() => setViewMode('general')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 ${viewMode === 'general'
                                                ? 'bg-ebony-surface text-white shadow-md border border-ebony-border'
                                                : 'text-ebony-muted hover:text-white hover:bg-ebony-surface/50'
                                                }`}
                                        >
                                            Geral
                                        </button>

                                        {/* 2. RESPONDIDO (Azul - Webhook) */}
                                        <button
                                            onClick={() => setViewMode('received')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 flex items-center gap-1.5 ${viewMode === 'received'
                                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_10px_-3px_rgba(59,130,246,0.3)]'
                                                : 'text-ebony-muted hover:text-blue-300 hover:bg-blue-500/5'
                                                }`}
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" /> Respondido
                                        </button>

                                        {/* 3. ATRASADOS (Vermelho - Alerta) */}
                                        <button
                                            onClick={() => setViewMode('late')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 flex items-center gap-1.5 ${viewMode === 'late'
                                                ? 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_-3px_rgba(239,68,68,0.3)]'
                                                : 'text-ebony-muted hover:text-red-300 hover:bg-red-500/5'
                                                }`}
                                        >
                                            <AlertCircle className="w-3.5 h-3.5" /> Atrasados
                                        </button>
                                        {/* 3.5 NÃO ENVIADOS (Cinza - Fora da janela de 7 dias) */}
                                        <button
                                            onClick={() => setViewMode('notSent')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 ${viewMode === 'notSent'
                                                ? 'bg-gray-500/10 text-gray-300 border border-gray-500/20'
                                                : 'text-ebony-muted hover:text-gray-200 hover:bg-gray-500/5'
                                                }`}
                                        >
                                            Não enviado
                                        </button>

                                        {/* 4. PLANEJAMENTO (Roxo - Treino/Troca) */}
                                        <button
                                            onClick={() => setViewMode('planning')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 flex items-center gap-1.5 ${viewMode === 'planning'
                                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_10px_-3px_rgba(168,85,247,0.3)]'
                                                : 'text-ebony-muted hover:text-purple-300 hover:bg-purple-500/5'
                                                }`}
                                        >
                                            <Dumbbell className="w-3.5 h-3.5" /> Planejamento
                                        </button>

                                        {/* 5. CONCLUÍDOS (Verde - Sucesso) */}
                                        <button
                                            onClick={() => setViewMode('completed')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-300 flex items-center gap-1.5 ${viewMode === 'completed'
                                                ? 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_-3px_rgba(34,197,94,0.3)]'
                                                : 'text-ebony-muted hover:text-green-300 hover:bg-green-500/5'
                                                }`}
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Concluídos
                                        </button>

                                    </div>
                                </div>

                                {viewMode === 'general' && (
                                    <div className="flex justify-end gap-2 border-t border-ebony-border pt-2">
                                        <span className="text-xs font-bold text-ebony-muted flex items-center mr-1 uppercase">Período:</span>

                                        <button
                                            onClick={() => setTimeFilter('week')}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${timeFilter === 'week'
                                                ? 'bg-ebony-surface text-white border-ebony-border'
                                                : 'bg-transparent text-ebony-muted border-ebony-border hover:bg-ebony-surface hover:text-white'
                                                }`}
                                        >
                                            Semana
                                        </button>

                                        <button
                                            onClick={() => setTimeFilter('month')}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${timeFilter === 'month'
                                                ? 'bg-ebony-surface text-white border-ebony-border'
                                                : 'bg-transparent text-ebony-muted border-ebony-border hover:bg-ebony-surface hover:text-white'
                                                }`}
                                        >
                                            Mês
                                        </button>

                                        <button
                                            onClick={() => setTimeFilter('all')}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${timeFilter === 'all'
                                                ? 'bg-ebony-surface text-white border-ebony-border'
                                                : 'bg-transparent text-ebony-muted border-ebony-border hover:bg-ebony-surface hover:text-white'
                                                }`}
                                        >
                                            Todos
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* TABELA INTELIGENTE (NAVEGAÇÃO CORRIGIDA + FILTRO RESPONDIDO) */}
                            <div className="overflow-x-auto bg-ebony-surface rounded-xl border border-ebony-border shadow-lg">
                                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-sm text-left relative border-collapse">
                                        <thead className="bg-ebony-deep text-ebony-muted font-bold uppercase text-[10px] sticky top-0 z-10 shadow-md">
                                            <tr>
                                                {/* Diminuí de 40% para 35% para dar espaço */}
                                                <th className="p-3 pl-5 bg-ebony-deep w-[35%] tracking-wider">Aluno / Ação</th>

                                                {/* Diminuí de 20% para 15% */}
                                                <th className="p-3 text-center bg-ebony-deep w-[15%] tracking-wider">Data Prevista</th>

                                                {/* --- NOVA COLUNA AQUI --- */}
                                                <th className="p-3 text-center bg-ebony-deep w-[15%] tracking-wider">Data Enviada</th>

                                                {/* Diminuí de 20% para 15% */}
                                                <th className="p-3 text-center bg-ebony-deep w-[15%] tracking-wider">Status</th>

                                                <th className="p-3 text-right pr-5 bg-ebony-deep w-[20%] tracking-wider">Prazo (Auto)</th>
                                            </tr>

                                        </thead>

                                        <tbody className="divide-y divide-ebony-border/50 bg-ebony-surface">
                                            {(() => {
                                                // --- LÓGICA DE FILTROS (PRESERVADA) ---
                                                let list = allFeedbacks.filter(item => item.studentName.toLowerCase().includes(tableSearch.toLowerCase()));
                                                const now = new Date(); now.setHours(0, 0, 0, 0);

                                                if (tableSearch.trim().length > 0) {
                                                    // Busca ativa
                                                } else {
                                                    if (viewMode === 'completed') list = list.filter(i => i.status === 'done');
                                                    else if (viewMode === 'received') list = list.filter(i => i.received === true && i.status !== 'done');
                                                    else if (viewMode === 'late') list = list.filter(i => {
                                                        const diff = (i.dateObj - now) / (1000 * 60 * 60 * 24);
                                                        return i.status !== 'done' && !i.received && diff < 0 && diff >= -7;
                                                    });

                                                    else if (viewMode === 'notSent') list = list.filter(i => {
                                                        const diff = (i.dateObj - now) / (1000 * 60 * 60 * 24);
                                                        return i.status !== 'done' && !i.received && diff < -7;
                                                    });
                                                    else if (viewMode === 'planning') list = list.filter(i => i.type === 'training' && i.status !== 'done');
                                                    else {
                                                        list = list.filter(i => i.status !== 'done');
                                                        if (timeFilter === 'today') list = list.filter(i => i.dateObj.toDateString() === now.toDateString());
                                                        else if (timeFilter === 'week') { const next = new Date(now); next.setDate(now.getDate() + 7); list = list.filter(i => i.dateObj >= now && i.dateObj <= next); }
                                                        else if (timeFilter === 'month') list = list.filter(i => i.dateObj.getMonth() === now.getMonth() && i.dateObj.getFullYear() === now.getFullYear());
                                                    }
                                                }

                                                if (list.length === 0) return (<tr><td colSpan="4" className="p-10 text-center text-ebony-muted italic">Nenhum registro encontrado para este filtro.</td></tr>);

                                                const toMs = (v) => {
                                                    if (!v) return 0;
                                                    if (typeof v === "number") return v;
                                                    if (v?.toMillis) return v.toMillis(); // Firestore Timestamp
                                                    const d = new Date(v);               // ISO string
                                                    return isNaN(d.getTime()) ? 0 : d.getTime();
                                                  };
                                                  
                                                  const getReceivedMs = (it) => {
                                                    // usa o campo que tu já mostra na UI
                                                    return toMs(it.receivedAt || it.received_at || it.updatedAt || it.updated_at);
                                                  };
                                                  
                                                  // ---- ORDENAÇÃO FINAL ANTES DO MAP ----
                                                  if (viewMode === "received") {
                                                    // Respondido: data prevista mais recente primeiro
                                                    list.sort((a, b) => getReceivedMs(a) - getReceivedMs(b));
                                                  } else if (viewMode === "completed") {
                                                    // Concluídos: opcional (por data prevista desc)
                                                    list.sort((a, b) => b.date.localeCompare(a.date));
                                                  } else {
                                                    // Padrão do resto: por data prevista (crescente)
                                                    list.sort((a, b) => a.date.localeCompare(b.date));
                                                  }
                                                  
                                                  return list.slice(0, 50).map((item, idx) => {
                                                    // --- CÁLCULOS VISUAIS ---
                                                    const daysToAdd = item.type === 'training' ? deadlineSettings.trainingDays : deadlineSettings.feedbackDays;
                                                    const baseDate = new Date(item.date + 'T12:00:00');
                                                    baseDate.setDate(baseDate.getDate() + daysToAdd);
                                                    const finalDeadlineText = baseDate.toLocaleDateString('pt-BR');
                                                    const hasNote = !!item.note;
                                                    const isLate = item.dateObj < now && item.status !== 'done';
                                                    const diffDaysRow = (item.dateObj - now) / (1000 * 60 * 60 * 24);
                                                    const isNotSent = !item.received && item.status !== 'done' && diffDaysRow < -7;
                                                    const isToday = item.dateObj.toDateString() === now.toDateString() && item.status !== 'done';

                                                    return (
                                                        <tr
                                                            key={idx}
                                                            // AJUSTE: Removidos os backgrounds coloridos (bg-blue/5, bg-red/5). 
                                                            // Mantida apenas a border-l colorida e o hover padrão.
                                                            className={`group transition-all duration-200 border-l-[3px] hover:bg-ebony-border/20 ${item.status === 'done'
                                                                ? 'bg-ebony-deep/30 border-l-green-500/30 opacity-60 grayscale-[0.3] hover:grayscale-0 hover:opacity-100' // Concluído (levemente apagado)
                                                                : item.received
                                                                    ? 'border-l-blue-500' // Respondido (Apenas borda azul)
                                                                    : isLate
                                                                        ? 'border-l-red-500' // Atrasado (Apenas borda vermelha)
                                                                        : isToday
                                                                            ? 'border-l-yellow-500' // Hoje (Apenas borda amarela)
                                                                            : 'border-l-transparent'
                                                                }`}
                                                        >
                                                            {/* COLUNA 1: ALUNO + AÇÕES */}
                                                            <td className="p-3 pl-5 align-middle">
                                                                <div className="flex items-start gap-3">

                                                                    {/* 1. BOTÃO OLHO (AGORA NA ESQUERDA E DISCRETO) */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleOpenQuickHistory(item.studentId, item.studentName);
                                                                        }}
                                                                        className="mt-1 p-1.5 text-ebony-muted hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all"
                                                                        title="Ver Histórico Rápido"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                    </button>

                                                                    <div className="flex flex-col gap-1.5 flex-1">
                                                                        {/* Nome do Aluno */}
                                                                        <div
                                                                            className="font-bold text-white text-sm cursor-pointer hover:text-ebony-primary transition-colors flex items-center gap-2"
                                                                            onClick={() => {
                                                                                setSelectedStudent({ id: item.studentId, name: item.studentName });
                                                                                setActiveView('calendar');
                                                                            }}
                                                                        >
                                                                            {item.studentName}
                                                                            {isLate && <AlertCircle className="w-3 h-3 text-red-500" />}
                                                                        </div>

                                                                        {/* Botão de Nota (Mantido Original) */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setCurrentNote({ text: item.note || "", item });
                                                                                setNoteModalOpen(true);
                                                                            }}
                                                                            className={`flex items-center gap-1.5 text-[10px] font-bold transition-all w-fit px-2 py-0.5 rounded-md border ${hasNote
                                                                                ? "text-yellow-300 bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_8px_rgba(253,224,71,0.15)] hover:bg-yellow-500/20"
                                                                                : "text-ebony-muted border-transparent hover:text-white hover:bg-ebony-deep hover:border-ebony-border"
                                                                                }`}
                                                                        >
                                                                            <StickyNote className="w-3 h-3" /> {hasNote ? "Ler Nota" : "Adicionar nota"}
                                                                        </button>
                                                                    </div>

                                                                    {/* Botão Check (Lado Direito) */}
                                                                    <button
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            toggleFeedbackStatus(item);
                                                                        }}
                                                                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-md border flex-shrink-0 ${item.status === 'done'
                                                                            ? 'bg-green-600/20 text-green-400 border-green-500/50 hover:bg-red-500 hover:text-white hover:border-red-600'
                                                                            : 'bg-ebony-deep text-ebony-muted border-ebony-border hover:border-green-500 hover:text-white hover:bg-green-600'
                                                                            }`}
                                                                        title={item.status === 'done' ? "Desfazer" : "Concluir"}
                                                                    >
                                                                        {item.status === 'done' ? <Undo className="w-4 h-4" /> : <Check className="w-5 h-5" strokeWidth={3} />}
                                                                    </button>
                                                                </div>
                                                            </td>

                                                            {/* COLUNA 2: DATA & TIPO */}
                                                            <td className="p-3 text-center align-middle">
                                                                <div className="flex flex-col items-center gap-1.5">
                                                                    <span className={`text-xs font-bold flex items-center gap-1 ${isLate
                                                                        ? 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.4)] animate-pulse'
                                                                        : isToday
                                                                            ? 'text-yellow-200'
                                                                            : 'text-ebony-muted'
                                                                        }`}>
                                                                        {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                                    </span>

                                                                    {item.type === 'training' ? (
                                                                        <span className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-400 px-2.5 py-0.5 rounded-md text-[10px] font-bold border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.15)] uppercase tracking-wide">
                                                                            <Dumbbell className="w-3 h-3" /> Troca
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-400 px-2.5 py-0.5 rounded-md text-[10px] font-bold border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.1)] uppercase tracking-wide">
                                                                            Feedback
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            {/* --- NOVA CÉLULA: DATA ENVIADA --- */}
                                                            <td className="p-3 text-center align-middle">
                                                                {(item.receivedAt || (item.received && item.updatedAt)) ? (
                                                                    <div className="flex flex-col items-center justify-center gap-0.5 animate-in fade-in">
                                                                        {/* DATA (EM CIMA) */}
                                                                        <span className="font-bold text-white text-xs">
                                                                            {new Date(item.receivedAt || item.updatedAt).toLocaleDateString('pt-BR')}
                                                                        </span>

                                                                        {/* HORA (EM BAIXO - ESTILO TITANIUM) */}
                                                                        <span className="text-[9px] text-ebony-muted font-mono bg-ebony-deep px-1.5 rounded border border-ebony-border/50">
                                                                            {new Date(item.receivedAt || item.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                ) : item.received ? (
                                                                    // Fallback se tiver marcado como recebido mas sem data salva
                                                                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                                                        Recebido
                                                                    </span>
                                                                ) : (
                                                                    // Ainda não recebeu
                                                                    <span className="text-ebony-muted/30 text-[10px] font-mono">--/--</span>
                                                                )}
                                                            </td>

                                                            {/* COLUNA 3: STATUS */}
                                                            <td className="p-3 text-center align-middle">
                                                                {(() => {
                                                                    const now = new Date();
                                                                    now.setHours(0, 0, 0, 0);

                                                                    const diffDays = (item.dateObj - now) / (1000 * 60 * 60 * 24);
                                                                    const isLateWindow = diffDays < 0 && diffDays >= -7;
                                                                    const isNotSent = diffDays < -7;

                                                                    if (item.status === 'done') {
                                                                        return (
                                                                            <span className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-[0_0_10px_rgba(34,197,94,0.15)]">
                                                                                <CheckCircle2 className="w-3 h-3" /> Concluído
                                                                            </span>
                                                                        );
                                                                    }

                                                                    if (item.received) {
                                                                        return (
                                                                            <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(59,130,246,0.25)]">
                                                                                <MessageSquare className="w-3 h-3" /> Respondido
                                                                            </span>
                                                                        );
                                                                    }

                                                                    if (isNotSent) {
                                                                        return (
                                                                            <span className="inline-flex items-center px-4 py-1 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-300 text-[10px] font-bold uppercase tracking-wide">
                                                                                Não enviado
                                                                            </span>
                                                                        );
                                                                    }

                                                                    if (isLateWindow) {
                                                                        return (
                                                                            <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                                                                                <AlertCircle className="w-3 h-3" /> Atrasado
                                                                            </span>
                                                                        );
                                                                    }

                                                                    return (
                                                                        <span className="inline-flex items-center px-4 py-1 rounded-full bg-ebony-deep border border-ebony-border text-ebony-muted text-[10px] font-bold uppercase tracking-wide">
                                                                            Aguardando
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </td>


                                                            {/* COLUNA 4: PRAZO */}
                                                            <td className="p-3 text-right pr-5 align-middle">
                                                                <div className="flex justify-end items-center">
                                                                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${item.type === 'training'
                                                                        ? 'bg-purple-500/5 text-purple-300 border-purple-500/20'
                                                                        : 'bg-ebony-deep text-ebony-muted border-ebony-border'
                                                                        }`}>
                                                                        {finalDeadlineText}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {activeView === 'calendar' && (   // <--- ADICIONE ESTA LINHA
                    // === VISÃO 2: CALENDÁRIO...
                    <div className="animate-in slide-in-from-right duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                            {/* COLUNA ESQUERDA: BUSCA + CONFIGURAÇÕES */}
                            <div className="lg:col-span-4 space-y-4">

                                {/* 1. BUSCA DE ALUNO - TITANIUM DARK REFACTOR */}
                                <div className="bg-ebony-surface p-4 rounded-xl shadow-lg border border-ebony-border relative z-[100]">
                                    <label className="text-xs font-bold text-ebony-muted uppercase mb-2 block tracking-wider">
                                        Selecionar Aluno
                                    </label>

                                    <div className="relative group">
                                        {/* Ícone reativo: fica Vinho quando o input ganha foco */}
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ebony-muted group-focus-within:text-ebony-primary transition-colors duration-300" />

                                        <input
                                            type="text"
                                            placeholder="Buscar aluno..."
                                            className="w-full pl-10 p-2.5 bg-ebony-deep border border-ebony-border text-ebony-text rounded-lg shadow-inner focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary placeholder-gray-600 outline-none text-sm font-medium transition-all duration-300"
                                            value={searchQuery}
                                            onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                                            onFocus={() => setShowSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        />

                                        {showSuggestions && (
                                            <ul className="absolute left-0 right-0 top-full mt-2 bg-ebony-surface border border-ebony-border max-h-60 overflow-y-auto rounded-lg shadow-2xl z-[9999] custom-scrollbar">
                                                {students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).map(s => (
                                                    <li
                                                        key={s.id}
                                                        onClick={() => { setSelectedStudent(s); setSearchQuery(s.name); }}
                                                        className="p-3 text-sm text-ebony-text hover:bg-ebony-border/30 hover:pl-4 cursor-pointer border-b border-ebony-border/50 last:border-0 flex items-center gap-3 transition-all duration-200 group/item"
                                                    >
                                                        <User className="w-4 h-4 text-ebony-muted group-hover/item:text-ebony-text transition-colors" />

                                                        <StudentNameWithBadge
                                                            student={s}
                                                            nameFallback={s.name}
                                                            className="text-sm font-bold text-ebony-text"
                                                            showText={false}
                                                        />
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>

                                {selectedStudent && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

                                        {/* 1.1 DASHBOARDZINHO - TITANIUM CARDS */}
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: 'Encontros', value: summaryStats.encontros },
                                                { label: 'Trocas', value: summaryStats.trocas },
                                                { label: 'Semanas', value: summaryStats.semanas }
                                            ].map((stat, idx) => (
                                                <div key={idx} className="bg-ebony-surface p-4 rounded-xl border border-ebony-border flex flex-col items-center justify-center hover:border-ebony-primary/50 hover:shadow-[0_0_15px_-3px_rgba(133,0,0,0.15)] transition-all duration-300 group">
                                                    <span className="block text-3xl font-black text-ebony-text group-hover:text-white transition-colors">
                                                        {stat.value}
                                                    </span>
                                                    <span className="text-[10px] text-ebony-muted font-bold uppercase tracking-widest mt-1">
                                                        {stat.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* 2. VIGÊNCIA - INPUTS AFUNDADOS */}
                                        <div className="bg-ebony-surface p-5 rounded-xl shadow-lg border border-ebony-border relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-ebony-primary/50"></div>
                                            <h2 className="text-xs font-bold text-ebony-muted uppercase mb-4 flex items-center gap-2 tracking-wider">
                                                <Clock className="w-4 h-4 text-ebony-primary" /> Vigência do Plano
                                            </h2>

                                            <div className="grid grid-cols-12 gap-4 items-end">
                                                <div className="col-span-5">
                                                    <label className="text-[10px] font-bold text-ebony-muted block mb-1.5 ml-1">INÍCIO</label>
                                                    <input
                                                        type="date"
                                                        className="w-full p-2.5 bg-ebony-deep border border-ebony-border text-ebony-text rounded-lg shadow-inner focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary/50 placeholder-gray-600 text-xs font-bold outline-none transition-all"
                                                        value={schedule.planStart}
                                                        onChange={e => setSchedule({ ...schedule, planStart: e.target.value })}
                                                    />
                                                </div>

                                                <div className="col-span-2 text-center">
                                                    <label className="text-[10px] font-bold text-ebony-muted block mb-1.5">MESES</label>
                                                    <input
                                                        type="number"
                                                        className="w-full p-2.5 bg-ebony-deep border border-ebony-border text-ebony-text rounded-lg shadow-inner focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary/50 placeholder-gray-600 text-xs font-bold text-center outline-none transition-all"
                                                        value={schedule.planDuration}
                                                        onChange={e => setSchedule({ ...schedule, planDuration: e.target.value })}
                                                    />
                                                </div>

                                                <div className="col-span-5">
                                                    <label className="text-[10px] font-bold text-ebony-muted block mb-1.5 ml-1">FIM</label>
                                                    <input
                                                        type="date"
                                                        className="w-full p-2.5 bg-ebony-deep/50 border border-ebony-border text-ebony-muted rounded-lg shadow-none text-xs outline-none cursor-not-allowed"
                                                        value={schedule.planEnd}
                                                        readOnly
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 3. LISTA CRONOGRAMA */}
                                        <div className="bg-ebony-surface rounded-xl shadow-xl border border-ebony-border flex flex-col h-[500px] overflow-hidden">

                                            {/* CABEÇALHO COM AÇÕES */}
                                            <div className="p-5 border-b border-ebony-border bg-ebony-surface/95 backdrop-blur-sm z-10 flex flex-col gap-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-ebony-text text-lg">Cronograma</h3>
                                                        <p className="text-xs text-ebony-muted">Planejamento estratégico do aluno</p>
                                                    </div>
                                                </div>

                                                {/* Barra de Ferramentas */}
                                                <div className="flex flex-col gap-2 w-full">
                                                    {/* Linha 1: Ações principais */}
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={(e) => copyToClipboard(e)}
                                                            className="flex-1 px-4 py-2.5 bg-ebony-deep border border-ebony-border hover:bg-ebony-border text-ebony-muted hover:text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-xs group"
                                                        >
                                                            <Copy className="w-4 h-4 group-hover:text-ebony-text transition-colors" /> Copiar
                                                        </button>

                                                        <button
                                                            onClick={handleSave}
                                                            className="flex-1 px-4 py-2.5 bg-ebony-primary hover:bg-red-900 text-white rounded-lg font-bold shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2 text-xs hover:scale-[1.02]"
                                                        >
                                                            <Save className="w-4 h-4" /> Salvar Alterações
                                                        </button>
                                                    </div>

                                                    {/* Linha 2: Ferramentas secundárias */}
                                                    <div className="flex gap-1.5 bg-ebony-deep p-1.5 rounded-lg border border-ebony-border overflow-x-auto custom-scrollbar">
                                                        <button
                                                            onClick={() => setShowTemplateModal(true)}
                                                            className="flex-1 shrink-0 min-w-fit px-3 py-1.5 text-ebony-muted hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                                                            title="Templates"
                                                        >
                                                            <MessageSquare className="w-3.5 h-3.5" /> Template
                                                        </button>

                                                        <div className="w-px bg-ebony-border shrink-0"></div>

                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm("Deseja limpar todas as datas selecionadas? (O aluno e o plano mantêm-se)")) {
                                                                    setSchedule(prev => ({ ...prev, cycleStartDate: '', dates: [] }));
                                                                }
                                                            }}
                                                            className="flex-1 shrink-0 min-w-fit px-3 py-1.5 text-ebony-muted hover:text-orange-400 hover:bg-orange-500/10 rounded-md transition-all flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                                                            title="Limpar Datas"
                                                        >
                                                            <Trash className="w-3.5 h-3.5" /> Limpar
                                                        </button>

                                                        <div className="w-px bg-ebony-border shrink-0"></div>

                                                        <button
                                                            onClick={handleRenewCycle}
                                                            className="flex-1 shrink-0 min-w-fit px-3 py-1.5 text-ebony-muted hover:text-green-400 hover:bg-green-500/10 rounded-md transition-all flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                                                            title="Renovar Ciclo (Preserva Histórico)"
                                                        >
                                                            <RefreshCw className="w-3.5 h-3.5" /> Renovar
                                                        </button>

                                                        <div className="w-px bg-ebony-border shrink-0"></div>

                                                        <button
                                                            onClick={handleDeleteSchedule}
                                                            className="flex-1 shrink-0 min-w-fit px-3 py-1.5 text-ebony-muted hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                                                            title="Excluir Cronograma"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* TABELA REFINADA */}
                                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-ebony-surface">
                                                <table className="w-full text-xs text-left border-collapse">
                                                    <thead className="bg-ebony-deep text-ebony-muted font-bold sticky top-0 uppercase tracking-wider z-10 shadow-md">
                                                        <tr>
                                                            <th className="p-3 pl-5 bg-ebony-deep border-b border-ebony-border">Data</th>
                                                            <th className="p-3 text-center bg-ebony-deep border-b border-ebony-border">Tipo</th>
                                                            <th className="p-3 text-center bg-ebony-deep text-ebony-muted border-b border-ebony-border">Int.</th>
                                                            <th className="p-3 text-center bg-ebony-deep text-ebony-muted border-b border-ebony-border">Ciclo</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-ebony-border">
                                                        {processedList.map((item) => (
                                                            <tr
                                                                key={item.date}
                                                                className={`transition-colors ${item.isStartPoint
                                                                    ? 'bg-ebony-primary/10 border-l-4 border-l-ebony-primary'
                                                                    : 'hover:bg-ebony-border/30'
                                                                    } ${item.type === 'training' && !item.isStartPoint ? 'bg-ebony-deep/20' : ''}`}
                                                            >
                                                                {/* DATA */}
                                                                <td className="p-3 pl-4 font-bold text-white relative">
                                                                    {item.dateFormatted}
                                                                    {isVacation(item.date) && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-ebony-primary rounded-r"></span>}

                                                                    {/* BADGE DE INÍCIO */}
                                                                    {item.isStartPoint && (
                                                                        <span className="ml-2 text-[9px] font-black bg-ebony-primary text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                                            INÍCIO
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                {/* TIPO (Botão ou Ícone Fixo) */}
                                                                <td className="p-3 text-center">
                                                                    {item.isStartPoint ? (
                                                                        <div className="flex justify-center" title="Marco Zero">
                                                                            <ChevronsRight className="w-5 h-5 text-ebony-primary animate-pulse" />
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => toggleType(item.date)}
                                                                            className={`p-2 rounded-lg transition-all duration-300 border shadow-sm ${item.type === 'training'
                                                                                ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20 shadow-[0_0_10px_-3px_rgba(168,85,247,0.3)]'
                                                                                : 'bg-ebony-deep border-ebony-border text-ebony-muted hover:text-white hover:border-ebony-muted'
                                                                                }`}
                                                                        >
                                                                            {item.type === 'training' ? <Dumbbell className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                                                                        </button>
                                                                    )}
                                                                </td>

                                                                {/* INTERVALO */}
                                                                <td className="p-3 text-center text-ebony-muted font-medium">
                                                                    {item.diffWeeks !== '-' ? item.diffWeeks : ''}
                                                                </td>

                                                                {/* CICLO */}
                                                                <td className="p-2 text-center align-middle">
                                                                    {item.cycleDurationText && (
                                                                        <div className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border shadow-sm transition-all ${item.cycleDurationText.includes('definir')
                                                                            ? 'bg-purple-500/5 text-purple-300/70 border-purple-500/20 border-dashed'
                                                                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_-3px_rgba(168,85,247,0.4)]'
                                                                            }`}>
                                                                            {item.cycleDurationText}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* RODAPÉ TOTAL */}
                                            <div className="p-4 bg-ebony-deep/50 border-t border-ebony-border flex justify-between items-center backdrop-blur-sm">
                                                <span className="font-bold text-ebony-muted text-xs uppercase tracking-wider">Total Planejado</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-ebony-primary animate-pulse"></span>
                                                    <span className="font-black text-lg text-white">{summaryStats.semanas} semanas</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* COLUNA DIREITA: CALENDÁRIO & HISTÓRICO - TITANIUM DARK (CORRIGIDO) */}
                            <div className="lg:col-span-8 space-y-6">

                                {/* --- HISTÓRICO FIXO (EVITA PULO DE TELA) --- */}
                                <div className="bg-ebony-surface rounded-xl shadow-lg border border-ebony-border overflow-hidden h-[280px] flex flex-col transition-all group">

                                    {/* HEADER DO HISTÓRICO */}
                                    <div className="h-14 px-5 bg-ebony-surface border-b border-ebony-border flex justify-between items-center shrink-0 shadow-sm relative z-20">
                                        {/* Título da Seção */}
                                        <h3 className="font-bold text-white text-sm flex items-center gap-2 tracking-wide">
                                            <div className="p-1.5 bg-ebony-deep rounded-md border border-ebony-border">
                                                <ListChecks className="w-4 h-4 text-ebony-primary" />
                                            </div>
                                            <span className="text-ebony-text">Histórico & Feedback</span>
                                        </h3>

                                        {selectedStudent && (
                                            <div className="flex items-center gap-4">
                                                {/* Toggle View: Interruptor Tático */}
                                                <div className="bg-ebony-deep p-1 rounded-lg border border-ebony-border shadow-inner flex flex-col md:flex-row relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setHistoryView('table')}
                                                        className={`relative z-10 px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${historyView === 'table'
                                                            ? 'text-white shadow-[0_0_15px_rgba(133,0,0,0.4)]'
                                                            : 'text-ebony-muted hover:text-white'
                                                            }`}
                                                    >
                                                        Tabela
                                                        {historyView === 'table' && (
                                                            <span className="absolute inset-0 bg-ebony-primary rounded-md -z-10 animate-in fade-in zoom-in duration-200"></span>
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setHistoryView('timeline')}
                                                        className={`relative z-10 px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${historyView === 'timeline'
                                                            ? 'text-white shadow-[0_0_15px_rgba(133,0,0,0.4)]'
                                                            : 'text-ebony-muted hover:text-white'
                                                            }`}
                                                    >
                                                        Timeline
                                                        {historyView === 'timeline' && (
                                                            <span className="absolute inset-0 bg-ebony-primary rounded-md -z-10 animate-in fade-in zoom-in duration-200"></span>
                                                        )}
                                                    </button>
                                                </div>

                                                {/* Chip do Aluno */}
                                                <div className="hidden md:flex items-center bg-ebony-deep/50 border border-ebony-border rounded-full px-3 py-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                                                    <span className="text-xs text-ebony-text font-bold truncate max-w-[150px]">
                                                        {selectedStudent.name}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* CONTEÚDO (COM SCROLL INTERNO) */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-0 relative bg-ebony-surface">
                                        {selectedStudent ? (
                                            historyView === 'table' ? (
                                                // ===== VISUALIZAÇÃO A: TABELA =====
                                                <table className="w-full text-xs text-left border-collapse">
                                                    <thead className="bg-ebony-deep text-ebony-muted font-bold sticky top-0 uppercase text-[10px] z-10 shadow-md">
                                                        <tr>
                                                            <th className="p-3 pl-5 bg-ebony-deep border-b border-ebony-border">Data</th>
                                                            <th className="p-3 bg-ebony-deep border-b border-ebony-border">Tipo</th>
                                                            <th className="p-3 text-center bg-ebony-deep border-b border-ebony-border">Data Enviada</th>
                                                            <th className="p-3 text-center bg-ebony-deep border-b border-ebony-border">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-ebony-border/50">
                                                        {historyDates.map((histItem, idx) => (
                                                            <tr key={idx} className="hover:bg-ebony-border/20 transition-colors group">
                                                                <td className="p-3 pl-5 font-bold text-ebony-text">
                                                                    {new Date(histItem.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                                </td>

                                                                <td className="p-3">
                                                                    <div className="flex flex-col items-start gap-1">
                                                                        {histItem.type === 'training' ? (
                                                                            <span className="inline-flex items-center gap-1 text-purple-400 font-bold text-[10px] uppercase tracking-wide">
                                                                                <Dumbbell className="w-3 h-3" /> Troca
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-ebony-muted font-medium">Feedback</span>
                                                                        )}

                                                                        {!!String(histItem.note || "").trim() && (
                                                                            <div className="inline-flex items-center gap-1 text-[9px] font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded">
                                                                                <StickyNote className="w-2.5 h-2.5" /> Nota
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                <td className="p-3 text-center align-middle">
                                                                    {/* LÓGICA: Se tem Data de Recebimento (receivedAt) ou Atualização (updatedAt) */}
                                                                    {(histItem.receivedAt || (histItem.received && histItem.updatedAt)) ? (
                                                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                                                            {/* DATA (EM CIMA) */}
                                                                            <span className="font-bold text-white text-xs">
                                                                                {new Date(histItem.receivedAt || histItem.updatedAt).toLocaleDateString('pt-BR')}
                                                                            </span>

                                                                            {/* HORA (EM BAIXO - PRECISÃO) */}
                                                                            <span className="text-[10px] text-ebony-muted font-mono bg-ebony-deep px-1.5 rounded border border-ebony-border/50">
                                                                                {new Date(histItem.receivedAt || histItem.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                        </div>
                                                                    ) : histItem.received ? (
                                                                        // FALLBACK: Se está marcado como recebido mas não tem data salva no banco
                                                                        <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold">
                                                                            Recebido
                                                                        </span>
                                                                    ) : (
                                                                        // NÃO RECEBIDO AINDA
                                                                        <span className="text-ebony-muted/30 text-[10px] font-mono">--/--</span>
                                                                    )}
                                                                </td>

                                                                {/* --- COLUNA 4: STATUS (CORREÇÃO) --- */}
                                                                <td className="p-3 text-center align-middle">
                                                                    {(() => {
                                                                        const now = new Date();
                                                                        now.setHours(0, 0, 0, 0);

                                                                        const diffDays = (histItem.dateObj - now) / (1000 * 60 * 60 * 24);
                                                                        const isLateWindow = diffDays < 0 && diffDays >= -7;
                                                                        const isNotSent = diffDays < -7;

                                                                        if (histItem.status === 'done') {
                                                                            return (
                                                                                <span className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-[0_0_10px_rgba(34,197,94,0.15)]">
                                                                                    <CheckCircle2 className="w-3 h-3" /> Concluído
                                                                                </span>
                                                                            );
                                                                        }

                                                                        if (histItem.received) {
                                                                            return (
                                                                                <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(59,130,246,0.25)]">
                                                                                    <MessageSquare className="w-3 h-3" /> Respondido
                                                                                </span>
                                                                            );
                                                                        }

                                                                        if (isNotSent) {
                                                                            return (
                                                                                <span className="inline-flex items-center px-4 py-1 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-300 text-[10px] font-bold uppercase tracking-wide">
                                                                                    Não enviado
                                                                                </span>
                                                                            );
                                                                        }

                                                                        if (isLateWindow) {
                                                                            return (
                                                                                <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                                                                                    <AlertCircle className="w-3 h-3" /> Atrasado
                                                                                </span>
                                                                            );
                                                                        }

                                                                        return (
                                                                            <span className="inline-flex items-center px-4 py-1 rounded-full bg-ebony-deep border border-ebony-border text-ebony-muted text-[10px] font-bold uppercase tracking-wide">
                                                                                Aguardando
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </td>


                                                            </tr>
                                                        ))}

                                                        {historyDates.length === 0 && (
                                                            <tr>
                                                                <td colSpan="5" className="p-10 text-center text-ebony-muted italic">                                                                    Nenhum registro encontrado no histórico.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                // ===== VISUALIZAÇÃO B: TIMELINE (CORRIGIDA) =====
                                                <div className="p-6 space-y-0">
                                                    {historyDates.length === 0 ? (
                                                        <div className="p-10 text-center text-ebony-muted italic">
                                                            Nenhum histórico para exibir na timeline.
                                                        </div>
                                                    ) : (
                                                        historyDates.map((histItem, idx) => {
                                                            const dateBR = new Date(histItem.date + 'T12:00:00').toLocaleDateString('pt-BR');
                                                            const isTraining = histItem.type === 'training';
                                                            const isDone = histItem.status === 'done';
                                                            const hasNote = !!String(histItem.note || "").trim();
                                                            const daysToAdd = isTraining ? deadlineSettings.trainingDays : deadlineSettings.feedbackDays;
                                                            const baseDate = new Date(histItem.date + 'T12:00:00');
                                                            baseDate.setDate(baseDate.getDate() + daysToAdd);
                                                            const deadlineBR = baseDate.toLocaleDateString('pt-BR');

                                                            // Lógica de Cores Neon
                                                            let dotClass = "bg-ebony-border border-2 border-ebony-surface";
                                                            if (isDone) {
                                                                dotClass = "bg-green-500 shadow-[0_0_10px_#22c55e]";
                                                            } else if (isTraining) {
                                                                dotClass = "bg-purple-500 shadow-[0_0_10px_#a855f7]";
                                                            } else if (histItem.received) {
                                                                dotClass = "bg-blue-500 shadow-[0_0_10px_#3b82f6]";
                                                            }

                                                            return (
                                                                <div key={idx} className="relative pl-8 pb-8 last:pb-2 group/timeline">
                                                                    {/* Linha Conectora */}
                                                                    {idx < historyDates.length - 1 && (
                                                                        <div className="absolute left-[11px] top-4 bottom-0 w-0.5 bg-ebony-border/50 group-hover/timeline:bg-ebony-border transition-colors" />
                                                                    )}

                                                                    {/* Ponto (Dot) */}
                                                                    <div className={`absolute left-[7px] top-2 w-2.5 h-2.5 rounded-full z-10 transition-all duration-300 ${dotClass}`} />

                                                                    {/* Card da Timeline */}
                                                                    <div className={`rounded-xl border p-4 transition-all duration-300 relative ${isDone
                                                                        ? 'bg-ebony-deep/40 border-ebony-border/50 opacity-70 grayscale-[0.3] hover:grayscale-0 hover:opacity-100'
                                                                        : 'bg-ebony-deep border-ebony-border hover:border-ebony-primary/30 hover:shadow-[0_0_15px_-5px_rgba(133,0,0,0.2)]'
                                                                        }`}>

                                                                        <div className="flex flex-col gap-3">
                                                                            {/* HEADER */}
                                                                            <div className="flex justify-between items-start border-b border-ebony-border/50 pb-2">
                                                                                <span className="text-xs font-black text-white flex items-center gap-2">
                                                                                    {dateBR}
                                                                                </span>
                                                                                <div className="text-[10px] font-bold text-ebony-muted">
                                                                                    Prazo: <span className="text-ebony-text">{deadlineBR}</span>
                                                                                </div>
                                                                            </div>

                                                                            {/* TAGS NEON (BADGE DE NOTA RESTAURADO) */}
                                                                            <div className="flex flex-wrap gap-2 items-center">
                                                                                {/* Tipo */}
                                                                                {isTraining ? (
                                                                                    <span className="inline-flex items-center gap-1.5 bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-md text-[10px] font-bold border border-purple-500/20 shadow-[0_0_8px_-2px_rgba(168,85,247,0.3)]">
                                                                                        <Dumbbell className="w-3 h-3" /> TREINO
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="inline-flex items-center gap-1.5 bg-ebony-surface text-ebony-muted px-2.5 py-1 rounded-md text-[10px] font-bold border border-ebony-border">
                                                                                        FEEDBACK
                                                                                    </span>
                                                                                )}

                                                                                {/* Webhook */}
                                                                                {histItem.received ? (
                                                                                    <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-500/20">
                                                                                        RESPONDIDO
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-ebony-muted/60 text-[10px] italic pr-2 border-r border-ebony-border/30">
                                                                                        Pendente
                                                                                    </span>
                                                                                )}

                                                                                {/* Status Análise */}
                                                                                {isDone ? (
                                                                                    <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-400 px-2 py-0.5 rounded text-[10px] font-bold border border-green-500/20 shadow-[0_0_8px_-2px_rgba(34,197,94,0.3)]">
                                                                                        <CheckCircle2 className="w-3 h-3" /> CONCLUÍDO
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="inline-flex items-center gap-1 text-ebony-muted text-[10px]">
                                                                                        Aguardando
                                                                                    </span>
                                                                                )}

                                                                                {/* [RESTAURADO] Badge de Nota Interna */}
                                                                                {hasNote && (
                                                                                    <span className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-300 px-2 py-0.5 rounded text-[9px] font-bold border border-yellow-500/20 shadow-[0_0_5px_rgba(253,224,71,0.15)] animate-in fade-in">
                                                                                        <StickyNote className="w-3 h-3" /> Nota Interna
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* NOTA INTERNA (CONTEÚDO) */}
                                                                        {hasNote && (
                                                                            <div className="mt-3 relative group/note">
                                                                                <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-3 hover:bg-yellow-500/10 transition-colors">
                                                                                    <div className="flex items-start gap-2">
                                                                                        <StickyNote className="w-3 h-3 text-yellow-500/50 mt-0.5 shrink-0" />
                                                                                        <div className="text-[10px] text-yellow-100/80 leading-relaxed font-medium">
                                                                                            {histItem.note}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )
                                        ) : (
                                            // EMPTY STATE
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-ebony-muted gap-3 opacity-50">
                                                <div className="p-4 rounded-full bg-ebony-deep border border-ebony-border">
                                                    <User className="w-8 h-8" />
                                                </div>
                                                <p className="text-xs font-medium text-center leading-relaxed">
                                                    Selecione um aluno<br />para ver o dossiê completo.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* GRID DE MESES - PAINEL TÁTICO */}
                                {/* GRID DE MESES - PAINEL TÁTICO */}
                                <div className="bg-ebony-surface p-5 rounded-xl shadow-xl border border-ebony-border flex flex-col gap-4">

                                    {/* --- NOVO HEADER COMPACTO INTEGRADO --- */}
                                    <div className="flex justify-between items-center border-b border-ebony-border/50 pb-2">
                                        <div className="flex items-center gap-2 text-ebony-muted text-xs font-bold uppercase tracking-wider">
                                            <Calendar className="w-4 h-4 text-ebony-primary" />
                                            Visão Geral
                                        </div>

                                        {/* Pílula de Navegação */}
                                        <div className="flex items-center bg-ebony-deep rounded-lg border border-ebony-border p-0.5">
                                            <button
                                                onClick={() => setYear(year - 1)}
                                                className="p-1 hover:text-white text-ebony-muted transition-colors"
                                            >
                                                <ChevronsLeft className="w-4 h-4" />
                                            </button>

                                            <span className="px-3 text-sm font-black text-white font-mono select-none">
                                                {year}
                                            </span>

                                            <button
                                                onClick={() => setYear(year + 1)}
                                                className="p-1 hover:text-white text-ebony-muted transition-colors"
                                            >
                                                <ChevronsRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {MONTHS.map((monthName, monthIndex) => {
                                            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
                                            const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
                                            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                                            const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
                                            const holidaysInMonth = days.filter(d => getHolidayName(d, monthIndex));

                                            return (
                                                <div
                                                    key={monthName}
                                                    className="border border-ebony-border/50 rounded-xl p-3 hover:bg-ebony-deep/30 transition-colors flex flex-col h-full select-none bg-ebony-deep/10"
                                                >
                                                    {/* Mês Header */}
                                                    <div className="flex justify-between items-center mb-3 border-b border-ebony-border/50 pb-2">
                                                        <h4 className="font-bold text-white text-sm tracking-wide">
                                                            {monthName}
                                                        </h4>
                                                        {holidaysInMonth.length > 0 && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-ebony-primary shadow-[0_0_5px_rgba(133,0,0,0.8)]"></span>
                                                        )}
                                                    </div>

                                                    {/* Dias da Semana */}
                                                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                                        {WEEKDAYS.map((d, i) => (
                                                            <span key={i} className="text-[9px] font-bold text-ebony-muted uppercase opacity-70">
                                                                {d}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {/* Grid de Dias */}
                                                    <div className="grid grid-cols-7 gap-1 text-xs content-start flex-1">
                                                        {blanks.map(b => <div key={`blank-${b}`} />)}

                                                        {days.map(d => {
                                                            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                            const isMonday = new Date(year, monthIndex, d).getDay() === 1;

                                                            const scheduledItem = schedule.dates.find(item => item.date === dateStr);
                                                            const isSelected = !!scheduledItem;
                                                            const isTraining = scheduledItem?.type === 'training';
                                                            const isDone = scheduledItem?.status === 'done';
                                                            const isVac = isVacation(dateStr);
                                                            const inPlan = schedule.planStart && schedule.planEnd && dateStr >= schedule.planStart && dateStr <= schedule.planEnd;
                                                            const holiday = getHolidayName(d, monthIndex);

                                                            // LÓGICA VISUAL REFINADA (Hierarquia: Seleção > Férias > Segunda > Vigência > Padrão)
                                                            let containerClasses = "bg-ebony-surface text-ebony-text/60 border-transparent hover:border-ebony-border hover:text-white";

                                                            if (isSelected) {
                                                                const isMarcoZero = scheduledItem?.type === 'start';

                                                                // Concluído manda em tudo (não fica roxo/vermelho)
                                                                if (isDone) {
                                                                    containerClasses = "bg-ebony-deep text-ebony-muted border border-ebony-border line-through opacity-70";
                                                                } else if (isMarcoZero) {
                                                                    containerClasses = "bg-ebony-deep text-white font-black border border-ebony-border ring-2 ring-ebony-primary/40";
                                                                } else if (isTraining) {
                                                                    containerClasses = "bg-purple-500/20 text-white font-black border border-purple-500/30 ring-2 ring-purple-500/20";
                                                                } else {
                                                                    containerClasses = "bg-ebony-primary text-white font-black shadow-[0_0_10px_rgba(133,0,0,0.35)] scale-110 z-20 border-transparent ring-2 ring-white/20";
                                                                }

                                                            } else if (isVac) {

                                                                // 2. FÉRIAS
                                                                containerClasses = "bg-ebony-deep text-white font-bold border border-ebony-primary/50 shadow-inner opacity-60";

                                                            } else if (isMonday) {
                                                                // 3. SEGUNDA-FEIRA (O Destaque Solicitado)
                                                                if (inPlan) {
                                                                    // -> Segunda DENTRO da vigência: Verde "Sumo" (Lime) Vibrante
                                                                    containerClasses = "bg-emerald-900/30 text-emerald-100/80 font-bold border border-emerald-500/20";
                                                                } else {
                                                                    // -> Segunda FORA da vigência: Cinza Médio (Guia visual)
                                                                    containerClasses = "bg-gray-700/40 text-white font-bold border border-gray-600/30";
                                                                }

                                                            } else if (inPlan) {
                                                                // 4. VIGÊNCIA DO PLANO (Dias comuns)
                                                                containerClasses = "bg-green-900/20 text-green-100/70 border border-green-500/10 hover:bg-green-900/30";
                                                            }

                                                            if (holiday && !isSelected) {
                                                                containerClasses += " border-b-2 border-b-ebony-muted text-yellow-100 italic";
                                                            }

                                                            return (
                                                                <div
                                                                    key={d}
                                                                    onClick={() => toggleDate(dateStr)}
                                                                    onContextMenu={(e) => handleSetStart(e, dateStr)}
                                                                    title={holiday || (isMonday ? 'Dia de Feedback' : 'Botão Direito: Definir Início')}
                                                                    // AQUI ESTAVA O ERRO: Agora usamos containerClasses corretamente
                                                                    className={`aspect-square flex items-center justify-center rounded-md cursor-pointer transition-all duration-200 relative ${containerClasses} text-xs`}
                                                                >
                                                                    {d}
                                                                    {/* Indicador de Feriado */}
                                                                    {holiday && !isSelected && <span className="absolute top-0 right-0.5 text-[6px] text-orange-400 font-bold">•</span>}

                                                                    {/* Indicador Visual de INÍCIO (Marco Zero) */}
                                                                    {schedule.cycleStartDate === dateStr && (
                                                                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[6px] px-1 rounded uppercase font-bold tracking-tighter z-20 shadow-sm">
                                                                            INÍCIO
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Lista de Feriados no Rodapé */}
                                                    {holidaysInMonth.length > 0 && (
                                                        <div className="mt-auto pt-2 border-t border-ebony-border/50 space-y-1">
                                                            {holidaysInMonth.map(d => (
                                                                <div key={d} className="flex items-center gap-2 text-[9px] text-ebony-muted hover:text-white transition-colors">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-ebony-primary flex-shrink-0"></span>
                                                                    <span className="font-bold text-white">{d}:</span>
                                                                    <span className="truncate" title={getHolidayName(d, monthIndex)}>
                                                                        {getHolidayName(d, monthIndex)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODAL DE HISTÓRICO RÁPIDO (COM EDIÇÃO DE NOTA) --- */}
                {marcoMenu.open && createPortal(
                    <div
                        className="fixed inset-0 z-[99999]"
                        onMouseDown={() => setMarcoMenu({ open: false, x: 0, y: 0, dateStr: '' })}
                    >
                        <div
                            className="absolute bg-ebony-surface border border-ebony-border rounded-lg shadow-2xl p-2 w-56"
                            style={{ left: marcoMenu.x, top: marcoMenu.y }}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div className="text-[10px] text-ebony-muted font-bold uppercase mb-2">
                                Start do Ciclo
                            </div>

                            <button
                                type="button"
                                onClick={() => applyMarcoZero(marcoMenu.dateStr)}
                                className="w-full text-left px-3 py-2 rounded-md text-xs font-bold text-white hover:bg-ebony-deep border border-transparent hover:border-ebony-border transition"
                            >
                                Definir como Start
                            </button>

                            <button
                                type="button"
                                onClick={clearMarcoZero}
                                className="w-full text-left px-3 py-2 rounded-md text-xs font-bold text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition mt-1"
                            >
                                Remover Start
                            </button>

                            <button
                                type="button"
                                onClick={() => setMarcoMenu({ open: false, x: 0, y: 0, dateStr: '' })}
                                className="w-full text-left px-3 py-2 rounded-md text-xs font-bold text-ebony-muted hover:text-white hover:bg-ebony-deep border border-transparent hover:border-ebony-border transition mt-1"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
                {quickHistoryData && (
                    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-ebony-surface rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-ebony-border flex flex-col max-h-[80vh]">
                            <div className="p-4 border-b border-ebony-border bg-ebony-surface flex justify-between items-center">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <div className="p-1.5 bg-ebony-deep rounded-md border border-ebony-border">
                                        <ListChecks className="w-4 h-4 text-blue-400" />
                                    </div>
                                    Histórico: {quickHistoryData.studentName}
                                </h3>
                                <button onClick={() => setQuickHistoryData(null)} className="text-ebony-muted hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-0 overflow-y-auto custom-scrollbar flex-1 bg-ebony-deep/30">
                                {quickHistoryData.dates.length === 0 ? (
                                    <div className="p-8 text-center text-ebony-muted text-sm">Sem histórico registrado.</div>
                                ) : (
                                    <div className="relative pl-8 pt-6 pb-6">
                                        {quickHistoryData.dates.map((item, idx) => {
                                            const isDone = item.status === 'done';
                                            return (
                                                <div key={idx} className="relative pl-6 pb-6 last:pb-0 border-l border-ebony-border/50 ml-2">
                                                    <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-ebony-surface ${isDone ? 'bg-green-500' : 'bg-ebony-border'}`}></div>
                                                    <div className="bg-ebony-surface border border-ebony-border rounded-lg p-3 shadow-sm mr-4 hover:border-ebony-primary/30 transition-colors">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className="font-bold text-white text-xs flex items-center gap-2">
                                                                {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}

                                                                {item.status === 'done' ? (
                                                                    <span className="text-[9px] bg-green-500/10 text-green-400 px-1.5 rounded border border-green-500/20">
                                                                        Concluído
                                                                    </span>
                                                                ) : item.received ? (
                                                                    <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 rounded border border-blue-500/20">
                                                                        Respondido
                                                                    </span>
                                                                ) : (() => {
                                                                    const now = new Date(); now.setHours(0, 0, 0, 0);
                                                                    const d = new Date(item.date + 'T12:00:00'); d.setHours(0, 0, 0, 0);
                                                                    const isLate = d < now;
                                                                    return isLate ? (
                                                                        <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 rounded border border-red-500/20">
                                                                            Atrasado
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[9px] bg-ebony-deep text-ebony-muted px-1.5 rounded border border-ebony-border/50">
                                                                            Aguardando
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </span>

                                                            {item.type === 'training' && (
                                                                <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                                                    TROCA
                                                                </span>
                                                            )}
                                                        </div>


                                                        {/* ÁREA DE NOTA EDITÁVEL */}
                                                        <textarea
                                                            className="w-full bg-ebony-deep/50 text-white text-[11px] p-2 rounded border border-ebony-border/50 focus:border-yellow-500/50 focus:bg-ebony-deep outline-none resize-none placeholder-gray-600 transition-all"
                                                            rows={2}
                                                            placeholder="Adicionar nota..."
                                                            defaultValue={item.note || ""}
                                                            onBlur={(e) => {
                                                                // Salva apenas se mudou
                                                                if (e.target.value !== (item.note || "")) {
                                                                    handleSaveHistoryNote(quickHistoryData.studentId, item.date, e.target.value);
                                                                }
                                                            }}
                                                        ></textarea>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default FeedbackModule;
