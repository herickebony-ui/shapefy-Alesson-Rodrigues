import React, { useState, useEffect } from 'react';
import {
    X, Calendar, User, AlignLeft, MessageSquare,
    Send, CheckCircle2, Clock, ChevronDown, ChevronRight, Paperclip,
    Tag, FileText, Trash2, Download, Loader,
    Search, Link as LinkIcon, Plus,
    Image as ImageIcon
} from 'lucide-react';
import {
    doc, deleteDoc, updateDoc, arrayUnion, arrayRemove,
    onSnapshot, collection, addDoc, setDoc, getDoc
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, auth } from '../firebase';
import NotionEditor from './NotionEditor';
import StudentNameWithBadge from './StudentNameWithBadge';
import { scheduleWhatsAppNotification, scheduleCommentNotification } from '../utils/notificationScheduler';
// Adicione junto com os outros imports
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ptBR from 'date-fns/locale/pt-BR'; // Para ficar em português
registerLocale('pt-BR', ptBR); // Registra o idioma

// Função de Cores (Certifique-se de que ela está acessível ou copie ela antes dos componentes)
function getTagColor(tag) {
    if (!tag || typeof tag !== 'string') return 'bg-[#2a2a2a] text-gray-400 border-[#323238]';
    const t = tag.toLowerCase();

    if (t.includes('plano premium') || t === 'feedback' || t.includes('dieta e treino') || t.includes('devolutiva') || t.includes('preencher datas') || t.includes('suplementos') || t.includes('manipulados'))
        return 'bg-purple-900/40 text-purple-300 border-purple-700/50';

    if (t.includes('montar treino') || t.includes('treino') || t.includes('protocolo') || t.includes('exames') || t.includes('ajuste') || t.includes('atualizar datas') || t.includes('trocar'))
        return 'bg-green-900/40 text-green-300 border-green-700/50';

    if (t === 'montar dieta' || t.includes('dieta') || t.includes('whatsapp') || t.includes('mensagem') || t.includes('foto') || t.includes('responde'))
        return 'bg-blue-900/40 text-blue-300 border-blue-700/50';

    if (t.includes('cobrar') || t.includes('retorno') || t.includes('ausente') || t.includes('aguardando') || t.includes('avaliar') || t.includes('dúvida') || t.includes('duvida') || t.includes('sumida') || t.includes('dor') || t.includes('renovação') || t.includes('prontuário') || t.includes('shapefy') || t.includes('execução'))
        return 'bg-orange-900/40 text-orange-300 border-orange-700/50';

    return 'bg-[#2a2a2a] text-gray-400 border-[#323238]';
}

// --- FUNÇÃO DE CORES (DARK PREMIUM - igual TasksModule) ---
const STAGE_OPTIONS = [
    { id: "col_backlog", title: "Prioridade" },
    { id: "col_semana", title: "Essa Semana" },
    { id: "col_execucao", title: "Em Execução" },
    { id: "col_novos_alunos", title: "Novos Alunos" },
    { id: "col_automatizadas", title: "Automatizadas" },
    { id: "col_concluido", title: "Concluído" },
];

const STAGE_BY_COLUMN = Object.fromEntries(STAGE_OPTIONS.map(o => [o.id, o.title]));
const COLUMN_BY_STAGE = Object.fromEntries(STAGE_OPTIONS.map(o => [o.title, o.id]));
const safeColumnId = (colId) => (STAGE_BY_COLUMN[colId] ? colId : "col_backlog");


// CSS Customizado para parecer com o Notion
const datePickerCustomStyles = `
  .react-datepicker {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    overflow: hidden;
  }
  .react-datepicker__header {
    background-color: white;
    border-bottom: 1px solid #f3f4f6;
    padding-top: 10px;
  }
  .react-datepicker__current-month {
    font-weight: 600;
    color: #374151;
    margin-bottom: 5px;
  }
  .react-datepicker__day-name {
    color: #9ca3af;
    font-weight: 500;
  }
  .react-datepicker__day {
    color: #374151;
    border-radius: 4px;
  }
  .react-datepicker__day:hover {
    background-color: #f3f4f6;
    color: #111827;
  }
  .react-datepicker__day--selected {
    background-color: #374151 !important; /* Cinza escuro Notion */
    color: white !important;
  }
  .react-datepicker__day--keyboard-selected {
    background-color: #e5e7eb;
    color: black;
  }
  .react-datepicker__time-container {
    border-left: 1px solid #f3f4f6;
  }
  .react-datepicker__time-list-item--selected {
    background-color: #374151 !important;
  }
  .react-datepicker__time-list-item:hover {
    background-color: #f3f4f6 !important;
  }
`;

const DarkResponsiblePicker = ({ team = [], current = [], onPick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");

    // Garante que current seja sempre um array para evitar erros
    const currentArr = Array.isArray(current) ? current : [];

    const filtered = (team || []).filter(m =>
        (m.name || "").toLowerCase().includes(search.toLowerCase())
    );

    // Função para adicionar/remover (Toggle)
    const toggle = (member) => {
        const exists = currentArr.some(u => u.id === member.id);
        let newSelection;

        if (exists) {
            // Remove
            newSelection = currentArr.filter(u => u.id !== member.id);
        } else {
            // Adiciona (Preservando nome, id e email)
            newSelection = [...currentArr, { id: member.id, name: member.name, email: member.email }];
        }

        onPick(newSelection);
        // Mantém aberto para selecionar mais gente
        document.getElementById("resp-search-input")?.focus();
    };

    // Texto do botão
    const label = currentArr.length === 0
        ? "Sem responsável"
        : currentArr.length === 1
            ? currentArr[0].name.split(" ")[0]
            : `${currentArr[0].name.split(" ")[0]} +${currentArr.length - 1}`;

    return (
        <div className="relative w-full">
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(true); setSearch(""); }}
                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-[#252525] transition-colors text-left"
                title="Responsáveis"
            >
                <div className="flex -space-x-2 overflow-hidden">
                    {currentArr.length > 0 ? (
                        currentArr.slice(0, 3).map((u, i) => (
                            <div key={i} className="shrink-0 h-6 w-6 rounded-full ring-2 ring-[#202024] bg-[#252525] flex items-center justify-center text-[9px] font-bold text-gray-200 border border-[#323238]">
                                {(u.name || "U").charAt(0)}
                            </div>
                        ))
                    ) : (
                        <div className="h-6 w-6 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-[10px]"><User size={12} /></div>
                    )}
                </div>
                <span className={`text-sm font-medium truncate ${currentArr.length ? 'text-gray-200' : 'text-gray-500'}`}>
                    {label}
                </span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>

                    <div
                        className="absolute left-0 top-full mt-2 w-[300px] bg-[#1e1e24] border border-[#323238] shadow-2xl rounded-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-2 border-b border-[#323238]">
                            <div className="flex items-center gap-2 bg-[#2a2a2a] px-2 rounded border border-transparent focus-within:border-[#850000]">
                                <Search size={12} className="text-gray-500" />
                                <input
                                    id="resp-search-input"
                                    autoFocus
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full bg-transparent text-gray-200 placeholder:text-gray-500 text-xs p-2 outline-none"
                                    onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
                                />
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                            <button
                                onClick={() => { onPick([]); setIsOpen(false); }}
                                className="w-full text-left px-2 py-2 text-xs rounded hover:bg-[#333] text-red-400 font-bold mb-1"
                            >
                                <Trash2 size={12} className="inline mr-2" /> Limpar todos
                            </button>

                            {filtered.map(m => {
                                const isSelected = currentArr.some(u => u.id === m.id);
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => toggle(m)}
                                        className={`w-full text-left px-2 py-2 text-xs rounded flex items-center justify-between group transition-colors ${isSelected ? 'bg-[#2a2a2a] text-white' : 'text-gray-400 hover:bg-[#333] hover:text-gray-200'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-[#252525] border border-[#323238] flex items-center justify-center text-[9px] font-bold">
                                                {(m.name || "R").charAt(0)}
                                            </div>
                                            <span>{m.name}</span>
                                        </div>
                                        {isSelected && <CheckCircle2 size={14} className="text-green-500" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// --- NOVO COMPONENTE: SELECT DE STATUS CUSTOMIZADO (Badge Style) ---
const CustomStatusSelect = ({ currentValue, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Mapeamento de estilos (igual ao da lista principal)
    const styles = {
        'Normal': 'bg-[#2a2a2a] text-gray-300 border-[#323238]',
        'Prioridade': 'bg-[#850000]/10 text-red-300 border-[#850000]/25 shadow-[0_0_8px_rgba(133,0,0,0.18)]',
        'Essa Semana': 'bg-purple-500/10 text-purple-300 border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.18)]',
        'Em Execução': 'bg-blue-500/10 text-blue-300 border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.18)]',
        'Novos Alunos': 'bg-pink-500/10 text-pink-300 border-pink-500/20 shadow-[0_0_8px_rgba(236,72,153,0.18)]',
        'Automatizadas': 'bg-amber-500/10 text-amber-300 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.18)]',
        'Concluído': 'bg-green-500/10 text-green-300 border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.18)]',
    };

    return (
        <>
            {/* O Botão que mostra o valor atual */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border transition-all hover:brightness-110 ${styles[currentValue] || styles['Normal']}`}
            >
                {currentValue}
            </button>

            {/* O Menu Dropdown */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 mt-2 w-48 bg-[#1e1e24] border border-[#333] shadow-xl rounded-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-1 space-y-0.5">
                        <div className="px-2 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-[#333] mb-1">
                            Selecione o Status
                        </div>
                        {STAGE_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => { onChange(opt.title); setIsOpen(false); }}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-[#333] flex items-center group"
                            >
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${styles[opt.title] || styles['Normal']}`}>
                                    {opt.title}
                                </span>
                                {currentValue === opt.title && <CheckCircle2 size={12} className="ml-auto text-green-500" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </>
    );
};

export default function TaskDetailSidebar({ taskId, onClose, team = [], currentUserEmail, students = [] }) {
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);

    const [enter, setEnter] = useState(false);

    useEffect(() => {
        // garante transição suave depois que montar
        requestAnimationFrame(() => setEnter(true));
    }, []);


    // --- 1. BLOQUEAR SCROLL DO FUNDO (UX) ---
    useEffect(() => {
        // trava scroll sem “pular” layout (compensa largura do scrollbar)
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
        const prevOverflow = document.body.style.overflow;
        const prevPaddingRight = document.body.style.paddingRight;

        document.body.style.overflow = "hidden";
        if (scrollBarWidth > 0) document.body.style.paddingRight = `${scrollBarWidth}px`;

        return () => {
            document.body.style.overflow = prevOverflow;
            document.body.style.paddingRight = prevPaddingRight;
        };
    }, []);


    // --- 2. LÓGICA DE TAGS NA NUVEM (Notion Style) ---
    const [availableTags, setAvailableTags] = useState([]);
    const [tagSearch, setTagSearch] = useState(""); // Texto digitado no menu de tags

    // Carregar tags do banco (ORDEM EXATA DOS PRINTS)
    useEffect(() => {
        const fetchTags = async () => {
            try {
                // Mudei para 'task_tags_v3' para forçar a atualização da ordem
                const docRef = doc(db, "settings", "task_tags");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().list?.length > 0) {
                    setAvailableTags(docSnap.data().list);
                } else {
                    // LISTA ORGANIZADA POR COR (VERDE -> ROXO -> AZUL -> MARROM -> CINZA)
                    const MASTER_TAG_LIST = [
                        // --- GRUPO VERDE ---
                        'Ajustar Treino',
                        'Montar treino',
                        'Atualizar datas',
                        'Estruturar protocolo',
                        'Prescrever exames',
                        'Revisar protocolo',
                        'Trocar exercícios',
                        'ajsute', // Mantive o erro de digitação do print se quiser corrigir mude para 'Ajuste'

                        // --- GRUPO ROXO ---
                        'Feedback Total - Plano Premium',
                        'Feedback',
                        'Montar dieta e treino',
                        'Devolutiva de Feedback',
                        'Preencher datas de feedback',
                        'Prescrever suplementos/manipulados',

                        // --- GRUPO AZUL ---
                        'Montar dieta',
                        'Ajustar Dieta',
                        'Responder Mensagem',
                        'Não respondeu whatsapp',
                        'Mensagem com apontamentos',
                        'Comparar fotos',
                        'Montagem de fotos',
                        'Não responde',

                        // --- GRUPO MARROM/LARANJA ---
                        'Cobrar feedback',
                        'Cobrar retorno de contato',
                        'Ausente/buscar contato',
                        'Sem interação ➔ whatsapp',
                        'Retorno cobrado aguardando resposta',
                        'Avaliar feedback',
                        'Dúvida',
                        'Aluna sumida',
                        'Clica aqui e le',
                        'Dor no treino',
                        'Cobrança',
                        'renovação',
                        'Organizar prontuário',
                        'Avaliar pedido de ajuste',
                        'Rever dieta',
                        'Corrigir Execução',
                        'Subir treino Shapefy',

                        // --- GRUPO CINZA ---
                        'Marcar Consulta'
                    ];

                    await setDoc(docRef, { list: MASTER_TAG_LIST }, { merge: true });
                    setAvailableTags(MASTER_TAG_LIST);
                }
            } catch (e) { console.log("Erro ao carregar tags", e); }
        };
        fetchTags();
    }, []);

    // --- AQUI ESTÁ A CORREÇÃO: A função toggleTag tem que ficar SOLTA aqui fora ---
    const toggleTag = (tag) => {
        const currentTags = task.demandTypes || [];
        let newTags;

        // Se a tag já existe, remove. Se não existe, adiciona.
        if (currentTags.includes(tag)) {
            newTags = currentTags.filter(t => t !== tag);
        } else {
            newTags = [...currentTags, tag];
        }

        // Salva no banco de dados
        updateField('demandTypes', newTags);
    };

    // Criar nova Tag na Nuvem
    const handleCreateTag = async (newTagName) => {
        if (!newTagName || availableTags.includes(newTagName)) return;

        const newList = [...availableTags, newTagName];
        setAvailableTags(newList); // Atualiza visual
        setTagSearch(""); // Limpa busca

        // Salva na nuvem (Coleção settings -> Documento task_tags)
        await setDoc(doc(db, "settings", "task_tags"), { list: arrayUnion(newTagName) }, { merge: true });

        // Já seleciona a tag criada na tarefa (Agora ele consegue chamar a função acima)
        toggleTag(newTagName);
    };

    // Excluir Tag da Nuvem (Do menu de opções)
    const handleDeleteTagFromSystem = async (tagToDelete, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm(`Excluir a tag "${tagToDelete}" de todo o sistema?`)) return false;

        try {
            // remove do settings
            await updateDoc(doc(db, "settings", "task_tags"), {
                list: arrayRemove(tagToDelete),
            });

            // atualiza UI
            setAvailableTags(prev => prev.filter(t => t !== tagToDelete));

            // remove da tarefa se estiver selecionada
            if (task?.demandTypes?.includes(tagToDelete)) {
                const newTags = (task.demandTypes || []).filter(t => t !== tagToDelete);
                await updateField("demandTypes", newTags);
            }

            return true;
        } catch (err) {
            console.error("Erro ao excluir tag do sistema:", err);
            return false;
        }
    };


    // Estados para Busca de Aluno e Menu de Tags
    const [showStudentSearch, setShowStudentSearch] = useState(false);
    const [studentSearchTerm, setStudentSearchTerm] = useState("");
    const [showTagMenu, setShowTagMenu] = useState(false);

    // Lista de Tags disponíveis (Pode adicionar mais aqui)
    const TAG_OPTIONS = ['Ajustar Treino', 'Montar Dieta', 'Feedback', 'Dúvida', 'Onboarding', 'Cobrança', 'Renovação'];

    // Estado para novo comentário
    const [newComment, setNewComment] = useState("");

    // Estado para MÚLTIPLOS usuários (Array)
    const [mentionedUsers, setMentionedUsers] = useState([]);
    const [showMentionList, setShowMentionList] = useState(false); // Controla se a lista está aberta ou fechada

    const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false); // Começa fechado (clean)

    // 1. ESCUTAR A TAREFA EM TEMPO REAL (Para ver se alguém comentou enquanto você olha)
    useEffect(() => {
        if (!taskId) return;

        const unsub = onSnapshot(doc(db, "tasks", taskId), (docSnap) => {
            if (docSnap.exists()) {
                setTask({ id: docSnap.id, ...docSnap.data() });
            }
            setLoading(false);
        });

        return () => unsub();
    }, [taskId]);

    // 2. FUNÇÃO DE ATUALIZAR CAMPOS (COM BLINDAGEM DE ESTADO)
    const updateField = async (field, value) => {
        try {
            // A. Salva no banco
            await updateDoc(doc(db, "tasks", taskId), { [field]: value });

            // B. Se for alteração de RESPONSÁVEIS, verifica quem é NOVO
            if (field === 'assignedTo' && Array.isArray(value)) {

                // --- CORREÇÃO: CRIA UMA VERSÃO "VIRTUAL" ATUALIZADA DA TAREFA ---
                // Isso garante que se você acabou de mudar o título ou tags, a notificação veja isso
                const taskLatestState = { ...task, [field]: value };
                // -----------------------------------------------------------------

                const prevList = Array.isArray(task.assignedTo) ? task.assignedTo : [];
                const prevIds = new Set(prevList.map(u => u.id));
                const newAssignees = value.filter(u => !prevIds.has(u.id));

                if (newAssignees.length > 0) {
                    console.log(`🔔 ${newAssignees.length} novos responsáveis. Agendando...`);

                    for (const user of newAssignees) {
                        // 1. Agenda WhatsApp
                        scheduleWhatsAppNotification({
                            taskId,
                            // AQUI: Usamos taskLatestState para garantir que pegamos as tags mesmo se o state do React ainda não atualizou
                            taskTitle: taskLatestState.demandTypes?.length > 0
                                ? taskLatestState.demandTypes.join(", ")
                                : (taskLatestState.title || "Sem título"),

                            studentName: taskLatestState.studentData?.name || "",
                            responsibleId: user.id,
                            dueDate: taskLatestState.dueDate,
                            comment: taskLatestState.shortDescription || "",
                            assignerName: (() => {
                                const me = team.find(t => t.email === currentUserEmail);
                                return me?.name || currentUserEmail || "Alguém";
                            })()
                        });

                        // 2. Notificação Interna
                        if (user.email && user.email !== currentUserEmail) {
                            await addDoc(collection(db, "notifications"), {
                                recipientId: user.email,
                                recipientEmail: user.email,
                                toUserId: user.id,
                                type: "task_assigned",
                                title: "Nova Atribuição",
                                message: `Você foi definido como responsável por: "${taskLatestState.title}"`,
                                read: false,
                                createdAt: new Date().toISOString(),
                                taskId: taskId
                            });
                        }
                    }
                }
            }

        } catch (error) {
            console.error("Erro ao atualizar:", error);
        }
    };

    const updateTaskColumn = async (newColumnId) => {
        try {
            const colId = safeColumnId(newColumnId);

            const updates = {
                columnId: colId,
                priority: STAGE_BY_COLUMN[colId] || STAGE_BY_COLUMN["col_backlog"],
            };

            if (colId === "col_concluido") {
                updates.status = "concluida";
                updates.completed = true;
                updates.completedAt = new Date().toISOString();
                updates.dueDate = null;
            } else {
                // saiu do concluído -> volta a ser pendente e sai do histórico
                updates.status = "pending";
                updates.completed = false;
                updates.completedAt = null;
            }


            await updateDoc(doc(db, "tasks", taskId), updates);
        } catch (error) {
            console.error("Erro ao mudar etapa:", error);
        }
    };

    // 3. FUNÇÃO DE ENVIAR COMENTÁRIO (COM MÚLTIPLAS MENÇÕES)
    const handleSendComment = async () => {
        if (!newComment.trim()) return;

        // Criamos o objeto do comentário
        const commentData = {
            id: Date.now(),
            text: newComment,
            author: currentUserEmail || "Usuário",
            authorEmail: currentUserEmail,
            createdAt: new Date().toISOString(),
            // Salva a lista de IDs de quem foi marcado
            // SUBSTITUA APENAS ESTA LINHA:
            mentionedUsers: mentionedUsers.map(u => ({
                id: u.id,
                name: u.name || u.email || "Colaborador" // Garante que nunca fica vazio
            }))
        };

        try {
            // 1. Salva o comentário
            await updateDoc(doc(db, "tasks", taskId), {
                comments: arrayUnion(commentData)
            });

            // 2. Notifica TODOS os usuários marcados
            if (mentionedUsers.length > 0) {
                // Usamos Promise.all para enviar todas as notificações juntas
                const notificationPromises = mentionedUsers.map(user => {
                    if (user.email) {
                        return addDoc(collection(db, "notifications"), {
                            recipientId: user.email,
                            message: `${newComment}\n(em: ${task.title || 'Tarefa'})`,
                            taskId: taskId,
                            read: false,
                            createdAt: new Date().toISOString(),
                            type: 'comment_mention'
                        });
                    }
                    return null;
                });

                await Promise.all(notificationPromises);
            }

            // WhatsApp para mencionados
            if (mentionedUsers && mentionedUsers.length > 0) {
                for (const mentioned of mentionedUsers) {
                    if (mentioned.id && mentioned.id !== auth.currentUser?.uid) {
                        scheduleCommentNotification({
                            taskId,
                            taskTitle: task.demandTypes?.length > 0 ? task.demandTypes.join(", ") : (task.title || "Sem título"),
                            studentName: task.studentData?.name || "",
                            responsibleId: mentioned.id,
                            commentText: newComment.replace(/@\w+/g, '').trim(),
                            commenterName: (() => {
                                const me = team.find(t => t.email === currentUserEmail);
                                return me?.name || currentUserEmail || "Alguém";
                            })()
                        });
                    }
                }
            }

            // Limpar tudo
            setNewComment("");
            setMentionedUsers([]);
            setShowMentionList(false);

        } catch (error) {
            alert("Erro ao comentar: " + error.message);
        }
    };

    // Função auxiliar para Adicionar/Remover pessoa da lista
    const toggleMention = (user) => {
        if (mentionedUsers.find(u => u.id === user.id)) {
            // Se já está, remove
            setMentionedUsers(prev => prev.filter(u => u.id !== user.id));
        } else {
            // Se não está, adiciona
            setMentionedUsers(prev => [...prev, user]);
        }
    };

    // 4. FUNÇÃO DE EXCLUIR COMENTÁRIO
    const handleDeleteComment = async (commentToDelete) => {
        const confirm = window.confirm("Excluir este comentário?");
        if (!confirm) return;

        try {
            await updateDoc(doc(db, "tasks", taskId), {
                comments: arrayRemove(commentToDelete)
            });
        } catch (error) {
            console.error("Erro ao excluir comentário:", error);
            alert("Erro ao excluir.");
        }
    };

    // --- LÓGICA DE ANEXOS ---
    const [isUploading, setIsUploading] = useState(false);
    const storage = getStorage(); // Pega a instância do Storage

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setIsUploading(true);

            // 1. Cria uma referência única: tarefas/ID_DA_TAREFA/NOME_DO_ARQUIVO
            const storageRef = ref(storage, `tasks/${task.id}/${Date.now()}_${file.name}`);

            // 2. Sobe o arquivo
            await uploadBytes(storageRef, file);

            // 3. Pega o Link de Download
            const downloadURL = await getDownloadURL(storageRef);

            // 4. Salva o link no Firestore (dentro da tarefa)
            const newAttachment = {
                name: file.name,
                url: downloadURL,
                type: file.type,
                path: storageRef.fullPath, // Guardamos o caminho para poder deletar depois
                uploadedAt: new Date().toISOString()
            };

            await updateDoc(doc(db, "tasks", task.id), {
                attachments: arrayUnion(newAttachment)
            });

            console.log("Arquivo enviado!");
        } catch (error) {
            console.error("Erro no upload:", error);
            alert("Erro ao enviar arquivo.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteAttachment = async (attachment) => {
        if (!window.confirm(`Excluir o arquivo "${attachment.name}"?`)) return;

        try {
            // 1. Remove do Firestore visualmente
            await updateDoc(doc(db, "tasks", task.id), {
                attachments: arrayRemove(attachment)
            });

            // 2. Remove do Storage (se tiver o caminho salvo)
            if (attachment.path) {
                const fileRef = ref(storage, attachment.path);
                await deleteObject(fileRef);
            }
        } catch (error) {
            console.error("Erro ao excluir anexo:", error);
            alert("Erro ao excluir.");
        }
    };

    if (!taskId) return null;
    if (!task) return null;
    // FUNÇÃO QUE RODA QUANDO ALGUÉM É MENCIONADO NO EDITOR
    const handleMention = async (mentionedUser) => {
        // Agora verificamos se tem email também
        if (!mentionedUser || !mentionedUser.email) {
            console.warn("Usuário sem email, não é possível notificar.");
            return;
        }

        try {
            await addDoc(collection(db, "notifications"), {
                // --- CORREÇÃO AQUI: Usar .email em vez de .id ---
                recipientId: mentionedUser.email,
                // ------------------------------------------------
                message: `📢 Você foi mencionado em "${task.title}". Verifique as observações.`,
                taskId: taskId,
                read: false,
                createdAt: new Date().toISOString(),
                type: 'mention'
            });
            console.log("Notificação enviada para", mentionedUser.email);
        } catch (error) {
            console.error("Erro ao notificar:", error);
        }
    };

    return (
        <>
            {/* Overlay Escuro (Clica fora para fechar) */}
            <div
                className={`fixed inset-0 z-40 backdrop-blur-sm transition-opacity duration-200 ${enter ? "opacity-100 bg-black/70" : "opacity-0 bg-black/70"
                    }`}
                onClick={onClose}
            />

            {/* A Gaveta Lateral */}
            <div
                className={`fixed inset-y-0 right-0 w-full md:w-[600px] bg-[#202024] border-l border-[#323238] shadow-2xl z-50 flex flex-col text-gray-200
  transform-gpu will-change-transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
  ${enter ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
            >

                {/* HEADER ESTILO NOTION */}
                {/* HEADER */}
                <div className="px-8 pt-8 pb-4 relative bg-[#29292e] border-b border-[#323238]">
                    {/* Botões de Ação (Concluir, Excluir, Fechar) */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        {/* Concluir */}
                        <button
                            onClick={async () => {
                                if (!window.confirm("Concluir esta tarefa?")) return;
                                await updateDoc(doc(db, "tasks", taskId), {
                                    status: "concluida",
                                    completed: true,
                                    completedAt: new Date().toISOString(),
                                    dueDate: null,
                                    columnId: "col_concluido"
                                });
                                onClose();
                            }}
                            className="p-2 bg-green-900/20 hover:bg-green-900/40 rounded text-green-400 hover:text-green-300 transition-colors"
                            title="Concluir tarefa"
                        >
                            <CheckCircle2 size={20} />
                        </button>

                        {/* Excluir */}
                        <button
                            onClick={async () => {
                                if (!window.confirm("⚠️ Excluir esta tarefa permanentemente?")) return;
                                await deleteDoc(doc(db, "tasks", taskId));
                                onClose();
                            }}
                            className="p-2 bg-red-900/20 hover:bg-red-900/40 rounded text-red-400 hover:text-red-300 transition-colors"
                            title="Excluir tarefa"
                        >
                            <Trash2 size={20} />
                        </button>

                        {/* Fechar */}
                        <button onClick={onClose} className="p-2 hover:bg-[#252525] rounded text-gray-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="text-4xl mb-4 opacity-40 text-gray-300">📄</div>

                    {/* TÍTULO DA TAREFA */}
                    <div className="mb-2">
                        {task.studentData ? (
                            <div className="flex items-center justify-between">
                                <StudentNameWithBadge student={{ ...task.studentData, name: task.title }} className="text-3xl font-bold text-white" />
                                <button onClick={() => { updateField('studentData', null); updateField('title', task.studentData.name); }} className="p-1 text-gray-300 hover:text-red-500 rounded"><X size={16} /></button>
                            </div>
                        ) : (
                            <input
                                // AQUI: text-base no mobile (embora aqui já esteja grande, garante consistência)
                                className="text-3xl font-bold bg-transparent outline-none w-full text-white placeholder:text-gray-400"
                                value={task.title || ""}
                                onChange={(e) => updateField('title', e.target.value)}
                                placeholder="Sem título"
                            />
                        )}
                    </div>

                    {/* BOTÃO VINCULAR ALUNO */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setShowStudentSearch(!showStudentSearch)}
                            className="flex items-center gap-1 text-xs font-bold text-[#850000] hover:text-red-400 hover:bg-[#252525] px-2 py-1 rounded transition-colors whitespace-nowrap"
                        >
                            <LinkIcon size={12} /> Vincular Aluno
                        </button>

                        {/* Dropdown de Busca de Aluno */}
                        {showStudentSearch && (
                            <>
                                {/* CAMADA INVISÍVEL (CLIQUE FORA PARA FECHAR) */}
                                <div className="fixed inset-0 z-10" onClick={() => setShowStudentSearch(false)}></div>

                                {/* O MENU (z-20 para ficar acima da camada) */}
                                <div className="absolute right-0 top-full mt-2 w-[85vw] md:w-[500px] bg-[#29292e] border border-[#323238] shadow-xl rounded-lg z-20 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center border border-[#323238] rounded px-3 py-1.5 mb-2 bg-[#1a1a1a]">
                                        <Search size={14} className="text-gray-400" />
                                        <input
                                            autoFocus
                                            // AQUI: text-base impede o zoom no iPhone
                                            className="w-full bg-transparent outline-none text-base md:text-xs ml-2 text-gray-200 placeholder:text-gray-500"
                                            placeholder="Buscar aluno..."
                                            value={studentSearchTerm}
                                            onChange={e => setStudentSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-0.5">
                                        {students
                                            .filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()))
                                            .slice(0, 10)
                                            .map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => {
                                                        updateField('studentData', s);
                                                        updateField('title', s.name);
                                                        setShowStudentSearch(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#252525] rounded-md flex items-center justify-between group transition-colors"
                                                >
                                                    <div className="flex-1 min-w-0 pr-3">
                                                        <StudentNameWithBadge
                                                            student={s}
                                                            className="font-medium text-gray-200 group-hover:text-[#850000] truncate block"
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-mono shrink-0">
                                                        {s.phone || ""}
                                                    </span>
                                                </button>
                                            ))
                                        }
                                        {students.filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase())).length === 0 && (
                                            <div className="p-3 text-xs text-gray-400 text-center italic">Nenhum aluno encontrado</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ID (Mantido abaixo de tudo) */}
                    <div className="text-xs text-gray-400 font-mono mt-2">ID: {taskId}</div>
                </div>

                {/* CORPO (Scrollável) */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400">Carregando...</div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-[#202024]">

                        {/* --- BLOCO DE PROPRIEDADES (ESTILO NOTION) --- */}
                        <div className="space-y-1 py-2">

                            {/* 1. TIPO DE DEMANDA (DINÂMICO COM NUVEM) */}
                            <div className="flex items-start py-1.5 hover:bg-[#252525] rounded px-2 -mx-2 transition-colors relative">
                                <div className="w-[160px] text-gray-400 text-sm flex items-center gap-2 shrink-0 pt-1">
                                    <Tag size={16} /> Tipo de demanda
                                </div>
                                <div className="flex-1">
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {/* Tags Selecionadas */}
                                        {task.demandTypes?.map((tag, i) => (
                                            <span key={i} className={`px-2 py-0.5 rounded text-xs font-bold uppercase border flex items-center gap-1 ${getTagColor(tag)}`}>
                                                {tag}
                                                <button
                                                    onClick={() => toggleTag(tag)}
                                                    className="text-gray-400 hover:text-gray-200"
                                                    title="Remover tag"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </span>
                                        ))}

                                        {/* Botão + */}
                                        <button onClick={() => { setShowTagMenu(!showTagMenu); setTagSearch(""); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#323238] text-gray-400">
                                            <Plus size={14} />
                                        </button>
                                    </div>

                                    {/* MENU FLUTUANTE NOTION STYLE */}
                                    {showTagMenu && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowTagMenu(false)}></div>
                                            <div className="absolute left-0 top-full mt-2 w-[320px] bg-[#1e1e24] border border-[#333] shadow-2xl rounded-lg z-50 overflow-hidden"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {/* Input */}
                                                <div className="p-2 border-b border-[#333]">
                                                    <input
                                                        autoFocus
                                                        className="w-full bg-[#2a2a2a] text-white text-xs p-2 rounded outline-none border border-transparent focus:border-[#850000]"
                                                        placeholder="Buscar ou criar tag..."
                                                        value={tagSearch}
                                                        onChange={(e) => setTagSearch(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && tagSearch.trim()) handleCreateTag(tagSearch.trim());
                                                            if (e.key === 'Escape') setShowTagMenu(false);
                                                        }}
                                                    />
                                                </div>

                                                {/* Lista */}
                                                <div className="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                                    {availableTags
                                                        .filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
                                                        .map(tag => {
                                                            const isSelected = task.demandTypes?.includes(tag);
                                                            return (
                                                                <div
                                                                    key={tag}
                                                                    className={`w-full px-2 py-2 rounded text-xs flex items-center justify-between hover:bg-[#333] transition-colors group border ${isSelected ? 'bg-[#2a2a2a] border-gray-600' : 'border-transparent'
                                                                        }`}
                                                                    onClick={() => toggleTag(tag)}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border truncate ${getTagColor(tag)}`}>
                                                                            {tag}
                                                                        </span>
                                                                        {isSelected && <CheckCircle2 size={12} className="text-green-500" />}
                                                                    </div>

                                                                    <button
                                                                        onClick={(e) => handleDeleteTagFromSystem(tag, e)}
                                                                        className="text-gray-600 hover:text-red-500 hover:bg-red-900/20 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                                        title="Excluir tag do sistema"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}

                                                    {/* Criar nova */}
                                                    {tagSearch && !availableTags.some(t => t.toLowerCase() === tagSearch.toLowerCase()) && (
                                                        <button
                                                            onClick={() => handleCreateTag(tagSearch.trim())}
                                                            className="w-full text-left px-2 py-2 text-xs rounded hover:bg-[#333] text-gray-300 flex items-center gap-2 mt-1 border-t border-[#333]"
                                                        >
                                                            <Plus size={12} /> Criar <span className="font-bold text-white">"{tagSearch}"</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                        </>
                                    )}
                                </div>
                            </div>

                            {/* 2. PRIORIDADE */}
                            <div className="flex items-center py-1.5 hover:bg-[#252525] rounded px-2 -mx-2 transition-colors relative">
                                <div className="w-[160px] text-gray-400 text-sm flex items-center gap-2 shrink-0">
                                    <AlignLeft size={16} /> Status
                                </div>
                                <div className="flex-1 relative">
                                    {/* COMPONENTE CUSTOM SELECT */}
                                    <CustomStatusSelect
                                        currentValue={STAGE_BY_COLUMN[safeColumnId(task.columnId)] || STAGE_BY_COLUMN["col_backlog"]}
                                        onChange={(newTitle) => updateTaskColumn(COLUMN_BY_STAGE[newTitle] || "col_backlog")}
                                    />
                                </div>
                            </div>


                            {/* 3. VENCIMENTO (ESTILO NOTION) */}
                            <div className="flex items-center py-1.5 hover:bg-[#252525] rounded px-2 -mx-2 transition-colors">
                                <style>{datePickerCustomStyles}</style> {/* Injeta o CSS aqui */}

                                <div className="w-[160px] text-gray-400 text-sm flex items-center gap-2 shrink-0">
                                    <Calendar size={16} /> Vencimento
                                </div>
                                <div className="flex-1">
                                    <DatePicker
                                        selected={task.dueDate ? new Date(task.dueDate) : null}
                                        onChange={(date) => updateField('dueDate', date ? date.toISOString() : null)}
                                        showTimeSelect // Habilita a seleção de hora
                                        timeFormat="HH:mm"
                                        timeIntervals={15} // Intervalo de 15 min (igual Notion)
                                        timeCaption="Hora"
                                        dateFormat="dd/MM/yyyy HH:mm"
                                        locale="pt-BR"
                                        placeholderText="Sem data"
                                        // INPUT CUSTOMIZADO (Para parecer texto simples como no Notion)
                                        customInput={
                                            <button className="text-sm text-gray-200 hover:bg-gray-200 px-2 py-1 rounded transition-colors text-left w-full md:w-auto min-w-[100px]">
                                                {task.dueDate
                                                    ? new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                    : <span className="text-gray-400">Vazio</span>
                                                }
                                            </button>
                                        }
                                    />
                                </div>
                            </div>

                            {/* 4. RESPONSÁVEL */}
                            <div className="flex-1">
                                <DarkResponsiblePicker
                                    team={team}
                                    // Garante que passamos o array completo (Lista)
                                    current={Array.isArray(task.assignedTo) ? task.assignedTo : []}
                                    // Agora o "newSelection" já é a lista final pronta para salvar
                                    onPick={(newSelection) => updateField('assignedTo', newSelection)}
                                />
                            </div>


                            {/* 5. OBSERVAÇÕES (PREVIEW) - CAMPO QUE VOCÊ PEDIU */}
                            <div className="flex items-start py-1.5 hover:bg-[#252525] rounded px-2 -mx-2 transition-colors">
                                <div className="w-[160px] text-gray-400 text-sm flex items-center gap-2 shrink-0 pt-1">
                                    <FileText size={16} /> Observações
                                </div>
                                <div className="flex-1">
                                    <textarea
                                        value={task.shortDescription || ""}
                                        onChange={(e) => updateField('shortDescription', e.target.value)}
                                        placeholder="Adicione uma descrição curta..."
                                        // AQUI: text-base md:text-sm -> Isso resolve o ZOOM no textarea vermelho da sua foto
                                        className="w-full bg-[#252525] border border-[#323238] text-gray-200 placeholder:text-gray-500 px-3 py-2 rounded-lg outline-none text-base md:text-sm resize-none overflow-hidden focus:border-[#850000] focus:ring-1 focus:ring-[#850000]/30"
                                        rows={2}
                                        onInput={(e) => {
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <hr className="my-6 border-[#323238]" />

                        <hr className="border-[#323238]" />

                        {/* 2. OBSERVAÇÕES (Rich Text / Notion Style) */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-white flex items-center gap-2 text-sm uppercase">
                                <AlignLeft size={16} /> Observações
                            </h4>
                            {/* --- SEÇÃO DE ANEXOS (COM PREVIEW E TOGGLE) --- */}
                            <div className="mt-6 border border-[#323238] rounded-xl overflow-hidden bg-[#29292e]">

                                {/* 1. Cabeçalho Clicável (Toggle) */}
                                <button
                                    onClick={() => setIsAttachmentsOpen(!isAttachmentsOpen)}
                                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase">
                                        <Paperclip size={14} />
                                        Anexos ({task.attachments?.length || 0})
                                    </div>
                                    {isAttachmentsOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                                </button>

                                {/* 2. Conteúdo (Só aparece se estiver aberto) */}
                                {isAttachmentsOpen && (
                                    <div className="p-3 bg-[#29292e] animate-in slide-in-from-top-2 duration-200">

                                        <div className="space-y-2 mb-3">
                                            {task.attachments && task.attachments.length > 0 ? (
                                                task.attachments.map((file, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2 border border-[#323238] rounded-lg group hover:border-[#323238] transition-colors hover:shadow-sm">
                                                        <div className="flex items-center gap-3 overflow-hidden">

                                                            {/* --- AQUI É O PREVIEW --- */}
                                                            <div className="w-10 h-10 flex-shrink-0 bg-gray-100 rounded-md border border-[#323238] flex items-center justify-center overflow-hidden relative">
                                                                {file.type?.startsWith('image/') ? (
                                                                    <img
                                                                        src={file.url}
                                                                        alt="Preview"
                                                                        className="w-full h-full object-cover hover:scale-110 transition-transform cursor-zoom-in"
                                                                        onClick={() => window.open(file.url, '_blank')}
                                                                    />
                                                                ) : (
                                                                    <FileText size={20} className="text-gray-400" />
                                                                )}
                                                            </div>
                                                            {/* ----------------------- */}

                                                            <div className="flex flex-col min-w-0">
                                                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-700 hover:text-blue-600 truncate max-w-[200px]" title={file.name}>
                                                                    {file.name}
                                                                </a>
                                                                <span className="text-[10px] text-gray-400">
                                                                    {new Date(file.uploadedAt).toLocaleDateString('pt-BR')}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <a
                                                                href={file.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                                title="Baixar"
                                                            >
                                                                <Download size={14} />
                                                            </a>
                                                            <button
                                                                onClick={() => handleDeleteAttachment(file)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-xs text-gray-400 italic text-center py-2">
                                                    Nenhum arquivo anexado.
                                                </div>
                                            )}
                                        </div>

                                        {/* Botão de Upload Compacto */}
                                        <label className={`flex items-center justify-center gap-2 w-full p-2 border border-dashed border-[#323238] rounded-lg text-xs font-bold text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                disabled={isUploading}
                                            />
                                            {isUploading ? (
                                                <><Loader className="w-3 h-3 animate-spin" /> Enviando...</>
                                            ) : (
                                                <><Paperclip className="w-3 h-3" /> Anexar Novo Arquivo</>
                                            )}
                                        </label>
                                    </div>
                                )}
                            </div>
                            {/* --- AQUI ESTAVA O ERRO: Removi a div cinza de fora --- */}

                            {/* Mudei pl-2 para pl-12 (Dá espaço para o ícone :: aparecer sem cortar) */}
                            <div className="min-h-[150px] pl-1 py-2 group cursor-text relative" onClick={() => {
                                // Foco opcional
                            }}>
                                <NotionEditor
                                    value={task.observations || ""}
                                    onChange={(val) => updateField('observations', val)}

                                    // NOVOS PROPS:
                                    team={team}            // Passa a lista de equipe
                                    onMention={handleMention} // Passa a função que notifica
                                />
                            </div>
                        </div>

                        <hr className="border-[#323238]" />

                        {/* 3. COMENTÁRIOS (Chat) */}
                        <div className="space-y-4 pb-10">
                            <h4 className="font-bold text-white flex items-center gap-2 text-sm uppercase">
                                <MessageSquare size={16} /> Comentários ({task.comments?.length || 0})
                            </h4>

                            {/* Lista de Comentários */}
                            <div className="space-y-4">
                                {task.comments?.map((comment, idx) => (
                                    <div key={idx} className="flex gap-3 text-sm group">
                                        {/* Avatar */}
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-xs shrink-0">
                                            {comment.author?.charAt(0).toUpperCase()}
                                        </div>

                                        <div className="flex-1">
                                            {/* 1. CABEÇALHO (Nome, Data e Lixeira) */}
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-white">{comment.author}</span>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(comment.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>

                                                {/* Botão Excluir */}
                                                {(currentUserEmail === comment.authorEmail || currentUserEmail === comment.author) && (
                                                    <button
                                                        onClick={() => handleDeleteComment(comment)}
                                                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                                                        title="Apagar comentário"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* 2. TEXTO DO COMENTÁRIO (Isso estava faltando no seu) */}
                                            <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">
                                                {comment.text}
                                            </div>

                                            {/* 3. MENÇÕES EM AZUL (ABAIXO DO TEXTO) */}
                                            {comment.mentionedUsers && comment.mentionedUsers.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {comment.mentionedUsers.map((u, i) => (
                                                        <span key={i} className="text-blue-600 font-bold text-xs bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1">
                                                            @{u.name || "Alguém"}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* --- ÁREA DE COMENTÁRIO MODERNA --- */}
                            <div className="flex gap-2 items-start pt-2">
                                <div className="w-8 h-8 rounded-full bg-[#850000] flex items-center justify-center font-bold text-white text-xs mt-1 shrink-0">
                                    EU
                                </div>
                                <div className="flex-1 relative border border-[#323238] rounded-xl focus-within:border-[#850000] focus-within:ring-1 focus-within:ring-[#850000]/20 transition-all bg-[#29292e]">

                                    {/* 1. Área das "Etiquetas" (Quem já foi marcado) */}
                                    {mentionedUsers.length > 0 && (
                                        <div className="flex flex-wrap gap-2 p-2 pb-0 border-b border-[#323238]">
                                            {mentionedUsers.map(user => (
                                                <span key={user.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-[10px] font-bold">
                                                    @{user.name}
                                                    <button onClick={() => toggleMention(user)} className="hover:text-blue-900">
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* 2. O Campo de Texto */}
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Escreva um comentário..."
                                        className="w-full p-3 text-sm outline-none bg-transparent resize-none h-20 rounded-xl"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendComment();
                                            }
                                        }}
                                    />

                                    {/* 3. Barra de Ferramentas (Rodapé do Input) */}
                                    <div className="flex justify-between items-center p-2 bg-gray-50 rounded-b-xl border-t border-[#323238] relative">

                                        {/* Botão para abrir lista de menção */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowMentionList(!showMentionList)}
                                                className={`flex items-center gap-1 px-2 py-1.5 rounded hover:bg-gray-200 text-xs font-medium transition-colors ${showMentionList ? 'bg-gray-200 text-white' : 'text-gray-400'}`}
                                            >
                                                <span className="font-bold text-base">@</span>
                                                {mentionedUsers.length === 0 ? "Mencionar" : `${mentionedUsers.length} marcados`}
                                            </button>

                                            {/* --- A LISTA FLUTUANTE (POPOVER) --- */}
                                            {showMentionList && (
                                                <>
                                                    {/* Clica fora para fechar */}
                                                    <div className="fixed inset-0 z-10" onClick={() => setShowMentionList(false)}></div>

                                                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#29292e] border border-[#323238] shadow-xl rounded-lg overflow-hidden z-20 animate-in slide-in-from-bottom-2 duration-200">
                                                        <div className="p-2 bg-[#1a1a1a] text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#323238]">
                                                            Sugestões
                                                        </div>
                                                        <div className="max-h-40 overflow-y-auto">
                                                            {team.map(member => {
                                                                const isSelected = mentionedUsers.find(u => u.id === member.id);
                                                                return (
                                                                    <button
                                                                        key={member.id}
                                                                        onClick={() => toggleMention(member)}
                                                                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors hover:bg-[#252525] ${isSelected ? 'bg-[#252525] text-white font-bold' : 'text-gray-200'
                                                                            }`}

                                                                    >
                                                                        {member.name}
                                                                        {isSelected && <CheckCircle2 size={12} className="text-blue-600" />}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Botão Enviar */}
                                        <button
                                            onClick={handleSendComment}
                                            disabled={!newComment.trim()}
                                            className="p-1.5 bg-[#850000] text-white rounded-lg hover:bg-[#600000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Send size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </>
    );
}