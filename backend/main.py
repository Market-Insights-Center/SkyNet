from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import sys
import os
import csv
import json
import logging
import requests 
from datetime import datetime
import uuid
import yfinance as yf
import pandas as pd
from dotenv import load_dotenv
import subprocess
import signal
import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

# Ensure we can import from local folders
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))
load_dotenv(os.path.join(BASE_DIR, '..', '.env'))

# Import your command modules
from integration import invest_command, cultivate_command, custom_command, tracking_command, risk_command, history_command

# Database imports
from database import (
    read_articles_from_csv, 
    save_articles_to_csv, 
    read_ideas_from_csv, 
    save_ideas_to_csv,
    read_comments_from_csv,
    save_comments_to_csv,
    read_chats, 
    save_chats,
    get_all_users_from_db,
    update_user_tier,     
    get_user_profile,
    create_coupon,     
    get_all_coupons,   
    validate_coupon,   
    delete_coupon,
    verify_access_and_limits, # <--- FIXED: Replaced 'check_and_increment_limit' with correct name
    delete_user_full,
    delete_article,
    delete_idea,
    delete_comment,
    create_user_profile
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

app = FastAPI()

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directory
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

MODS_FILE = os.path.join(BASE_DIR, 'mods.csv')
SUPER_ADMIN_EMAIL = "marketinsightscenter@gmail.com"

# --- GLOBAL VARIABLES FOR SKYNET ---
SKYNET_PROCESS = None
SCHEDULER = None

def start_scheduler():
    global SCHEDULER
    if SCHEDULER is None:
        SCHEDULER = BackgroundScheduler()
        
        def run_risk_job():
            print("Running scheduled Risk Command...")
            try:
                # Create a new event loop for this thread to run the async task
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(risk_command.handle_risk_command([], ai_params={"assessment_type": "scheduled"}))
                loop.close()
            except Exception as e:
                print(f"Scheduler Error: {e}")

        SCHEDULER.add_job(run_risk_job, CronTrigger(minute='*/15'))
        SCHEDULER.start()
        print("Scheduler started.")

# Start scheduler on startup
start_scheduler()

# --- PYDANTIC MODELS ---
class ChatCreateRequest(BaseModel):
    creator_email: str
    participants: List[str]
    type: str = "general"
    initial_message: Optional[str] = None

class ChatMessageRequest(BaseModel):
    sender: str
    text: str

class ChatDeleteRequest(BaseModel):
    chat_id: str
    email: str

class ChatReadRequest(BaseModel):
    chat_id: str
    email: str

class UsernameCheckRequest(BaseModel):
    username: str

class MarketDataRequest(BaseModel):
    tickers: List[str]

class ModRequest(BaseModel):
    email: str
    action: str # add, remove
    requester_email: str

class ArticleCreateRequest(BaseModel):
    title: str
    subtitle: Optional[str] = None
    content: str
    author: str
    date: str
    hashtags: List[str] = []
    cover_image: Optional[str] = None

class IdeaCreateRequest(BaseModel):
    ticker: str
    title: str
    description: str
    author: str
    date: str
    hashtags: List[str] = []
    cover_image: Optional[str] = None

class VoteRequest(BaseModel):
    user_id: str
    vote_type: str

class ShareRequest(BaseModel):
    platform: str

class EmailShareRequest(BaseModel):
    email: str
    sender_name: str
    article_link: str
    article_title: str

class CommentCreateRequest(BaseModel):
    idea_id: Optional[int] = None
    article_id: Optional[int] = None 
    user_id: str
    user: str
    email: str
    text: str
    date: str

class CouponCreateRequest(BaseModel):
    code: str
    plan_id: str
    tier: str
    discount_label: str
    requester_email: str

class UserUpdateRequest(BaseModel):
    target_email: str
    new_tier: str
    requester_email: str

class UserDeleteRequest(BaseModel):
    target_email: str
    requester_email: str

class CouponDeleteRequest(BaseModel):
    code: str
    requester_email: str

class ArticleDeleteRequest(BaseModel):
    id: str
    requester_email: str

class IdeaDeleteRequest(BaseModel):
    id: str
    requester_email: str
    
class SkynetToggleRequest(BaseModel):
    action: str # "start" or "stop"

# --- HELPER FUNCTIONS ---
def get_mod_list():
    mods = []
    if os.path.exists(MODS_FILE):
        with open(MODS_FILE, 'r') as f:
            reader = csv.reader(f)
            next(reader, None) # Skip header
            for row in reader:
                if row: mods.append(row[0].lower())
    
    # Ensure Super Admin is always in the list
    if SUPER_ADMIN_EMAIL not in mods:
        mods.append(SUPER_ADMIN_EMAIL)
        # Write back to file if missing
        with open(MODS_FILE, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([SUPER_ADMIN_EMAIL])
            
    return mods

def get_chats(email: str, all_chats: bool = False):
    chats = read_chats()
    if all_chats: return chats
    user_chats = [c for c in chats if email in c.get('participants', [])]
    user_chats.sort(key=lambda x: x.get('last_updated', ''), reverse=True)
    return user_chats

# -----------------------------
# SKYNET AUTO-START ENDPOINT
# -----------------------------
@app.post("/api/skynet/toggle")
def toggle_skynet(req: SkynetToggleRequest):
    global SKYNET_PROCESS
    
    script_path = os.path.join(BASE_DIR, "skynet_phase1.py")
    
    if req.action == "start":
        if SKYNET_PROCESS and SKYNET_PROCESS.poll() is None:
            return {"status": "running", "message": "SkyNet is already active."}
        
        try:
            # Use sys.executable to ensure we use the same Python environment (venv)
            SKYNET_PROCESS = subprocess.Popen([sys.executable, script_path])
            logger.info(f"SkyNet launched with PID: {SKYNET_PROCESS.pid}")
            return {"status": "started", "pid": SKYNET_PROCESS.pid}
        except Exception as e:
            logger.error(f"Failed to start SkyNet: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start SkyNet: {e}")

    elif req.action == "stop":
        if SKYNET_PROCESS:
            try:
                # Terminate the process safely
                SKYNET_PROCESS.terminate()
                SKYNET_PROCESS = None
                return {"status": "stopped"}
            except Exception as e:
                logger.error(f"Error stopping SkyNet: {e}")
                # Force kill if terminate fails
                try:
                    SKYNET_PROCESS.kill()
                    SKYNET_PROCESS = None
                except:
                    pass
                return {"status": "stopped_forced"}
        return {"status": "not_running"}

    raise HTTPException(status_code=400, detail="Invalid action")

# -----------------------------
# AUTH & USER CHECK ENDPOINTS
# -----------------------------
@app.post("/api/auth/check-username")
def check_username_availability(req: UsernameCheckRequest):
    users = get_all_users_from_db()
    requested = req.username.strip().lower()
    
    if not requested:
        return {"available": False, "message": "Username cannot be empty"}
        
    for u in users:
        existing = (u.get('username') or "").lower()
        if existing == requested:
             return {"available": False, "message": "Username already taken"}
             
    return {"available": True, "message": "Username is available"}

# -----------------------------
# CHAT ENDPOINTS 
# -----------------------------

@app.post("/api/chat/create")
def create_chat(req: ChatCreateRequest):
    chats = read_chats()
    
    # Initialize last_read with current time for creator so it doesn't show as unread
    now = datetime.utcnow().isoformat()
    
    new_chat = {
        "id": str(uuid.uuid4()), "type": req.type,
        "participants": list(set(req.participants + [req.creator_email])),
        "messages": [], 
        "last_updated": now,
        "last_message_preview": req.initial_message or "New conversation",
        "last_read": {req.creator_email: now}
    }
    if req.initial_message:
        new_chat["messages"].append({"sender": req.creator_email, "text": req.initial_message, "timestamp": now})
    chats.append(new_chat)
    save_chats(chats)
    return new_chat

@app.get("/api/chat/list")
def list_user_chats(email: str, all_chats: bool = False):
    return get_chats(email, all_chats)

@app.get("/api/chat/{chat_id}/messages")
def get_messages(chat_id: str, email: str):
    chats = read_chats()
    chat = next((c for c in chats if c["id"] == chat_id), None)
    if not chat: raise HTTPException(status_code=404, detail="Chat not found")
    
    mods = get_mod_list()
    if email not in chat["participants"] and email not in mods:
        raise HTTPException(status_code=403, detail="Access denied")
        
    return chat.get("messages", [])

@app.post("/api/chat/{chat_id}/message")
def send_message(chat_id: str, req: ChatMessageRequest):
    chats = read_chats()
    for chat in chats:
        if chat["id"] == chat_id:
            now = datetime.utcnow().isoformat()
            msg = {"sender": req.sender, "text": req.text, "timestamp": now}
            chat.setdefault("messages", []).append(msg)
            chat["last_updated"] = msg["timestamp"]
            chat["last_message_preview"] = req.text
            
            # Update last_read for the sender automatically
            if "last_read" not in chat: chat["last_read"] = {}
            chat["last_read"][req.sender] = now
            
            save_chats(chats)
            return {"status": "success"}
    raise HTTPException(status_code=404, detail="Chat not found")

@app.post("/api/chat/{chat_id}/read")
def mark_chat_read(chat_id: str, req: ChatReadRequest):
    chats = read_chats()
    found = False
    for chat in chats:
        if chat["id"] == chat_id:
            if "last_read" not in chat: chat["last_read"] = {}
            chat["last_read"][req.email] = datetime.utcnow().isoformat()
            found = True
            break
            
    if found:
        save_chats(chats)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Chat not found")

@app.post("/api/chat/delete")
def delete_chat(req: ChatDeleteRequest):
    chats = read_chats()
    updated_chats = []
    found = False
    mods = get_mod_list()
    
    for chat in chats:
        if chat["id"] == req.chat_id:
            if req.email in chat["participants"] or req.email in mods:
                found = True
                continue 
            else:
                updated_chats.append(chat)
        else:
            updated_chats.append(chat)
            
    if found:
        save_chats(updated_chats)
        return {"status": "success"}
    
    chat_exists = any(c["id"] == req.chat_id for c in chats)
    if not chat_exists:
        raise HTTPException(status_code=404, detail="Chat not found")
        
    raise HTTPException(status_code=403, detail="Not authorized to delete this chat")

@app.post("/api/market-data")
async def get_market_data(request: MarketDataRequest):
    try:
        tickers = [t.upper().strip() for t in request.tickers if t]
        if not tickers: return []
        
        df = yf.download(tickers, period="1y", interval="1d", progress=False, auto_adjust=True)
        
        results = []
        for ticker in tickers:
            try:
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
                
        return results
    except Exception as e:
        print(f"Global Market Data Error: {e}")
        return []
    
@app.post("/api/market-data/details")
async def get_market_data_details(request: MarketDataRequest):
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

@app.get("/api/mods")
def get_mods(): return {"mods": get_mod_list()}

@app.post("/api/mods")
def manage_mods(request: ModRequest):
    mods = get_mod_list()
    if request.requester_email.lower() != SUPER_ADMIN_EMAIL:
         raise HTTPException(status_code=403, detail="Only Super Admin can manage moderators")
    
    target = request.email.lower().strip()
    
    if request.action == "add":
        if target not in mods:
            mods.append(target)
            with open(MODS_FILE, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([target])
            # Auto-upgrade to Singularity
            update_user_tier(target, "Singularity")
                
    elif request.action == "remove":
        if target == SUPER_ADMIN_EMAIL: 
            raise HTTPException(status_code=400, detail="Cannot remove super admin")
        if target in mods:
            mods.remove(target)
            with open(MODS_FILE, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["email"])
                for m in mods: 
                    if m != SUPER_ADMIN_EMAIL: 
                        writer.writerow([m])
                        
    return {"status": "success", "mods": get_mod_list()}

@app.get("/api/users")
def get_users(): 
    users = get_all_users_from_db()
    for user in users:
        if user.get('email', '').lower() == SUPER_ADMIN_EMAIL:
            user['tier'] = 'Singularity'
    return users

@app.get("/api/user/profile")
def api_get_user_profile(email: str, uid: Optional[str] = None):
    if email.lower() == SUPER_ADMIN_EMAIL:
        return {"email": email, "tier": "Singularity", "subscription_status": "active", "risk_tolerance": 10, "trading_frequency": "Daily", "portfolio_types": ["All"]}
        
    profile = get_user_profile(email)
    
    if not profile and uid:
        if create_user_profile(email, uid):
             profile = get_user_profile(email)
             
    if profile:
        return profile
    return {"email": email, "tier": "Basic", "subscription_status": "none"}

# --- ADMIN ROUTES ---
@app.get("/api/admin/coupons")
def api_get_coupons(email: str):
    mods = get_mod_list()
    if email not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    return get_all_coupons()

@app.post("/api/admin/coupons/create")
def api_create_coupon(req: CouponCreateRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    create_coupon(req.code, req.plan_id, req.tier, req.discount_label)
    return {"status": "success"}

@app.post("/api/admin/users/update")
def api_update_user_tier(req: UserUpdateRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    update_user_tier(req.target_email, req.new_tier)
    return {"status": "success"}

@app.post("/api/admin/users/delete")
def api_delete_user(req: UserDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if req.target_email == SUPER_ADMIN_EMAIL: raise HTTPException(status_code=400, detail="Cannot delete Super Admin")
    delete_user_full(req.target_email)
    return {"status": "success"}

@app.post("/api/admin/coupons/delete")
def api_delete_coupon(req: CouponDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if delete_coupon(req.code):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Coupon not found")

@app.post("/api/admin/articles/delete")
def api_delete_article(req: ArticleDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if delete_article(req.id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Article not found")

@app.post("/api/admin/ideas/delete")
def api_delete_idea(req: IdeaDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if delete_idea(req.id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Idea not found")

@app.get("/api/articles")
def get_articles(limit: int = 100):
    articles = read_articles_from_csv()
    articles.sort(key=lambda x: x.get('date', ''), reverse=True)
    return articles[:limit]

@app.get("/api/articles/{article_id}")
def get_article_by_id(article_id: int):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    all_comments = read_comments_from_csv()
    article_comments = [c for c in all_comments if str(c.get('article_id')) == str(article_id)]
    article_comments.sort(key=lambda x: x.get('date', ''), reverse=True)
    article['comments'] = article_comments
    return article

@app.post("/api/articles")
def create_article(req: ArticleCreateRequest):
    articles = read_articles_from_csv()
    new_id = 1
    if articles:
        new_id = max([int(a['id']) for a in articles]) + 1
    new_article = {
        "id": new_id,
        "title": req.title,
        "subheading": req.subtitle if req.subtitle else "",
        "content": req.content,
        "author": req.author,
        "date": req.date,
        "category": "Insight", 
        "hashtags": req.hashtags,
        "cover_image": req.cover_image if req.cover_image else "",
        "likes": 0,
        "dislikes": 0,
        "shares": 0,
        "liked_by": [],
        "disliked_by": []
    }
    articles.insert(0, new_article)
    save_articles_to_csv(articles)
    return new_article

@app.post("/api/articles/{article_id}/vote")
def vote_article(article_id: int, req: VoteRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    liked_by = article.get('liked_by', [])
    disliked_by = article.get('disliked_by', [])
    if req.vote_type == 'up':
        if req.user_id in liked_by: liked_by.remove(req.user_id)
        else:
            liked_by.append(req.user_id)
            if req.user_id in disliked_by: disliked_by.remove(req.user_id)
    elif req.vote_type == 'down':
        if req.user_id in disliked_by: disliked_by.remove(req.user_id)
        else:
            disliked_by.append(req.user_id)
            if req.user_id in liked_by: liked_by.remove(req.user_id)
    article['liked_by'] = liked_by
    article['disliked_by'] = disliked_by
    article['likes'] = len(liked_by)
    article['dislikes'] = len(disliked_by)
    save_articles_to_csv(articles)
    return {"status": "success", "likes": article['likes'], "dislikes": article['dislikes']}

@app.post("/api/articles/{article_id}/share")
def share_article(article_id: int, req: ShareRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    current_shares = article.get('shares', 0)
    article['shares'] = current_shares + 1
    save_articles_to_csv(articles)
    return {"status": "success", "shares": article['shares']}

@app.post("/api/articles/{article_id}/share/email")
def share_article_email(article_id: int, req: EmailShareRequest):
    articles = read_articles_from_csv()
    article = next((a for a in articles if int(a['id']) == article_id), None)
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    current_shares = article.get('shares', 0)
    article['shares'] = current_shares + 1
    save_articles_to_csv(articles)
    return {"status": "success", "message": f"Email sent to {req.email}"}

@app.get("/api/ideas")
def get_ideas(limit: int = 100):
    ideas = read_ideas_from_csv()
    all_comments = read_comments_from_csv()
    all_comments.sort(key=lambda x: x.get('date', ''), reverse=True)
    for idea in ideas:
        idea_id = str(idea.get('id'))
        idea['comments'] = [c for c in all_comments if str(c.get('idea_id')) == idea_id]
    ideas.sort(key=lambda x: x.get('date', ''), reverse=True)
    return ideas[:limit]

@app.post("/api/ideas")
def create_idea(req: IdeaCreateRequest):
    ideas = read_ideas_from_csv()
    new_id = 1
    if ideas: new_id = max([int(i['id']) for i in ideas]) + 1
    new_idea = {
        "id": new_id,
        "ticker": req.ticker,
        "title": req.title,
        "description": req.description,
        "author": req.author,
        "date": req.date,
        "hashtags": req.hashtags,
        "cover_image": req.cover_image if req.cover_image else "",
        "likes": 0,
        "dislikes": 0,
        "liked_by": [],
        "disliked_by": []
    }
    ideas.insert(0, new_idea)
    save_ideas_to_csv(ideas)
    return new_idea

@app.post("/api/ideas/{idea_id}/vote")
def vote_idea(idea_id: int, req: VoteRequest):
    ideas = read_ideas_from_csv()
    idea = next((i for i in ideas if int(i['id']) == idea_id), None)
    if not idea: raise HTTPException(status_code=404, detail="Idea not found")
    liked_by = idea.get('liked_by', [])
    disliked_by = idea.get('disliked_by', [])
    if req.vote_type == 'up':
        if req.user_id in liked_by: liked_by.remove(req.user_id)
        else:
            liked_by.append(req.user_id)
            if req.user_id in disliked_by: disliked_by.remove(req.user_id)
    elif req.vote_type == 'down':
        if req.user_id in disliked_by: disliked_by.remove(req.user_id)
        else:
            disliked_by.append(req.user_id)
            if req.user_id in liked_by: liked_by.remove(req.user_id)
    idea['liked_by'] = liked_by
    idea['disliked_by'] = disliked_by
    idea['likes'] = len(liked_by)
    idea['dislikes'] = len(disliked_by)
    save_ideas_to_csv(ideas)
    return {"status": "success", "likes": idea['likes'], "dislikes": idea['dislikes']}

@app.post("/api/comments")
def create_comment(req: CommentCreateRequest):
    comments = read_comments_from_csv()
    new_id = 1
    if comments: new_id = max([int(c['id']) for c in comments]) + 1
    new_comment = {
        "id": new_id,
        "idea_id": req.idea_id,
        "article_id": req.article_id,
        "user_id": req.user_id,
        "user": req.user,
        "email": req.email,
        "text": req.text,
        "date": req.date,
        "isAdmin": False
    }
    mods = get_mod_list()
    if req.email.lower() in mods: new_comment['isAdmin'] = True
    comments.insert(0, new_comment)
    save_comments_to_csv(comments)
    return new_comment

@app.delete("/api/comments/{comment_id}")
def api_delete_comment(comment_id: int, requester_email: str):
    mods = get_mod_list()
    if requester_email.lower() not in mods:
        raise HTTPException(status_code=403, detail="Not authorized to delete comments")
    if delete_comment(comment_id): return {"status": "success"}
    raise HTTPException(status_code=404, detail="Comment not found")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    upload_dir = os.path.join(STATIC_DIR, "uploads")
    if not os.path.exists(upload_dir): os.makedirs(upload_dir)
    filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    return {"url": f"/static/uploads/{filename}"}

@app.get("/api/stats")
def get_stats():
    users = get_all_users_from_db()
    ideas = read_ideas_from_csv()
    articles = read_articles_from_csv()
    tags = {}
    for i in ideas:
        for tag in i.get('hashtags', []):
            tags[tag] = tags.get(tag, 0) + 1
    sorted_tags = sorted(tags.items(), key=lambda x: x[1], reverse=True)
    trending = [t[0] for t in sorted_tags[:5]]
    return {
        "total_users": len(users),
        "active_users": len(users),
        "total_posts": len(ideas) + len(articles),
        "trending_topics": trending
    }

# --- COMMAND ENDPOINTS ---
@app.post("/api/invest")
async def api_invest(request: Request):
    try:
        data = await request.json()
        result = await invest_command.handle_invest_command([], ai_params=data, is_called_by_ai=True)
        return result
    except Exception as e:
        logger.error(f"Error in /api/invest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cultivate")
async def api_cultivate(request: Request):
    try:
        data = await request.json()
        result = await cultivate_command.handle_cultivate_command([], ai_params=data, is_called_by_ai=True)
        return result
    except Exception as e:
        logger.error(f"Error in /api/cultivate: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom")
async def api_custom(request: Request):
    try:
        data = await request.json()
        result = await custom_command.handle_custom_command([], ai_params=data, is_called_by_ai=True)
        return result
    except Exception as e:
        logger.error(f"Error in /api/custom: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tracking")
async def api_tracking(request: Request):
    try:
        data = await request.json()
        result = await tracking_command.handle_tracking_command([], ai_params=data, is_called_by_ai=True)
        return result
    except Exception as e:
        logger.error(f"Error in /api/tracking: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/risk")
async def api_risk():
    try:
        # We can pass empty args to get the default calculation
        result, _ = await risk_command.perform_risk_calculations_singularity(is_eod_save=False, is_called_by_ai=True)
        return result
    except Exception as e:
        logger.error(f"Error in /api/risk: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
async def api_history():
    try:
        result = await history_command.handle_history_command([], is_called_by_ai=True)
        return result
    except Exception as e:
        logger.error(f"Error in /api/history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)