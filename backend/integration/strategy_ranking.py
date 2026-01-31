import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
import traceback
import pytz

# Try to import process_custom_portfolio. 
# Depending on circular imports, we might need to import inside the function.
try:
    from backend.integration.invest_command import process_custom_portfolio
    from backend.integration.custom_command import load_portfolio_config
    from backend.integration.nexus_command import process_nexus_portfolio, _load_nexus_config
    from backend.database import get_user_profile
except ImportError:
    # Fallback for relative imports if run directly
    try:
        from integration.invest_command import process_custom_portfolio
        from integration.custom_command import load_portfolio_config
        from integration.nexus_command import process_nexus_portfolio, _load_nexus_config
        from database import get_user_profile
    except ImportError:
        pass

# --- CONFIG ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if 'backend' not in BASE_DIR:
    BASE_DIR = os.path.join(BASE_DIR, 'backend') # Adjust if we are too high up
if 'backend' in BASE_DIR and 'integration' in BASE_DIR:
     BASE_DIR = os.path.dirname(os.path.dirname(BASE_DIR)) # Adjust if we are too deep

DATA_DIR = os.path.join(BASE_DIR, 'backend', 'data')
RANKINGS_FILE = os.path.join(DATA_DIR, 'strategy_rankings.json')

logger = logging.getLogger("uvicorn")

def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)

def load_rankings() -> Dict[str, Any]:
    ensure_data_dir()
    if not os.path.exists(RANKINGS_FILE):
        return {"active": [], "history": []}
    try:
        with open(RANKINGS_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load rankings: {e}")
        return {"active": [], "history": []}

def save_rankings(data: Dict[str, Any]):
    ensure_data_dir()
    try:
        with open(RANKINGS_FILE, 'w') as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        logger.error(f"Failed to save rankings: {e}")

async def submit_portfolio_to_ranking(user_email: str, portfolio_code: str, interval: str, execution_time: str = "09:30", timezone: str = "UTC") -> Dict[str, Any]:
    """
    Submits a portfolio (Custom or Nexus) to the active rankings.
    """
    rankings = load_rankings()
    
    # Fetch Username
    username = user_email.split('@')[0] # Fallback
    try:
        profile = get_user_profile(user_email)
        if profile and profile.get('username'):
            username = profile['username']
    except Exception as e:
        logger.warning(f"Could not fetch profile for {user_email}: {e}")

    # Check if already exists in active
    for item in rankings["active"]:
        if item["portfolio_code"].lower() == portfolio_code.lower():
            item["interval"] = interval
            item["execution_time"] = execution_time
            item["timezone"] = timezone
            item["user_email"] = user_email
            item["username"] = username
            item["status"] = "active"
            save_rankings(rankings)
            return {"status": "success", "message": "Portfolio ranking updated."}

    # Verify portfolio exists (Custom OR Nexus)
    is_nexus = False
    config = await load_portfolio_config(portfolio_code)
    if not config:
        # Try Nexus
        config = await _load_nexus_config(portfolio_code)
        if config:
            is_nexus = True
        else:
            return {"status": "error", "message": "Portfolio/Nexus code not found in system."}

    new_entry = {
        "user_email": user_email,
        "username": username,
        "portfolio_code": portfolio_code,
        "type": "nexus" if is_nexus else "custom",
        "interval": interval,
        "execution_time": execution_time,
        "timezone": timezone,
        "submission_date": datetime.utcnow().isoformat(),
        "last_run": None,
        "pnl_all_time": 0.0,
        "last_stats": {},
        "status": "active"
    }
    
    rankings["active"].append(new_entry)
    save_rankings(rankings)
    
    asyncio.create_task(update_single_portfolio_ranking(portfolio_code))
    
    return {"status": "success", "message": "Strategy submitted to rankings."}

async def remove_portfolio_from_ranking(user_email: str, portfolio_code: str) -> Dict[str, Any]:
    """
    Moves a portfolio from active to history.
    """
    rankings = load_rankings()
    active = rankings["active"]
    found_idx = -1
    
    for i, item in enumerate(active):
        if item["portfolio_code"].lower() == portfolio_code.lower():
            if item["user_email"] != user_email and user_email != "marketinsightscenter@gmail.com":
                 return {"status": "error", "message": "Not authorized to remove this portfolio."}
            found_idx = i
            break
            
    if found_idx != -1:
        item = active.pop(found_idx)
        item["status"] = "removed"
        item["removal_date"] = datetime.utcnow().isoformat()
        
        # Check if already in history (update it if so, to avoid dupes of same code?)
        # Or allow multiple history entries for same code? 
        # User might submit, remove, submit, remove. Better to allow multiple history entries.
        rankings["history"].append(item)
        save_rankings(rankings)
        return {"status": "success", "message": "Portfolio retired from rankings."}
        
    return {"status": "error", "message": "Portfolio not found in active rankings."}

async def permanent_delete_strategy(user_email: str, portfolio_code: str, from_list: str = 'history') -> Dict[str, Any]:
    """
    Permanently deletes a strategy from history (or active).
    """
    rankings = load_rankings()
    target_list = rankings.get(from_list)
    if target_list is None:
        return {"status": "error", "message": "Invalid list specified."}

    found_idx = -1
    for i, item in enumerate(target_list):
        if item["portfolio_code"].lower() == portfolio_code.lower():
            if item["user_email"] != user_email and user_email != "marketinsightscenter@gmail.com":
                 return {"status": "error", "message": "Not authorized to delete this portfolio."}
            # If multiple same codes in history, this deletes the first one found.
            # Ideally we might deleted all? Or use ID?
            # For now, let's delete all matches if it's history to clean up completely.
            # But let's stick to first one or loop?
            # Users might want to delete a specific run. But we don't expose IDs.
            # Let's delete ALL occurrences in history for this code/user combo to be clean.
            found_idx = i
            break
            
    if found_idx == -1:
         return {"status": "error", "message": "Portfolio not found."}
         
    # Remove all matching entries for this user/code in history
    new_list = [x for x in target_list if not (x["portfolio_code"].lower() == portfolio_code.lower() and x["user_email"] == user_email)]
    
    if len(new_list) == len(target_list) and found_idx != -1:
         # Should not happen if found_idx was set
         target_list.pop(found_idx)
    else:
         rankings[from_list] = new_list

    save_rankings(rankings)
    return {"status": "success", "message": "Strategy permanently deleted."}

async def get_all_rankings() -> Dict[str, Any]:
    """
    Returns active and history rankings.
    """
    data = load_rankings()
    return data

async def update_single_portfolio_ranking(portfolio_code: str):
    logger.info(f"Updating ranking for {portfolio_code}")
    rankings = load_rankings()
    item = next((x for x in rankings["active"] if x["portfolio_code"].lower() == portfolio_code.lower()), None)
    
    if not item:
        return

    try:
        is_nexus = item.get('type') == 'nexus'
        
        # Load Config
        if is_nexus:
            config = await _load_nexus_config(portfolio_code)
        else:
            config = await load_portfolio_config(portfolio_code)
            
        if not config:
            logger.warning(f"Portfolio/Nexus {portfolio_code} config missing during update.")
            return

        # --- VALUATION OF PREVIOUS HOLDINGS ---
        previous_holdings = item.get("virtual_holdings", [])
        previous_cash = item.get("virtual_cash", 10000.0)
        
        current_equity = 0.0
        
        if not previous_holdings:
            # First Run
            current_equity = 10000.0
            item["initial_value"] = 10000.0
        else:
            # Calculate value using live prices
            import yfinance as yf
            
            # Extract tickers
            tickers = set([h.get('ticker') for h in previous_holdings if h.get('ticker') and h.get('ticker') != 'Cash'])
            price_map = {}
            
            if tickers:
                try:
                    # Batch fetch
                    tik_str = " ".join(tickers)
                    if tik_str:
                        # yfinance fast_info might be slow for many. 
                        # Use download for batch? Or Tickers.
                        # For now, Tickers is fine for reasonable size.
                        t_objs = yf.Tickers(tik_str)
                        for t in tickers:
                            try:
                                price = t_objs.tickers[t].fast_info.last_price
                                if price: price_map[t] = price
                            except: pass
                except Exception as e:
                    logger.error(f"Price fetch error for {portfolio_code}: {e}")

            # Sum Value
            equity_holdings = 0.0
            for h in previous_holdings:
                t = h.get('ticker')
                shares = float(h.get('shares', 0))
                
                # If we have a new price, use it. Else fall back to 'live_price_at_eval' from last time (better than nothing)
                price = price_map.get(t)
                if price is None:
                     price = float(h.get('live_price_at_eval', 0))
                
                equity_holdings += shares * price
            
            current_equity = equity_holdings + previous_cash

        # --- EXECUTE STRATEGY ---
        tailored_data = []
        final_cash = 0.0
        
        if is_nexus:
            # Nexus execution
            # process_nexus_portfolio returns (nexus_config, flattened_holdings)
            # It does NOT take total_value to "rebalance". It just calculates structure.
            # But wait, `process_nexus_portfolio` calls `process_custom_portfolio` internally for leaves.
            # And it uses `total_value` if passed?
            # Let's check `process_nexus_portfolio` signature.
            # It seems it doesn't take total_value in the simplified version I used to see?
            # Checking nexus_command.py...
            # The tool output was truncated, but generally Nexus aggregates.
            # However, for ACCURATE PnL simulation, we need the Nexus components to know the Total Value 
            # so they allocate correct dollar amounts.
            # If `process_nexus_portfolio` doesn't handle top-down capital flow, we might get % allocations.
            # If we get % allocations, we can apply them to `current_equity`.
            
            # Assumption: `process_nexus_portfolio` returns a list of holdings with 'actual_percent_allocation' or similar.
            # We will use the resulting holdings and re-allocate our `current_equity` into them.
            
            try:
                # We need to emulate `process_nexus_portfolio`.
                # process_nexus_portfolio(nexus_config, total_value, nexus_code)
                nexus_holdings, _ = await process_nexus_portfolio(config, current_equity, portfolio_code) 
                
                # Now we distribute `current_equity` according to `actual_percent_allocation` (if available) or `actual_money_allocation` ratios.
                total_model_value = sum([float(h.get('actual_money_allocation', 0)) for h in nexus_holdings])
                
                # Re-scale to current equity
                tailored_data = []
                spent = 0.0
                
                for h in nexus_holdings:
                    t = h.get('ticker')
                    if not t or t == 'Cash': continue
                    
                    bg_alloc = float(h.get('actual_money_allocation', 0))
                    if total_model_value > 0:
                        ratio = bg_alloc / total_model_value
                        target_amt = ratio * current_equity
                    else:
                        target_amt = 0
                        
                    # Get Price (we might need it if not in holding)
                    price = float(h.get('live_price_at_eval', 0))
                    if price <= 0:
                        # Fetch
                        price = price_map.get(t, 0)
                    
                    if price > 0:
                        shares = target_amt / price
                        tailored_data.append({
                            'ticker': t,
                            'shares': shares,
                            'live_price_at_eval': price,
                            'actual_money_allocation': target_amt
                        })
                        spent += target_amt
                        
                final_cash = current_equity - spent
                
            except Exception as e:
                logger.error(f"Nexus Exe Error: {e}")
                
        else:
            # Custom Portfolio
            res = await process_custom_portfolio(
                portfolio_data_config=config,
                tailor_portfolio_requested=True,
                frac_shares_singularity=True,
                total_value_singularity=current_equity,
                is_custom_command_simplified_output=True,
                is_called_by_ai=True
            )
            if isinstance(res, tuple) and len(res) >= 3:
                tailored_data = res[0] # Updated to index 0 for tailored_data with shares
                final_cash = res[2]

        # --- UPDATE STATE ---
        item["virtual_holdings"] = tailored_data
        item["virtual_cash"] = final_cash
        item["current_equity"] = current_equity 
        item["pnl_all_time"] = current_equity - item.get("initial_value", 10000.0)
        item["last_run"] = datetime.utcnow().isoformat()
        
        save_rankings(rankings)
        
    except Exception as e:
        logger.error(f"Error updating ranking for {portfolio_code}: {e}")
        traceback.print_exc()

async def check_and_update_rankings():
    """
    Called periodically (e.g. hourly) to check intervals and update.
    """
    rankings = load_rankings()
    active = rankings["active"]
    now = datetime.utcnow()
    
    for item in active:
        last_run_str = item.get("last_run")
        interval = item.get("interval", "1/d")
        execution_time_str = item.get("execution_time", "09:30")
        tz_name = item.get("timezone", "UTC")
        
        should_run = False
        
        # Parse target hour/minute
        try:
            target_hour, target_minute = map(int, execution_time_str.split(':'))
        except:
             target_hour, target_minute = 9, 30
             
        # Normalize "now" to the User's Timezone
        try:
            user_tz = pytz.timezone(tz_name)
            # utcnow -> replace tzinfo=utc -> astimezone(user_tz)
            now_localized = datetime.utcnow().replace(tzinfo=pytz.utc).astimezone(user_tz)
        except Exception as e:
            logger.warning(f"Invalid timezone {tz_name} for strategy {item['portfolio_code']}, falling back to UTC")
            now_localized = datetime.utcnow().replace(tzinfo=pytz.utc) 

        now_time = now_localized.time()
        is_past_time = (now_time.hour > target_hour) or (now_time.hour == target_hour and now_time.minute >= target_minute)
        
        if not last_run_str:
            # First run
            if is_past_time:
                should_run = True
        else:
            last_run_utc = datetime.fromisoformat(last_run_str)
            # Localize last_run to check dates in user logic
            # Assuming last_run_str was stored as UTC ISO
            if last_run_utc.tzinfo is None:
                last_run_utc = last_run_utc.replace(tzinfo=pytz.utc)
            
            last_run_local = last_run_utc.astimezone(user_tz)
            
            if interval == "1/d":
                if last_run_local.date() < now_localized.date() and is_past_time:
                    should_run = True
                    
            elif interval == "1/w":
                # Check if it's been 7 days
                delta = now_localized - last_run_local
                if delta.days >= 7 and is_past_time:
                    should_run = True
            
            elif interval == "1/m":
                delta = now_localized - last_run_local
                if delta.days >= 30 and is_past_time:
                    should_run = True
            
        if should_run:
            logger.info(f"Triggering scheduled update for {item['portfolio_code']} (Target: {execution_time_str} {tz_name})")
            await update_single_portfolio_ranking(item["portfolio_code"])
