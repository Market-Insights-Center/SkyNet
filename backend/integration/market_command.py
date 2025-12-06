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

async def calculate_market_invest_scores_singularity(tickers: List[str], ema_sens: int) -> List[Dict[str, Any]]:
    """Calculates INVEST scores for a list of tickers in parallel."""
    result_data_market = []
    total_tickers = len(tickers)
    print(f"\nCalculating Invest scores for {total_tickers} market tickers (Sensitivity: {ema_sens})...")
    chunk_size = 25
    processed_count_market = 0
    for i in range(0, total_tickers, chunk_size):
        chunk = tickers[i:i + chunk_size]
        tasks = [calculate_ema_invest(ticker, ema_sens, is_called_by_ai=True) for ticker in chunk]
        results_chunk = await asyncio.gather(*tasks, return_exceptions=True)
        for idx, res_item in enumerate(results_chunk):
            ticker_processed = chunk[idx]
            if isinstance(res_item, Exception):
                result_data_market.append({'ticker': ticker_processed, 'live_price': None, 'score': None, 'error': str(res_item)})
            elif res_item is not None:
                live_price_market, ema_invest_score_market = res_item
                result_data_market.append({'ticker': ticker_processed, 'live_price': live_price_market, 'score': ema_invest_score_market})
            processed_count_market += 1
        print(f"  ...market scores calculated for {processed_count_market}/{total_tickers} tickers.")
    result_data_market.sort(key=lambda x: safe_score(x.get('score', -float('inf'))), reverse=True)
    print("Finished calculating all market scores.")
    return result_data_market

async def save_market_data_singularity(sensitivity: int, date_str: str):
    """Fetches and saves S&P 500 scores for a given sensitivity and date."""
    print(f"\n--- Saving Full S&P500 Market Data (Sensitivity: {sensitivity}) for Date: {date_str} ---")
    sp500_symbols = await asyncio.to_thread(get_sp500_symbols_singularity)
    if not sp500_symbols:
        print("Error: Could not retrieve S&P 500 symbols.")
        return
    
    all_scores_data = await calculate_market_invest_scores_singularity(sp500_symbols, sensitivity)
    if not all_scores_data:
        print("Error: No valid market data calculated. Nothing saved.")
        return

    data_to_save = []
    for item in all_scores_data:
        if item.get('score') is not None:
            data_to_save.append({'DATE': date_str, 'TICKER': item['ticker'], 'PRICE': f"{item['live_price']:.2f}", 'SCORE': f"{item['score']:.2f}"})

    if not data_to_save:
        print("No tickers with valid scores found. Nothing saved.")
        return
    
    save_filename = f"{MARKET_FULL_SENS_DATA_FILE_PREFIX}{sensitivity}_data.csv"
    file_exists = os.path.isfile(save_filename)
    try:
        with open(save_filename, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['DATE', 'TICKER', 'PRICE', 'SCORE'])
            if not file_exists or os.path.getsize(f.name) == 0:
                writer.writeheader()
            writer.writerows(data_to_save)
        print(f"Successfully saved {len(data_to_save)} records to '{save_filename}'.")
    except IOError as e:
        print(f"Error writing market data to '{save_filename}': {e}")

async def display_market_scores(sensitivity: int, symbols_to_process: List[str], market_name: str):
    """Fetches, calculates, and displays market scores for a given list of stocks."""
    if not symbols_to_process:
        print(f"Error: No symbols provided for {market_name} market analysis.")
        return

    all_scores_data = await calculate_market_invest_scores_singularity(symbols_to_process, sensitivity)
    
    valid_scores = [item for item in all_scores_data if item.get('score') is not None]
    if not valid_scores:
        print(f"No valid scores could be calculated for the {market_name} list.")
        return
        
    top_10 = valid_scores[:10]
    bottom_10 = sorted(valid_scores, key=lambda x: x.get('score', float('inf')))[:10]
    spy_score_item = next((item for item in all_scores_data if item['ticker'] == 'SPY'), None)

    def format_row(item):
        price, score = item.get('live_price'), item.get('score')
        return [item.get('ticker', 'ERR'), f"${price:.2f}" if price is not None else "N/A", f"{score:.2f}%" if score is not None else "N/A"]
        
    print(f"\n**Top 10 {market_name} Stocks (Sensitivity: {sensitivity})**")
    print(tabulate([format_row(r) for r in top_10], headers=["Ticker", "Price", "Score"]))
    
    print(f"\n**Bottom 10 {market_name} Stocks (Sensitivity: {sensitivity})**")
    print(tabulate([format_row(r) for r in bottom_10], headers=["Ticker", "Price", "Score"]))
    
    print(f"\n**SPY Score (Sensitivity: {sensitivity})**")
    if spy_score_item:
        print(tabulate([format_row(spy_score_item)], headers=["Ticker", "Price", "Score"]))
    else:
        print("SPY score not available.")

def process_market_chart_data(top_10_tickers, bottom_10_tickers, historical_data):
    """
    Processes historical dataframe into a JSON-friendly structure for frontend Recharts.
    Returns:
        {
            "top_10_data": [{ "date": "...", "SPY": 1.2, "AAPL": 3.4 ... }, ...],
            "bottom_10_data": [{ "date": "...", "SPY": 1.2, "TSLA": -5.6 ... }, ...]
        }
    """
    try:
        if historical_data.empty: return {}
        
        def process_group(tickers):
            # 1. Extract valid series and normalize
            # Create a common date index from SPY if available, otherwise union of all
            # Ideally SPY is the baseline.
            
            data_dict = {} # { date_str: { ticker: value } }
            
            # SPY
            spy_series = None
            if 'SPY' in historical_data.columns.get_level_values(0):
                 spy_raw = historical_data['SPY']['Close'] if 'Close' in historical_data['SPY'] else historical_data['SPY']
                 spy_series = spy_raw.dropna()
                 spy_norm = (spy_series / spy_series.iloc[0] - 1) * 100
            
            tickers_to_process = [t for t in tickers if t != 'SPY']
            
            # Helper to add series to data_dict
            def add_series(ticker, series):
                for date, val in series.items():
                    date_str = date.strftime('%Y-%m-%d')
                    if date_str not in data_dict: data_dict[date_str] = {'date': date_str}
                    data_dict[date_str][ticker] = val

            if spy_series is not None:
                add_series('SPY', spy_norm)

            for ticker in tickers_to_process:
                try:
                    if isinstance(historical_data.columns, pd.MultiIndex):
                        if ticker not in historical_data.columns.get_level_values(0): continue
                        raw = historical_data[ticker]['Close']
                    else:
                        if ticker not in historical_data.columns: continue
                        raw = historical_data[ticker]
                    
                    raw = raw.dropna()
                    if raw.empty: continue
                    
                    # Normalize to start of specific series or start of period? 
                    # Usually start of period (align with SPY start if possible or self-start).
                    # Normalized to self-start is standard for "performance" comparison.
                    norm = (raw / raw.iloc[0] - 1) * 100
                    add_series(ticker, norm)
                except: continue
            
            # Convert data_dict to sorted list
            final_list = sorted(list(data_dict.values()), key=lambda x: x['date'])
            return final_list

        return {
            "top_10_data": process_group(top_10_tickers + ['SPY']),
            "bottom_10_data": process_group(bottom_10_tickers + ['SPY'])
        }
    except Exception as e:
        print(f"Data processing error: {e}")
        traceback.print_exc()
        return {}

async def run_market_analysis(market_type: str, sensitivity: int) -> Dict[str, Any]:
    """Orchestrates the market analysis and returns structured data."""
    symbols = []
    market_name = ""
    
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
    result_data = await calculate_market_invest_scores_singularity(symbols, sensitivity)
    
    valid_scores = [item for item in result_data if item.get('score') is not None]
    if not valid_scores:
        return {"error": "No valid scores calculated."}
        
    top_10 = valid_scores[:10]
    bottom_10 = sorted(valid_scores, key=lambda x: x.get('score', float('inf')))[:10]
    spy_data = next((item for item in result_data if item['ticker'] == 'SPY'), None)
    
    # --- Fetch Historical Data for Visualization ---
    try:
        top_tickers = [t['ticker'] for t in top_10]
        bot_tickers = [t['ticker'] for t in bottom_10]
        all_chart_tickers = list(set(top_tickers + bot_tickers + ['SPY']))
        
        period_map = {1: '5y', 2: '1y', 3: '6mo'}
        period = period_map.get(sensitivity, '1y')
        
        # Async fetch separate from command logic if possible, but here we do blocking in thread for now or use yf directly
        # Since this is running in main thread (awaited), we should be careful. 
        # Ideally move this to a thread.
        # However, to keep it simple within existing structure:
        
        hist_data = await asyncio.to_thread(
            yf.download, 
            tickers=all_chart_tickers, 
            period=period, 
            interval='1d', 
            progress=False, 
            auto_adjust=True,
            group_by='ticker' # Vital for multi-ticker structure consistency
        )

        # Consistency Check: Filter out tickers that yfinance dropped (e.g. duplicates like SNDK/WDC)
        # to ensure table matches chart exactly.
        if not hist_data.empty:
            available_tickers = set(hist_data.columns.get_level_values(0).unique())
            top_10 = [t for t in top_10 if t['ticker'] in available_tickers]
            bottom_10 = [t for t in bottom_10 if t['ticker'] in available_tickers]
            
            # Re-extract tickers for chart processing
            top_tickers = [t['ticker'] for t in top_10]
            bot_tickers = [t['ticker'] for t in bottom_10]

        chart_data_struct = await asyncio.to_thread(process_market_chart_data, top_tickers, bot_tickers, hist_data)
    except Exception as e:
        print(f"Chart gen failed: {e}")
        chart_data_struct = {}
    
    return {
        "market_name": market_name,
        "sensitivity": sensitivity,
        "top_10": top_10,
        "bottom_10": bottom_10,
        "all_data": valid_scores,
        "spy_data": spy_data,
        "chart_data": chart_data_struct # Renamed from chart_image
    }
        
# --- Main Command Handler ---
async def handle_market_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
    """Handles displaying or saving market data based on different stock lists."""
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
                    market_type = "sp500"
                except ValueError:
                    print(f"Invalid argument '{args[0]}'. Use a number (1-3), '+', '++', or '3725'.")
                    return
        
        # --- Handle Actions ---
        if action == 'save':
            if not sensitivity:
                sensitivity = int(input("Enter S&P500 Market Sensitivity (1, 2, or 3) to save: "))
            if not date_str:
                date_str = input("Enter date (MM/DD/YYYY) to save data for: ")
            await save_market_data_singularity(sensitivity, date_str)
            return

        if action == 'display':
            # ... existing CLI logic ...
            if sensitivity is None:
                # ... check args ...
                pass 
                
            # If called by AI/API, we bypass the CLI inputs and print logic usually
            if is_called_by_ai:
                return await run_market_analysis(market_type, sensitivity if sensitivity else 2)

            # ... existing CLI code ...
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

            symbols_to_run = sorted(list(set(symbols + ['SPY'])))
            await display_market_scores(sensitivity, symbols_to_run, market_name)

    except (ValueError, IndexError):
        print("Invalid input. Please provide a valid sensitivity (1, 2, or 3) or option ('+', '++').")

    if is_called_by_ai:
        return "The /market command has been executed. Results are in the console."