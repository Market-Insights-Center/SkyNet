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
import requests 
from datetime import datetime
import uuid
import yfinance as yf
import pandas as pd
from dotenv import load_dotenv

# Ensure we can import from local folders
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 1. Load backend/.env
load_dotenv(os.path.join(BASE_DIR, '.env'))
# 2. Load root .env (overrides if duplicates, or fills gaps)
load_dotenv(os.path.join(BASE_DIR, '..', '.env'))

# Import your command modules
from integration import invest_command, cultivate_command, custom_command, tracking_command

# Updated database imports
from database import (
    read_articles_from_csv, 
    save_articles_to_csv, 
    read_ideas_from_csv, 
    save_ideas_to_csv, 
    read_chats, 
    save_chats,
    get_all_users_from_db,
    update_user_tier,     
    get_user_profile,
    create_coupon,     
    get_all_coupons,   
    validate_coupon,   
    delete_coupon,
    check_and_increment_limit,
    delete_user_full,
    delete_article,
    delete_idea
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

# --- PAYPAL CONFIGURATION ---
PAYPAL_MODE = os.getenv("PAYPAL_MODE", "live")

# --- PYDANTIC MODELS ---
class ChatCreateRequest(BaseModel):
    creator_email: str
    participants: List[str]
    type: str = "general" # general, support, custom_portfolio
    initial_message: Optional[str] = None

class ChatMessageRequest(BaseModel):
    sender: str
    text: str

class ChatDeleteRequest(BaseModel):
    chat_id: str
    email: str

class MarketDataRequest(BaseModel):
    tickers: List[str]

class ModRequest(BaseModel):
    email: str
    action: str # add, remove
    requester_email: str

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

# Try standard env var, fallback to VITE_ prefixed one
def get_chats(email: str, all_chats: bool = False):
    chats = read_chats()
    if all_chats: return chats
    user_chats = [c for c in chats if email in c.get('participants', [])]
    user_chats.sort(key=lambda x: x.get('last_updated', ''), reverse=True)
    return user_chats

# -----------------------------
# CHAT ENDPOINTS (Fixed & Complete)
# -----------------------------

@app.post("/api/chat/create")
def create_chat(req: ChatCreateRequest):
    chats = read_chats()
    new_chat = {
        "id": str(uuid.uuid4()), "type": req.type,
        "participants": list(set(req.participants + [req.creator_email])),
        "messages": [], "last_updated": datetime.utcnow().isoformat(),
        "last_message_preview": req.initial_message or "New conversation"
    }
    if req.initial_message:
        new_chat["messages"].append({"sender": req.creator_email, "text": req.initial_message, "timestamp": new_chat["last_updated"]})
    chats.append(new_chat)
    save_chats(chats)
    return new_chat

@app.get("/api/chat/list")
def list_user_chats(email: str):
    return get_chats(email)

@app.get("/api/chat/{chat_id}/messages")
def get_messages(chat_id: str, email: str):
    chats = read_chats()
    chat = next((c for c in chats if c["id"] == chat_id), None)
    if not chat: raise HTTPException(status_code=404, detail="Chat not found")
    
    # Check if user is participant OR mod
    mods = get_mod_list()
    if email not in chat["participants"] and email not in mods:
        raise HTTPException(status_code=403, detail="Access denied")
        
    return chat.get("messages", [])

# --- THIS WAS MISSING, CAUSING MESSAGES NOT TO SEND ---
@app.post("/api/chat/{chat_id}/message")
def send_message(chat_id: str, req: ChatMessageRequest):
    chats = read_chats()
    for chat in chats:
        if chat["id"] == chat_id:
            msg = {"sender": req.sender, "text": req.text, "timestamp": datetime.utcnow().isoformat()}
            chat.setdefault("messages", []).append(msg)
            chat["last_updated"] = msg["timestamp"]
            chat["last_message_preview"] = req.text
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
            # Allow delete if user is participant OR admin
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
    elif request.action == "remove":
        if target == SUPER_ADMIN_EMAIL: raise HTTPException(status_code=400, detail="Cannot remove super admin")
        if target in mods:
            mods.remove(target)
            with open(MODS_FILE, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["email"])
                for m in mods: writer.writerow([m])
    return {"status": "success"}

@app.get("/api/users")
def get_users(): 
    users = get_all_users_from_db()
    # Ensure Super Admin has Singularity tier
    for user in users:
        if user.get('email', '').lower() == SUPER_ADMIN_EMAIL:
            user['tier'] = 'Singularity'
    return users

@app.get("/api/user/profile")
def api_get_user_profile(email: str):
    print(f"HIT PROFILE ENDPOINT: {email}")
    # Special override for Super Admin
    if email.lower() == SUPER_ADMIN_EMAIL:
        print("MATCHED SUPER ADMIN")
        return {"email": email, "tier": "Singularity", "subscription_status": "active", "risk_tolerance": 10, "trading_frequency": "Daily", "portfolio_types": ["All"]}
        
    profile = get_user_profile(email)
    if profile:
        return profile
    # Return default empty profile if not found in DB yet
    return {"email": email, "tier": "Basic", "subscription_status": "none"}

# --- ADMIN ROUTES ---
@app.get("/api/admin/coupons")
def api_get_coupons(email: str):
    mods = get_mod_list()
    if email not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    return get_all_coupons()

# DELETE THE "pass" FUNCTION THAT WAS HERE

class CouponCreateRequest(BaseModel):
    code: str
    plan_id: str
    tier: str
    discount_label: str
    requester_email: str

# Keep this one (The actual implementation)
@app.post("/api/admin/coupons/create")
def api_create_coupon(req: CouponCreateRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    create_coupon(req.code, req.plan_id, req.tier, req.discount_label)
    return {"status": "success"}

class UserUpdateRequest(BaseModel):
    target_email: str
    new_tier: str
    requester_email: str

@app.post("/api/admin/users/update")
def api_update_user_tier(req: UserUpdateRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    update_user_tier(req.target_email, req.new_tier)
    return {"status": "success"}

class UserDeleteRequest(BaseModel):
    target_email: str
    requester_email: str

@app.post("/api/admin/users/delete")
def api_delete_user(req: UserDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if req.target_email == SUPER_ADMIN_EMAIL: raise HTTPException(status_code=400, detail="Cannot delete Super Admin")
    delete_user_full(req.target_email)
    return {"status": "success"}

class CouponDeleteRequest(BaseModel):
    code: str
    requester_email: str

@app.post("/api/admin/coupons/delete")
def api_delete_coupon(req: CouponDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if delete_coupon(req.code):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Coupon not found")

class ArticleDeleteRequest(BaseModel):
    id: str
    requester_email: str

@app.post("/api/admin/articles/delete")
def api_delete_article(req: ArticleDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if delete_article(req.id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Article not found")

class IdeaDeleteRequest(BaseModel):
    id: str
    requester_email: str

@app.post("/api/admin/ideas/delete")
def api_delete_idea(req: IdeaDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if delete_idea(req.id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Idea not found")

# --- COMMAND ENDPOINTS ---

@app.post("/api/invest")
async def api_invest(request: Request):
    try:
        data = await request.json()
        # The frontend sends the body directly, which maps to ai_params in the handler
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)