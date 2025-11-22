from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from integration import invest_command, cultivate_command, custom_command, tracking_command

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SubPortfolio(BaseModel):
    tickers: List[str]
    weight: float

class InvestRequest(BaseModel):
    ema_sensitivity: int
    amplification: float
    sub_portfolios: List[SubPortfolio]
    tailor_to_value: bool = False
    total_value: Optional[float] = None
    use_fractional_shares: bool = False

class CultivateRequest(BaseModel):
    cultivate_code: str
    portfolio_value: float
    use_fractional_shares: bool = False
    action: str = "run_analysis"
    date_to_save: Optional[str] = None

class CustomRequest(BaseModel):
    portfolio_code: str
    ema_sensitivity: Optional[int] = None
    amplification: Optional[float] = None
    sub_portfolios: Optional[List[SubPortfolio]] = None
    tailor_to_value: bool = False
    total_value: Optional[float] = None
    use_fractional_shares: bool = False
    action: str = "run_existing_portfolio"

class TrackingRequest(BaseModel):
    portfolio_code: str
    total_value: Optional[float] = None
    use_fractional_shares: bool = False
    action: str = "run_analysis"
    # For Creation if missing
    sub_portfolios: Optional[List[SubPortfolio]] = None
    ema_sensitivity: Optional[int] = None
    amplification: Optional[float] = None
    # For Execution
    rh_username: Optional[str] = None
    rh_password: Optional[str] = None
    email_to: Optional[str] = None
    overwrite: bool = False
    trades: Optional[List[Dict[str, Any]]] = None
    new_run_data: Optional[List[Dict[str, Any]]] = None
    final_cash: Optional[float] = None

def normalize_table_data(data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = []
    for item in data_list:
        ticker = item.get("ticker") or item.get("Ticker") or "Unknown"
        if ticker == "Cash": continue 

        shares = item.get("shares") or item.get("Shares") or 0
        if isinstance(shares, (int, float)):
            shares_disp = f"{shares:.2f}" if isinstance(shares, float) else str(shares)
        else:
            shares_disp = str(shares)

        price = item.get("live_price_at_eval") or item.get("live_price") or item.get("LivePriceAtEval") or item.get("Price") or 0.0
        try: price = float(price)
        except: price = 0.0

        alloc_val = item.get("actual_percent_allocation") or item.get("combined_percent_allocation") or item.get("ActualPercentAllocation") or 0.0
        try: alloc_val = float(alloc_val)
        except: alloc_val = 0.0
        
        money_alloc = item.get("actual_money_allocation") or item.get("ActualMoneyAllocation") or 0.0
        try: money_alloc = float(money_alloc)
        except: money_alloc = 0.0

        normalized.append({
            "ticker": ticker,
            "shares": shares_disp,
            "price": price,
            "alloc": f"{alloc_val:.2f}%",
            "value": money_alloc 
        })
    return normalized

@app.get("/")
def read_root():
    return {"status": "online", "message": "Portfolio Lab Backend is running"}

@app.post("/api/invest")
async def run_invest(request: InvestRequest):
    print(f"Received /invest request: {request}")
    ai_params = {
        "ema_sensitivity": request.ema_sensitivity,
        "amplification": request.amplification,
        "sub_portfolios": [sp.model_dump() for sp in request.sub_portfolios],
        "tailor_to_value": request.tailor_to_value,
        "total_value": request.total_value,
        "use_fractional_shares": request.use_fractional_shares
    }
    try:
        result = await invest_command.handle_invest_command(
            args=[], ai_params=ai_params, is_called_by_ai=True, return_structured_data=True
        )
        if isinstance(result, str) and result.startswith("Error"):
             raise HTTPException(status_code=400, detail=result)
        tailored_list_str, combined_data, final_cash, tailored_structured_data = result
        raw_data = tailored_structured_data if request.tailor_to_value else combined_data
        table_data = normalize_table_data(raw_data)
        return {
            "summary": [
                {"label": "Total Value", "value": f"${request.total_value:,.2f}" if request.total_value else "N/A", "change": "Input"},
                {"label": "Cash Reserve", "value": f"${final_cash:,.2f}", "change": "Allocated"},
            ],
            "table": table_data,
            "raw_result": {"tailored_list": tailored_list_str, "final_cash": final_cash}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cultivate")
async def run_cultivate(request: CultivateRequest):
    print(f"Received /cultivate request: {request}")
    ai_params = {
        "cultivate_code": request.cultivate_code,
        "portfolio_value": request.portfolio_value,
        "use_fractional_shares": request.use_fractional_shares,
        "action": request.action,
        "date_to_save": request.date_to_save
    }
    try:
        result = await cultivate_command.handle_cultivate_command(args=[], ai_params=ai_params, is_called_by_ai=True)
        if isinstance(result, str) and result.startswith("Error"):
             raise HTTPException(status_code=400, detail=result)
        if isinstance(result, tuple):
             tailored_entries, final_cash = result
             table_data = normalize_table_data(tailored_entries)
             return {
                 "summary": [
                     {"label": "Portfolio Value", "value": f"${request.portfolio_value:,.2f}", "change": "Input"},
                     {"label": "Cash Reserve", "value": f"${final_cash:,.2f}", "change": "Allocated"}
                 ],
                 "table": table_data,
                 "raw_result": {"final_cash": final_cash}
             }
        elif isinstance(result, dict): return result
        return {"message": "Command executed", "result": str(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom")
async def run_custom(request: CustomRequest):
    print(f"Received /custom request: {request}")
    ai_params = {
        "portfolio_code": request.portfolio_code,
        "tailor_to_value": request.tailor_to_value,
        "total_value": request.total_value,
        "use_fractional_shares": request.use_fractional_shares,
        "action": request.action
    }
    if request.sub_portfolios:
        ai_params["sub_portfolios"] = [sp.model_dump() for sp in request.sub_portfolios]
    if request.ema_sensitivity: ai_params["ema_sensitivity"] = request.ema_sensitivity
    if request.amplification: ai_params["amplification"] = request.amplification
    
    try:
        result = await custom_command.handle_custom_command(args=[], ai_params=ai_params, is_called_by_ai=True)
        if isinstance(result, str) and result.startswith("Error"):
             raise HTTPException(status_code=400, detail=result)
        if isinstance(result, dict) and result.get("status") == "not_found": return result 
        if isinstance(result, dict) and "holdings" in result:
             table_data = normalize_table_data(result["holdings"])
             return {
                 "status": "success",
                 "summary": [
                     {"label": "Total Value", "value": f"${result.get('total_value', 0):,.2f}", "change": "Input"},
                     {"label": "Cash", "value": f"${result.get('final_cash', 0):,.2f}", "change": "Allocated"}
                 ],
                 "table": table_data,
                 "raw_result": result
             }
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tracking")
async def run_tracking(request: TrackingRequest):
    print(f"Received /tracking request: {request}")
    ai_params = request.model_dump()
    
    # Convert sub_portfolios to dicts if present
    if request.sub_portfolios:
        ai_params["sub_portfolios"] = [sp.model_dump() for sp in request.sub_portfolios]

    try:
        result = await tracking_command.handle_tracking_command(args=[], ai_params=ai_params, is_called_by_ai=True)
        
        if isinstance(result, str) and result.startswith("Error"):
             raise HTTPException(status_code=400, detail=result)
        
        if isinstance(result, dict) and result.get("status") == "not_found":
            return result

        if isinstance(result, dict) and result.get("status") == "success" and "table" in result:
             # Data is already formatted by tracking_command, just pass it through or normalize specific parts
             # Note: Tracking command might return raw data that needs normalization
             if "table" in result and isinstance(result["table"], list) and len(result["table"]) > 0 and "alloc" not in result["table"][0]:
                 result["table"] = normalize_table_data(result["table"])
             return result

        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)