import React, { useRef, useEffect, useState } from 'react';
import html2canvas from 'html2canvas';
import { Loader } from 'lucide-react';

const ElectronicSignature = ({ studentName, onSignatureGenerated }) => {
  const signatureRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(true);
  // Opcional: estado local para debug visual se necessário
  // const [previewUrl, setPreviewUrl] = useState(null);

  // Este efeito roda toda vez que o nome do aluno muda ou o componente monta
  useEffect(() => {
    const generateSignatureImage = async () => {
      if (!signatureRef.current || !studentName) return;

      setIsGenerating(true);
      try {
        // 1. Garante que as fontes do Google carregaram antes de "tirar o print"
        await document.fonts.ready;

        // 2. Pequeno delay para garantir a renderização do DOM
        await new Promise(resolve => setTimeout(resolve, 100));

        // 3. Converte a DIV em uma imagem (canvas)
        const canvas = await html2canvas(signatureRef.current, {
          backgroundColor: null, // Fundo transparente importante para o PDF
          scale: 3, // Alta resolução para ficar nítido no PDF
          logging: false, // Desativa logs no console
          useCORS: true, // Ajuda com fontes externas
          width: signatureRef.current.offsetWidth,
          height: signatureRef.current.offsetHeight,
        });

        // 4. Converte o canvas em uma URL de imagem PNG (Data URL)
        const dataUrl = canvas.toDataURL('image/png');

        // setPreviewUrl(dataUrl); // Para debug apenas

        // 5. Envia a imagem gerada "para cima", para o formulário pai (StudentRegistrationForm)
        if (onSignatureGenerated) {
            // Passamos o dataUrl e também o tipo para manter compatibilidade
            onSignatureGenerated({
                dataUrl: dataUrl,
                type: 'electronic_cursive'
            });
            // console.log("Assinatura cursiva gerada com sucesso");
        }

      } catch (error) {
        console.error("Erro ao gerar imagem da assinatura:", error);
        alert("Houve um problema ao gerar a visualização da assinatura. Tente recarregar.");
      } finally {
        setIsGenerating(false);
      }
    };

    // Só gera se tiver um nome para assinar
    if (studentName && studentName.trim().length > 0) {
        generateSignatureImage();
    }
  }, [studentName, onSignatureGenerated]); // Recria se o nome mudar

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Assinatura Eletrônica
      </label>

      {/* Área de Visualização da Assinatura */}
      <div className="relative p-4 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-xl flex flex-col items-center justify-center min-h-[120px]">

        {isGenerating && (
           <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-xl">
             <Loader className="w-6 h-6 text-blue-600 animate-spin" />
             <span className="text-sm text-blue-600 ml-2 font-bold">Gerando assinatura...</span>
           </div>
        )}

        {/* ESTA É A DIV QUE VIRA IMAGEM (FONTE CURSIVA) */}
        <div
          ref={signatureRef}
          style={{
            // --- MUDANÇAS AQUI ---
            fontFamily: "'Mr De Havilland', cursive", // Nova fonte mais inclinada
            color: "#000000", // Preto puro
            fontSize: "2.5rem", // Aumentei o tamanho para compensar a fonte nova
            // ---------------------
            width: 520, 
            padding: "10px 40px",
            whiteSpace: "nowrap",
            lineHeight: "1.25",
            paddingBottom: "18px",            
            textAlign: "center"           
          }}
          className="select-none pointer-events-none"
        >
          {studentName || "Nome do Aluno"}
        </div>

        {/* Linha abaixo da assinatura */}
        <div className="w-2/3 border-b-2 border-blue-200 mt-2"></div>
        <p className="text-[10px] text-blue-600 mt-2 uppercase font-bold tracking-wider">
            Assinado Eletronicamente
        </p>
      </div>

      <p className="text-xs text-gray-500 text-center bg-white p-2 rounded border border-gray-100">
        <span className="font-bold">Confirmação:</span> Esta representação visual do seu nome será utilizada como sua assinatura válida neste contrato digital.
      </p>
      {/* DEBUG: Se quiser ver a imagem gerada que vai pro PDF, descomente abaixo */}
      {/* {previewUrl && <img src={previewUrl} alt="Preview gerado" style={{border: '1px solid red', width: 200}} />} */}
    </div>
  );
};

export default ElectronicSignature;