import React, { useState, useEffect } from "react";
import {
    ArrowLeft, Save, AlertCircle, Loader, ChevronUp, ChevronDown,
    FileText, UtensilsCrossed, BarChart2, Edit, Copy, Trash2
} from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, collection, getDocs, query, where, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import {
    buscarDietaDetalhe, salvarDieta, buscarAlimentos, buscarRefeicoesProntas,
    buscarRefeicaoProntaDetalhe, buscarAlunoDetalhe, salvarRefeicaoPronta
} from "./dietaService";
import { excluirDieta, duplicarDieta } from "./dietaService";


// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, dec = 1) => v != null ? Number(v).toFixed(dec) : "0.0";
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const calcularTotais = (draft) => {
    if (!draft) return null;
    let prot = 0, carb = 0, lip = 0, kcal = 0, fib = 0;

    for (let i = 1; i <= 8; i++) {
        if (draft[`meal_${i}`] === 1) {
            let primeiraOpcaoAtiva = null;
            for (let j = 1; j <= 10; j++) {
                if (draft[`meal_${i}_option_${j}`] === 1) {
                    primeiraOpcaoAtiva = j;
                    break;
                }
            }
            if (primeiraOpcaoAtiva) {
                const itens = draft[`meal_${i}_option_${primeiraOpcaoAtiva}_items`] || [];
                itens.forEach(item => {
                    if (!item.substitute) {
                        prot += Number(item.protein || 0);
                        carb += Number(item.carbohydrate || 0);
                        lip += Number(item.lipid || 0);
                        kcal += Number(item.calories || 0);
                        fib += Number(item.fiber || 0);
                    }
                });
            }
        }
    }
    const peso = Number(draft.weight) || 1;
    return {
        prot, carb, lip, kcal, fib,
        relProt: prot / peso,
        relCarb: carb / peso,
        relLip: lip / peso,
        relFib: fib / peso
    };
};

const verificarSubstitutos = (draft) => {
    const divergencias = [];

    const tolerancia = (kcal) => {
        if (kcal <= 100) return 20;
        if (kcal <= 200) return 30;
        if (kcal <= 300) return 40;
        return 60;
    };

    for (let i = 1; i <= 8; i++) {
        if (draft[`meal_${i}`] !== 1) continue;
        for (let j = 1; j <= 10; j++) {
            if (draft[`meal_${i}_option_${j}`] !== 1) continue;
            const items = draft[`meal_${i}_option_${j}_items`] || [];
            let principal = null;
            items.forEach(item => {
                if (!item.substitute || item.substitute === 0) {
                    principal = item;
                } else if (item.substitute === 1 && principal) {
                    const kcalPrincipal = Number(principal.calories || 0);
                    const kcalSub = Number(item.calories || 0);
                    if (kcalPrincipal > 0) {
                        const diff = Math.abs(kcalSub - kcalPrincipal) / kcalPrincipal;
                        const diffAbsoluta = Math.abs(kcalSub - kcalPrincipal);
                        if (diff > 0.15 && diffAbsoluta > tolerancia(kcalPrincipal)) {
                            divergencias.push({
                                refeicao: draft[`meal_${i}_label`] || `Refeição ${i}`,
                                opcao: draft[`meal_${i}_option_${j}_label`] || `Opção ${j}`,
                                principal: principal.food,
                                substituto: item.food,
                                kcalPrincipal,
                                kcalSub,
                                diff: Math.round(diff * 100),
                                idRef: `meal_${i}_option_${j}`
                            });
                        }
                    }
                }
            });
        }
    }
    return divergencias;
};

const ToastSubstitutos = ({ divergencias, onClose, onConfirmar }) => {
    // remove o useEffect com setTimeout (não some mais automaticamente)
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
            <div className="bg-yellow-900/60 border border-yellow-500/60 rounded-xl p-5 shadow-2xl max-w-md w-full mx-4 pointer-events-auto">
                <div className="flex items-start gap-3">
                    <span className="text-yellow-400 text-lg mt-0.5">⚠️</span>
                    <div className="flex-1">
                        <p className="text-yellow-300 font-bold text-sm mb-3">
                            Substitutos com calorias divergentes (&gt;15%)
                        </p>
                        <div className="space-y-2">
                            {divergencias.map((d, i) => (
                                <div key={i} className="text-xs text-yellow-200 border-l-2 border-yellow-500/50 pl-2">
                                    <span className="text-yellow-400 font-semibold">{d.refeicao} · {d.opcao}</span>
                                    <p className="mt-0.5">
                                        <strong>{d.substituto}</strong> ({d.kcalSub} kcal) vs <strong>{d.principal}</strong> ({d.kcalPrincipal} kcal)
                                        <span className="ml-1 text-yellow-400 font-bold">— {d.diff}% diferença</span>
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 mt-4 justify-end">
                            <button onClick={() => {
                                const primeiroErro = divergencias[0];
                                if (primeiroErro && primeiroErro.idRef) {
                                    const elemento = document.getElementById(primeiroErro.idRef);
                                    if (elemento) elemento.scrollIntoView({ behavior: "smooth", block: "center" });
                                }
                                onClose();
                            }}
                                className="px-4 py-2 text-sm border border-yellow-500/40 text-yellow-400 rounded-lg hover:bg-yellow-500/10 transition">
                                Corrigir
                            </button>
                            <button onClick={onConfirmar}
                                className="px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition">
                                Salvar mesmo assim
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-yellow-400 hover:text-yellow-200 text-xl leading-none ml-2">×</button>
                </div>
            </div>
        </div>
    );
};

const InputAlimento = ({ value, onChange, onSelect }) => {
    const [query, setQuery] = useState(value || "");
    const [resultados, setResultados] = useState([]);
    const [aberto, setAberto] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const timerRef = React.useRef(null);

    const buscar = (texto) => {
        setQuery(texto);
        clearTimeout(timerRef.current);

        const t = (texto || "").trim();
        if (!t || t.length < 1) {
            setResultados([]);
            setAberto(false);
            return;
        }

        // % inteligente: "ar%co" vira partes ["ar","co"]
        const partes = t.split("%").map(s => s.trim()).filter(Boolean);
        const termoBusca = partes.join(" "); // o que vai pro backend (sem %)

        timerRef.current = setTimeout(async () => {
            setCarregando(true);
            try {
                const res = await buscarAlimentos({ search: termoBusca, limit: 10 });

                let list = res.list || [];

                // Se usou %, filtra no front garantindo ordem das partes
                if (t.includes("%") && partes.length) {
                    const lowerParts = partes.map(p => p.toLowerCase());
                    list = list.filter((a) => {
                        const nome = (a.name || a.food || a.food_name || "").toLowerCase();
                        let idx = 0;
                        for (const p of lowerParts) {
                            const found = nome.indexOf(p, idx);
                            if (found === -1) return false;
                            idx = found + p.length;
                        }
                        return true;
                    });
                }

                setResultados(t.length === 0 ? list.slice(0, 5) : list);
                setAberto(true);
            } catch (e) {
                setResultados([]);
                setAberto(false);
            } finally {
                setCarregando(false);
            }
        }, 400);
    };

    const handleChange = (e) => {
        const v = e.target.value;
        setQuery(v);
        onChange(v);
        buscar(v);
    };

    const handleSelect = (alimento) => {
        setQuery(alimento.name);
        setAberto(false);
        onSelect(alimento);
    };

    return (
        <div className="relative w-full">
            <input
                value={query}
                onChange={handleChange}
                onBlur={() => setTimeout(() => setAberto(false), 200)}
                onFocus={() => query.trim().length >= 1 && resultados.length > 0 && setAberto(true)}
                className="w-full h-7 px-2 bg-transparent border border-transparent hover:border-[#323238] focus:border-[#850000]/60 text-white rounded text-xs outline-none transition-colors"
                placeholder="Buscar alimento..."
            />
            {carregando && (
                <div className="absolute right-2 top-1.5">
                    <Loader size={12} className="animate-spin text-gray-500" />
                </div>
            )}
            {aberto && resultados.length > 0 && (
                <div className="absolute z-50 top-full left-0 w-72 bg-[#1a1a1a] border border-[#323238] rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1">
                    {resultados.map((alimento, i) => (
                        <button
                            key={i}
                            onMouseDown={() => handleSelect(alimento)}
                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[#29292e] hover:text-white transition-colors border-b border-[#323238]/50 last:border-0"
                        >
                            <div className="font-medium">{alimento.food || alimento.name}</div>
<div className="text-gray-500 text-[10px] mt-0.5">
    P: {alimento.protein}g · C: {alimento.carbohydrate}g · G: {alimento.lipid}g · {alimento.calories} kcal
</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ModalEditarAlimento = ({ item, onSave, onClose }) => {
    const [formData, setFormData] = useState({ ...item });
    const handleChange = (f, v) => setFormData(p => ({ ...p, [f]: v }));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-[#323238]">
                    <h2 className="text-lg font-bold text-white">Editar Alimento</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
                </div>
                <div className="p-5 overflow-y-auto flex-1 space-y-8">

                    {/* Básicos */}
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <FormGroup label="Alimento *">
                                <Input value={formData.food || ""} disabled={true} />
                            </FormGroup>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <input type="checkbox" checked={formData.substitute === 1} onChange={e => handleChange("substitute", e.target.checked ? 1 : 0)} className="w-4 h-4 accent-[#0052cc] rounded" />
                            <label className="text-sm text-white">É substituto</label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        <FormGroup label="Qtd. de Ref">
                            <Input type="number" value={formData.ref_weight} onChange={v => handleChange("ref_weight", v)} />
                        </FormGroup>
                        <FormGroup label="Unidade">
                            <Select value={formData.unit} onChange={v => handleChange("unit", v)} options={["g", "ml", "unidade"]} />
                        </FormGroup>
                        <FormGroup label="Medida Caseira">
                            <Input value={formData.medida_caseira} onChange={v => handleChange("medida_caseira", v)} />
                        </FormGroup>
                        <FormGroup label="Peso Total">
                            <Input type="number" value={formData.weight} onChange={v => handleChange("weight", v)} />
                        </FormGroup>
                    </div>

                    {/* Macronutrientes */}
                    <div>
                        <h3 className="text-sm font-semibold text-white mb-4 border-b border-[#323238] pb-2">Macronutrientes</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                            <FormGroup label="Proteína (g)"><Input type="number" value={formData.protein} onChange={v => handleChange("protein", v)} /></FormGroup>
                            <FormGroup label="Carboidrato (g)"><Input type="number" value={formData.carbohydrate} onChange={v => handleChange("carbohydrate", v)} /></FormGroup>
                            <FormGroup label="Gorduras Totais (g)"><Input type="number" value={formData.lipid} onChange={v => handleChange("lipid", v)} /></FormGroup>
                            <FormGroup label="Fibras (g)"><Input type="number" value={formData.fiber} onChange={v => handleChange("fiber", v)} /></FormGroup>
                            <FormGroup label="Valor Energético (kcal)"><Input type="number" value={formData.calories} onChange={v => handleChange("calories", v)} /></FormGroup>
                        </div>
                    </div>

                    {/* Minerais */}
                    <div>
                        <h3 className="text-sm font-semibold text-white mb-4 border-b border-[#323238] pb-2">Minerais</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                            <FormGroup label="Cálcio (mg)"><Input type="number" value={formData.calcium} onChange={v => handleChange("calcium", v)} /></FormGroup>
                            <FormGroup label="Cobre (mg)"><Input type="number" value={formData.copper} onChange={v => handleChange("copper", v)} /></FormGroup>
                            <FormGroup label="Ferro (mg)"><Input type="number" value={formData.iron} onChange={v => handleChange("iron", v)} /></FormGroup>
                            <FormGroup label="Fósforo (mg)"><Input type="number" value={formData.phosphor} onChange={v => handleChange("phosphor", v)} /></FormGroup>
                            <FormGroup label="Magnésio (mg)"><Input type="number" value={formData.magnesium} onChange={v => handleChange("magnesium", v)} /></FormGroup>
                            <FormGroup label="Potássio (mg)"><Input type="number" value={formData.potassium} onChange={v => handleChange("potassium", v)} /></FormGroup>
                            <FormGroup label="Selênio (µg)"><Input type="number" value={formData.selenium} onChange={v => handleChange("selenium", v)} /></FormGroup>
                            <FormGroup label="Sódio (mg)"><Input type="number" value={formData.sodium} onChange={v => handleChange("sodium", v)} /></FormGroup>
                            <FormGroup label="Zinco (mg)"><Input type="number" value={formData.zinc} onChange={v => handleChange("zinc", v)} /></FormGroup>
                        </div>
                    </div>

                    {/* Vitaminas */}
                    <div>
                        <h3 className="text-sm font-semibold text-white mb-4 border-b border-[#323238] pb-2">Vitaminas</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                            <FormGroup label="Vitamina A (µg)"><Input type="number" value={formData.vitamin_a} onChange={v => handleChange("vitamin_a", v)} /></FormGroup>
                            <FormGroup label="Vitamina B1 (mg)"><Input type="number" value={formData.vitamin_b1} onChange={v => handleChange("vitamin_b1", v)} /></FormGroup>
                            <FormGroup label="Vitamina B2 (mg)"><Input type="number" value={formData.vitamin_b2} onChange={v => handleChange("vitamin_b2", v)} /></FormGroup>
                            <FormGroup label="Vitamina B3 (mg)"><Input type="number" value={formData.vitamin_b3} onChange={v => handleChange("vitamin_b3", v)} /></FormGroup>
                            <FormGroup label="Vitamina B6 (mg)"><Input type="number" value={formData.vitamin_b6} onChange={v => handleChange("vitamin_b6", v)} /></FormGroup>
                            <FormGroup label="Vitamina B9 (µg)"><Input type="number" value={formData.vitamin_b9} onChange={v => handleChange("vitamin_b9", v)} /></FormGroup>
                            <FormGroup label="Vitamina B12 (µg)"><Input type="number" value={formData.vitamin_b12} onChange={v => handleChange("vitamin_b12", v)} /></FormGroup>
                            <FormGroup label="Vitamina C (mg)"><Input type="number" value={formData.vitamin_c} onChange={v => handleChange("vitamin_c", v)} /></FormGroup>
                            <FormGroup label="Vitamina D (µg)"><Input type="number" value={formData.vitamin_d} onChange={v => handleChange("vitamin_d", v)} /></FormGroup>
                            <FormGroup label="Vitamina E (mg)"><Input type="number" value={formData.vitamin_e} onChange={v => handleChange("vitamin_e", v)} /></FormGroup>
                        </div>
                    </div>

                </div>
                <div className="p-4 border-t border-[#323238] flex justify-end gap-3 bg-[#222226] rounded-b-xl">
                    <button onClick={onClose} className="px-5 py-2 bg-transparent hover:bg-[#323238] text-gray-300 text-sm font-medium rounded transition-colors">Cancelar</button>
                    <button onClick={() => onSave(formData)} className="px-5 py-2 bg-[#0052cc] hover:bg-[#0043a8] text-white text-sm font-medium rounded transition-colors">Salvar Alterações</button>
                </div>
            </div>
        </div>
    );
};
const ModalAdicionarRefeicaoPronta = ({ onClose, onSelectMeal }) => {
    const [query, setQuery] = useState("");
    const [resultados, setResultados] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const timerRef = React.useRef(null);

    const buscar = (texto) => {
        setQuery(texto);
        clearTimeout(timerRef.current);

        const t = (texto || "").trim();
        const partes = t.split("%").map(s => s.trim()).filter(Boolean);
        const termoBusca = partes.join(" ");

        timerRef.current = setTimeout(async () => {
            setCarregando(true);
            try {
                const res = await buscarRefeicoesProntas({ search: termoBusca || undefined, limit: 5 });
                let list = res.list || [];

                if (t.includes("%") && partes.length) {
                    const lowerParts = partes.map(p => p.toLowerCase());
                    list = list.filter((r) => {
                        const nome = (r.full_name || r.name || "").toLowerCase();
                        let idx = 0;
                        for (const p of lowerParts) {
                            const found = nome.indexOf(p, idx);
                            if (found === -1) return false;
                            idx = found + p.length;
                        }
                        return true;
                    });
                }

                setResultados(list);
            } catch (e) {
                console.error(e);
            } finally {
                setCarregando(false);
            }
        }, 400);
    };

    // ← ISSO QUE FALTAVA
    useEffect(() => {
        buscar("");
    }, []);

    const handleSelect = async (refeicao) => {
        setCarregando(true);
        try {
            const res = await buscarRefeicaoProntaDetalhe(refeicao.name);
            const data = res.data || res;
            if (data.table_foods && data.table_foods.length > 0) {
                onSelectMeal(data.table_foods);
            } else {
                alert("Essa refeição não possui alimentos cadastrados.");
            }
        } catch (e) {
            alert("Erro ao puxar alimentos: " + e.message);
        } finally {
            setCarregando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center p-4 border-b border-[#323238]">
                    <h2 className="text-lg font-bold text-white">Adicionar Refeição Pronta</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
                </div>
                <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4">
                    <FormGroup label="Selecione a refeição *">
                        <div className="relative">
                            <Input value={query} onChange={buscar} placeholder="Buscar refeição..." />
                            {carregando && <Loader size={14} className="animate-spin absolute right-3 top-3 text-gray-400" />}
                        </div>
                    </FormGroup>
                    <div className="flex-1 overflow-y-auto space-y-1">
                        {resultados.map((ref, i) => (
                            <button key={i} onClick={() => handleSelect(ref)} disabled={carregando}
                                className="w-full text-left p-3 rounded-lg hover:bg-[#29292e] text-gray-300 hover:text-white transition-colors border border-transparent hover:border-[#323238] text-sm">
                                {ref.full_name || ref.name}
                            </button>
                        ))}
                        {!carregando && resultados.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">Nenhuma refeição encontrada.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
const TabelaAlimentos = ({ items, onUpdateItem, onAddItem, onDeleteItem, onDuplicateItem, onMoveItem, onAddRefeicaoPronta, macrosReferencia }) => {
    const [exibirSubs, setExibirSubs] = useState(false);
    const [editingIdx, setEditingIdx] = useState(null);
    const visiveis = exibirSubs ? items : items.filter(i => !i.substitute);

    const macrosOpcao = items.reduce((acc, item) => {
        if (!item.substitute) {
            acc.prot += Number(item.protein || 0);
            acc.carb += Number(item.carbohydrate || 0);
            acc.lip += Number(item.lipid || 0);
            acc.kcal += Number(item.calories || 0);
            acc.fib += Number(item.fiber || 0);
        }
        return acc;
    }, { prot: 0, carb: 0, lip: 0, kcal: 0, fib: 0 });

    return (
        <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl mt-4">
            {editingIdx !== null && (
                <ModalEditarAlimento
                    item={items[editingIdx]}
                    onClose={() => setEditingIdx(null)}
                    onSave={(updatedItem) => {
                        onUpdateItem(editingIdx, "__selecionarAlimento", updatedItem);
                        setEditingIdx(null);
                    }}
                />
            )}
            {items.length === 0 ? (
                <div className="p-6 text-left border-b border-[#323238]">
                    <p className="text-white text-base">Por favor, adicione uma linha para exibir os campos</p>
                </div>
            ) : (
                <div className="relative z-20 w-full overflow-x-auto md:overflow-visible">
                    <table className="w-full text-xs border-separate border-spacing-y-0.5">
                        <thead className="text-gray-500 uppercase bg-[#29292e] border-b border-[#323238]">
                            <tr>
                                <th className="px-2 py-2 w-8 text-center">#</th>
                                <th className="px-2 py-2 min-w-[180px]">Alimento</th>
                                <th className="px-2 py-2 w-20 min-w-[80px]">Qtd.</th>
                                <th className="px-2 py-2 w-24 min-w-[90px]">Unid.</th>
                                <th className="px-2 py-2 w-28">Medida Cas.</th>
                                <th className="px-2 py-2 w-16">Prot.</th>
                                <th className="px-2 py-2 w-16">Carb.</th>
                                <th className="px-2 py-2 w-16">Gord.</th>
                                <th className="px-2 py-2 w-16">Fib.</th>
                                <th className="px-2 py-2 w-16">Kcal</th>
                                <th className="px-2 py-2 w-24 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#323238]/50">
                            {visiveis.map((item, itemIdx) => {
                                const realIdx = item.__uid
                                    ? items.findIndex(i => i.__uid === item.__uid)
                                    : items.indexOf(item);

                                // Regra: Verifica se o item atual é o principal e se o item logo abaixo dele é um substituto
                                const temSubstitutoOculto = !exibirSubs && !item.substitute && items[realIdx + 1]?.substitute === 1;

                                return (
                                    <tr key={item.__uid || itemIdx} className={`transition-colors ${item.substitute ? 'bg-red-500/10' : temSubstitutoOculto ? 'bg-[#2c2c31]' : 'bg-[#222226]'} hover:bg-[#2f2f35]`}>
                                        <td className="px-2 py-2 rounded-l-lg">
                                            <div className="flex items-center gap-1 justify-center">
                                                <div className="flex flex-col items-center">
                                                    <button onClick={() => onMoveItem(realIdx, -1)} disabled={realIdx === 0}
                                                        className="h-4 w-5 flex items-center justify-center text-gray-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                        <ChevronUp size={11} />
                                                    </button>
                                                    <button onClick={() => onMoveItem(realIdx, +1)} disabled={realIdx === items.length - 1}
                                                        className="h-4 w-5 flex items-center justify-center text-gray-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                                        <ChevronDown size={11} />
                                                    </button>
                                                </div>
                                                <span className="text-gray-600 font-mono text-xs">{realIdx + 1}</span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1">
                                            <div className="flex items-center gap-1.5">
                                                {item.substitute === 1 && (
                                                    <span className="shrink-0 text-[9px] font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-1 py-0.5 rounded uppercase">OU</span>
                                                )}
                                                <InputAlimento
                                                    value={item.food || ""}
                                                    onChange={(v) => onUpdateItem(realIdx, "food", v)}
                                                    onSelect={(alimento) => {
                                                        const base = {
                                                            ref_weight: alimento.ref_weight ?? 100,
                                                            protein: alimento.protein ?? 0,
                                                            carbohydrate: alimento.carbohydrate ?? 0,
                                                            lipid: alimento.lipid ?? 0,
                                                            fiber: alimento.fiber ?? 0,
                                                            calories: alimento.calories ?? 0,
                                                            calcium: alimento.calcium ?? 0,
                                                            copper: alimento.copper ?? 0,
                                                            iron: alimento.iron ?? 0,
                                                            phosphor: alimento.phosphor ?? 0,
                                                            magnesium: alimento.magnesium ?? 0,
                                                            potassium: alimento.potassium ?? 0,
                                                            selenium: alimento.selenium ?? 0,
                                                            sodium: alimento.sodium ?? 0,
                                                            zinc: alimento.zinc ?? 0,
                                                            vitamin_a: alimento.vitamin_a ?? 0,
                                                            vitamin_b1: alimento.vitamin_b1 ?? 0,
                                                            vitamin_b2: alimento.vitamin_b2 ?? 0,
                                                            vitamin_b3: alimento.vitamin_b3 ?? 0,
                                                            vitamin_b6: alimento.vitamin_b6 ?? 0,
                                                            vitamin_b9: alimento.vitamin_b9 ?? 0,
                                                            vitamin_b12: alimento.vitamin_b12 ?? 0,
                                                            vitamin_c: alimento.vitamin_c ?? 0,
                                                            vitamin_d: alimento.vitamin_d ?? 0,
                                                            vitamin_e: alimento.vitamin_e ?? 0,
                                                        };
                                                        onUpdateItem(realIdx, "__selecionarAlimento", { food: alimento.food_name || alimento.food || alimento.name, _base: base, ...base });
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-2 py-1"><input type="number" value={item.ref_weight ?? ""} onChange={e => onUpdateItem(realIdx, "ref_weight", e.target.value)} className="w-full h-7 px-2 bg-[#29292e] border border-[#323238] text-white rounded text-xs outline-none focus:border-[#850000]/60" /></td>
                                        <td className="px-2 py-1">
                                            <select value={item.unit || "g"} onChange={e => onUpdateItem(realIdx, "unit", e.target.value)}
                                                className="w-full h-7 px-1 bg-[#29292e] border border-[#323238] text-white rounded text-xs outline-none focus:border-[#850000]/60 appearance-none">
                                                <option>g</option><option>ml</option><option>unidade</option>
                                            </select>
                                        </td>
                                        <td className="px-2 py-1"><input value={item.medida_caseira || ""} onChange={e => onUpdateItem(realIdx, "medida_caseira", e.target.value)} className="w-full h-7 px-2 bg-transparent border border-transparent hover:border-[#323238] focus:border-[#850000]/60 text-white rounded text-xs outline-none transition-colors" /></td>
                                        {["protein", "carbohydrate", "lipid", "fiber", "calories"].map(f => (
                                            <td key={f} className="px-2 py-1"><input type="number" value={item[f] ?? ""} onChange={e => onUpdateItem(realIdx, f, e.target.value)} className="w-full h-7 px-1 text-center bg-transparent border border-transparent hover:border-[#323238] focus:border-[#850000]/60 text-white rounded text-xs outline-none transition-colors" /></td>
                                        ))}
                                        <td className="px-2 py-2 rounded-r-lg">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => setEditingIdx(realIdx)} className="h-6 w-6 flex items-center justify-center bg-[#29292e] text-blue-400 hover:bg-blue-600 hover:text-white rounded transition-colors">
                                                    <Edit size={11} />
                                                </button>
                                                <button onClick={() => onDuplicateItem(realIdx)} className="h-6 w-6 flex items-center justify-center bg-[#29292e] text-gray-400 hover:bg-gray-600 hover:text-white rounded transition-colors">
                                                    <Copy size={11} />
                                                </button>
                                                <button onClick={() => onDeleteItem(realIdx)} className="h-6 w-6 flex items-center justify-center bg-[#29292e] text-red-400 hover:bg-red-600 hover:text-white rounded transition-colors">
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="flex flex-wrap gap-2 p-3 bg-[#1a1a1a] border-t border-[#323238]">
                <button onClick={() => onAddItem(false)}
                    className="px-3 py-1.5 bg-[#0052cc] hover:bg-[#0043a8] text-white text-xs font-medium rounded transition-colors">
                    Adicionar Linha
                </button>
                <button onClick={() => onAddItem(true)}
                    className="px-3 py-1.5 bg-[#0052cc] hover:bg-[#0043a8] text-white text-xs font-medium rounded transition-colors">
                    Adicionar Substituto
                </button>
                <button onClick={onAddRefeicaoPronta} className="px-3 py-1.5 bg-[#0052cc] hover:bg-[#0043a8] text-white text-xs font-medium rounded transition-colors">
                    Adicionar Refeição Pronta
                </button>
                <button onClick={() => setExibirSubs(s => !s)}
                    className="px-3 py-1.5 bg-[#29292e] hover:bg-[#2f2f35] border border-[#323238] text-gray-300 text-xs font-medium rounded transition-colors">
                    {exibirSubs ? "Ocultar Substitutos" : "Exibir Substitutos"}
                </button>
            </div>

            {items.length > 0 && (
                <div className="p-4 bg-[#1a1a1a] border-t border-[#323238]">
                    <h3 className="text-sm font-semibold text-white mb-3">Macros Totais da Opção</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="text-gray-500 border-b border-[#323238]">
                                <tr>
                                    <th className="pb-2 font-medium">Prot (g)</th>
                                    <th className="pb-2 font-medium">Carbs (g)</th>
                                    <th className="pb-2 font-medium">Gord (g)</th>
                                    <th className="pb-2 font-medium">kcal</th>
                                    <th className="pb-2 font-medium">Fibra (g)</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-300">
                                <tr>
                                    <td className="pt-2">
                                        <span className="text-white font-medium">{fmt(macrosOpcao.prot, 1)}</span>
                                        {macrosReferencia && <span className={`ml-1.5 text-[10px] font-bold whitespace-nowrap ${macrosOpcao.prot - macrosReferencia.prot > 0.05 ? 'text-green-400' : macrosOpcao.prot - macrosReferencia.prot < -0.05 ? 'text-red-400' : 'text-gray-500'}`}>({fmt(macrosReferencia.prot, 1)})</span>}
                                    </td>
                                    <td className="pt-2">
                                        <span className="text-white font-medium">{fmt(macrosOpcao.carb, 1)}</span>
                                        {macrosReferencia && <span className={`ml-1.5 text-[10px] font-bold whitespace-nowrap ${macrosOpcao.carb - macrosReferencia.carb > 0.05 ? 'text-green-400' : macrosOpcao.carb - macrosReferencia.carb < -0.05 ? 'text-red-400' : 'text-gray-500'}`}>({fmt(macrosReferencia.carb, 1)})</span>}
                                    </td>
                                    <td className="pt-2">
                                        <span className="text-white font-medium">{fmt(macrosOpcao.lip, 1)}</span>
                                        {macrosReferencia && <span className={`ml-1.5 text-[10px] font-bold whitespace-nowrap ${macrosOpcao.lip - macrosReferencia.lip > 0.05 ? 'text-green-400' : macrosOpcao.lip - macrosReferencia.lip < -0.05 ? 'text-red-400' : 'text-gray-500'}`}>({fmt(macrosReferencia.lip, 1)})</span>}
                                    </td>
                                    <td className="pt-2">
                                        <span className="text-white font-medium">{fmt(macrosOpcao.kcal, 0)}</span>
                                        {macrosReferencia && <span className={`ml-1.5 text-[10px] font-bold whitespace-nowrap ${macrosOpcao.kcal - macrosReferencia.kcal > 0.5 ? 'text-green-400' : macrosOpcao.kcal - macrosReferencia.kcal < -0.5 ? 'text-red-400' : 'text-gray-500'}`}>({fmt(macrosReferencia.kcal, 0)})</span>}
                                    </td>
                                    <td className="pt-2">
                                        <span className="text-white font-medium">{fmt(macrosOpcao.fib, 1)}</span>
                                        {macrosReferencia && <span className={`ml-1.5 text-[10px] font-bold whitespace-nowrap ${macrosOpcao.fib - macrosReferencia.fib > 0.05 ? 'text-green-400' : macrosOpcao.fib - macrosReferencia.fib < -0.05 ? 'text-red-400' : 'text-gray-500'}`}>({fmt(macrosReferencia.fib, 1)})</span>}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
const MEAL_LABELS = {
    1: "Café da Manhã", 2: "Lanche da Manhã", 3: "Almoço",
    4: "Lanche da Tarde", 5: "Jantar", 6: "Ceia",
    7: "Refeição 7", 8: "Refeição 8"
};
const RefeicaoBlock = ({ n, draft, setDraft }) => {
    const enabled = draft?.[`meal_${n}`] === 1;

    const opcoes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const opcoesAtivas = enabled ? opcoes.filter(i => draft[`meal_${n}_option_${i}`] === 1) : [];

    const temItens = enabled
        ? opcoesAtivas.some((optNum) => {
            const itemsField = `meal_${n}_option_${optNum}_items`;
            return (draft[itemsField] || []).length > 0;
        })
        : false;

    const itensOpcao1 = draft[`meal_${n}_option_1_items`] || [];
    const macrosReferencia = itensOpcao1.reduce((acc, item) => {
        if (!item.substitute) {
            acc.prot += Number(item.protein || 0);
            acc.carb += Number(item.carbohydrate || 0);
            acc.lip += Number(item.lipid || 0);
            acc.kcal += Number(item.calories || 0);
            acc.fib += Number(item.fiber || 0);
        }
        return acc;
    }, { prot: 0, carb: 0, lip: 0, kcal: 0, fib: 0 });

    const [modalRefeicaoPronta, setModalRefeicaoPronta] = useState(null);
    const [modalSalvarPronta, setModalSalvarPronta] = useState(null);
    const [modalCopiar, setModalCopiar] = useState(null);
    const [aberta, setAberta] = useState(() => temItens);

    const handleCopiarParaDestino = (refeicaoDestino, opcaoDestino, modo, itemsOrigem) => {
        const itemsField = `meal_${refeicaoDestino}_option_${opcaoDestino}_items`;
        console.log("=== COPIAR ===");
        console.log("refeicaoDestino:", refeicaoDestino, typeof refeicaoDestino);
        console.log("opcaoDestino:", opcaoDestino, typeof opcaoDestino);
        console.log("modo:", modo);
        console.log("itemsField:", itemsField);
        console.log("itemsOrigem.length:", itemsOrigem?.length);
        console.log("itemsOrigem:", JSON.stringify(itemsOrigem));

        setDraft(prev => {
            console.log("draft antes:", prev[itemsField]);
            const novosItens = itemsOrigem.map(item => {
                const { name, ...itemSemName } = item;
                return { ...itemSemName, __uid: uid() };
            });
            console.log("novosItens.length:", novosItens.length);
            const existentes = prev[itemsField] || [];
            return {
                ...prev,
                [itemsField]: modo === "substituir" ? novosItens : [...existentes, ...novosItens]
            };
        });
    };

    const makeHandlers = (optNum) => {
        const field = `meal_${n}_option_${optNum}_items`;
        const items = draft[field] || [];
        return {
            items,
            onAddItem: (isSubstitute) => {
                const novo = { __uid: uid(), food: "", substitute: isSubstitute ? 1 : 0, ref_weight: "", unit: "g", weight: "", protein: 0, carbohydrate: 0, lipid: 0, fiber: 0, calories: 0 };
                setDraft(prev => ({ ...prev, [field]: [...(prev[field] || []), novo] }));
            },
            onDeleteItem: (idx) => setDraft(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== idx) })),
            onDuplicateItem: (idx) => setDraft(prev => {
                const arr = [...(prev[field] || [])];
                const { name, ...itemSemName } = arr[idx];
                arr.splice(idx + 1, 0, { ...itemSemName, __uid: uid() });
                return { ...prev, [field]: arr };
            }),
            onMoveItem: (idx, dir) => setDraft(prev => {
                const arr = [...(prev[field] || [])];
                const target = idx + dir;
                if (target < 0 || target >= arr.length) return prev;
                [arr[idx], arr[target]] = [arr[target], arr[idx]];
                return { ...prev, [field]: arr };
            }),
            onUpdateItem: (idx, key, value) => setDraft(prev => {
                const arr = [...(prev[field] || [])];
                if (key === "__selecionarAlimento") {
                    arr[idx] = { ...arr[idx], ...value };
                } else if (key === "ref_weight") {
                    if (!arr[idx]._base) {
                        arr[idx]._base = { ...arr[idx] };
                    }

                    // Força a leitura como número inteiro
                    const novoPeso = parseInt(value, 10) || 0;
                    const pesoBase = parseFloat(arr[idx]._base.ref_weight) || 100;
                    const proporcao = pesoBase > 0 ? novoPeso / pesoBase : 0;

                    // Nova função auxiliar que arredonda direto para número inteiro (sem casa decimal)
                    const calc = (val) => Math.round(Number(val || 0) * proporcao);

                    arr[idx] = {
                        ...arr[idx],
                        [key]: value, // Mantém o que foi digitado para permitir apagar o campo
                        // Macros
                        protein: calc(arr[idx]._base.protein),
                        carbohydrate: calc(arr[idx]._base.carbohydrate),
                        lipid: calc(arr[idx]._base.lipid),
                        fiber: calc(arr[idx]._base.fiber),
                        calories: calc(arr[idx]._base.calories),
                        // Minerais
                        calcium: calc(arr[idx]._base.calcium),
                        copper: calc(arr[idx]._base.copper),
                        iron: calc(arr[idx]._base.iron),
                        phosphor: calc(arr[idx]._base.phosphor),
                        magnesium: calc(arr[idx]._base.magnesium),
                        potassium: calc(arr[idx]._base.potassium),
                        selenium: calc(arr[idx]._base.selenium),
                        sodium: calc(arr[idx]._base.sodium),
                        zinc: calc(arr[idx]._base.zinc),
                        // Vitaminas
                        vitamin_a: calc(arr[idx]._base.vitamin_a),
                        vitamin_b1: calc(arr[idx]._base.vitamin_b1),
                        vitamin_b2: calc(arr[idx]._base.vitamin_b2),
                        vitamin_b3: calc(arr[idx]._base.vitamin_b3),
                        vitamin_b6: calc(arr[idx]._base.vitamin_b6),
                        vitamin_b9: calc(arr[idx]._base.vitamin_b9),
                        vitamin_b12: calc(arr[idx]._base.vitamin_b12),
                        vitamin_c: calc(arr[idx]._base.vitamin_c),
                        vitamin_d: calc(arr[idx]._base.vitamin_d),
                        vitamin_e: calc(arr[idx]._base.vitamin_e)
                    };
                } else {
                    arr[idx] = { ...arr[idx], [key]: value };
                }
                return { ...prev, [field]: arr };
            }),
            onAddRefeicaoPronta: () => setModalRefeicaoPronta({ optNum }),
        };
    };

    const adicionarOpcao = () => {
        const proxima = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find(j => !draft[`meal_${n}_option_${j}`]);
        if (!proxima) return;
        setDraft(prev => ({
            ...prev,
            [`meal_${n}_option_${proxima}`]: 1,
            [`meal_${n}_option_${proxima}_label`]: `Opção ${proxima}`,
            [`meal_${n}_option_${proxima}_items`]: [],
        }));
    };

    const desabilitarOpcao = (optNum) => {
        setDraft(prev => ({
            ...prev,
            [`meal_${n}_option_${optNum}`]: 0,
            [`meal_${n}_option_${optNum}_label`]: "",
            [`meal_${n}_option_${optNum}_items`]: [],
        }));
    };

    if (!enabled) return (
        <div className="mb-3">
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl px-4 py-3 flex items-center justify-between opacity-40 hover:opacity-70 transition-opacity">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#323238] shrink-0" />
                    <span className="text-gray-500 text-sm font-medium">{MEAL_LABELS[n]}</span>
                </div>
                <button onClick={() => setDraft(prev => ({
                    ...prev,
                    [`meal_${n}`]: 1,
                    [`meal_${n}_label`]: MEAL_LABELS[n],
                    [`meal_${n}_option_1`]: 1,
                    [`meal_${n}_option_1_label`]: "Opção 1",
                    [`meal_${n}_option_1_items`]: []
                }))}
                    className="text-xs text-gray-500 hover:text-white border border-[#323238] px-3 py-1 rounded transition-colors">
                    Habilitar
                </button>
            </div>
        </div>
    );

    return (
        <div className="mb-6 bg-[#29292e] border border-[#323238] rounded-xl overflow-hidden">
            {/* Modais */}
            {modalRefeicaoPronta && (
                <ModalAdicionarRefeicaoPronta
                    onClose={() => setModalRefeicaoPronta(null)}
                    onSelectMeal={(foods) => {
                        const { optNum } = modalRefeicaoPronta;
                        const field = `meal_${n}_option_${optNum}_items`;
                        const novos = foods.map(f => {
                            const { name, ...fSemName } = f;
                            return { ...fSemName, __uid: uid() };
                        });
                        setDraft(prev => ({ ...prev, [field]: [...(prev[field] || []), ...novos] }));
                        setModalRefeicaoPronta(null);
                    }}
                />
            )}
            {modalSalvarPronta && (
                <ModalSalvarRefeicaoPronta
                    items={modalSalvarPronta.items}
                    onClose={() => setModalSalvarPronta(null)}
                />
            )}
            {modalCopiar && (
                <ModalCopiarOpcao
                    draft={draft}
                    itemsOrigem={modalCopiar.items}
                    onClose={() => setModalCopiar(null)}
                    onCopiar={handleCopiarParaDestino}
                />
            )}

            {/* Header da Refeição */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#323238]">
                <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-[#850000] shrink-0" />
                    <input
                        value={draft[`meal_${n}_label`] || MEAL_LABELS[n]}
                        onChange={e => setDraft(prev => ({ ...prev, [`meal_${n}_label`]: e.target.value }))}
                        className="bg-transparent text-white font-semibold text-base outline-none border-b border-transparent hover:border-[#323238] focus:border-[#850000]/60 transition-colors"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setAberta(a => !a)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#1a1a1a] border border-[#323238] text-gray-400 hover:text-white transition-colors">
                        {aberta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={() => setDraft(prev => ({ ...prev, [`meal_${n}`]: 0 }))}
                        className="h-8 px-3 text-xs text-[#850000] border border-[#850000]/30 rounded-lg hover:bg-[#850000]/10 transition-colors">
                        Desabilitar
                    </button>
                </div>
            </div>

            {/* Corpo */}
            {aberta && (
                <div className="p-5 space-y-6">
                    {opcoesAtivas.map(optNum => {
                        const h = makeHandlers(optNum);
                        return (
                            <div key={optNum} id={`meal_${n}_option_${optNum}`} className="border border-[#323238] rounded-xl p-4 bg-[#1a1a1a]">
                                <div className="flex flex-col gap-2 mb-4">
                                    {/* Linha 1: Título da Opção */}
                                    <input
                                        value={draft[`meal_${n}_option_${optNum}_label`] || `Opção ${optNum}`}
                                        onChange={e => setDraft(prev => ({ ...prev, [`meal_${n}_option_${optNum}_label`]: e.target.value }))}
                                        className="bg-transparent text-white font-bold text-sm outline-none border-b border-transparent hover:border-[#323238] focus:border-[#850000]/60 transition-colors uppercase tracking-wider w-full md:w-max"
                                    />

                                    {/* Linha 2: Legenda na esquerda e Botões na direita */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
                                        <SugestaoAC
                                            categoria="legendas_refeicoes"
                                            value={draft[`meal_${n}_option_${optNum}_legend`] || ""}
                                            onChange={v => setDraft(prev => ({ ...prev, [`meal_${n}_option_${optNum}_legend`]: v }))}
                                            placeholder="Legenda (Ex: Consumir 40min antes do treino)"
                                            className="bg-transparent text-gray-400 text-xs outline-none border-b border-transparent hover:border-[#323238] focus:border-[#850000]/60 transition-colors w-full text-left pb-1"
                                        />

                                        <div className="flex flex-wrap gap-2 shrink-0">
                                            <button onClick={() => desabilitarOpcao(optNum)}
                                                className="px-2 py-1 border border-[#850000]/40 text-[#850000] hover:bg-[#850000]/10 text-[11px] font-medium rounded transition-colors">
                                                Desabilitar Opção
                                            </button>
                                            <button onClick={() => setModalSalvarPronta({ items: h.items })}
                                                className="px-2 py-1 border border-[#2d5c3f] text-emerald-400 hover:bg-[#2d5c3f]/20 text-[11px] font-medium rounded transition-colors">
                                                Salvar como Ref. Pronta
                                            </button>
                                            <button onClick={() => setModalCopiar({ items: h.items })}
                                                className="px-2 py-1 border border-[#323238] text-gray-400 hover:text-white text-[11px] font-medium rounded transition-colors">
                                                Copiar Opção
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <TabelaAlimentos {...h} macrosReferencia={optNum > 1 ? macrosReferencia : null} />
                            </div>
                        );
                    })}
                    <button onClick={adicionarOpcao}
                        className="w-full py-2 border border-dashed border-[#323238] text-gray-500 hover:text-white hover:border-[#850000]/40 text-sm rounded-xl transition-colors">
                        + Adicionar Opção
                    </button>
                </div>
            )}
        </div>
    );
};
// ─── Componentes de Input ─────────────────────────────────────────────────────
const FormGroup = ({ label, children }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
            {label}
        </label>
        {children}
    </div>
);

const Input = ({ type = "text", value, onChange, placeholder, disabled }) => (
    <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#323238] text-white text-sm rounded-lg focus:outline-none focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    />
);

const Textarea = ({ value, onChange, placeholder, rows = 4 }) => (
    <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full p-3 bg-[#1a1a1a] border border-[#323238] text-white text-sm rounded-lg focus:outline-none focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 transition-colors resize-none"
    />
);

const Select = ({ value, onChange, options }) => (
    <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#323238] text-white text-sm rounded-lg focus:outline-none focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 transition-colors appearance-none"
    >
        <option value="">Selecionar...</option>
        {options.map(opt => (
            <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
            </option>
        ))}
    </select>
);
// ─── COMPONENTE: BANNER DE ORIENTAÇÕES GLOBAIS (Fixo no Treino/Dieta) ─────────
const BannerOrientacoes = ({ alunoId }) => {
    const [orientacoes, setOrientacoes] = useState("");
    const [loading, setLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [textoTemp, setTextoTemp] = useState("");

    // Novo estado para controlar expandir/recolher (começa fechado)
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!alunoId) return;
        setLoading(true);
        const fns = getFunctions();
        const fnCompleto = httpsCallable(fns, "buscarAlunoDetalhe");
        fnCompleto({ id: alunoId })
            .then(res => {
                const d = res.data?.data || res.data || {};
                setOrientacoes(d.orientacoes_globais || "");
                setTextoTemp(d.orientacoes_globais || "");
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [alunoId]);

    const handleSave = async () => {
        if (!alunoId) return;
        setSaving(true);
        try {
            const fns = getFunctions();
            const salvarAlunoFn = httpsCallable(fns, "salvarAluno");
            await salvarAlunoFn({ id: alunoId, campos: { orientacoes_globais: textoTemp } });
            setOrientacoes(textoTemp);
            setEditMode(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!alunoId) return null;
    if (loading) return <div className="animate-pulse h-8 bg-[#850000]/10 border-b border-[#850000]/30 w-full shrink-0"></div>;

    const IcoInfo = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
    const IcoCopy = () => <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>;
    const IcoEdit = () => <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
    const IcoChevronDown = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>;
    const IcoChevronUp = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>;

    return (
        <div className="bg-[#850000]/10 border-b border-[#850000]/30 shrink-0 w-full relative z-40 mb-6 -mt-2 transition-all">
            <div className={`px-5 flex gap-2 items-start transition-all ${expanded ? 'py-2.5' : 'py-1.5'}`}>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        {/* Título agora é um botão que expande/recolhe */}
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="flex items-center gap-1.5 text-[10px] font-bold italic text-gray hover:text-gray-200 uppercase tracking-widest transition-colors outline-none"
                        >
                            <span className="text-red-800 transition-transform">
                                {expanded ? <IcoChevronUp /> : <IcoChevronDown />}
                            </span>
                            Anotações Globais do Aluno
                        </button>

                        <div className="flex items-center gap-3">
                            {saved && <span className="text-green-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"><IcoCopy /> Salvo</span>}
                            {editMode ? (
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditMode(false); setTextoTemp(orientacoes); }} className="text-gray-400 hover:text-white text-[10px] transition-colors underline">Cancelar</button>
                                    <button onClick={handleSave} disabled={saving} className="text-red-400 hover:text-red-300 text-[10px] font-bold transition-colors disabled:opacity-50 underline">{saving ? "..." : "Salvar"}</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setEditMode(true); setExpanded(true); }}
                                    className="text-gray-400 hover:text-red-400 text-[9px] uppercase font-bold tracking-wider transition-colors flex items-center gap-1"
                                >
                                    <IcoEdit /> Editar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Área de conteúdo que só aparece se estiver expandida */}
                    {expanded && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            {editMode ? (
                                <textarea
                                    value={textoTemp}
                                    onChange={e => setTextoTemp(e.target.value)}
                                    rows={3}
                                    className="w-full bg-black/40 border border-red-500/30 focus:border-red-500/70 rounded px-2 py-1 text-red-400 text-xs outline-none resize-none transition-colors"
                                    placeholder="Escreva as restrições ou contexto importante..."
                                />
                            ) : (
                                <p className="text-red-400 text-xs leading-tight max-h-16 overflow-y-auto custom-scrollbar pr-2 whitespace-pre-line">
                                    {orientacoes || <span className="text-red-400/50 italic">Sem contexto cadastrado.</span>}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
// ─── Componente Principal ─────────────────────────────────────────────────────

const TABS = [
    { id: "gerais", label: "Dados Gerais", icon: FileText },
    { id: "refeicoes", label: "Refeições", icon: UtensilsCrossed },
    { id: "ciclo", label: "Ciclo de Carbo", icon: BarChart2 }, // ← NOVA
];

const buscarAlunosFichaFn = httpsCallable(getFunctions(), "buscarAlunosFicha");

const SugestaoAC = ({ categoria, value, onChange, placeholder, isTextarea = false, className = "" }) => {
    const [opts, setOpts] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const carregar = async () => {
        if (opts.length > 0) { setOpen(true); return; }
        setLoading(true);
        try {
            const db = getFirestore();
            const q = query(collection(db, "sugestoes"), where("categoria", "==", categoria));
            const snap = await getDocs(q);
            const res = snap.docs.map(d => d.data().texto);
            setOpts(res);
            if (res.length > 0) setOpen(true);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const baseInputClass = className || "w-full h-10 px-3 bg-[#1a1a1a] border border-[#323238] text-white text-sm rounded-lg focus:outline-none focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 transition-colors";
    const baseTextareaClass = className || "w-full p-3 bg-[#1a1a1a] border border-[#323238] text-white text-sm rounded-lg focus:outline-none focus:border-[#850000]/60 focus:ring-1 focus:ring-[#850000]/30 transition-colors resize-none";

    return (
        <div className="relative w-full flex-1">
            {isTextarea ? (
                <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} onFocus={carregar} onBlur={() => setTimeout(() => setOpen(false), 200)} placeholder={placeholder} rows={4} className={baseTextareaClass} />
            ) : (
                <input value={value || ""} onChange={(e) => onChange(e.target.value)} onFocus={carregar} onBlur={() => setTimeout(() => setOpen(false), 200)} placeholder={placeholder} className={baseInputClass} />
            )}
            {loading && <span className="absolute right-3 top-3 text-gray-500"><Loader size={14} className="animate-spin" /></span>}
            {open && opts.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-[#29292e] border border-[#323238] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {opts.map((texto, i) => (
                        <button key={i} onMouseDown={(e) => { e.preventDefault(); onChange(texto); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#323238] transition border-b border-[#323238]/50 last:border-0">
                            {texto}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const AlunoAC = ({ value, onChange }) => {
    const [q, setQ] = useState(value || "");
    const [opts, setOpts] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handle = async (texto) => {
        setQ(texto);
        if (texto.length < 2) { setOpts([]); setOpen(false); return; }
        setLoading(true);
        try {
            const res = await buscarAlunosFichaFn({ busca: texto });
            setOpts((res.data?.list || []).map(a => ({ id: a.name, nome: a.nome_completo })));
            setOpen(true);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    return (
        <div className="flex flex-col gap-1.5 relative">
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                Aluno <span className="text-red-500">*</span>
            </label>
            <div className="relative">
                <input value={q} onChange={e => handle(e.target.value)}
                    onBlur={() => setTimeout(() => setOpen(false), 200)}
                    placeholder="Digite o nome do aluno..."
                    className="w-full h-10 px-3 bg-[#1a1a1a] border border-[#323238] text-white text-sm rounded-lg focus:outline-none focus:border-[#850000]/60 transition-colors placeholder-gray-600"
                />
                {loading && <span className="absolute right-3 top-3 text-gray-500"><Loader size={14} className="animate-spin" /></span>}
            </div>
            {open && opts.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-[#29292e] border border-[#323238] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {opts.map(o => (
                        <button key={o.id} onMouseDown={() => { onChange(o.id, o.nome); setQ(o.nome); setOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-[#323238] transition">
                            {o.nome}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ModalSalvarRefeicaoPronta = ({ items, onClose }) => {
    const [nome, setNome] = useState("");
    const [salvando, setSalvando] = useState(false);

    const handleSalvar = async () => {
        if (!nome.trim()) { alert("Digite um nome para a refeição."); return; }
        setSalvando(true);
        try {
            await salvarRefeicaoPronta(nome.trim(), items);
            alert("✅ Refeição salva com sucesso!");
            onClose();
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-[#323238]">
                    <h2 className="text-lg font-bold text-white">Salvar como Refeição Pronta</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-gray-400 text-sm">{items.length} alimento(s) serão salvos.</p>
                    <FormGroup label="Nome da Refeição *">
                        <Input value={nome} onChange={setNome} placeholder="Ex: Overnight (335kcal — 9g PTN)" />
                    </FormGroup>
                </div>
                <div className="p-4 border-t border-[#323238] flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 text-gray-400 hover:text-white text-sm border border-[#323238] rounded-lg transition">Cancelar</button>
                    <button onClick={handleSalvar} disabled={salvando}
                        className="px-5 py-2 bg-[#2d5c3f] hover:bg-[#3b7852] text-white text-sm font-medium rounded-lg transition disabled:opacity-60 flex items-center gap-2">
                        {salvando && <Loader size={14} className="animate-spin" />}
                        {salvando ? "Salvando..." : "Salvar"}
                    </button>
                </div>
            </div>
        </div>
    );
};
const ModalCopiarOpcao = ({ draft, itemsOrigem, onClose, onCopiar }) => {
    const [refeicaoDestino, setRefeicaoDestino] = useState("");
    const [opcaoDestino, setOpcaoDestino] = useState("");
    const [modoColagem, setModoColagem] = useState("substituir");

    const refeicoes = [1, 2, 3, 4, 5, 6, 7, 8].filter(n => draft[`meal_${n}`] === 1);
    const opcoes = refeicaoDestino
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(j => draft[`meal_${refeicaoDestino}_option_${j}`] === 1)
        : [];

    const handleCopiar = () => {
        if (!refeicaoDestino || !opcaoDestino) { alert("Selecione a refeição e opção de destino."); return; }
        onCopiar(parseInt(refeicaoDestino), parseInt(opcaoDestino), modoColagem, itemsOrigem); // ← passa itemsOrigem
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-[#323238]">
                    <h2 className="text-lg font-bold text-white">Copiar Opção para...</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-gray-400 text-sm">{itemsOrigem.length} alimento(s) serão copiados.</p>

                    <FormGroup label="Refeição Destino">
                        <Select
                            value={refeicaoDestino}
                            onChange={v => { setRefeicaoDestino(v); setOpcaoDestino(""); }}
                            options={refeicoes.map(n => ({ value: String(n), label: draft[`meal_${n}_label`] || MEAL_LABELS[n] }))}
                        />
                    </FormGroup>

                    {refeicaoDestino && (
                        <FormGroup label="Opção Destino">
                            <Select
                                value={opcaoDestino}
                                onChange={setOpcaoDestino}
                                options={opcoes.map(j => ({ value: String(j), label: draft[`meal_${refeicaoDestino}_option_${j}_label`] || `Opção ${j}` }))}
                            />
                        </FormGroup>
                    )}

                    {opcaoDestino && (
                        <FormGroup label="Modo de Colagem">
                            <div className="flex gap-2">
                                {[
                                    { value: "substituir", label: "Substituir" },
                                    { value: "adicionar", label: "Adicionar ao final" }
                                ].map(op => (
                                    <button key={op.value} onClick={() => setModoColagem(op.value)}
                                        className={`flex-1 py-2 rounded-lg text-sm border transition ${modoColagem === op.value ? "bg-[#850000]/20 border-[#850000]/50 text-red-400" : "border-[#323238] text-gray-400 hover:text-white"}`}>
                                        {op.label}
                                    </button>
                                ))}
                            </div>
                        </FormGroup>
                    )}
                </div>
                <div className="p-4 border-t border-[#323238] flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 text-gray-400 hover:text-white text-sm border border-[#323238] rounded-lg transition">Cancelar</button>
                    <button onClick={handleCopiar}
                        className="px-5 py-2 bg-[#850000] hover:bg-red-700 text-white text-sm font-medium rounded-lg transition">
                        Copiar
                    </button>
                </div>
            </div>
        </div>
    );
};

const ModalDuplicarDieta = ({ dietaId, nomeAtual, onClose, onDuplicado }) => {
    const [modo, setModo] = useState("mesmo");
    const [novoAlunoId, setNovoAlunoId] = useState("");
    const [novoAlunoNome, setNovoAlunoNome] = useState("");
    const [dataInicial, setDataInicial] = useState("");
    const [dataFinal, setDataFinal] = useState("");
    const [duplicando, setDuplicando] = useState(false);

    const handleDuplicar = async () => {
        if (modo === "novo" && !novoAlunoId) { alert("Selecione um aluno."); return; }
        setDuplicando(true);
        try {
            const res = await duplicarDieta(dietaId, modo === "novo" ? novoAlunoId : null, dataInicial || null, dataFinal || null);
            alert(`✅ Dieta duplicada com sucesso!`);
            onDuplicado(res.data?.name);
        } catch (e) {
            alert("Erro ao duplicar: " + e.message);
        } finally {
            setDuplicando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center p-4 border-b border-[#323238]">
                    <h2 className="text-lg font-bold text-white">Duplicar Dieta</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-gray-400 text-sm">Duplicando dieta de <span className="text-white font-medium">{nomeAtual}</span></p>

                    <FormGroup label="Vincular a">
                        <div className="flex gap-2">
                            {[
                                { value: "mesmo", label: "Mesmo Aluno" },
                                { value: "novo", label: "Novo Aluno" }
                            ].map(op => (
                                <button key={op.value} onClick={() => setModo(op.value)}
                                    className={`flex-1 py-2 rounded-lg text-sm border transition ${modo === op.value ? "bg-[#850000]/20 border-[#850000]/50 text-red-400" : "border-[#323238] text-gray-400 hover:text-white"}`}>
                                    {op.label}
                                </button>
                            ))}
                        </div>
                    </FormGroup>

                    {modo === "novo" && (
                        <AlunoAC
                            value={novoAlunoNome}
                            onChange={(id, nome) => { setNovoAlunoId(id); setNovoAlunoNome(nome); }}
                        />
                    )}
                    {/* ← INSIRA AQUI */}
                    <div className="grid grid-cols-2 gap-3">
                        <FormGroup label="Data Inicial">
                            <Input type="date" value={dataInicial} onChange={setDataInicial} />
                        </FormGroup>
                        <FormGroup label="Data Final">
                            <Input type="date" value={dataFinal} onChange={setDataFinal} />
                        </FormGroup>
                    </div>
                    <p className="text-xs text-gray-500">
                        Os dados de peso, altura, idade e sexo serão atualizados com as informações mais recentes do aluno.
                    </p>
                </div>
                <div className="p-4 border-t border-[#323238] flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2 text-gray-400 hover:text-white text-sm border border-[#323238] rounded-lg transition">Cancelar</button>
                    <button onClick={handleDuplicar} disabled={duplicando}
                        className="px-5 py-2 bg-[#850000] hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60 flex items-center gap-2">
                        {duplicando && <Loader size={14} className="animate-spin" />}
                        {duplicando ? "Duplicando..." : "Duplicar"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export { ModalDuplicarDieta };

const CicloCarbo = ({ alunoId }) => {
    const TIPOS = [
        { key: "alto", label: "Alto Carbo" },
        { key: "medio", label: "Médio Carbo" },
        { key: "baixo", label: "Baixo Carbo" },
        { key: "zero", label: "Zero Carbo" },
    ];

    const [metaBase, setMetaBase] = useState("");
    const [dias, setDias] = useState({
        alto: { kcal: "", qtd: "" },
        medio: { kcal: "", qtd: "" },
        baixo: { kcal: "", qtd: "" },
        zero: { kcal: "", qtd: "" },
    });
    const [ultimoSave, setUltimoSave] = useState(null);
    const [dadosSalvos, setDadosSalvos] = useState(null);
    const [salvando, setSalvando] = useState(false);
    const [carregando, setCarregando] = useState(true);
    const [expandido, setExpandido] = useState(false);

    useEffect(() => {
        if (!alunoId) return;
        const carregar = async () => {
            setCarregando(true);
            try {
                const db = getFirestore();
                const ref = doc(db, "ciclos_carboidratos", alunoId);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const d = snap.data();
                    setMetaBase(d.metaBase || "");
                    setDias(d.dias || { alto: { kcal: "", qtd: "" }, medio: { kcal: "", qtd: "" }, baixo: { kcal: "", qtd: "" }, zero: { kcal: "", qtd: "" } });
                    setUltimoSave(d.savedAt || null);
                    setDadosSalvos(d);
                }
            } catch (e) { console.error(e); }
            finally { setCarregando(false); }
        };
        carregar();
    }, [alunoId]);

    const metaSemanal = Number(metaBase || 0) * 7;
    const totalPlanejado = TIPOS.reduce((acc, t) => acc + Number(dias[t.key].kcal || 0) * Number(dias[t.key].qtd || 0), 0);
    const totalDias = TIPOS.reduce((acc, t) => acc + Number(dias[t.key].qtd || 0), 0);
    const diferenca = totalPlanejado - metaSemanal;

    const handleDia = (key, campo, valor) => setDias(prev => ({ ...prev, [key]: { ...prev[key], [campo]: valor } }));

    const handleSalvar = async () => {
        if (!alunoId) return;
        setSalvando(true);
        try {
            const db = getFirestore();
            const ref = doc(db, "ciclos_carboidratos", alunoId);
            const savedAt = new Date().toISOString();
            const payload = { metaBase, dias, savedAt };
            await setDoc(ref, payload);
            setUltimoSave(savedAt);
            setDadosSalvos(payload);
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        } finally { setSalvando(false); }
    };

    if (!alunoId) return (
        <div className="flex items-center justify-center py-20">
            <p className="text-gray-500 text-sm">Selecione um aluno para acessar o ciclo de carboidratos.</p>
        </div>
    );

    if (carregando) return (
        <div className="flex items-center justify-center py-20">
            <Loader size={24} className="animate-spin text-[#850000]" />
        </div>
    );

    return (
        <div className="animate-in fade-in duration-300 space-y-3">

            {/* Linha superior: Meta + Resumo lado a lado */}
            <div className="grid grid-cols-5 gap-3">

                {/* Meta Base */}
                <div className="bg-[#29292e] border border-[#323238] rounded-xl px-4 py-3 flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Kcal/dia</p>
                        <input
                            type="number"
                            value={metaBase}
                            onChange={e => setMetaBase(e.target.value)}
                            placeholder="Ex: 2000"
                            className="w-full h-8 px-2 bg-[#1a1a1a] border border-[#323238] text-white rounded-lg text-sm outline-none focus:border-[#850000]/60 transition-colors"
                        />
                    </div>
                    <div className="shrink-0 text-right">
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Semanal</p>
                        <p className="text-white text-lg font-bold leading-none">{metaSemanal.toLocaleString()}<span className="text-gray-500 text-xs font-normal ml-1">kcal</span></p>
                    </div>
                </div>

                {/* Total Dias e Média */}
                <div className="bg-[#29292e] border border-[#323238] rounded-xl px-4 py-2 flex flex-col justify-center gap-1.5">
                    <div className="flex justify-between items-end">
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider">Dias</p>
                        <p className={`text-base font-bold leading-none ${totalDias === 7 ? "text-green-400" : "text-yellow-400"}`}>
                            {totalDias}<span className="text-gray-500 text-[10px] font-normal">/7</span>
                        </p>
                    </div>
                    <div className="flex justify-between items-end">
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider">Média</p>
                        <p className="text-white text-base font-bold leading-none">
                            {Math.round(totalPlanejado / 7)}<span className="text-gray-500 text-[10px] font-normal ml-0.5">kcal</span>
                        </p>
                    </div>
                </div>

                {/* Total Planejado */}
                <div className="bg-[#29292e] border border-[#323238] rounded-xl px-4 py-3 flex flex-col justify-center">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Total Planejado</p>
                    <p className="text-xl font-bold text-white">{totalPlanejado.toLocaleString()}<span className="text-gray-500 text-xs font-normal ml-1">kcal</span></p>
                </div>

                {/* Diferença */}
                <div className="bg-[#29292e] border border-[#323238] rounded-xl px-4 py-3 flex flex-col justify-center">
                    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Diferença</p>
                    <p className={`text-xl font-bold ${diferenca === 0 ? "text-green-400" : diferenca > 0 ? "text-red-400" : "text-yellow-400"}`}>
                        {diferenca > 0 ? "+" : ""}{diferenca.toLocaleString()}<span className="text-gray-500 text-xs font-normal ml-1">kcal</span>
                    </p>
                </div>

                {/* Salvar */}
                <div className="bg-[#29292e] border border-[#323238] rounded-xl px-4 py-3 flex flex-col justify-between">
                    <p className="text-gray-600 text-[10px] italic">
                        {ultimoSave ? `Salvo: ${new Date(ultimoSave).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Nenhum save ainda"}
                    </p>
                    <button onClick={handleSalvar} disabled={salvando}
                        className="w-full h-8 flex items-center justify-center gap-2 rounded-lg bg-[#850000] hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-60">
                        {salvando ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
                        {salvando ? "Salvando..." : "Salvar Ciclo"}
                    </button>
                </div>
            </div>

            {/* Tabela compacta */}
            <div className="bg-[#29292e] border border-[#323238] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-[#323238] bg-[#222226]">
                            <th className="text-left px-5 py-2 font-medium">Tipo de Dia</th>
                            <th className="text-left px-4 py-2 font-medium">Kcal do Dia</th>
                            <th className="text-left px-4 py-2 font-medium">Nº de Dias</th>
                            <th className="text-left px-4 py-2 font-medium">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#323238]/50">
                        {TIPOS.map(t => {
                            const kcal = Number(dias[t.key].kcal || 0);
                            const qtd = Number(dias[t.key].qtd || 0);
                            const subtotal = kcal * qtd;
                            return (
                                <tr key={t.key} className="hover:bg-[#2f2f35] transition-colors">
                                    <td className="px-5 py-2.5 text-white font-medium text-sm">{t.label}</td>
                                    <td className="px-4 py-2.5">
                                        <input type="number" value={dias[t.key].kcal} onChange={e => handleDia(t.key, "kcal", e.target.value)} placeholder="0"
                                            className="w-24 h-8 px-2 bg-[#1a1a1a] border border-[#323238] text-white rounded-lg text-sm outline-none focus:border-[#850000]/60 transition-colors" />
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <input type="number" value={dias[t.key].qtd} onChange={e => handleDia(t.key, "qtd", e.target.value)} placeholder="0"
                                            className="w-16 h-8 px-2 bg-[#1a1a1a] border border-[#323238] text-white rounded-lg text-sm outline-none focus:border-[#850000]/60 transition-colors" />
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-300 font-medium">
                                        {subtotal > 0 ? subtotal.toLocaleString() : "—"} <span className="text-gray-500 text-xs">kcal</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Painel de Resumo do Ciclo Salvo */}
            {dadosSalvos && dadosSalvos.savedAt && (
                <div className="bg-[#1a1a1a] border border-[#323238] rounded-xl p-5 mt-4 transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
                        <button onClick={() => setExpandido(!expandido)} className="flex items-center gap-2 text-sm font-bold text-white hover:text-gray-300 transition-colors outline-none">
                            <span className="h-2 w-2 rounded-full bg-green-500"></span>
                            {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            Resumo do Ciclo Salvo ({new Date(dadosSalvos.savedAt).toLocaleDateString("pt-BR")})
                        </button>
                        
                        <div className="flex items-center gap-2">
                            <button onClick={() => {
                                setMetaBase(dadosSalvos.metaBase || "");
                                setDias(dadosSalvos.dias || { alto: { kcal: "", qtd: "" }, medio: { kcal: "", qtd: "" }, baixo: { kcal: "", qtd: "" }, zero: { kcal: "", qtd: "" } });
                                setExpandido(true);
                            }} className="px-3 py-1.5 bg-[#29292e] hover:bg-[#323238] border border-[#323238] text-blue-400 text-xs font-medium rounded transition-colors flex items-center gap-1.5">
                                <Edit size={12} /> Editar
                            </button>
                            <button onClick={async () => {
                                if (!window.confirm("Deseja realmente excluir este ciclo salvo?")) return;
                                try {
                                    setCarregando(true);
                                    await deleteDoc(doc(getFirestore(), "ciclos_carboidratos", alunoId));
                                    setDadosSalvos(null);
                                    setUltimoSave(null);
                                    setExpandido(false);
                                } catch(e) { alert("Erro ao excluir: " + e.message); }
                                finally { setCarregando(false); }
                            }} className="px-3 py-1.5 bg-[#29292e] hover:bg-red-900/30 border border-[#323238] hover:border-red-500/30 text-red-400 text-xs font-medium rounded transition-colors flex items-center gap-1.5">
                                <Trash2 size={12} /> Excluir
                            </button>
                        </div>
                    </div>
                    
                    {expandido && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* 1 e 2. Distribuição de Dias */}
                            <div className="bg-[#29292e] border border-[#323238] rounded-lg p-3">
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Distribuição Preenchida</p>
                                <div className="space-y-1.5">
                                    {TIPOS.map(t => {
                                        const d = dadosSalvos.dias[t.key];
                                        if (!d || !Number(d.qtd)) return null;
                                        return (
                                            <div key={t.key} className="flex justify-between text-xs bg-[#222226] px-2 py-1 rounded border border-[#323238]">
                                                <span className="text-gray-300">{d.qtd}x <strong className="text-white">{t.label}</strong></span>
                                                <span className="text-gray-400">{d.kcal} kcal</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Metas */}
                            <div className="bg-[#29292e] border border-[#323238] rounded-lg p-3">
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Meta Base</p>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center bg-[#222226] px-2 py-1.5 rounded border border-[#323238]">
                                        <span className="text-gray-400">Manual/Dia:</span>
                                        <strong className="text-white">{dadosSalvos.metaBase || 0} kcal</strong>
                                    </div>
                                    <div className="flex justify-between items-center bg-[#222226] px-2 py-1.5 rounded border border-[#323238]">
                                        <span className="text-gray-400">Semanal:</span>
                                        <strong className="text-white">{Number(dadosSalvos.metaBase || 0) * 7} kcal</strong>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Média */}
                            <div className="bg-[#29292e] border border-[#323238] rounded-lg p-3 flex flex-col justify-center">
                                <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Média Semanal Real</p>
                                <div className="flex-1 flex flex-col items-center justify-center bg-[#222226] rounded border border-[#323238] py-2">
                                    <p className="text-2xl font-bold text-white leading-none">
                                        {Math.round(TIPOS.reduce((acc, t) => acc + Number(dadosSalvos.dias[t.key]?.kcal || 0) * Number(dadosSalvos.dias[t.key]?.qtd || 0), 0) / 7)}
                                    </p>
                                    <span className="text-gray-500 text-[10px] mt-1">kcal/dia</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
export default function DietaDetalhe({ dietaId, onVoltar }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState("gerais");
    const [toastSubstitutos, setToastSubstitutos] = useState(null);
    const [pendingPayload, setPendingPayload] = useState(null); // ← AQUI

    // O 'draft' é o estado principal. Ele guarda todas as alterações que o usuário faz na tela antes de salvar.
    const isNova = !dietaId;
    const [draft, setDraft] = useState(null);
    const [modalDuplicar, setModalDuplicar] = useState(false);

    useEffect(() => {
        if (isNova) {
            setDraft({
                aluno: "", nome_completo: "", strategy: "", week_days: "",
                date: new Date().toISOString().split("T")[0],
                final_date: "",   // ← adicione aqui
                calorie_goal: "", sexo: "", age: "", weight: "", height: "",
                frequencia_atividade: "", general_description: "", obs: "",
                meal_1: 1, meal_1_label: MEAL_LABELS[1],
                meal_1_option_1: 1, meal_1_option_1_label: "Opção 1", meal_1_option_1_items: [],
                meal_2: 0, meal_3: 0, meal_4: 0, meal_5: 0, meal_6: 0, meal_7: 0, meal_8: 0,
            });
            setLoading(false);
            return;
        }
        const load = async () => {
            setLoading(true);
            try {
                const result = await buscarDietaDetalhe(dietaId);
                const data = result.data || result;
                const addUids = (draft) => {
                    const result = { ...draft };
                    for (let i = 1; i <= 8; i++) {
                        for (let j = 1; j <= 10; j++) {
                            const field = `meal_${i}_option_${j}_items`;
                            if (result[field]) {
                                result[field] = result[field].map(item =>
                                    item.__uid ? item : { ...item, __uid: uid() }
                                );
                            }
                        }
                    }
                    return result;
                };
                setDraft(addUids(data));
            } catch (err) {
                setError(err.message ?? "Erro ao carregar dieta");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [dietaId]);

    const handleSave = async () => {
        if (!draft.aluno) { alert("Selecione um aluno antes de salvar."); return; }
        setSaving(true);
        try {
            const totaisCalc = calcularTotais(draft);
            const payload = { ...draft, total_calories: Math.round(totaisCalc?.kcal || 0) };

            // Remove campos frontend dos itens
            const camposRemover = ["__uid", "_base", "nome_completo"];
            camposRemover.forEach(c => delete payload[c]);

            for (let i = 1; i <= 8; i++) {
                for (let j = 1; j <= 10; j++) {
                    const field = `meal_${i}_option_${j}_items`;
                    if (payload[field]) {
                        payload[field] = payload[field].map(item => {
                            const limpo = { ...item };
                            delete limpo.__uid;
                            delete limpo._base;
                            return limpo;
                        });
                    }
                }
            }

            const calculatedCalories = Math.round(totaisCalc?.kcal || 0);
            const divergencias = verificarSubstitutos(draft);
            if (divergencias.length > 0) {
                setPendingPayload({ payload, calculatedCalories });
                setToastSubstitutos(divergencias);
                return;
            }
            await salvarDieta(isNova ? null : dietaId, payload);
            alert("Dieta salva com sucesso!");
            onVoltar(calculatedCalories);
        } catch (err) {
            alert("Erro ao salvar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field, value) => {
        setDraft(prev => ({ ...prev, [field]: value }));
    };

    const totais = calcularTotais(draft);
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [draft, saving]);

    // ── Telas de Estado ──
    if (loading) return (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-white">
            <Loader size={32} className="animate-spin text-[#850000]" />
            <p className="text-gray-500 text-sm">Carregando dieta...</p>
        </div>
    );

    if (error) return (
        <div className="text-white">
            <button onClick={() => onVoltar()} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
                <ArrowLeft size={16} /><span className="text-sm">Voltar</span>
            </button>
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                <AlertCircle size={18} />
                <p className="text-sm">{error}</p>
            </div>
        </div>
    );

    return (
        <div className="text-white pb-32"> {/* pb-32 para o footer fixo não cobrir o conteúdo */}

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onVoltar(Math.round(calcularTotais(draft)?.kcal || 0))}
                        className="p-2 rounded-lg bg-[#29292e] border border-[#323238] text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-white">
                            {isNova ? "Nova Dieta" : <>Editar Dieta: <span className="text-gray-300 font-medium">{draft.nome_completo || draft.aluno}</span></>}
                        </h1>
                    </div>
                </div>
                {!isNova && (
                    <button
                        onClick={async () => {
                            if (!window.confirm("Tem certeza que deseja excluir esta dieta?")) return;
                            try {
                                await excluirDieta(dietaId);
                                alert("Dieta excluída!");
                                onVoltar();
                            } catch (e) {
                                alert("Erro ao excluir: " + e.message);
                            }
                        }}
                        className="h-10 px-4 flex items-center gap-2 rounded-lg bg-transparent border border-[#850000]/40 text-[#850000] hover:bg-[#850000]/10 text-sm font-medium transition-colors"
                    >
                        <Trash2 size={16} />
                        Excluir
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-10 px-6 flex items-center gap-2 rounded-lg bg-[#850000] hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-lg disabled:opacity-60"
                >
                    {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? "Salvando..." : "Salvar Dieta"}
                </button>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 border-b border-[#323238] mb-6">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === id
                            ? "border-[#850000] text-white"
                            : "border-transparent text-gray-500 hover:text-gray-300"
                            }`}
                    >
                        <Icon size={16} />
                        {label}
                    </button>
                ))}
            </div>

            {/* BANNER FIXO DE CONTEXTO VITAL INJETADO AQUI */}
            {draft.aluno && <BannerOrientacoes alunoId={draft.aluno} />}

            {/* ── Aba: Dados Gerais ── */}
            {tab === "gerais" && (
                <div className="space-y-8 animate-in fade-in duration-300">

                    {/* Bloco 1: Paciente e Datas */}
                    <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <AlunoAC
                                    value={draft.nome_completo}
                                    onChange={async (id, nome) => {
                                        handleChange("aluno", id);
                                        handleChange("nome_completo", nome);
                                        try {
                                            const res = await buscarAlunoDetalhe(id);
                                            if (res.data) {
                                                handleChange("sexo", res.data.sexo || "");
                                                handleChange("age", res.data.age || "");
                                                handleChange("weight", res.data.weight || "");
                                                handleChange("height", res.data.height ? res.data.height * 100 : "");
                                            }
                                        } catch (e) { console.error(e); }
                                    }}
                                />
                            </div>

                            <FormGroup label="Estratégia">
                                <SugestaoAC categoria="estrategia" value={draft.strategy} onChange={(v) => handleChange("strategy", v)} placeholder="Selecione ou digite..." />
                            </FormGroup>
                            <FormGroup label="Dias da Semana">
                                <SugestaoAC categoria="dias_semana" value={draft.week_days} onChange={(v) => handleChange("week_days", v)} placeholder="Selecione ou digite..." />
                            </FormGroup>
                            <FormGroup label="Data Inicial">
                                <Input type="date" value={draft.date} onChange={(v) => handleChange("date", v)} />
                            </FormGroup>
                            <FormGroup label="Data Final">
                                <Input type="date" value={draft.final_date} onChange={(v) => handleChange("final_date", v)} />
                            </FormGroup>
                            <FormGroup label="Meta de Calorias">
                                <Input type="number" value={draft.calorie_goal} onChange={(v) => handleChange("calorie_goal", v)} />
                            </FormGroup>
                        </div>
                    </div>

                    {/* Bloco 2: Biometria */}
                    <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <FormGroup label="Sexo">
                                <Select
                                    value={draft.sexo}
                                    onChange={(v) => handleChange("sexo", v)}
                                    options={["Feminino", "Masculino"]}
                                />
                            </FormGroup>
                            <FormGroup label="Idade">
                                <Input type="number" value={draft.age} onChange={(v) => handleChange("age", v)} />
                            </FormGroup>
                            <FormGroup label="Peso (kg)">
                                <Input type="number" value={draft.weight} onChange={(v) => handleChange("weight", v)} />
                            </FormGroup>
                            <FormGroup label="Altura (cm)">
                                <Input type="number" value={draft.height} onChange={(v) => handleChange("height", v)} />
                            </FormGroup>
                            <div className="md:col-span-2">
                                <FormGroup label="Nível de Atividade Física (PAL)">
                                    <Select
                                        value={draft.frequencia_atividade}
                                        onChange={(v) => handleChange("frequencia_atividade", v)}
                                        options={["Sedentário", "Levemente Ativo", "Moderadamente Ativo", "Muito Ativo", "Extremamente Ativo"]}
                                    />
                                </FormGroup>
                            </div>
                        </div>
                    </div>

                    {/* Bloco 3: Observações */}
                    <div className="bg-[#29292e] border border-[#323238] rounded-xl p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <FormGroup label="Descrições Gerais">
                                <SugestaoAC isTextarea categoria="descricoes_gerais" value={draft.general_description} onChange={(v) => handleChange("general_description", v)} placeholder="Ex: Consumo de água..." />
                            </FormGroup>
                            <FormGroup label="Observações">
                                <SugestaoAC isTextarea categoria="observacoes_dieta" value={draft.obs} onChange={(v) => handleChange("obs", v)} placeholder="Ex: Vegetais permitidos..." />
                            </FormGroup>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Aba: Refeições ── */}
            {tab === "refeicoes" && (
                <div className="animate-in fade-in duration-300 pb-32">
                    <h2 className="text-xl font-bold mb-6 text-white">Refeições</h2>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <RefeicaoBlock key={n} n={n} draft={draft} setDraft={setDraft} />
                    ))}

                    {/* ── Rodapé Fixo Compacto (Apenas nesta aba) ── */}
                    <div className="fixed bottom-0 left-0 right-0 bg-ebony-bg border-t border-ebony-border py-2 px-4 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] z-50">
                        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-6">

                            {/* Bloco Totais */}
                            <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-center">
                                <span className="text-[10px] font-bold text-ebony-text-muted uppercase tracking-widest hidden md:block">Totais:</span>
                                <div className="flex gap-2 md:gap-3 text-[11px] md:text-xs">
                                    <span className="text-gray-300"><strong className="text-white">Prot:</strong> {fmt(totais?.prot, 0)}g</span>
                                    <span className="text-gray-300"><strong className="text-white">Líp:</strong> {fmt(totais?.lip, 0)}g</span>
                                    <span className="text-gray-300"><strong className="text-white">Carb:</strong> {fmt(totais?.carb, 0)}g</span>
                                    <span className="text-gray-300"><strong className="text-white">Fib:</strong> {fmt(totais?.fib, 0)}g</span>
                                    <span className="bg-ebony-primary text-gray-300 border border-ebony-primary/25 shadow-neon-red px-2 py-0.5 rounded font-medium ml-1">
                                        <strong className="text-white">Kcal:</strong> {fmt(totais?.kcal, 0)}
                                    </span>
                                </div>
                            </div>

                            {/* Separador Desktop */}
                            <div className="hidden md:block w-px h-4 bg-ebony-border"></div>

                            {/* Bloco Relativos */}
                            <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-center">
                                <span className="text-[10px] font-bold text-ebony-text-muted uppercase tracking-widest hidden md:block">Relativos:</span>
                                <div className="flex gap-2 md:gap-3 text-[11px] md:text-xs text-ebony-text-muted">
                                    <span>PTN: <strong className="text-white">{fmt(totais?.relProt, 1)}</strong></span>
                                    <span>LIP: <strong className="text-white">{fmt(totais?.relLip, 1)}</strong></span>
                                    <span>CHO: <strong className="text-white">{fmt(totais?.relCarb, 1)}</strong></span>
                                    <span>FIB: <strong className="text-white">{fmt(totais?.relFib, 1)}</strong></span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
            {tab === "ciclo" && (
                <CicloCarbo alunoId={draft.aluno} />
            )}
            {toastSubstitutos && (
                <ToastSubstitutos
                    divergencias={toastSubstitutos}
                    onClose={() => { setToastSubstitutos(null); setPendingPayload(null); }}
                    onConfirmar={async () => {
                        if (!pendingPayload) return;
                        setSaving(true);
                        try {
                            await salvarDieta(isNova ? null : dietaId, pendingPayload.payload);
                            setToastSubstitutos(null);
                            setPendingPayload(null);
                            alert("Dieta salva com sucesso!");
                            onVoltar(pendingPayload.calculatedCalories);
                        } catch (err) {
                            alert("Erro ao salvar: " + err.message);
                        } finally {
                            setSaving(false);
                        }
                    }}
                />
            )}
        </div>
    );
}