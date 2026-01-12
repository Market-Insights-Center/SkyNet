# --- Imports for market_command ---
import asyncio
import os
import sys
import csv
from datetime import datetime
from io import StringIO
from typing import List, Dict, Any, Optional

import pandas as pd
import numpy as np
import requests
import yfinance as yf
import matplotlib
matplotlib.use('Agg') # Use non-interactive backend
import matplotlib.pyplot as plt
import io
import base64
from tabulate import tabulate
import traceback
from tradingview_screener import Column, Query
try:
    from backend.usage_counter import increment_usage
except ImportError:
    try:
        from usage_counter import increment_usage
    except ImportError:
        def increment_usage(*args): pass

# --- Imports ---
try:
    from backend.integration.invest_command import calculate_ema_invest, screen_custom_market_stocks
except ImportError:
    try:
        from integration.invest_command import calculate_ema_invest, screen_custom_market_stocks
    except ImportError:
         print("CRITICAL: invest_command not found for market_command.")

# --- Helper Functions ---
def safe_score(val):
    if val is None: return -float('inf')
    try:
        return float(val)
    except:
        return -float('inf')

# --- Constants ---
MARKET_FULL_SENS_DATA_FILE_PREFIX = 'market_full_sens_'

# --- Helper Functions (copied for self-containment) ---

def get_sp500_symbols_singularity(is_called_by_ai: bool = False) -> List[str]:
    """Fetches S&P 500 symbols from Wikipedia."""
    try:
        sp500_url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(sp500_url, headers=headers, timeout=15)
        response.raise_for_status()
        dfs = pd.read_html(StringIO(response.text))
        if not dfs: return []
        sp500_df = dfs[0]
        if 'Symbol' not in sp500_df.columns: return []
        symbols = [str(s).replace('.', '-') for s in sp500_df['Symbol'].tolist() if isinstance(s, str)]
        return sorted(list(set(s for s in symbols if s)))
    except Exception:
        return []

def screen_custom_market_stocks(market_cap_min: float, avg_vol_min: float) -> List[str]:
    """
    Screens for stocks using TradingView based on market cap and volume.
    """
    print(f"  -> Screening for stocks (MCAP > ${int(market_cap_min/1e9)}B, Vol > {int(avg_vol_min/1e6)}M)...")
    try:
        # Build the query with specified filters
        query = Query().select('name').where(
            Column('market_cap_basic') >= market_cap_min,
            Column('average_volume_90d_calc') >= avg_vol_min
        ).limit(1000) # Limit to a reasonable number for performance

        # Execute the scanner
        _, df = query.get_scanner_data(timeout=60)

        if df is not None and 'name' in df.columns:
            # Extract, clean, and standardize ticker symbols
            tickers = [str(t).split(':')[-1].replace('.', '-') for t in df['name'].tolist() if pd.notna(t)]
            unique_tickers = sorted(list(set(tickers)))
            print(f"     ...found {len(unique_tickers)} stocks matching criteria.")
            return unique_tickers
        print("     ...screener returned no data.")
        return []
    except Exception as e:
        print(f"     ...screener failed with an error: {type(e).__name__}")
        return []

def safe_score(value: Any) -> float:
    """Safely converts a value to a float, returning 0.0 on failure."""
    try:
        if pd.isna(value) or value is None: return 0.0
        if isinstance(value, str): value = value.replace('%', '').replace('$', '').strip()
        return float(value)
    except (ValueError, TypeError): return 0.0
    except Exception: return 0.0

async def calculate_ema_invest(ticker: str, ema_interval: int, is_called_by_ai: bool = False) -> tuple[Optional[float], Optional[float]]:
    """Calculates the INVEST score for a ticker based on EMA sensitivity."""
    stock = yf.Ticker(ticker.replace('.', '-'))
    interval_map = {1: "1wk", 2: "1d", 3: "1h"}
    period_map = {1: "max", 2: "10y", 3: "2y"}
    try:
        data = await asyncio.to_thread(stock.history, period=period_map.get(ema_interval, "2y"), interval=interval_map.get(ema_interval, "1h"))
        if data.empty or 'Close' not in data.columns: return None, None
        
        # Freshness Check: If last data point is older than 10 days, discard.
        last_date = data.index[-1]
        if isinstance(last_date, pd.Timestamp):
             # Simple check: compare to now.
             import datetime
             # Use naive comparison if tz-aware
             now = datetime.datetime.now(last_date.tzinfo) if last_date.tzinfo else datetime.datetime.now()
             if (now - last_date).days > 10:
                  return None, None

        data['EMA_8'] = data['Close'].ewm(span=8, adjust=False).mean()
        data['EMA_55'] = data['Close'].ewm(span=55, adjust=False).mean()
        if data.empty or data.iloc[-1][['Close', 'EMA_8', 'EMA_55']].isna().any():
            return (data['Close'].iloc[-1] if not data.empty and pd.notna(data['Close'].iloc[-1]) else None), None
        latest = data.iloc[-1]
        live_price, ema_8, ema_55 = latest['Close'], latest['EMA_8'], latest['EMA_55']
        if pd.isna(live_price) or pd.isna(ema_8) or pd.isna(ema_55) or ema_55 == 0: return live_price, None
        ema_invest_score = (((ema_8 - ema_55) / ema_55) * 4 + 0.5) * 100
        return float(live_price), float(ema_invest_score)
    except Exception:
        return None, None

# --- Core Logic Functions (from market.py) ---

def process_market_chart_data(top_tickers: List[str], bot_tickers: List[str], df: pd.DataFrame) -> Dict[str, Any]:
    """
    Processes yfinance MultiIndex DataFrame into two JSON-friendly structures for frontend charts.
    Calculates percentage change from the start of the period for each ticker.
    """
    if df.empty: 
        print("Chart Data Gen: DF is empty.")
        return {}
    
    # Helper to process a group of tickers normalized vs SPY
    def process_group(tickers):
        group_tickers = list(set(tickers + ['SPY']))
        
        # Determine accessible tickers based on DF structure
        available_cols = []
        is_multi = isinstance(df.columns, pd.MultiIndex)
        
        if is_multi:
            # MultiIndex: (Ticker, PriceType) -> df.columns.levels[0]
            available_cols = df.columns.levels[0].tolist()
        else:
            # Single Index or different structure.
            # If group_by='ticker' is used but only 1 ticker, it might not be MultiIndex depending on version.
            # Or if auto_adjust=True, might be flat if 1 ticker.
            # But here we likely have many.
            pass
            
        closes = pd.DataFrame()
        
        for t in group_tickers:
            try:
                if is_multi:
                    if t in df.columns.levels[0]:
                        if 'Close' in df[t]:
                            closes[t] = df[t]['Close']
                        elif 'Adj Close' in df[t]: # Fallback
                             closes[t] = df[t]['Adj Close']
                else:
                    # Fallback flat structure: "Ticker" or "Close" if single?
                    # If multiple tickers and flat, maybe "Close" "Close" "Close"? No, yfinance usually gives MultiIndex
                    # If flat with one ticker, columns are Open, High, Low, Close...
                    # If flat with multiple tickers (legacy?), columns are Tickers (if only Close downloaded?)
                    if t in df.columns:
                        closes[t] = df[t]
            except Exception as e:
                # print(f"DEBUG: Failed to extract {t}: {e}")
                continue
            
        closes.dropna(inplace=True)
        if closes.empty: 
            print(f"Chart Data Gen: Closes DF empty for group {tickers[:3]}...")
            return []

        # Normalize to percent change from start
        # Use first valid index
        first_valid_idx = closes.first_valid_index()
        if not first_valid_idx: return []
        
        base_vals = closes.loc[first_valid_idx]
        normalized = (closes / base_vals - 1) * 100
        # Ensure stocks don't drop below -100% (impossible price < 0)
        normalized = normalized.clip(lower=-100.0)
        normalized.reset_index(inplace=True)
        
        # Convert to records: [{date: '...', SPY: 10.5, AAPL: 12.0}, ...]
        records = []
        for _, row in normalized.iterrows():
            record = {'date': row['Date'].strftime('%Y-%m-%d')}
            for t in closes.columns:
                if t in row and t != 'Date':
                   val = row[t]
                   if pd.notna(val) and not np.isinf(val):
                        record[t] = val
            records.append(record)
        return records

    try:
        return {
            "top_10_data": process_group(top_tickers),
            "bottom_10_data": process_group(bot_tickers)
        }
    except Exception as e:
        print(f"Chart Processing Error: {e}")
        traceback.print_exc()
        return {}

async def calculate_market_invest_scores_singularity(tickers: List[str], ema_sens: int, progress_callback: Optional[Any] = None) -> List[Dict[str, Any]]:
    """Calculates INVEST scores for a list of tickers in parallel."""
    result_data_market = []
    total_tickers = len(tickers)
    print(f"\nCalculating Invest scores for {total_tickers} market tickers (Sensitivity: {ema_sens})...")
    
    # Granular Progress Tracking
    processed_count = 0
    progress_lock = asyncio.Lock()
    
    async def process_ticker(ticker: str):
        nonlocal processed_count
        res_item = await calculate_ema_invest(ticker, ema_sens, is_called_by_ai=True)
        
        async with progress_lock:
             processed_count += 1
             # Report every 5 tickers or last one to reduce noise
             if progress_callback and (processed_count % 5 == 0 or processed_count == total_tickers):
                 await progress_callback(f"Scanning market... ({processed_count}/{total_tickers})")
                 
        return ticker, res_item

    # Process in chunks to respect overall load but gather results flexibly
    chunk_size = 50 # Larger chunk size since we have semaphore inside invest_command
    
    for i in range(0, total_tickers, chunk_size):
        chunk = tickers[i:i + chunk_size]
        tasks = [process_ticker(t) for t in chunk]
        
        results_chunk = await asyncio.gather(*tasks, return_exceptions=True)
        
        for res in results_chunk:
            if isinstance(res, Exception): # Should be rare as process_ticker swallows usually
                 continue
            if not isinstance(res, tuple) or len(res) != 2: continue
            
            ticker_processed, res_item = res
            
            if isinstance(res_item, Exception): # From calculate_ema_invest exception
                 # result_data_market.append(...) # Logic to handle error if needed
                 pass 
            elif res_item:
                 if res_item[0] is not None or res_item[1] is not None:
                     # Check if exception inside tuple logic of calculate_ema_invest? 
                     # calculate_ema_invest returns (live_price, score) or (None, None)
                     live_price, score = res_item
                     result_data_market.append({'ticker': ticker_processed, 'live_price': live_price, 'score': score})
        
        print(f"  ...market scores calculated for {processed_count}/{total_tickers} tickers.")

    result_data_market.sort(key=lambda x: safe_score(x.get('score', -float('inf'))), reverse=True)
    print("Finished calculating all market scores.")
    return result_data_market

async def run_market_analysis(market_type: str, sensitivity: int, progress_callback: Optional[Any] = None) -> Dict[str, Any]:
    """Orchestrates the market analysis and returns structured data."""
    symbols = []
    market_name = ""
    
    if progress_callback: await progress_callback("Fetching market symbols...")
    
    if market_type == "sp500":
        market_name = "S&P 500"
        symbols = await asyncio.to_thread(get_sp500_symbols_singularity)
    elif market_type == "plus":
        market_name = ">50B MCAP & >5M Vol"
        symbols = await asyncio.to_thread(screen_custom_market_stocks, 50_000_000_000, 5_000_000)
    elif market_type == "plusplus":
        market_name = ">10B MCAP & >5M Vol"
        symbols = await asyncio.to_thread(screen_custom_market_stocks, 10_000_000_000, 5_000_000)
    
    if not symbols:
        return {"error": f"Could not retrieve symbols for {market_name}"}
        
    symbols = sorted(list(set(symbols + ['SPY'])))
    result_data = await calculate_market_invest_scores_singularity(symbols, sensitivity, progress_callback)
    
    if progress_callback: await progress_callback("Filtering valid scores...")
    
    valid_scores = [item for item in result_data if item.get('score') is not None]
    if not valid_scores:
        return {"error": "No valid scores calculated."}
        
    top_10 = valid_scores[:10]
    bottom_10 = sorted(valid_scores, key=lambda x: x.get('score', float('inf')))[:10]
    spy_data = next((item for item in result_data if item['ticker'] == 'SPY'), None)
    
    # --- Fetch Historical Data for Visualization ---
    try:
        if progress_callback: await progress_callback("Generating charts...")
        top_tickers = [t['ticker'] for t in top_10]
        bot_tickers = [t['ticker'] for t in bottom_10]
        all_chart_tickers = list(set(top_tickers + bot_tickers + ['SPY']))
        
        period_map = {1: '5y', 2: '1y', 3: '6mo'}
        period = period_map.get(sensitivity, '1y')
        
        hist_data = await asyncio.wait_for(
            asyncio.to_thread(
                yf.download, 
                tickers=all_chart_tickers, 
                period=period, 
                interval='1d', 
                progress=False, 
                auto_adjust=True,
                group_by='ticker'
            ),
            timeout=45.0 # Timeout after 45 seconds to prevent hanging
        )

        if not hist_data.empty:
            available_tickers = set(hist_data.columns.get_level_values(0).unique())
            top_10 = [t for t in top_10 if t['ticker'] in available_tickers]
            bottom_10 = [t for t in bottom_10 if t['ticker'] in available_tickers]
            
            top_tickers = [t['ticker'] for t in top_10]
            bot_tickers = [t['ticker'] for t in bottom_10]

        chart_data_struct = await asyncio.to_thread(process_market_chart_data, top_tickers, bot_tickers, hist_data)
    except asyncio.TimeoutError:
        print("Chart Data Gen: Timed out after 45s.")
        chart_data_struct = {}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Chart gen failed in run_market_analysis: {e}")
        chart_data_struct = {}
    
    return {
        "market_name": market_name,
        "sensitivity": sensitivity,
        "top_10": top_10,
        "bottom_10": bottom_10,
        "all_data": valid_scores,
        "spy_data": spy_data,
        "chart_data": chart_data_struct
    }
        
# --- Main Command Handler ---
async def handle_market_command(
    args: List[str], 
    ai_params: Optional[Dict] = None, 
    is_called_by_ai: bool = False,
    progress_callback: Optional[Any] = None
):
    """Handles displaying or saving market data based on different stock lists."""
    await increment_usage('market')
    try:
        action = "display"
        market_type = "sp500"  # default
        sensitivity = None
        date_str = None

        if ai_params:
            action = ai_params.get("action", "display")
            sensitivity = int(ai_params.get("sensitivity", 2))
            date_str = ai_params.get("date_str")
            market_type = ai_params.get("market_type", "sp500")
        else: # CLI Path
            # ... CLI args parsing (unchanged) ...
            if not args:
                market_type = "sp500"
            elif args[0] == "+":
                 market_type = "plus"
            elif args[0] == "++":
                 market_type = "plusplus"
            elif args[0] == "3725":
                 action = "save"
            else:
                 try:
                     sensitivity = int(args[0])
                 except: pass

        if action == 'save':
             # ... CLI save logic ...
             return

        if action == 'display':
            # If called by AI/API, we bypass the CLI inputs and print logic usually
            if is_called_by_ai:
                return await run_market_analysis(
                    market_type, 
                    sensitivity if sensitivity else 2,
                    progress_callback=progress_callback
                )

            # CLI Display Logic
            if sensitivity is None:
                sensitivity_str = input("Enter Market Sensitivity (1:Weekly, 2:Daily, 3:Hourly): ")
                try:
                    sensitivity = int(sensitivity_str)
                except ValueError:
                    print("Invalid sensitivity. Please enter 1, 2, or 3.")
                    return

            symbols = []
            if market_type == "sp500":
                market_name = "S&P 500"
                symbols = await asyncio.to_thread(get_sp500_symbols_singularity)
            elif market_type == "plus":
                market_name = ">50B MCAP & >5M Vol"
                symbols = await asyncio.to_thread(screen_custom_market_stocks, 50_000_000_000, 5_000_000)
            elif market_type == "plusplus":
                market_name = ">10B MCAP & >5M Vol"
                symbols = await asyncio.to_thread(screen_custom_market_stocks, 10_000_000_000, 5_000_000)
            
            if not symbols:
                print(f"Could not retrieve stock list. Aborting.")
                return

            await display_market_scores(sensitivity, symbols, market_name)

    except (ValueError, IndexError):
        pass

    if is_called_by_ai:
        return "The /market command has been executed. Results are in the console."