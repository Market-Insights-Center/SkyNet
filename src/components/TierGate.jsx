import React from 'react';
import { Lock, Crown } from 'lucide-react';

/**
 * TierGate Component
 * 
 * Renders children if user meets the required tier.
 * Otherwise, renders a "locked" state with an upgrade message.
 * 
 * @param {Object} userProfile - The current user's profile object
 * @param {string} requiredTier - Minimum tier required ('Basic', 'Pro', 'Enterprise')
 * @param {React.ReactNode} children - Content to show if allowed
 * @param {boolean} showLock - If true, restricts access. If false, passes through (useful for external logic).
 * @param {string} featureName - Name of feature being gated (for display)
 * @param {string} type - 'overlay' | 'block' | 'inline' (Visual style)
 */
const TierGate = ({
    userProfile,
    requiredTier = 'Pro',
    children,
    showLock = null,
    featureName = "Premium Feature",
    type = 'block'
}) => {
    const tiers = ['Basic', 'Pro', 'Enterprise', 'Singularity', 'Visionary', 'Institutional'];
    const currentTier = userProfile?.tier || 'Basic';

    // Determine access
    let hasAccess = false;
    if (showLock !== null) {
        hasAccess = !showLock;
    } else {
        const reqIndex = tiers.indexOf(requiredTier);
        const curIndex = tiers.indexOf(currentTier);
        hasAccess = curIndex >= reqIndex;
    }

    if (hasAccess) return children;

    // Locked UI
    if (type === 'inline') {
        return (
            <div className="flex items-center gap-2 text-gray-500 bg-gray-900/50 px-3 py-2 rounded-lg border border-gray-800 cursor-not-allowed opacity-75">
                <Lock size={14} className="text-gold" />
                <span className="text-xs font-bold uppercase tracking-wider">{requiredTier}+ Only</span>
            </div>
        );
    }

    if (type === 'overlay') {
        return (
            <div className="relative group">
                <div className="opacity-20 pointer-events-none filter blur-[2px] select-none grayscale">
                    {children}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10 p-4 text-center rounded-xl border border-white/10">
                    <div className="p-3 bg-black/80 rounded-full border border-gold/30 mb-3 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                        <Lock size={24} className="text-gold" />
                    </div>
                    <h3 className="text-white font-bold mb-1 flex items-center gap-2">
                        {featureName} <Crown size={14} className="text-purple-400" />
                    </h3>
                    <p className="text-xs text-gray-400 mb-3 max-w-[200px]">
                        Available on <span className="text-gold font-bold">{requiredTier}</span> plan.
                    </p>
                    <button onClick={() => window.location.href = '/products'} className="text-xs bg-gold text-black font-bold px-4 py-2 rounded-full hover:bg-white transition-colors">
                        Upgrade to {requiredTier}
                    </button>
                </div>
            </div>
        );
    }

    // Default 'block'
    return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-900/30 border border-gray-800 rounded-xl text-center">
            <div className="p-4 bg-black/50 rounded-full mb-4 border border-gray-800">
                <Lock size={32} className="text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{featureName} Locked</h3>
            <p className="text-gray-400 mb-6 max-w-sm">
                This advanced feature requires a <span className="text-white font-bold">{requiredTier}</span> subscription or higher.
            </p>
            <a href="/products" className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-colors">
                Upgrade to {requiredTier}
            </a>
        </div>
    );
};

export default TierGate;
