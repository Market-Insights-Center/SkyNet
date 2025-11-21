from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import sys
import os

# Add the backend directory to sys.path to ensure imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the integration commands
from integration import invest_command, cultivate_command, custom_command, tracking_command

app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"], # Adjust for your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Request Models ---

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
    action: str = "run_analysis" # run_analysis, save_data
    date_to_save: Optional[str] = None

class CustomRequest(BaseModel):
    portfolio_code: str
    ema_sensitivity: int
    amplification: float
    sub_portfolios: List[SubPortfolio]
    tailor_to_value: bool = False
    total_value: Optional[float] = None
    use_fractional_shares: bool = False
    action: str = "run_analysis" # run_analysis, save_data

class TrackingRequest(BaseModel):
    portfolio_code: str
    total_value: Optional[float] = None
    use_fractional_shares: bool = False
    action: str = "run_analysis" # run_analysis, comparison

# --- Routes ---

# --- Helper for Frontend Normalization ---
def normalize_table_data(data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = []
    for item in data_list:
        # Handle various key naming conventions from different commands
        ticker = item.get("ticker") or item.get("Ticker") or "Unknown"
        if ticker == "Cash": continue # Skip cash in table if preferred, or handle separately

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
        
        # Added for "Value" column (Actual Money Allocation)
        money_alloc = item.get("actual_money_allocation") or item.get("ActualMoneyAllocation") or 0.0
        try: money_alloc = float(money_alloc)
        except: money_alloc = 0.0

        normalized.append({
            "ticker": ticker,
            "shares": shares_disp,
            "price": price,
            "alloc": f"{alloc_val:.2f}%",
            "value": money_alloc # Pass raw number for formatting in frontend
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
        # Call the integration command
        result = await invest_command.handle_invest_command(
            args=[], 
            ai_params=ai_params, 
            is_called_by_ai=True, 
            return_structured_data=True
        )
        
        if isinstance(result, str) and result.startswith("Error"):
             raise HTTPException(status_code=400, detail=result)

        # Unpack the result from invest_command
        tailored_list_str, combined_data, final_cash, tailored_structured_data = result
        
        # Determine which dataset to display based on whether tailoring was requested
        raw_data = tailored_structured_data if request.tailor_to_value else combined_data
        table_data = normalize_table_data(raw_data)

        # Calculate total allocated value (excluding cash)
        total_allocated = sum(item['value'] for item in table_data)
        
        # Prepare summary cards
        response_data = {
            "summary": [
                {
                    "label": "Total Value", 
                    "value": f"${request.total_value:,.2f}" if request.total_value else "N/A", 
                    "change": "Input"
                },
                {
                    "label": "Cash Reserve", 
                    "value": f"${final_cash:,.2f}", 
                    "change": f"{((final_cash / request.total_value) * 100):.1f}%" if request.total_value else "0%"
                },
            ],
            "table": table_data,
            "raw_result": {
                "tailored_list": tailored_list_str,
                "final_cash": final_cash
            }
        }
        return response_data

    except Exception as e:
        import traceback
        traceback.print_exc()
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
        result = await cultivate_command.handle_cultivate_command(
            args=[],
            ai_params=ai_params,
            is_called_by_ai=True
        )
        
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
                 "table": table_data
             }
        elif isinstance(result, dict):
            return result
        else:
            return {"message": "Command executed", "result": str(result)}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom")
async def run_custom(request: CustomRequest):
    print(f"Received /custom request: {request}")
    
    ai_params = {
        "portfolio_code": request.portfolio_code,
        "ema_sensitivity": request.ema_sensitivity,
        "amplification": request.amplification,
        "sub_portfolios": [sp.model_dump() for sp in request.sub_portfolios],
        "tailor_to_value": request.tailor_to_value,
        "total_value": request.total_value,
        "use_fractional_shares": request.use_fractional_shares,
        "action": request.action
    }
    
    try:
        result = await custom_command.handle_custom_command(
            args=[],
            ai_params=ai_params,
            is_called_by_ai=True
        )
        
        if isinstance(result, str) and result.startswith("Error"):
             raise HTTPException(status_code=400, detail=result)
        
        if isinstance(result, dict) and "holdings" in result:
             table_data = normalize_table_data(result["holdings"])
             return {
                 "summary": [
                     {"label": "Total Value", "value": f"${result.get('total_value', 0):,.2f}", "change": "Input"},
                     {"label": "Cash", "value": f"${result.get('final_cash', 0):,.2f}", "change": "Allocated"}
                 ],
                 "table": table_data
             }
             
        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tracking")
async def run_tracking(request: TrackingRequest):
    print(f"Received /tracking request: {request}")
    
    ai_params = {
        "portfolio_code": request.portfolio_code,
        "total_value": request.total_value,
        "use_fractional_shares": request.use_fractional_shares,
        "action": request.action
    }
    
    try:
        result = await tracking_command.handle_tracking_command(
            args=[],
            ai_params=ai_params,
            is_called_by_ai=True
        )
        
        if isinstance(result, str) and result.startswith("Error"):
             raise HTTPException(status_code=400, detail=result)
             
        if isinstance(result, dict) and "holdings" in result:
             table_data = normalize_table_data(result["holdings"])
             return {
                 "summary": [
                     {"label": "Total Value", "value": f"${result.get('total_value', 0):,.2f}", "change": "Input"},
                     {"label": "Cash", "value": f"${result.get('final_cash', 0):,.2f}", "change": "Allocated"}
                 ],
                 "table": table_data
             }

        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)