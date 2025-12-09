import React from 'react';
import { motion } from 'framer-motion';

const LiquidBackground = () => {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-deep-black">
            {/* Orb 1 - Gold */}
            <motion.div
                animate={{
                    x: [0, 100, -50, 0],
                    y: [0, -50, 50, 0],
                    scale: [1, 1.2, 0.9, 1],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut"
                }}
                className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-gold/20 rounded-full blur-[120px] mix-blend-screen"
            />

            {/* Orb 2 - Purple */}
            <motion.div
                animate={{
                    x: [0, -70, 30, 0],
                    y: [0, 100, -50, 0],
                    scale: [1, 1.1, 0.8, 1],
                }}
                transition={{
                    duration: 25,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut"
                }}
                className="absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] bg-royal-purple/25 rounded-full blur-[120px] mix-blend-screen"
            />

            {/* Orb 3 - Deep Purple/Blue Accent */}
            <motion.div
                animate={{
                    x: [0, 50, -50, 0],
                    y: [0, -30, 80, 0],
                    scale: [1, 1.3, 0.9, 1],
                }}
                transition={{
                    duration: 22,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut"
                }}
                className="absolute bottom-[-10%] left-[20%] w-[60vw] h-[60vw] bg-[#4B0082]/30 rounded-full blur-[140px] mix-blend-screen"
            />

             {/* Orb 4 - Cyan/Teal (Subtle Accent for "Liquid" feel) */}
             <motion.div
                animate={{
                    x: [0, -40, 60, 0],
                    y: [0, 60, -40, 0],
                    scale: [1, 1.2, 1],
                }}
                transition={{
                    duration: 30,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut"
                }}
                className="absolute bottom-[10%] right-[30%] w-[40vw] h-[40vw] bg-cyan-900/20 rounded-full blur-[130px] mix-blend-screen"
            />

            {/* Noise Overlay for Texture */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-10" 
                 style={{ 
                     backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
                 }}
            />
        </div>
    );
};

export default LiquidBackground;
