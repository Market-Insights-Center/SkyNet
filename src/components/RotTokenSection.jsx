import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp, Plus, Search, Trash2, Edit2,
    Save, X, Zap, Skull, Clock, Activity, AlertTriangle, Brain
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line
} from 'recharts';

const RotTokenSection = () => {
    const [status, setStatus] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [mockMode, setMockMode] = useState(false);

    // Forms
    const [showAddTerm, setShowAddTerm] = useState(false);
    const [newTerm, setNewTerm] = useState({ term: '', lifespan: '1d', damage: 5 });

    const [showAddEvent, setShowAddEvent] = useState(false);
    const [newEvent, setNewEvent] = useState({ name: '', lifespan: '1h', damage: 1000 });

    // Editing
    const [editingTerm, setEditingTerm] = useState(null);
    const [editingEvent, setEditingEvent] = useState(null);

    // Search
    const [termSearch, setTermSearch] = useState('');
    const [eventSearch, setEventSearch] = useState('');

    // Specific Graph
    const [viewingTerm, setViewingTerm] = useState(null); // ID of term to show graph for
    const [termHistory, setTermHistory] = useState([]);

    const [viewingEvent, setViewingEvent] = useState(null);
    const [eventHistory, setEventHistory] = useState([]);

    const fetchStatus = async () => {
        try {
            const res = await fetch(`/api/rot/status?mode=${mockMode ? 'mock' : 'real'}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setStatus(data);
            setLoading(false);
        } catch (e) {
            console.error("Failed to fetch rot status", e);
        }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/rot/history?mode=${mockMode ? 'mock' : 'real'}`);
            if (!res.ok) throw new Error("Failed to fetch history");
            const data = await res.json();
            setHistory(data);
        } catch (e) {
            console.error("Failed to fetch rot history", e);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        setLoadingHistory(true);

        // Parallel fetch
        fetchStatus();
        fetchHistory();

        const interval = setInterval(() => {
            fetchStatus();
            // Optional: Refresh history less frequently or same time
            // fetchHistory(); 
        }, 5000);

        return () => clearInterval(interval);
    }, [mockMode]); // Refetch when mode toggles

    const handleAddTerm = async () => {
        if (!newTerm.term) return;
        await fetch(`/api/rot/terms?mode=${mockMode ? 'mock' : 'real'}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTerm)
        });
        setNewTerm({ term: '', lifespan: '1d', damage: 5 });
        setShowAddTerm(false);
        fetchStatus();
    };

    const handleAddEvent = async () => {
        if (!newEvent.name) return;
        await fetch(`/api/rot/events?mode=${mockMode ? 'mock' : 'real'}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newEvent)
        });
        setNewEvent({ name: '', lifespan: '1h', damage: 1000 });
        setShowAddEvent(false);
        fetchStatus();
    };

    const handleUpdateTerm = async () => {
        if (!editingTerm) return;
        await fetch(`/api/rot/terms/${editingTerm.id}?mode=${mockMode ? 'mock' : 'real'}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                term: editingTerm.term,
                lifespan: editingTerm.lifespan_str, // Use the string value from input
                damage: parseFloat(editingTerm.damage)
            })
        });

        setEditingTerm(null);
        fetchStatus();
    };

    const handleUpdateEvent = async () => {
        if (!editingEvent) return;
        await fetch(`/api/rot/events/${editingEvent.id}?mode=${mockMode ? 'mock' : 'real'}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: editingEvent.name,
                lifespan: editingEvent.lifespan_str,
                damage: parseFloat(editingEvent.damage)
            })
        });
        setEditingEvent(null);
        fetchStatus();
    };

    const handleViewTerm = async (term) => {
        setViewingTerm(term);
        try {
            const res = await fetch(`/api/rot/term_history/${term.id}?mode=${mockMode ? 'mock' : 'real'}`);
            const data = await res.json();
            setTermHistory(data);
        } catch (e) {
            console.error(e);
            setTermHistory([]);
        }
    };

    const handleViewEvent = async (event) => {
        setViewingEvent(event);
        try {
            const res = await fetch(`/api/rot/event_history/${event.id}?mode=${mockMode ? 'mock' : 'real'}`);
            const data = await res.json();
            setEventHistory(data);
        } catch (e) {
            console.error(e);
            setEventHistory([]);
        }
    };

    const handleGenerateMockData = async () => {
        if (!window.confirm("Overwrite MOCK data with fresh random content?")) return;
        await fetch('/api/rot/mock?mode=mock', { method: 'POST' });
        // Force mock mode on if not already
        if (!mockMode) setMockMode(true);
        fetchStatus();
    };

    // --- Render Helpers ---

    if (loading) return <div className="p-8 text-gold animate-pulse">Initializing Rot Protocol...</div>;

    const filteredTerms = (status?.terms || []).filter(t => t.term.toLowerCase().includes(termSearch.toLowerCase()));
    const filteredEvents = (status?.events || []).filter(e => e.name.toLowerCase().includes(eventSearch.toLowerCase()));

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    const formatDate = (iso) => new Date(iso).toLocaleString();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* HERDER */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 mb-2">
                        ROT TOKEN <span className="text-sm text-gray-500 font-mono tracking-widest ml-4">PROTOCOL: DECAY</span>
                    </h2>
                    <div className="text-6xl font-black text-white tracking-tighter">
                        {formatCurrency(status?.current_price || 0)}
                    </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                    <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                        <span className="text-sm font-bold text-gray-400">MODE:</span>
                        <div className="flex bg-black p-1 rounded border border-white/10">
                            <button onClick={() => setMockMode(false)} className={`px-3 py-1 text-xs font-bold rounded ${!mockMode ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-white'}`}>REAL</button>
                            <button onClick={() => setMockMode(true)} className={`px-3 py-1 text-xs font-bold rounded ${mockMode ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}>MOCK</button>
                        </div>
                        {mockMode && (
                            <button onClick={handleGenerateMockData} className="px-3 py-1 text-xs bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded hover:bg-orange-500 hover:text-black font-bold transition-all">
                                GEN DATA
                            </button>
                        )}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-widest mt-2">Protocol Start</div>
                    <div className="font-mono text-gold">{status?.launch_date ? new Date(status.launch_date).toLocaleString() : 'N/A'}</div>
                </div>
            </div>

            {/* MAIN CHART */}
            <div className="h-64 w-full bg-white/5 rounded-xl border border-white/10 p-4 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent pointer-events-none" />
                {/* Background Icon */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05]">
                    <Brain size={300} className="text-white" />
                </div>
                {loadingHistory ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history}>
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                            <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString()} stroke="#444" />
                            <YAxis stroke="#444" />
                            <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                            <Area type="monotone" dataKey="price" stroke="#4ade80" fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* --- CASUAL ROT (EXPONENTIAL) --- */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Skull className="text-green-500" />
                            <h3 className="text-xl font-bold text-green-400">Casual Rot</h3>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-2 text-gray-500" size={16} />
                                <input
                                    className="bg-black/50 border border-white/10 rounded pl-8 pr-2 py-1.5 text-sm w-32 focus:w-48 transition-all"
                                    placeholder="Search..."
                                    value={termSearch}
                                    onChange={e => setTermSearch(e.target.value)}
                                />
                            </div>
                            <button onClick={() => setShowAddTerm(!showAddTerm)} className="p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {showAddTerm && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-green-900/10 p-4 rounded-lg border border-green-500/20 flex gap-2 items-end">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500">Term</label>
                                        <input className="w-full bg-black border border-white/10 p-1.5 rounded" value={newTerm.term} onChange={e => setNewTerm({ ...newTerm, term: e.target.value })} />
                                    </div>
                                    <div className="w-40">
                                        <label className="text-xs text-gray-500">Lifespan</label>
                                        <div className="flex gap-1">
                                            <input
                                                type="number"
                                                className="w-full bg-black border border-white/10 p-1.5 rounded"
                                                placeholder="1"
                                                value={parseFloat(newTerm.lifespan) || ''}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    const unit = newTerm.lifespan.replace(/[\d\.]/g, '') || 'd';
                                                    setNewTerm({ ...newTerm, lifespan: `${val}${unit}` });
                                                }}
                                            />
                                            <select
                                                className="bg-black border border-white/10 p-1.5 rounded w-16"
                                                value={newTerm.lifespan.replace(/[\d\.]/g, '') || 'd'}
                                                onChange={e => {
                                                    const val = parseFloat(newTerm.lifespan) || 0;
                                                    const unit = e.target.value;
                                                    setNewTerm({ ...newTerm, lifespan: `${val}${unit}` });
                                                }}
                                            >
                                                {['s', 'm', 'h', 'd', 'w', 'mo', 'y'].map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="w-24">
                                        <label className="text-xs text-gray-500">Damage</label>
                                        <input type="number" className="w-full bg-black border border-white/10 p-1.5 rounded" value={newTerm.damage} onChange={e => setNewTerm({ ...newTerm, damage: e.target.value })} />
                                    </div>
                                    <button onClick={handleAddTerm} className="bg-green-500 text-black font-bold p-2 rounded h-[34px]">Add</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* TABLE */}
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-2">
                        <table className="w-full text-left text-sm">
                            <thead className="text-gray-500 sticky top-0 bg-[#111] z-10">
                                <tr>
                                    <th className="p-2">Term</th>
                                    <th className="p-2">Date</th>
                                    <th className="p-2">Life/Dmg</th>
                                    <th className="p-2 text-right">Value</th>
                                    <th className="p-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredTerms.map(t => (
                                    <tr key={t.id} className="hover:bg-white/5 group">
                                        <td
                                            className="p-2 font-bold text-green-300 cursor-pointer hover:underline"
                                            onClick={() => handleViewTerm(t)}
                                        >
                                            {t.term}
                                        </td>
                                        <td className="p-2 text-xs text-gray-500">{new Date(t.created_at_iso).toLocaleDateString()}</td>
                                        <td className="p-2 text-xs font-mono">
                                            <div>{t.lifespan_str}</div>
                                            <div className="text-gray-500">{t.damage}</div>
                                        </td>
                                        <td className="p-2 text-right font-mono text-green-400">
                                            {t.current_value < 0.01 ? '<0.01' : t.current_value.toFixed(2)}
                                        </td>
                                        <td className="p-2 text-right">
                                            <button onClick={() => setEditingTerm(t)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white"><Edit2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* --- ROT OVERLOAD (LINEAR) --- */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Zap className="text-orange-500" />
                            <h3 className="text-xl font-bold text-orange-400">Rot Overload</h3>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-2 top-2 text-gray-500" size={16} />
                                <input
                                    className="bg-black/50 border border-white/10 rounded pl-8 pr-2 py-1.5 text-sm w-32 focus:w-48 transition-all"
                                    placeholder="Search..."
                                    value={eventSearch}
                                    onChange={e => setEventSearch(e.target.value)}
                                />
                            </div>
                            <button onClick={() => setShowAddEvent(!showAddEvent)} className="p-2 bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30">
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {showAddEvent && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-orange-900/10 p-4 rounded-lg border border-orange-500/20 flex gap-2 items-end">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500">Event Name</label>
                                        <input className="w-full bg-black border border-white/10 p-1.5 rounded" value={newEvent.name} onChange={e => setNewEvent({ ...newEvent, name: e.target.value })} />
                                    </div>
                                    <div className="w-40">
                                        <label className="text-xs text-gray-500">Lifespan</label>
                                        <div className="flex gap-1">
                                            <input
                                                type="number"
                                                className="w-full bg-black border border-white/10 p-1.5 rounded"
                                                placeholder="1"
                                                value={parseFloat(newEvent.lifespan) || ''}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    const unit = newEvent.lifespan.replace(/[\d\.]/g, '') || 'h';
                                                    setNewEvent({ ...newEvent, lifespan: `${val}${unit}` });
                                                }}
                                            />
                                            <select
                                                className="bg-black border border-white/10 p-1.5 rounded w-16"
                                                value={newEvent.lifespan.replace(/[\d\.]/g, '') || 'h'}
                                                onChange={e => {
                                                    const val = parseFloat(newEvent.lifespan) || 0;
                                                    const unit = e.target.value;
                                                    setNewEvent({ ...newEvent, lifespan: `${val}${unit}` });
                                                }}
                                            >
                                                {['s', 'm', 'h', 'd', 'w', 'mo', 'y'].map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="w-24">
                                        <label className="text-xs text-gray-500">Damage</label>
                                        <input type="number" className="w-full bg-black border border-white/10 p-1.5 rounded" value={newEvent.damage} onChange={e => setNewEvent({ ...newEvent, damage: e.target.value })} />
                                    </div>
                                    <button onClick={handleAddEvent} className="bg-orange-500 text-black font-bold p-2 rounded h-[34px]">Add</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* TABLE */}
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-2">
                        <table className="w-full text-left text-sm">
                            <thead className="text-gray-500 sticky top-0 bg-[#111] z-10">
                                <tr>
                                    <th className="p-2">Event</th>
                                    <th className="p-2">Date</th>
                                    <th className="p-2">Life/Dmg</th>
                                    <th className="p-2 text-right">Value</th>
                                    <th className="p-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredEvents.map(e => (
                                    <tr key={e.id} className="hover:bg-white/5 group">
                                        <td
                                            className="p-2 font-bold text-orange-300 cursor-pointer hover:underline"
                                            onClick={() => handleViewEvent(e)}
                                        >
                                            {e.name}
                                        </td>
                                        <td className="p-2 text-xs text-gray-500">{new Date(e.created_at_iso).toLocaleDateString()}</td>
                                        <td className="p-2 text-xs font-mono">
                                            <div>{e.lifespan_str}</div>
                                            <div className="text-gray-500">{e.damage}</div>
                                        </td>
                                        <td className="p-2 text-right font-mono text-orange-400">
                                            {e.current_value.toFixed(2)}
                                        </td>
                                        <td className="p-2 text-right">
                                            <button onClick={() => setEditingEvent(e)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white"><Edit2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- MODALS --- */}
            <AnimatePresence>
                {/* EDIT TERM MODAL */}
                {editingTerm && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#111] border border-white/20 p-6 rounded-xl w-full max-w-md">
                            <h3 className="text-xl font-bold mb-4">Edit Rot Term</h3>
                            <div className="space-y-4">
                                <div>
                                    <label>Term</label>
                                    <input className="w-full bg-black/50 border border-white/10 p-2 rounded" value={editingTerm.term} onChange={e => setEditingTerm({ ...editingTerm, term: e.target.value })} />
                                </div>
                                <div>
                                    <label>Damage</label>
                                    <input type="number" className="w-full bg-black/50 border border-white/10 p-2 rounded" value={editingTerm.damage} onChange={e => setEditingTerm({ ...editingTerm, damage: e.target.value })} />
                                </div>
                                <div>
                                    <label>Lifespan</label>
                                    <div className="flex gap-1">
                                        <input
                                            type="number"
                                            className="w-full bg-black/50 border border-white/10 p-2 rounded"
                                            placeholder="1"
                                            value={parseFloat(editingTerm.lifespan_str) || ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const unit = editingTerm.lifespan_str.replace(/[\d\.]/g, '') || 'd';
                                                setEditingTerm({ ...editingTerm, lifespan_str: `${val}${unit}` });
                                            }}
                                        />
                                        <select
                                            className="bg-black/50 border border-white/10 p-2 rounded w-20"
                                            value={editingTerm.lifespan_str.replace(/[\d\.]/g, '') || 'd'}
                                            onChange={e => {
                                                const val = parseFloat(editingTerm.lifespan_str) || 0;
                                                const unit = e.target.value;
                                                setEditingTerm({ ...editingTerm, lifespan_str: `${val}${unit}` });
                                            }}
                                        >
                                            {['s', 'm', 'h', 'd', 'w', 'mo', 'y'].map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    <button onClick={() => setEditingTerm(null)} className="px-4 py-2 text-gray-400">Cancel</button>
                                    <button onClick={handleUpdateTerm} className="px-4 py-2 bg-green-500 text-black font-bold rounded">Save Changes</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* EDIT EVENT MODAL */}
                {editingEvent && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#111] border border-white/20 p-6 rounded-xl w-full max-w-md">
                            <h3 className="text-xl font-bold mb-4">Edit Rot Event</h3>
                            <div className="space-y-4">
                                <div>
                                    <label>Name</label>
                                    <input className="w-full bg-black/50 border border-white/10 p-2 rounded" value={editingEvent.name} onChange={e => setEditingEvent({ ...editingEvent, name: e.target.value })} />
                                </div>
                                <div>
                                    <label>Damage</label>
                                    <input type="number" className="w-full bg-black/50 border border-white/10 p-2 rounded" value={editingEvent.damage} onChange={e => setEditingEvent({ ...editingEvent, damage: e.target.value })} />
                                </div>
                                <div>
                                    <label>Lifespan</label>
                                    <div className="flex gap-1">
                                        <input
                                            type="number"
                                            className="w-full bg-black/50 border border-white/10 p-2 rounded"
                                            placeholder="1"
                                            value={parseFloat(editingEvent.lifespan_str) || ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const unit = editingEvent.lifespan_str.replace(/[\d\.]/g, '') || 'h';
                                                setEditingEvent({ ...editingEvent, lifespan_str: `${val}${unit}` });
                                            }}
                                        />
                                        <select
                                            className="bg-black/50 border border-white/10 p-2 rounded w-20"
                                            value={editingEvent.lifespan_str.replace(/[\d\.]/g, '') || 'h'}
                                            onChange={e => {
                                                const val = parseFloat(editingEvent.lifespan_str) || 0;
                                                const unit = e.target.value;
                                                setEditingEvent({ ...editingEvent, lifespan_str: `${val}${unit}` });
                                            }}
                                        >
                                            {['s', 'm', 'h', 'd', 'w', 'mo', 'y'].map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    <button onClick={() => setEditingEvent(null)} className="px-4 py-2 text-gray-400">Cancel</button>
                                    <button onClick={handleUpdateEvent} className="px-4 py-2 bg-orange-500 text-black font-bold rounded">Save Changes</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* TERM GRAPH POPUP */}
                {viewingTerm && (
                    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-8 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#111] border border-green-500/30 p-8 rounded-2xl w-full max-w-4xl flex flex-col relative shadow-2xl shadow-green-900/20">
                            <button onClick={() => setViewingTerm(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24} /></button>

                            <div className="mb-6">
                                <h3 className="text-3xl font-bold text-green-400 mb-1">{viewingTerm.term}</h3>
                                <div className="text-gray-400 font-mono text-sm">
                                    Created: {new Date(viewingTerm.created_at_iso).toLocaleString()} • Lifespan: {viewingTerm.lifespan_str} • Base Damage: {viewingTerm.damage}
                                </div>
                            </div>

                            {/* CHART SECTION */}
                            <div className="h-96 bg-white/5 rounded-xl border border-white/10 p-4 relative overflow-hidden">
                                {/* Background Icon */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                                    <Brain size={200} className="text-white" />
                                </div>

                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={termHistory}>
                                        <defs>
                                            <linearGradient id="colorTerm" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                                        <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString()} stroke="#444" />
                                        <YAxis stroke="#444" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#000', borderColor: '#222' }}
                                            labelFormatter={l => new Date(l).toLocaleString()}
                                            formatter={v => [v.toFixed(2), "Value"]}
                                        />
                                        <Area type="monotone" dataKey="value" stroke="#10B981" fill="url(#colorTerm)" fillOpacity={1} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* EVENT GRAPH POPUP */}
                {viewingEvent && (
                    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-8 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#111] border border-orange-500/30 p-8 rounded-2xl w-full max-w-4xl flex flex-col relative shadow-2xl shadow-orange-900/20">
                            <button onClick={() => setViewingEvent(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24} /></button>

                            <div className="mb-6">
                                <h3 className="text-3xl font-bold text-orange-400 mb-1">{viewingEvent.name}</h3>
                                <div className="text-gray-400 font-mono text-sm">
                                    Created: {new Date(viewingEvent.created_at_iso).toLocaleString()} • Lifespan: {viewingEvent.lifespan_str} • Base Damage: {viewingEvent.damage}
                                </div>
                            </div>

                            {/* CHART SECTION */}
                            <div className="h-96 bg-white/5 rounded-xl border border-white/10 p-4 relative overflow-hidden">
                                {/* Background Icon */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                                    <Zap size={200} className="text-white" />
                                </div>

                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={eventHistory}>
                                        <defs>
                                            <linearGradient id="colorEvent" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                                        <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString()} stroke="#444" />
                                        <YAxis stroke="#444" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#000', borderColor: '#222' }}
                                            labelFormatter={l => new Date(l).toLocaleString()}
                                            formatter={v => [v.toFixed(2), "Value"]}
                                        />
                                        <Area type="monotone" dataKey="value" stroke="#F97316" fill="url(#colorEvent)" fillOpacity={1} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>
                    </div>
                )}

            </AnimatePresence>
        </div >
    );
};

export default RotTokenSection;
