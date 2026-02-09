import React from 'react';

const GlassCard = ({ children, className = "", hoverEffect = false, noise = false, ...props }) => {
    return (
        <div
            className={`
                glass-panel
                rounded-2xl 
                ${noise ? 'glass-noise' : ''}
                ${hoverEffect ? 'transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_8px_32px_0_rgba(212,175,55,0.1)] hover:-translate-y-1' : ''}
                ${className}
            `}
            {...props}
        >
            {children}
        </div>
    );
};

export default GlassCard;
