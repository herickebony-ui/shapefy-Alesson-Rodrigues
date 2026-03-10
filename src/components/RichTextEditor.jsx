import React, { useRef, useEffect, useState } from 'react'
import { Bold, Italic, Underline, Palette, Link as LinkIcon, FileSignature, Indent, Outdent } from 'lucide-react';

// --- EDITOR DE TEXTO DEFINITIVO (BARRA COMPLETA + ROLAGEM CORRIGIDA) ---
const RichTextEditor = ({ value, onChange, isA4 = false }) => {
  const editorRef = useRef(null);
  const [blockType, setBlockType] = useState("p");
  const [formats, setFormats] = useState({});
  const [currentFontSize, setCurrentFontSize] = useState("3"); // "3" equivale a ~12pt no browser
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [linkText, setLinkText] = useState("");

  // --- FUNÇÃO DE COLAGEM INTELIGENTE (PRESERVA TÍTULOS DO WORD) ---
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');

    // 1. Cria um ambiente virtual HTML para manipular o conteúdo antes de colar
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    // 2. Mapeia os estilos internos do Word para tags HTML reais
    const wordMappings = {
      'MsoHeading1': 'h1',
      'MsoHeading2': 'h2',
      'MsoHeading3': 'h3',
      'MsoTitle': 'h1',
      'MsoSubtitle': 'h2'
    };

    // 3. Itera sobre todos os elementos para converter e limpar
    doc.body.querySelectorAll('*').forEach((el) => {
      // A. Converter Classes do Word em Tags Semânticas
      // Se o elemento tiver uma classe conhecida do Word, transformamos na tag certa
      for (const [wordClass, htmlTag] of Object.entries(wordMappings)) {
        if (el.className && el.className.includes(wordClass)) {
          const newEl = document.createElement(htmlTag);
          newEl.innerHTML = el.innerHTML;
          el.replaceWith(newEl);
          el = newEl; // Atualiza a referência para limpar os atributos abaixo
          break; // Já achou, para o loop
        }
      }

      // B. Limpeza de Atributos (Remove fontes, cores fixas e classes do Word)
      // Mantemos apenas o href se for um link
      const attributes = Array.from(el.attributes);
      attributes.forEach(attr => {
        if (el.tagName === 'A' && attr.name === 'href') return; // Mantém links
        el.removeAttribute(attr.name); // Remove style, class, lang, align, etc.
      });

      // C. Remove comentários condicionais do Word (sujeira oculta)
      if (el.nodeType === 8) el.remove();
    });

    // 4. Remove tags vazias que o Word costuma deixar (ex: <p>&nbsp;</p>) se desejar
    // doc.body.innerHTML = doc.body.innerHTML.replace(/<p>&nbsp;<\/p>/g, "");

    const cleanHtml = doc.body.innerHTML;
    document.execCommand("insertHTML", false, cleanHtml);
  };

  const updateToolbarState = () => {
    const doc = document;

    // Detecta tamanho da fonte atual (retorna string '3', '4', etc ou px dependendo do browser)
    // O fallback || '3' garante que não quebre se for indefinido
    const size = doc.queryCommandValue('fontSize');
    setCurrentFontSize(size || "3");

    // Verifica estados binários
    setFormats({
      bold: doc.queryCommandState('bold'),
      italic: doc.queryCommandState('italic'),
      underline: doc.queryCommandState('underline'),
      justifyLeft: doc.queryCommandState('justifyLeft'),
      justifyCenter: doc.queryCommandState('justifyCenter'),
      justifyRight: doc.queryCommandState('justifyRight'),
      justifyFull: doc.queryCommandState('justifyFull'),
    });
  };

  const execCmd = (command, val = null) => {
    document.execCommand(command, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const addLink = () => {
    const selectionText = window.getSelection()?.toString() || "";
    setLinkText(selectionText || "");
    setLinkUrl("https://");
    setShowLinkModal(true);
  };
  
  const confirmLink = () => {
    if (!linkUrl || linkUrl === "https://") {
      setShowLinkModal(false);
      return;
    }
    let finalUrl = linkUrl;
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = `https://${finalUrl}`;
    }
    const finalText = linkText || finalUrl;
    const linkHtml = `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer" style="color:#3b82f6;text-decoration:underline;">${escapeHtml(finalText)}</a>`;
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, linkHtml);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    setShowLinkModal(false);
    setLinkUrl("https://");
    setLinkText("");
  };

  // --- FUNÇÕES DA BARRA DE FERRAMENTAS ---
  const changeColor = (e) => execCmd("foreColor", e.target.value);
  const changeSize = (e) => {
    execCmd("fontSize", e.target.value);
    setCurrentFontSize(e.target.value); // Atualiza visualmente na hora
  };
  const formatBlock = (e) => {
    const val = e.target.value;
    execCmd("formatBlock", val);

    // Se voltar para texto normal, garante que remove formatações de cabeçalho residuais
    if (val === 'p') {
      document.execCommand("removeFormat", false, null); // Opcional: limpa negritos residuais se desejar, senão remova esta linha
    }
    setBlockType(val);
  };

  const alignLeft = () => execCmd("justifyLeft");
  const alignCenter = () => execCmd("justifyCenter");
  const alignRight = () => execCmd("justifyRight");
  const alignFull = () => execCmd("justifyFull");

  const indent = () => execCmd("indent");
  const outdent = () => execCmd("outdent");

  const insertSignaturePlaceholder = () => {
    const html = `<div class="no-break" style="margin-top:20px;"><div style="height:60px; border-bottom:1px solid #000; width:260px;"></div><div style="font-size:10pt; color:#333; margin-top:5px;">Assinatura do Aluno</div><div>{{assinatura_aluno}}</div></div>`;
    document.execCommand("insertHTML", false, html);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  // Helper simples para escapar HTML no link
  const escapeHtml = (text) => {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  // Substitua o wrapperClass e scrollAreaClass por estes simples:

  const wrapperClass = isA4
    ? "flex flex-col h-[70vh] w-full bg-gray-600 border border-gray-300 rounded overflow-hidden"
    : "flex flex-col min-h-[300px] border border-gray-200 bg-white shadow-sm";

  const scrollAreaClass = isA4
  ? "flex-1 overflow-y-auto overflow-x-auto w-full flex justify-center items-start pt-2 pb-32 bg-gray-600 cursor-text custom-scrollbar"
  : "w-full";

  const editorCss = `
    .editor-content { text-align: justify; }
    .editor-content p { margin: 0; padding: 0; min-height: 1em; }
    /* Ajuste fino para simular a densidade de fonte do PDF */
    .editor-content { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  `;

  const paperStyle = isA4
    ? {
      // ALTURA MÍNIMA (Padrão A4 @ 96DPI)
      minHeight: "1123px",
      width: "210mm",     // Define a largura exata do papel A4
      maxWidth: "100%",

      // ALTURA AUTOMÁTICA (Isso resolve o problema da folha "única". Ela vai esticar)
      height: "auto",
      // MARGENS: Se no PDF cabe mais texto, precisamos de MENOS margem aqui.
      // 40px é aprox 1cm. Se ainda quebrar antes, baixe para 30px.
      padding: "20mm 20mm",

      // AJUSTE DE FONTE (Antialiasing faz a fonte parecer mais fina, ocupando menos espaço)
      fontFamily: "'Times-Roman' ",
      fontSize: "12",
      lineHeight: "1.15",
      letterSpacing: "-0.1",
      
      boxSizing: "border-box",
      backgroundColor: "white",
      boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
      color: "#000",
      whiteSpace: "pre-wrap", // Mantém quebras de linha reais
      overflow: "visible",     // NUNCA corta o texto

      // Centralizar o papel na div cinza
      marginLeft: "auto",
      marginRight: "auto",
      marginBottom: "50px" // Espaço visual no fim
    }
    : {
      // (Estilo do modo normal - mantenha o que você já tem ou use o padrão simples)
      width: "100%", minHeight: "250px", padding: "20px", backgroundColor: "white", 
      fontFamily: "ui-sans-serif, system-ui, sans-serif", 
      fontSize: "16px", 
      color: "#1f2937", 
      lineHeight: "1.3", outline: "none"
    };

  return (
    <>
    {/* Modal de Link estilo Notion */}
    {showLinkModal && (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLinkModal(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-4 animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
          <div className="text-sm font-bold text-gray-800 mb-3">Inserir Link</div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">URL</label>
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://exemplo.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && confirmLink()}
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Texto do link (opcional)</label>
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Clique aqui"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && confirmLink()}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowLinkModal(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmLink}
              className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Inserir
            </button>
          </div>
        </div>
      </div>
    )}
    <div className={wrapperClass}>

      {/* --- BARRA DE FERRAMENTAS (FIXA - Não rola) --- */}
      {/* O "flex-none" garante que ela nunca encolha ou suma */}
      <div className="flex-none bg-gray-100 border-b border-gray-300 p-2 flex flex-wrap items-center gap-2 z-20 shadow-sm select-none">

        {/* Ícones de Formatação (Negrito, Itálico...) */}
        <div className="flex bg-white border border-gray-300 rounded shadow-sm">
          <button onClick={() => execCmd("bold")} className={`p-1.5 px-3 border-r ${formats.bold ? 'bg-gray-300 text-black' : 'hover:bg-gray-200'}`} title="Negrito"><Bold size={16} /></button>
          <button onClick={() => execCmd("italic")} className={`p-1.5 px-3 border-r ${formats.italic ? 'bg-gray-300 text-black' : 'hover:bg-gray-200'}`} title="Itálico"><Italic size={16} /></button>
          <button onClick={() => execCmd("underline")} className={`p-1.5 px-3 ${formats.underline ? 'bg-gray-300 text-black' : 'hover:bg-gray-200'}`} title="Sublinhado"><Underline size={16} /></button>
        </div>

        {/* Alinhamento */}
        <div className="flex bg-white border border-gray-300 rounded shadow-sm ml-1">
          <button onClick={alignLeft} className={`p-1.5 px-2 border-r ${formats.justifyLeft ? 'bg-gray-300' : 'hover:bg-gray-200'}`} title="Esq"><div className="text-[10px] font-bold">ESQ</div></button>
          <button onClick={alignCenter} className={`p-1.5 px-2 border-r ${formats.justifyCenter ? 'bg-gray-300' : 'hover:bg-gray-200'}`} title="Cen"><div className="text-[10px] font-bold">CEN</div></button>
          <button onClick={alignFull} className={`p-1.5 px-2 ${formats.justifyFull ? 'bg-gray-300' : 'hover:bg-gray-200'}`} title="Jus"><div className="text-[10px] font-bold">JUS</div></button>
        </div>

        {/* Recuo */}
        <div className="flex bg-white border border-gray-300 rounded shadow-sm ml-1">
          <button onClick={outdent} className="p-1.5 px-2 hover:bg-gray-200 border-r"><Outdent size={16} /></button>
          <button onClick={indent} className="p-1.5 px-2 hover:bg-gray-200"><Indent size={16} /></button>
        </div>
        {/* Link */}
        <div className="flex bg-white border border-gray-300 rounded shadow-sm ml-1">
          <button onClick={addLink} className="p-1.5 px-2 hover:bg-gray-200" title="Inserir Link"><LinkIcon size={16} /></button>
        </div>

        {/* Tamanho e Cor */}
        <div className="flex items-center gap-2 ml-1 bg-white border border-gray-300 rounded p-0.5 px-2">
          <div className="relative w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-gray-100 rounded">
            <Palette className="w-4 h-4 text-blue-600" />
            <input type="color" onChange={changeColor} className="absolute inset-0 opacity-0 cursor-pointer" title="Cor" />
          </div>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <select
            onChange={changeSize}
            value={currentFontSize}
            className="text-xs bg-transparent outline-none cursor-pointer w-20 font-semibold"
          >
            <option value="2">10pt (PP)</option>
            <option value="3">12pt (P)</option>
            <option value="4">14pt (M)</option>
            <option value="5">18pt (G)</option>
            <option value="6">24pt (GG)</option>
          </select>
        </div>

        {/* Assinatura (Só no modo A4) */}
        {isA4 && (
          <div className="ml-auto pl-2">
            <button onClick={insertSignaturePlaceholder} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-bold text-gray-700 hover:bg-blue-50 hover:border-blue-400 transition-all shadow-sm">
              <FileSignature size={14} /> Assinatura
            </button>
          </div>
        )}
      </div>

      {/* --- ÁREA DE EDIÇÃO --- */}
      <div className={scrollAreaClass} onClick={() => editorRef.current?.focus()}>
        <>
          <style>{editorCss}</style>
          <div
            ref={editorRef}
            className="editor-content break-words"
            contentEditable
            suppressContentEditableWarning
            onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
            onKeyUp={updateToolbarState}
            onMouseUp={updateToolbarState}
            onPaste={handlePaste}
            style={paperStyle}
          />
        </>
      </div>
    </div>
    </>
  );
};

export default RichTextEditor;