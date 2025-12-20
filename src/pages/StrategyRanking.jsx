import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Activity, Trash2, TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import WaveBackground from '../components/WaveBackground.jsx';
import { useAuth } from '../contexts/AuthContext';

const StrategyRanking = () => {
    const { userProfile, currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('active'); // active | history | mine
    const [rankings, setRankings] = useState({ active: [], history: [] });
    const [loading, setLoading] = useState(true);
    const [submission, setSubmission] = useState({
        user_email: '',
        portfolio_code: '',
        interval: '1/d'
    });
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchRankings();
    }, []);

    // Sync User Identity
    useEffect(() => {
        if (currentUser && currentUser.email) {
            setSubmission(prev => ({
                ...prev,
                user_email: currentUser.email
            }));
        } else if (userProfile && userProfile.email) {
            setSubmission(prev => ({
                ...prev,
                user_email: userProfile.email
            }));
        }
    }, [currentUser, userProfile]);

    const fetchRankings = async () => {
        try {
            setLoading(true);
            const res = await fetch('http://127.0.0.1:8000/api/strategy-ranking/list');
            const data = await res.json();
            // Sort by PnL Descending
            if (data.active) data.active.sort((a, b) => (b.pnl_all_time || 0) - (a.pnl_all_time || 0));
            if (data.history) data.history.sort((a, b) => (b.pnl_all_time || 0) - (a.pnl_all_time || 0));
            setRankings(data);
        } catch (error) {
            console.error("Error fetching rankings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!submission.portfolio_code) return;

        try {
            const res = await fetch('http://127.0.0.1:8000/api/strategy-ranking/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submission)
            });
            const result = await res.json();
            if (result.status === 'success') {
                setMessage('Portfolio Submitted Successfully!');
                fetchRankings();
                setSubmission(prev => ({ ...prev, portfolio_code: '' }));
            } else {
                setMessage('Error: ' + result.message);
            }
        } catch (err) {
            setMessage('Network Error');
        }
        setTimeout(() => setMessage(''), 3000);
    };

    const handleRemove = async (code) => {
        if (!confirm(`Retire ${code} from active rankings? It will be moved to Hall of Fame.`)) return;
        try {
            const res = await fetch('http://127.0.0.1:8000/api/strategy-ranking/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_email: submission.user_email, portfolio_code: code })
            });
            const result = await res.json();
            if (result.status === 'success') {
                fetchRankings();
            } else {
                alert(result.message);
            }
        } catch (e) {
            alert("Error removing portfolio");
        }
    };

    const handlePermanentDelete = async (code) => {
        if (!confirm(`PERMANENTLY DELETE ${code} from history? This cannot be undone.`)) return;
        try {
            const res = await fetch('http://127.0.0.1:8000/api/strategy-ranking/delete-permanent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_email: submission.user_email, portfolio_code: code })
            });
            const result = await res.json();
            if (result.status === 'success') {
                fetchRankings();
            } else {
                alert(result.message);
            }
        } catch (e) {
            alert("Error deleting portfolio");
        }
    };

    const formatPnL = (val) => {
        const num = parseFloat(val || 0);
        const isPos = num >= 0;
        return (
            <span className={`font-mono font-bold ${isPos ? 'text-green-400' : 'text-red-400'} flex items-center gap-1`}>
                {isPos ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                ${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        );
    };

    const formatTimeSince = (dateStr) => {
        if (!dateStr) return 'Just now';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHrs / 24);

        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHrs > 0) return `${diffHrs}h ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        return 'Just now';
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 relative overflow-hidden">
            <WaveBackground />

            <div className="relative z-10 max-w-7xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link to="/portfolio-lab" className="mr-4 p-2 bg-white/5 rounded-full hover:bg-white/10 transition">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gold to-yellow-200">
                        Strategy Rankings
                    </h1>
                </div>

                {/* Submission Zone */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-8"
                >
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Activity className="text-gold" /> Submit Strategy
                    </h2>
                    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-grow w-full">
                            <label className="block text-gray-400 text-sm mb-1">Portfolio Code</label>
                            <input
                                type="text"
                                value={submission.portfolio_code}
                                onChange={(e) => setSubmission({ ...submission, portfolio_code: e.target.value })}
                                className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-gold"
                                placeholder="e.g. ALPHA_V1"
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-gray-400 text-sm mb-1">Interval</label>
                            <select
                                value={submission.interval}
                                onChange={(e) => setSubmission({ ...submission, interval: e.target.value })}
                                className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-gold"
                            >
                                <option value="1/h">Hourly (1/h)</option>
                                <option value="1/d">Daily (1/d)</option>
                                <option value="1/w">Weekly (1/w)</option>
                                <option value="1/m">Monthly (1/m)</option>
                            </select>
                        </div>
                        <button
                            type="submit"
                            className="w-full md:w-auto px-6 py-2 bg-gradient-to-r from-gold to-yellow-600 text-black font-bold rounded-lg hover:brightness-110 transition shadow-lg shadow-gold/20"
                        >
                            Submit to Arena
                        </button>
                    </form>
                    {message && <p className="mt-2 text-gold text-sm">{message}</p>}
                </motion.div>

                {/* Leaderboard Tabs */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-6 py-2 rounded-full font-medium transition-all ${activeTab === 'active' ? 'bg-gold text-black shadow-lg shadow-gold/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                        Active Battles
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-full font-medium transition-all ${activeTab === 'history' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                        All-Time Hall of Fame
                    </button>
                    <button
                        onClick={() => setActiveTab('mine')}
                        className={`px-6 py-2 rounded-full font-medium transition-all ${activeTab === 'mine' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                    >
                        My Strategies
                    </button>
                </div>

                {/* Ranking Table */}
                <div className="bg-gray-900/50 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden min-h-[400px] mb-12">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-gray-400 uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Rank</th>
                                    <th className="px-6 py-4">Strategy Code</th>
                                    <th className="px-6 py-4">Commander</th>
                                    <th className="px-6 py-4 text-right">All-Time PnL</th>
                                    <th className="px-6 py-4">Interval</th>
                                    <th className="px-6 py-4">
                                        {(activeTab === 'active' || activeTab === 'mine') ? 'Time Since Post' : 'Retired At'}
                                    </th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan="7" className="p-8 text-center text-gray-500">Loading Intelligence...</td></tr>
                                ) : (() => {
                                    let displayList = [];
                                    if (activeTab === 'active') displayList = rankings.active;
                                    else if (activeTab === 'history') displayList = rankings.history;
                                    else if (activeTab === 'mine') displayList = [...rankings.active, ...rankings.history]
                                        .filter(x => x.user_email === submission.user_email)
                                        .sort((a, b) => (b.pnl_all_time || 0) - (a.pnl_all_time || 0));

                                    if (displayList.length === 0) return <tr><td colSpan="7" className="p-8 text-center text-gray-500">No strategy data found.</td></tr>;

                                    return displayList.map((item, index) => {
                                        const isMine = item.user_email === submission.user_email;
                                        return (
                                            <tr key={index} className={`hover:bg-white/5 transition-colors group ${isMine ? 'bg-gold/5 border-l-2 border-gold' : ''}`}>
                                                <td className="px-6 py-4 font-mono text-gray-500">#{index + 1}</td>
                                                <td className="px-6 py-4 font-bold text-white group-hover:text-gold transition-colors">
                                                    {item.portfolio_code}
                                                </td>
                                                <td className="px-6 py-4 text-gray-300 flex items-center gap-2">
                                                    {item.username || item.user_email.split('@')[0]}
                                                    {isMine && <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded border border-gold/30">YOU</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {formatPnL(item.pnl_all_time)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-300">{item.interval || '1/d'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-400 text-sm">
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={14} />
                                                        {(activeTab === 'active' || activeTab === 'mine' && item.status === 'active')
                                                            ? formatTimeSince(item.submission_date)
                                                            : (item.removal_date ? new Date(item.removal_date).toLocaleDateString() : 'N/A')}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {(isMine || submission.user_email === 'marketinsightscenter@gmail.com') && item.status === 'active' && (
                                                        <button
                                                            onClick={() => handleRemove(item.portfolio_code)}
                                                            className="text-gray-500 hover:text-red-500 transition-colors p-2"
                                                            title="Retire from Rankings"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                    {item.status === 'removed' && <span className="text-gray-600 text-xs italic">Retired</span>}
                                                </td>
                                            </tr>
                                        )
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* My Active Strategies / Shortcut Box (Requested Feature) 
                    "at the bottom of the Active Battles page... add a box for all the user's submitted portfolios" 
                */}
                {activeTab === 'active' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="bg-gray-900/50 backdrop-blur-md border border-gold/20 rounded-2xl p-6 relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-gold/50" />
                        <h3 className="text-xl font-bold text-gold mb-4 flex items-center gap-2">
                            <Trophy size={20} /> Your Command Center
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-gray-500 text-xs uppercase border-b border-white/10">
                                    <tr>
                                        <th className="py-2">Strategy</th>
                                        <th className="py-2 text-right">PnL</th>
                                        <th className="py-2 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankings.active.filter(x => x.user_email === submission.user_email).length === 0 ? (
                                        <tr><td colSpan="3" className="py-4 text-gray-500 italic">You have no active strategies in the arena.</td></tr>
                                    ) : (
                                        rankings.active.filter(x => x.user_email === submission.user_email).map((item, idx) => (
                                            <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                                <td className="py-3 font-bold text-white relative">
                                                    {item.portfolio_code}
                                                    {item.status === 'active' && <span className="absolute -top-1 -right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Active"></span>}
                                                </td>
                                                <td className="py-3 text-right">{formatPnL(item.pnl_all_time)}</td>
                                                <td className="py-3 text-right flex justify-end gap-3">
                                                    <button
                                                        onClick={() => handleRemove(item.portfolio_code)}
                                                        className="text-red-400 hover:text-red-300 text-sm underline opacity-70 hover:opacity-100"
                                                    >
                                                        Retire
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                    {/* Also show History items here for deletion/viewing */}
                                    {rankings.history.filter(x => x.user_email === submission.user_email).map((item, idx) => (
                                        <tr key={`hist-${idx}`} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors opacity-70">
                                            <td className="py-3 font-bold text-gray-400">{item.portfolio_code} (Retired)</td>
                                            <td className="py-3 text-right">{formatPnL(item.pnl_all_time)}</td>
                                            <td className="py-3 text-right flex justify-end gap-3">
                                                <button
                                                    onClick={() => handlePermanentDelete(item.portfolio_code)}
                                                    className="text-gray-500 hover:text-red-600 text-sm flex items-center gap-1 transition-colors"
                                                    title="Permanently Delete"
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </div >
        </div >
    );
};

export default StrategyRanking;
