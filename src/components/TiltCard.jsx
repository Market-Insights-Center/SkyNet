import React, { useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";

const TiltCard = ({ children, className = "", ...props }) => {
    const ref = useRef(null);

    // Mouse position logging
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Smooth spring animation for the rotation
    const mouseX = useSpring(x, { stiffness: 150, damping: 20 });
    const mouseY = useSpring(y, { stiffness: 150, damping: 20 });

    const handleMouseMove = (e) => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
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
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            className={`relative transition-transform duration-200 ease-linear rounded-2xl ${className}`}
            {...props}
        >
            <div
                style={{ transform: "translateZ(50px)" }} // Push content forward
                className="relative z-10 h-full"
            >
                {children}
            </div>

            {/* Glass Background Layer */}
            <div className="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]" />

            {/* Holographic Sheen Layer */}
            <motion.div
                style={{ background: sheenGradient }}
                className="absolute inset-0 rounded-2xl pointer-events-none mix-blend-overlay z-20"
            />
        </motion.div>
    );
};

export default TiltCard;
