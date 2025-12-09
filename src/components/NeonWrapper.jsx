import React from 'react';

const NeonWrapper = ({ children, className = "", color = "gold" }) => {
    // Generate color strings based on prop
    const colors = {
        gold: "from-transparent via-[#D4AF37] to-transparent",
        purple: "from-transparent via-[#6A0DAD] to-transparent",
        cyan: "from-transparent via-[#00FFFF] to-transparent",
        red: "from-transparent via-[#FF0000] to-transparent"
    };

    const gradientColors = colors[color] || colors.gold;

    return (
        <div className={`relative group ${className}`}>
            {/* Moving Border Gradient */}
            <div className="absolute -inset-[2px] rounded-full opacity-75 blur-sm transition duration-500 group-hover:opacity-100">
                <div className={`absolute inset-0 bg-gradient-to-r ${gradientColors} animate-spin-slow w-[200%] h-[200%] top-[-50%] left-[-50%]`}
                    style={{ animation: 'spin 3s linear infinite' }} />
                {/* Note: This simplistic spin might need a mask-image approach for a true border flow 
                         without covering the content, or z-index trick. 
                         Better approach:
                     */}
            </div>

            {/* Refined Approach: Conic Gradient Background + Mask */}
            <div className={`absolute -inset-[1px] rounded-full bg-gradient-to-r ${gradientColors} animate-border-flow bg-[length:200%_100%] opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

            <div className="relative">
                {children}
            </div>
        </div>
    );
};

/* 
 * Since Tailwind arbitrary values for animations are tricky, 
 * let's stick to a simpler "glow pulse" or use a CSS module strategy.
 * 
 * Better Strategy: 
 * A pseudo-element with a conic gradient that spins.
 */

const NeonFlowBorder = ({ children, className = "", color = "gold" }) => {
    const colorHex = {
        gold: "#D4AF37",
        purple: "#6A0DAD",
        cyan: "#00FFFF",
        red: "#FF0000"
    }[color] || "#D4AF37";

    return (
        <div className={`relative group ${className}`}>
            {/* The Glow */}
            <div
                className="absolute -inset-0.5 bg-gradient-to-r from-transparent via-[var(--neon-color)] to-transparent rounded-lg opacity-30 blur group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"
                style={{ '--neon-color': colorHex }}
            ></div>

            {/* The Content Container */}
            <div className="relative">
                {children}
            </div>

            <style>{`
                @keyframes tilt {
                    0%, 50%, 100% {
                        transform: rotate(0deg);
                    }
                    25% {
                        transform: rotate(0.5deg);
                    }
                    75% {
                        transform: rotate(-0.5deg);
                    }
                }
                .animate-tilt {
                    animation: tilt 10s infinite linear;
                }
            `}</style>
        </div>
    );
};

export default NeonFlowBorder;
