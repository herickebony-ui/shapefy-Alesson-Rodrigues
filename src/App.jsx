import React, { useEffect, useState, useRef, Suspense, lazy } from 'react';

// 1. Firebase (Auth, Firestore, Storage)
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from "firebase/storage";
import { signInWithEmailAndPassword, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

// 2. Conexão com seus Arquivos Novos
import { auth, db, storage } from './firebase';
import {
  applyStudentValuesToContract,
  buildMapsUrl,
  formatUrl,
  generateSlug,
  logContractEvent,
  generateContractPDF // <--- ADICIONE ISSO AQUI
} from './utils/utils';

const Dashboard = lazy(() => import('./components/Dashboard'));
const FinancialModule = lazy(() => import('./components/FinancialModule'));
const RichTextEditor = lazy(() => import('./components/RichTextEditor'));
const StudentRegistration = lazy(() => import('./components/StudentRegistration'));
const VideoPlayerGlobal = lazy(() => import('./components/VideoPlayerGlobal'));
const ElectronicSignature = lazy(() => import('./components/ElectronicSignature'));
const SecurityModal = lazy(() => import('./components/SecurityModal'));
const StudentHub = lazy(() => import('./components/members/StudentHub'));
const MembersArea = lazy(() => import('./components/members/MembersArea'));
const MembersAdmin = lazy(() => import('./components/members/MembersAdmin'));

const TelaCarregandoModulo = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#121214]">
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 border-2 border-red-900 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Abrindo...</p>
    </div>
  </div>
);

// 4. Ícones (Mantenha os que você já tem do lucide-react)
import {
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Download,
  Edit,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  Image as ImageIcon,
  Layout,
  Loader,
  Lock,
  MapPin,
  Monitor,
  MoveDown,
  MoveUp,
  MoveVertical,
  Plus,
  Save,
  Settings,
  Smartphone,
  Trash2,
  Upload,
  Users,
  X
} from 'lucide-react';

// Função auxiliar para garantir formato E.164 (+55...)
const formatPhoneNumberForFirebase = (phone) => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, '');
  // Se tiver 10 ou 11 dígitos, assume que é Brasil e adiciona 55
  if (cleaned.length >= 10 && cleaned.length <= 11) {
    return `+55${cleaned}`;
  }
  // Se já tiver DDI (ex: 55119...), só adiciona o +
  return `+${cleaned}`;
};

const OnboardingConsultoria = () => {
  const defaultSteps = [
    { id: 1, type: 'welcome', title: 'Boas-vindas', content: 'Bem-vindo ao time!', buttonText: '', link: '', coverImage: null, coverPosition: 50, images: [] }
  ];

  const [passwordInput, setPasswordInput] = useState("");

  const [emailInput, setEmailInput] = useState("");
  const [viewState, setViewState] = useState('loading');
  // VOLTAR DO CONTRATO (pega a última tela válida antes de entrar no contrato)
  const lastNonContractViewRef = useRef("student_hub");

  useEffect(() => {
    // não deixa "loading" virar destino de voltar
    const blocked = new Set(["contract_sign", "contract_signed_success", "loading"]);
    if (!blocked.has(viewState)) {
      lastNonContractViewRef.current = viewState;
    }
  }, [viewState]);

  const goBackFromContract = () => {
    const prev = lastNonContractViewRef.current || "student_hub";

    // Se veio de qualquer tela de onboarding, volta pro HUB (evita loop contrato <-> onboarding)
    if (prev === "student_view_flow" || prev === "student_view_legacy") {
      setViewState("student_hub");
      return;
    }

    setViewState(prev);
  };

  const goToContract = () => {
    // Se não tem aluno, não tem contrato (ex: acesso só onboarding público)
    if (!activeStudent?.id) {
      alert("Não há contrato vinculado a este acesso.");
      return;
    }

    // Checa se existe contrato de qualquer forma
    const hasAnyContract =
      !!activeStudent?.latestContractId ||
      !!activeStudent?.contractText ||
      !!activeStudent?.contractPdfUrl ||
      String(activeStudent?.latestContractStatus || "").toLowerCase() === "signed" ||
      String(activeStudent?.status || "").toLowerCase() === "signed";

    if (!hasAnyContract) {
      alert("Este aluno não possui contrato vinculado. (Acesso somente ao onboarding)");
      return;
    }

    const signed =
      String(activeStudent?.status || "").toLowerCase() === "signed" ||
      String(activeStudent?.latestContractStatus || "").toLowerCase() === "signed" ||
      !!activeStudent?.contractPdfUrl;

    setViewState(signed ? "contract_signed_success" : "contract_sign");
  };

  const [isAdminAccess, setIsAdminAccess] = useState(false);
  const [activePlanId, setActivePlanId] = useState(null);
  const [activeStudent, setActiveStudent] = useState(null);
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [activeContract, setActiveContract] = useState(null);
  const [activeContractId, setActiveContractId] = useState(null);
  const [studentPhoneInput, setStudentPhoneInput] = useState("");
  const [availablePlans, setAvailablePlans] = useState([]);
  const [students, setStudents] = useState([]);
  // --- NOVOS ESTADOS PARA O WHATSAPP SEPARADO (PASSO A) ---
  const [newStudentPhone, setNewStudentPhone] = useState(""); // Celular (Login)
  const [newStudentWhatsapp, setNewStudentWhatsapp] = useState(""); // Whats (Comunicação)
  const [isSameNumber, setIsSameNumber] = useState(true); // Checkbox
  const [newStudentName, setNewStudentName] = useState(""); // Nome do aluno (caso não tenha ainda)
  const [showNewStudentModal, setShowNewStudentModal] = useState(false); // Controle do Modal
  // --------------------------------------------------------
  const hasLoadedStudent = useRef(false);

  const [coachName, setCoachName] = useState("Sua Consultoria");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [finalTitle, setFinalTitle] = useState("Tudo Pronto!");
  const [finalMessage, setFinalMessage] = useState("Sucesso!");
  const [finalButtonText, setFinalButtonText] = useState("Continuar");

  const [steps, setSteps] = useState(defaultSteps);
  const [currentStep, setCurrentStep] = useState(0);
  // --- ÍNDICE (ALUNO) + AVISO DE ORDEM ---
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [pendingJumpIndex, setPendingJumpIndex] = useState(null);
  const [showOrderWarning, setShowOrderWarning] = useState(false);
  const [showOrderHint, setShowOrderHint] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [videoEmbedUrl, setVideoEmbedUrl] = useState("");

  const jumpToStep = (idx) => {
    // mesma etapa: só fecha
    if (idx === currentStep) {
      setIsIndexOpen(false);
      return;
    }
    const getYoutubeEmbedUrl = (url) => {
      if (!url) return "";

      // youtu.be/ID
      let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
      if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;

      // watch?v=ID
      match = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
      if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;

      // shorts/ID
      match = url.match(/shorts\/([a-zA-Z0-9_-]{6,})/);
      if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;

      // embed/ID
      match = url.match(/embed\/([a-zA-Z0-9_-]{6,})/);
      if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;

      return "";
    };

    const openVideoModal = (youtubeUrl) => {
      const embed = getYoutubeEmbedUrl(youtubeUrl);
      if (!embed) {
        // se não for link válido, abre normal
        window.open(youtubeUrl, "_blank");
        return;
      }
      setVideoEmbedUrl(`${embed}?autoplay=1&rel=0`);
      setIsVideoOpen(true);
    };

    const closeVideoModal = () => {
      setIsVideoOpen(false);
      setVideoEmbedUrl(""); // mata o vídeo pra parar o som
    };
    // Se estiver pulando etapas para frente, avisa
    if (idx > currentStep + 1) {
      setPendingJumpIndex(idx);
      setShowOrderWarning(true);
      setShowOrderHint(true); // mostra a faixa amarela
      return;
    }

    setCurrentStep(idx);
    setIsIndexOpen(false);
    window.scrollTo(0, 0);
  };

  const confirmJumpAnyway = () => {
    if (pendingJumpIndex === null) {
      setShowOrderWarning(false);
      return;
    }
    setShowOrderHint(true);
    setCurrentStep(pendingJumpIndex);
    setPendingJumpIndex(null);
    setShowOrderWarning(false);
    setIsIndexOpen(false);
    window.scrollTo(0, 0);
  };

  const cancelJump = () => {
    setPendingJumpIndex(null);
    setShowOrderWarning(false);
  };
  const [isCompleted, setIsCompleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreatePlan = async (id, name) => {
    setActivePlanId(id);
    setCoachName(name);
    setSteps(defaultSteps);
    setViewState('editor');
  };

  const handleDeletePlan = async (id) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "onboarding", id));
      await loadAllPlans();
    } catch (e) { alert("Erro ao deletar"); }
  };

  const handleDuplicatePlan = async (originalId, customName) => {
    if (!db) return;
    const originalPlan = availablePlans.find(p => p.id === originalId);
    if (!originalPlan) return;
    let newId = generateSlug(customName);
    // Evita IDs duplicados
    if (availablePlans.some(p => p.id === newId)) {
      newId = `${newId}-${Math.floor(Math.random() * 100)}`;
    }
    const { id, ...dataToSave } = originalPlan;
    const newPlanData = { ...dataToSave, name: customName };
    try {
      await setDoc(doc(db, "onboarding", newId), newPlanData);
      alert("Fluxo duplicado com sucesso!");
      await loadAllPlans();
    } catch (e) { console.error(e); alert("Erro ao duplicar"); }
  };

  const handleUpdatePlanMetadata = async (oldId, newId, newName) => {
    if (!db) return;
    if (oldId === newId) {
      try {
        await setDoc(doc(db, "onboarding", oldId), { name: newName }, { merge: true });
        await loadAllPlans();
      } catch (e) { alert("Erro ao atualizar nome."); }
    }
  };
  const handleUpdatePlanColor = async (id, newColor) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "onboarding", id), { color: newColor });
      // Atualiza a lista localmente para ver a cor na hora
      setAvailablePlans(prev => prev.map(p => p.id === id ? { ...p, color: newColor } : p));
    } catch (e) { console.error("Erro ao salvar cor", e); }
  };
  // 5. Função de EDITAR (Abrir o editor)
  const handleEditPlan = async (id) => {
    setActivePlanId(id);
    await loadPlan(id);
    setViewState('editor');
  };

  // --- ⬇️ LÓGICA DE ASSINATURA DO ALUNO ⬇️ ---
  const [signatureData, setSignatureData] = useState(null);
  const [studentFieldValues, setStudentFieldValues] = useState({});

  // --- SENSOR DE AUDITORIA: VISUALIZAÇÃO ---
  useEffect(() => {
    // Só grava se tiver aluno carregado (activeStudent) e se ele tiver ID
    if (activeStudent?.id) {
      // Se o status já for 'signed', talvez não precise gravar, ou grava como visualização recorrente
      if (activeStudent.status !== 'signed') {
        const sessionKey = `viewed_${activeStudent.id}`;
        // Verifica se já gravou nessa sessão (pra não duplicar se der F5)
        if (!sessionStorage.getItem(sessionKey)) {
          logContractEvent(db, activeStudent.id, "DOCUMENTO_ABERTO", "Aluno acessou o link único");
          sessionStorage.setItem(sessionKey, "true");
        }
      }
    }
  }, [activeStudent]);
  // ✅ CORREÇÃO: A função agora está no lugar certo (Escopo do Componente)
  // Função chamada quando o SecurityModal confirma que o código está certo
  const handleIdentityVerified = () => {
    console.log("SMS Validado com sucesso! Liberando botão...");
    setIsIdentityVerified(true);  // Libera o botão verde
    setShowSecurityModal(false);  // Fecha o modal
  };

  const handleSignContract = async () => {
    if (!activeStudent || !db) return;

    // 1. Validação de Campos Obrigatórios
    const pending = Array.isArray(activeStudent?.pendingFields) ? activeStudent.pendingFields : [];
    const requiredKeys = pending
      .filter(f => f?.owner === "student" && f?.key)
      .map(f => f.key);
    const missing = requiredKeys.filter((k) => !String(studentFieldValues?.[k] ?? "").trim());

    if (missing.length > 0) {
      const firstMissing = pending.find(f => f.key === missing[0]);
      alert(`Por favor, preencha: ${firstMissing?.label || missing[0]}`);
      return;
    }

    if (!signatureData) {
      alert("Por favor, faça sua assinatura.");
      return;
    }

    try {
      setViewState("loading");

      // 2. Captura de Metadados (Geolocalização Completa)
      let userIP = "IP não registrado";
      let userLocation = "Localização não identificada";

      try {
        const geoReq = await fetch('https://ipapi.co/json/');
        if (geoReq.ok) {
          const geoData = await geoReq.json();
          userIP = geoData.ip || "IP Oculto";
          if (geoData.city) {
            userLocation = `${geoData.city} - ${geoData.region_code || geoData.region}, ${geoData.country_name}`;
          }
        }
      } catch (err) {
        console.warn("Falha ao obter GeoIP:", err);
        try {
          const ipFallback = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipFallback.json();
          userIP = ipData.ip;
        } catch (e) { }
      }

      const userAgent = navigator.userAgent;
      const timestamp = new Date().toISOString();

      // ... (início da função continua igual)

      // 3. Montagem dos Objetos (Mantido)
      const signatureMeta = {
        ip: userIP,
        location: userLocation,
        deviceInfo: userAgent,
        signedAt: timestamp,
        method: "digital_signature_onboarding_otp_verified"
      };

      const signatureObj = {
        image: signatureData,
        meta: signatureMeta
      };

      const finalStudentData = {
        ...studentFieldValues,
        signedAt: timestamp,
        ipAddress: userIP,
        deviceInfo: userAgent
      };

      // 4. Salva a Assinatura no Banco (Mantido)
      if (activeContractId && activeContractId !== "legacy") {
        await updateDoc(doc(db, "contracts", activeContractId), {
          status: "signed",
          studentData: finalStudentData,
          signature: signatureObj,
          audit: signatureMeta
        });
        await updateDoc(doc(db, "students", activeStudent.id), {
          latestContractStatus: "signed",
          status: "signed",
          signature: signatureObj,
          studentData: finalStudentData
        });
        await logContractEvent(db, activeStudent.id, "ASSINATURA BIOMÉTRICA", "Contrato assinado digitalmente.");
      } else {
        await updateDoc(doc(db, "students", activeStudent.id), {
          status: "signed",
          latestContractStatus: "signed",
          studentData: finalStudentData,
          signature: signatureObj
        });
      }

      // --- 🚨 AQUI ESTÁ A CORREÇÃO: "O PULO DO GATO" ---

      // A. Força o Texto do Contrato
      const textToPrint = activeContract?.contractText || activeStudent.contractText || "<p>Erro: Texto não encontrado.</p>";

      // B. BUSCA OS LOGS DO BANCO
      const freshSnap = await getDoc(doc(db, "students", activeStudent.id));
      const freshData = freshSnap.exists() ? freshSnap.data() : {};
      let currentLogs = freshData.auditTrail || [];

      // C. FILTRO DE DATA (LIMPEZA PARA RENOVAÇÃO)
      if (activeContract && activeContract.createdAt) {
        const contractStart = activeContract.createdAt.toDate
          ? activeContract.createdAt.toDate()
          : new Date(activeContract.createdAt);

        const safeMargin = new Date(contractStart.getTime() - 30 * 60000); // 30 min de tolerância

        currentLogs = currentLogs.filter(log => {
          const logDate = new Date(log.timestamp);

          // 1. Regra de Data: Só aceita logs mais novos que o contrato
          const isNewEnough = logDate >= safeMargin;

          // 2. Regra Anti-Duplicidade: Remove assinaturas anteriores desse mesmo contrato
          // (Para que só apareça a assinatura FINAL que estamos fazendo agora)
          const isNotSignature = log.event !== "ASSINATURA BIOMÉTRICA";

          return isNewEnough && isNotSignature;
        });
      }

      // D. Cria o Log da Assinatura Atual (A Única que vai valer)
      const newLogEntry = {
        event: "ASSINATURA BIOMÉTRICA",
        timestamp: timestamp,
        details: "Contrato assinado e validado digitalmente.",
        ip: userIP,
        device: userAgent,
        location: userLocation
      };

      // E. Monta o Pacote Final para o PDF
      const studentForPdf = {
        ...activeStudent,
        ...finalStudentData,
        signature: signatureObj,
        contractText: textToPrint,
        // Junta os logs do banco (OTP) + o da assinatura
        auditTrail: [...currentLogs, newLogEntry]
      };

      // F. Gera o PDF
      await generateContractPDF(studentForPdf);

      // G. Recarrega o Aluno para pegar o link final
      const updatedSnap = await getDoc(doc(db, "students", activeStudent.id));
      if (updatedSnap.exists()) {
        const freshData = updatedSnap.data();
        setActiveStudent({ id: activeStudent.id, ...freshData });
      }

      setViewState("contract_signed_success");

    } catch (e) {
      console.error(e);
      alert("Erro ao salvar assinatura: " + e.message);
      setViewState("student_login");
    }
  };

  const handleStudentLoginV2 = async () => {
    if (!activeStudent) {
      alert("Erro: Dados do aluno não carregados. Recarregue a página.");
      return;
    }
    // 2. Busca o dado ATUALIZADO no banco antes de conferir a senha
    const freshSnap = await getDoc(doc(db, "students", activeStudent.id));
    if (!freshSnap.exists()) {
      alert("Erro: Cadastro não encontrado.");
      setViewState("student_login");
      return;
    }
    const freshData = { id: freshSnap.id, ...freshSnap.data() };
    setActiveStudent(freshData); // Atualiza visualmente
    const phoneInputClean = String(studentPhoneInput || "").replace(/\D/g, "");
    // ✅ TRAVA 1: campo vazio
    if (!phoneInputClean) {
      alert("Digite seu WhatsApp com DDD para acessar.");
      setViewState("student_login");
      return;
    }

    // ✅ TRAVA 2: mínimo de dígitos (Brasil: 10 ou 11)
    if (phoneInputClean.length < 10) {
      alert("Digite o número completo com DDD.");
      setViewState("student_login");
      return;
    }
    const studentPhoneClean = (freshData.phone || "").replace(/\D/g, ''); // <--- AGORA ISSO FUNCIONA

    if (phoneInputClean === studentPhoneClean || studentPhoneClean.endsWith(phoneInputClean)) {
      sessionStorage.setItem('ebony_student_phone', studentPhoneClean);

      // COLE ISSO NO LUGAR (Nova Lógica dos 40 dias + Hub)
      if (freshData.status === 'signed' || freshData.materialDelivered === true) {
        // --- 🛡️ TRAVA DOS 40 DIAS ---
        const signedDate = activeStudent.studentData?.signedAt || activeStudent.contractPdfUpdatedAt;

        if (signedDate) {
          const dateA = new Date(signedDate);
          const dateB = new Date();
          const diffTime = Math.abs(dateB - dateA);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 40) {
            alert("Link expirou...");
            return;
          }
        }

        setViewState('student_hub');
      } else {  // <--- ADICIONE ESSE "else {" AQUI      
        try {
          let contractData = null;
          let contractId = null;

          if (freshData.latestContractId) {
            const contractSnap = await getDoc(doc(db, "contracts", freshData.latestContractId));
            if (contractSnap.exists()) {
              contractData = contractSnap.data();
              contractId = contractSnap.id;
            }
          }

          if (!contractData && freshData.contractText) {
            contractData = { contractText: freshData.contractText };
            contractId = "legacy";
          }

          if (contractData) {
            setActiveContract(contractData);
            setActiveContractId(contractId);
            setViewState('contract_sign');
          } else {
            alert("Aviso: Nenhum contrato pendente foi encontrado para este cadastro.");
            setViewState('student_login');
          }

        } catch (error) {
          console.error("Erro ao buscar contrato:", error);
          alert("Erro de conexão ao buscar contrato.");
          setViewState('student_login');
        }
      }
    } else {
      alert(`Número incorreto...`);
      setViewState("student_login"); // <--- ADICIONE ISSO
    }
  };
  // --- ⬆️ FIM DA LÓGICA DE ASSINATURA ⬆️ ---

  // --- ⬆️ FIM DO BLOCO ⬆️ ---

  const handleAdminLogin = async () => {
    // CORREÇÃO: Agora pegamos o emailInput (o que você digitou) e não mais o fixo
    if (!emailInput) return alert("Digite o e-mail.");
    if (!passwordInput) return alert("Digite a senha.");

    try {
      // Aqui estava o erro: troquei 'emailAdmin' por 'emailInput'
      await signInWithEmailAndPassword(auth, emailInput, passwordInput);

      setIsAdminAccess(true);
      sessionStorage.setItem('ebony_admin', 'true');

      setViewState('dashboard'); // mostra o dashboard imediatamente
      Promise.all([loadAllPlans(), loadAllStudents()]); // carrega em background
    } catch (error) {
      console.error(error);
      // Dica: O Firebase retorna error.code === 'auth/invalid-credential'
      alert("Acesso negado. Verifique e-mail e senha.");
    }
  };
  
//   const handleAdminLogin = async () => {
//     if (!emailInput) return alert("Digite o e-mail.");
//     if (!passwordInput) return alert("Digite a senha.");

//     try {
//         const formData = new URLSearchParams();
//         formData.append("usr", emailInput);
//         formData.append("pwd", passwordInput);

//         const response = await fetch("https://shapefy.online/api/method/login", {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/x-www-form-urlencoded",
//                 "Accept": "application/json",
//             },
//             body: formData.toString(),
//             credentials: "include" 
//         });

//         const result = await response.json();

//         // O Frappe retorna 'message': 'Logged In' ou o nome do usuário em algumas versões
//         if (response.ok && (result.home_page === "/menu_shapefy" || result.full_name)) {
            
//             // --- AQUI ESTÁ A LÓGICA DE REDIRECIONAMENTO QUE FALTAVA ---
            
//             // 1. Define que o usuário é admin
//             setIsAdminAccess(true);
            
//             // 2. Salva na sessão (igual você fazia antes)
//             sessionStorage.setItem('ebony_admin', 'true');

//             // 3. Carrega os dados (certifique-se que essas funções usem o novo padrão de fetch)
//             //await Promise.all([loadAllPlans(), loadAllStudents()]);

//             // 4. Muda a tela para o dashboard
//             setViewState('dashboard');
            
//             console.log("Login no Frappe com sucesso!");

//         } else {
//             alert("Acesso negado. Verifique e-mail e senha no Shapefy.");
//         }

//     } catch (error) {
//         console.error("Erro ao conectar com Frappe:", error);
//         alert("Erro de conexão. Verifique se o servidor está online.");
//     }
// };

  // --- MICROCIRURGIA: GATILHO INICIAL (CORRIGIDO: PRIORIDADE PARA LINKS) ---
  // --- GATILHO INICIAL COM PROTEÇÃO ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const urlFlowId = params.get("id");
    const isRegister = params.get("register") === "true";

    const unsubscribe = auth.onAuthStateChanged(async (user) => {

      // PRIORIDADE 0: CADASTRO
      if (isRegister) {
        setViewState("register");
        return;
      } 

      // PRIORIDADE 1: LINK DE ALUNO (Com trava de segurança)
      if (urlToken) { 
        if (hasLoadedStudent.current) return;  

        try {  
          hasLoadedStudent.current = true;
          setViewState("loading");
          const snap = await getDoc(doc(db, "students", urlToken));

          if (!snap.exists()) {
            // Se não achou no banco, avisa mas manda pra tela de TELEFONE (não Admin)
            alert("Link não identificado ou expirado. Tente entrar com seu número.");
            setActiveStudent({ id: urlToken, name: "Aluno" }); 
            setViewState("student_login"); 
            return;
          }

          const st = { id: snap.id, ...snap.data() };
          setActiveStudent(st);
          setStudentPhoneInput("");
          setViewState("student_login");
        } catch (err) {
          console.error("Erro token:", err);
          // AQUI ESTAVA O ERRO: Mudamos de "login" (Admin) para "student_login" (Telefone)
          // Mesmo se der erro de permissão, o aluno cai na tela certa.
          setActiveStudent({ id: urlToken, name: "Aluno" });
          setViewState("student_login"); 
        }
        return;
      }

      // PRIORIDADE 2: LINK DE FLUXO PÚBLICO
      if (urlFlowId) {
        if (hasLoadedStudent.current) return; // Usa a mesma trava
        try {
          hasLoadedStudent.current = true;
          setViewState("loading");
          await loadPlan(urlFlowId);
          setActiveStudent(null);
          setViewState("student_view_flow");
        } catch (err) {
          setViewState("login");
        }
        return;
      }

     // PRIORIDADE 3: ADMIN LOGADO
     if (user) {
      // Se estamos no fluxo do aluno (tem activeStudent), ignoramos o login de admin
      if (activeStudent) return;

      setIsAdminAccess(true);
      // Libera a tela IMEDIATAMENTE, os dados carregam em segundo plano
      setViewState('dashboard');
      Promise.all([loadAllPlans(), loadAllStudents()]).catch(console.error);
    } else {
        setViewState("login");
      }
    });

    return () => unsubscribe();
  }, []); // Dependências vazias mantidas
  // --- FIRESTORE ALUNOS ---
  const loadAllStudents = async () => {
    if (!db) return;
    try {
      const q = await getDocs(collection(db, "students"));
      const list = q.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(list);
    } catch (e) { console.error("Erro alunos", e); }
  };

  const onCreateStudent = async (data) => {
    // ✅ mantenha a trava do db (só melhora a mensagem)
    if (!db) {
      alert("Erro: banco não iniciado. Recarregue a página e tente novamente.");
      return;
    }

    try {
      // ✅ agora só exige nome (plano NÃO é obrigatório)
      if (!data?.name || !String(data.name).trim()) {
        alert("Erro: Nome do aluno é obrigatório.");
        return;
      }

      // ✅ garante strings (evita crash no .replace do login)
      const safePhone = String(data.phone || "");
      const safeEmail = String(data.email || "");
      const safeCpf = String(data.cpf || "");

      const newStudentRef = doc(collection(db, "students"));

      const finalData = {
        ...data,

        id: newStudentRef.id,

        name: String(data.name).trim(),
        phone: safePhone,   // pode ser "" (aluno sem telefone ainda)
        email: safeEmail,
        cpf: safeCpf,

        // ✅ vínculos opcionais (ponto-chave)
        planId: data.planId ? data.planId : null,
        latestContractId: data.latestContractId ? data.latestContractId : null,

        // ✅ status coerente com “aluno solto”
        status: data.planId ? (data.status || "pending_contract") : "student_only",

        createdAt: data.createdAt || new Date().toISOString(),
      };

      await setDoc(newStudentRef, finalData);

      await loadAllStudents();
      alert("Aluno cadastrado com sucesso! (sem vínculo obrigatório)");
    } catch (e) {
      console.error("ERRO FIREBASE:", e);
      alert("Erro ao criar aluno: " + e.message);
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "students", id));
      await loadAllStudents();
    } catch (e) { alert("Erro ao deletar"); }
  }
  // --- FUNÇÃO DE CHECK (MATERIAL ENTREGUE) - NO LUGAR CERTO ---
  const toggleMaterialDelivered = async (student) => {
    if (!db) return;

    const newStatus = !student.materialDelivered;

    // 1. Atualiza visualmente NA HORA
    setStudents(currentList =>
      currentList.map(item =>
        item.id === student.id ? { ...item, materialDelivered: newStatus } : item
      )
    );

    try {
      // 2. Salva no Banco de Dados (para não perder no F5)
      await updateDoc(doc(db, "students", student.id), {
        materialDelivered: newStatus
      });
    } catch (error) {
      console.error("Erro ao salvar status:", error);
      alert("Erro ao salvar no sistema. A alteração será desfeita.");
      loadAllStudents();
    }
  };
  const loadAllPlans = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "onboarding"));
      const plansList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailablePlans(plansList);
    } catch (error) {
      console.error("Erro ao carregar planos:", error);
    }
  };

  const loadPlan = async (id) => {
    if (!db) { setSteps(defaultSteps); return; }
    try {
      const docRef = doc(db, "onboarding", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCoachName(data.coachName || "Sua Consultoria");
        setWhatsappLink(data.whatsappLink || "");
        setFinalTitle(data.finalTitle || "Tudo Pronto!");
        setFinalMessage(data.finalMessage || "Sucesso!");
        setFinalButtonText(data.finalButtonText || "Continuar");
        setSteps(data.steps || defaultSteps);
      } else {
        setCoachName("Nova Consultoria");
        setSteps(defaultSteps);
      }
    } catch (error) { console.error("Erro ao carregar plano", error); }
  };

  const handleSaveToCloud = async () => {
    if (!db || !activePlanId) return alert("Erro de configuração.");
    setIsSaving(true);
    try {
      // CORREÇÃO URGENTE:
      // Mudamos de setDoc (que apaga tudo) para updateDoc (que só atualiza o necessário).
      // Removemos o campo "name" daqui para ele NÃO mexer no nome do Dashboard.
      await updateDoc(doc(db, "onboarding", activePlanId), {
        coachName,
        whatsappLink,
        finalTitle,
        finalMessage,
        finalButtonText,
        steps
      });
      alert("✅ Fluxo salvo com sucesso! (Cor e Nome mantidos)");
    } catch (error) {
      alert("Erro ao salvar.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- FUNÇÕES DE NAVEGAÇÃO E EDITOR ---
  const updateStep = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };
  const renderVideoPreview = (url) => {
    const u = (url || "").trim();
    if (!u) return null;

    // YouTube: https://www.youtube.com/watch?v=ID  ou  https://youtu.be/ID
    const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    if (yt) {
      const src = `https://www.youtube.com/embed/${yt[1]}`;
      return (
        <iframe
          // Titanium Dark: Bordas arredondadas e fundo escuro no loading
          className="w-full h-full rounded-lg bg-ebony-deep"
          src={src}
          title="Vídeo"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    // Vimeo: https://vimeo.com/123456789
    const vimeo = u.match(/vimeo\.com\/(\d+)/);
    if (vimeo) {
      const src = `https://player.vimeo.com/video/${vimeo[1]}`;
      return (
        <iframe
          // Titanium Dark: Bordas arredondadas e fundo escuro no loading
          className="w-full h-full rounded-lg bg-ebony-deep"
          src={src}
          title="Vídeo"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }

    // Link direto mp4/webm/ogg
    if (u.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
      // Titanium Dark: Bordas arredondadas e fundo escuro
      return <video className="w-full h-full rounded-lg bg-ebony-deep" src={u} controls />;
    }

    // fallback
    return (
      <a
        // Titanium Dark: Texto claro (E1E1E6) em vez de azul, com hover branco
        className="text-ebony-text hover:text-white underline transition-colors"
        href={u}
        target="_blank"
        rel="noreferrer"
      >
        Abrir vídeo
      </a>
    );
  };
  const removeCover = (index) => {
    const newSteps = [...steps];
    // Remove a imagem e reseta a posição para o meio
    newSteps[index] = { ...newSteps[index], coverImage: null, coverPosition: 50 };
    setSteps(newSteps);
  };

  const moveStep = (index, direction) => {
    let newIndex = index; // Variável para saber para onde ele foi

    if (direction === 'up' && index > 0) {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index - 1]] = [newSteps[index - 1], newSteps[index]];
      setSteps(newSteps);
      newIndex = index - 1; // Foi para cima
    } else if (direction === 'down' && index < steps.length - 1) {
      const newSteps = [...steps];
      [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
      setSteps(newSteps);
      newIndex = index + 1; // Foi para baixo
    }

    // --- LÓGICA DO PULO IMEDIATO ---
    // O setTimeout espera o React redesenhar a tela (50ms) antes de pular
    setTimeout(() => {
      const element = document.getElementById(`step-${newIndex}`);
      if (element) {
        // Calcula a posição do elemento menos 100px (para não ficar atrás do menu fixo)
        const y = element.getBoundingClientRect().top + window.scrollY - 100;

        // Pula instantaneamente (behavior: 'auto')
        window.scrollTo({ top: y, behavior: 'auto' });
      }
    }, 50);
  };

  const removeStep = (index) => {
    if (steps.length <= 1) return alert("Você precisa ter pelo menos uma etapa.");
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
  };

  // --- UPLOAD DE CAPA OTIMIZADO (COMPRESSÃO AUTOMÁTICA) ---
  const handleCoverUpload = async (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const labelElement = e.target.parentElement.querySelector('span');
    if (labelElement) {
      labelElement.innerText = "Otimizando e Enviando...";
      labelElement.className = "text-xs font-bold text-blue-600 animate-pulse";
    }

    try {
      if (!storage) throw new Error("Storage não iniciado");

      // 1. OTIMIZAÇÃO DE IMAGEM (Reduz de 5MB para ~150KB)
      const compressedFile = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200; // Largura máxima (HD)
            const scaleSize = MAX_WIDTH / img.width;

            // Se a imagem for menor que o limite, não mexe
            if (scaleSize >= 1) {
              resolve(file);
              return;
            }

            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Transforma em arquivo leve (JPEG 80% qualidade)
            canvas.toBlob((blob) => {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.8);
          };
        };
      });

      // 2. ENVIO PARA NUVEM
      const storageRef = ref(storage, `capas/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(storageRef, compressedFile);
      const url = await getDownloadURL(snapshot.ref);

      // 3. SALVAR LINK
      updateStep(index, 'coverImage', url);

      // Feedback Visual
      if (labelElement) {
        labelElement.innerText = "Sucesso!";
        setTimeout(() => {
          if (labelElement) labelElement.innerText = "Carregar Capa";
          if (labelElement) labelElement.className = "text-xs text-gray-500 font-medium";
        }, 2000);
      }

    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Erro ao enviar imagem: " + error.message);
      if (labelElement) labelElement.innerText = "Erro no envio";
    }
  };

  // --- UPLOAD DE GALERIA COM BARRA DE PROGRESSO ---
  const handleImageUpload = async (index, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const labelElement = e.target.parentElement.querySelector('span');
    const originalText = "Add Imagem";

    try {
      if (!storage) throw new Error("Storage não iniciado");

      // 1. OTIMIZAÇÃO (Mantemos seu código de compressão que estava ótimo)
      if (labelElement) labelElement.innerText = "Comprimindo...";

      const compressedFile = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const scaleSize = MAX_WIDTH / img.width;

            if (scaleSize >= 1) { resolve(file); return; }

            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.8);
          };
        };
      });

      // 2. UPLOAD COM PROGRESSO
      const storageRef = ref(storage, `galeria/${Date.now()}-${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, compressedFile);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (labelElement) {
            labelElement.innerText = `${Math.round(progress)}%`;
            labelElement.className = "text-xs font-bold text-blue-600";
          }
        },
        (error) => {
          console.error(error);
          alert("Erro no upload");
          if (labelElement) labelElement.innerText = "Erro";
        },
        async () => {
          // Upload completo
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          const currentImages = steps[index].images || [];
          updateStep(index, 'images', [...currentImages, url]);

          if (labelElement) {
            labelElement.innerText = originalText;
            labelElement.className = "text-xs text-gray-500 font-medium";
          }
        }
      );

    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Erro: " + error.message);
      if (labelElement) labelElement.innerText = "Erro!";
    }
  };

  const removeImage = (stepIndex, imgIndex) => {
    const currentImages = steps[stepIndex].images || [];
    const newImages = currentImages.filter((_, i) => i !== imgIndex);
    updateStep(stepIndex, 'images', newImages);
  };

  const handlePdfUpload = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newSteps = [...steps];
      newSteps[index] = { ...newSteps[index], pdfData: url, pdfName: file.name };
      setSteps(newSteps);
    }
  };

  const removePdf = (index) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], pdfData: null, pdfName: null };
    setSteps(newSteps);
  };

  const handleNext = async () => {
    // 1. Se NÃO for o último passo, só avança
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
      return;
    }

    // 2. SE FOR O ÚLTIMO PASSO (Hora de Finalizar)
    // Apenas libera a tela final, pois a assinatura já foi feita no Hub.
    setIsCompleted(true);
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  if (viewState === 'dashboard') {
    return (
      <Dashboard
        plans={availablePlans}
        onSelectPlan={handleEditPlan}
        onCreatePlan={handleCreatePlan}
        onDeletePlan={handleDeletePlan}
        onDuplicatePlan={handleDuplicatePlan}
        onUpdatePlanMeta={handleUpdatePlanMetadata}

        // ADICIONE ESTA LINHA AQUI:
        onUpdatePlanColor={handleUpdatePlanColor}

        students={students}
        onCreateStudent={onCreateStudent}
        onDeleteStudent={handleDeleteStudent}
        onReloadData={loadAllStudents}

        onToggleDelivery={toggleMaterialDelivered}
        onOpenFinancial={() => setViewState('financial')}        
      />
    );
  }

  // --- TELA: MÓDULO FINANCEIRO ---
  if (viewState === 'financial') {
    return (
      <FinancialModule
        db={db} // IMPORTANTE: Passar o banco de dados
        user={auth.currentUser} // Se precisar de autenticação
        onBack={() => setViewState('dashboard')} // Botão de voltar
      />
    );
  }

  // --- TELA: MEMBERS ADMIN (ADMIN) ---
  if (viewState === 'members_admin') {
    return <MembersAdmin />;
  }

  // --- TELA: HUB DO ALUNO (PÓS-LOGIN) ---
  if (viewState === 'student_hub') {
    return (
      <StudentHub
        studentId={activeStudent?.id || null}
        go={setViewState}
      />
    );
  }

  // --- TELA: ÁREA DE MEMBROS (NETFLIX STYLE) ---
  if (viewState === 'members_area') {
    return (
      <MembersArea
        studentId={activeStudent?.id || null}
        go={setViewState}
      />
    );
  }

  // --- RENDERIZAÇÃO ---

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
        <div className="text-center">
          <Loader className="w-10 h-10 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 font-medium text-sm">Carregando...</p>
        </div>
      </div>
    );
  }
  // --- INSIRA AQUI (Resolve a Tela Branca) ---
  if (viewState === 'register') {
    return <StudentRegistration db={db} />;
  }
  // TELA 0: PRÉ-CADASTRO
  if (viewState === 'public_register') {
    return <StudentRegistration db={db} />;
  }
  // --- TELA DE LOGIN (REFATORADA TITANIUM DARK) ---
  if (viewState === 'login') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ebony-bg p-4 font-sans">
      <div className="w-full max-w-sm bg-ebony-surface rounded-2xl shadow-2xl overflow-hidden border border-ebony-border animate-in fade-in zoom-in duration-500">

        {/* Cabeçalho do Card - Fundo Deep para contraste */}
        <div className="bg-ebony-deep p-8 text-center border-b border-ebony-border">
          <div className="w-14 h-14 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-4 shadow-inner border border-white/10">
            <span className="text-white font-bold text-lg tracking-wider">ON</span>
          </div>
          <h2 className="text-white text-lg font-bold">Gestão Consultoria ArTeam</h2>
          <p className="text-ebony-muted text-xs mt-1 uppercase tracking-widest opacity-80">Acesso Administrativo</p>
        </div>

        <div className="p-8 pt-10 space-y-5">

          {/* CAMPO DE E-MAIL */}
          <div>
            <label className="block text-xs font-bold text-ebony-muted uppercase mb-2 ml-1">E-mail</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Users className="h-5 w-5 text-gray-600 group-focus-within:text-ebony-text transition-colors" />
              </div>
              <input
                type="email"
                placeholder="admin@teamebony.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-ebony-border rounded-xl leading-5 bg-ebony-deep text-ebony-text placeholder-gray-600 focus:outline-none focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary transition-all duration-200"
              />
            </div>
          </div>

          {/* CAMPO DE SENHA */}
          <div>
            <label className="block text-xs font-bold text-ebony-muted uppercase mb-2 ml-1">Senha</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-600 group-focus-within:text-ebony-text transition-colors" />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                className="block w-full pl-10 pr-3 py-3 border border-ebony-border rounded-xl leading-5 bg-ebony-deep text-ebony-text placeholder-gray-600 focus:outline-none focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary transition-all duration-200"
              />
            </div>
          </div>

          <button
            onClick={handleAdminLogin}
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-ebony-primary hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-900 transition-all transform active:scale-[0.98]"
          >
            Entrar no Sistema
            <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
          </button>
        </div>

        {/* Rodapé do Card */}
        <div className="bg-ebony-deep/50 px-8 py-4 border-t border-ebony-border text-center">
          <p className="text-[10px] text-ebony-muted">Área restrita para treinadores.</p>
        </div>
      </div>
      <p className="mt-8 text-xs text-ebony-muted font-medium opacity-50">Consultoria Ebony Team © 2025</p>
    </div>
  );

  // TELA 3: LOGIN DO ALUNO (REFATORADO TITANIUM DARK + NEON GREEN)
  if (viewState === 'student_login') return (
    <div className="min-h-screen flex items-center justify-center bg-ebony-bg p-4 font-sans">
      <div className="w-full max-w-sm bg-ebony-surface rounded-2xl shadow-2xl border border-ebony-border p-8 text-center animate-in zoom-in duration-300">

        {/* Ícone com brilho Neon Sutil */}
        <div className="w-16 h-16 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
          <Smartphone className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Olá, {activeStudent?.name?.split(' ')[0] || "Olá"}!</h2>
        <p className="text-sm text-ebony-muted mb-6">Para confirmar sua identidade e acessar seu contrato/onboarding, digite seu WhatsApp cadastrado com DDD e o 9 na frente.</p>

        <input
          type="tel"
          placeholder="(DDD) 90000-0000"
          value={studentPhoneInput}
          onChange={e => setStudentPhoneInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStudentLoginV2()}
          // Input Dark com foco Verde Neon
          className="w-full p-4 border border-ebony-border rounded-xl mb-4 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50 text-center text-lg tracking-widest font-bold bg-ebony-deep text-white placeholder-gray-600 transition-all"
        />

        <button
          onClick={handleStudentLoginV2}
          // Botão Verde com Efeito Neon no fundo (shadow-green)
          className="w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40 active:scale-95"
        >
          Acessar
        </button>
      </div>
    </div>
  );

  // --- TELA DE ASSINATURA (Versão Blindada v2 - TITANIUM DARK) ---
  if (viewState === 'contract_sign') {
    let contractDisplay = "<p>Carregando contrato...</p>";
    let pending = [];

    try {
      // 1. Proteção contra Contrato Vazio
      const baseHTML = activeContract?.contractText || activeStudent?.contractText || "<div style='padding:20px; text-align:center; color:#ef4444;'>⚠️ Texto do contrato não encontrado. Contate o suporte.</div>";

      // 2. Proteção nos Campos Pendentes
      pending = Array.isArray(activeStudent?.pendingFields) ? activeStudent.pendingFields : [];

      // 3. Função SafeDate (Reforçada)
      const safeDate = (dateVal) => {
        if (!dateVal) return "";
        try {
          if (typeof dateVal === 'string' && dateVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = dateVal.split('-');
            return `${d}/${m}/${y}`;
          }
          if (dateVal && typeof dateVal.toDate === 'function') {
            return dateVal.toDate().toLocaleDateString('pt-BR');
          }
          const d = new Date(dateVal);
          if (isNaN(d.getTime())) return String(dateVal);
          return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        } catch (e) {
          return "";
        }
      };

      // 4. Mesclagem de Dados (Blindada)
      const mergedValues = {
        nome: activeStudent?.name || "",
        telefone: activeStudent?.phone || "",
        cpf: activeStudent?.cpf || "",
        rg: activeStudent?.rg || "",
        email: activeStudent?.email || "",
        endereco: activeStudent?.address || "",
        profissao: activeStudent?.profession || "",
        nascimento: safeDate(activeStudent?.birthDate),
        ...studentFieldValues,
      };

      // 5. Geração do HTML (Protegida)
      if (typeof applyStudentValuesToContract === 'function') {
        contractDisplay = applyStudentValuesToContract(baseHTML, mergedValues);
      } else {
        contractDisplay = baseHTML;
      }

    } catch (fatalError) {
      console.error("ERRO FATAL NA RENDERIZAÇÃO:", fatalError);
      // Erro estilizado no Tema Dark
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-ebony-bg">
          <h2 className="text-xl font-bold text-red-500 mb-2">Erro ao carregar o contrato</h2>
          <p className="text-sm text-red-400 mb-4">O sistema encontrou um erro nos dados deste aluno.</p>
          <div className="bg-ebony-surface p-4 rounded border border-red-900/50 text-xs text-left font-mono text-red-200 overflow-auto max-w-full">
            {fatalError.message}
          </div>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors">
            Tentar Novamente
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-ebony-bg p-4 md:p-8 font-sans">
        {/* HEADER VOLTAR (contrato) */}
        <div className="sticky top-0 z-50 -mx-4 -mt-4 md:-mx-8 md:-mt-8 mb-4 bg-ebony-surface/90 backdrop-blur-md border-b border-ebony-border px-4 md:px-8 py-3">
          <button
            onClick={goBackFromContract}
            className="text-sm font-black text-ebony-muted hover:text-white transition flex items-center gap-2"
            type="button"
          >
            ← Voltar
          </button>
        </div>
        <div className="max-w-3xl mx-auto bg-ebony-surface rounded-2xl shadow-xl overflow-hidden border border-ebony-border animate-in fade-in slide-in-from-bottom-8">

          <div className="bg-ebony-deep border-b border-ebony-border p-6 text-center">
            <h1 className="text-2xl font-bold text-white">Contrato de Prestação de Serviços</h1>
            <p className="text-ebony-muted text-sm mt-1">Leia atentamente e assine ao final</p>
          </div>

          <div className="p-4 md:p-10 space-y-6 overflow-hidden">

            {/* Campos Pendentes */}
            {pending.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                {pending
                  .filter((f) => f?.owner === "student" && !["cpf_aluno", "endereco_aluno"].includes(f.key))
                  .map((field, idx) => (
                    <div key={idx}>
                      <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">
                        {field.label}
                      </label>
                      <input
                        type={field.type === "date" ? "date" : "text"}
                        value={studentFieldValues[field.key] || ""}
                        onChange={(e) =>
                          setStudentFieldValues((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-lg outline-none text-white focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary transition-colors placeholder-gray-600"
                        placeholder={`Digite ${field.label}...`}
                      />
                    </div>
                  ))}
              </div>
            )}

            {/* Contrato Renderizado */}
            {/* Adicionado 'prose-invert' para que o HTML interno fique claro (modo dark) automaticamente */}
            <div className="bg-ebony-deep p-6 rounded-xl border border-ebony-border h-96 overflow-y-auto shadow-inner custom-scrollbar">
              <div
                className="prose prose-sm prose-invert max-w-none text-ebony-text"
                dangerouslySetInnerHTML={{ __html: contractDisplay }}
              />
            </div>

            {/* Assinatura */}
            <div className="bg-ebony-deep/30 p-4 rounded-xl border border-dashed border-ebony-border">
              <label className="block text-xs font-bold text-ebony-muted uppercase mb-2 flex items-center gap-2">
                <FileSignature className="w-4 h-4" /> Assinatura Digital
              </label>
              <div className="w-full max-w-full overflow-x-hidden">
                <ElectronicSignature
                  studentName={activeStudent?.name || "Aluno"}
                  onSignatureGenerated={(signatureData) => {
                    setSignatureData(signatureData.dataUrl);
                  }}
                // Dica: Se ElectronicSignature aceitar props de cor, passe color="white" ou similar aqui
                />
              </div>
              <p className="text-[10px] text-ebony-muted mt-2 text-right">
                A assinatura acima foi gerada eletronicamente e possui validade jurídica.
              </p>
            </div>

            {/* Botão de Ação */}
            <button
              onClick={() => {
                if (!isIdentityVerified) {
                  setShowSecurityModal(true);
                } else {
                  handleSignContract();
                }
              }}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 
              ${isIdentityVerified
                  ? "bg-green-600 hover:bg-green-500 text-white animate-pulse shadow-green-500/20"
                  : "bg-ebony-primary hover:bg-red-900 text-white"
                }`}
            >
              {isIdentityVerified ? (
                <>
                  <CheckCircle className="w-6 h-6" />
                  Confirmar e Assinar Contrato
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Validar Identidade para Assinar
                </>
              )}
            </button>

            {!isIdentityVerified && (
              <p className="text-center text-xs text-ebony-muted mt-2">
                É necessário validar seu celular via SMS para liberar a assinatura.
              </p>
            )}

          </div>
        </div>

        {/* Modais */}
        {showSecurityModal && activeStudent?.phone && (
          <SecurityModal
            isOpen={true}
            studentPhone={formatPhoneNumberForFirebase(activeStudent.phone)}
            studentId={activeStudent.id}
            onVerified={handleIdentityVerified}
            onClose={() => setShowSecurityModal(false)}
          />
        )}
      </div>
    );
  }

  // --- FUNÇÃO DE RENDERIZAÇÃO DO CONTEÚDO (VISÃO DO ALUNO - TITANIUM DARK) ---
  const renderStepContent = (step) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {step.coverImage && (
        <div className="-mx-6 -mt-6 md:-mx-10 md:-mt-10 mb-6 relative group bg-ebony-deep">
          <img
            src={step.coverImage}
            alt="Capa"
            className="w-full h-auto object-cover rounded-t-2xl shadow-sm transition-all duration-300"
            style={{
              objectPosition: `center ${step.coverPosition || 50}%`,
              maxHeight: '400px'
            }}
          />
        </div>
      )}
      <h2 className="text-2xl font-bold text-white">{step.title}</h2>

      {/* 'prose-invert' inverte as cores do HTML para fundo escuro automaticamente */}
      <div className="text-lg text-ebony-muted prose prose-invert max-w-none prose-a:text-ebony-primary prose-a:no-underline hover:prose-a:underline" dangerouslySetInnerHTML={{ __html: step.content }} />

      {/* --- GALERIA DARK --- */}
      {step.images && step.images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 my-8">
          {step.images.map((img, idx) => img && (
            <div key={idx} className="relative group bg-ebony-deep rounded-2xl border border-ebony-border flex items-center justify-center overflow-hidden h-64 shadow-lg hover:shadow-xl transition-all">
              <img src={img} alt="" className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
            </div>
          ))}
        </div>
      )}

      {(step.type === 'text' || step.type === 'welcome') && (step.linkExtra || step.link) && (
        <a
          href={formatUrl(step.linkExtra || step.link)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-ebony-text hover:text-white hover:underline font-medium mt-4 transition-colors"
        >
          {step.buttonText || "Acessar Link"} <ExternalLink className="w-4 h-4" />
        </a>
      )}

      {step.type === 'pdf' && (
        <div className="bg-ebony-deep border border-ebony-border rounded-xl shadow-lg p-6 mt-6">
          <div className="flex items-center gap-3 mb-4">
            {/* Ícone com fundo transparente escuro e cor viva */}
            <div className="p-2 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white">Arquivo para Download</h3>
              <p className="text-sm text-ebony-muted">{step.pdfName || "Documento PDF"}</p>
            </div>
          </div>
          <a
            href={step.pdfData || formatUrl(step.link) || "#"}
            download={!!step.pdfData ? (step.pdfName || "documento.pdf") : undefined}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-ebony-surface border border-ebony-border text-white rounded-lg hover:bg-ebony-border hover:border-gray-500 transition-all font-medium"
          >
            <Download className="w-4 h-4" />{step.buttonText || "Baixar Arquivo"}
          </a>
        </div>
      )}

      {step.type === 'location' && (
        <div className="bg-ebony-deep border border-ebony-border rounded-xl shadow-lg p-6 mt-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/20">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white">Localização</h3>
              <p className="text-sm text-ebony-muted">
                Toque no botão para abrir no Google Maps.
              </p>
            </div>
          </div>

          {step.location ? (
            <a
              href={buildMapsUrl(step.location)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors font-bold shadow-lg"
            >
              {step.buttonText || "Abrir no Google Maps"}
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <div className="text-sm text-red-500 font-bold">
              Localização não configurada nesta etapa.
            </div>
          )}
        </div>
      )}

      {step.type === 'app' && (
        <div className="mt-8">
          <h3 className="font-bold text-white mb-4 text-center">Escolha sua plataforma:</h3>
          <div className="flex flex-col gap-3 max-w-sm mx-auto">
            {step.iosLink && <a href={formatUrl(step.iosLink)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-ebony-surface border border-ebony-border hover:bg-ebony-border text-white rounded-xl font-medium transition-all"><Smartphone className="w-5 h-5" />App Store (iPhone)</a>}
            {step.androidLink && <a href={formatUrl(step.androidLink)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-ebony-surface border border-ebony-border hover:bg-ebony-border text-white rounded-xl font-medium transition-all"><Smartphone className="w-5 h-5" />Google Play (Android)</a>}
            {step.webLink && <a href={formatUrl(step.webLink)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-ebony-primary text-white rounded-xl font-medium hover:bg-red-900 transition-colors"><Monitor className="w-5 h-5" />Acessar Navegador</a>}
          </div>
        </div>
      )}

      {step.type === 'video' && (
        <div className="mt-6">
          <div className="relative bg-black aspect-video rounded-xl overflow-hidden shadow-2xl border border-ebony-border">
            {/* Usa o componente global que criamos */}
            <VideoPlayerGlobal url={step.videoUrl || step.link} />
          </div>

          {step.buttonText && (
            <a
              href={formatUrl(step.videoUrl || step.link)}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-3 bg-ebony-primary text-white rounded-lg font-bold mt-4 hover:bg-red-900 transition-colors shadow-lg"
            >
              {step.buttonText}
            </a>
          )}
        </div>
      )}
    </div>
  );

  // ------------------------------------------------------------------
  // --- TELA ÚNICA: HUB DE SUCESSO E DOWNLOADS (TITANIUM DARK) ---
  if (viewState === 'contract_signed_success') {
    const hasPlan = !!activeStudent?.onboardingPlanId;
    const pdfUrl = activeStudent?.contractPdfUrl;

    return (
      <div className="min-h-screen flex items-center justify-center bg-ebony-bg p-4 font-sans">
        <div className="w-full max-w-md bg-ebony-surface rounded-2xl shadow-2xl border border-ebony-border p-8 text-center animate-in zoom-in duration-500">

          <button
            type="button"
            onClick={goBackFromContract}
            className="mb-4 text-sm font-black text-ebony-muted hover:text-white transition flex items-center gap-2"
          >
            ← Voltar
          </button>

          {/* Cabeçalho com Ícone Verde Neon (Sinal de Sucesso) */}
          <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(34,197,94,0.2)] border border-green-500/20">
            <CheckCircle className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Documento Assinado!</h2>
          <p className="text-ebony-muted text-sm mb-6">
            Obrigado, <strong className="text-white">{activeStudent?.name?.split(' ')[0]}</strong>. <br />
            Seu contrato está seguro conosco.
          </p>

          {/* --- ÁREA DE DOWNLOAD (DARK DEEP) --- */}
          <div className="bg-ebony-deep p-5 rounded-xl border border-ebony-border mb-6 text-left shadow-inner">
            <h3 className="text-xs font-bold text-ebony-muted uppercase mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Seus Documentos
            </h3>

            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                download="Contrato_EbonyTeam.pdf"
                className="flex items-center justify-between p-3 bg-ebony-surface border border-ebony-border rounded-lg hover:border-ebony-primary hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-red-500/10 p-2 rounded text-red-500 border border-red-500/10">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-ebony-primary transition-colors">Contrato de Prestação</p>
                    <p className="text-[10px] text-ebony-muted">PDF Assinado Digitalmente</p>
                  </div>
                </div>
                <Download className="w-5 h-5 text-gray-500 group-hover:text-white" />
              </a>
            ) : (
              <div className="text-center p-4 text-ebony-muted text-xs italic bg-ebony-surface/50 border border-dashed border-ebony-border rounded">
                Gerando PDF... (Recarregue a página em instantes)
              </div>
            )}

            <p className="text-[10px] text-gray-500 mt-3 text-center">
              * Este link para download ficará disponível por 40 dias.
            </p>
          </div>

          {/* --- BOTÕES DE AÇÃO --- */}
          <div className="space-y-3">
            {hasPlan ? (
              <button
                onClick={async () => {
                  const flowId = String(activeStudent?.onboardingPlanId || "").trim();
                  if (!flowId) {
                    alert("Seu onboarding ainda não foi vinculado. Fale com seu treinador.");
                    return;
                  }
                  setViewState("loading");
                  try {
                    const snap = await getDoc(doc(db, "onboarding", flowId));
                    if (!snap.exists()) {
                      alert("Seu onboarding não foi encontrado no sistema. Fale com seu treinador.");
                      setViewState("contract_signed_success");
                      return;
                    }
                    const data = snap.data();
                    const steps = Array.isArray(data?.steps) ? data.steps : [];
                    if (steps.length <= 1) {
                      alert("Seu onboarding ainda não está configurado. Fale com seu treinador.");
                      setViewState("contract_signed_success");
                      return;
                    }
                    await loadPlan(flowId);
                    setViewState("student_view_flow");
                  } catch (e) {
                    console.error(e);
                    alert("Erro ao carregar seu onboarding. Tente novamente.");
                    setViewState("contract_signed_success");
                  }
                }}
                // Botão Primário Ebony (Vinho) - Marcando a entrada oficial no sistema
                className="w-full py-4 bg-ebony-primary hover:bg-red-900 text-white rounded-xl font-bold text-lg transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                Iniciar Onboarding <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setStudentPhoneInput("");
                  setIsIdentityVerified(false);
                  setShowSecurityModal(false);
                  setViewState("student_login");
                }}
                // Botão Secundário Dark
                className="w-full py-4 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                Sair com Segurança <Lock className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </div>
    );
  }
  // ------------------------------------------------------------------
  // 2. RENDER FINAL (EDITOR OU ALUNO) - AGORA VEM DEPOIS
  // ------------------------------------------------------------------
  if (viewState === 'editor' || viewState === 'student_view_flow' || viewState === 'student_view_legacy') {

    // 🛑 TRAVA DE SEGURANÇA MÁXIMA (GUARDIÃO)
    if (viewState === 'editor') {
      const isAdmin = sessionStorage.getItem('ebony_admin') === 'true';
      if (!isAdmin) {
        setTimeout(() => setViewState('login'), 0);
        return null;
      }
    }

    return (
      <div className="min-h-screen bg-ebony-bg font-sans text-ebony-text relative pb-32">
        {/* HEADER DO EDITOR (SE TIVER) */}
        {/* --- HEADER DO EDITOR (TITANIUM DARK) --- */}
        {viewState === 'editor' && (
          <header className="bg-ebony-surface border-b border-ebony-border sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <button
                  onClick={() => { loadAllPlans(); loadAllStudents(); setViewState('dashboard') }}
                  className="p-2 hover:bg-ebony-deep text-ebony-muted hover:text-white rounded-full mr-2 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold text-lg">Editando: <span className="text-ebony-primary">{activePlanId}</span></h1>
              </div>

              <div className="flex items-center gap-2">
                {/* Botão SALVAR - Ação Primária (Vermelho) */}
                <button
                  onClick={handleSaveToCloud}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-lg ${isSaving ? 'bg-ebony-deep cursor-not-allowed text-gray-500' : 'bg-ebony-primary hover:bg-red-900'}`}
                >
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isSaving ? "Salvando..." : "Salvar no Site"}</span>
                </button>

                {/* Botão TESTAR - Ação Secundária (Outline/Ghost) */}
                <button
                  onClick={() => { setCurrentStep(0); setIsCompleted(false); setViewState('student_view_legacy'); }}
                  className="flex items-center gap-2 px-4 py-2 bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep rounded-lg text-sm font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">Testar</span>
                </button>
              </div>
            </div>
          </header>
        )}

        {/* --- HEADER DO ALUNO (TITANIUM DARK) --- */}
        {viewState !== 'editor' && (
          <header className="sticky top-0 z-40 bg-ebony-surface/90 backdrop-blur-md border-b border-ebony-border transition-all">

            {/* LINHA 1 */}
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">

              {/* ESQUERDA: ON + Textos */}
              <div className="flex items-center gap-3">
                {/* Logo Box - Vermelho para marca forte */}
                <div className="w-10 h-10 bg-ebony-primary rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-red-900/20">
                  ON
                </div>

                <div className="leading-tight">
                  <h1 className="text-sm font-bold text-white">Onboarding</h1>
                  <p className="text-[10px] text-ebony-muted font-medium uppercase tracking-wide">{coachName}</p>
                </div>
              </div>

              {/* DIREITA: PROGRESSO + TEMPO ESTIMADO ABAIXO */}
              <div className="flex items-center gap-3">
                {/* PROGRESSO */}
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-ebony-muted uppercase tracking-wider">Progresso</span>

                  <div className="w-28 h-2 bg-ebony-deep border border-ebony-border rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-ebony-primary shadow-[0_0_10px_#850000] transition-all duration-500 ease-out"
                      style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    />
                  </div>

                  {currentStep === 0 && (
                    <span className="mt-1 text-[10px] text-gray-500 font-medium">
                      Tempo estimado: 3–5 min
                    </span>
                  )}
                </div>
              </div>

            </div>

          </header>
        )}
        {/* --- BOTÃO EXCLUSIVO DO MODO TESTE (PARA VOLTAR AO EDITOR) --- */}
        {/* CORREÇÃO: Adicionado && isAdminAccess para garantir que alunos não vejam este botão */}
        {viewState === 'student_view_legacy' && isAdminAccess && (
          <div className="fixed bottom-24 right-4 z-[9999] animate-in fade-in slide-in-from-right">
            <button
              onClick={() => setViewState('editor')}
              // Titanium Dark: Vermelho Vinho com borda escura para recorte
              className="flex items-center gap-2 px-5 py-3 bg-ebony-primary text-white rounded-full font-bold shadow-2xl shadow-black/50 hover:bg-red-900 hover:scale-105 transition-all border-2 border-ebony-bg"
            >
              <Edit className="w-4 h-4" />
              Sair do Teste
            </button>
          </div>
        )}

        {/* ÍCONE ÍNDICE - AJUSTADO (TITANIUM DARK) */}
        {viewState !== 'editor' && (
          // Container invisível que alinha com o conteúdo do site
          <div className="fixed top-[80px] left-0 w-full z-50 pointer-events-none">
            <div className="max-w-6xl mx-auto px-4">
              <button
                onClick={() => setIsIndexOpen((v) => !v)}
                // Titanium Dark: Surface (Card), Borda Sutil, Linhas Brancas
                className="pointer-events-auto w-9 h-9 flex flex-col items-center justify-center gap-[3px] rounded-lg border border-ebony-border bg-ebony-surface hover:bg-ebony-deep hover:border-gray-500 shadow-lg transition-all"
                title="Abrir índice"
                aria-label="Abrir índice"
              >
                {/* Linhas brancas (ebony-text) para contraste no fundo escuro */}
                <span className="block w-4 h-[2px] bg-ebony-text rounded-full" />
                <span className="block w-4 h-[2px] bg-ebony-text rounded-full" />
                <span className="block w-4 h-[2px] bg-ebony-text rounded-full" />
              </button>
            </div>
          </div>
        )}

        {/* --- MODAL ÍNDICE (ALUNO - TITANIUM DARK) --- */}
        {viewState !== 'editor' && isIndexOpen && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-ebony-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-ebony-border animate-in fade-in zoom-in duration-300">
              <div className="p-4 border-b border-ebony-border flex items-center justify-between">
                <h3 className="font-bold text-white">Índice</h3>
                <button
                  onClick={() => setIsIndexOpen(false)}
                  className="p-1 hover:bg-ebony-deep rounded-full transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5 text-ebony-muted hover:text-white" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
                {steps.map((s, i) => (
                  <button
                    key={s.id ?? i}
                    onClick={() => jumpToStep(i)}
                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all mb-1
                      ${i === currentStep
                        ? "bg-ebony-deep border-l-4 border-ebony-primary shadow-md"
                        : "hover:bg-ebony-deep/50 hover:pl-5"
                      }`}
                  >
                    <div className="min-w-0">
                      <div className={`text-sm font-bold truncate ${i === currentStep ? 'text-white' : 'text-ebony-text'}`}>
                        {s.title || `Etapa ${i + 1}`}
                      </div>
                      {i === currentStep && (
                        <div className="text-[10px] text-ebony-primary font-bold uppercase tracking-wider mt-1">Você está aqui</div>
                      )}
                    </div>
                    {i === currentStep ? (
                      <div className="w-2 h-2 rounded-full bg-ebony-primary shadow-[0_0_8px_#850000]"></div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-ebony-border" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL VÍDEO (TITANIUM DARK) --- */}
        {viewState !== 'editor' && isVideoOpen && (
          <div
            className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={closeVideoModal}
          >
            <div
              className="bg-ebony-surface w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-ebony-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-ebony-border flex items-center justify-between">
                <h3 className="font-bold text-white">Vídeo</h3>
                <button
                  onClick={closeVideoModal}
                  className="p-1 hover:bg-ebony-deep rounded-full transition-colors"
                  aria-label="Fechar vídeo"
                >
                  <X className="w-5 h-5 text-ebony-muted hover:text-white" />
                </button>
              </div>

              <div className="p-3 bg-black">
                <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden border border-ebony-border">
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={videoEmbedUrl}
                    title="Vídeo explicativo"
                    frameBorder="0"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL AVISO (PULAR ORDEM - TITANIUM DARK) --- */}
        {viewState !== 'editor' && showOrderWarning && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-ebony-surface w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-ebony-border animate-in zoom-in duration-300">
              <h3 className="text-lg font-bold text-white mb-2">Recomendado seguir a ordem</h3>
              <p className="text-sm text-ebony-muted mb-6">
                A gente recomenda seguir as etapas em sequência para não perder nada.
                Quer ir mesmo assim?
              </p>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={cancelJump}
                  className="px-4 py-2 rounded-lg font-bold text-ebony-muted hover:text-white hover:bg-ebony-deep transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmJumpAnyway}
                  className="px-4 py-2 rounded-lg font-bold bg-ebony-primary text-white hover:bg-red-900 shadow-lg transition-all active:scale-95"
                >
                  Ir mesmo assim
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL (TITANIUM DARK) */}
        <main className={`max-w-6xl mx-auto px-4 py-8 transition-all ${viewState === 'editor' ? 'max-w-4xl' : 'flex flex-col justify-center min-h-[calc(100vh-160px)]'}`}>
          {viewState === 'editor' ? (
            <div className="space-y-8"> {/* Container Principal do Editor */}

              {/* Seção 1: Configurações Gerais */}
              <div className="bg-ebony-surface rounded-xl border border-ebony-border shadow-lg overflow-hidden">
                <div className="bg-ebony-primary p-4 border-b border-red-900 flex items-center gap-3">
                  <Settings className="w-5 h-5 text-white" />
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">
                    Configurações Gerais
                  </h3>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-ebony-muted mb-1">Nome da Consultoria</label>
                      <input
                        type="text"
                        value={coachName}
                        onChange={(e) => setCoachName(e.target.value)}
                        className="w-full p-2 border border-ebony-border rounded bg-ebony-deep text-white focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary outline-none transition-all placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-ebony-muted mb-1">Link do WhatsApp (Final)</label>
                      <input
                        type="text"
                        value={whatsappLink}
                        onChange={(e) => setWhatsappLink(e.target.value)}
                        className="w-full p-2 border border-ebony-border rounded bg-ebony-deep text-white focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary outline-none transition-all placeholder-gray-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 2: Configurações da Página Final */}
              <div className="bg-ebony-surface rounded-xl border border-ebony-border shadow-lg overflow-hidden">
                <div className="bg-ebony-primary p-4 border-b border-red-900 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-white" />
                  <h3 className="text-lg font-black text-white uppercase tracking-wide">
                    Configurações da Página Final
                  </h3>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-ebony-muted mb-1">Título</label>
                      <input
                        type="text"
                        value={finalTitle}
                        onChange={(e) => setFinalTitle(e.target.value)}
                        className="w-full p-2 border border-ebony-border rounded bg-ebony-deep text-white focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary outline-none transition-all placeholder-gray-600"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-ebony-muted mb-1">Texto do Botão</label>
                      <input
                        type="text"
                        value={finalButtonText || ''}
                        onChange={(e) => setFinalButtonText && setFinalButtonText(e.target.value)}
                        className="w-full p-2 border border-ebony-border rounded bg-ebony-deep text-white focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary outline-none transition-all placeholder-gray-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-ebony-muted mb-1">Mensagem Final</label>
                    <textarea
                      value={finalMessage || ''}
                      onChange={(e) => setFinalMessage && setFinalMessage(e.target.value)}
                      rows={3}
                      className="w-full p-2 border border-ebony-border rounded bg-ebony-deep text-white focus:border-ebony-primary focus:ring-1 focus:ring-ebony-primary outline-none transition-all placeholder-gray-600"
                    />
                  </div>
                </div>
              </div>

              {/* Título da Seção de Etapas */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-ebony-muted uppercase tracking-wider flex items-center gap-2 mb-4">
                  <Layout className="w-4 h-4" /> Etapas do Fluxo ({steps.length})
                </h2>

                {/* --- NAVEGAÇÃO RÁPIDA (Side Dots) --- */}
                <div className="group/menu fixed right-2 top-1/2 transform -translate-y-1/2 z-50 flex flex-col gap-6 hidden xl:flex p-4 rounded-2xl hover:bg-black/40 transition-colors backdrop-blur-sm border border-transparent hover:border-ebony-border">
                  {steps.map((s, i) => (
                    <a
                      key={i}
                      href={`#step-${i}`}
                      className="group/item relative flex items-center justify-end"
                    >
                      {/* Tooltip */}
                      <span className="cursor-pointer absolute right-6 px-3 py-1.5 bg-ebony-surface text-white text-[11px] font-bold rounded-lg opacity-0 translate-x-4 group-hover/menu:opacity-100 group-hover/menu:translate-x-0 transition-all duration-300 ease-out shadow-xl border border-ebony-border z-50 truncate max-w-[230px] hover:bg-ebony-primary hover:border-ebony-primary">
                        {i + 1}. {s.title || "Sem Título"}
                      </span>

                      {/* Bolinha */}
                      <div className="w-3 h-3 bg-ebony-muted rounded-full border border-ebony-bg group-hover/item:bg-ebony-primary group-hover/item:border-white group-hover/item:scale-150 transition-all shadow-sm"></div>
                    </a>
                  ))}
                </div>

                {steps.map((step, index) => (
                  <div
                    id={`step-${index}`}
                    key={step.id}
                    className="group bg-ebony-surface rounded-xl border border-ebony-border shadow-lg mb-8 overflow-visible transition-all hover:shadow-2xl hover:border-ebony-muted/30">

                    {/* Cabeçalho da Etapa */}
                    <div className="bg-ebony-primary p-4 border-b border-red-900 flex items-center justify-between sticky top-16 z-40 shadow-md">
                      <div className="flex items-center gap-3">
                        {/* O Número (Branco com texto Vinho) */}
                        <span className="w-8 h-8 flex items-center justify-center bg-white text-ebony-primary rounded-lg text-sm font-bold shadow-sm">
                          {index + 1}
                        </span>

                        {/* Título (Texto BRANCO) */}
                        <span className="text-lg font-black text-white uppercase tracking-wide truncate max-w-[200px] sm:max-w-md">
                          {step.title || "Sem Título"}
                        </span>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveStep(index, 'up')} className="p-2 hover:bg-red-900 rounded text-white transition-all">
                          <MoveUp className="w-5 h-5" />
                        </button>
                        <button onClick={() => moveStep(index, 'down')} className="p-2 hover:bg-red-900 rounded text-white transition-all">
                          <MoveDown className="w-5 h-5" />
                        </button>
                        <button onClick={() => removeStep(index)} className="p-2 text-red-200 hover:bg-black hover:text-red-500 rounded transition-all">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Conteúdo da Etapa */}
                    <div className="p-5 grid gap-4">

                      {/* --- IMAGEM DE CAPA --- */}
                      <div className="bg-ebony-deep/50 p-4 rounded-lg border border-ebony-border">
                        <label className="block text-xs font-bold text-ebony-muted uppercase mb-2">Imagem de Capa (Horizontal)</label>
                        {!step.coverImage ? (
                          <label className="cursor-pointer flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-ebony-border hover:border-ebony-primary hover:bg-ebony-deep transition-colors group/upload">
                            <ImageIcon className="w-6 h-6 text-gray-500 group-hover/upload:text-ebony-text mb-2" />
                            <span className="text-xs text-ebony-muted font-medium group-hover/upload:text-white">Carregar Capa</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverUpload(index, e)} />
                          </label>
                        ) : (
                          <div className="space-y-3">
                            <div className="relative rounded-lg overflow-hidden border border-ebony-border group bg-black">
                              <img
                                src={step.coverImage}
                                alt="Capa"
                                className="w-full h-80 object-cover transition-all opacity-80 group-hover:opacity-100"
                                style={{ objectPosition: `center ${step.coverPosition || 50}%` }}
                              />

                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  removeCover(index);
                                }}
                                className="absolute top-2 right-2 w-8 h-8 bg-ebony-primary text-white rounded-full shadow-lg hover:bg-red-900 flex items-center justify-center z-50 cursor-pointer transition-transform hover:scale-110 border border-white/20"
                                title="Remover Capa"
                              >
                                <Trash2 className="w-4 h-4 pointer-events-none" />
                              </button>
                            </div>

                            {/* Slider de Posição */}
                            <div className="flex items-center gap-2 bg-ebony-deep p-2 rounded border border-ebony-border">
                              <MoveVertical className="w-4 h-4 text-gray-500" />
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ajustar Posição Vertical</label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={step.coverPosition || 50}
                                  onChange={(e) => updateStep(index, 'coverPosition', e.target.value)}
                                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-ebony-primary"
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-8 text-right">{step.coverPosition || 50}%</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Título e Tipo */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-3">
                          <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Título</label>
                          <input type="text" value={step.title} onChange={(e) => updateStep(index, 'title', e.target.value)} className="w-full p-2 border border-ebony-border bg-ebony-deep text-white rounded-md font-medium outline-none focus:border-ebony-primary transition-colors" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Tipo</label>
                          <select value={step.type} onChange={(e) => updateStep(index, 'type', e.target.value)} className="w-full p-2 border border-ebony-border bg-ebony-deep text-white rounded-md text-sm outline-none focus:border-ebony-primary">
                            <option value="text">Texto</option>
                            <option value="welcome">Boas-vindas</option>
                            <option value="pdf">PDF</option>
                            <option value="video">Vídeo</option>
                            <option value="app">App</option>
                            <option value="location">Localização</option>
                          </select>
                        </div>
                      </div>

                      {/* Editor de Texto */}
                      {/* Dica: Passar uma prop 'theme="dark"' se o componente suportar, ou envolver em um div que force cores claras para o texto dentro do editor */}
                      <div className="flow-editor-dark">
                        <RichTextEditor
                          isA4={false}
                          value={step.content}
                          onChange={(newContent) => updateStep(index, "content", newContent)}
                        />
                      </div>

                      {/* Configuração Vídeo */}
                      {step.type === "video" && (
                        <div className="bg-ebony-deep p-4 rounded-lg border border-ebony-border shadow-sm mt-4">
                          <label className="text-xs font-bold text-ebony-muted uppercase mb-1 block">Link do Vídeo</label>
                          <input
                            type="text"
                            value={step.videoUrl || ""}
                            onChange={(e) => updateStep(index, "videoUrl", e.target.value)}
                            className="w-full p-2 border border-ebony-border bg-ebony-bg text-white rounded-md text-sm outline-none focus:border-ebony-primary"
                            placeholder='Ex: https://youtu.be/XXXX ou link .mp4'
                          />

                          {!!(step.videoUrl || "").trim() && (
                            <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-ebony-border bg-black">
                              {renderVideoPreview(step.videoUrl)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Galeria de Fotos */}
                      <div className="bg-ebony-deep p-4 rounded-lg border border-ebony-border shadow-sm">
                        <label className="block text-xs font-bold text-ebony-muted uppercase mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Galeria (Fotos Extras)</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {step.images && step.images.map((imgUrl, imgIndex) => (
                            <div key={imgIndex} className="relative group aspect-square bg-black rounded-lg border border-ebony-border overflow-hidden">
                              <img src={imgUrl} alt="" className="w-full h-full object-contain" />
                              <button onClick={() => removeImage(index, imgIndex)} className="absolute top-1 right-1 p-1 bg-ebony-primary text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          ))}
                          <label className="cursor-pointer flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-ebony-border hover:border-ebony-primary hover:bg-ebony-surface transition-colors">
                            <Upload className="w-6 h-6 text-gray-500 mb-2" />
                            <span className="text-xs text-gray-500 font-medium">Add Imagem</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(index, e)} />
                          </label>
                        </div>
                      </div>

                      {/* Inputs Condicionais (App, PDF, Links) - Estilo Dark */}
                      {step.type === 'app' && (
                        <div className="bg-ebony-deep p-4 rounded-lg border border-ebony-border shadow-sm">
                          <div className="grid gap-2">
                            <div><label className="text-xs font-medium text-ebony-muted">Android</label><input type="text" value={step.androidLink} onChange={(e) => updateStep(index, 'androidLink', e.target.value)} className="w-full p-2 border border-ebony-border bg-ebony-bg text-white rounded-md text-sm outline-none focus:border-ebony-primary" /></div>
                            <div><label className="text-xs font-medium text-ebony-muted">iOS</label><input type="text" value={step.iosLink} onChange={(e) => updateStep(index, 'iosLink', e.target.value)} className="w-full p-2 border border-ebony-border bg-ebony-bg text-white rounded-md text-sm outline-none focus:border-ebony-primary" /></div>
                            <div><label className="text-xs font-medium text-ebony-muted">Web</label><input type="text" value={step.webLink} onChange={(e) => updateStep(index, 'webLink', e.target.value)} className="w-full p-2 border border-ebony-border bg-ebony-bg text-white rounded-md text-sm outline-none focus:border-ebony-primary" /></div>
                          </div>
                        </div>
                      )}

                      {(step.type === 'pdf') && (
                        <div className="bg-ebony-deep p-4 rounded-lg border border-ebony-border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div><label className="text-xs font-bold uppercase text-ebony-muted mb-1">Link Externo</label><input type="text" value={step.link} onChange={(e) => updateStep(index, 'link', e.target.value)} className="w-full p-2 border border-ebony-border bg-ebony-bg text-white rounded-md text-sm outline-none focus:border-ebony-primary" /></div>
                          <div>
                            <label className="text-xs font-bold uppercase text-ebony-muted mb-1">Upload PDF</label>
                            {!step.pdfData ?
                              <label className="w-full p-2 border border-dashed border-ebony-border rounded-md bg-ebony-bg text-sm text-gray-500 cursor-pointer flex items-center justify-center gap-2 hover:border-ebony-primary hover:text-white transition-colors">
                                <Upload className="w-4 h-4" /> Selecionar
                                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handlePdfUpload(index, e)} />
                              </label>
                              :
                              <div className="flex items-center justify-between p-2 bg-green-900/20 border border-green-900/50 rounded-md">
                                <span className="text-xs text-green-400 truncate">{step.pdfName}</span>
                                <button onClick={() => removePdf(index)} className="p-1 text-red-400 hover:text-red-300"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            }
                          </div>
                          <div className="md:col-span-2"><label className="text-xs font-bold uppercase text-ebony-muted mb-1">Texto Botão</label><input type="text" value={step.buttonText} onChange={(e) => updateStep(index, 'buttonText', e.target.value)} className="w-full p-2 border border-ebony-border bg-ebony-bg text-white rounded-md text-sm outline-none focus:border-ebony-primary" /></div>
                        </div>
                      )}

                      {/* Inputs do tipo: Localização */}
                      {step.type === 'location' && (
                        <div className="bg-ebony-deep p-4 rounded-lg border border-ebony-border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className="text-xs font-bold uppercase text-ebony-muted mb-1">Endereço ou Link do Google Maps</label>
                            <input
                              type="text"
                              value={step.location || ""}
                              onChange={(e) => updateStep(index, 'location', e.target.value)}
                              className="w-full p-2 border border-ebony-border bg-ebony-bg text-white rounded-md text-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                              placeholder='Ex: "Av. Cinquentenário, 1000, Itabuna - BA" ou cole um link do Maps'
                            />
                            <p className="text-[10px] text-gray-500 mt-1">
                              Dica: pode ser endereço em texto OU um link completo do Google Maps.
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase text-ebony-muted mb-1">Texto do Botão</label>
                            <input
                              type="text"
                              value={step.buttonText || ""}
                              onChange={(e) => updateStep(index, 'buttonText', e.target.value)}
                              className="w-full p-2 border border-ebony-border bg-ebony-bg text-white rounded-md text-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                              placeholder="Ex: Abrir no Google Maps"
                            />
                          </div>
                        </div>
                      )}

                      {(step.type === 'text' || step.type === 'welcome') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-ebony-deep p-4 rounded-lg border border-ebony-border shadow-sm">
                          <div>
                            <label className="text-xs font-bold uppercase text-ebony-muted mb-1">Link Extra</label>
                            <input
                              type="text"
                              value={step.linkExtra || ""}
                              onChange={(e) => updateStep(index, "linkExtra", e.target.value)}
                              className="w-full p-2 border border-ebony-border bg-ebony-bg text-white rounded-md text-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                              placeholder='Ex: "https://..."'
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold uppercase text-ebony-muted mb-1">Texto Botão</label>
                            <input
                              type="text"
                              value={step.buttonText || ""}
                              onChange={(e) => updateStep(index, "buttonText", e.target.value)}
                              className="w-full p-2 border border-ebony-border bg-ebony-bg text-white rounded-md text-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                              placeholder='Ex: "Acessar"'
                            />
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                ))}

                {/* Botão Adicionar Etapa */}
                <button onClick={() => setSteps([...steps, { id: Date.now(), type: 'text', title: 'Nova Etapa', content: '...', buttonText: '', link: '', coverImage: null, coverPosition: 50, images: [] }])} className="w-full py-4 border-2 border-dashed border-ebony-border rounded-xl text-ebony-muted font-medium hover:border-ebony-primary hover:text-white hover:bg-ebony-deep transition-all flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" /> Adicionar Etapa
                </button>
              </div>
            </div>
          ) : (
            // --- VISUALIZAÇÃO (ALUNO/PREVIEW - TITANIUM DARK) ---
            isCompleted ? (
              <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in">
                {/* Ícone Sucesso Neon */}
                <div className="w-20 h-20 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">{finalTitle}</h2>
                <p className="text-ebony-muted max-w-md mb-8">{finalMessage}</p>

                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <a
                    href={formatUrl(whatsappLink)}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-500 transition-all active:scale-95 shadow-lg shadow-green-900/50 flex items-center justify-center gap-2 w-full"
                  >
                    <Smartphone className="w-6 h-6" /> {finalButtonText}
                  </a>

                  <button
                    onClick={() => { setIsCompleted(false); setCurrentStep(0); window.scrollTo(0, 0); }}
                    className="px-8 py-3 border border-ebony-border text-ebony-muted rounded-xl font-bold text-sm hover:bg-ebony-deep hover:text-white transition-colors w-full"
                  >
                    Voltar ao início do Onboarding
                  </button>
                </div>
              </div>
            ) : (
              // Card do Conteúdo Ativo
              <div className="bg-ebony-surface min-h-[400px] rounded-2xl shadow-xl border border-ebony-border p-6 md:p-10 mb-8 relative">
                {renderStepContent(steps[currentStep])}
              </div>
            )
          )}
        </main>

        {/* FOOTER NAVEGAÇÃO (TITANIUM DARK) */}
        {viewState !== 'editor' && !isCompleted && (
          <footer className="fixed bottom-0 left-0 right-0 bg-ebony-surface border-t border-ebony-border p-4 z-40 backdrop-blur-md bg-opacity-95">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">

              {/* ESQUERDA: GRUPO DE AÇÕES */}
              <div className="flex items-center gap-3">

                {/* 1. VOLTAR (Seta simples) */}
                <button
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className={`p-3 rounded-xl transition-all border border-transparent hover:bg-white/5 ${currentStep === 0 ? "text-gray-600 cursor-not-allowed" : "text-gray-300 hover:text-white"
                    }`}
                  title="Voltar etapa anterior"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>

                {/* 2. CONTRATO (Botão com Borda e Texto) */}
                {(activeStudent?.id /* ...suas condições... */) && (
                  <button
                    type="button"
                    onClick={goToContract}
                    className="
    flex items-center gap-2 px-4 py-2 rounded-full
    bg-[#202024] hover:bg-[#29292e]
    text-xs font-bold text-gray-300 hover:text-white
    border border-white/5 hover:border-white/10
    transition-all shadow-sm
  "
                  >
                    <FileText className="w-4 h-4" />
                    <span>Contrato</span>
                  </button>
                )}
              </div>


              {/* BOTÃO PRÓXIMO / FINALIZAR */}
              <button
                onClick={handleNext}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 ${currentStep === steps.length - 1
                  ? 'bg-green-600 text-white hover:bg-green-500 shadow-green-900/20' // Finalizar (Verde)
                  : 'bg-ebony-primary text-white hover:bg-red-900'      // Próximo (Ebony Primary)
                  }`}
              >
                <span>{currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}</span>
                {currentStep === steps.length - 1 ? <CheckCircle className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
          </footer>
        )}
      </div>
    );
  }

  return null;
};

const OnboardingConsultoriaWrapper = (props) => (
  <Suspense fallback={<TelaCarregandoModulo />}>
    <OnboardingConsultoria {...props} />
  </Suspense>
);

export default OnboardingConsultoriaWrapper;