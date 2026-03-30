import React, { useState } from 'react';
import {
  collection, doc, updateDoc, addDoc, getDoc, setDoc,
  writeBatch, arrayRemove
} from "firebase/firestore";
import {
  Users, FileText, Settings, Plus, Save, X, Search, FileSignature,
  CheckCircle, ChevronRight, Loader
} from 'lucide-react';
import { getAuth } from "firebase/auth";
import { db } from '../firebase';
import { generateSlug, applyStudentValuesToContract } from '../utils/utils';
import RichTextEditor from './RichTextEditor';

const cleanPhone = (phone) => (phone ? String(phone).replace(/\D/g, '') : '');

const StudentFormModal = ({
  isInviting,
  setIsInviting,
  editingStudentId,
  setEditingStudentId,
  students,
  plans,
  templates,
  plansById,
  onReloadData,
  onOpenFinancial,
  isSameNumber,
  setIsSameNumber,
  newStudentName,
  setNewStudentName,
  newStudentPhone,
  setNewStudentPhone,
  newStudentWhatsapp,
  setNewStudentWhatsapp,
  extraData,
  setExtraData,
}) => {

  const [selectedPlanForStudent, setSelectedPlanForStudent] = useState("");
  // Campos para o Template Dinâmico
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [adminFieldValues, setAdminFieldValues] = useState({});
  const [cepLoading, setCepLoading] = useState(false);

const [frappeExtra, setFrappeExtra] = useState({
  objetivo: '', instagram: '', sexo: '', age: '', height: '', weight: '',
  orientacoes_globais: '', dieta: false, treino: false,
  ja_usou_o_aplicativo: false, frequencia_atividade: '', doencas: '', medicamento: '',
});
const setFE = (f, v) => setFrappeExtra(prev => ({ ...prev, [f]: v }));

  // --- ESTADOS PARA VÍNCULOS (CASAL/GRUPO) ---
  const [linkedStudents, setLinkedStudents] = useState([]); // Lista dos selecionados
  const [linkSearchTerm, setLinkSearchTerm] = useState(""); // O que você digita na busca
  const [originalLinkedIds, setOriginalLinkedIds] = useState([]); // antes de editar
  
  // --- NOVOS ESTADOS PARA O FLUXO DE APROVAÇÃO (WORD) ---
  const [approvalStep, setApprovalStep] = useState(1); // 1 = Formulário, 2 = Editor Final
  const [includeOnboarding, setIncludeOnboarding] = useState(true); // Padrão: Com onboarding
  const [draftContract, setDraftContract] = useState(""); // O texto do contrato para editar

  // Inicializa estados internos quando o modal abre
  React.useEffect(() => {
    if (isInviting && editingStudentId) {
      const student = students.find(s => s.id === editingStudentId);
      if (student) {
        setSelectedPlanForStudent(student.onboardingPlanId || "");
        setIncludeOnboarding(!!student.onboardingPlanId);
        setAdminFieldValues({});
        setApprovalStep(1);
        setOriginalLinkedIds(Array.isArray(student.linkedStudentIds) ? student.linkedStudentIds : []);
        if (Array.isArray(student.linkedStudentIds)) {
          const found = students.filter(s => student.linkedStudentIds.includes(s.id));
          setLinkedStudents(found.map(s => ({ id: s.id, name: s.name })));
        } else {
          setLinkedStudents([]);
        }
        setLinkSearchTerm("");
      }
    }
    if (isInviting && !editingStudentId) {
      setApprovalStep(1);
      setSelectedPlanForStudent("");
      setIncludeOnboarding(true);
      setAdminFieldValues({});
      setDraftContract("");
      setLinkedStudents([]);
      setOriginalLinkedIds([]);
      setLinkSearchTerm("");
      setFrappeExtra({
        objetivo: '', instagram: '', sexo: '', age: '', height: '', weight: '',
        orientacoes_globais: '', dieta: false, treino: false,
        ja_usou_o_aplicativo: false, frequencia_atividade: '', doencas: '', medicamento: '',
      });
    }
}, [isInviting, editingStudentId]);
  // Limpa tudo quando o modal fecha
  React.useEffect(() => {
    if (!isInviting) {
      setApprovalStep(0);
      setDraftContract("");
      setSelectedPlanForStudent("");
      setAdminFieldValues({});
      setLinkedStudents([]);
      setLinkSearchTerm("");
    }
  }, [isInviting]);

  // --- FUNÇÃO NOVA: BUSCAR CEP (DASHBOARD) ---
  const handleDashboardCepBlur = async (e) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setExtraData(prev => ({
          ...prev,
          cep: cep,
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        }));
      } else {
        alert("CEP não encontrado.");
      }
    } catch (error) {
      console.error("Erro CEP", error);
    } finally {
      setCepLoading(false);
    }
  };

  // Função CORRIGIDA: Salva dados, VÍNCULOS e garante a atualização
  const handleSaveDataOnly = async () => {
    if (!editingStudentId) return alert("Nenhum aluno selecionado para edição.");
    try {
      let finalAddress = extraData.address;
      if (extraData.street) {
        finalAddress = `${extraData.street}, ${extraData.number}, ${extraData.neighborhood}, ${extraData.city} - ${extraData.state}, CEP: ${extraData.cep}`;
      }
      const phoneDigits = cleanPhone(newStudentPhone);
      const cleanWhatsapp = isSameNumber ? phoneDigits : cleanPhone(newStudentWhatsapp);

      // 1. Atualiza Firebase
      await updateDoc(doc(db, "students", editingStudentId), {
        name: newStudentName,
        phone: phoneDigits,
        whatsapp: cleanWhatsapp,
        ...extraData,
        address: finalAddress,
        linkedStudentIds: linkedStudents.map(s => s.id)
      });

      // 2. Sincroniza vínculos
      if (linkedStudents.length > 0 || originalLinkedIds.length > 0) {
        await syncLinkedGroup({
          studentId: editingStudentId,
          newLinkedIds: linkedStudents.map(s => s.id),
          prevLinkedIds: originalLinkedIds
        });
      }

      // 3. Atualiza Frappe via salvarAluno
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fns = getFunctions();
      const salvarAluno = httpsCallable(fns, 'salvarAluno');
      await salvarAluno({
        id: editingStudentId,
        campos: {
          nome_completo: newStudentName,
          email: extraData.email || "",
          telefone: phoneDigits,
          "profissão": extraData.profession || "",
          "endereço": finalAddress || "",
          cpf: extraData.cpf || "",
          objetivo: frappeExtra.objetivo || "",
          instagram: frappeExtra.instagram || "",
          sexo: frappeExtra.sexo || "",
          age: frappeExtra.age ? Number(frappeExtra.age) : 0,
          height: frappeExtra.height ? Number(frappeExtra.height) : 0,
          weight: frappeExtra.weight ? Number(frappeExtra.weight) : 0,
          orientacoes_globais: frappeExtra.orientacoes_globais || "",
          dieta: frappeExtra.dieta ? 1 : 0,
          treino: frappeExtra.treino ? 1 : 0,
          ja_usou_o_aplicativo: frappeExtra.ja_usou_o_aplicativo ? 1 : 0,
          frequencia_atividade: frappeExtra.frequencia_atividade || "",
          doencas: frappeExtra.doencas || "",
          medicamento: frappeExtra.medicamento || "",
        }
      });

      alert("✅ Dados salvos no Firebase e no Frappe!");
      if (onReloadData) setTimeout(async () => { await onReloadData(); }, 800);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar dados: " + e.message);
    }
  };

  const handleSaveWithoutContract = async () => {
    if (!newStudentName || !newStudentPhone) {
      alert("Nome e Telefone são obrigatórios.");
      return;
    }
    const phoneDigits = cleanPhone(newStudentPhone);
    const whatsappDigits = isSameNumber ? phoneDigits : cleanPhone(newStudentWhatsapp);
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fns = getFunctions();
      const criarAlunoFrappe = httpsCallable(fns, 'criarAlunoFrappe');
      const resultFrappe = await criarAlunoFrappe({
        nome_completo: String(newStudentName).trim(),
        email: extraData.email || "",
        telefone: phoneDigits,
        profissao: extraData.profession || "",
        endereco: extraData.address || "",
        cpf: extraData.cpf || "",
        objetivo: frappeExtra.objetivo || "",
        instagram: frappeExtra.instagram || "",
        sexo: frappeExtra.sexo || "",
        age: frappeExtra.age ? Number(frappeExtra.age) : 0,
        height: frappeExtra.height ? Number(frappeExtra.height) : 0,
        weight: frappeExtra.weight ? Number(frappeExtra.weight) : 0,
        orientacoes_globais: frappeExtra.orientacoes_globais || "",
        dieta: frappeExtra.dieta ? 1 : 0,
        treino: frappeExtra.treino ? 1 : 0,
        ja_usou_o_aplicativo: frappeExtra.ja_usou_o_aplicativo ? 1 : 0,
        frequencia_atividade: frappeExtra.frequencia_atividade || "",
        doencas: frappeExtra.doencas || "",
        medicamento: frappeExtra.medicamento || "",
      });
      if (!resultFrappe.data?.success) throw new Error("Falha ao criar aluno no Frappe.");
      const alunoId = resultFrappe.data.alunoId;
      await setDoc(doc(db, "students", alunoId), {
        name: String(newStudentName).trim(),
        phone: phoneDigits,
        whatsapp: whatsappDigits,
        email: extraData.email || "",
        cpf: extraData.cpf || "",
        profession: extraData.profession || "",
        address: extraData.address || "",
        createdAt: new Date().toISOString(),
        status: "student_only",
        planId: null,
        planName: null,
        linkedStudentIds: [],
      });
      alert(resultFrappe.data.jaExistia
        ? "⚠️ Aluno já existia no Frappe! Vinculado com sucesso."
        : "✅ Aluno cadastrado com sucesso!");
      setIsInviting(false);
      if (onReloadData) await onReloadData();
    } catch (e) {
      console.error(e);
      alert("Erro ao cadastrar: " + e.message);
    }
  };

  // 1. GERAR RASCUNHO (Passo A -> Passo B)
  const handleGenerateDraft = () => {
    // Validação Inteligente
    if (!newStudentName || !newStudentPhone || !selectedTemplateId) {
      alert("Preencha Nome, WhatsApp e escolha um Modelo de Contrato.");
      return;
    }

    if (includeOnboarding && !selectedPlanForStudent) {
      alert("Você marcou que existe Onboarding, então precisa selecionar um Fluxo.");
      return;
    }

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return alert("Modelo não encontrado.");

    let html = template.content;

    // A. Preenche Variáveis Manuais (Admin)
    const adminFields = template.fields.filter(f => f.owner === 'admin');
    for (const field of adminFields) {
      const val = adminFieldValues[field.key];
      if (!val) {
        alert(`O campo "${field.label}" é obrigatório.`);
        return;
      }
      const regex = new RegExp(`{{${field.key}}}`, 'g');
      html = html.replace(regex, val);
    }

    // --- CORREÇÃO: Montar o endereço em TEMPO REAL para o contrato ---
    // Assim, o que você digitou nos campos Rua/Bairro vai direto pro contrato, 
    // mesmo sem clicar em salvar antes.
    let currentAddress = extraData.address;

    if (extraData.street) {
      currentAddress = `${extraData.street}, ${extraData.number}, ${extraData.neighborhood}, ${extraData.city} - ${extraData.state}, CEP: ${extraData.cep}`;
    }
    // ----------------------------------------------------------------

    const nameStyled = `<b>${newStudentName.toUpperCase()}</b>`;
    html = html.replace(/{{nome}}/g, nameStyled);

    // B. Preenche Dados do Aluno
    const studentDataForMerge = {
      telefone: newStudentPhone,
      cpf: extraData.cpf,
      rg: extraData.rg,
      email: extraData.email,
      profissao: extraData.profession,

      endereco: currentAddress, // <--- AQUI: Usa o endereço montado na hora

      nascimento: extraData.birthDate ? new Date(extraData.birthDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "",
    };

    html = applyStudentValuesToContract(html, studentDataForMerge);

    setDraftContract(html);
    setApprovalStep(2);
  };

   // --- MICROCIRURGIA: SALVAR CADASTRO (COM DADOS COMPLETOS, MAS OPCIONAIS) ---
   const handleQuickRegister = async () => {
    if (!newStudentName || !newStudentPhone) {
      alert("Preencha o Nome e o Celular Obrigatórios.");
      return;
    }

    if (!isSameNumber && !String(newStudentWhatsapp || "").trim()) {
      alert("Preencha o número do WhatsApp.");
      return;
    }

    const phoneDigits = cleanPhone(newStudentPhone);
    const whatsappDigits = isSameNumber ? phoneDigits : cleanPhone(newStudentWhatsapp);

    try {
      // 1. Cria no Frappe via Cloud Function
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fns = getFunctions();
      const criarAlunoFrappe = httpsCallable(fns, 'criarAlunoFrappe');

      const resultFrappe = await criarAlunoFrappe({
        nome_completo: String(newStudentName).trim(),
        email: extraData.email || "",
        telefone: phoneDigits,
        profissao: extraData.profession || "",
        endereco: extraData.address || "",
        birthDate: extraData.birthDate || "", // Frappe calcula age internamente
      });

      if (!resultFrappe.data?.success) {
        throw new Error("Falha ao criar aluno no Frappe.");
      }

      const alunoId = resultFrappe.data.alunoId;

      // 2. Cria no Firebase students com o ID do Frappe
      await setDoc(doc(db, "students", alunoId), {
        name: String(newStudentName).trim(),
        phone: phoneDigits,
        whatsapp: whatsappDigits,
        email: extraData.email || "",
        cpf: extraData.cpf || "",
        rg: extraData.rg || "",
        birthDate: extraData.birthDate || "", // Data de nascimento fica no Firebase
        profession: extraData.profession || "",
        address: extraData.address || "",
        createdAt: new Date().toISOString(),
        status: "student_only",
        planId: null,
        planName: null,
        planColor: null,
        onboardingPlanId: null,
        templateId: null,
        linkedStudentIds: [],
      });

      alert(resultFrappe.data.jaExistia
        ? "Aluno já existia no Frappe! Cadastro vinculado com sucesso."
        : "Aluno cadastrado com sucesso!");

      const newStudentData = { id: alunoId, name: String(newStudentName).trim(), planId: null };

      setNewStudentName("");
      setNewStudentPhone("");
      setNewStudentWhatsapp("");
      setIsSameNumber(true);
      setExtraData({ cpf: '', rg: '', email: '', address: '', birthDate: '', profession: '' });

      setIsInviting(false);
      onOpenFinancial(newStudentData);

      if (onReloadData) await onReloadData();
    } catch (e) {
      console.error(e);
      alert("Erro ao cadastrar: " + e.message);
    }
  };

  const syncLinkedGroup = async ({ studentId, newLinkedIds = [], prevLinkedIds = [] }) => {
    const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];

    // 1) limpa o input
    const cleanNew = uniq(newLinkedIds).filter(id => id !== studentId);

    // 2) define o grupo final (tu + selecionados)
    const group = uniq([studentId, ...cleanNew]);

    // 3) quem saiu do vínculo (pra remover “fantasma”)
    const removed = uniq(prevLinkedIds).filter(id => !group.includes(id));

    const batch = writeBatch(db);

    // A) Para cada membro do grupo, salva a lista completa dos "outros"
    group.forEach(id => {
      const ref = doc(db, "students", id);
      const others = group.filter(x => x !== id);
      batch.update(ref, { linkedStudentIds: others });
    });

    // B) Para quem saiu, remove qualquer referência a esse grupo
    removed.forEach(id => {
      const ref = doc(db, "students", id);
      const toRemove = group.filter(x => x !== id);
      if (toRemove.length) {
        batch.update(ref, { linkedStudentIds: arrayRemove(...toRemove) });
      }
    });

    await batch.commit();
  };

  // --- FUNÇÃO DE LOG (CORREÇÃO DO ERRO REFERENCE ERROR) ---
  const logAudit = async (payload) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      // Tenta pegar o email do usuário logado, senão usa "admin"
      const quemFez = (user && user.email) ? user.email : "admin";

      await addDoc(collection(db, 'audit_logs'), {
        ...payload,
        createdAt: new Date().toISOString(),
        who: quemFez
      });
      console.log("Log de auditoria salvo com sucesso.");
    } catch (e) {
      console.error("Aviso: Não foi possível salvar o log de auditoria.", e);
      // O catch silencioso impede que o sistema trave se o log falhar
    }
  };

  // 2. FINALIZAR E GERAR CONTRATO (Passo B -> Firebase)
  const handleFinalizeInvite = async () => {
    if (!editingStudentId) return alert("Erro: Nenhum aluno selecionado.");
    if (!newStudentName) return alert("O nome do aluno é obrigatório.");

    try {
      // 1. Garante que o aluno existe no Frappe
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fns = getFunctions();
      const criarAlunoFrappe = httpsCallable(fns, 'criarAlunoFrappe');

      const resultFrappe = await criarAlunoFrappe({
        nome_completo: String(newStudentName).trim(),
        email: extraData.email || "",
        telefone: cleanPhone(newStudentPhone),
        profissao: extraData.profession || "",
        endereco: extraData.address || "",
        birthDate: extraData.birthDate || "",
      });

      if (!resultFrappe.data?.success) throw new Error("Falha ao criar aluno no Frappe.");
      const alunoId = resultFrappe.data.alunoId;

      // 2. Monta endereço completo
      let finalAddress = extraData.address || "";
      if (extraData.street) {
        finalAddress = `${extraData.street}, ${extraData.number || 'S/N'}, ${extraData.neighborhood} - ${extraData.city}/${extraData.state} - CEP: ${extraData.cep}`;
      }

      const timestamp = new Date().toISOString();
      const phoneDigits = cleanPhone(newStudentPhone);
      const whatsappDigits = isSameNumber ? phoneDigits : cleanPhone(newStudentWhatsapp);

      // 3. Cria contrato no Firebase
      const contractData = {
        studentId: alunoId,
        studentName: newStudentName,
        status: 'waiting_sign',
        createdAt: timestamp,
        contractText: draftContract,
        templateId: selectedTemplateId,
        studentSnapshot: {
          name: newStudentName,
          cpf: extraData.cpf,
          email: extraData.email,
          phone: phoneDigits
        }
      };

      const contractRef = await addDoc(collection(db, "contracts"), contractData);
      const newContractId = contractRef.id;

      // 4. Salva/atualiza aluno no Firebase com ID do Frappe
      await setDoc(doc(db, "students", alunoId), {
        name: newStudentName,
        phone: phoneDigits,
        whatsapp: whatsappDigits,
        email: extraData.email || "",
        cpf: extraData.cpf || "",
        rg: extraData.rg || "",
        birthDate: extraData.birthDate || "",
        profession: extraData.profession || "",
        address: finalAddress,
        cep: extraData.cep || "",
        street: extraData.street || "",
        number: extraData.number || "",
        neighborhood: extraData.neighborhood || "",
        city: extraData.city || "",
        state: extraData.state || "",
        createdAt: timestamp,
        status: 'waiting_sign',
        latestContractId: newContractId,
        contractPdfUrl: null,
        onboardingPlanId: includeOnboarding ? selectedPlanForStudent : null,
        planId: (includeOnboarding && selectedPlanForStudent) ? selectedPlanForStudent : null,
        linkedStudentIds: linkedStudents.map(s => s.id)
      }, { merge: true });

      // 5. Sincroniza vínculos
      if (linkedStudents.length > 0 || originalLinkedIds.length > 0) {
        await syncLinkedGroup({
          studentId: alunoId,
          newLinkedIds: linkedStudents.map(s => s.id),
          prevLinkedIds: originalLinkedIds
        });
      }

      // 6. Log de auditoria
      await logAudit({
        action: "GEROU_MINUTA",
        entity: "CONTRACT",
        entityId: newContractId,
        studentId: alunoId,
        studentName: newStudentName,
        note: `Minuta gerada com modelo: ${selectedTemplateId}`
      });

      alert("✅ Contrato gerado! O link está pronto.");

      const approvedStudentData = {
        id: alunoId,
        name: newStudentName,
        planId: (includeOnboarding && selectedPlanForStudent) ? selectedPlanForStudent : null,
      };

      setIsInviting(false);
      setEditingStudentId(null);
      setNewStudentName("");
      setDraftContract("");
      setApprovalStep(0);

      if (approvedStudentData.planId) onOpenFinancial(approvedStudentData);
      if (onReloadData) await onReloadData();

    } catch (e) {
      console.error("Erro ao finalizar:", e);
      alert("Erro ao salvar: " + e.message);
    }
  };

  // ===== ÁREA 3: JSX =====
  if (!isInviting) return null;

  return (    
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-ebony-surface rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200 border border-ebony-border">
            <div className="bg-ebony-deep border-b border-ebony-border p-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  {approvalStep === 0 ? (
                    <><Users className="w-5 h-5" /> Novo Cadastro: Escolha o Tipo</>
                  ) : approvalStep === 1 ? (
                    <><Users className="w-5 h-5" /> Passo 1: Dados & Negociação</>
                  ) : (
                    <><FileSignature className="w-5 h-5" /> Passo 2: Revisão Final da Minuta (Word)</>
                  )}
                </h3>
                <p className="text-xs text-ebony-muted">
                  {approvalStep === 1 ? "Confira os dados do aluno e defina as regras do plano." : "Edite o texto final se necessário. O que estiver aqui será o contrato oficial."}
                </p>
              </div>
              <button
                onClick={() => setIsInviting(false)}
                className="p-2 hover:bg-ebony-surface rounded-full transition-colors border border-transparent hover:border-ebony-border"
              >
                <X className="w-6 h-6 text-ebony-muted" />
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">              

            {approvalStep === 1 && (
                <div className="w-full h-full overflow-y-auto bg-ebony-bg p-3">
                  <div className="max-w-4xl mx-auto space-y-3">

                    {/* 1. DADOS BÁSICOS */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-ebony-muted uppercase">Dados Básicos</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newStudentName}
                          onChange={(e) => setNewStudentName(e.target.value)}
                          className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none"
                          placeholder="Nome Completo"
                        />
                        <div className="space-y-1">
                          <input
                            type="tel"
                            value={newStudentPhone}
                            onChange={(e) => {
                              setNewStudentPhone(e.target.value);
                              if (isSameNumber) setNewStudentWhatsapp(e.target.value);
                            }}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                            placeholder="Celular (Login)"
                          />
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id="same_number_step1"
                              checked={isSameNumber}
                              onChange={(e) => {
                                setIsSameNumber(e.target.checked);
                                if (e.target.checked) setNewStudentWhatsapp(newStudentPhone);
                                else setNewStudentWhatsapp("");
                              }}
                              className="w-3.5 h-3.5 rounded cursor-pointer accent-ebony-primary"
                            />
                            <label htmlFor="same_number_step1" className="text-[10px] text-ebony-muted cursor-pointer select-none">
                              WhatsApp é o mesmo?
                            </label>
                          </div>
                          {!isSameNumber && (
                            <input
                              type="tel"
                              value={newStudentWhatsapp}
                              onChange={(e) => setNewStudentWhatsapp(e.target.value)}
                              className="w-full p-2 mt-1 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 animate-in fade-in slide-in-from-top-1"
                              placeholder="Qual é o WhatsApp?"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2. DADOS CADASTRAIS */}
                    <div className="bg-ebony-surface p-4 rounded-xl border border-ebony-border shadow-sm space-y-3">
                      <h4 className="font-bold text-white text-sm uppercase border-b border-ebony-border pb-1.5 mb-1 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Dados Cadastrais
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="CPF"
                          value={extraData.cpf}
                          onChange={e => setExtraData({ ...extraData, cpf: e.target.value })}
                          className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                        />
                        <input
                          type="text"
                          placeholder="RG"
                          value={extraData.rg}
                          onChange={e => setExtraData({ ...extraData, rg: e.target.value })}
                          className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                        />
                        <input
                          type="date"
                          value={extraData.birthDate}
                          onChange={e => setExtraData({ ...extraData, birthDate: e.target.value })}
                          className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Profissão"
                          value={extraData.profession}
                          onChange={e => setExtraData({ ...extraData, profession: e.target.value })}
                          className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm"
                        />

                        <div className="md:col-span-2 bg-ebony-deep/60 p-4 rounded-lg border border-ebony-border grid grid-cols-4 gap-3">
                          <div className="col-span-4 text-xs font-bold text-ebony-muted uppercase mb-1">Endereço</div>
                          <div className="col-span-1">
                            <input
                              placeholder="CEP"
                              value={extraData.cep || ''}
                              onChange={e => setExtraData({ ...extraData, cep: e.target.value })}
                              onBlur={handleDashboardCepBlur}
                              className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            />
                            {cepLoading && <span className="text-[9px] text-ebony-muted animate-pulse">Buscando...</span>}
                          </div>
                          <div className="col-span-3">
                            <input
                              placeholder="Rua"
                              value={extraData.street || ''}
                              onChange={e => setExtraData({ ...extraData, street: e.target.value })}
                              className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            />
                          </div>
                          <div className="col-span-1">
                            <input
                              placeholder="Nº"
                              value={extraData.number || ''}
                              onChange={e => setExtraData({ ...extraData, number: e.target.value })}
                              className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              placeholder="Bairro"
                              value={extraData.neighborhood || ''}
                              onChange={e => setExtraData({ ...extraData, neighborhood: e.target.value })}
                              className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              placeholder="Cidade"
                              value={extraData.city || ''}
                              onChange={e => setExtraData({ ...extraData, city: e.target.value })}
                              className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            />
                          </div>
                          <div className="col-span-1">
                            <input
                              placeholder="UF"
                              value={extraData.state || ''}
                              onChange={e => setExtraData({ ...extraData, state: e.target.value })}
                              className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            />
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="Email"
                          value={extraData.email}
                          onChange={e => setExtraData({ ...extraData, email: e.target.value })}
                          className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none text-sm md:col-span-2"
                        />
                      </div>

                      {editingStudentId && (
                        <button
                          onClick={handleSaveDataOnly}
                          className="w-full py-3 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep font-bold rounded-lg flex items-center justify-center gap-2 mt-4 transition-colors"
                        >
                          <Save className="w-4 h-4" /> Salvar Alterações nos Dados
                        </button>
                      )}
                    </div>

                    {/* CAMPOS FRAPPE EXTRAS */}
                    <div className="bg-ebony-surface p-4 rounded-xl border border-ebony-border shadow-sm space-y-3">
                      <h4 className="font-bold text-white text-sm uppercase border-b border-ebony-border pb-2 mb-2">
                        Informações sobre o Corpo
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-ebony-muted uppercase">Objetivo</label>
                          <input value={frappeExtra.objetivo} onChange={e => setFE('objetivo', e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            placeholder="Ex: Hipertrofia" />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-ebony-muted uppercase">Instagram</label>
                          <input value={frappeExtra.instagram} onChange={e => setFE('instagram', e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            placeholder="@usuario" />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-ebony-muted uppercase">Sexo</label>
                          <select value={frappeExtra.sexo} onChange={e => setFE('sexo', e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary text-sm">
                            <option value="">Selecionar...</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Feminino">Feminino</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-ebony-muted uppercase">Idade</label>
                          <input type="number" min="0" value={frappeExtra.age} onChange={e => setFE('age', e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            placeholder="0" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-ebony-muted uppercase">Altura (cm)</label>
                          <input type="number" min="0" value={frappeExtra.height} onChange={e => setFE('height', e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            placeholder="0" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-ebony-muted uppercase">Peso (kg)</label>
                          <input type="number" min="0" value={frappeExtra.weight} onChange={e => setFE('weight', e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            placeholder="0" />
                        </div>
                        <div className="col-span-2 md:col-span-4 space-y-1">
                          <label className="text-[10px] font-bold text-ebony-muted uppercase">Orientações Globais</label>
                          <textarea value={frappeExtra.orientacoes_globais} onChange={e => setFE('orientacoes_globais', e.target.value)}
                            rows={2} className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary placeholder-gray-600 text-sm resize-none"
                            placeholder="Será exibido na criação de fichas e dietas" />
                        </div>
                      </div>

                      <h4 className="font-bold text-white text-sm uppercase border-b border-ebony-border pb-2 mt-4">
                        Mais Info
                      </h4>
                      <div className="flex gap-6 flex-wrap">
                        {[['dieta','Dieta'],['treino','Treino'],['ja_usou_o_aplicativo','Já usou o aplicativo']].map(([field, label]) => (
                          <label key={field} className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={frappeExtra[field]}
                              onChange={e => setFE(field, e.target.checked)}
                              className="w-4 h-4 rounded accent-ebony-primary cursor-pointer" />
                            <span className="text-sm text-white">{label}</span>
                          </label>
                        ))}
                      </div>

                      <h4 className="font-bold text-white text-sm uppercase border-b border-ebony-border pb-2 mt-4">
                        Saúde e Treino
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-ebony-muted uppercase">Nível de Atividade Física (PAL)</label>
                          <select value={frappeExtra.frequencia_atividade} onChange={e => setFE('frequencia_atividade', e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary text-sm">
                            <option value="">Selecionar...</option>
                            {['Sedentário','Levemente Ativo','Moderadamente Ativo','Muito Ativo','Extremamente Ativo'].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-ebony-muted uppercase">Doenças preexistentes</label>
                          <input value={frappeExtra.doencas} onChange={e => setFE('doencas', e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            placeholder="Ex: Diabetes, Hipertensão..." />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-ebony-muted uppercase">Uso de medicamentos</label>
                          <input value={frappeExtra.medicamento} onChange={e => setFE('medicamento', e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg outline-none focus:border-ebony-primary placeholder-gray-600 text-sm"
                            placeholder="Ex: Metformina..." />
                        </div>
                      </div>
                    </div>

                    {/* --- SEÇÃO DE VÍNCULOS (CASAL/GRUPO) --- */}
                    <div className="bg-ebony-surface p-4 rounded-xl border border-ebony-border shadow-sm space-y-3">
                      <h4 className="font-bold text-ebony-primary text-sm uppercase border-b border-ebony-border pb-1.5 mb-1 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Vínculos (Plano Casal / Grupo)
                      </h4>

                      <div className="space-y-3">
                        {/* Lista de Selecionados (Etiquetas) */}
                        <div className="flex flex-wrap gap-2">
                          {linkedStudents.map(link => (
                            <div
                              key={link.id}
                              className="bg-ebony-deep text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 border border-ebony-border"
                            >
                              <span>❤️ {link.name}</span>
                              <button
                                onClick={() => setLinkedStudents(prev => prev.filter(p => p.id !== link.id))}
                                className="hover:text-ebony-primary"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {linkedStudents.length === 0 && (
                            <span className="text-xs text-ebony-muted italic">Nenhum vínculo selecionado.</span>
                          )}
                        </div>

                        {/* Campo de Busca */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Buscar parceiro(a) por nome..."
                            value={linkSearchTerm}
                            onChange={(e) => setLinkSearchTerm(e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                          />

                          {linkSearchTerm.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-ebony-surface border border-ebony-border rounded-lg shadow-xl mt-1 z-50 max-h-40 overflow-y-auto overflow-hidden">
                              {students
                                .filter(s =>
                                  s.id !== editingStudentId &&
                                  !linkedStudents.some(sel => sel.id === s.id) &&
                                  s.name?.toLowerCase().includes(linkSearchTerm.toLowerCase())
                                )
                                .map(s => (
                                  <div
                                    key={s.id}
                                    onClick={() => {
                                      setLinkedStudents(prev => [...prev, { id: s.id, name: s.name }]);
                                      setLinkSearchTerm("");
                                    }}
                                    className="p-3 text-sm text-white hover:bg-ebony-border/30 cursor-pointer border-b border-ebony-border last:border-0"
                                  >
                                    {s.name} <span className="text-[10px] text-ebony-muted">({s.phone})</span>
                                  </div>
                                ))
                              }
                              {students.filter(s => s.name?.toLowerCase().includes(linkSearchTerm.toLowerCase())).length === 0 && (
                                <div className="p-3 text-xs text-ebony-muted text-center">Nenhum aluno encontrado.</div>
                              )}
                            </div>
                          )}
                        </div>

                        <p className="text-[10px] text-ebony-muted">
                          Ao vincular, uma etiqueta vermelha aparecerá na tabela e no financeiro para facilitar a identificação.
                        </p>
                      </div>
                    </div>

                    {/* 4. CONFIGURAÇÃO DO CONTRATO */}
                    <div className="bg-ebony-surface p-4 rounded-xl border border-ebony-border shadow-sm space-y-3">
                      <h4 className="font-bold text-white text-sm uppercase border-b border-ebony-border pb-1.5 mb-1 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Configuração do Contrato
                      </h4>

                      <div className="flex items-center justify-between bg-ebony-deep/60 p-3 rounded-lg border border-ebony-border">
                        <div>
                          <span className="block text-sm font-bold text-white">Liberar Acesso ao App/Onboarding?</span>
                          <span className="text-xs text-ebony-muted">Se desligado, o aluno só assina o contrato.</span>
                        </div>
                        <button
                          onClick={() => setIncludeOnboarding(!includeOnboarding)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${includeOnboarding ? 'bg-ebony-primary' : 'bg-ebony-border'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${includeOnboarding ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`space-y-1 transition-all ${includeOnboarding ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                          <label className="text-xs font-bold text-ebony-muted uppercase">Fluxo de Onboarding</label>
                          <select
                            value={selectedPlanForStudent}
                            onChange={(e) => setSelectedPlanForStudent(e.target.value)}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                          >
                            <option value="">Selecione o Fluxo...</option>
                            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-ebony-muted uppercase">Modelo de Contrato</label>
                          <select
                            value={selectedTemplateId}
                            onChange={(e) => { setSelectedTemplateId(e.target.value); setAdminFieldValues({}); }}
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 font-bold"
                          >
                            <option value="">Selecione o Modelo...</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                      </div>

                      {selectedTemplateId && (
                        <div className="bg-ebony-deep/60 p-4 rounded-lg border border-ebony-border animate-in fade-in mt-4">
                          <h4 className="text-xs font-bold text-ebony-muted uppercase mb-3">Variáveis de Negociação</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {templates.find(t => t.id === selectedTemplateId)?.fields?.filter(f => f.owner === 'admin').map((field, idx) => (
                              <div key={idx}>
                                <label className="block text-[10px] font-bold text-ebony-muted uppercase mb-1">{field.label}</label>
                                <input
                                  type={field.type === 'date' ? 'date' : 'text'}
                                  value={adminFieldValues[field.key] || ''}
                                  onChange={(e) => setAdminFieldValues({ ...adminFieldValues, [field.key]: e.target.value })}
                                  className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 text-sm font-medium"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {approvalStep === 2 && (
                <div className="w-full h-full bg-ebony-bg flex justify-center overflow-hidden">
                  <RichTextEditor isA4={true} value={draftContract} onChange={setDraftContract} />
                </div>
              )}
            </div>

            <div className="bg-ebony-surface border-t border-ebony-border p-4 flex justify-end gap-3 z-50">
              <button
                onClick={() => setIsInviting(false)}
                className="px-4 py-2 text-ebony-muted hover:bg-ebony-deep rounded-lg font-bold transition-colors text-xs mr-auto border border-transparent hover:border-ebony-border"
              >
                Cancelar
              </button>

              {approvalStep === 1 ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveWithoutContract}
                    className="px-5 py-2.5 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg font-bold transition-colors text-sm flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Salvar sem contrato
                  </button>
                  <button
                    onClick={handleGenerateDraft}
                    className="px-8 py-2.5 bg-ebony-primary hover:bg-red-900 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition-colors text-sm"
                  >
                    Próximo: Revisar Minuta <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setApprovalStep(1)}
                    className="px-6 py-3 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg font-bold transition-colors"
                  >
                    Voltar e Editar Dados
                  </button>
                  <button
                    onClick={handleFinalizeInvite}
                    className="px-8 py-3 bg-ebony-primary hover:bg-red-900 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Aprovar e Enviar Link
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
  );
};

export default StudentFormModal;