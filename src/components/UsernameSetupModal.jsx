import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const UsernameSetupModal = ({ isOpen, onClose }) => {
    const { currentUser, userProfile, fetchUserProfile } = useAuth();
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isTaken, setIsTaken] = useState(false);

    // If profile has a "User_123" style name, we assume it's auto-generated and needs changing
    useEffect(() => {
        if (userProfile?.username && !userProfile.username.startsWith("User_")) {
            // If they already have a custom username, maybe we don't need to force this?
            // But the parent component controls visibility.
            setUsername(userProfile.username);
        }
    }, [userProfile]);

    const checkAvailability = async (val) => {
        if (!val || val.length < 3) return;
        try {
            const response = await fetch('/api/auth/check-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: val })
            });
            const data = await response.json();
            setIsTaken(data.taken);
            if (data.taken) setError("Username is already taken.");
            else setError("");
        } catch (e) {
            console.error(e);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (username.length < 3) {
            setError("Username must be at least 3 characters.");
            return;
        }
        if (isTaken) {
            setError("Username is taken.");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/user/username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email, username: username })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Failed to update username");
            }

            // Refresh profile
            await fetchUserProfile(currentUser.email);
            onClose(); // Setup complete
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0f0f0f] border border-gold/30 rounded-lg p-8 w-full max-w-md shadow-2xl relative">
                <h2 className="text-2xl font-bold text-white mb-2">Create Your Username</h2>
                <p className="text-gray-400 mb-6 text-sm">You must set a unique username to continue.</p>

                {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-2 rounded mb-4 text-sm">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-mono text-gold mb-1">USERNAME</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                setIsTaken(false);
                                setError('');
                            }}
                            onBlur={(e) => checkAvailability(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded px-4 py-3 text-white focus:border-gold focus:outline-none transition-colors"
                            placeholder="e.g. MarketWizard"
                        />
                        {isTaken && <p className="text-red-400 text-xs mt-1">Username unavailable</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || isTaken || !username}
                        className="w-full py-3 rounded font-bold transition-all transform hover:scale-[1.02] disabled:hover:scale-100
                            bg-gold text-black hover:bg-yellow-400 shadow-lg shadow-gold/20
                            disabled:bg-gray-800 disabled:text-gray-500 disabled:border disabled:border-white/10 disabled:shadow-none disabled:cursor-not-allowed disabled:opacity-100"
                    >
                        {loading ? "Saving..." : "Set Username & Continue"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UsernameSetupModal;
