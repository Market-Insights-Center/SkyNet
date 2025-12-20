import React, { useRef, useEffect } from 'react';

const WaveBackground = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let particles = [];
        let waves = [];
        let width, height;

        // Configuration
        const particleCount = 300;
        const waveCount = 40; // WAY MORE lines

        // Strict Gold & Purple Palette
        const colors = [
            '#D4AF37', // Gold
            '#FFD700', // Bright Gold
            '#B8860B', // Dark Goldenrod
            '#6A0DAD', // Purple
            '#9370DB', // Medium Purple
            '#4B0082', // Indigo
            '#8A2BE2', // Blue Violet
        ];

        const init = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;

            // Initialize Particles
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 2 + 0.5,
                    speedX: Math.random() * 0.5 - 0.25,
                    speedY: Math.random() * 0.5 - 0.25,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    alpha: Math.random() * 0.5 + 0.2
                });
            }

            // Initialize Waves
            waves = [];
            for (let i = 0; i < waveCount; i++) {
                waves.push({
                    frequency: 0.002 + Math.random() * 0.008,
                    amplitude: 20 + Math.random() * 80,
                    speed: 0.2 + Math.random() * 0.8,
                    offset: Math.random() * Math.PI * 2,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    yOffset: (Math.random() - 0.5) * 100 // Spread waves vertically slightly
                });
            }
        };

        const drawWave = (wave, time) => {
            ctx.beginPath();
            // Start line
            ctx.moveTo(0, height / 2 + wave.yOffset);

            for (let i = 0; i < width; i++) {
                // Complex sine summation
                const y = Math.sin(i * wave.frequency + time * wave.speed + wave.offset) * wave.amplitude
                    + Math.sin(i * wave.frequency * 0.5 + time * wave.speed * 0.5) * (wave.amplitude * 0.5);

                ctx.lineTo(i, height / 2 + wave.yOffset + y);
            }

            ctx.strokeStyle = wave.color;
            ctx.lineWidth = 1; // Thin lines for "string" effect
            ctx.globalAlpha = 0.3; // Transparency for blending
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        };

        const drawParticles = () => {
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.fill();

                // Move particles
                p.x += p.speedX;
                p.y += p.speedY;

                // Wrap around screen
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                // Twinkle effect
                if (Math.random() > 0.95) {
                    p.alpha = Math.random() * 0.5 + 0.2;
                }
            });
        };

        const render = (time) => {
            // Draw background fill (Light Purple as requested)
            // Using a rich purple that isn't too bright to maintain contrast
            ctx.fillStyle = '#2D1B4E';
            ctx.fillRect(0, 0, width, height);

            // Additive blending for glowing effect
            ctx.globalCompositeOperation = 'screen';

            const t = time * 0.001;

            // Draw all waves
            waves.forEach(wave => drawWave(wave, t));

            // Draw Particles
            drawParticles();

            // Reset composite operation
            ctx.globalCompositeOperation = 'source-over';

            animationFrameId = requestAnimationFrame(() => render(performance.now()));
        };

        init();
        window.addEventListener('resize', init);
        render(0);

        return () => {
            window.removeEventListener('resize', init);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

export { WaveBackground };
