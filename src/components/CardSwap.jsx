import React, { Children, cloneElement, forwardRef, isValidElement, useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import './CardSwap.css';

export const Card = forwardRef(({ customClass, ...rest }, ref) => (
    <div ref={ref} {...rest} className={`card ${customClass ?? ''} ${rest.className ?? ''}`.trim()} />
));
Card.displayName = 'Card';

const makeSlot = (i, distX, distY, total, centerStack, depth) => {
    const xOffset = centerStack ? -((total - 1) * distX) / 2 : 0;
    const yOffset = centerStack ? -((total - 1) * distY) / 2 : 0;
    return {
        x: (i * distX) + xOffset,
        y: -(i * distY) - yOffset, // Negative distY to stack upwards, center with offset
        z: -i * depth,
        zIndex: total - i
    };
};
const placeNow = (el, slot, skew) =>
    gsap.set(el, {
        x: slot.x,
        y: slot.y,
        z: slot.z,
        xPercent: -50,
        yPercent: -50,
        skewY: skew,
        transformOrigin: 'center center',
        zIndex: slot.zIndex,
        force3D: true
    });

const CardSwap = ({
    width = 500,
    height = 400,
    cardDistance = 60,
    verticalDistance = 70,
    delay = 5000,
    pauseOnHover = false,
    onCardClick,
    skewAmount = 6,
    easing = 'elastic',
    dropDistance = 300,
    swapAxis = 'y',
    centerStack = false,
    depth = 40,
    children
}) => {
    const config =
        easing === 'elastic'
            ? {
                ease: 'elastic.out(0.6,0.9)',
                durDrop: 2,
                durMove: 2,
                durReturn: 2,
                promoteOverlap: 0.9,
                returnDelay: 0.05
            }
            : {
                ease: 'power1.inOut',
                durDrop: 0.8,
                durMove: 0.8,
                durReturn: 0.8,
                promoteOverlap: 0.45,
                returnDelay: 0.2
            };

    const childArr = useMemo(() => Children.toArray(children), [children]);
    const refs = useMemo(
        () => childArr.map(() => React.createRef()),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [childArr.length]
    );

    const order = useRef(Array.from({ length: childArr.length }, (_, i) => i));

    const tlRef = useRef(null);
    const intervalRef = useRef();
    const container = useRef(null);

    // Initial placement
    useEffect(() => {
        const total = refs.length;
        refs.forEach((r, i) => {
            if (r.current) {
                placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total, centerStack, depth), skewAmount);
            }
        });
    }, [refs, cardDistance, verticalDistance, centerStack, depth, skewAmount]);

    // Define swap function at top level
    const swap = React.useCallback(() => {
        if (order.current.length < 2) return;

        const [front, ...rest] = order.current;
        const elFront = refs[front]?.current;
        if (!elFront) return;

        const tl = gsap.timeline();
        tlRef.current = tl;

        // Animate based on swapAxis
        const dropProp = swapAxis === 'x' ? 'x' : 'y';

        tl.to(elFront, {
            [dropProp]: `+=${dropDistance}`,
            duration: config.durDrop,
            ease: config.ease
        });

        tl.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`);
        rest.forEach((idx, i) => {
            const el = refs[idx]?.current;
            if (el) {
                const slot = makeSlot(i, cardDistance, verticalDistance, refs.length, centerStack, depth);
                tl.set(el, { zIndex: slot.zIndex }, 'promote');
                tl.to(
                    el,
                    {
                        x: slot.x,
                        y: slot.y,
                        z: slot.z,
                        duration: config.durMove,
                        ease: config.ease
                    },
                    `promote+=${i * 0.15}`
                );
            }
        });

        const backSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length, centerStack, depth);
        tl.addLabel('return', `promote+=${config.durMove * config.returnDelay}`);
        tl.call(
            () => {
                gsap.set(elFront, { zIndex: backSlot.zIndex });
            },
            undefined,
            'return'
        );
        tl.to(
            elFront,
            {
                x: backSlot.x,
                y: backSlot.y,
                z: backSlot.z,
                duration: config.durReturn,
                ease: config.ease
            },
            'return'
        );

        tl.call(() => {
            order.current = [...rest, front];
        });
    }, [swapAxis, dropDistance, config, cardDistance, verticalDistance, centerStack, depth, refs]);

    // Interval Effect
    useEffect(() => {
        // Start interval
        intervalRef.current = window.setInterval(swap, delay);

        if (pauseOnHover) {
            const node = container.current;
            const pause = () => {
                tlRef.current?.pause();
                clearInterval(intervalRef.current);
            };
            const resume = () => {
                tlRef.current?.play();
                intervalRef.current = window.setInterval(swap, delay);
            };
            if (node) {
                node.addEventListener('mouseenter', pause);
                node.addEventListener('mouseleave', resume);
                return () => {
                    node.removeEventListener('mouseenter', pause);
                    node.removeEventListener('mouseleave', resume);
                    clearInterval(intervalRef.current);
                };
            }
        }
        return () => clearInterval(intervalRef.current);
    }, [delay, pauseOnHover, swap]); // Removed redundant dependencies, swap is memoized

    const handleManualSwap = (e) => {
        e.stopPropagation();
        // Reset interval to avoid double swap
        clearInterval(intervalRef.current);
        swap();
        intervalRef.current = window.setInterval(swap, delay);
    };

    const rendered = childArr.map((child, i) =>
        isValidElement(child)
            ? cloneElement(child, {
                key: i,
                ref: refs[i],
                style: { width, height, ...(child.props.style ?? {}) },
                onClick: e => {
                    child.props.onClick?.(e);
                    onCardClick?.(i);
                }
            })
            : child
    );

    return (
        <div ref={container} className="card-swap-container group/swap" style={{ width, height }}>
            {rendered}

            {/* Manual Swap Control */}
            <button
                onClick={handleManualSwap}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white/10 hover:bg-gold/80 hover:text-black backdrop-blur-md border border-white/20 text-white p-2 rounded-full transition-all duration-300 opacity-0 group-hover/swap:opacity-100 translate-y-2 group-hover/swap:translate-y-0"
                title="Next Card"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
                </svg>
            </button>
        </div>
    );
};

export default CardSwap;
