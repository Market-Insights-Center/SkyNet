import React, { useState, useEffect } from 'react';
import { Shield, Users, AlertTriangle, CheckCircle, XCircle, Trash2, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const { currentUser, isMod } = useAuth();
    const navigate = useNavigate();
    const [mods, setMods] = useState([]);
    const [articles, setArticles] = useState([]);
    const [users, setUsers] = useState([]);
    const [newModEmail, setNewModEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [activeTab, setActiveTab] = useState('mods'); // 'mods', 'articles', 'users'

    useEffect(() => {
        if (!isMod) {
            navigate('/');
            return;
        }
        fetchData();
    }, [isMod, navigate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Mods
            const modsRes = await fetch('http://localhost:8000/api/mods');
            const modsData = await modsRes.json();
            setMods(modsData.mods || []);

            // Fetch Articles
            const articlesRes = await fetch('http://localhost:8000/api/articles');
            const articlesData = await articlesRes.json();
            setArticles(articlesData || []);

            // Fetch Users
            const usersRes = await fetch('http://localhost:8000/api/users');
            const usersData = await usersRes.json();
            setUsers(usersData || []);

        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMod = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:8000/api/mods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: newModEmail,
                    action: 'add',
                    requester_email: currentUser.email
                })
            });
            const data = await response.json();
            setMessage({ type: data.status === 'success' ? 'success' : 'error', text: data.message });
            if (data.status === 'success') {
                setNewModEmail('');
                fetchData();
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to add moderator' });
        }
    };

    const handleRemoveMod = async (email) => {
        if (!window.confirm(`Remove ${email} from moderators?`)) return;
        try {
            const response = await fetch('http://localhost:8000/api/mods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    action: 'remove',
                    requester_email: currentUser.email
                })
            });
            const data = await response.json();
            setMessage({ type: data.status === 'success' ? 'success' : 'error', text: data.message });
            if (data.status === 'success') fetchData();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to remove moderator' });
        }
    };

    const handleDeleteArticle = async (articleId) => {
        if (!window.confirm('Are you sure you want to delete this article? This cannot be undone.')) return;
        try {
            const response = await fetch(`http://localhost:8000/api/articles/${articleId}?requester_email=${currentUser.email}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.status === 'success') {
                setMessage({ type: 'success', text: 'Article deleted successfully' });
                fetchData();
            } else {
                setMessage({ type: 'error', text: data.detail || 'Failed to delete article' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error deleting article' });
        }
    };

    const handleUpdateUser = async (email, field, value) => {
        try {
            // Find current user data to merge
            const user = users.find(u => u.email === email) || { email, subscription_plan: 'Free', subscription_cost: 0 };
            const updatedUser = { ...user, [field]: value };

            const response = await fetch('http://localhost:8000/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedUser)
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'User updated successfully' });
                fetchData();
            } else {
                setMessage({ type: 'error', text: 'Failed to update user' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error updating user' });
        }
    };

    if (loading) return <div className="min-h-screen pt-24 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div></div>;

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Shield className="text-gold" size={40} />
                    <div>
                        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                        <p className="text-gray-400">Manage community and content</p>
                    </div>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                        {message.text}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-4 mb-8 border-b border-white/10 pb-1">
                    <button
                        onClick={() => setActiveTab('mods')}
                        className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === 'mods' ? 'text-gold' : 'text-gray-400 hover:text-white'}`}
                    >
                        Moderators
                        {activeTab === 'mods' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === 'users' ? 'text-gold' : 'text-gray-400 hover:text-white'}`}
                    >
                        Users
                        {activeTab === 'users' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('articles')}
                        className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === 'articles' ? 'text-gold' : 'text-gray-400 hover:text-white'}`}
                    >
                        Articles
                        {activeTab === 'articles' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
                    </button>
                </div>

                {activeTab === 'mods' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Add Mod */}
                        <div className="bg-[#111] rounded-2xl border border-white/10 p-6">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Users size={20} className="text-gold" /> Add Moderator
                            </h2>
                            <form onSubmit={handleAddMod} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">User Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={newModEmail}
                                        onChange={(e) => setNewModEmail(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-gold focus:ring-1 focus:ring-gold outline-none"
                                        placeholder="user@example.com"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-gold text-black font-bold py-2 rounded-lg hover:bg-yellow-400 transition-colors"
                                >
                                    Grant Access
                                </button>
                            </form>
                        </div>

                        {/* Mod List */}
                        <div className="bg-[#111] rounded-2xl border border-white/10 p-6">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Shield size={20} className="text-gold" /> Active Moderators
                            </h2>
                            <div className="space-y-3">
                                {mods.map((email) => (
                                    <div key={email} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                        <span className="text-gray-300">{email}</span>
                                        {email !== "marketinsightscenter@gmail.com" && (
                                            <button
                                                onClick={() => handleRemoveMod(email)}
                                                className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors"
                                                title="Remove Access"
                                            >
                                                <XCircle size={18} />
                                            </button>
                                        )}
                                        {email === "marketinsightscenter@gmail.com" && (
                                            <span className="text-xs text-gold bg-gold/10 px-2 py-1 rounded border border-gold/20">Super Admin</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'articles' && (
                    <div className="bg-[#111] rounded-2xl border border-white/10 p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <FileText size={20} className="text-gold" /> Manage Articles
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 text-sm">
                                        <th className="py-3 px-4">Title</th>
                                        <th className="py-3 px-4">Author</th>
                                        <th className="py-3 px-4">Date</th>
                                        <th className="py-3 px-4">Category</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {articles.map((article) => (
                                        <tr key={article.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-4 text-white font-medium">{article.title}</td>
                                            <td className="py-3 px-4 text-gray-300">{article.author}</td>
                                            <td className="py-3 px-4 text-gray-400 text-sm">{new Date(article.date).toLocaleDateString()}</td>
                                            <td className="py-3 px-4 text-gray-300">
                                                <span className="bg-white/10 px-2 py-1 rounded text-xs">{article.category}</span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteArticle(article.id)}
                                                    className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Delete Article"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {articles.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-gray-500">No articles found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="bg-[#111] rounded-2xl border border-white/10 p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Users size={20} className="text-gold" /> Manage Users
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 text-sm">
                                        <th className="py-3 px-4">Email</th>
                                        <th className="py-3 px-4">Subscription Plan</th>
                                        <th className="py-3 px-4">Cost ($)</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user, index) => (
                                        <tr key={user.email || index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-4 text-white font-medium">{user.email}</td>
                                            <td className="py-3 px-4">
                                                <select
                                                    value={user.subscription_plan || 'Free'}
                                                    onChange={(e) => handleUpdateUser(user.email, 'subscription_plan', e.target.value)}
                                                    className="bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-gold outline-none"
                                                >
                                                    <option value="Free">Free</option>
                                                    <option value="Pro">Pro</option>
                                                    <option value="Enterprise">Enterprise</option>
                                                </select>
                                            </td>
                                            <td className="py-3 px-4">
                                                <input
                                                    type="number"
                                                    value={user.subscription_cost || 0}
                                                    onChange={(e) => handleUpdateUser(user.email, 'subscription_cost', parseFloat(e.target.value))}
                                                    className="bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-gold outline-none w-24"
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-right text-gray-500 text-xs">
                                                Auto-saves
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="py-8 text-center text-gray-500">No users found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
