
import React, { useEffect } from 'react';
import { Hand, Mic, Activity, X } from 'lucide-react';

import LiquidBackground from '../components/LiquidBackground';

const ControlsPage = () => {
    useEffect(() => {
        document.title = "SkyNet Controls";
    }, []);

    return (
        <div className="w-screen h-screen bg-deep-black text-cyan-100 font-mono relative overflow-hidden">
            <LiquidBackground />

            <div className="absolute inset-0 z-10 flex flex-col backdrop-blur-3xl bg-black/60 border border-white/10">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 shrink-0 backdrop-blur-md shadow-lg">
                    <div className="flex items-center gap-2 text-cyan-400">
                        <Activity className="w-5 h-5" />
                        <h2 className="text-lg font-bold tracking-widest">SKYNET CONTROLS</h2>
                    </div>
                    <button onClick={() => window.close()} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* RIGHT HAND */}
                    <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-colors">
                        <div className="flex items-center gap-2 text-cyan-300 border-b border-cyan-500/30 pb-1 mb-2">
                            <Hand className="w-4 h-4" />
                            <h3 className="font-bold">RIGHT HAND</h3>
                        </div>
                        <ul className="space-y-3 text-xs text-gray-300">
                            <li><strong className="text-cyan-400">Index Point:</strong> Move Cursor</li>
                            <li><strong className="text-cyan-400">Pinch (Index):</strong> Click / Drag</li>
                            <li><strong className="text-cyan-400">2x Pinch:</strong> Double Click</li>
                            <li><strong className="text-cyan-400">Pinky+Thumb:</strong> Right Click</li>
                            <li><strong className="text-cyan-400">2 Fingers Up/Down:</strong> Scroll</li>
                            <li><strong className="text-cyan-400">Shaka 🤙:</strong> Toggle Sidebar</li>
                        </ul>
                    </div>

                    {/* LEFT HAND */}
                    <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-purple-500/30 transition-colors">
                        <div className="flex items-center gap-2 text-purple-300 border-b border-purple-500/30 pb-1 mb-2">
                            <Hand className="w-4 h-4" />
                            <h3 className="font-bold">LEFT HAND</h3>
                        </div>
                        <ul className="space-y-3 text-xs text-gray-300">
                            <li><strong className="text-purple-400">Open Palm (Hold):</strong> Freeze / Controls</li>
                            <li><strong className="text-purple-400">2 Fingers Up:</strong> Diction (Speech-to-Text)</li>
                            <li><strong className="text-purple-400">3 Fingers Up:</strong> Delete Word (1/sec)</li>
                            <li><strong className="text-purple-400">Mid+Thumb:</strong> Cycle Sensitivity</li>
                            <li><strong className="text-purple-400">Closed Fist:</strong> Reset Mouse</li>
                            <li><strong className="text-purple-400">Thumb+Pinky:</strong> Open TradingView</li>
                            <li><strong className="text-purple-400">Rock On (Index+Pinky):</strong> TERMINATE</li>
                        </ul>
                    </div>

                    {/* VOICE COMMANDS */}
                    <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-green-500/30 transition-colors">
                        <div className="flex items-center gap-2 text-green-300 border-b border-green-500/30 pb-1 mb-2">
                            <Mic className="w-4 h-4" />
                            <h3 className="font-bold">VOICE COMMANDS</h3>
                        </div>
                        <ul className="space-y-3 text-xs text-gray-300">
                            <li><strong className="text-green-400">"Open Chart [Ticker]"</strong><br /><span className="text-gray-500">e.g. "Open Chart NVDA"</span></li>
                            <li><strong className="text-green-400">"Start/Stop Diction"</strong><br /><span className="text-gray-500">Toggle typing mode</span></li>
                            <li><strong className="text-green-400">"Go to [Page]"</strong><br /><span className="text-gray-500">e.g. "Go to News"</span></li>
                            <li><strong className="text-green-400">"Sarah Connor"</strong><br /><span className="text-gray-500">System Shutdown</span></li>
                        </ul>
                    </div>
                </div>

                <div className="p-4 bg-black/50 text-[10px] text-gray-400 text-center border-t border-white/10 shrink-0 backdrop-blur">
                    SkyNet Neural Interface v2.5 • Systems Nominal
                </div>
            </div>
        </div>
    );
};

export default ControlsPage;
