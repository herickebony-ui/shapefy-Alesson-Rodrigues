import React, { useState, useEffect, lazy, Suspense } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import emailjs from '@emailjs/browser';
import {
    MessageSquare, X, Settings, Plus, Trash, Check, Bold, Link as LinkIcon,
    Smartphone, Megaphone, ShieldCheck, FileWarning, AlertTriangle,
    Mail, Loader
} from 'lucide-react';

const RichTextEditor = lazy(() => import('./RichTextEditor'));

// Converte HTML do editor para formato WhatsApp (*bold*, _italic_)
function htmlToWhatsApp(html) {
    if (!html) return '';
    return html
        .replace(/<b>(.*?)<\/b>/gi, '*$1*')
        .replace(/<strong>(.*?)<\/strong>/gi, '*$1*')
        .replace(/<i>(.*?)<\/i>/gi, '_$1_')
        .replace(/<em>(.*?)<\/em>/gi, '_$1_')
        .replace(/<u>(.*?)<\/u>/gi, '$1')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}


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
const MEGAAPI_DOC_PATH = "settings/whatsapp_config";
const EMAILJS_SERVICE_ID = "service_bbgiotb";
const EMAILJS_TEMPLATE_ID = "template_yvoz298";
const EMAILJS_PUBLIC_KEY = "ob4FD-glJDBkWJVfM";

const CommunicationModule = ({ students = [] }) => {
    // 1. Estados
    const [activeView, setActiveView] = useState('reminders'); // 'reminders' | 'settings_api'
    const [loading, setLoading] = useState(false);

    const [megaApiConfig, setMegaApiConfig] = useState({
        host: '',
        instanceKey: '',
        token: '',
        qrCodeBase64: '',
        connectionStatus: 'checking'
    });
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditFilter, setAuditFilter] = useState('all'); // 'all' | 'errors'

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
    const [testEmailInput, setTestEmailInput] = useState('');
    const [testOptions, setTestOptions] = useState({ whatsapp: true, email: false });
    const [testTemplateType, setTestTemplateType] = useState('feedback1');

    const defaultReminderSettings = {
        enabled: true,
        timeZone: "America/Bahia",
        sendChannels: { whatsapp: true },
        whatsappDaysBefore: 1,
        whatsappSendHour: 9,
        smsTemplate: "Oi {{NOME}}! Lembrete: seu feedback/treino está chegando ({{DATA}}). Envie no app: {{LINK}}",
        smsTemplateFeedback1: "",
        smsTemplateFeedback2: "",
        smsTemplateTraining1: "",
        smsTemplateTraining2: "",
        emailSubjectFeedback: "Lembrete: seu feedback é {{DATA}} 💪",
        emailSubjectTraining: "Lembrete: feedback de treino dia {{DATA}} 🏋️",
    };
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
        if (!testOptions.whatsapp && !testOptions.email) return alert("Selecione pelo menos um canal de envio.");

        setLoading(true);

        try {
            const dataTeste = "20/01/2026";

            // --- WHATSAPP ---
            if (testOptions.whatsapp) {
                let cleanPhone = testPhoneInput.replace(/\D/g, '');
                if (cleanPhone.length >= 10 && cleanPhone.length <= 11) cleanPhone = '55' + cleanPhone;

                if (cleanPhone.length < 12) throw new Error(`Número inválido (${cleanPhone}). Use DDI+DDD+NUMERO (Ex: 557399998888)`);
                if (!megaApiConfig.host || !megaApiConfig.instanceKey || !megaApiConfig.token) throw new Error("Preencha os dados da MegaAPI na aba de Configuração.");

                let cleanHost = megaApiConfig.host.trim();
                if (!cleanHost.startsWith('http')) cleanHost = `https://${cleanHost}`;
                cleanHost = cleanHost.replace(/\/$/, "");

                const safeLink = String(reminderSettings.link || "https://shapefy.app").replace(/^"+|"+$/g, "");
                // Var 1 é HTML do RichTextEditor → converte para WhatsApp plain text
                const rawTemplate = reminderSettings.smsTemplate || "";
                const msgWhatsapp = htmlToWhatsApp(rawTemplate)
                    .replaceAll("{{NOME}}", "Teste Admin")
                    .replaceAll("{{DATA}}", dataTeste)
                    .replaceAll("{{DIA_SEMANA}}", "Terça-feira")
                    .replaceAll("{{LINK}}", safeLink);

                const alvos = [`${cleanPhone}@s.whatsapp.net`];
                if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
                    const ddd = cleanPhone.substring(2, 4);
                    const resto = cleanPhone.substring(5);
                    alvos.push(`55${ddd}${resto}@s.whatsapp.net`);
                }

                for (const alvo of alvos) {
                    fetch(`${cleanHost}/rest/sendMessage/${megaApiConfig.instanceKey}/text`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${megaApiConfig.token}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ messageData: { to: alvo, text: msgWhatsapp } })
                    })
                        .then(r => r.json())
                        .then(d => console.log(`Tentativa para ${alvo}:`, d))
                        .catch(e => console.error(`Erro para ${alvo}:`, e));
                }

                await new Promise(r => setTimeout(r, 500));
            }

            // --- EMAIL ---
            if (testOptions.email) {
                const destino = testEmailInput.trim();
                if (!destino || !destino.includes('@')) throw new Error("Informe um e-mail válido para o teste.");

                const safeLink = String(reminderSettings.link || "https://shapefy.app").replace(/^"+|"+$/g, "");

                // Var 1 é HTML (RichTextEditor), Var 2 é texto simples
                const isTraining = testTemplateType.startsWith('training');
                const isVar1 = testTemplateType.endsWith('1');
                const rawHtml = isTraining
                    ? (isVar1 ? reminderSettings.smsTemplateTraining1 : reminderSettings.smsTemplateTraining2)
                    : (isVar1 ? reminderSettings.smsTemplateFeedback1 : reminderSettings.smsTemplateFeedback2);

                // Para e-mail: usa HTML diretamente (variação 1) ou converte texto em <p> (variação 2)
                const conteudo_dinamico = (isVar1
                    ? (rawHtml || "")
                    : (rawHtml || "").split('\n').map(l => l.trim() ? `<p>${l}</p>` : '<br/>').join('')
                )
                    .replaceAll("{{NOME}}", "Teste Admin")
                    .replaceAll("{{DATA}}", dataTeste)
                    .replaceAll("{{DIA_SEMANA}}", "Terça-feira")
                    .replaceAll("{{LINK}}", `<a href="${safeLink}">${safeLink}</a>`);

                const subjectTemplate = isTraining
                    ? (reminderSettings.emailSubjectTraining || "Lembrete: feedback de treino dia {{DATA}} 🏋️")
                    : (reminderSettings.emailSubjectFeedback || "Lembrete: seu feedback é {{DATA}} 💪");
                const subject = subjectTemplate.replaceAll("{{DATA}}", dataTeste).replaceAll("{{NOME}}", "Teste Admin");

                await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                    subject,
                    conteudo_dinamico,
                    email_destino: destino,
                    nome_instrutor: "Consultoria AR Team",
                    email: destino,
                }, EMAILJS_PUBLIC_KEY);
            }

            alert(`✅ Teste enviado com sucesso!`);
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

    const handleDisconnectWhatsApp = async () => {
        if (!window.confirm("Deseja desconectar o WhatsApp desta instância?")) return;

        if (!megaApiConfig.host || !megaApiConfig.instanceKey || !megaApiConfig.token) {
            return alert("Dados da MegaAPI incompletos.");
        }

        setLoading(true);
        try {
            let cleanHost = megaApiConfig.host.trim();
            if (!cleanHost.startsWith('http')) cleanHost = `https://${cleanHost}`;
            cleanHost = cleanHost.replace(/\/$/, "");

            const response = await fetch(`${cleanHost}/rest/instance/logout/${megaApiConfig.instanceKey}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${megaApiConfig.token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json().catch(() => ({}));
            console.log("Logout MegaAPI:", data);

            setMegaApiConfig(prev => ({ ...prev, connectionStatus: 'disconnected', qrCodeBase64: '' }));
            alert("✅ WhatsApp desconectado com sucesso.");
        } catch (error) {
            console.error("Erro ao desconectar:", error);
            alert("Erro ao desconectar: " + error.message);
        } finally {
            setLoading(false);
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
                                    {/* WhatsApp — config principal */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="text-xs font-black text-ebony-muted">
                                            Status
                                            <div className="mt-2 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={!!reminderSettings.enabled}
                                                    onChange={(e) =>
                                                        setReminderSettings((p) => ({ ...p, enabled: e.target.checked }))
                                                    }
                                                />
                                                <span className="text-white font-bold">Automação ativa</span>
                                            </div>
                                        </div>

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
                                        Link do App ({'{{LINK}}'})
                                        <input
                                            value={reminderSettings.link || ""}
                                            onChange={(e) => setReminderSettings((p) => ({ ...p, link: e.target.value }))}
                                            className="mt-2 w-full bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 px-3 py-2 text-sm outline-none"
                                        />
                                    </label>

                                    {/* Variáveis disponíveis */}
                                    <div className="text-[11px] text-ebony-muted bg-ebony-deep/40 px-3 py-2 rounded-lg border border-ebony-border">
                                        Variáveis: {['{{NOME}}','{{DATA}}','{{DIA_SEMANA}}','{{LINK}}'].map(v => (
                                            <span key={v} className="font-black text-white mx-1 cursor-pointer hover:text-ebony-primary" onClick={() => navigator.clipboard.writeText(v)} title="Copiar">{v}</span>
                                        ))}
                                        <span className="ml-2 text-ebony-muted/50">· clique para copiar</span>
                                    </div>

                                    {/* ========== GRID DE TEMPLATES ========== */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                                        {/* ---- FEEDBACK NORMAL ---- */}
                                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl overflow-hidden">
                                            {/* Header do card */}
                                            <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border-b border-blue-500/20">
                                                <span className="text-xl">📊</span>
                                                <div className="flex-1">
                                                    <h4 className="text-xs font-black text-blue-400 uppercase">Feedback Normal</h4>
                                                    <p className="text-[10px] text-ebony-muted">Avaliação geral · WhatsApp + E-mail</p>
                                                </div>
                                            </div>

                                            <div className="p-4 space-y-4">
                                                {/* Assunto e-mail */}
                                                <div>
                                                    <label className="text-[10px] font-black text-ebony-muted uppercase flex items-center gap-1 mb-1">
                                                        <Mail className="w-3 h-3" /> Assunto do E-mail
                                                    </label>
                                                    <input
                                                        value={reminderSettings.emailSubjectFeedback || "Lembrete: seu feedback é {{DATA}} 💪"}
                                                        onChange={(e) => setReminderSettings((p) => ({ ...p, emailSubjectFeedback: e.target.value }))}
                                                        className="w-full bg-ebony-deep border border-ebony-border text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                                                    />
                                                </div>

                                                {/* Variação 1 — RichTextEditor */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                                                        <span className="text-xs font-black text-white">Variação Principal</span>
                                                        <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">WhatsApp + E-mail</span>
                                                    </div>
                                                    <div className="rounded-xl overflow-hidden border border-blue-500/30 bg-ebony-deep min-h-[180px]">
                                                        <Suspense fallback={<div className="flex items-center justify-center h-32 text-gray-400 text-xs gap-2"><Loader className="w-4 h-4 animate-spin" /> Carregando editor...</div>}>
                                                            <RichTextEditor
                                                                value={reminderSettings.smsTemplateFeedback1 || ""}
                                                                onChange={(html) => setReminderSettings(p => ({ ...p, smsTemplateFeedback1: html }))}
                                                            />
                                                        </Suspense>
                                                    </div>
                                                </div>

                                                {/* Variação 2 — simples */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="w-5 h-5 rounded-full bg-ebony-border text-white text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                                                        <span className="text-xs font-black text-ebony-muted">Variação Alternativa</span>
                                                        <span className="text-[10px] text-ebony-muted bg-ebony-deep border border-ebony-border px-2 py-0.5 rounded-full">Só WhatsApp</span>
                                                    </div>
                                                    <textarea
                                                        rows={3}
                                                        value={reminderSettings.smsTemplateFeedback2 || ""}
                                                        onChange={(e) => setReminderSettings((p) => ({ ...p, smsTemplateFeedback2: e.target.value }))}
                                                        placeholder="Ex: E aí {{NOME}}! Não esquece: feedback {{DATA}}. Acesse: {{LINK}}"
                                                        className="w-full bg-ebony-deep border border-ebony-border text-white rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-blue-500 placeholder-gray-600"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* ---- FEEDBACK DE TREINO ---- */}
                                        <div className="bg-green-500/5 border border-green-500/20 rounded-xl overflow-hidden">
                                            {/* Header do card */}
                                            <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border-b border-green-500/20">
                                                <span className="text-xl">💪</span>
                                                <div className="flex-1">
                                                    <h4 className="text-xs font-black text-green-400 uppercase">Feedback de Treino</h4>
                                                    <p className="text-[10px] text-ebony-muted">Troca de ficha · WhatsApp + E-mail</p>
                                                </div>
                                            </div>

                                            <div className="p-4 space-y-4">
                                                {/* Assunto e-mail */}
                                                <div>
                                                    <label className="text-[10px] font-black text-ebony-muted uppercase flex items-center gap-1 mb-1">
                                                        <Mail className="w-3 h-3" /> Assunto do E-mail
                                                    </label>
                                                    <input
                                                        value={reminderSettings.emailSubjectTraining || "Lembrete: feedback de treino dia {{DATA}} 🏋️"}
                                                        onChange={(e) => setReminderSettings((p) => ({ ...p, emailSubjectTraining: e.target.value }))}
                                                        className="w-full bg-ebony-deep border border-ebony-border text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500"
                                                    />
                                                </div>

                                                {/* Variação 1 — RichTextEditor */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                                                        <span className="text-xs font-black text-white">Variação Principal</span>
                                                        <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">WhatsApp + E-mail</span>
                                                    </div>
                                                    <div className="rounded-xl overflow-hidden border border-green-500/30 bg-ebony-deep min-h-[180px]">
                                                        <Suspense fallback={<div className="flex items-center justify-center h-32 text-gray-400 text-xs gap-2"><Loader className="w-4 h-4 animate-spin" /> Carregando editor...</div>}>
                                                            <RichTextEditor
                                                                value={reminderSettings.smsTemplateTraining1 || ""}
                                                                onChange={(html) => setReminderSettings(p => ({ ...p, smsTemplateTraining1: html }))}
                                                            />
                                                        </Suspense>
                                                    </div>
                                                </div>

                                                {/* Variação 2 — simples */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="w-5 h-5 rounded-full bg-ebony-border text-white text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                                                        <span className="text-xs font-black text-ebony-muted">Variação Alternativa</span>
                                                        <span className="text-[10px] text-ebony-muted bg-ebony-deep border border-ebony-border px-2 py-0.5 rounded-full">Só WhatsApp</span>
                                                    </div>
                                                    <textarea
                                                        rows={3}
                                                        value={reminderSettings.smsTemplateTraining2 || ""}
                                                        onChange={(e) => setReminderSettings((p) => ({ ...p, smsTemplateTraining2: e.target.value }))}
                                                        placeholder="Ex: Olá {{NOME}}! Treino novo chegando {{DATA}}. Veja: {{LINK}}"
                                                        className="w-full bg-ebony-deep border border-ebony-border text-white rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-green-500 placeholder-gray-600"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                    </div>

                                    {/* Nota explicativa */}
                                    <div className="flex items-start gap-2 text-[11px] text-yellow-800 bg-yellow-400/15 border border-yellow-400/40 rounded-lg px-3 py-2.5">
                                        <span className="shrink-0 mt-0.5 text-yellow-400">💡</span>
                                        <span>
                                            <strong className="text-yellow-300">Por que ter duas variações?</strong>{" "}
                                            <span className="text-yellow-200/80">O WhatsApp pode bloquear ou limitar contas que enviam mensagens idênticas em massa. Ter uma variação alternativa reduz o risco e mantém sua conta protegida.</span>
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

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

                            {/* ÁREA DO QR CODE / STATUS */}
                            <div className="mt-6 rounded-xl overflow-hidden">
                                {megaApiConfig.connectionStatus === 'connected' ? (
                                    <div className="flex flex-col items-center justify-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-8 min-h-[200px] animate-in fade-in">
                                        <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                                            <Smartphone className="w-8 h-8 text-green-400" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-green-400 font-black text-base">WhatsApp Conectado</p>
                                            <p className="text-xs text-ebony-muted mt-1">Instância ativa e pronta para envios</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center bg-white rounded-xl p-4 min-h-[250px] shadow-inner">
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
                                )}
                            </div>

                            <div className="pt-2 flex gap-2">
                                {megaApiConfig.connectionStatus === 'connected' ? (
                                    <button
                                        onClick={handleDisconnectWhatsApp}
                                        disabled={loading}
                                        className="flex-1 px-4 py-3 bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-400 font-bold rounded-lg text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? "Desconectando..." : "Desconectar WhatsApp"}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleGenerateQRCode}
                                        disabled={loading}
                                        className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? "Conectando..." : "Gerar QR Code"}
                                    </button>
                                )}

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
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer bg-ebony-deep p-2 rounded-lg border border-ebony-border flex-1">
                                        <input
                                            type="checkbox"
                                            checked={testOptions.whatsapp}
                                            onChange={e => setTestOptions(p => ({ ...p, whatsapp: e.target.checked }))}
                                            className="accent-green-500"
                                        />
                                        <span className="text-sm text-white font-bold">WhatsApp</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-ebony-deep p-2 rounded-lg border border-ebony-border flex-1">
                                        <input
                                            type="checkbox"
                                            checked={testOptions.email}
                                            onChange={e => setTestOptions(p => ({ ...p, email: e.target.checked }))}
                                            className="accent-blue-500"
                                        />
                                        <span className="text-sm text-white font-bold">E-mail</span>
                                    </label>
                                </div>
                            </div>

                            {testOptions.whatsapp && (
                                <div>
                                    <label className="text-xs font-bold text-ebony-muted uppercase mb-1 block">
                                        Número (DDD + Número)
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="Ex: 73999998888"
                                        className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white text-lg font-mono outline-none focus:border-green-500 transition-colors"
                                        value={testPhoneInput}
                                        onChange={(e) => setTestPhoneInput(e.target.value)}
                                        autoFocus
                                    />
                                    <p className="text-[10px] text-ebony-muted mt-1">O código 55 será adicionado automaticamente.</p>
                                </div>
                            )}

                            {testOptions.email && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-ebony-muted uppercase mb-1 block">
                                            Template a testar
                                        </label>
                                        <select
                                            value={testTemplateType}
                                            onChange={e => setTestTemplateType(e.target.value)}
                                            className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white text-sm outline-none focus:border-blue-500"
                                        >
                                            <option value="feedback1">📊 Feedback Normal — Variação 1</option>
                                            <option value="feedback2">📊 Feedback Normal — Variação 2</option>
                                            <option value="training1">💪 Feedback de Treino — Variação 1</option>
                                            <option value="training2">💪 Feedback de Treino — Variação 2</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-ebony-muted uppercase mb-1 block">
                                            E-mail de Destino
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="Ex: teste@email.com"
                                            className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white text-sm outline-none focus:border-blue-500 transition-colors"
                                            value={testEmailInput}
                                            onChange={(e) => setTestEmailInput(e.target.value)}
                                        />
                                    </div>
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
                                disabled={loading}
                                className="flex-1 py-2 bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg transition disabled:opacity-50"
                            >
                                {loading ? "Enviando..." : "Enviar Agora"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunicationModule;