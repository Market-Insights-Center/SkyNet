
import asyncio
import json
import logging
import traceback
import inspect
from typing import List, Dict, Any, Optional, AsyncGenerator
try:
    from backend.usage_counter import increment_usage
except ImportError:
    try:
        from usage_counter import increment_usage
    except ImportError:
        def increment_usage(*args): pass

from backend.ai_service import ai
from backend.integration import (
    market_command,
    sentiment_command,
    risk_command,
    briefing_command,
    fundamentals_command,
    assess_command,
    mlforecast_command,
    powerscore_command,
    quickscore_command
)

def safe_float(val):
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0

# Configure Logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentinel_ai")

# --- Command Registry ---
# Map "tool names" used by the Planner LLM to actual python functions.
COMMAND_REGISTRY = {
    "market": market_command.handle_market_command,
    "sentiment": sentiment_command.handle_sentiment_command,
    "risk": risk_command.handle_risk_command,
    "briefing": briefing_command.handle_briefing_command,
    "fundamentals": fundamentals_command.handle_fundamentals_command,
    "assess": assess_command.handle_assess_command,
    "mlforecast": mlforecast_command.handle_mlforecast_command,
    "powerscore": powerscore_command.handle_powerscore_command,
    "quickscore": quickscore_command.handle_quickscore_command,
    "nexus_import": lambda args, ai_params, is_called_by_ai: handle_nexus_import_tool(ai_params),
    "summary": lambda args, ai_params, is_called_by_ai: handle_summary_tool(ai_params),
    "manual_list": lambda args, ai_params, is_called_by_ai: handle_manual_list_tool(ai_params)
}

async def handle_manual_list_tool(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pass-through for manual ticker input.
    """
    tickers_input = params.get("tickers", "")
    if isinstance(tickers_input, list):
         tickers = tickers_input
    elif isinstance(tickers_input, str):
         # Split by comma or newline
         tickers = [t.strip().upper() for t in tickers_input.replace('\n', ',').split(',') if t.strip()]
    else:
         tickers = []
         
    return {
        "tickers": tickers,
        "top_10": tickers[:10], # For compatibility with "top_10" chaining
        "count": len(tickers),
        "message": f"Processed {len(tickers)} manual tickers."
    }

async def handle_nexus_import_tool(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Imports tickers from a Nexus/Portfolio code.
    """
    nexus_code = params.get("nexus_code", "")
    if not nexus_code: return {"error": "No Nexus code provided."}
    
    # Import here to avoid circulars if possible (or assume it's safe at module level)
    # We need to ensure nexus_command is available. 
    # It is imported at top level: from backend.integration import ... nexus_command?
    # Let's check imports. sentinel_command imports: market_command, sentiment_command...
    # We need to add nexus_command to imports if not there.
    try:
        from backend.integration.nexus_command import fetch_nexus_tickers
        tickers = await fetch_nexus_tickers(nexus_code)
    except Exception as e:
        return {"error": f"Failed to import Nexus tickers: {e}"}
        
    return {
        "tickers": tickers,
        "top_10": tickers[:10],
        "count": len(tickers),
        "message": f"Imported {len(tickers)} tickers from Nexus '{nexus_code}'."
    }

async def handle_summary_tool(params: Dict[str, Any]) -> str:
    """
    Summarizes the provided context data, optimized for speed but prioritizing key insights.
    """
    data = params.get("context_data", {})
    user_query = params.get("user_query", "the user request")
    
    # Smart Context Truncation (Pre-JSON)
    optimized_data = {}
    for k, v in data.items():
        # Specific handling for MLForecast results to ensure we don't truncate valuable predictions
        if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict) and "table" in v[0]:
            # This looks like a list of MLForecast return objects
            summarized_forecasts = []
            for item in v:
                if "table" in item:
                    # Keep the table, it's small enough and critical
                    summarized_forecasts.append({"forecast_table": item["table"]})
            optimized_data[k] = summarized_forecasts
        
        elif isinstance(v, list) and len(v) > 20:
            optimized_data[k] = {"summary": f"List with {len(v)} items", "preview": v[:20]}
        elif isinstance(v, dict) and "all_data" in v: # Handle market command specific large outputs
             # Keep summary stats if available, drop raw 'all_data'
             safe_v = v.copy()
             safe_v["all_data"] = "Truncated for summary"
             if "chart_data" in safe_v: safe_v["chart_data"] = "Chart data excluded"
             optimized_data[k] = safe_v
        else:
            optimized_data[k] = v

    # Serialize
    context_str = json.dumps(optimized_data, default=str)
    
    # Final Safety Limit
    if len(context_str) > 30000:
        context_str = context_str[:30000] + "...(truncated)"

    prompt = f"""
    You are the Strategy Analyst for Sentinel AI. 
    User Request: "{user_query}"
    
    Context Data:
    {context_str}
    
    Goal: write a comprehensive, professional Mission Report.
    
    Guidelines:
    1. **Synthesize, don't just list.** Explain WHiCH stocks look best and WHY based on the combined data (Market Scan + Sentiment + ML Forecasts).
    2. **Highlight Discrepancies.** If Sentiment is high but ML Forecast is DOWN, mention this risk.
    3. **Actionable Conclusion.** Give a final verdict or recommendation.
    4. **ML Forecast Specifics.** If ML Forecast data is present, explicitly mention the predicted direction and confidence for the different time horizons (1-Week, 1-Month, etc.).
    
    Format Rules:
    - **Mission Summary**: High-level executive summary.
    - **Key Insights**: Bullet points with deep analysis.
    - **Data-Driven Verdict**: Clear conclusion.
    - NO Markdown Tables.
    - NO code blocks.
    """
    
    try:
        # Use a timeout for the AI generation if possible, but here we just await
        return await ai.generate_content(prompt)
    except Exception as e:
        return f"Summary generation failed: {e}. Raw data available in logs."

SYSTEM_PROMPT_PLANNER = """
You are the "Sentinel AI" Execution Planner. 
Your goal is to translate a user's natural language request into a Multi-Step Execution Plan JSON.

Available Tools (Commands):
1. **market**: Get market data. Params: 'sensitivity' (1=Weekly, 2=Daily, 3=Hourly), 'market_type' ('sp500', 'plus', 'plusplus'). Returns list of tickers with scores.
2. **sentiment**: Analyze sentiment for a ticker. Params: 'tickers_source' (source of tickers), 'limit' (int). Returns score and summary.
3. **risk**: Check general market risk (SPY/VIX). No params. Returns risk level.
4. **summary**: Generate a final summary. Params: 'data_source' (usually '$CONTEXT').
5. **briefing**: Get market news briefing. No params. Returns text summary.
6. **fundamentals**: Get fundamental data (PE, EPS, etc.). Params: 'tickers_source' (source), 'limit' (int).
7. **powerscore**: Get comprehensive PowerScore (0-100). Params: 'tickers_source' (source), 'limit' (int).
8. **quickscore**: Get quick technical score. Params: 'tickers_source' (source).
9. **mlforecast**: Generate ML-based price forecasts. Params: 'tickers_source' (source of tickers), 'limit' (int).
10. **nexus_import**: Import tickers from a Nexus/Portfolio code. Params: 'nexus_code' (str).

Rules:
1. **Break it down**: If the user asks for "market and then sentiment", that is TWO steps.
2. **Context Chaining**: 
    - For commands like `sentiment`, `powerscore` use `tickers_source`.
    - If the user implies using the result of a previous step, set `tickers_source` to `"$step_N_output.top_10"`.
3. **Defaults**: Unless specified otherwise, set `limit` to 10.
4. **Final Summary**: ALWAYS end the plan with a "summary" step using "data_source": "$CONTEXT".
5. **Format**: Return ONLY valid JSON. The JSON must be a list of steps.

{mode_instructions}

Example 1: "Run market scan sens 2 then sentiment"
[
    {
        "step_id": 1,
        "tool": "market",
        "params": {"sensitivity": 2, "market_type": "sp500"},
        "output_key": "step_1_output",
        "description": "Run S&P 500 market scan with daily sensitivity."
    },
    {
        "step_id": 2,
        "tool": "sentiment",
        "params": {"tickers_source": "$step_1_output.top_10", "limit": 10},
        "output_key": "step_2_output",
        "description": "Analyze sentiment for the top 10 stocks from Step 1."
    },
    {
        "step_id": 3,
        "tool": "summary",
        "params": {"data_source": "$CONTEXT"},
        "output_key": "final_summary",
        "description": "Summarize all findings."
    }
]
"""

async def plan_execution(user_prompt: str, execution_mode: str = "auto") -> List[Dict[str, Any]]:
    """
    Uses the AI Service to generate a JSON execution plan from the user prompt.
    """
    logger.info(f"Planning execution for: {user_prompt} (Mode: {execution_mode})")
    
    mode_instructions = ""
    if execution_mode == "plan_and_review":
        mode_instructions = """
        MODE: PLAN AND REVIEW
        - Be COMPREHENSIVE and DETAILED.
        - Add extra verification steps if applicable.
        - Break down complex tasks into granular steps.
        - Prioritize depth of analysis over speed.
        """
    elif execution_mode == "quick_execute":
        mode_instructions = """
        MODE: QUICK EXECUTE
        - Be CONCISE and EFFICIENT.
        - Merge steps where possible appropriately.
        - Focus on speed and direct results.
        - Do not add unnecessary exploratory steps unless explicitly asked.
        """
    
    formatted_system_prompt = SYSTEM_PROMPT_PLANNER.replace("{mode_instructions}", mode_instructions)
    
    try:
        response_text = await ai.generate_content(
            prompt=f"User Request: {user_prompt}",
            system_instruction=formatted_system_prompt,
            json_mode=True
        )
        
        # Clean and parse JSON
        cleaned_json = response_text.strip()
        if "```json" in cleaned_json:
            cleaned_json = cleaned_json.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned_json:
             cleaned_json = cleaned_json.split("```")[1].split("```")[0].strip()
            
        plan = json.loads(cleaned_json)
        
        # Handle { "steps": [...] } format
        if isinstance(plan, dict) and "steps" in plan: 
            plan = plan["steps"]
        elif isinstance(plan, dict) and "tool" in plan:
            # AI returned a single step object instead of a list
            plan = [plan]
            
        # Validate structure
        if not isinstance(plan, list):
            logger.error(f"Plan is not a list: {type(plan)} - Content: {str(plan)[:100]}")
            return []
            
        # Ensure all items are dicts
        valid_plan = []
        for i, item in enumerate(plan):
            if isinstance(item, dict):
                valid_plan.append(item)
            else:
                logger.warning(f"Skipping invalid plan item at index {i}: {item} (type: {type(item)})")
                
        return valid_plan
    except Exception as e:
        logger.error(f"Planning failed: {e}")
        return []

async def execute_step(step: Dict[str, Any], context: Dict[str, Any], progress_callback: Optional[Any] = None) -> Any:
    """
    Executes a single step of the plan.
    """
    tool_name = step.get("tool")
    params = step.get("params", {})
    
    if tool_name not in COMMAND_REGISTRY:
        return {"error": f"Tool '{tool_name}' not found."}
    
    handler = COMMAND_REGISTRY[tool_name]
    logger.info(f"Executing Step {step.get('step_id')}: {tool_name} with params {params}")
    
    # --- Context Resolution / Magic Binding ---
    # Attempt to resolve "tickers_source" if present
    # This is a simplified "Chain" logic. 
    # Realistically, we'd need a robust expression parser, but for now we handle specific "Market -> Ticker List" patterns.
    
    target_tickers = []
    
    if "tickers_source" in params:
        source_key = params["tickers_source"]
        # e.g. "$step_1_output.top_10" or "$step_1_output"
        
        if source_key.startswith("$"):
            # logic: parse "$key.subkey"
            clean_key = source_key.lstrip("$")
            parts = clean_key.split(".")
            base_var = parts[0] # e.g. "step_1_output"
            sub_prop = parts[1] if len(parts) > 1 else None # e.g. "top_10"
            
            if base_var in context:
                source_data = context[base_var]
                raw_list = []
                
                # If sub_prop is specified, try to access it
                if sub_prop and isinstance(source_data, dict) and sub_prop in source_data:
                    raw_list = source_data[sub_prop]
                elif isinstance(source_data, list):
                    # Maybe the step output is directly a list
                    raw_list = source_data
                elif isinstance(source_data, dict):
                    # Try to guess - check for common keys if no sub_prop
                    if "top_10" in source_data: raw_list = source_data["top_10"]
                    elif "tickers" in source_data: raw_list = source_data["tickers"]
                
                # Validation: Expecting list of dicts with 'ticker' key or list of strings
                for item in raw_list:
                    if isinstance(item, dict) and "ticker" in item:
                        target_tickers.append(item["ticker"])
                    elif isinstance(item, str):
                        target_tickers.append(item)
                
                # Limit handling: Capture limit for OUTPUT truncation, not input
                output_limit = int(params.get("limit", 100))
                # target_tickers = target_tickers[:limit] # REMOVED: Do not limit input
                
                logger.info(f"Resolved {len(target_tickers)} context tickers from {source_key}")
            else:
                 logger.warning(f"Context key '{base_var}' not found. Available keys: {list(context.keys())}")
                 return {"error": f"Dependency {base_var} failed or missing."}
    
    # Special handling for Summary Step context injection
    if params.get("data_source") == "$CONTEXT":
        params["context_data"] = context
        # Also pass original user prompt if available in context? 
        # For now, handle_summary_tool defaults to generic query if not found.
    
    # If the tool handles single ticker but we have a list (e.g. Sentiment on Top 3)
    if target_tickers and tool_name in ["sentiment", "powerscore", "quickscore", "fundamentals", "mlforecast"]:        # We need to run this command MULTIPLE times? Or update the command to accept a list?
        # Most of our commands accept a single ticker in args[0].
        # We will iterate here for this specific meta-command logic.
        
        # Parallel Execution Logic
        results = []
        total = len(target_tickers)
        
        # Determine concurrency limit based on tool type to avoid rate limits
        # Quickscore/Fundamentals are local calculations or light DB queries -> Higher concurrency
        # Sentiment/MLForecast might hit external APIs -> Lower concurrency
        concurrency = 15 
        if tool_name in ["mlforecast", "sentiment"]:
            concurrency = 5
        
        semaphore = asyncio.Semaphore(concurrency)
        
        async def _process_single_ticker(idx, t):
            async with semaphore:
                # Progress Update (Batch-style to reduce noise, e.g. every 5 or 10%)
                if progress_callback and (idx % 5 == 0 or idx == total - 1): 
                     await progress_callback(f"Processing {t} ({idx+1}/{total})...")
                
                step_params = params.copy()
                step_params["ticker"] = t
                try:
                    return await handler(args=[t], ai_params=step_params, is_called_by_ai=True)
                except Exception as e:
                    logger.error(f"Error processing {t}: {e}")
                    return {"ticker": t, "error": str(e)}

        tasks = [_process_single_ticker(i, t) for i, t in enumerate(target_tickers)]
        results = await asyncio.gather(*tasks)
        
        # --- POST-PROCESSING & SORTING ---
        # Sort results to provide the "Best" N results requested by user
        def get_score(item):
            # Try common score keys
            s = item.get('score', item.get('quick_score', item.get('total_score', 0)))
            return safe_float(s)

        try:
            results.sort(key=get_score, reverse=True)
        except: pass # Sort might fail if mixed types, ignore
        
        # Slice output to requested limit to prevent UI freeze
        # But allow "All" to pass through if limit is very high (e.g. > 500)
        # Assuming frontend limit input usually implies "Top N"
        output_limit = int(params.get("limit", 10)) # Re-read in case not set above
        
        final_output = results[:output_limit]
        logger.info(f"Processed {len(results)} items. Returning top {len(final_output)}.")
        
        return {
            "top_10": final_output[:10],
            "tickers": results, # Keep full list available for next steps? 
                                # WARNING: This might crash frontend if "tickers" is rendered.
                                # SentinelAI.jsx likely renders the whole return object.
                                # FIX: We should return a structure that mimics a single result or a list.
                                # If we return a LIST, frontend iterates.
                                # If we return DICT, frontend shows specific keys.
            "results": final_output,
            "count": len(final_output),
            "total_processed": len(results),
            "message": f"Processed {len(results)} tickers. Showing top {len(final_output)}."
        }

    # Normal Single Execution
    # Prepare arguments
    # We pass ai_params = params
    
    try:
        # Check if handler accepts progress_callback
        sig = inspect.signature(handler)
        kwargs = {"args": [], "ai_params": params, "is_called_by_ai": True}
        if "progress_callback" in sig.parameters:
            kwargs["progress_callback"] = progress_callback

        result = await handler(**kwargs)
        return result
    except Exception as e:
        logger.error(f"Step Execution Error: {e}")
        return {"error": str(e)}

async def run_sentinel(user_prompt: str, plan_override: Optional[List[Dict[str, Any]]] = None, execution_mode: str = "auto") -> AsyncGenerator[Dict[str, Any], None]:
    """
    Main entry point for Sentinel AI.
    1. Plan (or use override)
    2. Execute Loop
    3. Summarize
    """
    try:
        await increment_usage('sentinel')
        yield {"type": "status", "message": f"Analyzing request... (Mode: {execution_mode})"}
        
        plan = []
        if plan_override:
            plan = plan_override
            yield {"type": "status", "message": "Using provided execution plan..."}
        else:
            plan = await plan_execution(user_prompt, execution_mode=execution_mode)
            yield {"type": "plan", "plan": plan}
        
        if not plan:
             yield {"type": "error", "message": "Failed to generate a valid execution plan. The AI service may be unresponsive or returned empty output."}
             # Do not just return; ensure we finish cleanly
             return

        context = {}
        
        for step in plan:
            step_id = step.get("step_id")
            tool_name = step.get("tool")
            description = step.get("description", tool_name)
            output_key = step.get("output_key", f"step_{step_id}_output")
            
            yield {"type": "status", "message": f"Step {step_id}: {description}..."}
            
            # --- Queue-Based Progress Streaming ---
            queue = asyncio.Queue()
            
            async def progress_callback(msg: str):
                await queue.put(msg)
                
            async def wrapped_execution():
                return await execute_step(step, context, progress_callback=progress_callback)

            exec_task = asyncio.create_task(wrapped_execution())
            
            # Consume updates while task runs
            # Consume updates while task runs
            get_future = None
            
            while True:
                # Check if task failed immediately
                if exec_task.done():
                     # If task is done, we must drain the queue once to ensure we didn't miss anything that happened just before finish
                     break

                if get_future is None:
                    get_future = asyncio.ensure_future(queue.get())

                # Wait for message or task completion with Heartbeat Timeout
                # This prevents ERR_INCOMPLETE_CHUNKED_ENCODING on slow steps
                done_futures, pending = await asyncio.wait(
                    [get_future, exec_task], 
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=5.0 
                )
                
                if not done_futures:
                    # Timeout reached (Heartbeat), send ping to keep connection alive
                    yield {"type": "ping"}
                    continue
                
                if get_future in done_futures:
                    try:
                        msg = get_future.result()
                        get_future = None # Reset for next message
                        if msg is None: break
                        yield {"type": "status", "message": f"Step {step_id}: {msg}"}
                    except Exception:
                        get_future = None
                
                if exec_task.done():
                    break
            
            # Drain remaining queue items if any
            if get_future and not get_future.done():
                get_future.cancel()
            
            while not queue.empty():
                try:
                    msg = queue.get_nowait()
                    if msg: yield {"type": "status", "message": f"Step {step_id}: {msg}"}
                except: break
            
            try:
                result = await exec_task
            except Exception as e:
                logger.error(f"Step {step_id} execution exception: {e}")
                result = {"error": str(e)}

            # --------------------------------------

            # Store Result
            if isinstance(result, dict) and "error" in result:
                 yield {"type": "error", "message": f"Step {step_id} failed: {result['error']}"}
                 context[output_key] = result
            else:
                 context[output_key] = result
                 
                 if tool_name == "summary":
                     yield {"type": "summary", "message": result}
                 else:
                     # Aggressive Recursive Sanitizer for Frontend Display
                     def sanitize_for_display(obj, depth=0):
                         if depth > 3: return "..." # Prevent deep recursion
                         
                         if isinstance(obj, list):
                             if len(obj) > 10:
                                 return [sanitize_for_display(x, depth+1) for x in obj[:10]] + [f"<{len(obj)-10} more items...>"]
                             return [sanitize_for_display(x, depth+1) for x in obj]
                         
                         elif isinstance(obj, dict):
                             new_dict = {}
                             for k, v in obj.items():
                                 if k in ["tickers", "data"] and isinstance(v, list) and len(v) > 20:
                                     new_dict[k] = f"<{len(v)} items hidden>"
                                 else:
                                     new_dict[k] = sanitize_for_display(v, depth+1)
                             return new_dict
                         
                         elif isinstance(obj, str):
                             if len(obj) > 1000: return obj[:1000] + "...(truncated)"
                             return obj
                             
                         return obj

                     display_result = sanitize_for_display(result)
                     yield {"type": "step_result", "step_id": step_id, "result": display_result}
            

            
        # Only run finalizing step if a summary was requested
        has_summary_step = any(s.get("tool") == "summary" for s in plan)
        
        if has_summary_step:
            yield {"type": "status", "message": "Finalizing..."}
            logger.info("Sentinel: Finalizing... Yielding context.")
            
            # Safe Context Yielding (Prevent huge payloads)
            safe_context = {}
            for k, v in context.items():
                try:
                     # Basic check using str representation length
                     if len(str(v)) > 500000: # 500KB limit per item
                         safe_context[k] = "Data too large for full display. Check specific step outputs."
                         logger.warning(f"Truncated context key {k} due to size.")
                     else:
                         safe_context[k] = v
                except:
                     safe_context[k] = v

            yield {"type": "final", "context": safe_context}
        else:
            logger.info("Sentinel: No summary step, skipping finalization.")
            # Even without Final context, we should ensure frontend knows we are done.
            # The generator exit handles that naturally.
        
    except Exception as e:
        logger.error(f"Sentinel Global Crash: {e}")
        traceback.print_exc()
        yield {"type": "error", "message": f"Sentinel System Error: {str(e)}"}
    finally:
        # Ensure generator closes
        pass
