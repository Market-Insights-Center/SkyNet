# tracking_command.py

import asyncio
import os
import csv
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
import math
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import configparser

from integration.custom_command import (
    _get_custom_portfolio_run_csv_filepath, 
    _save_custom_portfolio_run_to_csv, 
    TRACKING_ORIGIN_FILE, 
    PORTFOLIO_DB_FILE,
    save_portfolio_to_csv
)
from integration.invest_command import process_custom_portfolio, calculate_ema_invest
from integration.execution_command import execute_portfolio_rebalance, get_robinhood_equity

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_FILE = os.path.join(BASE_DIR, 'config.ini')

async def _load_portfolio_run(portfolio_code: str, user_id: str = None) -> List[Dict[str, Any]]:
    # STRICT OWNERSHIP: Only load file specific to this user
    filepath = _get_custom_portfolio_run_csv_filepath(portfolio_code, user_id)
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        # Filter out comment lines
        data_lines = [line for line in lines if not line.startswith('#')]
        if not data_lines: return []
        
        reader = csv.DictReader(data_lines)
        return list(reader)
    except Exception:
        return []

async def _load_portfolio_origin_data(portfolio_code: str, user_id: str = None) -> Dict[str, Dict[str, float]]:
    origin_data = {}
    if not os.path.exists(TRACKING_ORIGIN_FILE):
        return origin_data
    try:
        with open(TRACKING_ORIGIN_FILE, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # STRICT OWNERSHIP: Match PortfolioCode AND UserId exactly
                row_user = row.get('UserId', '').strip()
                target_user = user_id.strip() if user_id else ''
                
                if row.get('PortfolioCode') == portfolio_code and row_user == target_user:
                    try:
                        origin_data[row['Ticker']] = {
                            'shares': float(row['Shares']),
                            'price': float(row['Price'])
                        }
                    except (ValueError, TypeError):
                        continue
    except Exception:
        pass
    return origin_data

async def generate_performance_data(portfolio_code: str, current_holdings: Dict[str, float], user_id: str = None) -> Dict[str, Any]:
    origin_data = await _load_portfolio_origin_data(portfolio_code, user_id)
    
    all_tickers = list(set(origin_data.keys()) | set(current_holdings.keys()))
    
    # Fetch live prices
    tasks = [calculate_ema_invest(ticker, 2, is_called_by_ai=True) for ticker in all_tickers]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    live_prices = {}
    for ticker, res in zip(all_tickers, results):
        if res and not isinstance(res, Exception) and res[0] is not None:
            live_prices[ticker] = res[0]

    table_rows = []
    total_pnl = 0.0
    total_origin_value = 0.0
    total_current_value = 0.0

    for ticker in all_tickers:
        origin = origin_data.get(ticker)
        current_shares = current_holdings.get(ticker, 0.0)
        live_price = live_prices.get(ticker, 0.0)
        
        if origin:
            origin_price = origin['price']
            # PnL calculated on CURRENT holdings against ORIGIN price
            cost_basis = current_shares * origin_price
            current_val = current_shares * live_price
            pnl = current_val - cost_basis
            
            table_rows.append({
                "ticker": ticker,
                "origin_price": origin_price,
                "live_price": live_price,
                "origin_shares": origin['shares'],
                "current_shares": current_shares,
                "pnl": pnl,
                "pnl_percent": ((live_price - origin_price) / origin_price * 100) if origin_price > 0 else 0
            })
            total_pnl += pnl
            total_origin_value += cost_basis
            total_current_value += current_val

    return {
        "status": "success",
        "rows": table_rows,
        "live_prices": live_prices, 
        "total_pnl": total_pnl,
        "total_pnl_percent": (total_pnl / total_origin_value * 100) if total_origin_value > 0 else 0,
        "total_current_value": total_current_value
    }

async def _send_tracking_email_html(recipient_email: str, subject: str, portfolio_code: str, total_value: float, trade_recs: List[Dict], new_run_data: List[Dict], new_cash: float):
    # (Email logic remains unchanged)
    try:
        config = configparser.ConfigParser()
        config.read(CONFIG_FILE)
        smtp_server = config.get('EMAIL_CONFIG', 'SMTP_SERVER', fallback=None)
        smtp_port = config.getint('EMAIL_CONFIG', 'SMTP_PORT', fallback=587)
        sender_email = config.get('EMAIL_CONFIG', 'SENDER_EMAIL', fallback=None)
        sender_password = config.get('EMAIL_CONFIG', 'SENDER_PASSWORD', fallback=None)

        if not all([smtp_server, smtp_port, sender_email, sender_password, recipient_email]):
            print("⚠️ Email config incomplete. Skipping email.")
            return False

        info_blocks_html = ""
        if trade_recs:
            info_blocks_html += "<h2>Trade Recommendations</h2><pre style='font-family: monospace; background-color: #2c2f33; color: #DAA520; padding: 10px; border-radius: 5px;'>"
            for rec in trade_recs:
                info_blocks_html += f"Action: {rec.get('side', '').upper()}\nTicker: {rec.get('ticker', '')}\nAmount: {float(rec.get('quantity', 0)):.4f} Shares\n---------------------------------------------\n"
            info_blocks_html += "</pre>"
        else:
            info_blocks_html = "<h2>No Trade Changes Recommended</h2>"

        full_table_html = "<h2>Recommended Allocation</h2><table border='1' cellpadding='5' style='border-collapse: collapse; width: 100%; color: #f0f0f0; background-color: #333;'><tr style='background-color: #9400D3; color: white;'><th>Ticker</th><th>Shares</th><th>Value</th><th>%</th></tr>"
        sorted_run = sorted(new_run_data, key=lambda x: x.get('ticker', ''))
        for item in sorted_run:
            if item.get('ticker') == 'Cash': continue
            val = float(item.get('actual_money_allocation', 0))
            pct = (val / total_value * 100) if total_value > 0 else 0
            full_table_html += f"<tr><td>{item.get('ticker')}</td><td>{float(item.get('shares', 0)):.2f}</td><td>${val:,.2f}</td><td>{pct:.2f}%</td></tr>"
        cash_pct = (new_cash / total_value * 100) if total_value > 0 else 0
        full_table_html += f"<tr style='font-weight:bold;'><td>CASH</td><td>-</td><td>${new_cash:,.2f}</td><td>{cash_pct:.2f}%</td></tr></table>"

        email_body = f"<html><body style='font-family: Arial, sans-serif; background-color: #1e1f22; color: #f0f0f0; padding: 20px;'><div style='background-color: #2c2f33; padding: 30px; border-radius: 8px;'><h1 style='color: #9400D3;'>Tracking Update: {portfolio_code}</h1><p>Total Portfolio Value: <strong>${total_value:,.2f}</strong></p>{info_blocks_html}<br>{full_table_html}</div></body></html>"

        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = recipient_email
        msg['Subject'] = subject
        msg.attach(MIMEText(email_body, 'html'))

        def _send():
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(sender_email, sender_password)
                server.send_message(msg)
        await asyncio.to_thread(_send)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

async def handle_tracking_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
    if not ai_params: return "Error: AI Params required."
    action = ai_params.get("action", "run_analysis")
    portfolio_code = ai_params.get("portfolio_code")
    user_id = ai_params.get("user_id")
    
    if not portfolio_code: return {"status": "error", "message": "Portfolio code is required."}

    if action == "run_analysis":
        portfolio_config = None
        if os.path.exists(PORTFOLIO_DB_FILE):
            try:
                with open(PORTFOLIO_DB_FILE, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        # STRICT OWNERSHIP CHECK
                        row_code = row.get('portfolio_code', '').lower().strip()
                        row_user = row.get('user_id', '').strip()
                        target_user = user_id.strip() if user_id else ''
                        
                        if row_code == portfolio_code.lower() and row_user == target_user:
                            portfolio_config = row
                            break
            except Exception: pass
        
        if not portfolio_config:
            sub_portfolios = ai_params.get("sub_portfolios")
            if sub_portfolios:
                # Create new config tied to USER ID
                new_config = {
                    'portfolio_code': portfolio_code,
                    'ema_sensitivity': str(ai_params.get('ema_sensitivity', 2)),
                    'amplification': str(ai_params.get('amplification', 1.0)),
                    'num_portfolios': str(len(sub_portfolios)),
                    'frac_shares': 'true' if ai_params.get('use_fractional_shares') else 'false',
                    'risk_tolerance': '10', 'risk_type': 'stock', 'remove_amplification_cap': 'true',
                    'user_id': user_id # Enforce ownership
                }
                for i, sp in enumerate(sub_portfolios, 1):
                    tickers = sp.get('tickers', [])
                    if isinstance(tickers, list): tickers = ",".join(tickers)
                    new_config[f'tickers_{i}'] = tickers.upper()
                    new_config[f'weight_{i}'] = str(sp.get('weight', 0))
                
                await save_portfolio_to_csv(PORTFOLIO_DB_FILE, new_config, is_called_by_ai=True)
                portfolio_config = new_config
            else:
                return {"status": "not_found", "message": f"Portfolio '{portfolio_code}' not found."}

        # LOAD OLD DATA (For "Since Last Save")
        # This loads the state of the CSV *before* we overwrite it later
        old_run_data = await _load_portfolio_run(portfolio_code, user_id)
        
        total_value = float(ai_params.get("total_value", 10000))
        use_frac = ai_params.get("use_fractional_shares", False)
        
        # Run New Analysis
        _, _, final_cash, new_run_data = await process_custom_portfolio(
            portfolio_data_config=portfolio_config,
            tailor_portfolio_requested=True,
            frac_shares_singularity=use_frac,
            total_value_singularity=total_value,
            is_custom_command_simplified_output=True,
            is_called_by_ai=True
        )

        trades = []
        old_holdings_map = {}
        old_prices_at_save = {}

        # Parse old run data safely
        if old_run_data:
            for row in old_run_data:
                ticker = row.get('Ticker')
                if ticker and ticker != 'Cash':
                    try:
                        shares = float(row.get('Shares', 0))
                        # Correctly get price from previous save file to compare against current
                        price = float(row.get('LivePriceAtEval', 0))
                        
                        old_holdings_map[ticker] = shares
                        old_prices_at_save[ticker] = price
                    except (ValueError, TypeError):
                        continue

        new_holdings_map = {row['ticker']: float(row['shares']) for row in new_run_data}
        all_tickers = sorted(list(set(old_holdings_map.keys()) | set(new_holdings_map.keys())))
        
        comparison_table = []
        for ticker in all_tickers:
            old_s = old_holdings_map.get(ticker, 0.0)
            new_s = new_holdings_map.get(ticker, 0.0)
            diff = new_s - old_s
            
            if not math.isclose(diff, 0, abs_tol=0.001):
                status = "Buy" if diff > 0 else "Sell"
                comparison_table.append({
                    "ticker": ticker, "old_shares": old_s, "new_shares": new_s,
                    "diff": diff, "action": status
                })
                trades.append({"ticker": ticker, "side": status.lower(), "quantity": abs(diff)})

        # Fetch live prices for performance calculation
        perf_data = await generate_performance_data(portfolio_code, old_holdings_map, user_id)
        live_prices = perf_data.get("live_prices", {})
        
        # Build "Since Last Save" Table
        since_last_save_table = []
        
        # We iterate over what was in the save file
        for ticker, old_price in old_prices_at_save.items():
            current_price = live_prices.get(ticker, 0.0)
            # For PnL "Since Last Save", we use the shares we held *at that time* (or arguably current, but let's use current holding of that ticker to show gain/loss on current position)
            # A pure "Since Last Save" usually implies: (Current Price - Last Save Price) * Current Shares
            shares_held = new_holdings_map.get(ticker, 0.0)
            
            if current_price > 0 and shares_held > 0:
                price_diff = current_price - old_price
                pnl = price_diff * shares_held
                pct = (price_diff / old_price * 100) if old_price > 0 else 0
                
                since_last_save_table.append({
                    "ticker": ticker,
                    "shares": shares_held,
                    "last_save_price": old_price,
                    "current_price": current_price,
                    "pnl": pnl,
                    "pnl_percent": pct
                })

        return {
            "status": "success",
            "summary": [
                {"label": "Target Value", "value": f"${total_value:,.2f}", "change": "Input"},
                {"label": "Est. Cash", "value": f"${final_cash:,.2f}", "change": "Allocated"},
                {"label": "All-Time P&L", "value": f"${perf_data.get('total_pnl', 0):,.2f}", "change": f"{perf_data.get('total_pnl_percent', 0):.2f}%"}
            ],
            "table": new_run_data,
            "comparison": comparison_table,
            "performance": perf_data.get("rows", []),
            "since_last_save": since_last_save_table,
            "raw_result": {"final_cash": final_cash, "trades": trades, "portfolio_code": portfolio_code}
        }

    elif action == "execute_trades":
        trades = ai_params.get("trades", [])
        rh_username = ai_params.get("rh_username")
        rh_password = ai_params.get("rh_password")
        email_to = ai_params.get("email_to")
        overwrite = ai_params.get("overwrite", False)
        new_run_data = ai_params.get("new_run_data", [])
        final_cash = ai_params.get("final_cash", 0.0)
        total_value = ai_params.get("total_value", 0.0)

        execution_log = []

        if rh_username and rh_password and trades:
            success = await asyncio.to_thread(execute_portfolio_rebalance, trades, rh_username, rh_password)
            execution_log.append("Trades executed on Robinhood." if success else "Robinhood execution failed.")

        if email_to:
            subject = f"Tracking Update: {portfolio_code}"
            await _send_tracking_email_html(email_to, subject, portfolio_code, total_value, trades, new_run_data, final_cash)
            execution_log.append(f"HTML Email sent to {email_to}.")

        if overwrite and new_run_data:
            await _save_custom_portfolio_run_to_csv(
                portfolio_code=portfolio_code,
                tailored_stock_holdings=new_run_data,
                final_cash=final_cash,
                total_portfolio_value_for_percent_calc=total_value,
                is_called_by_ai=True,
                user_id=user_id
            )
            execution_log.append("Save file overwritten.")

        return {"status": "success", "message": "Execution complete.", "log": execution_log}

    return {"status": "error", "message": "Unknown action."}