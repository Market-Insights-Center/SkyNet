import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SingularityHelpModal = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="glass-panel border-white/20 rounded-xl p-8 max-w-2xl w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-widest">SINGULARITY PROTOCOL</h2>
                                <p className="text-cyan-400 text-xs font-mono mt-1">OPERATIONAL MANUAL V1.0</p>
                            </div>
                            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-6 text-gray-300 text-sm font-mono leading-relaxed h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                            {/* Section 1 */}
                            <div className="bg-white/5 p-4 rounded border-l-2 border-cyan-500">
                                <h3 className="text-lg font-bold text-white mb-2">1. The Neural Stream (Left Panel)</h3>
                                <p>
                                    This is your command center. Interact with **Prometheus (Analyst)** for deep dives or **Kronos (Governor)** for execution.
                                    <br /><br />
                                    <span className="text-cyan-400">Example Commands:</span>
                                    <ul className="list-disc ml-5 mt-1 space-y-1 text-xs">
                                        <li>"Sentiment on $NVDA" (Spawns a Sentiment Node)</li>
                                        <li>"Quickscore TSLA" (Spawns a Technical Card)</li>
                                        <li>"/scan Convergence" (Triggers Kronos Sentinel Scan)</li>
                                    </ul>
                                </p>
                            </div>

                            {/* Section 2 */}
                            <div className="bg-white/5 p-4 rounded border-l-2 border-amber-500">
                                <h3 className="text-lg font-bold text-white mb-2">2. The Visual Canvas (Right Panel)</h3>
                                <p>
                                    Data is physical here. When the AI generates a report, it manifests as a **Floating Module**.
                                    <br /><br />
                                    <span className="text-amber-400">Interactions:</span>
                                    <ul className="list-disc ml-5 mt-1 space-y-1 text-xs">
                                        <li>**Drag**: Organize your workspace freely.</li>
                                        <li>**Minimize**: Use the `[ - ]` button on any card to collapse it.</li>
                                        <li>**Persistence**: Modules stay active while you work.</li>
                                    </ul>
                                </p>
                            </div>

                            {/* Section 3 */}
                            <div className="bg-white/5 p-4 rounded border-l-2 border-purple-500">
                                <h3 className="text-lg font-bold text-white mb-2">3. Connectivity & Advanced Workflows</h3>
                                <p>
                                    Use the canvas to chain logic (Concept):
                                    <br /><br />
                                    <span className="text-purple-400">Synthesis Example:</span>
                                    <br />
                                    1. Generate a **Risk Assessment** (`Check Risk`).
                                    <br />
                                    2. Generate a **Stock Analysis** (`Analyze AAPL`).
                                    <br />
                                    3. Ask the AI: *"Correlate the Risk Node with the AAPL Node."*
                                    <br />
                                    <span className="text-xs italic opacity-50 text-gray-400">The system context-aware engine sees what is on your canvas.</span>
                                </p>
                            </div>

                            <div className="text-center text-xs text-gray-500 mt-8">
                                SYSTEM STATUS: <span className="text-green-500">ONLINE</span> • LATENCY: 24ms
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SingularityHelpModal;
