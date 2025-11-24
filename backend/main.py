from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import sys
import os
import csv
import pandas as pd
import numpy as np
import math
import yfinance as yf
import asyncio
import logging

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from integration import invest_command, cultivate_command, custom_command, tracking_command

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---

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
    user_id: Optional[str] = None

class CultivateRequest(BaseModel):
    cultivate_code: str
    portfolio_value: float
    use_fractional_shares: bool = False
    action: str = "run_analysis"
    date_to_save: Optional[str] = None
    user_id: Optional[str] = None

class CustomRequest(BaseModel):
    portfolio_code: str
    ema_sensitivity: Optional[int] = None
    amplification: Optional[float] = None
    sub_portfolios: Optional[List[SubPortfolio]] = None
    tailor_to_value: bool = False
    total_value: Optional[float] = None
    use_fractional_shares: bool = False
    action: str = "run_existing_portfolio"
    user_id: Optional[str] = None

class TrackingRequest(BaseModel):
    portfolio_code: str
    total_value: Optional[float] = None
    use_fractional_shares: bool = False
    action: str = "run_analysis"
    sub_portfolios: Optional[List[SubPortfolio]] = None
    ema_sensitivity: Optional[int] = None
    amplification: Optional[float] = None
    rh_username: Optional[str] = None
    rh_password: Optional[str] = None
    email_to: Optional[str] = None
    overwrite: bool = False
    trades: Optional[List[Dict[str, Any]]] = None
    new_run_data: Optional[List[Dict[str, Any]]] = None
    final_cash: Optional[float] = None
    user_id: Optional[str] = None

class UserProfile(BaseModel):
    user_id: str
    email: str
    risk_tolerance: int
    trading_frequency: str
    portfolio_types: List[str]

class MarketDataRequest(BaseModel):
    tickers: List[str]

# --- Helper Functions ---

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

async def fetch_ticker_data(symbol: str) -> Dict[str, Any]:
    """
    Fetches data for a single ticker with extensive logging and fallbacks.
    """
    print(f"--- Fetching data for: {symbol} ---")
    
    def _get_data():
        try:
            ticker = yf.Ticker(symbol)
            
            # 1. Try Fast Info (Real-time-ish)
            try:
                current_price = ticker.fast_info.get('last_price', 0.0)
                print(f"   [{symbol}] FastInfo Price: {current_price}")
            except Exception as e:
                print(f"   [{symbol}] FastInfo Failed: {e}")
                current_price = 0.0

            # 2. Get History (1 Year)
            # We use auto_adjust=False to match traditional Close prices if needed
            hist = ticker.history(period="1y", interval="1d")
            if hist.empty:
                print(f"   [{symbol}] History (1y) is EMPTY.")
            else:
                print(f"   [{symbol}] History (1y) fetched. Rows: {len(hist)}. Last Close: {hist['Close'].iloc[-1]}")

            # 3. Get Intraday for Sparkline (5d, 15m to ensure granularity)
            spark_hist = ticker.history(period="5d", interval="15m")
            
            # 4. Metadata
            info = {}
            try:
                info = ticker.info
                # Fallback price if fast_info failed and history failed
                if current_price == 0.0:
                    current_price = info.get('currentPrice') or info.get('regularMarketPrice') or 0.0
                    print(f"   [{symbol}] Info Fallback Price: {current_price}")
            except Exception as e:
                print(f"   [{symbol}] Info Fetch Failed: {e}")

            return hist, spark_hist, current_price, info
        except Exception as e:
            print(f"   [{symbol}] CRITICAL FETCH ERROR: {e}")
            return pd.DataFrame(), pd.DataFrame(), 0.0, {}

    # Run the blocking calls in a thread
    hist, spark_hist, current_price, info = await asyncio.to_thread(_get_data)

    # --- Process Data ---
    
    # Defaults
    change_p_1d = 0.0
    change_1w = 0.0
    change_1m = 0.0
    change_1y = 0.0
    change_ytd = 0.0
    vol_str = "-"
    market_cap_str = "-"
    sparkline_points = []
    name = info.get('shortName') or info.get('longName') or symbol

    # Price Fallback Logic
    if current_price == 0.0 and not hist.empty:
        current_price = float(hist['Close'].iloc[-1])
        print(f"   [{symbol}] Using History Last Close as Price: {current_price}")

    if not hist.empty and current_price > 0:
        # 1D Change Calculation
        # If we have at least 2 days of data
        if len(hist) >= 2:
            prev_close = float(hist['Close'].iloc[-2])
            change_p_1d = ((current_price - prev_close) / prev_close) * 100
        
        # Helper for historical changes
        def calc_change(days):
            if len(hist) > days:
                try:
                    past = float(hist['Close'].iloc[-(days + 1)])
                    if past > 0:
                        return ((current_price - past) / past) * 100
                except Exception as ex:
                    print(f"   [{symbol}] Calc Change Error ({days}d): {ex}")
            return 0.0

        change_1w = calc_change(5)
        change_1m = calc_change(21)
        change_1y = calc_change(252)

        # YTD Calculation
        try:
            current_year = pd.Timestamp.now().year
            ytd_data = hist[hist.index.year == current_year]
            if not ytd_data.empty:
                start = float(ytd_data['Close'].iloc[0])
                if start > 0:
                    change_ytd = ((current_price - start) / start) * 100
        except Exception as ex:
            print(f"   [{symbol}] YTD Calc Error: {ex}")

        # Volume
        vol = 0
        if 'Volume' in hist.columns:
            # Get last valid volume
            vol = int(hist['Volume'].iloc[-1])
        
        # Format Volume
        if vol >= 1e9: vol_str = f"{vol/1e9:.2f}B"
        elif vol >= 1e6: vol_str = f"{vol/1e6:.2f}M"
        elif vol >= 1e3: vol_str = f"{vol/1e3:.2f}K"
        else: vol_str = str(vol)

    # Market Cap
    mc = info.get('marketCap')
    if mc:
        if mc >= 1e12: market_cap_str = f"{mc/1e12:.2f}T"
        elif mc >= 1e9: market_cap_str = f"{mc/1e9:.2f}B"
        elif mc >= 1e6: market_cap_str = f"{mc/1e6:.2f}M"
        else: market_cap_str = f"{mc:.0f}"

    # Sparkline Logic
    if not spark_hist.empty and 'Close' in spark_hist.columns:
        try:
            clean = spark_hist['Close'].dropna()
            if not clean.empty:
                # Take the last 20-30 points regardless of day boundaries for a smoother line
                # or focus on the last trading day.
                # Let's take the last 30 points to ensure we have data.
                sparkline_points = clean.tail(30).tolist()
        except Exception as ex:
            print(f"   [{symbol}] Sparkline Error: {ex}")

    return {
        "symbol": symbol,
        "name": name,
        "price": current_price,
        "change": change_p_1d,
        "marketCap": market_cap_str,
        "volume": vol_str,
        "sparkline": sparkline_points,
        "weekChange": change_1w,
        "monthChange": change_1m,
        "ytdChange": change_ytd,
        "yearChange": change_1y,
        "iv": "N/A",
        "earnings": "N/A",
        "peRatio": info.get('trailingPE', 0.0)
    }

# --- Routes ---

@app.get("/")
def read_root():
    return {"status": "online", "message": "Portfolio Lab Backend is running"}

@app.post("/api/save_user_profile")
async def save_user_profile(profile: UserProfile):
    file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_profiles.csv')
    try:
        file_exists = os.path.isfile(file_path)
        with open(file_path, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=profile.model_dump().keys())
            if not file_exists: writer.writeheader()
            writer.writerow(profile.model_dump())
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/market-data")
async def get_market_data(request: MarketDataRequest):
    print(f"Received Market Data Request for: {request.tickers}")
    if not request.tickers:
        return {"results": {}}
    
    try:
        # Concurrent execution for speed
        tasks = [fetch_ticker_data(ticker) for ticker in request.tickers]
        results_list = await asyncio.gather(*tasks)
        
        # Transform list to dict keyed by symbol
        results = {res['symbol']: res for res in results_list}
        
        return {"results": results}

    except Exception as e:
        print(f"Global error in market-data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Existing Command Routes ---

@app.post("/api/invest")
async def run_invest(request: InvestRequest):
    print(f"Received /invest request: {request}")
    ai_params = {
        "ema_sensitivity": request.ema_sensitivity,
        "amplification": request.amplification,
        "sub_portfolios": [sp.model_dump() for sp in request.sub_portfolios],
        "tailor_to_value": request.tailor_to_value,
        "total_value": request.total_value,
        "use_fractional_shares": request.use_fractional_shares,
        "user_id": request.user_id
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
        "date_to_save": request.date_to_save,
        "user_id": request.user_id
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
        "action": request.action,
        "user_id": request.user_id
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
    
    if request.sub_portfolios:
        ai_params["sub_portfolios"] = [sp.model_dump() for sp in request.sub_portfolios]

    try:
        result = await tracking_command.handle_tracking_command(args=[], ai_params=ai_params, is_called_by_ai=True)
        
        if isinstance(result, str) and result.startswith("Error"):
             raise HTTPException(status_code=400, detail=result)
        
        if isinstance(result, dict) and result.get("status") == "not_found":
            return result

        if isinstance(result, dict) and result.get("status") == "success" and "table" in result:
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