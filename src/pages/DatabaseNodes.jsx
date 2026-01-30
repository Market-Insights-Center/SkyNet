import React, { useState, useEffect } from 'react';
import { Database, Trash2, Edit, Save, Plus, ArrowLeft, Shield, Zap, Box, ChevronDown, ChevronRight } from 'lucide-react';
import NeonWrapper from '../components/NeonWrapper';
import { useAuth } from '../contexts/AuthContext';

// --- SUB-COMPONENTS (Defined OUTSIDE main component to prevent remounting/focus loss) ---

// --- API URL ---
const API_URL = '/api'; // Relative proxy

const ListView = ({ codes, startNew, startEditing, handleDelete, handleShare }) => (
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
                    {/* Add conditional limit logic indicator if needed, 
                        but simpler to just rely on backend 403 or add a small indicator text 
                        "Limit: 5" etc.
                        The request is "icon and very clear tier limitation messages".
                        So I should probably wrap this or add a help text.
                    */}
                </NeonWrapper>
                <NeonWrapper color="gold">
                    <button onClick={() => startNew('portfolio')} className="px-4 py-2 bg-black border border-yellow-500 rounded flex items-center gap-2 hover:bg-yellow-900/20 text-yellow-300">
                        <Plus size={16} /> New Portfolio
                    </button>
                </NeonWrapper>
            </div>
            {/* Tier Limits Info Banner */}
            <div className="mt-4 flex gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                    <Shield size={12} className="text-purple-500" />
                    <span>Basic: 3 | Pro: 10 | Enterprise: Unlimited</span>
                </div>
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
                            <button onClick={() => handleShare(c, 'nexus')} className="p-2 bg-gray-800 rounded hover:text-blue-400" title="Share"><Box size={14} /></button>
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
                            <button onClick={() => handleShare(c, 'portfolio')} className="p-2 bg-gray-800 rounded hover:text-blue-400" title="Share"><Box size={14} /></button>
                            <button onClick={() => handleDelete('portfolio', c.portfolio_code)} className="p-2 bg-gray-800 rounded hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div >
);

const CommunityView = ({ communityCodes, sort, setSort, handleImport, userProfile, handleDeleteCommunity }) => (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                Community <span className="text-blue-500">Hub</span>
            </h2>
            <div className="flex gap-4">
                <button onClick={() => setSort('recent')} className={`px-3 py-1 text-sm rounded transition-colors ${sort === 'recent' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Newest</button>
                <button onClick={() => setSort('popular')} className={`px-3 py-1 text-sm rounded transition-colors ${sort === 'popular' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Popular</button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {communityCodes.map(code => (
                <div key={code.id} className={`bg-gray-900/50 border ${code.type === 'nexus' ? 'border-purple-500/30 hover:border-purple-500' : 'border-yellow-500/30 hover:border-yellow-500'} p-6 rounded-xl transition-colors group relative`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg ${code.type === 'nexus' ? 'bg-purple-500/10 text-purple-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                            {code.type === 'nexus' ? <Database size={20} /> : <Box size={20} />}
                        </div>
                        <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 flex items-center gap-1">
                            {code.copy_count} Downloads
                        </span>
                    </div>
                    <h4 className="text-xl font-bold text-white mb-1">{code.code}</h4>
                    <p className="text-xs text-blue-400 mb-4">@{code.creator}</p>

                    <button
                        onClick={() => handleImport(code)}
                        className="w-full py-2 bg-gray-800 hover:bg-white hover:text-black rounded-lg transition-colors font-bold text-sm flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Import to My Database
                    </button>
                    {((userProfile?.username || '').toLowerCase() === (code.creator || '').toLowerCase()) && (
                        <button
                            onClick={() => handleDeleteCommunity(code)}
                            className="w-full mt-2 py-2 bg-red-900/20 hover:bg-red-500 hover:text-white text-red-500 rounded-lg transition-colors font-bold text-sm flex items-center justify-center gap-2"
                        >
                            <Trash2 size={16} /> Delete from Community
                        </button>
                    )}
                </div>
            ))}
            {communityCodes.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-500">Loading community codes...</div>
            )}
        </div>
    </div>
);


const PortfolioHierarchyInternal = ({ code, codes, startEditing, level }) => {
    const definition = codes.nexus.find(c => c.nexus_code === code) ||
        codes.portfolios.find(p => p.portfolio_code === code);
    if (!definition) return null;

    const items = definition.components || definition.sub_portfolios || [];
    const connectedCmds = definition.connected_commands || [];

    return (
        <div className={`mt-1 ${level > 0 ? 'ml-2 pl-2 border-l border-gray-700/50' : ''}`}>
            {/* Header is handled by parent for the toggle button usually, but here we render the BLOCK */}
            {/* The parent renders the "Button > Name %". This component renders the content beneath. */}

            {/* Recursive Items */}
            <div className="space-y-1">
                {items.map((sub, sIdx) => {
                    const label = sub.tickers || sub.ticker || sub.value || "Unknown";
                    const childDef = codes.nexus.find(c => c.nexus_code === label) ||
                        codes.portfolios.find(p => p.portfolio_code === label);

                    let typeLabel = "";
                    if (sub.type === 'command') typeLabel = "[CMD] ";

                    return (
                        <HierarchyItem
                            key={sIdx}
                            label={label}
                            typeLabel={typeLabel}
                            weight={sub.weight}
                            childDef={childDef}
                            codes={codes}
                            startEditing={startEditing}
                            level={level}
                        />
                    );
                })}
                {connectedCmds.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-gray-700/30">
                        {connectedCmds.map((cmd, cIdx) => (
                            <div key={cIdx} className="text-xs text-purple-400 font-mono pl-4">/{cmd}</div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

const HierarchyItem = ({ label, typeLabel, weight, childDef, codes, startEditing, level }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div>
            <div className="flex justify-between text-xs text-gray-300 hover:bg-white/5 p-1 rounded items-center">
                <div className="flex items-center gap-2">
                    {childDef ? (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-blue-400 hover:text-white transition-colors"
                        >
                            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                    ) : <span className="w-3"></span>}

                    <span className={childDef ? "text-blue-200" : ""}>
                        <span className="text-purple-400">{typeLabel}</span>{label}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-500">{weight}%</span>
                    {childDef && (
                        <button
                            onClick={() => startEditing(childDef)}
                            className="text-[10px] text-gray-600 hover:text-blue-400 opacity-50 hover:opacity-100"
                            title="Edit Directly"
                        >
                            <Edit size={10} />
                        </button>
                    )}
                </div>
            </div>

            {expanded && childDef && (
                <PortfolioHierarchyInternal
                    code={label}
                    codes={codes}
                    startEditing={startEditing}
                    level={level + 1}
                />
            )}
        </div>
    )
}

const EditorView = ({ activeCode, setActiveCode, handleSave, setViewMode, codes, startEditing }) => {
    const isNexus = activeCode.type === 'nexus';
    const [expandedItems, setExpandedItems] = useState({});

    const toggleExpand = (idx) => {
        setExpandedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const getSubPortfolio = (codeName) => {
        if (!codeName) return null;
        return codes.portfolios.find(p => p.portfolio_code === codeName)
            || codes.nexus.find(n => n.nexus_code === codeName);
    };
    const updateField = (field, value) => {
        setActiveCode(prev => ({ ...prev, [field]: value }));
    };

    // Helper to determine the correct list key (nexus uses 'components', portfolio uses 'sub_portfolios')
    // We check what exists or fallback based on type.
    const getListKey = () => {
        if (activeCode.components && activeCode.components.length > 0) return 'components';
        if (activeCode.sub_portfolios && activeCode.sub_portfolios.length > 0) return 'sub_portfolios';
        return isNexus ? 'components' : 'sub_portfolios';
    };
    const listKey = getListKey();
    const items = activeCode[listKey] || [];

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setActiveCode(prev => ({ ...prev, [listKey]: newItems }));
    };

    const addItem = () => {
        const newItem = isNexus
            ? { type: 'ticker', value: '', weight: 0 }
            : { tickers: '', weight: 0 };

        setActiveCode(prev => ({
            ...prev,
            [listKey]: [...(prev[listKey] || []), newItem]
        }));
    };

    const deleteItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        setActiveCode(prev => ({ ...prev, [listKey]: newItems }));
    };



    const totalWeight = items.reduce((s, i) => s + (parseFloat(i.weight) || 0), 0);

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                        <ArrowLeft className="text-gray-400" />
                    </button>
                    <h2 className="text-2xl font-bold text-white">
                        Edit <span className={isNexus ? "text-purple-400" : "text-yellow-400"}>{isNexus ? "Nexus" : "Portfolio"}</span>
                    </h2>
                </div>
                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-colors shadow-[0_0_15px_rgba(22,163,74,0.3)]">
                    <Save size={18} /> Save Changes
                </button>
            </div>

            {/* Main Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-400">Code Identifier</label>
                    <input
                        value={isNexus ? activeCode.nexus_code : activeCode.portfolio_code}
                        onChange={(e) => updateField(isNexus ? 'nexus_code' : 'portfolio_code', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none font-mono"
                        placeholder="e.g. ALPHA_V1"
                    />
                </div>

                {!isNexus && (
                    <>
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-400">Risk Tolerance (0-100)</label>
                            <input
                                type="number"
                                value={activeCode.risk_tolerance || 0}
                                onChange={(e) => updateField('risk_tolerance', parseInt(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-yellow-500 outline-none"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-400">Amplification</label>
                            <input
                                type="number"
                                step="0.1"
                                value={activeCode.amplification || 1.0}
                                onChange={(e) => updateField('amplification', parseFloat(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-yellow-500 outline-none"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Components List */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">Allocation Components</h3>
                    <button onClick={addItem} className="text-sm flex items-center gap-2 text-cyan-400 hover:text-cyan-300">
                        <Plus size={16} /> Add Component
                    </button>
                </div>

                <div className="space-y-3">
                    {items.map((item, idx) => (
                        <div key={idx} className="bg-black/40 rounded-lg border border-gray-800/50 mb-3">
                            {/* Top Row: Inputs */}
                            <div className="flex gap-4 items-center p-3">
                                {isNexus ? (
                                    <>
                                        <select
                                            value={item.type || 'ticker'}
                                            onChange={(e) => updateItem(idx, 'type', e.target.value)}
                                            className="bg-gray-800 border-none text-xs rounded text-gray-300 focus:ring-0 cursor-pointer"
                                        >
                                            <option className="text-black" value="ticker">Ticker</option>
                                            <option className="text-black" value="portfolio">Portfolio</option>
                                            <option className="text-black" value="command">Command</option>
                                        </select>
                                        {item.type === 'command' ? (
                                            <select
                                                value={item.value || 'breakout'}
                                                onChange={(e) => updateItem(idx, 'value', e.target.value)}
                                                className="bg-gray-800 border bg-transparent border-gray-700 rounded text-white text-sm focus:border-white px-2 py-1 outline-none w-32"
                                            >
                                                <option className="text-black" value="breakout">Breakout</option>
                                                <option className="text-black" value="market">Market</option>
                                                <option className="text-black" value="cultivate">Cultivate</option>
                                            </select>
                                        ) : (
                                            <input
                                                value={item.value || ''}
                                                onChange={(e) => updateItem(idx, 'value', e.target.value)}
                                                placeholder={item.type === 'portfolio' ? "PORT_CODE" : "TICKER"}
                                                className="bg-transparent border-b border-gray-700 focus:border-white w-32 text-white font-mono outline-none"
                                            />
                                        )}
                                    </>
                                ) : (
                                    /* Standard Portfolio Ticker/Sub-Portfolio Input */
                                    <input
                                        value={item.tickers || item.ticker || item.symbol || ''}
                                        onChange={(e) => updateItem(idx, 'tickers', e.target.value.toUpperCase())}
                                        placeholder="TICKER"
                                        className="bg-transparent border-b border-gray-700 focus:border-white w-24 text-white font-mono uppercase outline-none"
                                    />
                                )}

                                <div className="flex items-center gap-2 flex-1 justify-end">
                                    <input
                                        type="number"
                                        value={item.weight || 0}
                                        onChange={(e) => updateItem(idx, 'weight', parseFloat(e.target.value))}
                                        className="bg-transparent border-b border-gray-700 focus:border-white w-20 text-right text-white font-mono outline-none"
                                    />
                                    <span className="text-gray-500">%</span>
                                </div>
                                <button onClick={() => deleteItem(idx)} className="text-gray-600 hover:text-red-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {/* Bottom Row: Expansion (for Sub-Portfolios) */}
                            {(() => {
                                const subCode = isNexus
                                    ? (item.type === 'portfolio' ? (item.tickers || item.ticker || item.value) : item.value)
                                    : (item.tickers || item.ticker);

                                const subP = getSubPortfolio(subCode);

                                // For Nexus: Only expand if type is portfolio or it's a valid sub-portfolio ref
                                // For Standard: Always try to expand if subP exists
                                if (!subP) return null;
                                if (isNexus && item.type === 'ticker') return null;

                                const isExpanded = expandedItems[idx];

                                return (
                                    <div className="px-3 pb-3">
                                        <div className="mt-2 border-t border-gray-700/50 pt-2">
                                            <button onClick={() => toggleExpand(idx)} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 mb-2">
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                {isExpanded ? 'Hide Contents' : 'Show Contents'}
                                            </button>

                                            {isExpanded && (
                                                <div className="bg-gray-800/30 rounded p-3 animate-in fade-in slide-in-from-top-1">
                                                    <div className="flex justify-between items-center mb-2 border-b border-gray-700/50 pb-2">
                                                        <span className="text-xs font-mono text-gray-400">@{subP.portfolio_code || subP.nexus_code}</span>
                                                        <button
                                                            onClick={() => startEditing(subP)}
                                                            className="text-xs bg-blue-900/30 hover:bg-blue-600 text-blue-300 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1"
                                                        >
                                                            <Edit size={12} /> Edit Directly
                                                        </button>
                                                    </div>

                                                    {/* Use Recursive Component */}
                                                    <PortfolioHierarchyInternal
                                                        code={subCode}
                                                        codes={codes}
                                                        startEditing={startEditing}
                                                        level={0}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    ))}
                    {items.length === 0 && (
                        <p className="text-center text-gray-600 py-4 italic">No components added yet.</p>
                    )}
                </div>

                {/* Total Weight Check */}
                <div className="mt-4 flex justify-end">
                    <div className={`text-sm font-bold ${Math.abs(totalWeight - 100) < 0.1 ? 'text-green-500' : 'text-red-500'}`}>
                        Total Allocation: {totalWeight.toFixed(1)}%
                    </div>
                </div>
            </div >


        </div >
    );
};


const DatabaseNodes = () => {
    const { userProfile } = useAuth();
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'editor' | 'community'
    const [codes, setCodes] = useState({ nexus: [], portfolios: [] });
    const [communityCodes, setCommunityCodes] = useState([]);
    const [communitySort, setCommunitySort] = useState('recent');
    const [activeCode, setActiveCode] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCodes();
    }, []);

    useEffect(() => {
        if (viewMode === 'community') {
            fetchCommunity();
        }
    }, [viewMode, communitySort]);

    const fetchCommunity = async () => {
        try {
            const res = await fetch(`/api/database/community?sort=${communitySort}`);
            const data = await res.json();
            setCommunityCodes(data);
        } catch (e) {
            console.error(e);
        }
    };

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

    const handleShare = async (code, type) => {
        if (!confirm(`Share ${type === 'nexus' ? code.nexus_code : code.portfolio_code} to the Community?`)) return;
        const username = userProfile?.username || "Anonymous";
        const payload = {
            automation: { ...code, type }, // Reuse automation format roughly or adapt backend
            username
        };
        // Backend `share_portfolio` expects `data` (which is automation/code object) and `username`.
        // Main.py maps `req.automation` to `data`.

        try {
            const res = await fetch('/api/database/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) alert("Shared successfully!");
            else alert("Share failed.");
        } catch (e) {
            console.error(e);
            alert("Error sharing.");
        }
    };



    const handleDeleteCommunity = async (code) => {
        const username = userProfile?.username;
        if (!username || code.creator !== username) return;
        if (!confirm(`Delete "${code.code}" from Community?`)) return;

        try {
            const res = await fetch('/api/database/community/delete-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: code.id, username })
            });
            if (res.ok) {
                alert("Deleted successfully.");
                fetchCommunity();
            } else {
                const d = await res.json();
                alert(d.detail || "Failed to delete.");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting.");
        }
    };

    const handleImport = async (sharedCode) => {
        // Increment count
        fetch('/api/database/copy-count', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shared_id: sharedCode.id })
        });

        // Save as new
        if (!confirm(`Import ${sharedCode.code}?`)) return;

        const type = sharedCode.type;
        const data = sharedCode.data;
        // Rename to avoid conflict? Or let backend handle overwrite/new ID logic?
        // Let's prepend "Copy of"
        if (type === 'nexus') data.nexus_code = `Copy of ${data.nexus_code}`;
        else data.portfolio_code = `Copy of ${data.portfolio_code}`;
        data.originalId = null; // Ensure new creation

        const payload = {
            type,
            data,
            email: userProfile?.email
        };

        try {
            const res = await fetch('/api/database/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                alert("Imported successfully!");
                setViewMode('list');
                fetchCodes();
            } else {
                alert("Import failed.");
            }
        } catch (e) { console.error(e); }
    };

    // ... handleSave, startEditing, startNew (Keep existing logic) ...
    // I need to paste them back or rely on `replace_file_content` to keep them if I don't touch them.
    // The safest is to rewrite `DatabaseNodes` fully if I am replacing the block.

    // START: Copied Helpers to ensure function integrity
    const handleSave = async () => {
        if (!activeCode) return;
        let totalWeight = 0.0;
        let hasZeroWeight = false;
        let items = [];
        const isNexus = activeCode.type === 'nexus' || activeCode.nexus_code;
        if (isNexus) {
            items = activeCode.components || [];
        } else {
            items = activeCode.sub_portfolios || [];
            if (!items.length && activeCode.tickers_1) {
                items = activeCode.sub_portfolios || [];
            }
        }
        for (const item of items) {
            const w = parseFloat(item.weight || 0);
            if (w <= 0) hasZeroWeight = true;
            totalWeight += w;
        }
        if (Math.abs(totalWeight - 100) > 0.1) {
            alert(`Validation Error: Total weight must be 100%. Current total: ${totalWeight.toFixed(1)}%`);
            return;
        }
        if (hasZeroWeight) {
            alert("Validation Error: All components must have a weight greater than 0%.");
            return;
        }
        try {
            const payload = {
                type: isNexus ? 'nexus' : 'portfolio',
                data: activeCode,
                email: userProfile?.email,
                original_id: activeCode.originalId
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
        const copy = JSON.parse(JSON.stringify(code));
        copy.originalId = copy.type === 'nexus' ? copy.nexus_code : copy.portfolio_code;
        setActiveCode(copy);
        setViewMode('editor');
    };

    const startNew = (type) => {
        const newCode = type === 'nexus' ? {
            type: 'nexus',
            nexus_code: 'NEW_NEXUS',
            components: [],
            connected_commands: [],
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
        setActiveCode(newCode);
        setViewMode('editor');
    };
    // END: Copied Helpers

    return (
        <div className="min-h-screen bg-black pt-24 pb-12 px-8">
            {/* Tabs for List/Community */}
            {viewMode !== 'editor' && (
                <div className="flex items-center gap-6 mb-8 border-b border-gray-800 pb-2">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`pb-2 px-1 text-lg font-medium transition-colors ${viewMode === 'list' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        My Codes
                    </button>
                    <button
                        onClick={() => setViewMode('community')}
                        className={`pb-2 px-1 text-lg font-medium transition-colors ${viewMode === 'community' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        Community Hub
                    </button>
                </div>
            )}

            {viewMode === 'list' && (
                <ListView
                    codes={codes}
                    startNew={startNew}
                    startEditing={startEditing}
                    handleDelete={handleDelete}
                    handleShare={handleShare}
                />
            )}
            {viewMode === 'community' && (
                <CommunityView
                    communityCodes={communityCodes}
                    sort={communitySort}
                    setSort={setCommunitySort}
                    handleImport={handleImport}
                    userProfile={userProfile}
                    handleDeleteCommunity={handleDeleteCommunity}
                />
            )}
            {viewMode === 'editor' && (
                <EditorView
                    activeCode={activeCode}
                    setActiveCode={setActiveCode}
                    handleSave={handleSave}
                    setViewMode={setViewMode}
                    codes={codes}
                    startEditing={startEditing}
                />
            )}
        </div>
    );
};

export default DatabaseNodes;
