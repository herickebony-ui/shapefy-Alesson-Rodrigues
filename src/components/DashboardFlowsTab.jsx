import React from "react";
import { Copy, Settings, Plus, Trash2, Edit, Link as LinkIcon } from "lucide-react";
import { generateSlug } from "../utils/utils";

const DashboardFlowsTab = ({
    editingPlan, setEditingPlan,
    editName, setEditName,
    saveEdit,
    duplicatingPlan, setDuplicatingPlan,
    duplicateName, setDuplicateName,
    confirmDuplicate,
    isCreating, setIsCreating,
    newPlanName, setNewPlanName,
    handleCreate,
    plans,
    onSelectPlan,
    onUpdatePlanColor,
    copyLink,
    onDeletePlan,
}) => {
    {/* --- ABA 1: MEUS FLUXOS --- */ }
    return (
        <div className="animate-in fade-in duration-300">
            
            {/* --- MODAL RENOMEAR (TITANIUM DARK) --- */}
            {editingPlan && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-ebony-surface rounded-xl shadow-2xl border border-ebony-border p-6 w-full max-w-md animate-in zoom-in duration-200">
                        <h2 className="text-xl font-bold text-white mb-4">Renomear Fluxo</h2>
                        <input 
                            type="text" 
                            value={editName} 
                            onChange={(e) => setEditName(e.target.value)} 
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg mb-6 focus:border-ebony-primary outline-none transition-colors" 
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingPlan(null)} className="px-4 py-2 text-ebony-muted hover:text-white hover:bg-ebony-deep rounded transition-colors">Cancelar</button>
                            <button onClick={saveEdit} className="px-4 py-2 bg-ebony-primary text-white rounded font-bold hover:bg-red-900 transition-colors shadow-lg">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DUPLICAR (TITANIUM DARK) --- */}
            {duplicatingPlan && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-ebony-surface rounded-xl shadow-2xl border border-ebony-border p-6 w-full max-w-md animate-in zoom-in duration-200">
                        <h2 className="text-xl font-bold text-white mb-2">Duplicar Fluxo</h2>
                        <input 
                            autoFocus 
                            type="text" 
                            value={duplicateName} 
                            onChange={(e) => setDuplicateName(e.target.value)} 
                            className="w-full p-3 bg-ebony-deep border border-ebony-border text-white rounded-lg mb-2 focus:border-ebony-primary outline-none transition-colors" 
                        />
                        <p className="text-xs text-ebony-muted mb-6 font-mono">ID será: {generateSlug(duplicateName || 'novo-id')}</p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setDuplicatingPlan(null)} className="px-4 py-2 text-ebony-muted hover:text-white hover:bg-ebony-deep rounded transition-colors">Cancelar</button>
                            <button onClick={confirmDuplicate} className="px-4 py-2 bg-white text-black rounded font-bold hover:bg-gray-200 flex items-center gap-2 shadow-lg"><Copy className="w-4 h-4" /> Duplicar</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                
                {/* --- CARD CRIAR NOVO (DASHED NEON) --- */}
                <div className="bg-ebony-surface/50 p-6 rounded-xl border-2 border-dashed border-ebony-border flex flex-col items-center justify-center text-center hover:border-ebony-primary hover:bg-ebony-surface hover:shadow-[0_0_15px_rgba(133,0,0,0.2)] transition-all min-h-[200px] group cursor-pointer">
                    {!isCreating ? (
                        <button onClick={() => setIsCreating(true)} className="flex flex-col items-center gap-2 w-full h-full py-8">
                            <div className="w-12 h-12 bg-ebony-deep text-ebony-muted group-hover:text-white group-hover:bg-ebony-primary rounded-full flex items-center justify-center transition-all shadow-inner">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="font-bold text-ebony-muted group-hover:text-white transition-colors">Criar Novo Fluxo</span>
                        </button>
                    ) : (
                        <div className="w-full animate-in fade-in">
                            <input 
                                autoFocus 
                                type="text" 
                                placeholder="Nome do Fluxo" 
                                className="w-full p-2 bg-ebony-deep border border-ebony-border text-white rounded mb-3 text-sm focus:border-ebony-primary outline-none" 
                                value={newPlanName} 
                                onChange={e => setNewPlanName(e.target.value)} 
                            />
                            <div className="flex gap-2">
                                <button onClick={handleCreate} className="flex-1 bg-ebony-primary hover:bg-red-900 text-white py-2 rounded text-sm font-bold transition-colors">Criar</button>
                                <button onClick={() => setIsCreating(false)} className="px-3 bg-ebony-deep text-ebony-muted hover:text-white rounded text-sm font-bold border border-ebony-border">X</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- CARDS DE FLUXOS (NEON STYLE) --- */}
                {plans.map((plan) => (
                    <div
                        key={plan.id}
                        // Base Dark + Transição Suave
                        className="bg-ebony-surface p-6 rounded-xl relative group flex flex-col justify-between min-h-[200px] transition-all hover:-translate-y-1"
                        style={{
                            // AQUI ESTÁ A MÁGICA DO NEON:
                            // 1. A borda assume a cor do plano
                            border: `1px solid ${plan.color || '#323238'}`,
                            // 2. O box-shadow cria o brilho colorido (adicionando transparencia '33' ao hex)
                            boxShadow: `0 4px 20px -5px ${(plan.color || '#000000')}33`
                        }}
                    >
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg text-white leading-tight">{plan.name || plan.id}</h3>

                                <div className="flex items-center gap-2">
                                    {/* SELETOR DE COR (DOT GLOW) */}
                                    <div className="relative group/color">
                                        <div
                                            className="w-5 h-5 rounded-full cursor-pointer shadow-lg"
                                            style={{ 
                                                backgroundColor: plan.color || '#ffffff',
                                                boxShadow: `0 0 8px ${plan.color || '#ffffff'}`
                                            }}
                                            title="Mudar cor da etiqueta"
                                        />
                                        <input
                                            type="color"
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                            onChange={(e) => onUpdatePlanColor(plan.id, e.target.value)}
                                            value={plan.color || "#ffffff"}
                                        />
                                    </div>
                                    
                                    {/* Botão de Editar Nome */}
                                    <button onClick={() => { setEditingPlan(plan); setEditName(plan.name || plan.id) }} className="p-1 text-ebony-muted hover:text-white hover:bg-ebony-deep rounded transition-colors">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            {/* ID PILL - Afundado */}
                            <p className="text-[10px] text-ebony-muted font-mono mb-6 bg-ebony-deep border border-ebony-border inline-block px-2 py-1 rounded">
                                ID: {plan.id}
                            </p>
                        </div>

                        {/* AÇÕES */}
                        <div className="space-y-2">
                            {/* Botão Principal - Segue a cor do Titanium (Vinho) para manter a marca forte, 
                                ou poderia ser a cor do card. Optei por Titanium Standard para consistência da UI. */}
                            <button onClick={() => onSelectPlan(plan.id)} className="w-full py-2 bg-ebony-primary text-white rounded-lg text-sm font-bold hover:bg-red-900 transition-colors flex items-center justify-center gap-2 shadow-md">
                                <Settings className="w-4 h-4" /> Editar Fluxo
                            </button>
                            
                            <div className="flex gap-2">
                                <button onClick={() => copyLink(plan.id)} className="flex-1 py-2 bg-transparent border border-ebony-border text-ebony-muted rounded-lg text-sm font-medium hover:text-white hover:bg-ebony-deep hover:border-gray-500 transition-all flex items-center justify-center gap-2" title="Link Direto">
                                    <LinkIcon className="w-4 h-4" /> Link
                                </button>
                                <button onClick={() => { setDuplicatingPlan(plan); setDuplicateName(`${plan.name} (Cópia)`) }} className="flex-1 py-2 bg-transparent border border-ebony-border text-ebony-muted rounded-lg text-sm font-medium hover:text-white hover:bg-ebony-deep hover:border-gray-500 transition-all flex items-center justify-center gap-2">
                                    <Copy className="w-4 h-4" /> Duplicar
                                </button>
                            </div>
                        </div>

                        {/* Botão Deletar (Hover Reveal) */}
                        <button 
                            onClick={() => { if (confirm('Tem certeza?')) onDeletePlan(plan.id) }} 
                            className="absolute -top-3 -right-3 p-2 bg-ebony-surface border border-ebony-border shadow-lg rounded-full text-ebony-muted hover:text-red-500 hover:border-red-500 opacity-0 group-hover:opacity-100 transition-all z-10"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DashboardFlowsTab;
