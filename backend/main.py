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

# Ensure we can import from local folders
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

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
    delete_user_full
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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODS_FILE = os.path.join(BASE_DIR, 'mods.csv')

# --- PAYPAL CONFIGURATION ---
PAYPAL_MODE = os.getenv("PAYPAL_MODE", "sandbox")
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "your_sandbox_client_id")
PAYPAL_SECRET = os.getenv("PAYPAL_SECRET", "your_sandbox_secret")
PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com" if PAYPAL_MODE == "sandbox" else "https://api-m.paypal.com"

# PLAN MAP
PLAN_TIER_MAP = {
    "P-EXPLORER-ID": "Explorer",    
    "P-1EE89936BP540274LNEWASQI": "Visionary",  
    "P-8EG71614L88223945NEWAUBI": "Institutional"
}

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
    email: Optional[str] = "" 

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
    new_run_data: Optional[List[Dict]] = []
    final_cash: Optional[float] = 0.0

class MarketDataRequest(BaseModel):
    tickers: List[str]

class ModRequest(BaseModel):
    email: str
    action: str 
    requester_email: str

class SubscriptionVerifyRequest(BaseModel):
    subscriptionId: str
    email: str

# --- ADMIN MODELS ---
class AdminUpdateUserRequest(BaseModel):
    target_email: str
    new_tier: str
    requester_email: str

class AdminDeleteUserRequest(BaseModel):
    target_email: str
    requester_email: str

class CreateCouponRequest(BaseModel):
    code: str
    plan_id: str
    tier: str
    discount_label: str
    requester_email: str

class DeleteCouponRequest(BaseModel):
    code: str
    requester_email: str

# --- Chat Models ---
class ChatCreateRequest(BaseModel):
    type: str
    participants: List[str]
    creator_email: str
    initial_message: Optional[str] = None

class ChatMessageRequest(BaseModel):
    sender: str
    text: str

class ChatDeleteRequest(BaseModel):
    chat_id: str
    email: str

# --- Helper Functions ---
SUPER_ADMIN_EMAIL = "marketinsightscenter@gmail.com"

def get_mod_list():
    mods = [SUPER_ADMIN_EMAIL]
    if os.path.exists(MODS_FILE):
        try:
            with open(MODS_FILE, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row and row.get("email"):
                        email = row["email"].strip().lower()
                        if email not in mods:
                            mods.append(email)
        except Exception: pass
    return mods

def is_admin(email):
    if not email: return False
    clean_email = email.strip().lower()
    return clean_email in get_mod_list()

def get_paypal_access_token():
    try:
        url = f"{PAYPAL_API_BASE}/v1/oauth2/token"
        headers = {"Accept": "application/json", "Accept-Language": "en_US"}
        data = {"grant_type": "client_credentials"}
        response = requests.post(url, headers=headers, data=data, auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET))
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    except Exception as e:
        print(f"PayPal Token Error: {e}")
        return None

# --- ENDPOINTS ---

# 1. NEW ENDPOINT: User Profile Fetch
@app.get("/api/user/profile")
def api_get_user_profile(email: str):
    profile = get_user_profile(email)
    if profile:
        return profile
    # Return default empty profile if not found in DB yet
    return {"email": email, "tier": "Free", "subscription_status": "none"}

@app.post("/api/invest")
async def invest_endpoint(request: InvestRequest):
    allowed = check_and_increment_limit(request.email, "portfolio_lab")
    if not allowed:
        raise HTTPException(status_code=403, detail="Monthly Usage Limit Reached. Upgrade your subscription for more access.")

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
    allowed = check_and_increment_limit(request.email_to, "portfolio_lab")
    if not allowed:
        raise HTTPException(status_code=403, detail="Monthly Usage Limit Reached. Upgrade your subscription for more access.")

    try:
        ai_params = request.model_dump()
        return await custom_command.handle_custom_command([], ai_params=ai_params, is_called_by_ai=True)
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/tracking")
async def tracking_endpoint(request: GenericAlgoRequest):
    allowed = check_and_increment_limit(request.email_to, "portfolio_lab")
    if not allowed:
        raise HTTPException(status_code=403, detail="Monthly Usage Limit Reached. Upgrade your subscription for more access.")

    try:
        ai_params = request.model_dump()
        return await tracking_command.handle_tracking_command([], ai_params=ai_params, is_called_by_ai=True)
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/cultivate")
async def cultivate_endpoint(request: GenericAlgoRequest):
    allowed = check_and_increment_limit(request.email_to, "cultivate")
    if not allowed:
        raise HTTPException(status_code=403, detail="Monthly Cultivate Limit Reached. Upgrade your subscription for more access.")

    try:
        ai_params = request.model_dump()
        return await cultivate_command.handle_cultivate_command([], ai_params=ai_params, is_called_by_ai=True)
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- ADMIN ENDPOINTS ---

@app.post("/api/admin/users/update")
def admin_update_user(req: AdminUpdateUserRequest):
    if not is_admin(req.requester_email):
        raise HTTPException(status_code=403, detail="Not authorized")
    success = update_user_tier(req.target_email, req.new_tier, status="admin_override")
    if success: return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to update user")

@app.post("/api/admin/users/delete")
def admin_delete_user(req: AdminDeleteUserRequest):
    if not is_admin(req.requester_email):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    success = delete_user_full(req.target_email)
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to delete user")

@app.get("/api/admin/coupons")
def list_coupons(email: str):
    if not is_admin(email): raise HTTPException(status_code=403, detail="Not authorized")
    return get_all_coupons()

@app.post("/api/admin/coupons/create")
def admin_create_coupon(req: CreateCouponRequest):
    if not is_admin(req.requester_email): raise HTTPException(status_code=403, detail="Not authorized")
    success = create_coupon(req.code, req.plan_id, req.tier, req.discount_label)
    if success: return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to create coupon")

@app.post("/api/admin/coupons/delete")
def admin_delete_coupon(req: DeleteCouponRequest):
    if not is_admin(req.requester_email): raise HTTPException(status_code=403, detail="Not authorized")
    success = delete_coupon(req.code)
    if success: return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to delete coupon")

@app.get("/api/coupons/validate")
def check_coupon(code: str):
    coupon = validate_coupon(code)
    if coupon: return {"valid": True, "plan_id": coupon['plan_id'], "label": coupon.get('discount_label', 'Discount')}
    return {"valid": False}

# --- SUBSCRIPTION ENDPOINTS ---

@app.post("/api/subscriptions/verify")
async def verify_subscription(req: SubscriptionVerifyRequest):
    token = get_paypal_access_token()
    if not token: raise HTTPException(status_code=500, detail="Could not connect to payment provider")
    try:
        url = f"{PAYPAL_API_BASE}/v1/billing/subscriptions/{req.subscriptionId}"
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(url, headers=headers)
        if response.status_code != 200: raise HTTPException(status_code=400, detail="Invalid Subscription ID")
        sub_data = response.json()
        status = sub_data.get("status")
        plan_id = sub_data.get("plan_id")
        tier = PLAN_TIER_MAP.get(plan_id, "Visionary") 
        if status in ["ACTIVE", "TRIALLING"]:
            success = update_user_tier(req.email, tier, req.subscriptionId, status.lower())
            if success: return {"status": "success", "tier": tier}
            else: raise HTTPException(status_code=500, detail="Database update failed")
        else: return {"status": "failed", "message": f"Subscription status is {status}"}
    except Exception as e:
        logger.error(f"Verify Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- CHAT & MARKET DATA ---

@app.get("/api/chat/list")
def get_chats(email: str, all_chats: bool = False):
    chats = read_chats()
    if all_chats: return chats
    user_chats = [c for c in chats if email in c.get('participants', [])]
    user_chats.sort(key=lambda x: x.get('last_updated', ''), reverse=True)
    return user_chats

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

@app.get("/api/chat/{chat_id}/messages")
def get_messages(chat_id: str, email: str):
    chats = read_chats()
    chat = next((c for c in chats if c["id"] == chat_id), None)
    if not chat: raise HTTPException(status_code=404, detail="Chat not found")
    if email not in chat["participants"]: raise HTTPException(status_code=403, detail="Access denied")
    return chat.get("messages", [])

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
    for chat in chats:
        if chat["id"] == req.chat_id:
            found = True
            if req.email in chat["participants"]: chat["participants"].remove(req.email)
            if len(chat["participants"]) > 0: updated_chats.append(chat)
        else: updated_chats.append(chat)
    if found:
        save_chats(updated_chats)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Chat not found")

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
                else: hist_close = df['Close'].dropna()
                if hist_close.empty: continue
                
                def get_val(series, idx):
                    try: return float(series.iloc[idx].item())
                    except: return float(series.iloc[idx])

                current_price = get_val(hist_close, -1)
                price_1d = get_val(hist_close, -2) if len(hist_close) > 1 else current_price
                change_1d = ((current_price - price_1d) / price_1d) * 100 if price_1d != 0 else 0
                subset = hist_close.tail(30)
                sparkline = subset.values.flatten().tolist() if isinstance(subset, pd.DataFrame) else subset.tolist()

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
                except: pass 

                results.append({"ticker": ticker, "price": current_price, "change": change_1d, "marketCap": mkt_cap, "volume": volume, "peRatio": pe_ratio, "sparkline": sparkline})
            except: continue
        return results
    except: return []

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
                if isinstance(cal, dict) and 'Earnings Date' in cal:
                     dates = cal['Earnings Date']
                     if dates: earnings_date = str(dates[0].date())
            except: pass
            iv = "-"
            try:
                if t.info.get('impliedVolatility'): iv = f"{t.info['impliedVolatility'] * 100:.2f}%"
            except: pass
            results[ticker] = {"earnings": earnings_date, "iv": iv}
        except: results[ticker] = {"earnings": "-", "iv": "-"}
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
    return {"status": "success", "mods": mods}

@app.get("/api/articles")
def get_articles(limit: int = 100): return read_articles_from_csv()[:limit]

@app.get("/api/users")
def get_users(): return get_all_users_from_db()

@app.get("/api/ideas")
def get_ideas(limit: int = 100): return read_ideas_from_csv()[:limit]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)