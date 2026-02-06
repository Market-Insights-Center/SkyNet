import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Configuration
const IDLE_TIMEOUT_MS = 300000; // 5 minutes

// Pixel Art Assets (Assumes these exist or will exist)
const ASSETS = {
    sit: '/assets/rabbit_pixel_sit.png',
    prep: '/assets/rabbit_pixel_prep.png',
    jump: '/assets/rabbit_pixel_jump.png',
    back: '/assets/rabbit_pixel_back.png',
    hole: '/assets/pixel_hole.png'
};

const IdleRabbit = () => {
    // Top level state
    const [isIdle, setIsIdle] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    // Rabbit specific state
    const [rabbitPos, setRabbitPos] = useState({ x: 0, y: 0 });
    const [direction, setDirection] = useState(1); // 1 = right, -1 = left
    const [behaviorState, setBehaviorState] = useState('sitting'); // 'sitting', 'prepping', 'jumping', 'exiting'
    const [currentSprite, setCurrentSprite] = useState(ASSETS.sit);
    const [holePos, setHolePos] = useState(null);

    // Refs
    const lastActivityRef = useRef(Date.now());
    const idleCheckIntervalRef = useRef(null);
    const behaviorTimeoutRef = useRef(null);

    // --- Activity Tracking & Idle Trigger ---
    useEffect(() => {
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

        const resetTimer = () => {
            lastActivityRef.current = Date.now();
            if (isIdle && !isExiting) {
                triggerExit();
            }
        };

        // Throttled handler
        let throttleTimer;
        const handleActivity = () => {
            if (!throttleTimer) {
                throttleTimer = setTimeout(() => {
                    resetTimer();
                    throttleTimer = null;
                }, 500);
            }
        };

        events.forEach(event => window.addEventListener(event, handleActivity));

        idleCheckIntervalRef.current = setInterval(() => {
            const now = Date.now();
            if (!isIdle && !isExiting && (now - lastActivityRef.current > IDLE_TIMEOUT_MS)) {
                setIsIdle(true);
                startIdleBehavior();
            }
        }, 1000);

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
            if (idleCheckIntervalRef.current) clearInterval(idleCheckIntervalRef.current);
            if (behaviorTimeoutRef.current) clearTimeout(behaviorTimeoutRef.current);
            if (throttleTimer) clearTimeout(throttleTimer);
        };
    }, [isIdle, isExiting]);

    useEffect(() => {
        if (!isIdle) {
            // Reset logic when not idle
            setBehaviorState('sitting');
            setCurrentSprite(ASSETS.sit);
        }
    }, [isIdle]);

    // --- Behavior Logic ---

    const startIdleBehavior = () => {
        // Init position (random spot on screen)
        const padding = 100;
        const x = Math.random() * (window.innerWidth - padding * 2) + padding;
        const y = Math.random() * (window.innerHeight - padding * 2) + padding;
        setRabbitPos({ x, y });
        setBehaviorState('sitting');
        setCurrentSprite(ASSETS.sit);

        // Start loop
        scheduleNextBehavior();
    };

    const scheduleNextBehavior = () => {
        if (behaviorTimeoutRef.current) clearTimeout(behaviorTimeoutRef.current);

        // If we are currently sitting, decide to random Wait OR Jump
        // Simple logic: always jump after a sit duration, but sit duration varies
        const sitDuration = Math.random() * 3000 + 2000; // 2s - 5s

        behaviorTimeoutRef.current = setTimeout(() => {
            if (!isIdle || isExiting) return;
            startHopSequence();
        }, sitDuration);
    };

    const startHopSequence = () => {
        if (!isIdle || isExiting) return;

        // 1. Prep
        setBehaviorState('prepping');
        setCurrentSprite(ASSETS.prep);

        // Short prep time
        setTimeout(() => {
            if (!isIdle || isExiting) return;
            performJump();
        }, 200); // 200ms prep
    };

    const performJump = () => {
        if (!isIdle || isExiting) return;

        // 2. Jump
        setBehaviorState('jumping');
        setCurrentSprite(ASSETS.jump);

        // Calc new pos (Small jumps! 50-150px)
        const jumpDist = Math.random() * 100 + 50;
        // Random angle? Or just stick to mostly horizontal for "hopping around"
        // Let's go random direction X
        const newDir = Math.random() > 0.5 ? 1 : -1;
        setDirection(newDir);

        let newX = rabbitPos.x + (jumpDist * newDir);
        let newY = rabbitPos.y + (Math.random() * 40 - 20); // Slight Y variation

        // Bounds check
        const padding = 50;
        if (newX < padding) { newX = padding; setDirection(1); }
        if (newX > window.innerWidth - padding) { newX = window.innerWidth - padding; setDirection(-1); }
        if (newY < padding) newY = padding;
        if (newY > window.innerHeight - padding) newY = window.innerHeight - padding;

        setRabbitPos({ x: newX, y: newY });

        // Land after jump duration
        setTimeout(() => {
            if (!isIdle || isExiting) return;
            land();
        }, 500); // 500ms air time
    };

    const land = () => {
        if (!isIdle || isExiting) return;
        setBehaviorState('sitting');
        setCurrentSprite(ASSETS.sit);

        // Loop back to waiting
        scheduleNextBehavior();
    };


    // --- Exit Logic ---
    const triggerExit = () => {
        if (isExiting) return;
        setIsExiting(true);
        if (behaviorTimeoutRef.current) clearTimeout(behaviorTimeoutRef.current);

        // Turn back to viewer
        setBehaviorState('exiting');

        // Decide hole position relative to rabbit
        // Ensure hole is visible? Let's spawn it 100px away or right next to it
        // Let's spawn it 50px away in the direction rabbit was looking? Or just right there.
        // Let's spawn it slightly "above" (y-axis) so it looks like depth
        const holeX = rabbitPos.x + 20 * direction;
        const holeY = rabbitPos.y - 40;

        setHolePos({ x: holeX, y: holeY });

        // Sequence: 
        // 1. Look back (Sprite switch) + Hole Appears
        // 2. Short pause
        // 3. Jump INTO hole

        // 1.
        setCurrentSprite(ASSETS.back); // Looking at hole/camera? "Back" usually means back of head.

        setTimeout(() => {
            // 2. Jump in
            // Animate position to hole center
            setRabbitPos({ x: holeX, y: holeY }); // Move to hole center
            // We use Framer Motion variants to handle the visual 'jump and shrink'

            // Cleanup after animation matches duration
            setTimeout(() => {
                setIsIdle(false);
                setIsExiting(false);
                setHolePos(null);
            }, 800);
        }, 500);
    };

    return (
        <AnimatePresence>
            {isIdle && (
                <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">

                    {/* Hole */}
                    <AnimatePresence>
                        {isExiting && holePos && (
                            <motion.img
                                src={ASSETS.hole}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                className="absolute w-28 h-18 object-contain pixelated"
                                style={{
                                    left: holePos.x - 56, // Center
                                    top: holePos.y + 20,
                                    imageRendering: 'pixelated'
                                }}
                                transition={{ duration: 0.4 }}
                            />
                        )}
                    </AnimatePresence>

                    {/* Rabbit */}
                    <motion.div
                        className="absolute w-24 h-24"
                        initial={{ opacity: 0, x: rabbitPos.x, y: rabbitPos.y }}
                        animate={{
                            opacity: 1,
                            x: rabbitPos.x,
                            y: rabbitPos.y,
                            scaleX: isExiting ? 1 : direction, // Don't flip when looking back/jumping in
                            scale: (isExiting && holePos) ? 0 : 1 // Shrink to 0 when jumping in
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                            x: { type: "tween", duration: isExiting ? 0.5 : (behaviorState === 'jumping' ? 0.5 : 0) }, // Smooth jump, instant teleport otherwise
                            y: { type: "tween", duration: isExiting ? 0.5 : (behaviorState === 'jumping' ? 0.5 : 0) },
                            scale: { duration: isExiting ? 0.5 : 0.2 }
                        }}
                    >
                        <img
                            src={currentSprite}
                            alt="Rabbit"
                            className="w-full h-full object-contain drop-shadow-lg"
                            style={{ imageRendering: 'pixelated' }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default IdleRabbit;
