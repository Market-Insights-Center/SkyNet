import React, { useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";

const TiltCard = React.forwardRef(({ children, className = "", ...props }, ref) => {
    // We need an internal ref for measurements, but also want to expose ref to parent.
    // Use a merge refs pattern or just use internal ref if parent doesn't need DOm access specifically for measurement.
    // However, CardSwap uses GSAP on the ref. So we MUST expose the DOM node.

    // Simple solution: use the forwarded ref if provided, else strict local one (or useCallback ref).
    // For simplicity with Framer Motion, we can pass ref to motion.div.
    // But we need 'ref.current' for getBoundingClientRect in handleMouseMove.

    // We will use an internal ref and expose it via useImperativeHandle OR just use one ref if we can ensure it's an object ref.
    // Better: use a local ref and sync it, or use a callback ref.

    // Let's use a local ref for logic, and if ref is passed, we assign it.
    const internalRef = useRef(null);

    React.useImperativeHandle(ref, () => internalRef.current);

    // Mouse position logging
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Smooth spring animation for the rotation
    const mouseX = useSpring(x, { stiffness: 150, damping: 20 });
    const mouseY = useSpring(y, { stiffness: 150, damping: 20 });

    const handleMouseMove = (e) => {
        if (!internalRef.current) return;

        const rect = internalRef.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        const mouseXRelative = e.clientX - rect.left;
        const mouseYRelative = e.clientY - rect.top;

        // Calculate rotation values (-1 to 1 range relative to center)
        const xPct = (mouseXRelative / width - 0.5);
        const yPct = (mouseYRelative / height - 0.5);

        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    // Calculate rotation: Move mouse right -> Rotate Y positive. Move mouse down -> Rotate X negative.
    const rotateX = useTransform(mouseY, [-0.5, 0.5], [15, -15]); // Inverted for natural tilt
    const rotateY = useTransform(mouseX, [-0.5, 0.5], [-15, 15]);

    // Holographic Sheen Gradient
    const sheenX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
    const sheenY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

    // Dynamic background for sheen
    const sheenGradient = useMotionTemplate`radial-gradient(
        circle at ${sheenX} ${sheenY}, 
        rgba(255,255,255,0.15), 
        transparent 80%
    )`;

    return (
        <motion.div
            ref={internalRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            className={`relative transition-transform duration-200 ease-linear ${className}`}
            {...props}
        >
            <div
                style={{ transform: "translateZ(50px)" }} // Push content forward
                className="relative z-10 h-full"
            >
                {children}
            </div>

            {/* Glass Background Layer */}
            <div className="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]" />

            {/* Holographic Sheen Layer */}
            <motion.div
                style={{ background: sheenGradient }}
                className="absolute inset-0 pointer-events-none mix-blend-overlay z-20"
            />
        </motion.div>
    );
});

export default TiltCard;
