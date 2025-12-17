import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, CheckCircle, Shield, Activity, X, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NeonWrapper from '../components/NeonWrapper';

const MarketPredictions = () => {
    const { currentUser, userProfile } = useAuth();
    const [balance, setBalance] = useState(0);
    const [pendingPoints, setPendingPoints] = useState(0);
    const [predictions, setPredictions] = useState([]);
    const [myBets, setMyBets] = useState([]);
    const [betAmounts, setBetAmounts] = useState({}); // { predId: amount }
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Admin State
    const [isMod, setIsMod] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newPrediction, setNewPrediction] = useState({ title: '', stock: '', end_date: '', market_condition: '', wager_logic: 'binary_odds' });

    useEffect(() => {
        if (currentUser) {
            // Check Mod Status
            fetch('/api/mods')
                .then(res => res.json())
                .then(data => {
                    if (data.mods.includes(currentUser.email.toLowerCase())) setIsMod(true);
                })
                .catch(console.error);
        }
        fetchData();
    }, [currentUser]);

    const fetchData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Fetch Balance
            const pRes = await fetch('/api/points/user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email })
            });
            const pData = await pRes.json();
            setBalance(pData.points || 0);
            setPendingPoints(pData.pending_points || 0);

            // Fetch Predictions
            const predRes = await fetch('/api/predictions/active');
            const predData = await predRes.json();
            setPredictions(Array.isArray(predData) ? predData : []);

            // Fetch My Bets
            const betRes = await fetch(`/api/user/bets?email=${currentUser.email}`);
            const betData = await betRes.json();
            setMyBets(Array.isArray(betData) ? betData : []);

        } catch (e) {
            console.error("Error fetching prediction data", e);
        } finally {
            setLoading(false);
        }
    };

    const handleBetAmountChange = (id, val) => {
        setBetAmounts(prev => ({ ...prev, [id]: parseInt(val) || 0 }));
    };

    const placeBet = async (predictionId, choice) => {
        const amount = betAmounts[predictionId] || 0;
        if (amount <= 0) {
            alert("Please enter a valid amount.");
            return;
        }
        if (amount > balance) {
            alert("Insufficient Singularity Points.");
            return;
        }

        try {
            const res = await fetch('/api/predictions/bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: currentUser.email,
                    prediction_id: predictionId,
                    choice: choice,
                    amount: amount
                })
            });
            const data = await res.json();
            if (data.success) {
                // Refresh
                fetchData();
                setBetAmounts(prev => ({ ...prev, [predictionId]: 0 }));
                alert("Bet Placed Successfully!");
            } else {
                alert("Bet Failed: " + (data.message || "Unknown error"));
            }
        } catch (e) {
            console.error(e);
            alert("Betting Error");
        }
    };

    // UI Display Logic
    const BalanceDisplay = () => (
        <div className="flex flex-col items-end">
            <div className="text-3xl font-bold font-mono text-gold flex items-center gap-2">
                <DollarSign size={24} /> {balance.toLocaleString()}
            </div>
            {pendingPoints > 0 && (
                <div className="text-xs text-gray-400 font-mono">
                    + {pendingPoints.toLocaleString()} Pending
                </div>
            )}
        </div>
    );

    const handleCreatePrediction = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        let payload = { ...newPrediction, email: currentUser.email };

        // Support for Batch Mode Override
        if (e && e.overridePayload) {
            payload = { ...e.overridePayload, email: currentUser.email };
        }

        if (!payload.title || !payload.stock || !payload.end_date) return;

        try {
            const res = await fetch('/api/predictions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert("Prediction created!");
                setNewPrediction({ title: '', stock: '', end_date: '', market_condition: '', wager_logic: 'binary_odds' });
                setShowCreateModal(false);
                fetchData();
            } else {
                alert("Failed to create prediction.");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const calculateOdds = (yesPool, noPool, side) => {
        // Simple Pari-mutuel odds: Total Pool / Side Pool
        // Add a small vig or floor? User didn't request vig.
        // If Side Pool is 0, odds are technically infinite or base 1.0 until someone bets.
        // Let's show theoretical odds assuming a small bet or just raw pool ratio.

        const total = (yesPool || 0) + (noPool || 0);
        if (total === 0) return "1.00x";

        const sidePool = side === 'yes' ? yesPool : noPool;
        if (!sidePool || sidePool === 0) return "---"; // First bet gets everything? Or 1.0x?

        // Show decimal odds
        return (total / sidePool).toFixed(2) + "x";
    };

    const isAllowed = userProfile && (['Visionary', 'Institutional', 'Singularity', 'Founder'].includes(userProfile.tier) || userProfile.isAdmin);

    if (userProfile && !isAllowed) {
        return (
            <div className="min-h-screen bg-black text-white pt-32 px-4 flex flex-col items-center justify-center font-sans tracking-wide">
                <div className="max-w-md w-full bg-gray-900/50 border border-white/10 rounded-2xl p-8 text-center backdrop-blur shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none" />
                    <DollarSign size={64} className="text-gray-600 mb-6 mx-auto" />
                    <h2 className="text-2xl font-bold mb-4 text-white">Access Restricted</h2>
                    <p className="text-gray-400 mb-8">
                        The Market Predictions engine is reserved for <span className="text-gold font-bold">Visionary</span> tiers and above.
                        Upgrade your plan to wager points and compete on the leaderboard.
                    </p>
                    <button
                        onClick={() => window.location.href = '/#pricing'} // Simple redirect to pricing section
                        className="bg-gold text-black font-bold py-3 px-8 rounded-full hover:bg-yellow-400 transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(255,215,0,0.3)]"
                    >
                        Upgrade Access
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white pt-24 px-4 pb-20 font-sans">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between mb-12">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-bold mb-2">Market <span className="text-gold">Predictions</span></h1>
                        <p className="text-gray-400">Wager your Singularity Points on market events.</p>
                        {isMod && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="mt-4 flex items-center gap-2 bg-gold/20 hover:bg-gold/30 text-gold font-bold py-2 px-4 rounded-lg transition-colors border border-gold/30"
                            >
                                <Plus size={18} /> Admin: Create Prediction
                            </button>
                        )}
                    </div>
                    <div className="mt-6 md:mt-0 p-6 bg-gradient-to-r from-gray-900 to-black rounded-xl border border-gold/30 shadow-[0_0_20px_rgba(255,215,0,0.15)] text-center min-w-[250px]">
                        <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">Your Balance</div>
                        <BalanceDisplay />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ACTIVE EVENTS */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-2xl font-bold flex items-center gap-2"><Activity className="text-red-500" /> Live Events</h2>
                        {loading && <p>Loading market data...</p>}
                        {!loading && predictions.length === 0 && <p className="text-gray-500 italic">No active predictions.</p>}

                        {predictions.map(pred => (
                            <NeonWrapper key={pred.id} color="gold" className="rounded-xl">
                                <div className="p-6 bg-black rounded-xl relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="px-3 py-1 bg-gray-800 rounded text-xs font-bold text-white border border-gray-700">{pred.stock}</span>
                                                <span className="text-xs text-gray-500"><Clock size={12} className="inline mr-1" /> Ends: {new Date(pred.end_date).toLocaleString()}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-2">{pred.title}</h3>
                                            <p className="text-gray-400 text-sm">Condition: <span className="text-gold font-bold">{pred.market_condition}</span></p>
                                        </div>
                                        <div className="text-right text-xs text-gray-500">
                                            <div>Pool: {((pred.total_pool_yes || 0) + (pred.total_pool_no || 0)).toLocaleString()} pts</div>
                                        </div>
                                    </div>

                                    {/* ODDS & BETTING */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-lg border border-white/5 relative z-10">
                                        {/* YES SIDE */}
                                        <div className="flex flex-col items-center p-3 rounded bg-green-900/10 border border-green-500/20">
                                            <span className="text-green-500 font-bold mb-1">YES / OVER</span>
                                            <div className="text-2xl font-bold text-white mb-2">{calculateOdds(pred.total_pool_yes, pred.total_pool_no, 'yes')}</div>
                                            <div className="text-xs text-gray-500 mb-3">{(pred.total_pool_yes || 0).toLocaleString()} pts bet</div>
                                            <button
                                                onClick={() => placeBet(pred.id, 'yes')}
                                                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded transition-colors text-sm"
                                            >
                                                BET YES
                                            </button>
                                        </div>

                                        {/* NO SIDE */}
                                        <div className="flex flex-col items-center p-3 rounded bg-red-900/10 border border-red-500/20">
                                            <span className="text-red-500 font-bold mb-1">NO / UNDER</span>
                                            <div className="text-2xl font-bold text-white mb-2">{calculateOdds(pred.total_pool_yes, pred.total_pool_no, 'no')}</div>
                                            <div className="text-xs text-gray-500 mb-3">{(pred.total_pool_no || 0).toLocaleString()} pts bet</div>
                                            <button
                                                onClick={() => placeBet(pred.id, 'no')}
                                                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded transition-colors text-sm"
                                            >
                                                BET NO
                                            </button>
                                        </div>
                                    </div>

                                    {/* WAGER INPUT */}
                                    <div className="mt-4 relative z-10">
                                        <label className="text-xs text-gray-400 mb-1 block">Your Wager (Points)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                min="10"
                                                placeholder="Amount"
                                                value={betAmounts[pred.id] || ''}
                                                onChange={(e) => handleBetAmountChange(pred.id, e.target.value)}
                                                className="bg-black border border-gray-700 rounded px-3 py-2 text-white flex-1 focus:border-gold focus:outline-none"
                                            />
                                            <div className="flex gap-1">
                                                {[100, 500, 1000].map(amt => (
                                                    <button key={amt} onClick={() => handleBetAmountChange(pred.id, amt)} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-gray-300">
                                                        {amt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* BG Elements */}
                                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                        <DollarSign size={150} />
                                    </div>
                                </div>
                            </NeonWrapper>
                        ))}
                    </div>

                    {/* MY BETS SIDEBAR */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-900/50 backdrop-blur border border-white/10 rounded-xl p-6 sticky top-24">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><CheckCircle size={20} className="text-gold" /> Recent Bets</h2>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {myBets.length === 0 && <p className="text-gray-500 text-sm">No active bets.</p>}
                                {myBets.map(bet => (
                                    <div key={bet.id} className="p-3 bg-black/40 rounded border border-white/5 text-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`font-bold ${bet.choice === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                                                {bet.choice.toUpperCase()}
                                            </span>
                                            <span className="text-gold font-bold">{bet.amount} pts</span>
                                        </div>
                                        <div className="text-gray-400 text-xs mb-1">
                                            {new Date(bet.timestamp).toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                            ID: {bet.prediction_id.substring(0, 8)}...
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Creation Modal */}
            <CreatePredictionModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreatePrediction}
                newPrediction={newPrediction}
                setNewPrediction={setNewPrediction}
            />
        </div>
    );
};

const CreatePredictionModal = ({ isOpen, onClose, onSubmit, newPrediction, setNewPrediction }) => {
    const [batchMode, setBatchMode] = useState(false);
    const [batchSettings, setBatchSettings] = useState({
        basePrice: '',
        variations: '5, 10',
        unit: 'percent', // percent or dollars
        directions: { above: true, below: true }
    });

    if (!isOpen) return null;

    const handleBatchSubmit = async (e) => {
        e.preventDefault();
        if (!batchMode) {
            onSubmit(e);
            return;
        }

        // Generate list
        const levels = batchSettings.variations.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const base = parseFloat(batchSettings.basePrice);
        if (!base || levels.length === 0) {
            alert("Invalid base price or variations");
            return;
        }

        const variations = [];
        levels.forEach(lvl => {
            const val = batchSettings.unit === 'percent' ? (base * (lvl / 100)) : lvl;

            if (batchSettings.directions.above) {
                const target = (base + val).toFixed(2);
                variations.push({
                    title: `${newPrediction.stock} > ${target} (+${lvl}${batchSettings.unit === 'percent' ? '%' : '$'})`,
                    condition: `Price > ${target}`,
                    wager_logic: 'binary_odds'
                });
            }
            if (batchSettings.directions.below) {
                const target = (base - val).toFixed(2);
                variations.push({
                    title: `${newPrediction.stock} < ${target} (-${lvl}${batchSettings.unit === 'percent' ? '%' : '$'})`,
                    condition: `Price < ${target}`,
                    wager_logic: 'binary_odds'
                });
            }
        });

        // Submit one by one
        let count = 0;
        for (const v of variations) {
            // Mock event structure for existing handler logic or call API directly here?
            // Let's call a modified submit that takes overrides
            // Actually, we can just call the API directly loop here, but reusing `onSubmit` logic is cleaner if we can.
            // But `onSubmit` preventsDefault.
            // Let's just do the fetch loop here for simplicity of "Batch"
            try {
                const payload = {
                    ...newPrediction,
                    title: v.title,
                    market_condition: v.condition,
                    email: 'ADMIN_BATCH' // The main handler adds email, let's duplicate the fetch logic briefly or refactor.
                };
                // To keep it clean, let's assume parent passed a "handleDirectCreate" or we just emulate
                // We'll trust the user wants speed.
                await onSubmit({ preventDefault: () => { }, target: null, overridePayload: payload });
                count++;
            } catch (err) {
                console.error(err);
            }
        }
        alert(`Created ${count} predictions successfully.`);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-gold"><Plus size={20} /> Create Prediction</h3>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400 flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={batchMode} onChange={e => setBatchMode(e.target.checked)} className="accent-gold" />
                            Batch Mode
                        </label>
                        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                    </div>
                </div>
                <form onSubmit={handleBatchSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Stock Symbol</label>
                            <input placeholder="NVDA" value={newPrediction.stock} onChange={e => setNewPrediction({ ...newPrediction, stock: e.target.value.toUpperCase() })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white focus:border-gold outline-none" required />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">End Date</label>
                            <input type="datetime-local" value={newPrediction.end_date} onChange={e => setNewPrediction({ ...newPrediction, end_date: e.target.value })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white focus:border-gold outline-none" required />
                        </div>
                    </div>

                    {!batchMode ? (
                        <>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Title</label>
                                <input placeholder="e.g. NVDA Earnings Beat" value={newPrediction.title} onChange={e => setNewPrediction({ ...newPrediction, title: e.target.value })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white focus:border-gold outline-none" required />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Condition</label>
                                <input placeholder="e.g. Price > $140 at close" value={newPrediction.market_condition} onChange={e => setNewPrediction({ ...newPrediction, market_condition: e.target.value })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white focus:border-gold outline-none" required />
                            </div>
                        </>
                    ) : (
                        <div className="p-4 bg-white/5 rounded-lg border border-white/10 space-y-4">
                            <div>
                                <label className="block text-sm text-gold mb-1 font-bold">Batch Settings</label>
                                <div className="text-xs text-gray-500 mb-2">Create multiple predictions (Spread) based on current price.</div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Current Price / Base</label>
                                <input type="number" placeholder="100.00" value={batchSettings.basePrice} onChange={e => setBatchSettings({ ...batchSettings, basePrice: e.target.value })} className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Variations (comma sep)</label>
                                    <input placeholder="5, 10, 15" value={batchSettings.variations} onChange={e => setBatchSettings({ ...batchSettings, variations: e.target.value })} className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Unit</label>
                                    <select value={batchSettings.unit} onChange={e => setBatchSettings({ ...batchSettings, unit: e.target.value })} className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-white">
                                        <option value="percent">Percent (%)</option>
                                        <option value="dollars">Dollars ($)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-sm text-gray-300">
                                    <input type="checkbox" checked={batchSettings.directions.above} onChange={e => setBatchSettings({ ...batchSettings, directions: { ...batchSettings.directions, above: e.target.checked } })} className="accent-green-500" />
                                    Above Targets
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-300">
                                    <input type="checkbox" checked={batchSettings.directions.below} onChange={e => setBatchSettings({ ...batchSettings, directions: { ...batchSettings.directions, below: e.target.checked } })} className="accent-red-500" />
                                    Below Targets
                                </label>
                            </div>
                        </div>
                    )}

                    <button type="submit" className="w-full bg-gold hover:bg-yellow-500 text-black font-bold py-3 rounded-lg transition-colors mt-2">
                        {batchMode ? "Generate Batch Predictions" : "Post Prediction"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default MarketPredictions;
