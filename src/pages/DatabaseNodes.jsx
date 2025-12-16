import React, { useState, useEffect } from 'react';
import { Database, Trash2, Edit, Save, Plus, ArrowLeft, Shield, Zap, Box } from 'lucide-react';
import NeonWrapper from '../components/NeonWrapper';
import { useAuth } from '../contexts/AuthContext';

// --- SUB-COMPONENTS (Defined OUTSIDE main component to prevent remounting/focus loss) ---

const ListView = ({ codes, startNew, startEditing, handleDelete }) => (
    <div className="space-y-8 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex justify-between items-center">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <Database className="text-cyan-400" /> Database Codes
            </h2>
            <div className="flex gap-4">
                <NeonWrapper color="purple">
                    <button onClick={() => startNew('nexus')} className="px-4 py-2 bg-black border border-purple-500 rounded flex items-center gap-2 hover:bg-purple-900/20 text-purple-300">
                        <Plus size={16} /> New Nexus
                    </button>
                </NeonWrapper>
                <NeonWrapper color="gold">
                    <button onClick={() => startNew('portfolio')} className="px-4 py-2 bg-black border border-yellow-500 rounded flex items-center gap-2 hover:bg-yellow-900/20 text-yellow-300">
                        <Plus size={16} /> New Portfolio
                    </button>
                </NeonWrapper>
            </div>
        </div>

        {/* Nexus Section */}
        <div>
            <h3 className="text-xl text-purple-400 font-bold mb-4 border-b border-purple-500/30 pb-2">Nexus Codes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {codes.nexus.map(c => (
                    <div key={c.nexus_code} className="bg-gray-900/50 border border-purple-500/30 p-4 rounded-xl hover:border-purple-500 transition-colors group relative">
                        <h4 className="text-lg font-bold text-white mb-2">{c.nexus_code}</h4>
                        <p className="text-xs text-gray-400 mb-4">{c.components.length} Components</p>
                        <div className="flex gap-2">
                            <button onClick={() => startEditing(c)} className="p-2 bg-gray-800 rounded hover:text-cyan-400"><Edit size={14} /></button>
                            <button onClick={() => handleDelete('nexus', c.nexus_code)} className="p-2 bg-gray-800 rounded hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Portfolio Section */}
        <div>
            <h3 className="text-xl text-yellow-500 font-bold mb-4 border-b border-yellow-500/30 pb-2">Portfolio Codes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {codes.portfolios.map(c => (
                    <div key={c.portfolio_code} className="bg-gray-900/50 border border-yellow-500/30 p-4 rounded-xl hover:border-yellow-500 transition-colors group relative">
                        <h4 className="text-lg font-bold text-white mb-2">{c.portfolio_code}</h4>
                        <p className="text-xs text-gray-400 mb-4">{c.components.length} Sub-Allocations</p>
                        <div className="flex gap-2">
                            <button onClick={() => startEditing(c)} className="p-2 bg-gray-800 rounded hover:text-cyan-400"><Edit size={14} /></button>
                            <button onClick={() => handleDelete('portfolio', c.portfolio_code)} className="p-2 bg-gray-800 rounded hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const EditorView = ({ activeCode, setActiveCode, handleSave, setViewMode }) => {
    if (!activeCode) return null;
    const isNexus = activeCode.type === 'nexus';
    const color = isNexus ? 'purple' : 'yellow';

    // Helper to update root field
    const updateField = (field, val) => {
        setActiveCode(prev => ({ ...prev, [field]: val }));
    };

    // Helper to add component
    const addComponent = () => {
        const newComp = isNexus ?
            { type: 'Portfolio', value: 'NEW', weight: 0 } :
            { tickers: '', weight: 0 };
        setActiveCode(prev => ({
            ...prev,
            components: [...prev.components, newComp]
        }));
    };

    // Helper to remove component
    const removeComponent = (idx) => {
        setActiveCode(prev => ({
            ...prev,
            components: prev.components.filter((_, i) => i !== idx)
        }));
    };

    // Helper to update component
    const updateComponent = (idx, field, val) => {
        setActiveCode(prev => {
            const newComps = [...prev.components];
            newComps[idx] = { ...newComps[idx], [field]: val };
            return { ...prev, components: newComps };
        });
    };

    return (
        <div className="min-h-screen bg-black/90 p-8 text-white relative overflow-hidden">
            {/* Editor Toolbar */}
            <div className="fixed top-24 left-8 right-8 z-10 flex justify-between items-center bg-gray-900/80 backdrop-blur p-4 rounded-xl border border-gray-700">
                <div className="flex items-center gap-4">
                    <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-800 rounded"><ArrowLeft /></button>
                    <h2 className={`text-2xl font-bold text-${color}-400`}>
                        Editing {isNexus ? 'Nexus' : 'Portfolio'}:
                        <input
                            className="bg-transparent border-b border-gray-600 ml-2 focus:border-white outline-none"
                            value={isNexus ? activeCode.nexus_code : activeCode.portfolio_code}
                            onChange={(e) => updateField(isNexus ? 'nexus_code' : 'portfolio_code', e.target.value)}
                        />
                    </h2>
                </div>
                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-green-600 rounded hover:bg-green-500 font-bold">
                    <Save size={18} /> Save Database Code
                </button>
            </div>

            {/* Workspace (Tree Canvas Visualization) */}
            <div className="mt-32 flex flex-col items-center">

                {/* ROOT NODE */}
                <div className={`w-96 p-6 rounded-xl border-2 border-${color}-500 bg-gray-900/80 relative shadow-[0_0_30px_rgba(${isNexus ? 168 : 234},${isNexus ? 85 : 179},${isNexus ? 247 : 8},0.2)]`}>
                    <div className="absolute -top-3 left-4 px-2 bg-black text-xs font-bold uppercase tracking-widest text-gray-500">Root Node</div>

                    {/* Global Settings */}
                    <div className="space-y-4">
                        {/* Shared Params */}
                        <div className="flex items-center justify-between mb-4">
                            {/* Fractional Hidden (Defaults to True) */}
                        </div>

                        {!isNexus && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Sensitivity</label>
                                        <input type="number" className="w-full bg-black border border-gray-700 rounded px-2 py-1" value={activeCode.ema_sensitivity} onChange={(e) => updateField('ema_sensitivity', parseInt(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Amplification</label>
                                        <input type="number" className="w-full bg-black border border-gray-700 rounded px-2 py-1" value={activeCode.amplification} onChange={(e) => updateField('amplification', parseFloat(e.target.value))} />
                                    </div>
                                </div>

                            </>
                        )}
                    </div>

                    {/* Connection Line Origin */}
                    <div className="absolute bottom-0 left-1/2 w-0.5 h-12 bg-gray-600 translate-y-full"></div>
                </div>

                {/* CHILDREN CONTAINER */}
                {/* CHILDREN CONTAINER - Multi-row Layout */}
                <div className="mt-12 flex flex-col items-center gap-16">
                    {/* Helper to chunk array */}
                    {(() => {
                        const rows = [];
                        const components = activeCode.components;
                        for (let i = 0; i < components.length; i += 4) {
                            rows.push(components.slice(i, i + 4));
                        }

                        return rows.map((row, rowIndex) => (
                            <div key={rowIndex} className="relative flex gap-8 pt-8">
                                {/* Connectivity Lines for this Row */}
                                {/* 1. Vertical Spine from Root/Previous Row to this Row's Top */}
                                <div className="absolute -top-16 left-1/2 w-0.5 h-16 bg-gray-600 -translate-x-1/2"></div>

                                {/* 2. Horizontal Bar connecting all items in this row */}
                                {row.length > 1 && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-gray-600"
                                        style={{ width: `${(row.length - 1) * 320}px` }}></div>
                                )}

                                {row.map((comp, colIndex) => {
                                    const realIndex = rowIndex * 4 + colIndex;
                                    return (
                                        <div key={realIndex} className="relative w-72 flex flex-col items-center">
                                            {/* Vertical logic line from horizontal bar to item */}
                                            <div className="absolute top-0 left-1/2 w-0.5 h-8 bg-gray-600 -translate-y-full"></div>

                                            {/* Child Type Visual */}
                                            <div className={`w-full p-4 rounded-lg bg-gray-900 border ${isNexus ? 'border-blue-500' : 'border-blue-500'} relative group`}>

                                                {/* Weight Tag */}
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 px-2 py-0.5 text-xs rounded text-gray-300 z-10">
                                                    Weight: <input className="bg-transparent w-8 text-center" value={comp.weight} onChange={(e) => updateComponent(realIndex, 'weight', e.target.value)} />%
                                                </div>

                                                <button onClick={() => removeComponent(realIndex)} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>

                                                {isNexus ? (
                                                    <div className="space-y-2">
                                                        <select className="w-full bg-black text-xs border border-gray-700 rounded px-2 py-1 text-purple-300" value={comp.type} onChange={(e) => updateComponent(realIndex, 'type', e.target.value)}>
                                                            <option>Portfolio</option>
                                                            <option>Command</option>
                                                        </select>
                                                        <input className="w-full bg-black text-sm border border-gray-700 rounded px-2 py-1 text-white" value={comp.value} onChange={(e) => updateComponent(realIndex, 'value', e.target.value)} placeholder="Value (e.g. quantumfix)" />
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1 justify-center">
                                                            {comp.type === 'Portfolio' ? <Box size={10} /> : <Zap size={10} />}
                                                            {comp.type === 'Portfolio' ? 'Sub-Portfolio' : 'Command Exec'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest text-center mb-1">ASSET BUCKET</div>
                                                        <textarea
                                                            className="w-full h-24 bg-black/50 border border-blue-900/50 rounded p-2 text-xs font-mono text-blue-100 resize-none focus:border-blue-500 outline-none"
                                                            value={comp.tickers}
                                                            onChange={(e) => updateComponent(realIndex, 'tickers', e.target.value)}
                                                            placeholder="e.g. AAPL, MSFT, GOOG"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ));
                    })()}

                    {/* Add New Button (always at bottom) */}
                    <button onClick={addComponent} className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center text-gray-600 hover:text-white hover:border-white transition-colors">
                        <Plus />
                    </button>
                </div>
            </div>
        </div >
    );
};

// --- MAIN COMPONENT ---

const DatabaseNodes = () => {
    const { userProfile } = useAuth();
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'editor'
    const [codes, setCodes] = useState({ nexus: [], portfolios: [] });
    const [activeCode, setActiveCode] = useState(null); // The code being edited
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCodes();
    }, []);

    const fetchCodes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/database/codes');
            if (!res.ok) throw new Error("API Error");
            const data = await res.json();
            setCodes(data);
        } catch (e) {
            console.error("Failed to fetch codes:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (type, id) => {
        if (!confirm(`Are you sure you want to delete ${id}?`)) return;
        try {
            await fetch('/api/database/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, id })
            });
            fetchCodes();
        } catch (e) {
            console.error("Delete failed:", e);
        }
    };

    const handleSave = async () => {
        if (!activeCode) return;

        // --- Validation Logic ---
        let totalWeight = 0.0;
        let hasZeroWeight = false;
        let items = [];

        // Identify Items based on type
        const isNexus = activeCode.type === 'nexus' || activeCode.nexus_code;
        if (isNexus) {
            items = activeCode.components || [];
        } else {
            items = activeCode.sub_portfolios || []; // Check both potential keys
            if (!items.length && activeCode.tickers_1) {
                // Fallback for flat structure? Usually Editor converts to array.
                // Assuming EditorView uses 'sub_portfolios' or 'components'.
                // Let's check EditorView first to be sure.
                // Actually, let's look at how it maps.
                // Nexus uses 'components', Portfolio usually uses 'sub_portfolios'.
                items = activeCode.sub_portfolios || [];
            }
        }

        // Calculate
        for (const item of items) {
            const w = parseFloat(item.weight || 0);
            if (w <= 0) hasZeroWeight = true;
            totalWeight += w;
        }

        // Apply Rules
        // Rule 1: Total must be 100 (allow small float error)
        if (Math.abs(totalWeight - 100) > 0.1) {
            alert(`Validation Error: Total weight must be 100%. Current total: ${totalWeight.toFixed(1)}%`);
            return;
        }

        // Rule 2: No Zero Weights
        if (hasZeroWeight) {
            alert("Validation Error: All components must have a weight greater than 0%.");
            return;
        }
        // -----------------------

        try {
            const payload = {
                type: isNexus ? 'nexus' : 'portfolio',
                data: activeCode,
                email: userProfile?.email,
                original_id: activeCode.originalId // Send original ID for rename/overwrite logic
            };

            const res = await fetch('/api/database/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.status === 403) {
                const err = await res.json();
                alert(err.detail || "Limit Reached. Please Upgrade.");
                return;
            }

            if (!res.ok) throw new Error("Save Failed");

            alert("Saved successfully!");
            fetchCodes();
            setViewMode('list');
        } catch (e) {
            console.error("Save failed:", e);
            alert("Error saving: " + e.message);
        }
    };

    const startEditing = (code) => {
        // Deep copy to avoid mutating state directly
        const copy = JSON.parse(JSON.stringify(code));
        // Store original ID to handle renaming
        copy.originalId = copy.type === 'nexus' ? copy.nexus_code : copy.portfolio_code;
        setActiveCode(copy);
        setViewMode('editor');
    };

    const startNew = (type) => {
        const newCode = type === 'nexus' ? {
            type: 'nexus',
            nexus_code: 'NEW_NEXUS',
            components: [],
            frac_shares: true,
            num_components: 0
        } : {
            type: 'portfolio',
            portfolio_code: 'NEW_PORTFOLIO',
            ema_sensitivity: 2,
            amplification: 1.0,
            components: [],
            frac_shares: true,
            risk_tolerance: 10,
            risk_type: 'stock',
            remove_amplification_cap: true
        };
        setActiveCode(newCode); // No originalId for new
        setViewMode('editor');
    };

    return (
        <div className="min-h-screen bg-black pt-24 pb-12 px-8">
            {viewMode === 'list' && (
                <ListView
                    codes={codes}
                    startNew={startNew}
                    startEditing={startEditing}
                    handleDelete={handleDelete}
                />
            )}
            {viewMode === 'editor' && (
                <EditorView
                    activeCode={activeCode}
                    setActiveCode={setActiveCode}
                    handleSave={handleSave}
                    setViewMode={setViewMode}
                />
            )}
        </div>
    );
};

export default DatabaseNodes;
