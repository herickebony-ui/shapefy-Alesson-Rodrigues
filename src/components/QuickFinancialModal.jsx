import React, { useState, useEffect } from 'react';
import { X, Check, Loader, DollarSign, Calendar, CreditCard } from 'lucide-react';
import {
  addDoc, collection, doc, updateDoc,
  serverTimestamp, writeBatch, arrayRemove
} from "firebase/firestore";
import { db } from '../firebase';
import { getAuth } from "firebase/auth";

const QuickFinancialModal = ({ student, plans, students = [], onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  // --- VÍNCULOS (CASAL/GRUPO) ---
  const [linkedStudents, setLinkedStudents] = useState([]); // [{id,name,phone}]
  const [linkSearchTerm, setLinkSearchTerm] = useState("");
  const [originalLinkedIds, setOriginalLinkedIds] = useState([]); // antes de editar
  const [linksPanelOpen, setLinksPanelOpen] = useState(false);

  // Estado do formulário
  const [formData, setFormData] = useState({
    grossValue: "",
    netValue: "",
    payDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Pix", // só Pix/Cartão/Dinheiro
    planId: "",
    planName: "",
    obs: ""
  });

  // 1. Tenta preencher automático se o aluno já tiver plano vinculado
  useEffect(() => {
    // Só roda se tiver aluno, tiver planos carregados e o formulário ainda estiver "virgem" (sem valor)
    if (student?.planId && plans.length > 0 && !formData.netValue) {
      handleSelectPlan(student.planId);
    }
  }, [student, plans]); // Dependências

  useEffect(() => {
    if (!student?.id) return;

    const ids = Array.isArray(student?.linkedStudentIds) ? student.linkedStudentIds : [];
    setOriginalLinkedIds(ids);

    const found = (students || [])
      .filter(s => ids.includes(s.id))
      .map(s => ({ id: s.id, name: s.name, phone: s.phone }));

    setLinkedStudents(found);
    setLinksPanelOpen(false);
    setLinkSearchTerm("");
  }, [student?.id, students]);

  // Função que aplica os dados do plano nos inputs
  const applyPlanToForm = (plan) => {
    setFormData(prev => ({
      ...prev,
      planId: plan.id,
      planName: plan.name,
      // Pega valor e método do objeto do plano
      netValue: plan.netValue || plan.price || '',
      paymentMethod: plan.paymentMethod || 'Pix',
      obs: `Plano: ${plan.name} (${plan.durationMonths || 0} meses)`
    }));
  };

  const handleSelectPlan = (planId) => {
    const selectedPlan = plans.find(p => p.id === planId);

    if (selectedPlan) {
      const methodFromPlan = selectedPlan.paymentMethod || "Pix";

      setFormData(prev => ({
        ...prev,
        planId: selectedPlan.id,
        planName: selectedPlan.name,

        // bruto/líquido do plano (se não tiver gross, usa net)
        grossValue: String(selectedPlan.grossValue ?? selectedPlan.netValue ?? selectedPlan.price ?? ""),
        netValue: String(selectedPlan.netValue ?? selectedPlan.price ?? ""),

        paymentMethod: ["Pix", "Cartão", "Dinheiro"].includes(methodFromPlan) ? methodFromPlan : "Pix",
      }));
    } else {
      // plano obrigatório: se ficou vazio, só limpa
      setFormData(prev => ({
        ...prev,
        planId: "",
        planName: "",
        grossValue: "",
        netValue: "",
        paymentMethod: "Pix",
      }));
    }

  };

  // Função para pular sem salvar nada
  const handleSkip = () => {
    // Passa 'false' para avisar ao Dashboard que NÃO houve pagamento (apenas pulou)
    if (onSuccess) onSuccess(false);
    onClose();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.planId) return alert("Selecione um plano (obrigatório).");
    if (!formData.grossValue || !formData.netValue) return alert("Informe bruto e líquido.");

    setLoading(true);
    let success = false;

    const syncLinkedGroup = async (baseStudentId, newLinkedIds) => {
      const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];

      const cleanNew = uniq(newLinkedIds).filter(id => id !== baseStudentId);
      const group = uniq([baseStudentId, ...cleanNew]);

      const removed = uniq(originalLinkedIds).filter(id => !group.includes(id));

      const batch = writeBatch(db);

      group.forEach(id => {
        const others = group.filter(x => x !== id);
        batch.update(doc(db, "students", id), { linkedStudentIds: others });
      });

      removed.forEach(id => {
        const toRemove = group.filter(x => x !== id);
        if (toRemove.length) {
          batch.update(doc(db, "students", id), { linkedStudentIds: arrayRemove(...toRemove) });
        }
      });

      await batch.commit();
    };


    try {

      // 1. Salva Pagamento na coleção 'payments'
      const net = parseFloat(String(formData.netValue).replace(",", "."));
      const gross = parseFloat(String(formData.grossValue).replace(",", "."));

      const paymentRef = await addDoc(collection(db, "payments"), {
        studentId: student.id,
        studentName: student.name,

        planId: formData.planId,
        planType: formData.planName,

        paymentMethod: formData.paymentMethod,

        netValue: net,
        grossValue: gross,

        payDate: formData.payDate,

        // ✅ rápido NÃO tem início nem vencimento
        startDate: null,
        dueDate: null,

        status: "Pago e não iniciado",

        // ✅ padrão do sistema (ordem correta)
        createdAt: serverTimestamp(),

        // compat: robusto usa notes
        notes: formData.obs || "",
        obs: formData.obs || ""
      });

            // ✅ AUDITORIA (FINANCEIRO RÁPIDO)
            const auth = getAuth();
            const who = auth.currentUser?.email || "admin";
      
            await addDoc(collection(db, "audit_logs"), {
              action: "CRIOU_LANCAMENTO",
              entity: "PAYMENT",
              entityId: paymentRef.id,
      
              studentId: student.id,
              studentName: student.name,
      
              planName: formData.planName || "",
              netValue: Number(net) || 0,
              payDate: formData.payDate || "",
      
              note: `Lançamento rápido (${formData.paymentMethod})`,
              who,
              createdAt: serverTimestamp()
            });      

      // 2. Atualiza dados do Aluno na coleção 'students'
      const selectedPlan = plans.find(p => p.id === formData.planId);
      const planColor = selectedPlan?.color || "slate";

      const updatePayload = {
        lastPaymentDate: formData.payDate,
        lastPaymentValue: net,

        // ✅ plano completo (mata “plano fantasma”)
        planId: formData.planId,
        planName: formData.planName,
        planColor,

        // ✅ espelho financeiro (compacto)
        finStatus: "Pago e não iniciado",
        finPlanName: formData.planName,
        finPlanColor: planColor,
        finDueDate: null,
        finUpdatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, "students", student.id), updatePayload);

      // ✅ salva vínculos (se tiver)
      const currentLinkedIds = linkedStudents.map(ls => ls.id);
      await syncLinkedGroup(student.id, currentLinkedIds);

      success = true;

    } catch (error) {
      console.error("Erro ao salvar financeiro:", error);
      alert("Erro ao salvar. Verifique o console.");
    } finally {
      setLoading(false);
    
      if (success) {
        if (onSuccess) onSuccess(true);
        onClose();
      }
    }
    

  };

  return (
    // ESTRUTURA COPIADA DO SEU ARQUIVO DE REFERÊNCIA (TITANIUM DARK)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-ebony-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-ebony-border">
  
        {/* HEADER (TITANIUM) */}
        <div className="p-5 border-b border-ebony-border flex justify-between items-center bg-ebony-surface rounded-t-2xl">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-white">Lançar Pagamento</h2>
            <p className="text-xs text-ebony-muted mt-1 truncate">
              Aluno: <strong className="text-ebony-text">{student?.name}</strong>
            </p>
          </div>
  
          <button
            onClick={onClose}
            className="p-2 hover:bg-ebony-deep rounded-full transition-colors border border-transparent hover:border-ebony-border"
            title="Fechar"
          >
            <X size={20} className="text-ebony-muted" />
          </button>
        </div>
  
        {/* FORMULÁRIO */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
  
          {/* BLOCO DE PREENCHIMENTO RÁPIDO (NEON AZUL - “Glass”) */}
          <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-wider mb-1 block">
              ⚡ Selecionar Plano (Preenche Valor e Método)
            </label>
  
            <div className="relative">
              <select
                value={formData.planId}
                onChange={(e) => handleSelectPlan(e.target.value)}
                className="w-full p-2 pl-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm font-bold outline-none cursor-pointer hover:border-blue-500/30 transition-colors appearance-none"
              >
                <option value="" disabled>-- Selecione um Plano --</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    ● {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
  
          {/* VÍNCULOS (CASAL/GRUPO) */}
          <div className="p-3 rounded-xl border border-ebony-border bg-ebony-deep">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black text-ebony-muted uppercase tracking-wider">
                  🔗 Vínculos (casal/grupo)
                </div>
  
                <div className="text-sm font-black text-white truncate">
                  {linkedStudents.length
                    ? linkedStudents.map(l => l.name).join(", ")
                    : "Nenhum vínculo"}
                </div>
              </div>
  
              <button
                type="button"
                onClick={() => {
                  setLinksPanelOpen(v => !v);
                  setLinkSearchTerm("");
                }}
                className="shrink-0 px-3 py-1.5 text-xs font-black rounded-lg bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface transition-colors"
              >
                {linksPanelOpen ? "Fechar" : (linkedStudents.length ? "Editar" : "Adicionar")}
              </button>
            </div>
  
            {linksPanelOpen && (
              <div className="mt-3 pt-3 border-t border-ebony-border space-y-3">
  
                {/* Selecionados */}
                <div className="flex flex-wrap gap-2">
                  {linkedStudents.map(link => (
                    <div
                      key={link.id}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-black"
                    >
                      <span className="max-w-[200px] truncate">{link.name}</span>
  
                      <button
                        type="button"
                        onClick={() => setLinkedStudents(prev => prev.filter(p => p.id !== link.id))}
                        className="opacity-80 hover:opacity-100"
                        title="Remover vínculo"
                      >
                        <X size={14} className="text-blue-400" />
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
                    className="w-full p-2.5 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm outline-none"
                  />
  
                  {linkSearchTerm.trim().length > 0 && (() => {
                    const q = linkSearchTerm.trim().toLowerCase();
                    const matches = (students || [])
                      .filter(s =>
                        s.id !== student?.id &&
                        !linkedStudents.some(sel => sel.id === s.id) &&
                        (s.name || "").toLowerCase().includes(q)
                      )
                      .slice(0, 20);
  
                    return (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-ebony-surface border border-ebony-border rounded-xl shadow-lg max-h-48 overflow-y-auto z-50 overflow-hidden">
                        {matches.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-ebony-muted text-center">
                            Nenhum aluno encontrado.
                          </div>
                        ) : (
                          matches.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={() => {
                                setLinkedStudents(prev => [...prev, { id: s.id, name: s.name, phone: s.phone }]);
                                setLinkSearchTerm("");
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-ebony-border/30 border-b border-ebony-border last:border-0"
                            >
                              <div className="text-sm font-black text-white">{s.name}</div>
                              {s.phone && <div className="text-[11px] text-ebony-muted">{s.phone}</div>}
                            </button>
                          ))
                        )}
                      </div>
                    );
                  })()}
                </div>
  
                <p className="text-[10px] text-ebony-muted">
                  Isso salva o vínculo no cadastro do aluno (casal/grupo).
                </p>
              </div>
            )}
          </div>
  
          <div className="grid grid-cols-2 gap-4">
            {/* VALOR BRUTO */}
            <div className="space-y-1">
              <label className="text-xs font-black text-ebony-muted uppercase tracking-wider mb-1 block">
                Bruto (R$)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3.5 text-ebony-muted" size={16} />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.grossValue}
                  onChange={(e) => setFormData({ ...formData, grossValue: e.target.value })}
                  className="w-full pl-9 p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 font-black outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>
  
            {/* VALOR LÍQUIDO */}
            <div className="space-y-1">
              <label className="text-xs font-black text-ebony-muted uppercase tracking-wider mb-1 block">
                Líquido (R$)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3.5 text-ebony-muted" size={16} />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.netValue}
                  onChange={(e) => setFormData({ ...formData, netValue: e.target.value })}
                  className="w-full pl-9 p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 font-black outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>
  
            {/* DATA */}
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="text-xs font-black text-ebony-muted uppercase tracking-wider mb-1 block">
                Data
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3.5 text-ebony-muted" size={16} />
                <input
                  type="date"
                  required
                  value={formData.payDate}
                  onChange={(e) => setFormData({ ...formData, payDate: e.target.value })}
                  className="w-full pl-9 p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none"
                />
              </div>
            </div>
          </div>
  
          {/* MÉTODO DE PAGAMENTO */}
          <div className="space-y-1">
            <label className="text-xs font-black text-ebony-muted uppercase tracking-wider mb-1 block">
              Forma de Pagamento
            </label>
  
            <div className="relative">
              <CreditCard className="absolute left-3 top-3.5 text-ebony-muted" size={16} />
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full pl-9 p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none cursor-pointer"
              >
                <option value="Pix">Pix</option>
                <option value="Cartão">Cartão</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
            </div>
          </div>
  
          {/* OBSERVAÇÃO */}
          <div className="space-y-1">
            <label className="text-xs font-black text-ebony-muted uppercase tracking-wider mb-1 block">
              Observação
            </label>
  
            <input
              type="text"
              value={formData.obs}
              onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
              className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 font-medium outline-none"
              placeholder="Detalhes adicionais..."
            />
          </div>
  
          {/* BOTÕES */}
          <div className="pt-4 flex items-center gap-2">
  
            {/* 1. Cancelar (Fecha tudo) */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-sm font-black text-ebony-muted hover:text-white hover:bg-ebony-surface rounded-lg transition-colors border border-transparent hover:border-ebony-border"
            >
              Cancelar
            </button>
  
            {/* 2. Pular etapa (NEON AZUL) */}
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-3 text-sm font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/15 rounded-lg transition-colors mr-auto"
              title="Ir para o contrato sem lançar pagamento"
            >
              Pular etapa ➜
            </button>
  
            {/* 3. Confirmar (Primário Ebony) */}
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-ebony-primary hover:bg-red-900 text-white font-black rounded-lg shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 hover:shadow-[0_0_15px_-3px_rgba(133,0,0,0.3)]"
            >
              {loading ? <Loader className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
              Confirmar
            </button>
          </div>
  
        </form>
      </div>
    </div>
  );
  
};

export default QuickFinancialModal;