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
  
  // Track dragging state for "Click and Drag" simulation
  const isDragging = useRef(false);
  
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
            // --- CHART PAN: Simulate Click and Drag ---
            const clientX = cx * window.innerWidth;
            const clientY = cy * window.innerHeight;

            if (!isDragging.current) {
                dispatchMouseEvent('mousedown', clientX, clientY);
                isDragging.current = true;
            }
            dispatchMouseEvent('mousemove', clientX, clientY);
            
            lastDragPos.current = { x: cx, y: cy };
        } else {
            // --- PAGE SCROLL REMOVED ---
            // User requested two/three finger scrolling (WHEEL) for all scrolling.
        }
        break;
        
      case 'WHEEL':
        if (isChartOpen) {
            // --- CHART ZOOM: Simulate Mouse Wheel ---
            const clientX = cursorPos.x * window.innerWidth;
            const clientY = cursorPos.y * window.innerHeight;
            const el = document.elementFromPoint(clientX, clientY);
            
            // UP = Zoom In (negative deltaY), DOWN = Zoom Out (positive deltaY)
            const deltaY = cmd.payload === 'UP' ? -100 : 100;
            
            if (el) {
                const ev = new WheelEvent('wheel', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: clientX,
                    clientY: clientY,
                    deltaY: deltaY,
                    ctrlKey: true // Often required for zoom on some widgets
                });
                el.dispatchEvent(ev);
                addLog(`Chart Zoom: ${cmd.payload}`, "SYSTEM");
            }
        } else {
            // --- PAGE SCROLL ---
            // Reduced step size for smoother animation feeling
            const amount = cmd.payload === 'UP' ? -100 : 100;
            window.scrollBy({ top: amount, behavior: 'smooth' });
        }
        break;
        
      case 'ZOOM':
        // --- TIMEFRAME ZOOM (PINCH) ---
        // Keeps timeframe functionality separate from visual scroll/zoom
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
            // Could add click simulation here if needed
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
        
        // Handle Drag Release
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