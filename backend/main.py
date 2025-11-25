from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import sys
import os
import csv
import pandas as pd
import numpy as np
import yfinance as yf
import asyncio
import logging
import datetime
import random
import json

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

# --- GLOBAL LIMITER ---
# Crucial: Restricts concurrent fetches to 4 to prevent Yahoo from blocking connections
YF_SEMAPHORE = asyncio.Semaphore(4)

# --- CACHE ---
MARKET_DATA_CACHE = {}
CACHE_EXPIRY_SECONDS = 300 # 5 minutes

async def fetch_slow_data_task(symbol: str):
    """Background task to fetch slow data (IV, Earnings, Info) and update cache."""
    async with YF_SEMAPHORE:
        def _get_slow():
            try:
                import time
                time.sleep(random.uniform(0.5, 1.5)) # Lower priority
                ticker = yf.Ticker(symbol)
                
                # 1. INFO (Name/MarketCap/PE)
                info = {}
                try: info = ticker.info
                except: pass

                # 2. EARNINGS
                earnings_str = "N/A"
                try:
                    cal = ticker.calendar
                    if cal and isinstance(cal, dict):
                        dates = cal.get('Earnings Date')
                        if dates:
                            first = dates[0] if isinstance(dates, list) else dates
                            if hasattr(first, 'strftime'):
                                earnings_str = first.strftime("%m-%d")
                            else:
                                earnings_str = str(first)[:10]
                except: pass

                # 3. IV (Options)
                iv_str = "N/A"
                try:
                    # Need current price for IV calc
                    current_price = 0.0
                    if hasattr(ticker, 'fast_info'):
                        p = getattr(ticker.fast_info, 'last_price', None)
                        if p: current_price = float(p)
                    
                    if current_price > 0:
                        exps = ticker.options
                        if exps:
                            target_date = exps[0]
                            today = datetime.date.today()
                            for d_str in exps:
                                try:
                                    d_obj = datetime.datetime.strptime(d_str, "%Y-%m-%d").date()
                                    if (d_obj - today).days > 15:
                                        target_date = d_str
                                        break
                                except: continue
                            
                            chain = ticker.option_chain(target_date)
                            calls = chain.calls
                            if not calls.empty:
                                calls['dist'] = (calls['strike'] - current_price).abs()
                                valid = calls[calls['impliedVolatility'] > 0.001].copy()
                                if not valid.empty:
                                    best = valid.sort_values('dist').iloc[0]
                                    iv_str = f"{best['impliedVolatility'] * 100:.2f}%"
                except: pass

                return info, earnings_str, iv_str
            except Exception as e:
                print(f"Error fetching slow data for {symbol}: {e}")
                return {}, "N/A", "N/A"

        info, earnings_str, iv_str = await asyncio.to_thread(_get_slow)
        
        # Update Cache
        MARKET_DATA_CACHE[symbol] = {
            "timestamp": datetime.datetime.now().timestamp(),
            "info": info,
            "earnings": earnings_str,
            "iv": iv_str
        }

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

class ModRequest(BaseModel):
    email: str
    action: str  # "add" or "remove"
    requester_email: str

class VoteRequest(BaseModel):
    type: str # 'up' or 'down'

class Comment(BaseModel):
    id: int
    article_id: int
    user: str
    text: str
    date: str
    replies: Optional[List[Dict[str, Any]]] = []
    likes: int = 0
    dislikes: int = 0

class Article(BaseModel):
    id: Optional[int] = None
    title: str
    subheading: str
    content: str
    author: str
    date: str
    category: str = "General"
    hashtags: List[str] = []
    cover_image: Optional[str] = None
    likes: int = 0
    dislikes: int = 0
    shares: int = 0

class UserSubscription(BaseModel):
    email: str
    subscription_plan: str = "Free"
    subscription_cost: float = 0.0

# --- Helper Functions ---

MODS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mods.csv')
ARTICLES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'articles.json')
COMMENTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'comments.json')
USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.json')

def load_json(filepath):
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except:
        return []

def save_json(filepath, data):
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

def get_mod_list():
    if not os.path.exists(MODS_FILE):
        # Create with default super admin
        with open(MODS_FILE, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["email"])
            writer.writerow(["marketinsightscenter@gmail.com"])
        return ["marketinsightscenter@gmail.com"]
    
    mods = []
    try:
        with open(MODS_FILE, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row and row.get("email"):
                    mods.append(row["email"])
    except Exception as e:
        print(f"Error reading mods file: {e}")
    
    # Ensure super admin is always in the list
    if "marketinsightscenter@gmail.com" not in mods:
        mods.append("marketinsightscenter@gmail.com")
    
    return mods

def save_mod_list(mods):
    try:
        with open(MODS_FILE, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["email"])
            for email in mods:
                writer.writerow([email])
    except Exception as e:
        print(f"Error saving mods file: {e}")

def normalize_table_data(data):
    normalized = []
    # Handle different data structures (list of dicts or dict of dicts)
    iterable = data.values() if isinstance(data, dict) else data
    
    for item in iterable:
        ticker = item.get("ticker") or item.get("Ticker")
        if not ticker: continue
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

async def fetch_ticker_data(symbol: str, background_tasks: BackgroundTasks = None) -> Dict[str, Any]:
    
    # 1. FAST DATA (Price, Change, Sparkline) - Always fetch fresh
    async with YF_SEMAPHORE:
        def _get_fast():
            try:
                ticker = yf.Ticker(symbol)
                
                # Price
                current_price = 0.0
                try:
                    if hasattr(ticker, 'fast_info'):
                        p = getattr(ticker.fast_info, 'last_price', None)
                        if not p: p = getattr(ticker.fast_info, 'regular_market_price', None)
                        if p: current_price = float(p)
                except: pass

                # History (2y for calculations)
                try:
                    hist = ticker.history(period="2y", interval="1d")
                except:
                    hist = pd.DataFrame()
                
                if not hist.empty and current_price == 0.0:
                    current_price = float(hist['Close'].iloc[-1])

                # Sparkline
                try:
                    spark_hist = ticker.history(period="5d", interval="15m")
                except:
                    spark_hist = pd.DataFrame()

                return hist, spark_hist, current_price
            except:
                return pd.DataFrame(), pd.DataFrame(), 0.0

        hist, spark_hist, current_price = await asyncio.to_thread(_get_fast)

    # 2. SLOW DATA (Info, Earnings, IV) - Check Cache
    cached = MARKET_DATA_CACHE.get(symbol)
    now = datetime.datetime.now().timestamp()
    
    need_fetch = False
    if not cached:
        need_fetch = True
        slow_data = {"info": {}, "earnings": "Loading...", "iv": "Loading..."}
    elif (now - cached["timestamp"]) > CACHE_EXPIRY_SECONDS:
        need_fetch = True
        slow_data = cached # Return stale data while updating
    else:
        slow_data = cached

    if need_fetch and background_tasks:
        background_tasks.add_task(fetch_slow_data_task, symbol)

    # --- Calculations ---
    info = slow_data.get("info", {})
    name = info.get('shortName') or info.get('longName') or symbol
    
    market_cap_str = "-"
    mc = info.get('marketCap')
    if mc:
        if mc >= 1e12: market_cap_str = f"{mc/1e12:.2f}T"
        elif mc >= 1e9: market_cap_str = f"{mc/1e9:.2f}B"
        elif mc >= 1e6: market_cap_str = f"{mc/1e6:.2f}M"
        else: market_cap_str = f"{mc:.0f}"

    vol_str = "-"
    change_p_1d = 0.0
    change_1w = 0.0
    change_1m = 0.0
    change_1y = 0.0
    change_ytd = 0.0
    sparkline_points = []

    if not hist.empty and current_price > 0:
        # 1D Change
        if len(hist) >= 2:
            prev = float(hist['Close'].iloc[-2])
            if prev > 0:
                change_p_1d = ((current_price - prev) / prev) * 100
        
        # Volume
        if 'Volume' in hist.columns:
            vol = int(hist['Volume'].iloc[-1])
            if vol >= 1e9: vol_str = f"{vol/1e9:.2f}B"
            elif vol >= 1e6: vol_str = f"{vol/1e6:.2f}M"
            elif vol >= 1e3: vol_str = f"{vol/1e3:.2f}K"
            else: vol_str = str(vol)

        # Historical Changes
        def get_change(days_back):
            if len(hist) > days_back:
                try:
                    old_price = float(hist['Close'].iloc[-(days_back+1)])
                    if old_price > 0:
                        return ((current_price - old_price) / old_price) * 100
                except: pass
            return 0.0

        change_1w = get_change(5)
        change_1m = get_change(21)
        change_1y = get_change(252)

        # YTD
        try:
            yr = pd.Timestamp.now().year
            ytd_hist = hist[hist.index.year == yr]
            if not ytd_hist.empty:
                start_price = float(ytd_hist['Close'].iloc[0])
                if start_price > 0:
                    change_ytd = ((current_price - start_price) / start_price) * 100
        except: pass

    if not spark_hist.empty and 'Close' in spark_hist.columns:
        try:
            clean = spark_hist['Close'].dropna()
            if not clean.empty:
                sparkline_points = clean.tail(30).tolist()
        except: pass

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
        "iv": slow_data.get("iv", "N/A"),
        "earnings": slow_data.get("earnings", "N/A"),
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
async def get_market_data(request: MarketDataRequest, background_tasks: BackgroundTasks):
    if not request.tickers: return {"results": {}}
    
    try:
        # Concurrent execution with Semaphore controlled inside the function
        tasks = [fetch_ticker_data(t, background_tasks) for t in request.tickers]
        results_list = await asyncio.gather(*tasks)
        results = {res['symbol']: res for res in results_list}
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/invest")
async def run_invest(request: InvestRequest):
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
    ai_params = request.model_dump()
    if request.sub_portfolios:
        ai_params["sub_portfolios"] = [sp.model_dump() for sp in request.sub_portfolios]

    try:
        result = await tracking_command.handle_tracking_command(args=[], ai_params=ai_params, is_called_by_ai=True)
        if isinstance(result, dict) and "table" in result and isinstance(result["table"], list):
             if len(result["table"]) > 0 and "alloc" not in result["table"][0]:
                 result["table"] = normalize_table_data(result["table"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Mod Management Endpoints ---

@app.get("/api/mods")
def read_mods():
    return {"mods": get_mod_list()}

@app.post("/api/mods")
def manage_mods(request: ModRequest):
    SUPER_ADMIN = "marketinsightscenter@gmail.com"
    
    if request.requester_email != SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only the Super Admin can manage moderators.")

    current_mods = get_mod_list()
    
    if request.action == "add":
        if request.email not in current_mods:
            current_mods.append(request.email)
            save_mod_list(current_mods)
            return {"status": "success", "message": f"Added {request.email} as moderator."}
        return {"status": "info", "message": f"{request.email} is already a moderator."}
    
    elif request.action == "remove":
        if request.email == SUPER_ADMIN:
             raise HTTPException(status_code=400, detail="Cannot remove the Super Admin.")
        
        if request.email in current_mods:
            current_mods.remove(request.email)
            save_mod_list(current_mods)
            return {"status": "success", "message": f"Removed {request.email} from moderators."}
        return {"status": "info", "message": f"{request.email} is not a moderator."}
    
    raise HTTPException(status_code=400, detail="Invalid action.")

# --- Community Features (Articles & Comments) ---

@app.post("/api/comments")
def add_comment(comment: Comment):
    comments = load_json(COMMENTS_FILE)
    new_comment = comment.model_dump()
    
    # Generate ID
    max_id = 0
    def find_max_id(comment_list):
        m = 0
        for c in comment_list:
            if c.get('id', 0) > m: m = c.get('id', 0)
            if 'replies' in c:
                rm = find_max_id(c['replies'])
                if rm > m: m = rm
        return m

    max_id = find_max_id(comments)
    new_comment['id'] = max_id + 1
    
    comments.append(new_comment)
    save_json(COMMENTS_FILE, comments)
    return new_comment

@app.post("/api/comments/{comment_id}/reply")
def add_reply(comment_id: int, reply: Dict[str, Any]):
    comments = load_json(COMMENTS_FILE)
    
    def add_reply_recursive(comment_list):
        for c in comment_list:
            if c['id'] == comment_id:
                if 'replies' not in c: c['replies'] = []
                c['replies'].append(reply)
                return True
            if 'replies' in c and add_reply_recursive(c['replies']):
                return True
        return False

    if add_reply_recursive(comments):
        save_json(COMMENTS_FILE, comments)
        return {"status": "success", "message": "Reply added"}
    
    raise HTTPException(status_code=404, detail="Parent comment not found")

@app.post("/api/comments/{comment_id}/vote")
def vote_comment(comment_id: int, vote: VoteRequest):
    comments = load_json(COMMENTS_FILE)
    
    def vote_recursive(comment_list):
        for c in comment_list:
            if c['id'] == comment_id:
                if vote.type == 'up': c['likes'] += 1
                elif vote.type == 'down': c['dislikes'] += 1
                return True
            if 'replies' in c and vote_recursive(c['replies']):
                return True
        return False

    if vote_recursive(comments):
        save_json(COMMENTS_FILE, comments)
        return {"status": "success"}
    
    raise HTTPException(status_code=404, detail="Comment not found")

@app.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: int, requester_email: str):
    mods = get_mod_list()
    if requester_email not in mods:
        raise HTTPException(status_code=403, detail="Only moderators can delete comments.")
    
    comments = load_json(COMMENTS_FILE)
    
    def delete_recursive(comment_list):
        new_list = []
        for c in comment_list:
            if c['id'] == comment_id:
                continue # Skip this one (delete it)
            
            if 'replies' in c:
                c['replies'] = delete_recursive(c['replies'])
            
            new_list.append(c)
        return new_list

    new_comments = delete_recursive(comments)
    save_json(COMMENTS_FILE, new_comments)
    return {"status": "success", "message": "Comment deleted"}

@app.get("/api/articles")
def get_articles():
    articles = load_json(ARTICLES_FILE)
    return articles

@app.get("/api/articles/{article_id}")
def get_article(article_id: int):
    articles = load_json(ARTICLES_FILE)
    for a in articles:
        if a.get("id") == article_id:
            return a
    raise HTTPException(status_code=404, detail="Article not found")

@app.get("/api/stats")
def get_stats():
    users = load_json(USERS_FILE)
    comments = load_json(COMMENTS_FILE)
    articles = load_json(ARTICLES_FILE)
    
    # Calculate stats
    total_users = len(users)
    
    def count_comments(comment_list):
        count = 0
        for c in comment_list:
            count += 1
            if 'replies' in c:
                count += count_comments(c['replies'])
        return count
    
    total_posts = count_comments(comments)
    
    # Trending topics (hashtags from articles)
    hashtag_counts = {}
    for a in articles:
        for tag in a.get('hashtags', []):
            hashtag_counts[tag] = hashtag_counts.get(tag, 0) + 1
            
    sorted_tags = sorted(hashtag_counts.items(), key=lambda x: x[1], reverse=True)
    trending = [tag for tag, count in sorted_tags[:5]]
    
    # Fallback if no tags
    if not trending:
        trending = ["#AI_Investing", "#Market_Trends", "#Crypto", "#Tech", "#Finance"]

    return {
        "community_stats": {
            "online": random.randint(1200, 1500), # Mock "online" for liveliness
            "total_users": total_users,
            "total_posts": total_posts + len(articles)
        },
        "trending_topics": trending
    }

@app.post("/api/articles/{article_id}/vote")
def vote_article(article_id: int, vote: VoteRequest):
    articles = load_json(ARTICLES_FILE)
    for a in articles:
        if a.get("id") == article_id:
            if vote.type == 'up': a['likes'] += 1
            elif vote.type == 'down': a['dislikes'] += 1
            save_json(ARTICLES_FILE, articles)
            return {"status": "success", "likes": a['likes'], "dislikes": a['dislikes']}
    raise HTTPException(status_code=404, detail="Article not found")

@app.post("/api/articles")
def add_article(article: Article):
    articles = load_json(ARTICLES_FILE)
    new_article = article.model_dump()
    
    # Generate ID
    max_id = 0
    for a in articles:
        if a.get("id", 0) > max_id:
            max_id = a.get("id", 0)
    new_article["id"] = max_id + 1
    
    articles.insert(0, new_article) # Add to top
    save_json(ARTICLES_FILE, articles)
    return new_article

@app.get("/api/users")
def get_users():
    return load_json(USERS_FILE)

@app.post("/api/users")
def save_user(user: UserSubscription):
    users = load_json(USERS_FILE)
    user_data = user.model_dump()
    
    # Update existing or add new
    for i, u in enumerate(users):
        if u['email'] == user_data['email']:
            users[i] = user_data
            save_json(USERS_FILE, users)
            return {"status": "success", "message": "User updated"}
            
    users.append(user_data)
    save_json(USERS_FILE, users)
    return {"status": "success", "message": "User added"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)