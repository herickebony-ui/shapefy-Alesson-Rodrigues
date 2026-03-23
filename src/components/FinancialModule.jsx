import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  arrayRemove // ✅ ADD
} from "firebase/firestore";
import {
  FileText,
  CalendarDays,
  SlidersHorizontal,
  CheckCircle,
  CheckCircle2,
  Edit2,
  Eraser,
  Filter,
  History,
  Plus,
  Search,
  TrendingUp,
  Users,
  Wallet,
  X,
  LogOut,
  RefreshCcw
} from "lucide-react";
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import StudentNameWithBadge from './StudentNameWithBadge';
import StudentBadge from './StudentBadge';

const ALLOWED_COLORS = [
  'slate', 'red', 'rose', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink'
];

const COLOR_DOT = {
  slate: 'bg-slate-400', red: 'bg-red-400', rose: 'bg-rose-400',
  orange: 'bg-orange-400', amber: 'bg-amber-400', yellow: 'bg-yellow-400',
  lime: 'bg-lime-400', green: 'bg-green-400', emerald: 'bg-emerald-400',
  teal: 'bg-teal-400', cyan: 'bg-cyan-400', sky: 'bg-sky-400',
  blue: 'bg-blue-400', indigo: 'bg-indigo-400', violet: 'bg-violet-400',
  purple: 'bg-purple-400', fuchsia: 'bg-fuchsia-400', pink: 'bg-pink-400'
};

const COLOR_BADGE = {
  slate: 'bg-slate-100 text-slate-800 border-slate-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  lime: 'bg-lime-100 text-lime-800 border-lime-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  teal: 'bg-teal-100 text-teal-800 border-teal-200',
  cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  sky: 'bg-sky-100 text-sky-800 border-sky-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  violet: 'bg-violet-100 text-violet-800 border-violet-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  pink: 'bg-pink-100 text-pink-800 border-pink-200'
};
// Adicione isso logo abaixo de COLOR_BADGE
const HEX_COLORS = {
  slate: '#94a3b8', red: '#f87171', rose: '#fb7185',
  orange: '#fb923c', amber: '#fbbf24', yellow: '#facc15',
  lime: '#a3e635', green: '#4ade80', emerald: '#34d399',
  teal: '#2dd4bf', cyan: '#22d3ee', sky: '#38bdf8',
  blue: '#60a5fa', indigo: '#818cf8', violet: '#a78bfa',
  purple: '#c084fc', fuchsia: '#e879f9', pink: '#f472b6'
};
// --- HELPERS VISUAIS (ESTILO NOTION) ---
const getMonthBadge = (dateStr) => {
  if (!dateStr) return { day: '--', name: '-', color: 'bg-gray-100 text-gray-400' };

  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  const day = String(date.getDate()).padStart(2, '0');
  const monthIndex = date.getMonth();

  const months = [
    { name: 'JAN', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    { name: 'FEV', color: 'bg-pink-100 text-pink-800 border-pink-200' },
    { name: 'MAR', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
    { name: 'ABR', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    { name: 'MAI', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { name: 'JUN', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { name: 'JUL', color: 'bg-sky-100 text-sky-800 border-sky-200' },
    { name: 'AGO', color: 'bg-teal-100 text-teal-800 border-teal-200' },
    { name: 'SET', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { name: 'OUT', color: 'bg-lime-100 text-lime-800 border-lime-200' },
    { name: 'NOV', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { name: 'DEZ', color: 'bg-slate-200 text-slate-800 border-slate-300' },
  ];

  return { day, ...months[monthIndex] };
};

// --- ENGINE DE DATAS ---
const getTodayISO = () => {
  const d = new Date();
  const z = n => ('0' + n).slice(-2);
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

const normalizeDate = (input) => {
  if (!input) return null;
  if (typeof input === "object" && typeof input.toDate === "function") {
    const d = input.toDate();
    const z = n => ('0' + n).slice(-2);
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  if (typeof input === "string") return input.slice(0, 10);
  return null;
};

const parseLocalMidnight = (isoDate) => {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const isBetweenInclusive = (iso, start, end) => {
  if (!iso || !start || !end) return false;
  return iso >= start && iso <= end;
};

const formatDateBr = (dateStr) => {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const diffDaysISO = (fromISO, toISO) => {
  if (!fromISO || !toISO) return null;
  const a = parseLocalMidnight(fromISO);
  const b = parseLocalMidnight(toISO);
  if (!a || !b) return null;
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
};

const addDaysISO = (dateStr, days) => {
  if (!dateStr) return '';
  const date = parseLocalMidnight(dateStr);
  date.setDate(date.getDate() + Number(days || 0));
  const z = n => ('0' + n).slice(-2);
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
};

// Função inteligente para calcular data final
const addMonths = (dateStr, months) => {
  if (!dateStr) return '';
  const date = parseLocalMidnight(dateStr);
  date.setMonth(date.getMonth() + parseInt(months));
  const z = n => ('0' + n).slice(-2);
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
};

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

// --- LÓGICA DE STATUS ---
const getComputedStatus = (record, todayISO) => {
  if (record.status === 'Pausado') {
    return { label: 'Pausado', color: 'bg-black text-white border-gray-600', sortOrder: 0 };
  }

  const payDateStr = normalizeDate(record.payDate);
  const startDateStr = normalizeDate(record.startDate);
  const dueDateStr = normalizeDate(record.dueDate);
  const dToday = parseLocalMidnight(todayISO);

  // CASO 1: PAGOU MAS NÃO TEM DATA DE INÍCIO (Recém Lançado)
  if (payDateStr && !startDateStr) {
    return { label: 'Pago e não iniciado', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', sortOrder: 1 };
  }

  // CASO 2: TEM VENCIMENTO DEFINIDO
  if (dueDateStr) {
    const dDue = parseLocalMidnight(dueDateStr);
    const diffTime = dToday.getTime() - dDue.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 30) return { label: 'Inativo', color: 'bg-red-600 text-white border-red-700', sortOrder: 5 };
    if (diffDays > 0) return { label: 'Vencido', color: 'bg-[#850000] text-white border-red-900', sortOrder: 4 };
    if (dToday.getMonth() === dDue.getMonth() && dToday.getFullYear() === dDue.getFullYear()) {
      return { label: 'Renova esse mês', color: 'bg-orange-100 text-orange-800 border-orange-300', sortOrder: 3 };
    }
    return { label: 'Ativo', color: 'bg-green-100 text-green-800 border-green-300', sortOrder: 6 };
  }

  // CASO 3: SEM DATA E SEM PAGAMENTO
  return { label: 'PENDENTE', color: 'bg-gray-100 text-gray-500', sortOrder: 9 };
};

// --- SERVIÇOS ---
const FinancialService = {
  async createContractWithInstallments(baseData, installmentsData) {
    const batch = writeBatch(db);
    installmentsData.forEach(inst => {
      const recordRef = doc(collection(db, 'payments'));
      batch.set(recordRef, {
        ...inst,
        payDate: normalizeDate(inst.payDate),
        startDate: normalizeDate(inst.startDate),
        dueDate: normalizeDate(inst.dueDate),
        createdAt: serverTimestamp()
      });
    });
    await batch.commit();
  },

  async updateRecord(recordId, data) {
    const ref = doc(db, 'payments', recordId);
    return updateDoc(ref, {
      ...data,
      payDate: normalizeDate(data.payDate),
      startDate: normalizeDate(data.startDate),
      dueDate: normalizeDate(data.dueDate),
    });
  },

  async deleteRecord(recordId) {
    return deleteDoc(doc(db, 'payments', recordId));
  },

  async settlePayment(recordId, payDate) {
    const ref = doc(db, 'payments', recordId);
    return updateDoc(ref, { payDate: normalizeDate(payDate) });
  },

  // ✅ NOVAS FUNÇÕES AUDITADAS (COLA AQUI)
  async createPlanAudited(data, who = "admin") {
    const batch = writeBatch(db);

    const planRef = doc(collection(db, 'plans'));
    const auditRef = doc(collection(db, 'audit_logs'));

    batch.set(planRef, { ...data, createdAt: serverTimestamp() });

    batch.set(auditRef, {
      action: "CRIOU_PLANO",
      entity: "PLAN",
      entityId: planRef.id,
      planName: data.name || "",
      netValue: Number(data.netValue) || 0,
      note: `Criou plano (${data.durationMonths} meses • ${data.paymentMethod} • cor ${data.color})`,
      who,
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return planRef;
  },

  async updatePlanAudited(planId, beforePlan, data, who = "admin") {
    const batch = writeBatch(db);

    const planRef = doc(db, 'plans', planId);
    const auditRef = doc(collection(db, 'audit_logs'));

    const changes = {};
    ['name', 'durationMonths', 'paymentMethod', 'grossValue', 'netValue', 'color'].forEach((k) => {
      const before = beforePlan?.[k];
      const after = data[k];
      if (String(before ?? '') !== String(after ?? '')) {
        changes[k] = { from: before ?? null, to: after ?? null };
      }
    });

    batch.update(planRef, data);

    batch.set(auditRef, {
      action: "EDITOU_PLANO",
      entity: "PLAN",
      entityId: planId,
      planName: data.name || beforePlan?.name || "",
      netValue: Number(data.netValue) || 0,
      note: "Edição de plano (Gerenciar Planos)",
      changes,
      who,
      createdAt: serverTimestamp()
    });

    await batch.commit();
  },

  async deletePlanAudited(planId, planName, who = "admin") {
    const q = query(collection(db, 'payments'), where('planType', '==', planName), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      throw new Error(`BLOQUEADO: O plano "${planName}" não pode ser excluído pois existem registros financeiros vinculados a ele.`);
    }

    const batch = writeBatch(db);
    const planRef = doc(db, 'plans', planId);
    const auditRef = doc(collection(db, 'audit_logs'));

    batch.delete(planRef);

    batch.set(auditRef, {
      action: "EXCLUIU_PLANO",
      entity: "PLAN",
      entityId: planId,
      planName: planName || "",
      note: "Exclusão de plano (Gerenciar Planos)",
      who,
      createdAt: serverTimestamp()
    });

    await batch.commit();
  }
};

// Substitua o componente DashboardCard antigo por este:
const DashboardCard = ({
  title,
  value,
  subtext,
  icon: Icon,
  // 1. Mudamos o padrão para o fundo escuro (Surface) e borda escura
  colorClass = "bg-ebony-surface border-ebony-border",
  // 2. Texto padrão agora é Branco
  textClass = "text-white"
}) => (
  // Nota: removemos 'border-slate-200' fixo e deixamos apenas 'border' genérico
  // para que o colorClass controle a cor da borda.
  <div className={`${colorClass} p-6 rounded-xl shadow-sm border flex items-start justify-between relative overflow-hidden`}>
    <div className="relative z-10">
      {/* 3. Títulos e subtítulos agora usam ebony-muted para melhor contraste */}
      <p className="text-[10px] font-black uppercase tracking-widest text-ebony-muted mb-1">{title}</p>
      <h3 className={`text-2xl font-black ${textClass}`}>{value}</h3>
      {subtext && <p className="text-[10px] text-ebony-muted mt-1">{subtext}</p>}
    </div>

    {/* 4. O ícone agora tem fundo 'deep' (mais escuro que o card) em vez de preto transparente */}
    <div className="p-3 bg-ebony-deep rounded-lg border border-ebony-border/50">
      <Icon size={20} className={textClass} />
    </div>
  </div>
);

// Garanta que tem o import lá em cima: import { getAuth } from 'firebase/auth';

const logAudit = async (payload) => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    // Proteção: Se tiver usuário e e-mail, usa o e-mail. Senão, usa genérico.
    const quemFez = (user && user.email) ? user.email : "usuario_desconhecido";

    // Atenção: mantive a coleção 'audit_logs' que é a original do seu sistema
    await addDoc(collection(db, 'audit_logs'), {
      ...payload, // Espalha os dados que o sistema enviou (action, studentName, etc)
      createdAt: serverTimestamp(),
      who: quemFez // Salva o E-MAIL aqui
    });
  } catch (e) {
    console.error("Aviso: Falha ao registrar auditoria", e);
    // O catch vazio evita que o erro trave a tela do usuário
  }
};

// --- COMPONENTE PRINCIPAL ---
export default function FinancialModule({ onReloadData }) {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const fns = getFunctions();
        const listarAlunos = httpsCallable(fns, 'listarAlunos');
        const result = await listarAlunos({ search: "", limit: 30 });
        const mapped = (result.data?.list || []).map(a => ({
          id: a.name,
          name: a.nome_completo,
          email: a.email,
          phone: a.telefone,
        }));
        setStudents(mapped);
      } catch(e) {
        console.error("Erro ao carregar alunos:", e);
      }
    })();
  }, []);
  // 1) STATES
  const [records, setRecords] = useState([]);
  const [viewMode, setViewMode] = useState('records');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({ search: "", status: "all", plan: "all" });
  const [sortType, setSortType] = useState("date_asc");

  const [studentQuery, setStudentQuery] = useState("");
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);

  const [dateMode, setDateMode] = useState("month"); // "month" | "custom"

  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [dirtySnapshotIds, setDirtySnapshotIds] = useState([]);

  const markSnapshotDirty = (id) => {
    if (!id) return;
    setDirtySnapshotIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  // ✅ primeiro define selectedMonth
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const z = (n) => ("0" + n).slice(-2);
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}`; // YYYY-MM
  });

  const getRangeFromMonth = (ym) => {
    if (!ym) return null;
    const [y, m] = ym.split("-").map(Number);
    const z = (n) => ("0" + n).slice(-2);
    const lastDay = new Date(y, m, 0).getDate(); // m aqui é 1-12
    return {
      start: `${y}-${z(m)}-01`,
      end: `${y}-${z(m)}-${z(lastDay)}`
    };
  };

  // ✅ agora sim pode usar selectedMonth
  const monthLabel = useMemo(() => {
    if (!selectedMonth) return "MÊS";
    const [y, m] = selectedMonth.split("-").map(Number);
    const abbr = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"][m - 1] || "MÊS";
    return `${abbr}/${String(y).slice(2)}`; // ex: JAN/26
  }, [selectedMonth]);

  const monthRef = useRef(null);

  // 2) dateRange (continua existindo)
  const [dateRange, setDateRange] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-11
    const lastDay = new Date(y, m + 1, 0).getDate();
    const z = (n) => ("0" + n).slice(-2);
    return {
      start: `${y}-${z(m + 1)}-01`,
      end: `${y}-${z(m + 1)}-${z(lastDay)}`
    };
  });

  // ✅ quando estiver em modo month, sincroniza dateRange automaticamente
  useEffect(() => {
    if (dateMode !== "month") return;
    const r = getRangeFromMonth(selectedMonth);
    if (r) setDateRange(r);
  }, [selectedMonth, dateMode]);


  // --- GERADOR DE PDF (AGORA ELE ESTÁ FORA DO useState, ISSO CORRIGE O ERRO) ---
  const generatePDF = () => {
    const doc = new jsPDF();

    // --- 1. CÁLCULO DE MÉTRICAS DO RELATÓRIO ---
    let novosAlunos = 0;
    let renovacoes = 0;
    let naoRenovaram = 0;
    let totalRecebido = 0;

    // Listas para as tabelas
    const realizados = [];
    const pendentes = [];

    records.forEach(r => {
      const payISO = normalizeDate(r.payDate);
      const dueISO = normalizeDate(r.dueDate);
      const startISO = normalizeDate(r.startDate);

      const isPayInRange = payISO && isBetweenInclusive(payISO, dateRange.start, dateRange.end);
      const isDueInRange = dueISO && isBetweenInclusive(dueISO, dateRange.start, dateRange.end);
      const isStartInRange = startISO && isBetweenInclusive(startISO, dateRange.start, dateRange.end);

      // Métricas de Fluxo
      if (isStartInRange) novosAlunos++;

      // Lógica de Renovação (Baseada em Vencimentos no Período)
      if (isDueInRange) {
        if (r.payDate) {
          renovacoes++;
        } else {
          // Se venceu no período e não pagou (ou está Inativo/Vencido)
          naoRenovaram++;
        }
      }

      // Separação para as Tabelas
      const status = getComputedStatus(r, dateRange.end).label;
      const alunoNome = studentsMap[r.studentId]?.name || r.studentName || '-';
      const planoNome = r.planType || '-';
      const valorF = formatCurrency(r.netValue);

      // Tabela 1: O que entrou (Realizado)
      if (isPayInRange) {
        totalRecebido += parseFloat(r.netValue || 0);
        realizados.push([
          formatDateBr(payISO),
          alunoNome,
          planoNome,
          "Pago",
          valorF
        ]);
      }

      // Tabela 2: O que venceu/vence no período (Previsão/Pendências/Vencidos)
      if (isDueInRange) {
        pendentes.push([
          formatDateBr(dueISO),
          alunoNome,
          planoNome,
          r.payDate ? "Pago" : "Pendente",
          valorF
        ]);
      }
    });

    // --- 2. DESENHO DO PDF ---

    // Cabeçalho
    doc.setFontSize(18);
    doc.text("Relatório Financeiro - Ebony Team", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${formatDateBr(dateRange.start)} até ${formatDateBr(dateRange.end)}`, 14, 27);
    doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 32);

    // Bloco de Métricas (Caixas)
    doc.setDrawColor(200);
    doc.setFillColor(245, 247, 250);

    // Configuração das Caixas
    const startY = 40;
    const boxWidth = 45;
    const gap = 5;

    const drawCard = (x, title, value, color = [0, 0, 0]) => {
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(x, startY, boxWidth, 20, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(title, x + 2, startY + 6);
      doc.setFontSize(12);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFont("helvetica", "bold");
      doc.text(String(value), x + 2, startY + 15);
      doc.setFont("helvetica", "normal");
    };

    drawCard(14, "FATURAMENTO", formatCurrency(totalRecebido), [22, 163, 74]); // Verde
    drawCard(14 + boxWidth + gap, "NOVOS ALUNOS", novosAlunos);
    drawCard(14 + (boxWidth + gap) * 2, "RENOVAÇÕES", renovacoes, [37, 99, 235]); // Azul
    drawCard(14 + (boxWidth + gap) * 3, "NÃO RENOVARAM", naoRenovaram, [220, 38, 38]); // Vermelho

    // Tabela 1: Realizados
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Extrato de Entradas (Realizado)", 14, 75);

    autoTable(doc, {
      startY: 80,
      head: [['Data Pag.', 'Aluno', 'Plano', 'Status', 'Valor Líq.']],
      body: realizados,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 0, 0] }
    });

    // Tabela 2: Previsão/Vencimentos
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.text("Fluxo de Vencimentos (Renovações e Pendências)", 14, finalY - 5);

    autoTable(doc, {
      startY: finalY,
      head: [['Vencimento', 'Aluno', 'Plano', 'Situação', 'Valor Previsto']],
      body: pendentes,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [70, 70, 70] }
    });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Sistema Ebony - Uso interno e confidencial', 105, 290, null, null, "center");
    }

    doc.save(`financeiro_ebony_${dateRange.start}.pdf`);
  };

  // MODAIS E DADOS (Trazidos de baixo para cima)
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]); // Agora existe antes do useEffect!
  const [modalOpen, setModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // ✅ Modal de Renovação (topo)
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewQuery, setRenewQuery] = useState("");
  const [renewSelectedId, setRenewSelectedId] = useState("");
  const [renewDropdownOpen, setRenewDropdownOpen] = useState(false);

  const renewCandidates = useMemo(() => {
    const q = (renewQuery || "").trim().toLowerCase();
    const list = (students || []);

    if (!q) return list.slice(0, 30);

    return list
      .filter(s => {
        const name = (s.name || "").toLowerCase();
        const phone = String(s.phone || "");
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 30);
  }, [students, renewQuery]);

  const confirmRenew = () => {
    const sid = renewSelectedId;
    if (!sid) {
      alert("Seleciona a aluna antes de renovar.");
      return;
    }
    const name = studentsMap[sid]?.name || (students || []).find(s => s.id === sid)?.name || "Aluno";
    setRenewModalOpen(false);
    setRenewDropdownOpen(false);
    handleRenew({ id: sid, name });
  };

  const [currentRecord, setCurrentRecord] = useState(null);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState(null);
  const [formData, setFormData] = useState({});
  // --- VÍNCULOS NO MODAL DO FINANCEIRO ---
  const [linkedStudents, setLinkedStudents] = useState([]);  // selecionados no modal
  const [linkSearchTerm, setLinkSearchTerm] = useState("");  // busca
  const [originalLinkedIds, setOriginalLinkedIds] = useState([]); // vínculos "antes" (pra comparar)
  const [linksOverride, setLinksOverride] = useState({});    // pra refletir na UI do financeiro sem reload
  const [linksPanelOpen, setLinksPanelOpen] = useState(false); // ✅ painel retrátil do vínculo

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [lastRecordWarning, setLastRecordWarning] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [todayISO, setTodayISO] = useState(getTodayISO());
  useEffect(() => {
    const t = setTimeout(() => {
      (async () => {
        try {
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const fns = getFunctions();
          const listarAlunos = httpsCallable(fns, 'listarAlunos');
          const result = await listarAlunos({ search: filters.search, limit: 30 });
          const mapped = (result.data?.list || []).map(a => ({
            id: a.name,
            name: a.nome_completo,
            email: a.email,
            phone: a.telefone,
          }));
          setStudents(mapped);
        } catch(e) {
          console.error("Erro ao carregar alunos:", e);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  useEffect(() => {
    const t = setTimeout(() => {
      (async () => {
        try {
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const fns = getFunctions();
          const listarAlunos = httpsCallable(fns, 'listarAlunos');
          const result = await listarAlunos({ search: studentQuery, limit: 30 });
          const mapped = (result.data?.list || []).map(a => ({
            id: a.name,
            name: a.nome_completo,
            email: a.email,
            phone: a.telefone,
          }));
          setStudents(mapped);
        } catch(e) {
          console.error("Erro ao carregar alunos:", e);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [studentQuery]);
  useEffect(() => {
    setLoading(true);

    const qPayments = query(
      collection(db, "payments"),
      orderBy("createdAt", "desc")
    );

    const unsubPayments = onSnapshot(
      qPayments,
      (snap) => {
        setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        alert("ERRO ao carregar pagamentos: " + (err?.message || err));
        setLoading(false);
      }
    );

    const qPlans = query(
      collection(db, "plans"),
      orderBy("name", "asc")
    );

    const unsubPlans = onSnapshot(
      qPlans,
      (snap) => {
        setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error(err);
        alert("ERRO ao carregar planos: " + (err?.message || err));
      }
    );

    const qAudit = query(
      collection(db, "audit_logs"),
      orderBy("createdAt", "desc"),
      limit(300)
    );

    const unsubAudit = onSnapshot(
      qAudit,
      (snap) => {
        setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error(err);
        alert("ERRO ao carregar auditoria: " + (err?.message || err));
      }
    );

    return () => {
      unsubPayments();
      unsubPlans();
      unsubAudit();
    };
  }, []);

  const studentsMap = useMemo(() => {
    const map = {};
    (students || []).forEach(s => {
      const override = linksOverride[s.id];
      map[s.id] = override ? { ...s, linkedStudentIds: override } : s;
    });
    return map;
  }, [students, linksOverride]);
  const filteredStudentsForPicker = useMemo(() => {
    const q = (studentQuery || "").trim().toLowerCase();
    if (!q) return (students || []).slice(0, 30);

    return (students || [])
      .filter(s => {
        const name = (s.name || "").toLowerCase();
        const phone = String(s.phone || "");
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 30);
  }, [students, studentQuery]);
  useEffect(() => {
    if (!modalOpen) return;

    const sid = formData.studentId;
    if (!sid) {
      setLinkedStudents([]);
      setLinkSearchTerm("");
      setOriginalLinkedIds([]);
      return;
    }   

    const prof = studentsMap[sid];
    const ids = Array.isArray(prof?.linkedStudentIds) ? prof.linkedStudentIds : [];

    const found = (students || [])
      .filter(s => ids.includes(s.id))
      .map(s => ({ id: s.id, name: s.name, phone: s.phone }));

    setLinkedStudents(found);
    setOriginalLinkedIds(ids);
  }, [modalOpen, formData.studentId, students, studentsMap]);

  useEffect(() => {
    if (!modalOpen || currentRecord || !formData.studentId) {
      setLastRecordWarning(null);
      return;
    }
  
    const studentRecords = records
      .filter(r => r.studentId === formData.studentId)
      .sort((a, b) =>
        (normalizeDate(b.dueDate) || '').localeCompare(normalizeDate(a.dueDate) || '')
      );
  
    const last = studentRecords[0] || null;
    setLastRecordWarning(last);
  }, [formData.studentId, modalOpen, currentRecord, records]);

  const renewalIndex = useMemo(() => {
    const map = {};
    records.forEach(r => {
      const fromId = r.renewedFromPaymentId || r.renewedFrom;
      if (!fromId) return;

      const when =
        normalizeDate(r.payDate) ||
        normalizeDate(r.createdAt) ||
        normalizeDate(r.startDate) ||
        null;

      if (!when) return;

      if (!map[fromId] || when < map[fromId]) map[fromId] = when;
    });
    return map;
  }, [records, dirtySnapshotIds]);

  const plansById = useMemo(() => {
    const m = {};
    plans.forEach(p => { m[p.id] = p; });
    return m;
  }, [plans]);

  // --- KPI ENGINE (REGRAS DEFINITIVAS DA SPEC) ---
  const stats = useMemo(() => {
    let revenueReal = 0;
    let forecast = 0;

    const activeStudentIds = new Set();          // só ativo de verdade no mês
    const paidNotStartedStudentIds = new Set();  // pagou mas ainda não iniciou

    let expiringInMonthCount = 0;
    let retainedCount = 0;

    records.forEach(r => {
      const val = parseFloat(r.netValue) || 0;

      const payDate = normalizeDate(r.payDate);
      const start = normalizeDate(r.startDate);
      const due = normalizeDate(r.dueDate);

      // 1) Caixa: entrou no período
      if (payDate && isBetweenInclusive(payDate, dateRange.start, dateRange.end)) {
        revenueReal += val;
      }

      // Ignora pausado
      if (r.status === 'Pausado') return;

      // 2) Forecast: quem vence no período (se todos renovarem)
      if (due && isBetweenInclusive(due, dateRange.start, dateRange.end)) {
        forecast += val;

        // Base da retenção = quem vence no mês
        expiringInMonthCount++;

        // Retido = renovou até 30 dias depois do vencimento
        const renewalDate = renewalIndex[r.id]; // data que a renovação aconteceu
        const limit = addDaysISO(due, 30);
        if (renewalDate && renewalDate <= limit) {
          retainedCount++;
        }
      }

      // 3) Ativos do mês (plano cobre o mês)
      if (start && due && r.studentId) {
        const coversMonth = (start <= dateRange.end) && (due >= dateRange.start);
        if (coversMonth) activeStudentIds.add(r.studentId);
      }

      // 4) Pago e não iniciado (pagou mas não colocou início)
      if (r.studentId && payDate && !start) {
        paidNotStartedStudentIds.add(r.studentId);
      }
    });

    const retentionRate = expiringInMonthCount > 0
      ? Math.round((retainedCount / expiringInMonthCount) * 100)
      : 100;

    // Ativos + Pago e não iniciado (sem duplicar pessoas)
    const union = new Set([...activeStudentIds, ...paidNotStartedStudentIds]);

    return {
      revenueReal,
      forecast,
      active: activeStudentIds.size,
      activePlusPaidNotStarted: union.size,
      retention: retentionRate
    };
  }, [records, dateRange, renewalIndex]);


  // FILTRAGEM TELA 1 - FINANCEIRO PURO
  const filteredRecords = useMemo(() => records.filter(r => {
    // 1. BUSCA (SUPERPODER - MODO AUDITORIA)
    const sName = studentsMap[r.studentId]?.name || r.studentName || '';
    const searchTerm = filters.search.trim().toLowerCase();

    // Se digitou nome, MOSTRA TUDO (Histórico completo), ignorando datas e status.
    if (searchTerm) {
      return sName.toLowerCase().includes(searchTerm);
    }

    // --- REGRAS DE RELATÓRIO MENSAL (Sem busca) ---

    // Datas
    const payISO = normalizeDate(r.payDate);
    const dueISO = normalizeDate(r.dueDate);

    // Filtro Opcional: "Pagos no Período" (Atalho de Caixa)
    if (filters.status === 'paid_in_period') {
      if (!payISO) return false;
      return isBetweenInclusive(payISO, dateRange.start, dateRange.end);
    }

    // STATUS DE LANÇAMENTO (Puro Financeiro)
    // Se não é busca nem "pago no período", aplicamos a lógica de "Pertence ao Mês?"
    // Um lançamento pertence ao mês financeiro se:
    // A) Venceu neste mês (Previsão)
    // B) Foi Pago neste mês (Caixa)

    const isDueInMonth = dueISO && isBetweenInclusive(dueISO, dateRange.start, dateRange.end);
    const isPaidInMonth = payISO && isBetweenInclusive(payISO, dateRange.start, dateRange.end);
    const computed = getComputedStatus(r, todayISO);
    if (filters.status === 'Pausado') {
      return computed.label === 'Pausado';
    }
    // Se o registro não tem Vencimento nem Pagamento dentro do mês, esconde.
    // (Isso remove alunos ativos que pagaram mês passado e só vencem mês que vem da lista financeira)
    if (!isDueInMonth && !isPaidInMonth) return false;


    // Filtros Específicos da UI
    if (filters.status !== 'all') {

      // ✅ já existe computed aqui em cima: const computed = getComputedStatus(r, todayISO);

      if (filters.status === 'Pago e não iniciado') {
        if (computed.label !== 'Pago e não iniciado') return false;
      }

      // Mapeamento simples para a visão financeira
      if (filters.status === 'Pendente' && r.payDate) return false;
      if (filters.status === 'Pago' && !r.payDate) return false;

      // ✅ inclui "Renova esse mês" aqui também
      if (['Ativo', 'Vencido', 'Pausado', 'Renova esse mês'].includes(filters.status)) {
        if (computed.label !== filters.status) return false;
      }
    }

    // Filtro de Plano
    if (filters.plan !== 'all') {
      if (r.planType !== filters.plan) return false;
    }

    return true;
  }).sort((a, b) => {
    const aDue = normalizeDate(a.dueDate) || '';
    const bDue = normalizeDate(b.dueDate) || '';

    const aName = (studentsMap[a.studentId]?.name || a.studentName || '').toLowerCase();
    const bName = (studentsMap[b.studentId]?.name || b.studentName || '').toLowerCase();

    // Dia do mês (1→31)
    const aDay = aDue ? parseInt(aDue.slice(8, 10), 10) : 99;
    const bDay = bDue ? parseInt(bDue.slice(8, 10), 10) : 99;

    if (sortType === "date_desc") return (bDue || '0000-00-00').localeCompare(aDue || '0000-00-00');
    if (sortType === "day_asc") return aDay - bDay;
    if (sortType === "alpha_asc") return aName.localeCompare(bName);

    // padrão: date_asc (Jan→Dez)
    return (aDue || '9999-99-99').localeCompare(bDue || '9999-99-99');
  }), [records, filters, studentsMap, dateRange, todayISO, sortType]);

  // --- ENGINE DA FASE 2: GESTÃO DE ALUNOS ---
  const managementData = useMemo(() => {
    const studentMap = new Map();

    // 1) Base: todos alunos do cadastro
    Object.values(studentsMap).forEach(s => {
      studentMap.set(s.id, {
        id: s.id,
        name: s.name,
        photo: s.photo,
        statusInMonth: 'Inativo',
        planInMonth: '-',
        dueDateInMonth: null,
        lastPayment: null,
        isPausedGlobal: s.status === 'paused' || s.status === 'Pausado',
        records: []
      });
    });

    // 2) Cola os lançamentos dentro de cada aluno + acha último pagamento + marca pausado se existir lançamento pausado
    records.forEach(r => {
      if (!r.studentId) return;
      if (!studentMap.has(r.studentId)) return;

      const s = studentMap.get(r.studentId);
      s.records.push(r);

      // Se existir qualquer lançamento pausado, a gestão trata como pausado
      if (r.status === 'Pausado') s.isPausedGlobal = true;

      const payISO = normalizeDate(r.payDate);
      if (payISO) {
        if (!s.lastPayment || payISO > normalizeDate(s.lastPayment.date)) {
          s.lastPayment = { date: r.payDate, value: r.netValue };
        }
      }
    });

    const isInSelectedMonth = (iso) =>
      iso && isBetweenInclusive(iso, dateRange.start, dateRange.end);

    const pickActiveRecordInMonth = (recs) => {
      const candidates = recs.filter(r => {
        const start = normalizeDate(r.startDate);
        const due = normalizeDate(r.dueDate);
        if (!start || !due) return false;
        return (start <= dateRange.end) && (due >= dateRange.start);
      });

      candidates.sort((a, b) => {
        const aStart = normalizeDate(a.startDate) || '';
        const bStart = normalizeDate(b.startDate) || '';
        if (bStart !== aStart) return bStart.localeCompare(aStart);

        const aDue = normalizeDate(a.dueDate) || '';
        const bDue = normalizeDate(b.dueDate) || '';
        return bDue.localeCompare(aDue);
      });

      return candidates[0] || null;
    };

    const pickExpiringRecordInMonth = (recs) => {
      const candidates = recs.filter(r => {
        const due = normalizeDate(r.dueDate);
        return isInSelectedMonth(due);
      });

      // pega o que vence mais “pra frente” dentro do mês
      candidates.sort((a, b) =>
        (normalizeDate(b.dueDate) || '').localeCompare(normalizeDate(a.dueDate) || '')
      );

      return candidates[0] || null;
    };

    const findRenewalForExpiring = (recs, expiring) => {
      if (!expiring?.id) return null;

      const expId = expiring.id;
      const expDue = normalizeDate(expiring.dueDate);
      if (!expDue) return null;

      const limitISO = addDaysISO(expDue, 30);
      const dayAfterISO = addDaysISO(expDue, 1);

      // (A) Caso perfeito: veio linkado
      const linked = recs.find(r => (r.renewedFromPaymentId || r.renewedFrom) === expId);
      if (linked) return linked;

      // (B) Fallback: parece renovação mesmo sem link
      const candidates = recs.filter(r => {
        if (r.id === expId) return false;

        const start = normalizeDate(r.startDate);
        const pay = normalizeDate(r.payDate);
        const due = normalizeDate(r.dueDate);

        // tem cara de "novo ciclo" (novo vencimento > vencimento antigo)
        const dueLooks = due && due > expDue;

        // começou depois do vencimento (até 30 dias) OU pagou depois do vencimento (até 30 dias)
        const startLooks = start && start >= dayAfterISO && start <= limitISO;
        const payLooks = pay && pay >= expDue && pay <= limitISO;

        return dueLooks && (startLooks || payLooks);
      });

      // pega a renovação “mais próxima” do vencimento (a primeira que aconteceu)
      candidates.sort((a, b) => {
        const aWhen = normalizeDate(a.payDate) || normalizeDate(a.startDate) || normalizeDate(a.createdAt) || '9999-99-99';
        const bWhen = normalizeDate(b.payDate) || normalizeDate(b.startDate) || normalizeDate(b.createdAt) || '9999-99-99';
        return aWhen.localeCompare(bWhen);
      });

      return candidates[0] || null;
    };

    // 3) Decide o status final de cada aluno no mês
    let list = Array.from(studentMap.values()).map(s => {
      const recs = s.records || [];

      // Pausado sempre ganha (independente de mês)
      if (s.isPausedGlobal) {
        s.statusInMonth = 'Pausado';

        // opcional: não deixa vazio
        const any = recs[0];
        if (any) {
          s.planInMonth = any.planName || any.planType || s.planInMonth;
          s.dueDateInMonth = any.dueDate || s.dueDateInMonth;
        }

        return s;
      }

      const expiring = pickExpiringRecordInMonth(recs);
      const activeInMonth = pickActiveRecordInMonth(recs);

      // Se vence no mês, esse aluno “entra na regra do triângulo”
      if (expiring) {
        const expDue = normalizeDate(expiring.dueDate);
        const limit = addDaysISO(expDue, 30);
        const passou30 = todayISO > limit;

        const renewal = findRenewalForExpiring(recs, expiring);

        if (renewal) {
          // Renovou (mesmo atrasado) -> ATIVO
          s.statusInMonth = 'Ativo';
          s.planInMonth =
            renewal.planName || renewal.planType ||
            activeInMonth?.planName || activeInMonth?.planType ||
            expiring.planName || expiring.planType || '-';

          s.dueDateInMonth =
            renewal.dueDate || activeInMonth?.dueDate || expiring.dueDate || null;

        } else {
          // Não renovou ainda
          s.statusInMonth = passou30 ? 'Não renovou' : 'Renova';
          s.planInMonth = expiring.planName || expiring.planType || '-';
          s.dueDateInMonth = expiring.dueDate || null;
        }

        return s;
      }

      // Se não vence no mês, mas tem plano cobrindo o mês -> ATIVO
      if (activeInMonth) {
        s.statusInMonth = 'Ativo';
        s.planInMonth = activeInMonth.planName || activeInMonth.planType || '-';
        s.dueDateInMonth = activeInMonth.dueDate || null;
        return s;
      }

      s.statusInMonth = 'Inativo';
      return s;
    });

    // 4) Busca
    const searchTerm = (filters.search || "").trim().toLowerCase();
    if (searchTerm) {
      return list.filter(s => (s.name || "").toLowerCase().includes(searchTerm));
    }

    // 5) Filtros (mantém sua lógica)
    list = list.filter(s => {
      if (s.statusInMonth === 'Inativo' && !s.isPausedGlobal) return false;

      if (filters.status === 'all') return true;
      if (filters.status === 'Pausado') return s.statusInMonth === 'Pausado';
      if (filters.status === 'Ativo') return s.statusInMonth === 'Ativo';
      if (filters.status === 'Renova esse mês') return s.statusInMonth === 'Renova';

      return true;
    });

    // 6) Ordenação
    return list.sort((a, b) => {
      const weight = (st) =>
        st === 'Renova' ? 3 :
          st === 'Ativo' ? 2 :
            st === 'Pausado' ? 1 : 0;

      return weight(b.statusInMonth) - weight(a.statusInMonth);
    });
  }, [records, studentsMap, dateRange, filters, todayISO]);

  // --- LÓGICA DE SNAPSHOT (CORRIGIDA PARA LIMPAR O DASHBOARD) ---
  const computeSnapshotForStudent = (studentId) => {
    if (!studentId) return null;

    const recs = records.filter(r => r.studentId === studentId);

    // CENÁRIO 1: SEM REGISTROS (Apagou tudo)
    // Aqui forçamos null para limpar o Dashboard
    if (!recs.length) {
      return {
        finStatus: "Sem plano",
        finDueDate: null,
        finPlanName: null,  // Limpa o nome
        finPlanId: null,    // Limpa o ID
        finPlanColor: null, // Remove a cor (volta pro cinza)
      };
    }

    // 2) Se tiver QUALQUER lançamento pausado, Pausado ganha.
    const isPaused = recs.some(r => r.status === "Pausado");
    if (isPaused) {
      const any = [...recs].sort((a, b) => (normalizeDate(b.dueDate) || "").localeCompare(normalizeDate(a.dueDate) || ""))[0];
      const planName = any?.planName || any?.planType || null;
      const planColor = plans.find(p => p.name === planName)?.color || "slate";

      return {
        finStatus: "Pausado",
        finDueDate: normalizeDate(any?.dueDate) || null,
        finPlanName: planName,
        finPlanId: any?.planId || null,
        finPlanColor: planColor,
      };
    }

    // 3) Pega o contrato mais relevante (Ativo > Vencido)
    const best = [...recs].sort((a, b) => {
      const aDue = normalizeDate(a.dueDate) || "";
      const bDue = normalizeDate(b.dueDate) || "";
      if (bDue !== aDue) return bDue.localeCompare(aDue);
      return (normalizeDate(b.payDate) || "").localeCompare(normalizeDate(a.payDate) || "");
    })[0];

    const pay = normalizeDate(best.payDate);
    const start = normalizeDate(best.startDate);
    const due = normalizeDate(best.dueDate);

    const planName = best.planName || best.planType || null;
    const planColor = plans.find(p => p.name === planName)?.color || "slate";

    let finStatus = "Sem plano";

    if (pay && !start) {
      finStatus = "Pago e não iniciado";
    } else if (due) {
      if (due < todayISO) {
        const limit = addDaysISO(due, 30);
        finStatus = todayISO > limit ? "Não renovou" : "Vencido";
      } else {
        const days = diffDaysISO(todayISO, due);
        finStatus = (days !== null && days <= 7) ? "Renova" : "Ativo";
      }
    } else if (planName) {
      finStatus = "Sem venc.";
    }

    return {
      finStatus,
      finDueDate: due || null,
      finPlanName: planName,
      finPlanId: best.planId || null,
      finPlanColor: planColor,
    };
  };

  // EFEITO QUE SALVA NO BANCO (CORRIGIDO PARA ESPELHAR NO DASHBOARD)
  useEffect(() => {
    if (!dirtySnapshotIds.length) return;

    const ids = [...new Set(dirtySnapshotIds)];
    setDirtySnapshotIds([]);

    // No Alesson os alunos vêm do Frappe — snapshot não se aplica
  setDirtySnapshotIds([]);
}, [dirtySnapshotIds]);


  // STATS ESPECÍFICOS DA GESTÃO
  const managementStats = useMemo(() => {
    const active = stats.active;
    const paused = managementData.filter(s => s.isPausedGlobal).length;
    const renews = managementData.filter(s => s.statusInMonth === 'Renova').length;
    const lost = managementData.filter(s => s.statusInMonth === 'Não renovou').length;

    return { active, paused, renews, lost };
  }, [studentsMap, stats.active, managementData]);


  // INTELIGÊNCIA DE SELEÇÃO DE PLANO
  const handleSelectPlan = (planId) => {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setFormData(prev => ({
        ...prev,
        planId: plan.id,
        planType: plan.name,
        paymentMethod: plan.paymentMethod,
        grossValue: plan.grossValue,
        netValue: plan.netValue,
        durationMonths: plan.durationMonths, // Salva a duração para usar depois
        status: 'Pago e não iniciado', // Regra de Ouro
        payDate: todayISO,
        startDate: '', // Limpo de propósito
        dueDate: ''    // Limpo de propósito
      }));
    }
  };

  const closeLaunchModal = () => {
    setModalOpen(false);

    // ✅ Opção A: resetar sempre
    setLinksPanelOpen(false);
    setLinkSearchTerm("");
    setStudentDropdownOpen(false);
    setStudentQuery("");

    // limpa seleção de vínculos (evita “fantasma” no próximo lançamento)
    setLinkedStudents([]);
    setOriginalLinkedIds([]);

    // opcional, mas ajuda a evitar “editar antigo”
    setCurrentRecord(null);
    setLastRecordWarning(null);
    setFormData({});
  };

  // INTELIGÊNCIA DE DATA FINAL E STATUS
  const handleStartDateChange = (e) => {
    const newStart = e.target.value;
    let newDue = formData.dueDate;
    let newStatus = formData.status;

    // 1. Se tiver duração salva, calcula o vencimento sozinho
    if (formData.durationMonths) {
      newDue = addMonths(newStart, formData.durationMonths);
    }

    // 2. Se preencheu a data de início, já muda o status para ATIVO automaticamente
    if (newStart) {
      newStatus = 'Ativo';
    }

    setFormData(prev => ({
      ...prev,
      startDate: newStart,
      dueDate: newDue,
      status: newStatus // Atualiza o dropdown visualmente
    }));
  };

  // --- INTELIGÊNCIA DE RENOVAÇÃO (FASE 3) ---
  const handleRenew = (studentSummary) => {
    // 1. Acha o último registro desse aluno para pegar os dados do plano anterior
    // (A engine de gestão já nos dá o 'lastPayment', mas vamos pegar o registro completo dos 'records')

    // Filtra registros desse aluno e ordena pelo vencimento (mais futuro primeiro)
    const studentRecords = records
      .filter(r => r.studentId === studentSummary.id)
      .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));

    const lastRecord = studentRecords[0]; // O contrato mais recente (que está vencendo ou venceu)

    // Se não tiver registro anterior, abre como novo normal
    if (!lastRecord) {
      setFormData({
        studentId: studentSummary.id,
        studentName: studentSummary.name,
        status: 'Ativo'
      });
      setStudentQuery(studentSummary.name);
      setModalOpen(true);
      return;
    }

    // 2. Calcula as Novas Datas
    // Data Início = Vencimento Anterior + 1 Dia (Continuidade Perfeita)
    let newStart = todayISO;
    let newDue = '';

    if (lastRecord.dueDate) {
      const dLastDue = parseLocalMidnight(lastRecord.dueDate);
      dLastDue.setDate(dLastDue.getDate() + 1); // Soma 1 dia

      const z = n => ('0' + n).slice(-2);
      newStart = `${dLastDue.getFullYear()}-${z(dLastDue.getMonth() + 1)}-${z(dLastDue.getDate())}`;
    }

    // Tenta achar o plano original para saber a duração
    const originalPlan = plans.find(p => p.name === lastRecord.planType) ||
      plans.find(p => p.id === lastRecord.planId);

    const duration = originalPlan ? originalPlan.durationMonths : 1; // Padrão 1 mês se não achar

    // Calcula novo vencimento
    if (newStart) {
      newDue = addMonths(newStart, duration);
    }

    // 3. Preenche o Modal Automaticamente
    setFormData({
      studentId: studentSummary.id,
      studentName: studentSummary.name,

      renewedFrom: lastRecord.id,

      planId: originalPlan?.id || '',       // Mantém o plano
      planType: lastRecord.planType,        // Mantém o nome
      paymentMethod: lastRecord.paymentMethod, // Mantém o método (ex: Pix)

      grossValue: lastRecord.grossValue,    // Mantém o preço
      netValue: lastRecord.netValue,

      startDate: newStart,  // Já calculado
      dueDate: newDue,      // Já calculado
      durationMonths: duration,

      status: 'Pago e não iniciado', // Sugestão: Já coloca como pago se for renovar na hora, ou 'Pendente'
      payDate: todayISO, // Sugere pagamento hoje

      notes: `Renovação de contrato (Anterior venceu em ${formatDateBr(lastRecord.dueDate)})`
    });

    setStudentQuery(studentSummary.name);
    setStudentDropdownOpen(false);

    // Abre o modal
    setModalOpen(true);
  };
  const openModal = (record = null) => {
    setCurrentRecord(record);

    if (record) {
      setFormData({
        ...record,
        payDate: normalizeDate(record.payDate) || '',
        startDate: normalizeDate(record.startDate) || '',
        dueDate: normalizeDate(record.dueDate) || '',
      });

      const name = studentsMap[record.studentId]?.name || record.studentName || "";
      setStudentQuery(name);
    } else {
      setFormData({
        studentId: '',
        studentName: '',
        planType: 'Mensal',
        paymentMethod: 'Pix',
        startDate: '',
        dueDate: '',
        payDate: '',
        grossValue: '',
        netValue: '',
        status: 'Ativo',
        installments: 1,
        notes: ''
      });

      setStudentQuery("");
    }

    setStudentDropdownOpen(false);
    setLinksPanelOpen(false);
    setLinkSearchTerm("");

    // closeLaunchModal(); <--- REMOVA ESTA LINHA AQUI! ELA QUE ESTÁ ZERANDO TUDO.

    setModalOpen(true);
  };

  const openHistory = (studentId) => {
    const student = studentsMap[studentId];

    const history = records
      .filter(r => r.studentId === studentId)
      .sort((a, b) => {
        const aISO = normalizeDate(a.payDate || a.dueDate) || "";
        const bISO = normalizeDate(b.payDate || b.dueDate) || "";
        return bISO.localeCompare(aISO); // mais recente primeiro
      });

    setSelectedStudentHistory({ student, history });
    setHistoryModalOpen(true); // se teu modal depende disso
  };

  const syncLinkedGroup = async (baseStudentId, newLinkedIds) => {
    const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];

    const cleanNew = uniq(newLinkedIds).filter(id => id !== baseStudentId);
    const group = uniq([baseStudentId, ...cleanNew]);

    // quem saiu (tava antes e não tá mais)
    const removed = uniq(originalLinkedIds).filter(id => !group.includes(id));

    const batch = writeBatch(db);

    // A) cada membro recebe "todos os outros" como linkedStudentIds
    group.forEach(id => {
      const others = group.filter(x => x !== id);
      batch.update(doc(db, "students", id), { linkedStudentIds: others });
    });

    // B) quem saiu perde referências desse grupo (sem apagar outros vínculos que ele possa ter)
    removed.forEach(id => {
      const toRemove = group.filter(x => x !== id);
      if (toRemove.length) {
        batch.update(doc(db, "students", id), { linkedStudentIds: arrayRemove(...toRemove) });
      }
    });

    await batch.commit();

    // Reflete na UI do Financeiro sem depender de reload do Dashboard
    setLinksOverride(prev => {
      const copy = { ...prev };
      group.forEach(id => { copy[id] = group.filter(x => x !== id); });
      removed.forEach(id => { copy[id] = []; }); // visual imediato
      return copy;
    });

    // Atualiza o "antes" pra próxima edição no modal
    setOriginalLinkedIds(group.filter(x => x !== baseStudentId));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (lastRecordWarning && !currentRecord) {
      const dueISO = normalizeDate(lastRecordWarning.dueDate);
      const isStillActive = dueISO && dueISO >= todayISO.slice(0, 7) + '-01';

      if (isStillActive) {
        const conflictPlan = lastRecordWarning.planType || 'plano desconhecido';
        const conflictDue = formatDateBr(dueISO);
        const conflictPay = lastRecordWarning.payDate
          ? `Pago em ${formatDateBr(normalizeDate(lastRecordWarning.payDate))}`
          : 'Ainda não pago';

        const confirmed = window.confirm(
          `⚠️ Esta aluna ainda tem um contrato vigente.\n\nPlano: ${conflictPlan}\nVencimento: ${conflictDue}\nSituação: ${conflictPay}\n\nDeseja lançar mesmo assim?`
        );
        if (!confirmed) return;
      }
    }
    const sId = formData.studentId;
    const sName = studentsMap[sId]?.name || "Aluno Desconhecido";

    // validações de datas...
    const start = (formData.startDate || '').trim();
    const due = (formData.dueDate || '').trim();

    if ((start && !due) || (!start && due)) {
      alert("Você preencheu apenas UMA das datas. Preencha AS DUAS ou deixe AS DUAS vazias.");
      return;
    }
    if (start && due && due < start) {
      alert("Erro: a Data Fim/Vencimento não pode ser ANTES da Data Início.");
      return;
    }

    const baseData = {
      planId: formData.planId || null,
      renewedFromPaymentId: formData.renewedFrom || null,
      studentId: sId,
      studentName: sName,
      planType: formData.planType,
      paymentMethod: formData.paymentMethod,
      grossValue: parseFloat(formData.grossValue),
      netValue: parseFloat(formData.netValue),
      durationMonths: formData.durationMonths || null,
      status: formData.status,
      startDate: formData.startDate,
      dueDate: formData.dueDate,
      payDate: formData.payDate || null,
      notes: formData.notes || ''
    };

    try {
      if (currentRecord) {
        await FinancialService.updateRecord(currentRecord.id, baseData);

        await logAudit({
          action: "EDITOU_LANCAMENTO",
          entity: "PAYMENT",
          entityId: currentRecord.id,
          studentId: sId,
          studentName: sName,
          planName: baseData.planType || "",
          netValue: baseData.netValue || 0,
          payDate: baseData.payDate || "",
          startDate: baseData.startDate || "",
          dueDate: baseData.dueDate || "",
          note: "Alteração manual"
        });
      } else {
        await FinancialService.createContractWithInstallments(baseData, [baseData]);

        const isRenewal = !!baseData.renewedFromPaymentId;

        await logAudit({
          action: isRenewal ? "RENOVOU_CONTRATO" : "CRIOU_LANCAMENTO",
          entity: "PAYMENT",
          entityId: null,
          studentId: sId,
          studentName: sName,
          planName: baseData.planType || "",
          netValue: baseData.netValue || 0,
          payDate: baseData.payDate || "",
          startDate: baseData.startDate || "",
          dueDate: baseData.dueDate || "",
          note: isRenewal ? `Renovou contrato (origem: ${baseData.renewedFromPaymentId})` : "Novo lançamento"
        });
      }

      // 👇👇 CORREÇÃO ROBUSTA (RECUPERA O ID PELO NOME) 👇👇

      // 1. Tenta pegar o ID direto.
      let finalPlanId = baseData.planId;
      let finalPlanObj = plans.find(p => p.id === finalPlanId);

      // 2. SE NÃO TIVER ID (Registro Antigo), PROCURA PELO NOME
      if (!finalPlanObj && baseData.planType) {
        console.log("ID não encontrado, buscando pelo nome:", baseData.planType);
        finalPlanObj = plans.find(p => p.name === baseData.planType);
        if (finalPlanObj) {
          finalPlanId = finalPlanObj.id; // ✅ Achamos o ID!
        }
      }

      // 3. Agora que garantimos o ID, atualizamos o cadastro do Aluno
      // 3. Agora que garantimos o ID, atualizamos o cadastro do Aluno
      if (sId && finalPlanId && finalPlanObj) {
        try {
          const studentRef = doc(db, "students", sId);

          await updateDoc(studentRef, {
            // Dados básicos do plano
            planId: finalPlanId,
            planName: finalPlanObj.name,
            planColor: finalPlanObj.color,

            // ✅ ESPELHO FINANCEIRO (Lógica unificada)
            // REMOVI AS DUPLICATAS QUE ESTAVAM AQUI EM CIMA

            finStatus: (() => {
              if (baseData.status === "Pausado") return "Pausado";

              const due = normalizeDate(baseData.dueDate);
              if (!due) return baseData.status || "Sem plano";

              if (due < todayISO) {
                const limit = addDaysISO(due, 30);
                return todayISO > limit ? "Não renovou" : "Vencido";
              }

              const days = diffDaysISO(todayISO, due);
              if (days <= 7) return "Renova";

              return "Ativo";
            })(),

            // Datas e Meta (AQUI ESTAVAM AS REPETIÇÕES - DEIXEI SÓ UMA VEZ)
            finDueDate: normalizeDate(baseData.dueDate) || null,
            finPlanName: finalPlanObj.name,
            finPlanColor: finalPlanObj.color,
            finUpdatedAt: new Date().toISOString()
          });

        } catch (error) {
          console.error("Erro ao atualizar espelho financeiro:", error);
        }
      }

      // 👇👇 [NOVO] ADICIONE ESTE BLOCO PARA SALVAR OS VÍNCULOS 👇👇
      if (sId) {
        try {
          // Pega apenas os IDs dos alunos selecionados no modal
          const currentLinkedIds = linkedStudents.map(ls => ls.id);

          // Chama a função que sincroniza o grupo (adiciona nos outros e remove de quem saiu)
          await syncLinkedGroup(sId, currentLinkedIds);

          console.log("✅ Vínculos sincronizados via Financeiro!");
        } catch (error) {
          console.error("Erro ao sincronizar vínculos:", error);
        }
      }
      // 👆👆 FIM DO BLOCO NOVO 👆👆
      markSnapshotDirty(sId);
      closeLaunchModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSettle = async (record) => {
    if (!window.confirm("Confirmar baixa no pagamento?")) return;
    await FinancialService.settlePayment(record.id, todayISO);
    markSnapshotDirty(record.studentId);
    await logAudit({
      action: "DEU_BAIXA",
      entity: "PAYMENT",
      entityId: record.id,
      studentId: record.studentId || "",
      studentName: studentsMap[record.studentId]?.name || record.studentName || "",
      planName: record.planType || "",
      netValue: parseFloat(record.netValue) || 0,
      note: `Baixou pagamento para ${todayISO}`
    });
  };

  const handleDeleteRecord = async () => {
    if (!currentRecord) return;

    if (!window.confirm("Apagar registro?")) return;

    try {
      // 1) Apaga
      await FinancialService.deleteRecord(currentRecord.id);
      markSnapshotDirty(currentRecord.studentId);
      // 2) Loga auditoria (depois que deu certo)
      await logAudit({
        action: "EXCLUIU_LANCAMENTO",
        entity: "PAYMENT",
        entityId: currentRecord.id,
        studentId: currentRecord.studentId || "",
        studentName: studentsMap[currentRecord.studentId]?.name || currentRecord.studentName || "",
        planName: currentRecord.planType || "",
        netValue: Number(currentRecord.netValue) || 0,
        startDate: normalizeDate(currentRecord.startDate) || "",
        dueDate: normalizeDate(currentRecord.dueDate) || "",
        payDate: normalizeDate(currentRecord.payDate) || "",
        note: "Exclusão manual via modal (lápis > Excluir)"
      });

      closeLaunchModal();
    } catch (err) {
      alert("Erro ao excluir: " + (err?.message || err));
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando financeiro...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">

      {/* 1. CABEÇALHO COM BOTÕES DE TROCA DE TELA (CORRIGIDO) */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-ebony-border pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Módulo Financeiro</h2>

          {/* Abas internas do Financeiro (padrão do sistema — versão compacta) */}
          <div className="bg-ebony-deep p-1 rounded-xl border border-ebony-border shadow-sm mt-3 overflow-x-auto w-full">
            <div className="flex min-w-max">
              <button
                onClick={() => setViewMode('records')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'records'
                  ? 'bg-ebony-primary text-white shadow-lg'
                  : 'text-ebony-muted hover:bg-ebony-surface hover:text-white'
                  }`}
              >
                <Wallet className="w-3.5 h-3.5" /> Lançamentos
              </button>

              <button
                onClick={() => setViewMode('students')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'students'
                  ? 'bg-ebony-primary text-white shadow-lg'
                  : 'text-ebony-muted hover:bg-ebony-surface hover:text-white'
                  }`}
              >
                <Users className="w-3.5 h-3.5" /> Gestão de Alunos
              </button>
            </div>
          </div>
        </div>

        {/* Botão Fechar Painel (Se houver props onClose, senão pode remover) */}
        {/* <button onClick={onClose}><X /></button> */}
      </div>

      {/* 2. CARDS KPI (Muda conforme a aba) */}
      {viewMode === 'records' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <DashboardCard
            title="Alunos Ativos"
            value={stats.active}
            icon={Users}
            subtext={`Ativos + Pago e não iniciado: ${stats.activePlusPaidNotStarted}`}
          />
          <DashboardCard
            title="Faturamento Líquido"
            value={formatCurrency(stats.revenueReal)}
            icon={Wallet}
            colorClass="bg-emerald-500/10 border-emerald-500/20"
            textClass="text-emerald-300"
            subtext="Recebido no período"
          />
          <DashboardCard title="Previsão (Forecast)" value={formatCurrency(stats.forecast)} icon={TrendingUp} subtext="Vence no período" />
          <DashboardCard title="Taxa de Retenção" value={`${stats.retention}%`} icon={CheckCircle} subtext="Renovações / Vencimentos" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <DashboardCard title="Ativos no Mês" value={managementStats.active} icon={Users} subtext="Ativos" />

          <DashboardCard
            title="Renovam este Mês"
            value={managementStats.renews}
            icon={History}
            colorClass="bg-emerald-500/10 border-emerald-500/20"
            textClass="text-emerald-300"
            subtext="Vencimentos previstos"
          />

          <DashboardCard title="Pausados (Total)" value={managementStats.paused} icon={LogOut} subtext="Congelados na base" />
          <DashboardCard
            title="Churn (Não renovou)"
            value={managementStats.lost}
            icon={X}
            colorClass="bg-red-500/10 border-red-500/20"
            textClass="text-red-300"
            subtext="Venceu + 30 dias sem renovação"
          />
        </div>
      )}

      {/* 3. BARRA DE FERRAMENTAS (Ações em cima / Filtros embaixo) */}
      <div className="bg-ebony-surface rounded-2xl border border-ebony-border shadow-sm overflow-visible">
        {/* FAIXA 1 — AÇÕES */}
        <div className="p-4 bg-ebony-deep border-b border-ebony-border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

            {/* ESQUERDA: botões utilitários */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={generatePDF}
                className="bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition-colors"
              >
                <FileText size={16} /> PDF
              </button>

              <div className="w-[180px] shrink-0">
                <select
                  value={filters.plan}
                  onChange={(e) => setFilters({ ...filters, plan: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-ebony-deep border border-ebony-border text-white shadow-sm focus:border-ebony-primary outline-none text-sm font-bold cursor-pointer h-[42px]"
                >
                  <option value="all">Todos Planos</option>
                  {plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>

              <button
                onClick={() => setPlanModalOpen(true)}
                className="bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition-colors"
              >
                <TrendingUp size={16} /> Planos
              </button>

              <button
                onClick={() => setAuditModalOpen(true)}
                className="bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition-colors"
              >
                <History size={16} /> Auditoria
              </button>
            </div>

            {/* DIREITA: botões principais */}
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {viewMode === "records" && (
                <button
                  onClick={() => {
                    setRenewModalOpen(true);
                    setRenewQuery("");
                    setRenewSelectedId("");
                    setRenewDropdownOpen(true);
                  }}
                  className="bg-ebony-primary hover:bg-red-900 text-white px-5 py-2 rounded-lg font-black flex items-center gap-2 shadow-lg transition-colors"
                  title="Renovar contrato"
                >
                  <RefreshCcw size={18} /> Renovar
                </button>
              )}

              <button
                onClick={() => openModal()}
                className="bg-ebony-primary hover:bg-red-900 text-white px-6 py-2 rounded-lg font-black flex items-center gap-2 shadow-lg transition-colors"
              >
                <Plus size={16} /> Lançar Pagamento
              </button>
            </div>
          </div>
        </div>

        {/* FAIXA 2 — FILTROS */}
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">

            {/* Buscar */}
            <div className="md:col-span-4 relative">
              <Search className="absolute left-3 top-2.5 text-gray-600" size={18} />
              <input
                placeholder="Buscar aluno..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 h-[42px] bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none"
              />
            </div>

            {/* DATA */}
            <div className="md:col-span-3">
              <div className="relative flex items-center justify-between gap-3 bg-ebony-deep rounded-lg border border-ebony-border px-3 h-[42px] w-full min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    const el = monthRef.current;
                    if (!el) return;
                    if (el.showPicker) el.showPicker();
                    else el.click();
                  }}
                  className="flex items-center gap-2 font-black text-white text-sm min-w-0"
                  title="Selecionar mês"
                >
                  <CalendarDays size={16} className="text-gray-600" />
                  <span className="tracking-wide truncate">{monthLabel}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDateMode("custom");
                    setCustomRangeOpen(true);
                  }}
                  className="h-8 w-8 shrink-0 rounded-lg border border-ebony-border bg-ebony-surface hover:bg-ebony-border/30 grid place-items-center transition-colors"
                  title="Personalizar período"
                >
                  <SlidersHorizontal size={16} className="text-ebony-muted" />
                </button>

                <input
                  ref={monthRef}
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="absolute opacity-0 pointer-events-none w-0 h-0"
                  tabIndex={-1}
                />

                {/* Overlay pra fechar clicando fora */}
                {customRangeOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onMouseDown={() => setCustomRangeOpen(false)}
                  />
                )}

                {/* Popover do período */}
                {customRangeOpen && dateMode === "custom" && (
                  <div className="absolute left-0 top-full mt-2 z-[80] w-[300px] bg-ebony-surface border border-ebony-border rounded-xl shadow-xl p-2 overflow-hidden">
                    <div className="text-[9px] font-black uppercase tracking-widest text-ebony-muted mb-2">
                      Período personalizado
                    </div>

                    {/* Linha das datas (GRID pra não vazar) */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="min-w-0 w-full h-9 px-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-xs font-bold"
                      />

                      <span className="text-ebony-muted text-xs font-bold">➜</span>

                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="min-w-0 w-full h-9 px-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-xs font-bold"
                      />
                    </div>

                    {/* Ações (compacto) */}
                    <div className="flex items-center justify-between mt-2">
                      <button
                        type="button"
                        onClick={() => setDateMode("month")}
                        className="h-9 px-3 rounded-lg bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface text-xs font-black transition-colors"
                      >
                        Voltar pro mês
                      </button>

                      <button
                        type="button"
                        onClick={() => setCustomRangeOpen(false)} // ou tua função de aplicar
                        className="h-9 px-3 rounded-lg bg-ebony-primary hover:bg-red-900 text-white text-xs font-black shadow-lg transition-colors"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="md:col-span-2">
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-ebony-deep border border-ebony-border text-white shadow-sm focus:border-ebony-primary outline-none text-sm font-bold cursor-pointer h-[42px]"
              >
                <option value="all">Todos Status</option>
                <option value="paid_in_period">💰 Pagos no Período</option>
                <option value="Pago e não iniciado">🟡 Pago e não iniciado</option>
                <option value="Ativo">🟢 Ativo</option>
                <option value="Renova esse mês">🟠 Renova Mês</option>
                <option value="Pausado">⚫ Pausado</option>
                <option value="Vencido">🟤 Vencido</option>
              </select>
            </div>

            {/* Ordenação (só lançamentos) */}
            <div className="md:col-span-3">
              {viewMode === "records" ? (
                <div className="relative">
                  <select
                    value={sortType}
                    onChange={(e) => setSortType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-ebony-deep border border-ebony-border text-white shadow-sm focus:border-ebony-primary outline-none text-sm font-bold hover:bg-ebony-surface cursor-pointer appearance-none h-[42px]"
                  >
                    <option value="date_asc">📅 Linha do Tempo (Jan→Dez)</option>
                    <option value="day_asc">🔢 Dia do Mês (1→31)</option>
                    <option value="date_desc">🔻 Mais Recentes Primeiro</option>
                    <option value="alpha_asc">🔤 Aluno (A-Z)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-ebony-muted">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
              ) : (
                <div className="hidden md:block" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TABELA (CONDICIONAL: FINANCEIRO OU GESTÃO) */}
      {viewMode === 'records' ? (
        // === TABELA 1: FINANCEIRO PURO (Seu código original mantido aqui) ===
        <div className="bg-ebony-surface rounded-xl shadow-sm border border-ebony-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-ebony-deep text-[10px] font-black text-ebony-muted uppercase tracking-widest border-b border-ebony-border">
                  <th className="p-4">Aluno</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Vencimento</th>
                  <th className="p-4">Plano / Forma</th>
                  <th className="p-4">Valor Líquido</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-ebony-border">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="p-12 text-center text-ebony-muted flex flex-col items-center gap-2"
                    >
                      <Filter size={32} className="opacity-30 text-ebony-muted" />
                      <p>Nenhum registro no período.</p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const status = getComputedStatus(r, todayISO);
                    const studentProfile = studentsMap[r.studentId];
                    const sName = studentsMap[r.studentId]?.name || r.studentName;
                    const badge = getMonthBadge(r.dueDate);
                    const linkedIds = Array.isArray(studentProfile?.linkedStudentIds)
                      ? studentProfile.linkedStudentIds
                      : [];
                    const hasLink = linkedIds.length > 0;
                    const linkedNames = linkedIds
                      .map((id) => studentsMap[id]?.name)
                      .filter(Boolean);
                    const linkTooltip = linkedNames.length
                      ? `Vínculo com: ${linkedNames.join(", ")}`
                      : "Aluno possui vínculo";

                    const planObj = r.planId ? plansById[r.planId] : null;
                    const planNameToShow = planObj?.name || r.planType;
                    const planColor =
                      planObj?.color ||
                      plansById[r.planId]?.color ||
                      plans.find((p) => p.name === r.planType)?.color ||
                      "slate";

                    return (
                      <tr
                        key={r.id}
                        className="group transition-colors border-b border-ebony-border hover:bg-ebony-border/30"
                      >
                        <td className="p-4 cursor-pointer" onClick={() => openHistory(r.studentId)}>
                          <div className="flex items-center gap-2">
                            <StudentNameWithBadge
                              student={studentProfile}
                              nameFallback={sName}
                              className="font-bold text-white transition-colors group-hover:text-white"
                            />
                            <History size={12} className="opacity-0 group-hover:opacity-100 text-ebony-muted" />
                          </div>

                          {hasLink && (
                            <div className="mt-1">
                              <span
                                className="inline-flex items-center gap-1 
                              bg-status-link/10 text-status-link border border-status-link/20 
                              text-[9px] px-2.5 py-0.5 rounded-full font-bold shadow-sm cursor-help 
                              hover:bg-status-link/20 hover:border-status-link/50 
                              hover:shadow-neon-link hover:scale-105 
                              transition-all duration-300 ease-out"

                                title={linkTooltip}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  alert(linkTooltip); // Ou sua lógica de modal
                                }}
                              >
                                🔗 Vínculo
                              </span>
                            </div>
                          )}

                          {r.notes && (
                            <div className="text-[10px] text-ebony-muted mt-1 max-w-[220px] truncate">
                              {r.notes}
                            </div>
                          )}
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="text-[10px] text-ebony-muted mb-1 font-medium">
                            Início: {formatDateBr(r.startDate)}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xl font-black text-ebony-muted/50 w-6 text-center">
                              {badge.day}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                              {badge.name}
                            </span>
                          </div>
                        </td>

                        <td className="p-4 w-[280px]">
                          <div
                            className={`font-bold text-xs inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded border ${COLOR_BADGE[planColor] || COLOR_BADGE.slate
                              }`}
                          >
                            {planNameToShow}
                          </div>
                          <div className="text-[10px] text-ebony-muted uppercase tracking-wide block mt-1 whitespace-nowrap">
                            {r.paymentMethod}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="font-mono font-bold text-white">
                            {formatCurrency(r.netValue)}
                          </div>
                          {r.payDate && (
                            <div className="text-[10px] text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Pago: {formatDateBr(r.payDate)}
                            </div>
                          )}
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            {!r.payDate && (
                              <button
                                onClick={() => handleSettle(r)}
                                className="p-2 text-emerald-400 hover:bg-ebony-deep rounded-lg border border-transparent hover:border-ebony-border transition-all"
                                title="Confirmar Pagamento"
                              >
                                <CheckCircle2 size={18} />
                              </button>
                            )}

                            <button
                              onClick={() => openModal(r)}
                              className="p-2 text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg border border-transparent hover:border-ebony-border transition-all"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // === TABELA 2: GESTÃO DE ALUNOS (A NOVA TABELA) ===
        <div className="bg-ebony-surface rounded-xl border border-ebony-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-4 border-b border-ebony-border bg-ebony-surface flex justify-between items-center">
            <h3 className="font-bold text-white">Visão de Alunos</h3>
            <span className="text-xs text-ebony-muted">
              Mostrando alunos únicos baseados no mês selecionado
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-ebony-deep text-[10px] font-black text-ebony-muted uppercase tracking-widest border-b border-ebony-border">
                  <th className="p-4">Aluno</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Vencimento</th>
                  <th className="p-4">Plano / Forma</th>
                  <th className="p-4">Último Pagamento</th>
                </tr>
              </thead>

              <tbody>
                {managementData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-10 text-center text-ebony-muted">
                      Nenhum aluno encontrado neste perfil.
                    </td>
                  </tr>
                ) : (
                  managementData.map((s) => (
                    <tr
                      key={s.id}
                      className="group transition-colors border-b border-ebony-border hover:bg-ebony-border/30"
                    >
                      {/* ALUNO (clicável → histórico) */}
                      <td className="p-4 cursor-pointer" onClick={() => openHistory(s.id)}>
                        <div className="flex items-center gap-2">
                          <StudentNameWithBadge
                            student={studentsMap[s.id] || s}
                            nameFallback={s.name}
                            className="font-bold text-white transition-colors group-hover:text-white"
                            showText={false}
                          />
                          <History size={12} className="opacity-0 group-hover:opacity-100 text-ebony-muted" />
                        </div>

                        {s.isPausedGlobal && (
                          <div className="mt-1 inline-block text-[10px] bg-ebony-deep px-2 py-0.5 rounded border border-ebony-border text-ebony-muted font-bold">
                            Pausado Globalmente
                          </div>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="p-4">
                        {s.isPausedGlobal ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border bg-ebony-deep text-white border-ebony-border">
                            Pausado
                          </span>
                        ) : s.statusInMonth === "Não renovou" ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border bg-ebony-primary text-white border-ebony-primary/60">
                            Não renovou
                          </span>
                        ) : s.statusInMonth === "Renova" ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border bg-ebony-deep text-white border-ebony-border">
                            Renova esse mês
                          </span>
                        ) : s.statusInMonth === "Ativo" ? (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border bg-ebony-deep text-white border-ebony-border">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border bg-ebony-deep text-ebony-muted border-ebony-border">
                            Sem contrato
                          </span>
                        )}
                      </td>

                      {/* VENCIMENTO (igual lançamentos) */}
                      <td className="p-4">
                        <div className="text-[10px] text-ebony-muted mb-1 font-medium">
                          {s.statusInMonth === "Renova" ? "Vence no período" : "Vigente no período"}
                        </div>

                        {s.dueDateInMonth ? (
                          (() => {
                            const badge = getMonthBadge(s.dueDateInMonth);
                            return (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xl font-black text-ebony-muted/50 w-6 text-center">
                                  {badge.day}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                                  {badge.name}
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-ebony-muted">-</span>
                        )}
                      </td>

                      {/* PLANO / FORMA (badge igual + linha pequena embaixo) */}
                      <td className="p-4">
                        {(() => {
                          const planColor = plans.find((p) => p.name === s.planInMonth)?.color || "slate";
                          return (
                            <>
                              <div
                                className={`font-bold text-xs inline-block px-2 py-0.5 rounded border ${COLOR_BADGE[planColor] || COLOR_BADGE.slate
                                  }`}
                              >
                                {s.planInMonth || "-"}
                              </div>
                              <div className="text-[10px] text-ebony-muted uppercase tracking-wide block mt-1">
                                {s.statusInMonth === "Renova"
                                  ? "RENOVA"
                                  : s.statusInMonth === "Ativo"
                                    ? "VIGENTE"
                                    : "-"}
                              </div>
                            </>
                          );
                        })()}
                      </td>

                      {/* ÚLTIMO PAGAMENTO (valor grande + data pequena embaixo) */}
                      <td className="p-4">
                        {s.lastPayment ? (
                          <>
                            <div className="font-mono font-bold text-white">
                              {formatCurrency(s.lastPayment.value)}
                            </div>
                            <div className="text-[10px] text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Pago: {formatDateBr(s.lastPayment.date)}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-ebony-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* MODAL DE GERENCIAR PLANOS (CORRIGIDO) */}
      {/* MODAL DE GERENCIAR PLANOS (CORRIGIDO) */}
      {planModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-ebony-surface rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 border border-ebony-border">

            {/* Cabeçalho do Modal */}
            <div className="p-4 border-b border-ebony-border bg-ebony-surface flex justify-between items-center">
              <h3 className="font-bold text-white">Gerenciar Planos</h3>
              <button onClick={() => { setPlanModalOpen(false); setEditingPlan(null); }}>
                <X size={20} className="text-ebony-muted hover:text-white transition-colors" />
              </button>
            </div>

            {/* Lista de Planos Existentes */}
            <div className="p-4 max-h-[300px] overflow-y-auto space-y-2 bg-ebony-surface">
              {[...plans].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(p => (
                <div
                  key={p.id}
                  className={`flex justify-between items-center p-3 border rounded-lg bg-ebony-deep shadow-sm hover:border-ebony-primary/40 transition-colors ${editingPlan?.id === p.id ? 'ring-2 ring-ebony-primary border-transparent' : 'border-ebony-border'
                    }`}
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${COLOR_DOT[p.color] || COLOR_DOT.slate}`}></div>
                    <div>
                      <div className="font-bold text-sm text-white">{p.name}</div>
                      <div className="text-xs text-ebony-muted">
                        {p.durationMonths} meses • Liq: {formatCurrency(p.netValue)}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingPlan(p)}
                      className="p-2 text-ebony-muted hover:text-white hover:bg-ebony-surface rounded transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Excluir plano "${p.name}"?`)) return;
                        try { await FinancialService.deletePlanAudited(p.id, p.name); } catch (e) { alert(e.message); }
                      }}
                      className="p-2 text-ebony-muted hover:text-white hover:bg-ebony-primary/20 rounded transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {plans.length === 0 && (
                <p className="text-center text-xs text-ebony-muted py-4">
                  Nenhum plano cadastrado.
                </p>
              )}
            </div>

            {/* Formulário de Cadastro/Edição */}
            <form
              key={editingPlan ? editingPlan.id : 'create-new'}
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.target);
                const planData = {
                  name: f.get('name'),
                  durationMonths: parseInt(f.get('duration')),
                  paymentMethod: f.get('method'),
                  grossValue: parseFloat(f.get('gross')),
                  netValue: parseFloat(f.get('net')),
                  color: f.get('color') || 'slate'
                };

                try {
                  if (editingPlan) {
                    await FinancialService.updatePlanAudited(editingPlan.id, editingPlan, planData);
                    setEditingPlan(null);
                  } else {
                    await FinancialService.createPlanAudited(planData);
                  }
                  e.target.reset();
                } catch (err) { alert(err?.message || err); }
              }}
              className="p-5 bg-ebony-surface border-t border-ebony-border space-y-3 shadow-[0_-5px_15px_rgba(0,0,0,0.25)] relative z-10"
            >
              {editingPlan && (
                <div className="text-xs font-bold text-ebony-muted mb-2 flex justify-between">
                  <span className="text-white">✏️ Editando: {editingPlan.name}</span>
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="underline text-ebony-muted hover:text-white font-normal transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <input
                  name="name"
                  defaultValue={editingPlan?.name}
                  placeholder="Nome"
                  className="col-span-2 w-full p-2 text-sm bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                  required
                />
                <input
                  name="duration"
                  type="number"
                  defaultValue={editingPlan?.durationMonths}
                  placeholder="Meses"
                  className="w-full p-2 text-sm bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                  required
                />
              </div>

              {/* Cores */}
              <div className="flex flex-wrap gap-2">
                {['slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink'].map(c => (
                  <label key={c} className="cursor-pointer">
                    <input
                      type="radio"
                      name="color"
                      value={c}
                      className="sr-only peer"
                      defaultChecked={editingPlan ? editingPlan.color === c : c === 'slate'}
                    />
                    <div className={`w-5 h-5 rounded-full ${COLOR_DOT[c]} peer-checked:ring-2 peer-checked:ring-ebony-primary`}></div>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  name="gross"
                  type="number"
                  step="0.01"
                  defaultValue={editingPlan?.grossValue}
                  placeholder="Bruto"
                  className="p-2 text-sm bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                  required
                />
                <input
                  name="net"
                  type="number"
                  step="0.01"
                  defaultValue={editingPlan?.netValue}
                  placeholder="Líquido"
                  className="p-2 text-sm bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 font-bold"
                  required
                />
              </div>

              <input type="hidden" name="method" value="Pix" /> {/* Simplificado */}

              <button className="w-full py-2 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg text-sm">
                Salvar Plano
              </button>
            </form>
          </div>
        </div>
      )}

      {renewModalOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-ebony-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 border border-ebony-border">

            {/* Header */}
            <div className="p-4 border-b border-ebony-border bg-ebony-surface flex justify-between items-center">
              <div>
                <h3 className="font-black text-white">Renovar contrato</h3>
                <p className="text-xs text-ebony-muted">Escolhe a aluna pra abrir a renovação.</p>
              </div>
              <button
                onClick={() => { setRenewModalOpen(false); setRenewDropdownOpen(false); }}
                className="p-2 rounded-full hover:bg-ebony-deep transition-colors"
                title="Fechar"
              >
                <X size={18} className="text-ebony-muted hover:text-white transition-colors" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-ebony-muted" size={18} />
                <input
                  autoFocus
                  value={renewQuery}
                  onChange={(e) => { setRenewQuery(e.target.value); setRenewDropdownOpen(true); setRenewSelectedId(""); }}
                  onFocus={() => setRenewDropdownOpen(true)}
                  onKeyDown={(e) => { if (e.key === "Escape") setRenewDropdownOpen(false); }}
                  placeholder="Digite o nome da aluna..."
                  className="w-full pl-10 pr-3 py-2.5 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                />

                {renewDropdownOpen && (
                  <div className="mt-2 border border-ebony-border bg-ebony-surface rounded-xl shadow-lg max-h-64 overflow-y-auto overflow-hidden">
                    {renewCandidates.length === 0 ? (
                      <div className="p-3 text-xs text-ebony-muted text-center">Nenhuma aluna encontrada.</div>
                    ) : (
                      renewCandidates.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setRenewSelectedId(s.id);
                            setRenewQuery(s.name || "");
                            setRenewDropdownOpen(false);
                          }}
                          className={`w-full text-left p-3 border-b border-ebony-border last:border-0 hover:bg-ebony-border/30 transition-colors ${renewSelectedId === s.id ? "bg-ebony-deep" : ""
                            }`}
                        >
                          <div className="font-bold text-sm text-white">{s.name}</div>
                          {s.phone && <div className="text-[10px] text-ebony-muted">{s.phone}</div>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setRenewModalOpen(false); setRenewDropdownOpen(false); }}
                  className="px-4 py-2 rounded-lg bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface font-bold text-sm transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={confirmRenew}
                  className="px-5 py-2 rounded-lg bg-ebony-primary hover:bg-red-900 text-white font-black text-sm shadow-lg disabled:opacity-50 transition-colors"
                  disabled={!renewSelectedId}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw size={16} /> Renovar
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIÇÃO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-ebony-surface rounded-xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-ebony-border">
            <div className="p-5 border-b border-ebony-border flex justify-between items-center bg-ebony-surface rounded-t-xl">
              <h2 className="text-lg font-bold text-white">
                {currentRecord ? 'Editar Lançamento' : 'Novo Lançamento'}
              </h2>
              <button onClick={closeLaunchModal} className="p-2 hover:bg-ebony-deep rounded-full transition-colors">
                <X size={20} className="text-ebony-muted hover:text-white transition-colors" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3">
              {/* Bloco de Preenchimento Rápido Melhorado */}
              {!currentRecord && (
                <div className="bg-ebony-deep p-2 rounded-lg border border-ebony-border">
                  <label className="text-[10px] font-bold text-ebony-muted uppercase tracking-wider mb-1 block">
                    ⚡ Preenchimento Rápido
                  </label>

                  <div className="relative">
                    <select
                      onChange={(e) => handleSelectPlan(e.target.value)}
                      className="w-full p-2 pl-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none cursor-pointer hover:border-ebony-primary/60 transition-colors appearance-none"
                    >
                      <option value="">-- Selecione um Plano --</option>
                      {plans.map(p => (
                        <option
                          key={p.id}
                          value={p.id}
                          style={{ color: HEX_COLORS[p.color] || '#000', fontWeight: 'bold' }}
                        >
                          ● {p.name} ({p.durationMonths} meses)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Preview da cor selecionada para confirmação visual */}
                  {formData.planId && plansById[formData.planId] && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-ebony-muted animate-in fade-in">
                      <div className={`w-3 h-3 rounded-full ${COLOR_DOT[plansById[formData.planId].color]}`}></div>
                      <span>
                        Plano: <strong className="text-white">{plansById[formData.planId].name}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="relative">
                <label className="text-xs font-bold text-ebony-muted uppercase tracking-wider mb-1 block">
                  Aluno
                </label>

                <input
                  value={studentQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStudentQuery(v);
                    setStudentDropdownOpen(true);

                    // se limpar o texto, limpa o studentId também
                    if (!v.trim()) {
                      setFormData(prev => ({ ...prev, studentId: "" }));
                    }
                  }}
                  onFocus={() => setStudentDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setStudentDropdownOpen(false);
                  }}
                  placeholder="Digite o nome do aluno..."
                  disabled={!!currentRecord} // mantém tua regra: em edição não troca aluno
                  className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 font-medium outline-none"
                  required
                />

                {/* Dropdown */}
                {studentDropdownOpen && !currentRecord && (
                  <div className="absolute top-full left-0 right-0 bg-ebony-surface border border-ebony-border rounded-xl shadow-xl mt-1 z-50 max-h-56 overflow-y-auto overflow-hidden">
                    {filteredStudentsForPicker.length === 0 ? (
                      <div className="p-3 text-xs text-ebony-muted text-center">Nenhum aluno encontrado.</div>
                    ) : (
                      filteredStudentsForPicker.map(s => (
                        <div
                          key={s.id}
                          onMouseDown={() => {
                            // onMouseDown evita perder o clique por causa do blur
                            setFormData(prev => ({ ...prev, studentId: s.id }));
                            setStudentQuery(s.name || "");
                            setStudentDropdownOpen(false);
                          }}
                          className="p-3 text-sm text-white hover:bg-ebony-border/30 cursor-pointer border-b border-ebony-border last:border-0 transition-colors"
                        >
                          <div className="font-bold">{s.name}</div>
                          {s.phone && <div className="text-[10px] text-ebony-muted">{s.phone}</div>}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Clique fora (simples): fecha quando sai do input */}
                {!currentRecord && (
                  <div
                    className="fixed inset-0 z-40"
                    style={{ display: studentDropdownOpen ? "block" : "none" }}
                    onMouseDown={() => setStudentDropdownOpen(false)}
                  />
                )}
              </div>
              {/* AVISO DE ÚLTIMO LANÇAMENTO */}
{lastRecordWarning && !currentRecord && (
  <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2 flex items-center gap-3">
    <span className="text-sm shrink-0">📋</span>
    <div className="min-w-0 flex-1">
      <p className="text-orange-400/70 font-black text-[9px] uppercase tracking-wider mb-1">
        Último lançamento desta aluna
      </p>
      <div className="grid grid-cols-2 gap-x-3 text-[11px]">
        <div><span className="text-ebony-muted">Plano: </span><span className="text-white font-bold">{lastRecordWarning.planType || '-'}</span></div>
        <div><span className="text-ebony-muted">Valor: </span><span className="text-white font-bold">{formatCurrency(lastRecordWarning.netValue)}</span></div>
        <div><span className="text-ebony-muted">Vence: </span><span className="text-white font-bold">{formatDateBr(normalizeDate(lastRecordWarning.dueDate))}</span></div>
        <div>
          {lastRecordWarning.payDate
            ? <><span className="text-ebony-muted">Pago: </span><span className="text-emerald-400 font-bold">{formatDateBr(normalizeDate(lastRecordWarning.payDate))}</span></>
            : <span className="text-yellow-400 font-bold">⚠ Não pago</span>
          }
        </div>
      </div>
    </div>
  </div>
)}
              {/* --- VÍNCULOS (CASAL/GRUPO) - EDITÁVEL NO FINANCEIRO --- */}
              {formData.studentId && (
                <div
                  className={`rounded-lg border px-3 py-2 transition-all duration-300 ${linkedStudents.length > 0
                    ? "bg-status-link/5 border-status-link/30 shadow-[0_0_15px_rgba(236,72,153,0.05)]" // Aceso
                    : "bg-ebony-deep border-ebony-border" // Apagado
                    }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {/* Título muda de cor se tiver vínculo */}
                      <div
                        className={`text-[10px] font-black uppercase tracking-wider mb-0.5 ${linkedStudents.length > 0 ? "text-status-link" : "text-ebony-muted"
                          }`}
                      >
                        🔗 Vínculos
                      </div>

                      <div className="text-xs text-white truncate font-medium">
                        {linkedStudents.length ? (
                          <span className="text-ebony-text">
                            Com: <span className="text-white">{linkedStudents.map((l) => l.name).join(", ")}</span>
                          </span>
                        ) : (
                          "Nenhum vínculo"
                        )}
                      </div>
                    </div>

                    {/* Botão de ação (mantive sua lógica, só ajustei estilo) */}
                    <button
                      type="button"
                      onClick={() => {
                        setLinksPanelOpen((v) => !v);
                        setLinkSearchTerm("");
                      }}
                      className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${linkedStudents.length > 0
                        ? "bg-status-link/10 border-status-link/20 text-status-link hover:bg-status-link/20 hover:border-status-link/50"
                        : "bg-transparent border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface"
                        }`}
                    >
                      {linksPanelOpen ? "Fechar" : linkedStudents.length ? "Editar" : "Adicionar"}
                    </button>
                  </div>

                  {linksPanelOpen && (
                    <div className="mt-3 space-y-3 border-t border-ebony-border pt-3">
                      {/* Selecionados */}
                      <div className="flex flex-wrap gap-2">
                        {linkedStudents.map(link => (
                          <div
                            key={link.id}
                            className="bg-ebony-surface text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-2 border border-ebony-border"
                          >
                            <span className="max-w-[180px] truncate">{link.name}</span>
                            <button
                              type="button"
                              onClick={() => setLinkedStudents(prev => prev.filter(p => p.id !== link.id))}
                              className="text-ebony-muted hover:text-white transition-colors"
                              title="Remover vínculo"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {linkedStudents.length === 0 && (
                          <span className="text-xs text-ebony-muted italic">Nenhum vínculo.</span>
                        )}
                      </div>

                      {/* Busca */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar pessoa pra vincular..."
                          value={linkSearchTerm}
                          onChange={(e) => setLinkSearchTerm(e.target.value)}
                          className="w-full px-3 py-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                        />

                        {linkSearchTerm.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-ebony-surface border border-ebony-border rounded-xl shadow-xl mt-1 z-50 max-h-44 overflow-y-auto overflow-hidden">
                            {(students || [])
                              .filter(s =>
                                s.id !== formData.studentId &&
                                !linkedStudents.some(sel => sel.id === s.id) &&
                                (s.name || "").toLowerCase().includes(linkSearchTerm.toLowerCase())
                              )
                              .slice(0, 20)
                              .map(s => (
                                <div
                                  key={s.id}
                                  onMouseDown={() => {
                                    setLinkedStudents(prev => [...prev, { id: s.id, name: s.name, phone: s.phone }]);
                                    setLinkSearchTerm("");
                                  }}
                                  className="p-3 text-sm text-white hover:bg-ebony-border/30 cursor-pointer border-b border-ebony-border last:border-0 transition-colors"
                                >
                                  <div className="font-bold">{s.name}</div>
                                  {s.phone && <div className="text-[10px] text-ebony-muted">{s.phone}</div>}
                                </div>
                              ))}

                            {(students || []).filter(s =>
                              (s.name || "").toLowerCase().includes(linkSearchTerm.toLowerCase())
                            ).length === 0 && (
                                <div className="p-3 text-xs text-ebony-muted text-center">Nenhum aluno encontrado.</div>
                              )}
                          </div>
                        )}
                      </div>

                      <p className="text-[10px] text-ebony-muted">
                        Salva vínculo no cadastro (students). No financeiro é só sinal visual.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {/* ------------------------------------------------------- */}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ebony-muted uppercase tracking-wider mb-1 block">
                    Plano (Nome)
                  </label>
                  <input
                    value={formData.planType}
                    onChange={e => setFormData({ ...formData, planType: e.target.value })}
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ebony-muted uppercase tracking-wider mb-1 block">
                    Método
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                  >
                    <option value="Pix">Pix</option>
                    <option value="Cartão">Cartão</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-ebony-deep p-3 rounded-xl border border-ebony-border">
                <div>
                  <label className="text-[10px] font-bold text-ebony-muted uppercase block mb-1">
                    Valor Bruto
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.grossValue}
                    onChange={e => setFormData({ ...formData, grossValue: e.target.value })}
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                    placeholder="R$ 0,00"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-ebony-muted uppercase block mb-1">
                    Líquido (Recebido)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.netValue}
                    onChange={e => setFormData({ ...formData, netValue: e.target.value })}
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm font-bold"
                    placeholder="R$ 0,00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-ebony-muted uppercase block mb-1">
                    Início (Previsão)
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={handleStartDateChange}
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-ebony-muted uppercase block mb-1">
                    Fim (Vencimento)
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ebony-muted uppercase tracking-wider mb-1 block">
                    Status Atual
                  </label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className={`w-full p-3 border rounded-lg bg-ebony-deep text-white text-sm font-bold shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 ${formData.status === 'Pago e não iniciado'
                      ? 'border-ebony-primary/40'
                      : 'border-ebony-border'
                      }`}
                  >
                    <option value="Pago e não iniciado">🟡 Pago e não iniciado</option>
                    <option value="Ativo">🟢 Ativo (Vigendo)</option>
                    <option value="Pausado">⚫ Pausado</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-ebony-muted uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Data Pagamento
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={formData.payDate}
                      onChange={e => setFormData({ ...formData, payDate: e.target.value })}
                      className="flex-1 p-2.5 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm font-bold"
                    />
                    {formData.payDate && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, payDate: '' })}
                        className="p-2.5 text-ebony-muted hover:text-white hover:bg-ebony-primary/20 rounded-lg border border-ebony-border transition-colors"
                        title="Limpar Pagamento"
                      >
                        <Eraser size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-ebony-muted uppercase tracking-wider mb-1 block">
                  Observações
                </label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                  rows="2"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-3 border-t border-ebony-border">
                {currentRecord && (
                  <button
                    type="button"
                    onClick={handleDeleteRecord}
                    className="px-4 py-3 text-ebony-muted font-bold hover:bg-ebony-primary/20 rounded-xl text-sm transition-colors"
                  >
                    Excluir
                  </button>
                )}

                <button
                  type="button"
                  onClick={closeLaunchModal}
                  className="ml-auto px-6 py-3 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface font-bold rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-8 py-3 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-sm"
                >
                  Salvar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTÓRICO LTV */}
      {historyModalOpen && selectedStudentHistory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in">
          {/* Alterado para max-w-5xl para caber as novas colunas */}
          <div className="bg-ebony-surface rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 border border-ebony-border">

            {/* CABEÇALHO DO MODAL */}
            <div className="p-6 bg-ebony-surface border-b border-ebony-border text-white flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedStudentHistory.student?.name}</h2>
                <p className="text-ebony-muted text-sm mt-1">LTV (Lifetime Value) - Histórico de Pagamentos</p>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="bg-ebony-deep hover:bg-ebony-border/30 p-2 rounded-full transition-colors border border-ebony-border"
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            {/* RESUMO FINANCEIRO */}
            <div className="bg-ebony-deep p-4 border-b border-ebony-border flex justify-around text-center">
              <div>
                <p className="text-[10px] font-bold uppercase text-ebony-muted">Total Pago (Líquido)</p>
                <p className="text-xl font-black text-emerald-400">
                  {formatCurrency(
                    selectedStudentHistory.history.reduce(
                      (acc, curr) => acc + (curr.payDate ? parseFloat(curr.netValue || 0) : 0),
                      0
                    )
                  )}
                </p>
              </div>
            </div>

            {/* TABELA COM NOVAS COLUNAS */}
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-ebony-deep border-b border-ebony-border shadow-sm z-10">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Data Pagamento</th>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Referência</th>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Líquido</th>

                    {/* NOVAS COLUNAS ADICIONADAS AQUI */}
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Início Vigência</th>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Fim Vigência</th>

                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted text-right">Status Calc.</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedStudentHistory.history.map(h => {
                    const planObj = h.planId ? plansById[h.planId] : null;
                    const planNameToShow = planObj?.name || h.planType;
                    return (
                      <tr key={h.id} className="transition-colors border-b border-ebony-border hover:bg-ebony-border/30">
                        <td className="p-4">
                          {h.payDate ? (
                            <span className="font-bold text-emerald-400">{formatDateBr(h.payDate)}</span>
                          ) : (
                            <span className="text-xs text-ebony-muted italic">Pendente</span>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="font-bold text-white">{planNameToShow}</div>
                          <div className="text-xs text-ebony-muted">{h.paymentMethod}</div>
                        </td>

                        <td className="p-4 font-mono font-bold text-white">{formatCurrency(h.netValue)}</td>

                        {/* DADOS DAS NOVAS COLUNAS */}
                        <td className="p-4 text-xs text-ebony-muted font-medium">{formatDateBr(h.startDate)}</td>
                        <td className="p-4 text-xs text-ebony-muted font-medium">{formatDateBr(h.dueDate)}</td>

                        <td className="p-4 text-right">
                          <span className="text-[10px] border px-1 py-0.5 rounded bg-ebony-deep text-ebony-muted border-ebony-border">
                            {getComputedStatus(h, todayISO).label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {auditModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-ebony-surface rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden border border-ebony-border">

            {/* Cabeçalho */}
            <div className="p-5 bg-ebony-surface border-b border-ebony-border text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Auditoria</h2>
                <p className="text-ebony-muted text-sm">Histórico de ações no sistema</p>
              </div>
              <button
                onClick={() => setAuditModalOpen(false)}
                className="bg-ebony-deep hover:bg-ebony-border/30 p-2 rounded-full transition-colors border border-ebony-border"
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-ebony-deep border-b border-ebony-border z-10">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Data/Hora</th>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Quem</th>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Ação</th>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Aluno</th>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Plano</th>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Valor</th>
                    <th className="p-4 text-[10px] font-black uppercase text-ebony-muted">Detalhe</th>
                  </tr>
                </thead>

                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-10 text-center text-ebony-muted">
                        Nenhum log encontrado ainda.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(l => {
                      // Tratamento dos dados
                      const when = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleString('pt-BR') : '-';
                      const quem = l.who || 'Admin';
                      const aluno = l.studentName || '-';
                      const plano = l.planName || '-';
                      const valor = (typeof l.netValue === 'number')
                        ? formatCurrency(l.netValue)
                        : (l.netValue ? formatCurrency(Number(l.netValue)) : '-');

                      return (
                        <tr key={l.id} className="transition-colors border-b border-ebony-border hover:bg-ebony-border/30">
                          {/* 1. DATA/HORA */}
                          <td className="p-4 text-[10px] text-ebony-muted font-mono">
                            {when}
                          </td>

                          {/* 2. QUEM - Alterado para lowercase (minúsculo) para ficar igual e-mail */}
                          <td className="p-4 text-[10px] font-bold text-white lowercase">
                            {l.who || 'admin'}
                          </td>

                          {/* 3. AÇÃO */}
                          <td className="p-4 text-[10px] font-bold text-white">
                            {l.action}
                          </td>

                          {/* 4. ALUNO */}
                          <td className="p-4 text-[10px] text-ebony-muted">
                            {aluno}
                          </td>

                          {/* 5. PLANO */}
                          <td className="p-4 text-[10px] text-ebony-muted">
                            {plano}
                          </td>

                          {/* 6. VALOR */}
                          <td className="p-4 text-[10px] font-mono text-white">
                            {valor}
                          </td>

                          {/* 7. DETALHE */}
                          <td className="p-4 text-[10px] text-ebony-muted italic max-w-[200px] truncate">
                            {l.note || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
