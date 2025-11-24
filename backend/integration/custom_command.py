# --- Imports for custom_command ---
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

# --- Local Imports ---
from integration.invest_command import process_custom_portfolio, safe_score

def safe_score(value) -> float:
    try:
        if pd.isna(value) or value is None: return 0.0
        if isinstance(value, str): value = value.replace('%', '').replace('$', '').strip()
        return float(value)
    except (ValueError, TypeError): return 0.0

def ensure_portfolio_output_dir():
    if not os.path.exists(PORTFOLIO_OUTPUT_DIR):
        try:
            os.makedirs(PORTFOLIO_OUTPUT_DIR)
        except OSError:
            pass

async def save_portfolio_to_csv(file_path: str, portfolio_data_to_save: Dict[str, Any], is_called_by_ai: bool = False):
    file_exists = os.path.isfile(file_path)
    fieldnames = ['portfolio_code', 'ema_sensitivity', 'amplification', 'num_portfolios', 'frac_shares', 'risk_tolerance', 'risk_type', 'remove_amplification_cap', 'user_id']
    num_portfolios_val = int(portfolio_data_to_save.get('num_portfolios', 0))
    for i in range(1, num_portfolios_val + 1):
        fieldnames.extend([f'tickers_{i}', f'weight_{i}'])
    try:
        with open(file_path, 'a', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
            if not file_exists or os.path.getsize(file_path) == 0: writer.writeheader()
            writer.writerow(portfolio_data_to_save)
    except Exception as e:
        if not is_called_by_ai:
            print(f"Error saving portfolio config: {e}")

def _get_custom_portfolio_run_csv_filepath(portfolio_code: str, user_id: str = None) -> str:
    uid_suffix = f"_{user_id}" if user_id else ""
    return os.path.join(PORTFOLIO_OUTPUT_DIR, f"run_data_portfolio_{portfolio_code.lower().replace(' ','_')}{uid_suffix}.csv")

from collections import defaultdict
async def _update_portfolio_origin_data(portfolio_code: str, tailored_stock_holdings: List[Dict[str, Any]], user_id: str = None):
    """
    Updates tracking_origin.csv with new positions.
    Prevents duplicating entries if they already exist for this Portfolio + User.
    """
    origin_data = defaultdict(dict)
    if os.path.exists(TRACKING_ORIGIN_FILE):
        try:
            with open(TRACKING_ORIGIN_FILE, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Match Portfolio Code AND User ID (handle None/Empty for legacy)
                    row_user = row.get('UserId')
                    if row['PortfolioCode'] == portfolio_code and (row_user == user_id or (not row_user and not user_id)):
                        origin_data[row['Ticker']] = {'Shares': row['Shares'], 'Price': row['Price']}
        except (IOError, csv.Error) as e:
            print(f"⚠️ Warning: Could not read origin data file: {e}")
            return

    new_entries_to_add = []
    for holding in tailored_stock_holdings:
        ticker = holding.get('ticker')
        if ticker and ticker != 'Cash' and ticker not in origin_data:
            new_entries_to_add.append({
                'PortfolioCode': portfolio_code,
                'UserId': user_id if user_id else '',
                'Ticker': ticker,
                'Shares': holding.get('shares'),
                'Price': holding.get('live_price_at_eval')
            })

    if not new_entries_to_add:
        return

    try:
        file_exists = os.path.exists(TRACKING_ORIGIN_FILE)
        with open(TRACKING_ORIGIN_FILE, 'a', newline='', encoding='utf-8') as f:
            fieldnames = ['PortfolioCode', 'UserId', 'Ticker', 'Shares', 'Price']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            if not file_exists or os.path.getsize(TRACKING_ORIGIN_FILE) == 0:
                writer.writeheader()
            writer.writerows(new_entries_to_add)
    except IOError as e:
        print(f"❌ Error: Could not write to origin data file: {e}")

async def _save_custom_portfolio_run_to_csv(portfolio_code: str, tailored_stock_holdings: List[Dict[str, Any]], final_cash: float, total_portfolio_value_for_percent_calc: Optional[float] = None, is_called_by_ai: bool = False, user_id: str = None):
    filepath = _get_custom_portfolio_run_csv_filepath(portfolio_code, user_id)
    timestamp_utc_str = datetime.now(pytz.UTC).isoformat()
    data_for_csv = []
    
    for holding in tailored_stock_holdings:
        path_str = ' > '.join(map(str, holding.get('path', [])))
        data_for_csv.append({
            'Ticker': holding.get('ticker'),
            'Shares': holding.get('shares'),
            'LivePriceAtEval': holding.get('live_price_at_eval'),
            'ActualMoneyAllocation': holding.get('actual_money_allocation'),
            'ActualPercentAllocation': holding.get('actual_percent_allocation'),
            'RawInvestScore': holding.get('raw_invest_score', 'N/A'),
            'SubPortfolio': holding.get('sub_portfolio_id', 'N/A'),
            'SubPortfolioPath': path_str
        })

    cash_percent_alloc_val = 'N/A'
    if total_portfolio_value_for_percent_calc and total_portfolio_value_for_percent_calc > 0:
        cash_percent_alloc_val = (final_cash / total_portfolio_value_for_percent_calc) * 100.0

    data_for_csv.append({
        'Ticker': 'Cash', 'Shares': '-', 'LivePriceAtEval': 1.0,
        'ActualMoneyAllocation': final_cash,
        'ActualPercentAllocation': f"{cash_percent_alloc_val:.2f}" if isinstance(cash_percent_alloc_val, float) else 'N/A',
        'RawInvestScore': 'N/A', 'SubPortfolio': 'N/A', 'SubPortfolioPath': 'Cash'
    })

    fieldnames = ['Ticker', 'Shares', 'LivePriceAtEval', 'ActualMoneyAllocation', 'ActualPercentAllocation', 'RawInvestScore', 'SubPortfolio', 'SubPortfolioPath']
    try:
        ensure_portfolio_output_dir()
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            csvfile.write(f"# portfolio_code: {portfolio_code}\n# timestamp_utc: {timestamp_utc_str}\n# ---BEGIN_DATA---\n")
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(data_for_csv)
    except Exception as e:
        if not is_called_by_ai:
            print(f"❌ Error saving custom portfolio run CSV: {e}")

    if tailored_stock_holdings:
        await _update_portfolio_origin_data(portfolio_code, tailored_stock_holdings, user_id)

async def handle_custom_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
    if ai_params: 
        portfolio_code_input = ai_params.get("portfolio_code")
        user_id = ai_params.get("user_id")

        if not portfolio_code_input:
            return "Error for AI (/custom): 'portfolio_code' is required."

        action = ai_params.get("action", "run_existing_portfolio")

        if action == "run_existing_portfolio":
            portfolio_config_from_db = None
            if os.path.exists(PORTFOLIO_DB_FILE):
                try:
                    with open(PORTFOLIO_DB_FILE, 'r', encoding='utf-8', newline='') as f_db:
                        reader = csv.DictReader(f_db)
                        for row in reader:
                            row_code = row.get('portfolio_code', '').strip().lower()
                            row_user = row.get('user_id')
                            if row_code == portfolio_code_input.lower() and (row_user == user_id or not row_user):
                                portfolio_config_from_db = row
                                break
                except Exception: pass

            if not portfolio_config_from_db:
                if "sub_portfolios" in ai_params and "ema_sensitivity" in ai_params:
                    new_config = {
                        'portfolio_code': portfolio_code_input,
                        'ema_sensitivity': str(ai_params.get('ema_sensitivity', 2)),
                        'amplification': str(ai_params.get('amplification', 1.0)),
                        'num_portfolios': str(len(ai_params.get('sub_portfolios', []))),
                        'frac_shares': 'true' if ai_params.get('use_fractional_shares') else 'false',
                        'risk_tolerance': '10',
                        'risk_type': 'stock',
                        'remove_amplification_cap': 'true',
                        'user_id': user_id
                    }
                    for i, sp in enumerate(ai_params.get('sub_portfolios', []), 1):
                        tickers_list = sp.get('tickers', [])
                        if isinstance(tickers_list, list): tickers_str = ",".join(tickers_list)
                        else: tickers_str = str(tickers_list)
                        new_config[f'tickers_{i}'] = tickers_str.upper()
                        new_config[f'weight_{i}'] = str(sp.get('weight', 0))

                    await save_portfolio_to_csv(PORTFOLIO_DB_FILE, new_config, is_called_by_ai=True)
                    portfolio_config_from_db = new_config
                else:
                    return {"status": "not_found", "message": f"Portfolio '{portfolio_code_input}' not found."}

            tailor_run_ai = ai_params.get("tailor_to_value", False)
            total_value_ai_float = None
            if tailor_run_ai:
                try:
                    total_value_ai_float = float(ai_params.get("total_value", 0))
                    if total_value_ai_float <= 0: return "Error: 'total_value' must be positive."
                except ValueError: return "Error: Invalid 'total_value'."
                except ValueError: return "Error: Invalid 'total_value'."

            frac_shares_final = ai_params.get("use_fractional_shares")
            if frac_shares_final is None:
                frac_shares_final = portfolio_config_from_db.get('frac_shares', 'false').lower() == 'true'

            try:
                _, _, final_cash, tailored_data = await process_custom_portfolio(
                    portfolio_data_config=portfolio_config_from_db,
                    tailor_portfolio_requested=tailor_run_ai,
                    frac_shares_singularity=frac_shares_final,
                    total_value_singularity=total_value_ai_float,
                    is_custom_command_simplified_output=True,
                    is_called_by_ai=True
                )

                await _save_custom_portfolio_run_to_csv(
                    portfolio_code=portfolio_code_input,
                    tailored_stock_holdings=tailored_data,
                    final_cash=final_cash,
                    total_portfolio_value_for_percent_calc=total_value_ai_float if tailor_run_ai else None,
                    is_called_by_ai=True,
                    user_id=user_id
                )

                return {
                    "status": "success",
                    "holdings": tailored_data,
                    "final_cash": final_cash,
                    "total_value": total_value_ai_float if tailor_run_ai else (sum(h['actual_money_allocation'] for h in tailored_data) + final_cash)
                }

            except Exception as e:
                return f"Error processing portfolio '{portfolio_code_input}': {str(e)}"
    return None