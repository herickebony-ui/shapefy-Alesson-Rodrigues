import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Users, Shield, Trash2, UserCheck, Briefcase, Phone, Save } from 'lucide-react';

const TeamModule = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error("Erro ao buscar equipe:", error);
      alert("Erro ao carregar equipe.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- 1. FUNÇÃO DE LIMPEZA DO TELEFONE ---
  // Mantém apenas números para salvar limpo no banco (padrão 55...)
  const cleanPhone = (value) => {
    return value.replace(/\D/g, "");
  };

  // --- 2. ATUALIZA O ESTADO LOCAL ENQUANTO DIGITA ---
  const handlePhoneChange = (userId, rawValue) => {
    const numericValue = cleanPhone(rawValue);
    
    // Atualiza a lista visualmente na hora
    setUsers(prevUsers => prevUsers.map(user => 
      user.id === userId ? { ...user, whatsapp: numericValue } : user
    ));
  };

  // --- 3. SALVA NO FIREBASE QUANDO CLICA FORA (ONBLUR) ---
  const handlePhoneSave = async (user) => {
    try {
        // Se estiver vazio, não faz nada ou salva vazio mesmo
        await updateDoc(doc(db, 'users', user.id), { 
            whatsapp: user.whatsapp || "" 
        });
        // Feedback visual sutil (opcional, pode ser um toast)
        console.log(`WhatsApp de ${user.name} salvo: ${user.whatsapp}`);
    } catch (error) {
        alert("Erro ao salvar telefone: " + error.message);
    }
  };

  const handleRoleChange = async (user, newRole) => {
    if (newRole === user.role) return;

    if (newRole !== 'admin' && user.role === 'admin') {
      if (!window.confirm(`ATENÇÃO: Você está tirando os poderes de Admin de ${user.name}. Tem certeza?`)) {
        fetchUsers();
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'users', user.id), { role: newRole });
      alert(`Cargo de ${user.name} alterado para ${newRole.toUpperCase()}!`);
      fetchUsers();
    } catch (error) {
      alert("Erro ao atualizar: " + error.message);
    }
  };

  const removeUserFromDb = async (id) => {
    if (!window.confirm("Isso removerá as permissões deste usuário. Continuar?")) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      fetchUsers();
    } catch (error) {
      alert("Erro: " + error.message);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 bg-ebony-primary/20 text-white px-2 py-1 rounded-full text-xs font-bold border border-ebony-primary/40">
            <Shield size={12} /> Admin
          </span>
        );
      case 'secretary':
        return (
          <span className="inline-flex items-center gap-1 bg-ebony-deep text-white px-2 py-1 rounded-full text-xs font-bold border border-amber-500/25">
            <Briefcase size={12} /> Secretária
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-ebony-deep text-white px-2 py-1 rounded-full text-xs font-bold border border-sky-500/25">
            <UserCheck size={12} /> Consultor
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in bg-ebony-bg text-ebony-text">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-ebony-primary" /> Gestão de Equipe
          </h2>
          <p className="text-ebony-muted text-sm">Administre cargos e contatos para notificações.</p>
        </div>

        <button
          onClick={fetchUsers}
          className="px-3 py-2 rounded-lg text-xs font-bold bg-transparent border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-surface transition-colors"
        >
          Atualizar Lista
        </button>
      </div>

      <div className="bg-ebony-surface rounded-xl shadow-sm border border-ebony-border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-ebony-deep border-b border-ebony-border">
            <tr>
              <th className="p-4 text-xs font-bold text-ebony-muted uppercase tracking-wider">Nome / Email</th>
              {/* NOVA COLUNA */}
              <th className="p-4 text-xs font-bold text-ebony-muted uppercase tracking-wider">WhatsApp (Notificações)</th>
              <th className="p-4 text-xs font-bold text-ebony-muted uppercase tracking-wider">Cargo Atual</th>
              <th className="p-4 text-xs font-bold text-ebony-muted uppercase tracking-wider">Alterar Cargo</th>
              <th className="p-4 text-xs font-bold text-ebony-muted uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-ebony-border">
            {loading ? (
              <tr>
                <td colSpan="5" className="p-6 text-center text-ebony-muted">
                  Carregando...
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr
                  key={user.id}
                  className="border-b border-ebony-border hover:bg-ebony-border/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="font-bold text-white">{user.name || "Sem nome"}</div>
                    <div className="text-xs text-ebony-muted">{user.email}</div>
                  </td>

                  {/* --- CAMPO DE WHATSAPP --- */}
                  <td className="p-4">
                    <div className="flex items-center gap-2 bg-ebony-deep/50 border border-ebony-border rounded-lg px-2 py-1.5 focus-within:border-ebony-primary transition-colors w-48">
                        <Phone size={14} className="text-ebony-muted shrink-0" />
                        <input 
                            type="text" 
                            placeholder="55..."
                            className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-ebony-muted/50 font-mono"
                            value={user.whatsapp || ''}
                            onChange={(e) => handlePhoneChange(user.id, e.target.value)}
                            onBlur={() => handlePhoneSave(user)}
                        />
                    </div>
                    {(!user.whatsapp || user.whatsapp.length < 10) && (
                        <p className="text-[9px] text-red-400 mt-1 pl-1">Necessário p/ notificações</p>
                    )}
                  </td>

                  <td className="p-4">
                    {getRoleBadge(user.role)}
                  </td>

                  <td className="p-4">
                    <select
                      value={user.role || 'consultant'}
                      onChange={(e) => handleRoleChange(user, e.target.value)}
                      className="p-2 bg-ebony-deep border border-ebony-border text-white rounded-lg shadow-sm focus:border-ebony-primary outline-none cursor-pointer text-sm font-bold hover:bg-ebony-surface transition-colors"
                    >
                      <option value="consultant">Consultor</option>
                      <option value="secretary">Secretária</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>

                  <td className="p-4 text-right">
                    <button
                      onClick={() => removeUserFromDb(user.id)}
                      className="p-2 text-ebony-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remover acesso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid md:grid-cols-3 gap-4">
        <div className="p-3 bg-ebony-surface border border-ebony-border rounded-lg text-xs text-ebony-muted">
          <strong className="text-white">Dica:</strong> Insira o número com DDD e DDI (Ex: 5571999999999) para garantir o envio.
        </div>
      </div>
    </div>
  );
};

export default TeamModule;