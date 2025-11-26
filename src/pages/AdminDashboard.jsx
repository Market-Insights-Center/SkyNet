import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Search, Edit2, Check, X, FileText, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';

const AdminDashboard = () => {
    const { currentUser } = useAuth();
    const [isMod, setIsMod] = useState(false);
    const [loading, setLoading] = useState(true);

    // Data States
    const [users, setUsers] = useState([]);
    const [articles, setArticles] = useState([]);
    const [mods, setMods] = useState([]);

    // UI States
    const [activeTab, setActiveTab] = useState('users'); // 'users', 'articles', 'mods'
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [showNewArticleForm, setShowNewArticleForm] = useState(false);
    const [newArticle, setNewArticle] = useState({ title: '', subheading: '', content: '', author: 'M.I.C. Team', category: 'Insight', cover_image: '' });
    const [newModEmail, setNewModEmail] = useState('');

    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        const action = params.get('action');

        if (tab) {
            setActiveTab(tab);
        }
        if (tab === 'articles' && action === 'new') {
            setShowNewArticleForm(true);
        }

        if (currentUser) {
            // Verify Mod Status
            fetch('http://localhost:8000/api/mods')
                .then(res => res.json())
                .then(data => {
                    if (data.mods.includes(currentUser.email)) {
                        setIsMod(true);
                        fetchData();
                    } else {
                        setLoading(false);
                    }
                })
                .catch(err => {
                    console.error("Error checking mods:", err);
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, [currentUser, location.search]);

    const fetchData = () => {
        // Fetch Users
        fetch('http://localhost:8000/api/users')
            .then(res => res.json())
            .then(data => setUsers(data))
            .catch(err => console.error("Error fetching users:", err));

        // Fetch Articles
        fetch('http://localhost:8000/api/articles?limit=100')
            .then(res => res.json())
            .then(data => setArticles(data))
            .catch(err => console.error("Error fetching articles:", err));

        // Fetch Mods
        fetch('http://localhost:8000/api/mods')
            .then(res => res.json())
            .then(data => setMods(data.mods))
            .catch(err => console.error("Error fetching mods:", err))
            .finally(() => setLoading(false));
    };

    const handleSubscriptionChange = (email, newTier) => {
        const user = users.find(u => u.email === email);
        if (!user) return;

        const updatedUser = { ...user, subscription_plan: newTier };

        // Optimistic update
        setUsers(users.map(u => u.email === email ? updatedUser : u));
        setEditingUser(null);

        fetch('http://localhost:8000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedUser)
        }).catch(err => console.error("Error updating user:", err));
    };

    const handleCreateArticle = (e) => {
        e.preventDefault();
        const articleData = {
            ...newArticle,
            date: new Date().toISOString().split('T')[0],
            hashtags: []
        };

        fetch('http://localhost:8000/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(articleData)
        })
            .then(res => res.json())
            .then(savedArticle => {
                setArticles([savedArticle, ...articles]);
                setShowNewArticleForm(false);
                setNewArticle({ title: '', subheading: '', content: '', author: 'M.I.C. Team', category: 'Insight', cover_image: '' });
            })
            .catch(err => console.error("Error creating article:", err));
    };

    const handleDeleteArticle = (id) => {
        if (window.confirm("Are you sure you want to delete this article?")) {
            fetch(`http://localhost:8000/api/articles/${id}?requester_email=${currentUser.email}`, {
                method: 'DELETE'
            })
                .then(() => {
                    setArticles(articles.filter(a => a.id !== id));
                })
                .catch(err => console.error("Error deleting article:", err));
        }
    };

    const handleAddMod = (e) => {
        e.preventDefault();
        fetch('http://localhost:8000/api/mods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: newModEmail, action: 'add', requester_email: currentUser.email })
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    setMods([...mods, newModEmail]);
                    setNewModEmail('');
                } else {
                    alert(data.message);
                }
            })
            .catch(err => console.error("Error adding mod:", err));
    };

    const handleRemoveMod = (email) => {
        if (window.confirm(`Remove ${email} from moderators?`)) {
            fetch('http://localhost:8000/api/mods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, action: 'remove', requester_email: currentUser.email })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        setMods(mods.filter(m => m !== email));
                    } else {
                        alert(data.message);
                    }
                })
                .catch(err => console.error("Error removing mod:", err));
        }
    };

    if (loading) return <div className="min-h-screen bg-deep-black flex items-center justify-center text-white">Loading...</div>;

    if (!isMod) {
        return (
            <div className="min-h-screen bg-deep-black flex flex-col items-center justify-center text-white p-4">
                <Shield size={64} className="text-red-500 mb-6" />
                <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
                <p className="text-gray-400 mb-8 text-center max-w-md">
                    You do not have permission to view this area. This page is restricted to M.I.C. Moderators only.
                </p>
                <Link to="/" className="bg-gold text-black px-8 py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors">
                    Return Home
                </Link>
            </div>
        );
    }

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4 pb-20">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 flex items-center">
                            <Shield className="text-gold mr-3" /> Admin Dashboard
                        </h1>
                        <p className="text-gray-400">Manage users, articles, and permissions.</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                        <span className="font-bold text-sm">System Operational</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'users' ? 'bg-gold text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                    >
                        <Users size={18} className="inline mr-2" /> Users
                    </button>
                    <button
                        onClick={() => setActiveTab('articles')}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'articles' ? 'bg-gold text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                    >
                        <FileText size={18} className="inline mr-2" /> Articles
                    </button>
                    <button
                        onClick={() => setActiveTab('mods')}
                        className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'mods' ? 'bg-gold text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                    >
                        <Shield size={18} className="inline mr-2" /> Moderators
                    </button>
                </div>

                {/* Content Area */}
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden min-h-[500px]">

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div>
                            <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                                <h2 className="text-xl font-bold">User Management</h2>
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:border-gold focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Email</th>
                                            <th className="px-6 py-4">Plan</th>
                                            <th className="px-6 py-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredUsers.map((user, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4 font-bold">{user.email}</td>
                                                <td className="px-6 py-4">
                                                    {editingUser === user.email ? (
                                                        <select
                                                            value={user.subscription_plan}
                                                            onChange={(e) => handleSubscriptionChange(user.email, e.target.value)}
                                                            className="bg-black border border-gold text-gold rounded px-2 py-1 text-sm focus:outline-none"
                                                        >
                                                            <option value="Free">Free</option>
                                                            <option value="Explorer">Explorer</option>
                                                            <option value="Navigator">Navigator</option>
                                                            <option value="Visionary">Visionary</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`font-bold ${user.subscription_plan === 'Visionary' ? 'text-gold' : 'text-gray-400'}`}>
                                                            {user.subscription_plan}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {editingUser === user.email ? (
                                                        <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
                                                    ) : (
                                                        <button onClick={() => setEditingUser(user.email)} className="text-gold hover:text-yellow-400 flex items-center text-sm font-bold"><Edit2 size={16} className="mr-1" /> Edit</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ARTICLES TAB */}
                    {activeTab === 'articles' && (
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">Article Management</h2>
                                <button
                                    onClick={() => setShowNewArticleForm(!showNewArticleForm)}
                                    className="bg-gold text-black px-4 py-2 rounded-lg font-bold hover:bg-yellow-500 transition-colors flex items-center"
                                >
                                    {showNewArticleForm ? <X size={18} className="mr-2" /> : <Plus size={18} className="mr-2" />}
                                    {showNewArticleForm ? "Cancel" : "New Article"}
                                </button>
                            </div>

                            {showNewArticleForm && (
                                <form onSubmit={handleCreateArticle} className="mb-8 bg-white/5 p-6 rounded-xl border border-white/10 space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Title"
                                        value={newArticle.title}
                                        onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-gold focus:outline-none"
                                        required
                                    />
                                    <input
                                        type="text"
                                        placeholder="Subheading"
                                        value={newArticle.subheading}
                                        onChange={(e) => setNewArticle({ ...newArticle, subheading: e.target.value })}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-gold focus:outline-none"
                                        required
                                    />
                                    <textarea
                                        placeholder="Content (HTML supported)"
                                        value={newArticle.content}
                                        onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-gold focus:outline-none min-h-[200px]"
                                        required
                                    />
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            placeholder="Category"
                                            value={newArticle.category}
                                            onChange={(e) => setNewArticle({ ...newArticle, category: e.target.value })}
                                            className="flex-1 bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-gold focus:outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Author"
                                            value={newArticle.author}
                                            onChange={(e) => setNewArticle({ ...newArticle, author: e.target.value })}
                                            className="flex-1 bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-gold focus:outline-none"
                                        />
                                    </div>
                                    <button type="submit" className="w-full bg-gold text-black py-3 rounded-lg font-bold hover:bg-yellow-500 transition-colors">
                                        Publish Article
                                    </button>
                                </form>
                            )}

                            <div className="space-y-4">
                                {articles.map(article => (
                                    <div key={article.id} className="bg-white/5 p-4 rounded-lg flex justify-between items-center border border-white/5 hover:border-gold/30 transition-colors">
                                        <div>
                                            <h3 className="font-bold text-lg">{article.title}</h3>
                                            <p className="text-sm text-gray-400">{new Date(article.date).toLocaleDateString()} • {article.author}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteArticle(article.id)}
                                            className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* MODS TAB */}
                    {activeTab === 'mods' && (
                        <div className="p-6">
                            <h2 className="text-xl font-bold mb-6">Moderator Management</h2>

                            <form onSubmit={handleAddMod} className="flex gap-4 mb-8">
                                <input
                                    type="email"
                                    placeholder="Enter email to add as mod"
                                    value={newModEmail}
                                    onChange={(e) => setNewModEmail(e.target.value)}
                                    className="flex-1 bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-gold focus:outline-none"
                                    required
                                />
                                <button type="submit" className="bg-gold text-black px-6 rounded-lg font-bold hover:bg-yellow-500 transition-colors">
                                    Add Mod
                                </button>
                            </form>

                            <div className="space-y-2">
                                {mods.map((mod, idx) => (
                                    <div key={idx} className="bg-white/5 p-4 rounded-lg flex justify-between items-center">
                                        <span className="font-bold text-gray-300">{mod}</span>
                                        {mod !== 'marketinsightscenter@gmail.com' && (
                                            <button
                                                onClick={() => handleRemoveMod(mod)}
                                                className="text-red-400 hover:text-red-300 text-sm font-bold"
                                            >
                                                Remove
                                            </button>
                                        )}
                                        {mod === 'marketinsightscenter@gmail.com' && (
                                            <span className="text-gold text-xs font-bold border border-gold/30 px-2 py-1 rounded">SUPER ADMIN</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
