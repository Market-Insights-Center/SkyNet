import React, { useEffect, useRef, useState } from 'react';
import { useSkyNet } from '../contexts/SkyNetContext';
import { Cpu, Maximize, Minus, X, Power, HelpCircle } from 'lucide-react';

const SidebarPage = () => {
    const { logs, shutdownSystem, connect, isConnected } = useSkyNet();
    const logsEndRef = useRef(null);

    useEffect(() => {
        // Auto-connect ONLY if not already connected (prevents double connect attempts)
        if (!isConnected) connect();
    }, [connect, isConnected]);

    useEffect(() => {
        document.title = "SkyNet Feed";
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    const handleTerminate = async () => {
        try { await shutdownSystem(); window.close(); } catch (e) { }
    };

    const textStyle = { fontSize: '11px', lineHeight: '1.4' };

    return (
        <div className="w-screen h-screen bg-black/95 text-cyan-100 font-mono border-l border-cyan-500/30 flex flex-col overflow-hidden">
            {/* HEADER */}
            <div className="p-2 border-b border-cyan-500/30 bg-cyan-900/10 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center gap-2 text-cyan-400">
                    <Cpu className="w-4 h-4" />
                    <span className="font-bold text-xs tracking-wider">NEURAL FEED</span>
                </div>
                <button onClick={() => window.close()} className="hover:bg-red-500/20 p-1 rounded text-red-400">
                    <X className="w-3 h-3" />
                </button>
            </div>

            {/* LOGS */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono scrollbar-thin scrollbar-thumb-cyan-900" style={textStyle}>
                {logs.length === 0 && (
                    <div className="text-gray-600 text-center mt-10 italic">Awaiting Input...</div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className={`flex flex-col border-l-2 pl-2 py-0.5 ${log.type === 'VOICE' ? 'border-purple-500' :
                        log.type === 'ERROR' ? 'border-red-500' : 'border-cyan-500'
                        }`}>
                        <div className="flex justify-between opacity-50 text-gray-500 text-[9px] uppercase tracking-tighter">
                            <span>{log.timestamp}</span>
                            <span>{log.type}</span>
                        </div>
                        <span className={`${log.type === 'VOICE' ? 'text-purple-300 font-semibold' :
                            log.type === 'ERROR' ? 'text-red-400' : 'text-cyan-100'
                            }`}>
                            {log.message}
                        </span>
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>

            {/* FOOTER */}
            <div className="p-2 border-t border-cyan-500/30 bg-gray-900/50 shrink-0 space-y-2">
                <button onClick={handleTerminate} className="w-full flex items-center justify-center gap-2 bg-red-900/40 hover:bg-red-900/70 text-red-200 py-1.5 rounded border border-red-500/30 transition-all text-xs font-bold uppercase tracking-wider">
                    <Power className="w-3 h-3" /> TERMINATE
                </button>
            </div>
        </div>
    );
};

export default SidebarPage;
