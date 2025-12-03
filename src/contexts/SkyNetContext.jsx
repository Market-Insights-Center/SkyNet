import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SkyNetContext = createContext();

export const useSkyNet = () => useContext(SkyNetContext);

// TradingView Intervals
const INTERVALS = ['1M', '1W', 'D', '240', '60', '15'];

export const SkyNetProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  
  const [cursorPos, setCursorPos] = useState({ x: 0.5, y: 0.5 });
  const [cursorState, setCursorState] = useState('open'); 
  
  const [chartTicker, setChartTicker] = useState(null); 
  const [chartInterval, setChartInterval] = useState('D'); 

  // Refs for loop access
  const chartTickerRef = useRef(chartTicker);
  const chartIntervalRef = useRef(chartInterval);
  const lastDragPos = useRef(null);
  
  useEffect(() => { chartTickerRef.current = chartTicker; }, [chartTicker]);
  useEffect(() => { chartIntervalRef.current = chartInterval; }, [chartInterval]);

  const navigate = useNavigate();
  const ws = useRef(null);

  const connect = () => {
    if (ws.current) return;
    const socket = new WebSocket('ws://localhost:8001');

    socket.onopen = () => {
      setIsConnected(true);
      addLog("System Connected", "SYSTEM");
    };

    socket.onclose = () => {
      setIsConnected(false);
      ws.current = null;
      addLog("System Disconnected", "ERROR");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleCommand(data);
      } catch (e) {}
    };

    ws.current = socket;
  };

  const disconnect = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  };

  const addLog = (msg, type = "SYSTEM") => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { message: msg, timestamp, type }].slice(-50));
  };

  const handleCommand = (cmd) => {
    const isChartOpen = !!chartTickerRef.current;
    
    if (cmd.action === 'VOICE_HEARD') {
      addLog(`"${cmd.payload}"`, 'VOICE');
      return; 
    }
    if (cmd.log) addLog(cmd.log, 'SYSTEM');

    switch (cmd.action) {
      case 'TERMINATE':
        addLog("TERMINATING SESSION...", "ERROR");
        setTimeout(() => window.close(), 1500);
        break;

      case 'NAVIGATE':
        setChartTicker(null);
        navigate(cmd.payload);
        break;
      
      case 'DRAG':
        setCursorState('closed');
        const cx = cmd.payload.x;
        const cy = cmd.payload.y;
        setCursorPos({ x: cx, y: cy });

        if (isChartOpen) {
            // --- CHART PAN (Arrows) ---
            if (lastDragPos.current) {
                const dx = cx - lastDragPos.current.x;
                if (Math.abs(dx) > 0.001) {
                    const key = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
                    // Repeat events for faster pan
                    for(let i=0; i<3; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true }));
                }
            }
            lastDragPos.current = { x: cx, y: cy };
        } else {
            // --- PAGE SCROLL ---
            if (cy < 0.2) window.scrollBy({ top: -30, behavior: 'auto' });
            if (cy > 0.8) window.scrollBy({ top: 30, behavior: 'auto' });
        }
        break;
        
      case 'WHEEL':
        if (isChartOpen) {
            // --- VISUAL ZOOM (Keys) ---
            const key = cmd.payload === 'UP' ? 'ArrowUp' : 'ArrowDown';
            for(let i=0; i<3; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true }));
            addLog(`Chart Zoom: ${cmd.payload}`, "SYSTEM");
        } else {
            // Page Scroll
            const amount = cmd.payload === 'UP' ? -150 : 150;
            window.scrollBy({ top: amount, behavior: 'smooth' });
        }
        break;
        
      case 'ZOOM':
        // --- TIMEFRAME ZOOM ---
        if (isChartOpen) {
            const currentInt = chartIntervalRef.current;
            const idx = INTERVALS.indexOf(currentInt);
            let newIdx = idx;
            
            if (cmd.payload === 'IN') newIdx = Math.min(idx + 1, INTERVALS.length - 1);
            if (cmd.payload === 'OUT') newIdx = Math.max(idx - 1, 0); 
            
            if (newIdx !== idx) {
                setChartInterval(INTERVALS[newIdx]);
                addLog(`Timeframe: ${INTERVALS[newIdx]}`, "SYSTEM");
            }
        }
        break;

      case 'RESET_VIEW':
        if (isChartOpen) {
            setChartInterval('D');
            addLog("Chart Reset", "SYSTEM");
        }
        break;

      case 'CLOSE_CHART':
        setChartTicker(null);
        break;

      case 'CLICK':
        if (isChartOpen) {
            addLog("Interact: Chart", "SYSTEM");
        } else {
            const x = window.innerWidth * cursorPos.x;
            const y = window.innerHeight * cursorPos.y;
            const cursorEl = document.getElementById('skynet-cursor');
            if (cursorEl) cursorEl.style.display = 'none';
            let el = document.elementFromPoint(x, y);
            if (cursorEl) cursorEl.style.display = 'flex';

            if (el) {
                // Find Interactive Parent
                let target = el;
                let depth = 0;
                while (target && depth < 5) {
                    if (['BUTTON', 'A', 'INPUT'].includes(target.tagName) || target.onclick) break;
                    target = target.parentElement;
                    depth++;
                }
                if (!target) target = el;

                target.click();
                
                target.style.outline = '2px solid cyan';
                setTimeout(() => target.style.outline = 'none', 150);
                
                addLog(`Clicked: ${target.tagName}`, "SYSTEM");
            }
        }
        break;

      case 'OPEN_CHART':
        setChartInterval('D');
        setChartTicker(cmd.payload);
        break;

      case 'CURSOR':
        setCursorPos({ x: cmd.payload.x, y: cmd.payload.y });
        setCursorState(cmd.payload.state || 'open');
        if (cmd.payload.state === 'open') lastDragPos.current = null;
        break;

      case 'RESET':
        if (isChartOpen) setChartTicker(null);
        break;

      default: break;
    }
  };

  return (
    <SkyNetContext.Provider value={{ 
      connect, disconnect, isConnected, logs, cursorPos, cursorState,
      chartTicker, setChartTicker, chartInterval
    }}>
      {children}
    </SkyNetContext.Provider>
  );
};