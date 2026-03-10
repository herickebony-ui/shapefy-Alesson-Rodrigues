import React, { useState, useEffect, useMemo } from 'react';
import StudentNameWithBadge from './StudentNameWithBadge';
import TaskDetailSidebar from './TaskDetailSidebar';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ptBR from 'date-fns/locale/pt-BR';
import { scheduleWhatsAppNotification } from '../utils/notificationScheduler'; // <--- ADICIONE ISSO
registerLocale('pt-BR', ptBR);
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, where,
  getDocs, getDoc, setDoc, arrayRemove, arrayUnion, limit,
} from "firebase/firestore";

// Import da Autenticação (Separado)
import { getAuth } from "firebase/auth";
import { db } from '../firebase'; // Certifique-se que o caminho está certo
import {
  LayoutGrid, List, Plus, Filter, Search, Calendar,
  CheckCircle2, Clock, User, X, Save, Users,
  Trash2, History, AlignLeft, MessageSquare
} from 'lucide-react';

const COLUMNS = [
  {
    id: "col_backlog",
    title: "Prioridade",
    bg: "bg-[#29292e]",
    neonKey: "wine",
    cardNeon: "ring-1 ring-[#850000]/55 hover:ring-[#850000]/75 hover:shadow-[0_0_26px_rgba(133,0,0,0.16)]"
  },
  {
    id: "col_semana",
    title: "Essa Semana",
    bg: "bg-[#29292e]",
    neonKey: "purple",
    cardNeon: "ring-1 ring-purple-500/55 hover:ring-purple-500/75 hover:shadow-[0_0_26px_rgba(168,85,247,0.16)]"
  },
  {
    id: "col_execucao",
    title: "Em Execução",
    bg: "bg-[#29292e]",
    neonKey: "blue",
    cardNeon: "ring-1 ring-blue-500/55 hover:ring-blue-500/75 hover:shadow-[0_0_26px_rgba(59,130,246,0.16)]"
  },
  {
    id: "col_novos_alunos",
    title: "Novos Alunos",
    bg: "bg-[#29292e]",
    neonKey: "pink",
    cardNeon: "ring-1 ring-pink-500/55 hover:ring-pink-500/75 hover:shadow-[0_0_26px_rgba(236,72,153,0.16)]"
  },
  {
    id: "col_automatizadas",
    title: "Automatizadas",
    bg: "bg-[#29292e]",
    neonKey: "amber",
    cardNeon: "ring-1 ring-amber-500/55 hover:ring-amber-500/75 hover:shadow-[0_0_26px_rgba(245,158,11,0.16)]"
  },
  {
    id: "col_concluido",
    title: "Concluído",
    bg: "bg-[#29292e]",
    neonKey: "green",
    cardNeon: "ring-1 ring-green-500/55 hover:ring-green-500/75 hover:shadow-[0_0_26px_rgba(34,197,94,0.16)]"
  },
];


// CSS Customizado para o DatePicker (Estilo Notion Dark)
const datePickerDarkStyles = `
  .react-datepicker {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: #1e1e24;
    border: 1px solid #333;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    overflow: hidden;
  }
  .react-datepicker__header {
    background-color: #1e1e24;
    border-bottom: 1px solid #333;
    padding-top: 12px;
  }
  .react-datepicker__current-month {
    font-weight: 600;
    color: #fff;
    margin-bottom: 8px;
  }
  .react-datepicker__day-name {
    color: #888;
    font-weight: 500;
  }
  .react-datepicker__day {
    color: #ccc;
    border-radius: 6px;
  }
  .react-datepicker__day:hover {
    background-color: #333;
    color: #fff;
  }
  .react-datepicker__day--selected {
    background-color: #850000 !important;
    color: white !important;
  }
  .react-datepicker__day--keyboard-selected {
    background-color: #333;
    color: white;
  }
  .react-datepicker__time-container {
    border-left: 1px solid #333;
    background-color: #1e1e24;
  }
  .react-datepicker__time {
    background-color: #1e1e24;
  }
  .react-datepicker__time-box {
    background-color: #1e1e24;
  }
  .react-datepicker__time-list-item {
    color: #ccc;
  }
  .react-datepicker__time-list-item:hover {
    background-color: #333 !important;
    color: #fff;
  }
  .react-datepicker__time-list-item--selected {
    background-color: #850000 !important;
    color: white !important;
  }
  .react-datepicker__navigation-icon::before {
    border-color: #888;
  }
  .react-datepicker__navigation:hover *::before {
    border-color: #fff;
  }
  .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list {
    background-color: #1e1e24;
  }
  .react-datepicker__close-icon {
    padding-right: 4px;
  }
  .react-datepicker__close-icon::after {
    background-color: transparent !important;
    color: #666 !important;
    font-size: 16px !important;
    font-weight: normal !important;
    padding: 0 !important;
    height: auto !important;
    width: auto !important;
  }
  .react-datepicker__close-icon:hover::after {
    color: #ff4444 !important;
  }
`;

const NEON = {
  wine: {
    ring: "ring-[#850000]/55",
    glow: "shadow-[0_0_26px_rgba(133,0,0,0.16)]",
    top: "bg-[#850000]/70",
  },
  purple: {
    ring: "ring-purple-500/55",
    glow: "shadow-[0_0_26px_rgba(168,85,247,0.16)]",
    top: "bg-purple-500/70",
  },
  blue: {
    ring: "ring-blue-500/55",
    glow: "shadow-[0_0_26px_rgba(59,130,246,0.16)]",
    top: "bg-blue-500/70",
  },
  pink: {
    ring: "ring-pink-500/55",
    glow: "shadow-[0_0_26px_rgba(236,72,153,0.16)]",
    top: "bg-pink-500/70",
  },
  amber: {
    ring: "ring-amber-500/55",
    glow: "shadow-[0_0_26px_rgba(245,158,11,0.16)]",
    top: "bg-amber-500/70",
  },
  green: {
    ring: "ring-green-500/55",
    glow: "shadow-[0_0_26px_rgba(34,197,94,0.16)]",
    top: "bg-green-500/70",
  },
};

const STAGE_BY_COLUMN = Object.fromEntries(COLUMNS.map(c => [c.id, c.title]));
const COLUMN_BY_STAGE = Object.fromEntries(COLUMNS.map(c => [c.title, c.id]));
const KNOWN_COLUMN_IDS = new Set(COLUMNS.map(c => c.id));

const safeColumnId = (colId) => (KNOWN_COLUMN_IDS.has(colId) ? colId : "col_backlog");


// Badge de Prioridade com brilho interno
const PriorityBadge = ({ priority }) => {
  const styles = {
    // STATUS (colunas)
    'Normal': 'bg-[#2a2a2a] text-gray-300 border-[#323238]',
    'Prioridade': 'bg-[#850000]/10 text-red-300 border-[#850000]/25 shadow-[0_0_8px_rgba(133,0,0,0.18)]',
    'Essa Semana': 'bg-purple-500/10 text-purple-300 border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.18)]',
    'Em Execução': 'bg-blue-500/10 text-blue-300 border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.18)]',
    'Novos Alunos': 'bg-pink-500/10 text-pink-300 border-pink-500/20 shadow-[0_0_8px_rgba(236,72,153,0.18)]',
    'Automatizadas': 'bg-amber-500/10 text-amber-300 border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.18)]',
    'Concluído': 'bg-green-500/10 text-green-300 border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.18)]',
  };
  return (
    <span className={`inline-flex items-center max-w-[180px] overflow-hidden whitespace-nowrap text-ellipsis text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${styles[priority] || styles['Normal']}`}>
      {priority}
    </span>
  );
};

// Função de Cores (Certifique-se de que ela está acessível ou copie ela antes dos componentes)
function getTagColor(tag) {
  if (!tag || typeof tag !== 'string') return 'bg-[#2a2a2a] text-gray-400 border-[#323238]';
  const t = tag.toLowerCase();

  // Regras fixas (as tuas)
  if (t.includes('plano premium') || t === 'feedback' || t.includes('dieta e treino') || t.includes('devolutiva') || t.includes('preencher datas') || t.includes('suplementos') || t.includes('manipulados'))
    return 'bg-purple-900/40 text-purple-300 border-purple-700/50';

  if (t.includes('montar treino') || t.includes('treino') || t.includes('protocolo') || t.includes('exames') || t.includes('ajuste') || t.includes('atualizar datas') || t.includes('trocar'))
    return 'bg-green-900/40 text-green-300 border-green-700/50';

  if (t === 'montar dieta' || t.includes('dieta') || t.includes('whatsapp') || t.includes('mensagem') || t.includes('foto') || t.includes('responde'))
    return 'bg-blue-900/40 text-blue-300 border-blue-700/50';

  if (t.includes('cobrar') || t.includes('retorno') || t.includes('ausente') || t.includes('aguardando') || t.includes('avaliar') || t.includes('dúvida') || t.includes('duvida') || t.includes('sumida') || t.includes('dor') || t.includes('renovação') || t.includes('prontuário') || t.includes('shapefy') || t.includes('execução'))
    return 'bg-orange-900/40 text-orange-300 border-orange-700/50';

  // --- NOVO: cor automática (determinística) pra qualquer tag nova ---
  const palette = [
    'bg-purple-900/40 text-purple-300 border-purple-700/50',
    'bg-blue-900/40 text-blue-300 border-blue-700/50',
    'bg-green-900/40 text-green-300 border-green-700/50',
    'bg-amber-900/40 text-amber-300 border-amber-700/50',
    'bg-pink-900/40 text-pink-300 border-pink-700/50',
    'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
    'bg-red-900/40 text-red-300 border-red-700/50',
  ];

  let hash = 0;
  for (let i = 0; i < t.length; i++) hash = (hash * 31 + t.charCodeAt(i)) >>> 0;

  return palette[hash % palette.length];
}

// --- COMPONENTES DE EDIÇÃO INLINE (Estilo Notion/Excel) ---

// --- LÓGICA DE NAVEGAÇÃO GLOBAL ---
const moveFocus = (e, rowIndex, colIndex, totalRows) => {
  e.preventDefault(); // Impede o scroll da página
  let nextRow = rowIndex;
  let nextCol = colIndex;

  // Mapa de navegação
  if (e.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
  if (e.key === 'ArrowDown') nextRow = Math.min(totalRows - 1, rowIndex + 1);
  if (e.key === 'ArrowLeft') nextCol = Math.max(0, colIndex - 1);
  if (e.key === 'ArrowRight') nextCol = Math.min(6, colIndex + 1); // Ajuste 6 para o nº max de colunas

  const nextId = `cell-${nextRow}-${nextCol}`;
  const el = document.getElementById(nextId);
  if (el) el.focus();
};

// --- NOVO: SELETOR DE ALUNO INLINE (COM DETECÇÃO DE BORDA) ---
const InlineStudentSelect = ({ students, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0 }); // Novo estado para posição
  const wrapperRef = React.useRef(null);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Função inteligente para abrir
  const toggleOpen = (e) => {
    e.stopPropagation();

    if (!isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const dropdownHeight = 250; // Altura estimada do menu
      const spaceBelow = window.innerHeight - rect.bottom;

      // LÓGICA: Se tiver menos de 250px embaixo, abre para CIMA
      const openUpwards = spaceBelow < dropdownHeight;

      setCoords({
        top: openUpwards ? rect.top - dropdownHeight : rect.bottom + 5,
        left: rect.left
      });
    }

    setIsOpen(!isOpen);
    setSearchTerm("");
  };

  return (
    <div className="relative flex items-center" ref={wrapperRef}>
      {/* Botão Ícone */}
      <button
        onClick={toggleOpen}
        className="p-1.5 text-gray-500 hover:text-[#2eaadc] hover:bg-[#2eaadc]/10 rounded transition-colors mr-1"
        title="Vincular Aluno"
      >
        <Users size={14} />
      </button>

      {/* Dropdown de Busca (Flutuante) */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>
          <div
            className="fixed z-50 bg-[#1e1e24] border border-[#333] shadow-2xl rounded-lg w-72 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: coords.top, // Usa a coordenada calculada
              left: coords.left
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-[#333]">
              <div className="flex items-center gap-2 bg-[#2a2a2a] px-2 rounded border border-transparent focus-within:border-[#2eaadc]">
                <Search size={12} className="text-gray-500" />
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar aluno..."
                  className="w-full bg-transparent text-white text-xs p-2 outline-none"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
              {filteredStudents.length > 0 ? filteredStudents.map(student => (
                <button
                  key={student.id}
                  onClick={() => { onSelect(student); setIsOpen(false); }}
                  className="w-full text-left px-2 py-2 text-xs rounded hover:bg-[#333] text-gray-300 flex items-center gap-2 group transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-[#252525] border border-[#323238] flex items-center justify-center text-[9px] font-bold text-gray-400 group-hover:border-[#2eaadc] group-hover:text-[#2eaadc]">
                    {student.name.charAt(0)}
                  </div>
                  <span className="truncate flex-1">{student.name}</span>
                  {student.finStatus === 'Ativo' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_green]"></div>}
                </button>
              )) : (
                <div className="p-3 text-center text-xs text-gray-500 italic">Nenhum aluno encontrado</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// 1. Célula de Texto Inteligente (Pop-up Flutuante Real)
const InlineTextCell = ({ value, onSave, placeholder, colIndex }) => { // <--- RECEBENDO COLINDEX

  // --- 1. PRIMEIRO: Declare as variáveis (States e Refs) ---
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const cellRef = React.useRef(null);
  const textareaRef = React.useRef(null);

  // --- 2. DEPOIS: Os Efeitos (Lógica) ---

  // Atualiza valor local se o banco mudar
  useEffect(() => { setLocalValue(value || ""); }, [value]);

  // Lógica de Auto-Abrir para Nova Tarefa (Quick Add)
  useEffect(() => {
    // Se for tarefa nova (sem valor) E for a coluna 0 (Título)
    if (!value && colIndex === 0) {
      // Pequeno delay para garantir que o elemento existe na tela antes de calcular a posição
      setTimeout(() => {
        if (cellRef.current) {
          const rect = cellRef.current.getBoundingClientRect();
          setCoords({ top: rect.top, left: rect.left });
          setIsEditing(true); // Abre só depois de calcular
        }
      }, 100);
    }
  }, [value]); // Roda quando o valor muda (ou nasce vazio)

  // Função para abrir o editor ao clicar
  const handleEdit = (e) => {
    e.stopPropagation();
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      setCoords({ top: rect.top, left: rect.left });
    }
    setIsEditing(true);
  };

  const save = () => { setIsEditing(false); if (localValue !== value) onSave(localValue); };

  // Auto-resize da altura do texto
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [isEditing, localValue]);

  return (
    <>
      {/* Visualização na Tabela (Truncada) */}
      <div
        ref={cellRef}
        onClick={handleEdit}
        className="w-full h-full min-h-[30px] flex items-center px-2 rounded border border-transparent hover:border-gray-600 cursor-text transition-all text-sm truncate text-gray-300"
        title={value}
      >
        {value || <span className="opacity-30 italic text-xs">{placeholder}</span>}
      </div>

      {/* O POP-UP FLUTUANTE */}
      {isEditing && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); save(); }}></div>

          <div
            className="fixed z-50 bg-[#1e1e24] border border-[#333] shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-lg p-3 animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: coords.top - 10,
              left: coords.left - 10,
              width: '320px',
              minHeight: '100px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              ref={textareaRef}
              autoFocus
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
                if (e.key === 'Escape') { setIsEditing(false); setLocalValue(value || ""); }
              }}
              className="w-full bg-transparent text-white text-sm outline-none resize-none overflow-y-auto custom-scrollbar leading-relaxed max-h-[400px]"
              placeholder={placeholder}
              rows={1}
              style={{ lineHeight: '1.5' }}
            />
            <div className="flex justify-between items-center mt-3 border-t border-[#333] pt-2">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Shift+Enter: Pular linha</span>
              <button onClick={save} className="text-[10px] bg-[#850000] text-white px-2 py-1 rounded hover:bg-red-700 transition-colors">Salvar</button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

// 2. CÉLULA DE TAGS (NOVA - Com Dropdown)
// --- COMPONENTE DE TAG ATUALIZADO (ORDEM: SELECIONADAS NO TOPO) ---
const InlineTagCell = ({ tags = [], allTags = [], onSave, onSystemTagDelete, onCreateSystemTag, rowIndex, colIndex, totalRows }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 280 }); // Novo estado para posição
  const cellRef = React.useRef(null); // Ref para ancoragem

  // 1. Filtra pelo que você digitou
  const filteredTags = allTags.filter(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

  // 2. ORDENA: Selecionadas primeiro
  const sortedTags = [...filteredTags].sort((a, b) => {
    const isA = tags.includes(a);
    const isB = tags.includes(b);
    if (isA && !isB) return -1;
    if (!isA && isB) return 1;
    return 0;
  });

  const toggleTag = (tag, e) => {
    if (e) e.stopPropagation();
    const current = tags || [];
    const newTags = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    onSave(newTags);
    document.getElementById(`tag-search-${rowIndex}-${colIndex}`)?.focus();
  };

  // Função para abrir na posição correta (Fixed)
  // Função para abrir na posição correta (Com detecção de borda)
  const openDropdown = (e) => {
    e.stopPropagation();
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      const dropdownHeight = 250; // Altura estimada do menu
      const spaceBelow = window.innerHeight - rect.bottom;

      // Se tiver pouco espaço embaixo (menos que a altura do menu), abre pra cima
      const openUpwards = spaceBelow < dropdownHeight;

      setCoords({
        top: openUpwards ? rect.top - dropdownHeight : rect.bottom + 5,
        left: rect.left,
        width: 300
      });
    }
    setIsOpen(true);
    setSearchTerm("");
  };

  return (
    <div
      ref={cellRef}
      id={`cell-${rowIndex}-${colIndex}`}
      tabIndex={0}
      className="relative w-full h-full min-h-[30px] flex items-center px-2 rounded border border-transparent focus:border-blue-500 focus:bg-[#333] outline-none cursor-pointer"
      onClick={openDropdown}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openDropdown(e);
        if (!isOpen && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          moveFocus(e, rowIndex, colIndex, totalRows);
        }
      }}
    >
      {/* Visualização (Tags Fechadas) */}
      <div className="flex flex-wrap gap-1 overflow-hidden h-full py-1 w-full pointer-events-none">
        {tags.length > 0 ? tags.slice(0, 2).map((tag, i) => (
          <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border whitespace-nowrap ${getTagColor(tag)}`}>{tag}</span>
        )) : <span className="opacity-30 text-xs italic">Sem tags</span>}
        {tags.length > 2 && <span className="text-[9px] text-gray-400">+{tags.length - 2}</span>}
      </div>

      {/* Menu Dropdown FLUTUANTE (Fixed - escapa da tabela) */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>
          <div
            className="fixed z-[9999] bg-[#1e1e24] border border-[#333] shadow-2xl rounded-lg flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ top: coords.top, left: coords.left, width: coords.width }}
          >
            {/* Input de Busca */}
            <div className="p-2 border-b border-[#333]">
              <input
                id={`tag-search-${rowIndex}-${colIndex}`}
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar ou criar tag..."
                className="w-full bg-[#2a2a2a] text-white text-xs p-2 rounded outline-none border border-transparent focus:border-[#850000]"
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const name = (searchTerm || "").trim();
                    if (!name) return;
                    if (!allTags.includes(name)) await onCreateSystemTag?.(name);
                    toggleTag(name);
                    setSearchTerm("");
                    return;
                  }
                  if (e.key === "Escape") {
                    setIsOpen(false);
                    cellRef.current?.focus();
                  }
                }}
              />
            </div>
            {/* Lista de Opções */}
            <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
              {sortedTags.map(tag => {
                const active = tags.includes(tag);
                return (
                  <div key={tag} className={`w-full px-2 py-1.5 rounded text-xs flex items-center justify-between hover:bg-[#333] transition-colors group border ${active ? "bg-[#2a2a2a] border-gray-600" : "border-transparent"}`}>
                    <button onClick={(e) => toggleTag(tag, e)} className="flex-1 text-left flex items-center gap-2 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getTagColor(tag)}`}>{tag}</span>
                      {active && <CheckCircle2 size={12} className="text-green-500" />}
                    </button>
                    <button onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await onSystemTagDelete?.(tag, e);
                      if (ok && (tags || []).includes(tag)) onSave((tags || []).filter(t => t !== tag));
                    }}
                      className="text-gray-600 hover:text-red-500 hover:bg-red-900/20 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                      title="Excluir tag do sistema">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
              {/* Botão Criar Nova */}
              {searchTerm && !filteredTags.includes(searchTerm) && (
                <button onClick={async () => {
                  const name = searchTerm.trim();
                  if (!name) return;
                  if (!allTags.includes(name)) await onCreateSystemTag?.(name);
                  toggleTag(name);
                  setSearchTerm("");
                }}
                  className="w-full text-left px-2 py-2 text-xs rounded hover:bg-[#333] text-gray-300 flex items-center gap-2 mt-1 border-t border-[#333]">
                  <Plus size={12} /> Criar <span className="font-bold text-white">"{searchTerm}"</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// --- KANBAN: TAG PICKER (igual lista, mas com IDs únicos por task) ---
const KanbanTagPicker = ({ taskId, tags = [], allTags = [], onSave, onSystemTagDelete, onCreateSystemTag }) => {

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTags = allTags.filter(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

  const sortedTags = [...filteredTags].sort((a, b) => {
    const isA = tags.includes(a);
    const isB = tags.includes(b);
    if (isA && !isB) return -1;
    if (!isA && isB) return 1;
    return 0;
  });

  const toggleTag = (tag, e) => {
    if (e) e.stopPropagation();
    const current = tags || [];
    const newTags = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    onSave(newTags);
    // mantém foco no input
    setTimeout(() => document.getElementById(`kanban-tag-search-${taskId}`)?.focus(), 0);
  };

  return (
    <div className="relative">
      {/* Linha clicável (abre dropdown) */}
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); setSearchTerm(""); }}
        className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-[#252525] text-xs text-gray-500 font-medium"
        title="Tipo de Demanda"
      >
        <AlignLeft size={14} className="opacity-70" />
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, i) => (
              <span key={`${tag}-${i}`} className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTagColor(tag)}`}>
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-500">Adicionar Tipo de Demanda</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>

          <div
            className="absolute left-0 mt-2 w-[320px] bg-[#1e1e24] border border-[#333] shadow-2xl rounded-lg z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-[#333]">
              <input
                id={`kanban-tag-search-${taskId}`}
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar ou criar tag..."
                className="w-full bg-[#2a2a2a] text-white text-xs p-2 rounded outline-none border border-transparent focus:border-[#850000]"
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const name = (searchTerm || "").trim();
                    if (!name) return;

                    // cria no sistema se ainda não existir
                    if (!allTags.includes(name)) {
                      await onCreateSystemTag?.(name);
                    }

                    // seleciona na tarefa
                    toggleTag(name);
                    setSearchTerm("");
                    return;
                  }

                  if (e.key === "Escape") {
                    setIsOpen(false);
                    setTimeout(() => document.getElementById(`kanban-tag-search-${taskId}`)?.blur(), 0);
                  }
                }}

              />
            </div>

            <div className="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {sortedTags.map(tag => {
                const active = tags.includes(tag);

                return (
                  <div
                    key={tag}
                    className={`w-full px-2 py-1.5 rounded text-xs flex items-center justify-between hover:bg-[#333] transition-colors group border ${active ? "bg-[#2a2a2a] border-gray-600" : "border-transparent"
                      }`}
                  >
                    <button
                      onClick={(e) => toggleTag(tag, e)}
                      className="flex-1 text-left flex items-center gap-2 min-w-0"
                    >
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getTagColor(tag)}`}>
                        {tag}
                      </span>
                      {active && <CheckCircle2 size={12} className="text-green-500" />}
                    </button>

                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await onSystemTagDelete?.(tag, e);

                        // se deletou do sistema e estava selecionada na tarefa → remove também
                        if (ok && (tags || []).includes(tag)) {
                          onSave((tags || []).filter(t => t !== tag));
                        }
                      }}
                      className="text-gray-600 hover:text-red-500 hover:bg-red-900/20 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                      title="Excluir tag do sistema"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}


              {searchTerm && !allTags.includes(searchTerm) && (
                <button
                  onClick={async () => {
                    const name = (searchTerm || "").trim();
                    if (!name) return;

                    if (!allTags.includes(name)) {
                      await onCreateSystemTag?.(name);
                    }

                    toggleTag(name);
                    setSearchTerm("");
                  }}
                  className="w-full text-left px-2 py-2 text-xs rounded hover:bg-[#333] text-gray-300 flex items-center gap-2 mt-1 border-t border-[#333]"
                >
                  <Plus size={12} /> Criar <span className="font-bold text-white">"{searchTerm}"</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// 3. CÉLULA DE SELECT (Prioridade)
const InlineSelectCell = ({ value, onSave, options, rowIndex, colIndex, totalRows }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (newVal) => {
    onSave(newVal);
    setIsEditing(false);
    // Devolve o foco para a div após selecionar
    setTimeout(() => document.getElementById(`cell-${rowIndex}-${colIndex}`)?.focus(), 0);
  };

  if (isEditing) {
    return (
      <select
        autoFocus
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setIsEditing(false); document.getElementById(`cell-${rowIndex}-${colIndex}`)?.focus(); }
        }}
        className="w-full bg-[#1a1a1a] text-white p-1 rounded outline-none border border-[#850000] text-xs appearance-none"
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  return (
    <div
      id={`cell-${rowIndex}-${colIndex}`}
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsEditing(true); }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          moveFocus(e, rowIndex, colIndex, totalRows);
        }
      }}
      className="w-full h-full min-h-[30px] flex items-center px-2 rounded border border-transparent focus:border-blue-500 focus:bg-[#333] outline-none cursor-pointer"
    >
      <PriorityBadge priority={value} />
    </div>
  );
};

// 4. CÉLULA DE RESPONSÁVEL
const InlineResponsibleCell = ({ currentUserId, team, onSave, rowIndex, colIndex, totalRows }) => {
  const [isEditing, setIsEditing] = useState(false);
  const currentUser = team.find(t => t.id === currentUserId);

  const handleChange = (id) => {
    const user = team.find(t => t.id === id);
    onSave(user ? { id: user.id, name: user.name, email: user.email } : null);
    setIsEditing(false);
    setTimeout(() => document.getElementById(`cell-${rowIndex}-${colIndex}`)?.focus(), 0);
  };

  if (isEditing) {
    return (
      <select
        autoFocus
        value={currentUserId || ""}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setIsEditing(false); document.getElementById(`cell-${rowIndex}-${colIndex}`)?.focus(); }
        }}
        className="w-full bg-[#1a1a1a] text-white p-1 rounded outline-none border border-[#850000] text-xs"
      >
        <option value="">Sem resp.</option>
        {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    );
  }

  return (
    <div
      id={`cell-${rowIndex}-${colIndex}`}
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsEditing(true); }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          moveFocus(e, rowIndex, colIndex, totalRows);
        }
      }}
      className="w-full h-full min-h-[30px] flex items-center px-2 rounded border border-transparent focus:border-blue-500 focus:bg-[#333] outline-none cursor-pointer text-xs"
    >
      {currentUser ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-gray-500 flex items-center justify-center text-[8px] font-bold text-white">{currentUser.name.charAt(0)}</div>
          {currentUser.name.split(' ')[0]}
        </div>
      ) : <span className="opacity-30">-</span>}
    </div>
  );
};

const KanbanResponsiblePicker = ({ taskId, team = [], current = [], onPick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const currentArr = Array.isArray(current) ? current : [];
  const filtered = (team || []).filter(m => (m.name || "").toLowerCase().includes(search.toLowerCase()));

  const toggle = (member) => {
    const exists = currentArr.some(x => x?.id === member.id);
    const next = exists
      ? currentArr.filter(x => x?.id !== member.id)
      : [...currentArr, { id: member.id, name: member.name, email: member.email }];

    onPick(next);
  };

  const label = currentArr.length === 0
    ? "Adicionar Responsável"
    : currentArr.length === 1
      ? currentArr[0].name
      : `${currentArr[0].name.split(" ")[0]} +${currentArr.length - 1}`;

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(true); setSearch(""); }}
        className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-[#252525] text-xs text-gray-500 font-medium"
        title="Responsáveis"
      >
        <Users size={14} className="opacity-70" />
        <span className="truncate">{label}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>

          <div
            className="absolute left-0 mt-2 w-[320px] bg-[#1e1e24] border border-[#333] shadow-2xl rounded-lg z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-[#333]">
              <input
                id={`kanban-resp-search-${taskId}`}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar responsável..."
                className="w-full bg-[#2a2a2a] text-white text-xs p-2 rounded outline-none border border-transparent focus:border-[#850000]"
                onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
              />
            </div>

            <div className="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
              <button
                onClick={() => { onPick([]); setIsOpen(false); }}
                className="w-full text-left px-2 py-2 text-xs rounded hover:bg-[#333] text-gray-300"
              >
                ✓ Limpar responsáveis
              </button>

              {filtered.map(m => {
                const active = currentArr.some(x => x?.id === m.id);

                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m)}
                    className={`w-full text-left px-2 py-2 text-xs rounded hover:bg-[#333] text-gray-200 flex items-center gap-2 border ${active ? "bg-[#2a2a2a] border-gray-600" : "border-transparent"}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#252525] border border-[#323238] flex items-center justify-center text-[10px] font-bold text-gray-300">
                      {(m.name || "R").charAt(0)}
                    </div>
                    <span className="truncate flex-1">{m.name}</span>
                    {active && <CheckCircle2 size={12} className="text-green-500" />}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-3 text-center text-xs text-gray-500 italic">Nenhum responsável encontrado</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};


const InlineResponsiblePickerCell = ({ taskId, team = [], current = [], onPick, rowIndex, colIndex, totalRows }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320, openUp: false });
  const btnRef = React.useRef(null);

  const currentArr = Array.isArray(current) ? current : [];
  const filtered = (team || []).filter(m => (m.name || "").toLowerCase().includes(search.toLowerCase()));

  const open = (e) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const dropdownHeight = 320;
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < dropdownHeight;

      setCoords({
        top: openUp ? r.top - dropdownHeight : r.bottom + 8,
        left: r.left,
        width: 320,
        openUp
      });
    }
    setSearch("");
    setIsOpen(true);
  };

  const toggle = (member) => {
    const exists = currentArr.some(x => x?.id === member.id);
    const next = exists
      ? currentArr.filter(x => x?.id !== member.id)
      : [...currentArr, { id: member.id, name: member.name, email: member.email }];

    onPick(next);
  };

  const label = currentArr.length === 0
    ? "Adicionar Responsável"
    : currentArr.length === 1
      ? currentArr[0].name.split(" ")[0]
      : `${currentArr[0].name.split(" ")[0]} +${currentArr.length - 1}`;

  return (
    <div
      id={`cell-${rowIndex}-${colIndex}`}
      tabIndex={0}
      className="relative w-full h-full min-h-[30px] flex items-center px-2 rounded border border-transparent focus:border-blue-500 focus:bg-[#333] outline-none"
      onKeyDown={(e) => {
        if (e.key === "Enter") open(e);
        if (!isOpen && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          moveFocus(e, rowIndex, colIndex, totalRows);
        }
      }}
    >
      <button
        ref={btnRef}
        onClick={open}
        className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-[#252525] text-xs text-gray-300"
        title="Responsáveis"
      >
        <Users size={14} className="opacity-70" />
        <span className="truncate">{label}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
          <div
            className="fixed z-50 bg-[#1e1e24] border border-[#333] shadow-2xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-[#333]">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar responsável..."
                className="w-full bg-[#2a2a2a] text-white text-xs p-2 rounded outline-none border border-transparent focus:border-[#850000]"
                onKeyDown={(e) => { if (e.key === "Escape") setIsOpen(false); }}
              />
            </div>

            <div className="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
              <button
                onClick={() => { onPick([]); setIsOpen(false); }}
                className="w-full text-left px-2 py-2 text-xs rounded hover:bg-[#333] text-gray-300"
              >
                ✓ Limpar responsáveis
              </button>

              {filtered.map(m => {
                const active = currentArr.some(x => x?.id === m.id);

                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m)}
                    className={`w-full text-left px-2 py-2 text-xs rounded hover:bg-[#333] text-gray-200 flex items-center gap-2 border ${active ? "bg-[#2a2a2a] border-gray-600" : "border-transparent"}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#252525] border border-[#323238] flex items-center justify-center text-[10px] font-bold text-gray-300">
                      {(m.name || "R").charAt(0)}
                    </div>
                    <span className="truncate flex-1">{m.name}</span>
                    {active && <CheckCircle2 size={12} className="text-green-500" />}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-3 text-center text-xs text-gray-500 italic">Nenhum responsável encontrado</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};


const InlineStatusPickerCell = ({ currentTitle, options = [], onPick, rowIndex, colIndex, totalRows }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320 });
  const btnRef = React.useRef(null);

  const filtered = options.filter(o => (o || "").toLowerCase().includes(search.toLowerCase()));

  const open = (e) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 8, left: r.left, width: 320 });
    }
    setSearch("");
    setIsOpen(true);
  };

  return (
    <div
      id={`cell-${rowIndex}-${colIndex}`}
      tabIndex={0}
      className="relative w-full h-full min-h-[30px] flex items-center px-2 rounded border border-transparent focus:border-blue-500 focus:bg-[#333] outline-none"
      onKeyDown={(e) => {
        if (e.key === "Enter") open(e);
        if (!isOpen && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          moveFocus(e, rowIndex, colIndex, totalRows);
        }
      }}
    >
      <button
        ref={btnRef}
        onClick={open}
        className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-[#252525] text-xs text-gray-300"
        title="Status"
      >
        <AlignLeft size={14} className="opacity-70" />
        {currentTitle ? (
          <PriorityBadge priority={currentTitle} />
        ) : (
          <span className="text-gray-500 text-xs">Selecione...</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
          <div
            className="fixed z-50 bg-[#1e1e24] border border-[#333] shadow-2xl rounded-lg overflow-hidden"
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-[#333]">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar status..."
                className="w-full bg-[#2a2a2a] text-white text-xs p-2 rounded outline-none border border-transparent focus:border-[#850000]"
                onKeyDown={(e) => { if (e.key === "Escape") setIsOpen(false); }}
              />
            </div>

            <div className="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {filtered.map(opt => (
                <button
                  key={opt}
                  onClick={() => { onPick(opt); setIsOpen(false); }}
                  className="w-full text-left px-2 py-2 text-xs rounded hover:bg-[#333] text-gray-200"
                >
                  {opt}
                </button>
              ))}

              {filtered.length === 0 && (
                <div className="p-3 text-center text-xs text-gray-500 italic">Nada encontrado</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};


// 5. CÉLULA DE DATA (DatePicker Estilo Notion)
const InlineDateCell = ({ taskId, value, onSave, rowIndex, colIndex, totalRows }) => {
  const isOverdue = value && new Date(value) < new Date();

  return (
    <div
      id={`cell-${rowIndex}-${colIndex}`}
      tabIndex={0}
      className="w-full h-full min-h-[30px] px-2 py-1 rounded border border-transparent focus:border-blue-500 focus:bg-[#333] outline-none overflow-visible relative flex items-center gap-2 cursor-pointer hover:bg-[#2a2a2a]"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          moveFocus(e, rowIndex, colIndex, totalRows);
        }
      }}
    >
      <style>{datePickerDarkStyles}</style>
      <Clock size={14} className="text-gray-500 opacity-70 flex-shrink-0" />
      <DatePicker
        selected={value ? new Date(value) : null}
        onChange={(date) => onSave(date ? date.toISOString() : null)}
        showTimeSelect
        timeFormat="HH:mm"
        timeIntervals={15}
        timeCaption="Hora"
        dateFormat="dd/MM/yyyy HH:mm"
        locale="pt-BR"
        placeholderText="Vencimento"
        isClearable
        portalId="root"
        customInput={
          <button
            className={`text-left text-xs font-semibold px-1 py-0.5 pr-8 rounded hover:bg-[#333] transition-colors ${value ? (isOverdue ? "text-red-500" : "text-[#2eaadc]") : "text-gray-500"}`}
          >
            {value
              ? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : "Vencimento"
            }
          </button>
        }
      />
    </div>
  );
};



// 6. CÉLULA SIMPLES (Para o Título - Edita na própria linha)
const SimpleTextCell = ({ value, onSave, placeholder, shouldFocus }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => { setLocalValue(value || ""); }, [value]);

  // Foca automático se for uma linha nova
  useEffect(() => {
    if (shouldFocus && !value) setIsEditing(true);
  }, [shouldFocus, value]);

  const save = () => { setIsEditing(false); if (localValue !== value) onSave(localValue); };

  if (isEditing) {
    return (
      <input
        autoFocus
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={save}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setIsEditing(false); setLocalValue(value || ""); }
        }}
        className="w-full bg-[#1a1a1a] text-white p-1 rounded outline-none border border-[#850000] text-sm font-semibold"
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      className="w-full h-full flex items-center px-1 cursor-text text-sm font-medium text-white truncate hover:bg-[#333] rounded transition-colors"
    >
      {value || <span className="opacity-30 italic font-normal text-xs">{placeholder}</span>}
    </div>
  );
};
// --- NOVO COMPONENTE: SELETOR DE STATUS PARA O CARD KANBAN ---
const KanbanStatusPicker = ({ currentColumnId, onPick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = React.useRef(null);

  // Pega o título baseado no ID da coluna atual
  const currentTitle = STAGE_BY_COLUMN[safeColumnId(currentColumnId)] || "Prioridade";

  const openDropdown = (e) => {
    e.stopPropagation(); // Impede de abrir o card
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 5, left: rect.left });
    }
    setIsOpen(true);
  };

  return (
    <>
      {/* Botão Gatilho (A Tag atual) */}
      <button
        ref={btnRef}
        onClick={openDropdown}
        className="hover:brightness-110 active:scale-95 transition-all"
        title="Mudar Status"
        // Impede que o drag and drop capture o clique neste botão
        onMouseDown={(e) => e.stopPropagation()}
      >
        <PriorityBadge priority={currentTitle} />
      </button>

      {/* Dropdown Flutuante (Portal simulado com Fixed) */}
      {isOpen && (
        <>
          {/* Overlay invisível para fechar ao clicar fora */}
          <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}></div>

          <div
            className="fixed z-[9999] bg-[#1e1e24] border border-[#333] shadow-2xl rounded-lg p-2 flex flex-col gap-1 w-48 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: coords.top, left: coords.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] font-bold text-gray-500 uppercase px-2 py-1 mb-1">Selecione o Status</span>

            {COLUMNS.map(col => (
              <button
                key={col.id}
                onClick={() => { onPick(col.id); setIsOpen(false); }}
                className={`w-full text-left px-2 py-1.5 rounded hover:bg-[#333] flex items-center justify-between group ${currentColumnId === col.id ? 'bg-[#2a2a2a]' : ''}`}
              >
                <PriorityBadge priority={col.title} />
                {currentColumnId === col.id && <CheckCircle2 size={12} className="text-green-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
};
export default function TasksModule({ students, pendingTaskId, setPendingTaskId }) {
  const [viewMode, setViewMode] = useState('list');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const auth = getAuth(); // Para pegar o email do usuário atual
  const [tasks, setTasks] = useState([]);
  const [activeTeamTab, setActiveTeamTab] = useState('all');
  const [loading, setLoading] = useState(true);
  // --- ESTADOS PARA O FILTRO DO HISTÓRICO ---
  const [historyFilterPeriod, setHistoryFilterPeriod] = useState('30days'); // 'all', '7days', '30days'
  const [historyFilterUser, setHistoryFilterUser] = useState('all');
  // 2. NOVO ESTADO PARA A EQUIPE
  const [team, setTeam] = useState([]);
  // --- ESTADO DA PESQUISA ---
  const [searchQuery, setSearchQuery] = useState("");

  // Função para remover acentos e deixar minúsculo (Filtro Avançado)
  const normalizeText = (text) => {
    return text
      ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      : "";
  };
  // --- KANBAN (Notion style) ---
  const [kanbanNewTaskId, setKanbanNewTaskId] = useState(null);
  const [kanbanEdit, setKanbanEdit] = useState({ taskId: null, field: null });

  const toAssigneesArray = (assignedTo) => {
    if (Array.isArray(assignedTo)) return assignedTo.filter(Boolean);
    return assignedTo ? [assignedTo] : [];
  };
  // Estado para controlar a ordenação (qual coluna e qual direção)
  const [sortConfig, setSortConfig] = useState({ key: 'dueDate', direction: 'asc' });
  const requestSort = (key) => {
    setSortConfig((prev) => {
      const direction = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc';
      return { key, direction };
    });
  };


  // Estados do Modal de Criação
  const [isModalOpen, setIsModalOpen] = useState(false);
  // --- ESTADOS ATUALIZADOS ---
  const [availableTags, setAvailableTags] = useState([]); // Lista carregada do banco
  const [newTask, setNewTask] = useState({
    title: '',
    priority: 'Normal',
    columnId: 'col_backlog',
    dueDate: '',
    demandTypes: [], // AGORA É UM ARRAY PARA MÚLTIPLAS SELEÇÕES
    shortDescription: '' // Novo campo de observação
  });
  // --- ESTADO E LÓGICA DE SELEÇÃO MÚLTIPLA (CHECKBOX) ---
  const [selectedRows, setSelectedRows] = useState([]);

  // Selecionar/Deselecionar uma linha
  const toggleRowSelection = (taskId) => {
    setSelectedRows(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId) // Remove
        : [...prev, taskId] // Adiciona
    );
  };

  // Selecionar/Deselecionar TUDO
  const toggleAllSelection = () => {
    if (selectedRows.length === sortedTasks.length) {
      setSelectedRows([]); // Limpa tudo
    } else {
      setSelectedRows(sortedTasks.map(t => t.id)); // Marca tudo
    }
  };

  // Excluir os selecionados
  const handleDeleteSelected = async () => {
    try {
      // Deleta todos os selecionados em paralelo
      const deletePromises = selectedRows.map(id => deleteDoc(doc(db, "tasks", id)));
      await Promise.all(deletePromises);
      setSelectedRows([]); // Limpa a seleção
    } catch (error) {
      console.error("Erro ao excluir em massa:", error);
    }
  };

  // --- ATALHO DE TECLADO (DELETE) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Só age se tiver algo selecionado
      if (selectedRows.length === 0) return;

      // 2. Verifica se a tecla é Delete ou Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {

        // 3. PROTEÇÃO INTELIGENTE CORRIGIDA
        // Pega o elemento que está em foco
        const activeEl = document.activeElement;
        const tagName = activeEl.tagName.toUpperCase();
        const inputType = activeEl.type ? activeEl.type.toLowerCase() : '';

        // Se for campo de digitar texto (text, password, email, textarea), BLOQUEIA O DELETE
        // Se for checkbox, botão ou radio, LIBERA O DELETE
        if (
          (tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range'].includes(inputType)) ||
          tagName === 'TEXTAREA' ||
          activeEl.isContentEditable
        ) {
          return; // Está digitando, então não apaga a tarefa
        }

        // 4. Executa a exclusão
        e.preventDefault(); // Impede o Backspace de voltar a página
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRows]); // Recria o listener quando a seleção muda

  const handleCreateSystemTag = async (tagName) => {
    const name = (tagName || "").trim();
    if (!name) return false;

    try {
      const docRef = doc(db, "settings", "task_tags");

      // garante persistência sem sobrescrever lista inteira
      await setDoc(docRef, { list: arrayUnion(name) }, { merge: true });

      // atualiza UI (sem sumir do dropdown)
      setAvailableTags(prev => (prev.includes(name) ? prev : [...prev, name]));
      return true;
    } catch (err) {
      console.error("Erro ao criar tag no sistema:", err);
      return false;
    }
  };


  // --- FUNÇÃO PARA EXCLUIR TAG DO SISTEMA ---
  const handleDeleteSystemTag = async (tagToDelete, e) => {
    if (e) e.stopPropagation();

    if (!window.confirm(`⚠️ Tem certeza? \n\nA tag "${tagToDelete}" será excluída do sistema.`)) {
      return false; // Retorna falso se cancelou
    }

    try {
      const docRef = doc(db, "settings", "task_tags");
      await updateDoc(docRef, {
        list: arrayRemove(tagToDelete)
      });

      setAvailableTags(prev => prev.filter(t => t !== tagToDelete));
      return true; // Retorna verdadeiro se excluiu

    } catch (error) {
      console.error("Erro ao excluir tag:", error);
      return false;
    }
  };
  // --- EFEITO PARA CARREGAR TAGS DO BANCO ---
  useEffect(() => {
    const fetchTags = async () => {
      try {
        console.log("🔍 Buscando tags no Firebase...");
        const docRef = doc(db, "settings", "task_tags");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("✅ Tags encontradas:", data.list);
          // Ordena alfabeticamente para ficar bonito na lista
          setAvailableTags(data.list || []);
        } else {
          console.warn("⚠️ Documento 'settings/task_tags' não existe no banco!");
          // Se não existir, define uma lista vazia ou padrão para não quebrar
          setAvailableTags([]);
        }
      } catch (e) {
        console.error("❌ Erro fatal ao buscar tags:", e);
      }
    };

    fetchTags();
  }, []);

  // Função para adicionar/remover tag na seleção
  const toggleTag = (tag) => {
    setNewTask(prev => {
      const current = prev.demandTypes || [];
      if (current.includes(tag)) return { ...prev, demandTypes: current.filter(t => t !== tag) };
      return { ...prev, demandTypes: [...current, tag] };
    });
  };
  const [isStudentTask, setIsStudentTask] = useState(false);
  // --- FUNÇÃO NOVA: CRIA TAREFA VAZIA E ABRE DIRETO ---
  const handleCreateEmptyTask = async () => {
    try {
      const userEmail = auth.currentUser?.email || "Desconhecido";
      const userObj = team.find(t => t.email === userEmail);
      const userName = userObj ? userObj.name : "Eu";

      // Cria o documento vazio
      const docRef = await addDoc(collection(db, "tasks"), {
        title: "",
        priority: "Normal",
        columnId: "col_backlog",
        status: "pending",
        createdAt: new Date().toISOString(),
        createdBy: userName,
        lastEditedBy: userName,
        demandTypes: [],
        dueDate: null
      });

      // Abre a gaveta imediatamente
      setSelectedTaskId(docRef.id);
    } catch (error) {
      console.error("Erro ao criar:", error);
    }
  };

  // --- QUICK ADD (BOTÃO "+ Novo" NO RODAPÉ DA LISTA) ---
  const handleQuickAdd = async () => {
    try {
      const userEmail = auth.currentUser?.email || "Desconhecido";
      const userName = team.find(t => t.email === userEmail)?.name || "Eu";

      // Cria o documento vazio direto no banco
      await addDoc(collection(db, "tasks"), {
        title: "", // Título vazio para você digitar na linha
        priority: "Normal",
        columnId: "col_backlog",
        status: "pending",
        createdAt: new Date().toISOString(),
        createdBy: userName,
        lastEditedBy: userName,
        lastEditedAt: new Date().toISOString(),
        demandTypes: [],
        dueDate: null,
        studentData: null // Nasce sem aluno (Texto Livre)
      });

      // Dica: O Firebase atualiza a lista automaticamente e a nova linha aparecerá.
    } catch (error) {
      console.error("Erro ao criar tarefa rápida:", error);
    }
  };

  // --- QUICK ADD (KANBAN - por coluna, estilo Notion) ---
  const handleKanbanQuickAdd = async (columnId, origin = 'bottom') => {
    try {
      const userEmail = auth.currentUser?.email || "Desconhecido";
      const userName = team.find(t => t.email === userEmail)?.name || "Eu";

      const docRef = await addDoc(collection(db, "tasks"), {
        title: "",
        priority: "Normal",
        columnId: columnId,
        status: "pending",
        createdAt: new Date().toISOString(),
        createdBy: userName,
        lastEditedBy: userName,
        lastEditedAt: new Date().toISOString(),
        demandTypes: [],
        dueDate: null,
        shortDescription: "",
        studentData: null,
        assignedTo: [],
        isHeaderCreated: origin === 'top', // Define se foi criada pelo topo
      });

      setKanbanNewTaskId(docRef.id);
    } catch (error) {
      console.error("Erro ao criar item no kanban:", error);
    }
  };


  // --- FUNÇÃO DE ARRASTAR E SOLTAR (DRAG & DROP) ---
  const updateTaskColumn = async (taskId, newColumnId) => {
    try {
      const colId = safeColumnId(newColumnId);

      const updates = {
        columnId: colId,
        priority: STAGE_BY_COLUMN[colId] || STAGE_BY_COLUMN["col_backlog"],
        lastEditedAt: new Date().toISOString(),
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
      console.error("Erro ao mover tarefa:", error);
    }
  };
  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    await updateTaskColumn(draggableId, destination.droppableId);
  };

  // --- EFEITO: ABRE A TAREFA SE VIER DO SINO ---
  useEffect(() => {
    if (pendingTaskId) {
      console.log("🔔 Abrindo tarefa via notificação:", pendingTaskId);
      setSelectedTaskId(pendingTaskId); // Abre a gaveta lateral

      // Limpa o pendente (para não reabrir se você fechar e voltar)
      if (setPendingTaskId) setPendingTaskId(null);
    }
  }, [pendingTaskId]);

  // --- 1. CONEXÃO COM O FIREBASE (OTIMIZADA COM LIMIT E CLEANUP) ---
  useEffect(() => {
    let isMounted = true; // Proteção para não atualizar tela que já fechou

    if (!auth.currentUser) {
      setLoading(true);
      return;
    }

    setLoading(true);

    // ADICIONADO: limit(150) -> Baixa apenas os 150 últimos itens. Isso resolve a lentidão inicial.
    const q = query(
      collection(db, "tasks"),
      orderBy("createdAt", "desc"),
      limit(150)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isMounted) return; // Se a tela fechou, ignora o resultado do banco

      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTasks(tasksData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar tarefas:", error);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false; // Avisa que a tela fechou
      unsubscribe();     // Cancela a conexão com o banco
    };
  }, [auth.currentUser]);
  // --- BUSCAR EQUIPE (USERS) ---
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const teamData = querySnapshot.docs.map(d => ({
          id: d.id,
          name: d.data().name || "Sem Nome",
          role: d.data().role || "Consultor",
          email: d.data().email // <--- ADICIONE ESTA LINHA IMPORTANTE
        }));
        setTeam(teamData);
      } catch (error) {
        console.error("Erro ao buscar equipe:", error);
      }
    };
    fetchTeam();
  }, []);

  // --- ESTADO PARA TIPOS DE DEMANDA (Para criar igual Notion) ---
  const [availableDemandTypes, setAvailableDemandTypes] = useState(['Ajustar Treino', 'Montar Dieta', 'Dúvida', 'Feedback']);

  // --- 2. FUNÇÃO DE SALVAR NOVA TAREFA ---
  const handleCreateTask = async () => {
    if (!newTask.title) return alert("Digite o título da tarefa");

    // Adiciona tipo de demanda se for novo
    if (newTask.demandType && !availableDemandTypes.includes(newTask.demandType)) {
      setAvailableDemandTypes(prev => [...prev, newTask.demandType]);
    }

    try {
      const userEmail = auth.currentUser?.email || "Desconhecido";
      const userName = team.find(t => t.email === userEmail)?.name || "Eu";

      // 1. CRIA A TAREFA
      const docRef = await addDoc(collection(db, "tasks"), {
        ...newTask,
        createdAt: new Date().toISOString(),
        createdBy: userName,
        lastEditedBy: userName,
        lastEditedAt: new Date().toISOString(),
        status: 'pending',
        assignedTo: Array.isArray(newTask.assignedTo) ? newTask.assignedTo : []
      });

      // 2. DISPARA NOTIFICAÇÕES (SINO + WHATSAPP)
      if (newTask.assignedTo && newTask.assignedTo.length > 0) {
        const assignees = Array.isArray(newTask.assignedTo) ? newTask.assignedTo : [newTask.assignedTo];

        const notificationPromises = assignees.map(u => {
          // Verifica se tem e-mail e se não é para você mesmo
          if (u.email && u.email !== userEmail) {

            // A. AGENDA O ZAP (CENÁRIO A - DELAY 3 MIN)
            scheduleWhatsAppNotification({
              taskId: docRef.id,
              taskTitle: newTask.demandTypes?.length > 0 ? newTask.demandTypes.join(", ") : newTask.title,
              studentName: newTask.studentData?.name || "",
              responsibleId: u.id,
              dueDate: newTask.dueDate,
              comment: newTask.shortDescription || "",
              assignerName: userName
            });

            // B. CRIA NOTIFICAÇÃO INTERNA (SINO)
            return addDoc(collection(db, "notifications"), {
              recipientId: u.email,
              recipientEmail: u.email,
              toUserId: u.id,
              type: "task_assigned",
              title: "Nova Atribuição",
              message: `${userName} definiu você em: "${newTask.title}"${newTask.shortDescription ? `\nObs: ${newTask.shortDescription}` : ''}`,
              read: false,
              createdAt: new Date().toISOString(),
              taskId: docRef.id
            });
          }
          return null;
        });

        await Promise.all(notificationPromises);
        console.log("🔔 Notificações agendadas!");
      }

      setIsModalOpen(false);
      setNewTask({ title: '', priority: 'Normal', columnId: 'col_backlog', dueDate: '', demandType: '', shortDescription: '' }); // Limpa description tb
    } catch (error) {
      console.error("Erro ao criar:", error);
      alert("Erro ao criar tarefa");
    }
  };

  // --- 3. FUNÇÃO DE MOVER CARD (SIMPLES) ---
  // Futuramente faremos Drag & Drop, por enquanto é um clique para avançar
  const moveTask = async (task, direction) => {
    const currentIndex = COLUMNS.findIndex(c => c.id === task.columnId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < COLUMNS.length) {
      const newCol = COLUMNS[newIndex].id;
      await updateDoc(doc(db, "tasks", task.id), { columnId: newCol });
    }
  };

  // --- 4. FUNÇÃO DE CONCLUIR ---

  // Ação 1: Concluir (Move para a coluna de Concluído e tira o vencimento)
  const handleCompleteTask = async (taskId) => {
    if (!window.confirm("Concluir esta tarefa?")) return;

    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: "concluida",
        completed: true,
        completedAt: new Date().toISOString(),
        dueDate: null,            // Remove dos pendentes
        columnId: 'col_concluido' // <--- ESSA LINHA FAZ ELA MOVER NO KANBAN
      });
    } catch (error) {
      console.error("Erro ao concluir:", error);
      alert("Erro ao concluir tarefa.");
    }
  };

  // Ação 2: Excluir Permanentemente (A Lixeira)
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("⚠️ Tem certeza? Isso excluirá a tarefa PERMANENTEMENTE.")) return;

    try {
      await deleteDoc(doc(db, "tasks", taskId));
    } catch (error) {
      console.error("Erro ao excluir:", error);
    }
  }

  const mainTasks = tasks;

  const listTasks = tasks.filter(t => safeColumnId(t.columnId) !== 'col_concluido');

  const teamTasksFiltered = useMemo(() => {
    // 1. Filtro de Equipe
    let filtered = activeTeamTab === 'all'
      ? listTasks
      : listTasks.filter(t => toAssigneesArray(t.assignedTo).some(u => u?.id === activeTeamTab));

    // 2. Filtro de Pesquisa Avançada (Nome, Título, Aluno)
    if (searchQuery.trim()) {
      const query = normalizeText(searchQuery);
      filtered = filtered.filter(t => {
        const titleNormal = normalizeText(t.title);
        const studentNameNormal = t.studentData ? normalizeText(t.studentData.name) : "";
        // Pesquisa no Título OU no Nome do Aluno vinculado
        return titleNormal.includes(query) || studentNameNormal.includes(query);
      });
    }

    return filtered;
  }, [activeTeamTab, listTasks, searchQuery]);

  // Cria a lista final ordenada (COM MEMÓRIA PARA NÃO TRAVAR)
  const sortedTasks = useMemo(() => {
    return [...teamTasksFiltered].sort((a, b) => {
      // Verifica se as tarefas são "novas" (sem título)
      const isNewA = !a.title || a.title.trim() === "";
      const isNewB = !b.title || b.title.trim() === "";

      // 1. Se AMBOS são novos
      if (isNewA && isNewB) {
        if (a.isHeaderCreated && !b.isHeaderCreated) return -1; // A (Topo) ganha de B (Baixo)
        if (!a.isHeaderCreated && b.isHeaderCreated) return 1;  // B (Topo) ganha de A (Baixo)
        // Se forem iguais, o mais recente ganha (ordem de criação)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      // 2. A é novo (Topo) -> A sobe imediatamente
      if (isNewA && a.isHeaderCreated) return -1;

      // 3. B é novo (Topo) -> B sobe imediatamente
      if (isNewB && b.isHeaderCreated) return 1;

      // 4. A é novo (Baixo) -> A vai para o final do mundo
      if (isNewA && !a.isHeaderCreated) return 1;

      // 5. B é novo (Baixo) -> B vai para o final do mundo
      if (isNewB && !b.isHeaderCreated) return -1;

      // --- Daqui pra baixo é a ordenação normal das tarefas existentes ---

      if (!sortConfig.key) return 0;

      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (sortConfig.key === 'priority') {
        const weight = {
          col_backlog: 1, col_semana: 2, col_execucao: 3,
          col_novos_alunos: 4, col_automatizadas: 5, col_concluido: 6,
        };
        valA = weight[safeColumnId(a.columnId)] || 99;
        valB = weight[safeColumnId(b.columnId)] || 99;
      }

      if (sortConfig.key === 'dueDate') {
        if (!valA) return 1;
        if (!valB) return -1;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [teamTasksFiltered, sortConfig]); // Fecha o useMemo corretamente

  // Função auxiliar para salvar rápido e NOTIFICAR
  const updateTaskField = async (taskId, field, value) => {
    try {
      const ref = doc(db, "tasks", taskId);
      const isAssigning = field === "assignedTo";

      // 1. Atualiza a tarefa no Firebase
      await updateDoc(ref, {
        [field]: isAssigning ? toAssigneesArray(value) : value,
        lastEditedAt: new Date().toISOString()
      });

      // 2. --- LÓGICA DE NOTIFICAÇÃO (WHATSAPP + NOTIFICAÇÃO INTERNA) ---
      if (isAssigning) {
        // Buscamos a tarefa do estado local APENAS para comparação de "quem era o antigo responsável"
        const currentTaskLocal = tasks.find(t => t.id === taskId);

        // CORREÇÃO CRÍTICA: Buscar o documento ATUALIZADO do banco para garantir que temos as Tags mais recentes
        // Isso evita que a notificação saia errada se o usuário acabou de adicionar uma tag na lista
        const freshDoc = await getDoc(ref);
        const freshTask = freshDoc.exists() ? freshDoc.data() : currentTaskLocal;

        // Converte para array para lidar com múltiplos responsáveis
        const nextArr = toAssigneesArray(value);
        const prevArr = toAssigneesArray(currentTaskLocal?.assignedTo);
        const prevIds = new Set(prevArr.map(u => u.id));

        // Filtra APENAS quem é NOVO nessa tarefa
        const newAssignees = nextArr.filter(u => !prevIds.has(u.id));

        if (newAssignees.length > 0) {
          const currentUserEmail = auth.currentUser?.email;
          const assigner = team.find(t => t.email === currentUserEmail);
          const assignerName = assigner ? assigner.name : "Alguém";

          // Usamos freshTask.title aqui
          const taskTitleFallback = freshTask.title || "uma tarefa";

          for (const user of newAssignees) {
            // A. Cria notificação interna (Sino)
            await addDoc(collection(db, "notifications"), {
              recipientId: user.email,
              recipientEmail: user.email,
              toUserId: user.id,
              type: "task_assigned",
              title: "Nova Atribuição",
              message: `${assignerName} definiu você como responsável por: "${taskTitleFallback}"`,
              read: false,
              createdAt: new Date().toISOString(),
              taskId: taskId
            });

            // B. AGENDA O WHATSAPP (COM DELAY DE 3 MINUTOS)
            // AQUI A MÁGICA: Usamos freshTask.demandTypes
            scheduleWhatsAppNotification({
              taskId: taskId,
              taskTitle: (freshTask.demandTypes && freshTask.demandTypes.length > 0)
                ? freshTask.demandTypes.join(", ")
                : taskTitleFallback,
              studentName: freshTask.studentData?.name || "",
              responsibleId: user.id,
              dueDate: freshTask.dueDate,
              comment: freshTask.shortDescription || "",
              assignerName: assignerName
            });
          }
        }
      }

      console.log(`Campo ${field} salvo!`);
    } catch (error) {
      console.error("Erro ao salvar inline:", error);
    }
  };

  return (
    // MUDANÇA 1: Fundo Geral Escuro (#121212)
    <div className="p-6 max-w-[1800px] mx-auto min-h-screen bg-[#202024] text-gray-200 font-sans selection:bg-red-900 selection:text-white">

      {/* HEADER PREMIUM */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 bg-[#29292e] p-4 rounded-2xl border border-[#323238] shadow-2xl relative overflow-hidden">

        {/* Efeito de brilho no topo do header (Cyberpunk touch) */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 via-[#850000] to-red-900 opacity-50"></div>

        <div className="z-10">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <span className="bg-[#850000] w-2 h-8 rounded-full"></span>
            Central de Tarefas
          </h1>
          <p className="text-sm text-gray-400 mt-1 pl-5">Gerenciador de demandas Team Ébony.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10 w-full md:w-auto justify-end">
          {/* BARRA DE PESQUISA AVANÇADA */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-gray-500 group-focus-within:text-[#850000] transition-colors" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar aluno ou tarefa..."
              className="bg-[#202024] text-gray-200 text-sm rounded-lg pl-10 pr-4 py-2 border border-[#323238] focus:border-[#850000] focus:ring-1 focus:ring-[#850000] outline-none w-full md:w-64 shadow-inner transition-all placeholder-gray-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Botões de Visualização Dark */}
          <div className="bg-[#202024] p-1 rounded-lg border border-[#323238] flex items-center shadow-inner">
            <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-[#252525] text-red-500 shadow-lg ring-1 ring-[#333]' : 'text-gray-400 hover:text-gray-300'}`} title="Kanban">
              <LayoutGrid size={18} />
            </button>
            <div className="w-[1px] h-4 bg-[#333] mx-1"></div>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-[#252525] text-red-500 shadow-lg ring-1 ring-[#333]' : 'text-gray-400 hover:text-gray-300'}`} title="Lista">
              <List size={18} />
            </button>
            <div className="w-[1px] h-4 bg-[#333] mx-1"></div>
            <button onClick={() => setViewMode('history')} className={`p-2 rounded-md transition-all ${viewMode === 'history' ? 'bg-[#252525] text-red-500 shadow-lg ring-1 ring-[#333]' : 'text-gray-400 hover:text-gray-300'}`} title="Histórico">
              <History size={18} />
            </button>
          </div>
          <button
            onClick={handleCreateEmptyTask}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#850000] text-white rounded-lg text-sm font-bold hover:bg-red-700 shadow-[0_4px_14px_rgba(133,0,0,0.4)] transition-all active:scale-95 hover:shadow-[0_6px_20px_rgba(133,0,0,0.6)]"
          >
            <Plus size={18} /> <span className="hidden md:inline">Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* KANBAN BOARD COM DRAG & DROP */}
      {viewMode === 'kanban' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex overflow-x-auto pb-8 gap-8 items-start px-2">
            {COLUMNS.map(col => {
              // CORREÇÃO 1: Usamos 'sortedTasks' em vez de 'tasks'.
              // Isso garante que a lógica de "Criado no Topo" vs "Criado no Fundo" seja respeitada aqui também.
              const columnTasks = sortedTasks.filter(t => safeColumnId(t.columnId) === col.id);

              return (
                <div
                  key={col.id}
                  className="min-w-[340px] w-[340px] flex flex-col h-full"
                >

                  {/* Cabeçalho da Coluna (Neon Style) */}
                  <div
                    className={`p-4 mb-3 flex justify-between items-center rounded-xl ${col.bg}
                  border border-[#323238] relative overflow-hidden group
                  ring-1 ring-offset-0 ${(NEON[col.neonKey] || NEON.wine).ring} ${(NEON[col.neonKey] || NEON.wine).glow}`}
                  >
                    <div className={`absolute top-0 left-0 w-full h-[3px] ${(NEON[col.neonKey] || NEON.wine).top}`}></div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-200 text-sm tracking-wide">{col.title}</span>
                      <span className="bg-[#2a2a2a] text-gray-400 px-2 py-0.5 rounded text-[10px] font-bold border border-[#323238]">
                        {columnTasks.length}
                      </span>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleKanbanQuickAdd(col.id, 'top'); }}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#252525] border border-[#323238] text-red-400 hover:text-red-300 hover:bg-[#333] transition-colors"
                      title="Nova página"
                    >
                      <Plus size={18} />
                    </button>
                  </div>



                  {/* Área dos Cards */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        // ALTERAÇÃO: Trocamos o cálculo fixo por 'flex-1 h-full'.
                        // Isso faz a coluna esticar automaticamente até o rodapé do pai.
                        className={`p-2 space-y-4 custom-scrollbar transition-colors rounded-xl flex-1 w-full overflow-y-auto ${
                          // Aqui também já apliquei o ajuste da cor escura que você pediu
                          snapshot.isDraggingOver ? 'bg-black/20 ring-2 ring-dashed ring-ebony-border/30' : ''
                          }`}
                      >
                        {columnTasks.map((task, index) => {
                          const dateObj = task.dueDate ? new Date(task.dueDate) : null;
                          const isOverdue = dateObj && dateObj < new Date() && task.columnId !== 'col_concluido';
                          const dateString = dateObj ? dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

                          return (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  style={{ ...provided.draggableProps.style }}
                                  // CARD VISUAL: Cinza Escuro + Borda Sutil
                                  className={`group bg-[#29292e] p-5 rounded-2xl shadow-lg border border-[#323238]/50
                                  ${col.cardNeon}
                                  hover:shadow-2xl transition-all cursor-grab active:cursor-grabbing relative flex flex-col gap-3
                                  ${snapshot.isDragging ? 'shadow-[0_0_30px_rgba(0,0,0,0.5)] rotate-2 scale-105 z-50 ring-1 ring-[#850000]/35' : ''}`}
                                >
                                  {/* Header do Card */}
                                  <div className="flex justify-between items-start" {...provided.dragHandleProps}>

                                    <KanbanStatusPicker
                                      currentColumnId={task.columnId}
                                      onPick={(newColId) => updateTaskColumn(task.id, newColId)}
                                    />

                                    {/* Botões discretos, sempre visíveis */}
                                    <div className="flex gap-1.5">
                                      {/* Abrir detalhes */}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); }}
                                        className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-[#333] transition-colors"
                                        title="Abrir detalhes"
                                      >
                                        <AlignLeft size={14} />
                                      </button>

                                      {/* Concluir */}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCompleteTask(task.id); }}
                                        className="p-1.5 rounded-full text-green-500/70 hover:text-green-400 hover:bg-green-900/20 transition-colors"
                                        title="Concluir tarefa"
                                      >
                                        <CheckCircle2 size={14} />
                                      </button>

                                      {/* Excluir */}
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await deleteDoc(doc(db, "tasks", task.id));
                                          } catch (err) {
                                            console.error("Erro ao excluir tarefa:", err);
                                          }
                                        }}
                                        className="p-1.5 rounded-full text-red-500/50 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                                        title="Excluir tarefa"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>


                                  {/* CONTEÚDO (KANBAN - estilo Notion, editável sem abrir) */}
                                  <div className="space-y-2">

                                    {/* Título / Aluno (estilo tabela: vincular aluno sem abrir card) */}
                                    <div className="flex items-center gap-2">
                                      <InlineStudentSelect
                                        students={students}
                                        onSelect={(student) => {
                                          updateTaskField(task.id, 'studentData', student);
                                          updateTaskField(task.id, 'title', student.name);
                                        }}
                                      />

                                      {task.studentData ? (
                                        <div className="flex items-center gap-2 w-full">
                                          <div className="flex-1 min-w-0">
                                            <StudentNameWithBadge
                                              student={{ ...task.studentData, name: task.title }}
                                              showText={true}
                                              className="text-white font-semibold text-sm"
                                            />
                                          </div>

                                          <button
                                            onClick={(e) => { e.stopPropagation(); updateTaskField(task.id, 'studentData', null); }}
                                            className="text-gray-600 hover:text-red-500 hover:bg-red-900/20 p-1.5 rounded"
                                            title="Desvincular aluno"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      ) : (
                                        <input
                                          autoFocus={task.id === kanbanNewTaskId}
                                          defaultValue={task.title || ""}
                                          onFocus={() => { if (task.id === kanbanNewTaskId) setKanbanNewTaskId(null); }}
                                          onClick={(e) => e.stopPropagation()}
                                          onBlur={(e) => updateTaskField(task.id, 'title', e.target.value)}
                                          placeholder="Digite um nome..."
                                          className="w-full bg-transparent text-white font-semibold text-sm outline-none placeholder:text-gray-500"
                                        />
                                      )}
                                    </div>


                                    {/* Criada por + Comentários */}
                                    <div className="flex items-center justify-between w-full mt-1">
                                      <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <div className="w-5 h-5 rounded-full bg-[#850000] text-white flex items-center justify-center text-[9px] font-bold">
                                          {(task.createdBy || 'E').charAt(0)}
                                        </div>
                                        <span>{task.createdBy || '—'}</span>
                                      </div>

                                      {/* Ícone de Comentário (Estilo Notion) */}
                                      {(task.commentsCount > 0 || (task.comments && task.comments.length > 0)) && (
                                        <div className="flex items-center gap-1 text-gray-500" title="Comentários">
                                          <MessageSquare size={12} className="fill-gray-500/20" />
                                          <span className="text-[10px] font-medium">{task.commentsCount || task.comments?.length || 0}</span>
                                        </div>
                                      )}
                                    </div>
                                    {/* Tags (estilo Notion) */}
                                    <KanbanTagPicker
                                      onCreateSystemTag={handleCreateSystemTag}
                                      taskId={task.id}
                                      tags={task.demandTypes || []}
                                      allTags={availableTags}
                                      onSave={(newTags) => updateTaskField(task.id, 'demandTypes', newTags)}
                                      onSystemTagDelete={handleDeleteSystemTag}
                                    />


                                    {/* Observações (curtas - shortDescription) */}
                                    <InlineTextCell
                                      value={task.shortDescription || ""}
                                      onSave={(val) => updateTaskField(task.id, 'shortDescription', val)}
                                      placeholder="Adicionar Observações"
                                      colIndex={4}
                                    />


                                    {/* Criado em (data + hora, automático) */}
                                    <div className="text-xs text-gray-400 font-mono">
                                      {task.createdAt
                                        ? new Date(task.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : '--/--/---- --:--'}
                                    </div>

                                    {/* Vencimento (DatePicker Estilo Notion) */}
                                    <div className="relative flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      <style>{datePickerDarkStyles}</style>
                                      <Clock size={14} className="text-gray-500 flex-shrink-0" />
                                      <DatePicker
                                        selected={task.dueDate ? new Date(task.dueDate) : null}
                                        onChange={(date) => updateTaskField(task.id, 'dueDate', date ? date.toISOString() : null)}
                                        showTimeSelect
                                        timeFormat="HH:mm"
                                        timeIntervals={15}
                                        timeCaption="Hora"
                                        dateFormat="dd/MM/yyyy HH:mm"
                                        locale="pt-BR"
                                        placeholderText="Vencimento"
                                        isClearable
                                        portalId="root"
                                        customInput={
                                          <button
                                            className={`text-left text-xs font-semibold px-2 py-1 pr-8 rounded hover:bg-[#252525] transition-colors ${task.dueDate ? "text-[#2eaadc]" : "text-gray-500"}`}
                                          >
                                            {task.dueDate
                                              ? new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                              : "Vencimento"
                                            }
                                          </button>
                                        }
                                      />
                                    </div>

                                    {/* Responsável (clicável / editável) */}
                                    {kanbanEdit.taskId === task.id && kanbanEdit.field === 'assignedTo' ? (
                                      <select
                                        autoFocus
                                        value={task.assignedTo?.id || ""}
                                        onChange={(e) => {
                                          const id = e.target.value || "";
                                          const user = team.find(t => t.id === id);
                                          updateTaskField(task.id, 'assignedTo', user ? { id: user.id, name: user.name, email: user.email } : null);
                                          setKanbanEdit({ taskId: null, field: null });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={() => setKanbanEdit({ taskId: null, field: null })}
                                        className="w-full bg-[#1a1a1a] text-white p-1 rounded outline-none border border-[#323238] text-xs"
                                      >
                                        <option value="">Adicionar Responsável</option>
                                        {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                      </select>
                                    ) : (
                                      <KanbanResponsiblePicker
                                        taskId={task.id}
                                        team={team}
                                        current={toAssigneesArray(task.assignedTo)}
                                        onPick={(newArr) => updateTaskField(task.id, "assignedTo", newArr)}
                                      />

                                    )}

                                  </div>


                                  {/* --- 3. RODAPÉ DO CARD (CORRIGIDO PARA EVITAR ERRO DE CHARAT) --- */}
                                  <div className="flex items-center justify-between text-xs pt-3 border-t border-[#323238] mt-1">
                                    <div className="flex items-center gap-2 text-gray-400">
                                      {(() => {
                                        // Proteção contra crash: verifica se é array ou objeto
                                        const assignee = Array.isArray(task.assignedTo) ? task.assignedTo[0] : task.assignedTo;

                                        if (assignee && assignee.name) {
                                          return (
                                            <div className="flex items-center gap-1.5 bg-[#252525] pr-2 rounded-full border border-[#323238]">
                                              <div className="w-5 h-5 rounded-full bg-[#850000] text-white flex items-center justify-center text-[9px] font-bold">
                                                {assignee.name.charAt(0)}
                                              </div>
                                              <span className="truncate max-w-[60px]">{assignee.name.split(' ')[0]}</span>
                                              {Array.isArray(task.assignedTo) && task.assignedTo.length > 1 && (
                                                <span className="text-[9px] text-gray-500">+{task.assignedTo.length - 1}</span>
                                              )}
                                            </div>
                                          );
                                        }
                                        return <span className="text-gray-500 italic text-[10px]">Sem resp.</span>;
                                      })()}
                                    </div>

                                    {/* Data de criação ou conclusão */}
                                    <div className="text-[10px] text-gray-500 font-mono">
                                      {task.completedAt
                                        ? `Concluído: ${new Date(task.completedAt).toLocaleDateString('pt-BR')}`
                                        : new Date(task.createdAt).toLocaleDateString('pt-BR')}
                                    </div>
                                  </div>

                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleKanbanQuickAdd(col.id, 'bottom'); }}
                          className="w-full mt-2 text-left p-3 text-gray-500 hover:bg-[#252525] hover:text-white transition-colors rounded-xl border border-[#323238] flex items-center gap-2 text-sm font-medium group"
                        >
                          <Plus size={16} className="text-gray-600 group-hover:text-white transition-colors" />
                          Novo(a) item
                        </button>

                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
      {/* === VISÃO LISTA DARK PREMIUM === */}
      {viewMode === 'list' && (
        <div className="bg-transparent rounded-none shadow-none border-none overflow-visible flex flex-col h-[calc(100vh-180px)]">

          {/* 1. FILTROS E AÇÕES EM MASSA (ATUALIZADO COM CONTADORES) */}
          <div className="flex items-center justify-between p-3 border-b border-[#323238] bg-[#1a1a1a]">

            {selectedRows.length > 0 ? (
              /* MODO EXCLUSÃO (MANTIDO IGUAL) */
              <div className="flex items-center gap-3 animate-in slide-in-from-left-2 fade-in duration-200">
                <span className="text-white text-xs font-bold bg-[#850000] px-2 py-1 rounded">{selectedRows.length} selecionados</span>
                <button onClick={handleDeleteSelected} className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded border border-red-900/30 hover:bg-red-900/20">
                  <Trash2 size={14} /> EXCLUIR SELECIONADOS
                </button>
              </div>
            ) : (
              /* FILTROS COM CONTADORES */
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
                <span className="text-[10px] font-bold text-gray-400 uppercase mr-2 tracking-widest">Filtrar:</span>

                {/* BOTÃO TODOS */}
                <button onClick={() => setActiveTeamTab('all')} className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all flex items-center gap-2 ${activeTeamTab === 'all' ? 'bg-gray-200 text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-[#252525] text-gray-400 border-[#323238] hover:bg-[#333] hover:text-white'}`}>
                  Todos
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeTeamTab === 'all' ? 'bg-black text-white' : 'bg-[#333] text-gray-300'}`}>
                    {listTasks.length}
                  </span>
                </button>

                {/* BOTÕES DA EQUIPE (DINÂMICO) */}
                {team.map(member => {
                  // Calcula quantas tarefas esse membro tem
                  const taskCount = listTasks.filter(t => toAssigneesArray(t.assignedTo).some(u => u?.id === member.id)).length;

                  return (
                    <button key={member.id} onClick={() => setActiveTeamTab(member.id)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all flex items-center gap-2 ${activeTeamTab === member.id ? 'bg-[#850000] text-white border-red-700 shadow-[0_0_10px_rgba(133,0,0,0.4)]' : 'bg-[#252525] text-gray-400 border-[#323238] hover:bg-[#333] hover:text-white'}`}>
                      <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold">{member.name.charAt(0)}</span>
                      {member.name.split(' ')[0]}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-1 ${activeTeamTab === member.id ? 'bg-white/20 text-white' : 'bg-[#333] text-gray-300'}`}>
                        {taskCount}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 2. TABELA DARK (COM TABLE-FIXED PARA CORTAR TEXTO) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#202024]">
            <table className="w-full text-sm text-left border-collapse">

              {/* Cabeçalho */}
              <thead className="bg-[#1a1a1a] text-white font-bold text-xs border-b border-[#323238] sticky top-0 z-10 uppercase tracking-wider">
                <tr>
                  {/* COLUNA CHECKBOX */}
                  <th className="py-4 px-3 w-12 border-r border-[#2a2a2a] text-center">
                    <input
                      type="checkbox"
                      onChange={toggleAllSelection}
                      checked={sortedTasks.length > 0 && selectedRows.length === sortedTasks.length}
                      className="appearance-none w-4 h-4 border border-gray-500 rounded bg-transparent checked:bg-blue-600 checked:border-blue-600 cursor-pointer transition-all relative checked:after:content-[''] checked:after:absolute checked:after:left-[5px] checked:after:top-[1px] checked:after:w-[5px] checked:after:h-[9px] checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white checked:after:rotate-45"
                    />
                  </th>

                  <th className="py-4 px-4 w-[380px] border-r border-[#2a2a2a]">Tarefa / Aluno</th>

                  {/* 1. PRIORIDADE */}
                  <th className="py-4 px-4 w-52 border-r border-[#2a2a2a] cursor-pointer hover:bg-[#252525] transition-colors" onClick={() => requestSort('priority')}>
                    <div className="flex items-center gap-1">Status {sortConfig.key === 'priority' && <span className="text-[#850000]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}</div>
                  </th>

                  {/* 2. VENCIMENTO (POSIÇÃO CORRETA) */}
                  <th className="py-4 px-4 w-52 border-r border-[#2a2a2a] cursor-pointer hover:bg-[#252525] transition-colors" onClick={() => requestSort('dueDate')}>
                    <div className="flex items-center gap-1">Vencimento {sortConfig.key === 'dueDate' && <span className="text-[#850000]">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}</div>
                  </th>

                  {/* 3. RESPONSÁVEL */}
                  <th className="py-4 px-4 w-40 border-r border-[#2a2a2a]">Responsável</th>

                  {/* 4. TAGS */}
                  <th className="py-4 px-4 w-40 border-r border-[#2a2a2a]">Tags</th>

                  {/* 5. OBSERVAÇÕES */}
                  <th className="py-4 px-4 w-64 border-r border-[#2a2a2a]">Observações</th>

                  <th className="py-4 px-4 w-32 border-r border-[#2a2a2a]">Criado em</th>
                  <th className="py-4 px-4 w-32">Última Edição</th>
                </tr>
              </thead>

              {/* Corpo */}
              <tbody className="divide-y divide-[#2a2a2a]">
                {sortedTasks.length === 0 ? (
                  <tr><td colSpan="9" className="p-10 text-center text-gray-400 italic">Nenhuma tarefa encontrada.</td></tr>
                ) : (
                  sortedTasks.map((task, rowIndex) => {
                    const totalRows = sortedTasks.length;
                    const isSelected = selectedRows.includes(task.id);

                    return (
                      <tr key={task.id} className={`transition-all group border-l-2 border-l-transparent hover:border-l-[#850000] ${isSelected ? 'bg-[#3a3a42]' : 'bg-[#29292e] hover:bg-[#252525]'}`}>

                        {/* CHECKBOX */}
                        <td className="py-2 px-3 border-r border-[#2a2a2a] text-center w-12">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(task.id)}
                            className="appearance-none w-4 h-4 border border-gray-500 rounded bg-transparent checked:bg-blue-600 checked:border-blue-600 cursor-pointer transition-all relative checked:after:content-[''] checked:after:absolute checked:after:left-[5px] checked:after:top-[1px] checked:after:w-[5px] checked:after:h-[9px] checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white checked:after:rotate-45"
                          />
                        </td>

                        {/* 0. TÍTULO E VINCULO DE ALUNO */}
                        <td className="py-2 px-2 border-r border-[#2a2a2a] w-[450px] truncate">
                          <div className="flex items-center gap-1 overflow-hidden">
                            {/* Abrir detalhes */}
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); }}
                              className="text-gray-600 hover:text-white p-1.5 rounded flex-shrink-0"
                              title="Abrir Detalhes"
                            >
                              <AlignLeft size={16} />
                            </button>

                            {/* Seletor de aluno */}
                            <InlineStudentSelect
                              students={students}
                              onSelect={(student) => {
                                updateTaskField(task.id, 'studentData', student);
                                updateTaskField(task.id, 'title', student.name);
                              }}
                            />

                            {/* Título / aluno */}
                            <div className="flex-1 min-w-0">
                              {/* --- SUBSTITUA O BLOCO {task.studentData ? (...) : (...)} POR ESTE: --- */}

                              {task.studentData ? (
                                <div
                                  tabIndex={0}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Delete' || e.key === 'Backspace') {
                                      e.preventDefault();
                                      updateTaskField(task.id, 'studentData', null);
                                    }
                                  }}
                                  // CORREÇÃO 1: "relative" para o botão X poder flutuar, e "w-full" para ocupar a célula
                                  className="relative flex items-center gap-2 group px-1 py-0.5 rounded focus:bg-[#3a3a42] focus:ring-1 focus:ring-[#850000] outline-none cursor-default transition-all w-full overflow-hidden"
                                >
                                  {/* CORREÇÃO 2: min-w-0 e flex-1 garantem que ele encolha e não quebre linha */}
                                  <div className="flex-1 min-w-0">
                                    <StudentNameWithBadge
                                      student={{ ...task.studentData, name: task.title }}
                                      showText={true}
                                      // CORREÇÃO 3: whitespace-nowrap força tudo ficar na mesma linha
                                      className="text-gray-200 font-medium text-sm truncate whitespace-nowrap block"
                                    />
                                  </div>

                                  {/* CORREÇÃO 4: Botão X com position absolute para não empurrar o texto para baixo */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateTaskField(task.id, 'studentData', null); }}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 bg-[#29292e]/90 p-1 rounded shadow-sm z-10"
                                    title="Desvincular"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : (
                                <SimpleTextCell
                                  value={task.title}
                                  onSave={(val) => updateTaskField(task.id, 'title', val)}
                                  placeholder="Sem título"
                                  shouldFocus={rowIndex === sortedTasks.length - 1}
                                />
                              )}
                            </div>
                            {/* Ícone de Comentário na Lista */}
                            {(task.commentsCount > 0 || (task.comments && task.comments.length > 0)) && (
                              <div className="ml-2 flex items-center justify-center bg-[#252525] w-6 h-6 rounded-full border border-[#323238] flex-shrink-0" title="Ver comentários">
                                <MessageSquare size={12} className="text-gray-400" />
                              </div>
                            )}
                            {/* Concluir */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCompleteTask(task.id); }}
                              className="text-green-400 hover:text-green-300 hover:bg-green-900/20 p-1.5 rounded flex-shrink-0"
                              title="Concluir tarefa"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          </div>
                        </td>


                        {/* 1. PRIORIDADE */}
                        <td className="py-2 px-2 border-r border-[#2a2a2a] w-32 relative">
                          <InlineStatusPickerCell
                            rowIndex={rowIndex} colIndex={1} totalRows={totalRows}
                            currentTitle={STAGE_BY_COLUMN[safeColumnId(task.columnId)] || STAGE_BY_COLUMN["col_backlog"]}
                            options={COLUMNS.map(c => c.title)}
                            onPick={(stageTitle) => updateTaskColumn(task.id, COLUMN_BY_STAGE[stageTitle] || "col_backlog")}
                          />
                        </td>

                        {/* 2. VENCIMENTO */}
                        <td className={`py-2 px-2 border-r border-[#2a2a2a] w-40`}>
                          <InlineDateCell
                            taskId={task.id}
                            rowIndex={rowIndex} colIndex={2} totalRows={totalRows}
                            value={task.dueDate}
                            onSave={(val) => updateTaskField(task.id, "dueDate", val)}
                          />
                        </td>

                        {/* 3. RESPONSÁVEL */}
                        <td className="py-2 px-2 border-r border-[#2a2a2a] w-40">
                          <InlineResponsiblePickerCell
                            taskId={task.id}
                            rowIndex={rowIndex} colIndex={3} totalRows={totalRows}
                            team={team}
                            current={task.assignedTo || null}
                            onPick={(userObj) => updateTaskField(task.id, "assignedTo", userObj)}
                          />
                        </td>

                        {/* 4. TAGS */}
                        <td className="py-2 px-2 border-r border-[#2a2a2a] relative w-64">
                          <InlineTagCell
                            onCreateSystemTag={handleCreateSystemTag}
                            rowIndex={rowIndex} colIndex={5} totalRows={totalRows}
                            tags={task.demandTypes}
                            allTags={availableTags}
                            onSave={(newTags) => updateTaskField(task.id, 'demandTypes', newTags)}
                            onSystemTagDelete={handleDeleteSystemTag}
                          />
                        </td>

                        {/* 5. OBSERVAÇÕES */}
                        <td className="py-2 px-2 border-r border-[#2a2a2a] w-64 max-w-[250px] overflow-hidden cursor-pointer relative group">
                          <InlineTextCell
                            rowIndex={rowIndex}
                            colIndex={4} // <--- MUDEI PARA 4 (ASSIM ELE SABE QUE NÃO É O TÍTULO)
                            totalRows={totalRows}
                            value={task.shortDescription} // <--- MUDEI PARA A DESCRIÇÃO
                            onSave={(val) => updateTaskField(task.id, 'shortDescription', val)}
                            placeholder="Obs..."
                          />
                        </td>

                        {/* COLUNA CRIADO EM (CORRIGIDA) */}
                        <td className="py-2 px-4 border-r border-[#2a2a2a] text-xs text-gray-500 font-mono w-32">
                          {(() => {
                            // 1. Se não tiver data, mostra traço
                            if (!task.createdAt) return "-";

                            // 2. Tenta converter
                            const date = new Date(task.createdAt);

                            // 3. Se a conversão falhar (Invalid Date), mostra traço
                            if (isNaN(date.getTime())) return "-";

                            // 4. Se deu certo, formata com DATA e HORA
                            return date.toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit', // Ano com 2 dígitos (26) fica mais limpo
                              hour: '2-digit',
                              minute: '2-digit'
                            });
                          })()}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            {/* --- BOTÃO QUICK ADD (ESTILO NOTION) --- */}
            <div className="border-t border-[#323238] p-3">
              <button
                onClick={handleQuickAdd}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors rounded-lg border border-[#323238] hover:bg-[#252525] text-sm font-medium"
              >
                <Plus size={16} className="text-gray-500" />
                Novo
              </button>
            </div>


          </div> {/* Fim da div overflow-y-auto */}
        </div> // Fim do container da lista
      )}
      {/* === VISÃO HISTÓRICO DARK PREMIUM === */}
      {viewMode === 'history' && (
        <div className="bg-[#29292e] rounded-xl shadow-2xl border border-[#323238] overflow-hidden flex flex-col h-[calc(100vh-200px)] animate-in fade-in duration-300">

          {/* Header Histórico */}
          <div className="p-5 bg-[#1a1a1a] border-b border-[#323238] flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="font-bold text-gray-200 flex items-center gap-2 text-lg">
                <History size={20} className="text-[#850000]" />
                Histórico de Entregas
              </h3>
              <p className="text-xs text-white mt-1">Arquivo morto e análise de produtividade.</p>
            </div>

            {/* Filtros Dark */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-[#252525] border border-[#323238] rounded-lg px-2 py-1.5 shadow-inner">
                <Calendar size={14} className="text-white mr-2" />
                <select
                  value={historyFilterPeriod}
                  onChange={(e) => setHistoryFilterPeriod(e.target.value)}
                  className="text-xs font-bold text-white bg-transparent outline-none cursor-pointer"
                >
                  <option value="7days">Últimos 7 dias</option>
                  <option value="30days">Últimos 30 dias</option>
                  <option value="all">Todo o período</option>
                </select>
              </div>

              <div className="flex items-center bg-[#252525] border border-[#323238] rounded-lg px-2 py-1.5 shadow-inner">
                <User size={14} className="text-white mr-2" />
                <select
                  value={historyFilterUser}
                  onChange={(e) => setHistoryFilterUser(e.target.value)}
                  className="text-xs font-bold text-white bg-transparent outline-none cursor-pointer"
                >
                  <option value="all">Toda a Equipe</option>
                  {team.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar bg-transparent">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-[#1a1a1a] text-white font-bold text-xs border-b border-[#323238] sticky top-0 z-10 uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-5">Tarefa / Aluno</th>
                  <th className="py-4 px-5">Detalhes</th>
                  <th className="py-4 px-5">Responsável</th>
                  <th className="py-4 px-5">Conclusão</th>
                  <th className="py-4 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {tasks
                  .filter(t => t.completed === true || t.columnId === 'col_concluido')
                  .filter(t => historyFilterUser === 'all' ? true : toAssigneesArray(t.assignedTo).some(u => u?.id === historyFilterUser))
                  .filter(t => {
                    if (historyFilterPeriod === 'all') return true;
                    const d = t.completedAt ? new Date(t.completedAt) : new Date(t.lastEditedAt);
                    const days = historyFilterPeriod === '7days' ? 7 : 30;
                    const cut = new Date(); cut.setDate(cut.getDate() - days);
                    return d >= cut;
                  })
                  .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
                  .map(task => (
                    <tr key={task.id} onClick={() => setSelectedTaskId(task.id)} className="hover:bg-[#29292e] transition-colors cursor-pointer group">
                      <td className="py-4 px-5 font-medium text-gray-300">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-green-900/20 text-green-500 rounded-full border border-green-900/30"><CheckCircle2 size={14} /></div>
                          {task.studentData ? <StudentNameWithBadge student={{ ...task.studentData, name: task.title }} showText={true} className="text-white" /> : <span>{task.title}</span>}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col gap-1">
                          <PriorityBadge priority={STAGE_BY_COLUMN[safeColumnId(task.columnId)] || STAGE_BY_COLUMN["col_backlog"]} />
                          <div className="flex gap-1 mt-1">
                            {task.demandTypes?.slice(0, 2).map((tag, i) => <span key={i} className={`w-2 h-2 rounded-full ${getTagColor(tag).split(' ')[0]}`}></span>)}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-white text-xs">
                        {task.assignedTo ? task.assignedTo.name : '-'}
                      </td>
                      <td className="py-4 px-5 text-white font-mono text-xs">
                        {task.completedAt ? new Date(task.completedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'S/ Data'}
                      </td>
                      <td className="py-4 px-5 text-right">
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* --- SIDEBAR DE DETALHES (GAVETA LATERAL) --- */}
      {selectedTaskId && (
        <TaskDetailSidebar
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          team={team}
          currentUserEmail={auth.currentUser?.email}
          students={students} // <--- ADICIONE ESTA LINHA OBRIGATÓRIA
        />
      )}
      {/* --- MODAL DE NOVA TAREFA (ATUALIZADO) --- */}
      {/* --- MODAL DARK --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#29292e] border border-[#323238] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">

            <div className="p-5 border-b border-[#323238] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-bold text-gray-200 text-lg">Nova Tarefa</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400 hover:text-red-500 transition-colors" /></button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">

              {/* Título / Aluno */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Título / Aluno</label>
                  <button onClick={() => { setIsStudentTask(!isStudentTask); setNewTask({ ...newTask, title: '' }); }} className="text-[10px] text-[#850000] font-bold hover:text-red-400 transition-colors">
                    {isStudentTask ? "Mudar p/ Texto Livre" : "Vincular Aluno"}
                  </button>
                </div>
                {isStudentTask ? (
                  <div className="flex items-center border border-[#323238] rounded-lg focus-within:border-[#850000] bg-[#252525] overflow-hidden transition-colors">
                    <div className="pl-3 text-gray-400"><User size={16} /></div>
                    <input type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Buscar aluno..." className="w-full p-2.5 bg-transparent outline-none text-sm text-white placeholder-gray-600" />
                  </div>
                ) : (
                  <input autoFocus type="text" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} className="w-full p-2.5 border border-[#323238] rounded-lg bg-[#252525] outline-none focus:border-[#850000] text-white placeholder-gray-600 transition-colors" placeholder="Ex: Ajustar estratégia..." />
                )}
              </div>

              {/* Data */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block">Vencimento</label>
                <input type="datetime-local" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} className="w-full p-2.5 border border-[#323238] rounded-lg bg-[#252525] outline-none focus:border-[#850000] text-gray-200 scheme-dark" />
              </div>

              {/* Tags no Modal */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block">Tags</label>
                <div className="flex gap-2 flex-wrap bg-[#151515] p-3 rounded-lg border border-[#323238] min-h-[60px]">
                  {availableTags.map(tag => {
                    const isSelected = newTask.demandTypes?.includes(tag);
                    return (
                      <div key={tag} className="group relative inline-block">
                        <button
                          onClick={() => { setNewTask(prev => { const c = prev.demandTypes || []; return c.includes(tag) ? { ...prev, demandTypes: c.filter(t => t !== tag) } : { ...prev, demandTypes: [...c, tag] }; }); }}
                          className={`px-3 py-1 text-xs rounded border transition-all ${isSelected ? getTagColor(tag) + ' shadow-lg ring-1 ring-white/10' : 'bg-[#252525] text-gray-400 border-[#323238] hover:border-gray-500'}`}
                        >
                          {tag}
                        </button>

                        {/* BOTÃO EXCLUIR (APARECE NO HOVER) */}
                        <button
                          onClick={(e) => handleDeleteSystemTag(tag, e)}
                          className="absolute -top-2 -right-2 bg-red-900 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md border border-red-700 z-10"
                          title="Excluir tag"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Selects */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-white uppercase mb-1.5 block">Prioridade</label>
                  <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="w-full p-2.5 border border-[#323238] rounded-lg bg-[#252525] text-gray-200 outline-none focus:border-[#850000]">
                    <option>Normal</option><option>Alta</option><option>Baixa</option><option>Essa semana</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white uppercase mb-1.5 block">Coluna</label>
                  <select value={newTask.columnId} onChange={(e) => setNewTask({ ...newTask, columnId: e.target.value })} className="w-full p-2.5 border border-[#323238] rounded-lg bg-[#252525] text-gray-200 outline-none focus:border-[#850000]">
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-[#323238] flex justify-end gap-3 bg-[#1a1a1a]">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-400 font-bold text-xs hover:text-white hover:bg-[#333] rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleCreateTask} className="px-6 py-2.5 bg-[#850000] text-white rounded-lg font-bold text-xs hover:bg-red-700 shadow-lg flex items-center gap-2 transition-all">
                <Save size={16} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}