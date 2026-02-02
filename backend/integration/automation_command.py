import asyncio
import traceback
import yfinance as yf
from datetime import datetime, timedelta
import pytz # Ensure installed or handle error
USER_TZ = pytz.timezone('America/Chicago')
from typing import List, Dict, Any
try:
    from backend.usage_counter import increment_usage
except ImportError:
    try: 
        from usage_counter import increment_usage
    except ImportError:
        def increment_usage(*args): pass

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
        try:
             from integration import risk_command
             print("[DEBUG AUTO] ✅ risk_command loaded (relative)")
        except ImportError as e2:
             print(f"[DEBUG AUTO] ⚠️ risk_command failed: {e2}")

    try:
        from backend.integration import sentiment_command
        print("[DEBUG AUTO] ✅ sentiment_command loaded")
    except ImportError as e:
         try:
            from integration import sentiment_command
            print("[DEBUG AUTO] ✅ sentiment_command loaded (relative)")
         except ImportError as e2:
            print(f"[DEBUG AUTO] ⚠️ sentiment_command failed: {e2}")

    try:
        from backend.integration import tracking_command
        print("[DEBUG AUTO] ✅ tracking_command loaded")
    except ImportError as e:
         try:
            from integration import tracking_command
            print("[DEBUG AUTO] ✅ tracking_command loaded (relative)")
         except ImportError as e2:
            print(f"[DEBUG AUTO] ⚠️ tracking_command failed: {e2}")

    try:
        from backend.integration import nexus_command
        print("[DEBUG AUTO] ✅ nexus_command loaded")
    except ImportError as e:
        try:
            from integration import nexus_command
            print("[DEBUG AUTO] ✅ nexus_command loaded (relative)")
        except ImportError as e2:
            print(f"[DEBUG AUTO] ⚠️ nexus_command failed: {e2}")

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

def calculate_next_run(target_time_str, interval=1):
    """Calculates the next scheduled run time string using User Timezone (CST)."""
    try:
        # 1. Get current time in User TZ
        now_utc = datetime.now(pytz.utc)
        now_user = datetime.now(USER_TZ)

        th, tm = map(int, target_time_str.split(':'))
        
        # Create target for "today" in User TZ
        target_today = now_user.replace(hour=th, minute=tm, second=0, microsecond=0)
        
        # Logic: If now_user >= target_today, we missed it?
        # NOTE: This function is called to set the NEXT run.
        # If we are strictly AFTER the target, next run is tomorrow.
        # If we are BEFORE, next run is today.
        
        if target_today <= now_user:
             next_run = target_today + timedelta(days=interval)
        else:
             next_run = target_today
        
        # Skip weekends
        while next_run.weekday() > 4:
            next_run += timedelta(days=1)
            
        return next_run.isoformat()
    except Exception as e:
        print(f"Error calculating next run: {e}")
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
    
    if not nodes: return

    print(f"[AUTOMATION] Processing {auto.get('id')} ({len(nodes)} nodes)...")

    # 1. EVALUATION PHASE
    # Evaluate ALL conditional nodes first to establish state.
    # Conditionals: risk, price, percentage, sentiment_trigger, time_interval
    conditional_types = ['risk', 'price', 'percentage', 'sentiment_trigger', 'time_interval']
    conditionals = [n for n in nodes if n.get('type') in conditional_types]
    
    node_results = {} # { nodeId: bool }

    # --- PRIORITY: TIME CHECK ---
    # Per user requirement: "all automation checks starts by checking the time and if the time is not valid, it skips any other check"
    time_nodes = [n for n in conditionals if n.get('type') == 'time_interval']
    
    if time_nodes:
        time_valid = False
        for node in time_nodes:
            try:
                res = await evaluate_condition(node)
                node_results[node['id']] = res
                if res: 
                    time_valid = True
                    print(f"   -> Node {node['type']} ({node['id']}) = TRUE (Gatekeeper Open)")
                else:
                    print(f"   -> Node {node['type']} ({node['id']}) = FALSE (Gatekeeper Closed)")
            except Exception as e:
                print(f"   -> Node {node['type']} ({node['id']}) Error: {e}")
                node_results[node['id']] = False
        
        if not time_valid:
            print("   [AUTOMATION] Time Gate Closed. Skipping other checks.")
            return # Exit immediately
    
    # Continue with other conditionals if Time is valid (or if no Time nodes exist - though frontend now enforces it)
    other_conditionals = [n for n in conditionals if n.get('type') != 'time_interval']

    for node in other_conditionals:
        try:
            res = await evaluate_condition(node)
            node_results[node['id']] = res
            if res:
                print(f"   -> Node {node['type']} ({node['id']}) = TRUE")
            else:
                 print(f"   -> Node {node['type']} ({node['id']}) = FALSE")
        except Exception as e:
            print(f"   -> Node {node['type']} ({node['id']}) Error: {e}")
            node_results[node['id']] = False

    # 1.5 Save State for Time Interval (if any triggered)
    # Simple check: if any time_interval was True, we likely updated its state in evaluate_condition?
    # Yes, evaluate_condition updates 'last_run' for time_interval.
    # We should save automation if any time_interval triggered.
    # 1.5 Save State for Time Interval (if any triggered)
    # If time_valid is True, it means we are INSIDE the window.
    # We ONLY update 'next_run' here. 'last_run' is updated only if actions execute.
    if time_valid and time_nodes:
        try:
            # Update Next Run
            # Assuming first time node dictates the schedule for now
            t_node = time_nodes[0]
            target_str = t_node.get('data', {}).get('target_time', '09:30')
            auto['next_run'] = calculate_next_run(target_str)
            
            # Note: We do NOT update 'last_run' here anymore.
            
            from backend.automation_storage import save_automation
            save_automation(auto)
            print(f"   [AUTOMATION] valid time window: updated next_run to {auto['next_run']}")
        except Exception as e:
            print(f"   [AUTOMATION] Failed to update next_run: {e}")

    # 2. PROPAGATION PHASE
    # Queue: { targetId, targetHandle, signal, sourceId }
    queue = []
    
    # Track stop reasons for debugging/user feedback
    stop_reason = None

    # Seed queue from Evaluated Conditionals
    for c_node in conditionals:
        res = node_results.get(c_node['id'], False)
        if not res:
            # If a root conditional failed, that's a potential stop reason
            # We overwrite this if later nodes fail, but this is a good start
            stop_reason = f"Condition Failed: {c_node.get('type', 'Unknown').replace('_', ' ').title()}"
        
        # Find outgoing edges even if False? 
        # Logic: If False, we usually don't propagate unless it's to a Logic Gate that handles False?
        # Standard flow: If False, we don't fire generic edges.
        if res:
            out_edges = [e for e in edges if e['source'] == c_node['id']]
            for edge in out_edges:
                queue.append({
                    'target': edge['target'],
                    'targetHandle': edge['targetHandle'],
                    'signal': res,
                    'source': edge['source']
                })
            
    processed_nodes = set() # To prevent loops or double execution of Actions
    node_map = {n['id']: n for n in nodes}
    actions_executed = False # Track if any action action actually fired

    try:
        while queue:
            item = queue.pop(0)
            target_id = item['target']
            signal = item['signal']
            target_node = node_map.get(target_id)
            
            if not target_node: continue
            
            t_type = target_node.get('type')
            
            # --- IF GATE LOGIC ---
            if t_type == 'if_gate':
                # Identify priority based on ALL inputs
                if target_id in processed_nodes: continue # Logic gates evaluated once per run (simplification)
                processed_nodes.add(target_id)

                # Get all input edges to this gate
                in_edges = [e for e in edges if e['target'] == target_id]
                
                # Sort by handle 'in-0', 'in-1', etc.
                def get_idx(e):
                    h = e.get('targetHandle', '')
                    if h.startswith('in-'):
                        return int(h.split('-')[1])
                    return 9999
                
                in_edges.sort(key=get_idx)
                
                fired_handle = 'out-else'
                
                for edge in in_edges:
                    src_id = edge['source']
                    src_status = node_results.get(src_id, False) 
                    
                    if src_status:
                        # Found our priority match
                        idx = get_idx(edge)
                        fired_handle = f"out-{idx}"
                        break
                
                print(f"   -> IfGate ({target_id}) firing {fired_handle}")
                node_results[target_id] = True 

                # Propagate output
                out_edges = [e for e in edges if e['source'] == target_id and e['sourceHandle'] == fired_handle]
                for oe in out_edges:
                    queue.append({
                        'target': oe['target'],
                        'targetHandle': oe['targetHandle'],
                        'signal': True, # Gate always emits "Go" on the chosen path
                        'source': target_id
                    })

            # --- LOGIC GATE (AND/OR) ---
            elif t_type == 'logic_gate':
                # Check inputs
                in_edges = [e for e in edges if e['target'] == target_id]
                
                # Map input sources to their results
                input_values = []
                for e in in_edges:
                    src = e['source']
                    # Check if we have a result for this source
                    val = node_results.get(src, False)
                    input_values.append(val)
                    
                op = target_node.get('data', {}).get('operation', 'AND').upper()
                
                gate_res = False
                if op == 'AND':
                    gate_res = all(input_values) and len(input_values) > 0
                elif op == 'OR':
                    gate_res = any(input_values)
                    
                if gate_res:
                    print(f"   -> LogicGate ({target_id}) {op} = TRUE")
                    node_results[target_id] = True # Store result for downstream gates
                    
                    if target_id not in processed_nodes:
                        processed_nodes.add(target_id)
                        
                        out_edges = [e for e in edges if e['source'] == target_id]
                        for oe in out_edges:
                            queue.append({
                                'target': oe['target'],
                                'targetHandle': oe['targetHandle'],
                                'signal': True,
                                'source': target_id
                            })
                else:
                    print(f"   -> LogicGate ({target_id}) {op} = FALSE (Inputs: {input_values})")
                    stop_reason = f"Logic Gate ({op}) Failed"

            # --- ACTION: END AUTOMATION ---
            elif t_type == 'end_automation':
                 print(f"   [AUTOMATION] End Automation Node Reached ({target_id}). Stopping flow.")
                 stop_reason = "Explicit Stop (End Automation Node)"
                 
                 # Check if there is a completion email attached to this node
                 # If so, queue it up. If not, we are done.
                 out_edges = [e for e in edges if e['source'] == target_id]
                 
                 # Filter only for completion_email targets
                 inserted_targets = []
                 for oe in out_edges:
                     target_n = node_map.get(oe['target'])
                     if target_n and target_n.get('type') == 'completion_email':
                          queue.append({
                            'target': oe['target'],
                            'targetHandle': oe['targetHandle'],
                            'signal': True,
                            'source': target_id
                        })
                          inserted_targets.append(oe['target'])
                 
                 # Filter Queue: Only keep items that are targeting the 'completion_email' nodes we enabled
                 new_queue = []
                 for q_item in queue:
                     if q_item['target'] in inserted_targets:
                         new_queue.append(q_item)
                 
                 queue = new_queue
                 processed_nodes.add(target_id)


            # --- ACTIONS ---
            elif t_type in ['tracking', 'nexus', 'send_email', 'webhook', 'completion_email']:
                if signal:
                    if target_id not in processed_nodes:
                        processed_nodes.add(target_id)
                        try:
                            await increment_usage('automations_run') # Increment usage when an action is triggered
                            await execute_action(target_node, nodes, edges, auto.get('user_email'), node_results, auto.get('name'))
                            actions_executed = True
                            
                            # NEW: Allow propagation from Actions (if chaining is desired)
                            # We treat successful execution as a "True" signal for downstream nodes
                            node_results[target_id] = True
                            out_edges = [e for e in edges if e['source'] == target_id]
                            for oe in out_edges:
                                queue.append({
                                    'target': oe['target'],
                                    'targetHandle': oe['targetHandle'],
                                    'signal': True,
                                    'source': target_id
                                })

                        except Exception as e:
                            print(f"   [AUTOMATION] Action Failed: {e}")
                            stop_reason = f"Action Failed: {str(e)}"
                            raise e # Re-raise to trigger Failure Email logic

        
        # 3. Save State (Success or Failure)
        from backend.automation_storage import save_automation
        
        if actions_executed:
            auto['last_run'] = datetime.now().isoformat()
            if 'last_error' in auto: del auto['last_error'] # Clear error on success
            try:
                save_automation(auto)
                print(f"   [AUTOMATION] SUCCESS: Saved timestamp for {auto.get('name')}")
            except Exception as e:
                print(f"   [AUTOMATION] Failed to save timestamp: {e}")
                
        elif time_valid: 
            # Time was valid, but no action executed. This counts as a "Stop" or "Fail".
            # We record this so the UI can show it.
            # Format: { date: iso, message: str }
            
            reason = stop_reason or "Conditions not met"
            auto['last_error'] = {
                'date': datetime.now().isoformat(),
                'message': reason
            }
            try:
                save_automation(auto)
                print(f"   [AUTOMATION] STOPPED: Saved error state for {auto.get('name')} ({reason})")
            except Exception as e:
                 print(f"   [AUTOMATION] Failed to save error state: {e}")

    except Exception as execution_error:
        import traceback
        print(f"   [CRITICAL AUTOMATION FAILURE] {auto.get('name')}: {execution_error}")
        traceback.print_exc()
        
        # --- FAILURE EMAIL LOGIC ---
        # "if the automation fails at any step... sends a failure email"
        # Find ANY completion_email node to use as config
        completion_node = next((n for n in nodes if n.get('type') == 'completion_email'), None)
        
        if completion_node:
            connected_sources = get_connected_nodes(completion_node['id'], nodes, edges, direction="target_to_source")
            email_info = None
            for src in connected_sources:
               if src.get('type') == 'email_info':
                   email_info = src.get('data', {}).get('email')

            # Fallback to user email if node/info doesn't specify
            target_email = completion_node.get('data', {}).get('email')
            if not target_email and email_info: target_email = email_info
            if not target_email: target_email = auto.get('user_email')
            
            if target_email:
                 print(f"   [FAILURE RECOVERY] Sending Failure Report to {target_email}")
                 timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                 
                 subject = f"⛔ Automation Failed: {auto.get('name')}"
                 body = f"""
                 <h2>Automation Execution Failed</h2>
                 <p><b>Time:</b> {timestamp}</p>
                 <p><b>Error:</b> {str(execution_error)}</p>
                 <hr>
                 <p>The automation encountered a critical error and stopped unexpectedly.</p>
                 <p><i>Sent via Medulla Automation</i></p>
                 """
                 
                 try:
                    from backend.integration import monitor_command
                    # Use a separate try/except for sending to ensure we don't loop crash
                    await monitor_command.send_notification(subject, body, to_emails=[target_email])
                 except Exception as mail_err:
                    print(f"   [FAILURE RECOVERY] Could not send failure email: {mail_err}")
        else:
            print("   [FAILURE RECOVERY] No Completion Email module found. Skipping failure notification.")
        
        # Save Error State
        auto['last_error'] = {
            'date': datetime.now().isoformat(),
            'message': f"CRITICAL: {str(execution_error)}"
        }
        try:
             from backend.automation_storage import save_automation
             save_automation(auto)
        except: pass


async def evaluate_condition(node):
    try:
        # from datetime import datetime, timedelta  <-- REMOVED REDUNDANT IMPORT
        data = node.get('data', {})
        c_type = node.get('type')
        
        op = data.get('op', '>')
        target_val = float(data.get('value', 0))

        current_val = 0

        # --- RISK ---
        if c_type == 'risk':
            metric = data.get('metric', 'market') # Default to 'market' (Market Invest Score) as per user graph
            
            # Fetch real scores
            # Using tuple unpacking from calculate_risk_scores_singularity:
            # general_score, large_cap_score, ema_score_val_risk, combined_score, spy_live_price, vix_live_price
            
            try:
                scores = await risk_command.calculate_risk_scores_singularity(is_called_by_ai=True)
                if not scores or scores[0] is None:
                    print("[EVAL] Risk calculation returned None")
                    return False
                
                general, large, ema, combined, spy, vix = scores
                
                # Fetch advanced metrics if needed (Recession/Market Invest Score)
                # For basic metrics, we have them. For Market Invest Score (MIS), we need extra steps.
                current_val = 0
                
                if metric == 'general': current_val = general
                elif metric == 'large_cap': current_val = large
                elif metric == 'ema': current_val = ema
                elif metric == 'combined': current_val = combined
                elif metric == 'market':
                     # Need MIS
                     l_ema = await asyncio.to_thread(risk_command.calculate_recession_likelihood_ema_risk, is_called_by_ai=True)
                     l_vix = risk_command.calculate_recession_likelihood_vix_risk(vix, is_called_by_ai=True)
                     _, capped_mis, _ = risk_command.calculate_market_invest_score_risk(l_vix, l_ema, is_called_by_ai=True)
                     current_val = capped_mis if capped_mis is not None else 0
                
                print(f"   [EVAL] Risk Metric '{metric}' = {current_val:.2f}")

            except Exception as e:
                print(f"   [EVAL ERROR] Risk fetch failed: {e}")
                traceback.print_exc()
                current_val = 0 

        # --- PRICE ---
        elif c_type == 'price':
            ticker = data.get('ticker', '').upper()
            if not ticker: return False
            t = yf.Ticker(ticker)
            current_val = t.fast_info.last_price

        # --- PERCENTAGE ---
        elif c_type == 'percentage':
            ticker = data.get('ticker', '').upper()
            timeframe = data.get('timeframe', '1d')
            if not ticker: return False
            
            t = yf.Ticker(ticker)
            hist = t.history(period="1y") 
            if hist.empty: return False
            
            current_price = hist['Close'].iloc[-1]
            past_price = current_price
            
            if timeframe == '1d' and len(hist) > 1: past_price = hist['Close'].iloc[-2]
            elif timeframe == '1w' and len(hist) > 5: past_price = hist['Close'].iloc[-6]
            elif timeframe == '1m' and len(hist) > 20: past_price = hist['Close'].iloc[-21]
            elif timeframe == '3m' and len(hist) > 60: past_price = hist['Close'].iloc[-61]
            elif timeframe == '1y' and len(hist) > 250: past_price = hist['Close'].iloc[-251]
            
            if past_price == 0: return False
            current_val = ((current_price - past_price) / past_price) * 100

        # --- SENTIMENT TRIGGER ---
        elif c_type == 'sentiment_trigger':
            ticker = data.get('ticker', '').upper()
            if not ticker: return False
            try:
                res = await sentiment_command.handle_sentiment_command(
                    args=[ticker],
                    is_called_by_ai=True
                )
                if res and 'sentiment_score' in res:
                    # Map [-1, 1] -> [0, 100]
                    raw = float(res['sentiment_score']) 
                    current_val = (raw + 1) * 50
                else: 
                    return False
            except Exception as e:
                print(f"   [EVAL] Sentiment fail: {e}")
                return False

        # --- TIME INTERVAL ---
        if c_type == 'time_interval':
            now_user = datetime.now(USER_TZ)
            print(f"   [EVAL] Time Check (User TZ): {now_user} | Weekday {now_user.weekday()}")
            
            # 1. Trading Day (Mon=0, Fri=4)
            # If unit is days, we strictly check trading days? Or make it optional?
            # Existing logic was strict.
            # 1. Trading Day (Mon=0, Fri=4)
            if now_user.weekday() > 4: return False 
            
            # 2. Time Check with Buffer (15 minutes)
            target_str = data.get('target_time', "09:30")
            try:
                th, tm = map(int, target_str.split(':'))
                target_dt = now_user.replace(hour=th, minute=tm, second=0, microsecond=0)
            except:
                target_dt = now_user.replace(hour=9, minute=30, second=0, microsecond=0)

            # Buffer Window: Target to Target + 15 mins
            buffer_minutes = 15
            end_window = target_dt + timedelta(minutes=buffer_minutes)
            
            # Check strictly if we are IN the window
            if not (target_dt <= now_user <= end_window):
                # We are outside the window (too early or too late)
                print(f"   [EVAL] Time Window Miss: {now_user.time()} outside {target_dt.time()} - {end_window.time()}")
                return False

            print(f"   [EVAL] Time Window HIT: {now_user.time()} inside {target_dt.time()} - {end_window.time()}")

            # 3. Interval/Frequency Check (Duplicate Execution Prevention)
            last_run_str = data.get('last_run')
            if last_run_str:
                try:
                    last_run = datetime.fromisoformat(last_run_str)
                    
                    # STRICT DAILY LIMIT: If it ran at all today, skip.
                    if last_run.date() == now_user.date():
                        print("   [EVAL] Time Interval: Already ran today (Strict Limit).")
                        return False

                    # If we already ran TODAY (or since the last target time), skip.
                    # Simple check: If last_run is within the same window?
                    # Or simpler: if last_run > target_dt (meaning we ran after the target started today), skip.
                    
                    if last_run >= target_dt:
                        print("   [EVAL] Time Interval: Already ran this window.")
                        return False
                        
                    # Also respect the Frequency (Days) if > 1 day?
                    # interval = int(data.get('interval', 1))
                    # unit = data.get('unit', 'days')
                    # ... ignoring complex multi-day logic for now to ensure daily reliability first.
                    # Assuming "Every 1 Day" is the norm.
                except:
                    pass 
            
            # Update State (Caller saves if ANY time_interval triggers)
            # We mark it as True, and we set a temp_last_run in data to be saved?
            # Yes, we update it in memory. `process_automation` saves it later.
            node['data']['last_run'] = now_user.isoformat()
            return True


        # --- LOGIC GATES (Intermediate) ---
        # Logic gates are usually evaluated in propagation phase, 
        # but if we are here, it means we treated it as a start node?
        # Logic Gates should NOT be start nodes usually.
        
        # COMPARISON
        # If we didn't return True/False already (TimeInterval returns True/False), compare current_val.
        if op == '>': return current_val > target_val
        elif op == '<': return current_val < target_val
        elif op == '>=': return current_val >= target_val
        elif op == '<=': return current_val <= target_val
        elif op == '==': return current_val == target_val
        
        return False
        
    except Exception as e:
        print(f"[EVAL ERROR] {node.get('type')}: {e}")
        return False


async def execute_action(node, nodes, edges, user_email, node_results=None, auto_name="Automation"):
    # Unified Execution Logic
    try:
        # 1. Gather Info from attached Condition/Info blocks
        connected_sources = get_connected_nodes(node['id'], nodes, edges, direction="target_to_source")
        
        email_info = None
        rh_info = None
        
        for src in connected_sources:
            if src.get('type') == 'email_info':
                email_info = src.get('data', {}).get('email')
            elif src.get('type') == 'rh_info':
                rh_info = src.get('data', {})

        a_type = node.get('type')
        data = node.get('data', {})

        # 2. Prepare Parameters (Safe Conversion)
        code = data.get('code')
        val_raw = data.get('value')
        # Safe float conversion handling empty strings
        value = float(val_raw) if val_raw and str(val_raw).strip() else 0.0
        
        fractional = data.get('fractional', False)
        # Handle 'actions' list (e.g. ['email', 'robinhood'])
        actions = data.get('actions', []) 
        
        ai_params = {
            'total_value': value,
            'use_fractional_shares': fractional,
            'execute_rh': 'robinhood' in actions,
            'send_email': 'email' in actions,
            'overwrite': 'overwrite' in actions,
            'email_to': email_info if email_info else user_email,
            'rh_user': rh_info.get('email') if rh_info else None,
            'rh_pass': rh_info.get('password') if rh_info else None
        }

        print(f"   [ACTION] Executing {a_type} (Code: {code}, Val: {value})")

        # 3. Dispatch Command
        if a_type == 'nexus':
            if code:
                ai_params['nexus_code'] = code
                # Call Nexus Command
                # Ensure nexus_command is imported
                try:
                    from backend.integration import nexus_command
                except ImportError:
                    from integration import nexus_command
                    
                await nexus_command.handle_nexus_command(
                    args=[], 
                    ai_params=ai_params, 
                    is_called_by_ai=True
                )
            else:
                print("   [ACTION ERROR] Nexus execution skipped: No code provided.")

        elif a_type == 'tracking':
            if code:
                ai_params['portfolio_code'] = code
                try:
                    from backend.integration import tracking_command
                except ImportError:
                    from integration import tracking_command
                    
                await tracking_command.handle_tracking_command(
                    args=[], 
                    ai_params=ai_params
                )
            else:
                print("   [ACTION ERROR] Tracking execution skipped: No code provided.")

        elif a_type == 'send_email':
            subject = data.get('subject', 'SkyNet Automation Alert')
            body = f"Your automation logic was triggered.\n\nTrigger Block ID: {node.get('id')}\nAction: Send Email"
            recipient = email_info if email_info else user_email
            
            if recipient:
                print(f"   [ACTION] Sending Email to {recipient}")
                try:
                    from backend.integration import monitor_command
                except ImportError:
                    from cli_commands import monitor_command
                    
                await monitor_command.send_notification(subject, body, to_emails=[recipient])
            else:
                print("   [ACTION] Email skipped: No recipient found.")

        elif a_type == 'completion_email':
            # Send Completion Summary
            target_email = node.get('data', {}).get('email')
            if not target_email and email_info: target_email = email_info
            
            if not target_email and user_email: target_email = user_email

            if target_email:
                print(f"   [ACTION] Sending Completion Email to {target_email}...")
                
                # Construct Summary
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                # auto_name is passed in args
                
                steps_summary = "<ul>"
                # Sort nodes by some logic? or just list them
                sorted_nodes = sorted(nodes, key=lambda n: (n.get('position', {}).get('y', 0), n.get('position', {}).get('x', 0)))
                
                for n in sorted_nodes:
                    n_type = n.get('type', '').replace('_', ' ').title()
                    n_res = node_results.get(n['id']) if node_results else None
                    
                    status_icon = "⚪"
                    status_text = "Skipped/Pending"
                    if n_res is True: 
                        status_icon = "✅" 
                        status_text = "Passed"
                    elif n_res is False: 
                        status_icon = "❌" 
                        status_text = "Failed"
                        
                    # Don't show every node detail, just high level
                    steps_summary += f"<li>{status_icon} <b>{n_type}</b>: {status_text}</li>"
                steps_summary += "</ul>"
                
                subject = f"Automation Completed: {auto_name}"
                body = f"""
                <h2>Automation Run Successful</h2>
                <p><b>Time:</b> {timestamp}</p>
                <hr>
                <h3>Execution Stack:</h3>
                {steps_summary}
                <p><i>Sent via Medulla Automation</i></p>
                """
                
                try:
                    from backend.integration import monitor_command
                    await monitor_command.send_notification(
                        subject,
                        body, # send_notification handles HTML? usually logic handles it
                        to_emails=[target_email]
                    )
                    print(f"   [ACTION] Completion Email Sent.")
                except Exception as e:
                    print(f"   [ACTION] Failed to send email: {e}")
            else:
                 print("   [ACTION] Skipped Completion Email: No email address found.")

        elif a_type == 'webhook':
            url = data.get('url')
            platform = data.get('platform')
            message = data.get('message', 'SkyNet Alert')

            if url:
                payload = {}
                if platform == 'discord':
                    payload = {"content": message}
                else: # slack/generic
                    payload = {"text": message}

                import aiohttp
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, json=payload) as resp:
                        print(f"   [WEBHOOK] Sent to {platform} ({resp.status})")
            else:
                 print("   [ACTION] Webhook skipped: No URL provided.")

    except Exception as e:
        print(f"[ACTION ERROR] Execution Failed: {e}")
        traceback.print_exc()
        raise e # NEW: Re-raise to let the main loop know we crashed
