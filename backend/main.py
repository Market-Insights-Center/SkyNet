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
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from collections import Counter
from firebase_admin import auth 
import uuid

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Ensure database.py has read_user_profiles implemented as discussed
from integration import invest_command, cultivate_command, custom_command, tracking_command
from database import read_articles_from_csv, save_articles_to_csv, read_user_profiles

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

# --- CONFIGURATION ---
# Replace with your actual email credentials or use environment variables
EMAIL_USER = os.environ.get("EMAIL_USER", "marketinsightscenter@gmail.com") 
EMAIL_PASS = os.environ.get("EMAIL_PASS", "your-app-password") # Google App Password

YF_SEMAPHORE = asyncio.Semaphore(4)

# --- Constants ---
USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.json')
MODS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mods.csv')
COMMENTS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'comments.json')
CHATS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chats.json')

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
    vote_type: str

class ShareRequest(BaseModel):
    platform: str

class EmailShareRequest(BaseModel):
    email: str
    sender_name: str
    article_link: str
    article_title: str

class UserSubscription(BaseModel):
    email: str
    subscription_plan: str
    cost: float
    updated_at: Optional[str] = None
    password: Optional[str] = None 

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
    action: str 
    requester_email: str

class ArticleVoteRequest(BaseModel):
    user_id: str
    vote_type: str 

# --- Chat Models ---

class ChatMessage(BaseModel):
    id: str
    sender: str
    text: str
    timestamp: str

class CreateChatRequest(BaseModel):
    type: str # 'direct' or 'admin_support'
    participants: List[str] # Emails of participants
    initial_message: Optional[str] = None
    creator_email: str

class SendMessageRequest(BaseModel):
    sender: str
    text: str

class DeleteChatRequest(BaseModel):
    chat_id: str
    email: str

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
    
    if "marketinsightscenter@gmail.com" not in mods:
        mods.append("marketinsightscenter@gmail.com")
    
    return mods

def send_real_email(to_email, subject, body):
    """Sends a real email using SMTP if configured."""
    if "your-app-password" in EMAIL_PASS:
        print(f"[EMAIL MOCK] To: {to_email} | Subject: {subject}")
        return False

    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_USER
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        text = msg.as_string()
        server.sendmail(EMAIL_USER, to_email, text)
        server.quit()
        print(f"[EMAIL SENT] To: {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR]: {e}")
        return False

# --- API Endpoints ---

# ... [Invest, Cultivate, Custom, Tracking endpoints omitted for brevity] ...
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
        logger.error(f"Invest Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cultivate")
async def cultivate_endpoint(request: CultivateRequest):
    try:
        ai_params = request.model_dump()
        result = await cultivate_command.handle_cultivate_command([], ai_params=ai_params, is_called_by_ai=True)
        if isinstance(result, tuple):
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
                    
                    # Fetch history for 1 year to calculate all changes + sparkline
                    hist = stock.history(period="1y")
                    
                    change_1w = 0
                    change_1m = 0
                    change_1y = 0
                    sparkline = []

                    if not hist.empty:
                        current = hist['Close'].iloc[-1]
                        
                        # 1 Week (approx 5 trading days)
                        if len(hist) > 5:
                            price_1w = hist['Close'].iloc[-6]
                            change_1w = ((current - price_1w) / price_1w) * 100
                        
                        # 1 Month (approx 21 trading days)
                        if len(hist) > 21:
                            price_1m = hist['Close'].iloc[-22]
                            change_1m = ((current - price_1m) / price_1m) * 100

                        # 1 Year (approx 252 trading days)
                        if len(hist) > 0:
                            price_1y = hist['Close'].iloc[0]
                            change_1y = ((current - price_1y) / price_1y) * 100
                            
                        # Sparkline: Last 30 points
                        sparkline = hist['Close'].tail(30).tolist()

                    prev_close = info.previous_close
                    change = price - prev_close
                    change_percent = (change / prev_close) * 100 if prev_close else 0

                    data.append({
                        "ticker": ticker,
                        "price": price,
                        "change": change,           # 1D Change $
                        "changePercent": change_percent, # 1D Change %
                        "change1W": change_1w,
                        "change1M": change_1m,
                        "change1Y": change_1y,
                        "marketCap": info.market_cap,
                        "volume": info.last_volume,
                        "sparkline": sparkline
                    })
                except Exception as e:
                    print(f"Error fetching {ticker}: {e}")
                    data.append({
                        "ticker": ticker,
                        "price": 0, "change": 0, "changePercent": 0,
                        "change1W": 0, "change1M": 0, "change1Y": 0,
                        "marketCap": 0, "volume": 0, "sparkline": []
                    })
        return data
    except Exception as e:
        logger.error(f"Market Data Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/market-data/details")
async def market_data_details_endpoint(request: MarketDataRequest):
    try:
        tickers = request.tickers
        if not tickers:
            return {"results": {}}
        
        results = {}
        async with YF_SEMAPHORE:
            for ticker in tickers:
                try:
                    stock = yf.Ticker(ticker)
                    info = stock.info
                    
                    # Robust IV Check
                    iv = info.get('impliedVolatility')
                    if iv is None:
                        try:
                            # Try computing from options if available (fallback)
                            # This gets the first expiration date options chain
                            if stock.options:
                                opt_date = stock.options[0]
                                opt = stock.option_chain(opt_date)
                                # Simple average of ATM call/put implied volatility
                                # This is a rough approximation if direct data is missing
                                calls_iv = opt.calls['impliedVolatility'].mean()
                                puts_iv = opt.puts['impliedVolatility'].mean()
                                if not np.isnan(calls_iv) and not np.isnan(puts_iv):
                                    iv = (calls_iv + puts_iv) / 2
                        except Exception as inner_e:
                            print(f"Failed to calculate IV fallback for {ticker}: {inner_e}")

                    if iv is None:
                        iv_display = "N/A"
                    else:
                        iv_display = f"{iv:.2%}"

                    pe = info.get('trailingPE', info.get('forwardPE'))
                    pe_display = f"{pe:.2f}" if pe else "N/A"

                    earnings = "N/A"
                    ts = info.get('earningsTimestamp')
                    if ts:
                        earnings = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d')
                    
                    results[ticker] = {
                        "iv": iv_display,
                        "peRatio": pe_display,
                        "earnings": earnings
                    }
                except Exception as e:
                    print(f"Error fetching details for {ticker}: {e}")
                    results[ticker] = { "iv": "N/A", "peRatio": "N/A", "earnings": "N/A" }
                    
        return {"results": results}
    except Exception as e:
        logger.error(f"Market Data Details Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
def get_stats():
    # To get total users count, we should ideally check Firebase
    try:
        page = auth.list_users()
        total_users = 0
        while page:
            total_users += len(page.users)
            page = page.get_next_page()
    except:
        users = load_json(USERS_FILE)
        total_users = len(users)

    articles = read_articles_from_csv()
    
    all_hashtags = []
    for a in articles:
        if isinstance(a.get('hashtags'), list):
            all_hashtags.extend(a['hashtags'])
        elif isinstance(a.get('hashtags'), str):
             tags = a['hashtags'].replace('[','').replace(']','').replace('"','').replace("'",'').split(',')
             all_hashtags.extend([t.strip() for t in tags if t.strip()])

    trending = [tag for tag, count in Counter(all_hashtags).most_common(5)] if all_hashtags else ["AI_Investing", "Crypto", "Market"]

    return {
        "total_users": total_users,
        "active_users": int(total_users * 0.8),
        "total_posts": len(articles),
        "trending_topics": trending
    }

@app.get("/api/users")
def get_users():
    """
    Fetches ALL users from Firebase Auth and merges with local DB data.
    This ensures admins see everyone, even if they haven't been saved to users.json yet.
    """
    local_users = load_json(USERS_FILE)
    profiles = read_user_profiles()
    
    # Create a map for fast lookup of local data
    local_map = {u['email']: u for u in local_users}
    
    all_users = []
    
    try:
        # Fetch from Firebase
        page = auth.list_users()
        while page:
            for user in page.users:
                email = user.email
                if not email: continue
                
                # Default Object
                user_obj = {
                    "email": email,
                    "uid": user.uid,
                    "subscription_plan": "Free",
                    "cost": 0.0,
                    "profile": None
                }
                
                # Merge Local Subscription Data
                if email in local_map:
                    user_obj.update(local_map[email])
                
                # Merge Profile Data
                if email in profiles:
                    user_obj['profile'] = profiles[email]
                    user_obj['risk_tolerance'] = profiles[email].get('risk_tolerance')
                    user_obj['trading_frequency'] = profiles[email].get('trading_frequency')
                
                all_users.append(user_obj)
                
            page = page.get_next_page()
            
    except Exception as e:
        print(f"Error fetching Firebase users: {e}")
        # Fallback to local file if Firebase fails (dev mode without creds)
        return local_users

    return all_users

@app.post("/api/users")
def save_user(user: UserSubscription):
    users = load_json(USERS_FILE)
    user_data = user.model_dump()
    
    found = False
    for i, u in enumerate(users):
        if u['email'] == user_data['email']:
            users[i]['subscription_plan'] = user_data['subscription_plan']
            users[i]['cost'] = user_data['cost']
            found = True
            break
            
    if not found:
        users.append(user_data)
        
    save_json(USERS_FILE, users)
    return {"status": "success", "message": "User updated"}

@app.get("/api/mods")
def get_mods():
    return {"mods": get_mod_list()}

@app.post("/api/mods")
def manage_mods(request: ModRequest):
    mods = get_mod_list()
    if request.requester_email != "marketinsightscenter@gmail.com":
         raise HTTPException(status_code=403, detail="Only Super Admin can manage moderators")

    if request.action == "add":
        if request.email not in mods:
            mods.append(request.email)
            with open(MODS_FILE, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([request.email])
    elif request.action == "remove":
        if request.email == "marketinsightscenter@gmail.com": raise HTTPException(status_code=400)
        if request.email in mods:
            mods.remove(request.email)
            with open(MODS_FILE, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["email"])
                for m in mods: writer.writerow([m])
    
    return {"status": "success", "mods": mods}

# --- Article Endpoints ---

@app.get("/api/articles")
def get_articles(limit: int = 100, sort: str = "recent"):
    articles = read_articles_from_csv()
    articles.sort(key=lambda x: x.get('date', ''), reverse=True)
    return articles[:limit]

@app.get("/api/articles/{article_id}")
def get_article(article_id: int):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    comments = load_json(COMMENTS_FILE)
    article['comments'] = [c for c in comments if c['article_id'] == article_id]
    return article

@app.post("/api/articles")
def create_article(article: Article):
    articles = read_articles_from_csv()
    new_id = max([int(a.get('id', 0)) for a in articles], default=0) + 1
    article.id = new_id
    if not article.date: article.date = datetime.datetime.now().strftime("%Y-%m-%d")
    articles.insert(0, article.model_dump())
    save_articles_to_csv(articles)
    return {"status": "success", "article": article}

@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int):
    articles = read_articles_from_csv()
    initial_len = len(articles)
    
    # Filter out the article
    articles = [a for a in articles if int(a.get('id', 0)) != int(article_id)]
    
    if len(articles) == initial_len:
        print(f"Failed to delete article {article_id}. ID not found.")
        raise HTTPException(status_code=404, detail="Article not found")
        
    success = save_articles_to_csv(articles)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save changes to database")
        
    return {"status": "success", "message": "Article deleted"}

@app.post("/api/articles/{article_id}/vote")
def vote_article(article_id: int, request: ArticleVoteRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article: raise HTTPException(status_code=404)
    
    user_id = request.user_id
    if not isinstance(article.get('liked_by'), list): article['liked_by'] = []
    if not isinstance(article.get('disliked_by'), list): article['disliked_by'] = []

    if user_id in article['liked_by']:
        article['liked_by'].remove(user_id)
        article['likes'] = max(0, article.get('likes', 0) - 1)
    if user_id in article['disliked_by']:
        article['disliked_by'].remove(user_id)
        article['dislikes'] = max(0, article.get('dislikes', 0) - 1)
        
    if request.vote_type == 'up':
        article['liked_by'].append(user_id)
        article['likes'] += 1
    elif request.vote_type == 'down':
        article['disliked_by'].append(user_id)
        article['dislikes'] += 1
        
    save_articles_to_csv(articles)
    return {"status": "success", "likes": article['likes'], "dislikes": article['dislikes']}

@app.post("/api/articles/{article_id}/share")
def share_article(article_id: int, request: ShareRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article: raise HTTPException(status_code=404)
    article['shares'] = article.get('shares', 0) + 1
    save_articles_to_csv(articles)
    return {"status": "success", "shares": article['shares']}

@app.post("/api/articles/{article_id}/share/email")
def share_article_email(article_id: int, request: EmailShareRequest):
    body = f"""
    Hello,

    {request.sender_name} has shared an article with you from Market Insights Center:

    Title: {request.article_title}
    Read here: {request.article_link}

    Best,
    Market Insights Center
    """
    
    # Try real email
    sent = send_real_email(request.email, f"{request.sender_name} shared an article", body)
    
    # Increment share count regardless of email success (user intention was to share)
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if article:
        article['shares'] = article.get('shares', 0) + 1
        save_articles_to_csv(articles)
        
    return {"status": "success", "message": "Email sent" if sent else "Email mocked (check logs)"}

@app.post("/api/comments")
def add_comment(comment: Comment):
    comments = load_json(COMMENTS_FILE)
    new_id = max([c.get('id', 0) for c in comments], default=0) + 1
    comment.id = new_id
    if not comment.date: comment.date = datetime.datetime.now().strftime("%Y-%m-%d")
    comments.append(comment.model_dump())
    save_json(COMMENTS_FILE, comments)
    return {"status": "success", "comment": comment}

@app.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: int, requester_email: str):
    mods = get_mod_list()
    if requester_email not in mods: raise HTTPException(status_code=403)
    comments = load_json(COMMENTS_FILE)
    comments = [c for c in comments if c['id'] != comment_id]
    save_json(COMMENTS_FILE, comments)
    return {"status": "success"}

# --- CHAT API ENDPOINTS ---

@app.post("/api/chat/create")
def create_chat(request: CreateChatRequest):
    chats = load_json(CHATS_FILE)
    
    # Determine participants
    participants = [request.creator_email]
    
    if request.type == 'admin_support':
        mods = get_mod_list()
        # Add all mods to participants if not already there
        for m in mods:
            if m not in participants:
                participants.append(m)
        subject = f"Support Ticket: {request.creator_email}"
    else:
        # Standard direct chat (can be multi-user)
        for p in request.participants:
            if p not in participants:
                participants.append(p)
        subject = ", ".join(participants)

    # Check if a chat between these EXACT participants already exists
    # Filter out chats that are not deleted for the creator
    if request.type == 'direct':
        # Sort for consistent comparison
        target_participants = sorted(participants)
        
        existing = next((
            c for c in chats 
            if sorted(c['participants']) == target_participants 
            and c.get('type') != 'admin_support'
            and request.creator_email not in c.get('deleted_by', [])
        ), None)
        
        if existing:
            # OPTIMIZATION: Return lightweight version (no messages)
            return {
                "id": existing["id"],
                "type": existing["type"],
                "participants": existing["participants"],
                "subject": existing["subject"],
                "last_updated": existing["last_updated"],
                "deleted_by": existing.get("deleted_by", []),
                "last_message_preview": existing["messages"][-1]["text"] if existing["messages"] else ""
            }

    new_chat = {
        "id": str(uuid.uuid4()),
        "type": request.type,
        "participants": participants,
        "subject": subject,
        "created_at": datetime.datetime.now().isoformat(),
        "last_updated": datetime.datetime.now().isoformat(),
        "deleted_by": [],
        "messages": []
    }

    if request.initial_message:
        msg = {
            "id": str(uuid.uuid4()),
            "sender": request.creator_email,
            "text": request.initial_message,
            "timestamp": datetime.datetime.now().isoformat()
        }
        new_chat["messages"].append(msg)

    chats.append(new_chat)
    save_json(CHATS_FILE, chats)
    
    # Return lightweight version
    return {
        "id": new_chat["id"],
        "type": new_chat["type"],
        "participants": new_chat["participants"],
        "subject": new_chat["subject"],
        "last_updated": new_chat["last_updated"],
        "deleted_by": new_chat["deleted_by"],
        "last_message_preview": request.initial_message or ""
    }

@app.get("/api/chat/list")
def list_chats(email: str, all_chats: bool = False):
    """
    OPTIMIZATION: Returns lightweight chat objects (WITHOUT 'messages' array).
    """
    chats = load_json(CHATS_FILE)
    
    mods = get_mod_list()
    is_admin = email in mods
    
    user_chats = []
    
    for c in chats:
        # Check permissions with case-insensitivity safety
        participants = [p.lower() for p in c.get('participants', [])]
        user_email = email.lower()
        
        is_participant = user_email in participants
        is_deleted = user_email in [d.lower() for d in c.get('deleted_by', [])]
        
        # Logic: 
        # 1. If requesting "all_chats" (Admin Monitoring), allow if admin.
        # 2. Otherwise, must be participant AND not deleted.
        if (all_chats and is_admin) or (is_participant and not is_deleted):
            # Create lightweight object
            preview = ""
            if c.get("messages") and len(c["messages"]) > 0:
                preview = c["messages"][-1]["text"]
            
            user_chats.append({
                "id": c["id"],
                "type": c.get("type", "direct"),
                "participants": c["participants"],
                "subject": c.get("subject", "Conversation"),
                "last_updated": c.get("last_updated", ""),
                "last_message_preview": preview
            })
            
    user_chats.sort(key=lambda x: x.get('last_updated', ''), reverse=True)
    return user_chats

@app.get("/api/chat/{chat_id}/messages")
def get_chat_messages(chat_id: str, email: str):
    """
    OPTIMIZATION: Specific endpoint to load messages only when needed.
    """
    chats = load_json(CHATS_FILE)
    chat = next((c for c in chats if c['id'] == chat_id), None)
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    mods = get_mod_list()
    # Case-insensitive check
    participants = [p.lower() for p in chat['participants']]
    if email.lower() not in participants and email not in mods:
        raise HTTPException(status_code=403, detail="Access denied")
        
    return chat.get("messages", [])

@app.post("/api/chat/{chat_id}/message")
def send_message(chat_id: str, request: SendMessageRequest):
    chats = load_json(CHATS_FILE)
    chat = next((c for c in chats if c['id'] == chat_id), None)
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # If a user replies to a chat that others deleted, it should reappear for them?
    # Common behavior: Yes.
    chat['deleted_by'] = [] # Reset deleted status so everyone sees new message
    
    # Case insensitive participant check
    participants = [p.lower() for p in chat['participants']]
    if request.sender.lower() not in participants:
        # Auto-add if it's an admin replying to a ticket they weren't original participant of?
        # For now, stick to strict participation
        raise HTTPException(status_code=403, detail="User not in chat")

    msg = {
        "id": str(uuid.uuid4()),
        "sender": request.sender,
        "text": request.text,
        "timestamp": datetime.datetime.now().isoformat()
    }
    
    if "messages" not in chat: chat["messages"] = []
    chat['messages'].append(msg)
    chat['last_updated'] = msg['timestamp']
    
    save_json(CHATS_FILE, chats)
    return msg

@app.post("/api/chat/delete")
def delete_chat_for_user(request: DeleteChatRequest):
    chats = load_json(CHATS_FILE)
    chat = next((c for c in chats if c['id'] == request.chat_id), None)
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    # Case insensitive check
    participants = [p.lower() for p in chat['participants']]
    if request.email.lower() not in participants:
         raise HTTPException(status_code=403, detail="Not a participant")

    if "deleted_by" not in chat:
        chat["deleted_by"] = []
        
    # Prevent duplicate entries
    if request.email not in chat["deleted_by"]:
        chat["deleted_by"].append(request.email)
        
    save_json(CHATS_FILE, chats)
    return {"status": "success", "chat_id": request.chat_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)