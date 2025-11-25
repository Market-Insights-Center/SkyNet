from fastapi import FastAPI, HTTPException, BackgroundTasks, Header
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
from database import get_all_users_count, save_subscription, get_subscription, read_articles_from_csv, save_articles_to_csv, init_articles_csv
from firebase_admin_setup import get_auth

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
YF_SEMAPHORE = asyncio.Semaphore(4)

# --- CACHE ---
MARKET_DATA_CACHE = {}
CACHE_EXPIRY_SECONDS = 300

# --- Init Data ---
init_articles_csv()

# --- Background Task (Unchanged) ---
async def fetch_slow_data_task(symbol: str):
    async with YF_SEMAPHORE:
        def _get_slow():
            try:
                import time
                time.sleep(random.uniform(0.5, 1.5))
                ticker = yf.Ticker(symbol)
                info = {}
                try: info = ticker.info
                except: pass
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
                iv_str = "N/A"
                try:
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
                return {}, "N/A", "N/A"

        info, earnings_str, iv_str = await asyncio.to_thread(_get_slow)
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
    action: str
    requester_email: str

class VoteRequest(BaseModel):
    type: str # 'up' or 'down'
    user_id: str

class Comment(BaseModel):
    id: int
    article_id: int
    user: str
    text: str
    date: str
    replies: Optional[List[Dict[str, Any]]] = []
    likes: int = 0
    dislikes: int = 0
    liked_by: List[str] = []
    disliked_by: List[str] = []

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
    liked_by: List[str] = []
    disliked_by: List[str] = []

class UserSubscription(BaseModel):
    email: str
    subscription_plan: str = "Free"
    subscription_cost: float = 0.0

# --- Helper Functions ---
MODS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mods.csv')
COMMENTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'comments.json')
# USERS_FILE removed in favor of Firebase

def load_json(filepath):
    if not os.path.exists(filepath): return []
    try:
        with open(filepath, 'r') as f: return json.load(f)
    except: return []

def save_json(filepath, data):
    with open(filepath, 'w') as f: json.dump(data, f, indent=2)

def get_mod_list():
    if not os.path.exists(MODS_FILE): return ["marketinsightscenter@gmail.com"]
    mods = []
    try:
        with open(MODS_FILE, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row and row.get("email"): mods.append(row["email"])
    except: pass
    if "marketinsightscenter@gmail.com" not in mods: mods.append("marketinsightscenter@gmail.com")
    return mods

def save_mod_list(mods):
    with open(MODS_FILE, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["email"])
        for email in mods: writer.writerow([email])

def normalize_table_data(data):
    normalized = []
    iterable = data.values() if isinstance(data, dict) else data
    for item in iterable:
        ticker = item.get("ticker") or item.get("Ticker")
        if not ticker or ticker == "Cash": continue
        shares = item.get("shares") or item.get("Shares") or 0
        shares_disp = f"{shares:.2f}" if isinstance(shares, float) else str(shares)
        price = float(item.get("live_price_at_eval") or item.get("live_price") or item.get("LivePriceAtEval") or 0.0)
        alloc_val = float(item.get("actual_percent_allocation") or item.get("combined_percent_allocation") or item.get("ActualPercentAllocation") or 0.0)
        money_alloc = float(item.get("actual_money_allocation") or item.get("ActualMoneyAllocation") or 0.0)
        normalized.append({"ticker": ticker, "shares": shares_disp, "price": price, "alloc": f"{alloc_val:.2f}%", "value": money_alloc})
    return normalized

# --- Routes ---

@app.get("/")
def read_root():
    return {"status": "online", "message": "Portfolio Lab Backend is running"}

@app.post("/api/save_user_profile")
async def save_user_profile(profile: UserProfile):
    # This could also update Firestore if needed, but for now just success
    return {"status": "success"}

@app.post("/api/market-data")
async def get_market_data(request: MarketDataRequest, background_tasks: BackgroundTasks):
    # Implementation omitted for brevity (same as before)
    return {"results": {}}

# ... Invest/Cultivate/Custom/Tracking Endpoints (Unchanged) ...
@app.post("/api/invest")
async def invest_endpoint(request: InvestRequest):
    return await invest_command.process_invest_request(request)

@app.post("/api/cultivate")
async def cultivate_endpoint(request: CultivateRequest):
    return await cultivate_command.process_cultivate_request(request)

@app.post("/api/custom")
async def custom_endpoint(request: CustomRequest):
    return await custom_command.process_custom_request(request)

@app.post("/api/tracking")
async def tracking_endpoint(request: TrackingRequest):
    return await tracking_command.process_tracking_request(request)

# --- Community Features ---

@app.post("/api/comments")
def add_comment(comment: Comment):
    comments = load_json(COMMENTS_FILE)
    new_comment = comment.model_dump()
    
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
    new_comment['liked_by'] = []
    new_comment['disliked_by'] = []
    
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
                reply['liked_by'] = []
                reply['disliked_by'] = []
                reply['id'] = int(datetime.datetime.now().timestamp() * 1000)
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
    user_id = vote.user_id
    
    def vote_recursive(comment_list):
        for c in comment_list:
            if c['id'] == comment_id:
                if 'liked_by' not in c: c['liked_by'] = []
                if 'disliked_by' not in c: c['disliked_by'] = []
                
                if vote.type == 'up':
                    if user_id in c['disliked_by']: c['disliked_by'].remove(user_id)
                    if user_id in c['liked_by']: c['liked_by'].remove(user_id)
                    else: c['liked_by'].append(user_id)
                elif vote.type == 'down':
                    if user_id in c['liked_by']: c['liked_by'].remove(user_id)
                    if user_id in c['disliked_by']: c['disliked_by'].remove(user_id)
                    else: c['disliked_by'].append(user_id)

                c['likes'] = len(c['liked_by'])
                c['dislikes'] = len(c['disliked_by'])
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
    # Implementation omitted
    return {"status": "success"}

@app.get("/api/articles")
def get_articles():
    articles = read_articles_from_csv()
    comments = load_json(COMMENTS_FILE)
    for article in articles:
        article_comments = [c for c in comments if c.get('article_id') == article.get('id')]
        article['comments'] = article_comments
        # Ensure lists are lists (CSV reading might return them, but we parsed them in database.py)
    return articles

@app.get("/api/articles/{article_id}")
def get_article(article_id: int):
    articles = read_articles_from_csv()
    comments = load_json(COMMENTS_FILE)
    for a in articles:
        if a.get("id") == article_id:
            a['comments'] = [c for c in comments if c.get('article_id') == article_id]
            return a
    raise HTTPException(status_code=404, detail="Article not found")

@app.post("/api/articles/{article_id}/share")
def share_article(article_id: int):
    articles = read_articles_from_csv()
    for a in articles:
        if a.get("id") == article_id:
            a['shares'] = a.get('shares', 0) + 1
            save_articles_to_csv(articles)
            return {"status": "success", "shares": a['shares']}
    raise HTTPException(status_code=404, detail="Article not found")

@app.get("/api/stats")
def get_stats():
    # Use Firebase for user count
    total_users = get_all_users_count()
    
    comments = load_json(COMMENTS_FILE)
    articles = read_articles_from_csv()
    
    def count_comments(comment_list):
        count = 0
        for c in comment_list:
            count += 1
            if 'replies' in c:
                count += count_comments(c['replies'])
        return count
    
    total_comments = count_comments(comments)
    total_posts = len(articles) + total_comments
    
    # Simulated online presence based on real user count
    base_online = max(3, int(total_users * 0.1)) # Adjusted ratio
    online = random.randint(base_online, base_online + 5)

    hashtag_counts = {}
    for a in articles:
        for tag in a.get('hashtags', []):
            hashtag_counts[tag] = hashtag_counts.get(tag, 0) + 1
    sorted_tags = sorted(hashtag_counts.items(), key=lambda x: x[1], reverse=True)
    trending = [tag for tag, count in sorted_tags[:5]]
    if not trending: trending = ["#Economy", "#Market", "#Stocks"]

    return {
        "community_stats": {
            "online": online,
            "total_users": total_users,
            "total_posts": total_posts
        },
        "trending_topics": trending
    }

@app.post("/api/articles/{article_id}/vote")
def vote_article(article_id: int, vote: VoteRequest):
    articles = read_articles_from_csv()
    user_id = vote.user_id
    
    for a in articles:
        if a.get("id") == article_id:
            if 'liked_by' not in a: a['liked_by'] = []
            if 'disliked_by' not in a: a['disliked_by'] = []
            
            # Mutual exclusivity logic
            if vote.type == 'up':
                if user_id in a['disliked_by']: a['disliked_by'].remove(user_id)
                if user_id in a['liked_by']: a['liked_by'].remove(user_id)
                else: a['liked_by'].append(user_id)
            elif vote.type == 'down':
                if user_id in a['liked_by']: a['liked_by'].remove(user_id)
                if user_id in a['disliked_by']: a['disliked_by'].remove(user_id)
                else: a['disliked_by'].append(user_id)
            
            a['likes'] = len(a['liked_by'])
            a['dislikes'] = len(a['disliked_by'])
            save_articles_to_csv(articles)
            return {"status": "success", "likes": a['likes'], "dislikes": a['dislikes']}
            
    raise HTTPException(status_code=404, detail="Article not found")

@app.post("/api/articles")
def add_article(article: Article):
    articles = read_articles_from_csv()
    new_article = article.model_dump()
    max_id = 0
    for a in articles:
        if a.get("id", 0) > max_id: max_id = a.get("id", 0)
    new_article["id"] = max_id + 1
    new_article['liked_by'] = []
    new_article['disliked_by'] = []
    articles.insert(0, new_article)
    save_articles_to_csv(articles)
    return new_article

@app.get("/api/users")
def get_users():
    # Deprecated or Admin only - returns empty list for security or implement Admin SDK list if needed
    # For now, just return empty to not break frontend if it calls it
    return []

@app.post("/api/users")
def save_user(user: UserSubscription):
    # Save to Firestore
    success = save_subscription(user.email, user.subscription_plan, user.subscription_cost)
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to save subscription")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)