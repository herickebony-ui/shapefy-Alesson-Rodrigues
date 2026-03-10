import React, { useState, useEffect } from 'react';
import { getAuth, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Importando do seu arquivo local
import { User, Mail, Lock, Save, Send, ShieldCheck, AlertCircle } from 'lucide-react';

const ProfileModule = () => {
  const auth = getAuth();
  const user = auth.currentUser;

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [userRole, setUserRole] = useState('Carregando...');

  // Ao abrir, verifica qual é o cargo desse usuário no banco de dados
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserRole(data.role === 'admin' ? 'Administrador' : 'Consultor');
        } else {
            // Se o usuário é novo, cria como CONSULTOR por padrão
            await setDoc(userRef, {
              email: user.email,
              name: user.displayName || 'Novo Usuário',
              role: 'consultant', // <--- MUDAR AQUI (antes estava 'admin')
              createdAt: new Date().toISOString()
            });
            setUserRole('Consultor');          
        }
      } catch (error) {
        console.error("Erro ao buscar role:", error);
        setUserRole('Desconhecido');
      }
    };
    fetchUserRole();
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // 1. Atualiza no Auth (Login)
      await updateProfile(user, { displayName });
      
      // 2. Atualiza no Firestore (Banco de Dados de Usuários)
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { name: displayName });

      setMessage({ type: 'success', text: 'Dados atualizados com sucesso!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao atualizar: ' + error.message });
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!window.confirm("Quer receber um e-mail para criar uma nova senha?")) return;
    
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage({ type: 'success', text: `E-mail enviado para ${user.email}. Verifique sua caixa de entrada.` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao enviar e-mail: ' + error.message });
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto mt-8">
      {/* Cabeçalho */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <User size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Meu Perfil</h2>
              <p className="text-sm text-gray-500">Gerencie suas credenciais de acesso</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100">
            <ShieldCheck size={14} />
            {userRole}
          </div>
        </div>

        <div className="p-8">
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.type === 'success' ? <ShieldCheck size={18}/> : <AlertCircle size={18}/>}
              {message.text}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Coluna da Esquerda: Dados Básicos */}
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail de Acesso</label>
                <div className="flex items-center gap-3 p-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed">
                  <Mail size={18} />
                  <span>{user?.email}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">O e-mail não pode ser alterado por aqui.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <div className="relative">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Seu nome"
                  />
                  <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-70"
              >
                <Save size={18} />
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>

            {/* Coluna da Direita: Segurança */}
            <div className="border-l border-gray-100 pl-8 flex flex-col justify-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Lock size={18} className="text-gray-500"/> Segurança
              </h3>
              
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800 leading-relaxed">
                  Para sua segurança, não armazenamos senhas diretamente. Clique abaixo para receber um link seguro de redefinição.
                </p>
              </div>

              <button
                onClick={handleResetPassword}
                className="group flex items-center justify-center gap-2 w-full bg-white border border-gray-300 text-gray-700 p-3 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-400 transition-all"
              >
                <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                Redefinir Minha Senha
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModule;