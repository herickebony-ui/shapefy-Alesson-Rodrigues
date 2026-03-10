import React, { useEffect, useState } from "react";
import { CheckSquare, LayoutDashboard, Megaphone } from "lucide-react"; 
import TasksModule from "./TasksModule";
import FeedbackModule from "./FeedbackModule";
import CommunicationModule from "./CommunicationModule.jsx";
import AuditoriaFeedbacks from "./AuditoriaFeedbacks"; 

// Adicionei a prop 'hideNavigation' com padrão false
export default function OperationsHub({ students, pendingTaskId, setPendingTaskId, initialTab = "tasks", hideNavigation = false, feedbackInitialView }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // --- EFEITO: FORÇAR ABA TAREFAS SE VIER DO SINO ---
  useEffect(() => {
    if (pendingTaskId) {
      setActiveTab("tasks");
    }
  }, [pendingTaskId]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="w-full min-h-screen flex flex-col gap-6 relative overflow-x-hidden">
      
      {/* --- NAVEGAÇÃO SUPERIOR (SÓ RENDERIZA SE hideNavigation FOR FALSE) --- */}
      {!hideNavigation && (
        <div className="w-full flex justify-center items-center pt-2 pb-2 relative px-4">
          
          <div className="inline-flex flex-col md:flex-row bg-ebony-deep p-1.5 rounded-2xl border border-ebony-border shadow-2xl z-10 w-full md:w-auto">
            
            {/* 1. TAREFAS */}
            <button
              onClick={() => setActiveTab("tasks")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === "tasks"
                  ? "bg-ebony-primary text-white shadow-lg shadow-red-900/20 scale-105"
                  : "text-ebony-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Gestão de Tarefas
            </button>

            {/* 2. FEEDBACKS */}
            <button
              onClick={() => setActiveTab("feedback")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === "feedback" || activeTab === "feedbacks" // Proteção para caso venha string diferente
                  ? "bg-ebony-primary text-white shadow-lg shadow-red-900/20 scale-105"
                  : "text-ebony-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Gestão de Feedbacks
            </button>

            {/* 3. COMUNICAÇÃO */}
            <button
              onClick={() => setActiveTab("communication")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === "communication"
                  ? "bg-ebony-primary text-white shadow-lg shadow-red-900/20 scale-105"
                  : "text-ebony-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <Megaphone className="w-4 h-4" />
              Gestão de Comunicação
            </button>

          </div>

          <AuditoriaFeedbacks />

        </div>
      )}

      {/* --- ÁREA DE CONTEÚDO (FULL WIDTH) --- */}
      <div className="w-full flex-1 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Adicionei 'mt-6' caso a navegação esteja oculta, para não colar no topo */}
        <div className={hideNavigation ? "mt-4" : ""}> 
            <div style={{ display: activeTab === "tasks" ? "block" : "none" }}>
            <TasksModule
                students={students}
                pendingTaskId={pendingTaskId}
                setPendingTaskId={setPendingTaskId}
            />
            </div>

            {/* Ajuste para aceitar 'feedback' ou 'feedbacks' */}
            <div style={{ display: (activeTab === "feedback" || activeTab === "feedbacks") ? "block" : "none" }}>
            <FeedbackModule students={students} initialView={feedbackInitialView} />
            </div>

            <div style={{ display: activeTab === "communication" ? "block" : "none" }}>
            <CommunicationModule students={students} />
            </div>
        </div>

      </div>
    </div>
  );
}