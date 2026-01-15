import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";

export const PinContainer = ({
    children,
    title,
    href,
    className,
    containerClassName,
}) => {
    const [transform, setTransform] = useState("rotateX(0deg)");
    const [isHovered, setIsHovered] = useState(false);

    const onMouseEnter = () => {
        setTransform("rotateX(40deg) scale(0.8)");
        setIsHovered(true);
    };
    const onMouseLeave = () => {
        setTransform("rotateX(0deg) scale(1)");
        setIsHovered(false);
    };

    return (
        <Link
            className={cn(
                "relative group/pin z-50 cursor-pointer block w-full h-full overflow-visible",
                containerClassName
            )}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            to={href || "/"}
        >
            <div
                style={{
                    perspective: "1000px",
                    transform: "rotateX(70deg) translateZ(0deg)",
                }}
                className="absolute left-0 top-0 w-full h-full"
            >
                <div
                    style={{
                        transform: transform,
                    }}
                    className={cn(
                        "absolute left-0 top-0 w-full h-full flex justify-start items-start rounded-2xl shadow-[0_8px_16px_rgb(0_0_0/0.4)] border border-white/[0.1] group-hover/pin:border-white/[0.2] transition duration-700 overflow-hidden bg-black",
                        className
                    )}
                >
                    <div className="relative z-50 w-full h-full">{children}</div>
                </div>
            </div>
            <PinPerspective title={title} href={href} active={isHovered} />
        </Link>
    );
};

export const PinPerspective = ({ title, active }) => {
    return (
        <motion.div
            animate={{ opacity: active ? 1 : 0 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none absolute left-0 top-0 w-full h-full flex items-center justify-center z-[100]"
        >
            <div className="w-full h-full absolute inset-0 flex items-center justify-center">
                {/*
            Pin Assembly: Title + Stick.
            Anchored at absolute bottom-1/2 (The vertical center of the card).
            This ensures the "stick" grows upwards from the exact center.
            Flex-col ensures Title sits perfectly on top of Stick.
        */}
                <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="relative flex space-x-2 items-center z-10 rounded-full bg-zinc-950 py-0.5 px-4 ring-1 ring-white/10 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                        <span className="relative z-20 text-white text-xs font-bold inline-block py-0.5">
                            {title}
                        </span>
                        <span className="absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-emerald-400/0 via-emerald-400/90 to-emerald-400/0 transition-opacity duration-500"></span>
                    </div>

                    <div className="w-px h-20 bg-gradient-to-b from-transparent to-cyan-500 blur-[0.5px]"></div>
                    <div className="w-px h-20 bg-gradient-to-b from-transparent to-cyan-500 blur-[0.5px] absolute bottom-0"></div>
                </div>

                {/* Center Orb / Ripples */}
                <div
                    style={{
                        perspective: "1000px",
                        transform: "rotateX(70deg) translateZ(0)",
                    }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                    <>
                        <motion.div
                            initial={{
                                opacity: 0,
                                scale: 0,
                                x: "-50%",
                                y: "-50%",
                            }}
                            animate={{
                                opacity: [0, 1, 0.5, 0],
                                scale: 1,
                                z: 0,
                            }}
                            transition={{
                                duration: 6,
                                repeat: Infinity,
                                delay: 0,
                            }}
                            className="absolute left-1/2 top-1/2 h-[11.25rem] w-[11.25rem] rounded-[50%] bg-sky-500/[0.2] shadow-[0_8px_16px_rgb(0_0_0/0.4)]"
                        ></motion.div>
                        <motion.div
                            initial={{
                                opacity: 0,
                                scale: 0,
                                x: "-50%",
                                y: "-50%",
                            }}
                            animate={{
                                opacity: [0, 1, 0.5, 0],
                                scale: 1,
                                z: 0,
                            }}
                            transition={{
                                duration: 6,
                                repeat: Infinity,
                                delay: 2,
                            }}
                            className="absolute left-1/2 top-1/2 h-[11.25rem] w-[11.25rem] rounded-[50%] bg-sky-500/[0.2] shadow-[0_8px_16px_rgb(0_0_0/0.4)]"
                        ></motion.div>
                        <motion.div
                            initial={{
                                opacity: 0,
                                scale: 0,
                                x: "-50%",
                                y: "-50%",
                            }}
                            animate={{
                                opacity: [0, 1, 0.5, 0],
                                scale: 1,
                                z: 0,
                            }}
                            transition={{
                                duration: 6,
                                repeat: Infinity,
                                delay: 4,
                            }}
                            className="absolute left-1/2 top-1/2 h-[11.25rem] w-[11.25rem] rounded-[50%] bg-sky-500/[0.2] shadow-[0_8px_16px_rgb(0_0_0/0.4)]"
                        ></motion.div>
                    </>
                </div>

                {/* Center Dots */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="bg-cyan-600 w-[4px] h-[4px] rounded-full blur-[3px]" />
                    <div className="bg-cyan-300 w-[2px] h-[2px] rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>

            </div>
        </motion.div>
    );
};
