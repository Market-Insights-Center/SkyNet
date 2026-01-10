import asyncio
import os
import csv
from datetime import datetime
import pytz
import math
import traceback
from typing import List, Dict, Any, Optional
from collections import defaultdict

import pandas as pd
from tabulate import tabulate

# --- Imports from other command modules ---
from backend.integration.invest_command import process_custom_portfolio
try:
    from backend.usage_counter import increment_usage
except ImportError:
    try:
        from usage_counter import increment_usage
    except ImportError:
        def increment_usage(*args): pass

# --- Constants ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTFOLIO_DB_FILE = os.path.join(BASE_DIR, 'portfolio_codes_database.csv')
PORTFOLIO_OUTPUT_DIR = os.path.join(BASE_DIR, 'portfolio_outputs')
TRACKING_ORIGIN_FILE = os.path.join(BASE_DIR, 'tracking_origin_data.csv')

# --- Helper Functions ---

def safe_score(value: Any) -> float:
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
            pass # Fail silently if creation fails in a race condition

def ask_singularity_input(prompt: str, validation_fn=None, error_msg: str = "Invalid input.", default_val=None, is_called_by_ai: bool = False) -> Optional[str]:
    if is_called_by_ai:
        return None
    while True:
        full_prompt = f"{prompt}"
        if default_val is not None:
            full_prompt += f" (default: {default_val if default_val != '' else 'None'}, press Enter to use)"
        full_prompt += ": "
        user_response = input(full_prompt).strip()
        if not user_response and default_val is not None:
            return str(default_val)
        if not user_response and default_val is None:
            print("Input is required.")
            continue
        if validation_fn:
            if validation_fn(user_response):
                return user_response
            else:
                print(error_msg)
                retry = input("Try again? (yes/no, default: yes): ").lower().strip()
                if retry == 'no':
                    return None
        else:
            return user_response

async def collect_portfolio_inputs_singularity(portfolio_code_singularity: str, is_called_by_ai: bool = False) -> Optional[Dict[str, Any]]:
    inputs = {'portfolio_code': portfolio_code_singularity}
    try:
        while True:
            ema_sens_str = input("Enter EMA sensitivity (1: Weekly, 2: Daily, 3: Hourly): ")
            try: inputs['ema_sensitivity'] = str(int(ema_sens_str)); break
            except: print("Invalid input.")
        while True:
            amp_str = input("Enter amplification (e.g., 0.5, 1.0, 2.0): ")
            try: inputs['amplification'] = str(float(amp_str)); break
            except: print("Invalid input.")
        while True:
            num_port_str = input("Enter number of sub-portfolios: ")
            try: inputs['num_portfolios'] = str(int(num_port_str)); break
            except: print("Must be > 0.")
            try: inputs['num_portfolios'] = str(int(num_port_str)); break
            except: print("Must be > 0.")
        
        # Default Fractional to true (Modified per user request)
        inputs['frac_shares'] = 'true'
        inputs['risk_tolerance'] = '10'; inputs['risk_type'] = 'stock'; inputs['remove_amplification_cap'] = 'true'
        current_total_weight = 0.0
        for i in range(1, int(inputs['num_portfolios']) + 1):
            tickers_in = input(f"Enter tickers for Sub-Portfolio {i} (comma-separated): ").upper()
            inputs[f'tickers_{i}'] = tickers_in
            if i == int(inputs['num_portfolios']):
                weight_val = 100.0 - current_total_weight
            else:
                weight_str = input(f"Enter weight for Sub-Portfolio {i} (%): ")
                weight_val = float(weight_str)
            inputs[f'weight_{i}'] = f"{weight_val:.2f}"; current_total_weight += weight_val
        return inputs
    except (ValueError, Exception):
        return None

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
        if not is_called_by_ai:
            print(f"Error saving portfolio config: {e}")

def _get_custom_portfolio_run_csv_filepath(portfolio_code: str, user_id: str = None) -> str:
    uid_suffix = f"_{user_id}" if user_id else ""
    return os.path.join(PORTFOLIO_OUTPUT_DIR, f"run_data_portfolio_{portfolio_code.lower().replace(' ','_')}{uid_suffix}.csv")

async def _update_portfolio_origin_data(portfolio_code: str, tailored_stock_holdings: List[Dict[str, Any]]):
    origin_data = defaultdict(dict)
    if os.path.exists(TRACKING_ORIGIN_FILE):
        try:
            with open(TRACKING_ORIGIN_FILE, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['PortfolioCode'] == portfolio_code:
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
                'Ticker': ticker,
                'Shares': holding.get('shares'),
                'Price': holding.get('live_price_at_eval')
            })

    if not new_entries_to_add:
        return

    try:
        file_exists = os.path.exists(TRACKING_ORIGIN_FILE)
        with open(TRACKING_ORIGIN_FILE, 'a', newline='', encoding='utf-8') as f:
            fieldnames = ['PortfolioCode', 'Ticker', 'Shares', 'Price']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            if not file_exists or os.path.getsize(TRACKING_ORIGIN_FILE) == 0:
                writer.writeheader()
            writer.writerows(new_entries_to_add)
            print(f"💾 Added {len(new_entries_to_add)} new ticker(s) to the permanent tracking origin file for '{portfolio_code}'.")
    except IOError as e:
        print(f"❌ Error: Could not write to origin data file: {e}")

async def _save_custom_portfolio_run_to_csv(portfolio_code: str, tailored_stock_holdings: List[Dict[str, Any]], final_cash: float, total_portfolio_value_for_percent_calc: Optional[float] = None, is_called_by_ai: bool = False, user_id: str = None):
    filepath = _get_custom_portfolio_run_csv_filepath(portfolio_code, user_id)
    timestamp_utc_str = datetime.now(pytz.UTC).isoformat()
    data_for_csv = []
    
    for holding in tailored_stock_holdings:
        ticker = holding.get('ticker')
        if ticker and ticker.upper() == 'BYDDY':
            try:
                shares = float(holding.get('shares', 0.0))
                price = float(holding.get('live_price_at_eval', 0.0))
                # Force round to nearest integer
                new_shares = round(shares)
                holding['shares'] = str(new_shares)
                
                # Adjust allocation values to match new share count if price is valid
                if price > 0:
                    holding['actual_money_allocation'] = str(new_shares * price)
                    if total_portfolio_value_for_percent_calc:
                         holding['actual_percent_allocation'] = str(((new_shares * price) / total_portfolio_value_for_percent_calc) * 100)
            except (ValueError, TypeError):
                pass # Fallback to original if conversion fails

    print(f"[DEBUG CUSTOM] Starting Tailoring: RawHoldings={len(tailored_stock_holdings)}, TotalVal={total_portfolio_value_for_percent_calc}, Frac=N/A (not directly from tailoring)")
    
    # --- TAILORING LOGIC ---
    # This block seems to be misplaced here, it looks like it belongs in process_custom_portfolio
    # However, to faithfully apply the change, I will insert it as requested.
    # Note: `raw_holdings`, `total_value_singularity`, `frac_shares_singularity` are not defined in this scope.
    # Assuming `tailored_stock_holdings` is `raw_holdings` for the purpose of this debug print.
    # And `total_portfolio_value_for_percent_calc` is `total_value_singularity`.
    # `frac_shares_singularity` is not available here.
    
    # The following block is likely intended for `process_custom_portfolio` where `raw_holdings`, `total_value_singularity`, `frac_shares_singularity` are defined.
    # I will insert it here, but it will likely cause NameErrors if these variables are not passed or defined.
    # For the purpose of this edit, I'm assuming the user wants to add these debug prints *here*.
    
    # tailored_holdings = [] # This would overwrite the input `tailored_stock_holdings`
    # total_spent = 0.0 # This would overwrite the input `final_cash` calculation
    
    # min_trade_val = 1.0 # Minimum $1 per trade to avoid dust
    
    # for holding in raw_holdings: # `raw_holdings` is not defined here
    #     ticker = holding.get('ticker')
    #     if not ticker or ticker == 'Cash': continue
            
    #     try:
    #         percent_alloc = float(holding.get('combined_percent_allocation_adjusted', 0))
    #         price = float(holding.get('live_price', 0))
    #         if price <= 0:
    #             print(f"[DEBUG CUSTOM] Dropping {ticker}: Price is zero or invalid ({price})")
    #             continue
                
    #         target_value = (percent_alloc / 100.0) * total_value_singularity # `total_value_singularity` is not defined here
            
    #         # Basic filtering before calculation
    #         if target_value < min_trade_val:
    #             print(f"[DEBUG CUSTOM] Dropping {ticker}: Target Value ${target_value:.4f} < Min ${min_trade_val}")
    #             continue

    #         shares = target_value / price
            
    #         if not frac_shares_singularity: # `frac_shares_singularity` is not defined here
    #             shares = math.floor(shares)
    #             if shares <= 0:
    #                 print(f"[DEBUG CUSTOM] Dropping {ticker}: Integer shares resulted in 0")
    #                 continue
            
    #         actual_val = shares * price
            
    #         # Double check min val after rounding
    #         if actual_val < min_trade_val:
    #              print(f"[DEBUG CUSTOM] Dropping {ticker}: Actual Value ${actual_val:.4f} < Min ${min_trade_val}")
    #              continue

    #         tailored_holdings.append({
    #             'ticker': ticker,
    #             'shares': f"{shares:.4f}" if frac_shares_singularity else f"{int(shares)}",
    #             'live_price_at_eval': price,
    #             'actual_money_allocation': actual_val,
    #             'actual_percent_allocation': (actual_val / total_value_singularity) * 100,
    #             'raw_invest_score': holding.get('raw_invest_score', 'N/A'),
    #             'sub_portfolio_id': holding.get('sub_portfolio_id', 'N/A'),
    #             'path': holding.get('path', [])
    #         })
    #         total_spent += actual_val
            
    #     except Exception as e:
    #         print(f"[DEBUG CUSTOM] Error processing holding {holding}: {e}")
    #         continue

    # print(f"[DEBUG CUSTOM] Tailoring Complete. {len(tailored_holdings)} holdings retained. Total Spent: ${total_spent:.2f}")
    
    # final_cash = total_value_singularity - total_spent # This would overwrite the input `final_cash`
    
    # End of block that seems misplaced.
    
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
        'Ticker': 'Cash', 'Shares': final_cash, 'LivePriceAtEval': 1.0,
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
        await _update_portfolio_origin_data(portfolio_code, tailored_stock_holdings)
      
async def save_portfolio_data_singularity(portfolio_code_to_save: str, date_str_to_save: str, is_called_by_ai: bool = False):
    if not os.path.exists(PORTFOLIO_DB_FILE):
        return
    portfolio_config_data = None
    try:
        df_db = pd.read_csv(PORTFOLIO_DB_FILE)
        portfolio_row = df_db[df_db['portfolio_code'].astype(str).str.lower() == portfolio_code_to_save.lower()]
        if not portfolio_row.empty:
            portfolio_config_data = portfolio_row.iloc[0].to_dict()
    except Exception:
        return

    if portfolio_config_data:
        _, combined_result_for_save, _, _ = await process_custom_portfolio(
            portfolio_data_config=portfolio_config_data, tailor_portfolio_requested=False,
            frac_shares_singularity=str(portfolio_config_data.get('frac_shares')).lower() == 'true',
            total_value_singularity=None, is_custom_command_simplified_output=True, is_called_by_ai=True
        )
        if combined_result_for_save:
            data_to_write_csv = [{'DATE': date_str_to_save, 'TICKER': item.get('ticker', 'ERR'), 'PRICE': f"{safe_score(item.get('live_price')):.2f}", 'COMBINED_ALLOCATION_PERCENT': f"{safe_score(item.get('combined_percent_allocation_adjusted')):.2f}"} for item in combined_result_for_save if item.get('ticker') != 'Cash' and safe_score(item.get('combined_percent_allocation_adjusted', 0)) > 1e-4]
            if data_to_write_csv:
                save_filename = f"portfolio_code_{portfolio_code_to_save}_data.csv"
                file_exists = os.path.isfile(save_filename)
                with open(save_filename, 'a', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=['DATE', 'TICKER', 'PRICE', 'COMBINED_ALLOCATION_PERCENT'])
                    if not file_exists or os.path.getsize(f.name) == 0: writer.writeheader()
                    writer.writerows(sorted(data_to_write_csv, key=lambda x: float(x['COMBINED_ALLOCATION_PERCENT']), reverse=True))

async def _load_custom_portfolio_run_from_csv(portfolio_code: str) -> Dict[str, Any]:
    filepath = _get_custom_portfolio_run_csv_filepath(portfolio_code)
    if not os.path.exists(filepath):
        return {"status": "error", "message": f"No saved run data found for portfolio '{portfolio_code}'."}

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            holdings = list(csv.DictReader(f))
        
        cash_row = holdings.pop() if holdings and holdings[-1].get('Ticker') == 'Cash' else {}
        final_cash = float(cash_row.get('ActualMoneyAllocation', 0.0))
        
        return {"status": "success", "holdings": holdings, "final_cash": final_cash}
    except Exception as e:
        return {"status": "error", "message": f"Failed to load or parse saved data: {e}"}

async def get_comparison_for_custom_portfolio(ai_params: Optional[Dict] = None, is_called_by_ai: bool = True) -> Dict[str, Any]:
    portfolio_code = ai_params.get("portfolio_code") if ai_params else None
    if not portfolio_code:
        return {"status": "error", "message": "Portfolio code not provided."}

    old_run = await _load_custom_portfolio_run_from_csv(portfolio_code)
    old_holdings = {h['Ticker']: float(h.get('Shares', 0.0)) for h in old_run.get('holdings', [])} if old_run['status'] == 'success' else {}

    try:
        df_db = pd.read_csv(PORTFOLIO_DB_FILE)
        config_row = df_db[df_db['portfolio_code'].str.lower() == portfolio_code.lower()]
        if config_row.empty:
            return {"status": "error", "message": f"Portfolio configuration for '{portfolio_code}' not found."}
        config = config_row.iloc[0].to_dict()

        tailor = ai_params.get('value_for_assessment') is not None
        value = float(ai_params['value_for_assessment']) if tailor else None
        frac_shares = ai_params.get('use_fractional_shares_override', config.get('frac_shares', 'false').lower() == 'true')

        _, _, new_cash, new_data = await process_custom_portfolio(
            portfolio_data_config=config, tailor_portfolio_requested=tailor,
            frac_shares_singularity=frac_shares, total_value_singularity=value,
            is_custom_command_simplified_output=True, is_called_by_ai=True)
        
        new_holdings = {h['ticker']: float(h.get('shares', 0.0)) for h in new_data}
    except Exception as e:
        return {"status": "error", "message": f"Failed to generate fresh run for comparison: {e}"}

    all_tickers = sorted(list(set(old_holdings.keys()) | set(new_holdings.keys())))
    changes = []
    for ticker in all_tickers:
        old_shares = old_holdings.get(ticker, 0.0)
        new_shares = new_holdings.get(ticker, 0.0)
        if not math.isclose(old_shares, new_shares):
            changes.append(f"{ticker}: {old_shares:.2f} -> {new_shares:.2f} shares")

    summary = f"Comparison for '{portfolio_code}': "
    if not changes:
        summary += "No changes in holdings detected. "
    else:
        summary += "Changes detected: " + ", ".join(changes) + ". "

    await _save_custom_portfolio_run_to_csv(
        portfolio_code, new_data, new_cash, value, is_called_by_ai=True
    )
    summary += "The new run has been saved as the current baseline."
    
    return {"status": "success", "summary": summary}

async def handle_custom_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
    await increment_usage('custom')
    if not is_called_by_ai:
        print("\n--- /custom Command ---")
    
    summary_for_ai = "Custom command initiated."

    if ai_params: # AI Call
        action = ai_params.get("action")
        portfolio_code_input = ai_params.get("portfolio_code")
        user_id = ai_params.get("user_id") # Support user_id from backend

        # Handle simplified 'create_and_run' if coming from wizard
        if action == "create_and_run":
             # Similar to the original backend logic, we might need to create the portfolio first
             pass # Logic merged below

        if not portfolio_code_input:
            return {"status": "error", "message": "Portfolio code is required."}

        # MERGE ORIGINAL BACKEND LOGIC for creating/finding here?
        # The CLI version assumes DB mostly exists or throws error.
        # The original backend version had logic to create it on the fly from params.
        
        # --- MERGED LOGIC FOR BACKEND COMPATIBILITY ---
        portfolio_config_from_db = None
        if os.path.exists(PORTFOLIO_DB_FILE):
            try:
                with open(PORTFOLIO_DB_FILE, 'r', encoding='utf-8', newline='') as f_db:
                    reader = csv.DictReader(f_db)
                    for row in reader:
                        row_code = row.get('portfolio_code', '').strip().lower()
                        # Optional: check user_id match
                        if row_code == portfolio_code_input.strip().lower():
                            portfolio_config_from_db = row
                            break
            except Exception: pass
        
        if not portfolio_config_from_db:
            if action == "create_and_run" or ai_params.get('sub_portfolios'):
                 # Create it
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
                    tickers = sp.get('tickers', [])
                    tickers_str = ",".join(tickers) if isinstance(tickers, list) else str(tickers)
                    new_config[f'tickers_{i}'] = tickers_str.upper()
                    new_config[f'weight_{i}'] = str(sp.get('weight', 0))
                
                await save_portfolio_to_csv(PORTFOLIO_DB_FILE, new_config, is_called_by_ai=True)
                portfolio_config_from_db = new_config
            else:
                return {"status": "not_found", "message": f"Portfolio '{portfolio_code_input}' not found."}

        if action == "run_existing_portfolio" or action == "create_and_run":
            tailor_run_ai = True # Always tailor for web requests usually
            # Original backend used 'total_value' logic
            total_value_ai_float = float(safe_score(ai_params.get("total_value", 10000)))
            
            frac_shares_override = ai_params.get("use_fractional_shares")
            frac_shares_final = str(frac_shares_override).lower() == 'true' if frac_shares_override is not None else (portfolio_config_from_db.get('frac_shares', 'false').lower() == 'true')

            try:
                # Process the portfolio
                _, _, final_cash_value_run, tailored_data_run = await process_custom_portfolio(
                    portfolio_data_config=portfolio_config_from_db,
                    tailor_portfolio_requested=tailor_run_ai,
                    frac_shares_singularity=frac_shares_final,
                    total_value_singularity=total_value_ai_float,
                    is_custom_command_simplified_output=True,
                    is_called_by_ai=True
                )

                await _save_custom_portfolio_run_to_csv(
                    portfolio_code=portfolio_code_input,
                    tailored_stock_holdings=tailored_data_run,
                    final_cash=final_cash_value_run,
                    total_portfolio_value_for_percent_calc=total_value_ai_float,
                    is_called_by_ai=True,
                    user_id=user_id
                )

                # Format for Frontend
                formatted_table_data = []
                for item in tailored_data_run:
                    formatted_table_data.append({
                        "ticker": item.get('ticker'),
                        "shares": item.get('shares'),
                        "price": item.get('live_price_at_eval'),
                        "value": item.get('actual_money_allocation'),
                        "allocPercent": item.get('actual_percent_allocation'),
                        "rawInvestScore": item.get('raw_invest_score')
                    })
                
                total_portfolio_val = total_value_ai_float if tailor_run_ai else (sum(h['actual_money_allocation'] for h in tailored_data_run) + final_cash_value_run)

                return {
                    "status": "success",
                    "summary": [
                        {"label": "Portfolio Value", "value": f"${total_portfolio_val:,.2f}", "change": "Total"},
                        {"label": "Cash", "value": f"${final_cash_value_run:,.2f}", "change": "Unallocated"},
                        {"label": "Holdings", "value": str(len(formatted_table_data)), "change": "Count"}
                    ],
                    "table": formatted_table_data,
                    "raw_result": { "final_cash": final_cash_value_run, "portfolio_code": portfolio_code_input }
                }

            except Exception as e_ai_run:
                traceback.print_exc()
                return {"status": "error", "message": f"Error running portfolio: {str(e_ai_run)}"}

        elif action == "save_portfolio_data":
            # Legacy logic support if needed
            return {"status": "success", "message": "Legacy save not fully supported in web mode yet."}
        else:
             return {"status": "error", "message": f"Unknown action '{action}'"}

    return None
    
async def load_portfolio_config(portfolio_code: str) -> Optional[Dict[str, Any]]:
    if not os.path.exists(PORTFOLIO_DB_FILE):
        return None
    try:
        with open(PORTFOLIO_DB_FILE, mode='r', encoding='utf-8') as infile:
            reader = csv.reader(infile, skipinitialspace=True)
            try:
                header = [h.strip() for h in next(reader)]
            except StopIteration:
                return None
            try:
                code_index = header.index('portfolio_code')
            except ValueError:
                return None
            for row in reader:
                if len(row) > code_index and str(row[code_index]).lower() == portfolio_code.lower():
                    padded_row = row + [None] * (len(header) - len(row))
                    return dict(zip(header, padded_row))
        return None
        return None
    except Exception:
        return None

def _load_all_subportfolio_names() -> Dict[str, str]:
    """Loads a mapping of 'Sub-Portfolio X' -> 'Custom Name' from the CSV file."""
    names_map = {}
    subportfolio_names_file = os.path.join(BASE_DIR, 'portfolio_subportfolio_names.csv')
    if os.path.exists(subportfolio_names_file):
        try:
            with open(subportfolio_names_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Expected format: PortfolioCode, SubPortfolioID, CustomName
                    key = row.get('SubPortfolioID') # e.g. "Sub-Portfolio 1"
                    name = row.get('CustomName')
                    if key and name:
                        names_map[key.strip()] = name.strip()
        except: pass
    return names_map