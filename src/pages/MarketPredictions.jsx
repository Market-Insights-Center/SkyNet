import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, CheckCircle, Shield, Activity, X, Plus, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NeonWrapper from '../components/NeonWrapper';
import Skeleton from '../components/Skeleton';

const MarketPredictions = () => {
    const { currentUser, userProfile } = useAuth();
    const [balance, setBalance] = useState(0);
    const [pendingPoints, setPendingPoints] = useState(0);
    const [predictions, setPredictions] = useState([]);
    const [myBets, setMyBets] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
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
            const [balanceRes, predsRes, betsRes, leaderRes] = await Promise.all([
                fetch('/api/points/user', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentUser.email })
                }),
                fetch('/api/predictions/active?include_recent=true'),
                fetch(`/api/user/bets?email=${currentUser.email}`),
                fetch('/api/predictions/leaderboard') // Fetch Leaderboard
            ]);

            const balanceData = await balanceRes.json();
            const predsData = await predsRes.json();
            const betsData = await betsRes.json();
            const leaderData = await leaderRes.json();

            setBalance(balanceData.points || 0);
            setPendingPoints(balanceData.pending_points || 0);
            setLeaderboard(Array.isArray(leaderData) ? leaderData : []);

            // Filter: Active OR (Ended recently)
            const allPreds = Array.isArray(predsData) ? predsData : [];
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const visiblePreds = allPreds.filter(p => {
                if (p.status === 'active') return true;
                if (p.status === 'ended') {
                    const endDate = new Date(p.end_date);
                    return endDate > twentyFourHoursAgo;
                }
                return false;
            });

            setPredictions(visiblePreds);
            setMyBets(Array.isArray(betsData) ? betsData : []);

        } catch (e) {
            console.error("Error fetching prediction data", e);
        } finally {
            setLoading(false);
        }
    };

    // ... inside render loop or helper
    const getPredictionStatus = (pred) => {
        const isExpired = new Date() > new Date(pred.end_date);
        if (pred.status === 'ended') return 'ENDED';
        if (isExpired) return 'RESOLVING';
        return 'ACTIVE';
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
                {balance.toLocaleString()} pts
            </div>
            {pendingPoints > 0 && (
                <div className="text-xs text-gray-400 font-mono">
                    + {pendingPoints.toLocaleString()} pts Pending
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

    const handleResolve = async (id, outcome) => {
        if (!window.confirm(`Are you sure you want to resolve this as ${outcome.toUpperCase()}? This is irreversible.`)) return;

        try {
            const res = await fetch('/api/predictions/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, outcome, email: currentUser.email })
            });
            const data = await res.json();
            if (data.success) {
                alert("Prediction Resolved!");
                fetchData();
            } else {
                alert("Resolution Failed.");
            }
        } catch (e) {
            console.error(e);
            alert("Error resolving.");
        }
    };

    const calculateOdds = (yesPool, noPool, side) => {
        const total = (yesPool || 0) + (noPool || 0);
        if (total === 0) return "1.00x";
        const sidePool = side === 'yes' ? yesPool : noPool;
        if (!sidePool || sidePool === 0) return "---";
        return (total / sidePool).toFixed(2) + "x";
    };

    const calculateChance = (yesPool, noPool, side) => {
        const total = (yesPool || 0) + (noPool || 0);
        if (total === 0) return "50.0%";
        const sidePool = side === 'yes' ? yesPool : noPool;
        const pct = ((sidePool || 0) / total) * 100;
        return pct.toFixed(1) + "%";
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
                    {/* Old balance display removed */}
                </div>

                {/* LEADERBOARD SECTION */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-2 relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative h-full bg-black/40 backdrop-blur-md border border-white/5 rounded-xl p-6 overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Trophy className="text-gold w-5 h-5" />
                                    <h3 className="text-lg font-bold text-white tracking-wide">Top Forecasters</h3>
                                </div>
                                <span className="text-xs text-gray-500 uppercase">Accuracy (Min 10 Bets)</span>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[250px]">
                                {loading && leaderboard.length === 0 ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(i => <Skeleton key={i} height="40px" className="w-full" />)}
                                    </div>
                                ) : leaderboard.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-sm italic">
                                        <TrendingUp className="w-8 h-8 mb-2 opacity-20" />
                                        No qualified forecasters yet.
                                    </div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-500 border-b border-white/5 uppercase">
                                            <tr>
                                                <th className="pb-2 font-medium">Rank</th>
                                                <th className="pb-2 font-medium">User</th>
                                                <th className="pb-2 font-medium text-right">Accuracy</th>
                                                <th className="pb-2 font-medium text-right">Bets</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {leaderboard.map((user, idx) => (
                                                <tr key={idx} className="group/row hover:bg-white/5 transition-colors">
                                                    <td className="py-2.5 pl-2 font-mono text-gray-400">#{idx + 1}</td>
                                                    <td className="py-2.5 font-medium text-white flex items-center gap-2">
                                                        {idx === 0 && <Trophy className="w-3 h-3 text-yellow-400" />}
                                                        {user.username}
                                                    </td>
                                                    <td className="py-2.5 text-right font-bold text-cyan-400">{user.accuracy}%</td>
                                                    <td className="py-2.5 text-right text-gray-400">{user.total_bets}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                    <NeonWrapper className="p-8 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md h-full min-h-[220px]">
                        <h3 className="text-cyan-500/70 text-xs uppercase tracking-[0.2em] mb-4 font-bold">Available Balance</h3>
                        {loading ? <Skeleton width="180px" height="60px" /> : (
                            <div className="relative group cursor-default">
                                <div className="relative px-8 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex items-baseline gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-cyan-500/30 transition-colors">
                                    <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-100 to-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)] tracking-tighter">
                                        {balance.toLocaleString()}
                                    </span>
                                    <span className="text-sm font-bold text-cyan-400 tracking-widest uppercase mb-2">PTS</span>
                                </div>
                            </div>
                        )}
                        {pendingPoints > 0 && (
                            <div className="mt-4 flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                                <Clock size={12} className="text-yellow-500 animate-pulse" />
                                <span className="text-xs font-bold text-yellow-500/90">+{pendingPoints} Pending</span>
                            </div>
                        )}
                    </NeonWrapper>
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-lg border border-white/5 relative z-10 transition-all hover:border-white/10">
                                        {/* YES SIDE */}
                                        <div className={`flex flex-col items-center p-4 rounded-lg border transition-all ${getPredictionStatus(pred) === 'ENDED' && pred.winner === 'yes' ? 'bg-green-500/20 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-green-900/10 border-green-500/20 hover:bg-green-900/20'}`}>
                                            <span className="text-green-500 font-bold mb-1 tracking-wider text-sm">YES / OVER</span>
                                            <div className="text-3xl font-black text-white mb-1" style={{ textShadow: "0 0 10px rgba(34,197,94,0.5)" }}>
                                                {calculateOdds(pred.total_pool_yes, pred.total_pool_no, 'yes')}
                                            </div>
                                            <div className="text-sm font-bold text-green-400 mb-2">
                                                {calculateChance(pred.total_pool_yes, pred.total_pool_no, 'yes')} Chance
                                            </div>
                                            <div className="text-xs text-gray-500 mb-4 font-mono">{(pred.total_pool_yes || 0).toLocaleString()} pts bet</div>
                                            <button
                                                onClick={() => placeBet(pred.id, 'yes')}
                                                disabled={getPredictionStatus(pred) !== 'ACTIVE'}
                                                className={`w-full py-3 font-bold rounded-lg transition-all text-sm uppercase tracking-wide shadow-lg ${getPredictionStatus(pred) !== 'ACTIVE'
                                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white shadow-green-900/20 transform hover:-translate-y-0.5'
                                                    }`}
                                            >
                                                {getPredictionStatus(pred) === 'ENDED' && pred.winner === 'yes' ? 'WINNER' : 'BET YES'}
                                            </button>
                                        </div>

                                        {/* NO SIDE */}
                                        <div className={`flex flex-col items-center p-4 rounded-lg border transition-all ${getPredictionStatus(pred) === 'ENDED' && pred.winner === 'no' ? 'bg-red-500/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-red-900/10 border-red-500/20 hover:bg-red-900/20'}`}>
                                            <span className="text-red-500 font-bold mb-1 tracking-wider text-sm">NO / UNDER</span>
                                            <div className="text-3xl font-black text-white mb-1" style={{ textShadow: "0 0 10px rgba(239,68,68,0.5)" }}>
                                                {calculateOdds(pred.total_pool_yes, pred.total_pool_no, 'no')}
                                            </div>
                                            <div className="text-sm font-bold text-red-400 mb-2">
                                                {calculateChance(pred.total_pool_yes, pred.total_pool_no, 'no')} Chance
                                            </div>
                                            <div className="text-xs text-gray-500 mb-4 font-mono">{(pred.total_pool_no || 0).toLocaleString()} pts bet</div>
                                            <button
                                                onClick={() => placeBet(pred.id, 'no')}
                                                disabled={getPredictionStatus(pred) !== 'ACTIVE'}
                                                className={`w-full py-3 font-bold rounded-lg transition-all text-sm uppercase tracking-wide shadow-lg ${getPredictionStatus(pred) !== 'ACTIVE'
                                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-900/20 transform hover:-translate-y-0.5'
                                                    }`}
                                            >
                                                {getPredictionStatus(pred) === 'ENDED' && pred.winner === 'no' ? 'WINNER' : 'BET NO'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* ODDS HISTORY GRAPH */}
                                    {pred.history && pred.history.length > 1 && (
                                        <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-white/5 relative z-10">
                                            <div className="text-xs text-gray-400 mb-2 font-bold uppercase tracking-wider flex items-center gap-2">
                                                <Activity size={12} className="text-gold" /> Historical Probability Trend
                                            </div>
                                            <div className="h-40 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={pred.history.map(h => {
                                                        const total = (h.yes || 0) + (h.no || 0);
                                                        return {
                                                            time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                                            fullDate: new Date(h.timestamp).toLocaleString(),
                                                            yesChance: total ? ((h.yes / total) * 100).toFixed(1) : 50,
                                                            noChance: total ? ((h.no / total) * 100).toFixed(1) : 50
                                                        };
                                                    })}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                                        <XAxis dataKey="time" stroke="#666" fontSize={10} tick={{ fill: '#666' }} />
                                                        <YAxis stroke="#666" fontSize={10} tick={{ fill: '#666' }} domain={[0, 100]} unit="%" />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
                                                            itemStyle={{ fontSize: '12px' }}
                                                            labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
                                                            formatter={(value) => [value + "%"]}
                                                        />
                                                        <Line type="monotone" dataKey="yesChance" stroke="#22c55e" strokeWidth={2} dot={false} name="YES Chance" />
                                                        <Line type="monotone" dataKey="noChance" stroke="#ef4444" strokeWidth={2} dot={false} name="NO Chance" />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}

                                    {/* STATUS / RESOLUTION */}
                                    {getPredictionStatus(pred) === 'ACTIVE' ? (
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
                                                <button onClick={() => handleBetAmountChange(pred.id, 100)} className="bg-gray-800 text-xs px-2 hover:bg-gray-700 rounded">100</button>
                                                <button onClick={() => handleBetAmountChange(pred.id, 500)} className="bg-gray-800 text-xs px-2 hover:bg-gray-700 rounded">500</button>
                                                <button onClick={() => handleBetAmountChange(pred.id, 1000)} className="bg-gray-800 text-xs px-2 hover:bg-gray-700 rounded">1000</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-4 relative z-10 p-3 bg-white/5 rounded border border-white/10 text-center flex flex-col gap-2 items-center justify-center">
                                            <div className="text-sm font-bold text-gray-300">
                                                {pred.status === 'resolved' || pred.winner ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <CheckCircle size={16} className="text-green-500" />
                                                        Winner: {pred.winning_outcome ? pred.winning_outcome.toUpperCase() : (pred.winner ? pred.winner.toUpperCase() : 'DRAW')}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center justify-center gap-2 text-gold">
                                                        <Activity size={16} className="animate-pulse" />
                                                        Awaiting Resolution...
                                                    </span>
                                                )}
                                            </div>

                                            {/* ADMIN RESOLVE ACTIONS */}
                                            {isMod && (!pred.winning_outcome && !pred.winner) && (
                                                <div className="flex gap-2 mt-2 w-full">
                                                    <button
                                                        onClick={() => handleResolve(pred.id, 'yes')}
                                                        className="flex-1 bg-green-900/50 hover:bg-green-800 text-green-200 text-xs py-2 rounded border border-green-700/50"
                                                    >
                                                        Force Win: YES
                                                    </button>
                                                    <button
                                                        onClick={() => handleResolve(pred.id, 'no')}
                                                        className="flex-1 bg-red-900/50 hover:bg-red-800 text-red-200 text-xs py-2 rounded border border-red-700/50"
                                                    >
                                                        Force Win: NO
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
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
    // Categories: Stocks, Crypto, Indices, Custom
    const [category, setCategory] = useState('Stocks');

    // Smart inputs
    const [smartInputs, setSmartInputs] = useState({
        ticker: '',
        coin: 'BTC',
        index: 'SPY',
        targetPrice: '',
        direction: 'Above', // Above, Below
        dateType: 'Specific', // Specific, End of Week, End of Month
        customDate: '',
    });

    useEffect(() => {
        if (!isOpen) {
            // Reset on close? Or keep for ease? 
            // setSmartInputs({ ticker: '', coin: 'BTC', index: 'SPY', targetPrice: '', direction: 'Above', dateType: 'Specific', customDate: '' });
        }
    }, [isOpen]);

    // Auto-Generate Title & Condition
    useEffect(() => {
        if (category === 'Custom') return;

        let symbol = '';
        if (category === 'Stocks') symbol = smartInputs.ticker.toUpperCase();
        if (category === 'Crypto') symbol = smartInputs.coin;
        if (category === 'Indices') symbol = smartInputs.index;

        if (!symbol || !smartInputs.targetPrice) return;

        const dirSymbol = smartInputs.direction === 'Above' ? '>' : '<';

        // Auto Text
        const title = `${symbol} ${dirSymbol} $${smartInputs.targetPrice}`;
        const condition = `Price ${dirSymbol} ${smartInputs.targetPrice}`;

        // Set to parent state
        setNewPrediction(prev => ({
            ...prev,
            title: title,
            stock: symbol,
            market_condition: condition,
            wager_logic: 'binary_odds' // Enforce default
        }));

    }, [category, smartInputs, setNewPrediction]);


    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        // Timezone Fix: Convert the datetime-local value (which has no TZ info but implies local)
        // to a proper full ISO string with timezone or UTC.
        // The input value is like "2026-06-15T15:30"
        // new Date("2026-06-15T15:30") creates a date object treating that string as Local Time (browser default)
        // Then .toISOString() gives us the UTC equivalent.
        if (!newPrediction.end_date) return;

        const localDate = new Date(newPrediction.end_date);
        const utcIso = localDate.toISOString();

        // Pass Override
        onSubmit({
            preventDefault: () => { },
            overridePayload: {
                ...newPrediction,
                end_date: utcIso
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-gold"><Plus size={20} /> Smart Prediction Builder</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 mb-6 border-b border-gray-800 pb-2">
                    {['Stocks', 'Crypto', 'Indices', 'Custom'].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${category === cat ? 'bg-gold/10 text-gold border-b-2 border-gold' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* CONDITIONAL INPUTS */}
                    {category === 'Stocks' && (
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Stock Ticker</label>
                            <input
                                placeholder="NVDA"
                                value={smartInputs.ticker}
                                onChange={e => setSmartInputs({ ...smartInputs, ticker: e.target.value })}
                                className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-gold"
                            />
                        </div>
                    )}

                    {category === 'Crypto' && (
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Coin</label>
                            <select
                                value={smartInputs.coin}
                                onChange={e => setSmartInputs({ ...smartInputs, coin: e.target.value })}
                                className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-gold"
                            >
                                <option value="BTC">Bitcoin (BTC)</option>
                                <option value="ETH">Ethereum (ETH)</option>
                                <option value="SOL">Solana (SOL)</option>
                                <option value="DOGE">Dogecoin (DOGE)</option>
                            </select>
                        </div>
                    )}

                    {category === 'Indices' && (
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Index ETF</label>
                            <select
                                value={smartInputs.index}
                                onChange={e => setSmartInputs({ ...smartInputs, index: e.target.value })}
                                className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-gold"
                            >
                                <option value="SPY">S&P 500 (SPY)</option>
                                <option value="QQQ">Nasdaq 100 (QQQ)</option>
                                <option value="DIA">Dow Jones (DIA)</option>
                                <option value="IWM">Russell 2000 (IWM)</option>
                            </select>
                        </div>
                    )}

                    {/* SMART FIELDS (Skip for Custom) */}
                    {category !== 'Custom' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Target Price ($)</label>
                                <input
                                    type="number"
                                    placeholder="150.00"
                                    value={smartInputs.targetPrice}
                                    onChange={e => setSmartInputs({ ...smartInputs, targetPrice: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-gold"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Direction</label>
                                <select
                                    value={smartInputs.direction}
                                    onChange={e => setSmartInputs({ ...smartInputs, direction: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-gold"
                                >
                                    <option value="Above">Price Above (&gt;)</option>
                                    <option value="Below">Price Below (&lt;)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* COMMON: END DATE */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">End Date</label>
                        <input
                            type="datetime-local"
                            value={newPrediction.end_date}
                            onChange={e => setNewPrediction({ ...newPrediction, end_date: e.target.value })}
                            className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white focus:border-gold outline-none"
                            required
                        />
                    </div>

                    {/* PREVIEW / OVERRIDE */}
                    <div className="pt-4 border-t border-gray-800">
                        <label className="block text-xs text-gold font-bold mb-2 uppercase">Generated Output (Editable)</label>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Title</label>
                                <input
                                    value={newPrediction.title}
                                    onChange={e => setNewPrediction({ ...newPrediction, title: e.target.value })}
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-gold outline-none"
                                    placeholder="Prediction Title"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Market Condition Logic</label>
                                <input
                                    value={newPrediction.market_condition}
                                    onChange={e => setNewPrediction({ ...newPrediction, market_condition: e.target.value })}
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 font-mono focus:border-gold outline-none"
                                    placeholder="Condition String"
                                />
                            </div>
                            {category === 'Custom' && (
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Related Ticker</label>
                                    <input
                                        value={newPrediction.stock}
                                        onChange={e => setNewPrediction({ ...newPrediction, stock: e.target.value.toUpperCase() })}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-gold outline-none"
                                        placeholder="TICKER"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-gold hover:bg-yellow-500 text-black font-bold py-3 rounded-lg transition-colors mt-2 shadow-[0_0_15px_rgba(255,215,0,0.3)]">
                        Post Prediction
                    </button>
                </form>
            </div>
        </div>
    );
};

export default MarketPredictions;
