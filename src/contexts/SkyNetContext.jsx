import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const SkyNetContext = createContext();

export const useSkyNet = () => useContext(SkyNetContext);

// TradingView Intervals
const INTERVALS = ['1M', '1W', 'D', '240', '60', '15'];

export const SkyNetProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [isElectron, setIsElectron] = useState(false);
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
  const controlsWindowRef = useRef(null);
  const sidebarWindowRef = useRef(null);

  useEffect(() => { chartTickerRef.current = chartTicker; }, [chartTicker]);
  useEffect(() => { chartIntervalRef.current = chartInterval; }, [chartInterval]);

  const navigate = useNavigate();
  const ws = useRef(null);

  const handleCommand = (cmd) => {
    const isChartOpen = !!chartTickerRef.current;
    const isActiveTab = window.location.pathname.includes('/active-chart');

    const overlayActions = ["OPEN_SIDEBAR", "CLOSE_SIDEBAR", "TOGGLE_SIDEBAR"];
    if (overlayActions.includes(cmd.action)) {
      // Still dispatch event for potential in-page listeners (if any remain)
      const event = new CustomEvent('SKYNET_COMMAND', { detail: { action: cmd.action } });
      window.dispatchEvent(event);
      addLog(`CMD: ${cmd.action}`, "SYSTEM");

      if (cmd.action === "OPEN_SIDEBAR") {
        if (!sidebarWindowRef.current || sidebarWindowRef.current.closed) {
          sidebarWindowRef.current = window.open(window.location.origin + '/sidebar', 'SkyNetSidebar', 'width=320,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes,left=' + (window.screen.width - 350));
          addLog("Opened Detached Sidebar", "SYSTEM");
        }
      }
      if (cmd.action === "CLOSE_SIDEBAR") {
        if (sidebarWindowRef.current) {
          sidebarWindowRef.current.close();
          sidebarWindowRef.current = null;
          addLog("Closed Detached Sidebar", "SYSTEM");
        }
      }
      if (cmd.action === "TOGGLE_SIDEBAR") {
        if (!sidebarWindowRef.current || sidebarWindowRef.current.closed) {
          sidebarWindowRef.current = window.open(window.location.origin + '/sidebar', 'SkyNetSidebar', 'width=320,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes,left=' + (window.screen.width - 350));
          addLog("Opened Detached Sidebar", "SYSTEM");
        } else {
          sidebarWindowRef.current.close();
          sidebarWindowRef.current = null;
          addLog("Closed Detached Sidebar", "SYSTEM");
        }
      }
    }

    if (cmd.action === 'OPEN_CONTROLS') {
      if (!controlsWindowRef.current || controlsWindowRef.current.closed) {
        controlsWindowRef.current = window.open(window.location.origin + '/controls', 'SkyNetControls', 'width=900,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
        addLog("Opened Global Controls", "SYSTEM");
      }
      return;
    }

    if (cmd.action === 'CLOSE_CONTROLS') {
      if (controlsWindowRef.current) {
        controlsWindowRef.current.close();
        controlsWindowRef.current = null;
        addLog("Closed Global Controls", "SYSTEM");
      }
      return;
    }

    if (cmd.action === 'VOICE_HEARD') {
      addLog(`"${cmd.payload}"`, 'VOICE');
      return;
    }

    if (cmd.action === 'LOG') {
      addLog(cmd.log, cmd.type || 'SYSTEM');
      return;
    }
    if (cmd.log) addLog(cmd.log, 'SYSTEM');

    switch (cmd.action) {
      case 'TERMINATE':
        addLog("TERMINATING SESSION...", "ERROR");
        setTimeout(() => window.close(), 1500);
        break;

      case 'NAVIGATE':
        if (cmd.payload.startsWith('http')) {
          window.open(cmd.payload, '_blank');
        } else {
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
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: clientX,
                clientY: clientY,
                deltaY: deltaY,
                ctrlKey: true
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

  // CHECK FOR ELECTRON ENVIRONMENT
  useEffect(() => {
    if (window.electronAPI) {
      setIsElectron(true);
      addLog("Native Bridge Detected", "SYSTEM");
    }
  }, []);

  const connect = () => {
    if (ws.current) return;

    // IF NOT ELECTRON, DISABLE (User Constraint)
    if (!window.electronAPI) {
      setConnectionError("SkyNet requires the Desktop App. Please download it to use this feature.");
      return;
    }

    // SIMULATED CONNECTION FOR ELECTRON
    // The "Server" is the Native Main Process, always available.
    setIsConnected(true);
    setConnectionError(null);
    addLog("System Online", "SYSTEM");

    // Note: Actual CV Logic will be handled by the SkyNetVision component
    // which starts when isConnected is true.
  };

  const disconnect = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  };

  const shutdownSystem = async () => {
    try {
      const host = window.location.hostname;
      await fetch(`/api/skynet/toggle`, {
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

  return (
    <SkyNetContext.Provider value={{
      connect, disconnect, shutdownSystem, isConnected, connectionError, logs, cursorPos, cursorState,
      chartTicker, setChartTicker, chartInterval, isElectron, handleCommand
    }}>
      {children}
    </SkyNetContext.Provider>
  );
};