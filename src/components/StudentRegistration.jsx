import React, { useState } from 'react';
import { collection, doc, setDoc, query, where, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { CheckCircle, Loader } from 'lucide-react';
import { db, app } from '../firebase';
import StudentBadge from './StudentBadge';

// --- NOVO COMPONENTE: PRÉ-CADASTRO PÚBLICO ---
const StudentRegistration = ({ db }) => {
  const [formData, setFormData] = useState({
    name: "", cpf: "", rg: "", email: "", phone: "", cep: "", street: "", number: "", neighborhood: "", city: "", state: "", complement: "",
    address: "", profession: "", birthDate: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Novos estados
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isSameNumber, setIsSameNumber] = useState(true);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCepBlur = async (e) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (!d.erro) setFormData(prev => ({ ...prev, street: d.logradouro, neighborhood: d.bairro, city: d.localidade, state: d.uf }));
    } catch (e) { console.error(e); }
  };

  // Função auxiliar de limpeza (pode colocar dentro ou fora do componente)
  const cleanPhone = (phone) => {
    let cleaned = phone.replace(/\D/g, ''); 
    if (cleaned.startsWith('55') && cleaned.length > 11) {
      cleaned = cleaned.substring(2); 
    }
    return cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // --- NOVA VERIFICAÇÃO DE CAMPOS OBRIGATÓRIOS ---
    const requiredFields = [
      { key: 'name', label: 'Nome Completo' },
      { key: 'cpf', label: 'CPF' },
      { key: 'rg', label: 'RG' },
      { key: 'email', label: 'E-mail' },
      { key: 'phone', label: 'Celular' },
      { key: 'profession', label: 'Profissão' },
      { key: 'birthDate', label: 'Data de Nascimento' }
    ];
  
    // Verifica campos básicos do formData
    for (const field of requiredFields) {
      if (!formData[field.key] || formData[field.key].trim() === "") {
        alert(`O campo ${field.label} é obrigatório!`);
        return; // Bloqueia o envio
      }
    }
  
    // Verifica endereço (Garante que ou o CEP/Rua ou o campo de endereço manual existam)
    if (!formData.address && (!formData.cep || !formData.street || !formData.number)) {
      alert("Por favor, preencha os dados de Endereço!");
      return;
    }
    // 1. Validação de Data de Nascimento (Mantida)
    const dateParts = formData.birthDate.split('/');
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const year = parseInt(dateParts[2]);
    const currentYear = new Date().getFullYear();

    if (
        formData.birthDate.length !== 10 || 
        day < 1 || day > 31 ||              
        month < 1 || month > 12 ||          
        year < 1900 || year > currentYear   
    ) {
      alert("Data de Nascimento inválida! Por favor, verifique.");
      return; 
    }
    
    setLoading(true);

    // --- NOVA VERIFICAÇÃO DE DUPLICIDADE ---
    try {
      const cleanedNewPhone = cleanPhone(formData.phone);
      
      // Criamos uma consulta para buscar se já existe esse número limpo
      const q = query(
        collection(db, "students"), 
        where("phone", "==", cleanedNewPhone)
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        alert("Identificamos que você já possui um cadastro conosco. Por favor, aguarde o contato da nossa equipe via WhatsApp.");
        setLoading(false);
        return; // ⛔ Bloqueia o envio
      }
    } catch (err) {
      console.error("Erro na verificação:", err);
    }
    // ---------------------------------------

    const formattedAddress = formData.street
      ? `${formData.street}, ${formData.number}, ${formData.neighborhood}, ${formData.city} - ${formData.state}, CEP: ${formData.cep}`
      : formData.address;

    const finalWhatsapp = isSameNumber ? formData.phone : whatsapp;

    // --- CORREÇÃO DE DATA DE NASCIMENTO ---
    // Converte de DD/MM/AAAA para AAAA-MM-DD (Padrão internacional aceito pelo Admin)
    const [dia, mes, ano] = formData.birthDate.split('/');
    const birthDateISO = `${ano}-${mes}-${dia}`;
    // ---------------------------------------

    try {
      // 1. Cria no Frappe
      const fns = getFunctions(app);
      const criarAlunoFrappe = httpsCallable(fns, 'criarAlunoFrappe');

      const resultFrappe = await criarAlunoFrappe({
        nome_completo: formData.name.trim(),
        email: formData.email,
        telefone: cleanPhone(formData.phone),
        profissao: formData.profession,
        endereco: formattedAddress,
        birthDate: birthDateISO,
      });

      if (!resultFrappe.data?.success) throw new Error("Falha ao criar aluno no Frappe.");
      const alunoId = resultFrappe.data.alunoId;

      // 2. Cria no Firebase com ID do Frappe
      await setDoc(doc(db, "students", alunoId), {
        ...formData,
        birthDate: birthDateISO,
        address: formattedAddress,
        phone: cleanPhone(formData.phone),
        whatsapp: cleanPhone(finalWhatsapp),
        status: 'em_analise',
        createdAt: new Date().toISOString(),
        planId: null,
        templateId: null
      });

      setSuccess(true);
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };
  // Função para criar a máscara de Data (DD/MM/AAAA)
  const handleDateMask = (e) => {
    let value = e.target.value.replace(/\D/g, ""); 
    if (value.length > 8) value = value.slice(0, 8); 

    if (value.length >= 5) {
      value = value.replace(/(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3");
    } else if (value.length >= 3) {
      value = value.replace(/(\d{2})(\d{1,6})/, "$1/$2");
    }

    // Atualiza o estado
    setFormData(prev => ({ ...prev, birthDate: value }));
  };  
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ebony-bg p-4">
        <div className="bg-ebony-surface border border-ebony-border p-8 rounded-2xl shadow-2xl text-center max-w-md animate-in zoom-in duration-300">
          
          {/* Ícone Sucesso Neon */}
          <div className="w-16 h-16 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
            <CheckCircle className="w-8 h-8" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Cadastro Recebido!</h2>
          <p className="text-ebony-muted">
            Recebemos seus dados com sucesso. Nossa equipe vai analisar e entrará em contato pelo WhatsApp em breve para a assinatura do contrato.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ebony-bg py-10 px-4 font-sans flex items-center justify-center">
      <div className="max-w-2xl w-full bg-ebony-surface rounded-2xl shadow-2xl overflow-hidden border border-ebony-border animate-in fade-in slide-in-from-bottom-4">
        
        {/* Cabeçalho */}
        <div className="bg-ebony-deep p-6 border-b border-ebony-border text-center">
          <h1 className="text-2xl font-bold text-white">Ficha de Cadastro</h1>
          <p className="text-ebony-muted text-sm mt-1">Preencha seus dados para iniciar a consultoria</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* --- 1. CAMPO NOME --- */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Nome Completo *</label>
              <input 
                name="name" 
                required 
                value={formData.name} 
                onChange={handleChange} 
                className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-xl text-white outline-none focus:border-ebony-primary transition-colors placeholder-gray-600" 
                placeholder="Seu nome completo" 
              />
            </div>              

            {/* --- BLOCO NOVO DE TELEFONE --- */}
            <div className="md:col-span-2 space-y-3">
              <div>
                <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Celular (Login e SMS) *</label>
                <input 
                  name="phone" 
                  type="tel" 
                  required 
                  value={formData.phone} 
                  onChange={(e) => {
                    handleChange(e);
                    if (isSameNumber) setWhatsapp(""); 
                  }} 
                  className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-xl text-white outline-none focus:border-ebony-primary transition-colors placeholder-gray-600" 
                  placeholder="(00) 90000-0000" 
                />
              </div>

              {/* CHECKBOX */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="same_number_check"
                  checked={isSameNumber}
                  onChange={(e) => setIsSameNumber(e.target.checked)}
                  // Checkbox estilizado (accent-color)
                  className="w-4 h-4 accent-ebony-primary bg-ebony-deep border-ebony-border rounded cursor-pointer"
                />
                <label htmlFor="same_number_check" className="text-xs text-ebony-muted cursor-pointer select-none hover:text-white transition-colors">
                  Este número também é meu WhatsApp
                </label>
              </div>

              {/* CAMPO EXTRA (SÓ APARECE SE DESMARCAR) */}
              {!isSameNumber && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-green-500 uppercase mb-1">Número do WhatsApp *</label>
                  <input 
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    // Borda Verde Neon para destaque, mas fundo Dark
                    className="w-full p-3 bg-ebony-deep border border-green-900 text-white rounded-xl outline-none focus:border-green-500 focus:ring-1 focus:ring-green-900 transition-colors placeholder-gray-600" 
                    placeholder="Número exclusivo para WhatsApp" 
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">CPF *</label>
              <input name="cpf" required value={formData.cpf} onChange={handleChange} className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-xl text-white outline-none focus:border-ebony-primary transition-colors placeholder-gray-600" placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">RG *</label>
              <input name="rg" required value={formData.rg} onChange={handleChange} className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-xl text-white outline-none focus:border-ebony-primary transition-colors placeholder-gray-600" placeholder="Registro Geral" />
            </div>

            <div>
              <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Data de Nascimento *</label>
              <input
                type="tel"
                name="birthDate"
                placeholder="DD/MM/AAAA"
                maxLength={10}
                value={formData.birthDate || ""}
                onChange={handleDateMask}
                className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-xl text-white outline-none focus:border-ebony-primary transition-colors placeholder-gray-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">Profissão *</label>
              <input name="profession" required value={formData.profession} onChange={handleChange} className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-xl text-white outline-none focus:border-ebony-primary transition-colors placeholder-gray-600" placeholder="Sua profissão" />
            </div>

            {/* BLOCO DE ENDEREÇO */}
            <div className="md:col-span-2 bg-ebony-deep/30 p-4 rounded-xl border border-ebony-border">
              <label className="text-xs font-bold text-ebony-muted uppercase mb-2 block">Endereço (Busca Automática)</label>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <input name="cep" placeholder="CEP" required value={formData.cep} onChange={handleChange} onBlur={handleCepBlur} className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white outline-none focus:border-ebony-primary placeholder-gray-600" />
                </div>
                <div className="col-span-3">
                  <input name="street" placeholder="Rua" required value={formData.street} onChange={handleChange} className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white outline-none focus:border-ebony-primary placeholder-gray-600" />
                </div>
                <div className="col-span-1">
                  <input name="number" placeholder="Nº" required value={formData.number} onChange={handleChange} className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white outline-none focus:border-ebony-primary placeholder-gray-600" />
                </div>
                <div className="col-span-3">
                  <input name="neighborhood" placeholder="Bairro" value={formData.neighborhood} onChange={handleChange} className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-lg text-white outline-none focus:border-ebony-primary placeholder-gray-600" />
                </div>
                {/* Cidade e UF desabilitados visualmente (read-only style) */}
                <div className="col-span-3">
                  <input name="city" placeholder="Cidade" value={formData.city} onChange={handleChange} className="w-full p-3 bg-ebony-deep/50 border border-ebony-border rounded-lg text-ebony-muted outline-none cursor-not-allowed" />
                </div>
                <div className="col-span-1">
                  <input name="state" placeholder="UF" value={formData.state} onChange={handleChange} className="w-full p-3 bg-ebony-deep/50 border border-ebony-border rounded-lg text-ebony-muted outline-none cursor-not-allowed" />
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-ebony-muted uppercase mb-1">E-mail *</label>
              <input name="email" type="email" required value={formData.email} onChange={handleChange} className="w-full p-3 bg-ebony-deep border border-ebony-border rounded-xl text-white outline-none focus:border-ebony-primary transition-colors placeholder-gray-600" placeholder="seu@email.com" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-ebony-primary text-white rounded-xl font-bold hover:bg-red-900 transition-all flex items-center justify-center gap-2 shadow-lg mt-4 active:scale-95 disabled:opacity-50">
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : "Enviar Cadastro"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StudentRegistration;