# prometheus_core.py
import sqlite3
import json
import asyncio
import pandas as pd
from datetime import datetime, timedelta
import traceback
import random
import sys
import io
import google.generativeai as genai # Ensure this is installed
import logging
import yfinance as yf
from dateutil.relativedelta import relativedelta
from typing import Dict, List, Any, Callable, Optional, Tuple
import numpy as np
from tabulate import tabulate
import os
import inspect # For signature checking
import re # Added for parsing AI response
import importlib.util # Needed for dynamic loading
import shutil # <-- ADD THIS LINE
import uuid # Needed for temporary filenames
import aiosqlite
import statistics
import requests

# --- Constants ---
SYNTHESIZED_WORKFLOWS_FILE = 'synthesized_workflows.json'
IMPROVED_CODE_DIR = 'improved_commands' # Directory for generated code
COMMANDS_DIR = '' # Directory for original commands (current dir)
OPTIMIZABLE_PARAMS_FILE = 'optimizable_parameters.json' # <-- NEW CONFIG FILE
LEARNED_MEMORY_FILE = 'prometheus_memory.json' # <-- Persist best params across runs
PROMETHEUS_STATE_FILE = 'prometheus_state.json'
DEFAULT_CORR_INTERVAL_HOURS = 6
DEFAULT_WORKFLOW_CHANCE = 0.1

# --- Prometheus Core Logger ---
prometheus_logger = logging.getLogger('PROMETHEUS_CORE')
prometheus_logger.setLevel(logging.DEBUG)
prometheus_logger.propagate = False

if not prometheus_logger.hasHandlers():
    # FIX: Add encoding='utf-8' here to prevent the "charmap" crash
    file_handler = logging.FileHandler('prometheus_core.log', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    prometheus_logger.addHandler(file_handler)

    # Console handler (Safe version)
    console_handler = logging.StreamHandler()
    # Only show Warnings/Errors in console to keep it clean
    console_handler.setLevel(logging.WARNING) 
    # Use a simple formatter without complex characters for console if needed
    # Use a simple formatter without complex characters for console if needed
    console_handler.setFormatter(logging.Formatter('%(levelname)s - %(message)s'))
    prometheus_logger.addHandler(console_handler)

def force_flush_logger():
    """Forces all handlers to flush."""
    for h in prometheus_logger.handlers:
        h.flush()

async def get_yf_download_robustly(tickers: list, **kwargs) -> pd.DataFrame:
    """ 
    Robust wrapper for yf.download with random delays and retry logic.
    Updated to be compatible with latest yfinance/curl_cffi.
    """
    max_retries = 3
    
    # FIX: Do NOT pass a custom session. Let yfinance handle connection internals.
    # We still ensure a timeout is set for safety, though YF might manage it internally.
    if 'timeout' not in kwargs:
        kwargs['timeout'] = 30 
    
    # Ensure other safe defaults
    kwargs.setdefault('progress', False)
    kwargs.setdefault('auto_adjust', False)

    for attempt in range(max_retries):
        try:
            # ANTIBOT: Random sleep is the key to fixing the original timeouts.
            # We wait 2-5 seconds between calls to space out the 20+ backtests.
            sleep_time = random.uniform(2.0, 5.0) + (attempt * 2)
            await asyncio.sleep(sleep_time)
            
            # Run blocking download in thread (No 'session' argument)
            data = await asyncio.to_thread(yf.download, tickers=tickers, **kwargs)

            if data is not None and not data.empty:
                return data
            
            # If empty, log warning and retry
            prometheus_logger.warning(f"Attempt {attempt+1}: Empty data for {tickers}. Retrying...")
            
        except Exception as e:
            error_msg = str(e)
            if "Too Many Requests" in error_msg or "429" in error_msg:
                prometheus_logger.warning(f"Rate limited on {tickers}. Cooling down for 15s...")
                await asyncio.sleep(15)
            else:
                prometheus_logger.warning(f"Attempt {attempt+1} failed for {tickers}: {e}")

    # Final fallback if all retries fail
    prometheus_logger.error(f"All {max_retries} attempts failed for {tickers}.")
    return pd.DataFrame()

# --- Minimal calculate_ema_invest for context fetching ---
async def calculate_ema_invest_minimal(ticker: str, ema_interval: int = 2) -> Optional[float]:
    """ Minimal version to get INVEST score for context. """
    interval_map = {1: "1wk", 2: "1d", 3: "1h"}; period_map = {1: "max", 2: "10y", 3: "2y"}
    try:
        data = await get_yf_download_robustly(tickers=[ticker], period=period_map.get(ema_interval, "10y"), interval=interval_map.get(ema_interval, "1d"), auto_adjust=True)
        if data.empty: prometheus_logger.debug(f"calculate_ema_invest_minimal({ticker}): No data from download."); return None
        close_prices = None; price_level_name = 'Price'; ticker_level_name = 'Ticker'; close_col_tuple = None
        if isinstance(data.columns, pd.MultiIndex):
             if ('Close', ticker) in data.columns: close_prices = data[('Close', ticker)]
             elif 'Close' in data.columns.get_level_values(price_level_name): close_col_tuple = next((col for col in data.columns if col[data.columns.names.index(price_level_name)] == 'Close'), None);
             if close_col_tuple: close_prices = data[close_col_tuple]
        elif 'Close' in data.columns: close_prices = data['Close']
        if close_prices is None or close_prices.isnull().all() or len(close_prices.dropna()) < 55: prometheus_logger.warning(f"Insufficient 'Close' data for {ticker} EMA calc ({len(close_prices.dropna()) if close_prices is not None else 0} points)."); return None
        ema_8 = close_prices.ewm(span=8, adjust=False).mean(); ema_55 = close_prices.ewm(span=55, adjust=False).mean(); last_ema_8, last_ema_55 = ema_8.iloc[-1], ema_55.iloc[-1]
        if pd.isna(last_ema_8) or pd.isna(last_ema_55) or abs(last_ema_55) < 1e-9: prometheus_logger.warning(f"NaN or zero EMA_55 for {ticker}."); return None
        ema_invest_score = (((last_ema_8 - last_ema_55) / last_ema_55) * 4 + 0.5) * 100
        return float(ema_invest_score)
    except Exception as e: prometheus_logger.warning(f"Context EMA Invest calc failed for {ticker}: {e}"); return None


# --- Helper for Context Enhancement ---
async def _calculate_perc_changes(ticker: str) -> Dict[str, str]:
    """Fetches 5 years of data using robust helper and calculates % changes."""
    changes = { "1d": "N/A", "1w": "N/A", "1mo": "N/A", "3mo": "N/A", "1y": "N/A", "5y": "N/A" }
    try:
        data = await get_yf_download_robustly( tickers=[ticker], period="5y", interval="1d", auto_adjust=True )
        if data.empty: prometheus_logger.warning(f"No data returned for {ticker} % changes."); return changes
        close_prices = None; price_level_name = 'Price'; ticker_level_name = 'Ticker'; close_col_tuple = None
        if isinstance(data.columns, pd.MultiIndex):
             if ('Close', ticker) in data.columns: close_prices = data[('Close', ticker)]
             elif 'Close' in data.columns.get_level_values(price_level_name): close_col_tuple = next((col for col in data.columns if col[data.columns.names.index(price_level_name)] == 'Close'), None);
             if close_col_tuple: close_prices = data[close_col_tuple]
        elif 'Close' in data.columns: close_prices = data['Close']
        if close_prices is None or close_prices.dropna().empty or len(close_prices.dropna()) < 2: prometheus_logger.warning(f"Insufficient 'Close' data for {ticker} % changes."); return changes
        close_prices = close_prices.dropna(); latest_close = close_prices.iloc[-1]; now_dt = close_prices.index[-1]
        if now_dt.tzinfo is not None: now_dt = now_dt.tz_localize(None)
        periods = { "1d": now_dt - timedelta(days=1), "1w": now_dt - timedelta(weeks=1), "1mo": now_dt - relativedelta(months=1), "3mo": now_dt - relativedelta(months=3), "1y": now_dt - relativedelta(years=1), "5y": now_dt - relativedelta(years=5) }
        past_closes = {}
        for key, past_date in periods.items():
            if close_prices.index.tzinfo is None and past_date.tzinfo is not None: past_date = past_date.tz_localize(None)
            try:
                potential_indices = close_prices.index[close_prices.index <= past_date]
                if not potential_indices.empty:
                    actual_past_date = potential_indices[-1]
                    if actual_past_date < now_dt:
                        past_close_val = close_prices.asof(actual_past_date)
                        if pd.notna(past_close_val):
                            past_closes[key] = past_close_val
                elif key == "5y" and len(close_prices) > 0 and pd.notna(close_prices.iloc[0]):
                    past_closes[key] = close_prices.iloc[0]
            except IndexError:
                 if key == "5y" and len(close_prices) > 0 and pd.notna(close_prices.iloc[0]):
                     past_closes[key] = close_prices.iloc[0]

        latest_close_scalar = latest_close.item() if isinstance(latest_close, (pd.Series, pd.DataFrame)) else latest_close

        for key in periods.keys():
             past_close = past_closes.get(key)
             past_close_scalar = past_close.item() if isinstance(past_close, (pd.Series, pd.DataFrame)) else past_close
             if isinstance(past_close_scalar, (int, float, np.number)) and \
                isinstance(latest_close_scalar, (int, float, np.number)) and \
                past_close_scalar != 0 and \
                pd.notna(past_close_scalar) and \
                pd.notna(latest_close_scalar):
                 try:
                      change = ((latest_close_scalar - past_close_scalar) / past_close_scalar) * 100
                      changes[key] = f"{change:+.2f}%"
                 except ZeroDivisionError:
                      prometheus_logger.warning(f"Zero division error calculating % change for {ticker}, key {key}. Past close: {past_close_scalar}")

    except Exception as e:
        prometheus_logger.exception(f"Unexpected error in _calculate_perc_changes for {ticker}: {e}")
    return changes

# --- Add this class definition BEFORE class Prometheus ---
class OllamaWrapper:
    """
    A wrapper for the local Ollama API that mimics the Google Gemini interface.
    """
    def __init__(self, model_name="phi3"):
        self.model_name = model_name
        self.api_url = "http://localhost:11434/api/generate"
        print(f"   -> Prometheus Core: AI switched to Local Ollama ({model_name})")

    async def generate_content_async(self, prompt: str, generation_config: Optional[Dict] = None):
        """
        Asynchronous generation wrapper.
        """
        return await asyncio.to_thread(self.generate_content, prompt, generation_config)

    def generate_content(self, prompt: str, generation_config: Optional[Dict] = None):
        temperature = 0.7
        if isinstance(generation_config, dict):
            temperature = generation_config.get('temperature', 0.7)
        
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_ctx": 4096
            }
        }

        class AIResponse:
            def __init__(self, text):
                self.text = text

        try:
            # Increased timeout to 300s (5m) for code generation
            response = requests.post(self.api_url, json=payload, timeout=300)
            response.raise_for_status()
            result_json = response.json()
            return AIResponse(result_json.get("response", ""))
        except Exception as e:
            # Log using the module logger if available, otherwise print
            logging.getLogger('PROMETHEUS_CORE').error(f"Ollama generation failed: {e}")
            # Do NOT return the error as text, return None or empty so the caller knows it failed
            return None
              
# --- Prometheus Class ---
class Prometheus:
    # --- Add this method inside the Prometheus class ---
    def make_hashable(self, d: Dict[str, Any]) -> tuple:
        """
        Helper to convert a parameter dictionary into a hashable tuple 
        so it can be used as a key in the fitness_cache.
        """
        # Sort items to ensure {'a':1, 'b':2} is the same as {'b':2, 'a':1}
        return tuple(sorted(d.items()))
    
    def __init__(self, gemini_api_key: Optional[str], toolbox_map: Dict[str, Callable],
                 risk_command_func: Callable, derivative_func: Callable,
                 mlforecast_func: Callable, screener_func: Callable,
                 powerscore_func: Callable, sentiment_func: Callable,
                 fundamentals_func: Callable, quickscore_func: Callable):
        
        prometheus_logger.info("Initializing Prometheus Core (Ollama Mode)...")
        
        # 1. Initialize Database
        self.db_path = "prometheus_kb.sqlite"
        self._initialize_db()

        # 2. Load State
        self.is_active = self._load_prometheus_state()
        self.workflow_analysis_chance = DEFAULT_WORKFLOW_CHANCE 
        try:
            if os.path.exists(PROMETHEUS_STATE_FILE):
                with open(PROMETHEUS_STATE_FILE, 'r') as f:
                    state = json.load(f)
                    self.workflow_analysis_chance = state.get("workflow_analysis_chance", DEFAULT_WORKFLOW_CHANCE)
        except (IOError, json.JSONDecodeError) as e:
            prometheus_logger.warning(f"Could not load workflow_analysis_chance: {e}. Using default.")

        print(f"   -> Prometheus Core: Initializing in {'ACTIVE' if self.is_active else 'INACTIVE'} state.")
        
        # 3. Setup Tools & Functions
        self.base_toolbox = toolbox_map.copy()
        self.toolbox = toolbox_map
        self.risk_command_func = risk_command_func
        self.derivative_func = derivative_func
        self.mlforecast_func = mlforecast_func
        self.screener_func = screener_func
        self.powerscore_func = powerscore_func
        self.sentiment_func = sentiment_func
        self.fundamentals_func = fundamentals_func
        self.quickscore_func = quickscore_func
        
        # 4. Initialize AI Model (Ollama)
        self.gemini_api_key = gemini_api_key 
        self.gemini_model = None
        try:
            # Force initialization of the local wrapper defined above
            self.gemini_model = OllamaWrapper(model_name='phi3')
            prometheus_logger.info("Ollama model initialized (phi3).")
        except Exception as e:
            prometheus_logger.error(f"Ollama init failed: {e}")
            print(f"   -> Prometheus Core: ❌ Warn - Ollama init failed: {e}")

        # 5. Load Configurations & Background Tasks
        self._load_optimizable_params()
        self.synthesized_commands = set()

        required_funcs = [self.derivative_func, self.mlforecast_func, self.sentiment_func, self.fundamentals_func, self.quickscore_func]
    
        if self.is_active:
            self._load_and_register_synthesized_commands_sync()
            if all(required_funcs): 
                self.correlation_task = asyncio.create_task(self.background_correlation_analysis())
                prometheus_logger.info("BG correlation task started.")
                print("   -> Prometheus Core: Background correlation task started.")
            else: 
                missing = [f for f, func in zip(["deriv", "mlfcst", "sent", "fund", "qscore"], required_funcs) if not func]
                self.correlation_task = None
                prometheus_logger.warning(f"BG correlation task NOT started (missing: {', '.join(missing)}).")
        else:
            prometheus_logger.info("Prometheus initialized in INACTIVE state.")
            self.correlation_task = None
        
        os.makedirs(IMPROVED_CODE_DIR, exist_ok=True)

    def _load_prometheus_state(self) -> bool:
        """Loads the active/inactive state from a JSON file. Defaults to True."""
        try:
            if os.path.exists(PROMETHEUS_STATE_FILE):
                with open(PROMETHEUS_STATE_FILE, 'r') as f:
                    state = json.load(f)
                    return state.get("is_active", True)
        except (IOError, json.JSONDecodeError) as e:
            prometheus_logger.warning(f"Could not load Prometheus state file: {e}. Defaulting to ON.")
        return True # Default to ON

    def _save_prometheus_state(self):
        """Saves the current active/inactive state to a JSON file."""
        try:
            with open(PROMETHEUS_STATE_FILE, 'w') as f:
                json.dump({"is_active": self.is_active}, f, indent=4)
            prometheus_logger.info(f"Saved Prometheus state (is_active: {self.is_active}) to {PROMETHEUS_STATE_FILE}")
        except IOError as e:
            prometheus_logger.error(f"Failed to save Prometheus state: {e}")

    def _initialize_db(self):
        prometheus_logger.info(f"Initializing KB (SQLite) at '{self.db_path}'...")
        print("   -> Prometheus Core: Initializing Knowledge Base (SQLite)...")
        conn = None 
        try:
            conn = sqlite3.connect(self.db_path); cursor = conn.cursor()
            
            # --- 1. command_log Table ---
            cursor.execute("""CREATE TABLE IF NOT EXISTS command_log (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                timestamp TEXT NOT NULL,
                                command TEXT NOT NULL,
                                parameters TEXT,
                                market_context TEXT,
                                output_summary TEXT,
                                success BOOLEAN,
                                duration_ms INTEGER,
                                user_feedback_rating INTEGER,
                                user_feedback_comment TEXT,
                                backtest_return_pct REAL,
                                backtest_sharpe_ratio REAL,
                                backtest_trade_count INTEGER,
                                backtest_buy_hold_return_pct REAL 
                             )""")
            cursor.execute("PRAGMA table_info(command_log)"); columns = [info[1] for info in cursor.fetchall()]
            if 'user_feedback_rating' not in columns: cursor.execute("ALTER TABLE command_log ADD COLUMN user_feedback_rating INTEGER")
            if 'user_feedback_comment' not in columns: cursor.execute("ALTER TABLE command_log ADD COLUMN user_feedback_comment TEXT")
            if 'backtest_return_pct' not in columns: cursor.execute("ALTER TABLE command_log ADD COLUMN backtest_return_pct REAL")
            if 'backtest_sharpe_ratio' not in columns: cursor.execute("ALTER TABLE command_log ADD COLUMN backtest_sharpe_ratio REAL")
            if 'backtest_trade_count' not in columns: cursor.execute("ALTER TABLE command_log ADD COLUMN backtest_trade_count INTEGER")
            # --- NEW: Add Buy & Hold column to command_log ---
            if 'backtest_buy_hold_return_pct' not in columns: 
                cursor.execute("ALTER TABLE command_log ADD COLUMN backtest_buy_hold_return_pct REAL")

            # --- 2. convergence_runs Table (No changes) ---
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS convergence_runs (
                run_id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_name TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                status TEXT NOT NULL,
                run_parameters_json TEXT,
                parent_run_id INTEGER,
                FOREIGN KEY (parent_run_id) REFERENCES convergence_runs (run_id)
            )
            """)
            
            # --- 3. convergence_results Table ---
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS convergence_results (
                result_id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                universe TEXT NOT NULL,
                market_condition TEXT NOT NULL,
                strategy_name TEXT NOT NULL,
                best_params_json TEXT,
                best_sharpe_ratio REAL,
                total_return_pct REAL,
                max_drawdown_pct REAL,
                trade_count INTEGER,
                profit_time_ratio REAL,
                test_duration_days INTEGER,
                buy_hold_return_pct REAL
            )
            """)
            
            # --- 4. Migration check for convergence_results ---
            cursor.execute("PRAGMA table_info(convergence_results)")
            conv_results_columns = [info[1] for info in cursor.fetchall()]
            if 'test_duration_days' not in conv_results_columns:
                cursor.execute("ALTER TABLE convergence_results ADD COLUMN test_duration_days INTEGER")
            # --- NEW: Add Buy & Hold column to convergence_results ---
            if 'buy_hold_return_pct' not in conv_results_columns:
                cursor.execute("ALTER TABLE convergence_results ADD COLUMN buy_hold_return_pct REAL")

            conn.commit()
            prometheus_logger.info("KB schema verified (incl. backtest & B&H columns)."); 
            print("   -> Prometheus Core: Knowledge Base ready.")
            
        except Exception as e: 
            prometheus_logger.exception(f"ERROR initializing DB: {e}"); 
            print(f"   -> Prometheus Core: [ERROR] initializing DB: {e}")
        finally:
            if conn:
                conn.close()

    # --- NEW: Load Optimizable Parameters Config ---
    def _load_optimizable_params(self):
        """Loads the optimizable parameter definitions from JSON file."""
        self.optimizable_params_config = {}
        default_config = {
            "/backtest": {
                "ma_crossover": {
                    "short_ma": {"type": "int", "min": 5, "max": 100, "step": 1},
                    "long_ma": {"type": "int", "min": 20, "max": 250, "step": 1}
                },
                "rsi": {
                    "rsi_period": {"type": "int", "min": 5, "max": 30, "step": 1},
                    "rsi_buy": {"type": "int", "min": 10, "max": 40, "step": 1},
                    "rsi_sell": {"type": "int", "min": 60, "max": 90, "step": 1}
                },
                 "trend_following": {
                     "ema_short": {"type": "int", "min": 5, "max": 50, "step": 1},
                     "ema_long": {"type": "int", "min": 20, "max": 150, "step": 1},
                     "adx_thresh": {"type": "int", "min": 15, "max": 40, "step": 1}
                 }
                # Add other backtest strategies here
            },
            "/invest": { # Example for /invest if it becomes optimizable
                "_default": { # Use _default if no specific sub-strategy
                    "amplification": {"type": "float", "min": 0.1, "max": 5.0, "step": 0.1}
                    # "ema_sensitivity": {"type": "int", "values": [1, 2, 3]} # Example with specific values
                }
            }
        }
        try:
            if not os.path.exists(OPTIMIZABLE_PARAMS_FILE):
                 prometheus_logger.warning(f"Optimizable params file '{OPTIMIZABLE_PARAMS_FILE}' not found. Creating with defaults.")
                 with open(OPTIMIZABLE_PARAMS_FILE, 'w') as f:
                     json.dump(default_config, f, indent=4)
                 self.optimizable_params_config = default_config
            else:
                with open(OPTIMIZABLE_PARAMS_FILE, 'r') as f:
                    self.optimizable_params_config = json.load(f)
                prometheus_logger.info(f"Loaded optimizable parameters from '{OPTIMIZABLE_PARAMS_FILE}'.")
        except (IOError, json.JSONDecodeError) as e:
            prometheus_logger.error(f"Error loading or creating optimizable params file: {e}. Using empty config.")
            self.optimizable_params_config = {} # Use empty on error

    # --- NEW: Get Optimizable Parameters ---
    def _get_optimizable_params(self, command_name: str, strategy_name: Optional[str] = None) -> Optional[Dict[str, Dict]]:
        """Retrieves the parameter definitions for a specific command/strategy."""
        command_config = self.optimizable_params_config.get(command_name)
        if not command_config:
            return None
        if strategy_name:
            return command_config.get(strategy_name)
        else:
            # Return default if only one strategy or a _default key exists
            if len(command_config) == 1:
                return next(iter(command_config.values()))
            return command_config.get("_default")

    # --- NEW: Generate Initial Population ---
    def _generate_initial_population(self, command_name: str, strategy_name: Optional[str] = None, population_size: int = 50, seed_population: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        """Generates a list of random parameter sets (individuals), optionally seeded from a previous run."""
        param_definitions = self._get_optimizable_params(command_name, strategy_name)
        if not param_definitions:
            prometheus_logger.error(f"Cannot generate population: No optimizable parameter definitions found for {command_name}/{strategy_name or ''}")
            return []

        population = []
        
        # --- NEW: Add seed population first (Memory Feature) ---
        if seed_population:
            for seed_individual in seed_population:
                # Validate that the seed's keys match the expected parameters
                if all(key in param_definitions for key in seed_individual.keys()):
                    population.append(seed_individual)
                    prometheus_logger.debug(f"Adding seed individual: {seed_individual}")
                else:
                    prometheus_logger.warning(f"Skipping invalid seed individual (mismatched keys): {seed_individual}")
        
        prometheus_logger.info(f"Added {len(population)} individuals from seed population.")

        # Fill the rest of the population with random individuals
        num_to_generate = population_size - len(population)
        if num_to_generate <= 0:
            prometheus_logger.warning(f"Seed population ({len(population)}) >= population size ({population_size}). Using only seeds.")
            return population[:population_size] # Return only the requested size

        # --- ADAPTIVE INITIALIZATION ---
        # If we have seeds, generate 50% of the remaining slots by mutating the seeds (local search).
        # The other 50% are purely random (global exploration).
        num_adaptive = 0
        if seed_population:
            num_adaptive = num_to_generate // 2
            
            # Helper to get a random seed to mutate
            def get_random_seed():
                return random.choice(seed_population)

            for _ in range(num_adaptive):
                parent = get_random_seed()
                mutant = parent.copy()
                # Apply Gaussian noise to parameters
                for param, definition in param_definitions.items():
                    if random.random() < 0.5: # 50% chance to mutate each param
                        continue
                        
                    param_type = definition.get("type")
                    if param_type == "int":
                        step = definition.get("step", 1)
                        # Small mutation: +/- 1 to 3 steps
                        delta = random.randint(-3, 3) * step 
                        val = mutant.get(param, definition["values"][0] if "values" in definition else 0)
                        if isinstance(val, (int, float)):
                            new_val = int(val + delta)
                            # Clamp
                            if "min" in definition and "max" in definition:
                                new_val = max(definition["min"], min(definition["max"], new_val))
                            mutant[param] = new_val
                            
                    elif param_type == "float":
                        step = definition.get("step", 0.1)
                        # Gaussian mutation with sigma = 2 steps
                        delta = random.gauss(0, 2 * step)
                        val = mutant.get(param, 0.0)
                        if isinstance(val, (int, float)):
                             new_val = round(round((val + delta) / step) * step, 8)
                             if "min" in definition and "max" in definition:
                                new_val = max(definition["min"], min(definition["max"], new_val))
                             mutant[param] = new_val
                             
                population.append(mutant)
            
            prometheus_logger.info(f"Generated {num_adaptive} adaptive individuals around seeds.")

        # Fill remaining slots with pure random (Global Search)
        num_random = num_to_generate - num_adaptive
        for _ in range(num_random):
            individual = {}
            for param, definition in param_definitions.items():
                param_type = definition.get("type")
                if "values" in definition:
                    individual[param] = random.choice(definition["values"])
                elif param_type == "int":
                    step = definition.get("step", 1)
                    min_val = definition.get("min")
                    max_val = definition.get("max")
                    if min_val is not None and max_val is not None:
                        # Ensure range includes max_val and aligns with step
                        num_steps = (max_val - min_val) // step
                        individual[param] = min_val + random.randint(0, num_steps) * step
                    else:
                         individual[param] = random.randint(0, 100) # Fallback range
                elif param_type == "float":
                    step = definition.get("step", 0.1)
                    min_val = definition.get("min")
                    max_val = definition.get("max")
                    if min_val is not None and max_val is not None:
                         val = random.uniform(min_val, max_val)
                         # Round to nearest step
                         individual[param] = round(round(val / step) * step, 8) # Round to avoid float precision issues
                    else:
                         individual[param] = round(random.uniform(0.0, 1.0), 4) # Fallback range
                else:
                    prometheus_logger.warning(f"Unsupported parameter type '{param_type}' for '{param}' in config.")
            population.append(individual)

        prometheus_logger.info(f"Generated total population of size {len(population)} for {command_name}/{strategy_name or ''}.")
        return population
    # --- END NEW GA FUNCTIONS ---


    def read_command_code(self, command_filename: str) -> Optional[str]:
        # ... (implementation remains the same) ...
        if not command_filename.endswith(".py"):
            prometheus_logger.error(f"read_command_code: Invalid filename '{command_filename}'. Must end with .py")
            return None
        current_dir = os.path.dirname(__file__)
        commands_subfolder = COMMANDS_DIR
        file_path = os.path.join(current_dir, commands_subfolder, command_filename)
        prometheus_logger.debug(f"Attempting to read code from specific path: {file_path}")
        try:
            if not os.path.exists(file_path):
                prometheus_logger.error(f"read_command_code: File not found at specific path '{file_path}'")
                fallback_path = os.path.join(current_dir, command_filename)
                prometheus_logger.debug(f"Attempting fallback read from: {fallback_path}")
                if os.path.exists(fallback_path):
                    file_path = fallback_path
                    prometheus_logger.info(f"Found code file in fallback location: {file_path}")
                else:
                    prometheus_logger.error(f"read_command_code: File not found in fallback either: '{fallback_path}'")
                    return None
            with open(file_path, 'r', encoding='utf-8') as f:
                code_content = f.read()
                prometheus_logger.info(f"Successfully read code from '{file_path}'")
                return code_content
        except IOError as e:
            prometheus_logger.exception(f"read_command_code: IOError reading file '{file_path}': {e}")
            return None
        except Exception as e:
            prometheus_logger.exception(f"read_command_code: Unexpected error reading file '{file_path}': {e}")
            return None

    def _load_and_register_synthesized_commands_sync(self):
        # ... (implementation remains the same) ...
        prometheus_logger.info(f"Loading synthesized commands sync from '{SYNTHESIZED_WORKFLOWS_FILE}'...")
        print(f"   -> Prometheus Core: Loading synthesized workflows...")
        loaded_count = 0
        try:
            if not os.path.exists(SYNTHESIZED_WORKFLOWS_FILE):
                with open(SYNTHESIZED_WORKFLOWS_FILE, 'w') as f: json.dump({}, f)
                prometheus_logger.info(f"Created empty synthesized file: '{SYNTHESIZED_WORKFLOWS_FILE}'"); print(f"   -> Prometheus Core: Created empty synthesized workflows file."); return
            with open(SYNTHESIZED_WORKFLOWS_FILE, 'r') as f: workflows = json.load(f)
            if not isinstance(workflows, dict): prometheus_logger.warning(f"Workflows file not a dict. Skipping."); print(f"   -> Prometheus Core: Warn - Workflows file format incorrect."); return
            for command_name_with_slash, sequence in workflows.items():
                if isinstance(sequence, list) and command_name_with_slash.startswith('/'):
                    self._create_and_register_workflow_function_sync(sequence, command_name_with_slash)
                    loaded_count += 1
                else: prometheus_logger.warning(f"Invalid sequence/name for '{command_name_with_slash}' in {SYNTHESIZED_WORKFLOWS_FILE}.")
            prometheus_logger.info(f"Loaded/registered {loaded_count} synthesized commands sync.")
            print(f"   -> Prometheus Core: Loaded {loaded_count} synthesized workflows.")
        except FileNotFoundError: pass
        except json.JSONDecodeError: prometheus_logger.error(f"Error decoding JSON {SYNTHESIZED_WORKFLOWS_FILE}."); print(f"   -> Prometheus Core: [ERROR] Bad JSON in workflows file.")
        except Exception as e: prometheus_logger.exception(f"Error loading synthesized workflows sync: {e}"); print(f"   -> Prometheus Core: [ERROR] loading workflows sync: {e}")

    async def get_market_context(self) -> Dict[str, Any]:
        """ Fetches market context including risk scores and % changes with enhanced logging. """
        # --- NEW: Check if Prometheus is active ---
        if not self.is_active:
            prometheus_logger.debug("get_market_context: Prometheus is INACTIVE. Skipping context fetch.")
            return {}
        # --- END NEW ---
        
        prometheus_logger.info("Starting context fetch...")
        print("[CONTEXT DEBUG] Starting context fetch...") # <<< DEBUG
        context: Dict[str, Any] = {"vix_price": "N/A", "spy_score": "N/A", "spy_changes": {}, "vix_changes": {}}
        risk_fetch_success = False

        if self.risk_command_func:
            original_stdout = sys.stdout; sys.stdout = io.StringIO()
            try:
                prometheus_logger.debug("Attempting primary context fetch via risk_command_func...")
                print("[CONTEXT DEBUG] Calling risk_command_func...") # <<< DEBUG
                risk_result_tuple_or_dict = await asyncio.wait_for(
                     self.risk_command_func(args=[], ai_params={"assessment_type": "standard"}, is_called_by_ai=True),
                     timeout=90.0
                )
                prometheus_logger.debug(f"risk_command_func raw result type: {type(risk_result_tuple_or_dict)}") # <<< DEBUG
                risk_data_dict = {}; raw_data_dict = {}
                if isinstance(risk_result_tuple_or_dict, tuple) and len(risk_result_tuple_or_dict) >= 2:
                    risk_data_dict = risk_result_tuple_or_dict[0] if isinstance(risk_result_tuple_or_dict[0], dict) else {}
                    raw_data_dict = risk_result_tuple_or_dict[1] if isinstance(risk_result_tuple_or_dict[1], dict) else {}
                elif isinstance(risk_result_tuple_or_dict, dict):
                    risk_data_dict = risk_result_tuple_or_dict
                    raw_data_dict["Live VIX Price"] = risk_data_dict.get('vix_price')
                    raw_data_dict["Raw Market Invest Score"] = risk_data_dict.get('market_invest_score') # Might be capped
                elif risk_result_tuple_or_dict is None: prometheus_logger.warning("Risk command returned None.")
                elif isinstance(risk_result_tuple_or_dict, str) and "error" in risk_result_tuple_or_dict.lower(): prometheus_logger.warning(f"Risk error: {risk_result_tuple_or_dict}")
                else: prometheus_logger.warning(f"Unexpected risk result type: {type(risk_result_tuple_or_dict)}")

                vix_str = raw_data_dict.get("Live VIX Price")
                if vix_str in ["N/A", None, ""]:
                    vix_key = next((k for k in risk_data_dict if 'vix' in k.lower() and 'price' in k.lower()), None)
                    vix_str = risk_data_dict.get(vix_key)

                score_str = raw_data_dict.get("Raw Market Invest Score")
                if score_str in ["N/A", None, ""]:
                    score_key = next((k for k in risk_data_dict if 'market invest score' in k.lower()), None)
                    score_str = risk_data_dict.get(score_key)

                if vix_str not in ["N/A", None, ""]:
                    try: context["vix_price"] = f"{float(str(vix_str).strip('%').strip()):.2f}"
                    except (ValueError, TypeError): pass
                if score_str not in ["N/A", None, ""]:
                    try: context["spy_score"] = f"{float(str(score_str).strip('%').strip()):.2f}%"
                    except (ValueError, TypeError): pass

                if context["vix_price"] != "N/A" and context["spy_score"] != "N/A":
                    risk_fetch_success = True
                    prometheus_logger.info(f"Primary risk fetch OK: VIX={context['vix_price']}, Score={context['spy_score']}")
                    print(f"[CONTEXT DEBUG] Primary risk fetch OK: VIX={context['vix_price']}, Score={context['spy_score']}")
                else:
                    prometheus_logger.warning(f"Primary risk fetch partial/failed: VIX={context['vix_price']}, Score={context['spy_score']}")
                    print(f"[CONTEXT DEBUG] Primary risk fetch partial/failed: VIX={context['vix_price']}, Score={context['spy_score']}")
            except asyncio.TimeoutError:
                prometheus_logger.error("Primary risk context fetch timed out (90s)")
                print("[CONTEXT DEBUG] Primary risk context fetch timed out (90s)")
            except Exception as e:
                prometheus_logger.exception(f"Primary risk context fetch error: {e}")
                print(f"[CONTEXT DEBUG] Primary risk context fetch error: {type(e).__name__} - {e}")
            finally:
                sys.stdout = original_stdout
        else:
            prometheus_logger.warning("No risk_command_func provided for context.")
            print("[CONTEXT DEBUG] No risk_command_func provided.")

        if context["spy_score"] == "N/A":
            prometheus_logger.info("Attempting fallback SPY INVEST score...")
            print("[CONTEXT DEBUG] Attempting fallback SPY INVEST score...")
            try:
                spy_invest_score = await asyncio.wait_for(calculate_ema_invest_minimal('SPY', 2), timeout=30.0)
                if spy_invest_score is not None:
                    context["spy_score"] = f"{spy_invest_score:.2f}%"
                    prometheus_logger.info(f"Fallback SPY Score OK: {context['spy_score']}")
                    print(f"[CONTEXT DEBUG] Fallback SPY Score OK: {context['spy_score']}")
                else:
                    prometheus_logger.warning("Fallback SPY Score failed (returned None).")
                    print("[CONTEXT DEBUG] Fallback SPY Score failed (returned None).")
            except asyncio.TimeoutError:
                prometheus_logger.error("Fallback SPY Score timed out (30s).")
                print("[CONTEXT DEBUG] Fallback SPY Score timed out (30s).")
            except Exception as e_spy:
                prometheus_logger.exception(f"Fallback SPY Score error: {e_spy}")
                print(f"[CONTEXT DEBUG] Fallback SPY Score error: {type(e_spy).__name__} - {e_spy}")

        if context["vix_price"] == "N/A":
            prometheus_logger.info("Attempting fallback VIX price fetch...")
            print("[CONTEXT DEBUG] Attempting fallback VIX price fetch...")
            try:
                vix_data = await asyncio.wait_for(get_yf_download_robustly(tickers=['^VIX'], period="5d", interval="1d", auto_adjust=False), timeout=30.0)
                prometheus_logger.debug(f"Fallback VIX yf download result (shape): {vix_data.shape if not vix_data.empty else 'Empty'}")
                if not vix_data.empty:
                    close_prices = None; ticker = '^VIX'; price_level_name = 'Price'; close_col_tuple = None
                    if isinstance(vix_data.columns, pd.MultiIndex):
                         prometheus_logger.debug("Fallback VIX: MultiIndex detected")
                         if ('Close', ticker) in vix_data.columns: close_prices = vix_data[('Close', ticker)]; prometheus_logger.debug("Fallback VIX: Found ('Close', ticker)")
                         elif 'Close' in vix_data.columns.get_level_values(0):
                             close_col_tuple = next((c for c in vix_data.columns if c[0] == 'Close'), None);
                             if close_col_tuple: close_prices = vix_data[close_col_tuple]; prometheus_logger.debug(f"Fallback VIX: Found tuple {close_col_tuple}")
                             else: prometheus_logger.debug("Fallback VIX: 'Close' in level 0 but tuple not found?")
                         else: prometheus_logger.debug("Fallback VIX: MultiIndex but no 'Close' found.")
                    elif 'Close' in vix_data.columns:
                         close_prices = vix_data['Close']; prometheus_logger.debug("Fallback VIX: Simple DataFrame with 'Close'")
                    else: prometheus_logger.debug("Fallback VIX: No 'Close' column found at all.")

                    if close_prices is not None and not close_prices.dropna().empty:
                         last_price = close_prices.dropna().iloc[-1]
                         context["vix_price"] = f"{last_price:.2f}"; prometheus_logger.info(f"Fallback VIX price OK: {context['vix_price']}"); print(f"[CONTEXT DEBUG] Fallback VIX price OK: {context['vix_price']}")
                    else: prometheus_logger.warning("Fallback VIX: Could not extract valid 'Close' price series."); print("[CONTEXT DEBUG] Fallback VIX: Could not extract valid 'Close' series.")
                else: prometheus_logger.warning("Fallback VIX: Empty data returned from yfinance."); print("[CONTEXT DEBUG] Fallback VIX: Empty data returned from yfinance.")
            except asyncio.TimeoutError:
                prometheus_logger.error("Fallback VIX price timed out (30s).")
                print("[CONTEXT DEBUG] Fallback VIX price timed out (30s).")
            except Exception as e_vix:
                prometheus_logger.exception(f"Fallback VIX price fetch error: {e_vix}")
                print(f"[CONTEXT DEBUG] Fallback VIX price fetch error: {type(e_vix).__name__} - {e_vix}")

        try:
             spy_changes_task = asyncio.wait_for(_calculate_perc_changes('SPY'), timeout=30.0); vix_changes_task = asyncio.wait_for(_calculate_perc_changes('^VIX'), timeout=30.0)
             spy_changes_result, vix_changes_result = await asyncio.gather(spy_changes_task, vix_changes_task, return_exceptions=True)
             if isinstance(spy_changes_result, dict): context["spy_changes"] = spy_changes_result; prometheus_logger.debug(f"SPY % changes fetched.")
             else: prometheus_logger.warning(f"Failed SPY % changes: {spy_changes_result}")
             if isinstance(vix_changes_result, dict): context["vix_changes"] = vix_changes_result; prometheus_logger.debug(f"VIX % changes fetched.")
             else: prometheus_logger.warning(f"Failed VIX % changes: {vix_changes_result}")
        except asyncio.TimeoutError: prometheus_logger.error("ERROR fetching SPY/VIX % changes: Timeout")
        except Exception as e_changes: prometheus_logger.exception(f"ERROR fetching SPY/VIX % changes: {e_changes}")

        prometheus_logger.info(f"Final market context: VIX={context['vix_price']}, Score={context['spy_score']}")
        print(f"[CONTEXT DEBUG] Final context: VIX={context['vix_price']}, Score={context['spy_score']}")
        return context
    
    async def execute_and_log(self, command_name_with_slash: str, args: List[str] = None, ai_params: Optional[Dict] = None, called_by_user: bool = False, internal_call: bool = False) -> Any:
        start_time = datetime.now(); command_name = command_name_with_slash.lstrip('/'); context = {}
        if not internal_call: context = await self.get_market_context()
        
        command_func = self.toolbox.get(command_name); log_id = None
        if not command_func:
            output_summary = f"Unknown command '{command_name_with_slash}'"; prometheus_logger.error(output_summary); print(output_summary)
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            if not internal_call: log_id = self._log_command(start_time, command_name_with_slash, args or ai_params, context, output_summary, success=False, duration_ms=duration_ms)
            return {"status": "error", "message": output_summary}

        parameters_to_log = None
        if args is not None:
            parameters_to_log = args
        elif ai_params is not None:
            parameters_to_log = ai_params
        elif called_by_user:
            parameters_to_log = []
            
        context_str_log = "Context N/A (Internal Call)"
        if not internal_call:
            if context: 
                 context_str_log = ", ".join([f"{k}:{str(v)[:20]}{'...' if len(str(v))>20 else ''}" for k,v in context.items()])
            else: 
                 context_str_log = "Context N/A (Prometheus Inactive)" if not self.is_active else "Context N/A (Fetch Failed)"
                 
        param_str = ' '.join(map(str, args)) if args is not None else json.dumps(ai_params) if ai_params else ""
        log_msg_start = f"Executing: {command_name_with_slash} {param_str} | Context: {context_str_log}"; prometheus_logger.info(log_msg_start)
        is_synthesis_execution = command_name.startswith("synthesized_")
        if called_by_user or is_synthesis_execution: print(f"[Prometheus Log] {log_msg_start}")
        output_summary = f"Execution started."; success_flag = False; result = None
        backtest_metrics_for_log = {} 

        try:
            kwargs_to_pass = {}
            sig = inspect.signature(command_func)
            func_params = sig.parameters
            expects_args = 'args' in func_params
            expects_ai_params = 'ai_params' in func_params

            if expects_args:
                if args is not None:
                    kwargs_to_pass["args"] = args
                elif called_by_user:
                    kwargs_to_pass["args"] = []
                elif not expects_ai_params:
                    kwargs_to_pass["args"] = []

            if expects_ai_params:
                if ai_params is not None:
                    kwargs_to_pass["ai_params"] = ai_params
                elif not called_by_user:
                    kwargs_to_pass["ai_params"] = {}
            
            if 'is_called_by_ai' in func_params:
                kwargs_to_pass["is_called_by_ai"] = not called_by_user

            prometheus_logger.debug(f"Calling {command_name} with actual kwargs: {list(kwargs_to_pass.keys())}")
            if asyncio.iscoroutinefunction(command_func): result = await command_func(**kwargs_to_pass)
            else: result = await asyncio.to_thread(lambda: command_func(**kwargs_to_pass))
            
            prometheus_logger.debug(f"Result from {command_name}: {type(result)} - {str(result)[:100]}...")
            success_flag = True

            if result is None: output_summary = f"{command_name_with_slash} completed (printed output or None)."
            elif isinstance(result, str):
                 if "error" in result.lower() or "failed" in result.lower(): success_flag = False
                 output_summary = result[:1000]
            elif isinstance(result, dict):
                 # --- START OF MODIFICATION ---
                 if command_name == "backtest" and result.get("status") == "success":
                     backtest_metrics_for_log = {
                         "backtest_return_pct": result.get("total_return_pct"),
                         "backtest_sharpe_ratio": result.get("sharpe_ratio"),
                         "backtest_trade_count": result.get("trade_count"),
                         "backtest_buy_hold_return_pct": result.get("buy_hold_return_pct") # Add this
                     }
                     output_summary = (f"Backtest success: Return={result.get('total_return_pct', 'N/A'):.2f}%, "
                                       f"Buy&Hold={result.get('buy_hold_return_pct', 'N/A'):.2f}%, " # Add this
                                       f"Sharpe={result.get('sharpe_ratio', 'N/A'):.3f}, Trades={result.get('trade_count', 'N/A')}")
                 # --- END OF MODIFICATION ---
                 elif result.get('status') == 'error' or 'error' in result: success_flag = False; output_summary = str(result.get('error') or result.get('message', 'Unknown error dict'))[:1000]
                 elif result.get('status') == 'success' or result.get('status') == 'partial_error':
                     if command_name == "sentiment" and 'sentiment_score_raw' in result: output_summary = f"Sentiment for {result.get('ticker','N/A')}: Score={result['sentiment_score_raw']:.2f}. Summary: {result.get('summary', 'N/A')}"
                     elif command_name == "fundamentals" and 'fundamental_score' in result: output_summary = f"Fundamentals Score for {result.get('ticker','N/A')}: {result['fundamental_score']:.2f}"
                     elif command_name == "risk": output_summary = f"Risk: Combined={result.get('combined_score', 'N/A')}, MktInv={result.get('market_invest_score', 'N/A')}, IVR={result.get('market_ivr', 'N/A')}"
                     elif command_name == "breakout" and 'current_breakout_stocks' in result: stocks = result['current_breakout_stocks']; count = len(stocks); top_ticker = stocks[0]['Ticker'] if count > 0 else 'None'; output_summary = f"Breakout: Found {count} stocks. Top: {top_ticker}."
                     elif command_name == "reportgeneration" and 'filename' in result: output_summary = f"Report Generation: Success. File '{result['filename']}'."
                     elif command_name == "derivative" and 'summary' in result: output_summary = result['summary'][:1000]
                     elif command_name == "quickscore": output_summary = result.get("summary", result.get("message", str(result)))[:1000]
                     elif command_name.startswith("synthesized_") and 'summary' in result: output_summary = result['summary'][:1000]
                     elif command_name == "memo" and 'memo_text' in result: output_summary = "Market Memo generated successfully."
                     elif command_name == "strategy_recipe" and 'recipe_steps' in result: output_summary = f"Strategy Recipe generated ({len(result['recipe_steps'])} steps)."
                     elif command_name == "generate_improvement_hypothesis" and 'hypothesis' in result: output_summary = f"Hypothesis generated for {result.get('filename','?')}"
                     elif command_name == "_generate_improved_code" and 'filepath' in result: output_summary = f"Generated improved code saved to {result.get('filepath')}"
                     elif 'summary' in result: output_summary = str(result['summary'])[:1000]
                     elif 'message' in result: output_summary = str(result['message'])[:1000]
                     else: output_summary = f"{command_name_with_slash} success (dict)."
                 else: output_summary = f"{command_name_with_slash} completed (dict)."
            elif isinstance(result, tuple):
                 if command_name in ["invest", "cultivate"] and len(result) >= 4:
                     holdings_data = result[3] if len(result[3]) > 0 else result[1]; num_holdings = len(holdings_data) if isinstance(holdings_data, list) else 0; cash_val = result[2]
                     output_summary = f"{command_name.capitalize()} done. Holdings: {num_holdings}. Cash: ${cash_val:,.2f}"
                 else: output_summary = f"{command_name_with_slash} completed (tuple len {len(result)})."
            elif isinstance(result, list): output_summary = f"{command_name_with_slash} completed ({len(result)} items)."
            elif isinstance(result, pd.DataFrame): output_summary = f"{command_name_with_slash} completed (DataFrame[{len(result)} rows])."
            else: output_summary = f"{command_name_with_slash} completed (type: {type(result).__name__})."

            if success_flag: prometheus_logger.info(f"Command {command_name_with_slash} finished successfully.")
            else: prometheus_logger.warning(f"Command {command_name_with_slash} finished with error: {output_summary}")
        except Exception as e:
             success_flag = False; output_summary = f"CRITICAL ERROR executing {command_name_with_slash}: {type(e).__name__} - {e}"; prometheus_logger.exception(f"CRITICAL ERROR executing {command_name_with_slash}");
             if called_by_user or is_synthesis_execution: print(f"[Prometheus Log] CRITICAL ERROR: {output_summary}")
             output_summary += f"\nTraceback:\n{traceback.format_exc()}"
             result = {"status": "error", "message": output_summary}
        finally:
             duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
             log_internal_ai_steps = command_name in ["generate_improvement_hypothesis", "_generate_improved_code"]
             
             if not internal_call or is_synthesis_execution or log_internal_ai_steps or command_name_with_slash == "/backtest":
                 prometheus_logger.debug(f"Logging command {command_name_with_slash} to DB (internal_call={internal_call}, backtest={command_name_with_slash == '/backtest'})")
                 log_id = await self._log_command(
                     start_time, command_name_with_slash, parameters_to_log, context,
                     output_summary[:5000], success=success_flag, duration_ms=duration_ms,
                     backtest_metrics=backtest_metrics_for_log
                 )
                 if called_by_user and log_id is not None: print(f"[Prometheus Action ID: {log_id}]")
                 
                 if self.is_active and called_by_user and not internal_call and not is_synthesis_execution and random.random() < self.workflow_analysis_chance:
                     await self.analyze_workflows()
             else:
                 prometheus_logger.debug(f"Skipping DB log for internal command: {command_name_with_slash}")

        if command_name == "backtest" and isinstance(result, dict) and result.get("status") == "success":
            return result
        elif result is None and success_flag:
             return {"status": "success", "summary": output_summary}
        return result
    
    async def _log_command(self, timestamp: datetime, command: str, parameters: Any, context: Dict[str, Any], output_summary: str, success: bool = True, duration_ms: int = 0, backtest_metrics: Optional[Dict] = None) -> Optional[int]:
        # ... (implementation remains the same) ...
        params_str = json.dumps(parameters, default=str) if isinstance(parameters, (dict, list)) else str(parameters); context_str = json.dumps(context, default=str)
        log_entry = {
            "timestamp": timestamp.isoformat(), "command": command, "parameters": params_str,
            "market_context": context_str, "output_summary": output_summary, "success": success,
            "duration_ms": duration_ms
        }
        if backtest_metrics:
            log_entry["backtest_return_pct"] = backtest_metrics.get("backtest_return_pct")
            log_entry["backtest_sharpe_ratio"] = backtest_metrics.get("backtest_sharpe_ratio")
            log_entry["backtest_trade_count"] = backtest_metrics.get("backtest_trade_count")

        log_msg = f"Logging: {command} | Success: {success} | Duration: {duration_ms}ms | Summary: {output_summary[:60]}...";
        if backtest_metrics: log_msg += f" | BT Return: {log_entry['backtest_return_pct']:.2f}%" if log_entry.get('backtest_return_pct') is not None else ""
        prometheus_logger.info(log_msg)

        conn = None
        try:
            columns = ', '.join(log_entry.keys())
            placeholders = ', '.join(':' + key for key in log_entry.keys())
            sql = f"INSERT INTO command_log ({columns}) VALUES ({placeholders})"
            
            # Run blocking SQL in thread to avoid freezing the loop
            def _run_sql_insert():
                c = sqlite3.connect(self.db_path)
                cur = c.cursor()
                cur.execute(sql, log_entry)
                c.commit()
                lid = cur.lastrowid
                c.close()
                return lid
                
            return await asyncio.to_thread(_run_sql_insert)
            
        except Exception as e:
            prometheus_logger.exception(f"ERROR logging command to DB: {e}")
            return None
            



    # ... (Rest of Prometheus class methods: analyze_workflows, _create_*, _save_*, background_*, generate_*, _generate_*, _compare_*, _load_*, _run_*, _parse_*, start_interactive_session, _query_log_db remain the same) ...
    async def analyze_workflows(self):
        # ... (implementation remains the same) ...
        prometheus_logger.info("Analyzing command history for potential 2-step workflows...")
        print("[Prometheus Workflow] Analyzing command history for 2-step patterns...")
        conn = sqlite3.connect(self.db_path)
        try:
            query = """
            SELECT c1.command AS command1, c2.command AS command2, COUNT(*) as frequency
            FROM command_log c1 JOIN command_log c2 ON c1.id + 1 = c2.id
            WHERE c1.success = 1 AND c2.success = 1 AND STRFTIME('%s', c2.timestamp) - STRFTIME('%s', c1.timestamp) < 120
            GROUP BY command1, command2 HAVING frequency >= 2 ORDER BY frequency DESC LIMIT 5;
            """
            df_sequences = pd.read_sql_query(query, conn)
            if not df_sequences.empty:
                prometheus_logger.info(f"Potential 2-step workflows detected: {df_sequences.to_dict('records')}")
                print("-> Prometheus Suggestion: Potential 2-step workflows detected:")
                for _, row in df_sequences.iterrows():
                    sequence = [row['command1'], row['command2']]
                    print(f"  - Sequence `{'` -> `'.join(sequence)}` observed {row['frequency']} times.")
                    known_pattern = ['/breakout', '/quickscore']
                    if sequence == known_pattern:
                        cmd_name_with_slash = f"/synthesized_{'_'.join(s.lstrip('/') for s in sequence)}"
                        if cmd_name_with_slash not in self.synthesized_commands:
                            prometheus_logger.info(f"Triggering synthesis for {sequence}")
                            await self._create_and_register_workflow_function(sequence, cmd_name_with_slash)
                        else:
                            prometheus_logger.debug(f"Synthesis skipped for {sequence}, command already exists.")
                            print(f"    (Synthesis skipped, command '{cmd_name_with_slash}' already created)")
                    else:
                        prometheus_logger.debug(f"Skipping synthesis for unsupported 2-step pattern: {sequence}")
                        print(f"    (Skipping synthesis, pattern '{' -> '.join(sequence)}' not yet supported)")
            else:
                 prometheus_logger.info("No frequent 2-step command sequences (>=2) found.")
                 print("[Prometheus Workflow] No frequent (>=2) 2-step command sequences found.")
        except Exception as e:
            prometheus_logger.exception(f"ERROR analyzing 2-step workflows: {e}"); print(f"[Prometheus Workflow] [ERROR] {e}")
        finally: conn.close()


    async def _create_and_register_workflow_function(self, sequence: List[str], command_name_with_slash: str, load_only: bool = False):
        # ... (implementation remains the same) ...
        """ Internal helper for the 2-step /breakout -> /quickscore workflow. """
        prometheus_logger.info(f"{'Loading' if load_only else 'Creating'} 2-step workflow function for '{command_name_with_slash}'")
        command_name_no_slash = command_name_with_slash.lstrip('/')
        if command_name_with_slash in self.synthesized_commands: prometheus_logger.debug(f"Workflow '{command_name_with_slash}' already registered."); return

        async def _workflow_executor(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
            print(f"\n--- Running Synthesized Workflow: {command_name_with_slash} ---"); step_summaries = []; top_ticker = None; success = True
            print("  Step 1: Running /breakout..."); prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 1 - /breakout")
            breakout_result = await self.execute_and_log("/breakout", args=[], called_by_user=False, internal_call=True)
            prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 1 Result: {breakout_result}")

            if isinstance(breakout_result, dict) and breakout_result.get("status") == "success":
                stocks = breakout_result.get("current_breakout_stocks", [])
                if stocks and isinstance(stocks, list) and len(stocks) > 0:
                    top_stock_data = stocks[0];
                    if isinstance(top_stock_data, dict):
                        top_ticker = top_stock_data.get('Ticker')
                        if top_ticker: step_summaries.append(f"Breakout found {len(stocks)} stocks, top: {top_ticker}."); print(f"    -> Top breakout stock: {top_ticker}"); prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 1 OK, top={top_ticker}")
                        else: step_summaries.append("Breakout success, but top ticker missing key."); print("    -> Top breakout stock missing 'Ticker'."); prometheus_logger.warning(f"Workflow {command_name_with_slash}: Step 1 Warn - Missing 'Ticker'.")
                    else: step_summaries.append("Breakout success, but invalid stock data format."); print("    -> Invalid stock data format."); prometheus_logger.warning(f"Workflow {command_name_with_slash}: Step 1 Warn - Invalid format.")
                else: step_summaries.append(breakout_result.get("message", "Breakout success, but found no stocks.")); print(f"    -> {breakout_result.get('message', '/breakout found no stocks.')}"); prometheus_logger.info(f"Workflow {command_name_with_slash}: Step 1 Info - No stocks.")
            else: error_msg = breakout_result.get("message", "Unknown error or non-dict result") if isinstance(breakout_result, dict) else str(breakout_result); step_summaries.append(f"Breakout step failed: {error_msg}"); print(f"    -> /breakout failed: {error_msg[:100]}..."); prometheus_logger.error(f"Workflow {command_name_with_slash}: Step 1 FAILED: {error_msg}"); success = False

            if success and top_ticker:
                print(f"  Step 2: Running /quickscore for {top_ticker}..."); prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 2 - /quickscore {top_ticker}")
                qs_params = {'ticker': top_ticker};
                qs_result = await self.execute_and_log("/quickscore", ai_params=qs_params, called_by_user=False, internal_call=True)
                prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 2 Result: {qs_result}")
                if isinstance(qs_result, dict) and qs_result.get("status") == "success": summary = qs_result.get("summary", "No summary.").split(". Graphs:")[0]; step_summaries.append(f"Quickscore ({top_ticker}): {summary}."); print(f"    -> {summary}."); prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 2 OK.")
                else: error_msg = qs_result.get("message", "Failed or non-dict result") if isinstance(qs_result, dict) else str(qs_result); step_summaries.append(f"Quickscore ({top_ticker}): Failed."); print(f"    -> /quickscore failed: {error_msg[:100]}..."); prometheus_logger.warning(f"Workflow {command_name_with_slash}: Step 2 FAILED/Error: {qs_result}")
            elif success: step_summaries.append("Quickscore skipped."); print("  Step 2: Skipped /quickscore."); prometheus_logger.info(f"Workflow {command_name_with_slash}: Step 2 Skipped.")

            final_summary = f"Synthesized workflow '{command_name_with_slash}' completed. Results: {' | '.join(step_summaries)}"; print(f"--- Workflow {command_name_with_slash} Finished ---"); prometheus_logger.info(f"Workflow {command_name_with_slash} Finished.")
            final_result_for_log = {"summary": final_summary, "status": "success" if success else "error"}
            return final_result_for_log

        self.toolbox[command_name_no_slash] = _workflow_executor; self.synthesized_commands.add(command_name_with_slash)
        if not load_only:
            prometheus_logger.info(f"Saving definition for '{command_name_with_slash}'")
            self._save_synthesized_command_definition(command_name_with_slash, sequence)
            print(f"[Prometheus Synthesis] New command '{command_name_with_slash}' created and saved.")
            print(f"   -> Try running: {command_name_with_slash}")
        else: prometheus_logger.info(f"Registered loaded command '{command_name_with_slash}'")

    def _create_and_register_workflow_function_sync(self, sequence: List[str], command_name_with_slash: str):
        # ... (implementation remains the same) ...
        """ Synchronous version for loading during initialization. """
        command_name_no_slash = command_name_with_slash.lstrip('/')
        if command_name_with_slash in self.synthesized_commands: return
        prometheus_logger.info(f"Loading workflow function sync for '{command_name_with_slash}'")
        async def _workflow_executor(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
            print(f"\n--- Running Synthesized Workflow: {command_name_with_slash} ---"); step_summaries = []; top_ticker = None; success = True
            print("  Step 1: Running /breakout..."); prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 1 - /breakout")
            breakout_result = await self.execute_and_log("/breakout", args=[], called_by_user=False, internal_call=True)
            prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 1 Result: {breakout_result}")
            if isinstance(breakout_result, dict) and breakout_result.get("status") == "success":
                 stocks = breakout_result.get("current_breakout_stocks", [])
                 if stocks and isinstance(stocks, list) and len(stocks) > 0:
                     top_stock_data = stocks[0];
                     if isinstance(top_stock_data, dict):
                         top_ticker = top_stock_data.get('Ticker')
                         if top_ticker: step_summaries.append(f"Breakout found {len(stocks)} stocks, top: {top_ticker}."); print(f"    -> Top breakout stock: {top_ticker}"); prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 1 OK, top={top_ticker}")
                         else: step_summaries.append("Breakout success, top ticker missing key."); print("    -> Top breakout stock missing 'Ticker'."); prometheus_logger.warning(f"Workflow {command_name_with_slash}: Step 1 Warn - Missing 'Ticker'.")
                     else: step_summaries.append("Breakout success, invalid stock data format."); print("    -> Invalid stock data format."); prometheus_logger.warning(f"Workflow {command_name_with_slash}: Step 1 Warn - Invalid format.")
                 else: step_summaries.append(breakout_result.get("message", "Breakout success, but found no stocks.")); print(f"    -> {breakout_result.get('message', '/breakout found no stocks.')}"); prometheus_logger.info(f"Workflow {command_name_with_slash}: Step 1 Info - No stocks.")
            else: error_msg = breakout_result.get("message", "Unknown error or non-dict result") if isinstance(breakout_result, dict) else str(breakout_result); step_summaries.append(f"Breakout step failed: {error_msg}"); print(f"    -> /breakout failed: {error_msg[:100]}..."); prometheus_logger.error(f"Workflow {command_name_with_slash}: Step 1 FAILED: {error_msg}"); success = False
            if success and top_ticker:
                 print(f"  Step 2: Running /quickscore for {top_ticker}..."); prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 2 - /quickscore {top_ticker}")
                 qs_params = {'ticker': top_ticker}; qs_result = await self.execute_and_log("/quickscore", ai_params=qs_params, called_by_user=False, internal_call=True)
                 prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 2 Result: {qs_result}")
                 if isinstance(qs_result, dict) and qs_result.get("status") == "success": summary = qs_result.get("summary", "No summary.").split(". Graphs:")[0]; step_summaries.append(f"Quickscore ({top_ticker}): {summary}."); print(f"    -> {summary}."); prometheus_logger.debug(f"Workflow {command_name_with_slash}: Step 2 OK.")
                 else: error_msg = qs_result.get("message", "Failed or non-dict result") if isinstance(qs_result, dict) else str(qs_result); step_summaries.append(f"Quickscore ({top_ticker}): Failed."); print(f"    -> /quickscore failed: {error_msg[:100]}..."); prometheus_logger.warning(f"Workflow {command_name_with_slash}: Step 2 FAILED/Error: {qs_result}")
            elif success: step_summaries.append("Quickscore skipped."); print("  Step 2: Skipped /quickscore."); prometheus_logger.info(f"Workflow {command_name_with_slash}: Step 2 Skipped.")
            final_summary = f"Synthesized workflow '{command_name_with_slash}' completed. Results: {' | '.join(step_summaries)}"; print(f"--- Workflow {command_name_with_slash} Finished ---"); prometheus_logger.info(f"Workflow {command_name_with_slash} Finished.")
            final_result_for_log = {"summary": final_summary, "status": "success" if success else "error"}
            return final_result_for_log
        self.toolbox[command_name_no_slash] = _workflow_executor
        self.synthesized_commands.add(command_name_with_slash)
        prometheus_logger.info(f"Registered loaded command '{command_name_with_slash}' sync.")


    def _save_synthesized_command_definition(self, command_name_with_slash: str, sequence: List[str]):
        # ... (implementation remains the same) ...
        try:
            workflows = {}
            if os.path.exists(SYNTHESIZED_WORKFLOWS_FILE):
                with open(SYNTHESIZED_WORKFLOWS_FILE, 'r') as f:
                    try: workflows = json.load(f)
                    except json.JSONDecodeError: prometheus_logger.error(f"Error reading {SYNTHESIZED_WORKFLOWS_FILE}, overwriting."); workflows = {}
            workflows[command_name_with_slash] = sequence
            with open(SYNTHESIZED_WORKFLOWS_FILE, 'w') as f: json.dump(workflows, f, indent=4)
            prometheus_logger.info(f"Saved/Updated {command_name_with_slash} in {SYNTHESIZED_WORKFLOWS_FILE}")
        except Exception as e:
            prometheus_logger.exception(f"Error saving definition for {command_name_with_slash}: {e}"); print(f"   -> Prometheus Synthesis: [ERROR] saving workflow: {e}")

    async def background_correlation_analysis(self):
        # ... (implementation remains the same) ...
        try: 
            from backend.integration.risk_command import get_sp500_symbols_singularity
        except ImportError:
            try:
                from integration.risk_command import get_sp500_symbols_singularity
            except ImportError:
                 prometheus_logger.error("Failed import get_sp500_symbols_singularity from risk_command."); return
        commands_to_correlate = {
            'derivative': {'func': self.derivative_func, 'args': [], 'ai_params': {}, 'period': '1y', 'value_key': 'second_derivative_at_end'},
            'mlforecast': {'func': self.mlforecast_func, 'args': [], 'ai_params': {}, 'period': '5-Day', 'value_key': 'Est. % Change'},
            'sentiment': {'func': self.sentiment_func, 'args': [], 'ai_params': {}, 'value_key': 'sentiment_score_raw'},
            'fundamentals': {'func': self.fundamentals_func, 'args': [], 'ai_params': {}, 'value_key': 'fundamental_score'},
            'quickscore': {'func': self.quickscore_func, 'args': [], 'ai_params': {'ema_interval': 2}, 'value_key': 'score'}
        }
        valid_commands_to_run = { cmd: config for cmd, config in commands_to_correlate.items() if config['func'] is not None };
        if not valid_commands_to_run: prometheus_logger.error("BG Corr: No valid functions."); print("[Prometheus Background] ERROR: No valid functions."); return
        prometheus_logger.info(f"BG Corr: Will analyze: {list(valid_commands_to_run.keys())}")
        while True:
             # <<< START OF FIX >>>
             # Load the wait interval from the state file *inside* the loop.
             wait_hours = DEFAULT_CORR_INTERVAL_HOURS # Default
             try:
                 if os.path.exists(PROMETHEUS_STATE_FILE):
                     with open(PROMETHEUS_STATE_FILE, 'r') as f:
                         state = json.load(f)
                         # Read the configured interval, fall back to default if not found or invalid
                         wait_hours = float(state.get("correlation_interval_hours", DEFAULT_CORR_INTERVAL_HOURS))
             except (IOError, json.JSONDecodeError, ValueError) as e:
                 prometheus_logger.warning(f"BG Corr: Could not read interval from state file, using default. Error: {e}")
                 wait_hours = DEFAULT_CORR_INTERVAL_HOURS
             # <<< END OF FIX >>>
             
             prometheus_logger.info(f"BG Corr: Waiting {wait_hours} hours."); print(f"\n[Prometheus Background] Next correlation check in ~{wait_hours} hours...")
             await asyncio.sleep(int(3600 * wait_hours)); cycle_start_time = datetime.now(); prometheus_logger.info("Starting BG correlation cycle."); print(f"\n[Prometheus Background] Starting cycle @ {cycle_start_time.strftime('%H:%M:%S')}...")
             try:
                 sp500_tickers = await asyncio.to_thread(get_sp500_symbols_singularity);
                 if not sp500_tickers: prometheus_logger.warning("BG Corr: Failed S&P500 fetch."); continue
                 subset_size = min(len(sp500_tickers), 20); subset_tickers = random.sample(sp500_tickers, subset_size); prometheus_logger.info(f"BG Corr: Analyzing {len(subset_tickers)} tickers: {subset_tickers}"); print(f"[Prometheus Background] Analyzing {len(subset_tickers)} tickers...")
                 all_results_data = {cmd: {} for cmd in valid_commands_to_run}; tasks_by_command = {cmd: [] for cmd in valid_commands_to_run}; tickers_by_command_task = {cmd: [] for cmd in valid_commands_to_run};
                 semaphore = asyncio.Semaphore(5); total_tasks = len(subset_tickers) * len(valid_commands_to_run); completed_tasks = 0
                 for cmd, config in valid_commands_to_run.items():
                     func = config['func']
                     async def run_single_command(ticker, cmd_name, cmd_config):
                         nonlocal completed_tasks
                         async with semaphore:
                             try:
                                 params = cmd_config['ai_params'].copy(); params['ticker'] = ticker; kwargs_exec = {'ai_params': params, 'is_called_by_ai': True}
                                 if cmd_name == 'quickscore': result = await func(ticker=ticker, ema_interval=params.get('ema_interval', 2), is_called_by_ai=True)
                                 else:
                                     import inspect; sig = inspect.signature(func)
                                     if "gemini_model_obj" in sig.parameters: kwargs_exec["gemini_model_obj"] = self.gemini_model
                                     if "api_lock_override" in sig.parameters:
                                          try: from main_singularity import GEMINI_API_LOCK; kwargs_exec["api_lock_override"] = GEMINI_API_LOCK
                                          except ImportError: pass
                                     result = await func(**kwargs_exec)
                                 completed_tasks += 1
                                 if completed_tasks % 5 == 0 or completed_tasks == total_tasks: print(f"\r[Prometheus Background] Progress: {completed_tasks}/{total_tasks} calls...", end="")
                                 return ticker, result
                             except Exception as e:
                                 prometheus_logger.warning(f"BG {cmd_name} task failed {ticker}: {type(e).__name__} - {e}"); completed_tasks += 1
                                 if completed_tasks % 5 == 0 or completed_tasks == total_tasks: print(f"\r[Prometheus Background] Progress: {completed_tasks}/{total_tasks} calls...", end="")
                                 return ticker, e
                     for ticker in subset_tickers: task = asyncio.create_task(run_single_command(ticker, cmd, config)); tasks_by_command[cmd].append(task); tickers_by_command_task[cmd].append(ticker)
                 for cmd, tasks in tasks_by_command.items():
                     if not tasks: continue; raw_cmd_results = await asyncio.gather(*tasks); config = valid_commands_to_run[cmd]; value_key = config['value_key']
                     for i, (ticker, result) in enumerate(raw_cmd_results):
                         if isinstance(result, Exception): continue; extracted_value = None
                         try:
                             if cmd == 'derivative' and isinstance(result, dict) and config.get('period') in result.get('periods', {}): period_data = result['periods'][config['period']]; extracted_value = period_data.get(value_key) if period_data.get('status') == 'success' else None
                             elif cmd == 'mlforecast' and isinstance(result, list) and result:
                                 for forecast in result:
                                     if forecast.get("Period") == config.get('period'): val_str = forecast.get(value_key, "0%").replace('%', ''); extracted_value = float(val_str); break
                             elif cmd == 'quickscore' and isinstance(result, tuple) and len(result) == 2: extracted_value = result[1]
                             elif isinstance(result, dict) and value_key in result: extracted_value = result[value_key]
                             if extracted_value is not None: all_results_data[cmd][ticker] = float(extracted_value)
                         except (ValueError, TypeError, KeyError, IndexError) as e_extract: prometheus_logger.warning(f"BG {cmd}: Extract error {ticker}. Err: {e_extract}. Res: {str(result)[:100]}...")
                 df_corr = pd.DataFrame(all_results_data).dropna(); print("\r" + " " * 80 + "\r", end="")
                 if len(df_corr) >= 5:
                     try:
                         correlation_matrix = df_corr.corr(method='pearson'); print("[Prometheus Background] Cross-Tool Correlation Matrix:"); print(correlation_matrix.to_string(float_format="%.3f")); prometheus_logger.info(f"Corr matrix ({len(df_corr)} stocks):\n{correlation_matrix.to_string(float_format='%.3f')}")
                         strong_correlations = correlation_matrix.unstack().sort_values(ascending=False).drop_duplicates(); strong_correlations = strong_correlations[abs(strong_correlations) > 0.5]; strong_correlations = strong_correlations[strong_correlations < 1.0]
                         if not strong_correlations.empty: print("[Prometheus Background] Potential Strong Correlations (>0.5):"); print(strong_correlations.to_string(float_format="%.3f")); prometheus_logger.info(f"Strong correlations:\n{strong_correlations.to_string(float_format='%.3f')}")
                         else: print("[Prometheus Background] No strong correlations (>0.5) found."); prometheus_logger.info("No strong correlations (>0.5) found.")
                     except Exception as ce: prometheus_logger.exception(f"BG corr calc error: {ce}"); print(f"[Prometheus Background] Corr calc error: {ce}")
                 else: print(f"[Prometheus Background] Not enough common data ({len(df_corr)}) for matrix."); prometheus_logger.warning(f"BG Corr: Not enough common data ({len(df_corr)}).")
             except asyncio.CancelledError: prometheus_logger.info("BG correlation task cancelled."); break
             except Exception as e: prometheus_logger.exception(f"ERROR BG correlation cycle: {e}"); print(f"[Prometheus Background] Cycle ERROR: {e}")
             finally: cycle_end_time = datetime.now(); duration = cycle_end_time - cycle_start_time; prometheus_logger.info(f"BG cycle finished. Duration: {duration}"); print(f"[Prometheus Background] Cycle finished @ {cycle_end_time.strftime('%H:%M:%S')} (Duration: {duration}).")

    async def generate_market_memo(self, args: List[str] = None, ai_params: Optional[Dict] = None, is_called_by_ai: bool = False, prometheus_instance: 'Prometheus' = None, gemini_model_obj: Any = None):
        # ... (implementation remains the same) ...
        """ Analyzes recent logs and market context to generate a daily memo. """
        prometheus_logger.info("Generating Market Memo...")
        print("\n--- Generating Prometheus Market Memo ---")
        if not self.gemini_model:
            print("❌ Error: Gemini model not initialized. Cannot generate memo.")
            return {"status": "error", "message": "Gemini model not available."}

        print("  -> Fetching current market context (/risk)...")
        market_context_dict = {}
        try:
            risk_result = await self.execute_and_log("/risk", ai_params={"assessment_type": "standard"}, internal_call=True)
            if isinstance(risk_result, dict) and risk_result.get("status") != "error":
                 market_context_dict['VIX Price'] = risk_result.get('vix_price', 'N/A')
                 market_context_dict['Market Invest Score'] = risk_result.get('market_invest_score', 'N/A')
                 market_context_dict['Combined Score'] = risk_result.get('combined_score', 'N/A')
                 market_context_dict['Market IVR'] = risk_result.get('market_ivr', 'N/A')
                 print("     ...Market context fetched.")
            else:
                 print("     ⚠️ Warning: Failed to fetch market context via /risk.")
                 market_context_dict['Status'] = 'Market context unavailable'
        except Exception as e_ctx:
            print(f"     ❌ Error fetching market context: {e_ctx}")
            market_context_dict['Status'] = f'Error fetching context: {e_ctx}'

        print("  -> Querying recent command history...")
        recent_logs = []
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cutoff_time = (datetime.now() - timedelta(hours=24)).isoformat()
            cursor.execute("""
                SELECT command, parameters, output_summary
                FROM command_log
                WHERE success = 1 AND timestamp >= ?
                ORDER BY id DESC
                LIMIT 10
            """, (cutoff_time,))
            rows = cursor.fetchall()
            if rows:
                recent_logs = [{"command": r[0], "params": r[1], "summary": r[2]} for r in rows]
                print(f"     ...Found {len(recent_logs)} relevant recent command logs.")
            else:
                print("     ...No relevant command logs found in the last 24 hours.")
            conn.close()
        except Exception as e_db:
            print(f"     ❌ Error querying command log: {e_db}")
            if conn: conn.close()
            recent_logs = [{"error": f"Failed to query logs: {e_db}"}]

        print("  -> Constructing prompt for AI memo generation...")
        today_date = datetime.now().strftime('%B %d, %Y')
        prompt = f"""
        Act as Prometheus, an AI market analyst. Today is {today_date}.
        Generate a concise "Market Memo" (3-5 sentences) based ONLY on the provided context and recent command activity.

        **Current Market Context:**
        {json.dumps(market_context_dict, indent=2)}

        **Recent Successful Command Summaries (last 24h, max 10):**
        {json.dumps(recent_logs, indent=2)}

        **Instructions:**
        1.  Synthesize the market context (scores, VIX, IVR) and recent command results.
        2.  Identify potential trends, shifts, or notable findings (e.g., strong sector sentiment, recurring breakout patterns, interesting correlations found).
        3.  Suggest 1-2 potentially relevant strategies or areas of focus given the current conditions, referencing specific tools (like /sector, /assess) if applicable.
        4.  Keep the memo brief and action-oriented. Avoid definitive predictions.
        5.  Do NOT invent data not present in the context or logs. If context/logs are unavailable or empty, state that the analysis is limited.

        **Market Memo for {today_date}:**
        """

        print("  -> Sending request to Gemini for memo generation...")
        memo_text = "Error: Memo generation failed."
        try:
             response = await asyncio.to_thread(
                 self.gemini_model.generate_content,
                 prompt,
                 generation_config=genai.types.GenerationConfig(temperature=0.5)
             )
             if response and response.text:
                  memo_text = response.text.strip()
                  print("     ...Memo generated successfully.")
             else:
                  print("     ⚠️ Warning: AI returned an empty response.")
                  memo_text = "Memo Generation Error: AI returned no text."

        except Exception as e_ai:
             print(f"     ❌ Error during AI memo generation: {e_ai}")
             memo_text = f"Memo Generation Error: {e_ai}"

        print("\n" + "="*25 + " Prometheus Market Memo " + "="*25)
        print(f"Date: {today_date}\n")
        print(memo_text)
        print("="*72)

        return {"status": "success", "memo_text": memo_text}

    async def generate_strategy_recipe(self, args: List[str] = None, ai_params: Optional[Dict] = None, is_called_by_ai: bool = False, called_by_user: bool = False, prometheus_instance: 'Prometheus' = None, gemini_model_obj: Any = None):
        # ... (implementation remains the same) ...
        """ Uses the AI to generate a step-by-step strategy recipe. """
        prometheus_logger.info("Generating Strategy Recipe...")
        print("\n--- Generating Prometheus Strategy Recipe ---")
        if not self.gemini_model:
            print("❌ Error: Gemini model not initialized. Cannot generate recipe.")
            return {"status": "error", "message": "Gemini model not available."}

        user_goal = ""
        if called_by_user and args:
            user_goal = " ".join(args)
        elif not called_by_user and ai_params:
            user_goal = ai_params.get("goal", "")
        elif called_by_user:
             if not args:
                 print("Error: Please provide a strategy goal after the command.")
                 return {"status": "error", "message": "Strategy goal is required when called by user."}
             user_goal = " ".join(args)

        if not user_goal:
            print("❌ Error: No strategy goal provided.")
            return {"status": "error", "message": "Strategy goal is required."}

        prometheus_logger.debug(f"User goal for recipe: {user_goal}")
        print(f"  -> User Goal: '{user_goal}'")

        available_tool_list = [f"/{name}" for name in self.toolbox.keys() if name != "strategy_recipe"]
        prometheus_logger.debug(f"Available tools for recipe: {available_tool_list}")

        print("  -> Constructing prompt for AI recipe generation...")
        prompt = f"""
        Act as Prometheus, an AI strategist. Your task is to design a step-by-step investment strategy based on the user's high-level goal description, using ONLY the available tools.

        **User's Goal Description:** "{user_goal}"

        **Available Tools:**
        {', '.join(available_tool_list)}

        **Instructions:**
        1.  Analyze the user's goal description.
        2.  Create a logical sequence of 3-7 steps using the available tools to achieve the goal.
        3.  For each step, clearly state the tool to use (e.g., "/sector") and the specific parameters needed (e.g., "Semiconductors & Semiconductor Equipment"). If parameters depend on previous steps, explain how (e.g., "Run /quickscore on the top 5 tickers from step 3").
        4.  Focus ONLY on creating the recipe steps. Do NOT execute the strategy.
        5.  Format your response clearly using numbered steps. Start directly with step 1.
        6.  If a goal seems impossible or requires unavailable tools, state that clearly instead of generating steps.

        **Proposed Strategy Recipe:**
        """

        print("  -> Sending request to Gemini for recipe generation...")
        recipe_text = "Error: Recipe generation failed."
        recipe_steps = []
        try:
             response = await asyncio.to_thread(
                 self.gemini_model.generate_content,
                 prompt,
                 generation_config=genai.types.GenerationConfig(temperature=0.3)
             )
             if response and response.text:
                  raw_text = response.text.strip()
                  potential_steps = re.split(r'\n\s*(?=\d+\.\s)', raw_text)
                  recipe_steps = [step.strip() for step in potential_steps if step.strip()]
                  if recipe_steps:
                      recipe_text = "\n".join(recipe_steps)
                      print("     ...Recipe generated successfully.")
                  else:
                      recipe_text = raw_text
                      print("     ⚠️ Warning: AI response formatting might be unexpected.")
             else:
                  print("     ⚠️ Warning: AI returned an empty response.")
                  recipe_text = "Recipe Generation Error: AI returned no text."
                  recipe_steps = [recipe_text]

        except Exception as e_ai:
             print(f"     ❌ Error during AI recipe generation: {e_ai}")
             recipe_text = f"Recipe Generation Error: {e_ai}"
             recipe_steps = [recipe_text]

        print("\n" + "="*25 + " Prometheus Strategy Recipe " + "="*25)
        print(f"Goal: {user_goal}\n")
        print("Proposed Strategy:")
        print(recipe_text)
        print("="*74)

        prometheus_logger.info(f"Generated strategy recipe for goal: {user_goal}")
        return {"status": "success", "recipe_steps": recipe_steps}


    async def generate_improvement_hypothesis(self, command_filename: str):
        # ... (implementation remains the same) ...
        """ Uses the LLM to analyze command code and performance logs to propose improvements. """
        prometheus_logger.info(f"Generating improvement hypothesis for {command_filename}")
        print(f"\n--- Generating Improvement Hypothesis for {command_filename} ---")
        if not self.gemini_model:
            print("❌ Error: Gemini model not initialized.")
            return {"status": "error", "message": "Gemini model not available."}

        print("  -> Reading command source code...")
        code_content = self.read_command_code(command_filename)
        if not code_content:
            print("❌ Error: Could not read source code.")
            return {"status": "error", "message": f"Could not read source code for {command_filename}"}
        print("     ...Code read successfully.")

        print("  -> Querying performance logs...")
        command_name_for_log = "/" + command_filename.replace("_command.py", "")
        performance_summary = {"total_runs": 0, "success_rate": "N/A", "avg_duration_ms": "N/A"}
        conn = None
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*), AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END), AVG(duration_ms) FROM command_log WHERE command = ?", (command_name_for_log,))
            result = cursor.fetchone()
            if result and result[0] > 0:
                performance_summary["total_runs"] = result[0]
                performance_summary["success_rate"] = f"{result[1]*100:.1f}%" if result[1] is not None else "N/A"
                performance_summary["avg_duration_ms"] = f"{result[2]:.0f} ms" if result[2] is not None else "N/A"
                print(f"     ...Found {result[0]} log entries. Success: {performance_summary['success_rate']}, Avg Duration: {performance_summary['avg_duration_ms']}")
            else:
                print("     ...No performance logs found for this command.")
            conn.close()
        except Exception as e_db:
            print(f"     ❌ Error querying logs: {e_db}")
            if conn: conn.close()
            performance_summary["error"] = f"Error querying logs: {e_db}"

        print("  -> Constructing prompt for AI analysis...")
        max_code_chars = 15000
        code_snippet = code_content[:max_code_chars] + ("\n... [Code Truncated]" if len(code_content) > max_code_chars else "")

        prompt = f"""
        Act as Prometheus, an AI code optimizer. Analyze the following Python code for the command '{command_name_for_log}' and its performance summary.

        **Command Code (may be truncated):**
        ```python
        {code_snippet}
        ```

        **Performance Summary:**
        {json.dumps(performance_summary, indent=2)}

        **Task:**
        1.  Identify potential areas for improvement in the code (e.g., efficiency bottlenecks, error handling gaps, opportunities for better logic, parameter tuning needs based on logs).
        2.  Formulate a specific, actionable hypothesis for improvement. Describe WHAT change you propose and WHY it might be better based on the code and performance data.
        3.  Focus ONLY on the hypothesis. Do NOT provide the full modified code yet. If no obvious improvement is found, state that.

        **Improvement Hypothesis for {command_filename}:**
        """

        print("  -> Sending request to Gemini for hypothesis generation...")
        hypothesis_text = "Error: Hypothesis generation failed."
        try:
             response = await asyncio.to_thread(
                 self.gemini_model.generate_content,
                 prompt,
                 generation_config=genai.types.GenerationConfig(temperature=0.4)
             )
             if response and response.text:
                  hypothesis_text = response.text.strip()
                  print("     ...Hypothesis generated.")
             else:
                  print("     ⚠️ Warning: AI returned an empty response for hypothesis.")
                  hypothesis_text = "Hypothesis Error: AI returned no text."
        except Exception as e_ai:
             print(f"     ❌ Error during AI hypothesis generation: {e_ai}")
             hypothesis_text = f"Hypothesis Error: {e_ai}"

        print("\n" + "-"*30)
        print(f" Prometheus Improvement Hypothesis for {command_filename}")
        print("-"*30)
        print(hypothesis_text)
        print("-"*30)

        prometheus_logger.info(f"Generated hypothesis for {command_filename}")
        return {"status": "success", "hypothesis": hypothesis_text, "filename": command_filename, "original_code": code_content}


    async def _generate_improved_code(self, command_filename: str, original_code: str, improvement_hypothesis: str) -> Optional[str]:
        """ Uses the LLM to generate improved code and saves it to a *temporary* file. Returns the temp filepath. """
        prometheus_logger.info(f"Generating improved code for {command_filename} based on hypothesis.")
        print(f"\n--- Generating Improved Code for {command_filename} ---")
        if not self.gemini_model:
            print("❌ Error: Gemini model not initialized.")
            return None

        print("  -> Constructing prompt for AI code generation...")
        prompt = f"""
        Act as Prometheus, an AI code generator. You are given the original Python code for the command '{command_filename}' and a hypothesis for improving it.

        **Improvement Hypothesis:**
        {improvement_hypothesis}

        **Original Code:**
        ```python
        {original_code}
        ```

        **Task:**
        Rewrite the *entire* original Python code, incorporating the changes suggested in the hypothesis.
        - Ensure the generated code is complete, correct, and runnable Python code.
        - Preserve the original function signatures and overall structure where possible, unless the hypothesis explicitly requires changes.
        - Your response MUST contain ONLY the final, complete Python code block, starting with ```python and ending with ```.
        - Do NOT include any explanations, comments about changes, or introductory/concluding text outside the code block.

        **Improved Code:**
        """

        print("  -> Sending request to Gemini for code generation...")
        generated_code = None
        temp_filepath = None # Define here for use in exception blocks
        try:
             response = await asyncio.to_thread(
                 self.gemini_model.generate_content,
                 prompt,
                 generation_config=genai.types.GenerationConfig(temperature=0.1)
             )
             if response and response.text:
                  code_match = re.search(r'```python\n(.*)```', response.text, re.DOTALL)
                  if code_match:
                      generated_code = code_match.group(1).strip()
                      print("     ...Code generated successfully.")
                  else:
                      prometheus_logger.warning("AI response did not contain a valid Python code block.")
                      print("     ⚠️ Warning: AI response did not contain a valid Python code block. Using raw response.")
                      generated_code = response.text.replace('```python', '').replace('```', '').strip()
                      if not generated_code:
                          raise ValueError("AI returned unusable code response.")
             else:
                  prometheus_logger.error("AI returned an empty response for code generation.")
                  print("     ❌ Error: AI returned an empty response.")
                  return None

        except Exception as e_ai:
             prometheus_logger.exception(f"Error during AI code generation: {e_ai}")
             print(f"     ❌ Error during AI code generation: {e_ai}")
             return None

        # --- Save to temporary file ---
        try:
            # Create a unique temporary filename in IMPROVED_CODE_DIR
            temp_filename = f"{command_filename.replace('.py', '')}_prom_temp_{uuid.uuid4().hex[:8]}.py"
            temp_filepath = os.path.join(IMPROVED_CODE_DIR, temp_filename)

            print(f"  -> Saving generated code to temporary file: {temp_filepath}")
            os.makedirs(IMPROVED_CODE_DIR, exist_ok=True)
            with open(temp_filepath, 'w', encoding='utf-8') as f:
                f.write(generated_code)
            prometheus_logger.info(f"Saved generated code temporarily to '{temp_filepath}'")
            print("     ...Temporary code saved.")
            return temp_filepath # Return the path to the temporary file
        except IOError as e:
            prometheus_logger.exception(f"IOError saving generated code to '{temp_filepath}': {e}")
            print(f"     ❌ Error saving generated code: {e}")
            return None
        except Exception as e:
            prometheus_logger.exception(f"Unexpected error saving generated code: {e}")
            print(f"     ❌ Unexpected error saving generated code: {e}")
            return None
        
    async def _compare_command_performance(self, original_filename: str, improved_filepath: str, ticker: str = "SPY", period: str = "1y", initial_capital: float = 10000.0) -> Optional[Tuple[Dict, Dict]]:
        """
        Loads and backtests both original and improved strategy code, then compares results.
        Only attempts backtest if files contain a valid 'Strategy' class.
        Accepts full path for improved file. Returns comparison results tuple or None.
        """
        prometheus_logger.info(f"Comparing performance: '{original_filename}' vs '{os.path.basename(improved_filepath)}' on {ticker} ({period})")
        print(f"\n--- Comparing Performance: {original_filename} vs. {os.path.basename(improved_filepath)} ---")
        print(f"    Ticker: {ticker}, Period: {period}, Initial Capital: ${initial_capital:,.2f}")

        # --- Locate Files ---
        original_filepath = os.path.join(os.path.dirname(__file__), COMMANDS_DIR, original_filename)
        # improved_filepath is already a full path

        if not os.path.exists(original_filepath):
            print(f"❌ Error: Original file not found: {original_filepath}")
            return None
        if not os.path.exists(improved_filepath):
            print(f"❌ Error: Improved file not found: {improved_filepath}")
            return None

        # --- Load Strategy Classes ---
        print("  -> Loading strategy classes...")
        OriginalStrategy = self._load_strategy_class_from_file(original_filepath)
        ImprovedStrategy = self._load_strategy_class_from_file(improved_filepath)

        # --- Check if Classes are Backtestable ---
        original_is_backtestable = OriginalStrategy and hasattr(OriginalStrategy(pd.DataFrame()), 'generate_signals')
        improved_is_backtestable = ImprovedStrategy and hasattr(ImprovedStrategy(pd.DataFrame()), 'generate_signals')

        if not original_is_backtestable:
             print(f"⚠️ Warning: Original file '{original_filename}' does not appear to contain a backtestable 'Strategy' class.")
        if not improved_is_backtestable:
             print(f"⚠️ Warning: Improved file '{os.path.basename(improved_filepath)}' does not appear to contain a backtestable 'Strategy' class.")

        if not original_is_backtestable or not improved_is_backtestable:
             print("❌ Cannot perform backtest comparison. Both files must contain valid backtest strategies.")
             return None # Return None if not comparable

        print("     ...Strategy classes loaded successfully.")

        # --- Fetch Data ---
        print(f"  -> Fetching backtest data for {ticker} ({period})...")
        fetch_start_date, fetch_end_date = self._parse_period_to_dates(period)
        if not fetch_start_date or not fetch_end_date:
            print(f"❌ Error: Invalid period string '{period}'.")
            return None
        # Fetch extra data for indicators
        fetch_start_date_extended = (datetime.strptime(fetch_start_date, '%Y-%m-%d') - timedelta(days=90)).strftime('%Y-%m-%d')

        backtest_data = await get_yf_download_robustly(
            tickers=[ticker], start=fetch_start_date_extended, end=fetch_end_date, interval="1d", auto_adjust=False
        )
        if backtest_data.empty: print(f"❌ Failed to fetch backtest data for {ticker}."); return None

        # Standardize columns if needed (single ticker download might be flat)
        if not isinstance(backtest_data.columns, pd.MultiIndex):
             backtest_data.columns = pd.MultiIndex.from_product([backtest_data.columns, [ticker]], names=['Price', 'Ticker'])

        required_cols = ['Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']
        if not all((col, ticker) in backtest_data.columns for col in required_cols):
             print(f"❌ Fetched data for {ticker} missing required columns. Has: {backtest_data.columns.tolist()}")
             return None

        # Filter to exact period *after* fetching extra
        backtest_data = backtest_data.loc[fetch_start_date:fetch_end_date]
        if backtest_data.empty: print(f"❌ No data remaining for {ticker} after filtering for period {period}."); return None
        print("     ...Data fetched successfully.")

        # --- Run Backtests ---
        print("  -> Running backtest on Original code...")
        original_results = self._run_single_backtest(OriginalStrategy, backtest_data.copy(), initial_capital, ticker) # Pass copy of data

        print("  -> Running backtest on Improved code...")
        improved_results = self._run_single_backtest(ImprovedStrategy, backtest_data.copy(), initial_capital, ticker) # Pass copy of data

        # --- Compare and Display ---
        print("\n--- Backtest Comparison ---")
        if original_results and improved_results:
            comparison_data = [
                ["Metric", "Original", "Improved", "Change"],
                ["Final Value ($)", f"{original_results['final_value']:,.2f}", f"{improved_results['final_value']:,.2f}", f"{improved_results['final_value'] - original_results['final_value']:+,.2f}"],
                ["Total Return (%)", f"{original_results['total_return_pct']:.2f}%", f"{improved_results['total_return_pct']:.2f}%", f"{improved_results['total_return_pct'] - original_results['total_return_pct']:+.2f}%"],
                ["Sharpe Ratio", f"{original_results['sharpe_ratio']:.3f}", f"{improved_results['sharpe_ratio']:.3f}", f"{improved_results['sharpe_ratio'] - original_results['sharpe_ratio']:+.3f}"],
                ["Max Drawdown (%)", f"{original_results['max_drawdown_pct']:.2f}%", f"{improved_results['max_drawdown_pct']:.2f}%", f"{improved_results['max_drawdown_pct'] - original_results['max_drawdown_pct']:+.2f}%"],
                ["Trades", f"{original_results['trade_count']}", f"{improved_results['trade_count']}", f"{improved_results['trade_count'] - original_results['trade_count']:+}"]
            ]
            print(tabulate(comparison_data, headers="firstrow", tablefmt="grid", floatfmt=".2f"))
            prometheus_logger.info("Backtest comparison completed.")
            return original_results, improved_results # Return results for confirmation step
        else:
            print("❌ One or both backtests failed. Cannot compare results.")
            prometheus_logger.error("Backtest comparison failed because one or both backtests did not return results.")
            return None # Indicate failure
        
    def _load_strategy_class_from_file(self, filepath: str) -> Optional[type]:
        # ... (implementation remains the same) ...
        """Dynamically loads the 'Strategy' class from a Python file."""
        module_name = f"prometheus_strategy_{os.path.basename(filepath).replace('.py', '')}_{random.randint(1000, 9999)}"
        try:
            spec = importlib.util.spec_from_file_location(module_name, filepath)
            if spec is None or spec.loader is None:
                prometheus_logger.error(f"Could not create module spec for {filepath}")
                return None
            strategy_module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = strategy_module
            spec.loader.exec_module(strategy_module)

            if hasattr(strategy_module, 'Strategy'):
                prometheus_logger.debug(f"Successfully loaded Strategy class from {filepath}")
                return strategy_module.Strategy
            else:
                 prometheus_logger.error(f"'Strategy' class not found in {filepath}")
                 return None
        except SyntaxError as e:
            prometheus_logger.exception(f"Syntax error loading strategy from '{filepath}': {e}")
            print(f"❌ Syntax Error loading {filepath}: {e}")
            return None
        except Exception as e:
            prometheus_logger.exception(f"Error loading strategy from '{filepath}': {e}")
            return None
        finally:
            if module_name in sys.modules:
                del sys.modules[module_name]

    def _run_single_backtest(self, StrategyClass: type, data: pd.DataFrame, initial_capital: float, ticker: str) -> Optional[Dict[str, Any]]:
        # ... (implementation remains the same) ...
        """ Executes a vectorized backtest for a single strategy class. """
        prometheus_logger.debug(f"Running backtest for strategy: {StrategyClass.__name__}")
        if data.empty:
            prometheus_logger.error("Backtest skipped: Input data is empty.")
            return None

        try:
            strategy_instance = StrategyClass(data=data, params={})
            if not hasattr(strategy_instance, 'generate_signals') or not callable(strategy_instance.generate_signals):
                prometheus_logger.error(f"Backtest failed: Strategy class {StrategyClass.__name__} missing callable 'generate_signals' method.")
                return None
            signals_multi = strategy_instance.generate_signals()
            if not isinstance(signals_multi, pd.DataFrame):
                prometheus_logger.error(f"Backtest failed: generate_signals for {StrategyClass.__name__} did not return a DataFrame (returned {type(signals_multi)}).")
                return None
            prometheus_logger.debug(f"Signals generated, shape: {signals_multi.shape}")

            adj_close_prices = data.loc[:, pd.IndexSlice[('Adj Close', ticker)]].droplevel(1, axis=1).squeeze()
            if adj_close_prices.empty or adj_close_prices.isnull().all():
                 prometheus_logger.error(f"Backtest failed: No valid 'Adj Close' data for {ticker}.")
                 return None

            if ticker not in signals_multi.columns:
                 ticker_lower = ticker.lower()
                 matching_cols = [col for col in signals_multi.columns if str(col).lower() == ticker_lower]
                 if not matching_cols:
                      prometheus_logger.error(f"Backtest failed: Signal column for {ticker} not found in Strategy output. Columns: {signals_multi.columns.tolist()}")
                      return None
                 signal_col_name = matching_cols[0]
                 signals = signals_multi[signal_col_name]
                 prometheus_logger.warning(f"Used case-insensitive match for signal column: '{signal_col_name}' for ticker '{ticker}'")
            else:
                 signals = signals_multi[ticker]

            signals = signals.reindex(adj_close_prices.index).ffill().fillna(0)

            daily_returns = adj_close_prices.pct_change()
            positions = signals.shift(1).fillna(0)
            strategy_returns = positions * daily_returns
            cumulative_strategy_returns = (1 + strategy_returns).cumprod()

            final_value = initial_capital * cumulative_strategy_returns.iloc[-1]
            total_return_pct = (cumulative_strategy_returns.iloc[-1] - 1) * 100
            excess_returns = strategy_returns
            sharpe_ratio = (np.mean(excess_returns) / np.std(excess_returns)) * np.sqrt(252) if np.std(excess_returns) != 0 else 0
            running_max = cumulative_strategy_returns.cummax()
            drawdown = (cumulative_strategy_returns - running_max) / running_max
            max_drawdown_pct = drawdown.min() * 100
            trade_count = (positions.diff().abs() > 0).sum()

            results = {
                "final_value": final_value,
                "total_return_pct": total_return_pct,
                "sharpe_ratio": sharpe_ratio,
                "max_drawdown_pct": max_drawdown_pct,
                "trade_count": trade_count
            }
            prometheus_logger.debug(f"Backtest results: {results}")
            return results

        except Exception as e:
            prometheus_logger.exception(f"CRITICAL: Backtest execution failed for {StrategyClass.__name__}. Error: {e}")
            return None

    def _parse_period_to_dates(self, period_str: str) -> Tuple[Optional[str], Optional[str]]:
        # ... (implementation remains the same) ...
        """ Converts period string (e.g., '1y', '3mo') to start/end dates. """
        end_date = datetime.now()
        start_date = None
        num_match = re.search(r'(\d+)', period_str.lower())
        if not num_match: return None, None
        try:
            num = int(num_match.group(1))
            if 'y' in period_str: start_date = end_date - relativedelta(years=num)
            elif 'mo' in period_str: start_date = end_date - relativedelta(months=num)
            elif 'd' in period_str: start_date = end_date - relativedelta(days=num)
            else: return None, None
            return start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')
        except ValueError:
            return None, None


# --- NEW: Core Genetic Algorithm Functions ---

    def _select_parents(self, population_with_fitness: List[Tuple[Dict[str, Any], float]], num_parents: int) -> List[Dict[str, Any]]:
        """
        Selects the top-performing individuals as parents for the next generation.
        Uses simple truncation selection (top N).
        """
        if num_parents > len(population_with_fitness):
            prometheus_logger.warning(f"Requested {num_parents} parents, but only {len(population_with_fitness)} individuals available. Selecting all.")
            num_parents = len(population_with_fitness)

        parents = [item[0] for item in population_with_fitness[:num_parents]]
        prometheus_logger.info(f"Selected top {len(parents)} parents based on fitness.")
        return parents

    def _crossover(self, parents: List[Dict[str, Any]], offspring_size: int) -> List[Dict[str, Any]]:
        """
        Creates offspring by combining parameters from selected parents.
        Uses simple single-point crossover for demonstration.
        """
        offspring = []
        if not parents:
            return offspring # Cannot create offspring without parents

        num_parents = len(parents)
        param_keys = list(parents[0].keys()) # Assume all parents have the same parameter keys

        while len(offspring) < offspring_size:
            # Randomly select two distinct parents
            parent1_idx = random.randint(0, num_parents - 1)
            parent2_idx = random.randint(0, num_parents - 1)
            # Ensure parents are different if possible
            while num_parents > 1 and parent1_idx == parent2_idx:
                parent2_idx = random.randint(0, num_parents - 1)

            parent1 = parents[parent1_idx]
            parent2 = parents[parent2_idx]

            # Choose a crossover point (index)
            if len(param_keys) > 1:
                crossover_point = random.randint(1, len(param_keys) - 1)
            else:
                crossover_point = 1 # Only one parameter, effectively takes from parent1

            child = {}
            # Take parameters before point from parent1, after point from parent2
            for i, key in enumerate(param_keys):
                if i < crossover_point:
                    child[key] = parent1[key]
                else:
                    child[key] = parent2[key]

            offspring.append(child)

        prometheus_logger.info(f"Created {len(offspring)} offspring via crossover.")
        return offspring

    def _mutate(self, offspring: List[Dict[str, Any]], command_name: str, strategy_name: Optional[str] = None, mutation_rate: float = 0.1) -> List[Dict[str, Any]]:
        """
        Introduces random changes (mutations) into the offspring population.
        """
        param_definitions = self._get_optimizable_params(command_name, strategy_name)
        if not param_definitions:
            prometheus_logger.error(f"Cannot mutate: No optimizable parameter definitions found for {command_name}/{strategy_name or ''}")
            return offspring # Return unchanged if no definitions

        mutation_count = 0
        for individual in offspring:
            for param, definition in param_definitions.items():
                if random.random() < mutation_rate:
                    mutation_count += 1
                    original_value = individual[param]
                    param_type = definition.get("type")

                    # Generate a new random value based on definition
                    new_value = original_value # Default to original if mutation fails
                    if "values" in definition:
                         new_value = random.choice([v for v in definition["values"] if v != original_value] or [original_value]) # Avoid choosing same value if possible
                    elif param_type == "int":
                        step = definition.get("step", 1)
                        min_val = definition.get("min")
                        max_val = definition.get("max")
                        if min_val is not None and max_val is not None:
                            num_steps = (max_val - min_val) // step
                            new_value = min_val + random.randint(0, num_steps) * step
                        else: new_value = random.randint(0, 100) # Fallback
                    elif param_type == "float":
                        step = definition.get("step", 0.1)
                        min_val = definition.get("min")
                        max_val = definition.get("max")
                        if min_val is not None and max_val is not None:
                             val = random.uniform(min_val, max_val)
                             new_value = round(round(val / step) * step, 8)
                        else: new_value = round(random.uniform(0.0, 1.0), 4) # Fallback

                    individual[param] = new_value
                    prometheus_logger.debug(f"Mutated param '{param}': {original_value} -> {new_value}")

        if mutation_count > 0:
             prometheus_logger.info(f"Applied {mutation_count} mutations across offspring.")
        return offspring

    # --- Memory / Persistence Methods ---
    
    def _get_memory_key(self, strategy: str, ticker: str, period: Optional[str] = None) -> str:
        base_key = f"{strategy.lower()}_{ticker.upper()}"
        if period:
             base_key += f"_{period.lower()}"
        return base_key

    def _load_learned_memory(self, strategy: str, ticker: str, period: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Loads previously best-known parameters for this strategy/ticker.
        Returns a list containing the best params (as a seed) if found.
        """
        if not os.path.exists(LEARNED_MEMORY_FILE):
            return []
            
        try:
            with open(LEARNED_MEMORY_FILE, 'r') as f:
                memory = json.load(f)
                
            key = self._get_memory_key(strategy, ticker, period)
            data = memory.get(key)
            
            # Fallback to legacy key (strategy_ticker) if specific period key not found
            if not data and period:
                legacy_key = self._get_memory_key(strategy, ticker)
                data = memory.get(legacy_key)
                if data:
                    prometheus_logger.info(f"🧠 Memory Recall: Specific key {key} not found. Falling back to legacy key {legacy_key}.")
            
            # Support both old format (single dict) and new format (list of dicts)
            seeds = []
            if isinstance(data, list):
                for item in data:
                    if "params" in item: seeds.append(item["params"])
            elif isinstance(data, dict) and "params" in data:
                seeds.append(data["params"])
                
            if seeds:
                prometheus_logger.info(f"🧠 Memory Recall: Found {len(seeds)} previous best seeds for {key} at {os.path.abspath(LEARNED_MEMORY_FILE)}")
                return seeds
            else:
                 prometheus_logger.info(f"🧠 Memory: Key {key} not found or empty.")
        except json.JSONDecodeError:
            prometheus_logger.error(f"🧠 Memory Corruption: {LEARNED_MEMORY_FILE} is not valid JSON. Ignoring.")
        except Exception as e:
            prometheus_logger.error(f"Failed to load memory: {e}")
            
        return []

    def _save_learned_memory(self, strategy: str, ticker: str, params: Dict[str, Any], fitness: float, period: Optional[str] = None):
        """
        Saves the best parameters to memory, maintaining a Top 3 list.
        """
        key = self._get_memory_key(strategy, ticker, period)
        memory = {}
        
        # Load existing
        if os.path.exists(LEARNED_MEMORY_FILE):
            try:
                with open(LEARNED_MEMORY_FILE, 'r') as f:
                    memory = json.load(f)
            except: pass # Start fresh if corrupt

        # Get existing seeds for this key
        current_data = memory.get(key)
        existing_seeds = []
        
        if isinstance(current_data, list):
             existing_seeds = current_data
        elif isinstance(current_data, dict) and "params" in current_data:
             existing_seeds = [current_data] # Convert old single-format to list

        # Create new entry
        new_entry = {
            "params": params,
            "fitness": fitness,
            "timestamp": datetime.now().isoformat()
        }

        # Add to list, checking for duplicates (simple set check on params str)
        updated_seeds = [new_entry]
        seen_params = {json.dumps(params, sort_keys=True)}

        for seed in existing_seeds:
            seed_params_str = json.dumps(seed.get("params"), sort_keys=True)
            if seed_params_str not in seen_params:
                updated_seeds.append(seed)
                seen_params.add(seed_params_str)
        
        # Sort by fitness descending and keep top 3
        updated_seeds.sort(key=lambda x: x.get("fitness", -999), reverse=True)
        updated_seeds = updated_seeds[:3]

        memory[key] = updated_seeds

        try:
            with open(LEARNED_MEMORY_FILE, 'w') as f:
                json.dump(memory, f, indent=4)
            
            # Log progress
            best_fitness = updated_seeds[0]['fitness']
            if len(updated_seeds) > len(existing_seeds) or best_fitness > (existing_seeds[0]['fitness'] if existing_seeds else -999):
                 prometheus_logger.info(f"🧠 Memory Updated: New top seed for {key}! (Fitness: {fitness:.2f}%)")
            else:
                 prometheus_logger.info(f"🧠 Memory Retained: Result ({fitness:.2f}%) saved to diversity pool.")
                 
        except Exception as e:
            prometheus_logger.error(f"Failed to save memory: {e}")

    # --- NEW: Main GA Optimization Loop ---
    async def run_parameter_optimization(
        self, 
        command_name: str, 
        strategy_name: str, 
        ticker: str, 
        period: Optional[str] = None, 
        start_date: Optional[str] = None, 
        end_date: Optional[str] = None, 
        seed_population: Optional[List[Dict[str, Any]]] = None, 
        generations: int = 10, 
        population_size: int = 20, 
        num_parents: int = 10, 
        mutation_rate: float = 0.1
    ) -> Tuple[Optional[Dict[str, Any]], float, Dict[str, Any]]:
        
        start_time = datetime.now()
        
        # 1. Load Memory (Seeds)
        seeds = self._load_learned_memory(strategy_name, ticker, period)
        if seeds:
             print(f"[Prometheus] Loaded {len(seeds)} best params from memory for {strategy_name}/{ticker} ({period or 'all'}).")
             
        # 2. Initialize Population
        population = self._generate_initial_population(
            command_name=command_name, 
            strategy_name=strategy_name, 
            population_size=population_size,
            seed_population=(seed_population or []) + seeds
        )
        
        # Determine previous best for UI
        previous_best_return = 0.0
        if seeds:
             # Let's fetch the previous best float manually here for metadata.
             try:
                 with open(LEARNED_MEMORY_FILE, 'r') as f:
                      m = json.load(f)
                      key = self._get_memory_key(strategy_name, ticker, period)
                      if key in m and m[key]: previous_best_return = m[key][0].get("fitness", 0.0) # Get fitness of the top seed
             except: pass

        best_fitness = -999.0
        best_params = None
        best_individual = None # To store the actual parameter dict
        # Initialize metrics with defaults to prevent N/A if loop fails
        best_metrics = {
            "sharpe_ratio": 0.0,
            "trade_count": 0,
            "buy_hold_return_pct": 0.0
        }

        # Cache to avoid re-running same params
        fitness_cache = {} 

        for gen in range(generations):
            prometheus_logger.info(f"--- [Generation {gen+1}/{generations}] ---")
            
            # Identify new individuals
            new_individuals = []
            for ind in population:
                ind_hash = self.make_hashable(ind)
                if ind_hash not in fitness_cache:
                    new_individuals.append(ind)
            
            # Run backtests for new individuals
            if new_individuals:
                prometheus_logger.info(f" -> Queuing {len(new_individuals)} new backtests...")
                # In a real scenario, you might parallelize this. 
                # For safety/rate-limits, we run sequentially or in small batches.
                for ind in new_individuals:
                    # Construct args. If using /backtest, args are [ticker, strategy, period, json_params]
                    params_json = json.dumps(ind)
                    period_arg = period if period else json.dumps({"start": start_date, "end": end_date})
                    
                    # Execute
                    result = await self.execute_and_log(
                        command_name_with_slash=f"{command_name.strip('/')}",
                        args=[ticker, strategy_name, period_arg, params_json],
                        called_by_user=False,
                        internal_call=True
                    )
                    
                    # YIELD CONTROL to allow API requests (logs/status) to be processed
                    await asyncio.sleep(0)
                    
                    # Process result
                    ind_hash = self.make_hashable(ind)
                    if isinstance(result, dict) and result.get("status") == "success":
                        fitness = float(result.get("total_return_pct", -999.0))
                        fitness_cache[ind_hash] = {
                            "fitness": fitness,
                            "metrics": {
                                "sharpe_ratio": result.get("sharpe_ratio", 0.0),
                                "trade_count": result.get("trade_count", 0),
                                "buy_hold_return_pct": result.get("buy_hold_return_pct", 0.0)
                            }
                        }
                    else:
                        # Penalty for failure
                        fitness_cache[ind_hash] = {"fitness": -999.0, "metrics": {}}
                        error_msg = result.get('message', 'Unknown error') if isinstance(result, dict) else str(result)
                        prometheus_logger.warning(f"Generation {gen+1}: Backtest failed for params {ind}. Error: {error_msg[:100]}...")

            # Evaluate entire population
            pop_with_fitness = []
            for ind in population:
                ind_hash = self.make_hashable(ind)
                data = fitness_cache.get(ind_hash, {"fitness": -999.0, "metrics": {}})
                pop_with_fitness.append((ind, data["fitness"], data["metrics"]))
            
            # Sort descending by fitness (Return %)
            pop_with_fitness.sort(key=lambda x: x[1], reverse=True)
            
            # Check for new best
            current_best_ind, current_best_fit, current_best_met = pop_with_fitness[0]
            if current_best_fit > best_fitness:
                best_fitness = current_best_fit
                best_params = current_best_ind # This is the hashable version
                best_individual = current_best_ind # Store the actual dict
                best_metrics = current_best_met # Capture the metrics of the winner!
                
                # Live Update for UI
                live_data = {
                    "best_params": best_individual,
                    "best_return": best_fitness,
                    "buy_hold_return": best_metrics.get('buy_hold_return_pct', 0.0),
                    "sharpe_ratio": best_metrics.get('sharpe_ratio', 0.0),
                    "trade_count": best_metrics.get('trade_count', 0),
                    "generation": gen + 1,
                    "status": "running",
                    "previous_best_return": previous_best_return # <-- Passed to UI
                }
                prometheus_logger.debug(f"[LIVE UPDATE] {json.dumps(live_data)}")
                
                # --- NEW: Save to status file for API ---
                try:
                    with open("optimization_status.json", "w") as f:
                        json.dump(live_data, f)
                except Exception as e:
                    prometheus_logger.error(f"Failed to write optimization_status.json: {e}")
                # ----------------------------------------

                prometheus_logger.info(f" -> Best Fitness (Return %) in Gen {gen+1}: {best_fitness:.2f}%")
                prometheus_logger.info(f"    Params: {best_individual}")
                prometheus_logger.info(f"    ✨ New Overall Best Found! ✨")
            else:
                prometheus_logger.info(f" -> Best Fitness in Gen {gen+1}: {current_best_fit:.2f}% (Overall Best: {best_fitness:.2f}%)")
                # Also update status file even if no new best, just to convert generation count? 
                # Ideally yes, but let's stick to updating on new best or at end of gen.
                # Actually, user wants "Current Generation" displayed.
                
            # Update status file at end of EVERY generation to show progress (Gen X/Y)
            try:
                current_status = {
                    "best_params": best_individual,
                    "best_return": best_fitness,
                    "buy_hold_return": best_metrics.get('buy_hold_return_pct', 0.0),
                    "sharpe_ratio": best_metrics.get('sharpe_ratio', 0.0),
                    "trade_count": best_metrics.get('trade_count', 0),
                    "generation": gen + 1,
                    "status": "running"
                }
                with open("optimization_status.json", "w") as f:
                    json.dump(current_status, f)
            except Exception as e:
                prometheus_logger.error(f"Failed to write optimization_status.json: {e}")


            # Evolution (Selection, Crossover, Mutation)
            if gen < generations - 1:
                parents = self._select_parents(pop_with_fitness, num_parents)
                offspring = self._crossover(parents, population_size - len(parents))
                offspring = self._mutate(offspring, command_name, strategy_name, mutation_rate)
                population = parents + offspring
                prometheus_logger.info(f" -> New generation size: {len(population)}")

        prometheus_logger.info("--- Optimization Finished ---")
        if best_individual:
            prometheus_logger.info("🏆 Best Parameters Found:")
            # Prepare structured result for UI parsing
            optimization_result_data = {
                "best_params": best_individual,
                "best_return": best_fitness,
                "buy_hold_return": best_metrics.get('buy_hold_return_pct', 0.0),
                "sharpe_ratio": best_metrics.get('sharpe_ratio', 0.0),
                "trade_count": best_metrics.get('trade_count', 0),
                "status": "completed",
                "previous_best_return": previous_best_return
            }
            
            # --- NEW: Save final status ---
            try:
                with open("optimization_status.json", "w") as f:
                    json.dump(optimization_result_data, f)
                    
                if best_individual:
                    self._save_learned_memory(strategy_name, ticker, best_individual, best_fitness, period)
                # ----------------------
                
            except Exception as e:
                prometheus_logger.error(f"Failed to write optimization_status.json or save memory: {e}")
            # ------------------------------
            
            # Print standard output for humans (and log it)
            prometheus_logger.info(json.dumps(best_params, indent=4))
            prometheus_logger.info(f"   Best Fitness (Total Return): {best_fitness:.2f}%")
            bh_display = best_metrics.get('buy_hold_return_pct', 'N/A')
            if isinstance(bh_display, float): bh_display = f"{bh_display:.2f}%"
            prometheus_logger.info(f"   vs. Buy & Hold Return: {bh_display}")
            
            # Print structured tag for UI (kept as print if needed by anything else, but logger is safer)
            prometheus_logger.info(f"[OPTIMIZATION RESULT] {json.dumps(optimization_result_data)}")
            
            return best_params, best_fitness, best_metrics
        else:
            prometheus_logger.warning("❌ Optimization failed to find valid parameters.")
            return None, 0.0, {}
        
    # --- Add this new helper function inside the Prometheus class ---
    async def _query_logged_metrics_by_params(self, db_path: str, command: str, strategy: str, params_json: str) -> Dict[str, Any]:
        """
        (Internal Fallback)
        Queries the command_log for a specific backtest run (matching params)
        and returns all relevant metrics. Defaults None values to 0.0.
        """
        metrics = {}
        prometheus_logger.debug(f"[GA Fallback] Querying log for metrics for {params_json}...")
        
        target_params_dict = json.loads(params_json)

        try:
            param_defs = self._get_optimizable_params(command, strategy)
            if not param_defs:
                return metrics
                
            param_keys = sorted(list(param_defs.keys()))
            expected_param_count = len(param_keys)
            
            async with aiosqlite.connect(db_path) as db:
                cursor = await db.execute(
                    """
                    SELECT backtest_return_pct, backtest_sharpe_ratio, backtest_trade_count, backtest_buy_hold_return_pct, parameters
                    FROM command_log
                    WHERE command = ? AND success = 1 
                      AND parameters LIKE ? 
                    ORDER BY backtest_return_pct DESC
                    """,
                    (command, f"%{strategy}%")
                )
                rows = await cursor.fetchall()

                if not rows:
                    return metrics

                for row in rows:
                    return_pct, sharpe, trades, buy_hold_pct, params_str = row
                    try:
                        logged_args_list = json.loads(params_str)
                        
                        param_dict_from_log = {}
                        if isinstance(logged_args_list, list) and len(logged_args_list) == 4 and logged_args_list[3].startswith('{'):
                             param_dict_from_log = json.loads(logged_args_list[3])
                        elif isinstance(logged_args_list, list) and len(logged_args_list) == (3 + expected_param_count):
                            log_param_values = logged_args_list[3:]
                            for i, key in enumerate(param_keys):
                                p_type = param_defs[key].get("type")
                                p_val_str = str(log_param_values[i])
                                if p_type == "int": param_dict_from_log[key] = int(p_val_str)
                                elif p_type == "float": param_dict_from_log[key] = float(p_val_str)
                                else: param_dict_from_log[key] = p_val_str
                        else:
                            continue
                        
                        if param_dict_from_log == target_params_dict:
                            # --- START OF FIX: Default None to 0.0 ---
                            metrics["total_return_pct"] = return_pct or 0.0
                            metrics["best_sharpe_ratio"] = sharpe or 0.0
                            metrics["trade_count"] = trades or 0
                            metrics["buy_hold_return_pct"] = buy_hold_pct or 0.0
                            # --- END OF FIX ---
                            prometheus_logger.debug(f"[GA Fallback]   -> SUCCESS: Found exact parameter match.")
                            return metrics
                            
                    except Exception:
                        continue
                
            prometheus_logger.warning(f"[GA Fallback]   -> FAILED: No exact parameter match found in logs for {params_json}.")

        except Exception as e:
            prometheus_logger.error(f"Error in _query_logged_metrics_by_params: {e}", exc_info=True)
            
        return metrics
    
    # ... (rest of the Prometheus class methods remain the same) ...
    async def start_interactive_session(self):
        # --- Updated command list and generate code logic ---
        
        # --- MODIFIED: Added 'status' to the help text ---
        print("\n--- Prometheus Meta-AI Shell ---");
        print("Available commands: status, analyze patterns, check correlations, query log <limit>, generate memo, generate recipe, generate code <file.py> [t] [p], compare code <orig.py> <improved.py> [t] [p], optimize parameters <strat> <t> <p> [gen] [pop], test ga, exit") # Updated usage info
        # --- END MODIFIED ---
        
        prometheus_logger.info("Entered Prometheus interactive shell.")
        while True:
            try:
                # --- MODIFIED: Added status to prompt ---
                active_str = "ACTIVE" if self.is_active else "INACTIVE"
                user_input = await asyncio.to_thread(input, f"Prometheus ({active_str})> "); 
                # --- END MODIFIED ---
                
                user_input_lower = user_input.lower().strip(); parts = user_input.split(); cmd = parts[0].lower() if parts else ""
                
                if cmd == 'exit': prometheus_logger.info("Exiting Prometheus shell."); break
                
                # --- NEW: Handle status command ---
                elif cmd == "status":
                    current_status_str = "ON" if self.is_active else "OFF"
                    status_input = await asyncio.to_thread(input, f"Prometheus is currently {current_status_str}. Set status (1=ON, 0=OFF): ")
                    
                    if status_input == "0":
                        if not self.is_active:
                            print("Prometheus is already OFF.")
                        else:
                            print("Deactivating Prometheus...")
                            self.is_active = False
                            if self.correlation_task and not self.correlation_task.done():
                                self.correlation_task.cancel()
                                print("   -> Background correlation task cancelled.")
                            self.correlation_task = None
                            # Remove synthesized commands
                            self.toolbox = self.base_toolbox.copy()
                            self.synthesized_commands.clear()
                            print("   -> Synthesized commands unloaded.")
                            print("   -> Context fetching and workflow analysis disabled.")
                            self._save_prometheus_state() # Save state
                            
                    elif status_input == "1":
                        if self.is_active:
                            print("Prometheus is already ON.")
                        else:
                            print("Activating Prometheus...")
                            self.is_active = True
                            
                            # Restart background task
                            # (Need to copy this check from __init__)
                            required_funcs = [self.derivative_func, self.mlforecast_func, self.sentiment_func, self.fundamentals_func, self.quickscore_func]
                            if all(required_funcs):
                                if not self.correlation_task or self.correlation_task.done():
                                    self.correlation_task = asyncio.create_task(self.background_correlation_analysis())
                                    print("   -> Background correlation task started.")
                                else:
                                    print("   -> Background correlation task is already running.")
                            else:
                                missing = [f.__name__ for f, func in zip(["deriv", "mlfcst", "sent", "fund", "qscore"], required_funcs) if not func]
                                print(f"   -> Background correlation task NOT started (missing: {', '.join(missing)}).")
                                
                            # Reload synthesized commands
                            self._load_and_register_synthesized_commands_sync()
                            print("   -> Synthesized commands loaded.")
                            print("   -> Context fetching and workflow analysis enabled.")
                            self._save_prometheus_state() # Save state
                    else:
                        print("Invalid input. Status unchanged.")
                    continue # Go back to prompt
                # --- END NEW ---
                    
                elif cmd == "analyze" and len(parts)>1 and parts[1].lower() == "patterns": 
                    if not self.is_active: print("   -> Cannot analyze patterns. Prometheus is INACTIVE."); continue
                    await self.analyze_workflows()
                elif cmd == "check" and len(parts)>1 and parts[1].lower() == "correlations":
                     print("Triggering background correlation analysis manually..."); 
                     # --- MODIFIED: Check if active ---
                     if not self.is_active:
                         print("   -> Cannot check correlations. Prometheus is INACTIVE.")
                         continue
                     # --- END MODIFIED ---
                     required_funcs = [self.derivative_func, self.mlforecast_func, self.sentiment_func, self.fundamentals_func, self.quickscore_func]; can_run_corr = all(required_funcs)
                     if can_run_corr and (not self.correlation_task or self.correlation_task.done()): self.correlation_task = asyncio.create_task(self.background_correlation_analysis()); print("   -> Correlation task started.")
                     elif self.correlation_task and not self.correlation_task.done(): print("   -> Correlation task is already running.")
                     else: print("   -> Cannot run correlation analysis - required functions missing.")
                elif cmd == "query" and len(parts)>1 and parts[1].lower() == "log": limit = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 10; await self._query_log_db(limit)
                elif cmd == "generate" and len(parts)>1 and parts[1].lower() == "memo": 
                    if not self.is_active: print("   -> Cannot generate memo. Prometheus is INACTIVE."); continue
                    await self.generate_market_memo()
                elif cmd == "generate" and len(parts)>1 and parts[1].lower() == "recipe":
                    if not self.is_active: print("   -> Cannot generate recipe. Prometheus is INACTIVE."); continue
                    goal_parts = parts[2:]
                    if not goal_parts: print("Please provide a goal after 'generate recipe'.")
                    else: await self.generate_strategy_recipe(args=[" ".join(goal_parts)], called_by_user=True)
                # --- Handle generate code command ---
                elif cmd == "generate" and len(parts) > 1 and parts[1].lower() == "code" and len(parts) > 2:
                    if not self.is_active: print("   -> Cannot generate code. Prometheus is INACTIVE."); continue
                    filename_to_improve = parts[2]
                    # Optional ticker/period for comparison
                    ticker_arg = parts[3].upper() if len(parts) > 3 else "SPY"
                    period_arg = parts[4].lower() if len(parts) > 4 else "1y"

                    print(f"--- Initiating Code Improvement for {filename_to_improve} ---")
                    # 1. Generate Hypothesis
                    hypothesis_result = await self.generate_improvement_hypothesis(filename_to_improve)
                    if not (isinstance(hypothesis_result, dict) and hypothesis_result.get("status") == "success"):
                        print(f"❌ Skipping code generation because hypothesis failed: {hypothesis_result.get('message', 'Unknown error')}")
                        continue

                    original_code = hypothesis_result.get("original_code")
                    hypothesis_text = hypothesis_result.get("hypothesis")
                    if not original_code or not hypothesis_text:
                        print("❌ Error: Hypothesis generated, but original code or text missing.")
                        continue

                    # 2. Generate Improved Code (to temporary file)
                    temp_filepath = await self._generate_improved_code(
                        command_filename=filename_to_improve,
                        original_code=original_code,
                        improvement_hypothesis=hypothesis_text
                    )
                    if not temp_filepath:
                        print(f"❌ Failed to generate or save improved code for {filename_to_improve}.")
                        continue
                    print(f"✅ Successfully generated improved code (temporary): {temp_filepath}")

                    # 3. Compare Performance (if backtestable)
                    comparison_results = None
                    comparison_ran = False
                    print("\n-> Checking if code is backtestable for comparison...")
                    # Get full paths for loading check
                    original_target_path_check = os.path.join(os.path.dirname(__file__), COMMANDS_DIR, filename_to_improve)
                    OriginalStratClass = self._load_strategy_class_from_file(original_target_path_check)
                    ImprovedStratClass = self._load_strategy_class_from_file(temp_filepath)
                    
                    # Check if both classes were loaded AND have the 'generate_signals' method
                    is_backtestable = (OriginalStratClass and hasattr(OriginalStratClass(pd.DataFrame()), 'generate_signals') and
                                       ImprovedStratClass and hasattr(ImprovedStratClass(pd.DataFrame()), 'generate_signals'))

                    if is_backtestable:
                        print(f"-> Files appear backtestable. Running comparison on {ticker_arg} ({period_arg})...")
                        comparison_results = await self._compare_command_performance(
                            original_filename=filename_to_improve,
                            improved_filepath=temp_filepath, # Pass full temp path
                            ticker=ticker_arg,
                            period=period_arg
                        )
                        comparison_ran = True # Mark that comparison was attempted
                        if not comparison_results:
                            print("⚠️ Comparison failed or produced no results.")
                    else:
                        print("-> Files do not appear to be standard backtest strategies. Skipping performance comparison.")
                        print("   (Generated code saved temporarily. Review manually.)")

                    # 4. Ask for Confirmation to Overwrite
                    print("\n--- Confirmation ---")
                    original_target_path = os.path.join(os.path.dirname(__file__), COMMANDS_DIR, filename_to_improve)
                    prompt_message = f"❓ Overwrite original file '{original_target_path}' with the improved version? (yes/no): "
                    confirm = await asyncio.to_thread(input, prompt_message)

                    if confirm.lower() == 'yes':
                        try:
                            # --- Overwrite Logic ---
                            print(f"   -> Overwriting '{original_target_path}'...")
                            # Use shutil.move for atomic operation (rename/overwrite)
                            shutil.move(temp_filepath, original_target_path)
                            print(f"✅ Original file overwritten successfully.")
                            prometheus_logger.info(f"User confirmed overwrite for {filename_to_improve}.")
                        except Exception as e_move:
                            print(f"❌ Error overwriting file: {e_move}")
                            prometheus_logger.error(f"Error moving {temp_filepath} to {original_target_path}: {e_move}")
                            # Keep temp file if move failed
                            print(f"   -> Improved code remains available at: {temp_filepath}")

                    else:
                        # --- Cancelled Overwrite ---
                        print("   -> Overwrite cancelled.")
                        # Keep temp file for manual review
                        print(f"   -> Improved code remains available at: {temp_filepath}")
                        prometheus_logger.info(f"User cancelled overwrite for {filename_to_improve}. Temp file: {temp_filepath}")

                # --- Handle compare code command ---
                elif cmd == "compare" and len(parts) > 1 and parts[1].lower() == "code" and len(parts) > 3:
                    if not self.is_active: print("   -> Cannot compare code. Prometheus is INACTIVE."); continue
                    original_file = parts[2]
                    # Allow comparing file from improved_commands dir or commands dir
                    improved_file_basename = parts[3]
                    improved_file_path = os.path.join(os.path.dirname(__file__), IMPROVED_CODE_DIR, improved_file_basename)
                    if not os.path.exists(improved_file_path):
                         alt_path = os.path.join(os.path.dirname(__file__), COMMANDS_DIR, improved_file_basename)
                         if os.path.exists(alt_path):
                              improved_file_path = alt_path
                         else:
                              print(f"❌ Error: File '{improved_file_basename}' not found in '{IMPROVED_CODE_DIR}' or '{COMMANDS_DIR}'.")
                              continue

                    ticker_arg = parts[4].upper() if len(parts) > 4 else "SPY"
                    period_arg = parts[5].lower() if len(parts) > 5 else "1y"
                    await self._compare_command_performance(original_file, improved_file_path, ticker=ticker_arg, period=period_arg)

                # --- Handle optimize parameters command ---
                elif cmd == "optimize" and len(parts) > 1 and parts[1].lower() == "parameters" and len(parts) > 4:
                    if not self.is_active: print("   -> Cannot optimize parameters. Prometheus is INACTIVE."); continue
                    # Usage: optimize parameters <strategy_name> <ticker> <period> [generations] [population_size]
                    strategy_arg = parts[2].lower()
                    ticker_arg = parts[3].upper()
                    period_arg = parts[4].lower()
                    try:
                        generations_arg = int(parts[5]) if len(parts) > 5 else 10 # Default 10 generations
                        population_size_arg = int(parts[6]) if len(parts) > 6 else 20 # Default 20 population
                        num_parents_arg = population_size_arg // 2 # Keep top 50%
                    except ValueError:
                         print("❌ Error: Generations and population size must be integers.")
                         continue

                    # Validate strategy is optimizable for /backtest
                    optimizable_strategies = self.optimizable_params_config.get("/backtest", {}).keys()
                    if strategy_arg not in optimizable_strategies:
                        print(f"❌ Error: Strategy '{strategy_arg}' is not defined as optimizable in {OPTIMIZABLE_PARAMS_FILE} for /backtest.")
                        continue

                    # Run the optimization
                    await self.run_parameter_optimization(
                        command_name="/backtest",
                        strategy_name=strategy_arg,
                        ticker=ticker_arg,
                        period=period_arg,
                        generations=generations_arg,
                        population_size=population_size_arg,
                        num_parents=num_parents_arg
                    )

                # --- Handle Test GA command ---
                elif cmd == "test" and len(parts) > 1 and parts[1].lower() == "ga":
                    if not self.is_active: print("   -> Cannot test GA. Prometheus is INACTIVE."); continue
                    print("\n--- Testing Genetic Algorithm Core Functions ---")
                    test_command = "/backtest"
                    test_strategy = "rsi"
                    pop_size = 10
                    print(f"1. Generating initial population for {test_command}/{test_strategy} (size={pop_size})...")
                    initial_pop = self._generate_initial_population(test_command, test_strategy, pop_size)
                    if not initial_pop: print("   -> Failed to generate population."); continue
                    print(f"   -> Generated {len(initial_pop)} individuals. Example: {initial_pop[0]}")
                    print("\n2. Evaluating fitness (using DB scores if available)...")
                    pop_with_fitness = await self._evaluate_fitness(initial_pop, test_command, test_strategy)
                    if not pop_with_fitness: print("   -> Fitness evaluation failed."); continue
                    if not pop_with_fitness:
                         print("   -> No individuals after fitness evaluation.")
                         continue
                    print(f"   -> Top individual: {pop_with_fitness[0][0]} (Fitness: {pop_with_fitness[0][1]:.3f})")
                    print(f"   -> Bottom individual: {pop_with_fitness[-1][0]} (Fitness: {pop_with_fitness[-1][1]:.3f})")

                    num_parents_to_select = len(pop_with_fitness) // 2
                    print(f"\n3. Selecting top {num_parents_to_select} parents...")
                    parents = self._select_parents(pop_with_fitness, num_parents_to_select)
                    if not parents: print("   -> Parent selection failed."); continue
                    print(f"   -> Selected {len(parents)} parents. Example parent: {parents[0]}")
                    num_offspring = pop_size - len(parents)
                    print(f"\n4. Creating {num_offspring} offspring via crossover...")
                    offspring = self._crossover(parents, num_offspring)
                    if not offspring: print("   -> Crossover failed or produced no offspring."); offspring = []
                    
                    print("\n5. Mutating offspring...")
                    mutated_offspring = self._mutate(offspring, test_command, test_strategy, mutation_rate=0.2)
                    if not mutated_offspring: print("   -> Mutation produced no offspring."); mutated_offspring = []
                    else: print(f"   -> Mutation complete. Example mutated offspring: {mutated_offspring[0]}")

                    next_generation = parents + mutated_offspring
                    print(f"\n-> Next generation size: {len(next_generation)}")
                    print("--- GA Test Complete ---")
                else: 
                    # --- MODIFIED: Added 'status' to help text ---
                    print("Unknown command. Available: status, analyze patterns, check correlations, query log <limit>, generate memo, generate recipe, generate code <file.py> [t] [p], compare code <orig.py> <improved.py> [t] [p], optimize parameters <strat> <t> <p> [gen] [pop], test ga, exit")
                    # --- END MODIFIED ---
            except EOFError: prometheus_logger.warning("EOF received, exiting Prometheus shell."); break
            except Exception as e: prometheus_logger.exception(f"Error in Prometheus shell: {e}"); print(f"Error: {e}")
        print("Returning to M.I.C. Singularity main shell.")
        
    async def _query_log_db(self, limit: int = 10):
         # ... (implementation remains the same) ...
         print(f"\n--- Recent Command Logs (Last {limit}) ---")
         try:
             conn = sqlite3.connect(self.db_path); conn.row_factory = sqlite3.Row; cursor = conn.cursor(); cursor.execute("SELECT id, timestamp, command, parameters, success, duration_ms, output_summary FROM command_log ORDER BY id DESC LIMIT ?", (limit,)); rows = cursor.fetchall(); conn.close()
             if not rows: print("No logs found."); return
             log_data = []; headers = ["ID", "Timestamp", "Success", "Duration", "Command", "Parameters", "Summary"]
             for row in reversed(rows):
                 ts = datetime.fromisoformat(row['timestamp']).strftime('%H:%M:%S');
                 success_str = "OK" if row['success'] else "FAIL"; params_str = "<err>"
                 try:
                     params_data = json.loads(row['parameters'])
                     if isinstance(params_data, list): params_str = " ".join(map(str, params_data))
                     elif isinstance(params_data, dict): params_str = json.dumps(params_data, separators=(',', ':'))
                     else: params_str = str(params_data)
                 except (json.JSONDecodeError, TypeError): params_str = row['parameters'] if row['parameters'] else ""
                 params_str_trunc = params_str[:30] + ('...' if len(params_str) > 30 else '')
                 summary_str_trunc = row['output_summary'].replace('\n', ' ')[:50] + ('...' if len(row['output_summary']) > 50 else '')
                 log_data.append([row['id'], ts, success_str, f"{row['duration_ms']}ms", row['command'], params_str_trunc, summary_str_trunc])
             print(tabulate(log_data, headers=headers, tablefmt="grid"))
         except Exception as e: prometheus_logger.exception(f"Error querying log db: {e}"); print(f"Error: {e}")

    async def detect_market_regime(self, ticker: str = "SPY") -> Dict[str, Any]:
        """
        [New] Analyzes the market to classify the current 'Regime' using Option C (Trend + Volatility).
        Returns a dict with regime name, specific metrics, and raw values.
        """
        prometheus_logger.info(f"Detecting market regime for {ticker}...")
        try:
            # 1. Fetch Data (Price for Trend, VIX for Volatility)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=300) # Need >200 days for SMA200
            
            # Robustly fetch SPY and VIX
            spy_data = await get_yf_download_robustly([ticker], start=start_date, end=end_date)
            vix_data = await get_yf_download_robustly(['^VIX'], start=end_date - timedelta(days=10), end=end_date)

            if spy_data.empty or vix_data.empty:
                prometheus_logger.warning("Insufficient data for regime detection.")
                return {"regime": "Unknown", "reason": "Insufficient Data"}

            # Handle MultiIndex / Data Structure nuances
            spy_close = spy_data['Close']
            if isinstance(spy_close, pd.DataFrame): spy_close = spy_close.iloc[:, 0]
            
            vix_close = vix_data['Close']
            if isinstance(vix_close, pd.DataFrame): vix_close = vix_close.iloc[:, 0]

            if len(spy_close) < 200:
                return {"regime": "Unknown", "reason": "Not enough history for SMA200"}

            current_price = spy_close.iloc[-1]
            current_vix = vix_close.iloc[-1]
            
            # 2. Calculate Technicals (Trend)
            sma_50 = spy_close.rolling(window=50).mean().iloc[-1]
            sma_200 = spy_close.rolling(window=200).mean().iloc[-1]
            
            # 3. Classify Trend (Option C Part 1)
            trend = "Sideways"
            if current_price > sma_50 and current_price > sma_200: 
                trend = "Bull"
            elif current_price < sma_50 and current_price < sma_200: 
                trend = "Bear"
            
            # 4. Classify Volatility (Option C Part 2)
            volatility = "Normal"
            if current_vix > 25: 
                volatility = "High_Vol"
            elif current_vix < 12: 
                volatility = "Low_Vol"
            
            # 5. Construct Regime String
            regime_name = f"{trend}_{volatility}" # e.g., "Bull_Low_Vol", "Bear_High_Vol"
            
            result = {
                "regime": regime_name,
                "trend": trend,
                "volatility": volatility,
                "current_vix": float(current_vix),
                "sma_200_dist_pct": float((current_price - sma_200) / sma_200 * 100),
                "timestamp": datetime.now().isoformat()
            }
            
            prometheus_logger.info(f"Market Regime Detected: {regime_name} (VIX: {current_vix:.2f})")
            return result

        except Exception as e:
            prometheus_logger.error(f"Error detecting regime: {e}")
            return {"regime": "Unknown", "error": str(e)}

    async def get_best_strategy_for_regime(self, regime: str, universe: str = "SPY_500") -> Optional[Dict[str, Any]]:
        """
        [New] Queries the 'convergence_results' DB to find the best parameters 
        from historical periods that match the CURRENT regime.
        """
        prometheus_logger.info(f"Looking up best strategy for regime: {regime}")
        
        # Map dynamic regime (Real-time) to hardcoded historical conditions (DB tags)
        # This allows Prometheus to use "2022_Bear" lessons for a "Bear_High_Vol" today.
        condition_mapping = {
            "Bear_High_Vol": ["2022_Bear", "COVID_Crash"],
            "Bear_Normal": ["2022_Bear"],
            "Bull_High_Vol": ["2021_Bull"], 
            "Bull_Low_Vol": ["2021_Bull", "Current_1Y"],
            "Bull_Normal": ["Current_1Y"],
            "Sideways_Normal": ["Current_1Y"],
            "Sideways_High_Vol": ["2022_Bear"] # Defensive assumption
        }
        
        target_conditions = condition_mapping.get(regime, ["Current_1Y"])
        placeholders = ','.join('?' * len(target_conditions))
        
        # Query for the highest return strategy in matching conditions
        query = f"""
            SELECT strategy_name, best_params_json, total_return_pct, best_sharpe_ratio, market_condition
            FROM convergence_results
            WHERE market_condition IN ({placeholders})
            AND universe = ?
            AND total_return_pct > 0
            ORDER BY total_return_pct DESC
            LIMIT 1
        """
        
        args = target_conditions + [universe]
        
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                cursor = await db.execute(query, args)
                row = await cursor.fetchone()
                
                if row:
                    prometheus_logger.info(f"Found historical match: {row['strategy_name']} from {row['market_condition']}")
                    return {
                        "strategy": row['strategy_name'],
                        "params": json.loads(row['best_params_json']),
                        "historical_return": row['total_return_pct'],
                        "source_condition": row['market_condition']
                    }
                else:
                    prometheus_logger.warning(f"No exact historical match found for {regime}. Will use generic defaults.")
                    return None
        except Exception as e:
            prometheus_logger.error(f"Error fetching best strategy: {e}")
            return None

    async def run_autonomous_optimization(self, universe_ticker: str = "SPY") -> Dict[str, Any]:
        """
        [Quiet Version] The Core Self-Driving Loop.
        Only prints to console if a NEW better strategy is found or an error occurs.
        """
        # Log to file, not console
        prometheus_logger.info(f"Starting autonomous optimization for {universe_ticker}...")
        
        # 1. Detect Regime
        regime_data = await self.detect_market_regime(universe_ticker)
        current_regime = regime_data.get("regime", "Unknown")
        
        # 2. Find Historical Winner
        best_historical = await self.get_best_strategy_for_regime(current_regime)
        
        seed_population = []
        strategy_to_test = "rsi" # Default
        
        if best_historical:
            strategy_to_test = best_historical['strategy']
            seed_population.append(best_historical['params'])
        
        # 3. Optimize (Quietly)
        end_date = datetime.now()
        start_date = end_date - relativedelta(months=6)
        
        # We assume /backtest optimization covers the coefficients
        best_params, best_fitness, metrics = await self.run_parameter_optimization(
            command_name="/backtest",
            strategy_name=strategy_to_test,
            ticker=universe_ticker,
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d'),
            seed_population=seed_population,
            generations=6, # Slightly reduced for speed
            population_size=15
        )
        
        # 4. Save & Report
        if best_params:
            live_config = {
                "timestamp": datetime.now().isoformat(),
                "regime_detected": current_regime,
                "strategy_name": strategy_to_test,
                "active_parameters": best_params,
                "expected_return_6mo": best_fitness,
                "status": "Active"
            }
            
            try:
                with open("prometheus_live_strategy.json", "w") as f:
                    json.dump(live_config, f, indent=4)
                
                # ONLY PRINT THIS IF SUCCESSFUL
                print(f"\n[Prometheus] ✅ Strategy Update: {strategy_to_test} ({best_fitness:.2f}%) for {current_regime}")
                return {"status": "success", "config": live_config}
            except Exception as e:
                print(f"[Prometheus] ❌ Error saving live strategy: {e}")

        return {"status": "failure"}
      
# Need BaseStrategy for type checking in _load_strategy_class_from_file
try: from dev_command import BaseStrategy # type: ignore
except ImportError:
    prometheus_logger.warning("BaseStrategy not found, defining a dummy class for type checking.")
    class BaseStrategy: pass