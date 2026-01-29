import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { AlertCircle, CheckCircle, LogOut, User, Lock, ArrowLeft, Loader2, Shield, ArrowRight, Edit3, AlertTriangle, Trophy, Eye, EyeOff } from "lucide-react";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { WaveBackground } from "../components/WaveBackground.jsx";
import { motion, AnimatePresence } from "framer-motion";

export default function Profile() {
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const { currentUser, logout, updateUsername, updateUserPassword, deleteAccount, overrideUserTier } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [isMod, setIsMod] = useState(false);

    const usernameRef = useRef();
    const passwordRef = useRef();
    const passwordConfirmRef = useRef();

    // Questionnaire State
    const [riskTolerance, setRiskTolerance] = useState(5);
    const [tradingFrequency, setTradingFrequency] = useState("");
    const [portfolioTypes, setPortfolioTypes] = useState([]);
    const [otherFrequency, setOtherFrequency] = useState("");
    const [otherPortfolioType, setOtherPortfolioType] = useState("");
    const [qLoading, setQLoading] = useState(false);
    const [qError, setQError] = useState("");

    // Points & Referral State
    const [points, setPoints] = useState(0);
    const [pendingPoints, setPendingPoints] = useState(0);
    const [rank, setRank] = useState(0);
    const [referralCode, setReferralCode] = useState("");
    const [accountAge, setAccountAge] = useState("");
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);

    // Integrations & Header Widgets
    const [rhUsername, setRhUsername] = useState("");
    const [rhPassword, setRhPassword] = useState("");
    const [saveRh, setSaveRh] = useState(false);
    const [headerWidgets, setHeaderWidgets] = useState(['market_status']);
    const [showRhPass, setShowRhPass] = useState(false);

    const WIDGET_OPTIONS = [
        { id: 'market_status', label: 'Market Status' },
        { id: 'spy_day', label: 'SPY Return (Day)' },
        { id: 'spy_week', label: 'SPY Return (Week)' },
        { id: 'spy_month', label: 'SPY Return (Month)' },
        { id: 'spy_year', label: 'SPY Return (Year)' },
        { id: 'rh_value', label: 'RH Portfolio Value', requiresAuth: true },
        { id: 'rh_day', label: 'RH Return (Day)', requiresAuth: true }
    ];

    // Check for existing profile data on mount
    useEffect(() => {
        async function checkProfile() {
            if (currentUser) {
                // Check Mod Status
                fetch('/api/mods')
                    .then(res => res.json())
                    .then(data => {
                        if (data.mods.includes(currentUser.email)) {
                            setIsMod(true);
                        }
                    })
                    .catch(err => console.error("Error checking mods:", err));

                try {
                    const docRef = doc(db, "users", currentUser.email);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();

                        // Points & Referral Data
                        if (data.points) setPoints(data.points);
                        if (data.pending_transactions) {
                            const totalPending = data.pending_transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
                            setPendingPoints(totalPending);
                        }
                        if (data.points) setPoints(data.points);
                        if (data.pending_transactions) {
                            const totalPending = data.pending_transactions.reduce((sum, txn) => sum + (txn.amount || 0), 0);
                            setPendingPoints(totalPending);
                        }
                        if (data.referral_code) setReferralCode(data.referral_code);
                        if (data.settings?.show_leaderboard !== false) setShowLeaderboard(true); // Default to True

                        // Load Header Widgets
                        if (data.settings?.header_widgets) setHeaderWidgets(data.settings.header_widgets);

                        // Load Integrations
                        if (data.integrations?.robinhood) {
                            setSaveRh(data.integrations.robinhood.connected || false);
                            if (data.integrations.robinhood.username) setRhUsername(data.integrations.robinhood.username);
                            // NOTE: Password usually wouldn't be sent back to client in plain text in real app, but for prototype logic:
                            if (data.integrations.robinhood.encrypted_pass) setRhPassword(data.integrations.robinhood.encrypted_pass);
                        }

                        // Calculate Account Age
                        const created = data.created_at?.toDate ? data.created_at.toDate() : new Date(data.created_at || currentUser.metadata.creationTime);

                        // SELF-HEAL: If Firestore missing created_at, update it permenantly
                        if (!data.created_at && currentUser.metadata.creationTime) {
                            setDoc(docRef, { created_at: new Date(currentUser.metadata.creationTime) }, { merge: true })
                                .catch(e => console.error("Auto-healing created_at failed:", e));
                        }

                        if (created) {
                            const diff = Date.now() - created.getTime();
                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                            setAccountAge(`${days} days`);
                        }

                        // Fetch real-time points/rank
                        fetch('/api/points/user', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: currentUser.email })
                        })
                            .then(res => {
                                if (!res.ok) throw new Error("API Error");
                                return res.json();
                            })
                            .then(d => {
                                setPoints(d.points || 0);
                                setRank(d.rank || 0);
                                setPendingPoints(d.pending_points || 0);
                            }).catch(e => {
                                console.error("Points API Error:", e);
                                setPoints(data.points || 0); // Fallback to Firestore
                            });


                        // Populate state for the update modal
                        if (data.risk_tolerance) setRiskTolerance(data.risk_tolerance);

                        if (data.trading_frequency) {
                            const standardFreqs = ["Once A Quarter Or Less Often", "Once A Month", "Once A Week", "Every Other Day", "Every Day Or More Often"];
                            if (standardFreqs.includes(data.trading_frequency)) {
                                setTradingFrequency(data.trading_frequency);
                            } else {
                                setTradingFrequency("Other");
                                setOtherFrequency(data.trading_frequency);
                            }
                        }

                        if (data.portfolio_types && Array.isArray(data.portfolio_types)) {
                            // Filter out "Other" values to put in input, but standard logic here handles it mostly via check
                            setPortfolioTypes(data.portfolio_types);
                        }

                        // If critical data is missing, show questionnaire automatically
                        if (!data.risk_tolerance || !data.trading_frequency) {
                            setShowQuestionnaire(true);
                        }
                    } else {
                        // No doc exists at all
                        setShowQuestionnaire(true);
                    }
                } catch (e) {
                    console.error("Error checking profile:", e);
                }
            }
        }
        checkProfile();
    }, [currentUser]);



    async function handleLogout() {
        setError("");
        try {
            await logout();
            navigate("/login");
        } catch {
            setError("Failed to log out");
        }
    }

    async function handleUpdateProfile(e) {
        e.preventDefault();
        const promises = [];
        setLoading(true);
        setError("");
        setMessage("");

        if (usernameRef.current.value !== currentUser.displayName) {
            promises.push(updateUsername(usernameRef.current.value));
        }
        if (passwordRef.current.value) {
            if (passwordRef.current.value !== passwordConfirmRef.current.value) {
                setError("Passwords do not match");
                setLoading(false);
                return;
            }
            promises.push(updateUserPassword(passwordRef.current.value));
        }

        Promise.all(promises)
            .then(() => {
                setMessage("Profile updated successfully");
            })
            .catch((err) => {
                setError("Failed to update account: " + err.message);
            })
            .finally(() => {
                setLoading(false);
            });
    }

    // Questionnaire Handlers
    const handlePortfolioTypeChange = (type) => {
        setPortfolioTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const saveProfileToBackend = async (uid, email, data) => {
        try {
            const body = {
                user_id: uid,
                email: email,
                risk_tolerance: parseInt(data.risk_tolerance),
                trading_frequency: data.trading_frequency,
                portfolio_types: data.portfolio_types
            };
            // Note: Ensure this endpoint exists in backend or remove this call if it's purely Firestore
            // Assuming this is a placeholder or you have a route for it. 
            // If not, we can rely on Firestore.
        } catch (e) {
            console.error("Failed to save profile to CSV backend", e);
        }
    };

    const handleGenerateReferral = async () => {
        setGeneratingCode(true);
        try {
            const res = await fetch('/api/referrals/generate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email })
            });
            const data = await res.json();
            if (data.code) setReferralCode(data.code);
        } catch (e) {
            console.error(e);
        } finally {
            setGeneratingCode(false);
        }
    };

    const toggleLeaderboard = async () => {
        const newVal = !showLeaderboard;
        setShowLeaderboard(newVal);
        await setDoc(doc(db, "users", currentUser.email), { settings: { show_leaderboard: newVal } }, { merge: true });
    };

    const handleQuestionnaireSubmit = async (e) => {
        e.preventDefault();
        setQLoading(true);
        setQError("");

        const profileData = {
            risk_tolerance: riskTolerance,
            trading_frequency: tradingFrequency === "Other" ? otherFrequency : tradingFrequency,
            portfolio_types: portfolioTypes.includes("Other") ? [...portfolioTypes.filter(t => t !== "Other"), otherPortfolioType] : portfolioTypes
        };

        if (!profileData.trading_frequency) {
            setQError("Please select a trading frequency.");
            setQLoading(false);
            return;
        }

        try {
            // 1. Save to Firestore
            await setDoc(doc(db, "users", currentUser.email), profileData, { merge: true });

            // 2. Save to Backend CSV (Optional/If implemented)
            // await saveProfileToBackend(currentUser.uid, currentUser.email, profileData);

            setShowQuestionnaire(false);
            setMessage("Questionnaire updated successfully!");
        } catch (err) {
            console.error(err);
            setQError("Failed to save profile: " + err.message);
        } finally {
            setQLoading(false);
        }
    };


    // --- INTEGRATIONS LOGIC ---
    const handleSaveIntegrations = async () => {
        setLoading(true);
        try {
            await setDoc(doc(db, "users", currentUser.email), {
                settings: {
                    header_widgets: headerWidgets
                },
                integrations: {
                    robinhood: {
                        connected: saveRh,
                        username: saveRh ? rhUsername : "",
                        encrypted_pass: saveRh ? rhPassword : "" // In real world -> Hash/Encrypt this!
                    }
                }
            }, { merge: true });
            setMessage("Integration settings saved!");
        } catch (e) {
            console.error(e);
            setError("Failed to save settings: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleHeaderWidget = (id) => {
        setHeaderWidgets(prev => {
            if (prev.includes(id)) return prev.filter(w => w !== id);
            if (prev.length >= 6) return prev; // Limit max widgets
            return [...prev, id];
        });
    };

    return (
        <div className="relative min-h-screen bg-transparent text-white flex flex-col items-center pt-24 pb-10 overflow-hidden">

            <div className="relative z-10 w-full max-w-2xl p-8 bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">

                {/* Back Button */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate("/")}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Portfolio Lab
                    </button>
                </div>

                <div className="flex justify-between items-center mb-8">
                    {/* MODIFIED: Replaced gradient text with solid color for clarity */}
                    <h2 className="text-3xl font-bold text-gold">
                        Profile
                    </h2>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
                    >
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 flex items-center gap-2">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {message && (
                    <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded-lg mb-4 flex items-center gap-2">
                        <CheckCircle size={18} />
                        <span>{message}</span>
                    </div>
                )}

                <div className="mb-8 p-4 bg-black/30 rounded-lg border border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-2xl font-bold relative">
                            {currentUser?.displayName ? currentUser.displayName[0].toUpperCase() : currentUser?.email?.[0]?.toUpperCase() || "U"}
                            {/* Admin Badge on Avatar */}
                            {isMod && (
                                <div className="absolute -bottom-1 -right-1 bg-gold text-black text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/20 shadow-lg">
                                    Admin
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-semibold text-white">{currentUser?.displayName || "User"}</h3>
                                {isMod && (
                                    <span className="bg-gold/20 text-gold text-xs font-bold px-2 py-0.5 rounded border border-gold/30 tracking-wider flex items-center gap-1">
                                        <Shield size={12} className="fill-current" /> ADMINISTRATOR
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-400 text-sm">{currentUser?.email}</p>
                            <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 text-xs uppercase tracking-wider">Current Plan:</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${currentUser?.tier === 'Enterprise' ? 'bg-purple-900 text-purple-200' : currentUser?.tier === 'Pro' ? 'bg-gold/20 text-gold' : 'bg-gray-700 text-gray-300'}`}>
                                        {currentUser?.tier || 'Basic'}
                                    </span>
                                    {currentUser?.tier && currentUser.tier !== 'Basic' && (
                                        <a
                                            href="https://www.paypal.com/myaccount/autopay/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/20 transition-colors"
                                        >
                                            Manage Subscription
                                        </a>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowQuestionnaire(true)}
                                    className="text-xs text-gold hover:text-white flex items-center gap-1 hover:underline transition-colors"
                                >
                                    <Edit3 size={12} /> Update Questionnaire
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Admin Dashboard Link */}
                    {isMod && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <Link to="/admin" className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group">
                                <div className="flex items-center gap-3 text-gold">
                                    <Shield size={20} />
                                    <span className="font-bold">Access Admin Dashboard</span>
                                </div>
                                <ArrowRight size={18} className="text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                            </Link>
                        </div>
                    )}
                    {/* REWARDS & STATUS SECTION */}
                    <div className="mb-8 p-6 bg-black/30 rounded-lg border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-xl font-bold text-gold mb-4 flex items-center gap-2"><Shield size={20} /> Singularity Points</h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col items-center justify-center">
                                    <div className="text-3xl font-bold text-white">{points.toLocaleString()}</div>
                                    <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Total Points</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col items-center justify-center">
                                    <div className="text-3xl font-bold text-gold">#{rank}</div>
                                    <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Global Rank</div>
                                </div>
                            </div>

                            {/* PENDING POINTS BOX - Always show if > 0, or maybe even if 0 if requested prominently */}
                            {pendingPoints > 0 && (
                                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-purple-500/20 p-2 rounded-full text-purple-400">
                                            <Loader2 size={20} className="animate-spin-slow" />
                                        </div>
                                        <div>
                                            <div className="text-sm text-purple-200 font-bold">Pending Distribution</div>
                                            <div className="text-xs text-purple-400/80">Available in 24 Hours</div>
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-purple-300">
                                        {pendingPoints.toLocaleString()}
                                    </div>
                                </div>
                            )}

                            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-white mt-2">
                                <input type="checkbox" checked={showLeaderboard} onChange={toggleLeaderboard} className="accent-gold" />
                                Show me on public leaderboard
                            </label>
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-gold mb-4 flex items-center gap-2"><User size={20} /> Account Status</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Account Age</span>
                                    <span className="font-bold text-white">{accountAge || "New"}</span>
                                </div>

                                <div className="pt-2 border-t border-white/5">
                                    {/* TEMPORARILY HIDDEN
                                <div className="text-gray-400 text-sm mb-2">Referral Code</div>
                                {referralCode ? (
                                    <div className="flex gap-2">
                                        <div className="bg-black/50 px-3 py-2 rounded text-gold font-mono font-bold flex-1 text-center tracking-wider border border-white/10">
                                            {referralCode}
                                        </div>
                                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${referralCode}`); setMessage("Link copied!"); }} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded text-white font-bold transition-colors">
                                            Copy Link
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={handleGenerateReferral} disabled={generatingCode} className="w-full py-2 bg-gold/20 hover:bg-gold/30 text-gold rounded font-bold transition-colors border border-gold/20">
                                        {generatingCode ? "Generating..." : "Generate Referral Link"}
                                    </button>
                                )}
                                <p className="text-[10px] text-gray-500 mt-2">
                                    Refer a friend: If they subscribe to Pro, get 3 Months Pro Free. If Enterprise, get 3 Months Enterprise Free.
                                </p>
                                */}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* --- INTEGRATIONS & CUSTOMIZATION --- */}
                <div className="mb-8 p-6 bg-black/30 rounded-lg border border-white/5">
                    <h3 className="text-xl font-bold text-gold mb-6 flex items-center gap-2"><Lock size={20} /> Integrations & Customization</h3>

                    {/* Robinhood Connect */}
                    <div className="mb-8 pb-8 border-b border-white/5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="text-white font-bold flex items-center gap-2">
                                    Link Robinhood Account
                                    {saveRh && <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded border border-green-500/20">CONNECTED</span>}
                                </h4>
                                <p className="text-sm text-gray-400 mt-1">Connect your account to view live portfolio performance in the Floating Header.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={saveRh} onChange={(e) => setSaveRh(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>

                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300 ${!saveRh ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Username / Email</label>
                                <input
                                    type="text"
                                    value={rhUsername}
                                    onChange={(e) => setRhUsername(e.target.value)}
                                    placeholder="Enter Robinhood username"
                                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-green-500/50 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showRhPass ? "text" : "password"}
                                        value={rhPassword}
                                        onChange={(e) => setRhPassword(e.target.value)}
                                        placeholder="Enter password"
                                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-green-500/50 outline-none pr-10"
                                    />
                                    <button onClick={() => setShowRhPass(!showRhPass)} type="button" className="absolute right-3 top-2.5 text-gray-500 hover:text-white">
                                        {showRhPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Header Widgets */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h4 className="text-white font-bold">Floating Header Widgets</h4>
                                <p className="text-sm text-gray-400 mt-1">Select up to 6 metrics to display site-wide.</p>
                            </div>
                            <span className="text-xs text-gol border border-gold/20 bg-gold/5 px-2 py-1 rounded">{headerWidgets.length}/6 Selected</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {WIDGET_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => toggleHeaderWidget(opt.id)}
                                    disabled={!saveRh && opt.requiresAuth}
                                    className={`
                                        flex items-center gap-2 p-3 rounded-lg border text-sm transition-all
                                        ${!saveRh && opt.requiresAuth ? 'opacity-30 cursor-not-allowed border-white/5 bg-transparent' :
                                            headerWidgets.includes(opt.id)
                                                ? 'bg-purple-600/20 border-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.2)]'
                                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                        }
                                    `}
                                >
                                    {headerWidgets.includes(opt.id) && <CheckCircle size={14} className="text-purple-400" />}
                                    {opt.requiresAuth && <Lock size={12} className="text-gold" />}
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            onClick={handleSaveIntegrations}
                            disabled={loading}
                            className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-lg transition-all border border-white/20"
                        >
                            {loading ? "Saving..." : "Save Preferences"}
                        </button>
                    </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                            <User size={16} /> Display Name
                        </label>
                        <input
                            type="text"
                            ref={usernameRef}
                            defaultValue={currentUser?.displayName}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Enter display name"
                        />
                    </div>



                    <div className="pt-4 border-t border-white/10">
                        <h4 className="text-lg font-medium text-gray-200 mb-4">Change Password</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                                    <Lock size={16} /> New Password
                                </label>
                                <input
                                    type="password"
                                    ref={passwordRef}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="Leave blank to keep same"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                                    <Lock size={16} /> Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    ref={passwordConfirmRef}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="Leave blank to keep same"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Updating..." : "Update Profile"}
                        </button>
                    </div>
                </form>

                {/* DANGER ZONE */}
                <div className="mt-12 pt-8 border-t border-red-500/20">
                    <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2">
                        <AlertTriangle size={20} /> Danger Zone
                    </h3>
                    <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h4 className="text-white font-bold mb-1">Delete Account</h4>
                            <p className="text-sm text-gray-400">
                                Permanently delete your account and all of your content. This action cannot be undone.
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                if (window.confirm("Are you ABSOLUTELY SURE? This will permanently delete your account, portfolio data, and settings. This action cannot be undone.")) {
                                    setLoading(true);
                                    try {
                                        // 1. Delete Firestore Data
                                        await deleteDoc(doc(db, "users", currentUser.email));

                                        // 2. Delete Auth Account
                                        await deleteAccount();

                                        navigate("/login");
                                    } catch (err) {
                                        console.error(err);
                                        setError("Failed to delete account. You may need to log out and log back in to verify your identity before deleting.");
                                        setLoading(false);
                                    }
                                }
                            }}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>

                {/* QA CONTROLS REMOVED */}
            </div>

            {/* Questionnaire Modal - Mobile Optimized */}
            <AnimatePresence>
                {showQuestionnaire && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="bg-gray-900 border border-gold/30 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[90vh]"
                        >
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <h2 className="text-2xl font-bold text-gold">Investment Profile</h2>
                                <button
                                    onClick={() => setShowQuestionnaire(false)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                            </div>

                            <p className="text-gray-400 mb-4 text-sm shrink-0">
                                Customize your experience by updating your preferences.
                            </p>

                            {qError && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 text-sm shrink-0">
                                    {qError}
                                </div>
                            )}

                            <div className="overflow-y-auto pr-2 custom-scrollbar">
                                <form onSubmit={handleQuestionnaireSubmit} className="space-y-6">
                                    {/* Risk Tolerance */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Risk Tolerance (1 - 10)</label>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-gray-400">Low</span>
                                            <input
                                                type="range" min="1" max="10" value={riskTolerance}
                                                onChange={(e) => setRiskTolerance(e.target.value)}
                                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gold"
                                            />
                                            <span className="text-sm text-gray-400">High</span>
                                        </div>
                                        <div className="text-center text-gold font-bold mt-1">{riskTolerance}</div>
                                    </div>

                                    {/* Trading Frequency */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">How Often Do You Want To Trade</label>
                                        <div className="space-y-2">
                                            {["Once A Quarter Or Less Often", "Once A Month", "Once A Week", "Every Other Day", "Every Day Or More Often", "Other"].map((freq) => (
                                                <label key={freq} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5">
                                                    <input
                                                        type="radio" name="frequency" value={freq}
                                                        checked={tradingFrequency === freq}
                                                        onChange={(e) => setTradingFrequency(e.target.value)}
                                                        className="accent-gold"
                                                    />
                                                    <span className="text-gray-300 text-sm">{freq}</span>
                                                    {freq === "Other" && tradingFrequency === "Other" && (
                                                        <input
                                                            type="text" className="ml-2 bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-gold outline-none w-full max-w-[150px]"
                                                            placeholder="Specify" value={otherFrequency} onChange={(e) => setOtherFrequency(e.target.value)}
                                                        />
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Portfolio Types */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Investment Interests</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {[
                                                "Low Risk", "Medium Risk", "High Risk",
                                                "Stocks", "ETFs", "Options",
                                                "Crypto", "Indices", "Futures",
                                                "Sector Specific", "M.I.C. Algorithm Strategies", "Other"
                                            ].map((type) => (
                                                <label key={type} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5">
                                                    <input
                                                        type="checkbox" value={type}
                                                        checked={portfolioTypes.includes(type)}
                                                        onChange={() => handlePortfolioTypeChange(type)}
                                                        className="accent-gold"
                                                    />
                                                    <span className="text-gray-300 text-sm">{type}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {portfolioTypes.includes("Other") && (
                                            <input
                                                type="text" className="mt-2 w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-gold outline-none"
                                                placeholder="Please specify other options" value={otherPortfolioType} onChange={(e) => setOtherPortfolioType(e.target.value)}
                                            />
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={qLoading}
                                        className="w-full bg-gold hover:bg-yellow-500 text-black font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 mt-4"
                                    >
                                        {qLoading ? <Loader2 className="animate-spin" /> : "Save Changes"}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}