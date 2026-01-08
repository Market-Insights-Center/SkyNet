import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const StartupAnimation = ({ onComplete }) => {
    const [isVisible, setIsVisible] = useState(true);
    const canvasRef = useRef(null);

    useEffect(() => {
        const hasSeenAnimation = sessionStorage.getItem('startup_animation_shown');

        if (hasSeenAnimation) {
            setIsVisible(false);
            if (onComplete) onComplete();
            return;
        }

        const timer = setTimeout(() => {
            setIsVisible(false);
            sessionStorage.setItem('startup_animation_shown', 'true');
            if (onComplete) setTimeout(onComplete, 500);
        }, 2000); // 2 Seconds
        return () => clearTimeout(timer);
    }, [onComplete]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let width, height;
        let particles = [];
        let backgroundParticles = [];
        let time = 0;

        // Colors
        const GOLD = '#D4AF37';
        const PURPLE = '#6A0DAD';
        const SILVER = '#C0C0C0';

        const init = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            particles = [];
            backgroundParticles = [];

            // --- 1. Background Silver Dust ---
            for (let i = 0; i < 100; i++) {
                backgroundParticles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: Math.random() * 2,
                    alpha: Math.random() * 0.5 + 0.2
                });
            }

            // --- 2. Spiral Particles ---
            for (let i = 0; i < 400; i++) {
                particles.push(createSpiralParticle());
            }
        };

        const createSpiralParticle = () => {
            // Spawn from edges
            let x, y;
            if (Math.random() < 0.5) {
                x = Math.random() < 0.5 ? -10 : width + 10;
                y = Math.random() * height;
            } else {
                x = Math.random() * width;
                y = Math.random() < 0.5 ? -10 : height + 10;
            }

            return {
                x,
                y,
                angle: Math.atan2(height / 2 - y, width / 2 - x), // Angle to center
                dist: Math.sqrt(Math.pow(width / 2 - x, 2) + Math.pow(height / 2 - y, 2)), // Distance to center
                speed: 4 + Math.random() * 5, // Faster speed
                color: Math.random() > 0.5 ? GOLD : PURPLE,
                size: Math.random() * 2 + 1,
                offset: Math.random() * 100
            };
        };

        const drawSilkWave = (t) => {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.lineWidth = 2;

            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.strokeStyle = i % 2 === 0 ? GOLD : PURPLE;
                ctx.globalAlpha = 0.3;

                for (let x = 0; x < width; x += 10) {
                    const y = height / 2 +
                        Math.sin(x * 0.002 + t * 0.002 + i) * 100 +
                        Math.sin(x * 0.01 + t * 0.005) * 50;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.restore();
        };

        const draw = () => {
            // 1. Clear & Background
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, width, height);

            time += 16;

            // 2. Draw Silk Wave
            drawSilkWave(time);

            // 3. Draw Silver Dust
            ctx.fillStyle = SILVER;
            backgroundParticles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;

            // 4. Draw Spiral Particles
            const centerX = width / 2;
            const centerY = height / 2;

            particles.forEach(p => {
                p.dist -= p.speed;
                p.angle += 0.02;

                const currentDist = Math.max(0, p.dist);
                p.x = centerX + Math.cos(p.angle) * currentDist;
                p.y = centerY + Math.sin(p.angle) * currentDist;

                if (p.dist <= 10) {
                    Object.assign(p, createSpiralParticle());
                }

                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

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
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

                    <motion.div
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    >
                        <img
                            src="/logo.jpg"
                            alt="Logo"
                            className="w-48 h-48 object-contain rounded-full border-4 border-gold shadow-[0_0_100px_rgba(212,175,55,0.6)]"
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default StartupAnimation;
