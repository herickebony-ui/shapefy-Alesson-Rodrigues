import React, { useMemo } from "react";
import { doc, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import useRealtime from "../../hooks/useRealtime";

import StudentBadge from "../StudentBadge";
import { FileText, PlaySquare, ChevronRight, Lock, Rocket } from "lucide-react";

const HubCard = ({ title, description, icon: Icon, locked, onClick }) => (
  <button
    onClick={locked ? undefined : onClick}
    className={`
      group relative w-full text-left p-5 rounded-2xl border transition-all duration-300 overflow-hidden
      flex items-center gap-5
      ${locked
        ? "bg-ebony-surface/40 border-ebony-border opacity-50 cursor-not-allowed grayscale"
        : "bg-ebony-surface border-ebony-border hover:border-ebony-primary hover:shadow-[0_8px_30px_-5px_rgba(133,0,0,0.25)] hover:-translate-y-1"
      }
    `}
  >
    {/* EFEITO 1: Glow de fundo (Ambiente Light) */}
    {!locked && (
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-ebony-primary/10 blur-[60px] rounded-full transition-all duration-500 group-hover:bg-ebony-primary/20" />
    )}

    {/* COLUNA 1: Ícone em destaque */}
    <div className={`
      relative z-10 w-14 h-14 rounded-xl flex items-center justify-center border shadow-inner transition-all duration-300 shrink-0
      ${locked
        ? "bg-ebony-deep border-ebony-border text-ebony-muted"
        : "bg-ebony-deep border-ebony-border text-ebony-muted group-hover:bg-ebony-primary group-hover:border-ebony-primary group-hover:text-white"
      }
    `}>
      <Icon strokeWidth={1.5} className="w-7 h-7" />
    </div>

    {/* COLUNA 2: Textos */}
    <div className="flex-1 min-w-0 relative z-10">
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-bold transition-colors ${locked ? 'text-ebony-muted' : 'text-white group-hover:text-white'}`}>
          {title}
        </h3>

        {/* Seta animada que aparece no hover */}
        {!locked && (
          <ChevronRight className="w-5 h-5 text-ebony-primary opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-out" />
        )}
      </div>

      <p className="text-sm text-ebony-muted mt-1 font-medium leading-relaxed">
        {description}
      </p>
    </div>

    {/* Indicador de Bloqueio (Cadeado no topo) */}
    {locked && (
      <div className="absolute top-3 right-3">
        <Lock className="w-4 h-4 text-ebony-muted opacity-50" />
      </div>
    )}
  </button>
);

export default function StudentHub({ go, studentId }) {
  const studentRef = useMemo(() => {
    if (!studentId) return null;
    return doc(db, "students", studentId);
  }, [studentId]);

  const { data: student, loading } = useRealtime(studentRef);
  const continueQ = useMemo(() => {
    if (!studentId) return null;
    return query(
      collection(db, "students", studentId, "members_progress"),
      orderBy("updatedAt", "desc"),
      limit(1)
    );
  }, [studentId]);

  const { data: continueRows } = useRealtime(continueQ);

  const resumeKey = useMemo(() => (studentId ? `members_resume_${studentId}` : null), [studentId]);

  const openMembersAt = (moduleId, lessonId) => {
    if (!resumeKey) return;
    try {
      localStorage.setItem(
        resumeKey,
        JSON.stringify({ openModuleId: moduleId || null, lessonId: lessonId || null, at: Date.now() })
      );
    } catch (e) { }
    go && go("members_area");
  };

  const isActive = String(student?.finStatus || "").toLowerCase() === "ativo";
  const isContractSigned = student?.status === "signed" || student?.latestContractStatus === "signed" || !!student?.contractPdfUrl;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#202024] text-gray-100 p-6 flex items-center justify-center">
        <div className="text-sm text-gray-400">Carregando teu painel…</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-[#202024] text-gray-100 p-6 flex items-center justify-center">
        <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6 max-w-md w-full">
          <div className="font-black mb-2">Aluno não encontrado</div>
          <div className="text-sm text-gray-400">
            Não achei teu cadastro em <b>students</b> com este ID: <b>{studentId}</b>.
            <br />
          </div>
        </div>
      </div>
    );
  }

  const firstName = (student.name || student.nome || "Aluno").split(" ")[0];

  return (
    <div className="min-h-screen bg-ebony-bg text-ebony-text p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header de Boas-vindas */}
        <div className="bg-ebony-surface border border-ebony-border rounded-xl p-5 flex items-center justify-between gap-4 shadow-lg relative overflow-hidden group">
          {/* Efeito decorativo de fundo */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-ebony-primary/5 rounded-full blur-3xl -mr-16 -mt-32 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-50"></div>

          <div className="min-w-0 relative z-10">
            <div className="text-sm text-ebony-muted mb-1">Olá,</div>
            <div className="text-2xl font-bold text-white truncate tracking-tight">{firstName}</div>
          </div>

          <div className="shrink-0 relative z-10">
            <StudentBadge finStatus={student.finStatus} planId={student.planId} />
          </div>
        </div>
        {/* Seção Continuar Assistindo */}
        {(continueRows || []).length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-ebony-primary rounded-full shadow-[0_0_10px_#850000]"></div>
              <h2 className="font-bold text-white text-lg">Continuar assistindo</h2>
            </div>

            {/* Transformado em Grid para estilo Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(continueRows || []).map((r) => (
                <button
                  key={r.id}
                  onClick={() => openMembersAt(r.moduleId, r.lessonId)}
                  className={`
                group relative w-full text-left bg-ebony-surface border border-ebony-border rounded-xl overflow-hidden transition-all duration-300
                flex flex-col h-full
                ${!isActive
                      ? "opacity-60 cursor-not-allowed grayscale"
                      : "hover:border-ebony-primary hover:shadow-[0_0_20px_-5px_rgba(133,0,0,0.3)] hover:-translate-y-1"
                    }
              `}
                  disabled={!isActive}
                >
                  {/* Área da Imagem / Thumbnail */}
                  <div className="h-28 bg-[#121214] border-b border-[#323238] relative overflow-hidden">
                    {r.thumbnailUrl ? (
                      <img src={r.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-70" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
                    <div className="absolute left-4 bottom-3">
                      <div className="text-xs text-gray-300 font-black">{r.moduleTitle || "Módulo"}</div>
                      <div className="text-sm text-white font-black truncate max-w-[28ch]">{r.lessonTitle || "Aula"}</div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1 w-full bg-[#850000]/25">
                    <div
                      className="h-1 bg-[#850000]"
                      style={{ width: `${Number(r.moduleProgressPct || 0)}%` }}
                    />
                  </div>
                  </div>

                  <div className="p-3">
                    <div className="text-xs text-gray-400">
                      {isActive ? "Clique pra continuar" : "Acesso bloqueado"}
                      {typeof r.moduleDone === "number" && typeof r.moduleTotal === "number" && (
                        <div className="mt-1 text-[11px] text-gray-400 font-black">
                          Progresso: {r.moduleDone}/{r.moduleTotal}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <HubCard
            title="Passo 01: Assine o Contrato"
            description="Primeira etapa. Assine digitalmente seus termos para liberar as instruções."
            icon={FileText}
            locked={false}
            onClick={() => {
              go && go(isContractSigned ? "contract_signed_success" : "contract_sign");
            }}
          />

          <HubCard
            title="Passo 02: Onboarding Consultoria"
            description="Acesse todas informações importantes para a consulta e integração a consultoria."
            icon={Rocket}
            locked={!isContractSigned}
            onClick={() => go && go("onboarding_start")}
          />

          <HubCard
            title="Passo 03: Área de Membros"
            description="Acesse suas aulas, treinos e materiais complementares."
            icon={PlaySquare}
            locked={!isActive}
            onClick={() => go && go("members_area")}
          />
        </div>

        {!isActive && (
          <div className="relative overflow-hidden bg-ebony-surface border border-ebony-border border-l-4 border-l-red-500/50 rounded-r-xl p-5 shadow-lg mt-4">
            {/* Glow de fundo para alerta */}
            <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />

            <div className="relative z-10 text-sm text-ebony-muted leading-relaxed">
              Teu acesso está bloqueado porque o status financeiro está{' '}
              {/* Aplicação do Protocolo Neon (Contexto: Erro/Bloqueio) */}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 align-middle mx-1">
                {student.finStatus}
              </span>
              . Assim que mudar para <strong className="text-white">Ativo</strong>, destrava na hora (realtime).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}