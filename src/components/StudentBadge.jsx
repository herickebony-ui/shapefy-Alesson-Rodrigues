import React from "react";

const StudentBadge = ({ student, showText = false, showDate = false }) => {
  // --- LÓGICA DE PROTEÇÃO ---
  if (!student) {
    return (
      <div className="flex items-center gap-2 opacity-50">
        <div className="w-2.5 h-2.5 rounded-full bg-ebony-border" />
        {showText && <span className="text-[10px] text-gray-500 uppercase">-</span>}
      </div>
    );
  }

  // --- LÓGICA FINANCEIRA ---
  const hasPlan = !!student.finPlanName || !!student.planName || !!student.planId;
  const finStatus = student.finStatus || null;
  
  // Tratamento de datas (Firestore Timestamp ou String)
  const rawDue =
    student.finDueDate ||
    student.finDueDateInMonth ||
    student.dueDate ||
    student.nextDueDate ||
    student.vencimento ||
    null;

  let formattedDate = null;
  if (rawDue) {
    if (typeof rawDue === "string") {
      // Se vier como string "2026-01-25"
      formattedDate = rawDue.slice(0, 10).split('-').reverse().join('/');
    } else if (rawDue?.toDate) {
      // Se vier do Firebase (Timestamp)
      formattedDate = rawDue.toDate().toLocaleDateString('pt-BR');
    }
  }

  // --- MAPEAMENTO DE CORES (TITANIUM NEON) ---
  let colorClass = "bg-gray-600 border border-gray-500/30"; // Padrão
  let label = "Sem plano";

  if (finStatus === "Pausado") {
    colorClass = "bg-gray-500 border border-gray-400/30";
    label = "Pausado";
  } else if (!hasPlan) {
    colorClass = "bg-gray-700 border border-gray-600/30";
    label = "Sem plano";
  } else if (finStatus === "Não renovou") {
    colorClass = "bg-red-900 border border-red-500/30 text-red-500 shadow-neon-red"; 
    label = "Não renovou";
  } else if (finStatus === "Vencido") {
    colorClass = "bg-[#850000] border border-red-500/50 shadow-neon-red"; 
    label = "Vencido";
  } else if (finStatus === "Renova") {
    colorClass = "bg-amber-600 border border-amber-500/30 shadow-neon-amber";
    label = "Renova";
  } else if (finStatus === "Pago e não iniciado") {
    colorClass = "bg-yellow-500 border border-yellow-400/30 shadow-neon-amber";
    label = "Pago/Não iniciou";
  } else if (finStatus === "Ativo") {
    // Verde Neon
    colorClass = "bg-emerald-500 border border-emerald-400/30 shadow-neon-green";
    label = "Ativo";
  } else if (!formattedDate) {
    colorClass = "bg-slate-600";
    label = "Sem venc.";
  } else {
    // Fallback para Ativo
    colorClass = "bg-emerald-500 border border-emerald-400/30 shadow-neon-green";
    label = "Ativo";
  }

  return (
    <div className="flex flex-col justify-center">
      {/* Linha da Bolinha + Status */}
      <div className="flex items-center gap-2" title={formattedDate ? `Vence em: ${formattedDate}` : label}>
        <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
        
        {showText && (
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">
            {label}
          </span>
        )}
      </div>

      {/* Exibição Opcional da Data (Logo abaixo, se solicitado) */}
      {showDate && formattedDate && (
        <span className="text-[10px] text-gray-500 mt-0.5 ml-0.5 font-mono">
          {formattedDate}
        </span>
      )}
    </div>
  );
};

export default StudentBadge;