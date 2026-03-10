import React, { useState, useEffect } from 'react';
import { auth } from "../firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { logContractEvent } from '../utils/utils'; // Ajuste o caminho se necessário
import { db } from '../firebase'; // Precisa do db para salvar
import { Lock, Smartphone, Loader, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

const SecurityModal = ({ isOpen, onClose, studentPhone, onVerified, studentId }) => {
  const [step, setStep] = useState('initial'); // initial -> verify -> success
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recaptchaReady, setRecaptchaReady] = useState(false);

  // --- CORREÇÃO: Inicialização Única do Recaptcha ao Abrir ---
  useEffect(() => {
    if (!isOpen) return;

    const clearRecaptcha = () => {
      const container = document.getElementById('recaptcha-container');
      if (container) container.innerHTML = ''; 
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch(e) {}
        window.recaptchaVerifier = null;
      }
    };

    clearRecaptcha(); // Limpa resíduos anteriores

    try {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => console.log("Recaptcha validado"),
        'expired-callback': () => {
          setError('Sessão expirada. Reabra a janela.');
          setLoading(false);
        }
      });
      setRecaptchaReady(true);
    } catch (err) {
      if (err.message.includes('already been rendered')) {
         clearRecaptcha(); // Tenta recuperar se der erro
      }
    }

    return () => {
      setRecaptchaReady(false);
      clearRecaptcha();
    };
  }, [isOpen]);
  
  const handleSendCode = async () => {
    if (!studentPhone) {
      setError("Telefone não encontrado.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!window.recaptchaVerifier || !recaptchaReady) {
        throw new Error("Sistema de segurança carregando... Aguarde um segundo e tente novamente.");
      }

      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, studentPhone, appVerifier);
      
      setConfirmationResult(confirmation);
      setStep('verify');
      setLoading(false);
      
      if (studentId) {
        const tail = studentPhone ? studentPhone.slice(-4) : "****";
        logContractEvent(db, studentId, "OTP_ENVIADO", `Celular final: ${tail}`);
     }

    } catch (err) {
      console.error("ERRO SMS:", err);
      setLoading(false);
      
      if (err.code === 'auth/invalid-phone-number') {
        setError('Número inválido. Use formato +55DD9XXXXXXXX');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Bloqueio temporário do Google.');
      } else {
        setError('Erro ao enviar. Tente novamente.');
      }
    }
  };


  const handleVerify = async () => {
    if (otp.length < 6) return;
    setLoading(true);
    setError('');

    try {
      await confirmationResult.confirm(otp);
      if (studentId) {
        logContractEvent(db, studentId, "OTP_VALIDADO", "Sucesso: Código SMS confirmado pelo usuário.");
    }  
      
      setStep('success');
      setLoading(false);
      
      setTimeout(() => {
        onVerified();
        // Não fechamos aqui imediatamente, deixamos o App.jsx fechar 
        // ou fechamos manual se preferir, mas o ideal é o onVerified cuidar disso
      }, 1500);

    } catch (err) {
      console.error(err);
      setLoading(false);
      setError('Código incorreto. Verifique e tente novamente.');
    }
  };

  return (
    <div translate="no" className="notranslate fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-ebony-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative border border-ebony-border">
        
        {/* ESSENCIAL: O Container do Recaptcha precisa existir no HTML */}
        <div id="recaptcha-container"></div>

        {/* Header - Dark Deep */}
        <div className="bg-ebony-deep p-6 border-b border-ebony-border flex items-center gap-3">
          <div className="w-10 h-10 bg-ebony-primary text-white rounded-lg flex items-center justify-center shadow-lg shadow-red-900/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Assinatura Digital</h2>
            <p className="text-xs text-ebony-muted">Validação via SMS</p>
          </div>
        </div>

        <div className="p-8">
          
          {/* PASSO 1: Enviar Código */}
          {step === 'initial' && (
            <div className="text-center">
              {/* Ícone Tech Neon Blue */}
              <div className="w-16 h-16 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                <Smartphone className="w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">Validar Celular</h3>
              <p className="text-ebony-muted mb-6 text-sm">
                Enviaremos um código para o número:<br/>
                <span className="font-bold text-white text-lg mt-1 block tracking-wider">{studentPhone}</span>
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 text-red-400 text-xs rounded-lg flex items-center justify-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <button 
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading || !recaptchaReady}
                  className="w-full bg-ebony-primary hover:bg-red-900 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95"
                >
                {loading ? <Loader className="animate-spin w-5 h-5" /> : (
                  <>
                  <span translate="no" className="notranslate">
                    {!recaptchaReady ? "Carregando..." : "Enviar Código SMS"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
                )}
              </button>
              
              <button type="button" onClick={onClose} className="mt-4 text-xs text-ebony-muted hover:text-white underline transition-colors">
                Cancelar
              </button>
            </div>
          )}

          {/* PASSO 2: Digitar Código */}
          {step === 'verify' && (
            <div className="text-center animate-in slide-in-from-right">
              <h3 className="text-xl font-bold text-white mb-2">Digite o código</h3>
              <p className="text-ebony-muted mb-6 text-sm">
                Enviado para <strong>{studentPhone}</strong>
              </p>

              <div className="mb-6">
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  // Input Estilizado Dark com espaçamento largo
                  className="w-full text-center text-3xl font-bold tracking-[0.5em] p-4 bg-ebony-deep border-2 border-ebony-border text-white rounded-xl focus:border-green-500 focus:ring-0 outline-none transition-all placeholder-gray-700"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 text-red-400 text-xs rounded-lg flex items-center justify-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

                <button 
                  type="button"
                  onClick={handleVerify}
                  disabled={otp.length < 6 || loading}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-900/20"
                >
                {loading ? <Loader className="animate-spin w-5 h-5" /> : "Confirmar Código"}
              </button>
              
              <button 
                type="button"
                onClick={() => setStep('initial')} 
                className="w-full text-xs text-ebony-muted hover:text-white mt-4 underline transition-colors"
              >
                Voltar e reenviar o código
              </button>
            </div>
          )}

          {/* PASSO 3: Sucesso */}
          {step === 'success' && (
            <div className="text-center py-4 animate-in zoom-in">
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4 animate-bounce drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <h3 className="text-2xl font-bold text-white">Sucesso!</h3>
              <p className="text-ebony-muted mt-2">Identidade confirmada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityModal;