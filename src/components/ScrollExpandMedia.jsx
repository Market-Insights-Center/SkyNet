import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const ScrollExpandMedia = ({
    mediaSrc,
    posterSrc,
    bgImageSrc,
    title, // Pass generic title if needed, or children
    overlayContent, // Special prop for the Title/Buttons overlay
    children,
}) => {
    const [scrollProgress, setScrollProgress] = useState(0);
    const [showContent, setShowContent] = useState(false);
    const [mediaFullyExpanded, setMediaFullyExpanded] = useState(false);
    const [touchStartY, setTouchStartY] = useState(0);
    const [isMobileState, setIsMobileState] = useState(false);

    const sectionRef = useRef(null);

    useEffect(() => {
        // Reset state on mount
        setScrollProgress(0);
        setShowContent(false);
        setMediaFullyExpanded(false);
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        const handleWheel = (e) => {
            // If we are fully expanded and scrolling UP at the very top of the window, collapse back
            if (mediaFullyExpanded && e.deltaY < 0 && window.scrollY <= 10) {
                // Prevent default only if we are taking action to collapse
                // But users might just want to scroll up the page content. 
                // Logic: If window.scrollY is 0, we can collapse.
                if (window.scrollY === 0) {
                    setMediaFullyExpanded(false);
                    e.preventDefault();
                }
            }
            // If NOT fully expanded, hijack scroll to control progress
            else if (!mediaFullyExpanded) {
                e.preventDefault();
                const scrollDelta = e.deltaY * 0.0009;
                const newProgress = Math.min(Math.max(scrollProgress + scrollDelta, 0), 1);
                setScrollProgress(newProgress);

                if (newProgress >= 1) {
                    setMediaFullyExpanded(true);
                    setShowContent(true);
                    // Allow document scroll again
                } else if (newProgress < 0.9) {
                    setShowContent(false);
                    setMediaFullyExpanded(false);
                }
            }
        };

        const handleTouchStart = (e) => {
            setTouchStartY(e.touches[0].clientY);
        };

        const handleTouchMove = (e) => {
            if (!touchStartY) return;

            const touchY = e.touches[0].clientY;
            const deltaY = touchStartY - touchY; // positive = scroll down

            if (mediaFullyExpanded && deltaY < -20 && window.scrollY <= 5) {
                setMediaFullyExpanded(false);
                // e.preventDefault(); // Optional: prevent pull-to-refresh
            } else if (!mediaFullyExpanded) {
                e.preventDefault();
                const scrollFactor = deltaY < 0 ? 0.008 : 0.005;
                const scrollDelta = deltaY * scrollFactor;
                const newProgress = Math.min(Math.max(scrollProgress + scrollDelta, 0), 1);
                setScrollProgress(newProgress);

                if (newProgress >= 1) {
                    setMediaFullyExpanded(true);
                    setShowContent(true);
                } else if (newProgress < 0.9) {
                    // Keep it collapsed
                }

                setTouchStartY(touchY);
            }
        };

        const handleTouchEnd = () => {
            setTouchStartY(0);
        };

        // Lock scroll position to top if not fully expanded
        const handleScroll = () => {
            if (!mediaFullyExpanded && window.scrollY > 0) {
                window.scrollTo(0, 0);
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('scroll', handleScroll);
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('wheel', handleWheel);
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [scrollProgress, mediaFullyExpanded, touchStartY]);

    useEffect(() => {
        const checkIfMobile = () => {
            setIsMobileState(window.innerWidth < 768);
        };
        checkIfMobile();
        window.addEventListener('resize', checkIfMobile);
        return () => window.removeEventListener('resize', checkIfMobile);
    }, []);

    // Responsive calculations
    // Initial width/height (small card state)
    const baseWidth = isMobileState ? 340 : 900;
    const baseHeight = isMobileState ? 380 : 450;

    // Expansion factors
    // We want to reach roughly 100vw and 100vh
    const expandedWidth = isMobileState ? window.innerWidth : window.innerWidth;
    const expandedHeight = isMobileState ? window.innerHeight : window.innerHeight;

    const currentWidth = baseWidth + (scrollProgress * (expandedWidth - baseWidth));
    const currentHeight = baseHeight + (scrollProgress * (expandedHeight - baseHeight));

    const borderRadius = 24 - (scrollProgress * 24); // 24px -> 0px

    return (
        <div ref={sectionRef} className="bg-black relative">
            <section className="relative flex flex-col items-center justify-start min-h-[100vh]">
                {/* Background Layer - Fades out as we expand (optional) or stays */}
                <motion.div
                    className="absolute inset-0 z-0"
                    style={{ opacity: 1 - scrollProgress }}
                >
                    {bgImageSrc ? (
                        <img
                            src={bgImageSrc}
                            alt="Background"
                            className="w-full h-full object-cover opacity-50"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black" />
                    )}
                </motion.div>

                {/* Main Sticky/Fixed Container during animation */}
                <div className={`fixed top-0 left-0 w-full h-screen flex flex-col items-center justify-center z-10 transition-none pointer-events-none`}>

                    {/* Video Card */}
                    <div
                        className="relative overflow-hidden shadow-2xl z-20"
                        style={{
                            width: `${currentWidth}px`,
                            height: `${currentHeight}px`,
                            maxWidth: '100vw',
                            maxHeight: '100vh',
                            borderRadius: `${borderRadius}px`,
                            pointerEvents: 'auto'
                            // When expanded, allow clicks. When shrinking, maybe not?
                        }}
                    >
                        <video
                            src={mediaSrc}
                            poster={posterSrc}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover"
                        />

                        {/* Dark Overlay on Video - Fades out as it expands? Or stays? */}
                        <div className="absolute inset-0 bg-black/40" />

                        {/* Content Overlay that lives INSIDE the video card (Title, Buttons) */}
                        {/* We can transform this based on scrollProgress to fade it out or move it */}
                        {overlayContent && (
                            <motion.div
                                className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 z-30"
                                style={{
                                    opacity: 1,
                                    scale: 1,
                                    display: 'flex'
                                }}
                            >
                                {overlayContent}
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Spacer to push content down - strictly visually handled by the logic above */}
            </section>

            {/* The rest of the page content */}
            <motion.div
                className="relative z-20 w-full bg-black min-h-screen"
                initial={{ opacity: 0, y: 100 }}
                animate={{
                    opacity: showContent ? 1 : 0,
                    y: showContent ? 0 : 100
                }}
                transition={{ duration: 0.8 }}
                style={{
                    display: showContent ? 'block' : 'none',
                    marginTop: '5vh' // Small gap
                }}
            >
                <div
                    className="absolute -top-64 left-0 right-0 h-96 bg-gradient-to-b from-transparent via-blue-900/40 to-black backdrop-blur-xl pointer-events-none"
                    style={{
                        maskImage: 'linear-gradient(to bottom, transparent 0%, black 40%, black 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40%, black 100%)'
                    }}
                />
                {children}
            </motion.div>
        </div >
    );
};

export default ScrollExpandMedia;
