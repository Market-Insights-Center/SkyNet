import React, { useEffect, useRef, useState } from 'react';
import { Camera } from '@mediapipe/camera_utils';
import { Hands } from '@mediapipe/hands';
import { useSkyNet } from '../contexts/SkyNetContext';

const SkyNetVision = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const { isConnected, handleCommand, disconnect } = useSkyNet();
    const [status, setStatus] = useState("Initializing Vision...");

    // Gesture State
    const lastGesture = useRef(null);
    const gestureStartTime = useRef(0);
    const cursorState = useRef({ x: 0.5, y: 0.5, smoothedX: 0.5, smoothedY: 0.5 });

    // Constants (tuned for JS)
    const SMOOTHING = 0.5; // High smoothing for jitter
    const CLICK_THRESHOLD = 0.03; // Distance between thumb/index
    const PINCH_HOLD_TIME = 200; // ms

    const lastClickTime = useRef(0);
    const isPinching = useRef(false);

    useEffect(() => {
        if (!isConnected) return;

        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });

        hands.onResults(onResults);

        if (videoRef.current) {
            const camera = new Camera(videoRef.current, {
                onFrame: async () => {
                    await hands.send({ image: videoRef.current });
                },
                width: 640,
                height: 480
            });
            camera.start();
            setStatus("Vision Active - Camera Online");
        }

        // Voice Recognition
        let recognition = null;
        if ('webkitSpeechRecognition' in window) {
            recognition = new window.webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.onresult = (event) => {
                const text = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
                processVoice(text);
            };
            recognition.start();
        }

        return () => {
            hands.close();
            if (recognition) recognition.stop();
        };
    }, [isConnected]);

    const onResults = (results) => {
        if (!canvasRef.current || !results.multiHandLandmarks) return;

        // Basic Drawing (Optional, for debug or overlay)
        // const ctx = canvasRef.current.getContext('2d');
        // ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        // drawConnectors(ctx, results.multiHandLandmarks, HAND_CONNECTIONS, ...);

        const landmarks = results.multiHandLandmarks; // Array of hands
        if (landmarks.length === 0) return;

        // Logic: Assuming Right Hand is Mouse (Index 0 usually, but need checking handedness if strictly required)
        // For simplicity, we take the first hand for cursor.
        const hand = landmarks[0];

        // 1. Cursor Movement (Index Finger Tip: 8)
        const indexTip = hand[8];
        const rawX = 1 - indexTip.x; // Mirror logic
        const rawY = indexTip.y;

        // Smoothing
        cursorState.current.smoothedX += (rawX - cursorState.current.smoothedX) * SMOOTHING;
        cursorState.current.smoothedY += (rawY - cursorState.current.smoothedY) * SMOOTHING;

        // Send to Electron
        if (window.electronAPI) {
            window.electronAPI.moveMouse(cursorState.current.smoothedX, cursorState.current.smoothedY);
        }

        // 2. Click Logic (Index Tip 8 vs Thumb Tip 4)
        const thumbTip = hand[4];
        const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);

        if (distance < CLICK_THRESHOLD) {
            if (!isPinching.current) {
                isPinching.current = true;
                if (window.electronAPI) window.electronAPI.clickMouse('left');
                // Debounce
                setTimeout(() => isPinching.current = false, 300);
            }
        }

        // 3. Special Gestures
        // Termination Triangle (Requires 2 hands, thumbs and indexes touching)
        // Not easily ported exactly without robust 2-hand logic.
        // Fallback: Use "Rock On" (Index + Pinky UP, others DOWN) for Termination on Left Hand?
        // Implementing simple "Shaka" for Sidebar toggle.
        // (Thumb extended, Pinky extended, others curled).

        // Detecting Shaka: 
        // Thumb Tip (4) is far from Index MCP (5)
        // Pinky Tip (20) high
        // Middle (12) / Ring (16) curled (Tip below PIP)

        const isPinkyUp = hand[20].y < hand[18].y;
        const isThumbUp = hand[4].y < hand[2].y; // Approx
        const isMiddleDown = hand[12].y > hand[10].y;
        const isRingDown = hand[16].y > hand[14].y;

        if (isPinkyUp && isThumbUp && isMiddleDown && isRingDown) {
            // SHAKA
            const now = Date.now();
            if (now - gestureStartTime.current > 1000) {
                handleCommand({ action: "TOGGLE_SIDEBAR" });
                gestureStartTime.current = now;
            }
        }
    };

    const processVoice = (text) => {
        console.log("Voice:", text);
        if (text.includes("open sidebar")) handleCommand({ action: "OPEN_SIDEBAR" });
        if (text.includes("close sidebar")) handleCommand({ action: "CLOSE_SIDEBAR" });
        if (text.includes("sarah connor")) {
            handleCommand({ action: "TERMINATE" });
            disconnect();
        }
        if (text.includes("go to news")) window.location.href = "/media-center";
    };

    if (!isConnected) return null;

    return (
        <div className="fixed bottom-4 right-4 w-48 h-36 bg-black/80 border border-cyan-500 rounded overflow-hidden z-[99999] pointer-events-none opacity-50 hover:opacity-100 transition-opacity">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-cyan-400 p-1 text-center">
                {status}
            </div>
        </div>
    );
};

export default SkyNetVision;
