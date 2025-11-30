from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import sys
import os
import csv
import json
import logging
import asyncio
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

# Ensure we can import from local folders
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import your command modules
from integration import invest_command, cultivate_command, custom_command, tracking_command
from database import read_articles_from_csv, save_articles_to_csv, read_ideas_from_csv, save_ideas_to_csv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

app = FastAPI()

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://marketinsightscenter.cloud",
        "https://www.marketinsightscenter.cloud"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directory
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODS_FILE = os.path.join(BASE_DIR, 'mods.csv')
USERS_FILE = os.path.join(BASE_DIR, 'users.json')

# --- Models ---
class SubPortfolio(BaseModel):
    tickers: Any
    weight: float

class InvestRequest(BaseModel):
    ema_sensitivity: Optional[Any] = 2
    amplification: Optional[float] = 1.0
    sub_portfolios: List[SubPortfolio] = []
    tailor_to_value: bool = False
    total_value: Optional[float] = None
    use_fractional_shares: bool = False
    user_id: Optional[str] = None

class GenericAlgoRequest(BaseModel):
    user_id: Optional[str] = ""
    portfolio_code: Optional[str] = ""
    action: Optional[str] = "run_analysis"
    total_value: Optional[float] = 10000.0
    use_fractional_shares: Optional[bool] = False
    sub_portfolios: Optional[List[Dict]] = []
    ema_sensitivity: Optional[Any] = 2
    amplification: Optional[float] = 1.0
    trades: Optional[List] = []
    rh_username: Optional[str] = ""
    rh_password: Optional[str] = ""
    email_to: Optional[str] = ""
    risk_tolerance: Optional[int] = 10
    vote_type: Optional[str] = "stock"
    overwrite: Optional[bool] = False
    strategy_code: Optional[str] = "A" 
    cultivate_code: Optional[str] = "A"
    portfolio_value: Optional[float] = 10000.0

class MarketDataRequest(BaseModel):
    tickers: List[str]

class ModRequest(BaseModel):
    email: str
    action: str 
    requester_email: str

# --- Helper Functions ---
def get_mod_list():
    super_admin = "marketinsightscenter@gmail.com"
    if not os.path.exists(MODS_FILE):
        return [super_admin]
    mods = []
    try:
        with open(MODS_FILE, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row and row.get("email"):
                    mods.append(row["email"].strip().lower())
    except Exception: pass
    if super_admin not in mods: mods.append(super_admin)
    return mods

def load_json(filepath):
    if not os.path.exists(filepath): return []
    try:
        with open(filepath, 'r') as f: return json.load(f)
    except: return []

# --- ENDPOINTS ---

@app.post("/api/invest")
async def invest_endpoint(request: InvestRequest):
    try:
        ai_params = request.model_dump()
        result = await invest_command.handle_invest_command([], ai_params=ai_params, is_called_by_ai=True)
        if isinstance(result, tuple):
             _, _, final_cash, tailored_data = result
             return {"status": "success", "holdings": tailored_data, "final_cash": final_cash}
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/custom")
async def custom_endpoint(request: GenericAlgoRequest):
    try:
        ai_params = request.model_dump()
        return await custom_command.handle_custom_command([], ai_params=ai_params, is_called_by_ai=True)
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/tracking")
async def tracking_endpoint(request: GenericAlgoRequest):
    try:
        ai_params = request.model_dump()
        return await tracking_command.handle_tracking_command([], ai_params=ai_params, is_called_by_ai=True)
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/cultivate")
async def cultivate_endpoint(request: GenericAlgoRequest):
    try:
        ai_params = request.model_dump()
        return await cultivate_command.handle_cultivate_command([], ai_params=ai_params, is_called_by_ai=True)
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- MARKET DATA ---

@app.post("/api/market-data")
async def get_market_data(request: MarketDataRequest):
    """
    Fetches Price, Sparkline, Market Cap, Volume, PE, and calculates 1D, 1W, 1M, 1Y changes.
    """
    try:
        tickers = [t.upper().strip() for t in request.tickers if t]
        if not tickers: return []
        
        # 1. Download 1 Year of data
        # auto_adjust=True fixes the FutureWarnings regarding price adjustments
        df = yf.download(tickers, period="1y", interval="1d", progress=False, auto_adjust=True)
        
        results = []
        for ticker in tickers:
            try:
                # Handle MultiIndex vs Single Index
                if len(tickers) > 1:
                    if ticker not in df['Close'].columns: continue
                    hist_close = df['Close'][ticker].dropna()
                else:
                    hist_close = df['Close'].dropna()

                if hist_close.empty: continue

                # Helper to safely get float value (Fixes FutureWarning)
                def get_val(series, idx):
                    try:
                        # .item() converts numpy types to native python floats cleanly
                        return float(series.iloc[idx].item())
                    except:
                        return float(series.iloc[idx])

                # Get Prices
                current_price = get_val(hist_close, -1)
                
                # Calculate Changes
                price_1d = get_val(hist_close, -2) if len(hist_close) > 1 else current_price
                change_1d = ((current_price - price_1d) / price_1d) * 100 if price_1d != 0 else 0
                
                price_1w = get_val(hist_close, -6) if len(hist_close) > 6 else get_val(hist_close, 0)
                change_1w = ((current_price - price_1w) / price_1w) * 100 if price_1w != 0 else 0

                price_1m = get_val(hist_close, -22) if len(hist_close) > 22 else get_val(hist_close, 0)
                change_1m = ((current_price - price_1m) / price_1m) * 100 if price_1m != 0 else 0

                price_1y = get_val(hist_close, 0)
                change_1y = ((current_price - price_1y) / price_1y) * 100 if price_1y != 0 else 0

                # Sparkline (Fixes 'DataFrame has no attribute tolist')
                # We ensure we are working with a flat list of values
                subset = hist_close.tail(30)
                if isinstance(subset, pd.DataFrame):
                    sparkline = subset.values.flatten().tolist()
                else:
                    sparkline = subset.tolist()

                # Get Metadata (PE, Vol, Cap)
                mkt_cap = 0
                volume = 0
                pe_ratio = 0
                
                try:
                    t = yf.Ticker(ticker)
                    mkt_cap = t.fast_info.market_cap
                    volume = t.fast_info.last_volume
                    info = t.info
                    pe_ratio = info.get('trailingPE', 0)
                    if not volume: volume = info.get('volume', 0)
                    if not mkt_cap: mkt_cap = info.get('marketCap', 0)
                except: 
                    pass 

                results.append({
                    "ticker": ticker,
                    "price": current_price,
                    "change": change_1d,
                    "change1W": change_1w,
                    "change1M": change_1m,
                    "change1Y": change_1y,
                    "marketCap": mkt_cap,
                    "volume": volume,
                    "peRatio": pe_ratio,
                    "sparkline": sparkline
                })
            except Exception as e: 
                # This log helps identify which specific ticker is failing
                print(f"Error processing {ticker}: {e}")
                continue
                
        return results
    except Exception as e:
        print(f"Global Market Data Error: {e}")
        return []
    
@app.post("/api/market-data/details")
async def get_market_data_details(request: MarketDataRequest):
    """
    Fetches heavy data: Earnings Date and Implied Volatility (IV).
    """
    results = {}
    tickers = [t.upper().strip() for t in request.tickers if t]
    
    for ticker in tickers:
        try:
            t = yf.Ticker(ticker)
            
            # 1. Earnings Date
            earnings_date = "-"
            try:
                cal = t.calendar
                # 'cal' can be a Dictionary or DataFrame depending on yfinance version
                if isinstance(cal, dict):
                     # Look for Earnings Date
                     if 'Earnings Date' in cal:
                         dates = cal['Earnings Date']
                         if dates: earnings_date = str(dates[0].date())
                elif isinstance(cal, pd.DataFrame):
                    # Transpose sometimes needed
                    if not cal.empty:
                        # Common keys: 'Earnings Date' or 0
                        vals = cal.iloc[0]
                        earnings_date = str(vals.values[0])
            except: 
                # Fallback to info
                try:
                    ts = t.info.get('earningsTimestamp')
                    if ts: earnings_date = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                except: pass

            # 2. Implied Volatility (IV)
            iv = "-"
            try:
                # Try getting it from info first (fastest)
                if t.info.get('impliedVolatility'):
                     iv = f"{t.info['impliedVolatility'] * 100:.2f}%"
                else:
                    # Fallback: Approximate from options (slower, but accurate)
                    dates = t.options
                    if dates:
                        chain = t.option_chain(dates[0])
                        valid_ivs = chain.calls[chain.calls['impliedVolatility'] > 0]['impliedVolatility']
                        if not valid_ivs.empty:
                            iv = f"{valid_ivs.mean() * 100:.2f}%"
            except: pass

            results[ticker] = {
                "earnings": earnings_date,
                "iv": iv
            }
        except:
            results[ticker] = {"earnings": "-", "iv": "-"}
            
    return {"results": results}

@app.get("/api/mods")
def get_mods():
    return {"mods": get_mod_list()}

@app.post("/api/mods")
def manage_mods(request: ModRequest):
    mods = get_mod_list()
    if request.requester_email.lower() != "marketinsightscenter@gmail.com":
         raise HTTPException(status_code=403, detail="Only Super Admin can manage moderators")
    target = request.email.lower().strip()
    if request.action == "add":
        if target not in mods:
            mods.append(target)
            with open(MODS_FILE, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([target])
    elif request.action == "remove":
        if target == "marketinsightscenter@gmail.com": raise HTTPException(status_code=400, detail="Cannot remove super admin")
        if target in mods:
            mods.remove(target)
            with open(MODS_FILE, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["email"])
                for m in mods: writer.writerow([m])
    return {"status": "success", "mods": mods}

@app.get("/api/articles")
def get_articles(limit: int = 100):
    try: return read_articles_from_csv()[:limit]
    except: return []

@app.get("/api/users")
def get_users():
    return load_json(USERS_FILE)

@app.get("/api/ideas")
def get_ideas(limit: int = 100):
    return read_ideas_from_csv()[:limit]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)