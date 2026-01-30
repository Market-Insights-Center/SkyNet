from fastapi import APIRouter, HTTPException
from backend.schemas import (
    MarketDataRequest, ModRequest, RankingSubmitRequest, RankingRemoveRequest, RobinhoodRequest, ChartRequest
)
from backend.config import get_mod_list, SUPER_ADMIN_EMAIL
import yfinance as yf
import pandas as pd
import time
from datetime import datetime
import asyncio

# Attempt imports for integration
try:
    from backend.integration import performance_stream_command, strategy_ranking
except ImportError:
    try:
        from integration import performance_stream_command, strategy_ranking
    except Exception as e:
        print(f"Warning: Market router imports failed: {e}")

router = APIRouter()

# Simple in-memory cache for market data (Global to the module)
MARKET_CACHE = {}
CACHE_TTL = 300  # 5 minutes

from backend.services.robinhood_manager import RobinhoodManager

# If backend.services.firebase doesn't exist, we might need to initialize it or use existing init?
# Based on main.py imports, 'backend.routers' are imported.
# Let's check where 'db' comes from. Profile.jsx uses client SDK. Backend likely uses firebase-admin.
# We'll assume a helper or basic firestore usage.
import firebase_admin
from firebase_admin import firestore

def get_firestore_db():
    try:
        return firestore.client()
    except:
        return None

@router.post("/api/market-data/robinhood")
def get_robinhood_data(req: RobinhoodRequest): 
    # req.email is the user
    try:
        db_client = get_firestore_db()
        if not db_client: return {"status": "error", "message": "DB Error"}
        
        # Fetch user credentials from Firestore
        # DO NOT TRUST CLIENT TO SEND PASSWORD. Fetch from DB.
        user_doc = db_client.collection('users').document(req.email).get()
        if not user_doc.exists:
             return {"status": "error", "message": "User not found"}
        
        data = user_doc.to_dict()
        rh_data = data.get('integrations', {}).get('robinhood', {})
        
        if not rh_data.get('connected'):
             return {"status": "error", "message": "Not connected"}
             
        username = rh_data.get('username')
        password = rh_data.get('encrypted_pass') # Stored as plain text for prototype
        
        if not username or not password:
             return {"status": "error", "message": "Credentials missing"}
             
        # Fetch from Manager (Non-blocking now)
        portfolio = RobinhoodManager.get_portfolio(username, password)
        
        if portfolio:
            return {"status": "success", "data": portfolio}
        else:
            return {"status": "error", "message": "Failed to fetch data"}
            
    except Exception as e:
        print(f"RH Endpoint Error: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/api/market-data")
def get_market_data(request: MarketDataRequest):
    try:
        tickers = [t.upper().strip() for t in request.tickers if t]
        if not tickers: return []
        
        # Check cache
        cache_key = tuple(sorted(tickers))
        current_time = time.time()
        
        if cache_key in MARKET_CACHE:
            timestamp, data = MARKET_CACHE[cache_key]
            if current_time - timestamp < CACHE_TTL:
                return data
        
        # Use yf.download for batch processing
        df = yf.download(tickers, period="1y", interval="1d", progress=False, auto_adjust=True)
        
        results = []
        for ticker in tickers:
            try:
                # Handle DataFrame structure differences for single vs multi ticker
                if len(tickers) > 1:
                    if ticker not in df['Close'].columns: continue
                    hist_close = df['Close'][ticker].dropna()
                else:
                    hist_close = df['Close'].dropna()

                if hist_close.empty: continue

                def get_val(series, idx):
                    try: return float(series.iloc[idx].item())
                    except: return float(series.iloc[idx])

                current_price = get_val(hist_close, -1)
                price_1d = get_val(hist_close, -2) if len(hist_close) > 1 else current_price
                change_1d = ((current_price - price_1d) / price_1d) * 100 if price_1d != 0 else 0
                price_1w = get_val(hist_close, -6) if len(hist_close) > 6 else get_val(hist_close, 0)
                change_1w = ((current_price - price_1w) / price_1w) * 100 if price_1w != 0 else 0
                price_1m = get_val(hist_close, -22) if len(hist_close) > 22 else get_val(hist_close, 0)
                change_1m = ((current_price - price_1m) / price_1m) * 100 if price_1m != 0 else 0
                price_1y = get_val(hist_close, 0)
                change_1y = ((current_price - price_1y) / price_1y) * 100 if price_1y != 0 else 0

                subset = hist_close.tail(30)
                if isinstance(subset, pd.DataFrame):
                    sparkline = subset.values.flatten().tolist()
                else:
                    sparkline = subset.tolist()

                mkt_cap = 0
                volume = 0
                pe_ratio = 0
                company_name = "" 

                try:
                    t = yf.Ticker(ticker)
                    mkt_cap = t.fast_info.market_cap
                    volume = t.fast_info.last_volume
                    info = t.info
                    pe_ratio = info.get('trailingPE', 0)
                    company_name = info.get('shortName') or info.get('longName') or ""
                    if not volume: volume = info.get('volume', 0)
                    if not mkt_cap: mkt_cap = info.get('marketCap', 0)
                except: pass 

                results.append({
                    "ticker": ticker,
                    "companyName": company_name,
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
                print(f"Error processing {ticker}: {e}")
                continue
        
        # Save to cache
        MARKET_CACHE[cache_key] = (current_time, results)
        return results
    except Exception as e:
        print(f"Global Market Data Error: {e}")
        return []

@router.post("/api/market-data/details")
def get_market_data_details(request: MarketDataRequest):
    results = {}
    tickers = [t.upper().strip() for t in request.tickers if t]
    
    for ticker in tickers:
        try:
            t = yf.Ticker(ticker)
            earnings_date = "-"
            try:
                cal = t.calendar
                if isinstance(cal, dict):
                     if 'Earnings Date' in cal:
                         dates = cal['Earnings Date']
                         if dates: earnings_date = str(dates[0].date())
                elif isinstance(cal, pd.DataFrame):
                    if not cal.empty:
                        vals = cal.iloc[0]
                        earnings_date = str(vals.values[0])
            except: 
                try:
                    ts = t.info.get('earningsTimestamp')
                    if ts: earnings_date = datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                except: pass

            iv = "-"
            try:
                if t.info.get('impliedVolatility'):
                     iv = f"{t.info['impliedVolatility'] * 100:.2f}%"
                else:
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

@router.post("/api/market-data/chart")
def get_chart_data(req: ChartRequest):
    try:
        ticker = req.ticker.upper().strip()
        r = req.range.lower()
        
        # Map range to yfinance period/interval
        period = "1d"
        interval = "5m"
        
        if r == "1d":
            period = "1d"
            interval = "5m"
        elif r == "1w":
            period = "5d" # yfinance uses 5d for roughly a week
            interval = "15m" 
        elif r == "1m":
            period = "1mo"
            interval = "1h" # or 1d? 1h gives more detail for chart
        elif r == "1y":
            period = "1y"
            interval = "1d"
            
        df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=True)
        if df.empty:
            return {"status": "error", "message": "No data found"}
            
        # Format for chart (List of { time: timestamp, value: close })
        data = []
        for idx, row in df.iterrows():
            # Index is DatetimeIndex
            close_val = float(row['Close'].iloc[0]) if isinstance(row['Close'], pd.Series) else float(row['Close'])
            
            # Format timestamp
            # For intraday (1d, 1w), we want time. For 1y, date is enough, but ISO works for all.
            ts = idx.isoformat() 
            
            data.append({"time": ts, "value": close_val})
            
        # If result is too large, downsample? 
        # For 1y 1d, it's ~252 points -> OK.
        # For 1d 5m, it's ~78 points -> OK.
        
        return {"status": "success", "data": data, "ticker": ticker, "range": r}

    except Exception as e:
        print(f"Chart Error: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/api/performance-stream")
def get_performance_stream():
    """Returns the cached performance stream data."""
    return performance_stream_command.get_cached_heatmap()

@router.get("/api/performance-stream/details/{ticker}")
async def get_performance_stream_details(ticker: str):
    """Returns details for a specific stock."""
    return await performance_stream_command.get_stock_details(ticker)

@router.post("/api/performance-stream/force-update")
async def force_performance_stream_update(req: ModRequest):
    """Force update performance stream (Admin only)."""
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: 
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await performance_stream_command.update_heatmap_cache()
    return {"status": "success"}

# --- STRATEGY RANKING ENDPOINTS ---
@router.get("/api/strategy-ranking/list")
async def get_strategy_rankings():
    await strategy_ranking.check_and_update_rankings()
    return await strategy_ranking.get_all_rankings()

@router.post("/api/strategy-ranking/submit")
async def submit_strategy_ranking(req: RankingSubmitRequest):
    return await strategy_ranking.submit_portfolio_to_ranking(req.user_email, req.portfolio_code, req.interval)

@router.post("/api/strategy-ranking/remove")
async def remove_strategy_ranking(req: RankingRemoveRequest):
    return await strategy_ranking.remove_portfolio_from_ranking(req.user_email, req.portfolio_code)

@router.post("/api/strategy-ranking/delete-permanent")
async def delete_permanent_strategy_ranking(req: RankingRemoveRequest):
    return await strategy_ranking.permanent_delete_strategy(req.user_email, req.portfolio_code)
