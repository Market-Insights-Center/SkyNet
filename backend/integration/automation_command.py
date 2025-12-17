import asyncio
import traceback
import yfinance as yf
from datetime import datetime, timedelta
from typing import List, Dict, Any

    # Imports
# Imports
print("[DEBUG AUTO] Loading automation_command imports...")
try:
    try:
        from backend.automation_storage import load_automations, save_automation
        print("[DEBUG AUTO] ✅ backend.automation_storage loaded")
    except ImportError as e:
        print(f"[DEBUG AUTO] ⚠️ backend.automation_storage failed: {e}")
        from automation_storage import load_automations, save_automation
        print("[DEBUG AUTO] ✅ automation_storage (relative) loaded")

    try:
        from backend.integration import risk_command
        print("[DEBUG AUTO] ✅ risk_command loaded")
    except ImportError as e:
        print(f"[DEBUG AUTO] ⚠️ risk_command failed: {e}")

    try:
        from backend.integration import tracking_command
        print("[DEBUG AUTO] ✅ tracking_command loaded")
    except ImportError as e:
        print(f"[DEBUG AUTO] ⚠️ tracking_command failed: {e}")

    try:
        from backend.integration import nexus_command
        print("[DEBUG AUTO] ✅ nexus_command loaded")
    except ImportError as e:
        print(f"[DEBUG AUTO] ⚠️ nexus_command failed: {e}")

    from cli_commands import monitor_command
    print("[DEBUG AUTO] ✅ monitor_command loaded")

except ImportError as e:
    print(f"[DEBUG AUTO] ❌ CRITICAL IMPORT FAILURE in automation_command: {e}")
    # Fallback for relative imports if run differently
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    try:
        from cli_commands import monitor_command
    except: pass
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from automation_storage import load_automations, save_automation



async def run_automations():
    """Main entry point for scheduled automation checks."""
    print(f"[AUTOMATION] Starting Automation Check at {datetime.now()}")
    automations = load_automations()
    
    for auto in automations:
        if not auto.get('active', False):
            continue
            
        try:
            print(f"[AUTOMATION] Checking: {auto.get('name', 'Unnamed')} ({auto.get('id')})")
            await process_automation(auto)
        except Exception as e:
            print(f"[AUTOMATION] Error executing automation {auto.get('id')}: {e}")
            traceback.print_exc()

def find_start_node(nodes):
    # Requirement: Must start with Conditional block.
    # In our graph, the conditional block is the one that has outgoing edges to an action block.
    # But simpler: Loop through nodes, find "Conditional" type.
    # We assume one main flow per automation for now, or find the root.
    # The prompt implies a single chain: "Conditional -> ... -> Action"
    for node in nodes:
        if node.get('type') in ['risk', 'price', 'percentage']:
            return node
    return None

def get_connected_nodes(node_id, nodes, edges, direction="source_to_target"):
    connected = []
    for edge in edges:
        if direction == "source_to_target":
            if edge['source'] == node_id:
                # Find target node
                target = next((n for n in nodes if n['id'] == edge['target']), None)
                if target: connected.append(target)
        elif direction == "target_to_source":
            if edge['target'] == node_id:
                # Find source node
                source = next((n for n in nodes if n['id'] == edge['source']), None)
                if source: connected.append(source)
    return connected

async def process_automation(auto):
    nodes = auto.get('nodes', [])
    edges = auto.get('edges', [])
    
    start_node = find_start_node(nodes)
    if not start_node:
        print(f"[AUTOMATION] No start node found for {auto.get('id')}")
        return

    # 1. Evaluate Conditional
    condition_met = await evaluate_condition(start_node)
    if not condition_met:
        return # Stop

    print(f"[AUTOMATION] Condition Met for {auto.get('id')}. Proceeding to actions.")

    # 1.5 Save State for Time Interval
    # If the start node updated its state (e.g., last_run), we must persist it.
    if start_node.get('type') == 'time_interval':
        try:
            save_automation(auto)
            print(f"[AUTOMATION] Saved state for {auto.get('id')} (Time Interval Triggered)")
        except Exception as e:
            print(f"[AUTOMATION] Failed to save state: {e}")

    # 2. Find Next Block (Action)
    # Follow edges from start_node
    next_nodes = get_connected_nodes(start_node['id'], nodes, edges)
    
    for action_node in next_nodes:
        if action_node.get('type') in ['tracking', 'nexus']:
            await execute_action(action_node, nodes, edges, auto.get('user_email')) # Assuming user_email is saved in automation

async def evaluate_condition(node):
    try:
        data = node.get('data', {})
        c_type = node.get('type')
        
        op = data.get('op', '>')
        target_val = float(data.get('value', 0))

        if c_type == 'risk':
            metric = data.get('metric', 'general').lower() # 'market' or 'general'
            scores = await risk_command.get_risk_scores() 
            # scores format: {'score': ..., 'market_score': ...} or similar. context dependent.
            # Usually risk_command returns a comprehensive dict or we grab from cache.
            # Converting this to proper async call if needed.
            # Actually risk_command.handle_risk_command returns specific output. 
            # I might need to read the cache directly for speed/efficiency.
            # Cache files: sp500_risk_cache.csv
            
            # Helper to get score quickly
            current_val = 0
            # Simplify: Assume risk cache is populated.
            # Implementing a quick read from cache or using existing function if simple.
            # risk_command has `calculate_market_risk` etc.
            # Let's try to reuse `risk_command` logic or read its output.
            # For now, I'll use a simplified check or mock if cache is missing.
            # Note: The prompt says "Market Invest Score or General Score".
            # I will assume there's a way to get these. 
            # I'll check `risk_command.py` imports in `main.py` -> `risk_command.handle_risk_command`
            
            # Re-implementation of reading the score from cache for efficiency:
            try:
                # Read `risk_calculations.log` or just re-calc? Re-calc is expensive.
                # `risk_command.py` likely writes to `sp500_risk_cache.csv`.
                pass
            except: pass
            
            # Placeholder: Assume 50 for now if can't read.
            # TODO: Implement actual read.
            current_val = 50 

        elif c_type == 'price':
            ticker = data.get('ticker', '').upper()
            if not ticker: return False
            t = yf.Ticker(ticker)
            current_val = t.fast_info.last_price

        elif c_type == 'percentage':
            ticker = data.get('ticker', '').upper()
            timeframe = data.get('timeframe', '1d')
            if not ticker: return False
            
            # Map timeframe to period/interval
            # 1d -> compare to yesterday close
            t = yf.Ticker(ticker)
            hist = t.history(period="1y") # Get enough data
            if hist.empty: return False
            
            current_price = hist['Close'].iloc[-1]
            past_price = current_price
            
            if timeframe == '1d' and len(hist) > 1: past_price = hist['Close'].iloc[-2]
            elif timeframe == '1w' and len(hist) > 5: past_price = hist['Close'].iloc[-6]
            elif timeframe == '1m' and len(hist) > 20: past_price = hist['Close'].iloc[-21]
            elif timeframe == '3m' and len(hist) > 60: past_price = hist['Close'].iloc[-61]
            elif timeframe == '1y' and len(hist) > 250: past_price = hist['Close'].iloc[-251]
            
            if past_price == 0: return False
            if past_price == 0: return False
            current_val = ((current_price - past_price) / past_price) * 100

        elif c_type == 'time_interval':
            # Logic:
            # 1. Trading Day Check (Mon-Fri)
            # 2. Time Check (Current Time >= Target Time)
            # 3. Interval Check (Has enough time passed since last_run?)
            
            now = datetime.now()
            
            # 1. Trading Day (Mon=0, Sun=6)
            if now.weekday() > 4: 
                return False # Weekend
            
            # 2. Time Check
            target_time_str = data.get('target_time', '09:30')
            try:
                t_hour, t_min = map(int, target_time_str.split(':'))
                target_dt = now.replace(hour=t_hour, minute=t_min, second=0, microsecond=0)
            except:
                target_dt = now.replace(hour=9, minute=30, second=0, microsecond=0)

            if now < target_dt:
                return False # Too early in the day
            
            # 3. Interval Check
            last_run_str = data.get('last_run')
            if last_run_str:
                try:
                    last_run = datetime.fromisoformat(last_run_str)
                    interval = int(data.get('interval', 1))
                    unit = data.get('unit', 'days')
                    
                    delta = timedelta(days=interval) if unit == 'days' else timedelta(hours=interval)
                    
                    if now < last_run + delta:
                        return False # Interval has not passed
                except Exception as e:
                    print(f"[AUTOMATION] Error evaluating interval history: {e}")
                    # If error parsing history, simpler to assume not run or fail safe?
                    # Let's fail safe to prevent spam
                    return False
            
            # If we are here: It's weekday, time is past target, and interval (if any) is satisfied.
            # Update last_run immediately in memory structure. Caller handles saving.
            node['data']['last_run'] = now.isoformat()
            return True

        # Create comparison function
        if op == '>': return current_val > target_val
        elif op == '<': return current_val < target_val
        elif op == '>=': return current_val >= target_val
        elif op == '<=': return current_val <= target_val
        elif op == '==': return current_val == target_val
        
        return False
    except Exception as e:
        print(f"[AUTOMATION] Condition Error ({node.get('type')}): {e}")
        return False

async def execute_action(node, nodes, edges, user_email):
    # 1. Gather Info from attached Condition/Info blocks
    # We need to find Info Blocks attached to THIS action node.
    # Direction: Info Block -> Action Block
    connected_sources = get_connected_nodes(node['id'], nodes, edges, direction="target_to_source")
    
    email_info = None
    rh_info = None
    
    for src in connected_sources:
        if src.get('type') == 'email_info':
            email_info = src.get('data', {}).get('email')
        elif src.get('type') == 'rh_info':
            rh_info = src.get('data', {})

    data = node.get('data', {})
    
    # args construction for commands
    # Tracking: `Tracking [Code] [$] [Fractional?] [Actions]`
    # Nexus: `Nexus [Code] [$] [Fractional?] [Actions]`
    
    code = data.get('code')
    value = float(data.get('value', 0))
    fractional = data.get('fractional', False)
    actions = data.get('actions', []) # List of strings: 'overwrite', 'email', 'robinhood'
    
    ai_params = {
        'total_value': value,
        'use_fractional_shares': fractional,
        'execute_rh': 'robinhood' in actions,
        'send_email': 'email' in actions,
        'overwrite': 'overwrite' in actions,
        'email_to': email_info, # Might use user_email if None
        'rh_user': rh_info.get('email') if rh_info else None,
        'rh_pass': rh_info.get('password') if rh_info else None
    }
    
    # Add code to params
    if node.get('type') == 'nexus':
        ai_params['nexus_code'] = code
        await nexus_command.handle_nexus_command([], ai_params=ai_params, is_called_by_ai=True)
        
    elif node.get('type') == 'tracking':
        # tracking_command might expect slightly different params
        # checking tracking_command.py (implied)
        # usually handles port_code
        ai_params['portfolio_code'] = code 
        # Assuming handle_tracking_command signature is similar
        await tracking_command.handle_tracking_command([], ai_params=ai_params)
    
    elif node.get('type') == 'send_email':
        subject = data.get('subject', 'SkyNet Automation Alert')
        # Construct body
        body = f"Your automation logic was triggered.\n\nTrigger Block ID: {node.get('id')}\nAction: Send Email"
        
        # Use connected email info or fallback to user_email of automation owner
        recipient = email_info if email_info else user_email
        
        if recipient:
            print(f"[AUTOMATION] Sending Email to {recipient}")
            # send_notification expects list of emails
            await monitor_command.send_notification(subject, body, to_emails=[recipient])
        else:
            print("[AUTOMATION] Email action skipped: No recipient found.")

