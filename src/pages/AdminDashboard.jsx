import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, TrendingUp, Shield, Activity, Search, Edit2,
    Save, X, Check, Trash2, Tag, Plus, FileText, Lightbulb, Megaphone, Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import CreateArticleModal from '../components/CreateArticleModal';
import CreateIdeaModal from '../components/CreateIdeaModal';

const AdminDashboard = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    // Simple cache to prevent reload on revisit (persists during session unless page refresh)
    const [cacheLoaded, setCacheLoaded] = useState(false);

    const [users, setUsers] = useState([]);
    const [coupons, setCoupons] = useState([]);
    const [articles, setArticles] = useState([]);
    const [ideas, setIdeas] = useState([]);
    const [mods, setMods] = useState([]);
    const [banners, setBanners] = useState([]);

    const [stats, setStats] = useState({ totalUsers: 0, proUsers: 0, activeTrials: 0 });

    // Unified Search Term for all tabs
    const [searchTerm, setSearchTerm] = useState('');

    // Predictions State
    const [predictions, setPredictions] = useState([]);
    const [newPrediction, setNewPrediction] = useState({ title: '', stock: '', end_date: '', market_condition: '', wager_logic: 'binary_odds' });

    const [newModEmail, setNewModEmail] = useState('');

    // --- SMART BUILDER STATE ---
    const [category, setCategory] = useState('Stocks');
    const [smartInputs, setSmartInputs] = useState({
        ticker: '',
        coin: 'BTC',
        index: 'SPY',
        targetPrice: '',
        direction: 'Above',
        dateType: 'Specific',
        customDate: '',
    });

    // Auto-Generate Title & Condition (Replicated from MarketPredictions)
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

        setNewPrediction(prev => ({
            ...prev,
            title: title,
            stock: symbol,
            market_condition: condition,
            wager_logic: 'binary_odds'
        }));
    }, [category, smartInputs]);

    const [loadingUsers, setLoadingUsers] = useState(false);
    const [errorUsers, setErrorUsers] = useState(null);

    const [editingUser, setEditingUser] = useState(null);
    const [newTier, setNewTier] = useState('');
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [newCoupon, setNewCoupon] = useState({ code: '', plan_id: '', tier: 'Pro', discount_label: '20% OFF' });

    // Banners State
    const [showBannerModal, setShowBannerModal] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);
    const [bannerForm, setBannerForm] = useState({ text: '', link: '', type: 'info', active: true });

    // Create Content Modals State
    const [showCreateArticleModal, setShowCreateArticleModal] = useState(false);
    const [showCreateIdeaModal, setShowCreateIdeaModal] = useState(false);

    // --- LOGS STATE ---
    const [logs, setLogs] = useState('');
    const [logFile, setLogFile] = useState('server');
    const [loadingLogs, setLoadingLogs] = useState(false);

    const fetchLogs = (file = 'server') => {
        setLoadingLogs(true);
        setLogFile(file);
        if (!currentUser) return;
        fetch(`/api/admin/logs?email=${currentUser.email}&file=${file}`)
            .then(async res => {
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch {
                    // If parsing fails, maybe it returned raw text or error page
                    if (!res.ok) throw new Error(text || res.statusText);
                    throw new Error("Invalid JSON response");
                }
            })
            .then(data => setLogs(data.content || 'No content or log file not found.'))
            .catch(err => setLogs(`Error fetching logs: ${err.message}`))
            .finally(() => setLoadingLogs(false));
    };

    // --- SECURITY CHECK ---
    useEffect(() => {
        if (!currentUser) { navigate('/'); return; }
        fetch('/api/mods')
            .then(res => res.json())
            .then(data => {
                const myEmail = currentUser.email.toLowerCase();
                const allowed = data.mods.map(m => m.toLowerCase());
                if (!allowed.includes(myEmail)) navigate('/');
            })
            .catch(() => navigate('/'));
    }, [currentUser, navigate]);

    // Fetch Helpers with Caching
    const fetchUsers = (force = false) => {
        if (!force && users.length > 0) return; // Use cached
        setLoadingUsers(true);
        setErrorUsers(null);
        fetch('/api/users')
            .then(res => {
                if (!res.ok) throw new Error("Failed to connect to backend");
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setUsers(data);
                    setStats({
                        totalUsers: data.length,
                        proUsers: data.filter(u => u.tier === 'Pro' || u.tier === 'Enterprise').length,
                        activeTrials: data.filter(u => u.subscription_status === 'trialling').length
                    });
                } else {
                    setErrorUsers("Received invalid data format");
                }
            })
            .catch(err => setErrorUsers(err.message))
            .finally(() => setLoadingUsers(false));
    };

    const fetchArticles = () => {
        fetch('/api/articles').then(res => res.json()).then(data => setArticles(Array.isArray(data) ? data : [])).catch(() => setArticles([]));
    };

    const fetchIdeas = () => {
        fetch('/api/ideas').then(res => res.json()).then(data => setIdeas(Array.isArray(data) ? data : [])).catch(() => setIdeas([]));
    };

    const fetchBanners = () => {
        if (currentUser) {
            fetch(`/api/admin/banners?email=${currentUser.email}`).then(res => res.json()).then(data => setBanners(Array.isArray(data) ? data : [])).catch(() => setBanners([]));
        }
    };

    useEffect(() => {
        if (!currentUser) return;

        fetchUsers();

        if (currentUser && !cacheLoaded) {
            fetchUsers();
            fetch(`/api/admin/coupons?email=${currentUser.email}`).then(res => res.json()).then(data => setCoupons(Array.isArray(data) ? data : [])).catch(() => setCoupons([]));
            fetchArticles();
            fetchIdeas();
            fetch('/api/mods').then(res => res.json()).then(data => setMods(Array.isArray(data.mods) ? data.mods : [])).catch(() => setMods([]));
            fetchBanners();
            fetchPredictions();
            setCacheLoaded(true); // Mark as loaded so we don't refetch on tab switch/remount during same session unless desired
        }
    }, [currentUser, cacheLoaded]);

    const fetchPredictions = async () => {
        try {
            const res = await fetch('/api/predictions/active');
            const data = await res.json();
            setPredictions(data);
        } catch (error) {
            console.error("Error fetching predictions:", error);
        }
    };

    const handleUpdateTier = async () => {
        const res = await fetch('/api/admin/users/update', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_email: editingUser.email, new_tier: newTier, requester_email: currentUser.email })
        });
        if (res.ok) {
            setUsers(users.map(u => u.email === editingUser.email ? { ...u, tier: newTier } : u));
            setEditingUser(null);
        }
    };

    const handleDeleteUser = async (email) => {
        if (!window.confirm(`Are you sure you want to PERMANENTLY delete ${email}?`)) return;
        const res = await fetch('/api/admin/users/delete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_email: email, requester_email: currentUser.email })
        });
        if (res.ok) {
            setUsers(users.filter(u => u.email !== email));
        } else {
            alert("Failed to delete user. Ensure you have permission.");
        }
    };

    const handleDeleteCoupon = async (code) => {
        if (!window.confirm(`Delete coupon ${code}?`)) return;
        const res = await fetch('/api/admin/coupons/delete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, requester_email: currentUser.email })
        });
        if (res.ok) setCoupons(coupons.filter(c => c.code !== code));
    };

    const handleDeleteArticle = async (id) => {
        if (!window.confirm(`Delete article ${id}?`)) return;
        const res = await fetch('/api/admin/articles/delete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: String(id), requester_email: currentUser.email })
        });
        if (res.ok) setArticles(articles.filter(a => String(a.id) !== String(id)));
    };

    const handleDeleteIdea = async (id) => {
        if (!window.confirm(`Delete idea ${id}?`)) return;
        const res = await fetch('/api/admin/ideas/delete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: String(id), requester_email: currentUser.email })
        });
        if (res.ok) setIdeas(ideas.filter(i => String(i.id) !== String(id)));
    };

    const handleCreateCoupon = async () => {
        try {
            const res = await fetch('/api/admin/coupons/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newCoupon, requester_email: currentUser.email })
            });
            if (res.ok) {
                setCoupons([...coupons, { ...newCoupon, active: true }]);
                setShowCouponModal(false);
            } else alert("Failed to create coupon");
        } catch (error) { console.error(error); }
    };

    const handleModAction = async (email, action) => {
        try {
            const res = await fetch('/api/mods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, action, requester_email: currentUser.email })
            });
            const data = await res.json();

            if (data.status === 'success') {
                if (action === 'add') alert(`${email} added to moderators.`);

                if (data.mods && Array.isArray(data.mods)) {
                    setMods(data.mods);
                } else {
                    const refresh = await fetch('/api/mods');
                    const refreshData = await refresh.json();
                    if (Array.isArray(refreshData.mods)) setMods(refreshData.mods);
                }
                setNewModEmail('');
                fetchUsers(); // Refresh user list to show tier change
            } else {
                alert(data.detail || "Action failed");
            }
        } catch (error) {
            console.error(error);
            alert("Action failed - check console");
        }
    };

    const handleSaveBanner = async () => {
        const url = editingBanner ? '/api/admin/banners' : '/api/admin/banners';
        const method = editingBanner ? 'PUT' : 'POST';
        const body = { ...bannerForm, requester_email: currentUser.email };
        if (editingBanner) body.id = editingBanner.id;

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            setShowBannerModal(false);
            setEditingBanner(null);
            setBannerForm({ text: '', link: '', type: 'info', active: true });
            fetchBanners();
        } else {
            alert("Failed to save banner");
        }
    };

    const handleDeleteBanner = async (id) => {
        if (!window.confirm("Delete this banner?")) return;
        const res = await fetch('/api/admin/banners/delete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, requester_email: currentUser.email })
        });
        if (res.ok) {
            setBanners(banners.filter(b => b.id !== id));
        }
    };

    const openBannerModal = (banner = null) => {
        if (banner) {
            setEditingBanner(banner);
            setBannerForm({ text: banner.text, link: banner.link || '', type: banner.type, active: banner.active });
        } else {
            setEditingBanner(null);
            setBannerForm({ text: '', link: '', type: 'info', active: true });
        }
        setShowBannerModal(true);
    };

    // Filter Logic for Users Tab
    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Helpers for Moderators Tab
    const getModDetails = (email) => {
        const user = users.find(u => u.email === email);
        return user ? { username: user.username, email: user.email } : { username: 'Unknown', email: email };
    };

    const filteredMods = (mods || []).map(getModDetails).filter(m =>
        m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreatePrediction = async (e) => {
        e.preventDefault();
        if (!newPrediction.title || !newPrediction.stock || !newPrediction.end_date) return;

        try {
            const res = await fetch('/api/predictions/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newPrediction,
                    creator_email: currentUser.email,
                    category: category // Include selected category
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Prediction created!");
                setNewPrediction({ title: '', stock: '', end_date: '', market_condition: '', wager_logic: 'binary_odds' });
                fetchPredictions();
            } else {
                alert("Failed to create prediction.");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeletePrediction = async (id) => {
        if (!window.confirm("Delete prediction? This cannot be undone.")) return;
        try {
            const res = await fetch('/api/predictions/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, email: currentUser.email })
            });
            const data = await res.json();
            if (data.success) {
                alert("Prediction deleted.");
                fetchPredictions();
            }
        } catch (e) { console.error(e); }
    };



    const TabButton = ({ id, label, icon: Icon }) => (
        <button onClick={() => { setActiveTab(id); setSearchTerm(''); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${activeTab === id ? 'bg-gold text-black' : 'bg-white/10 text-gray-300'}`}>
            <Icon size={16} /> {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-black text-white p-8 pt-24">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gold mb-2">Admin Command Center</h1>
                        <p className="text-gray-400">Manage users, subscriptions, and platform content.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <TabButton id="overview" label="Overview" icon={Activity} />
                        <TabButton id="users" label="Users" icon={Users} />
                        <TabButton id="coupons" label="Coupons" icon={Tag} />
                        <TabButton id="articles" label="Articles" icon={FileText} />
                        <TabButton id="ideas" label="Ideas" icon={Zap} />
                        <TabButton id="banners" label="Banners" icon={Megaphone} />
                        <TabButton id="predictions" label="Predictions" icon={TrendingUp} />

                        <TabButton id="mods" label="Moderators" icon={Shield} />
                        <TabButton id="logs" label="System Logs" icon={FileText} />
                    </div>
                </div>

                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <div className="flex items-center gap-4 mb-2"><Users className="text-gold" /><span className="text-gray-400">Total Users</span></div>
                            <p className="text-3xl font-bold">{stats.totalUsers}</p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <div className="flex items-center gap-4 mb-2"><Shield className="text-gold" /><span className="text-gray-400">Paid Subscribers</span></div>
                            <p className="text-3xl font-bold">{stats.proUsers}</p>
                        </div>
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <div className="flex items-center gap-4 mb-2"><Activity className="text-gold" /><span className="text-gray-400">Active Trials</span></div>
                            <p className="text-3xl font-bold">{stats.activeTrials}</p>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex items-center gap-4">
                            <Search className="text-gray-400" size={20} />
                            <input type="text" placeholder="Search by username or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-white w-full" />
                        </div>

                        {loadingUsers && <div className="p-8 text-center text-gray-400">Loading users...</div>}
                        {errorUsers && <div className="p-8 text-center text-red-500 font-bold">Error: {errorUsers}</div>}

                        {!loadingUsers && !errorUsers && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-gray-400 text-sm">
                                        <tr>
                                            <th className="p-4">Username</th>
                                            <th className="p-4">Email</th>
                                            <th className="p-4">Tier</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredUsers.length === 0 ? (
                                            <tr><td colSpan="5" className="p-8 text-center text-gray-500">No users found.</td></tr>
                                        ) : (
                                            filteredUsers.map(user => (
                                                <tr key={user.email} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4 font-bold text-white flex items-center gap-2">
                                                        {/* Flashing Green Dot for Online Users (< 2 mins) */}
                                                        {user.last_seen && (new Date() - new Date(user.last_seen) < 120000) && (
                                                            <div className="relative flex h-3 w-3" title="Online now">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                                            </div>
                                                        )}
                                                        {user.username || user.display_name || 'N/A'}
                                                    </td>
                                                    <td className="p-4 text-gray-300">{user.email}</td>
                                                    <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${user.tier === 'Singularity' ? 'bg-purple-900 text-purple-200' : user.tier === 'Pro' ? 'bg-gold/20 text-gold' : 'bg-gray-700 text-gray-300'}`}>{user.tier}</span></td>
                                                    <td className="p-4 text-sm text-gray-400 font-mono">
                                                        {user.last_seen && (new Date() - new Date(user.last_seen) < 120000) ? (
                                                            <span className="text-green-400 font-bold">Active</span>
                                                        ) : (
                                                            <span className="text-gray-600">Inactive</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 flex gap-2">
                                                        <button onClick={() => { setEditingUser(user); setNewTier(user.tier); }} className="p-2 hover:bg-white/10 rounded-lg text-gold"><Edit2 size={16} /></button>
                                                        <button onClick={() => handleDeleteUser(user.email)} className="p-2 hover:bg-white/10 rounded-lg text-red-500"><Trash2 size={16} /></button>
                                                        {!mods.includes(user.email.toLowerCase()) && (
                                                            <button onClick={() => handleModAction(user.email, 'add')} className="p-2 hover:bg-white/10 rounded-lg text-blue-400" title="Make Moderator"><Shield size={16} /></button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'coupons' && (
                    <div>
                        <div className="flex justify-end mb-4"><button onClick={() => setShowCouponModal(true)} className="bg-gold text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-yellow-500"><Plus size={18} /> Create Coupon</button></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {coupons.map(c => (
                                <div key={c.code} className="bg-white/5 p-6 rounded-xl border border-white/10 relative">
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        <button onClick={() => handleDeleteCoupon(c.code)} className="text-red-500 hover:text-red-400 bg-black/50 p-1 rounded"><Trash2 size={16} /></button>
                                        <Tag className="text-gold/20" size={40} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1">{c.code}</h3>
                                    <p className="text-gold font-bold mb-4">{c.discount_label}</p>
                                    <div className="text-sm text-gray-400"><p>Tier: {c.applicable_tier}</p><p title={c.plan_id} className="truncate">ID: {c.plan_id}</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'articles' && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Published Articles</h2>
                            <button onClick={() => setShowCreateArticleModal(true)} className="bg-gold text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-yellow-500"><Plus size={18} /> Creative Article</button>
                        </div>
                        <div className="space-y-2">
                            {articles.map(a => (
                                <div key={a.id} className="p-4 bg-black/40 rounded border border-white/5 flex justify-between items-center">
                                    <div><h3 className="font-bold">{a.title}</h3><p className="text-sm text-gray-400">By {a.author} • {a.date}</p></div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-sm text-gray-500">ID: {a.id}</div>
                                        <button onClick={() => handleDeleteArticle(a.id)} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'ideas' && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Community Ideas</h2>
                            <button onClick={() => setShowCreateIdeaModal(true)} className="bg-gold text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-yellow-500"><Plus size={18} /> Create Idea</button>
                        </div>
                        <div className="space-y-2">
                            {ideas.map(i => (
                                <div key={i.id} className="p-4 bg-black/40 rounded border border-white/5 flex justify-between items-center">
                                    <div><h3 className="font-bold">{i.title} <span className="text-gold">({i.ticker})</span></h3><p className="text-sm text-gray-400">By {i.author}</p></div>
                                    <button onClick={() => handleDeleteIdea(i.id)} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'banners' && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Landing Page Banners</h2>
                            <button onClick={() => openBannerModal()} className="bg-gold text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-yellow-500">
                                <Plus size={18} /> Add Banner
                            </button>
                        </div>
                        <div className="space-y-4">
                            {banners.map(banner => (
                                <div key={banner.id} className={`p-4 rounded border ${banner.active ? 'border-white/20 bg-black/40' : 'border-red-900/50 bg-red-900/10'} flex flex-col md:flex-row justify-between items-center gap-4`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded ${banner.type === 'sale' ? 'bg-green-500/20 text-green-500' : banner.type === 'launch' ? 'bg-purple-500/20 text-purple-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                            <Tag size={16} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-white flex items-center gap-2">
                                                {banner.text}
                                                {!banner.active && <span className="text-xs bg-red-500/20 text-red-500 px-2 rounded">INACTIVE</span>}
                                            </div>
                                            {banner.link && <div className="text-sm text-gray-500">{banner.link}</div>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openBannerModal(banner)} className="p-2 hover:bg-white/10 rounded-lg text-gold"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDeleteBanner(banner.id)} className="p-2 hover:bg-white/10 rounded-lg text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                            {banners.length === 0 && <div className="text-center text-gray-500 py-8">No banners found.</div>}
                        </div>
                    </div>
                )}

                {activeTab === 'mods' && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-6 max-w-2xl">
                        <h2 className="text-xl font-bold mb-6">Moderator Management</h2>
                        <div className="p-4 border-b border-white/10 flex items-center gap-4 mb-4">
                            <Search className="text-gray-400" size={20} />
                            <input type="text" placeholder="Search mods by name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-white w-full" />
                        </div>

                        <div className="flex gap-4 mb-8">
                            <input value={newModEmail} onChange={e => setNewModEmail(e.target.value)} placeholder="Enter email to add as moderator" className="flex-1 bg-black border border-white/10 rounded px-4 py-2 text-white" />
                            <button onClick={() => handleModAction(newModEmail, 'add')} className="bg-gold text-black px-4 py-2 rounded font-bold">Add Mod</button>
                        </div>
                        <div className="space-y-2">
                            {filteredMods.map(mod => (
                                <div key={mod.email} className="flex justify-between items-center p-3 bg-black/40 rounded border border-white/5">
                                    <div>
                                        <div className="font-bold text-white">{mod.username}</div>
                                        <div className="text-sm text-gray-400">{mod.email}</div>
                                    </div>
                                    {mod.email !== 'marketinsightscenter@gmail.com' && (
                                        <button onClick={() => handleModAction(mod.email, 'remove')} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-6 flex flex-col h-[70vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2"><FileText size={20} /> System Logs</h2>
                            <div className="flex gap-2">
                                {['server', 'error', 'risk', 'startup'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => fetchLogs(f)}
                                        className={`px-3 py-1 text-sm rounded ${logFile === f ? 'bg-gold text-black font-bold' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                                    >
                                        {f.toUpperCase()}
                                    </button>
                                ))}
                                <button onClick={() => fetchLogs(logFile)} className="bg-white/10 p-2 rounded hover:bg-white/20 ml-2" title="Refresh">
                                    <Activity size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(logs);
                                        alert("Logs copied to clipboard!");
                                    }}
                                    className="bg-white/10 p-2 rounded hover:bg-white/20 ml-2"
                                    title="Copy Logs"
                                >
                                    <FileText size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-black border border-white/10 rounded-lg p-4 overflow-auto font-mono text-xs shadow-inner">
                            {loadingLogs ? (
                                <div className="text-gold animate-pulse">Accessing mainframe logs...</div>
                            ) : (
                                <pre className="whitespace-pre-wrap text-green-400">
                                    {logs || "Select a log file to view content."}
                                </pre>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'predictions' && (
                    <div className="space-y-8">
                        {/* CREATE PREDICTION */}
                        <div className="bg-black/40 border border-white/10 rounded-lg p-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus size={20} /> Create Market Prediction</h3>

                            {/* Category Tabs */}
                            <div className="flex gap-2 mb-6 border-b border-gray-800 pb-2">
                                {['Stocks', 'Crypto', 'Indices', 'Custom'].map(cat => (
                                    <button
                                        type="button"
                                        key={cat}
                                        onClick={() => setCategory(cat)}
                                        className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${category === cat ? 'bg-gold/10 text-gold border-b-2 border-gold' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            <form onSubmit={handleCreatePrediction} className="space-y-4">
                                {/* CONDITIONAL INPUTS */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                                    {/* SMART FIELDS */}
                                    {category !== 'Custom' && (
                                        <>
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
                                        </>
                                    )}
                                </div>

                                {/* COMMON: END DATE & PREVIEW */}
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

                                <div className="pt-4 border-t border-white/10">
                                    <label className="block text-xs text-gold font-bold mb-2 uppercase">Prediction Preview (Auto-Generated)</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Title</label>
                                            <input
                                                value={newPrediction.title}
                                                onChange={e => setNewPrediction({ ...newPrediction, title: e.target.value })}
                                                className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-gold outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Market Condition</label>
                                            <input
                                                value={newPrediction.market_condition}
                                                onChange={e => setNewPrediction({ ...newPrediction, market_condition: e.target.value })}
                                                className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 font-mono focus:border-gold outline-none"
                                            />
                                        </div>
                                        {category === 'Custom' && (
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Related Ticker</label>
                                                <input
                                                    value={newPrediction.stock}
                                                    onChange={e => setNewPrediction({ ...newPrediction, stock: e.target.value.toUpperCase() })}
                                                    className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-gold outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button type="submit" className="w-full bg-gold text-black font-bold py-3 rounded hover:bg-yellow-500 transition-colors shadow-lg shadow-gold/10">Post Prediction</button>
                            </form>
                        </div>

                        {/* LIST PREDICTIONS */}
                        <div className="bg-black/40 border border-white/10 rounded-lg p-6">
                            <h3 className="text-xl font-bold mb-4">Active Predictions</h3>
                            <div className="space-y-4">
                                {predictions.map(pred => (
                                    <div key={pred.id} className="flex justify-between items-center p-4 bg-white/5 rounded border border-white/5">
                                        <div>
                                            <div className="font-bold text-lg">{pred.title}</div>
                                            <div className="text-sm text-gray-400">Ends: {new Date(pred.end_date).toLocaleString()} | Stock: {pred.stock}</div>
                                            <div className="text-xs text-gold mt-1">Pool: {pred.total_pool_yes + pred.total_pool_no} pts</div>
                                        </div>
                                        <button onClick={() => handleDeletePrediction(pred.id)} className="p-2 text-red-500 hover:bg-white/10 rounded"><Trash2 size={18} /></button>
                                    </div>
                                ))}
                                {predictions.length === 0 && <p className="text-gray-500">No active predictions.</p>}
                            </div>
                        </div>
                    </div>
                )}


            </div>

            {/* Edit User Modal */}
            <AnimatePresence>
                {editingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="bg-gray-900 border border-white/10 p-8 rounded-xl w-full max-w-md">
                            <h3 className="text-xl font-bold mb-6">Edit User Subscription</h3>
                            <div className="space-y-4 mb-8">
                                <div><label className="block text-sm text-gray-400 mb-1">Email</label><input disabled value={editingUser.email} className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-gray-500" /></div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Tier</label>
                                    <select value={newTier} onChange={(e) => setNewTier(e.target.value)} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white">
                                        <option value="Basic">Basic</option><option value="Pro">Pro</option><option value="Enterprise">Enterprise</option><option value="Singularity">Singularity</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3"><button onClick={() => setEditingUser(null)} className="px-4 py-2 text-gray-400">Cancel</button><button onClick={handleUpdateTier} className="px-4 py-2 bg-gold text-black rounded font-bold">Save Changes</button></div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create Coupon Modal */}
            <AnimatePresence>
                {showCouponModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="bg-gray-900 border border-white/10 p-8 rounded-xl w-full max-w-md">
                            <h3 className="text-xl font-bold mb-6">Create Coupon</h3>
                            <div className="space-y-4 mb-8">
                                <div><label className="block text-sm text-gray-400 mb-1">Code</label><input value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white" placeholder="e.g. SAVE20" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Label</label><input value={newCoupon.discount_label} onChange={e => setNewCoupon({ ...newCoupon, discount_label: e.target.value })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white" placeholder="e.g. 20% OFF" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Tier</label><select value={newCoupon.tier} onChange={e => setNewCoupon({ ...newCoupon, tier: e.target.value })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white"><option value="Pro">Pro</option><option value="Enterprise">Enterprise</option></select></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Plan ID</label><input value={newCoupon.plan_id} onChange={e => setNewCoupon({ ...newCoupon, plan_id: e.target.value })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white" placeholder="Hidden PayPal Plan ID" /></div>
                            </div>
                            <div className="flex justify-end gap-3"><button onClick={() => setShowCouponModal(false)} className="px-4 py-2 text-gray-400">Cancel</button><button onClick={handleCreateCoupon} className="px-4 py-2 bg-gold text-black rounded font-bold">Create</button></div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Banner Modal */}
            <AnimatePresence>
                {showBannerModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="bg-gray-900 border border-white/10 p-8 rounded-xl w-full max-w-md">
                            <h3 className="text-xl font-bold mb-6">{editingBanner ? 'Edit Banner' : 'Create Banner'}</h3>
                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Banner Text</label>
                                    <input value={bannerForm.text} onChange={e => setBannerForm({ ...bannerForm, text: e.target.value })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white" placeholder="e.g. Big Sale this Weekend!" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Link (Optional)</label>
                                    <input value={bannerForm.link} onChange={e => setBannerForm({ ...bannerForm, link: e.target.value })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white" placeholder="/products" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Countdown Target (Optional)</label>
                                    <input
                                        type="datetime-local"
                                        value={bannerForm.countdown_target || ''}
                                        onChange={e => setBannerForm({ ...bannerForm, countdown_target: e.target.value })}
                                        className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Leave empty for no countdown</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Type</label>
                                        <select value={bannerForm.type} onChange={e => setBannerForm({ ...bannerForm, type: e.target.value })} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white">
                                            <option value="info">Info (Blue)</option>
                                            <option value="sale">Sale (Green)</option>
                                            <option value="launch">Launch (Purple)</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center pt-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={bannerForm.active} onChange={e => setBannerForm({ ...bannerForm, active: e.target.checked })} />
                                            <span className="text-white select-none">Active</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setShowBannerModal(false)} className="px-4 py-2 text-gray-400">Cancel</button>
                                <button onClick={handleSaveBanner} className="px-4 py-2 bg-gold text-black rounded font-bold">Save</button>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create Article Modal */}
            <CreateArticleModal
                isOpen={showCreateArticleModal}
                onClose={() => setShowCreateArticleModal(false)}
                onArticleCreated={() => fetchArticles()}
                user={currentUser}
            />

            {/* Create Idea Modal */}
            <CreateIdeaModal
                isOpen={showCreateIdeaModal}
                onClose={() => setShowCreateIdeaModal(false)}
                onIdeaCreated={() => fetchIdeas()}
                user={currentUser}
            />
        </div>
    );
};

export default AdminDashboard;