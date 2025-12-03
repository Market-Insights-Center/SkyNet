import React, { useEffect, useRef } from 'react';
import { useSkyNet } from '../contexts/SkyNetContext';
import { X, Activity, Cpu, Wifi, Radio, Hand, Grab, Maximize, MousePointer2, Power, ArrowUp, RefreshCw, Clock } from 'lucide-react';

const SkyNetOverlay = () => {
  const { 
    isConnected, logs, cursorPos, cursorState,
    chartTicker, setChartTicker, chartInterval 
  } = useSkyNet();
  
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (!isConnected) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] font-mono h-screen w-screen overflow-hidden">
      
      {/* 1. STATUS HEADER */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 z-[10005]">
        <div className="flex items-center gap-2 bg-black/80 border border-cyan-500/50 px-4 py-2 rounded text-cyan-400 shadow-md backdrop-blur-md">
          <Activity className="w-4 h-4 animate-pulse text-cyan-300" />
          <span className="font-bold tracking-widest text-sm">SKYNET: ONLINE</span>
        </div>
      </div>

      {/* 2. CURSOR */}
      <div 
        id="skynet-cursor"
        className="absolute transition-transform duration-75 ease-out pointer-events-none z-[10010] text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
        style={{
          left: `${cursorPos.x * 100}%`,
          top: `${cursorPos.y * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {cursorState === 'closed' ? (
            <Grab className="w-8 h-8 fill-cyan-900/50" strokeWidth={1.5} />
        ) : (
            <Hand className="w-8 h-8 fill-cyan-900/50" strokeWidth={1.5} />
        )}
      </div>

      {/* 3. SIDEBAR */}
      <div className="fixed top-24 right-4 w-72 bottom-4 bg-black/90 border border-cyan-500/30 pointer-events-auto flex flex-col shadow-2xl backdrop-blur-sm rounded-lg overflow-hidden z-[10005]">
        <div className="p-2 border-b border-cyan-500/30 bg-cyan-900/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-cyan-400">
            <Cpu className="w-4 h-4" />
            <span className="font-bold text-xs tracking-wider">NEURAL FEED</span>
          </div>
          <Wifi className="w-3 h-3 text-green-500 animate-pulse" />
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-[10px] scrollbar-thin scrollbar-thumb-cyan-900">
          {logs.length === 0 && (
            <div className="text-gray-600 text-center mt-10">Awaiting Gestures...</div>
          )}
          {logs.map((log, i) => (
            <div key={i} className={`flex flex-col border-l-2 pl-2 ${
              log.type === 'VOICE' ? 'border-purple-500' : 
              log.type === 'ERROR' ? 'border-red-500' : 'border-cyan-500'
            }`}>
              <div className="flex justify-between opacity-50 text-gray-400 mb-0.5">
                <span>{log.timestamp}</span>
                <span>{log.type}</span>
              </div>
              <span className={`${
                log.type === 'VOICE' ? 'text-purple-300' : 
                log.type === 'ERROR' ? 'text-red-400' : 'text-cyan-100'
              }`}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        <div className="p-3 border-t border-cyan-500/30 text-[10px] text-gray-400 bg-black/90 shrink-0">
          {chartTicker ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-cyan-300 border-b border-white/10 pb-1">
                <Radio className="w-3 h-3 animate-pulse text-red-500"/>
                <span className="font-bold">MODE: CHART INTERACT</span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                <div className="flex items-center gap-2"><ArrowUp className="w-3 h-3 text-cyan-500"/> <span>✌️/ W: VISUAL ZOOM</span></div>
                <div className="flex items-center gap-2"><Grab className="w-3 h-3 text-cyan-500"/> <span>FIST: PAN CHART</span></div>
                <div className="flex items-center gap-2"><Maximize className="w-3 h-3 text-cyan-500"/> <span>PINCH: TIMEFRAME</span></div>
                <div className="flex items-center gap-2"><RefreshCw className="w-3 h-3 text-yellow-500"/> <span>SHAKA: RESET</span></div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
               <div className="flex items-center gap-2 text-cyan-300 border-b border-white/10 pb-1">
                <MousePointer2 className="w-3 h-3"/>
                <span className="font-bold">MODE: NAVIGATION</span>
              </div>
              <div className="grid grid-cols-1 gap-1">
                <div className="flex items-center gap-2"><Hand className="w-3 h-3 text-cyan-500"/> <span>OPEN HAND: MOVE</span></div>
                <div className="flex items-center gap-2"><MousePointer2 className="w-3 h-3 text-cyan-500"/> <span>PINCH: CLICK</span></div>
                <div className="flex items-center gap-2"><Grab className="w-3 h-3 text-cyan-500"/> <span>FIST: SCROLL PAGE</span></div>
                <div className="flex items-center gap-2 text-red-400 pt-1 border-t border-white/10"><Power className="w-3 h-3"/> <span>🤘 ROCK ON: TERMINATE</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. CHART MODAL (Resizable & Centered) */}
      {chartTicker && (
        <div className="pointer-events-auto fixed z-[10000] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center m-4">
          <div 
            className="bg-gray-900 border border-cyan-500 rounded-lg flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden resize-y min-w-[600px] min-h-[400px] w-[1000px] h-[700px] max-w-[calc(100vw-22rem)] max-h-[85vh] relative"
          >
            {/* Toolbar */}
            <div className="h-10 bg-gray-800 border-b border-gray-700 flex justify-between items-center px-4 shrink-0 z-50">
               <div className="flex items-center gap-3">
                  <div className="bg-black/50 px-2 py-0.5 rounded text-cyan-400 font-bold text-xs flex items-center gap-2 border border-cyan-500/30">
                    <Radio className="w-2 h-2 animate-pulse text-red-500" />
                    {chartTicker}
                  </div>
                  <div className="text-[10px] text-gray-400 hidden md:flex gap-2 items-center">
                    <Clock className="w-3 h-3" />
                    <span>TIMEFRAME: {chartInterval}</span>
                  </div>
               </div>
               
               <button 
                  onClick={() => setChartTicker(null)}
                  className="bg-red-500/10 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded text-[10px] font-bold border border-red-500/30 transition-colors flex items-center gap-1"
               >
                  <X className="w-3 h-3" /> CLOSE
               </button>
            </div>

            {/* Content (Native Iframe) */}
            <div className="flex-1 relative bg-black w-full h-full overflow-hidden">
                <iframe 
                    key={`${chartTicker}-${chartInterval}`} 
                    src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${chartTicker}&interval=${chartInterval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=${chartTicker}`}
                    className="w-full h-full border-none"
                    title={`Chart ${chartTicker}`}
                    allowTransparency="true"
                    allowFullScreen
                />
                
                {/* Resize Handle Hint */}
                <div className="absolute bottom-1 right-1 w-4 h-4 bg-cyan-500/20 rounded-br cursor-se-resize pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkyNetOverlay;