import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, FileText, Users, Trash2, Edit, Plus, Save, X, Check } from 'lucide-react';

const AdminDashboard = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('articles');
    const [articles, setArticles] = useState([]);
    const [users, setUsers] = useState([]);
    const [mods, setMods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // Article Form State
    const [editingArticle, setEditingArticle] = useState(null);
    const [newArticle, setNewArticle] = useState({ title: '', subheading: '', content: '', category: 'Market', author: 'M.I.C. Team', cover_image: '' });
    const [showArticleForm, setShowArticleForm] = useState(false);

    // Mod Form State
    const [newModEmail, setNewModEmail] = useState('');

    useEffect(() => {
        if (currentUser) {
            setIsSuperAdmin(currentUser.email === 'marketinsightscenter@gmail.com');
            fetchData();
        } else {
            navigate('/login');
        }
    }, [currentUser, navigate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [articlesRes, usersRes, modsRes] = await Promise.all([
                fetch('http://localhost:8001/api/articles?limit=100'),
                fetch('http://localhost:8001/api/users'),
                fetch('http://localhost:8001/api/mods')
            ]);

            const articlesData = await articlesRes.json();
            const usersData = await usersRes.json();
            const modsData = await modsRes.json();

            setArticles(articlesData);
            setUsers(usersData);
            setMods(modsData.mods || []);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Article Management ---

    const handleArticleSubmit = async (e) => {
        e.preventDefault();
        const articleData = editingArticle || newArticle;

        // Basic validation
        if (!articleData.title || !articleData.content) return;

        try {
            const response = await fetch('http://localhost:8001/api/articles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(articleData)
            });

            if (response.ok) {
                fetchData();
                setShowArticleForm(false);
                setEditingArticle(null);
                setNewArticle({ title: '', subheading: '', content: '', category: 'Market', author: 'M.I.C. Team', cover_image: '' });
            }
        } catch (error) {
            console.error("Error saving article:", error);
        }
    };

    const handleDeleteArticle = async (id) => {
        if (!window.confirm("Are you sure you want to delete this article?")) return;
        try {
            await fetch(`http://localhost:8001/api/articles/${id}`, { method: 'DELETE' });
            fetchData();
        } catch (error) {
            console.error("Error deleting article:", error);
        }
    };

    // --- User Management ---
    // (Currently just viewing, could add edit subscription logic if needed)

    // --- Mod Management ---

    const handleAddMod = async (e) => {
        e.preventDefault();
        if (!newModEmail) return;

        try {
            await fetch('http://localhost:8001/api/mods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newModEmail,
                    action: 'add',
                    requester_email: currentUser.email
                })
            });
            setNewModEmail('');
            fetchData();
        } catch (error) {
            console.error("Error adding mod:", error);
        }
    };

    const handleRemoveMod = async (email) => {
        if (!window.confirm(`Remove ${email} as moderator?`)) return;
        try {
            await fetch('http://localhost:8001/api/mods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    action: 'remove',
                    requester_email: currentUser.email
                })
            });
            fetchData();
        } catch (error) {
            console.error("Error removing mod:", error);
        }
    };

    if (loading) return <div className="min-h-screen bg-deep-black flex items-center justify-center text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-deep-black text-white pt-24 px-4 pb-20">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Shield className="text-gold" /> Admin Dashboard
                    </h1>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('articles')}
                            className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'articles' ? 'bg-gold text-black font-bold' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                            Articles
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-gold text-black font-bold' : 'bg-white/5 hover:bg-white/10'}`}
                        >
                            Users
                        </button>
                        {isSuperAdmin && (
                            <button
                                onClick={() => setActiveTab('mods')}
                                className={`px-4 py-2 rounded-lg transition-colors ${activeTab === 'mods' ? 'bg-gold text-black font-bold' : 'bg-white/5 hover:bg-white/10'}`}
                            >
                                Moderators
                            </button>
                        )}
                    </div>
                </div>

                {/* Articles Tab */}
                {activeTab === 'articles' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Manage Articles</h2>
                            <button
                                onClick={() => { setEditingArticle(null); setShowArticleForm(true); }}
                                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg transition-colors"
                            >
                                <Plus size={18} /> New Article
                            </button>
                        </div>

                        {showArticleForm && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                                <h3 className="text-lg font-bold mb-4">{editingArticle ? 'Edit Article' : 'Create New Article'}</h3>
                                <form onSubmit={handleArticleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Title</label>
                                        <input
                                            type="text"
                                            value={editingArticle ? editingArticle.title : newArticle.title}
                                            onChange={(e) => editingArticle ? setEditingArticle({ ...editingArticle, title: e.target.value }) : setNewArticle({ ...newArticle, title: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:border-gold outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Subheading</label>
                                        <input
                                            type="text"
                                            value={editingArticle ? editingArticle.subheading : newArticle.subheading}
                                            onChange={(e) => editingArticle ? setEditingArticle({ ...editingArticle, subheading: e.target.value }) : setNewArticle({ ...newArticle, subheading: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:border-gold outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Content (HTML supported)</label>
                                        <textarea
                                            value={editingArticle ? editingArticle.content : newArticle.content}
                                            onChange={(e) => editingArticle ? setEditingArticle({ ...editingArticle, content: e.target.value }) : setNewArticle({ ...newArticle, content: e.target.value })}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:border-gold outline-none min-h-[200px]"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Category</label>
                                            <input
                                                type="text"
                                                value={editingArticle ? editingArticle.category : newArticle.category}
                                                onChange={(e) => editingArticle ? setEditingArticle({ ...editingArticle, category: e.target.value }) : setNewArticle({ ...newArticle, category: e.target.value })}
                                                className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:border-gold outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Cover Image URL</label>
                                            <input
                                                type="text"
                                                value={editingArticle ? editingArticle.cover_image : newArticle.cover_image}
                                                onChange={(e) => editingArticle ? setEditingArticle({ ...editingArticle, cover_image: e.target.value }) : setNewArticle({ ...newArticle, cover_image: e.target.value })}
                                                className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-white focus:border-gold outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowArticleForm(false)}
                                            className="px-4 py-2 text-gray-400 hover:text-white"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="bg-gold text-black font-bold px-6 py-2 rounded hover:bg-yellow-500"
                                        >
                                            Save Article
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div className="grid gap-4">
                            {articles.map(article => (
                                <div key={article.id} className="bg-white/5 border border-white/10 p-4 rounded-lg flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-lg">{article.title}</h3>
                                        <p className="text-sm text-gray-400">{article.date} • {article.author}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setEditingArticle(article); setShowArticleForm(true); }}
                                            className="p-2 text-blue-400 hover:bg-blue-500/10 rounded"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteArticle(article.id)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div>
                        <h2 className="text-xl font-bold mb-6">User Management</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400">
                                        <th className="p-4">Email</th>
                                        <th className="p-4">Plan</th>
                                        <th className="p-4">Risk Tolerance</th>
                                        <th className="p-4">Trading Frequency</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user, i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="p-4">{user.email}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${user.subscription_plan === 'Institutional' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                    {user.subscription_plan || 'Free'}
                                                </span>
                                            </td>
                                            <td className="p-4">{user.risk_tolerance || '-'}</td>
                                            <td className="p-4">{user.trading_frequency || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Mods Tab */}
                {activeTab === 'mods' && isSuperAdmin && (
                    <div>
                        <h2 className="text-xl font-bold mb-6">Moderator Management</h2>

                        <form onSubmit={handleAddMod} className="flex gap-4 mb-8">
                            <input
                                type="email"
                                value={newModEmail}
                                onChange={(e) => setNewModEmail(e.target.value)}
                                placeholder="Enter email to add as moderator"
                                className="flex-1 bg-black/50 border border-white/10 rounded px-4 py-2 text-white focus:border-gold outline-none"
                                required
                            />
                            <button type="submit" className="bg-gold text-black font-bold px-6 py-2 rounded hover:bg-yellow-500">
                                Add Moderator
                            </button>
                        </form>

                        <div className="space-y-2">
                            {mods.map((mod, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-lg flex justify-between items-center">
                                    <span className="font-mono">{mod}</span>
                                    {mod !== 'marketinsightscenter@gmail.com' && (
                                        <button
                                            onClick={() => handleRemoveMod(mod)}
                                            className="text-red-400 hover:text-red-300 text-sm font-bold"
                                        >
                                            Remove
                                        </button>
                                    )}
                                    {mod === 'marketinsightscenter@gmail.com' && (
                                        <span className="text-gold text-xs font-bold uppercase tracking-wider">Super Admin</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
