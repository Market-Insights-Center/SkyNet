from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from backend.schemas import (
    AssessRequest, MLForecastRequest, BriefingRequest, FundamentalsRequest,
    QuickscoreRequest, MarketRequest, BreakoutRequest, SentimentRequest,
    PowerScoreRequest, SummaryRequest, SentinelRequest
)
from backend.database import verify_access_and_limits, get_user_profile
from backend.config import SUPER_ADMIN_EMAIL
from backend.usage_counter import increment_usage
import logging
import json
import traceback

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
        await increment_usage("invest")
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
        await increment_usage("cultivate")
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
        await increment_usage("custom")
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
        await increment_usage("tracking")
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
        await increment_usage("risk")
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
        await increment_usage("history")
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
    await increment_usage("quickscore")
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
    return result

@router.post("/api/breakout")
async def run_breakout(req: BreakoutRequest):
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "breakout")
        if not limit_check["allowed"]:
            raise HTTPException(status_code=403, detail=limit_check["message"])
    result = await breakout_command.handle_breakout_command([], ai_params={"action": "run"}, is_called_by_ai=True)
    return result

@router.post("/api/sentiment")
async def run_sentiment(req: SentimentRequest):
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "sentiment")
    result = await sentiment_command.handle_sentiment_command(ai_params={"ticker": req.ticker}, is_called_by_ai=True)
    if not result: raise HTTPException(status_code=500, detail="Sentiment analysis failed.")
    if result.get("status") == "error": raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@router.post("/api/powerscore")
async def run_powerscore(req: PowerScoreRequest):
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "powerscore")
        if not limit_check["allowed"]:
            raise HTTPException(status_code=403, detail=limit_check["message"])
    result = await powerscore_command.handle_powerscore_command(
        ai_params={"ticker": req.ticker, "sensitivity": req.sensitivity}, is_called_by_ai=True
    )
    if not result: raise HTTPException(status_code=500, detail="PowerScore analysis failed.")
    if result.get("status") == "error": raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@router.post("/api/summary")
async def run_summary(req: SummaryRequest):
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "summary")
    await increment_usage("summary")
    return await summary_command.handle_summary_command(ai_params={"ticker": req.ticker}, is_called_by_ai=True)

@router.post("/api/briefing")
async def api_briefing(req: BriefingRequest):
    access = verify_access_and_limits(req.email, "briefing")
    if not access["allowed"]:
        raise HTTPException(status_code=403, detail=access["message"])
    try:
        data = await briefing_command.handle_briefing_command([], is_called_by_ai=True)
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
             raise Exception(results["error"])
        return {"results": results}
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
