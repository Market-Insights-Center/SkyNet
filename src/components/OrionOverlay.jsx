import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOrion } from '../contexts/OrionContext';
import {
  X, Activity, Cpu, Wifi, Radio, Hand, Maximize, MousePointer2,
  Power, ArrowUp, Search, HelpCircle, Mic, Minus, Layers, Eye
} from 'lucide-react';

const OrionOverlay = () => {
  const {
    isConnected, logs, shutdownSystem, chartTicker
  } = useOrion();

  const logsEndRef = useRef(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Custom Event Listener for Backend Commands
  useEffect(() => {
    const handleCustomEvent = (e) => {
      const { action } = e.detail;
      if (action === "OPEN_SIDEBAR") setShowSidebar(true);
      if (action === "CLOSE_SIDEBAR") setShowSidebar(false);
      if (action === "OPEN_CONTROLS") setShowControls(true);
      if (action === "CLOSE_CONTROLS") setShowControls(false);
      if (action === "TOGGLE_SIDEBAR") setShowSidebar(prev => !prev);
    };

    window.addEventListener('ORION_COMMAND', handleCustomEvent);
    return () => window.removeEventListener('ORION_COMMAND', handleCustomEvent);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleManualChart = () => {
    window.open("https://www.tradingview.com/chart", "_blank");
  };

  const handleTerminate = async () => {
    try { await shutdownSystem(); } catch (e) { }
  };

  if (!isConnected) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[2147483647] font-mono h-screen w-screen overflow-hidden">

      {/* 1. STATUS HEADER */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 z-[2147483647]">
        <div className="flex items-center gap-2 bg-black/80 border border-cyan-500/50 px-4 py-2 rounded text-cyan-400 shadow-md backdrop-blur-md">
          <Activity className="w-4 h-4 animate-pulse text-cyan-300" />
          <span className="font-bold tracking-widest text-sm">ORION: ONLINE</span>
        </div>
      </div>

      {/* 2. SIDEBAR REMOVED - NOW DETACHED WINDOW */}

      {/* 3. CONTROLS WINDOW (Toggled by Left Hand Open Palm) */}
      {showControls && (
        <div className="pointer-events-auto fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-gray-900/95 border border-cyan-500/50 rounded-lg shadow-[0_0_50px_rgba(6,182,212,0.4)] max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden text-cyan-100 font-mono ring-1 ring-cyan-400">
            <div className="flex items-center justify-between p-4 border-b border-cyan-500/30 bg-cyan-900/20">
              <div className="flex items-center gap-2 text-cyan-400">
                <Activity className="w-5 h-5" />
                <h2 className="text-lg font-bold tracking-widest">ORION CONTROLS</h2>
              </div>
              <button onClick={() => setShowControls(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
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

              <div className="space-y-4">
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

              <div className="space-y-4">
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

            <div className="p-4 bg-black/50 text-[10px] text-gray-500 text-center border-t border-gray-800">
              Orion Neural Interface v2.5 • Systems Nominal
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrionOverlay;