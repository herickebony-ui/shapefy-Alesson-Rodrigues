import React, { useEffect, useState } from "react";
import { AlertTriangle, X, RefreshCw, Trash2 } from "lucide-react";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import axios from "axios";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db } from "../firebase";

// URL do seu Webhook (Função Firebase)
const WEBHOOK_URL = "https://us-central1-onboarding-consultoria.cloudfunctions.net/receberWebhookShapefy"; 

const AuditoriaFeedbacks = () => {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // --- MONITORAMENTO EM TEMPO REAL (O LIMBO) ---
  useEffect(() => {
    const q = query(collection(db, "unidentified_feedbacks"), orderBy("receivedAt", "desc"));
    
    // Escuta ativa: se cair um erro novo, atualiza na hora
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setItems(data);
    });

    return () => unsubscribe();
  }, []);

  // --- LÓGICA DE REPROCESSAR ---
  const handleReprocess = async (item) => {
    setProcessingId(item.id);
    try {
      const response = await axios.post(WEBHOOK_URL, item.frappePayload);
      
      if (response.data.success && response.data.action === 'created') {
        // Sucesso: Remove do Limbo
        await deleteDoc(doc(db, "unidentified_feedbacks", item.id));
        
        // Se era o último item, fecha o modal automaticamente
        if (items.length === 1) setIsOpen(false); 
        
        alert("✅ Sucesso! Feedback vinculado e tarefa criada.");
      } else if (response.data.action === 'limbo') {
        alert("❌ O sistema tentou, mas ainda não achou o aluno. Verifique o email no cadastro.");
      } else {
        alert(`⚠️ Retorno inesperado: ${response.data.msg}`);
      }
    } catch (error) {
      console.error("Erro reprocessamento:", error);
      alert("Erro de conexão ao reprocessar.");
    } finally {
      setProcessingId(null);
    }
  };

  // --- LÓGICA DE EXCLUIR ---
  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja descartar este feedback permanentemente?")) {
      await deleteDoc(doc(db, "unidentified_feedbacks", id));
    }
  };

  // Se não tem erro, esse componente "some" da tela (retorna null)
  if (items.length === 0) return null;

  return (
    <>
      {/* --- 1. O BOTÃO DE ALERTA (TRIGGER) --- */}
      <button
        onClick={() => setIsOpen(true)}
        className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-[#850000] text-white px-4 py-2 rounded-xl shadow-lg border border-red-500 animate-pulse hover:scale-105 transition-transform z-20"
      >
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs font-bold uppercase hidden sm:inline">
          Auditoria ({items.length})
        </span>
      </button>

      {/* --- 2. O MODAL DE CORREÇÃO (SOBREPOSTO) --- */}
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] border border-[#333] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header Modal */}
            <div className="bg-[#850000] px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                Auditoria: Feedbacks Não Identificados
              </h3>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-white/70 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo da Tabela */}
            <div className="overflow-y-auto p-0 flex-1">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-[#252525] text-gray-200 uppercase font-medium sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Aluno (Form)</th>
                    <th className="px-6 py-4">Email Recebido</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#333]">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#2a2a2a] transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.receivedAt?.seconds ? format(new Date(item.receivedAt.seconds * 1000), "dd/MM HH:mm", { locale: ptBR }) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white font-bold text-base">{item.studentName}</div>
                        <div className="text-xs text-gray-600 font-mono mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          ID: {item.frappeFeedbackId}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-red-300 font-mono bg-red-900/20 px-2 py-1 rounded text-xs border border-red-900/30">
                          {item.studentEmail}
                        </span>
                        <div className="text-xs mt-1 text-gray-500">Não encontrado no banco</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center items-center gap-3">
                          <button
                            onClick={() => handleReprocess(item)}
                            disabled={processingId === item.id}
                            className="flex items-center gap-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white px-3 py-1.5 rounded-lg transition-all border border-blue-600/20 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${processingId === item.id ? 'animate-spin' : ''}`} />
                            <span className="text-xs font-bold uppercase">
                              {processingId === item.id ? "..." : "Reprocessar"}
                            </span>
                          </button>
                          
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Descartar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Modal */}
            <div className="bg-[#1f1f1f] px-6 py-3 text-xs text-gray-500 border-t border-[#333] shrink-0 flex justify-between">
              <span>Fluxo: 1. Copie o email errado; 2. Corrija no cadastro do Aluno; 3. Clique em Reprocessar.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AuditoriaFeedbacks;