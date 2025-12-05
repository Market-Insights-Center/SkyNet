import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SkyNetContext = createContext();

export const useSkyNet = () => useContext(SkyNetContext);

// TradingView Intervals
const INTERVALS = ['1M', '1W', 'D', '240', '60', '15'];

// --- DYNAMIC CONNECTION LOGIC ---
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const getWebSocketUrl = () => {
    // If API_URL is https://myvps.com, WS should be wss://myvps.com:8001
    // If API_URL is http://localhost:8000, WS should be ws://localhost:8001
    try {
        if (!import.meta.env.VITE_API_URL) return 'ws://localhost:8001';
        
        const url = new URL(import.meta.env.VITE_API_URL);
        const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        // Assuming SkyNet script runs on port 8001 on the VPS
        return `${protocol}//${url.hostname}:8001`;
    } catch (e) {
        console.warn("Error parsing VITE_API_URL, defaulting to localhost WS");
        return 'ws://localhost:8001';
    }
};

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
  const isDragging = useRef(false);
  
  useEffect(() => { chartTickerRef.current = chartTicker; }, [chartTicker]);
  useEffect(() => { chartIntervalRef.current = chartInterval; }, [chartInterval]);

  const navigate = useNavigate();
  const ws = useRef(null);

  // --- CONNECT TO WEBSOCKET ---
  const connect = () => {
    if (ws.current) return;
    
    // Auto-start backend if possible (via HTTP toggle)
    toggleSkyNet('start');

    const wsUrl = getWebSocketUrl();
    const socket = new WebSocket(wsUrl);

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

  // --- TOGGLE BACKEND (FIXED FETCH URL) ---
  const toggleSkyNet = async (action) => {
    try {
        // Uses the correct API base URL (localhost or VPS)
        await fetch(`${API_BASE_URL}/api/skynet/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
    } catch (error) {
        console.error("SkyNet Toggle Error:", error);
    }
  };

  const addLog = (msg, type = "SYSTEM") => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { message: msg, timestamp, type }].slice(-50));
  };

  // Helper to simulate mouse events
  const dispatchMouseEvent = (type, x, y, buttons = 1) => {
    const el = document.elementFromPoint(x, y);
    if (el) {
      const ev = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        buttons: buttons
      });
      el.dispatchEvent(ev);
    }
  };

  const handleCommand = (cmd) => {
    const isChartOpen = !!chartTickerRef.current;
    const isActiveTab = window.location.pathname.includes('/active-chart');
    
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

        if (isChartOpen || isActiveTab) {
            const clientX = cx * window.innerWidth;
            const clientY = cy * window.innerHeight;
            if (!isDragging.current) {
                dispatchMouseEvent('mousedown', clientX, clientY);
                isDragging.current = true;
            }
            dispatchMouseEvent('mousemove', clientX, clientY);
            lastDragPos.current = { x: cx, y: cy };
        } 
        break;
        
      case 'WHEEL':
        if (isChartOpen) {
            if (!isActiveTab) {
                const ticker = chartTickerRef.current;
                addLog("Opening Chart in Tab...", "SYSTEM");
                setChartTicker(null); 
                window.open(`/active-chart?ticker=${ticker}&skynet=true`, '_blank');
            } else {
                const clientX = cursorPos.x * window.innerWidth;
                const clientY = cursorPos.y * window.innerHeight;
                const el = document.elementFromPoint(clientX, clientY);
                const deltaY = cmd.payload === 'UP' ? -100 : 100;
                
                if (el) {
                    const ev = new WheelEvent('wheel', {
                        bubbles: true, cancelable: true, view: window,
                        clientX: clientX, clientY: clientY, deltaY: deltaY, ctrlKey: true
                    });
                    el.dispatchEvent(ev);
                    addLog(`Chart Zoom: ${cmd.payload}`, "SYSTEM");
                }
            }
        } else {
            const amount = cmd.payload === 'UP' ? -100 : 100;
            window.scrollBy({ top: amount, behavior: 'smooth' });
        }
        break;
        
      case 'ZOOM':
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
        if (isChartOpen && !isActiveTab) {
             setChartTicker(null);
             addLog("Chart Overlay Closed", "SYSTEM");
        } else if (isActiveTab) {
             window.close();
        }
        break;

      case 'CLICK':
        if (isChartOpen || isActiveTab) {
             const x = window.innerWidth * cursorPos.x;
             const y = window.innerHeight * cursorPos.y;
             
             const el = document.elementFromPoint(x,y);
             if(el) {
                const prev = el.style.outline;
                el.style.outline = "2px solid cyan";
                setTimeout(()=>el.style.outline=prev, 150);
             }
             
             dispatchMouseEvent('mousedown', x, y);
             dispatchMouseEvent('mouseup', x, y);
             dispatchMouseEvent('click', x, y);
             addLog("Click Dispatch", "SYSTEM");
        } else {
            const x = window.innerWidth * cursorPos.x;
            const y = window.innerHeight * cursorPos.y;
            const cursorEl = document.getElementById('skynet-cursor');
            if (cursorEl) cursorEl.style.display = 'none';

            let el = document.elementFromPoint(x, y);
            
            if (el) {
                let target = el;
                let foundClickable = false;

                for(let i=0; i<5 && target; i++) {
                    const styles = window.getComputedStyle(target);
                    if (
                        ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
                        target.getAttribute('role') === 'button' ||
                        styles.cursor === 'pointer' || 
                        target.onclick
                    ) {
                        foundClickable = true;
                        break;
                    }
                    target = target.parentElement;
                }
                
                if (!foundClickable) target = el;

                const eventOptions = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, buttons: 1 };
                target.dispatchEvent(new MouseEvent('mousedown', eventOptions));
                target.dispatchEvent(new MouseEvent('mouseup', eventOptions));
                target.dispatchEvent(new MouseEvent('click', eventOptions));
                
                if (target.click) target.click();

                const originalOutline = target.style.outline;
                target.style.outline = '2px solid cyan';
                setTimeout(() => target.style.outline = originalOutline, 150);
                
                addLog(`Clicked: ${target.tagName}`, "SYSTEM");
            }
            if (cursorEl) cursorEl.style.display = 'flex';
        }
        break;

      case 'OPEN_CHART':
        setChartInterval('D');
        setChartTicker(cmd.payload);
        break;

      case 'CURSOR':
        setCursorPos({ x: cmd.payload.x, y: cmd.payload.y });
        setCursorState(cmd.payload.state || 'open');
        
        if (cmd.payload.state === 'open' && isDragging.current) {
            const clientX = cmd.payload.x * window.innerWidth;
            const clientY = cmd.payload.y * window.innerHeight;
            dispatchMouseEvent('mouseup', clientX, clientY);
            isDragging.current = false;
            lastDragPos.current = null;
        }
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