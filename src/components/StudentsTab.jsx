import React, { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import {
    HelpCircle, Users, FileText, Plus, Search, FileSignature,
    CheckCircle, Loader, Share2, MoreVertical, Wallet, History, User, Trash2, Settings
} from 'lucide-react';
import { db } from '../firebase';
import { logContractEvent } from '../utils/utils';
import StudentNameWithBadge from "./StudentNameWithBadge";
import * as XLSX from 'xlsx';

const StudentsTab = ({    
    plans,
    onReloadData,
    onToggleDelivery,
    onOpenStudent,
    onOpenHistory,
    onOpenFinancial,
    onSmartPDF,
    onDeleteStudent,
    copyStudentLink,
    studentsById,
    onNewStudent,
}) => {

    const [filterStatus, setFilterStatus] = useState('all');
    const [filterMonth, setFilterMonth] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPlan, setFilterPlan] = useState('all');
    const [students, setStudents] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const { getFunctions, httpsCallable } = await import('firebase/functions');
                const fns = getFunctions();
                const listarAlunos = httpsCallable(fns, 'listarAlunos');
                const result = await listarAlunos({ limit: 500 });
                const frappeList = result.data?.list || [];

                // Busca dados de contrato do Firebase para cada aluno
                const { getDocs, collection } = await import('firebase/firestore');
                const { db } = await import('../firebase');
                const snap = await getDocs(collection(db, 'students'));
                const firebaseMap = {};
                snap.docs.forEach(d => { firebaseMap[d.id] = d.data(); });

                const merged = frappeList.map(a => ({
                    id: a.name,
                    name: a.nome_completo,
                    email: a.email,
                    phone: a.telefone,
                    // dados de contrato do Firebase
                    status: firebaseMap[a.name]?.status || 'student_only',
                    planId: firebaseMap[a.name]?.planId || null,
                    planName: firebaseMap[a.name]?.planName || null,
                    planColor: firebaseMap[a.name]?.planColor || null,
                    createdAt: firebaseMap[a.name]?.createdAt || null,
                    latestContractId: firebaseMap[a.name]?.latestContractId || null,
                    linkedStudentIds: firebaseMap[a.name]?.linkedStudentIds || [],
                    materialDelivered: false, // removido do Alesson
                }));

                setStudents(merged);
            } catch(e) {
                console.error("Erro ao carregar alunos:", e);
            }
        })();
    }, []);
    // 1. Estados da Paginação
    const [visibleCount, setVisibleCount] = useState(20);
    const [actionsMenuOpenId, setActionsMenuOpenId] = useState(null);
    // --- CORREÇÃO DO FILTRO FINANCEIRO ---
    const [financialPlans, setFinancialPlans] = useState([]); // Lista correta para o filtro
    const [loadingFinPlans, setLoadingFinPlans] = useState(false);

    // Paleta de Cores (Estática)
    const PLAN_COLORS = {
        slate: 'bg-slate-100 text-slate-800 border-slate-200',
        red: 'bg-red-100 text-red-800 border-red-200',
        rose: 'bg-rose-100 text-rose-800 border-rose-200',
        orange: 'bg-orange-100 text-orange-800 border-orange-200',
        amber: 'bg-amber-100 text-amber-800 border-amber-200',
        yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        lime: 'bg-lime-100 text-lime-800 border-lime-200',
        green: 'bg-green-100 text-green-800 border-green-200',
        emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        teal: 'bg-teal-100 text-teal-800 border-teal-200',
        cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        sky: 'bg-sky-100 text-sky-800 border-sky-200',
        blue: 'bg-blue-100 text-blue-800 border-blue-200',
        indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        violet: 'bg-violet-100 text-violet-800 border-violet-200',
        purple: 'bg-purple-100 text-purple-800 border-purple-200',
        fuchsia: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
        pink: 'bg-pink-100 text-pink-800 border-pink-200'
    };

    // 2. Lógica OTIMIZADA (Processa apenas uma vez)
    const { displayedStudents, totalFilteredCount } = useMemo(() => {
        // A. Filtra primeiro (Mais leve)
        const filtered = students.filter(student => {
            if (searchTerm && !student.name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            if (filterMonth && !student.createdAt?.startsWith(filterMonth)) return false;

            // Filtro de Plano (Financeiro)
            if (filterPlan !== 'all') {
                if (filterPlan === 'no_plan') { if (student.planId) return false; }
                else { if (student.planId !== filterPlan) return false; }
            }

            // Filtro de Status
            if (filterStatus !== 'all') {
                if (filterStatus === 'pending') return !student.materialDelivered;
                if (filterStatus === 'delivered') return student.materialDelivered;
                if (filterStatus === 'em_analise') return student.status === 'em_analise';
                if (filterStatus === 'no_contract') return student.status === 'student_only';
                if (filterStatus === 'waiting_sign') return student.status === 'waiting_sign';
                if (filterStatus === 'signed') return student.status === 'signed';
            }
            return true;
        });

        // B. Ordena por data de entrada (mais recente primeiro)
        filtered.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });

        // C. Retorna os dados fatiados (Paginação) e o total real
        return {
            displayedStudents: filtered.slice(0, visibleCount),
            totalFilteredCount: filtered.length
        };
    }, [students, searchTerm, filterMonth, filterStatus, visibleCount, filterPlan]);

    useEffect(() => {
        const close = () => setActionsMenuOpenId(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, []);

    // BUSCA OS PLANOS FINANCEIROS REAIS (Para o Filtro)
    useEffect(() => {
        const fetchFinancialPlans = async () => {
            try {
                setLoadingFinPlans(true);
                // Busca na mesma coleção que o Módulo Financeiro usa
                const q = query(collection(db, "plans"), orderBy("name", "asc"));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setFinancialPlans(list);
            } catch (error) {
                console.error("Erro ao buscar planos financeiros para filtro:", error);
            } finally {
                setLoadingFinPlans(false);
            }
        };

        fetchFinancialPlans();
    }, []); // Roda apenas uma vez ao abrir o Dashboard

    const cleanPhone = (phone) => {
        let cleaned = String(phone || "").replace(/\D/g, "");
        if (cleaned.startsWith("55") && cleaned.length > 11) {
          cleaned = cleaned.substring(2);
        }
        return cleaned;
      };

    // --- FUNÇÃO DE IMPORTAÇÃO EM MASSA (EXCEL) ---
    const handleImportExcel = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const name = (file.name || "").toLowerCase();
        const isCSV = name.endsWith(".csv");

        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                let wb;

                if (isCSV) {
                    // ✅ CSV é TEXTO (melhor pra acentos)
                    const text = evt.target.result;

                    // ✅ tenta adivinhar separador (CSV BR quase sempre é ';')
                    const firstLine = String(text).split(/\r?\n/)[0] || "";
                    const semicolons = (firstLine.match(/;/g) || []).length;
                    const commas = (firstLine.match(/,/g) || []).length;
                    const FS = semicolons > commas ? ";" : ",";

                    wb = XLSX.read(text, { type: "string", FS });
                } else {
                    // ✅ Excel é binário
                    const data = evt.target.result; // ArrayBuffer
                    wb = XLSX.read(data, { type: "array" });
                }

                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                const data = XLSX.utils.sheet_to_json(ws, { defval: "" }); // defval evita undefined

                if (!data.length) {
                    alert("A planilha parece estar vazia.");
                    return;
                }

                if (!window.confirm(`Encontrei ${data.length} alunos na planilha. Deseja importar todos agora?`)) return;

                let importedCount = 0;
                const timestamp = new Date().toISOString();

                for (const row of data) {
                    const rawName = row["Nome"] || row["nome"] || "";
                    if (!rawName) continue;

                    const rawPhone = cleanPhone(row["Telefone"] || row["telefone"] || row["Celular"] || row["celular"] || "");

                    const newStudent = {
                        name: String(rawName).trim(),
                        phone: rawPhone,
                        whatsapp: rawPhone,
                        email: row["Email"] || row["email"] || "",
                        cpf: row["CPF"] || row["cpf"] || "",
                        rg: row["RG"] || row["rg"] || "",
                        profession: row["Profissao"] || row["profissao"] || "",
                        address: row["Endereco"] || row["endereco"] || "",
                        birthDate: row["Nascimento"] || row["nascimento"] || "",

                        createdAt: timestamp,
                        status: "student_only",
                        planId: null,
                        planName: null,
                        planColor: null,
                        templateId: null,
                        materialDelivered: false,
                    };

                    await addDoc(collection(db, "students"), newStudent);
                    importedCount++;
                }

                alert(`Sucesso! ${importedCount} alunos foram importados.`);
                if (onReloadData) onReloadData();
            } catch (error) {
                console.error("Erro na importação:", error);
                alert("Erro ao processar o arquivo. Verifique o formato.");
            } finally {
                e.target.value = null; // permite selecionar o mesmo arquivo de novo
            }
        };

        // ✅ escolhe o modo certo de leitura
        if (isCSV) reader.readAsText(file, "utf-8");
        else reader.readAsArrayBuffer(file);
    };


    // ===== ÁREA 5: JSX =====
    return (
        <div className="animate-in fade-in duration-300">

            {/* --- DASHBOARD DE MÉTRICAS (MANTIDO) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Card 1: Total */}
                <div className="bg-ebony-surface p-5 rounded-2xl border border-ebony-border shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-ebony-muted uppercase tracking-wider">Total de Alunos</p>
                            <h3 className="text-3xl font-black text-white mt-1">{students.length}</h3>
                        </div>
                        <div className="p-2 bg-ebony-deep rounded-lg text-ebony-muted border border-ebony-border">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-ebony-muted">Base total de cadastros</div>
                </div>

                {/* Card 2: Novos no Mês */}
                <div className="bg-ebony-surface p-5 rounded-2xl border border-ebony-border shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-ebony-muted uppercase tracking-wider">Novos (Mês)</p>
                            <h3 className="text-3xl font-black text-white mt-1">
                                {students.filter(s => s.createdAt && s.createdAt.startsWith(new Date().toISOString().slice(0, 7))).length}
                            </h3>
                        </div>
                        <div className="p-2 bg-ebony-deep rounded-lg text-ebony-primary border border-ebony-border">
                            <Plus className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-ebony-primary font-bold bg-ebony-deep inline-block px-2 py-1 rounded self-start border border-ebony-border">
                        Crescimento Mensal
                    </div>
                </div>

                {/* Card 3: Pendente Assinatura (Fluxo de Entrada) */}
                <div className="bg-ebony-surface p-5 rounded-2xl border border-ebony-border shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-ebony-muted uppercase tracking-wider">Falta Assinar</p>
                            <h3 className="text-3xl font-black text-white mt-1">
                                {/* ALTERAÇÃO AQUI: Soma (Em Análise) + (Aguardando Assinatura) */}
                                {students.filter(s => s.status === 'waiting_sign' || s.status === 'em_analise').length}
                            </h3>
                        </div>
                        <div className="p-2 bg-ebony-deep rounded-lg text-ebony-muted border border-ebony-border">
                            <FileSignature className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-ebony-muted">Novos (Link) + Minutas Geradas</div>
                </div>

                {/* Card 4: Pendente Entrega (Material) */}
                <div className="bg-ebony-surface p-5 rounded-2xl border border-ebony-border shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-ebony-muted uppercase tracking-wider">Falta Entregar</p>
                            <h3 className="text-3xl font-black text-white mt-1">
                                {students.filter(s => !s.materialDelivered).length}
                            </h3>
                        </div>
                        <div className="p-2 bg-ebony-deep rounded-lg text-ebony-muted border border-ebony-border">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-ebony-muted">Alunos sem material</div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">

                {/* 1. Busca por Nome (NOVO) */}
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-ebony-muted/70" />
                    <input
                        type="text"
                        placeholder="Buscar aluno..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 p-2 w-40 text-sm bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                    />
                </div>

                {/* 2. Filtro Data */}
                <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="p-2 text-sm bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600"
                    title="Filtrar por mês de entrada"
                />

                {/* 4. Filtro de Plano (AGORA CONECTADO AO FINANCEIRO REAL) */}
                <select
                    value={filterPlan}
                    onChange={(e) => setFilterPlan(e.target.value)}
                    className="p-2 text-sm bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 font-medium max-w-[150px]"
                >
                    <option value="all">Todos os Planos</option>

                    {/* AQUI ESTÁ A MUDANÇA: Usamos financialPlans ao invés de plans */}
                    {financialPlans.map(fPlan => (
                        <option key={fPlan.id} value={fPlan.id}>
                            {fPlan.name} {/* Agora vai aparecer "Mensal", "Bimestral", etc */}
                        </option>
                    ))}

                    <option value="no_plan">Sem Plano Financeiro</option>
                </select>

                {/* 3. Filtro Status (COM OPÇÃO ASSINADO) */}
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="p-2 text-sm bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm outline-none focus:border-ebony-primary placeholder-gray-600 font-medium"
                >
                    <option value="all">Todos os Alunos</option>

                    <optgroup label="Status do Contrato">
                        <option value="em_analise">📋 Analisar Cadastro</option>
                        <option value="no_contract">🆕 Sem Contrato (Cadastrados)</option>
                        <option value="waiting_sign">✍️ Aguardando Assinatura</option>
                        <option value="signed">✅ Contrato Assinado</option>
                    </optgroup>

                    <optgroup label="Status do Material">
                        <option value="pending">⏳ Material Pendente</option>
                        <option value="delivered">✅ Material Entregue</option>
                    </optgroup>
                </select>

                {/* --- BOTÃO IMPORTAR COM TOOLTIP DE INSTRUÇÕES --- */}
                <div className="relative group">
                    <label className="bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg cursor-pointer">
                        <FileText className="w-5 h-5" />
                        <span className="hidden sm:inline">Importar Excel</span>

                        {/* Ícone de Ajuda Visual */}
                        <HelpCircle className="w-4 h-4 opacity-60 ml-1" />

                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleImportExcel}
                            className="hidden"
                        />
                    </label>

                    {/* --- O TOOLTIP (Aparece ao passar o mouse) --- */}
                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-80 bg-ebony-deep/95 backdrop-blur text-white text-xs p-4 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[100] border border-ebony-border transform translate-y-2 group-hover:translate-y-0">
                        <div className="font-bold mb-2 text-ebony-primary flex items-center gap-2">
                            <HelpCircle size={14} /> Como formatar sua planilha:
                        </div>
                        <p className="mb-2 text-ebony-muted">
                            A primeira linha do Excel deve conter exatamente estes nomes de colunas:
                        </p>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-ebony-muted font-mono text-[10px]">
                            <span>• Nome <span className="text-ebony-primary">*</span></span>
                            <span>• Telefone <span className="text-ebony-primary">*</span></span>
                            <span>• Email</span>
                            <span>• CPF</span>
                            <span>• RG</span>
                            <span>• Profissao</span>
                            <span>• Endereco</span>
                            <span>• Nascimento</span>
                        </div>

                        <div className="mt-3 pt-2 border-t border-ebony-border text-[10px] text-ebony-muted italic">
                            * Campos obrigatórios para o sistema.
                        </div>

                        {/* Setinha apontando para baixo */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-ebony-deep border-r border-b border-ebony-border transform rotate-45"></div>
                    </div>
                </div>

                <button
                    onClick={() => onNewStudent()}
                    className="bg-ebony-primary hover:bg-red-900 text-white font-bold rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 transition-colors ml-auto md:ml-0"
                >
                    <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Novo Aluno</span>
                </button>
            </div>        

            {/* TABELA DE ALUNOS (MANTIDA) */}
            <div className="bg-ebony-surface rounded-xl border border-ebony-border shadow-sm overflow-hidden">
                {students.length === 0 ? (
                    // CENÁRIO A: Carregando dados do servidor (Ainda não chegou nada)
                    <div className="p-12 text-center text-ebony-muted animate-in fade-in">
                        <Loader className="w-10 h-10 mx-auto mb-3 text-ebony-primary animate-spin" />
                        <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Sincronizando Alunos...</p>
                    </div>
                ) : totalFilteredCount === 0 ? (
                    // CENÁRIO B: Filtro não encontrou nada (Mas existem alunos no banco)
                    <div className="p-12 text-center text-ebony-muted">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Nenhum aluno encontrado com estes filtros.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-visible">
                            <table className="w-full text-left">
                                <thead className="bg-ebony-deep text-ebony-muted uppercase text-xs font-bold tracking-wider border-b border-ebony-border">
                                    <tr>
                                        <th className="p-4">Data Entrada</th>
                                        <th className="p-4">Aluno</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ebony-border">
                                    {/* --- PASSO 4B: MUDAR PARA displayedStudents --- */}
                                    {displayedStudents.map((student, index) => (
                                        <tr key={student.id} className="border-b border-ebony-border hover:bg-ebony-border/30 transition-colors">
                                            <td className="p-4 text-xs text-ebony-muted font-mono">
                                                {student.createdAt ? new Date(student.createdAt).toLocaleDateString('pt-BR') : '-'}
                                            </td>

                                            <td className="p-4">
                                                <div className="flex flex-col items-start gap-1">
                                                    {/* 1. Nome e Vínculo */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onOpenStudent(student);
                                                            }}
                                                            className="text-left hover:underline text-white"
                                                            title="Abrir cadastro do aluno"
                                                        >
                                                            <StudentNameWithBadge student={student} />
                                                        </button>

                                                        {Array.isArray(student.linkedStudentIds) && student.linkedStudentIds.length > 0 && (
                                                            <span
                                                                className="inline-flex items-center gap-1 bg-status-link/15 text-status-link border border-status-link/30 text-[9px] px-2.5 py-0.5 rounded-full font-bold shadow-sm cursor-pointer hover:bg-status-link/20 hover:shadow-neon-link hover:scale-105 transition-all"
                                                                title="Clique para ver detalhes"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const names = student.linkedStudentIds
                                                                        .map(id => studentsById[id]?.name)
                                                                        .filter(Boolean)
                                                                        .join(", ");
                                                                    alert(`❤️ Vínculo (Plano Casal/Grupo) com:\n\n${names || 'Nomes não carregados'}`);
                                                                }}
                                                            >
                                                                🔗 Vínculo
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* 2. Etiqueta do Plano (AQUI ESTÁ O CÓDIGO QUE FALTAVA) */}
                                                    {(() => {
                                                        const label = student.planName;
                                                        const colorKey = student.planColor || "slate";
                                                        if (!label) return null;

                                                        return (
                                                            <div className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wide w-fit mt-0.5 ${PLAN_COLORS[colorKey] || "bg-ebony-deep text-ebony-muted border-ebony-border"}`}>
                                                                {label}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* 3. Telefone */}
                                                    <div className="text-xs text-ebony-muted">{student.phone}</div>
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                {student.status === 'signed' ? (
                                                    <span className="inline-flex items-center gap-1 bg-status-success/15 text-status-success border border-status-success/30 py-1 px-2 rounded-full text-xs font-bold shadow-sm hover:shadow-neon-success transition-all">
                                                        <CheckCircle className="w-3 h-3" /> Assinado
                                                    </span>
                                                ) : student.status === 'student_only' ? (
                                                    <button
                                                        onClick={() => onOpenStudent(student)}
                                                        className="inline-flex items-center gap-1 bg-ebony-deep/60 text-ebony-muted border border-ebony-border py-1 px-3 rounded-full text-xs font-bold shadow-sm hover:text-white hover:bg-ebony-border/30 transition-all"
                                                    >
                                                        <Plus className="w-3 h-3" /> Gerar Contrato
                                                    </button>
                                                ) : student.status === 'em_analise' ? (
                                                    <button
                                                        onClick={() => onOpenStudent(student)}
                                                        className="inline-flex items-center gap-1 bg-status-info/15 text-status-info border border-status-info/30 py-1 px-3 rounded-full text-xs font-bold shadow-sm hover:bg-status-info/20 hover:shadow-neon-info transition-all animate-pulse"
                                                    >
                                                        <FileSignature className="w-3 h-3" /> Analisar Cadastro
                                                    </button>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-status-warning/15 text-status-warning border border-status-warning/30 py-1 px-2 rounded-full text-xs font-bold shadow-sm hover:shadow-neon-warning transition-all">
                                                        <Loader className="w-3 h-3" /> Aguardando Assinatura
                                                    </span>
                                                )}
                                            </td>


                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2 items-center relative">

                                                    {/* Material (mantido) */}
                                                    <button
                                                        onClick={() => onToggleDelivery(student)}
                                                        className={`group flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-all ${student.materialDelivered
                                                            ? 'bg-status-success/15 text-status-success border-status-success/30 shadow-sm hover:bg-status-success/20 hover:shadow-neon-success'
                                                            : 'bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-deep'
                                                            }`}
                                                        title={student.materialDelivered ? "Material já entregue" : "Marcar como entregue"}
                                                    >
                                                        {student.materialDelivered ? <CheckCircle className="w-4 h-4 fill-current" /> : <CheckCircle className="w-4 h-4" />}
                                                        <span className="text-[10px] font-bold uppercase hidden xl:inline">
                                                            {student.materialDelivered ? "Entregue" : "Pendente"}
                                                        </span>
                                                    </button>

                                                    {/* Menu ⋯ */}
                                                    <div className="relative">
                                                        <button
                                                            data-menu-id={student.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActionsMenuOpenId(prev => (prev === student.id ? null : student.id));
                                                            }}
                                                            className="p-2 border border-ebony-border rounded-lg text-ebony-muted hover:bg-ebony-deep transition-colors shadow-sm"
                                                            title="Mais ações"
                                                        >
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>

                                                        {actionsMenuOpenId === student.id && (() => {
                                                            const btn = document.querySelector(`[data-menu-id="${student.id}"]`);
                                                            const rect = btn?.getBoundingClientRect() || { bottom: 0, top: 0, right: 0 };
                                                            const menuHeight = 320;
                                                            const spaceBelow = window.innerHeight - rect.bottom;
                                                            const openUp = spaceBelow < menuHeight;

                                                            return (
                                                                <>
                                                                    <div className="fixed inset-0 z-[998]" onClick={() => setActionsMenuOpenId(null)}></div>
                                                                    <div
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="fixed w-56 bg-ebony-surface border border-ebony-border rounded-xl shadow-2xl z-[999] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                                                                        style={{
                                                                            top: openUp ? 'auto' : rect.bottom + 8,
                                                                            bottom: openUp ? (window.innerHeight - rect.top + 8) : 'auto',
                                                                            right: window.innerWidth - rect.right
                                                                        }}
                                                                    >
                                                                        {/* Abrir Perfil */}
                                                                        <button
                                                                            onClick={() => {
                                                                                onOpenStudent(student);
                                                                                setActionsMenuOpenId(null);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-sm hover:bg-ebony-border/30 flex items-center gap-2 text-left text-white"
                                                                        >
                                                                            <User className="w-4 h-4 text-ebony-muted" />
                                                                            Abrir perfil do aluno
                                                                        </button>

                                                                        {/* Contrato / Renovação */}
                                                                        <button
                                                                            onClick={() => {
                                                                                onOpenStudent(student);
                                                                                setActionsMenuOpenId(null);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-sm hover:bg-ebony-border/30 flex items-center gap-2 text-left text-white"
                                                                        >
                                                                            <FileSignature className="w-4 h-4 text-ebony-muted" />
                                                                            {student.status === 'student_only' ? 'Gerar contrato' : 'Novo contrato / renovação'}
                                                                        </button>

                                                                        {/* Histórico */}
                                                                        <button
                                                                            onClick={() => {
                                                                                onOpenHistory(student);
                                                                                setActionsMenuOpenId(null);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-sm hover:bg-ebony-border/30 flex items-center gap-2 text-left text-white"
                                                                        >
                                                                            <History className="w-4 h-4 text-ebony-muted" />
                                                                            Ver histórico de contratos
                                                                        </button>

                                                                        {/* Financeiro Rápido */}
                                                                        <button
                                                                            onClick={() => {
                                                                                onOpenFinancial(student);
                                                                                setActionsMenuOpenId(null);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-sm hover:bg-ebony-border/30 flex items-center gap-2 text-left text-white"
                                                                        >
                                                                            <Wallet className="w-4 h-4 text-ebony-muted" />
                                                                            Financeiro rápido
                                                                        </button>

                                                                        {/* Copiar link */}
                                                                        <button
                                                                            onClick={() => {
                                                                                copyStudentLink(student.id);
                                                                                logContractEvent(db, student.id, "LINK_GERADO", "Link copiado via menu ⋯");
                                                                                setActionsMenuOpenId(null);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-sm hover:bg-ebony-border/30 flex items-center gap-2 text-left text-white"
                                                                        >
                                                                            <Share2 className="w-4 h-4 text-ebony-muted" />
                                                                            Compartilhar link
                                                                        </button>

                                                                        {/* PDF (só se assinado) */}
                                                                        {student.status === 'signed' && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    onSmartPDF(student);
                                                                                    setActionsMenuOpenId(null);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-sm hover:bg-ebony-border/30 flex items-center gap-2 text-left text-white"
                                                                            >
                                                                                <FileText className="w-4 h-4 text-ebony-muted" />
                                                                                Baixar PDF oficial
                                                                            </button>
                                                                        )}

                                                                        <div className="h-px bg-ebony-border my-1"></div>

                                                                        {/* Excluir */}
                                                                        <button
                                                                            onClick={() => {
                                                                                onDeleteStudent(student.id);
                                                                                setActionsMenuOpenId(null);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-sm text-red-400 hover:bg-ebony-deep flex items-center gap-2 text-left"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                            Excluir aluno (Tudo)
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* --- PASSO 4C: BOTÃO CARREGAR MAIS --- */}
                        {totalFilteredCount > visibleCount && (
                            <div className="p-4 border-t border-ebony-border text-center bg-ebony-deep">
                                <button
                                    onClick={() => setVisibleCount(prev => prev + 20)}
                                    className="text-xs font-bold text-ebony-muted hover:text-white uppercase tracking-wider px-4 py-2 border border-ebony-border rounded-full hover:bg-ebony-surface transition-all"
                                >
                                    Carregar mais alunos ({totalFilteredCount - visibleCount} restantes)
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

        </div>
    );
};

export default StudentsTab;