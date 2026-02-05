
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
# Moved to bottom to avoid circular reference NameErrors with local handlers


async def handle_research_tool(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Performs a web search using DuckDuckGo. 
    Supports 'query' (single string) or 'tickers_source' (list of tickers).
    """
    query = params.get("query", "")
    limit = int(params.get("limit", 5))
    
    # --- Context / Ticker Support ---
    queries = []
    if "tickers_source" in params:
        # If tickers provided, generate queries for them
        tickers_source = params["tickers_source"]
        # If it's a list (already resolved by execute_step logic usually? 
        # No, execute_step doesn't resolve for 'research' by default unless we add it to the list of iterables.
        # But 'research' might want to aggregate. let's handle it here if passed directly or if execute_step passed it.)
        
        # Actually, execute_step logic for 'tickers_source' is generic. 
        # If the tool name is NOT in the loop list ("sentiment", etc), execute_step passes the raw param.
        # But wait, execute_step RESOLVES 'tickers_source' into a local var 'target_tickers', but DOES NOT pass it to handler unless iterated.
        # So we need to handle the resolution logic here OR add 'research' to the iteration list in execute_step.
        
        # Let's support naive list input if passed directly
        if isinstance(tickers_source, list):
            for t in tickers_source:
                queries.append(f"Latest news and updates for {t} stock")
    
    if query:
        queries.append(query)
        
    if not queries: return {"error": "No query or tickers provided for research."}
        
    try:
        from duckduckgo_search import DDGS
        
        all_results = []
        
        # Parallelize research if multiple queries
        async def run_search(q):
            print(f"[SENTINEL] performing research: {q}")
            try:
                # Sync call in thread
                res = await asyncio.to_thread(lambda: list(DDGS().text(q, max_results=limit)))
                # Add context to result
                for r in res: r['search_query'] = q
                return res
            except Exception as e:
                logger.error(f"Search error for {q}: {e}")
                return []

        # Run concurrent searches
        tasks = [run_search(q) for q in queries]
        batch_results = await asyncio.gather(*tasks)
        
        for batch in batch_results:
            all_results.extend(batch)
            
        return {
            "query": query if query else f"{len(queries)} queries generated",
            "results": all_results,
            "count": len(all_results),
            "message": f"Found {len(all_results)} results."
        }
    except ImportError:
        logger.warning("duckduckgo-search not found. Using fallback simulated response.")
        return {
            "query": str(queries),
            "results": [{"title": "Search Unavailable", "body": "Research module dependencies missing. Please check console."}],
            "count": 0,
            "message": "Research skipped (dependency missing)."
        }
    except Exception as e:
        print(f"[RESEARCH ERROR] {e}")
        return {"error": f"Search failed: {str(e)}"}

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
    Summarizes the provided context data.
    """
    data = params.get("context_data", {})
    user_query = params.get("user_query", "the user request")
    
    # Smart Context Truncation
    optimized_data = {}
    for k, v in data.items():
        if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict) and "table" in v[0]:
            summarized_forecasts = []
            for item in v:
                if "table" in item:
                    summarized_forecasts.append({"forecast_table": item["table"]})
            optimized_data[k] = summarized_forecasts
        
        elif isinstance(v, list) and len(v) > 20:
            optimized_data[k] = {"summary": f"List with {len(v)} items", "preview": v[:20]}
        elif isinstance(v, dict) and "all_data" in v:
             safe_v = v.copy()
             safe_v["all_data"] = "Truncated for summary"
             if "chart_data" in safe_v: safe_v["chart_data"] = "Chart data excluded"
             optimized_data[k] = safe_v
        else:
            optimized_data[k] = v

    context_str = json.dumps(optimized_data, default=str)
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
    5. **Research Data.** If research data is present, synthesize it into the report to provide context.
    
    Format Rules:
    - **Mission Summary**: High-level executive summary.
    - **Key Insights**: Bullet points with deep analysis.
    - **Data-Driven Verdict**: Clear conclusion.
    - NO Markdown Tables.
    - NO code blocks.
    """
    
    try:
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
11. **research**: Perform web research. Params: 'query' (str) OR 'tickers_source' (source).

Rules:
1. **Valid JSON**: You must return a strict JSON array of objects. NO Markdown, NO strings as IDs.
2. **Keys**: Each object MUST have:
   - "step_id" (Integer, 1-indexed)
   - "tool" (exact string from Available Tools)
   - "params" (Dictionary of parameters)
   - "description" (String explaining the step)
   - "output_key" (String, e.g. "step_1_output")
3. **Looping/Chaining**:
   - If user provides tickers (e.g. "Compare AAPL, TSLA"), do NOT make separate steps for each. Use ONE step per tool with `tickers_source`: ["AAPL", "TSLA"].
   - To chain, set `tickers_source` to "$step_N_output.top_10".
4. **Research**: If checking news for multiple tickers, pass the list to `tickers_source` in the research tool.
5. **Summary**: ALWAYS end with a "summary" tool.
6. **MAXIMIZE INTELLIGENCE**: If the user asks for "Analysis", "Deep Dive", "Check", or "Scan" provided tickers, you MUST include:
   - **quickscore** (Technical Health)
   - **mlforecast** (Price Prediction)
   - **sentiment** (Social/News Vibe)
   - **fundamentals** (Financials)
   - **research** (Latest News)
   Do NOT skip these unless explicitly told to be "brief".

{mode_instructions}

Example:
[
    {
        "step_id": 1,
        "tool": "manual_list",
        "params": {"tickers": ["AAPL", "TSLA"]},
        "output_key": "step_1_output",
        "description": "Load manual tickers."
    },
    {
        "step_id": 2,
        "tool": "quickscore",
        "params": {"tickers_source": "$step_1_output.tickers"},
        "output_key": "step_2_output",
        "description": "Technical Analysis"
    },
    {
        "step_id": 3,
        "tool": "mlforecast",
        "params": {"tickers_source": "$step_1_output.tickers"},
        "output_key": "step_3_output",
        "description": "AI Price Forecasting"
    },
    {
        "step_id": 4,
        "tool": "summary",
        "params": {"data_source": "$CONTEXT"},
        "description": "Final report."
    }
]
"""

async def plan_execution(user_prompt: str, execution_mode: str = "auto") -> List[Dict[str, Any]]:
    logger.info(f"Planning execution for: {user_prompt} (Mode: {execution_mode})")
    
    mode_instructions = ""
    if execution_mode == "plan_and_review":
        mode_instructions = "MODE: PLAN AND REVIEW (Detailed, Step-by-Step)"
    elif execution_mode == "quick_execute":
        mode_instructions = "MODE: QUICK EXECUTE (Concise, Merged Steps)"
    
    # --- Regex Pre-Processing to Assist Local LLMs ---
    import re
    # Simple regex for tickers: 2-5 uppercase letters, ignore common words
    potential_tickers = re.findall(r'\b[A-Z]{2,6}\b', user_prompt.upper())
    common_words = {"THE", "AND", "FO", "HAT", "HIS", "ITH", "ROM", "BUT", "ALL", "ARE", "WAS", "WERE", "CAN", "FOR", "USE", "GET", "HEY", "SEE", "RUN", "NOT", "YES", "LOW", "BIG", "NEW", "OLD", "BUY", "SELL", "TOP", "ANY", "NOW", "ONE", "TWO", "SIX", "TEN", "OUT", "PUT", "CALL", "ASK", "BID", "PE", "EPS", "VOL", "CAP", "ROI", "ROE", "ETF", "YTD", "LTD", "INC", "CORP", "PLC", "USA", "USD", "EUR", "GBP", "JPY", "CNY", "CAD", "AUD", "NZD", "CHF", "HKD", "SGD", "SEK", "DKK", "NOK", "TRY", "RUB", "ZAR", "BRL", "INR", "MXN", "PLN", "THB", "IDR", "HUF", "CZK", "ILS", "CLP", "PHP", "AED", "COP", "SAR", "MYR", "RON"}
    
    # Filter based on common words and maybe context (if user said "LITE, DXYZ")
    filtered_tickers = [t for t in potential_tickers if t not in common_words]
    # Remove duplicates but keep order
    final_tickers = list(dict.fromkeys(filtered_tickers))

    formatted_system_prompt = SYSTEM_PROMPT_PLANNER.replace("{mode_instructions}", mode_instructions)
    
    # INJECTION: Force the model to see the tickers we found
    if final_tickers:
        formatted_system_prompt += f"\n\n[SYSTEM HINT]: I detected potential tickers in the user request: {json.dumps(final_tickers)}. YOU MUST use this exact list for 'tickers_source' in your tools (research, mlforecast, quickscore, etc.). Do not use '$CONTEXT' for the first step."

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
        
        # Normalization
        if isinstance(plan, dict):
            if "steps" in plan: plan = plan["steps"]
            elif "tool" in plan: plan = [plan]
            else: plan = [] # Unknown dict structure
            
        if not isinstance(plan, list):
            logger.error(f"Invalid Plan Structure: {type(plan)}")
            return []
            
        valid_plan = []
        for i, item in enumerate(plan):
            if isinstance(item, dict):
                # Heuristic Fixes
                
                # 1. Fix missing 'tool' key if 'action' or 'command' exists
                if "tool" not in item:
                    if "action" in item: item["tool"] = item["action"]
                    elif "command" in item: item["tool"] = item["command"]
                
                # 2. Fix Step ID to integer
                if "step_id" not in item: item["step_id"] = i + 1
                try:
                    item["step_id"] = int(item["step_id"])
                except:
                    item["step_id"] = i + 1
                    
                # 3. Fix missing params
                if "params" not in item: item["params"] = {}
                
                # 4. Check Valid Tool
                if item.get("tool") in COMMAND_REGISTRY:
                    valid_plan.append(item)
                else:
                    logger.warning(f"Removing invalid tool step: {item.get('tool')}")
                    
        return valid_plan
    except Exception as e:
        logger.error(f"Planning failed: {e}")
        return []

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
    "manual_list": lambda args, ai_params, is_called_by_ai: handle_manual_list_tool(ai_params),
    "research": lambda args, ai_params, is_called_by_ai: handle_research_tool(ai_params)
}

async def execute_step(step: Dict[str, Any], context: Dict[str, Any], progress_callback: Optional[Any] = None) -> Any:
    # ... (Pre-existing validation logic)
    tool_name = step.get("tool")
    params = step.get("params", {})
    
    if tool_name not in COMMAND_REGISTRY:
        # Final safety check, though plan_execution filters this now
        return {"error": f"Tool '{tool_name}' not found."}
    
    handler = COMMAND_REGISTRY[tool_name]
    logger.info(f"Executing Step {step.get('step_id')}: {tool_name} with params {params}")
    
    target_tickers = []
    
    # --- Context Resolution ---
    # (Existing logic to extract target_tickers for 'tickers_source')
    # We KEEP this, but we also ensure that if 'research' is used with 'tickers_source', 
    # we might need to actually pass the RESOLVED list to the handler if the handler expects it.
    
    if "tickers_source" in params:
        source_key = params["tickers_source"]
        
        # logic to resolve parameters... (Same as before)
        if isinstance(source_key, list):
            target_tickers = source_key
        elif isinstance(source_key, str) and source_key.startswith("$"):
             # ... resolution logic ...
             clean_key = source_key.lstrip("$")
             parts = clean_key.split(".")
             base_var = parts[0]
             sub_prop = parts[1] if len(parts) > 1 else None
             
             if base_var in context:
                 source_data = context[base_var]
                 raw_list = []
                 if sub_prop and isinstance(source_data, dict) and sub_prop in source_data:
                     raw_list = source_data[sub_prop]
                 elif isinstance(source_data, list):
                     raw_list = source_data
                 elif isinstance(source_data, dict):
                     if "top_10" in source_data: raw_list = source_data["top_10"]
                     elif "tickers" in source_data: raw_list = source_data["tickers"]
                 
                 for item in raw_list:
                     if isinstance(item, dict) and "ticker" in item: target_tickers.append(item["ticker"])
                     elif isinstance(item, str): target_tickers.append(item)
                 
                 logger.info(f"Resolved {len(target_tickers)} context tickers")
             else:
                 return {"error": f"Dependency {base_var} failed."}

    # IMPORTANT: Inject the resolved tickers into params so handlers like 'research' can use them directly
    if target_tickers:
        params["tickers_source"] = target_tickers

    # ... (Iteration logic for mlforecast/sentiment)
    # Ensure 'research' is NOT iterated here if we want to batch it inside the handler
    # Actually, current handle_research_tool (new version) supports batching. 
    # So we should NOT include 'research' in the iterator list below.
    
    if target_tickers and tool_name in ["sentiment", "powerscore", "quickscore", "fundamentals", "mlforecast"]:
         # ... (Existing iteration logic) ...
         # This block is fine, just don't add 'research' to it.
         
         results = []
         total = len(target_tickers)
         concurrency = 5 if tool_name in ["mlforecast", "sentiment"] else 15
         semaphore = asyncio.Semaphore(concurrency)
         
         async def _process_single_ticker(idx, t):
             async with semaphore:
                 if progress_callback and (idx % 5 == 0 or idx == total - 1): 
                      await progress_callback(f"Processing {t} ({idx+1}/{total})...")
                 step_params = params.copy()
                 step_params["ticker"] = t
                 # Clear tickers_source to avoid confusion in recursive calls
                 if "tickers_source" in step_params: del step_params["tickers_source"]
                 
                 try:
                     return await handler(args=[t], ai_params=step_params, is_called_by_ai=True)
                 except Exception as e:
                     return {"ticker": t, "error": str(e)}

         tasks = [_process_single_ticker(i, t) for i, t in enumerate(target_tickers)]
         results = await asyncio.gather(*tasks)
         
         # Sort and Return
         def get_score(item):
             s = item.get('score', item.get('quick_score', item.get('total_score', 0)))
             return safe_float(s)
         try: results.sort(key=get_score, reverse=True)
         except: pass
         
         output_limit = int(params.get("limit", 10))
         final_output = results[:output_limit]
         return {
             "top_10": final_output[:10],
             "tickers": results, 
             "results": final_output,
             "count": len(final_output),
             "message": f"Results for {len(final_output)} items."
         }

    # Normal Single Execution (including Research with list)
    try:
        sig = inspect.signature(handler)
        kwargs = {"args": [], "ai_params": params, "is_called_by_ai": True}
        if "progress_callback" in sig.parameters:
            kwargs["progress_callback"] = progress_callback
        return await handler(**kwargs)
    except Exception as e:
        logger.error(f"Step Execution Error: {e}")
        return {"error": str(e)}


async def run_sentinel(user_prompt: str, plan_override: Optional[List[Dict[str, Any]]] = None, execution_mode: str = "auto") -> AsyncGenerator[Dict[str, Any], None]:
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
             yield {"type": "error", "message": "Failed to generate a valid execution plan."}
             return

        # --- Enforce Summary Step ---
        has_summary = any(step.get("tool") == "summary" for step in plan)
        if not has_summary:
            logger.info("Plan missing summary step. Auto-appending.")
            plan.append({
                "step_id": len(plan) + 1,
                "tool": "summary",
                "params": {"data_source": "$CONTEXT"},
                "description": "Auto-Generated Mission Report"
            })

        context = {}
        
        for step in plan:
            step_id = step.get("step_id")
            tool_name = step.get("tool")
            description = step.get("description", tool_name)
            output_key = step.get("output_key", f"step_{step_id}_output")
            
            yield {"type": "status", "message": f"Step {step_id}: {description}..."}
            
            queue = asyncio.Queue()
            
            async def progress_callback(msg: str):
                await queue.put(msg)
                
            async def wrapped_execution():
                return await execute_step(step, context, progress_callback=progress_callback)

            exec_task = asyncio.create_task(wrapped_execution())
            get_future = None
            
            while True:
                if exec_task.done():
                     break

                if get_future is None:
                    get_future = asyncio.ensure_future(queue.get())

                done_futures, pending = await asyncio.wait(
                    [get_future, exec_task], 
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=5.0 
                )
                
                if not done_futures:
                    yield {"type": "ping"}
                    continue
                
                if get_future in done_futures:
                    try:
                        msg = get_future.result()
                        get_future = None
                        if msg is None: break
                        yield {"type": "status", "message": f"Step {step_id}: {msg}"}
                    except Exception:
                        get_future = None
                
                if exec_task.done():
                    break
            
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

            if isinstance(result, dict) and "error" in result:
                 yield {"type": "error", "message": f"Step {step_id} failed: {result['error']}"}
                 context[output_key] = result
            else:
                 context[output_key] = result
                 
                 if tool_name == "summary":
                     yield {"type": "summary", "message": result}
                 else:
                     # Aggressive Recursive Sanitizer
                     def sanitize_for_display(obj, depth=0):
                         if depth > 3: return "..."
                         
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
                         return obj
                     
                     sanitized = sanitize_for_display(result)
                     yield {"type": "step_result", "step_id": step_id, "result": sanitized}

        yield {"type": "final", "context": context}

    except Exception as e:
        logger.error(f"Sentinel Global Crash: {e}")
        logger.error(traceback.format_exc())
        yield {"type": "error", "message": f"Critical System Failure: {str(e)}"}
