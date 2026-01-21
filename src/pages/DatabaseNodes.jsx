import React, { useState, useEffect } from 'react';
import { Database, Trash2, Edit, Save, Plus, ArrowLeft, Shield, Zap, Box } from 'lucide-react';
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
                    {userProfile?.username === code.creator && (
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

const EditorView = ({ activeCode, setActiveCode, handleSave, setViewMode }) => {
    const isNexus = activeCode.type === 'nexus';

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
        const newItem = { ticker: '', weight: 0 };
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
                        <div key={idx} className="flex gap-4 items-center bg-black/40 p-3 rounded-lg border border-gray-800/50">
                            <input
                                value={item.ticker || item.symbol || ''}
                                onChange={(e) => updateItem(idx, 'ticker', e.target.value.toUpperCase())}
                                placeholder="TICKER"
                                className="bg-transparent border-b border-gray-700 focus:border-white w-24 text-white font-mono uppercase outline-none"
                            />
                            <div className="flex items-center gap-2 flex-1">
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
            </div>
        </div>
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
                />
            )}
        </div>
    );
};

export default DatabaseNodes;
