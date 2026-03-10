import React, { useState, forwardRef, useImperativeHandle } from 'react';
import {
  collection, doc, updateDoc, deleteDoc, getDoc, getDocs, addDoc, query, where
} from "firebase/firestore";
import { History, X, FileText, Loader, Settings, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { generateContractPDF } from '../utils/utils';

const ContractManager = forwardRef(({ onReloadData }, ref) => {

    // --- LÓGICA DO HISTÓRICO DE CONTRATOS ---
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyContracts, setHistoryContracts] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyStudentName, setHistoryStudentName] = useState("");
    // --- FILTROS DA LISTA (ATUALIZADO: BUSCA + ASSINADO) ---

  const [historyStudentId, setHistoryStudentId] = useState(null); // <--- Adicione isto


   // --- 1. FUNÇÃO PARA ABRIR O HISTÓRICO ---
   const handleOpenHistory = async (student) => {
    setIsHistoryOpen(true);
    setLoadingHistory(true);
    setHistoryStudentName(student.name);
    setHistoryStudentId(student.id);

    console.log("Abrindo histórico para:", student.id);

    try {
      // Busca apenas pelo ID do aluno (sem ordenar no banco para evitar erro de índice)
      const q = query(collection(db, "contracts"), where("studentId", "==", student.id));
      const snapshot = await getDocs(q);

      // Ordena manualmente no Javascript (do mais novo para o mais velho)
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setHistoryContracts(list);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      alert("Erro ao carregar histórico. Verifique o console.");
    } finally {
      setLoadingHistory(false);
    }
  };

   // --- 2. FUNÇÃO PARA GERAR PDF DE UM CONTRATO ANTIGO ---
   const handleGenerateHistoryPDF = async (contract) => {
    if (!contract.signature?.image) return alert("Este contrato não possui assinatura digital salva.");

    const confirmGen = confirm("Deseja gerar o PDF oficial deste contrato antigo?");
    if (!confirmGen) return;

    // Cria um 'Aluno Temporário' com os dados daquele contrato específico
    const mockStudent = {
      id: contract.studentId, // ID real do aluno
      name: contract.studentSnapshot?.name || "Aluno",
      // Usa o texto e assinatura DO CONTRATO, não do cadastro atual
      contractText: contract.contractText,
      signature: contract.signature,
      studentData: contract.studentSnapshot || {},
      latestContractId: contract.id // IMPORTANTE: Para salvar o link no documento certo
    };

    // Chama a função global de gerar PDF (que está no utils.jsx ou importada)
    await generateContractPDF(mockStudent);

    // Atualiza a lista na hora para o botão mudar de "Gerar" para "Baixar"
    handleOpenHistory({ id: contract.studentId, name: historyStudentName });
  };

  // --- FUNÇÃO NOVA: EXCLUIR ITEM DO HISTÓRICO E RESETAR STATUS ---
  const handleDeleteHistoryItem = async (contractId) => {
    if (!window.confirm("🗑️ Tem certeza? Se esse for o contrato atual, o status do aluno será resetado para 'Sem Contrato'.")) return;

    try {
      // 1. Exclui o contrato do histórico
      await deleteDoc(doc(db, "contracts", contractId));

      // Atualiza a lista visualmente na hora
      setHistoryContracts(prev => prev.filter(c => c.id !== contractId));

      // 2. Tenta resetar o status do aluno se tivermos o ID dele
      // (historyStudentId foi adicionado no estado lá em cima, veja o passo abaixo)
      if (historyStudentId) {
        const studentRef = doc(db, "students", historyStudentId);

        // Busca o aluno para ver se o contrato que apagamos era o "latestContractId" dele
        const studentSnap = await getDoc(studentRef);
        if (studentSnap.exists()) {
          const sData = studentSnap.data();
          if (sData.latestContractId === contractId) {
            // Se era o contrato atual, reseta o aluno
            await updateDoc(studentRef, {
              status: 'student_only', // Volta para "Sem Contrato" (cinza)
              latestContractId: null,
              latestContractStatus: null,
              contractPdfUrl: null
            });
            // Recarrega a lista principal para o status amarelo sumir
            if (onReloadData) onReloadData();
          }
        }
      }

      alert("Registro excluído!");
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir.");
    }
  };

  // --- FUNÇÃO DE GERAÇÃO BLINDADA (Busca Texto e Dados antes de gerar) ---
  const handleSmartPDF = async (student) => {
    // Feedback visual simples
    const originalText = document.getElementById(`btn-pdf-${student.id}`)?.innerHTML;
    if (document.getElementById(`btn-pdf-${student.id}`)) {
      document.getElementById(`btn-pdf-${student.id}`).innerHTML = "...";
    }

    let fullStudent = { ...student };

    try {
      // 1. Busca os dados mais recentes do Aluno (Garante que o IP venha)
      const studentRef = doc(db, "students", student.id);
      const studentSnap = await getDoc(studentRef);

      if (studentSnap.exists()) {
        const freshData = studentSnap.data();
        // Mescla garantindo que tenhamos o studentData (onde fica o IP) atualizado
        fullStudent = { ...fullStudent, ...freshData, studentData: freshData.studentData || {} };
      }

      // 2. Busca o Texto do Contrato (Se não estiver no aluno, busca na coleção contracts)
      if (!fullStudent.contractText && fullStudent.latestContractId) {
        console.log("Texto não encontrado no aluno. Buscando no contrato vinculado:", fullStudent.latestContractId);
        const contractRef = doc(db, "contracts", fullStudent.latestContractId);
        const contractSnap = await getDoc(contractRef);

        if (contractSnap.exists()) {
          // INJETA O TEXTO NO OBJETO ANTES DE GERAR
          fullStudent.contractText = contractSnap.data().contractText;
        }
      }

      // 3. Agora sim, chama o gerador com o objeto COMPLETO
      await generateContractPDF(fullStudent);

    } catch (error) {
      console.error("Erro ao preparar PDF:", error);
      alert("Erro ao preparar dados do PDF.");
    } finally {
      // Restaura o botão
      if (document.getElementById(`btn-pdf-${student.id}`) && originalText) {
        document.getElementById(`btn-pdf-${student.id}`).innerHTML = originalText;
      }
    }
  };

  useImperativeHandle(ref, () => ({
    handleOpenHistory,
    handleDeleteHistoryItem,
    handleGenerateHistoryPDF,
    handleSmartPDF,
  }));

  // ===== ÁREA 3: JSX =====
  return (
    <>
      {/* --- MODAL DE HISTÓRICO --- */}
      {isHistoryOpen && (
              <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-ebony-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-ebony-border">
                  <div className="bg-ebony-deep p-4 border-b border-ebony-border flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <History className="w-5 h-5" /> Histórico: {historyStudentName}
                    </h3>
                    <button
                      onClick={() => setIsHistoryOpen(false)}
                      className="p-2 hover:bg-ebony-surface rounded-full transition-colors border border-transparent hover:border-ebony-border"
                    >
                      <X className="w-5 h-5 text-ebony-muted" />
                    </button>
                  </div>

                  <div className="p-6 max-h-[60vh] overflow-y-auto bg-ebony-bg">
                    {loadingHistory ? (
                      <div className="text-center py-8 text-ebony-muted">
                        <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
                        Carregando contratos...
                      </div>
                    ) : historyContracts.length === 0 ? (
                      <div className="text-center py-8 text-ebony-muted border-2 border-dashed border-ebony-border rounded-xl bg-ebony-surface">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p>Nenhum contrato encontrado no histórico.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {historyContracts.map(contract => (
                          <div
                            key={contract.id}
                            className="bg-ebony-surface p-4 rounded-xl border border-ebony-border shadow-sm flex items-center justify-between hover:bg-ebony-border/20 transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-white text-sm">
                                  {contract.studentSnapshot?.name || "Contrato"}
                                </span>
                                {contract.status === 'signed' ? (
                                  <span className="bg-ebony-deep text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-ebony-border">
                                    ASSINADO
                                  </span>
                                ) : (
                                  <span className="bg-ebony-deep text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-ebony-border">
                                    PENDENTE
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-ebony-muted font-mono">
                                Gerado em: {new Date(contract.createdAt).toLocaleDateString('pt-BR')} às{' '}
                                {new Date(contract.createdAt).toLocaleTimeString('pt-BR').slice(0, 5)}
                              </p>
                              <p className="text-[10px] text-ebony-muted mt-1">ID: {contract.id}</p>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* CASO 1: PDF Já existe -> Baixar */}
                              {contract.contractPdfUrl ? (
                                <a
                                  href={contract.contractPdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 px-3 py-1.5 bg-ebony-primary hover:bg-red-900 text-white rounded-lg text-xs font-bold transition-transform hover:scale-105 shadow-lg"
                                >
                                  <FileText className="w-3 h-3" /> Baixar PDF
                                </a>
                              ) : contract.status === 'signed' ? (
                                // CASO 2: Assinado sem PDF -> Gerar Agora
                                <button
                                  onClick={() => handleGenerateHistoryPDF(contract)}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg text-xs font-bold transition-colors"
                                >
                                  <Settings className="w-3 h-3 animate-spin-slow" /> Gerar PDF
                                </button>
                              ) : (
                                // CASO 3: Pendente
                                <div className="flex items-center gap-1 text-ebony-muted bg-ebony-deep px-2 py-1 rounded border border-ebony-border">
                                  <Loader className="w-3 h-3 animate-spin" />
                                  <span className="text-[10px] font-bold">Aguardando</span>
                                </div>
                              )}

                              {/* --- BOTÃO LIXEIRA (Cole aqui) --- */}
                              <button
                                onClick={() => handleDeleteHistoryItem(contract.id)}
                                className="p-1.5 bg-transparent text-ebony-muted border border-ebony-border rounded hover:bg-ebony-deep hover:text-red-400 transition-colors ml-2"
                                title="Excluir este registro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
    </>
  );
});

export default ContractManager;