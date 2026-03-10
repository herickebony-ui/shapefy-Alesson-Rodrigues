import React from "react";
import StudentBadge from "./StudentBadge";

export default function StudentNameWithBadge({
  student,
  nameFallback = "",
  // Mantemos o texto branco para o fundo escuro
  className = "font-bold text-white hover:text-gray-200 transition-colors", 
  showText = false
}) {
  const name = student?.name || nameFallback || "-";

  // --- LÓGICA DE DATA (Trazida para cá para controlar a posição) ---
  const rawDue =
    student?.finDueDate ||
    student?.finDueDateInMonth ||
    student?.dueDate ||
    student?.nextDueDate ||
    student?.vencimento ||
    null;

  let formattedDate = null;
  if (rawDue) {
    if (typeof rawDue === "string") {
      formattedDate = rawDue.slice(0, 10).split('-').reverse().join('/');
    } else if (rawDue?.toDate) {
      formattedDate = rawDue.toDate().toLocaleDateString('pt-BR');
    }
  }
  // -----------------------------------------------------------------

  return (
    <div className="flex flex-col items-start justify-center">
      {/* LINHA 1: Nome + Bolinha */}
      <div className="flex items-center gap-2">
        <span className={className}>{name}</span>
        
        {/* Chamamos a bolinha, mas dizemos para ela NÃO mostrar a data nem texto,
            pois vamos mostrar nós mesmos aqui fora */}
        <StudentBadge 
          student={student} 
          showText={false} 
          showDate={false} 
        />
      </div>

      {/* LINHA 2: Data de Vencimento (Logo abaixo do nome) */}
      {formattedDate && (
        <span className="text-[11px] text-gray-400 font-mono mt-0.5 leading-tight">
          Vence: {formattedDate}
        </span>
      )}
    </div>
  );
}