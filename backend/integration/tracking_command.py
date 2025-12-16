# tracking_command.py

# --- Imports ---
import asyncio
import os
import csv
from typing import List, Dict, Any, Optional
from collections import defaultdict
import pandas as pd
from tabulate import tabulate
import matplotlib.pyplot as plt
import numpy as np
import uuid
import traceback
import re
import smtplib
import configparser
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import math

# --- Constants ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBPORTFOLIO_NAMES_FILE = os.path.join(BASE_DIR, 'portfolio_subportfolio_names.csv')
CONFIG_FILE = os.path.join(BASE_DIR, 'config.ini')

config = configparser.ConfigParser()
config.read(CONFIG_FILE)

# --- Local Imports from other command modules ---
from backend.integration.custom_command import (
    _get_custom_portfolio_run_csv_filepath, 
    _save_custom_portfolio_run_to_csv, 
    TRACKING_ORIGIN_FILE,
    load_portfolio_config, 
    PORTFOLIO_DB_FILE,
    PORTFOLIO_DB_FILE,
    safe_score,
    _load_all_subportfolio_names
)
from backend.integration.invest_command import calculate_ema_invest, process_custom_portfolio

# Try importing execution logic, fallback if missing
try:
    from backend.integration.execution_command import execute_portfolio_rebalance, get_robinhood_equity, get_robinhood_holdings
except ImportError:
    def execute_portfolio_rebalance(trades, known_holdings=None): 
        print("Execution module not found.")
        return []
    def get_robinhood_equity(): return 0.0
    def get_robinhood_holdings(): return {}

# --- Helper Functions ---
async def _send_tracking_email(subject: str, html_body: str, recipient_email: str):
    """Sends an HTML email notification."""
    try:
        smtp_server = config.get('EMAIL_CONFIG', 'SMTP_SERVER')
        smtp_port = config.getint('EMAIL_CONFIG', 'SMTP_PORT')
        sender_email = config.get('EMAIL_CONFIG', 'SENDER_EMAIL')
        sender_password = config.get('EMAIL_CONFIG', 'SENDER_PASSWORD')

        if not all([smtp_server, smtp_port, sender_email, sender_password, recipient_email]):
            print("⚠️ Email config incomplete. Cannot send notification.")
            return

        msg = MIMEMultipart()
        msg['From'], msg['To'], msg['Subject'] = sender_email, recipient_email, subject
        msg.attach(MIMEText(html_body, 'html'))

        def _send_email_sync():
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(sender_email, sender_password)
                server.send_message(msg)
        
        await asyncio.to_thread(_send_email_sync)
        
    except Exception as e:
        print(f"❌ Failed to send tracking email: {e}")

async def _load_portfolio_run(portfolio_code: str) -> Optional[List[Dict[str, Any]]]:
    filepath = _get_custom_portfolio_run_csv_filepath(portfolio_code)
    if not os.path.exists(filepath):
        return None
    try:
        run_data = []
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip() == "# ---BEGIN_DATA---":
                    break
            reader = csv.DictReader(f)
            for row in reader:
                run_data.append(row)
        return run_data
    except Exception as e:
        return None

def _get_subportfolio_map_from_config(portfolio_config: Dict[str, Any]) -> Dict[str, str]:
    ticker_map = {}
    num_portfolios = int(safe_score(portfolio_config.get('num_portfolios', 0)))
    for i in range(1, num_portfolios + 1):
        sub_portfolio_id = f'Sub-Portfolio {i}'
        tickers_str = portfolio_config.get(f'tickers_{i}', '')
        for ticker in tickers_str.split(','):
            if ticker.strip():
                ticker_map[ticker.strip().upper()] = sub_portfolio_id
    return ticker_map

def _load_all_subportfolio_names() -> Dict[str, str]:
    if not os.path.exists(SUBPORTFOLIO_NAMES_FILE):
        return {}
    names = {}
    try:
        with open(SUBPORTFOLIO_NAMES_FILE, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                composite_key = f"{row['PortfolioCode'].lower().strip()}|{row['SubPortfolioID'].strip()}"
                names[composite_key] = row['SubPortfolioName']
    except Exception:
        pass 
    return names

async def _load_portfolio_origin_data(portfolio_code: str) -> Dict[str, Dict[str, float]]:
    origin_data = {}
    if not os.path.exists(TRACKING_ORIGIN_FILE):
        return origin_data
    try:
        with open(TRACKING_ORIGIN_FILE, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['PortfolioCode'] == portfolio_code:
                    try:
                        origin_data[row['Ticker']] = {
                            'shares': float(row['Shares']),
                            'price': float(row['Price'])
                        }
                    except (ValueError, TypeError):
                        continue
    except Exception as e:
        print(f"[DEBUG TRACKING] ⚠️ Warning: Could not process origin data file: {e}")
        import traceback
        traceback.print_exc()
    return origin_data

# --- NEW HIERARCHICAL PERFORMANCE FUNCTIONS ---

def _build_nested_performance_dict(run_data: List[Dict[str, Any]], live_prices: Dict[str, float]) -> Dict:
    print(f"[DEBUG TRACKING] Building Nested Perf Dict from {len(run_data)} rows...")
    """Builds a nested dictionary from the flat run data."""
    root = {'children': {}, 'positions': [], 'initial_value': 0.0, 'current_value': 0.0}

    for row in run_data:
        ticker = row.get('Ticker')
        if not ticker or ticker == 'Cash':
            continue

        try:
            path_str = row.get('SubPortfolioPath', '')
            path_parts = [part.strip() for part in path_str.split('>') if part.strip()]
            
            saved_shares = float(row['Shares'])
            initial_value = float(row['ActualMoneyAllocation'])
            
            live_price = live_prices.get(ticker)
            current_value = (saved_shares * live_price) if live_price is not None else initial_value

            pnl = current_value - initial_value
            pnl_percent = (pnl / initial_value) * 100 if initial_value > 0 else 0

            position_data = {
                'ticker': ticker, 'initial_value': initial_value, 'current_value': current_value,
                'pnl': pnl, 'pnl_percent': pnl_percent
            }

            current_node = root
            for part in path_parts:
                if part not in current_node['children']:
                    current_node['children'][part] = {'children': {}, 'positions': [], 'initial_value': 0.0, 'current_value': 0.0}
                current_node = current_node['children'][part]
                current_node['initial_value'] += initial_value
                current_node['current_value'] += current_value
            
            current_node['positions'].append(position_data)
            root['initial_value'] += initial_value
            root['current_value'] += current_value

        except (ValueError, TypeError, KeyError) as e:
            print(f"  -> ⚠️ Warning: Could not process saved row for '{ticker}'. Error: {e}. Skipping.")
    
    print(f"[DEBUG TRACKING] Nested Perf Build Complete. Root Value: {root['current_value']}")
    return root['children']

async def get_all_time_performance_data(
    portfolio_code: str, 
    new_run_data: List[Dict[str, Any]], 
    old_run_data: Optional[List[Dict[str, Any]]], 
    portfolio_config: Dict[str, Any], 
    names_map: Dict[str, str],
    live_rh_holdings: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    print(f"[DEBUG TRACKING] Calculating All-Time Performance for {portfolio_code}...")
    """Calculates all-time performance data for return to frontend."""
    origin_data = await _load_portfolio_origin_data(portfolio_code)
    if not origin_data:
         print(f"[DEBUG TRACKING] No Origin Data found for {portfolio_code}")
    else:
         print(f"[DEBUG TRACKING] Loaded {len(origin_data)} origin records.")
    
    ticker_to_sub_id_map = _get_subportfolio_map_from_config(portfolio_config)
    ticker_to_sub_name_map = {ticker: names_map.get(sub_id, sub_id) for ticker, sub_id in ticker_to_sub_id_map.items()}

    current_holdings = {}
    if live_rh_holdings:
        current_holdings = live_rh_holdings
    else:
        current_holdings = {h['ticker']: float(h.get('shares', 0)) for h in new_run_data if h.get('ticker') != 'Cash'}
    
    previous_holdings = {h['Ticker']: float(h.get('Shares', 0)) for h in old_run_data if h.get('Ticker') != 'Cash'} if old_run_data else {}
    
    all_held_tickers = set(current_holdings.keys()) | set(previous_holdings.keys())
    if origin_data:
        all_held_tickers = all_held_tickers | set(origin_data.keys())

    tasks = [calculate_ema_invest(ticker, ema_interval=2, is_called_by_ai=True) for ticker in all_held_tickers]
    live_price_results = await asyncio.gather(*tasks)
    live_prices = {ticker: res[0] for ticker, res in zip(all_held_tickers, live_price_results) if res and res[0] is not None}

    if not origin_data:
        return {"all_time_data": [], "grand_total_pnl": 0.0, "live_prices": live_prices}

    all_time_data_by_sub = defaultdict(list)
    sub_portfolio_pnl_totals = defaultdict(float)
    grand_total_pnl = 0.0
    
    formatted_data = []

    for ticker in sorted(list(all_held_tickers)):
        origin = origin_data.get(ticker)
        if not origin: continue

        live_price = live_prices.get(ticker)
        if live_price is None: continue

        origin_shares = origin['shares']
        origin_price = origin['price']
        origin_value = origin_shares * origin_price
        
        current_shares = current_holdings.get(ticker, 0.0)
            
        all_time_pnl = (live_price - origin_price) * origin_shares
        
        all_time_pnl_pct = (all_time_pnl / origin_value) * 100 if origin_value > 0 else 0
        share_change = current_shares - origin_shares
        
        sub_name = ticker_to_sub_name_map.get(ticker, "Unassigned")
        
        formatted_data.append({
            "ticker": ticker,
            "origin_price": origin_price,
            "live_price": live_price,
            "origin_shares": origin_shares,
            "current_shares": current_shares,
            "share_change": share_change,
            "all_time_pnl": all_time_pnl,
            "all_time_pnl_pct": all_time_pnl_pct,
            "sub_portfolio": sub_name
        })

        sub_portfolio_pnl_totals[sub_name] += all_time_pnl
        grand_total_pnl += all_time_pnl
    
    print(f"[DEBUG TRACKING] All-Time Calc Done. Total PnL: {grand_total_pnl}")
    return {
        "all_time_data": formatted_data, 
        "grand_total_pnl": grand_total_pnl,
        "sub_portfolio_totals": dict(sub_portfolio_pnl_totals),
        "live_prices": live_prices
    }

# --- Main Handler (Backend /tracking) ---
async def handle_tracking_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
    print(f"\n[DEBUG TRACKING] handle_tracking_command Called. Args={args}")
    # If called via frontend/AI, args might be empty or come through ai_params
    portfolio_code = None
    execute_actions = False
    
    if ai_params:
        portfolio_code = ai_params.get('portfolio_code')
        execute_actions = str(ai_params.get('execute_actions', 'false')).lower() == 'true'
    elif args:
        portfolio_code = args[0]

    if not portfolio_code:
        return {"status": "error", "message": "Portfolio code is required."}

    # Load Config
    portfolio_config = await load_portfolio_config(portfolio_code)
    if not portfolio_config:
         # RETURN NOT FOUND so frontend can pop the modal
        return {"status": "not_found", "message": f"Portfolio '{portfolio_code}' not found."}

    # (Historical Cost Basis loaded later)
    
    # Calculate Live Values
    execute_rh = str(ai_params.get('execute_rh', 'false')).lower() == 'true' if ai_params else False
    rh_equity = 0.0
    
    if execute_rh:
        try:
            rh_equity = await asyncio.to_thread(get_robinhood_equity)
        except: 
            rh_equity = 0.0

    suggested_value = math.floor(rh_equity * 0.98) if rh_equity > 0 else 10000.0
            
    # Load Previous Run Data
    old_run_data = await _load_portfolio_run(portfolio_code)
    if not old_run_data:
        print("[DEBUG TRACKING] No previous run data found.")

    # Calculate "Target" data from current config + parameters
    # But wait! Tracking usually just compares CURRENT vs SAVED. 
    # If no 'new' data is generated, we are just viewing.
    # HOWEVER, the CLI version usually re-runs the logic to see "What SHOULD it be now?"
    
    # We need to run process_custom_portfolio to get the IDEAL state
    print("[DEBUG TRACKING] Generating IDEAL portfolio state for comparison...")
    new_holdings_raw = []
    final_cash = 0.0
    if portfolio_config:
         res = await process_custom_portfolio(
            portfolio_data_config=portfolio_config,
            tailor_portfolio_requested=True,
            total_value_singularity=suggested_value,
            frac_shares_singularity=True, # Tracking usually assumes fractional precision
            is_custom_command_simplified_output=True,
            is_called_by_ai=True
        )
         # Unwrap Tuple: (tailored_data, final_combined... , final_cash, tailored_data)
         if isinstance(res, tuple):
             new_holdings_raw = res[0] if len(res) > 0 else []
             if len(res) > 2: final_cash = res[2]
         elif isinstance(res, list):
             new_holdings_raw = res
    
    print(f"[DEBUG TRACKING] Generated {len(new_holdings_raw)} ideal holdings. Cash=${final_cash:.2f}")
    new_target_data = [] # Convert to standard dict list
    for h in new_holdings_raw:
         new_target_data.append({
             'ticker': h.get('ticker'),
             'shares': h.get('shares'),
             'value': h.get('value') or h.get('actual_money_allocation'),
             'price': h.get('live_price_at_eval') or h.get('price')
         })
         
    # --- Compare Old vs New ---
    # Map New Targets
    target_holdings = {item['ticker']: float(item.get('shares', 0)) for item in new_target_data}
    
    performance_summary = []
    if old_run_data:
        tickers_to_fetch = set([row['Ticker'] for row in old_run_data if row.get('Ticker') != 'Cash'])
        # Add new target tickers too so we get prices for everything
        tickers_to_fetch.update(target_holdings.keys())
        
        tasks = [calculate_ema_invest(ticker, ema_interval=2, is_called_by_ai=True) for ticker in tickers_to_fetch]
        live_price_results = await asyncio.gather(*tasks, return_exceptions=True)
        live_prices_temp = {
            ticker: res[0]
            for ticker, res in zip(tickers_to_fetch, live_price_results)
            if not isinstance(res, Exception) and res and res[0] is not None
        }
        
        # Simple Summary Calculation (Historical PnL)
        total_pnl = 0
        for row in old_run_data:
            ticker = row.get('Ticker')
            if ticker == 'Cash': continue
            shares = float(safe_score(row.get('Shares')))
            cost_basis = float(safe_score(row.get('ActualMoneyAllocation')))
            current_price = live_prices_temp.get(ticker, 0)
            current_val = shares * current_price
            pnl = current_val - cost_basis
            total_pnl += pnl
            
            performance_summary.append({
                "ticker": ticker,
                "shares": shares,
                "cost_basis": cost_basis,
                "current_val": current_val,
                "pnl": pnl,
                "percent": (pnl/cost_basis)*100 if cost_basis > 0 else 0
            })
    elif new_target_data:
        # If no old run, we can't show PnL, but we can show the "Target" or "Initial" view
         performance_summary = [] # Keep empty to indicate "New" 

    # Unpack Execution Params
    rh_user = ai_params.get('rh_username') if ai_params else None
    rh_pass = ai_params.get('rh_password') if ai_params else None
    email_to = ai_params.get('email_to') if ai_params else None
    execute_rh = str(ai_params.get('execute_rh', 'false')).lower() == 'true' if ai_params else False
    
    # Trade Recommendations (Rebalancing)
    trade_recs = []
    # If execute_actions is True OR meaningful execution params are provided, we calculate trades
    if execute_actions or execute_rh or email_to:
        
        # --- LOGIC UPDATE: Use LIVE holdings if available to prevent duplicates ---
        current_holdings_map = {}
        if execute_rh:
             try:
                 print("[DEBUG TRACKING] Fetching LIVE Robinhood holdings for accurate diff...")
                 current_holdings_map = await asyncio.to_thread(get_robinhood_holdings)
                 print(f"[DEBUG TRACKING] Live Holdings Fetched: {len(current_holdings_map)} positions")
             except Exception as e:
                 print(f"[DEBUG TRACKING] Failed to get live holdings: {e}")
        
        # Fallback to CSV if Live failed or not requested
        if not current_holdings_map:
             current_holdings_map = {row['Ticker']: float(safe_score(row.get('Shares'))) for row in (old_run_data or []) if row.get('Ticker') != 'Cash'}
             print(f"[DEBUG TRACKING] Using SAVED CSV holdings: {len(current_holdings_map)} positions")

        all_tickers = set(current_holdings_map.keys()) | set(target_holdings.keys())
        
        for ticker in all_tickers:
            curr_shares = current_holdings_map.get(ticker, 0)
            target_shares = target_holdings.get(ticker, 0)
            diff = target_shares - curr_shares
            
            # Robust diff check
            if abs(diff) > 0.001: 
                trade_recs.append({
                    "ticker": ticker,
                    "action": "Buy" if diff > 0 else "Sell",
                    "diff": abs(diff),
                    "reason": "Rebalance to Target"
                })
        
        # Initial Buy Check (Only if we have NO current holdings at all)
        if not current_holdings_map and target_holdings and not trade_recs:
             for ticker, shares in target_holdings.items():
                 if shares > 0:
                     trade_recs.append({"ticker": ticker, "action": "Buy", "diff": shares, "reason": "Initial Buy"})
    
    # --- Performance Since Last Save (Nested) ---
    nested_performance = {}
    live_prices_perf = {}
    if old_run_data:
        tickers_to_fetch_perf = [row['Ticker'] for row in old_run_data if row.get('Ticker') != 'Cash']
        tasks_perf = [calculate_ema_invest(ticker, ema_interval=2, is_called_by_ai=True) for ticker in tickers_to_fetch_perf]
        live_res_perf = await asyncio.gather(*tasks_perf, return_exceptions=True)
        live_prices_perf = {
            t: r[0] for t, r in zip(tickers_to_fetch_perf, live_res_perf) 
            if not isinstance(r, Exception) and r and r[0] is not None
        }
    nested_performance = _build_nested_performance_dict(old_run_data or [], live_prices_perf)

    # --- All-Time Performance ---
    all_names_map = _load_all_subportfolio_names()
    all_time_results = await get_all_time_performance_data(
        portfolio_code, new_target_data, old_run_data, portfolio_config, all_names_map, 
        live_rh_holdings={k:v for k,v in (await asyncio.to_thread(get_robinhood_holdings)).items()} if execute_rh else None
    )

    # Execution Handling
    execution_result_msg = ""
    can_execute = False  # Flag for frontend button
    
    if trade_recs:
        # Check credentials for potential execution later
        rh_user = os.environ.get("RH_USERNAME")
        rh_pass = os.environ.get("RH_PASSWORD")
        # Relaxed logic: Show button if trades exist. Modal handles creds.
        can_execute = len(trade_recs) > 0
        
        # 1. Send Email (Still do this if requested, as it's not a trade execution)
        if email_to:
            try:
                # Format simple HTML table
                rows = "".join([f"<tr><td>{t['ticker']}</td><td>{t['action']}</td><td>{t['diff']:.4f}</td></tr>" for t in trade_recs])
                html = f"<h2>Portfolio Rebalance: {portfolio_code}</h2><table border='1'><tr><th>Ticker</th><th>Action</th><th>Shares</th></tr>{rows}</table>"
                await _send_tracking_email(f"Rebalance Alert: {portfolio_code}", html, email_to)
                execution_result_msg += " Email sent."
            except Exception as e:
                execution_result_msg += f" Email failed: {e}."

        # 2. DELETED: Immediate Execution on Robinhood
        # We now simply return the trades and let the frontend handle the execution button.
        if execute_rh:
             execution_result_msg += " Ready for Review."

    # --- Top Cards Summary Construction ---
    summary_stats = [
        {"label": "Portfolio Value", "value": f"${(suggested_value or 0):,.2f}"},
        {"label": "Cash Balance", "value": f"${rh_equity:,.2f}" if rh_equity else f"${final_cash:,.2f}"}, # Use rh_equity if available (it means cash was removed from it?) No, rh_equity usually includes cash? Wait. rh_equity is usually total value.
        # Let's use final_cash from raw results if available, else 0. 
        # Actually rh_equity is passed in. In tracking it might be total account value.
        # But we calculated final_cash earlier? No, tracking doesn't calc final_cash unless it's new.
        # Let's just calculate Cash from holdings vs Total Value
        {"label": "Holdings Count", "value": str(len(new_target_data))},
        {"label": "Portfolio Code", "value": portfolio_code}
    ]

    return {
        "status": "success",
        "portfolio_code": portfolio_code,
        "rh_equity": rh_equity,
        "suggested_value": suggested_value,
        
        # Frontend Mappings for Results.jsx
        "summary": summary_stats,
        "table": new_target_data,
        "since_last_save": performance_summary, 
        "performance": all_time_results.get("all_time_data", []), 
        "comparison": trade_recs,
        
        # Extras
        "nested_performance": nested_performance,
        "all_time_results_raw": all_time_results,
        "trades": trade_recs, # Consistent with Nexus
        "requires_execution_confirmation": can_execute,
        "message": "Tracking run complete." + execution_result_msg
    }