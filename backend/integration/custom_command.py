import asyncio
import os
import csv
from datetime import datetime
import pytz
import math
import traceback
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np

# --- Constants ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTFOLIO_DB_FILE = os.path.join(BASE_DIR, 'portfolio_codes_database.csv')
PORTFOLIO_OUTPUT_DIR = os.path.join(BASE_DIR, 'saved_runs')
TRACKING_ORIGIN_FILE = os.path.join(BASE_DIR, 'tracking_origin.csv')

from backend.integration.invest_command import process_custom_portfolio

def safe_score(value) -> float:
    try:
        if pd.isna(value) or value is None: return 0.0
        if isinstance(value, str): 
            value = value.replace('%', '').replace('$', '').replace(',', '').strip()
        return float(value)
    except (ValueError, TypeError): return 0.0

def _get_custom_portfolio_run_csv_filepath(portfolio_code: str, user_id: str = None) -> str:
    uid_suffix = f"_{user_id}" if user_id else ""
    safe_code = str(portfolio_code).lower().replace(' ', '_')
    if not os.path.exists(PORTFOLIO_OUTPUT_DIR):
        try: os.makedirs(PORTFOLIO_OUTPUT_DIR)
        except OSError: pass
    return os.path.join(PORTFOLIO_OUTPUT_DIR, f"run_data_portfolio_{safe_code}{uid_suffix}.csv")

async def save_portfolio_to_csv(file_path: str, portfolio_data_to_save: Dict[str, Any], is_called_by_ai: bool = False):
    file_exists = os.path.isfile(file_path)
    fieldnames = ['portfolio_code', 'ema_sensitivity', 'amplification', 'num_portfolios', 'frac_shares', 'risk_tolerance', 'risk_type', 'remove_amplification_cap', 'user_id']
    num_portfolios_val = int(safe_score(portfolio_data_to_save.get('num_portfolios', 0)))
    for i in range(1, num_portfolios_val + 1):
        fieldnames.extend([f'tickers_{i}', f'weight_{i}'])
    try:
        with open(file_path, 'a', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
            if not file_exists or os.path.getsize(file_path) == 0: writer.writeheader()
            writer.writerow(portfolio_data_to_save)
    except Exception as e:
        if not is_called_by_ai: print(f"Error saving portfolio config: {e}")

# --- FIX: This function was missing, causing ImportError in Tracking ---
async def _save_custom_portfolio_run_to_csv(portfolio_code: str, tailored_stock_holdings: List[Dict], final_cash: float, total_portfolio_value_for_percent_calc: float, is_called_by_ai: bool = False, user_id: str = None):
    try:
        filepath = _get_custom_portfolio_run_csv_filepath(portfolio_code, user_id)
        
        rows_to_save = []
        for item in tailored_stock_holdings:
            rows_to_save.append({
                'Ticker': item.get('ticker'),
                'Shares': item.get('shares'),
                'LivePriceAtEval': item.get('live_price_at_eval') or item.get('price'),
                'ActualMoneyAllocation': item.get('actual_money_allocation') or item.get('value'),
                'ActualPercentAllocation': item.get('actual_percent_allocation') or item.get('allocPercent'),
                'RawInvestScore': item.get('raw_invest_score', 0)
            })
        
        # Cash Row
        cash_pct = (final_cash / total_portfolio_value_for_percent_calc * 100) if total_portfolio_value_for_percent_calc > 0 else 0
        rows_to_save.append({
            'Ticker': 'Cash',
            'Shares': final_cash, 
            'LivePriceAtEval': 1.0,
            'ActualMoneyAllocation': final_cash,
            'ActualPercentAllocation': cash_pct,
            'RawInvestScore': 0
        })

        fieldnames = ['Ticker', 'Shares', 'LivePriceAtEval', 'ActualMoneyAllocation', 'ActualPercentAllocation', 'RawInvestScore']
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows_to_save)
            
    except Exception as e:
        print(f"Error saving run data: {e}")
        traceback.print_exc()

async def handle_custom_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
    try:
        if ai_params: 
            portfolio_code_input = ai_params.get("portfolio_code")
            user_id = ai_params.get("user_id")

            if not portfolio_code_input:
                return {"status": "error", "message": "Portfolio code is required."}

            # 1. Check DB for Portfolio
            portfolio_config_from_db = None
            if os.path.exists(PORTFOLIO_DB_FILE):
                try:
                    with open(PORTFOLIO_DB_FILE, 'r', encoding='utf-8', newline='') as f_db:
                        reader = csv.DictReader(f_db)
                        for row in reader:
                            row_code = row.get('portfolio_code', '').strip().lower()
                            row_user = row.get('user_id', '').strip()
                            if row_code == portfolio_code_input.strip().lower():
                                if not row_user or (user_id and row_user == user_id):
                                    portfolio_config_from_db = row
                                    break
                except Exception: pass

            # 2. Handle Creation
            action = ai_params.get("action", "run_existing_portfolio")
            if not portfolio_config_from_db:
                if action == "create_and_run" or (ai_params.get('sub_portfolios')):
                    raw_subs = ai_params.get('sub_portfolios')
                    sub_portfolios_list = raw_subs if isinstance(raw_subs, list) else []
                    
                    new_config = {
                        'portfolio_code': portfolio_code_input,
                        'ema_sensitivity': str(ai_params.get('ema_sensitivity', 2)),
                        'amplification': str(ai_params.get('amplification', 1.0)),
                        'num_portfolios': str(len(sub_portfolios_list)),
                        'frac_shares': 'true' if ai_params.get('use_fractional_shares') else 'false',
                        'risk_tolerance': '10',
                        'user_id': user_id
                    }
                    for i, sp in enumerate(sub_portfolios_list, 1):
                        tickers_list = sp.get('tickers', [])
                        tickers_str = ",".join(tickers_list) if isinstance(tickers_list, list) else str(tickers_list)
                        new_config[f'tickers_{i}'] = tickers_str.upper()
                        new_config[f'weight_{i}'] = str(sp.get('weight', 0))

                    await save_portfolio_to_csv(PORTFOLIO_DB_FILE, new_config, is_called_by_ai=True)
                    portfolio_config_from_db = new_config
                else:
                    return {
                        "status": "not_found", 
                        "message": f"Portfolio '{portfolio_code_input}' not found.",
                        "code": portfolio_code_input
                    }

            # 3. Run Analysis
            tailor_run_ai = True 
            total_value_ai_float = float(safe_score(ai_params.get("total_value", 10000)))
            frac_shares_param = ai_params.get("use_fractional_shares", False)
            if isinstance(frac_shares_param, str):
                frac_shares_final = frac_shares_param.lower() == 'true'
            else:
                frac_shares_final = bool(frac_shares_param)

            _, _, final_cash, tailored_data = await process_custom_portfolio(
                portfolio_data_config=portfolio_config_from_db,
                tailor_portfolio_requested=tailor_run_ai,
                frac_shares_singularity=frac_shares_final,
                total_value_singularity=total_value_ai_float,
                is_custom_command_simplified_output=True,
                is_called_by_ai=True
            )

            # 4. Save Run Data (Required for Tracking to find it later)
            await _save_custom_portfolio_run_to_csv(
                portfolio_code=portfolio_code_input,
                tailored_stock_holdings=tailored_data,
                final_cash=final_cash,
                total_portfolio_value_for_percent_calc=total_value_ai_float,
                user_id=user_id
            )

            # 5. Format Output
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

            total_portfolio_val = total_value_ai_float if tailor_run_ai else (sum(h['actual_money_allocation'] for h in tailored_data) + final_cash)

            return {
                "status": "success",
                "summary": [
                    {"label": "Portfolio Value", "value": f"${total_portfolio_val:,.2f}", "change": "Total"},
                    {"label": "Cash", "value": f"${final_cash:,.2f}", "change": "Unallocated"},
                    {"label": "Holdings", "value": str(len(formatted_table_data)), "change": "Count"}
                ],
                "table": formatted_table_data,
                "raw_result": { "final_cash": final_cash, "portfolio_code": portfolio_code_input }
            }

        return {"status": "error", "message": "No parameters provided."}

    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "message": f"Custom Command Error: {str(e)}"}