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

# --- Local Imports from other command modules ---
try:
    from .custom_command import _get_custom_portfolio_run_csv_filepath, _save_custom_portfolio_run_to_csv, TRACKING_ORIGIN_FILE, PORTFOLIO_DB_FILE
    from .invest_command import process_custom_portfolio, calculate_ema_invest
except ImportError:
    from custom_command import _get_custom_portfolio_run_csv_filepath, _save_custom_portfolio_run_to_csv, TRACKING_ORIGIN_FILE, PORTFOLIO_DB_FILE
    from invest_command import process_custom_portfolio, calculate_ema_invest

try:
    from .execution_command import execute_portfolio_rebalance, get_robinhood_equity
except ImportError:
    def execute_portfolio_rebalance(trades): print("Execution module not found.")
    def get_robinhood_equity(): return 0.0

# --- Constants ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBPORTFOLIO_NAMES_FILE = os.path.join(BASE_DIR, 'subportfolio_names.csv')

def _get_subportfolio_map_from_config(portfolio_config: Dict[str, Any]) -> Dict[str, str]:
    """Parses the portfolio config to create a mapping of Ticker -> Sub-Portfolio ID."""
    ticker_map = {}
    num_portfolios = int(portfolio_config.get('num_portfolios', 0))
    for i in range(1, num_portfolios + 1):
        sub_portfolio_id = f'Sub-Portfolio {i}'
        tickers_str = portfolio_config.get(f'tickers_{i}', '')
        for ticker in tickers_str.split(','):
            if ticker.strip():
                ticker_map[ticker.strip().upper()] = sub_portfolio_id
    return ticker_map

def _load_all_subportfolio_names() -> Dict[str, str]:
    """Loads all custom names from the dedicated CSV into a single map using a composite key."""
    if not os.path.exists(SUBPORTFOLIO_NAMES_FILE):
        return {}
    names = {}
    try:
        with open(SUBPORTFOLIO_NAMES_FILE, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Use a 'PortfolioCode|SubPortfolioID' composite key for uniqueness
                composite_key = f"{row['PortfolioCode'].lower().strip()}|{row['SubPortfolioID'].strip()}"
                names[composite_key] = row['SubPortfolioName']
    except Exception:
        pass # Fail silently if file is malformed
    return names

def _save_all_subportfolio_names(all_names_map: Dict[str, str]):
    """Saves the complete map of all portfolio names back to the CSV, overwriting the file."""
    rows_to_write = []
    for composite_key, name in all_names_map.items():
        try:
            portfolio_code, sub_id = composite_key.split('|', 1)
            rows_to_write.append({
                'PortfolioCode': portfolio_code,
                'SubPortfolioID': sub_id,
                'SubPortfolioName': name
            })
        except ValueError:
            continue # Skip any malformed keys

    # Sort for consistent file output
    sorted_rows = sorted(rows_to_write, key=lambda x: (x['PortfolioCode'], x['SubPortfolioID']))

    try:
        with open(SUBPORTFOLIO_NAMES_FILE, 'w', newline='', encoding='utf-8') as f:
            fieldnames = ['PortfolioCode', 'SubPortfolioID', 'SubPortfolioName']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(sorted_rows)
    except IOError as e:
        print(f"❌ Error saving sub-portfolio names: {e}")
# <<< END: REPLACEMENT >>>

# <<< START: REPLACEMENT for manage_subportfolio_names >>>
async def manage_subportfolio_names(
    portfolio_code: str,
    portfolio_config: Dict[str, Any],
    all_names_map: Dict[str, str],
    force_rename: bool = False
) -> bool:
    """Identifies sub-portfolios from config and prompts user to name them, updating a global map."""
    num_portfolios = 0
    try:
        num_portfolios = int(portfolio_config.get('num_portfolios', 0))
    except (ValueError, TypeError):
        print("Warning: 'num_portfolios' in config is not a valid number.")
        return False

    if num_portfolios == 0:
        return False

    sub_ids = [f'Sub-Portfolio {i}' for i in range(1, num_portfolios + 1)]

    print("\n--- Sub-Portfolio Naming ---")
    updated = False

    for sub_id in sub_ids:
        # Use the composite key for lookup and assignment
        composite_key = f"{portfolio_code.lower()}|{sub_id}"
        current_name = all_names_map.get(composite_key, sub_id)

        # If forcing rename, or if the name has never been set for this specific sub-portfolio
        if force_rename or (composite_key not in all_names_map):
            prompt = f"Enter name for '{sub_id}' of portfolio '{portfolio_code}' (current: '{current_name}', press Enter to keep): "
            custom_name = input(prompt).strip()

            if custom_name and custom_name != current_name:
                all_names_map[composite_key] = custom_name
                updated = True
            # If user skips for the first time, save the default name to the map
            elif composite_key not in all_names_map:
                all_names_map[composite_key] = sub_id

        # Ensure every ID has a map entry, even if it's the default
        elif composite_key not in all_names_map:
            all_names_map[composite_key] = sub_id

    if updated:
        _save_all_subportfolio_names(all_names_map)
        print("✔ Sub-portfolio names saved.")

    return updated
# <<< END: REPLACEMENT >>>

# <<< START: NEW HIERARCHICAL PERFORMANCE FUNCTIONS >>>

def _build_nested_performance_dict(run_data: List[Dict[str, Any]], live_prices: Dict[str, float]) -> Dict:
    """Builds a nested dictionary from the flat run data based on the SubPortfolioPath."""
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

            # Traverse the path, creating nodes if they don't exist
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
    
    return root['children']


def _display_performance_recursively(performance_nodes: Dict, indent: int = 0):
    """Recursively displays the performance data from the nested dictionary."""
    indent_str = "  " * indent
    for name, data in sorted(performance_nodes.items()):
        total_pnl = data['current_value'] - data['initial_value']
        total_pnl_pct = (total_pnl / data['initial_value']) * 100 if data['initial_value'] > 0 else 0

        header = f"**{name}**"
        stats = f"Initial: ${data['initial_value']:,.2f} | Current: ${data['current_value']:,.2f} | P&L: ${total_pnl:,.2f} ({total_pnl_pct:.2f}%)"
        print(f"\n{indent_str}{header} | {stats}")
        
        if data['positions']:
            position_table = [
                [p['ticker'], f"${p['initial_value']:,.2f}", f"${p['current_value']:,.2f}", f"${p['pnl']:,.2f}", f"{p['pnl_percent']:.2f}%"]
                for p in sorted(data['positions'], key=lambda x: x['initial_value'], reverse=True)
            ]
            # Add indentation to each line of the table string
            table_str = tabulate(position_table, headers=["Ticker", "Initial Value", "Current Value", "P&L ($)", "P&L (%)"], tablefmt="pretty")
            indented_table_str = "\n".join([f"{indent_str}  {line}" for line in table_str.splitlines()])
            print(indented_table_str)
        
        # Recurse for children
        if data['children']:
            _display_performance_recursively(data['children'], indent + 1)

# <<< END: NEW HIERARCHICAL PERFORMANCE FUNCTIONS >>>

async def _load_portfolio_origin_data(portfolio_code: str) -> Dict[str, Dict[str, float]]:
    """Loads the permanent origin data for a specific portfolio."""
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
        print(f"⚠️ Warning: Could not process origin data file: {e}")
    return origin_data

async def display_all_time_performance(portfolio_code: str, new_run_data: List[Dict[str, Any]], old_run_data: Optional[List[Dict[str, Any]]], portfolio_config: Dict[str, Any], names_map: Dict[str, str]):
    """Calculates and displays all-time performance, split by sub-portfolio."""
    print("\n--- All-Time Performance & Holdings Analysis ---")
    origin_data = await _load_portfolio_origin_data(portfolio_code)
    if not origin_data:
        print("No origin data found. This table will be populated after the first run is saved.")
        return

    # Create a map of Ticker -> Sub-Portfolio ID, then Ticker -> Sub-Portfolio Name
    ticker_to_sub_id_map = _get_subportfolio_map_from_config(portfolio_config)
    ticker_to_sub_name_map = {ticker: names_map.get(sub_id, sub_id) for ticker, sub_id in ticker_to_sub_id_map.items()}

    current_holdings = {h['ticker']: float(h.get('shares', 0)) for h in new_run_data if h.get('ticker') != 'Cash'}
    previous_holdings = {h['Ticker']: float(h.get('Shares', 0)) for h in old_run_data if h.get('Ticker') != 'Cash'} if old_run_data else {}
    all_held_tickers = set(origin_data.keys()) | set(current_holdings.keys()) | set(previous_holdings.keys())

    tasks = [calculate_ema_invest(ticker, ema_interval=2, is_called_by_ai=True) for ticker in all_held_tickers]
    live_price_results = await asyncio.gather(*tasks)
    live_prices = {ticker: res[0] for ticker, res in zip(all_held_tickers, live_price_results) if res and res[0] is not None}

    # Data structures for grouping and totals
    all_time_data_by_sub = defaultdict(list)
    sub_portfolio_pnl_totals = defaultdict(float)
    grand_total_pnl = 0.0

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
        
        table_row = [
            ticker, f"{origin_price:.2f}", f"{live_price:.2f}", f"{origin_shares:.2f}",
            f"{current_shares:.2f}", f"{share_change:+.2f}", f"${all_time_pnl:,.2f}", f"{all_time_pnl_pct:.2f}%"
        ]
        
        sub_name = ticker_to_sub_name_map.get(ticker, "Unassigned")
        all_time_data_by_sub[sub_name].append(table_row)
        sub_portfolio_pnl_totals[sub_name] += all_time_pnl
        grand_total_pnl += all_time_pnl

    if not all_time_data_by_sub:
        print("Could not calculate all-time performance data.")
        return

    # Display tables for each sub-portfolio
    for sub_name, table_data in sorted(all_time_data_by_sub.items()):
        print(f"\n**--- {sub_name} ---**")
        print(tabulate(table_data, headers=["Ticker", "Origin Price", "Live Price", "Origin Shares", "Current Shares", "Share +/-", "All-Time P&L ($)", "All-Time P&L (%)"], tablefmt="pretty"))
        total_pnl_for_sub = sub_portfolio_pnl_totals[sub_name]
        print(f"Sub-Portfolio Total P&L: ${total_pnl_for_sub:,.2f}")

    # Display the final grand total
    print("\n" + "="*50)
    print(f"**Entire Portfolio All-Time Total P&L: ${grand_total_pnl:,.2f}**")
    print("="*50)

def generate_allocation_comparison_chart(old_run: List[Dict], new_run: List[Dict], portfolio_code: str) -> Optional[str]:
    """Generates a grouped bar chart comparing old and new dollar allocations."""
    print("📊 Generating allocation comparison chart...")
    old_alloc = {row['Ticker']: float(row.get('ActualMoneyAllocation', 0)) for row in old_run if row['Ticker'] != 'Cash'}
    new_alloc = {row['ticker']: float(row.get('actual_money_allocation', 0)) for row in new_run}

    all_tickers = sorted(list(set(old_alloc.keys()) | set(new_alloc.keys())))
    if not all_tickers:
        print("No allocation data to plot.")
        return None

    old_values = [old_alloc.get(t, 0) for t in all_tickers]
    new_values = [new_alloc.get(t, 0) for t in all_tickers]
    
    x = np.arange(len(all_tickers))
    width = 0.35

    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(16, 8))
    
    rects1 = ax.bar(x - width/2, old_values, width, label='Old Allocation', color='#4E79A7')
    rects2 = ax.bar(x + width/2, new_values, width, label='New Allocation', color='#F28E2B')

    ax.set_ylabel('USD ($) Allocation', color='white')
    ax.set_title(f'Allocation Comparison for Portfolio: {portfolio_code}', color='white', fontsize=16)
    ax.set_xticks(x)
    ax.set_xticklabels(all_tickers, rotation=45, ha="right", color='white')
    ax.legend(facecolor='black', edgecolor='white', labelcolor='white')
    ax.grid(True, axis='y', color='dimgray', linestyle='--', linewidth=0.5, alpha=0.7)
    ax.tick_params(axis='y', colors='white')

    def autolabel(rects):
        for rect in rects:
            height = rect.get_height()
            if height > 0:
                ax.annotate(f'${height:,.0f}', xy=(rect.get_x() + rect.get_width() / 2, height),
                            xytext=(0, 3), textcoords="offset points", ha='center', va='bottom', color='lightgrey', fontsize=8)

    autolabel(rects1)
    autolabel(rects2)

    fig.tight_layout()
    filename = f"tracking_comparison_{portfolio_code}_{uuid.uuid4().hex[:6]}.png"
    plt.savefig(filename, facecolor='black', edgecolor='black')
    plt.close(fig)
    print(f"📂 Chart saved: {filename}")
    return filename

# <<< START: NEW FUNCTION FOR COMPARISON SUBCOMMAND >>>
async def handle_comparison_subcommand():
    """Handles the logic for the '/tracking comparison' subcommand."""
    print("\n--- Portfolio Comparison ---")
    
    # 1. Get user input for both portfolio codes
    code1 = input("Enter the first portfolio code to compare: ").strip()
    code2 = input("Enter the second portfolio code to compare: ").strip()

    if not code1 or not code2:
        print("❌ Error: Both portfolio codes are required.")
        return

    # 2. Validate that saved run files exist for both portfolios
    filepath1 = _get_custom_portfolio_run_csv_filepath(code1)
    filepath2 = _get_custom_portfolio_run_csv_filepath(code2)

    errors = []
    if not os.path.exists(filepath1):
        errors.append(f"  - No saved run found for '{code1}'. Please run '/custom {code1}' or '/tracking {code1}' to generate one.")
    if not os.path.exists(filepath2):
        errors.append(f"  - No saved run found for '{code2}'. Please run '/custom {code2}' or '/tracking {code2}' to generate one.")

    if errors:
        print("\n❌ Comparison cannot proceed due to missing data:")
        for error in errors:
            print(error)
        return

    # 3. Load the saved run data for both
    run_data1 = await _load_portfolio_run(code1)
    run_data2 = await _load_portfolio_run(code2)
    
    if not run_data1 or not run_data2:
        print("❌ Error: Could not load data from one or both of the saved run files.")
        return
        
    # 4. Process data into simple {ticker: shares} dictionaries
    try:
        holdings1 = {row['Ticker']: float(row['Shares']) for row in run_data1 if row.get('Ticker') != 'Cash' and row.get('Shares') != '-'}
        holdings2 = {row['Ticker']: float(row['Shares']) for row in run_data2 if row.get('Ticker') != 'Cash' and row.get('Shares') != '-'}
    except (ValueError, TypeError) as e:
        print(f"❌ Error processing share data from a saved file: {e}. Ensure the files are not corrupted.")
        return

    # 5. Compare holdings and build the results table
    all_tickers = sorted(list(set(holdings1.keys()) | set(holdings2.keys())))
    comparison_table = []

    for ticker in all_tickers:
        shares1 = holdings1.get(ticker, 0.0)
        shares2 = holdings2.get(ticker, 0.0)
        change = shares1 - shares2
        status = ""

        if shares1 > 0 and shares2 == 0:
            status = f"Only in {code1}"
        elif shares2 > 0 and shares1 == 0:
            status = f"Only in {code2}"
        elif np.isclose(shares1, shares2):
            status = "Equal Holdings"
        elif shares1 > shares2:
            status = f"More in {code1}"
        else: # shares2 > shares1
            status = f"Less in {code1}"
            
        comparison_table.append([
            ticker,
            f"{shares1:.2f}",
            f"{shares2:.2f}",
            f"{change:+.2f}", # The '+' sign ensures we see + or -
            status
        ])
        
    # 6. Display the final comparison table
    print(f"\n--- Comparison of Holdings: '{code1}' vs. '{code2}' ---")
    if not comparison_table:
        print("No stock holdings found in either portfolio to compare.")
    else:
        headers = ["Ticker", f"Shares in {code1}", f"Shares in {code2}", f"Difference ({code1} - {code2})", "Status"]
        print(tabulate(comparison_table, headers=headers, tablefmt="pretty"))

# --- Main Handler for /tracking ---
async def handle_tracking_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
    """Handles the /tracking command with automated RH fetching and optimized workflow."""
    if not is_called_by_ai:
        print("\n--- /tracking Command ---")
    
    # --- AI Parameter Parsing ---
    if is_called_by_ai:
        portfolio_code = ai_params.get("portfolio_code")
        if not portfolio_code: return "Error: 'portfolio_code' is required."
        
        # Support comparison via ai_params if needed, but for now focus on single portfolio analysis
        if ai_params.get("action") == "comparison":
            # TODO: Implement AI version of comparison if needed
            return "Error: Comparison action not yet supported for AI."
            
        subcommand = None # Not used in AI path typically
    else:
        if not args:
            print("Usage: /tracking <portfolio_code | comparison> [name]")
            return

        if args[0].lower() == 'comparison':
            await handle_comparison_subcommand()
            return

        portfolio_code = args[0]
        subcommand = args[1].lower() if len(args) > 1 else None

    all_names_map = _load_all_subportfolio_names()
    
    # --- 1. Load Config & Data ---
    portfolio_config = await load_portfolio_config(portfolio_code)
    if not portfolio_config:
        msg = f"Error: Portfolio configuration for '{portfolio_code}' not found."
        if is_called_by_ai: return msg
        print(msg); return

    if subcommand == 'name' and not is_called_by_ai:
        await manage_subportfolio_names(portfolio_code, portfolio_config, all_names_map, force_rename=True)
        return

    old_run_data = await _load_portfolio_run(portfolio_code)

    # --- 2. Auto-Fetch Robinhood Equity ---
    rh_equity = 0.0
    # Skip RH fetch for AI to speed up, or make it optional. For now, assume 0 or passed in params.
    if not is_called_by_ai:
        print("⏳ Connecting to Robinhood to fetch current portfolio value...")
        rh_equity = await asyncio.to_thread(get_robinhood_equity)
    
    suggested_value = None
    if rh_equity > 0:
        suggested_value = math.floor(rh_equity * 0.99)
        if not is_called_by_ai:
            print(f"✔ Robinhood Portfolio Value Fetched: ${rh_equity:,.2f}")
            print(f"  -> Suggested Tailoring Value (99%): ${suggested_value:,.2f}")
    elif not is_called_by_ai:
        print("⚠️ Could not fetch Robinhood value (or login failed). Proceeding with manual input.")

    # --- 3. Performance Since Last Save ---
    # (Skipping display for AI, but logic remains)
    if old_run_data and any(not row.get('SubPortfolio') or row.get('SubPortfolio') == 'Unassigned' for row in old_run_data):
        ticker_to_sub_map = _get_subportfolio_map_from_config(portfolio_config)
        for row in old_run_data:
            if not row.get('SubPortfolio') or row.get('SubPortfolio') == 'Unassigned':
                row['SubPortfolio'] = ticker_to_sub_map.get(row['Ticker'], 'Unassigned')

    if not is_called_by_ai:
        await manage_subportfolio_names(portfolio_code, portfolio_config, all_names_map, force_rename=False)

    if old_run_data and not is_called_by_ai:
        print("\n--- Performance Since Last Save ---")
        tickers_to_fetch = [row['Ticker'] for row in old_run_data if row.get('Ticker') != 'Cash']
        tasks = [calculate_ema_invest(ticker, ema_interval=2, is_called_by_ai=True) for ticker in tickers_to_fetch]
        live_price_results = await asyncio.gather(*tasks, return_exceptions=True)
        live_prices = {
            ticker: res[0]
            for ticker, res in zip(tickers_to_fetch, live_price_results)
            if not isinstance(res, Exception) and res and res[0] is not None
        }
        nested_performance_data = _build_nested_performance_dict(old_run_data, live_prices)
        if nested_performance_data:
            _display_performance_recursively(nested_performance_data)

    # --- 4. Inputs for New Calculation ---
    if not is_called_by_ai:
        print("\n--- Generating New Portfolio Recommendation ---")
    
    # Fractional Shares Input
    frac_shares_config = portfolio_config.get('frac_shares', 'false').lower() == 'true'
    
    if is_called_by_ai:
        use_frac_shares_new = ai_params.get("use_fractional_shares", frac_shares_config)
    else:
        frac_prompt = f"Use fractional shares? (yes/no, config default: {frac_shares_config}): "
        frac_input = input(frac_prompt).lower().strip()
        use_frac_shares_new = frac_shares_config
        if frac_input == 'yes': use_frac_shares_new = True
        elif frac_input == 'no': use_frac_shares_new = False

    # Portfolio Value Input
    new_total_value = 0.0
    if is_called_by_ai:
        val_param = ai_params.get("total_value")
        if val_param:
            try:
                new_total_value = float(val_param)
            except ValueError: return "Error: Invalid 'total_value'."
        elif suggested_value:
            new_total_value = float(suggested_value)
        else:
            return "Error: 'total_value' is required."
    else:
        val_prompt = "Enter total portfolio value"
        if suggested_value:
            val_prompt += f" (default: {suggested_value})"
        val_prompt += ": "
        val_input = input(val_prompt).strip()
        if not val_input and suggested_value:
            new_total_value = float(suggested_value)
        else:
            try:
                new_total_value = float(val_input)
                if new_total_value <= 0: raise ValueError
            except ValueError:
                print("Invalid value. Aborting.")
                return

    # --- 5. Calculate New Allocation ---
    _, _, new_cash, new_run_data = await process_custom_portfolio(
        portfolio_data_config=portfolio_config,
        tailor_portfolio_requested=True,
        frac_shares_singularity=use_frac_shares_new,
        total_value_singularity=new_total_value,
        is_custom_command_simplified_output=False, 
        is_called_by_ai=is_called_by_ai, # Pass this down
        names_map=all_names_map
    )

    # --- Return Data for AI ---
    if is_called_by_ai:
        # Return structured data for the API
        return {
            "portfolio_code": portfolio_code,
            "total_value": new_total_value,
            "final_cash": new_cash,
            "holdings": new_run_data,
            "old_run_data": old_run_data
        }

    # --- 6. Display Analysis (CLI Only) ---
    await display_all_time_performance(portfolio_code, new_run_data, old_run_data, portfolio_config, all_names_map)

    trades_to_execute = [] 
    comparison_table_str = ""

    if old_run_data:
        print("\n--- Comparison of Holdings (Old vs. New) ---")
        old_holdings = {h['Ticker']: float(h.get('Shares', 0)) for h in old_run_data if h['Ticker'] != 'Cash'}
        new_holdings = {h['ticker']: float(h.get('shares', 0)) for h in new_run_data}
        all_tickers = sorted(list(set(old_holdings.keys()) | set(new_holdings.keys())))
        
        comparison_table = []
        for ticker in all_tickers:
            old_s = old_holdings.get(ticker, 0)
            new_s = new_holdings.get(ticker, 0)
            change = new_s - old_s
            
            status = ""
            if old_s == 0 and new_s > 0: status = "New"
            elif new_s == 0 and old_s > 0: status = "Removed"
            elif not np.isclose(change, 0): status = "Modified"
                
            if status:
                comparison_table.append([ticker, f"{old_s:.2f}", f"{new_s:.2f}", f"{change:+.2f}", status])
                if change > 0:
                    trades_to_execute.append({'ticker': ticker, 'side': 'buy', 'quantity': abs(change)})
                elif change < 0:
                    trades_to_execute.append({'ticker': ticker, 'side': 'sell', 'quantity': abs(change)})
        
        if comparison_table:
            comparison_table_str = tabulate(comparison_table, headers=["Ticker", "Old Shares", "New Shares", "Change", "Status"], tablefmt="pretty")
            print(comparison_table_str)
        else:
            print("No changes in holdings between the last run and the new recommendation.")
            
        generate_allocation_comparison_chart(old_run_data, new_run_data, portfolio_code)

    # --- 7. Email Notification ---
    print("\n--- 📧 Trade Recommendation Email ---")
    email_choice = input("Would you like to receive an email with these trade recommendations? (yes/no): ").lower().strip()
    if email_choice == 'yes':
        email_subject = f"Tracking Update: {portfolio_code} Trade Recommendations"
        email_body = (f"Tracking Analysis for Portfolio: {portfolio_code}\n"
                      f"Total Value Used: ${new_total_value:,.2f}\n\n"
                      f"--- Recommended Trades ---\n"
                      f"{comparison_table_str if comparison_table_str else 'No trades recommended.'}\n\n"
                      f"End of Report.")
        await send_notification(email_subject, email_body)

    # --- 8. Execution & Saving Logic ---
    executed = False
    if trades_to_execute:
        print(f"\n🚀 Detected {len(trades_to_execute)} potential rebalancing trades.")
        exec_input = input(">>> Execute these trades on Robinhood? (yes/no): ").lower().strip()
        
        if exec_input == 'yes':
            # Run execution
            await asyncio.to_thread(execute_portfolio_rebalance, trades_to_execute)
            
            # AUTOMATIC SAVE on execution
            print("\n💾 Trades executed. Automatically overwriting last saved run data...")
            await _save_custom_portfolio_run_to_csv(
                portfolio_code=portfolio_code,
                tailored_stock_holdings=new_run_data,
                final_cash=new_cash,
                total_portfolio_value_for_percent_calc=new_total_value
            )
            print(f"✔ Run saved successfully.")
            executed = True
        else:
            print("Trade execution skipped.")

    # If we didn't execute (and thus didn't auto-save), ask to save manually
    if not executed:
        overwrite_input = input("\nOverwrite last saved run with these new results? (yes/no): ").lower().strip()
        if overwrite_input == 'yes':
            await _save_custom_portfolio_run_to_csv(
                portfolio_code=portfolio_code,
                tailored_stock_holdings=new_run_data,
                final_cash=new_cash,
                total_portfolio_value_for_percent_calc=new_total_value
            )
            print(f"✔ New run for portfolio '{portfolio_code}' has been saved.")
        else:
            print("Last saved run was not changed.")
        
    print("\n/tracking analysis complete.")
# <<< END: REPLACEMENT FOR handle_tracking_command >>>
