import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Construction, ArrowLeft } from 'lucide-react';
import { checkAccess } from '../data/productAccess';
import NeonWrapper from './NeonWrapper';

const AccessGate = ({ productKey, children, title = "Access Restricted" }) => {
    const { userProfile, loading } = useAuth();
    const navigate = useNavigate();

    if (loading) return null; // Or a spinner

    const { allowed, isComingSoon } = checkAccess(userProfile?.tier, productKey);

    // 1. "Coming Soon" State (Global Restriction)
    // Only Singularity users bypass this if they satisfy the checkAccess allowed logic (which they usually do as 'NL')
    //Actually, logic Check: isComingSoon is TRUE if Basic/Pro/Ent are NA.
    // If user IS Singularity, checkAccess.allowed will be TRUE (assuming Singularity is NL).
    // So we need to show Coming Soon ONLY if allowed is FALSE.
    // Wait. If I am Basic, allowed=False, isComingSoon=True. -> Show Coming Soon.
    // If I am Singularity, allowed=True, isComingSoon=True. -> Show Children.
    // Correct.

    if (!allowed) {
        if (isComingSoon) {
            return (
                <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                    <NeonWrapper className="max-w-xl w-full p-8 text-center bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-white/5">
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/30">
                                <Construction className="w-10 h-10 text-purple-400" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-4">
                            Coming Soon
                        </h1>
                        <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                            This feature is currently in the <span className="text-white font-semibold">Testing Phase</span> and is exclusively available to Singularity members for beta access.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors flex items-center gap-2"
                            >
                                <ArrowLeft size={18} /> Go Back
                            </button>
                        </div>
                    </NeonWrapper>
                </div>
            );
        }

        // Standard Restriction
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <NeonWrapper className="max-w-xl w-full p-8 text-center bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-white/5">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30">
                            <Lock className="w-10 h-10 text-red-400" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-200 mb-2">
                        {title}
                    </h1>
                    <h2 className="text-xl text-red-400 mb-6 font-mono">
                        Access Restricted
                    </h2>
                    <p className="text-gray-400 mb-8 leading-relaxed">
                        Your current tier (<span className="text-white font-bold">{userProfile?.tier || 'Basic'}</span>) does not include access to this product. Please upgrade your plan to unlock full potential.
                    </p>
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => navigate('/products')}
                            className="px-6 py-3 rounded-lg bg-gradient-to-r from-gold to-yellow-600 text-black font-bold hover:scale-105 transition-transform shadow-lg shadow-gold/20"
                        >
                            Upgrade Plan
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                </NeonWrapper>
            </div>
        );
    }

    return children;
};

export default AccessGate;
