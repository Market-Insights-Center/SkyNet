import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Plus, Search, User, Shield, MessageSquare, MoreVertical, X, Trash2, Check, Users, Briefcase, Paperclip, Bot, ArrowLeft } from 'lucide-react';

const Chatbox = () => {
    const { currentUser } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [modalStep, setModalStep] = useState('initial');

    // Multi-user selection
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [searchUserQuery, setSearchUserQuery] = useState('');

    const [isMod, setIsMod] = useState(false);
    const [adminViewAll, setAdminViewAll] = useState(false);

    const messagesEndRef = useRef(null);

    // Fetch initial data
    useEffect(() => {
        if (!currentUser) return;

        fetch('/api/mods')
            .then(res => res.json())
            .then(data => {
                if (data.mods && data.mods.includes(currentUser.email)) setIsMod(true);
            })
            .catch(err => console.log("Mod check skipped"));

        // Fetch users immediately to build username map
        fetchUsers();
        fetchConversations();

        const interval = setInterval(fetchConversations, 2000);
        return () => clearInterval(interval);
    }, [currentUser, adminViewAll]);

    // Poll for messages ONLY if a chat is selected
    useEffect(() => {
        if (!selectedChat) return;

        // Clear messages immediately when switching chats to prevent ghosting
        setMessages([]); 

        fetchChatMessages(selectedChat.id);
        const interval = setInterval(() => fetchChatMessages(selectedChat.id), 2000);
        return () => clearInterval(interval);
    }, [selectedChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- HELPER: Date Formatting ---
    const formatDisplayDate = (dateString, type = 'sidebar') => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = diffMs / (1000 * 60 * 60);

        const timeOpts = { hour: '2-digit', minute: '2-digit' };
        const dateOpts = { month: 'numeric', day: 'numeric', year: '2-digit' };

        if (type === 'sidebar') {
            // Sidebar: Show date if > 24h, else Time
            if (diffHours > 24) {
                return date.toLocaleDateString([], dateOpts);
            }
            return date.toLocaleTimeString([], timeOpts);
        }

        if (type === 'message') {
            // Message: If > 24h, show "Date Time", else just "Time"
            if (diffHours > 24) {
                return `${date.toLocaleDateString([], dateOpts)} ${date.toLocaleTimeString([], timeOpts)}`;
            }
            return date.toLocaleTimeString([], timeOpts);
        }
        return '';
    };

    const fetchConversations = async () => {
        try {
            const url = adminViewAll
                ? `/api/chat/list?email=${currentUser.email}&all_chats=true`
                : `/api/chat/list?email=${currentUser.email}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setConversations(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(data)) return data;
                    return prev;
                });
            }
            setIsLoading(false);
        } catch (err) {
            console.error("Error fetching chats:", err);
            setIsLoading(false);
        }
    };

    const fetchChatMessages = async (chatId) => {
        try {
            const res = await fetch(`/api/chat/${chatId}/messages?email=${currentUser.email}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error("Error fetching messages:", err);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        try {
            const res = await fetch(`/api/chat/${selectedChat.id}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: currentUser.email,
                    text: newMessage
                })
            });

            if (res.ok) {
                setNewMessage('');
                fetchChatMessages(selectedChat.id);
            }
        } catch (err) {
            console.error("Error sending message:", err);
        }
    };

    const deleteConversation = async (e, chatId) => {
        e.stopPropagation();

        if (!window.confirm("Are you sure you want to delete this conversation?")) return;

        try {
            const res = await fetch('/api/chat/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    email: currentUser.email
                })
            });

            if (res.ok) {
                setConversations(prev => prev.filter(c => c.id !== chatId));
                if (selectedChat?.id === chatId) {
                    setSelectedChat(null);
                    setMessages([]);
                }
                fetchConversations();
            }
        } catch (err) {
            console.error("Error deleting chat:", err);
        }
    };

    const startAdminChat = async () => {
        const payload = {
            type: 'admin_support',
            participants: [currentUser.email],
            creator_email: currentUser.email,
            initial_message: "Started a new support ticket."
        };
        createChat(payload);
    };

    const startCustomPortfolioChat = async () => {
        // 1. Fetch User Profile Data for Questionnaire Responses
        let profileText = "Could not retrieve profile data.";
        try {
            const res = await fetch(`/api/user/profile?email=${currentUser.email}`);
            if (res.ok) {
                const profile = await res.json();
                profileText = `
**User Questionnaire Responses:**
- **Risk Tolerance:** ${profile.risk_tolerance || 'N/A'}
- **Trading Frequency:** ${profile.trading_frequency || 'N/A'}
- **Portfolio Types:** ${(profile.portfolio_types || []).join(', ') || 'N/A'}

Please review these details. If you want to change anything, please let us know. 
If everything looks correct, please reply with "Confirm" to proceed with the custom portfolio build.
`;
            }
        } catch (e) {
            console.error("Failed to fetch profile for custom chat", e);
        }

        const payload = {
            type: 'custom_portfolio',
            participants: [currentUser.email, 'marketinsightscenter@gmail.com'],
            creator_email: 'marketinsightscenter@gmail.com', // Sent "from" admin
            initial_message: `Hello ${currentUser.displayName || 'User'}, \n\nYou have requested a Custom Portfolio Build. Here are the details we have on file:\n${profileText}`
        };
        createChat(payload);
    };

    const createChat = async (payload) => {
        try {
            const res = await fetch('/api/chat/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const chat = await res.json();
                if (chat && (chat.id || chat._id)) {
                    if (!chat.id) chat.id = chat._id;
                    setSelectedChat(chat);
                    setShowNewChatModal(false);
                    fetchConversations();
                }
            } else {
                alert("Failed to create chat.");
            }
        } catch (err) {
            console.error("Error creating chat:", err);
            alert("Network error.");
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                // Filter out self
                setAllUsers(data.filter(u => u.email !== currentUser.email));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const toggleUserSelection = (email) => {
        if (selectedUsers.includes(email)) {
            setSelectedUsers(selectedUsers.filter(e => e !== email));
        } else {
            setSelectedUsers([...selectedUsers, email]);
        }
    };

    const startDirectChat = async () => {
        if (selectedUsers.length === 0) return;
        const allParticipants = [...new Set([...selectedUsers, currentUser.email])];
        const payload = {
            type: 'direct',
            participants: allParticipants,
            creator_email: currentUser.email
        };
        createChat(payload);
    };

    const openNewChatModal = () => {
        setShowNewChatModal(true);
        setSelectedUsers([]);
        fetchUsers();
    };

    // Helper to get username from email using allUsers map
    const getUsername = (email) => {
        const user = allUsers.find(u => u.email === email);
        return user ? user.username : email.split('@')[0];
    };

    const getChatName = (chat) => {
        if (!chat) return "Unknown";
        if (chat.type === 'admin_support') return "Admin Support Team";
        if (chat.type === 'custom_portfolio') return "Custom Portfolio Request";

        const participants = chat.participants || [];
        const otherParticipants = participants.filter(p => p !== currentUser.email);

        if (otherParticipants.length === 0) return "Me (Draft)";
        
        // Map emails to usernames
        const names = otherParticipants.map(email => getUsername(email));

        if (names.length === 1) return names[0];
        if (names.length === 2) return `${names[0]}, ${names[1]}`;
        return `${names[0]} +${names.length - 1} others`;
    };

    // Group conversations by type
    const groupedConversations = {
        'Custom Portfolio': conversations.filter(c => c.type === 'custom_portfolio'),
        'Support': conversations.filter(c => c.type === 'admin_support'),
        'Direct Messages': conversations.filter(c => c.type !== 'custom_portfolio' && c.type !== 'admin_support')
    };

    return (
        <div className="fixed inset-0 pt-24 bg-deep-black flex overflow-hidden">
            {/* Sidebar */}
            <div className={`
                flex-col bg-[#0a0a0a] h-full border-r border-white/10
                w-full md:w-80
                ${selectedChat ? 'hidden md:flex' : 'flex'}
            `}>
                <div className="p-4 border-b border-white/10 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-gold">Chatbox</h2>
                    <button
                        onClick={openNewChatModal}
                        className="p-2 bg-gold/10 hover:bg-gold/20 rounded-full text-gold transition-colors"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                {/* Admin Toggle */}
                {isMod && (
                    <div className="flex border-b border-white/10 shrink-0">
                        <button
                            onClick={() => setAdminViewAll(false)}
                            className={`flex-1 py-3 text-xs font-medium transition-colors ${!adminViewAll ? 'bg-white/10 text-gold' : 'text-gray-500 hover:text-white'}`}
                        >
                            My Chats
                        </button>
                        <button
                            onClick={() => setAdminViewAll(true)}
                            className={`flex-1 py-3 text-xs font-medium transition-colors ${adminViewAll ? 'bg-white/10 text-gold' : 'text-gray-500 hover:text-white'}`}
                        >
                            Monitor All
                        </button>
                    </div>
                )}

                {/* SCROLL */}
                <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                    {conversations.length === 0 ? (
                        <div className="p-4 text-gray-500 text-center text-sm">No conversations found.</div>
                    ) : (
                        Object.entries(groupedConversations).map(([groupName, chats]) => (
                            chats.length > 0 && (
                                <div key={groupName}>
                                    <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider bg-white/5">
                                        {groupName}
                                    </div>
                                    {chats.map(chat => (
                                        <div
                                            key={chat.id}
                                            onClick={() => setSelectedChat(chat)}
                                            className={`group relative p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${selectedChat?.id === chat.id ? 'bg-white/10' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${chat.type === 'admin_support' ? 'bg-gold/20 text-gold' : chat.type === 'custom_portfolio' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                                    {chat.type === 'admin_support' ? <Shield size={18} /> :
                                                        chat.type === 'custom_portfolio' ? <Briefcase size={18} /> :
                                                            (chat.participants || []).length > 2 ? <Users size={18} /> : <User size={18} />}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-8">
                                                    <div className="font-medium text-gray-200 truncate">{getChatName(chat)}</div>
                                                    <div className="text-xs text-gray-500 truncate">
                                                        {chat.last_message_preview || 'No messages'}
                                                    </div>
                                                </div>
                                                {chat.last_updated && (
                                                    <div className="text-[10px] text-gray-600 absolute right-2 top-2">
                                                        {formatDisplayDate(chat.last_updated, 'sidebar')}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => deleteConversation(e, chat.id)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-red-500 hover:bg-white/10 rounded-full transition-all z-20"
                                                title="Delete Conversation"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`
                flex-1 flex-col bg-[#050505] h-full min-w-0
                ${selectedChat ? 'flex' : 'hidden md:flex'}
            `}>
                {selectedChat ? (
                    <>
                        <div className="h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-6 bg-[#0a0a0a] shrink-0">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setSelectedChat(null)}
                                    className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white"
                                >
                                    <ArrowLeft size={20} />
                                </button>

                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedChat.type === 'admin_support' ? 'bg-gold/20 text-gold' : selectedChat.type === 'custom_portfolio' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                    {selectedChat.type === 'admin_support' ? <Shield size={16} /> : selectedChat.type === 'custom_portfolio' ? <Briefcase size={16} /> : <User size={16} />}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-200">{getChatName(selectedChat)}</div>
                                    <div className="text-xs text-gray-500">
                                        {(selectedChat.participants || []).map(email => getUsername(email)).join(', ')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SCROLL */}
                        <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 space-y-4 custom-scrollbar">
                            {messages.map((msg, idx) => {
                                const isMe = msg.sender === currentUser.email;
                                return (
                                    <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? 'bg-gold text-black rounded-tr-none' : 'bg-white/10 text-gray-200 rounded-tl-none'}`}>
                                            {!isMe && <div className="text-[10px] text-gray-400 mb-1">{getUsername(msg.sender)}</div>}
                                            <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
                                            <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-black/60' : 'text-gray-500'}`}>
                                                {formatDisplayDate(msg.timestamp, 'message')}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-[#0a0a0a] shrink-0">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-gold transition-colors"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="p-2.5 bg-gold text-black rounded-full hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <MessageSquare size={48} className="mb-4 opacity-20" />
                        <p>Select a conversation or start a new one</p>
                    </div>
                )}
            </div>

            {/* New Chat Modal */}
            <AnimatePresence>
                {showNewChatModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#1a1a1a] border border-white/10 overflow-hidden shadow-2xl flex flex-col w-full h-full rounded-none md:w-full md:max-w-md md:h-[500px] md:rounded-2xl"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
                                <h3 className="text-xl font-bold text-white">New Conversation</h3>
                                <button onClick={() => setShowNewChatModal(false)} className="text-gray-400 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 flex-1 overflow-y-auto">
                                {modalStep === 'initial' ? (
                                    <div className="space-y-4">
                                        <button onClick={startAdminChat} className="w-full p-4 bg-gradient-to-r from-gold/10 to-transparent border border-gold/30 rounded-xl flex items-center gap-4 hover:border-gold transition-all group">
                                            <div className="p-3 bg-gold/20 rounded-full text-gold group-hover:bg-gold group-hover:text-black transition-colors"><Shield size={24} /></div>
                                            <div className="text-left"><div className="font-bold text-gold">Talk with Admin Team</div><div className="text-sm text-gray-400">Start a support ticket with moderators</div></div>
                                        </button>
                                        <button onClick={startCustomPortfolioChat} className="w-full p-4 bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/30 rounded-xl flex items-center gap-4 hover:border-blue-500 transition-all group">
                                            <div className="p-3 bg-blue-500/20 rounded-full text-blue-400 group-hover:bg-blue-500 group-hover:text-black transition-colors"><Briefcase size={24} /></div>
                                            <div className="text-left"><div className="font-bold text-blue-400">Request Custom Portfolio</div><div className="text-sm text-gray-400">Build a strategy tailored to you</div></div>
                                        </button>
                                        <button onClick={() => setModalStep('users')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-4 hover:bg-white/10 transition-all group">
                                            <div className="p-3 bg-white/10 rounded-full text-gray-300 group-hover:bg-white group-hover:text-black transition-colors"><Users size={24} /></div>
                                            <div className="text-left"><div className="font-bold text-white">Talk with Other Users</div><div className="text-sm text-gray-400">Select one or more users to message</div></div>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col">
                                        <div className="relative mb-4">
                                            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                                            <input type="text" placeholder="Search users by name..." value={searchUserQuery} onChange={(e) => setSearchUserQuery(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-gold" autoFocus />
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                                            {allUsers.filter(u => (u.username || '').toLowerCase().includes(searchUserQuery.toLowerCase())).map(user => {
                                                const isSelected = selectedUsers.includes(user.email);
                                                return (
                                                    <button key={user.email} onClick={() => toggleUserSelection(user.email)} className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors text-left border ${isSelected ? 'bg-gold/10 border-gold/50' : 'hover:bg-white/10 border-transparent'}`}>
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-gold border-gold' : 'border-gray-500'}`}>{isSelected && <Check size={14} className="text-black" />}</div>
                                                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0"><span className="text-xs font-bold">{user.username[0].toUpperCase()}</span></div>
                                                        <div className="min-w-0"><div className="font-bold text-gray-200 truncate text-sm">{user.username}</div></div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center gap-2 mt-auto">
                                            <button onClick={() => setModalStep('initial')} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors">Back</button>
                                            <button onClick={startDirectChat} disabled={selectedUsers.length === 0} className="flex-1 py-3 bg-gold hover:bg-yellow-500 text-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Start Chat ({selectedUsers.length})</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Chatbox;