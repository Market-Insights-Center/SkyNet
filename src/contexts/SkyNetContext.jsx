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
  const isDragging = useRef(false);

  useEffect(() => { chartTickerRef.current = chartTicker; }, [chartTicker]);
  useEffect(() => { chartIntervalRef.current = chartInterval; }, [chartInterval]);

  const navigate = useNavigate();
  const ws = useRef(null);

  const connect = () => {
    if (ws.current) return;

    // --- DYNAMIC HOST DETECTION ---
    // This automatically grabs 'localhost' when developing locally, 
    // and your VPS IP/Domain when deployed, ensuring the code works everywhere.
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const socketUrl = `${protocol}//${host}:8001`;

    const socket = new WebSocket(socketUrl);

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
      } catch (e) { }
    };

    ws.current = socket;
  };

  const disconnect = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  };

  const shutdownSystem = async () => {
    try {
      await fetch('http://localhost:8000/api/skynet/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      disconnect();
    } catch (e) {
      console.error("Shutdown Error", e);
      disconnect();
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
    // Check if we are currently on the full-page active chart tab
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
        // User requested "a new tab is opened to that page"
        // Check if it's a full URL or relative
        if (cmd.payload.startsWith('http')) {
          window.open(cmd.payload, '_blank');
        } else {
          // Construct full URL for local valid routes
          const url = window.location.origin + cmd.payload;
          window.open(url, '_blank');
        }
        break;

      case 'DRAG':
        setCursorState('closed');
        const cx = cmd.payload.x;
        const cy = cmd.payload.y;
        setCursorPos({ x: cx, y: cy });

        if (isChartOpen || isActiveTab) {
          // Standard Chart Drag (Pan)
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
            // --- CASE A: Overlay is Open, but NOT in new tab yet ---
            // Pop Out Logic
            const ticker = chartTickerRef.current;
            addLog("Opening Chart in Tab...", "SYSTEM");
            setChartTicker(null); // Close overlay locally
            window.open(`/active-chart?ticker=${ticker}&skynet=true`, '_blank');
          } else {
            // --- CASE B: We ARE in the new Active Chart Tab ---
            // Zoom/Scroll Logic for the Chart itself
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
          }
        } else {
          // --- STANDARD PAGE SCROLL ---
          const amount = cmd.payload === 'UP' ? -100 : 100;
          window.scrollBy({ top: amount, behavior: 'smooth' });
        }
        break;

      case 'ZOOM':
        // --- TIMEFRAME CHANGE ---
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
          // If we are in the dedicated tab, close the window
          window.close();
        }
        break;

      case 'CLICK':
        if (isChartOpen || isActiveTab) {
          // Basic click on overlay/chart
          const x = window.innerWidth * cursorPos.x;
          const y = window.innerHeight * cursorPos.y;

          // Visual feedback helper
          const el = document.elementFromPoint(x, y);
          if (el) {
            const prev = el.style.outline;
            el.style.outline = "2px solid cyan";
            setTimeout(() => el.style.outline = prev, 150);
          }

          dispatchMouseEvent('mousedown', x, y);
          dispatchMouseEvent('mouseup', x, y);
          dispatchMouseEvent('click', x, y);
          addLog("Click Dispatch", "SYSTEM");
        } else {
          // --- ROBUST CLICK HANDLING (Navigation Mode) ---
          const x = window.innerWidth * cursorPos.x;
          const y = window.innerHeight * cursorPos.y;

          const cursorEl = document.getElementById('skynet-cursor');
          if (cursorEl) cursorEl.style.display = 'none';

          let el = document.elementFromPoint(x, y);

          if (el) {
            let target = el;
            let foundClickable = false;

            for (let i = 0; i < 5 && target; i++) {
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
      connect, disconnect, shutdownSystem, isConnected, logs, cursorPos, cursorState,
      chartTicker, setChartTicker, chartInterval
    }}>
      {children}
    </SkyNetContext.Provider>
  );
};