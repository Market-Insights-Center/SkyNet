import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const StartupAnimation = ({ onComplete }) => {
    const [isVisible, setIsVisible] = useState(true);
    const canvasRef = useRef(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onComplete) setTimeout(onComplete, 1000);
        }, 4000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let width, height;

        // Configuration
        const particleCount = 200;
        const colors = [
            '#D4AF37', // Gold
            '#FFD700', // Bright Gold
            '#6A0DAD', // Purple
            '#9370DB', // Medium Purple
            '#4B0082', // Indigo
        ];

        let particles = [];

        const init = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;

            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(createParticle());
            }
        };

        const createParticle = () => {
            // Spawn from corners
            const corner = Math.floor(Math.random() * 4);
            let x, y;
            const spread = 300; // How far from corner they can spawn

            switch (corner) {
                case 0: // Top-left
                    x = Math.random() * spread;
                    y = Math.random() * spread;
                    break;
                case 1: // Top-right
                    x = width - Math.random() * spread;
                    y = Math.random() * spread;
                    break;
                case 2: // Bottom-right
                    x = width - Math.random() * spread;
                    y = height - Math.random() * spread;
                    break;
                case 3: // Bottom-left
                    x = Math.random() * spread;
                    y = height - Math.random() * spread;
                    break;
                default:
                    x = 0; y = 0;
            }

            return {
                x,
                y,
                history: [{ x, y }],
                speed: 2 + Math.random() * 3,
                angle: 0, // Will be calculated towards center
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 2 + 0.5,
                life: 100 + Math.random() * 100
            };
        };

        const draw = () => {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, width, height);

            ctx.globalCompositeOperation = 'screen';

            const centerX = width / 2;
            const centerY = height / 2;

            particles.forEach((p, i) => {
                // Calculate angle to center
                const dx = centerX - p.x;
                const dy = centerY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Move towards center with some noise
                const targetAngle = Math.atan2(dy, dx);
                // Add some spiral/noise effect
                const noise = Math.sin(dist * 0.01) * 0.5;

                p.x += Math.cos(targetAngle + noise) * p.speed;
                p.y += Math.sin(targetAngle + noise) * p.speed;

                // Update history for trails
                p.history.push({ x: p.x, y: p.y });
                if (p.history.length > 20) p.history.shift();

                // Draw trail
                ctx.beginPath();
                ctx.moveTo(p.history[0].x, p.history[0].y);
                for (let j = 1; j < p.history.length; j++) {
                    ctx.lineTo(p.history[j].x, p.history[j].y);
                }
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.size;
                ctx.stroke();

                // Reset if close to center or dead
                p.life--;
                if (dist < 50 || p.life <= 0) {
                    particles[i] = createParticle();
                }
            });

            ctx.globalCompositeOperation = 'source-over';
            animationFrameId = requestAnimationFrame(draw);
        };

        init();
        window.addEventListener('resize', init);
        draw();

        return () => {
            window.removeEventListener('resize', init);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-deep-black overflow-hidden"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                >
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

                    <motion.div
                        className="relative z-10 flex flex-col items-center"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ duration: 1.5, ease: "circOut" }}
                            className="mb-6 relative"
                        >
                            <div className="absolute inset-0 bg-gold/30 blur-3xl rounded-full transform scale-150" />
                            <img
                                src="/logo.jpg"
                                alt="M.I.C. Singularity Logo"
                                className="w-32 h-32 md:w-48 md:h-48 object-contain relative z-10 rounded-full border-2 border-gold/50 shadow-[0_0_30px_rgba(212,175,55,0.3)]"
                            />
                        </motion.div>

                        <motion.h1
                            className="text-4xl md:text-6xl font-bold tracking-widest text-white text-center drop-shadow-2xl"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.8, duration: 1 }}
                        >
                            M.I.C. <span className="text-gold">SINGULARITY</span>
                        </motion.h1>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default StartupAnimation;
