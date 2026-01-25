from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import asyncio
import traceback
# Trigger reload for dependencies


# Import Prometheus Core and Kronos Command
try:
    from backend.integration.prometheus_core import Prometheus
    from backend.integration import kronos_command
except ImportError:
    try:
        from integration.prometheus_core import Prometheus
        from integration import kronos_command
    except Exception as e:
        print(f"Background Router Import Warning: {e}")
        # Define dummies to prevent NameError on startup
        class Prometheus:
            def __init__(self, *args, **kwargs): pass
            is_active = False
            gemini_model = None
            def _load_prometheus_state(self): return False
            def _save_prometheus_state(self): pass
        kronos_command = None

# Setup Logger
logger = logging.getLogger("uvicorn")
router = APIRouter()

# --- Shared Prometheus Instance ---
# We need a way to maintain a persistent instance of Prometheus if we want state (like is_active).
# In a real app, this might be a dependency injection or a singleton service.
# For now, we'll try to use a global singleton pattern here or re-instantiate if acceptable.
# Since Prometheus loads state from file, re-instantiating might be okay, but background tasks won't persist across requests.
# We need a persistent instance for background tasks.

_prometheus_instance: Optional[Prometheus] = None

def get_prometheus_instance() -> Prometheus:
    global _prometheus_instance
    if _prometheus_instance is None:
        # Helper to safely import
        def safe_import(module_name, obj_name=None):
            try:
                mod = __import__(f"backend.integration.{module_name}", fromlist=[module_name])
                if obj_name: return getattr(mod, obj_name)
                return mod
            except ImportError:
                 try:
                     mod = __import__(f"integration.{module_name}", fromlist=[module_name])
                     if obj_name: return getattr(mod, obj_name)
                     return mod
                 except ImportError: return None

        # Import commands safely
        risk_cmd = safe_import("risk_command", "perform_risk_calculations_singularity")
        deriv_cmd = safe_import("derivative_command", "handle_derivative_command")
        ml_cmd = safe_import("mlforecast_command", "handle_mlforecast_command")
        sent_cmd = safe_import("sentiment_command", "handle_sentiment_command")
        fund_cmd = safe_import("fundamentals_command", "handle_fundamentals_command")
        quick_cmd = safe_import("quickscore_command", "handle_quickscore_command")
        power_cmd = safe_import("powerscore_command", "handle_powerscore_command")
        backtest_cmd = safe_import("backtest_command", "handle_backtest_command")
        
        # Instantiate Prometheus with available functions
        _prometheus_instance = Prometheus(
            gemini_api_key=None,
            toolbox_map={"backtest": backtest_cmd} if backtest_cmd else {},
            risk_command_func=risk_cmd,
            derivative_func=deriv_cmd,
            mlforecast_func=ml_cmd,
            screener_func=None,
            powerscore_func=power_cmd,
            sentiment_func=sent_cmd,
            fundamentals_func=fund_cmd,
            quickscore_func=quick_cmd
        )
        logger.info("Background Router: Prometheus instance initialized (with available modules).")

    return _prometheus_instance

# --- Request Models ---

class ToggleRequest(BaseModel):
    active: bool

class KronosRunRequest(BaseModel):
    command: str # "optimize", "convergence", "test"
    params: Dict[str, Any]

# --- Endpoints ---

@router.get("/api/background/status")
async def get_status():
    """Returns the current status of Prometheus and Kronos."""
    prom = get_prometheus_instance()
    
    # Reload state from file to be accurate
    is_active = prom._load_prometheus_state()
    prom.is_active = is_active # Sync instance

    # Get Schedule
    schedule = []
    if kronos_command:
        try:
            schedule = kronos_command._load_schedule()
        except Exception: 
            pass
    
    return {
        "active": is_active,
        "schedule": schedule,
        "mode": "Ollama (Local)" if prom.gemini_model else "Unknown"
    }

@router.post("/api/background/toggle")
async def toggle_status(req: ToggleRequest):
    """Toggles Prometheus active state."""
    prom = get_prometheus_instance()
    
    # We can reuse _handle_kronos_status logic or just call internal methods
    # But _handle_kronos_status expects "parts" array and prints.
    # PROPER WAY: Manipulate instance directly.
    
    if req.active:
        prom.is_active = True
        prom._save_prometheus_state()
        # In a full app we would start background tasks here.
        # status endpoint logic:
        # required_funcs = ...
        # if all(required_funcs): start_task()
        logger.info("Prometheus activated via API.")
    else:
        prom.is_active = False
        prom._save_prometheus_state()
        if prom.correlation_task:
            prom.correlation_task.cancel()
        logger.info("Prometheus deactivated via API.")
        
    return {"status": "success", "active": prom.is_active}

@router.post("/api/background/run")
async def run_kronos_command(req: KronosRunRequest):
    """Executes a Kronos command (optimize, convergence, test)."""
    prom = get_prometheus_instance()
    
    command = req.command.lower()
    params = req.params

    if not kronos_command:
        raise HTTPException(status_code=503, detail="Kronos command module not loaded (Import Error).")
    
    try:
        if command == "optimize":
            # params: strategy, ticker, period, generations, population
            # _handle_kronos_optimize expects parts list: ["optimize", strat, ticker, period, gen, pop]
            parts = [
                "optimize",
                str(params.get("strategy")),
                str(params.get("ticker")),
                str(params.get("period")),
                str(params.get("generations", 10)),
                str(params.get("population", 20))
            ]
            await kronos_command._handle_kronos_optimize(parts, prom)
            return {"status": "success", "message": "Optimization started (check logs)."}

        elif command == "convergence":
            # params: run_name, universes(list), conditions(list), strategies(list)
            # _handle_kronos_convergence expects parts and flags
            # parts = ["convergence", run_name, "--universes=...", ...]
            run_name = params.get("run_name", "manual_run")
            unis = ",".join(params.get("universes", ["SPY"]))
            conds = ",".join(params.get("conditions", ["Current_1Y"]))
            strats = ",".join(params.get("strategies", ["ma_crossover"]))
            
            parts = [
                "convergence",
                run_name,
                f"--universes={unis}",
                f"--conditions={conds}",
                f"--strategies={strats}"
            ]
            await kronos_command._handle_kronos_convergence(parts, prom)
            return {"status": "success", "message": "Convergence run started."}

        elif command == "test":
            # params: file, ticker, period, mode
            parts = [
                "test",
                str(params.get("file")),
                str(params.get("ticker")),
                str(params.get("period")),
                str(params.get("mode", "manual"))
            ]
            await kronos_command._handle_kronos_test(parts, prom)
            return {"status": "success", "message": "Test/Improvement run started."}
            
        else:
            raise HTTPException(status_code=400, detail=f"Unknown command: {command}")

    except Exception as e:
        logger.error(f"Error executing Kronos command {command}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/background/logs")
async def get_background_logs(lines: int = 100):
    """
    Returns the last N lines of the prometheus_core.log file.
    Usage: /api/background/logs?lines=50
    """
    import os
    
    log_file = "prometheus_core.log"
    
    if not os.path.exists(log_file):
        return {"logs": ["Log file not found."]}

    try:
        # Simple implementation for valid file sizes
        # For very large files, this should be optimized
        with open(log_file, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
        return {"logs": all_lines[-lines:]}
    except Exception as e:
        return {"logs": [f"Error reading log file: {str(e)}"]}

@router.get("/api/background/optimization_status")
async def get_optimization_status():
    """
    Returns the content of optimization_status.json if it exists.
    """
    import os
    import json
    
    status_file = "optimization_status.json"
    
    if not os.path.exists(status_file):
        return {"status": "idle", "message": "No optimization running or file missing."}

    try:
        with open(status_file, "r") as f:
            data = json.load(f)
            return data
    except Exception as e:
        return {"status": "error", "message": f"Error reading status file: {str(e)}"}
