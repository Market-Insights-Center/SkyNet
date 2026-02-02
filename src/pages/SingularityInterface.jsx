import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SingularityCanvas from '../components/SingularityCanvas';
import SingularityStream from '../components/SingularityStream'; // Assuming this exists
import { FaNetworkWired, FaPowerOff, FaShieldAlt, FaMicrophone, FaEye } from 'react-icons/fa'; // Ensure react-icons is installed
import { useOrion } from '../contexts/OrionContext';

const SingularityInterface = () => {
    const { connect, disconnect, isConnected, sendCommand, isVisionActive, isAudioActive } = useOrion();
    const [systemStatus, setSystemStatus] = useState('IDLE');
    const [streamData, setStreamData] = useState([]);

    // Sync status and auto-start vision
    useEffect(() => {
        if (isConnected) {
            setSystemStatus('CONNECTED // SYSTEM ONLINE');
            sendCommand('START_VISION');
        } else {
            setSystemStatus('IDLE');
        }
    }, [isConnected]);

    const handleConnect = () => {
        if (isConnected) {
            setSystemStatus('DISCONNECTING...');
            // Optional: Send stop command before disconnecting
            sendCommand('STOP_VISION');
            setTimeout(() => disconnect(), 500);
        } else {
            setSystemStatus('INITIALIZING HANDSHAKE...');
            connect();
        }
    };

    return (
        <div className="relative w-full h-screen overflow-hidden text-cyan-50 font-mono">
            {/* Background Animation */}
            <SingularityCanvas active={isConnected} />

            {/* Main Overlay */}
            <div className="relative z-10 w-full h-full flex flex-col justify-between p-6 pointer-events-none">

                {/* --- Header Branding --- */}
                <header className="flex justify-between items-center pointer-events-auto">
                    <div className="flex items-center space-x-4 backdrop-blur-md bg-black/40 p-3 rounded-lg border border-cyan-900/50">
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-cyan-400 animate-pulse' : 'bg-red-500'}`} />
                        <div>
                            <h1 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                                M.I.C. SINGULARITY
                            </h1>
                            <p className="text-xs text-cyan-700">MARKET INSIGHTS CENTER // CORE</p>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex gap-2">
                        {/* Audio Indicator */}
                        <div className={`hidden md:flex items-center gap-2 backdrop-blur-md bg-black/40 px-3 py-2 rounded-full border ${isAudioActive ? 'border-amber-500/50 text-amber-400' : 'border-cyan-900/30 text-gray-600'}`}>
                            <FaMicrophone className={isAudioActive ? 'animate-pulse' : ''} size={12} />
                            <span className="text-[10px] tracking-widest">{isAudioActive ? 'EARS' : 'OFF'}</span>
                        </div>

                        {/* Vision Indicator */}
                        <div className={`hidden md:flex items-center gap-2 backdrop-blur-md bg-black/40 px-3 py-2 rounded-full border ${isVisionActive ? 'border-green-500/50 text-green-400' : 'border-cyan-900/30 text-gray-600'}`}>
                            <FaEye className={isVisionActive ? 'animate-pulse' : ''} size={12} />
                            <span className="text-[10px] tracking-widest">{isVisionActive ? 'EYES' : 'OFF'}</span>
                        </div>

                        <div className="hidden md:block backdrop-blur-md bg-black/40 px-4 py-2 rounded-full border border-cyan-900/30">
                            <span className="text-xs tracking-widest">{systemStatus}</span>
                        </div>
                    </div>
                </header>

                {/* --- Center Interaction --- */}
                <main className="flex-1 flex flex-col items-center justify-center pointer-events-auto">
                    <AnimatePresence mode="wait">
                        {!isConnected ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                className="text-center"
                            >
                                <button
                                    onClick={handleConnect}
                                    className="group relative px-8 py-4 bg-black/50 overflow-hidden rounded-none border border-cyan-500/50 hover:border-cyan-400 transition-all duration-300"
                                >
                                    <div className="absolute inset-0 w-0 bg-cyan-900/20 transition-all duration-[250ms] ease-out group-hover:w-full opacity-50" />
                                    <span className="relative flex items-center gap-3 text-cyan-400 tracking-[0.2em] group-hover:text-white transition-colors">
                                        <FaNetworkWired /> INITIATE CONNECTION
                                    </span>
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="w-full max-w-4xl h-[60vh] flex gap-4"
                            >
                                {/* Left Panel: Stream */}
                                <div className="flex-1 bg-black/60 backdrop-blur-sm border border-cyan-900/50 rounded-lg p-4 flex flex-col relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
                                    <h3 className="text-sm text-cyan-600 mb-2 flex items-center gap-2">
                                        <FaShieldAlt /> LIVE DATA STREAM
                                    </h3>

                                    {/* Singularity Stream Component Injection */}
                                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                                        <SingularityStream active={isConnected} mode="ANALYST" />
                                    </div>
                                </div>

                                {/* Right Panel: Metrics (Optional Visuals) */}
                                <div className="w-1/3 bg-black/60 backdrop-blur-sm border border-cyan-900/50 rounded-lg p-4 hidden md:flex flex-col gap-4">
                                    <div className="h-1/2 border border-dashed border-cyan-900/50 p-2 flex items-center justify-center">
                                        <span className="text-xs text-cyan-800 animate-pulse">A.I. PROCESSING...</span>
                                    </div>
                                    <div className="h-1/2 border border-dashed border-cyan-900/50 p-2 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="text-4xl text-cyan-500 font-bold">98.4%</div>
                                            <div className="text-xs text-cyan-700">CONFIDENCE</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>

                {/* --- Footer Controls --- */}
                <footer className="flex justify-center pb-4 pointer-events-auto">
                    {isConnected && (
                        <button
                            onClick={handleConnect}
                            className="px-6 py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-xs tracking-widest rounded transition-colors flex items-center gap-2"
                        >
                            <FaPowerOff /> TERMINATE SESSION
                        </button>
                    )}
                </footer>

            </div>

            {/* Scanline Overlay Effect */}
            <div className="absolute inset-0 pointer-events-none z-20 opacity-10"
                style={{
                    backgroundImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.5) 50%)',
                    backgroundSize: '100% 4px'
                }}
            />
            <div className="absolute inset-0 pointer-events-none z-10" style={{ background: 'radial-gradient(circle, transparent 60%, black 100%)' }} />
        </div>
    );
};

export default SingularityInterface;