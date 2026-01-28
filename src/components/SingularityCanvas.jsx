import React, { useRef, useEffect } from 'react';

const SingularityCanvas = ({ active }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let width, height;
        let particles = [];

        // Configuration
        const particleCount = 400;
        const connectionDistance = 100;
        const coreRadius = 50;

        // Resize handler
        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', resize);
        resize();

        class Particle {
            constructor() {
                this.reset();
            }

            reset() {
                // Spawn particles in a disk formation
                const angle = Math.random() * Math.PI * 2;
                const distance = coreRadius + Math.random() * (Math.max(width, height) / 1.5);
                this.x = width / 2 + Math.cos(angle) * distance;
                this.y = height / 2 + Math.sin(angle) * distance;
                this.angle = angle;
                this.distance = distance;
                // Tangential velocity (orbit speed)
                this.velocity = (0.5 + Math.random() * 1.5) * (Math.random() < 0.5 ? 1 : 1);
                this.size = Math.random() * 2 + 0.5;
                this.alpha = Math.random() * 0.5 + 0.1;
            }

            update(isActive) {
                // Increase speed if active (Connected)
                const speedMultiplier = isActive ? 2.5 : 1;

                // Orbit logic
                this.angle += (this.velocity / this.distance) * speedMultiplier;

                // Slowly spiral in
                this.distance -= 0.2 * speedMultiplier;

                // Reset if sucked in too close
                if (this.distance < coreRadius) {
                    this.reset();
                    this.distance = Math.max(width, height) / 1.5; // Respawn at edge
                }

                // Calculate Cartesian coords
                this.x = width / 2 + Math.cos(this.angle) * this.distance;
                this.y = height / 2 + Math.sin(this.angle) * this.distance;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 255, 255, ${this.alpha})`; // Cyan color for M.I.C. tech feel
                ctx.fill();
            }
        }

        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        const drawCore = (isActive) => {
            // The Black Hole / Singularity Core
            const cx = width / 2;
            const cy = height / 2;

            // Outer Glow
            const gradient = ctx.createRadialGradient(cx, cy, coreRadius * 0.8, cx, cy, coreRadius * 3);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.9)');
            gradient.addColorStop(0.5, isActive ? 'rgba(0, 255, 255, 0.2)' : 'rgba(100, 100, 255, 0.1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Inner Core (Event Horizon)
            ctx.beginPath();
            ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.strokeStyle = isActive ? '#0ff' : '#333';
            ctx.lineWidth = isActive ? 2 : 1;
            ctx.stroke();
        };

        const render = () => {
            ctx.fillStyle = 'rgba(10, 10, 15, 0.2)'; // Trails effect
            ctx.fillRect(0, 0, width, height);

            drawCore(active);

            particles.forEach(p => {
                p.update(active);
                p.draw();
            });

            // Draw connections between nearby particles (Network effect)
            ctx.strokeStyle = active ? 'rgba(0, 255, 255, 0.05)' : 'rgba(100, 100, 150, 0.03)';
            ctx.lineWidth = 0.5;

            for (let i = 0; i < particles.length; i += 2) { // Skip some for performance
                const p1 = particles[i];
                // Only connect particles close to the center for the "web" effect
                if (p1.distance > 300) continue;

                for (let j = i + 1; j < particles.length; j += 5) {
                    const p2 = particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 60) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, [active]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed top-0 left-0 w-full h-full z-0 pointer-events-none bg-black"
        />
    );
};

export default SingularityCanvas;