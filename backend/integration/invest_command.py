import yfinance as yf
import pandas as pd
import math
from tabulate import tabulate
import os
import uuid
import matplotlib
matplotlib.use('Agg')
import asyncio
import matplotlib.pyplot as plt
from typing import List, Dict, Any, Optional, Tuple
import csv
import traceback
import numpy as np

# --- Constants ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RISK_CSV_FILE = os.path.join(BASE_DIR, 'market_data.csv')
PORTFOLIO_DB_FILE = os.path.join(BASE_DIR, 'portfolio_codes_database.csv')
YFINANCE_API_SEMAPHORE = asyncio.Semaphore(5)

# --- Shared Helper Functions (Required by other modules) ---

def safe_score(value) -> float:
    try:
        if pd.isna(value) or value is None: return 0.0
        if isinstance(value, str): value = value.replace('%', '').replace('$', '').strip()
        return float(value)
    except (ValueError, TypeError): return 0.0

def get_allocation_score(is_called_by_ai: bool = False) -> Tuple[float, float, float]:
    avg_s, gen_s, mkt_inv_s = 50.0, 50.0, 50.0 
    if not os.path.exists(RISK_CSV_FILE):
        return avg_s, gen_s, mkt_inv_s

    try:
        with open(RISK_CSV_FILE, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = [h.strip() for h in next(reader)]
            last_line = None
            for line in reader:
                if line:
                    last_line = line
        
        if not last_line:
            return avg_s, gen_s, mkt_inv_s

        latest_data = dict(zip(header, last_line))
        gen_score_key = next((k for k in latest_data if k.lower().strip().startswith('general market score')), None)
        inv_score_key = next((k for k in latest_data if k.lower().strip().startswith('raw market invest score')), None)

        if not (gen_score_key and inv_score_key):
            return avg_s, gen_s, mkt_inv_s

        gs_val = safe_score(latest_data.get(gen_score_key))
        mis_val = safe_score(latest_data.get(inv_score_key))
        
        avg_s_calc = (gs_val + (2 * mis_val)) / 3.0
        avg_s = max(0, min(100, avg_s_calc))
        gen_s = max(0, min(100, gs_val))
        mkt_inv_s = max(0, min(100, mis_val))
        
        return avg_s, gen_s, mkt_inv_s

    except Exception as e:
        if not is_called_by_ai: print(f"Error in get_allocation_score: {e}")
        return avg_s, gen_s, mkt_inv_s

async def _load_all_portfolio_configs(is_called_by_ai: bool = False, user_id: str = None) -> Dict[str, Dict[str, Any]]:
    configs = {}
    if not os.path.exists(PORTFOLIO_DB_FILE):
        return configs
    try:
        with open(PORTFOLIO_DB_FILE, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            for row in reader:
                code = row.get('portfolio_code')
                row_user = row.get('user_id', '').strip()
                target_user = user_id.strip() if user_id else ''

                # Only load public portfolios OR portfolios owned by this user
                if code and (row_user == target_user or not row_user):
                    configs[code.lower().strip()] = {k.strip(): v for k, v in row.items()}
        return configs
    except Exception as e:
        if not is_called_by_ai: print(f"Error loading portfolio configs: {e}")
        return configs

async def calculate_ema_invest(ticker: str, ema_interval: int, is_called_by_ai: bool = False) -> Tuple[Optional[float], Optional[float]]:
    async with YFINANCE_API_SEMAPHORE:
        try:
            stock = yf.Ticker(ticker.replace('.', '-'))
            if ema_interval == 1:
                period = "2y"; interval = "1wk"
            elif ema_interval == 2:
                period = "1y"; interval = "1d"
            else:
                period = "1mo"; interval = "1h"
            
            await asyncio.sleep(np.random.uniform(0.01, 0.05)) # Reduced sleep
            data = await asyncio.to_thread(stock.history, period=period, interval=interval)
            
            # Fallback if no history
            if data.empty or 'Close' not in data.columns: 
                try:
                    price = stock.fast_info.last_price
                    return float(price), 50.0 # Return neutral score on partial data
                except:
                    return None, None
            
            data['EMA_8'] = data['Close'].ewm(span=8, adjust=False).mean()
            data['EMA_55'] = data['Close'].ewm(span=55, adjust=False).mean()
            
            latest = data.iloc[-1]
            live_price = float(latest['Close'])
            ema_8 = float(latest['EMA_8'])
            ema_55 = float(latest['EMA_55'])
            
            if pd.isna(live_price) or pd.isna(ema_8) or pd.isna(ema_55) or ema_55 == 0:
                return (live_price if not pd.isna(live_price) else None), 50.0
                
            ema_invest_score = (((ema_8 - ema_55) / ema_55) * 4 + 0.5) * 100
            return live_price, ema_invest_score
            
        except Exception as e:
            if not is_called_by_ai: print(f"DEBUG: Error in calculate_ema_invest for {ticker}: {e}")
            return None, None

# --- Main Logic Function (Restored so custom_command.py can import it) ---
async def process_custom_portfolio(
    portfolio_data_config: Dict[str, Any],
    tailor_portfolio_requested: bool,
    frac_shares_singularity: bool,
    total_value_singularity: Optional[float] = None,
    is_custom_command_simplified_output: bool = False,
    is_called_by_ai: bool = False,
    names_map: Optional[Dict[str, str]] = None,
    all_portfolio_configs_passed: Optional[Dict[str, Dict[str, Any]]] = None,
    parent_path: Optional[List[str]] = None
) -> Tuple[List[str], List[Dict[str, Any]], float, List[Dict[str, Any]]]:
    
    try:
        is_top_level_call = all_portfolio_configs_passed is None
        suppress_prints = (is_custom_command_simplified_output or is_called_by_ai) and is_top_level_call
        
        print(f"[DEBUG INVEST] process_custom_portfolio called. ID={portfolio_data_config.get('portfolio_code')} Tailor={tailor_portfolio_requested} Value={total_value_singularity}")

        user_id = portfolio_data_config.get('user_id')

        if is_top_level_call:
            all_portfolio_configs = await _load_all_portfolio_configs(is_called_by_ai=suppress_prints, user_id=user_id)
        else:
            all_portfolio_configs = all_portfolio_configs_passed or {}

        sell_to_cash_active = False
        if is_top_level_call:
            avg_score, _, _ = get_allocation_score(is_called_by_ai=suppress_prints)
            if avg_score < 50.0:
                sell_to_cash_active = True

        cleaned_config = {str(k).strip(): v for k, v in portfolio_data_config.items()}
        ema_sensitivity = int(safe_score(cleaned_config.get('ema_sensitivity', 3)))
        amplification = float(safe_score(cleaned_config.get('amplification', 1.0)))
        num_portfolios = int(safe_score(cleaned_config.get('num_portfolios', 0)))

        final_combined_portfolio_data_calc = []
        
        for i in range(num_portfolios):
            portfolio_index = i + 1
            weight = safe_score(cleaned_config.get(f'weight_{portfolio_index}', '0'))
            if weight <= 0: continue

            tickers_str = cleaned_config.get(f'tickers_{portfolio_index}', '')
            items_raw = [item.strip().upper() for item in tickers_str.split(',') if item.strip()]
            
            items_to_calc = []
            nested_portfolios = []

            for item in items_raw:
                if item.lower() in all_portfolio_configs:
                    nested_portfolios.append(item.lower())
                else:
                    items_to_calc.append(item)

            # Container for THIS sub-portfolio's items
            sub_portfolio_items = []

            # 1. Process Direct Stocks (Parallel)
            tasks = [calculate_ema_invest(ticker, ema_sensitivity, is_called_by_ai=True) for ticker in items_to_calc]
            results = await asyncio.gather(*tasks)
            
            for ticker, res in zip(items_to_calc, results):
                if not res or not isinstance(res, tuple) or len(res) < 2: continue
                live_price, ema_invest = res
                
                # Treat N/A as neutral 50
                raw_score = safe_score(ema_invest) if ema_invest is not None else 50.0
                live_price_val = live_price if live_price is not None else 0.0
                
                score_for_alloc = 0.0 if (sell_to_cash_active and raw_score < 50.0) else raw_score
                amplified_score = max(0, safe_score((score_for_alloc * amplification) - (amplification - 1) * 50))
                
                sub_portfolio_items.append({
                    'ticker': ticker, 
                    'live_price': live_price_val, 
                    'raw_invest_score': raw_score,
                    'amplified_score_adjusted': amplified_score,
                    'sub_portfolio_id': f"Sub-Portfolio {portfolio_index}",
                    'path': [ticker]
                })

            # 2. Process Nested Portfolios (Recursive)
            current_code = cleaned_config.get('portfolio_code', 'UNKNOWN')
            for child_code in nested_portfolios:
                # Cycle Detection
                if child_code in (parent_path or []):
                    print(f"[DEBUG] Cycle detected skipping {child_code}")
                    continue
                
                new_path = (parent_path or []) + [current_code]
                
                # Calculate allocated value for this child
                child_alloc_value = None
                if total_value_singularity and weight > 0:
                     child_alloc_value = total_value_singularity * (weight / 100.0)

                # Recurse
                _, child_calculated, _, _ = await process_custom_portfolio(
                    portfolio_data_config=all_portfolio_configs[child_code],
                    tailor_portfolio_requested=True, # MUST be True to get holdings
                    total_value_singularity=child_alloc_value,
                    frac_shares_singularity=frac_shares_singularity,
                    is_called_by_ai=True,
                    names_map=names_map,
                    all_portfolio_configs_passed=all_portfolio_configs,
                    parent_path=new_path
                )

                # Merge Results
                for child_item in child_calculated:
                    # Update metadata
                    child_item['sub_portfolio_id'] = f"Sub-Portfolio {portfolio_index} > {child_item['sub_portfolio_id']}"
                    # We accept the child's score for now, but will scale it below
                    sub_portfolio_items.append(child_item)

            # 3. Apply Sub-Portfolio Weighting
            # Normalize the total score of this sub-portfolio to match the desired weight
            current_sub_total = sum(item['amplified_score_adjusted'] for item in sub_portfolio_items)
            
            if weight > 0 and sub_portfolio_items:
                 # If the sub-portfolio has valid items, we want their Sum(Scores) to be proportional to Weight.
                 # Let's say Target Score = Weight * 1000.
                 # Factor = (Weight * 1000) / current_sub_total
                 # If current_sub_total is 0 (all items 0 score), we can't scale.
                 
                 if current_sub_total > 0:
                     factor = (weight * 1000.0) / current_sub_total
                     for item in sub_portfolio_items:
                         item['amplified_score_adjusted'] *= factor
                         # Also update recursed path for clarity? No, just score.
                 else:
                     # Fallback: If all scores are 0, but we have weight?
                     # Distribute evenly? or keep 0?
                     # If score is 0, it means "Don't Buy". So keep 0.
                     pass
            
            # Add to Main List
            final_combined_portfolio_data_calc.extend(sub_portfolio_items)

        total_amp = sum(e['amplified_score_adjusted'] for e in final_combined_portfolio_data_calc)
        for entry in final_combined_portfolio_data_calc:
            entry['combined_percent_allocation'] = (entry['amplified_score_adjusted'] / total_amp * 100) if total_amp > 0 else 0

        tailored_data = []
        final_cash = 0.0
        
        if tailor_portfolio_requested and total_value_singularity is not None:
            total_val = float(total_value_singularity)
            total_spent = 0.0
            print(f"[DEBUG INVEST] Starting Tailoring Loop. Items={len(final_combined_portfolio_data_calc)} Val=${total_val} Frac={frac_shares_singularity}")
            for entry in final_combined_portfolio_data_calc:
                alloc_pct = entry.get('combined_percent_allocation', 0.0)
                price = entry.get('live_price', 0.0)
                
                if alloc_pct > 0 and price > 0:
                    target_amt = total_val * (alloc_pct / 100.0)
                    shares = target_amt / price
                    final_shares = round(shares, 2) if frac_shares_singularity else math.floor(shares)
                    
                    # DEBUG: Dropped Stock Analysis
                    if final_shares <= 0:
                         print(f"[DEBUG INVEST] DROPPED {entry['ticker']}: Target=${target_amt:.2f} Price=${price:.2f} -> Shares={shares:.4f} (Floored to 0)")
                    
                    cost = final_shares * price
                    
                    if cost > 0:
                        # print(f"[DEBUG INVEST] Allocating {entry['ticker']}: {final_shares} shares @ ${price} = ${cost}")
                        tailored_data.append({
                            'ticker': entry['ticker'],
                            'shares': final_shares,
                            'live_price_at_eval': price,
                            'actual_money_allocation': cost,
                            'actual_percent_allocation': (cost / total_val) * 100,
                            'raw_invest_score': entry.get('raw_invest_score', 'N/A'),
                            'sub_portfolio_id': entry.get('sub_portfolio_id', 'N/A'),
                            'path': entry.get('path', [])
                        })
                        total_spent += cost
            final_cash = max(0, total_val - total_spent)

        print(f"[DEBUG INVEST] Portfolio Calc Complete. Tailored Count: {len(tailored_data)}, Cash: ${final_cash:.2f}")
        # RETURN FIXED: Put tailored_data at Index 0 for Nexus/Tracking compatibility
        # Original: return [], final_combined_portfolio_data_calc, final_cash, tailored_data
        return tailored_data, final_combined_portfolio_data_calc, final_cash, tailored_data

    except Exception as e:
        print(f"Error in process_custom_portfolio: {e}")
        # Return safe empty values to prevent crashes
        return [], [], 0.0, []

# --- Endpoint Handler (Anti-Crash Wrapped) ---
async def handle_invest_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False, return_structured_data: bool = False):
    """
    Handles the /invest command with full crash protection.
    """
    try:
        if ai_params:
            config = {
                'portfolio_code': 'TEMP',
                'ema_sensitivity': ai_params.get('ema_sensitivity', 2),
                'amplification': ai_params.get('amplification', 1.0),
                'num_portfolios': len(ai_params.get('sub_portfolios', [])),
                'user_id': ai_params.get('user_id')
            }
            for i, sp in enumerate(ai_params.get('sub_portfolios', []), 1):
                tickers = sp.get('tickers', [])
                if isinstance(tickers, list):
                    tickers = ",".join(tickers)
                config[f'tickers_{i}'] = tickers
                config[f'weight_{i}'] = sp.get('weight', 0)

            # Run processing
            _, _, final_cash, tailored_data = await process_custom_portfolio(
                portfolio_data_config=config,
                tailor_portfolio_requested=ai_params.get('tailor_to_value', False),
                frac_shares_singularity=ai_params.get('use_fractional_shares', False),
                total_value_singularity=ai_params.get('total_value', 0.0),
                is_called_by_ai=True
            )

            # Format data for Results.jsx
            formatted_table_data = []
            for item in tailored_data:
                formatted_table_data.append({
                    "ticker": item.get('ticker'),
                    "shares": item.get('shares'),
                    "price": item.get('live_price_at_eval'),
                    "value": item.get('actual_money_allocation'),
                    "allocPercent": item.get('actual_percent_allocation'),
                    "rawInvestScore": item.get('raw_invest_score')
                })

            total_value_calc = sum(h['actual_money_allocation'] for h in tailored_data) + final_cash

            return {
                "status": "success",
                "summary": [
                    {"label": "Portfolio Value", "value": f"${total_value_calc:,.2f}", "change": "Total"},
                    {"label": "Cash", "value": f"${final_cash:,.2f}", "change": "Unallocated"},
                    {"label": "Holdings", "value": str(len(formatted_table_data)), "change": "Count"}
                ],
                "table": formatted_table_data,
                "raw_result": {
                    "final_cash": final_cash,
                    "trades": []
                }
            }

        return {"status": "error", "message": "CLI not supported"}

    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "message": f"Critical Error in Invest Command: {str(e)}"}