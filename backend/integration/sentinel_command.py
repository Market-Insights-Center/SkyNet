import asyncio
import json
import logging
import traceback
import inspect
import re
from typing import List, Dict, Any, Optional, AsyncGenerator

# --- Usage Counter Import (Graceful Fallback) ---
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

# --- Tool Handlers ---

async def handle_research_tool(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Performs a web search using DuckDuckGo. 
    Supports 'query' (single string) or 'tickers_source' (list of tickers).
    Resolves company names for better search results.
    """
    query = params.get("query", "")
    limit = int(params.get("limit", 5))
    
    queries = []
    
    # --- Context / Ticker Support with Name Resolution ---
    if "tickers_source" in params:
        tickers_source = params["tickers_source"]
        
        if isinstance(tickers_source, list):
            import yfinance as yf
            
            async def get_search_term(symbol):
                try:
                    # Run blocking yfinance call in a thread
                    tick = await asyncio.to_thread(lambda: yf.Ticker(symbol))
                    info = await asyncio.to_thread(lambda: tick.info)
                    name = info.get('shortName') or info.get('longName')
                    return f"{symbol} ({name})" if name else symbol
                except:
                    return symbol
            
            # Limit parallel fetches to avoid rate limits or timeouts
            search_terms = await asyncio.gather(*[get_search_term(t) for t in tickers_source[:5]])
            
            for term in search_terms:
                queries.append(f"Latest financial news, analysis, and future outlook for {term}")
    
    if query:
        queries.append(query)
        
    if not queries: return {"error": "No query or tickers provided for research."}
        
    try:
        from duckduckgo_search import DDGS
        
        all_results = []
        
        # Parallelize research if multiple queries
        async def run_search(q):
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
            "message": f"Found {len(all_results)} results for research."
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
         # Split by comma or newline. CLEANUP: Strip '$' and whitespace.
         tickers = [t.strip().upper().lstrip('$') for t in tickers_input.replace('\n', ',').replace('$', '').split(',') if t.strip()]
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

async def handle_summary_tool(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Summarizes the provided context data and aligns it with structured ground truth.
    Returns: {"report": str, "data": List[Dict]}
    """
    data = params.get("context_data", {})
    user_query = params.get("user_query", "the user request")
    
    # --- 1. Fetch Real Company Names (Anti-Hallucination) ---
    all_tickers = set()
    
    # Scan context for tickers
    for k, v in data.items():
        if isinstance(v, dict) and "tickers" in v:
            for t in v["tickers"]: 
                if isinstance(t, str): all_tickers.add(t)
                elif isinstance(t, dict) and "ticker" in t: all_tickers.add(t["ticker"])
        elif isinstance(v, list):
             for item in v:
                 if isinstance(item, dict) and "ticker" in item: all_tickers.add(item["ticker"])
    
    import yfinance as yf
    name_map = {}
    
    if all_tickers:
        async def fetch_name(t):
            try:
                tick = await asyncio.to_thread(lambda: yf.Ticker(t))
                info = await asyncio.to_thread(lambda: tick.info)
                return t, info.get('shortName') or info.get('longName') or t
            except:
                return t, t
        
        async def fetch_with_timeout(t):
            try:
                return await asyncio.wait_for(fetch_name(t), timeout=3.0)
            except:
                return t, t

        results = await asyncio.gather(*[fetch_with_timeout(t) for t in list(all_tickers)])
        for t, name in results:
            name_map[t] = name

    # --- 2. Build Structured Master Data ---
    # We aggregate ALL metrics into a single source of truth
    master_data = {} # {ticker: {data}}

    def get_record(t):
        if t not in master_data:
            master_data[t] = {
                "ticker": t,
                "company_name": name_map.get(t, t),
                "quickscore": "N/A",
                "ml_forecast": [],
                "iv": "N/A",
                "ivr": "N/A",
                "gap": "N/A", # AAPC
                "beta": "N/A",
                "correlation": "N/A",
                "sentiment": "N/A"
            }
        return master_data[t]

    for k, v in data.items():
        # --- Handle Assess Data ---
        if "assess" in k and isinstance(v, dict):
            # Table format (Code A)
            if "rows" in v and isinstance(v["rows"], list) and "headers" in v:
                headers = [h.lower() for h in v["headers"]]
                try:
                    idx_ticker = next(i for i, h in enumerate(headers) if "ticker" in h)
                    idx_beta = next((i for i, h in enumerate(headers) if "beta" in h), -1)
                    idx_corr = next((i for i, h in enumerate(headers) if "corr" in h), -1)
                    idx_aapc = next((i for i, h in enumerate(headers) if "aapc" in h or "change" in h or "gap" in h), -1)
                    idx_iv = next((i for i, h in enumerate(headers) if "iv" in h and "rank" not in h), -1)
                    idx_ivr = next((i for i, h in enumerate(headers) if "rank" in h or "ivr" in h), -1)
                except:
                    idx_ticker, idx_aapc, idx_iv, idx_ivr, idx_beta, idx_corr = 0, 2, 4, 5, 6, 7

                for row in v["rows"]:
                    try:
                        t = row[idx_ticker]
                        rec = get_record(t)
                        if idx_beta != -1: rec["beta"] = row[idx_beta]
                        if idx_corr != -1: rec["correlation"] = row[idx_corr]
                        if idx_aapc != -1: rec["gap"] = row[idx_aapc]
                        if idx_iv != -1: rec["iv"] = row[idx_iv]
                        if idx_ivr != -1: rec["ivr"] = row[idx_ivr]
                    except: continue

            # List of Dicts format
            elif "results" in v and isinstance(v["results"], list):
                for res in v["results"]:
                    t = res.get('ticker')
                    if not t: continue
                    rec = get_record(t)
                    rec["beta"] = res.get('beta', rec["beta"])
                    rec["correlation"] = res.get('correlation', rec["correlation"])
                    rec["gap"] = res.get('aapc', rec["gap"])
                    rec["iv"] = res.get('iv', rec["iv"])
                    rec["ivr"] = res.get('ivr', rec["ivr"])
            
            # Direct Dict format
            elif "data" in v and isinstance(v["data"], dict):
                for t, metrics in v["data"].items():
                    rec = get_record(t)
                    rec["beta"] = metrics.get('beta', rec["beta"])
                    rec["correlation"] = metrics.get('correlation', rec["correlation"])
                    rec["gap"] = metrics.get('aapc', rec["gap"])
                    rec["iv"] = metrics.get('iv', rec["iv"])
                    rec["ivr"] = metrics.get('ivr', rec["ivr"])

        # --- Handle ML Forecasts ---
        if "mlforecast" in k:
            ml_list = v.get("table", v) if isinstance(v, dict) else v
            if isinstance(ml_list, list):
                for item in ml_list:
                    t = item.get("Ticker", item.get("ticker"))
                    if not t: continue
                    rec = get_record(t)
                    rec["ml_forecast"].append({
                        "period": item.get("Period", "Unknown"),
                        "prediction": item.get("Prediction", "N/A"),
                        "confidence": item.get("Confidence", ""),
                        "change": item.get("Est. % Change", "")
                    })

        # --- Handle Quickscore ---
        if "quickscore" in k:
            qs_list = v.get("results", []) if isinstance(v, dict) else v
            if isinstance(qs_list, list):
                 for item in qs_list:
                     t = item.get("ticker")
                     if not t: continue
                     rec = get_record(t)
                     rec["quickscore"] = item.get("score", item.get("quick_score", "N/A"))

    # Convert to clean list
    structured_results = list(master_data.values())
    
    # Filter out empty records that might have been created by noise
    # structured_results = [r for r in structured_results if r["ticker"] in all_tickers] # REMOVED STRICT FILTER

    # Rank by Quickscore (descending)
    # Rank by Quickscore (descending)
    def parse_score(r):
        try: return float(r.get("quickscore", -1))
        except: return -1
    
    try:
        structured_results.sort(key=parse_score, reverse=True)
    except Exception as e:
        logger.warning(f"Sorting failed: {e}")

    structured_json = json.dumps(structured_results, indent=2)

    import datetime
    today = datetime.datetime.now().strftime("%Y-%m-%d")

    # --- HALLUCINATION GUARD ---
    if not structured_results:
        logger.warning("Summary requested but NO structured data found in context.")
        return {
            "report": f"# Analysis Failed\n\nSentinel AI could not retrieve data for the requested assets. This may be due to:\n1. Invalid Tickers\n2. Data Feed Failure\n3. Market Closed",
            "data": []
        }

    prompt = f"""
    You are the Strategy Analyst for Sentinel AI.
    Current System Date: {today}
    User Request: "{user_query}"
    
    ### GROUND TRUTH DATA (OFFICIAL RECORD):
    {structured_json}
    
    ### CRITICAL INSTRUCTIONS:
    1. **STRICT DATA ADHERENCE:** You must ONLY use the data provided in the "GROUND TRUTH DATA" JSON above. 
    2. **ZERO TOLERANCE FOR HALLUCINATION:** 
       - Do **NOT** invent tickers (e.g. XYZ123, ABC456). 
       - Do **NOT** invent metrics.
       - If a specific metric is "N/A" or missing for a ticker, you MUST write "N/A" in the table.
       - If the JSON list is empty, state "No data available."
    3. **MASTER TABLE REQURIED:** You MUST create a Markdown table named "Master Data Table".
       - Columns: Asset (Ticker), Company Name, Quickscore, ML Forecasts, AAPC (Gap), IV, IVR, Beta, Correlation.
       - The table must contain ALL rows from the JSON data.
    4. **EXECUTIVE SUMMARY:** Summarize the top opportunities (High Quickscore/Forecast) vs risks based ONLY on the provided JSON.
    
    Format:
    # Executive Summary
    [Summary Text]

    # Master Data Table
    | Asset | Company Name | Quickscore | ML Forecasts | AAPC | IV | IVR | Beta | Correlation |
    |-------|--------------|------------|--------------|------|----|-----|------|-------------|
    | ...   | ...          | ...        | ...          | ...  | ...| ... | ...  | ...         |

    # Detailed Analysis
    [Per Ticker Analysis]

    # Verdict
    [Final Recommendation]
    """
    
    try:
        report_text = await ai.generate_content(prompt)
        # Final Safety Check: If report contains "XYZ123" or similar, fail it.
        if "XYZ123" in report_text or "TechnoLogix" in report_text:
             logger.error("AI Hallucinated despite instructions. Returning raw data.")
             return { "report": "AI Generation Failed (Hallucination Detected). Please review the raw data table below.", "data": structured_results }
             
        return {"report": report_text, "data": structured_results}
    except Exception as e:
        return {"report": f"Summary generation failed: {e}", "data": []}

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
12. **assess**: Advanced risk and correlation metrics. Params: 'tickers_source' (source), 'assess_code' (e.g., 'A' for volatility, 'B' for manual portfolio).

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
7. **Ticker Handling**: If the user lists tickers (e.g. "AAPL, TSLA"), use the `manual_list` tool. Do NOT use `nexus_import` unless a code (like "NEXUS-88") is explicitly provided.
8. **Ambiguous Requests**: If the user asks to "List tickers..." or "Find stocks..." but does NOT provide specific tickers, they want you to DISCOVER them. Use the `market` tool (e.g. `market_type='plus'` or `'sp500'`). Do NOT use `manual_list` with empty tickers.

{mode_instructions}
"""

async def plan_execution(user_prompt: str, execution_mode: str = "auto") -> List[Dict[str, Any]]:
    logger.info(f"Planning execution for: {user_prompt} (Mode: {execution_mode})")
    
    mode_instructions = ""
    if execution_mode == "plan_and_review":
        mode_instructions = "MODE: PLAN AND REVIEW (Detailed, Step-by-Step)"
    elif execution_mode == "quick_execute":
        mode_instructions = "MODE: QUICK EXECUTE (Concise, Merged Steps)"
    
    # --- Regex Pre-Processing to Assist Local LLMs ---
    # --- Regex Pre-Processing to Assist Local LLMs ---
    # 1. Priority: Explicit Tickers with '$' (e.g. $AAPL, $BTC)
    explicit_tickers = re.findall(r'\$([A-Z]{2,6})\b', user_prompt.upper())
    
    final_tickers = []
    
    if explicit_tickers:
        # If user was explicit, trust them completely and ignore noise
        final_tickers = list(dict.fromkeys(explicit_tickers))
        logger.info(f"Detected explicit tickers: {final_tickers}")
    else:
        # 2. Fallback: Loose Regex for tickers: 2-6 uppercase letters
        potential_tickers = re.findall(r'\b[A-Z]{2,6}\b', user_prompt.upper())
        
        # Expanded Common Words Stoplist
        common_words = {
            "THE", "AND", "FO", "HAT", "HIS", "ITH", "ROM", "BUT", "ALL", "ARE", "WAS", "WERE", "CAN", "FOR", 
            "USE", "GET", "HEY", "SEE", "RUN", "NOT", "YES", "LOW", "BIG", "NEW", "OLD", "BUY", "SELL", 
            "TOP", "ANY", "NOW", "ONE", "TWO", "SIX", "TEN", "OUT", "PUT", "CALL", "ASK", "BID", 
            "PE", "EPS", "VOL", "CAP", "ROI", "ROE", "ETF", "YTD", "LTD", "INC", "CORP", "PLC", 
            "USA", "USD", "EUR", "GBP", "JPY", "CNY", "CAD", "AUD", "NZD", "CHF", "HKD", "SGD", 
            "SEK", "DKK", "NOK", "TRY", "RUB", "ZAR", "BRL", "INR", "MXN", "PLN", "THB", "IDR", 
            "HUF", "CZK", "ILS", "CLP", "PHP", "AED", "COP", "SAR", "MYR", "RON", 
            "HAVE", "YOUR", "TIME", "SIGNAL", "FROM", "THEIR", "EACH", "FRAME", "ALSO", "DATA", 
            "THIS", "WILL", "WITH", "JUST", "MAKE", "SURE", "LIKE", "LIST", "TERM", "LONG", "SHORT", 
            "RISK", "ANALYSIS", "REPORT", "MISSION", "SENTINEL", "PLEASE", "COMPARE", "USING", "GENERAL", 
            "RESEARCH", "THEIR", "NUMBERS", "SCORES", "BETA", "CORRELATION", "ASSESS", "SCORE", 
            "STRONG", "WEAK", "WHERE", "WHAT", "WHEN", "WHY", "HOW", "ABOUT", "ABOVE", "BELOW",
            "FIND", "FOUND", "SHOW", "TELL", "GIVE", "NEED", "WANT", "LOOK", "CHECK", "SCAN",
            "BEST", "WORST", "GOOD", "BAD", "HIGH", "AVG", "MED", "MIN", "MAX", "STD", "VAR",
            "IVR", "IV", "GAP", "AAPC", "YIELD", "PRICE", "VALUE", "COST", "FUND", "REAL", "TRUE",
            "TEST", "PROMPT", "THINGS", "FETCH", "OF"
        }
        
        # Filter based on common words
        filtered_tickers = [t for t in potential_tickers if t not in common_words]
        final_tickers = list(dict.fromkeys(filtered_tickers))

    formatted_system_prompt = SYSTEM_PROMPT_PLANNER.replace("{mode_instructions}", mode_instructions)
    
    # INJECTION: Force the model to see the tickers we found
    if final_tickers:
        formatted_system_prompt += f"\n\n[SYSTEM HINT]: I detected potential tickers in the user request: {json.dumps(final_tickers)}. YOU MUST use this exact list for 'tickers_source' in your tools. Do NOT use 'nexus_import' unless a specific code like 'NEXUS-123' is provided. Use 'manual_list' for these tickers."

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
        tools_scheduled = set()

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
                
                # --- SAFETY NET: Fix Hallucinated Nexus Import ---
                was_swapped_import = False
                if item.get("tool") == "nexus_import":
                    # If AI chose nexus_import but didn't provide a valid code...
                    code = item["params"].get("nexus_code", "")
                    if (not code or "code" in code.lower() or code.startswith("$")) and final_tickers:
                        logger.warning("Planner hallucinated Nexus Import without code. Hot-swapping to Manual List & Injecting Analysis.")
                        item["tool"] = "manual_list"
                        item["params"]["tickers"] = final_tickers
                        item["description"] = "Auto-Corrected: Loaded detected tickers."
                        was_swapped_import = True
                        was_swapped_import = True
                
                # --- SAFETY NET: Fix Hallucinated Manual List ---
                if item.get("tool") == "manual_list":
                    # Check if tickers are populated
                    current_tickers = item["params"].get("tickers", [])
                    if not current_tickers:
                        if final_tickers:
                            logger.warning("Planner used manual_list with empty tickers. Injecting regex-found tickers.")
                            item["params"]["tickers"] = final_tickers
                            item["description"] = "Auto-Corrected: Loaded detected tickers."
                        else:
                            logger.warning("Planner used manual_list with NO tickers and NO regex matches. Swapping to Market Scan.")
                            item["tool"] = "market"
                            item["params"] = {"market_type": "plus", "sensitivity": 2} 
                            item["description"] = "Auto-Corrected: Scanning Market for Candidates."
                            # NOTE: Downstream tools referencing "$step_N.tickers" will resolve via "top_10" in context resolution logic.

                # 4. Check Valid Tool
                if item.get("tool") in COMMAND_REGISTRY:
                    valid_plan.append(item)
                    tools_scheduled.add(item.get("tool"))
                    
                    # INJECTION: If we swapped import->list, we MUST add analysis steps because the AI likely forgot them
                    if was_swapped_import:
                        pipeline = ["quickscore", "mlforecast", "fundamentals", "sentiment", "assess"]
                        for idx, tool in enumerate(pipeline):
                            step_params = {"tickers_source": "$manual_list.tickers", "limit": 10}
                            if tool == "assess":
                                step_params["assess_code"] = "A"

                            valid_plan.append({
                                "step_id": 900 + idx, # Arbitrary high ID to avoid conflict
                                "tool": tool,
                                "params": step_params,
                                "description": f"Auto-Injected Analysis: {tool}"
                            })
                            tools_scheduled.add(tool)

        # --- CRITICAL INJECTION LOGIC ---
        # 1. Ensure a Source Step Exists
        source_tools = ["manual_list", "market", "nexus_import"]
        has_source = any(t in tools_scheduled for t in source_tools)
        
        injected_source_step = False
        if not has_source and final_tickers:
            logger.info("Injecting missing 'manual_list' source step.")
            valid_plan.insert(0, {
                "step_id": 900,
                "tool": "manual_list",
                "params": {"tickers": final_tickers},
                "output_key": "step_1_output", # Will be re-indexed to step 1
                "description": "Auto-Injected Source: Loaded detected tickers."
            })
            tools_scheduled.add("manual_list")
            injected_source_step = True

        # 2. Re-Index steps so we can reference them correctly
        for i, step in enumerate(valid_plan): 
            step["step_id"] = i + 1
            step["output_key"] = f"step_{i+1}_output"

        # 3. Determine Source Reference for Analysis Tools
        # If we just injected manual_list at 0, it is now Step 1.
        source_ref = "$step_1_output.tickers"
        
        # If manual_list was already there, find its step ID
        if not injected_source_step:
            for step in valid_plan:
                if step["tool"] == "manual_list":
                    source_ref = f"${step['output_key']}.tickers"
                    break
                elif step["tool"] == "market":
                    source_ref = f"${step['output_key']}.top_10"
                    break
                elif step["tool"] == "nexus_import":
                    source_ref = f"${step['output_key']}.tickers"
                    break

        # 4. Inject Missing Analysis Tools (Assess / ML Forecast)
        keywords_assess = ["assess", "beta", "correlation", "volatility", "risk"]
        keywords_ml = ["forecast", "prediction", "future", "price target", "projection"]
        
        # Inject Assess if missing
        if any(k in user_prompt.lower() for k in keywords_assess) and "assess" not in tools_scheduled:
            logger.info("Injecting missing 'assess' tool.")
            # Insert before summary
            insert_idx = len(valid_plan)
            for i, step in enumerate(valid_plan):
                if step.get("tool") == "summary":
                    insert_idx = i
                    break
            
            valid_plan.insert(insert_idx, {
                "step_id": 998, # Temp ID
                "tool": "assess",
                "params": {"tickers_source": source_ref, "assess_code": "A"},
                "description": "Auto-Injected Risk Analysis (Beta/Correlation)"
            })
            
        # Inject ML Forecast if missing
        if any(k in user_prompt.lower() for k in keywords_ml) and "mlforecast" not in tools_scheduled:
             logger.info("Injecting missing 'mlforecast' tool.")
             insert_idx = len(valid_plan)
             for i, step in enumerate(valid_plan):
                if step.get("tool") == "summary":
                    insert_idx = i
                    break

             valid_plan.insert(insert_idx, {
                "step_id": 999, # Temp ID
                "tool": "mlforecast",
                "params": {"tickers_source": source_ref},
                "description": "Auto-Injected Price Forecasting"
            })
        
        # Final Re-index
        for i, step in enumerate(valid_plan): 
            step["step_id"] = i + 1
            step["output_key"] = f"step_{i+1}_output"

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
    tool_name = step.get("tool")
    params = step.get("params", {})
    
    if tool_name not in COMMAND_REGISTRY:
        return {"error": f"Tool '{tool_name}' not found."}
    
    handler = COMMAND_REGISTRY[tool_name]
    logger.info(f"Executing Step {step.get('step_id')}: {tool_name} with params {params}")
    
    target_tickers = []
    
    # --- Context Resolution ---
    if "tickers_source" in params:
        source_key = params["tickers_source"]
        
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
                     elif isinstance(item, str): target_tickers.append(item.lstrip('$'))
                 
                 logger.info(f"Resolved {len(target_tickers)} context tickers")
             else:
                 return {"error": f"Dependency {base_var} failed."}

    # IMPORTANT: Inject the resolved tickers into params so handlers like 'research' can use them directly
    if target_tickers:
        params["tickers_source"] = target_tickers

    # --- Data Source Resolution (Generic) ---
    if params.get("data_source") == "$CONTEXT":
        params["context_data"] = context

    # Check if tool supports internal batching or doesn't need iteration
    if tool_name in ["summary", "manual_list", "research", "nexus_import", "risk", "briefing"]:
        try:
            sig = inspect.signature(handler)
            kwargs = {"args": [], "ai_params": params, "is_called_by_ai": True}
            if "progress_callback" in sig.parameters:
                kwargs["progress_callback"] = progress_callback
            return await handler(**kwargs)
        except Exception as e:
            logger.error(f"Step Execution Error: {e}")
            return {"error": str(e)}

    # Batch Iteration for Analytical Tools (mlforecast, sentiment, assess, etc)
    if target_tickers:
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
                     # CLEANUP: Ensure ticker is clean before passing to tool
                     clean_ticker = t.lstrip('$').strip().upper()
                     return await handler(args=[clean_ticker], ai_params=step_params, is_called_by_ai=True)
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
    else:
        # Fallback for empty tickers
        return {"error": "No tickers provided for execution."}


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
                     # Unpack structured result
                     report_msg = result.get("report", str(result))
                     data_payload = result.get("data", [])
                     yield {"type": "summary", "message": report_msg, "data": data_payload}
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