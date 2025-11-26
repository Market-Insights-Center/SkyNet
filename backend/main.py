
from fastapi import FastAPI, HTTPException, Depends
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
from database import read_articles_from_csv, save_articles_to_csv

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

# --- Constants ---
USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.json')
MODS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mods.csv')
COMMENTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'comments.json')

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
    email: str
    risk_tolerance: int
    user_id: str
    vote_type: str # 'up' or 'down'

class ShareRequest(BaseModel):
    platform: str

class UserSubscription(BaseModel):
    email: str
    subscription_plan: str
    cost: float
    updated_at: Optional[str] = None
    password: Optional[str] = None # For Google users setting password

class Comment(BaseModel):
    id: int
    article_id: int
    user: str
    email: Optional[str] = None
    text: str
    date: str
    replies: Optional[List['Comment']] = []
    likes: int = 0
    dislikes: int = 0

# Needed for recursive models
Comment.model_rebuild()

class Article(BaseModel):
    id: Optional[int] = None
    title: str
    subheading: Optional[str] = ""
    content: str
    author: str
    date: Optional[str] = None
    category: str = "General"
    hashtags: List[str] = []
    cover_image: Optional[str] = None
    likes: int = 0
    dislikes: int = 0
    shares: int = 0
    liked_by: List[str] = []
    disliked_by: List[str] = []
    comments: List[Comment] = []

class MarketDataRequest(BaseModel):
    tickers: List[str]

class ModRequest(BaseModel):
    email: str
    action: str # "add" or "remove"
    requester_email: str

class ArticleVoteRequest(BaseModel):
    user_id: str
    vote_type: str # 'up' or 'down'

# --- Helper Functions ---

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
        json.dump(data, f, indent=4)

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

# --- API Endpoints ---

@app.post("/api/invest")
async def invest_endpoint(request: InvestRequest):
    try:
        ai_params = request.model_dump()
        result = await invest_command.handle_invest_command([], ai_params=ai_params, is_called_by_ai=True)
        if isinstance(result, tuple):
             # Unpack tuple from process_custom_portfolio
             # return [], final_combined_portfolio_data_calc, final_cash, tailored_data
             _, _, final_cash, tailored_data = result
             return {"status": "success", "holdings": tailored_data, "final_cash": final_cash}
        return result
    except Exception as e:
        logger.error(f"Invest Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cultivate")
async def cultivate_endpoint(request: CultivateRequest):
    try:
        ai_params = request.model_dump()
        result = await cultivate_command.handle_cultivate_command([], ai_params=ai_params, is_called_by_ai=True)
        if isinstance(result, tuple):
             # return tailored_entries, final_cash
             tailored_entries, final_cash = result
             return {"status": "success", "holdings": tailored_entries, "final_cash": final_cash}
        return result
    except Exception as e:
        logger.error(f"Cultivate Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom")
async def custom_endpoint(request: CustomRequest):
    try:
        ai_params = request.model_dump()
        result = await custom_command.handle_custom_command([], ai_params=ai_params, is_called_by_ai=True)
        return result
    except Exception as e:
        logger.error(f"Custom Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tracking")
async def tracking_endpoint(request: TrackingRequest):
    try:
        ai_params = request.model_dump()
        result = await tracking_command.handle_tracking_command([], ai_params=ai_params, is_called_by_ai=True)
        return result
    except Exception as e:
        logger.error(f"Tracking Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/market-data")
async def market_data_endpoint(request: MarketDataRequest):
    try:
        tickers = request.tickers
        if not tickers:
            return []
        
        data = []
        async with YF_SEMAPHORE:
            for ticker in tickers:
                try:
                    stock = yf.Ticker(ticker)
                    info = stock.fast_info
                    price = info.last_price
                    prev_close = info.previous_close
                    change = price - prev_close
                    change_percent = (change / prev_close) * 100 if prev_close else 0
                    
                    # 1Y and 5Y change (approximate)
                    hist = stock.history(period="5y")
                    change_1y = 0
                    change_5y = 0
                    
                    if not hist.empty:
                        current = hist['Close'].iloc[-1]
                        if len(hist) > 252:
                            price_1y = hist['Close'].iloc[-252]
                            change_1y = ((current - price_1y) / price_1y) * 100
                        if len(hist) > 0:
                            price_5y = hist['Close'].iloc[0]
                            change_5y = ((current - price_5y) / price_5y) * 100

                    data.append({
                        "ticker": ticker,
                        "price": price,
                        "change": change,
                        "changePercent": change_percent,
                        "marketCap": info.market_cap,
                        "volume": info.last_volume,
                        "change1Y": change_1y,
                        "change5Y": change_5y
                    })
                except Exception as e:
                    print(f"Error fetching {ticker}: {e}")
                    # Return partial data or skip
                    data.append({
                        "ticker": ticker,
                        "price": 0,
                        "change": 0,
                        "changePercent": 0,
                        "marketCap": 0,
                        "volume": 0,
                        "change1Y": 0,
                        "change5Y": 0
                    })
        return data
    except Exception as e:
        logger.error(f"Market Data Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
def get_stats():
    users = load_json(USERS_FILE)
    articles = read_articles_from_csv()
    
    total_users = len(users)
    # Heuristic for active users: 80% of total users for now, or check updated_at if available
    active_users = int(total_users * 0.8) if total_users > 0 else 0
    total_posts = len(articles)
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_posts": total_posts
    }

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
            # Preserve existing fields if not provided in update
            existing_user = users[i]
            updated_user = {**existing_user, **user_data}
            # Remove None values to avoid overwriting with nulls if that's not intended
            # But here we want to update what's passed.
            users[i] = updated_user
            save_json(USERS_FILE, users)
            return {"status": "success", "message": "User updated"}
            
    users.append(user_data)
    save_json(USERS_FILE, users)
    return {"status": "success", "message": "User added"}

@app.get("/api/mods")
def get_mods():
    return {"mods": get_mod_list()}

@app.post("/api/mods")
def manage_mods(request: ModRequest):
    mods = get_mod_list()
    
    # Only super admin can add/remove mods
    if request.requester_email != "marketinsightscenter@gmail.com":
         raise HTTPException(status_code=403, detail="Only Super Admin can manage moderators")

    if request.action == "add":
        if request.email not in mods:
            mods.append(request.email)
            with open(MODS_FILE, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([request.email])
        return {"status": "success", "mods": mods}
    
    elif request.action == "remove":
        if request.email == "marketinsightscenter@gmail.com":
            raise HTTPException(status_code=400, detail="Cannot remove Super Admin")
        
        if request.email in mods:
            mods.remove(request.email)
            # Rewrite file
            with open(MODS_FILE, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["email"])
                for m in mods:
                    writer.writerow([m])
        return {"status": "success", "mods": mods}
    
    return {"status": "error", "message": "Invalid action"}

# --- Article Endpoints ---

@app.get("/api/articles")
def get_articles(limit: int = 100, sort: str = "recent"):
    articles = read_articles_from_csv()
    # Sort by date descending
    articles.sort(key=lambda x: x.get('date', ''), reverse=True)
    return articles[:limit]

@app.get("/api/articles/{article_id}")
def get_article(article_id: int):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Attach comments
    comments = load_json(COMMENTS_FILE)
    article_comments = [c for c in comments if c['article_id'] == article_id]
    article['comments'] = article_comments
    
    return article

@app.post("/api/articles")
def create_article(article: Article):
    articles = read_articles_from_csv()
    new_id = max([int(a.get('id', 0)) for a in articles], default=0) + 1
    article.id = new_id
    # Ensure date is set if not provided
    if not article.date:
        article.date = datetime.datetime.now().strftime("%Y-%m-%d")
        
    articles.insert(0, article.model_dump())
    save_articles_to_csv(articles)
    return {"status": "success", "article": article}

@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int):
    articles = read_articles_from_csv()
    initial_len = len(articles)
    articles = [a for a in articles if int(a['id']) != article_id]
    
    if len(articles) == initial_len:
        raise HTTPException(status_code=404, detail="Article not found")
        
    save_articles_to_csv(articles)
    return {"status": "success", "message": "Article deleted"}

@app.post("/api/articles/{article_id}/vote")
def vote_article(article_id: int, request: ArticleVoteRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    user_id = request.user_id
    vote_type = request.vote_type
    
    liked_by = article.get('liked_by', [])
    disliked_by = article.get('disliked_by', [])
    
    # Ensure lists
    if not isinstance(liked_by, list): liked_by = []
    if not isinstance(disliked_by, list): disliked_by = []

    # Remove existing votes from both lists to ensure exclusivity
    if user_id in liked_by:
        liked_by.remove(user_id)
        article['likes'] = max(0, article.get('likes', 0) - 1)
    if user_id in disliked_by:
        disliked_by.remove(user_id)
        article['dislikes'] = max(0, article.get('dislikes', 0) - 1)
        
    # Add new vote
    if vote_type == 'up':
        liked_by.append(user_id)
@app.post("/api/mods")
def manage_mods(request: ModRequest):
    mods = get_mod_list()
    
    # Only super admin can add/remove mods
    if request.requester_email != "marketinsightscenter@gmail.com":
         raise HTTPException(status_code=403, detail="Only Super Admin can manage moderators")

    if request.action == "add":
        if request.email not in mods:
            mods.append(request.email)
            with open(MODS_FILE, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([request.email])
        return {"status": "success", "mods": mods}
    
    elif request.action == "remove":
        if request.email == "marketinsightscenter@gmail.com":
            raise HTTPException(status_code=400, detail="Cannot remove Super Admin")
        
        if request.email in mods:
            mods.remove(request.email)
            # Rewrite file
            with open(MODS_FILE, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["email"])
                for m in mods:
                    writer.writerow([m])
        return {"status": "success", "mods": mods}
    
    return {"status": "error", "message": "Invalid action"}

# --- Article Endpoints ---

@app.get("/api/articles")
def get_articles(limit: int = 100, sort: str = "recent"):
    articles = read_articles_from_csv()
    # Sort by date descending
    articles.sort(key=lambda x: x.get('date', ''), reverse=True)
    return articles[:limit]

@app.get("/api/articles/{article_id}")
def get_article(article_id: int):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Attach comments
    comments = load_json(COMMENTS_FILE)
    article_comments = [c for c in comments if c['article_id'] == article_id]
    article['comments'] = article_comments
    
    return article

@app.post("/api/articles")
def create_article(article: Article):
    articles = read_articles_from_csv()
    new_id = max([int(a.get('id', 0)) for a in articles], default=0) + 1
    article.id = new_id
    # Ensure date is set if not provided
    if not article.date:
        article.date = datetime.datetime.now().strftime("%Y-%m-%d")
        
    articles.insert(0, article.model_dump())
    save_articles_to_csv(articles)
    return {"status": "success", "article": article}

@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int):
    articles = read_articles_from_csv()
    initial_len = len(articles)
    articles = [a for a in articles if int(a['id']) != article_id]
    
    if len(articles) == initial_len:
        raise HTTPException(status_code=404, detail="Article not found")
        
    save_articles_to_csv(articles)
    return {"status": "success", "message": "Article deleted"}

@app.post("/api/articles/{article_id}/vote")
def vote_article(article_id: int, request: ArticleVoteRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    user_id = request.user_id
    vote_type = request.vote_type
    
    liked_by = article.get('liked_by', [])
    disliked_by = article.get('disliked_by', [])
    
    # Ensure lists
    if not isinstance(liked_by, list): liked_by = []
    if not isinstance(disliked_by, list): disliked_by = []

    # Remove existing votes from both lists to ensure exclusivity
    if user_id in liked_by:
        liked_by.remove(user_id)
        article['likes'] = max(0, article.get('likes', 0) - 1)
    if user_id in disliked_by:
        disliked_by.remove(user_id)
        article['dislikes'] = max(0, article.get('dislikes', 0) - 1)
        
    # Add new vote
    if vote_type == 'up':
        liked_by.append(user_id)
        article['likes'] = article.get('likes', 0) + 1
    elif vote_type == 'down':
        disliked_by.append(user_id)
        article['dislikes'] = article.get('dislikes', 0) + 1
        
    article['liked_by'] = liked_by
    article['disliked_by'] = disliked_by
    
    save_articles_to_csv(articles)
    return {"status": "success", "likes": article['likes'], "dislikes": article['dislikes']}

@app.post("/api/articles/{article_id}/share")
def share_article(article_id: int, request: ShareRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
        
    article['shares'] = article.get('shares', 0) + 1
    save_articles_to_csv(articles)
    return {"status": "success", "shares": article['shares']}

# --- Comment Endpoints ---

@app.post("/api/comments")
def add_comment(comment: Comment):
    comments = load_json(COMMENTS_FILE)
    # Generate ID
    new_id = max([c.get('id', 0) for c in comments], default=0) + 1
    comment.id = new_id
    if not comment.date:
        comment.date = datetime.datetime.now().strftime("%Y-%m-%d")
        
    comments.append(comment.model_dump())
    save_json(COMMENTS_FILE, comments)
    return {"status": "success", "comment": comment}

@app.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: int, requester_email: str):
    mods = get_mod_list()
    if requester_email not in mods:
        raise HTTPException(status_code=403, detail="Only admins can delete comments")

    comments = load_json(COMMENTS_FILE)
    initial_len = len(comments)
    comments = [c for c in comments if c['id'] != comment_id]
    
    if len(comments) == initial_len:
        raise HTTPException(status_code=404, detail="Comment not found")
        
    save_json(COMMENTS_FILE, comments)
    return {"status": "success", "message": "Comment deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)