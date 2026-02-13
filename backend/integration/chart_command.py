import asyncio
import logging
import re
from typing import List, Dict, Any, Set, AsyncGenerator

# Import tool handlers
from backend.integration.quickscore_command import handle_quickscore_command
from backend.integration.mlforecast_command import handle_mlforecast_command
from backend.integration.assess_command import handle_assess_command
from backend.integration.sentiment_command import handle_sentiment_command

logger = logging.getLogger("chart_command")

# --- Column Mapping Logic ---
# Maps specific column patterns to the tools required to fetch them
# and the specific key/index to extract from the tool's result.

# QuickScore: Returns { "scores": { "1": { "score": "8.5%" } ... } }
# Mappings: "QS 1" -> scores['1']['score'], "QS 5y" -> scores['1']['score']
QS_MAPPING = {
    r"QS\s*1|QUICKSCORE\s*5Y": ("quickscore", "1"),
    r"QS\s*2|QUICKSCORE\s*1Y": ("quickscore", "2"),
    r"QS\s*3|QUICKSCORE\s*6MO": ("quickscore", "3"),
}

# ML Forecast: Returns { "table": [ { "Period": "5-Day", "Prediction": "UP" ... } ] }
# Mappings: "MLF 1" -> Period "5-Day", "MLF 5" -> Period "1-Year"
MLF_MAPPING = {
    r"MLF\s*1|ML\s*FORECAST\s*5D": ("mlforecast", "5-Day"),
    r"MLF\s*2|ML\s*FORECAST\s*1MO": ("mlforecast", "1-Month (21-Day)"),
    r"MLF\s*3|ML\s*FORECAST\s*3MO": ("mlforecast", "3-Month (63-Day)"),
    r"MLF\s*4|ML\s*FORECAST\s*6MO": ("mlforecast", "6-Month (26-Week)"),
    r"MLF\s*5|ML\s*FORECAST\s*1Y": ("mlforecast", "1-Year (52-Week)"),
}

# Assess A: Returns { "rows": [ [Ticker, Chg, AAPC, VolScore, IV, Rank, Beta, Corr, Match] ] }
# Indices in row: 
# 0: Ticker, 1: Change, 2: AAPC, 3: VolScore, 4: IV, 5: VolRank, 6: Beta, 7: Corr
ASSESS_A_MAPPING = {
    r"AA\s*B|ASSESS\s*A\s*BETA": ("assess_a", 6),
    r"AA\s*C|ASSESS\s*A\s*CORR.*": ("assess_a", 7),
    r"AA\s*AAPC|ASSESS\s*A\s*AAPC": ("assess_a", 2), # AAPC
    r"AA\s*IV$|ASSESS\s*A\s*IV$": ("assess_a", 4),   # IV
    r"AA\s*IVR|ASSESS\s*A\s*IVR": ("assess_a", 5),   # Vol Rank
}

# Sentiment: Returns { "sentiment_score_raw": 0.45, "summary": ... }
SENTIMENT_MAPPING = {
    r"^S$|SENTIMENT$": ("sentiment", "score"),
}

async def stream_ticker_tools(ticker: str, required_tools: Set[str], column_instructions: List[Dict]) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Yields cell updates for a single ticker as tools complete.
    """
    # 1. Define Tool Handlers

    async def run_tool(tool_name):
        for attempt in range(3): # 3 Attempts Total
            try:
                if attempt > 0:
                    await asyncio.sleep(1 * attempt) # Backoff
                
                result = None
                if tool_name == "quickscore":
                    result = await handle_quickscore_command([], ai_params={"ticker": ticker}, is_called_by_ai=True)
                elif tool_name == "mlforecast":
                    result = await handle_mlforecast_command([], ai_params={"ticker": ticker, "skip_graph": True}, is_called_by_ai=True)
                elif tool_name == "assess_a":
                    # Defaulting to 1Y/3 risk for general assessment
                    result = await handle_assess_command([], ai_params={"assess_code": "A", "ticker": ticker, "timeframe_str": "1Y", "risk_tolerance": 3}, is_called_by_ai=True)
                elif tool_name == "sentiment":
                    result = await handle_sentiment_command([], ai_params={"ticker": ticker}, is_called_by_ai=True)
                
                # Check for soft errors to trigger retry
                if result is None:
                    raise ValueError("Result is None")
                if isinstance(result, dict) and "error" in result:
                    raise ValueError(f"Tool returned error: {result['error']}")
                
                return result

            except Exception as e:
                logger.error(f"Attempt {attempt+1} failed for {tool_name}/{ticker}: {e}")
                if attempt == 2: # Last attempt
                    return None
        return None # Should be unreachable given return in loop

    # 2. Launch Tasks
    tasks = []
    tool_map = {}
    for tool in required_tools:
        task = asyncio.create_task(run_tool(tool))
        tasks.append(task)
        tool_map[task] = tool

    # 3. Yield Results as they complete
    pending = set(tasks)
    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        
        for task in done:
            tool_type = tool_map[task]
            try:
                result = task.result()
            except Exception as e:
                logger.error(f"Task exception for {tool_type}/{ticker}: {e}")
                result = None

            # 4. Map Result to Columns and Yield
            # Find all columns that depend on this tool
            relevant_cols = [c for c in column_instructions if c["tool_type"] == tool_type]
            
            for col_def in relevant_cols:
                col_id = col_def["id"]
                extract_key = col_def["extract_key"]
                value = "N/A"

                try:
                    if not result or (isinstance(result, dict) and "error" in result):
                        value = "N/A"
                    else:
                        # --- Logic matches original extraction ---
                        if tool_type == "quickscore":
                            scores = result.get("scores", {})
                            if str(extract_key) in scores:
                                value = scores[str(extract_key)].get("score", "N/A")
                            else: value = "N/A"

                        elif tool_type == "mlforecast":
                            table = result.get("table", [])
                            match = next((row for row in table if row.get("Period") == extract_key), None)
                            if match:
                                change = match.get("Est. % Change", "")
                                # Clean: Remove UP/DOWN/+, strip
                                change_clean = change.replace("UP", "").replace("DOWN", "").replace("+", "").strip()
                                value = change_clean if change_clean else "N/A"
                            else:
                                value = "N/A"

                        elif tool_type == "assess_a":
                            rows = result.get("rows", [])
                            if rows:
                                row = rows[0]
                                idx = int(extract_key)
                                if len(row) > idx:
                                    raw = str(row[idx])
                                    value = "N/A" if raw in ["Data Error", "None", "nan"] else raw
                                else: value = "N/A"
                            else: value = "N/A"

                        elif tool_type == "sentiment":
                            try:
                                score = float(result.get("sentiment_score_raw", 0.0))
                                value = f"{score:.2f}"
                            except: value = "0.00"

                except Exception as extract_err:
                    logger.error(f"Extraction error {col_id}/{ticker}: {extract_err}")
                    value = "N/A"
                
                # Yield UPDATE for this specific cell
                yield {
                    "type": "update",
                    "ticker": ticker,
                    "col_id": col_id,
                    "value": value
                }

async def stream_chart_completion(tickers: List[str], columns: List[str]) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Streams chart completion data with cell-level granularity.
    """
    if not tickers or not columns:
        yield {"type": "error", "message": "No tickers or columns provided."}
        return

    # 1. Parse Columns & Tools
    required_tools = set()
    column_instructions = [] 
    
    for col in columns:
        col_upper = col.upper().strip()
        matched = False
        # Check mappings (QS, MLF, Assess, Sentiment)
        for mapping in [QS_MAPPING, MLF_MAPPING, ASSESS_A_MAPPING, SENTIMENT_MAPPING]:
            for pattern, (tool, key) in mapping.items():
                if re.search(pattern, col_upper):
                    required_tools.add(tool)
                    column_instructions.append({"id": col, "tool_type": tool, "extract_key": key})
                    matched = True
                    break
            if matched: break
        
        if not matched:
            column_instructions.append({"id": col, "tool_type": "unknown", "extract_key": None})

    # 2. Initial Handshake
    total_cells = len(tickers) * len(columns)
    yield {
        "type": "start",
        "total_tickers": len(tickers),
        "total_columns": len(columns), 
        "total_cells": total_cells,
        "columns": columns
    }

    # 3. Processing Loop (Queue-based Concurrency)
    queue = asyncio.Queue()
    # Limit CONCURRENT TICKERS (not just tools) to prevent overloading
    CONCURRENCY_LIMIT = 3 
    semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)

    async def worker(ticker):
        async with semaphore:
            await queue.put({"type": "row_start", "ticker": ticker})
            try:
                async for update in stream_ticker_tools(ticker, required_tools, column_instructions):
                    await queue.put(update)
            except Exception as e:
                logger.error(f"Stream worker error {ticker}: {e}")
            finally:
                await queue.put(None) # Metadata signal: Ticker Done

    # Start workers
    tasks = [asyncio.create_task(worker(t)) for t in tickers]
    
    # Consume queue
    completed_tickers = 0
    total_tickers_count = len(tickers)

    while completed_tickers < total_tickers_count:
        item = await queue.get()
        if item is None:
            completed_tickers += 1
        else:
            yield item

    # Cleanup
    for t in tasks: t.cancel()
    yield {"type": "done"}
