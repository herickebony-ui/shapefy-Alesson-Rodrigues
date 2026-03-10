import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; // Ajuste o caminho se necessário (ex: '../../firebase')
import emailjs from '@emailjs/browser';
import {
    MessageSquare, X, Settings, Plus, Trash, Check, Bold, Link as LinkIcon,
    Smartphone, Megaphone, Radio, ShieldCheck, FileWarning, AlertTriangle // Ícones que vamos usar aqui
} from 'lucide-react';


const DEFAULT_TEMPLATE = `O SEU ACOMPANHAMENTO VAI ATÉ: {{FIM_PLANO}}
    
    A ficha de treino é atualizada até a próxima segunda-feira após o envio do feedback.
    Se houver atraso no feedback, o novo plano poderá atrasar.
    Caso você não conclua todas as semanas, a atualização será feita em até 5 dias úteis após o último feedback.

    1.0 — CRONOGRAMA DE FEEDBACKS
    O feedback deve ser enviado quinzenalmente, sempre às segundas-feiras, nas seguintes datas: 
    {{LISTA_DATAS}}

    •Responda o Feedback pelo Aplicativo ShapeFy 
    shapefy.online (http://shapefy.online/)

    2.0 — FOTOS PARA AVALIAÇÃO
    •Envie as fotos no padrão descrito no link abaixo, utilizando o formulário dentro do aplicativo:
    CLIQUE AQUI E ACESSE AS INSTRUÇÕES (https://teamebony.com.br/wp-content/uploads/2025/03/PROTOCOLO-DE-FOTOS-P-AVALIACAO-FISICA.pdf)

    Senha de acesso do teu app:`;

const REMINDER_DOC_PATH = "settings/feedback_reminder_template";
const MEGAAPI_DOC_PATH = "settings/whatsapp_config"; // Onde vamos salvar no banco
const EMAILJS_SERVICE_ID = "service_bbgiotb";
const EMAILJS_TEMPLATE_ID = "template_yvoz298";
const EMAILJS_PUBLIC_KEY = "ob4FD-glJDBkWJVfM";

const CommunicationModule = ({ students = [] }) => {
    // 1. Estados
    const [activeView, setActiveView] = useState('reminders'); // 'reminders' | 'broadcast' | 'settings_api'
    const [loading, setLoading] = useState(false);

    // --- ESTADOS PARA Z-API E DISPARO EM MASSA ---
    // --- ESTADOS PARA MEGAAPI ---
    const [megaApiConfig, setMegaApiConfig] = useState({
        host: '',         // A URL do site (Ex: https://api.megaapi...)
        instanceKey: '',  // A chave da instância
        token: '',        // O Token de segurança
        qrCodeBase64: '',  // Onde vamos guardar a imagem do QR
        connectionStatus: 'checking'  // 'connected' | 'disconnected' | 'checking'
    });
    const [broadcastMessages, setBroadcastMessages] = useState(['', '', '']);
    const [broadcastSending, setBroadcastSending] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [broadcastJobs, setBroadcastJobs] = useState([]);
    const [jobsLoading, setJobsLoading] = useState(false);
    const [auditFilter, setAuditFilter] = useState('all'); // 'all' | 'email' | 'whatsapp' | 'errors'

    const [reminderSaving, setReminderSaving] = useState(false);
    const [savedTemplates, setSavedTemplates] = useState([{ id: 'default', name: 'Modelo Padrão', text: DEFAULT_TEMPLATE }]);
    const [messageTemplate, setMessageTemplate] = useState(() => { return localStorage.getItem('ebony_msg_template') || DEFAULT_TEMPLATE; });
    const [reminderSettings, setReminderSettings] = useState(null);
    const [reminderLoading, setReminderLoading] = useState(false);

    // Novos estados que estavam faltando e causavam erro no saveTemplate
    const [templateNameInput, setTemplateNameInput] = useState('');
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const textareaRef = React.useRef(null);

    // --- ESTADOS DO MODAL DE TESTE ---
    const [showTestModal, setShowTestModal] = useState(false);
    const [testPhoneInput, setTestPhoneInput] = useState('');
    const [testOptions, setTestOptions] = useState({ email: true, whatsapp: true })

    const defaultReminderSettings = {
        enabled: true,

        // (Email pode ficar como está — teu backend de e-mail ignora isso hoje)
        daysBefore: 1,
        sendHour: 9,
        timeZone: "America/Bahia",

        // ✅ novos toggles por canal
        sendChannels: { email: true, whatsapp: true },

        // ✅ configs específicas do WhatsApp
        whatsappDaysBefore: 1,
        whatsappSendHour: 9,

        smsTemplate: "Oi {{NOME}}! Lembrete: seu feedback/treino está chegando ({{DATA}}). Envie no app: {{LINK}}",
        smsTemplateFeedback1: "",
        smsTemplateFeedback2: "",
        smsTemplateTraining1: "",
        smsTemplateTraining2: "",
        emailSubjectTemplate: "Lembrete: feedback amanhã ({{DATA}})",
        emailTemplate: "Oi {{NOME}}! Amanhã ({{DATA}}) é seu feedback. Envie pelo app: {{LINK}}",
    };
    async function loadBroadcastStatus() {
        setJobsLoading(true);
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const getStatus = httpsCallable(functions, 'getBroadcastStatus');

            const result = await getStatus();
            if (result.data.success) {
                setBroadcastJobs(result.data.jobs);
            }
        } catch (error) {
            console.error("Erro ao carregar status:", error);
        } finally {
            setJobsLoading(false);
        }
    }
    async function loadAuditLogs() {
        try {
            const snapshot = await getDocs(
                query(
                    collection(db, "communication_audit"),
                    orderBy("sentAt", "desc"),
                    limit(50)
                )
            );

            const logs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().sentAt?.toDate?.() || doc.data().failedAt?.toDate?.() || new Date()
            }));

            setAuditLogs(logs);
        } catch (error) {
            console.error("Erro ao carregar auditoria:", error);
        }
    }
    // 3. Funções (Definidas antes dos efeitos que as usam)
    async function loadReminderSettings() {
        setReminderLoading(true);
        try {
            const ref = doc(db, REMINDER_DOC_PATH);
            const snap = await getDoc(ref);
            const data = snap.exists() ? snap.data() : {};

            // ✅ Garante que TODOS os campos existam (mesmo que vazios)
            setReminderSettings({
                ...defaultReminderSettings,
                ...data,
                smsTemplateFeedback1: data.smsTemplateFeedback1 || "",
                smsTemplateFeedback2: data.smsTemplateFeedback2 || "",
                smsTemplateTraining1: data.smsTemplateTraining1 || "",
                smsTemplateTraining2: data.smsTemplateTraining2 || ""
            });
        } catch (error) {
            console.error("Erro ao carregar:", error);
            // Se der erro, carrega os padrões
            setReminderSettings(defaultReminderSettings);
        } finally {
            setReminderLoading(false);
        }
    }

    async function saveReminderSettings() {
        if (!reminderSettings) return;
        setReminderSaving(true);
        try {
            const ref = doc(db, REMINDER_DOC_PATH);
            await setDoc(ref, { ...reminderSettings, updatedAt: serverTimestamp() }, { merge: true });
        } finally {
            setReminderSaving(false);
        }
    }

    // 4. Efeitos (Agora podem usar as funções e constantes acima)
    useEffect(() => {
        // Se estiver na aba 'reminders' e os dados estiverem vazios, carrega!
        if (activeView === 'reminders' && !reminderSettings) {
            loadReminderSettings();
        }
    }, [activeView]);

    // 2. useEffect para carregar do Firebase assim que a tela abrir
    useEffect(() => {
        const loadTemplates = async () => {
            try {
                // Busca no documento 'msg_templates' dentro da coleção 'settings'
                const docRef = doc(db, "settings", "msg_templates");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().list) {
                    setSavedTemplates(docSnap.data().list);
                }
            } catch (error) {
                console.error("Erro ao carregar templates:", error);
            }
        };
        loadTemplates();
    }, []);

    // --- NOVO: FUNÇÕES (Salvar, Carregar, Deletar) ---
    const handleSaveNewTemplate = async () => { // Note o async
        if (!templateNameInput.trim()) return alert("Dê um nome para o modelo.");

        const newTemplate = { id: Date.now(), name: templateNameInput, text: messageTemplate };
        const newList = [...savedTemplates, newTemplate];

        // 1. Atualiza visualmente na hora (Optimistic UI)
        setSavedTemplates(newList);
        setTemplateNameInput('');

        // 2. Salva no Firebase
        try {
            await setDoc(doc(db, "settings", "msg_templates"), { list: newList });
            // Opcional: alert("Modelo salvo na nuvem!");
        } catch (error) {
            console.error("Erro ao salvar template:", error);
            alert("Erro ao salvar no banco de dados.");
        }
    };

    const handleSendBroadcastRobust = async () => {
        const validMessages = broadcastMessages.filter(msg => msg.trim());

        if (validMessages.length === 0) {
            return alert("📝 Escreva pelo menos uma mensagem antes de enviar.");
        }

        const now = new Date();
        const currentHour = now.getHours();
        if (currentHour < 5 || currentHour >= 21) {
            return alert("⏰ Envios são permitidos apenas entre 5h e 21h para proteger sua conta.");
        }

        if (!window.confirm(`🚀 Confirma o envio para ${students.length} alunos?\n\n📝 ${validMessages.length} variações de mensagem\n⏱️ Processamento: 3 alunos por lote, ~12 por hora`)) {
            return;
        }

        setBroadcastSending(true);

        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const createJob = httpsCallable(functions, 'createBroadcastJob');

            const result = await createJob({
                messages: validMessages
            });

            if (result.data.success) {
                setBroadcastMessages(['', '', '']);
                alert(`✅ Broadcast iniciado!\n\n📊 ${result.data.totalStudents} alunos na fila\n🎲 ${validMessages.length} variações\n📈 Acompanhe o progresso no dashboard`);

                // Carrega status após criar job
                setTimeout(() => loadBroadcastStatus(), 2000);
            }
        } catch (error) {
            console.error("Erro ao enviar broadcast:", error);

            let errorMsg = "❌ Erro interno";
            if (error.code === 'failed-precondition') {
                errorMsg = "⏰ " + error.message;
            } else if (error.code === 'unauthenticated') {
                errorMsg = "🔒 Você precisa estar logado";
            } else if (error.code === 'not-found') {
                errorMsg = "👥 " + error.message;
            }

            alert(errorMsg);
        } finally {
            setBroadcastSending(false);
        }
    };

    const handleLoadTemplate = (e) => {
        const id = e.target.value;
        if (!id) return;
        // Correção: Converte ambos para String para garantir que ache mesmo se for número vs texto
        const selected = savedTemplates.find(t => String(t.id) === String(id));
        if (selected && window.confirm(`Carregar modelo "${selected.name}"? O texto atual será substituído.`)) {
            setMessageTemplate(selected.text);
        }
        e.target.value = ""; // Reseta o select
    };

    const handleDeleteTemplate = async (id) => { // Note o async
        if (id === 'default') return alert("Não pode apagar o padrão.");

        if (window.confirm("Apagar este modelo salvo?")) {
            const newList = savedTemplates.filter(t => t.id !== id);

            // 1. Atualiza visual
            setSavedTemplates(newList);

            // 2. Atualiza no Firebase
            try {
                await setDoc(doc(db, "settings", "msg_templates"), { list: newList });
            } catch (error) {
                console.error("Erro ao deletar:", error);
                alert("Erro ao atualizar o banco.");
            }
        }
    };

    const handleConfirmTestDispatch = async () => {
        if (!reminderSettings) return alert("Carregue as configurações primeiro!");

        // 1. Limpeza do número
        let cleanPhone = testPhoneInput.replace(/\D/g, '');

        // Adiciona 55 se for número BR curto (garante formato DDI)
        if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
            cleanPhone = '55' + cleanPhone;
        }

        // Validação
        if (testOptions.whatsapp && cleanPhone.length < 12) {
            return alert(`Número inválido (${cleanPhone}). O formato deve ser DDI+DDD+NUMERO (Ex: 557399998888)`);
        }

        setLoading(true);

        try {
            const dataTeste = "20/01/2026";

            // --- 1. DISPARO WHATSAPP (TIRO DUPLO) ---
            if (testOptions.whatsapp) {
                if (!megaApiConfig.host || !megaApiConfig.instanceKey || !megaApiConfig.token) {
                    throw new Error("Preencha os dados da MegaAPI na aba de Configuração.");
                }

                let cleanHost = megaApiConfig.host.trim();
                if (!cleanHost.startsWith('http')) cleanHost = `https://${cleanHost}`;
                cleanHost = cleanHost.replace(/\/$/, "");

                const safeLink = String(reminderSettings.link || "https://shapefy.app").replace(/^"+|"+$/g, "");

                const msgWhatsapp = (reminderSettings.smsTemplate || "")
                    .replaceAll("{{NOME}}", "Teste Admin")
                    .replaceAll("{{DATA}}", dataTeste)
                    .replaceAll("{{DIA_SEMANA}}", "Terça-feira")
                    .replaceAll("{{LINK}}", safeLink);

                // LISTA DE TENTATIVAS (COM E SEM O 9º DÍGITO)
                const alvos = [];

                // 1. Número Original (Com 9) + Sufixo
                alvos.push(`${cleanPhone}@s.whatsapp.net`);

                // 2. Número Sem o 9 (Se for celular BR com 13 dígitos) + Sufixo
                if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
                    const ddd = cleanPhone.substring(2, 4); // Ex: 73
                    const resto = cleanPhone.substring(5);  // Pula o 9º dígito
                    const semNove = `55${ddd}${resto}@s.whatsapp.net`;
                    alvos.push(semNove);
                }

                console.log("🚀 Disparando para:", alvos);

                // Loop de envio
                for (const alvo of alvos) {
                    const payload = {
                        messageData: {
                            to: alvo,            // Testamos as duas variações
                            text: msgWhatsapp    // A chave 'text' funcionou no seu Print 1
                        }
                    };

                    // Disparo (sem await para ser rápido, mas logando o resultado)
                    fetch(`${cleanHost}/rest/sendMessage/${megaApiConfig.instanceKey}/text`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${megaApiConfig.token}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload)
                    })
                        .then(r => r.json())
                        .then(d => console.log(`Tentativa para ${alvo}:`, d))
                        .catch(e => console.error(`Erro para ${alvo}:`, e));
                }

                // Pequeno delay visual
                await new Promise(r => setTimeout(r, 500));
            }
            // --- 2. DISPARO EMAIL ---
            if (testOptions.email) {
                const subject = (reminderSettings.emailSubjectTemplate || "Teste").replaceAll("{{DATA}}", dataTeste);
                const conteudoEmail = (reminderSettings.emailTemplate || "")
                    .replaceAll("{{NOME}}", "Teste Admin")
                    .replaceAll("{{DATA}}", dataTeste)
                    .replaceAll("{{DIA_SEMANA}}", "Terça")
                    .replaceAll("{{LINK}}", reminderSettings.link);

                const templateParams = {
                    subject: subject,
                    conteudo_dinamico: conteudoEmail,
                    email_destino: "herickebony@gmail.com",
                    nome_instrutor: "Consultoria Ebony Team",
                    email: "consultoria.ebonyteam@gmail.com"
                };

                await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
            }

            alert(`✅ Sucesso! Mensagem enviada para ${cleanPhone}.`);
            setShowTestModal(false);

        } catch (error) {
            console.error("Erro fatal:", error);
            alert("Erro ao disparar: " + error.message);
        } finally {
            setLoading(false);
        }
    };
    const applyBold = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = messageTemplate;

        // Se não tiver nada selecionado, não faz nada ou adiciona os asteriscos vazios
        const selectedText = text.substring(start, end);

        const newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end);

        setMessageTemplate(newText);
        // Opcional: focar de volta
        setTimeout(() => textarea.focus(), 0);
    };

    const openLinkInput = () => {
        const textarea = textareaRef.current;
        if (!textarea || textarea.selectionStart === textarea.selectionEnd) {
            alert("Selecione o texto que será o link primeiro.");
            return;
        }
        setShowLinkInput(true);
    };

    const applyLink = () => {
        if (!linkUrl) return;

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = messageTemplate;
        const selectedText = text.substring(start, end);

        const newText = text.substring(0, start) + `[${selectedText}](${linkUrl})` + text.substring(end);

        setMessageTemplate(newText);
        setShowLinkInput(false);
        setLinkUrl('');
    };

    // ✅ VERIFICA STATUS DA CONEXÃO
    const checkConnectionStatus = async (overrideConfig = null) => {
        const config = overrideConfig || megaApiConfig;
        if (!config.host || !config.instanceKey || !config.token) {
            setMegaApiConfig(prev => ({ ...prev, connectionStatus: 'disconnected' }));
            return;
        }

        try {
            let cleanHost = config.host.trim();
            if (!cleanHost.startsWith('http')) cleanHost = `https://${cleanHost}`;
            cleanHost = cleanHost.replace(/\/$/, "");

            const url = `${cleanHost}/rest/instance/${config.instanceKey}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            console.log("🔍 RETORNO MEGAAPI:", JSON.stringify(data));

            // A MegaAPI retorna { connected: true/false }
            if (data.instance?.status === "connected") {
                setMegaApiConfig(prev => ({ ...prev, connectionStatus: 'connected' }));
            } else {
                setMegaApiConfig(prev => ({ ...prev, connectionStatus: 'disconnected' }));
            }
        } catch (error) {
            console.error("Erro ao checar status:", error);
            setMegaApiConfig(prev => ({ ...prev, connectionStatus: 'disconnected' }));
        }
    };

    const handleGenerateQRCode = async () => {
        // 1. Validação básica
        if (!megaApiConfig.host || !megaApiConfig.instanceKey || !megaApiConfig.token) {
            return alert("Preencha o Host, Instance Key e Token primeiro!");
        }

        setLoading(true);
        setMegaApiConfig(prev => ({ ...prev, qrCodeBase64: '' })); // Limpa visualmente

        try {
            // --- BLINDAGEM DE URL (O PULO DO GATO) ---
            let cleanHost = megaApiConfig.host.trim();
            // Se o usuário esqueceu o https://, a gente coloca pra ele
            if (!cleanHost.startsWith('http')) {
                cleanHost = `https://${cleanHost}`;
            }
            // Remove a barra no final se tiver
            cleanHost = cleanHost.replace(/\/$/, "");
            // ------------------------------------------

            // Monta a URL Oficial da MegaAPI
            const url = `${cleanHost}/rest/instance/qrcode_base64/${megaApiConfig.instanceKey}`;

            console.log("📡 Conectando em:", url); // Ajuda a debugar no F12

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${megaApiConfig.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            // Verifica se veio o QR Code
            if (data && data.qrcode) {
                setMegaApiConfig(prev => ({ ...prev, qrCodeBase64: data.qrcode }));

                // ✅ Começa a checar status a cada 5 segundos até conectar
                const checkInterval = setInterval(async () => {
                    await checkConnectionStatus();
                    if (megaApiConfig.connectionStatus === 'connected') {
                        clearInterval(checkInterval);
                    }
                }, 5000);

                // Para de checar após 2 minutos
                setTimeout(() => clearInterval(checkInterval), 120000);
            } else {
                // Se não veio QR, pode ser que já esteja conectado ou deu erro
                console.warn("Retorno MegaAPI:", data);
                if (data.connected) {
                    alert("✅ Esta instância já está conectada! Não precisa ler o QR.");
                } else {
                    alert("Não foi possível gerar o QR. Verifique no painel se a instância está ATIVA.");
                }
            }
        } catch (error) {
            console.error("❌ Erro crítico:", error);
            alert("Erro de conexão. Verifique se o Host está correto (ex: apistart01...).");
        } finally {
            setLoading(false);
        }
    };

    // 2. Função para SALVAR as chaves
    const handleSaveMegaApiConfig = async () => {
        if (!megaApiConfig.host || !megaApiConfig.instanceKey || !megaApiConfig.token) {
            return alert("Preencha Host, Instance Key e Token antes de salvar.");
        }

        try {
            // Salva no documento 'settings/whatsapp_config'
            await setDoc(doc(db, MEGAAPI_DOC_PATH), {
                host: megaApiConfig.host,
                instanceKey: megaApiConfig.instanceKey,
                token: megaApiConfig.token,
                updatedAt: serverTimestamp()
            }, { merge: true }); // Merge evita apagar outros dados sem querer

            alert("✅ Configuração da MegaAPI salva com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar config:", error);
            alert("Erro ao salvar no banco de dados.");
        }
    };

    useEffect(() => {
        const loadMegaApi = async () => {
            try {
                const docSnap = await getDoc(doc(db, MEGAAPI_DOC_PATH));
                if (docSnap.exists()) {            
                    const data = docSnap.data();
                    setMegaApiConfig(prev => ({
                        ...prev,
                        host: data.host || '',
                        instanceKey: data.instanceKey || '',
                        token: data.token || ''
                    }));
                    setTimeout(() => checkConnectionStatus({
                        host: data.host || '',
                        instanceKey: data.instanceKey || '',
                        token: data.token || ''
                    }), 500);
                }
            } catch (error) {
                console.error("Erro ao carregar MegaAPI:", error);
            }
        };

        loadMegaApi();

        if (activeView === 'settings_api') {
            loadAuditLogs();
        }
        if (activeView === 'broadcast') {
            loadBroadcastStatus();
            const interval = setInterval(loadBroadcastStatus, 30000);
            return () => clearInterval(interval);
        }
    }, [activeView]);

    // ✅ CARREGA AUDITORIA EM TEMPO REAL
    useEffect(() => {
        if (activeView === 'settings_api') {
            loadAuditLogs();
        }
    }, [activeView]);

    // Função para limpar e formatar telefone (padrão DDI+DDD+NUMERO)
    const formatPhoneForAPI = (phone) => {
        // 1. Remove tudo que não é número
        let clean = phone.replace(/\D/g, '');

        // 2. Se o número não tiver DDI (menos de 12 dígitos), adiciona 55 (Brasil)
        // Ex: 73999998888 (11 dígitos) -> vira 5573999998888
        if (clean.length >= 10 && clean.length <= 11) {
            clean = '55' + clean;
        }

        return clean;
    };

    return (

        <div className="bg-ebony-bg min-h-screen p-4 md:p-8 animate-in fade-in relative">
            {/* Header simples para esse módulo */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-ebony-deep to-transparent rounded-xl border border-ebony-border/50 shadow-sm">
                    <Megaphone className="w-6 h-6 text-ebony-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight">Gestão de Comunicação</h1>
                    <p className="text-xs text-ebony-muted font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        Automação e CRM
                    </p>
                </div>
            </div>

            {/* Navegação Interna (Abas) */}
            <div className="flex bg-ebony-deep/80 backdrop-blur-sm p-1 rounded-xl border border-ebony-border shadow-lg mb-6 w-fit">
                <button
                    onClick={() => setActiveView('reminders')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeView === 'reminders' ? 'bg-ebony-primary text-white' : 'text-ebony-muted hover:text-white'}`}
                >
                    Lembretes
                </button>
                <button
                    onClick={() => setActiveView('broadcast')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeView === 'broadcast' ? 'bg-ebony-primary text-white' : 'text-ebony-muted hover:text-white'}`}
                >
                    Comunicados
                </button>
                <button
                    onClick={() => setActiveView('settings_api')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeView === 'settings_api' ? 'bg-ebony-primary text-white' : 'text-ebony-muted hover:text-white'}`}
                >
                    Mega-api Config
                </button>
            </div>

            {/* =========================================================================
               ÁREA DE COLAGEM 2: AQUI ENTRARÁ O JSX (O visual)
               ========================================================================= */}
            {/* --- MODAL DE MENSAGEM (COM EDITOR) --- */}
            {showTemplateModal && (
                <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
                    <div className="bg-ebony-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border border-ebony-border">
                        {/* Header */}
                        <div className="p-4 border-b border-ebony-border flex justify-between items-center bg-ebony-surface">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-ebony-muted" /> Modelo de Mensagem
                            </h3>
                            <button
                                onClick={() => setShowTemplateModal(false)}
                                className="text-ebony-muted hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 h-[600px] flex flex-col min-h-0 overflow-hidden relative">
                            {/* --- INÍCIO DO BLOCO NOVO (GERENCIADOR DE TEMPLATES) --- */}
                            <div className="mb-3 bg-ebony-deep p-3 rounded-lg border border-ebony-border flex flex-col gap-2">
                                {/* Linha 1: Select e Input */}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select
                                        onChange={handleLoadTemplate}
                                        defaultValue=""
                                        className="flex-1 p-2 text-xs bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 font-bold"
                                    >
                                        <option value="" disabled>📂 Carregar modelo salvo...</option>
                                        {savedTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>

                                    <div className="flex gap-2 flex-1">
                                        <input
                                            type="text"
                                            placeholder="Nome para salvar novo..."
                                            className="flex-1 p-2 text-xs bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none"
                                            value={templateNameInput}
                                            onChange={e => setTemplateNameInput(e.target.value)}
                                        />
                                        <button
                                            onClick={handleSaveNewTemplate}
                                            className="p-2 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg transition flex items-center justify-center"
                                            title="Salvar Modelo"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Linha 2: Chips dos modelos salvos (para visualização rápida/exclusão) */}
                                {savedTemplates.length > 1 && (
                                    <div className="flex gap-2 overflow-x-auto pt-1 pb-1 scrollbar-hide">
                                        {savedTemplates.filter(t => t.id !== 'default').map(t => (
                                            <div
                                                key={t.id}
                                                className="flex items-center gap-1 bg-ebony-surface border border-ebony-border px-2 py-1 rounded-md text-[10px] whitespace-nowrap shadow-sm"
                                            >
                                                <span className="font-bold text-ebony-muted">{t.name}</span>
                                                <button
                                                    onClick={() => handleDeleteTemplate(t.id)}
                                                    className="text-ebony-muted hover:text-white"
                                                >
                                                    <Trash className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-ebony-muted bg-ebony-deep p-3 rounded-lg border border-ebony-border mb-4">
                                Use as variáveis: <strong className="text-white">{'{{NOME}}'}</strong>,{" "}
                                <strong className="text-white">{'{{FIM_PLANO}}'}</strong> e{" "}
                                <strong className="text-white">{'{{LISTA_DATAS}}'}</strong>.
                            </p>

                            {/* BARRA DE FERRAMENTAS */}
                            <div className="flex items-center gap-2 mb-2 bg-ebony-deep p-1.5 rounded-lg border border-ebony-border w-fit">
                                <button
                                    onClick={applyBold}
                                    className="p-1.5 text-ebony-muted hover:text-white hover:bg-ebony-surface rounded transition"
                                    title="Negrito (**texto**)"
                                >
                                    <Bold className="w-4 h-4" />
                                </button>
                                <div className="w-px h-4 bg-ebony-border mx-1"></div>
                                <button
                                    onClick={openLinkInput}
                                    className="p-1.5 text-ebony-muted hover:text-white hover:bg-ebony-surface rounded transition"
                                    title="Inserir Link"
                                >
                                    <LinkIcon className="w-4 h-4" />
                                </button>
                            </div>

                            {/* INPUT FLUTUANTE DE LINK */}
                            {showLinkInput && (
                                <div className="absolute top-44 left-6 z-10 bg-ebony-surface shadow-xl border border-ebony-border p-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 w-80">
                                    <LinkIcon className="w-4 h-4 text-ebony-muted" />
                                    <input
                                        type="text"
                                        className="flex-1 text-sm outline-none bg-transparent text-white placeholder-gray-600"
                                        placeholder="Cole a URL aqui..."
                                        value={linkUrl}
                                        onChange={e => setLinkUrl(e.target.value)}
                                        autoFocus
                                    />
                                    <button
                                        onClick={applyLink}
                                        className="p-1 bg-ebony-primary hover:bg-red-900 text-white rounded transition"
                                    >
                                        <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => setShowLinkInput(false)}
                                        className="p-1 text-ebony-muted hover:text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            )}

                            {/* ÁREA DE TEXTO */}
                            <textarea
                                ref={textareaRef}
                                className="w-full flex-1 p-4 bg-ebony-deep border border-ebony-border rounded-lg text-sm font-mono text-white placeholder-gray-600 focus:ring-2 focus:ring-ebony-primary outline-none resize-none leading-relaxed"
                                value={messageTemplate}
                                onChange={(e) => setMessageTemplate(e.target.value)}
                            ></textarea>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-ebony-border flex justify-end bg-ebony-surface">
                            <button
                                onClick={() => { localStorage.setItem('ebony_msg_template', messageTemplate); setShowTemplateModal(false); }}
                                className="px-6 py-2 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg text-sm transition"
                            >
                                Salvar Alteração
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeView === 'reminders' && (
                <div className="animate-in fade-in">
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="bg-ebony-surface rounded-xl border border-ebony-border shadow-sm p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-black text-white">Automação de Lembretes</h3>

                                <div className="flex gap-2">
                                    <button
                                        onClick={loadReminderSettings}
                                        className="px-3 py-2 rounded-lg bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface text-xs font-black transition"
                                    >
                                        Recarregar
                                    </button>

                                    <button
                                        onClick={() => setShowTestModal(true)} // <--- SÓ ABRE O MODAL
                                        disabled={loading}
                                        className="px-3 py-2 rounded-lg bg-ebony-primary hover:bg-red-900 text-white text-xs font-black transition disabled:opacity-50"
                                    >
                                        {loading ? "Processando..." : "Disparar Teste"}
                                    </button>

                                    <button
                                        onClick={saveReminderSettings}
                                        disabled={reminderSaving || reminderLoading}
                                        className="px-3 py-2 rounded-lg bg-ebony-primary hover:bg-red-900 text-white text-xs font-black disabled:opacity-60 transition"
                                    >
                                        {reminderSaving ? "Salvando..." : "Salvar"}
                                    </button>
                                </div>
                            </div>

                            {reminderLoading || !reminderSettings ? (
                                <div className="text-sm text-ebony-muted">Carregando...</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="text-xs font-black text-ebony-muted">
                                            Ativo
                                            <div className="mt-2 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!reminderSettings.enabled}
                                                    onChange={(e) =>
                                                        setReminderSettings((p) => ({ ...p, enabled: e.target.checked }))
                                                    }
                                                />
                                                <span className="text-white font-bold">Habilitar</span>
                                            </div>
                                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {/* EMAIL */}
                                                <label className="flex items-center gap-2 bg-ebony-deep p-2 rounded-lg border border-ebony-border cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!reminderSettings.sendChannels?.email}
                                                        onChange={(e) =>
                                                            setReminderSettings((p) => ({
                                                                ...p,
                                                                sendChannels: {
                                                                    ...(p.sendChannels || {}),
                                                                    email: e.target.checked,
                                                                },
                                                            }))
                                                        }
                                                    />
                                                    <span className="text-white font-bold text-xs">Enviar Email</span>
                                                </label>
                                                {/* WHATSAPP (compatível com configs antigas "sms") */}
                                                <label className="flex items-center gap-2 bg-ebony-deep p-2 rounded-lg border border-ebony-border cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            !!reminderSettings.sendChannels?.whatsapp ||
                                                            !!reminderSettings.sendChannels?.sms
                                                        }
                                                        onChange={(e) =>
                                                            setReminderSettings((p) => ({
                                                                ...p,
                                                                sendChannels: {
                                                                    ...(p.sendChannels || {}),
                                                                    whatsapp: e.target.checked,
                                                                    sms: e.target.checked, // mantém compatibilidade com o que já existe salvo
                                                                },
                                                            }))
                                                        }
                                                    />
                                                    <span className="text-white font-bold text-xs">Enviar WhatsApp</span>
                                                </label>
                                            </div>
                                        </div>

                                        <label className="text-xs font-black text-ebony-muted">
                                            Email — Dias antes
                                            <input
                                                type="number"
                                                min={0}
                                                max={30}
                                                value={reminderSettings.daysBefore ?? 1}
                                                onChange={(e) =>
                                                    setReminderSettings((p) => ({ ...p, daysBefore: Number(e.target.value || 0) }))
                                                }
                                                className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 px-3 py-2 text-sm outline-none"
                                            />
                                        </label>

                                        <label className="text-xs font-black text-ebony-muted">
                                            Email — Hora do 1º envio (0–23)
                                            <input
                                                type="number"
                                                min={0}
                                                max={23}
                                                value={reminderSettings.sendHour ?? 9}
                                                onChange={(e) =>
                                                    setReminderSettings((p) => ({ ...p, sendHour: Number(e.target.value || 0) }))
                                                }
                                                className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 px-3 py-2 text-sm outline-none"
                                            />
                                        </label>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <label className="text-xs font-black text-ebony-muted">
                                            WhatsApp — Dias antes
                                            <input
                                                type="number"
                                                min={0}
                                                max={30}
                                                value={reminderSettings.whatsappDaysBefore ?? 1}
                                                onChange={(e) =>
                                                    setReminderSettings((p) => ({
                                                        ...p,
                                                        whatsappDaysBefore: Number(e.target.value || 0),
                                                    }))
                                                }
                                                className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg px-3 py-2 text-sm outline-none"
                                            />
                                        </label>

                                        <label className="text-xs font-black text-ebony-muted">
                                            WhatsApp — Hora (0–23)
                                            <input
                                                type="number"
                                                min={0}
                                                max={23}
                                                value={reminderSettings.whatsappSendHour ?? 9}
                                                onChange={(e) =>
                                                    setReminderSettings((p) => ({
                                                        ...p,
                                                        whatsappSendHour: Number(e.target.value || 0),
                                                    }))
                                                }
                                                className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg px-3 py-2 text-sm outline-none"
                                            />
                                        </label>
                                    </div>

                                    <label className="text-xs font-black text-ebony-muted">
                                        Link ({'{{LINK}}'})
                                        <input
                                            value={reminderSettings.link || ""}
                                            onChange={(e) => setReminderSettings((p) => ({ ...p, link: e.target.value }))}
                                            className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 px-3 py-2 text-sm outline-none"
                                        />
                                    </label>

                                    <label className="text-xs font-black text-ebony-muted">
                                        Assunto do Email
                                        <input
                                            value={reminderSettings.emailSubjectTemplate || ""}
                                            onChange={(e) =>
                                                setReminderSettings((p) => ({ ...p, emailSubjectTemplate: e.target.value }))
                                            }
                                            className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 px-3 py-2 text-sm outline-none"
                                        />
                                    </label>

                                    <label className="text-xs font-black text-ebony-muted">
                                        Template do Email
                                        <textarea
                                            rows={5}
                                            value={reminderSettings.emailTemplate || ""}
                                            onChange={(e) =>
                                                setReminderSettings((p) => ({ ...p, emailTemplate: e.target.value }))
                                            }
                                            className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 px-3 py-2 text-sm outline-none resize-none"
                                        />
                                    </label>

                                    <div className="space-y-3">
                                        {/* ========== FEEDBACK NORMAL ========== */}
                                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-3">
                                            <h4 className="text-xs font-black text-blue-400 uppercase flex items-center gap-2">
                                                📊 Feedback Normal (Avaliação Geral)
                                            </h4>

                                            <label className="text-xs font-black text-ebony-muted">
                                                Variação 1
                                                <textarea
                                                    rows={3}
                                                    value={reminderSettings.smsTemplateFeedback1 || ""}
                                                    onChange={(e) =>
                                                        setReminderSettings((p) => ({ ...p, smsTemplateFeedback1: e.target.value }))
                                                    }
                                                    placeholder="Ex: Oi {{NOME}}! Lembrete: feedback dia {{DATA}}. Link: {{LINK}}"
                                                    className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-blue-500 placeholder-gray-600 px-3 py-2 text-sm outline-none resize-none"
                                                />
                                            </label>

                                            <label className="text-xs font-black text-ebony-muted">
                                                Variação 2
                                                <textarea
                                                    rows={3}
                                                    value={reminderSettings.smsTemplateFeedback2 || ""}
                                                    onChange={(e) =>
                                                        setReminderSettings((p) => ({ ...p, smsTemplateFeedback2: e.target.value }))
                                                    }
                                                    placeholder="Ex: E aí {{NOME}}! Não esquece: feedback {{DATA}}. Acesse: {{LINK}}"
                                                    className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-blue-500 placeholder-gray-600 px-3 py-2 text-sm outline-none resize-none"
                                                />
                                            </label>
                                        </div>

                                        {/* ========== FEEDBACK DE TREINO ========== */}
                                        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 space-y-3">
                                            <h4 className="text-xs font-black text-green-400 uppercase flex items-center gap-2">
                                                💪 Feedback de Treino (Troca de Ficha)
                                            </h4>

                                            <label className="text-xs font-black text-ebony-muted">
                                                Variação 1
                                                <textarea
                                                    rows={3}
                                                    value={reminderSettings.smsTemplateTraining1 || ""}
                                                    onChange={(e) =>
                                                        setReminderSettings((p) => ({ ...p, smsTemplateTraining1: e.target.value }))
                                                    }
                                                    placeholder="Ex: Fala {{NOME}}! Feedback de treino dia {{DATA}}. Clique: {{LINK}}"
                                                    className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-green-500 placeholder-gray-600 px-3 py-2 text-sm outline-none resize-none"
                                                />
                                            </label>

                                            <label className="text-xs font-black text-ebony-muted">
                                                Variação 2
                                                <textarea
                                                    rows={3}
                                                    value={reminderSettings.smsTemplateTraining2 || ""}
                                                    onChange={(e) =>
                                                        setReminderSettings((p) => ({ ...p, smsTemplateTraining2: e.target.value }))
                                                    }
                                                    placeholder="Ex: Olá {{NOME}}! Treino novo chegando {{DATA}}. Veja: {{LINK}}"
                                                    className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-green-500 placeholder-gray-600 px-3 py-2 text-sm outline-none resize-none"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="text-[11px] text-ebony-muted">
                                        Variáveis: <span className="font-black text-white">{'{{NOME}}'}</span>,{" "}
                                        <span className="font-black text-white">{'{{DATA}}'}</span>,{" "}
                                        <span className="font-black text-white">{'{{DIA_SEMANA}}'}</span>,{" "}
                                        <span className="font-black text-white">{'{{LINK}}'}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* =======================================================
                ABA NOVA: COMUNICADOS (BROADCAST)
               ======================================================= */}
            {activeView === 'broadcast' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4">

                    {/* Lado Esquerdo: O Compositor de Mensagem */}
                    <div className="lg:col-span-8 space-y-4">
                        <div className="bg-ebony-surface rounded-xl border border-ebony-border p-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Megaphone className="w-32 h-32 text-ebony-primary" />
                            </div>

                            <h2 className="text-lg font-black text-white mb-1 flex items-center gap-2">
                                <Radio className="w-5 h-5 text-ebony-primary animate-pulse" /> Canal de Transmissão
                            </h2>
                            <p className="text-xs text-ebony-muted mb-6">
                                Envie avisos para toda a base ativa de alunos via WhatsApp.
                            </p>

                            <div className="space-y-4 relative z-10">
                                <div>
                                    <label className="text-xs font-bold text-ebony-muted uppercase mb-2 block">Sua Mensagem</label>
                                    {/* ===== 3 CAMPOS DE MENSAGEM ===== */}
                                    {[0, 1, 2].map((index) => (
                                        <div key={index} className="mb-4">
                                            <label className="text-xs font-bold text-ebony-muted uppercase mb-2 block flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${broadcastMessages[index].trim() ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                                Mensagem {index + 1} {index === 0 && "(Obrigatória)"}
                                            </label>
                                            <textarea
                                                value={broadcastMessages[index]}
                                                onChange={(e) => {
                                                    const newMessages = [...broadcastMessages];
                                                    newMessages[index] = e.target.value;
                                                    setBroadcastMessages(newMessages);
                                                }}
                                                className="w-full h-32 bg-ebony-deep border border-ebony-border rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-ebony-primary outline-none resize-none placeholder-gray-600 leading-relaxed"
                                                placeholder={
                                                    index === 0
                                                        ? "Ex: Pessoal, comunicado sobre o carnaval..."
                                                        : `Variação ${index + 1}: Mesmo conteúdo com palavras diferentes...`
                                                }
                                            />
                                            <div className="flex justify-between items-center mt-2 text-xs">
                                                <span className="text-ebony-muted">
                                                    {index === 0 ? "💡 Esta mensagem é obrigatória" : `🎲 Variação ${index + 1} (opcional)`}
                                                </span>
                                                <span className={`font-mono ${broadcastMessages[index].length > 300 ? 'text-yellow-400' : 'text-ebony-muted'}`}>
                                                    {broadcastMessages[index].length}/500
                                                </span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* ===== INFO DE VARIAÇÃO ===== */}
                                    <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-lg mb-4">
                                        <div className="flex items-center gap-2 text-blue-400 font-bold text-xs mb-2">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                            Sistema de Variação Inteligente
                                        </div>
                                        <ul className="text-xs text-blue-300/80 space-y-1">
                                            <li>• Cada aluno recebe uma mensagem diferente aleatoriamente</li>
                                            <li>• Use {'{{NOME}}'} para personalizar com o nome do aluno</li>
                                            <li>• Preencha 2-3 campos para máxima proteção anti-spam</li>
                                            <li>• Mensagens vazias são ignoradas automaticamente</li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="bg-ebony-deep/50 p-3 rounded-lg border border-ebony-border flex items-center justify-between">
                                    <div className="text-xs text-ebony-text">
                                        <span className="font-bold">Destinatários:</span> {students.length} alunos ativos • {broadcastMessages.filter(msg => msg.trim()).length} variações
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={handleSendBroadcastRobust}
                                        disabled={broadcastSending || broadcastMessages.filter(msg => msg.trim()).length === 0}
                                        className="px-6 py-3 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {broadcastSending ? "Enviando..." : (
                                            <>
                                                <Smartphone className="w-4 h-4" /> Enviar {broadcastMessages.filter(msg => msg.trim()).length} Variações
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lado Direito: Dashboard */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-ebony-surface rounded-xl border border-ebony-border p-5">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2">
                                    📊 Dashboard de Broadcasts
                                </h3>
                                <button
                                    onClick={loadBroadcastStatus}
                                    disabled={jobsLoading}
                                    className="text-xs text-ebony-muted hover:text-white transition"
                                >
                                    {jobsLoading ? "⟳" : "🔄"}
                                </button>
                            </div>

                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {broadcastJobs.length === 0 ? (
                                    <div className="text-center text-ebony-muted text-xs py-4">
                                        Nenhum broadcast ainda
                                    </div>
                                ) : (
                                    broadcastJobs.map((job) => (
                                        <div key={job.id} className="bg-ebony-deep rounded-lg p-3 border border-ebony-border">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="text-xs font-bold text-white">
                                                    {job.createdAt?.toDate?.()?.toLocaleDateString('pt-BR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                                <span className={`text-[10px] px-2 py-1 rounded font-bold ${job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                        job.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                                                            job.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                                                'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                    {job.status === 'completed' ? '✅ Finalizado' :
                                                        job.status === 'processing' ? '🔄 Enviando' :
                                                            job.status === 'error' ? '❌ Erro' :
                                                                '⏳ Na fila'}
                                                </span>
                                            </div>

                                            <div className="text-xs text-ebony-muted mb-2">
                                                {job.progress?.sent || 0} enviados • {job.progress?.failed || 0} falhas • {job.progress?.total || 0} total
                                            </div>

                                            {job.progress?.total > 0 && (
                                                <div className="w-full bg-ebony-surface rounded-full h-1.5 mb-2">
                                                    <div
                                                        className="bg-ebony-primary h-1.5 rounded-full transition-all"
                                                        style={{
                                                            width: `${((job.progress.sent + job.progress.failed) / job.progress.total) * 100}%`
                                                        }}
                                                    ></div>
                                                </div>
                                            )}

                                            {/* Últimos envios */}
                                            {job.items?.length > 0 && (
                                                <div className="space-y-1">
                                                    <div className="text-[10px] text-ebony-muted font-bold">ÚLTIMOS ENVIOS:</div>
                                                    {job.items.slice(0, 3).map((item) => (
                                                        <div key={item.id} className="flex justify-between items-center text-[10px]">
                                                            <span className="text-white truncate flex-1 mr-2">{item.studentName}</span>
                                                            <span className={item.status === 'sent' ? 'text-green-400' :
                                                                item.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}>
                                                                {item.status === 'sent' ? '✓' : item.status === 'failed' ? '✗' : '⏳'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {job.items.length > 3 && (
                                                        <div className="text-[10px] text-ebony-muted">+{job.items.length - 3} mais...</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="bg-ebony-deep rounded-xl border border-ebony-border p-5">
                            <h3 className="text-xs font-bold text-white uppercase mb-3 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-green-500" /> Boas Práticas
                            </h3>
                            <ul className="space-y-3">
                                <li className="text-[11px] text-ebony-muted leading-snug flex gap-2">
                                    <span className="w-1 h-1 bg-ebony-primary rounded-full mt-1.5 shrink-0"></span>
                                    Sistema processa 3 alunos por lote, ~12 por hora automaticamente.
                                </li>
                                <li className="text-[11px] text-ebony-muted leading-snug flex gap-2">
                                    <span className="w-1 h-1 bg-ebony-primary rounded-full mt-1.5 shrink-0"></span>
                                    Use <strong>{'{{NOME}}'}</strong> para personalizar cada mensagem.
                                </li>
                                <li className="text-[11px] text-ebony-muted leading-snug flex gap-2">
                                    <span className="w-1 h-1 bg-ebony-primary rounded-full mt-1.5 shrink-0"></span>
                                    Envios só acontecem das 5h às 21h.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* =======================================================
                ABA NOVA: CONFIGURAÇÃO Z-API & AUDITORIA
               ======================================================= */}
            {activeView === 'settings_api' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4">

                    {/* 1. Configuração da Instância */}
                    <div className="bg-ebony-surface rounded-xl border border-ebony-border p-6 shadow-lg">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-black text-white flex items-center gap-2">
                                <Settings className="w-5 h-5 text-ebony-muted" /> Configuração MegaAPI
                            </h2>

                            {/* ✅ INDICADOR DE STATUS */}
                            <div className="flex items-center gap-2">
                                {megaApiConfig.connectionStatus === 'connected' && (
                                    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-3 py-1.5 rounded-lg animate-in fade-in">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs font-bold text-green-400">Conectado</span>
                                    </div>
                                )}
                                {megaApiConfig.connectionStatus === 'disconnected' && (
                                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg animate-in fade-in">
                                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                        <span className="text-xs font-bold text-red-400">Desconectado</span>
                                    </div>
                                )}
                                {megaApiConfig.connectionStatus === 'checking' && (
                                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-lg animate-in fade-in">
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs font-bold text-yellow-400">Verificando...</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-ebony-muted uppercase">Host (URL da API)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: https://api.mega-api.app.br"
                                    className="w-full mt-1 p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white text-sm focus:border-green-500 outline-none transition-colors"
                                    value={megaApiConfig.host}
                                    onChange={e => setMegaApiConfig({ ...megaApiConfig, host: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-ebony-muted uppercase">Instance Key</label>
                                <input
                                    type="text"
                                    placeholder="Ex: minha_instancia_1"
                                    className="w-full mt-1 p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white text-sm focus:border-green-500 outline-none transition-colors"
                                    value={megaApiConfig.instanceKey}
                                    onChange={e => setMegaApiConfig({ ...megaApiConfig, instanceKey: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-ebony-muted uppercase">Token (Bearer)</label>
                                <input
                                    type="password"
                                    placeholder="Cole seu token aqui..."
                                    className="w-full mt-1 p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white text-sm focus:border-green-500 outline-none transition-colors"
                                    value={megaApiConfig.token}
                                    onChange={e => setMegaApiConfig({ ...megaApiConfig, token: e.target.value })}
                                />
                            </div>

                            {/* ÁREA DO QR CODE */}
                            <div className="mt-6 flex flex-col items-center justify-center bg-white rounded-xl p-4 min-h-[250px] shadow-inner">
                                {loading ? (
                                    <div className="animate-pulse text-gray-400 font-bold text-xs">Gerando QR Code...</div>
                                ) : megaApiConfig.qrCodeBase64 ? (
                                    <div className="flex flex-col items-center animate-in zoom-in duration-300">
                                        <img src={megaApiConfig.qrCodeBase64} alt="QR Code WhatsApp" className="w-56 h-56" />
                                        <p className="text-green-600 font-bold text-xs mt-2">Leia com seu WhatsApp!</p>
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <Smartphone className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p className="text-xs">Preencha os dados acima e clique em<br /><strong>Gerar QR Code</strong> para conectar.</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 flex gap-2"> {/* <--- ADICIONEI FLEX E GAP AQUI */}
                                <button
                                    onClick={handleGenerateQRCode}
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? "Conectando..." : "Gerar QR Code"}
                                </button>

                                <button
                                    onClick={handleSaveMegaApiConfig}
                                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs transition shadow-lg flex items-center justify-center gap-2"
                                >
                                    Salvar Config
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. Auditoria de Falhas */}
                    <div className="bg-ebony-surface rounded-xl border border-ebony-border p-6 shadow-lg flex flex-col h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-black text-white flex items-center gap-2">
                                <FileWarning className="w-5 h-5 text-ebony-primary" /> Auditoria de Envios
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setAuditFilter('all')}
                                    className={`px-2 py-1 rounded text-[10px] font-bold transition ${auditFilter === 'all' ? 'bg-ebony-primary text-white' : 'bg-ebony-deep text-ebony-muted'}`}
                                >
                                    Todos ({auditLogs.length})
                                </button>
                                <button
                                    onClick={() => setAuditFilter('errors')}
                                    className={`px-2 py-1 rounded text-[10px] font-bold transition ${auditFilter === 'errors' ? 'bg-red-500 text-white' : 'bg-ebony-deep text-ebony-muted'}`}
                                >
                                    Erros ({auditLogs.filter(l => l.status === 'error').length})
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 bg-ebony-deep/50 rounded-xl border border-ebony-border overflow-hidden relative">
                            <div className="overflow-y-auto absolute inset-0 custom-scrollbar p-2">
                                {auditLogs
                                    .filter(log => auditFilter === 'all' || (auditFilter === 'errors' && log.status === 'error'))
                                    .map((log) => (
                                        <div
                                            key={log.id}
                                            className={`p-3 rounded-lg border mb-2 ${log.status === 'error' ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="font-bold text-white text-sm">{log.studentName}</div>
                                                    <div className="text-[10px] text-ebony-muted mt-0.5 flex items-center gap-2">
                                                        <span className={`px-1.5 py-0.5 rounded ${log.channel === 'email' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}>
                                                            {log.channel === 'email' ? '📧 Email' : '💬 WhatsApp'}
                                                        </span>
                                                        {log.date && (
                                                            <span>{new Date(log.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                        )}
                                                    </div>
                                                    {log.status === 'error' && (
                                                        <div className="text-[10px] text-red-300 flex items-center gap-1 mt-1">
                                                            <AlertTriangle className="w-3 h-3" /> {log.error}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`text-[10px] font-bold px-2 py-1 rounded ${log.status === 'sent' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {log.status === 'sent' ? '✓ Enviado' : '✗ Falhou'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                {auditLogs.length === 0 && (
                                    <div className="text-center text-ebony-muted text-xs py-8">
                                        Nenhum envio registrado ainda
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* --- MODAL DE CONFIGURAÇÃO DO TESTE --- */}
            {showTestModal && (
                <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-ebony-surface rounded-xl border border-ebony-border shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="p-4 border-b border-ebony-border bg-ebony-deep">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-ebony-primary" /> Disparar Teste
                            </h3>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Seleção de Canais */}
                            <div>
                                <label className="text-xs font-bold text-ebony-muted uppercase mb-2 block">Canais de Envio</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-ebony-deep p-2 rounded-lg border border-ebony-border flex-1">
                                        <input
                                            type="checkbox"
                                            checked={testOptions.whatsapp}
                                            onChange={e => setTestOptions({ ...testOptions, whatsapp: e.target.checked })}
                                            className="accent-green-500"
                                        />
                                        <span className="text-sm text-white font-bold">WhatsApp</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-ebony-deep p-2 rounded-lg border border-ebony-border flex-1">
                                        <input
                                            type="checkbox"
                                            checked={testOptions.email}
                                            onChange={e => setTestOptions({ ...testOptions, email: e.target.checked })}
                                            className="accent-blue-500"
                                        />
                                        <span className="text-sm text-white font-bold">E-mail</span>
                                    </label>
                                </div>
                            </div>

                            {/* Input de Telefone (Só aparece se WhatsApp estiver marcado) */}
                            {testOptions.whatsapp && (
                                <div>
                                    <label className="text-xs font-bold text-ebony-muted uppercase mb-1 block">
                                        Número de Destino (DDD + Número)
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="Ex: 73999998888"
                                        className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white text-lg font-mono outline-none focus:border-green-500 transition-colors"
                                        value={testPhoneInput}
                                        onChange={(e) => {
                                            // Permite digitar, mas a limpeza real acontece no envio
                                            setTestPhoneInput(e.target.value);
                                        }}
                                        autoFocus
                                    />
                                    <p className="text-[10px] text-ebony-muted mt-1">
                                        *O sistema adicionará o código 55 (Brasil) automaticamente se necessário.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-ebony-deep/50 border-t border-ebony-border flex gap-3">
                            <button
                                onClick={() => setShowTestModal(false)}
                                className="flex-1 py-2 bg-transparent border border-ebony-border text-ebony-muted font-bold rounded-lg hover:text-white transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmTestDispatch}
                                className="flex-1 py-2 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg transition"
                            >
                                Enviar Agora
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunicationModule;