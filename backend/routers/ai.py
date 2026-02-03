from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from backend.schemas import (
    AssessRequest, MLForecastRequest, BriefingRequest, FundamentalsRequest,
    QuickscoreRequest, MarketRequest, BreakoutRequest, SentimentRequest,
    PowerScoreRequest, SummaryRequest, SentinelRequest, PrometheusRequest
)
from backend.database import verify_access_and_limits, get_user_profile
from backend.config import SUPER_ADMIN_EMAIL
from backend.usage_counter import increment_usage
import logging
import json
import traceback
import asyncio

# Import commands
try:
    from backend.integration import (
        invest_command, cultivate_command, custom_command, tracking_command,
        risk_command, history_command, quickscore_command, market_command,
        breakout_command, sentiment_command, powerscore_command, summary_command,
        briefing_command, fundamentals_command, assess_command, mlforecast_command,
        sentinel_command
    )
except ImportError:
    try:
        from integration import (
            invest_command, cultivate_command, custom_command, tracking_command,
            risk_command, history_command, quickscore_command, market_command,
            breakout_command, sentiment_command, powerscore_command, summary_command,
            briefing_command, fundamentals_command, assess_command, mlforecast_command,
            sentinel_command
        )
    except: pass

logger = logging.getLogger("uvicorn")
router = APIRouter()

@router.post("/api/invest")
async def api_invest(request: Request):
    try:
        data = await request.json()
        email = data.get('email')
        if email:
            limit_check = verify_access_and_limits(email, "invest")
            if not limit_check["allowed"]:
                raise HTTPException(status_code=403, detail=limit_check["message"])
        result = await invest_command.handle_invest_command([], ai_params=data, is_called_by_ai=True)
        await increment_usage("invest", email)
        return result
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error in /api/invest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/cultivate")
async def api_cultivate(request: Request):
    try:
        data = await request.json()
        email = data.get('email')
        if email:
             limit_check = verify_access_and_limits(email, "cultivate")
             if not limit_check["allowed"]:
                 raise HTTPException(status_code=403, detail=limit_check["message"])
        result = await cultivate_command.handle_cultivate_command([], ai_params=data, is_called_by_ai=True)
        await increment_usage("cultivate", email)
        return result
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error in /api/cultivate: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/custom")
async def api_custom(request: Request):
    try:
        data = await request.json()
        result = await custom_command.handle_custom_command([], ai_params=data, is_called_by_ai=True)
        await increment_usage("custom", data.get('email'))
        return result
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error in /api/custom: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/tracking")
async def api_tracking(request: Request):
    try:
        data = await request.json()
        email = data.get('email')
        if email:
             limit_check = verify_access_and_limits(email, "tracking")
             if not limit_check["allowed"]:
                 raise HTTPException(status_code=403, detail=limit_check["message"])
        result = await tracking_command.handle_tracking_command([], ai_params=data, is_called_by_ai=True)
        await increment_usage("tracking", email)
        return result
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error in /api/tracking: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/risk")
async def api_risk(email: str = "guest"): 
    if email != "guest":
        limit_check = verify_access_and_limits(email, "risk")
    try:
        result, _ = await risk_command.perform_risk_calculations_singularity(is_eod_save=False, is_called_by_ai=True)
        await increment_usage("risk", email)
        return result
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error in /api/risk: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/history")
async def api_history(email: str = "guest"):
    if email != "guest":
        limit_check = verify_access_and_limits(email, "history")
    try:
        result = await history_command.handle_history_command([], is_called_by_ai=True)
        await increment_usage("history", email)
        return result
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error in /api/history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/quickscore")
async def api_quickscore(req: QuickscoreRequest):
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "quickscore")
        if not limit_check["allowed"]:
            raise HTTPException(status_code=403, detail=limit_check["message"])
    result = await quickscore_command.handle_quickscore_command([], ai_params={"ticker": req.ticker}, is_called_by_ai=True)
    await increment_usage("quickscore", req.email)
    return result

@router.post("/api/market")
async def run_market(req: MarketRequest):
    limit_check = verify_access_and_limits(req.email, "market")
    if not limit_check["allowed"]:
        raise HTTPException(status_code=403, detail=limit_check["message"])
    result = await market_command.handle_market_command(
        [], ai_params={"action": "display", "market_type": req.market_type, "sensitivity": req.sensitivity},
        is_called_by_ai=True
    )
    await increment_usage("market", req.email)
    return result

@router.post("/api/breakout")
async def run_breakout(req: BreakoutRequest):
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "breakout")
        if not limit_check["allowed"]:
            raise HTTPException(status_code=403, detail=limit_check["message"])
    result = await breakout_command.handle_breakout_command([], ai_params={"action": "run"}, is_called_by_ai=True)
    await increment_usage("breakout", req.email)
    return result

@router.post("/api/sentiment")
async def run_sentiment(req: SentimentRequest):
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "sentiment")
    result = await sentiment_command.handle_sentiment_command(ai_params={"ticker": req.ticker}, is_called_by_ai=True)
    if not result: raise HTTPException(status_code=500, detail="Sentiment analysis failed.")
    if result.get("status") == "error": raise HTTPException(status_code=400, detail=result.get("message"))
    await increment_usage("sentiment", req.email)
    return result

@router.post("/api/powerscore")
async def run_powerscore(req: PowerScoreRequest):
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "powerscore")
        if not limit_check["allowed"]:
            raise HTTPException(status_code=403, detail=limit_check["message"])

    async def event_generator():
        try:
             async for update in powerscore_command.stream_powerscore_analysis(req.ticker, req.sensitivity, is_called_by_ai=True):
                  yield json.dumps(update, default=str) + "\n"
        except Exception as e:
             logger.error(f"PowerScore Stream Error: {e}")
             traceback.print_exc()
             yield json.dumps({"type": "error", "message": f"Server Error: {str(e)}"}, default=str) + "\n"

    return StreamingResponse(
        event_generator(), media_type="application/x-ndjson", headers={"X-Accel-Buffering": "no"}
    )

@router.post("/api/summary")
async def run_summary(req: SummaryRequest):
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "summary")
    await increment_usage("summary", req.email)
    return await summary_command.handle_summary_command(ai_params={"ticker": req.ticker}, is_called_by_ai=True)

@router.post("/api/briefing")
async def api_briefing(req: BriefingRequest):
    access = verify_access_and_limits(req.email, "briefing")
    if not access["allowed"]:
        raise HTTPException(status_code=403, detail=access["message"])
    try:
        data = await briefing_command.handle_briefing_command([], is_called_by_ai=True)
        await increment_usage("briefing", req.email)
        return data
    except Exception as e:
        logger.error(f"Briefing Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/fundamentals")
async def api_fundamentals(req: FundamentalsRequest):
    access = verify_access_and_limits(req.email, "fundamentals")
    if not access["allowed"]:
        raise HTTPException(status_code=403, detail=access["message"])
    try:
        data = await fundamentals_command.handle_fundamentals_command([], ai_params={"ticker": req.ticker}, is_called_by_ai=True)
        await increment_usage("fundamentals", req.email)
        if data and "error" in data:
             raise HTTPException(status_code=404, detail=data["error"])
        return data
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Fundamentals Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/assess")
async def api_assess_command(req: AssessRequest):
    code = req.assess_code.upper()
    permission_key = f"assess_{code.lower()}"
    limit_check = verify_access_and_limits(req.email, permission_key)
    if not limit_check["allowed"]:
        raise HTTPException(status_code=403, detail=limit_check["message"])

    ai_params = {
        "assess_code": code, "tickers_str": req.tickers_str, "timeframe_str": req.timeframe_str,
        "risk_tolerance": req.risk_tolerance, "backtest_period_str": req.backtest_period_str,
        "manual_portfolio_holdings": req.manual_portfolio_holdings,
        "custom_portfolio_code": req.custom_portfolio_code,
        "value_for_assessment": req.value_for_assessment,
        "cultivate_portfolio_code": req.cultivate_portfolio_code,
        "use_fractional_shares": req.use_fractional_shares, "portfolio_code": req.portfolio_code,
        "start_date": req.start_date, "end_date": req.end_date
    }
    try:
        result = await assess_command.handle_assess_command(
            [], ai_params=ai_params, is_called_by_ai=True, user_id=req.user_id
        )
        await increment_usage("assess", req.email)
        return {"result": result}
    except Exception as e:
        logger.error(f"Assess Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/mlforecast")
async def api_mlforecast_command(req: MLForecastRequest):
    limit_check = verify_access_and_limits(req.email, "mlforecast")
    if not limit_check["allowed"]:
        raise HTTPException(status_code=403, detail=limit_check["message"])
    try:
        results = await mlforecast_command.handle_mlforecast_command(ai_params={"ticker": req.ticker}, is_called_by_ai=True)
        if isinstance(results, dict) and "error" in results:
             raise HTTPException(status_code=400, detail=results["error"])
        await increment_usage("mlforecast", req.email)
        return {"results": results}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"MLForecast Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- SENTINEL ---
@router.post("/api/sentinel/plan")
async def plan_sentinel(req: SentinelRequest):
    plan = await sentinel_command.plan_execution(req.user_prompt, execution_mode=req.execution_mode or "auto")
    return {"plan": plan}

@router.post("/api/sentinel/execute")
async def execute_sentinel(req: SentinelRequest):
    profile = get_user_profile(req.email)
    tier = profile.get("tier", "Basic")
    if str(tier).strip().lower() != "singularity" and req.email.lower() != SUPER_ADMIN_EMAIL:
         raise HTTPException(status_code=403, detail="Sentinel AI requires Singularity Tier.")

    async def event_generator():
        try:
             async for update in sentinel_command.run_sentinel(req.user_prompt, plan_override=req.plan, execution_mode=req.execution_mode or "auto"):
                  yield json.dumps(update, default=str) + "\n"
        except Exception as e:
             traceback.print_exc()
             yield json.dumps({"type": "error", "message": f"Server Error: {str(e)}"}, default=str) + "\n"

    return StreamingResponse(
        event_generator(), media_type="application/x-ndjson", headers={"X-Accel-Buffering": "no"}
    )



@router.post("/api/prometheus")
async def api_prometheus(req: PrometheusRequest):
    # Simulate thinking process for UI
    async def event_generator():
        prompt = req.prompt.lower()
        steps = ["Parsing detailed request parameters..."]
        tool_output = None
        response_text = "Analysis complete."

        # Helper to extract ticker
        def extract_ticker(text):
             words = text.split()
             
             # 1. Priority: Explicit Ticker ($NVDA)
             for w in words:
                  if w.startswith("$") and len(w) > 1:
                       return w.strip("$,.?!").upper()

             # 2. Priority: Common known tickers (if plain text) which are NOT common words
             
             # 3. Fallback: Filtered word search
             common = [
                 "THE", "FOR", "AND", "WITH", "FROM", "THAT", "THIS", "SENTIMENT", "ANALYSIS", "ANALYZE", 
                 "STOCK", "BREAKOUT", "FIND", "SEARCH", "SCAN", "MARKET", "ON", "ABOUT", "WHAT", 
                 "QUICKSCORE", "SCORE", "QUICK", "INVEST", "RISK", "HISTORY", "TRACKING", "CUSTOM",
                 "CULTIVATE", "POWERSCORE", "BRIEFING", "FUNDAMENTALS", "ASSESS", "MLFORECAST", "SENTINEL",
                 "IS", "ARE", "WAS", "WERE", "BE", "BEEN", "BEING", "HAVE", "HAS", "HAD", "DO", "DOES", "DID",
                 "A", "AN", "IN", "OUT", "UP", "DOWN", "LEFT", "RIGHT", "OVER", "UNDER", "AGAINST", "BETWEEN",
                 "INTO", "THROUGH", "DURING", "BEFORE", "AFTER", "ABOVE", "BELOW", "TO", "OF", "AT", "BY",
                 "CONVERGENCE", "DIVERGENCE", "MOMENTUM", "VOLATILITY", "SECTOR", "INDUSTRY", "TECH"
             ]
             
             for w in words:
                  clean = w.strip("$,.?!").upper()
                  # Ticker Length Constraint: Most US tickers are 1-5 chars. 
                  # Longer words like "CONVERGENCE" (11) are likely not tickers unless explicitly marked with $.
                  if clean.isalpha() and 2 <= len(clean) <= 5 and clean not in common:
                       return clean
             return "SPY" # Default

        ticker = extract_ticker(req.prompt)

        # 1. INTENT RECOGNITION & TOOL SELECTION
        if "sentiment" in prompt or "mood" in prompt:
             steps.append("Initializing Sentiment Analysis Engine...")
             steps.append(f"Targeting Asset: {ticker}...")
             
             try:
                 steps.append("Querying social & news vectors...")
                 result = await sentiment_command.handle_sentiment_command(ai_params={"ticker": ticker}, is_called_by_ai=True)
                 
                 valid_data = False
                 if result and result.get("status") == "success":
                      data = result.get("data", {}) if "data" in result else result
                      # Check if we actually have data
                      if data.get("source_counts") and "Found 0" not in data.get("source_counts", ""):
                          valid_data = True
                          score = data.get("compound_score", 0) if "compound_score" in data else data.get("sentiment_score_raw", 0)
                          verdict = "BULLISH" if score > 0.05 else "BEARISH" if score < -0.05 else "NEUTRAL"
                          response_text = f"**Sentiment Analysis for {ticker}**\n\n**Verdict**: {verdict} (Score: {score:.3f})\n\nBased on recent data processing, {ticker} is exhibiting {verdict.lower()} signals. The aggregated sentiment score of {score:.3f} suggests a shift in market perception."
                          
                          # Widget Data
                          widget_payload = {
                              "type": "SENTIMENT_CARD",
                              "data": { "ticker": ticker, "score": score, "verdict": verdict, "details": data.get("summary", "N/A") }
                          }
                          yield json.dumps({"type": "widget", "content": widget_payload}) + "\n"
                      else:
                          pass # Falling through to error message

                 if not valid_data:
                      response_text = f"Could not determine sentiment for {ticker}. Recent social/news data volume is insufficient for a confident score."

             except Exception as e:
                 response_text = f"Sentiment analysis error: {str(e)}"

        elif "breakout" in prompt or "scan" in prompt:
             is_kronos = (req.mode == "GOVERNOR")
             
             if is_kronos:
                 # KRONOS UPGRADE: Use Sentinel for Deep Scanning
                 steps.append("KRONOS: Activating Sentinel Autonomous Scanner...")
                 steps.append("KRONOS: Deploying multi-vector analysis (Market, Risk, Breakout)...")
                 
                 # We trigger a predefined Sentinel plan for "Deep Scan"
                 # Define a manual plan to ensure high quality execution
                 sentinel_plan = [
                      {"step_id": 1, "tool": "market", "params": {"sensitivity": 2, "market_type": "sp500"}, "description": "Scanning S&P 500 for Volatility"},
                      {"step_id": 2, "tool": "risk", "params": {}, "description": "Evaluating Systemic Risk Levels"},
                      {"step_id": 3, "tool": "summary", "params": {"data_source": "$CONTEXT"}, "description": "Synthesizing Strategic Report"}
                 ]
                 
                 # Stream Sentinel Updates
                 try:
                     async for update in sentinel_command.run_sentinel("Deep Scan", plan_override=sentinel_plan, execution_mode="quick_execute"):
                          if update.get("type") == "status":
                              yield json.dumps({"type": "step", "content": f"KRONOS: {update.get('message')}"}) + "\n"
                          elif update.get("type") == "final":
                              # The context has the summary
                              ctx = update.get("context", {})
                              summary_text = ctx.get("final_summary", "Analysis Completed.")
                              if isinstance(summary_text, dict): summary_text = str(summary_text)
                              
                              # Extract key findings from context if available
                              response_text = f"**KRONOS STRATEGIC OUTPUT**\n\n{summary_text}\n\n**Directives:**\n- Align portfolio beta with identified risk.\n- Monitor flagged high-volatility assets."
                          elif update.get("type") == "error":
                               response_text = f"KRONOS EXECUTION ERROR: {update.get('message')}"
                 except Exception as e:
                     response_text = f"Kronos Sentinel Failure: {str(e)}"

             else:
                 # Standard Analyst Breakout
                 steps.append("Analyst: Routing request to Kronos Execution Layer...")
                 steps.append("Analyst: Waiting for scan results...")

                 try:
                     result = await breakout_command.handle_breakout_command([], ai_params={"action": "run"}, is_called_by_ai=True)
                     if result and result.get("status") == "success":
                          breakouts = result.get("data", [])[:5] # Top 5
                          if breakouts:
                               list_str = "\n".join([f"- **{b['ticker']}**: {b['signal_type']} (Strength: {b.get('strength', 'N/A')})" for b in breakouts])
                               response_text = f"**Breakout Scan Results**\n\nKronos has identified the following potential breakout candidates:\n\n{list_str}\n\nThese assets are showing significant momentum divergence."
                          else:
                               response_text = "System scan completed. No significant breakout signals detected at this time."
                     else:
                          response_text = "Breakout scan produced no viable results."
                 except Exception as e:
                     response_text = f"Breakout scan error: {str(e)}"

        elif "market" in prompt or "sector" in prompt or "trend" in prompt:
             steps.append("Accessing Global Market Data Layer...")
             steps.append("Correlating macro-economic indicators...")
             try:
                 # Fetch summary for SPY
                 summary = await summary_command.handle_summary_command(ai_params={"ticker": "SPY"}, is_called_by_ai=True)
                 if summary and summary.get("status") == "success":
                      txt = summary.get("data", {}).get("summary", "Market appears nominal.")
                      response_text = f"**Market Trend Analysis**\n\n{txt}\n\nGlobal indicators suggest the broader market (SPY) is driving current sector rotation."
                 else:
                      response_text = "Unable to retrieve comprehensive market summary."
             except Exception as e:
                  response_text = f"Market analysis error: {str(e)}"
        
        elif "quickscore" in prompt or "analyze" in prompt or "$" in req.prompt or ticker != "SPY":
             # General analysis for a ticker
             steps.append(f"Deep Scanning Ticker: {ticker}...")
             steps.append("Aggregating Multi-Factor Model...")
             
             try:
                 # Run quickscore with timeout
                 qs = await asyncio.wait_for(quickscore_command.handle_quickscore_command([], ai_params={"ticker": ticker}, is_called_by_ai=True), timeout=25.0)
                 if qs and qs.get("status") == "success":
                       # Parse new structured data (String keys "1", "2", "3")
                       # Fallback to direct access if needed
                       daily_data = qs.get("scores", {}).get("2", {})
                       score = daily_data.get("score", "N/A") if isinstance(daily_data, dict) else daily_data
                       
                       
                       summary = qs.get("summary", "N/A")
                       response_text = f"**Analysis for {ticker}**\n\n{summary}\n\nThe asset has been evaluated against our multi-factor model."
                       
                       widget_payload = {
                           "type": "QUICKSCORE_CARD",
                           "data": qs
                       }
                       yield json.dumps({"type": "widget", "content": widget_payload}) + "\n"

                 else:
                      response_text = f"Analysis for {ticker} yielded inconclusive results."
             except Exception as e:
                 response_text = f"Analysis error: {str(e)}"

        else:
             steps.append("Synthesizing strategic response...")
             await asyncio.sleep(1)
             response_text = "I am ready. Specify a strategy, ticker ($NVDA), or request a scan (e.g., 'Find Breakouts')."

        # Stream steps
        for step in steps:
            await asyncio.sleep(0.6) # Visual pacing
            yield json.dumps({"type": "step", "content": step}) + "\n"
        
        await asyncio.sleep(0.4)
        yield json.dumps({"type": "result", "content": response_text}) + "\n"

    return StreamingResponse(
        event_generator(), media_type="application/x-ndjson", headers={"X-Accel-Buffering": "no"}
    )
