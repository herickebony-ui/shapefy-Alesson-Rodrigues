import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions as functionsInstance } from '../firebase';
const fnExcluirMembro = httpsCallable(functionsInstance, 'excluirMembroEquipe');
import {
  Users, Shield, Trash2, UserCheck, Briefcase, Phone,
  Plus, X, Eye, EyeOff, Save, Settings, ChevronDown, ChevronUp, Check
} from 'lucide-react';

// ─── LISTA DE TELAS DO SISTEMA ────────────────────────────────────────────────
const TELAS = [
  { id: 'hub_alunos',          label: 'Hub de Alunos' },
  { id: 'fichas_treino',       label: 'Fichas de Treino' },
  { id: 'dietas',              label: 'Dietas' },
  { id: 'feedbacks_recebidos', label: 'Feedbacks Recebidos' },
  { id: 'treinos_realizados',  label: 'Treinos Realizados' },
  { id: 'banco_textos',        label: 'Banco de Textos' },
  { id: 'anamneses',           label: 'Anamneses' },          // <-- ADICIONADO
  { id: 'feedbacks_visao',     label: 'Feedbacks - Visão Geral' },
  { id: 'cronograma',          label: 'Cronograma Feedbacks' },
  { id: 'gestao_tarefas',      label: 'Gestão de Tarefas' },
  { id: 'comunicacao',         label: 'Gestão de Comunicação' },
  { id: 'exames',              label: 'Exames' },
  { id: 'prescricoes',         label: 'Prescrições' },
  { id: 'financeiro',          label: 'Financeiro' },
  { id: 'contratos',           label: 'Contratos' },
  { id: 'fluxos',              label: 'Fluxos' },
  { id: 'area_membros',        label: 'Área de Membros' },
  { id: 'equipe',              label: 'Equipe' },
];

// ─── PERMISSÕES PADRÃO ────────────────────────────────────────────────────────
const PERMISSOES_PADRAO = {
  admin: TELAS.reduce((acc, t) => ({ ...acc, [t.id]: true }), {}),
  secretary: TELAS.reduce((acc, t) => ({ ...acc, [t.id]: t.id !== 'equipe' }), {}),
  consultant: TELAS.reduce((acc, t) => ({
    ...acc,
    [t.id]: ['hub_alunos','fichas_treino','dietas','feedbacks_recebidos','treinos_realizados'].includes(t.id)
  }), {}),
};

const CARGOS = [
  { value: 'admin',      label: 'Administrador', icon: Shield,    color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
  { value: 'secretary',  label: 'Secretária',    icon: Briefcase, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30' },
  { value: 'consultant', label: 'Consultor',     icon: UserCheck, color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/30' },
];

const getCargoDef = (role) => CARGOS.find(c => c.value === role) || CARGOS[2];

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
const TeamModule = () => {
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState('equipe'); // 'equipe' | 'permissoes'
  const [permissoes, setPermissoes]     = useState(PERMISSOES_PADRAO);
  const [savingPerms, setSavingPerms]   = useState(false);
  const [savedPerms, setSavedPerms]     = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [expandedRole, setExpandedRole] = useState(null);

  // Form novo membro
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'consultant' });
  const [showPass, setShowPass]   = useState(false);
  const [creating, setCreating]   = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Busca usuários ──────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // ── Busca permissões salvas ─────────────────────────────────────────────────
  const fetchPermissoes = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'role_permissions'));
      if (snap.exists()) setPermissoes({ ...PERMISSOES_PADRAO, ...snap.data() });
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchUsers(); fetchPermissoes(); }, []);

  // ── Salvar permissões ───────────────────────────────────────────────────────
  const salvarPermissoes = async () => {
    setSavingPerms(true);
    try {
      await setDoc(doc(db, 'settings', 'role_permissions'), permissoes);
      setSavedPerms(true);
      setTimeout(() => setSavedPerms(false), 2000);
    } catch (e) { alert('Erro ao salvar: ' + e.message); }
    setSavingPerms(false);
  };

  const togglePerm = (cargo, telaId) => {
    if (cargo === 'admin') return; // admin sempre tem tudo
    setPermissoes(prev => ({
      ...prev,
      [cargo]: { ...prev[cargo], [telaId]: !prev[cargo][telaId] }
    }));
  };

  const toggleAll = (cargo, value) => {
    if (cargo === 'admin') return;
    setPermissoes(prev => ({
      ...prev,
      [cargo]: TELAS.reduce((acc, t) => ({ ...acc, [t.id]: value }), {})
    }));
  };

  // ── Criar membro ────────────────────────────────────────────────────────────
  const criarMembro = async () => {
    if (!form.name || !form.email || !form.password) {
      setCreateError('Preencha todos os campos.'); return;
    }
    setCreating(true); setCreateError('');
    try {
      const fn = httpsCallable(functionsInstance, 'criarMembroEquipe');
await fn({ name: form.name, email: form.email, password: form.password, role: form.role });
      setShowModal(false);
      setForm({ name: '', email: '', password: '', role: 'consultant' });
      fetchUsers();
    } catch (e) {
      setCreateError(e.message || 'Erro ao criar membro.');
    }
    setCreating(false);
  };

  // ── Cargo/phone helpers ─────────────────────────────────────────────────────
  const handleRoleChange = async (user, newRole) => {
    if (newRole === user.role) return;
    try {
      await updateDoc(doc(db, 'users', user.id), { role: newRole });
      fetchUsers();
    } catch (e) { alert('Erro: ' + e.message); }
  };

  const handlePhoneChange = (userId, val) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, whatsapp: val.replace(/\D/g,'') } : u));
  };

  const handlePhoneSave = async (user) => {
    try { await updateDoc(doc(db, 'users', user.id), { whatsapp: user.whatsapp || '' }); }
    catch (e) { alert('Erro: ' + e.message); }
  };

  const removeUser = async (id) => {
    if (!window.confirm('Remover acesso deste usuário? Isso também remove o login.')) return;
    try {
        await fnExcluirMembro({ uid: id });
        fetchUsers();
    } catch (e) { alert('Erro: ' + e.message); }
};

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto text-white">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users size={20} className="text-ebony-primary" /> Gestão de Equipe
          </h2>
          <p className="text-ebony-muted text-xs mt-0.5">Membros, cargos e permissões de acesso.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-ebony-primary hover:bg-ebony-primary/80 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        >
          <Plus size={15} /> Novo Membro
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-ebony-deep rounded-lg p-1 w-fit border border-ebony-border">
        {[['equipe','Equipe'],['permissoes','Permissões']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              tab === key ? 'bg-ebony-primary text-white shadow' : 'text-ebony-muted hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: EQUIPE ── */}
      {tab === 'equipe' && (
        <div className="bg-ebony-surface rounded-xl border border-ebony-border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-ebony-deep border-b border-ebony-border">
              <tr>
                <th className="p-3 text-xs font-bold text-ebony-muted uppercase">Nome / Email</th>
                <th className="p-3 text-xs font-bold text-ebony-muted uppercase hidden md:table-cell">WhatsApp</th>
                <th className="p-3 text-xs font-bold text-ebony-muted uppercase">Cargo</th>
                <th className="p-3 text-xs font-bold text-ebony-muted uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ebony-border">
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-ebony-muted">Carregando...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-ebony-muted">Nenhum membro cadastrado ainda.</td></tr>
              ) : users.map(user => {
                const cargo = getCargoDef(user.role);
                const Icon = cargo.icon;
                return (
                  <tr key={user.id} className="hover:bg-ebony-border/20 transition-colors">
                    <td className="p-3">
                      <div className="font-semibold">{user.name || 'Sem nome'}</div>
                      <div className="text-xs text-ebony-muted">{user.email}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 bg-ebony-deep border border-ebony-border rounded-lg px-2 py-1.5 w-44 focus-within:border-ebony-primary transition-colors">
                        <Phone size={12} className="text-ebony-muted shrink-0" />
                        <input
                          type="text" placeholder="55..."
                          className="bg-transparent outline-none text-xs text-white w-full placeholder-ebony-muted/40 font-mono"
                          value={user.whatsapp || ''}
                          onChange={e => handlePhoneChange(user.id, e.target.value)}
                          onBlur={() => handlePhoneSave(user)}
                        />
                      </div>
                    </td>
                    <td className="p-3">
                      <select
                        value={user.role || 'consultant'}
                        onChange={e => handleRoleChange(user, e.target.value)}
                        className={`text-xs font-bold px-2 py-1.5 rounded-lg border outline-none cursor-pointer transition-colors bg-ebony-deep ${cargo.bg} ${cargo.color}`}
                      >
                        {CARGOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => removeUser(user.id)}
                        className="p-1.5 text-ebony-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remover acesso"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: PERMISSÕES ── */}
      {tab === 'permissoes' && (
        <div className="space-y-3">
          <p className="text-xs text-ebony-muted mb-4">
            Defina quais telas cada cargo pode acessar. Admin sempre tem acesso total.
          </p>

          {CARGOS.map(cargo => {
            const isAdmin = cargo.value === 'admin';
            const perms = permissoes[cargo.value] || {};
            const totalAtivo = TELAS.filter(t => perms[t.id]).length;
            const isExpanded = expandedRole === cargo.value;
            const Icon = cargo.icon;

            return (
              <div key={cargo.value} className="bg-ebony-surface border border-ebony-border rounded-xl overflow-hidden">

                {/* Header do cargo */}
                <button
                  onClick={() => setExpandedRole(isExpanded ? null : cargo.value)}
                  className="w-full flex items-center justify-between p-4 hover:bg-ebony-border/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${cargo.bg}`}>
                      <Icon size={16} className={cargo.color} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm">{cargo.label}</div>
                      <div className="text-xs text-ebony-muted">
                        {isAdmin ? 'Acesso total — todas as telas' : `${totalAtivo} de ${TELAS.length} telas`}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-ebony-muted" /> : <ChevronDown size={16} className="text-ebony-muted" />}
                </button>

                {/* Grid de telas */}
                {isExpanded && (
                  <div className="border-t border-ebony-border p-4">
                    {!isAdmin && (
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => toggleAll(cargo.value, true)}
                          className="text-xs px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors font-semibold"
                        >
                          Selecionar tudo
                        </button>
                        <button
                          onClick={() => toggleAll(cargo.value, false)}
                          className="text-xs px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors font-semibold"
                        >
                          Desmarcar tudo
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {TELAS.map(tela => {
                        const ativo = isAdmin || !!perms[tela.id];
                        return (
                          <button
                            key={tela.id}
                            onClick={() => togglePerm(cargo.value, tela.id)}
                            disabled={isAdmin}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all text-left ${
                              ativo
                                ? 'bg-ebony-primary/15 border-ebony-primary/40 text-white'
                                : 'bg-ebony-deep border-ebony-border text-ebony-muted hover:border-ebony-muted'
                            } ${isAdmin ? 'cursor-default opacity-70' : 'cursor-pointer'}`}
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              ativo ? 'bg-ebony-primary border-ebony-primary' : 'border-ebony-border'
                            }`}>
                              {ativo && <Check size={10} className="text-white" />}
                            </div>
                            {tela.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Botão salvar */}
          <div className="flex justify-end pt-2">
            <button
              onClick={salvarPermissoes}
              disabled={savingPerms}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                savedPerms
                  ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                  : 'bg-ebony-primary hover:bg-ebony-primary/80 text-white'
              }`}
            >
              {savedPerms ? <><Check size={15} /> Salvo!</> : <><Save size={15} /> Salvar Permissões</>}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL NOVO MEMBRO ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ebony-surface border border-ebony-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-ebony-border">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Plus size={16} className="text-ebony-primary" /> Novo Membro
              </h3>
              <button onClick={() => { setShowModal(false); setCreateError(''); }}
                className="p-1.5 rounded-lg hover:bg-ebony-border text-ebony-muted hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="text-xs font-semibold text-ebony-muted uppercase mb-1.5 block">Nome completo</label>
                <input
                  type="text" placeholder="Ex: Maria Silva"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-ebony-deep border border-ebony-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-ebony-muted/50 outline-none focus:border-ebony-primary transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-ebony-muted uppercase mb-1.5 block">E-mail</label>
                <input
                  type="email" placeholder="email@exemplo.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-ebony-deep border border-ebony-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-ebony-muted/50 outline-none focus:border-ebony-primary transition-colors"
                />
              </div>

              {/* Senha */}
              <div>
                <label className="text-xs font-semibold text-ebony-muted uppercase mb-1.5 block">Senha provisória</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full bg-ebony-deep border border-ebony-border rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-ebony-muted/50 outline-none focus:border-ebony-primary transition-colors"
                  />
                  <button onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ebony-muted hover:text-white transition-colors">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Cargo */}
              <div>
                <label className="text-xs font-semibold text-ebony-muted uppercase mb-1.5 block">Cargo</label>
                <div className="grid grid-cols-3 gap-2">
                  {CARGOS.map(c => {
                    const Icon = c.icon;
                    const sel = form.role === c.value;
                    return (
                      <button
                        key={c.value}
                        onClick={() => setForm(f => ({ ...f, role: c.value }))}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                          sel ? `${c.bg} ${c.color}` : 'bg-ebony-deep border-ebony-border text-ebony-muted hover:border-ebony-muted'
                        }`}
                      >
                        <Icon size={16} />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {createError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}
            </div>

            <div className="p-5 pt-0 flex gap-2">
              <button
                onClick={() => { setShowModal(false); setCreateError(''); }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-ebony-border text-ebony-muted hover:text-white hover:bg-ebony-border transition-colors text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={criarMembro}
                disabled={creating}
                className="flex-1 px-4 py-2.5 rounded-lg bg-ebony-primary hover:bg-ebony-primary/80 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {creating ? 'Criando...' : 'Criar Membro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamModule;