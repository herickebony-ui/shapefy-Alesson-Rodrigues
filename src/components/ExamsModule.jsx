import React, { useState, useEffect } from 'react';
import {
  doc, getDoc, setDoc,
  collection, addDoc, getDocs, deleteDoc, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase'; // Import do seu banco
import { jsPDF } from "jspdf";
import StudentNameWithBadge from "./StudentNameWithBadge";
import {
  FileText, User, Calendar, Download, Trash2,
  Settings, Upload, Image as ImageIcon, Plus,
  CheckSquare, Square, PenTool, Activity,
  Apple, Zap, Heart, AlertTriangle, X, Save
} from 'lucide-react';

// Banco de Dados Inicial de Exames
const INITIAL_EXAMS_DB = [
  {
    category: "Avaliação Nutricional",
    icon: "Apple",
    items: [
      { name: "Vitamina B12", highlight: true },
      { name: "Homocisteína", highlight: true },
      { name: "25-hidroxi-vitamina D3", highlight: true },
      { name: "Ferritina", highlight: true },
      { name: "Vitamina C", highlight: true },
      { name: "Ácido fólico", highlight: false },
      { name: "Magnésio sérico", highlight: false },
      { name: "Cálcio iônico", highlight: false },
      { name: "PTH intacto", highlight: false },
      { name: "Zinco (sangue)", highlight: false },
      { name: "Vitamina A (Retinol)", highlight: false },
      { name: "Vitamina E", highlight: false },
      { name: "Vitamina K", highlight: false },
      { name: "Ferro", highlight: false },
      { name: "Transferrina", highlight: false }
    ]
  },
  {
    category: "Avaliação Metabólica",
    icon: "Zap",
    items: [
      { name: "Hemograma", highlight: true },
      { name: "Glicemia", highlight: true },
      { name: "Hemoglobina glicada", highlight: true },
      { name: "TSH", highlight: true },
      { name: "Estradiol (e2)", highlight: true },
      { name: "Testosterona total e frações", highlight: true },
      { name: "Gama GT", highlight: true },
      { name: "TGO", highlight: true },
      { name: "TGP", highlight: true },
      { name: "Creatinina", highlight: true },
      { name: "Insulina", highlight: false },
      { name: "T4 Livre", highlight: false },
      { name: "T3 Livre", highlight: false },
      { name: "T3 Reverso", highlight: false },
      { name: "Cortisol", highlight: false },
      { name: "Cortisol salivar (3 amostras)", highlight: false },
      { name: "S-DHEA", highlight: false },
      { name: "ACTH", highlight: false },
      { name: "Progesterona", highlight: false },
      { name: "Di-hidrotestosterona (DHT)", highlight: false },
      { name: "Ácido úrico", highlight: false }
    ]
  },
  {
    category: "Avaliação Cardiovascular",
    icon: "Heart",
    items: [
      { name: "Colesterol total", highlight: true },
      { name: "Colesterol HDL", highlight: true },
      { name: "Colesterol LDL", highlight: true },
      { name: "Triglicerídeos", highlight: true },
      { name: "Fibrinogênio", highlight: false },
      { name: "Apolipoproteína A1", highlight: false },
      { name: "Apolipoproteína B", highlight: false },
      { name: "PCR Ultrassensível", highlight: false }
    ]
  },
  {
    category: "Avaliação Tóxica",
    icon: "AlertTriangle",
    items: [
      { name: "Alumínio", highlight: false },
      { name: "Chumbo", highlight: false },
      { name: "Mercúrio", highlight: false },
      { name: "Arsênico", highlight: false }
    ]
  }
];

const ExamsModule = ({ students = [] }) => {
  // --- ESTADOS GERAIS ---
  const [patientName, setPatientName] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Carrega configurações
        const docRef = doc(db, "settings", "professional_profile");
        const docSnap = await getDoc(docRef);
  
        if (docSnap.exists()) {
          setConfig(docSnap.data());
        } else {
          const local = JSON.parse(localStorage.getItem('shapefy_config'));
          if (local) setConfig(local);
        }
  
        // Carrega templates salvos
        const templates = JSON.parse(localStorage.getItem('shapefy_exam_templates') || '[]');
        setSavedTemplates(templates);
  
        // Carrega exames do Firebase
        await loadExamsFromFirebase();
  
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };
  
    loadData();
  }, []);

  // --- ESTADO DOS EXAMES ---
  const [examCategories, setExamCategories] = useState(
    INITIAL_EXAMS_DB.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({ ...item, checked: false }))
    }))
  );
  const [otherExams, setOtherExams] = useState('');

  // --- CONFIGURAÇÕES ---
  const [config, setConfig] = useState({
    name: '', title: '', phone: '', email: '', address: '',
    logo: null, logoRatio: 1,
    signature: null, signatureRatio: 0.5,
    signatureScale: 1.0, signatureOffsetX: 0, signatureOffsetY: 0
  });

  // --- CARREGAR CONFIG DO FIREBASE ---
  useEffect(() => {
    const loadConfigFromDb = async () => {
      try {
        // Tenta buscar do Firebase primeiro
        const docRef = doc(db, "settings", "professional_profile");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setConfig(docSnap.data());
        } else {
          // Se não tiver no Firebase, tenta LocalStorage como backup
          const local = JSON.parse(localStorage.getItem('shapefy_config'));
          if (local) setConfig(local);
        }
      } catch (error) {
        console.error("Erro ao carregar config:", error);
      }
    };
    loadConfigFromDb();
  }, []);

  // --- SALVAR CONFIG NO FIREBASE ---
  const handleSaveProfile = async () => {
    setSavingConfig(true);
    try {
      // Salva no Firestore (Coleção settings -> Documento professional_profile)
      await setDoc(doc(db, "settings", "professional_profile"), config);

      // Atualiza também o LocalStorage para manter sincronia rápida
      localStorage.setItem('shapefy_config', JSON.stringify(config));

      alert("Perfil profissional salvo na nuvem com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // Atualiza o estado local enquanto digita (sem salvar no banco ainda)
  const updateConfigLocal = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // --- MANIPULAÇÃO DE EXAMES ---
  const toggleExam = (catIndex, itemIndex) => {
    const newCats = [...examCategories];
    newCats[catIndex].items[itemIndex].checked = !newCats[catIndex].items[itemIndex].checked;
    setExamCategories(newCats);
  };

  const addNewExam = async (catIndex) => {
    const name = prompt("Nome do novo exame:");
    if (name) {
      const newCats = [...examCategories];
      newCats[catIndex].items.push({ name, highlight: false, checked: true });
      setExamCategories(newCats);

      // Salva no Firebase
      await saveExamsToFirebase(newCats);
    }
  };

  // --- ATUALIZAR NOME DO EXAME (COM FIREBASE) ---
  const updateExamName = async (catIndex, itemIndex, newName) => {
    const newCats = [...examCategories];
    newCats[catIndex].items[itemIndex].name = newName;
    setExamCategories(newCats);

    // Salva no Firebase automaticamente após 1 segundo de pausa na digitação
    clearTimeout(window.updateExamTimeout);
    window.updateExamTimeout = setTimeout(async () => {
      await saveExamsToFirebase(newCats);
    }, 1000);
  };

  // --- REMOVER EXAME (COM FIREBASE) ---
  const removeExam = async (catIndex, itemIndex) => {
    if (window.confirm("Tem certeza que deseja remover este exame da lista?")) {
      const newCats = [...examCategories];
      newCats[catIndex].items.splice(itemIndex, 1);
      setExamCategories(newCats);

      // Salva no Firebase
      await saveExamsToFirebase(newCats);
    }
  };

  const clearAll = () => {
    if (window.confirm("Limpar toda a seleção?")) {
      setExamCategories(prev => prev.map(cat => ({
        ...cat,
        items: cat.items.map(i => ({ ...i, checked: false }))
      })));
      setOtherExams('');
    }
  };

  // --- UPLOAD IMAGENS COM COMPRESSÃO TURBO (CORRIGIDO) ---
  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // REDUZIMOS PARA 300PX (Suficiente para PDF e garante < 1MB)
          const MAX_WIDTH = 300;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Força qualidade média para garantir leveza
          // Se for PNG (tem fundo transparente), usa PNG. Se não, usa JPEG que é mais leve.
          const fileType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = 0.7; // 70% de qualidade

          const compressedDataUrl = canvas.toDataURL(fileType, quality);

          // Verifica tamanho final no console (para debug)
          console.log(`Tamanho original: ${event.target.result.length}, Comprimido: ${compressedDataUrl.length}`);

          const ratio = height / width;

          if (type === 'logo') {
            updateConfigLocal('logo', compressedDataUrl);
            updateConfigLocal('logoRatio', ratio);
          } else {
            updateConfigLocal('signature', compressedDataUrl);
            updateConfigLocal('signatureRatio', ratio);
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  // --- GERAR PDF ---
  const generatePDF = () => {
    const selectedExams = [];
    examCategories.forEach(cat => {
      cat.items.forEach(item => {
        if (item.checked) selectedExams.push(item.name);
      });
    });

    if (selectedExams.length === 0 && !otherExams) return alert("Selecione pelo menos um exame.");
    if (!patientName) return alert("Preencha o nome do paciente.");

    const doc = new jsPDF();
    const primaryColor = [133, 0, 0];
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const [y, m, d] = examDate.split('-');
    const dateFormatted = `${d}/${m}/${y}`;

    // CABEÇALHO
    let headerBottomY = 40;
    if (config.logo) {
      try {
        const imgWidth = 35;
        const imgHeight = imgWidth * (config.logoRatio || 1);
        doc.addImage(config.logo, 'PNG', 20, 15, imgWidth, imgHeight);
        if ((15 + imgHeight) > 35) headerBottomY = 15 + imgHeight + 5;
      } catch (e) { console.error(e); }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text((config.name || "Profissional").toUpperCase(), 190, 25, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(config.reg || config.title || "", 190, 31, { align: "right" });

    doc.setDrawColor(200);
    doc.line(20, headerBottomY, 190, headerBottomY);

    // TÍTULO E DADOS
    let yPos = headerBottomY + 15;
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("SOLICITAÇÃO DE EXAMES", pageWidth / 2, yPos, { align: "center" });

    yPos += 15;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Paciente:", 20, yPos);
    doc.setFont("helvetica", "bold");
    doc.text(patientName, 40, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${dateFormatted}`, 150, yPos);

    // LISTA DE EXAMES
    if (selectedExams.length > 0) {
      yPos += 10;
      doc.setFillColor(...primaryColor);
      doc.rect(20, yPos, 170, 9, 'F');
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Solicito os seguintes exames para avaliação clínica:", 22, yPos + 6);

      yPos += 15;
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const startX = 26;
      const maxWidth = 190;
      const lineHeight = 6;
      let currentX = startX;
      let startY = yPos;
      const footerReservedSpace = 65;

      selectedExams.forEach((item) => {
        const textStr = `• ${item}   `;
        const textWidth = doc.getTextWidth(textStr);

        if (currentX + textWidth > maxWidth) {
          currentX = startX;
          yPos += lineHeight;
          if (yPos > pageHeight - footerReservedSpace) {
            drawSideBar(doc, startY, yPos, primaryColor);
            drawFooter(doc, pageWidth, pageHeight);
            doc.addPage();
            yPos = 30; startY = yPos; currentX = startX;
          }
        }
        doc.text(textStr, currentX, yPos);
        currentX += textWidth;
      });
      drawSideBar(doc, startY, yPos + (lineHeight / 2), primaryColor);
      yPos += 10;
    }

    // OBSERVAÇÕES
    if (otherExams) {
      const footerReservedSpace = 65;
      if (yPos > pageHeight - footerReservedSpace - 20) {
        drawFooter(doc, pageWidth, pageHeight);
        doc.addPage();
        yPos = 30;
      } else {
        yPos += 5;
      }
      doc.setDrawColor(200);
      doc.line(20, yPos, 190, yPos);
      yPos += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text("OBSERVAÇÕES E ORIENTAÇÕES:", 20, yPos);
      yPos += 6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      const splitText = doc.splitTextToSize(otherExams, 170);
      doc.text(splitText, 20, yPos);
    }

    drawFooter(doc, pageWidth, pageHeight);
    doc.save(`Exames_${patientName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
  };

  const drawSideBar = (doc, startY, endY, color) => {
    if (endY <= startY) return;
    doc.setFillColor(...color);
    doc.roundedRect(21, startY - 4, 0.8, (endY - startY) + 2, 0.4, 0.4, 'F');
  };

  const drawFooter = (doc, pageWidth, pageHeight) => {
    const footerBottom = pageHeight - 10;
    let contactText = [config.address, config.phone, config.email].filter(Boolean).join("  •  ");

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");
    doc.text(contactText, pageWidth / 2, footerBottom, { align: "center" });

    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(config.title || config.reg || "", pageWidth / 2, footerBottom - 6, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(config.name || "", pageWidth / 2, footerBottom - 11, { align: "center" });

    const lineY = footerBottom - 16;
    doc.setDrawColor(150);
    doc.line(pageWidth / 2 - 40, lineY, pageWidth / 2 + 40, lineY);

    if (config.signature) {
      try {
        const scale = parseFloat(config.signatureScale) || 1.0;
        const ratio = config.signatureRatio || 0.5;
        const offX = parseFloat(config.signatureOffsetX) || 0;
        const offY = parseFloat(config.signatureOffsetY) || 0;

        const baseWidth = 40;
        const finalWidth = baseWidth * scale;
        const finalHeight = finalWidth * ratio;

        const xPos = ((pageWidth - finalWidth) / 2) + offX;
        const yPos = (lineY - finalHeight - 2) - offY;

        doc.addImage(config.signature, 'PNG', xPos, yPos, finalWidth, finalHeight);
      } catch (e) { console.error(e); }
    }
  };

  const IconComponent = ({ name }) => {
    const icons = { Apple, Zap, Heart, AlertTriangle };
    const TheIcon = icons[name] || Activity;
    return <TheIcon className="w-5 h-5 mr-2 opacity-80" />;
  };
  // --- FUNÇÕES DE MODELOS ---
  const saveCurrentAsTemplate = () => {
    if (!otherExams.trim()) return alert("Digite algo no campo para salvar como modelo!");
    const name = prompt("Dê um nome para este modelo (ex: Jejum 12h):");
    if (name) {
      const newTemplates = [...savedTemplates, { id: Date.now(), name, text: otherExams }];
      setSavedTemplates(newTemplates);
      localStorage.setItem('shapefy_exam_templates', JSON.stringify(newTemplates));
    }
  };

  const loadTemplate = (text) => {
    // Se já tiver algo escrito, pergunta se quer substituir
    if (otherExams.trim() && !window.confirm("Substituir o texto atual pelo modelo?")) {
      return;
    }
    setOtherExams(text);
  };

  const deleteTemplate = (id, e) => {
    e.stopPropagation(); // Evita carregar o modelo ao clicar no X
    if (window.confirm("Excluir este modelo permanentemente?")) {
      const newTemplates = savedTemplates.filter(t => t.id !== id);
      setSavedTemplates(newTemplates);
      localStorage.setItem('shapefy_exam_templates', JSON.stringify(newTemplates));
    }
  };

  // --- CARREGAR EXAMES DO FIREBASE ---
  const loadExamsFromFirebase = async () => {
    try {
      const docRef = doc(db, "settings", "exams_database");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setExamCategories(data.categories || INITIAL_EXAMS_DB.map(cat => ({
          ...cat,
          items: cat.items.map(item => ({ ...item, checked: false }))
        })));
      } else {
        // Se não existir, salva o banco inicial
        await saveExamsToFirebase(INITIAL_EXAMS_DB.map(cat => ({
          ...cat,
          items: cat.items.map(item => ({ ...item, checked: false }))
        })));
      }
    } catch (error) {
      console.error("Erro ao carregar exames:", error);
      // Fallback para dados iniciais se der erro
      setExamCategories(INITIAL_EXAMS_DB.map(cat => ({
        ...cat,
        items: cat.items.map(item => ({ ...item, checked: false }))
      })));
    }
  };

  // --- SALVAR EXAMES NO FIREBASE ---
  const saveExamsToFirebase = async (categories) => {
    try {
      await setDoc(doc(db, "settings", "exams_database"), {
        categories: categories,
        lastUpdated: new Date().toISOString()
      });
      console.log("Exames salvos no Firebase!");
    } catch (error) {
      console.error("Erro ao salvar exames:", error);
    }
  };
  return (
    <div className="bg-ebony-bg min-h-screen p-4 md:p-8 font-sans text-ebony-text animate-in fade-in">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* CABEÇALHO */}
        <div className="bg-ebony-surface rounded-xl shadow-sm border border-ebony-border p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-ebony-deep border border-ebony-border p-2 rounded-lg">
              <Activity className="w-6 h-6 text-ebony-muted" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Solicitação de Exames</h1>
              <p className="text-xs text-ebony-muted">Geração de PDF</p>
            </div>
          </div>
        </div>

        {/* PAINEL CONFIGURAÇÃO (AGORA COM BOTÃO SALVAR NO FIREBASE) */}
        <div className="bg-ebony-surface rounded-xl shadow-sm p-6 border-l-4 border-ebony-primary border border-ebony-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-bold text-lg flex items-center">
              <Settings className="w-5 h-5 mr-2 text-ebony-muted" /> Configuração do Profissional
            </h2>

            {/* BOTÃO SALVAR PERFIL */}
            <button
              onClick={handleSaveProfile}
              disabled={savingConfig}
              className="bg-ebony-primary hover:bg-red-900 text-white text-xs font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 transition disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {savingConfig ? "Salvando..." : "Salvar Perfil na Nuvem"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Logo */}
            <div className="md:col-span-2 flex flex-col items-center justify-center border-2 border-dashed border-ebony-border rounded-lg p-2 hover:bg-ebony-deep transition bg-ebony-deep/60 h-32 relative">
              {config.logo ? (
                <img src={config.logo} className="h-full w-full object-contain" alt="Logo" />
              ) : (
                <div className="text-center text-ebony-muted">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                  <p className="text-xs">Logo</p>
                </div>
              )}
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleImageUpload(e, 'logo')} />
            </div>

            {/* Dados Texto */}
            <div className="md:col-span-6 grid grid-cols-2 gap-4">
              <input
                placeholder="Nome Completo"
                className="p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm font-bold col-span-2 outline-none"
                value={config.name}
                onChange={e => updateConfigLocal('name', e.target.value)}
              />
              <input
                placeholder="Registro / Título"
                className="p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm col-span-2 outline-none"
                value={config.title}
                onChange={e => updateConfigLocal('title', e.target.value)}
              />
              <input
                placeholder="Telefone"
                className="p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm outline-none"
                value={config.phone}
                onChange={e => updateConfigLocal('phone', e.target.value)}
              />
              <input
                placeholder="E-mail"
                className="p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm outline-none"
                value={config.email}
                onChange={e => updateConfigLocal('email', e.target.value)}
              />
              <input
                placeholder="Endereço Completo"
                className="p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm col-span-2 outline-none"
                value={config.address}
                onChange={e => updateConfigLocal('address', e.target.value)}
              />
            </div>

            {/* Assinatura */}
            <div className="md:col-span-4 bg-ebony-deep rounded-lg border border-ebony-border p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase text-ebony-muted">Assinatura</span>
                <label className="cursor-pointer text-xs bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface px-2 py-1 rounded-lg transition flex items-center gap-1">
                  <Upload className="w-3 h-3" /> Upload
                  <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'signature')} />
                </label>
              </div>

              <div className="h-20 bg-ebony-surface border border-dashed border-ebony-border rounded-lg relative overflow-hidden flex items-center justify-center mb-2">
                {config.signature ? (
                  <img
                    src={config.signature}
                    style={{ transform: `translate(${config.signatureOffsetX * 2}px, ${config.signatureOffsetY * -2}px) scale(${config.signatureScale})` }}
                    className="max-h-full max-w-full object-contain"
                    alt="Assinatura"
                  />
                ) : (
                  <span className="text-xs text-ebony-muted">Sem Assinatura</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  className="accent-[var(--ebony-primary)] h-1"
                  value={config.signatureScale}
                  onChange={e => updateConfigLocal('signatureScale', e.target.value)}
                  title="Zoom"
                />
                <input
                  type="range"
                  min="-50"
                  max="50"
                  className="accent-[var(--ebony-primary)] h-1"
                  value={config.signatureOffsetX}
                  onChange={e => updateConfigLocal('signatureOffsetX', e.target.value)}
                  title="Pos X"
                />
                <input
                  type="range"
                  min="-30"
                  max="30"
                  className="accent-[var(--ebony-primary)] h-1"
                  value={config.signatureOffsetY}
                  onChange={e => updateConfigLocal('signatureOffsetY', e.target.value)}
                  title="Pos Y"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ÁREA PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CONTROLES ESQUERDA */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-ebony-surface p-4 sm:p-5 rounded-xl shadow-sm border border-ebony-border sticky top-6 min-h-[280px] sm:min-h-[320px]">
              <h3 className="text-white font-bold mb-4 border-b border-ebony-border pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-ebony-muted" /> Paciente
              </h3>

              {/* SEARCH PACIENTES COM INDICADOR VISUAL */}
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Nome do Paciente"
                  className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 text-sm outline-none"
                  value={patientName}
                  onChange={e => { setPatientName(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />

                {/* Indicador se é paciente existente ou novo */}
                {patientName && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {students.some(s => s.name.toLowerCase() === patientName.toLowerCase()) ? (
                      <span className="text-green-400 text-xs">✓ Existente</span>
                    ) : (
                      <span className="text-yellow-400 text-xs">+ Novo</span>
                    )}
                  </div>
                )}

                {/* Lista de sugestões */}
                {showSuggestions && patientName && (
                  <ul className="absolute z-50 bg-ebony-surface border border-ebony-border w-full max-h-40 overflow-y-auto rounded-b-lg shadow-lg mt-1">
                    {students.filter(s => s.name.toLowerCase().includes(patientName.toLowerCase())).map(s => (
                      <li
                        key={s.id}
                        className="p-2 text-sm hover:bg-ebony-border/30 cursor-pointer border-b border-ebony-border last:border-0"
                        onClick={() => { setPatientName(s.name); setShowSuggestions(false); }}
                      >
                        <StudentNameWithBadge
                          student={s}
                          nameFallback={s.name}
                          className="text-sm text-white"
                          showText={false}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <input
                type="date"
                className="w-full p-2 mb-8 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary text-sm outline-none"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
              />

              <button
                onClick={generatePDF}
                className="w-full bg-ebony-primary hover:bg-red-900 text-white font-bold py-3 rounded-lg shadow-lg transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" /> GERAR PDF
              </button>

              <button
                onClick={clearAll}
                className="w-full mt-4 text-xs text-ebony-muted hover:text-white flex justify-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Limpar Tudo
              </button>
            </div>
          </div>

          {/* LISTA EXAMES DIREITA */}
          <div className="lg:col-span-9">
            <div className="bg-ebony-surface p-6 rounded-xl shadow-sm border border-ebony-border">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Seleção de Exames</h3>
                <span className="text-xs bg-ebony-deep border border-ebony-border px-2 py-1 rounded text-ebony-muted">
                  Clique para selecionar • Clique no texto para editar
                </span>
              </div>

              <div className="space-y-8">
                {examCategories.map((cat, catIndex) => (
                  <div key={catIndex} className="mb-4">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-ebony-border">
                      <h4 className="text-white font-bold text-lg flex items-center">
                        <IconComponent name={cat.icon} /> {cat.category}
                      </h4>
                      <button
                        onClick={() => addNewExam(catIndex)}
                        className="text-xs bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-primary px-2 py-1 rounded-lg transition flex items-center gap-1 font-bold"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {cat.items.map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          onClick={() => toggleExam(catIndex, itemIndex)}
                          className={`group relative flex items-center p-2 rounded-lg cursor-pointer transition-all border ${item.checked
                            ? 'bg-ebony-deep border-ebony-primary'
                            : (item.highlight
                              ? 'bg-ebony-deep border-ebony-border'
                              : 'bg-ebony-surface border-ebony-border hover:bg-ebony-border/30')
                            }`}
                        >
                          {/* Checkbox */}
                          <div className="flex-shrink-0 mr-2">
                            {item.checked
                              ? <CheckSquare className="w-5 h-5 text-ebony-primary" />
                              : <Square className="w-5 h-5 text-ebony-muted" />
                            }
                          </div>

                          {/* Nome Editável */}
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateExamName(catIndex, itemIndex, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={`bg-transparent border-none outline-none text-sm w-full py-0 ${item.checked ? 'font-bold text-white' : 'text-ebony-text'
                              }`}
                          />

                          {/* Botão Excluir (Hover) */}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeExam(catIndex, itemIndex); }}
                            className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-ebony-deep rounded text-ebony-muted hover:text-white transition-all"
                            title="Remover exame"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* BLOCO DE OBSERVAÇÕES COM MODELOS SALVOS */}
              <div className="mt-8 pt-6 border-t border-ebony-border bg-ebony-deep p-4 rounded-lg">
                <div className="flex justify-between items-end mb-2">
                  <label className="text-sm font-bold text-white flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-ebony-muted" /> Observações e Orientações
                  </label>
                  <button
                    onClick={saveCurrentAsTemplate}
                    className="text-xs flex items-center gap-1 text-ebony-muted hover:text-white font-bold hover:bg-ebony-surface px-2 py-1 rounded-lg transition"
                    title="Salvar texto atual como modelo"
                  >
                    <Save className="w-3 h-3" /> Salvar Modelo
                  </button>
                </div>

                <textarea
                  rows="3"
                  className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary placeholder-gray-600 outline-none mb-3 resize-none"
                  placeholder="Orientações específicas ou exames adicionais..."
                  value={otherExams}
                  onChange={e => setOtherExams(e.target.value)}
                ></textarea>

                {/* LISTA DE MODELOS (CHIPS) */}
                {savedTemplates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {savedTemplates.map(t => (
                      <div
                        key={t.id}
                        onClick={() => loadTemplate(t.text)}
                        className="group flex items-center gap-2 bg-ebony-surface border border-ebony-border text-ebony-muted text-xs px-3 py-1.5 rounded-full cursor-pointer hover:border-ebony-primary hover:text-white transition"
                      >
                        <span className="font-medium">{t.name}</span>
                        <button
                          onClick={(e) => deleteTemplate(t.id, e)}
                          className="opacity-20 group-hover:opacity-100 hover:bg-ebony-deep p-0.5 rounded-full transition text-ebony-muted hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamsModule;