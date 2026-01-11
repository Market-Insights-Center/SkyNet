
import asyncio
import json
import logging
import traceback
from typing import List, Dict, Any, Optional
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

# Configure Logging
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
    # "mlforecast": mlforecast_command.handle_mlforecast_command, # Might need adaptation
    "powerscore": powerscore_command.handle_powerscore_command,
    "quickscore": quickscore_command.handle_quickscore_command,
    "summary": lambda args, ai_params, is_called_by_ai: handle_summary_tool(ai_params)
}

async def handle_summary_tool(params: Dict[str, Any]) -> str:
    """
    Summarizes the provided context data.
    """
    data = params.get("context_data", {})
    user_query = params.get("user_query", "the user request")
    
    # If data is large string/dict, truncate if needed, but for now just dump it.
    prompt = f"Summarize these execution results for {user_query}:\n\nData:\n{json.dumps(data, default=str)[:15000]}"
    
    """
    Summarizes the provided context data.
    """
    data = params.get("context_data", {})
    user_query = params.get("user_query", "the user request")
    
    # Explicitly request Markdown and Text
    prompt = f"""
    Write a comprehensive Mission Report for this request: "{user_query}".
    
    Data:
    {json.dumps(data, default=str)[:15000]}
    
    Format Rules:
    1. Use Markdown formatting (headers, bold, bullet points).
    2. If there are lists of stocks, use a Markdown Table.
    3. Do NOT output a code block (no ```json).
    4. Start with a clear "Mission Outcome" statement.
    """
    
    return await ai.generate_content(prompt)

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

Rules:
1. **Break it down**: If the user asks for "market and then sentiment", that is TWO steps.
2. **Context Chaining**: 
    - For commands like `sentiment`, `powerscore` use `tickers_source`.
    - If the user implies using the result of a previous step, set `tickers_source` to `"$step_N_output.top_10"`.
3. **Final Summary**: ALWAYS end the plan with a "summary" step using "data_source": "$CONTEXT".
4. **Format**: Return ONLY valid JSON. The JSON must be a list of steps.

Example 1: "Run market scan sens 2 then sentiment on top 3"
[
Rules:
1. **Break it down**: If the user asks for "market and then sentiment", that is TWO steps.
2. **Context Chaining**: 
    - For commands like `sentiment`, `powerscore` use `tickers_source`.
    - If the user implies using the result of a previous step, set `tickers_source` to `"$step_N_output.top_10"`.
3. **Defaults**: Unless specified otherwise, set `limit` to 10.
4. **Final Summary**: ALWAYS end the plan with a "summary" step using "data_source": "$CONTEXT".
5. **Format**: Return ONLY valid JSON. The JSON must be a list of steps.

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

Example 2: "Get market risk and then a briefing"
[
    { "step_id": 1, "tool": "risk", "params": {}, "output_key": "step_1_output", "description": "Check market risk." },
    { "step_id": 2, "tool": "briefing", "params": {}, "output_key": "step_2_output", "description": "Get market briefing." }
]
"""

async def plan_execution(user_prompt: str) -> List[Dict[str, Any]]:
    """
    Uses the AI Service to generate a JSON execution plan from the user prompt.
    """
    logger.info(f"Planning execution for: {user_prompt}")
    
    try:
        response_text = await ai.generate_content(
            prompt=f"User Request: {user_prompt}",
            system_instruction=SYSTEM_PROMPT_PLANNER,
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

async def execute_step(step: Dict[str, Any], context: Dict[str, Any]) -> Any:
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
                
                # Limit handling
                limit = int(params.get("limit", 100))
                target_tickers = target_tickers[:limit]
                
                logger.info(f"Resolved context tickers from {source_key}: {target_tickers}")
            else:
                 logger.warning(f"Context key '{base_var}' not found. Available keys: {list(context.keys())}")
                 return {"error": f"Dependency {base_var} failed or missing."}
    
    # Special handling for Summary Step context injection
    if params.get("data_source") == "$CONTEXT":
        params["context_data"] = context
        # Also pass original user prompt if available in context? 
        # For now, handle_summary_tool defaults to generic query if not found.
    
    # If the tool handles single ticker but we have a list (e.g. Sentiment on Top 3)
    if target_tickers and tool_name in ["sentiment", "powerscore", "quickscore", "fundamentals"]:
        # We need to run this command MULTIPLE times? Or update the command to accept a list?
        # Most of our commands accept a single ticker in args[0].
        # We will iterate here for this specific meta-command logic.
        
        results = []
        for t in target_tickers:
             # Prepare args/params for the function
             # Most handlers take (args, ai_params, is_called_by_ai)
             # args[0] is usually ticker
             
             # Call handler
             res = await handler(args=[t], ai_params={"ticker": t}, is_called_by_ai=True)
             results.append(res)
        
        return results

    # Normal Single Execution
    # Prepare arguments
    # We pass ai_params = params
    
    try:
        result = await handler(args=[], ai_params=params, is_called_by_ai=True)
        return result
    except Exception as e:
        logger.error(f"Step Execution Error: {e}")
        return {"error": str(e)}

async def run_sentinel(user_prompt: str, plan_override: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Main entry point for Sentinel AI.
    1. Plan (or use override)
    2. Execute Loop
    3. Summarize
    """
    await increment_usage('sentinel')
    yield {"type": "status", "message": "Analyzing request..."}
    
    plan = []
    if plan_override:
        plan = plan_override
        yield {"type": "status", "message": "Using provided execution plan..."}
    else:
        plan = await plan_execution(user_prompt)
    
    if not plan:
         yield {"type": "error", "message": "Failed to generate a valid execution plan."}
         return

    yield {"type": "plan", "plan": plan}
    
    context = {}
    
    for step in plan:
        step_id = step.get("step_id")
        tool = step.get("tool")
        desc = step.get("description")
        output_key = step.get("output_key", f"step_{step_id}_output")
        
        yield {"type": "status", "message": f"Executing Step {step_id}: {desc}..."}
        
        result = await execute_step(step, context)
        
        # Store result in context
        context[output_key] = result
        
        # Yield result - distinguishing Summary for special UI handling
        if tool == "summary":
             yield {"type": "summary", "message": result, "step_id": step_id}
        else:
             yield {"type": "step_result", "step_id": step_id, "result": result}
        
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
