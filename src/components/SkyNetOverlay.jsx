import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSkyNet } from '../contexts/SkyNetContext';
import { X, Activity, Cpu, Wifi, Radio, Hand, Grab, Maximize, MousePointer2, Power, ArrowUp, RefreshCw, Clock, Search, HelpCircle, Mic, Move } from 'lucide-react';

const SkyNetOverlay = () => {
  const {
    isConnected, logs, cursorPos, cursorState,
    chartTicker, setChartTicker, chartInterval, shutdownSystem
  } = useSkyNet();

  const logsEndRef = useRef(null);
  const location = useLocation();
  const [showControls, setShowControls] = React.useState(false);

  // Check if we are on the full-screen active chart page
  const isFullPageChart = location.pathname.includes('/active-chart');

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Function to manually open chart via sidebar
  // Function to manually open chart via sidebar
  const handleManualChart = () => {
    // Just open general Supercharts
    window.open("https://www.tradingview.com/chart", "_blank");
  };

  if (!isConnected) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] font-mono h-screen w-screen overflow-hidden">

      {/* 1. STATUS HEADER */}
      {/* Positioned on Right if sidebar is Left, or Left if sidebar is Right to avoid overlap */}
      <div className={`absolute top-4 ${isFullPageChart ? 'right-4' : 'left-4'} flex flex-col gap-1 z-[10005]`}>
        <div className="flex items-center gap-2 bg-black/80 border border-cyan-500/50 px-4 py-2 rounded text-cyan-400 shadow-md backdrop-blur-md">
          <Activity className="w-4 h-4 animate-pulse text-cyan-300" />
          <span className="font-bold tracking-widest text-sm">SKYNET: ONLINE</span>
        </div>
      </div>

      {/* 2. CURSOR REMOVED - SYSTEM CURSOR USED */}

      {/* 3. SIDEBAR - Default LEFT */}
      {/* Draggable logic can be added, for now fixed Left as requested */}
      <div className={`fixed top-24 bottom-4 w-72 bg-black/90 border border-cyan-500/30 pointer-events-auto flex flex-col shadow-2xl backdrop-blur-sm rounded-lg overflow-hidden z-[10005] left-4`}>

        <div className="p-2 border-b border-cyan-500/30 bg-cyan-900/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-cyan-400">
            <Cpu className="w-4 h-4" />
            <span className="font-bold text-xs tracking-wider">NEURAL FEED</span>
          </div>
          <Wifi className="w-3 h-3 text-green-500 animate-pulse" />
        </div>

        {/* LOGS AREA */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-[10px] scrollbar-thin scrollbar-thumb-cyan-900">
          {logs.length === 0 && (
            <div className="text-gray-600 text-center mt-10">Awaiting Gestures...</div>
          )}
          {logs.map((log, i) => (
            <div key={i} className={`flex flex-col border-l-2 pl-2 ${log.type === 'VOICE' ? 'border-purple-500' :
              log.type === 'ERROR' ? 'border-red-500' : 'border-cyan-500'
              }`}>
              <div className="flex justify-between opacity-50 text-gray-400 mb-0.5">
                <span>{log.timestamp}</span>
                <span>{log.type}</span>
              </div>
              <span className={`${log.type === 'VOICE' ? 'text-purple-300' :
                log.type === 'ERROR' ? 'text-red-400' : 'text-cyan-100'
                }`}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {/* SIDEBAR ACTIONS */}
        <div className="p-2 border-t border-cyan-500/30 bg-black/50 shrink-0">
          <button
            onClick={handleManualChart}
            className="w-full flex items-center justify-center gap-2 bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 py-2 rounded border border-cyan-500/30 transition-all text-xs font-bold"
          >
            <Search className="w-3 h-3" />
            MANUAL CHART
          </button>
          <button
            onClick={() => setShowControls(true)}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded border border-gray-600/30 transition-all text-xs font-bold mt-2"
          >
            <HelpCircle className="w-3 h-3" />
            CONTROLS MENU
          </button>
        </div>

        <div className="p-3 border-t border-cyan-500/30 text-[10px] text-gray-400 bg-black/90 shrink-0">
          {chartTicker ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-cyan-300 border-b border-white/10 pb-1">
                <Radio className="w-3 h-3 animate-pulse text-red-500" />
                <span className="font-bold">MODE: CHART INTERACT</span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                <div className="flex items-center gap-2"><Hand className="w-3 h-3 text-cyan-500" /> <span>SPIDER-MAN: CLOSE</span></div>
                <div className="flex items-center gap-2"><ArrowUp className="w-3 h-3 text-cyan-500" /> <span>2/3 FINGERS: ZOOM</span></div>
                <div className="flex items-center gap-2"><Maximize className="w-3 h-3 text-cyan-500" /> <span>PINCH: TIMEFRAME</span></div>
                <div className="flex items-center gap-2"><RefreshCw className="w-3 h-3 text-yellow-500" /> <span>SHAKA: RESET</span></div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-cyan-300 border-b border-white/10 pb-1">
                <MousePointer2 className="w-3 h-3" />
                <span className="font-bold">MODE: NAVIGATION</span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                <div className="flex items-center gap-2"><Hand className="w-3 h-3 text-cyan-500" /> <span>OPEN HAND: MOVE</span></div>
                <div className="flex items-center gap-2"><MousePointer2 className="w-3 h-3 text-cyan-500" /> <span>PINCH: CLICK</span></div>
                <div className="flex items-center gap-2"><ArrowUp className="w-3 h-3 text-cyan-500" /> <span>✌️/ W: SCROLL</span></div>
                <div className="flex items-center gap-2 text-red-400 pt-1 border-t border-white/10"><Power className="w-3 h-3" /> <span>🤘 ROCK ON: TERMINATE</span></div>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* 5. CONTROLS MODAL */}
      {showControls && (
        <div className="pointer-events-auto fixed inset-0 z-[10020] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900/95 border border-cyan-500/50 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.3)] max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden text-cyan-100 font-mono">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-cyan-500/30 bg-cyan-900/20">
              <div className="flex items-center gap-2 text-cyan-400">
                <Activity className="w-5 h-5" />
                <h2 className="text-lg font-bold tracking-widest">SKYNET CONTROLS</h2>
              </div>
              <button onClick={() => setShowControls(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Right Hand */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-cyan-300 border-b border-cyan-500/30 pb-1 mb-2">
                  <Hand className="w-4 h-4" />
                  <h3 className="font-bold">RIGHT HAND</h3>
                </div>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li><strong className="text-cyan-400">Pointer:</strong> Move Cursor</li>
                  <li><strong className="text-cyan-400">Pinch (Index):</strong> Left Click / Drag</li>
                  <li><strong className="text-cyan-400">Pinch (Middle):</strong> Right Click</li>
                  <li><strong className="text-cyan-400">2 Fingers Up/Down:</strong> Scroll</li>
                  <li><strong className="text-cyan-400">Swipe L/R:</strong> Prev/Next Tab</li>
                  <li><strong className="text-cyan-400">Swipe Down/Up:</strong> Close/New Tab</li>
                  <li><strong className="text-cyan-400">Thumbs Up/Down:</strong> Volume</li>
                  <li><strong className="text-cyan-400">"OK" Sign:</strong> Mute Toggle</li>
                  <li><strong className="text-cyan-400">Palm Push:</strong> Play/Pause Media</li>
                  <li><strong className="text-cyan-400">"L" Shape:</strong> Back Page</li>
                </ul>
              </div>

              {/* Left Hand */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-purple-300 border-b border-purple-500/30 pb-1 mb-2">
                  <Hand className="w-4 h-4" />
                  <h3 className="font-bold">LEFT HAND</h3>
                </div>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li><strong className="text-purple-400">Closed Fist:</strong> Reset Mouse Center</li>
                  <li><strong className="text-purple-400">Thumb + Pinky:</strong> Open TradingView</li>
                  <li><strong className="text-purple-400">Rock On:</strong> Terminate SkyNet</li>
                  {/* <li><strong className="text-purple-400">Pinch (Middle):</strong> Sensitivity Cycle</li> */}
                </ul>
              </div>

              {/* Voice */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-300 border-b border-green-500/30 pb-1 mb-2">
                  <Mic className="w-4 h-4" />
                  <h3 className="font-bold">VOICE COMMANDS</h3>
                </div>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li><strong className="text-green-400">"Open Chart [Ticker]"</strong><br /><span className="text-gray-500">e.g. "Open Chart Apple"</span></li>
                  <li><strong className="text-green-400">"Navigate to [Page]"</strong><br /><span className="text-gray-500">e.g. "Navigate to News"</span></li>
                  <li><strong className="text-green-400">"Sarah Connor"</strong><br /><span className="text-gray-500">Immediate Termination</span></li>
                </ul>
              </div>

            </div>

            <div className="p-4 bg-black/50 text-[10px] text-gray-500 text-center border-t border-gray-800">
              SkyNet Neural Interface v2.0 • Systems Nominal
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkyNetOverlay;