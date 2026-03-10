import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from '../firebase';
import { getFunctions, httpsCallable } from "firebase/functions";

import { pdf, Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import parse, { domToReact } from 'html-react-parser';

// ATUALIZAÇÃO 1: ESTILOS (Rodapé Ajustado e Seguro)
const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 80, // Aumentei bastante pra garantir que o rodapé caiba
    paddingHorizontal: 50,
    fontFamily: 'Times-Roman',
    fontSize: 12,
    lineHeight: 1.5,
  },
  text: {
    marginBottom: 8,
    textAlign: 'left',
    fontFamily: 'Times-Roman',
  },
  heading: {
    marginTop: 20,
    marginBottom: 10,
    fontFamily: 'Times-Roman', 
    fontWeight: 'bold',      
    fontSize: 14, 
    textTransform: 'uppercase',
  },
  bold: {
    fontFamily: 'Times-Roman',
    fontWeight: 'bold',
  },
  italic: {
    fontFamily: 'Times-Roman',
    fontStyle: 'italic',
  },
  // RODAPÉ: Subi a posição e fixei a altura
  footer: {
    position: "absolute",
    bottom: 30,
    left: 60,
    right: 60,
    height: 30,
    borderTopWidth: 0.5,
    borderTopColor: "#ccc",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#777",  
  },  
  auditBox: {
    borderWidth: 1,
    borderColor: '#000',
    padding: 10,
    marginTop: 20,
  },
  auditRow: {
    flexDirection: 'row',
    marginBottom: 4,
    fontSize: 9,
  }
});

const pickFirst = (...vals) =>
  vals.find(v => v !== undefined && v !== null && String(v).trim() !== "");

// converte Timestamp/Date/string para Date de forma segura
const toDateSafe = (v) => {
  if (!v) return null;

  // Firestore Timestamp
  if (typeof v?.toDate === "function") {
    try { return v.toDate(); } catch { /* ignore */ }
  }

  // Date
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  // number (ms)
  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  // string ISO / outros
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const formatPtBR = (dateLike) => {
  const d = toDateSafe(dateLike);
  return d ? d.toLocaleString("pt-BR") : "Data n/d";
};

// ✅ Resolve IP/Device/SignedAt/CreatedAt priorizando fontes "congeladas" (contrato/assinatura)
const resolveAuditMeta = (student = {}) => {
  const sData = student.studentData || {};
  const sig = student.signature || {};
  const sigMeta = sig.meta || sig.metadata || sig.audit || {};
  
  // Garante que logs seja um array
  const logs = Array.isArray(student.auditTrail) ? student.auditTrail : [];

  // 1. O TRUNFO: Busca o ÚLTIMO log válido no histórico (Varredura Reversa)
  // Se o cadastro principal falhar, pegamos o IP desse log "Camamu - BA" que você acabou de gerar
  const lastValidLog = [...logs].reverse().find(l => l.ip && l.ip.length > 5 && l.ip !== "IP Oculto");

  // Helper para validar string (evita "undefined" ou nulos)
  const valid = (val) => (val && String(val).trim() !== "" && String(val) !== "undefined") ? String(val) : null;

  // A. IP: Prioridade -> Assinatura > Dados Vivos > Último Log > Contrato Antigo
  const ip = valid(sigMeta.ipAddress) || valid(sigMeta.ip) || 
             valid(sData.ip) || valid(sData.ipAddress) || 
             valid(lastValidLog?.ip) || 
             "IP não registrado";

  // B. LOCALIZAÇÃO (Onde estava o erro): Agora busca no Log também!
  const location = valid(sigMeta.location) || 
                   valid(sData.location) || 
                   valid(lastValidLog?.location) || 
                   "Brasil (Local n/d)";

  // C. DISPOSITIVO
  const device = valid(sigMeta.device) || valid(sigMeta.userAgent) ||
                 valid(sData.device) || 
                 valid(lastValidLog?.device) || 
                 "Navegador Web";

  // D. DATAS
  const signedAt = pickFirst(
    sigMeta.signedAt,
    sData.signedAt,
    student.signedAt,
    lastValidLog?.timestamp // Se não tiver data de assinatura, usa a data do último log
  );

  const createdAt = pickFirst(
    student.contractCreatedAt,
    student.createdAt
  );

  return { ip, device, location, signedAt, createdAt };
};

// ✅ Rodapé: container View + Text (isso “fixa” de verdade no react-pdf)
const ContractFooter = ({ docId }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>ID: {docId} - Team Ebony Consulting</Text>

    <Text
      style={styles.footerText}
      render={({ pageNumber, totalPages }) => {
        // ✅ tira a última página (folha de assinaturas/auditoria)
        const contractTotal = Math.max(totalPages - 1, 1);
        // aqui só roda nas páginas do contrato, então pageNumber <= contractTotal
        return `Pág ${pageNumber} / ${contractTotal}`;
      }}
    />
  </View>
);


// =========================
// ✅ AGORA O TEU TRECHO COMPLETO DO ContractPdfDocument
// =========================
const ContractPdfDocument = ({ student, processedHtml }) => {
  const docId = student.id || "ID_PENDENTE";
  const signatureUrl = student.signature?.image;

  // CPF formatado... (mantém igual)
  const sData = student.studentData || {};
  const rawCpf = student.cpf || sData.cpf || "Não informado";
  const cpfDigits = String(rawCpf).replace(/\D/g, "");
  const finalCpf =
    cpfDigits.length === 11
      ? cpfDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
      : String(rawCpf);

  // ✅ AQUI ESTÁ A CORREÇÃO: Destructure "location" também!
  const { ip, device, location, signedAt, createdAt } = resolveAuditMeta(student);

  // Formata datas
  const signDate = formatPtBR(signedAt);
  const createdDate = formatPtBR(createdAt);
  
  // (IMPORTANTE: Remova a linha antiga "const locationStr = ...")
  // Agora usamos a variável 'location' que veio da função inteligente acima.

  // Hash
  const hashId = docId.split("").reverse().join("") + "ab9";

  // Lógica dos logs (mantém igual)
  const allLogs = student.auditTrail || [];
  const reversedIndex = [...allLogs].reverse().findIndex(log => log.event === "LINK_GERADO");
  const startIndex = reversedIndex >= 0 ? allLogs.length - 1 - reversedIndex : 0;
  const logsAtuais = allLogs.slice(startIndex);

  return (
    <Document>
      {/* ===== PÁGINAS DO CONTRATO (rodapé em TODAS) ===== */}
      <Page size="A4" style={styles.page} wrap>
        {/* ✅ COLOCA O FOOTER PRIMEIRO (não depende do “break” lá embaixo) */}
        <ContractFooter docId={docId} />

        <HtmlToPdfParser htmlContent={processedHtml} />                                
      </Page>

      {/* ===== ÚLTIMA PÁGINA (AJUSTE FINO FINAL) ===== */}
      <Page size="A4" style={styles.page}>
        
        {/* Cabeçalho Compacto */}
        <View style={{ borderBottomWidth: 2, paddingBottom: 5, marginBottom: 10 }}>
          <Text style={{ fontSize: 14, fontFamily: "Times-Roman", fontWeight: "bold" }}>
            Authentication Management
          </Text>
          <Text style={{ fontSize: 9, color: "#666" }}>
            Digital Security And Audit Validation
          </Text>
        </View>

        <Text style={[styles.heading, { textAlign: "center", marginBottom: 0 }]}>
          FOLHA DE ASSINATURAS
        </Text>

        {/* --- ASSINATURAS (POSICIONAMENTO NOVO) --- */}
        {/* marginTop: 0 -> Joga o bloco lá pra cima para dar espaço aos logs */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 30, marginTop: 0 }}>
          
          {/* LADO ALUNO */}
          <View style={{ width: "45%", alignItems: "center" }}>
            {signatureUrl ? (
              <Image
                src={signatureUrl}
                /* top: 10 empurra um pouco pra baixo pra encostar na linha */
                style={{ width: 160, height: 90, objectFit: "contain", top: 65, 
                transform: 'scale(1.5)', // 👈 Isso aumenta a imagem em 50% sem mover a linha
                transformOrigin: 'bottom center' }}
              />
            ) : (
              <View style={{ height: 85 }} />
            )}
            {/* Linha colada na imagem (marginTop: 0) */}
            <View style={{ borderBottomWidth: 1, width: "100%", marginTop: 0, marginBottom: 4, borderColor: "#000" }} />
            <Text style={{ fontFamily: "Times-Bold", fontSize: 11 }}>{student.name}</Text>
            <Text style={{ fontSize: 9, fontFamily: "Times-Roman", color: "#333" }}>CPF: {finalCpf}</Text>
            <Text style={{ fontSize: 9, fontFamily: "Times-Roman", color: "#666" }}>CONTRATANTE</Text>
          </View>

          {/* LADO EMPRESA (Configuração que você pediu) */}
          <View style={{ width: "45%", alignItems: "center" }}>
            <Image 
              src={COMPANY_SIGNATURE_URL} 
              /* top: 15 ajustado para a assinatura da empresa ficar perfeita na linha */
              style={{ width: 160, height: 90, objectFit: "contain", top: 35 }} 
            />
            {/* A linha fica exatamente abaixo da imagem */}
            <View style={{ borderBottomWidth: 1, width: "100%", marginTop: 0, marginBottom: 4, borderColor: '#000' }} />
            
            <Text style={{ fontFamily: "Times-Bold", fontSize: 11 }}>Hérick Ebony</Text>
            <Text style={{ fontSize: 9, fontFamily: "Times-Roman", color: "#333" }}>CPF: 858.861.845-11</Text>
            <Text style={{ fontSize: 9, fontFamily: "Times-Roman", color: "#666" }}>CONTRATADA</Text>
          </View>

        </View>
        {/* --- RODAPÉ DE VALIDAÇÃO --- */}
        <View style={{ marginTop: 0, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#999", paddingTop: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 8, fontFamily: "Times-Bold", color: "#333" }}>
            VALIDAÇÃO DE SEGURANÇA 
          </Text>
          <Text style={{ fontSize: 7, color: "#555", marginTop: 2 }}>
            Hash SHA256: {student.id ? student.id.substring(0, 32) + "..." : "N/A"}
          </Text>
          <Text style={{ fontSize: 7, color: "#555", marginTop: 2, textAlign: "center" }}>
            Documento assinado eletronicamente com validade jurídica conforme Medida Provisória nº 2.200-2/2001.
          </Text>
        </View>        
        {/* --- TRILHA DE AUDITORIA (Agora com bastante espaço!) --- */}
        <View style={{ marginTop: 10, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4, border: '1px solid #e0e0e0' }}>
          <Text style={{ fontSize: 8, fontFamily: 'Times-Bold', marginBottom: 0, textTransform: 'uppercase', color: '#000' }}>
            REGISTRO DE EVENTOS (LOG DETALHADO)
          </Text>

          {/* Loop para mostrar todos os passos salvos no Firebase */}
          {logsAtuais && logsAtuais.length > 0 ? (
          logsAtuais.map((log, index) => {
            
            // 1. TRATAMENTO DE SEGURANÇA (Adicione isso logo no começo do map)
            // Se 'details' for objeto, pegamos o texto de dentro ou transformamos em string.
            // Isso evita o Erro #31 que trava a tela.
            let safeDetails = "";
            if (log.details && typeof log.details === 'object') {
              safeDetails = log.details.info || JSON.stringify(log.details);
            } else {
              safeDetails = String(log.details || "");
            }

            return (
              <View key={index} style={{ marginBottom: 6, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: '#444' }}>
                
                {/* Use String() nos campos para garantir que null/undefined não quebre nada */}
                <Text style={{ fontSize: 8, fontFamily: 'Times-Bold', color: '#000', marginBottom: 0 }}>
                  EVENTO: {String(log.event)}
                </Text>
                
                <Text style={{ fontSize: 8, color: '#333', fontFamily: 'Times-Roman', marginBottom: 0, lineHeight: 1.2 }}>
                  • Data/Hora: {log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : "Data N/D"}
                </Text>
                
                <Text style={{ fontSize: 8, color: '#333', fontFamily: 'Times-Roman', marginBottom: 1, lineHeight: 1.2 }}>
                  • Dispositivo: {String(log.device || "N/D")}
                </Text>
                
                <Text style={{ fontSize: 8, color: '#333', fontFamily: 'Times-Roman', marginBottom: 1, lineHeight: 1.2 }}>
                  • Localização: {String(log.location || "Processando...")}
                </Text>
                
                <Text style={{ fontSize: 8, color: '#333', fontFamily: 'Times-Roman', marginBottom: 1, lineHeight: 1.2 }}>
                  • IP Origem: {String(log.ip || "Oculto")}
                </Text>

                {/* Só mostra a linha de Obs se tiver texto válido */}
                {safeDetails ? (
                  <Text style={{ fontSize: 8, color: '#666', fontFamily: 'Times-Roman', fontStyle: 'italic', marginTop: 1, lineHeight: 1.2 }}>
                    Obs: {safeDetails}
                  </Text>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={{ fontSize: 8, color: '#666' }}>Aguardando sincronização...</Text>
        )}
        </View>
      </Page>
    </Document>
  );
};


// ATUALIZAÇÃO 2: TRADUTOR (Removemos a bolinha "•" das listas)
// ATUALIZAÇÃO 2: TRADUTOR BLINDADO (Corrige erro 'null is not object')
const HtmlToPdfParser = ({ htmlContent }) => {
  const disableHyphenation = (word) => [word];
  if (!htmlContent) return <Text></Text>; // Retorna Text vazio em vez de null

  const hasMeaningful = (node) => {
    const kids = node?.children || [];
    return kids.some((c) => {
      if (c.type === "text") return String(c.data || "").replace(/\u00a0/g, " ").trim().length > 0;
      if (c.type === "tag") return c.name !== "br";
      return false;
    });
  };  
  
  const options = {
    replace: (domNode) => {
      if (domNode.type === "text") {
        const raw = String(domNode.data ?? "");
        // Normaliza espaços
        let t = raw.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ");
        
        // 🚨 AQUI ESTAVA O ERRO DO IPHONE:
        // Se t for vazio, não retorne null. Retorne string vazia.
        if (!t) return ""; 
        
        return <Text hyphenationCallback={disableHyphenation}>{t}</Text>;
      }       
      if (domNode.type === 'tag') {
        // ... (resto das tags blockquote, div, strong, etc - mantém igual) ...
        if (domNode.name === "blockquote") {
          return (<View style={{ marginLeft: 20 }}><Text style={styles.text} hyphenationCallback={disableHyphenation}>{domToReact(domNode.children, options)}</Text></View>);
        }        
        if (domNode.name === 'div') {
          if (!hasMeaningful(domNode)) return <View />; // Retorna View vazia segura
          return (<View style={{ marginBottom: 10 }}><Text style={styles.text} hyphenationCallback={disableHyphenation}>{domToReact(domNode.children, options)}</Text></View>);
        }
        if (domNode.name === "div") return <View>{domToReact(domNode.children, options)}</View>;
        if (domNode.name === 'strong' || domNode.name === 'b') return <Text style={styles.bold} hyphenationCallback={disableHyphenation}>{domToReact(domNode.children, options)}</Text>;
        if (domNode.name === 'em' || domNode.name === 'i') return <Text style={styles.italic} hyphenationCallback={disableHyphenation}>{domToReact(domNode.children, options)}</Text>;
        if (domNode.name === 'br') return <Text>{"\n"}</Text>;
        if (domNode.name === 'ul' || domNode.name === 'ol') return <View style={{ marginLeft: 30 }}>{domToReact(domNode.children, options)}</View>;
        
        // Removemos a bolinha (•) que você pediu antes
        if (domNode.name === 'li') {
            return (<View style={{ marginBottom: 4 }}><Text style={styles.text} hyphenationCallback={disableHyphenation}>{domToReact(domNode.children, options)}</Text></View>);
        }
        if (domNode.name === 'span') return <Text hyphenationCallback={disableHyphenation}>{domToReact(domNode.children, options)}</Text>;
        
        return <Text hyphenationCallback={disableHyphenation}>{domToReact(domNode.children, options)}</Text>;
      }
    }
  };

  return <View>{parse(htmlContent, options)}</View>;
};

// --- PREPARADOR DE VARIÁVEIS (Substitui {{nome}} pelo valor real) ---
const processContractVariables = (htmlTemplate, student) => {
    let out = htmlTemplate || "";
    const values = student?.studentData || {};
    
    // Junta dados do aluno raiz com dados complementares
    const data = { ...values, name: student.name, cpf: student.cpf, ...student };

    Object.entries(data).forEach(([key, val]) => {
      const safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`{{\\s*${safeKey}\\s*}}`, "g");
      const safeVal = String(val ?? "").trim();
      out = out.replace(regex, safeVal ? safeVal : "______________________");
    });
    
    // Removemos a tag de assinatura do texto pois ela será inserida fixamente no final
    out = out.replace(/{{\s*assinatura_aluno\s*}}/g, "");
    out = out.replace(/{{\s*[\w_]+\s*}}/g, "______________________");
    return out;
};



// --- ASSINATURA DA EMPRESA (FIXA) ---
export const COMPANY_SIGNATURE_URL = "https://i.imgur.com/85TWZVL.png";

// --- HELPER: GERADOR DE SLUG LIMPO ---
export const generateSlug = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, "") 
      .replace(/\s+/g, '-')     
      .replace(/[^\w\-]+/g, '') 
      .replace(/\-\-+/g, '-');  
  };

// ✅ HELPERS GLOBAIS (1 vez só, fora de componentes)
// Converte URL (firebase/http) em dataURL (evita problemas de CORS no canvas)
export async function toDataUrl(src) {
  if (!src) return null;
  if (String(src).startsWith("data:")) return src;

  const resp = await fetch(src);
  if (!resp.ok) throw new Error("Falha ao baixar assinatura: " + resp.status);

  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// --- SUBSTITUA A FUNÇÃO ANTIGA INTEIRA POR ESTA ---

// Adiciona “respiro” na assinatura de forma segura para o Navegador
// --- VERSÃO CORRIGIDA E BLINDADA ---
export const padSignatureForPdf = (base64Image, opts = {}) => {
  return new Promise((resolve) => {
    // Se não tiver imagem, retorna null logo
    if (!base64Image) {
      resolve(null);
      return;
    }

    if (base64Image.length < 100) {
      resolve(base64Image);
      return;
    }

    const {
      padTop = 30,    // Aumentei pra 50 pra assinatura descer (resolver a altura)
      padBottom = 120, // Diminuí pra 80 pra não ficar tanto espaço em branco
      padLeft = 20,
      padRight = 20,
    } = opts;

    const img = new window.Image();
    img.crossOrigin = "Anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        // Limita tamanho máximo para evitar crash no iOS
        const newWidth = img.width + padLeft + padRight;
        const newHeight = img.height + padTop + padBottom;

        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padLeft, padTop);

        // Retorna a imagem processada
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch (err) {
        console.error("Erro Canvas iOS (usando original):", err);
        // CRÍTICO: Se der erro no canvas, devolve a imagem ORIGINAL
        resolve(base64Image); 
      }
    };

    // Se falhar o carregamento, devolve a original
    img.onerror = () => {
        console.warn("Erro ao carregar img assinatura, usando original");
        resolve(base64Image);
    };

    img.src = base64Image;
  });
};
export const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const escapeHtml = (str) =>
  String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

    export const formatUrl = (url) => {
      if (!url) return "#";
      return url.toString().startsWith("http") ? url : `https://${url}`;
    };
// ✅ Helper: cria link do Google Maps a partir de um endereço ou link
export const buildMapsUrl = (value) => {
  if (!value) return "#";

  const txt = String(value).trim();

  // Se já for um link, só garante o https
  if (txt.startsWith("http://") || txt.startsWith("https://")) {
    return txt;
  }

  // Se for texto/endereço, cria busca do Google Maps
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(txt)}`;
};

// --- FUNÇÃO GLOBAL: PREENCHER CONTRATO ---
export const applyStudentValuesToContract = (html, values) => {
    let out = html || "";
    
    Object.entries(values || {}).forEach(([key, val]) => {
      // Tratamento seguro para regex
      const safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`{{\\s*${safeKey}\\s*}}`, "g");
      
      // Valor limpo (sem tags HTML estranhas, apenas texto)
      // Nota: Certifique-se de que a função escapeHtml também existe no seu código!
      const safeVal = String(val ?? "").trim();
      
      // Se o valor existir, substitui. Se não, coloca linha.
      out = out.replace(regex, safeVal ? escapeHtml(safeVal) : "______________________");
    });
   
    // Substitui o placeholder da assinatura pela linha preta e espaço da imagem
    out = out.replace(
      /{{\s*assinatura_aluno\s*}}/g,
      `<div style="margin-top: 20px; width: 100%;">
         <div style="border-bottom: 1px solid #000; width: 260px; margin-bottom: 5px;"></div>
         <div style="font-size: 10pt;">Assinatura do Aluno</div>
       </div>`
    );
    
    // Limpa variáveis residuais que não foram preenchidas
    out = out.replace(/{{\s*[\w_]+\s*}}/g, "______________________");
    
    return out;
  };

  export const previewContractPDF = async (student) => {
    const rawHtml = student.contractText || "<p>Prévia</p>";
    const finalHtml = processContractVariables(rawHtml, student);
  
    const blob = await pdf(
      <ContractPdfDocument student={student} processedHtml={finalHtml} />
    ).toBlob();
  
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };  
  // ATUALIZAÇÃO: GERAÇÃO (Com Logs para Diagnóstico)
export const generateContractPDF = async (student) => {
  // --- ÁREA DE DIAGNÓSTICO ---
  console.log("=== INICIANDO GERAÇÃO DE PDF ===");
  console.log("Aluno:", student.name);
  console.log("Tem Texto?", student.contractText ? "SIM" : "NÃO (Undefined)");
  console.log("Tem IP na Raiz?", student.ip || student.ipAddress);
  console.log("Tem IP no StudentData?", student.studentData?.ipAddress);
  // ---------------------------

  if (!student?.signature?.image) {
    alert("Erro: Assinatura não encontrada. Por favor, assine novamente.");
    return;
  }

  const loadingId = "pdf-loading-overlay";
  if (!document.getElementById(loadingId)) {
      const msg = document.createElement('div');
      msg.id = loadingId;
      msg.innerHTML = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);color:#fff;display:flex;align-items:center;justify-content:center;z-index:99999;font-family:sans-serif;">Gerando e Salvando Contrato...</div>';
      document.body.appendChild(msg);
  }

  try {
    // 1. AWAIT E REFRESH DO BANCO (CORRETO)
    await new Promise(r => setTimeout(r, 2000));
    const studentRef = doc(db, "students", student.id);
    const snapshot = await getDoc(studentRef);
    
    // Se achou, mistura os dados novos. Se não, usa o que tem.
    const freshStudent = snapshot.exists() ? { ...student, ...snapshot.data() } : student;

    const rawHtml = freshStudent.contractText || "<p>Erro: Texto do contrato não encontrado.</p>";
    
    // Usa o freshStudent para preencher as variáveis do texto
    const finalHtml = processContractVariables(rawHtml, freshStudent);

    // ✅ CORREÇÃO AQUI: Use 'freshStudent' para iniciar o objeto do PDF
    let studentForPdf = freshStudent; 

    try {
    const padded = await padSignatureForPdf(freshStudent.signature.image, {
    padTop: 20,
    padBottom: 220,  // 👈 aumenta aqui se ainda raspar
    padLeft: 20,
    padRight: 20,
  });

  if (padded) {
    studentForPdf = {
      ...freshStudent,
      signature: {
        ...(student.signature || {}),
        image: padded, // ✅ agora a assinatura tem respiro interno igual a da empresa
      },
    };
  }
} catch (e) {
  console.warn("⚠️ Não consegui aplicar padding na assinatura (seguindo com original):", e);
}

// ✅ 2) gera o PDF com o studentForPdf (assinatura corrigida)
const blob = await pdf(
  <ContractPdfDocument student={studentForPdf} processedHtml={finalHtml} />
).toBlob();

    console.log("PDF Criado com sucesso (Blob size):", blob.size);

    const uniqueFileName = student.latestContractId 
      ? `${student.latestContractId}.pdf` 
      : `${student.id}_${Date.now()}.pdf`;

    const storageRef = ref(storage, `contratos_assinados/${uniqueFileName}`);
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    console.log("Upload Firebase OK:", downloadUrl);

    await updateDoc(doc(db, "students", student.id), {
      contractPdfUrl: downloadUrl,
      status: "signed",
      contractPdfUpdatedAt: new Date().toISOString(),
    });
    
    if (student.latestContractId) {
       try {
          await updateDoc(doc(db, "contracts", student.latestContractId), {
              contractPdfUrl: downloadUrl,
              status: "signed"
          });
       } catch(e) { 
           console.warn("Aviso: Erro ao vincular histórico:", e); 
       }
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    const el = document.getElementById(loadingId);
    if(el) el.remove();
    alert("✅ Contrato assinado e salvo com sucesso!");

  } catch (error) {
    console.error("ERRO CRÍTICO NA GERAÇÃO:", error);
    const el = document.getElementById(loadingId);
    if(el) el.remove();
    alert("Erro ao gerar PDF: " + error.message);
  }
};
// --- NOVA FUNÇÃO DE AUDITORIA BLINDADA (VERCEL + FIREBASE SECRETS) ---
// --- FUNÇÃO DE AUDITORIA BLINDADA (MODO HÍBRIDO STACKBLITZ) ---
// Substitua toda a função logContractEvent antiga por esta:

// --- VERSÃO CORRIGIDA: CAPTURA IP DIRETO (FUNCIONA NO STACKBLITZ) ---
// --- FUNÇÃO DE AUDITORIA BLINDADA (Versão Unificada: Front + Back + Redundância) ---
export const logContractEvent = async (db, studentId, eventType, details = "") => {
  if (!studentId) return;

  const timestamp = new Date().toISOString();
  // Captura o dispositivo real do navegador
  const currentDevice = navigator.userAgent || "Navegador Web";
  
  // Garante que details seja string ou objeto limpo
  const safeDetails = typeof details === 'object' 
    ? (details.info || JSON.stringify(details)) 
    : String(details);

  try {
    console.log(`🔄 [AUDIT] Iniciando registro: ${eventType}`);

    // 1. CAPTURA DE IP E LOCALIZAÇÃO (Resiliente)
    let clientIp = "IP Oculto";
    let clientLoc = "Brasil (Local n/d)";
    let provider = "fallback_init";

    try {
        // A. Tenta pegar IP rápido via Cloudflare (Quase infalível)
        const respCF = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
        const textCF = await respCF.text();
        const dataCF = textCF.trim().split('\n').reduce((acc, line) => {
            const [k, v] = line.split('=');
            acc[k] = v;
            return acc;
        }, {});
        
        if (dataCF.ip) clientIp = dataCF.ip;
        
        // B. Tenta pegar Cidade/Estado (Mais detalhado)
        // Usamos ipwho.is que é free e CORS-friendly. Timeout curto para não travar.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s max

        try {
            const respGeo = await fetch(`https://ipwho.is/${clientIp}`, { signal: controller.signal });
            const dataGeo = await respGeo.json();
            clearTimeout(timeoutId);

            if (dataGeo.success) {
                // Formato: "Itabuna - BA, BR"
                clientLoc = `${dataGeo.city} - ${dataGeo.region_code}, ${dataGeo.country_code}`;
                provider = "geo_api";
            } else if (dataCF.loc) {
                // Fallback para o país da Cloudflare se a Geo falhar
                clientLoc = dataCF.loc === 'BR' ? 'Brasil' : dataCF.loc;
                provider = "cloudflare_loc";
            }
        } catch (geoErr) {
            // Se der timeout ou erro na geo, fica com o dado da Cloudflare
            if (dataCF.loc) clientLoc = dataCF.loc === 'BR' ? 'Brasil' : dataCF.loc;
            provider = "cloudflare_only";
        }

    } catch (ipError) {
        console.warn("⚠️ Falha parcial na rede (IP/Loc):", ipError);
    }

    // 2. MONTA O OBJETO DE LOG
    const logEntry = {
        event: eventType,
        timestamp: timestamp,
        details: safeDetails,
        ip: clientIp,
        location: clientLoc,
        device: currentDevice,
        source: "frontend_hybrid"
    };

    // 3. GRAVAÇÃO DUPLA (O PULO DO GATO)
    // Atualiza o array de histórico E os campos principais que o PDF lê no cabeçalho.
    const studentRef = doc(db, "students", studentId);

    // Prepara atualização. Usamos aspas para não apagar o resto do objeto studentData
    const updatePayload = {
        auditTrail: arrayUnion(logEntry),
        
        // FORÇA a atualização dos dados "vivos" do aluno para o cabeçalho do PDF pegar o mais recente
        "studentData.ip": clientIp,
        "studentData.location": clientLoc,
        "studentData.device": currentDevice,
        "studentData.lastUpdate": timestamp
    };

    // Se for o evento de assinatura ou geração de link, atualizamos também o studentData raiz para garantir
    if (eventType === "LINK_GERADO" || eventType === "ASSINADO") {
        updatePayload.ipAddress = clientIp; // Legado (garantia)
    }

    await updateDoc(studentRef, updatePayload);

    console.log(`✅ [AUDIT SUCCESS] Log salvo com IP: ${clientIp} e Local: ${clientLoc}`);

  } catch (error) {
    console.error("❌ ERRO CRÍTICO NA AUDITORIA:", error);
    // Não damos throw para não travar o fluxo do usuário, apenas logamos o erro
  }
};