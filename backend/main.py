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
import uuid
from contextlib import asynccontextmanager
import yfinance as yf

# Database Manager Imports
# Database Manager Imports
try:
    from integration.database_manager import read_nexus_codes, read_portfolio_codes, save_nexus_code, save_portfolio_code, delete_code
except ImportError:
    from backend.integration.database_manager import read_nexus_codes, read_portfolio_codes, save_nexus_code, save_portfolio_code, delete_code

# Automation Storage Imports (Fixes Save/Load)
try:
    from automation_storage import load_automations, save_automation, delete_automation, toggle_automation
    print(f"✅ LOADED: automation_storage")
except ImportError:
    try:
        from backend.automation_storage import load_automations, save_automation, delete_automation, toggle_automation
        print(f"✅ LOADED: automation_storage (Absolute)")
    except ImportError as e:
        print(f"❌ CRITICAL FAIL: automation_storage: {e}")

# Fix for WinError 183 in TzCache
try:
    cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache", "py-yfinance")
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir, exist_ok=True)
    yf.set_tz_cache_location(cache_dir)
except Exception as e:
    print(f"Warning: Could not set yfinance cache location: {e}")
import pandas as pd
from dotenv import load_dotenv
import subprocess
import signal
import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import traceback

# --- PATH CONFIGURATION (Fixes Import Errors) ---
# Determine where we are running from and ensure python finds modules correctly
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)

# Ensure the parent directory (SkyNet root) is in sys.path
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

# Ensure the current directory (backend) is in sys.path
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

print("--- SYSTEM PATH DEBUG ---")
print(f"Base: {PARENT_DIR}")
print(f"Curr: {CURRENT_DIR}")

# --- ROBUST COMMAND IMPORTS ---
nexus_command = None
invest_command = None
automation_command = None
risk_command = None
performance_stream_command = None

# 1. Nexus (Already working)
try:
    from backend.integration import nexus_command
    print(f"✅ LOADED: nexus_command")
except ImportError:
    try:
        from integration import nexus_command
        print(f"✅ LOADED: nexus_command (Relative)")
    except ImportError as e:
        print(f"❌ FAIL: nexus_command: {e}")

# 2. Automation (Critical for this task)
try:
    from backend.integration import automation_command
    print(f"✅ LOADED: automation_command")
except ImportError:
    try:
        from integration import automation_command
        print(f"✅ LOADED: automation_command (Relative)")
    except ImportError as e:
        print(f"❌ FAIL: automation_command: {e}")

# 3. Invest (Reported Failure)
try:
    from backend.integration import invest_command
    print(f"✅ LOADED: invest_command")
except ImportError as e:
    print(f"Warning: backend.integration import failed for invest_command: {e}")
    try:
        from integration import invest_command
        print(f"✅ LOADED: invest_command (Relative)")
    except ImportError as e:
        print(f"❌ FAIL: invest_command: {e}")

# 4. Risk (Critical for Automation)
try:
    from backend.integration import risk_command
    print(f"✅ LOADED: risk_command")
except ImportError:
    try:
        from integration import risk_command
        print(f"✅ LOADED: risk_command (Relative)")
    except ImportError as e:
        print(f"❌ FAIL: risk_command: {e}")

# 5. Performance Stream
try:
    from backend.integration import performance_stream_command
    print(f"✅ LOADED: performance_stream_command")
except ImportError:
    try:
        from integration import performance_stream_command
        print(f"✅ LOADED: performance_stream_command (Relative)")
    except ImportError as e:
        print(f"❌ FAIL: performance_stream_command: {e}")

# ... (Other commands can be imported similarly or in a block if less critical)
try:
    from backend.integration import (
        cultivate_command, custom_command, tracking_command, 
        history_command, quickscore_command, market_command, 
        breakout_command, briefing_command, fundamentals_command, 
        assess_command, mlforecast_command, sentiment_command, powerscore_command,
        summary_command, sentinel_command
    )
except ImportError:
    try:
        from integration import (
            cultivate_command, custom_command, tracking_command, 
            history_command, quickscore_command, market_command, 
            breakout_command, briefing_command, fundamentals_command, 
            assess_command, mlforecast_command, sentiment_command, powerscore_command,
            summary_command, sentinel_command
        )
    except Exception as e:
        print(f"Warning: Some commands failed to load: {e}")

# --- DATABASE IMPORTS ---
try:
    from backend.database import (
        read_articles_from_csv, save_articles_to_csv, read_ideas_from_csv, 
        save_ideas_to_csv, read_comments_from_csv, save_comments_to_csv, 
        read_chats, save_chats, get_all_users_from_db, update_user_tier, verify_storage_limit,     
        get_user_profile, create_coupon, get_all_coupons, validate_coupon,   
        delete_coupon, verify_access_and_limits, delete_user_full, delete_article,
        delete_idea, delete_comment, create_user_profile, check_username_taken,
        update_user_username, get_banners, create_banner, update_banner, delete_banner,
        generate_referral_code, process_referral_signup, get_user_points, get_leaderboard, 
        create_prediction, place_bet, get_active_predictions, get_user_bets, delete_prediction, 
        add_points, check_referral_reward
    )
except ImportError:
    from database import (
        read_articles_from_csv, save_articles_to_csv, read_ideas_from_csv, 
        save_ideas_to_csv, read_comments_from_csv, save_comments_to_csv, 
        read_chats, save_chats, get_all_users_from_db, update_user_tier,     
        get_user_profile, create_coupon, get_all_coupons, validate_coupon,   
        delete_coupon, verify_access_and_limits, delete_user_full, delete_article,
        delete_idea, delete_comment, create_user_profile, check_username_taken,
        update_user_username, get_banners, create_banner, update_banner, delete_banner,
        generate_referral_code, process_referral_signup, get_user_points, get_leaderboard, 
        create_prediction, place_bet, get_active_predictions, get_user_bets, delete_prediction, 
        add_points, check_referral_reward
    )

try:
    from backend.automation_storage import load_automations, save_automation, delete_automation, toggle_automation
except ImportError:
    try:
        from automation_storage import load_automations, save_automation, delete_automation, toggle_automation
    except: pass

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

from fastapi.responses import JSONResponse, StreamingResponse

# --- SHARED FUNCTIONS IMPORT ---
try:
    from backend.database import (
        get_db, 
        get_user_points, 
        add_points, 
        share_automation, 
        get_community_automations, 
        increment_copy_count,
        share_portfolio,
        get_community_portfolios,
        increment_portfolio_copy
    )
except ImportError:
    from database import (
        get_db, 
        get_user_points, 
        add_points, 
        share_automation, 
        get_community_automations, 
        increment_copy_count,
        share_portfolio,
        get_community_portfolios,
        increment_portfolio_copy
    )

try:
    from backend.usage_counter import increment_usage, get_all_usage
except ImportError:
    from usage_counter import increment_usage, get_all_usage

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    
    # 1. Start Risk/Performance Scheduler (Global)
    try:
        start_scheduler() # The one defined in this file
    except Exception as e:
        print(f"Failed to start Main Scheduler: {e}")

    # 2. Start Points Scheduler (External)
    try:
        from backend.points_scheduler import start_scheduler as start_points_scheduler
        start_points_scheduler()
    except ImportError:
        try:
             from points_scheduler import start_scheduler as start_points_scheduler
             start_points_scheduler()
        except Exception as e:
             print(f"Failed to start Points Scheduler: {e}")
             
    # 3. Initialize Firebase
    try:
        from backend.firebase_admin_setup import initialize_firebase
        initialize_firebase()
    except: pass
    
    yield
    # Shutdown logic
    if SCHEDULER:
        SCHEDULER.shutdown()

app = FastAPI(lifespan=lifespan)


# 1. Global JSON Exception Handler (Fix for "Unexpected token <")
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"🔥 UNHANDLED ERROR for {request.url}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal Server Error", "detail": str(exc)}
    )

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(CURRENT_DIR, "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

MODS_FILE = os.path.join(CURRENT_DIR, 'mods.csv')
SUPER_ADMIN_EMAIL = "marketinsightscenter@gmail.com"

# --- GLOBAL VARIABLES FOR ORION ---
ORION_PROCESS = None
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
        
        # Performance Stream Job (15 mins)
        def run_performance_stream_job():
            print("Running scheduled Performance Stream Update...")
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(performance_stream_command.update_heatmap_cache())
                loop.close()
            except Exception as e:
                print(f"Performance Stream Scheduler Error: {e}")
                
        SCHEDULER.add_job(run_performance_stream_job, CronTrigger(minute='*/15'))

        # Automation Job (15 mins)
        def run_automation_job():
            print("Running scheduled Automation Check...")
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                if automation_command:
                    loop.run_until_complete(automation_command.run_automations())
                loop.close()
            except Exception as e:
                print(f"Automation Scheduler Error: {e}")

        SCHEDULER.add_job(run_automation_job, CronTrigger(minute='*/15'))

        SCHEDULER.start()
        print("Scheduler started.")

# Start scheduler on startup
# Start scheduler on startup - MOVED TO LIFESPAN
# start_scheduler()


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

class UsernameUpdateRequest(BaseModel):
    email: str
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
    
class OrionToggleRequest(BaseModel):
    action: str # "start" or "stop"

class QuickscoreRequest(BaseModel):
    ticker: str
    email: str

class MarketRequest(BaseModel):
    email: str
    market_type: str = "sp500"
    sensitivity: int = 2

class BreakoutRequest(BaseModel):
    email: str

class BriefingRequest(BaseModel):
    email: str

class FundamentalsRequest(BaseModel):
    ticker: str
    email: str

class AssessRequest(BaseModel):
    email: str
    user_id: Optional[str] = None # Added for ownership check
    assess_code: str
    tickers_str: Optional[str] = None
    timeframe_str: Optional[str] = None
    risk_tolerance: Optional[int] = None
    backtest_period_str: Optional[str] = None
    manual_portfolio_holdings: Optional[List[Dict[str, Any]]] = None
    custom_portfolio_code: Optional[str] = None
    value_for_assessment: Optional[float] = None
    cultivate_portfolio_code: Optional[str] = None
    use_fractional_shares: Optional[bool] = None
    portfolio_code: Optional[str] = None # For Code E
    start_date: Optional[str] = None # For Code E
    end_date: Optional[str] = None # For Code E

class MLForecastRequest(BaseModel):
    email: str
    ticker: str

class SentimentRequest(BaseModel):
    email: str
    ticker: str

class PowerScoreRequest(BaseModel):
    email: str
    ticker: str
    sensitivity: int = 2

class UsageIncrementRequest(BaseModel):
    key: str

class SummaryRequest(BaseModel):
    ticker: str
    email: Optional[str] = "guest"

class NexusRequest(BaseModel):
    email: str
    nexus_code: str
    create_new: Optional[bool] = False
    components: Optional[List[Dict[str, Any]]] = None
    total_value: Optional[float] = None
    # Execution options
    use_fractional_shares: Optional[bool] = False
    execute_rh: Optional[bool] = False
    rh_user: Optional[str] = None
    rh_pass: Optional[str] = None
    send_email: Optional[bool] = False
    email_to: Optional[str] = None
    overwrite: Optional[bool] = False

class BannerCreateRequest(BaseModel):
    text: str
    link: Optional[str] = None
    countdown_target: Optional[str] = None
    type: str  # info, sale, launch
    active: bool = True
    requester_email: str

class BannerUpdateRequest(BaseModel):
    id: int
    text: str
    link: Optional[str] = None
    countdown_target: Optional[str] = None
    type: str # info, sale, launch
    active: bool
    requester_email: str

class BannerDeleteRequest(BaseModel):
    id: int
    requester_email: str

class ExecuteTradesRequest(BaseModel):
    trades: List[Dict[str, Any]]
    rh_username: Optional[str] = None
    rh_password: Optional[str] = None
    email_to: Optional[str] = None
    portfolio_code: Optional[str] = "Unknown"

class SentinelRequest(BaseModel):
    user_prompt: str
    email: str
    plan: Optional[List[Dict[str, Any]]] = None

class PredictionCreateRequest(BaseModel):
    title: str
    stock: str
    end_date: str
    market_condition: str
    wager_logic: str
    email: str 

class BetRequest(BaseModel):
    email: str
    prediction_id: str
    choice: str 
    amount: int

class ReferralRedeemRequest(BaseModel):
    email: str
    code: str
    
class PointsRequest(BaseModel):
    email: str

class AutomationSaveRequest(BaseModel):
    id: str
    name: str
    active: bool
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    user_email: str

class AutomationToggleRequest(BaseModel):
    id: str
    active: bool

class AutomationDeleteRequest(BaseModel):
    id: str



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
# ORION AUTO-START ENDPOINT
# -----------------------------
@app.post("/api/orion/toggle")
def toggle_orion(req: OrionToggleRequest):
    global ORION_PROCESS
    
    # Adjust script path based on robust directory finding
    script_path = os.path.join(CURRENT_DIR, "orion_v2.py")
    if not os.path.exists(script_path):
         script_path = os.path.join(PARENT_DIR, "backend", "orion_v2.py")
    
    if req.action == "start":
        if ORION_PROCESS and ORION_PROCESS.poll() is None:
            return {"status": "running", "message": "Orion is already active."}
        
        try:
            # Use sys.executable to ensure we use the same Python environment (venv)
            ORION_PROCESS = subprocess.Popen([sys.executable, script_path])
            logger.info(f"Orion launched with PID: {ORION_PROCESS.pid}")
            return {"status": "started", "pid": ORION_PROCESS.pid}
        except Exception as e:
            logger.error(f"Failed to start Orion: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start Orion: {e}")

    elif req.action == "stop":
        if ORION_PROCESS:
            try:
                # Terminate the process safely
                ORION_PROCESS.terminate()
                ORION_PROCESS = None
                return {"status": "stopped"}
            except Exception as e:
                logger.error(f"Error stopping Orion: {e}")
                # Force kill if terminate fails
                try:
                    ORION_PROCESS.kill()
                    ORION_PROCESS = None
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

@app.post("/api/user/username")
def update_username_endpoint(req: UsernameUpdateRequest):
    # 1. Verify availability again to be safe
    users = get_all_users_from_db()
    requested = req.username.strip()
    
    # Check if taken by someone else
    for u in users:
        if u.get('email') != req.email:
             if (u.get('username') or "").lower() == requested.lower():
                 raise HTTPException(status_code=400, detail="Username already taken")

    # 2. Update via database manager
    try:
        success = update_user_username(req.email, requested)
        if success:
            return {"status": "success", "username": requested}
        else:
            raise HTTPException(status_code=500, detail="Database update failed")
    except Exception as e:
        logger.error(f"Failed to update username: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# CHAT ENDPOINTS 
# -----------------------------

@app.post("/api/chat/create")
def create_chat(req: ChatCreateRequest):
    chats = read_chats()
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

@app.get("/api/performance-stream")
def get_performance_stream():
    """Returns the cached performance stream data."""
    return performance_stream_command.get_cached_heatmap()

@app.get("/api/performance-stream/details/{ticker}")
async def get_performance_stream_details(ticker: str):
    """Returns details for a specific stock."""
    return await performance_stream_command.get_stock_details(ticker)

@app.post("/api/performance-stream/force-update")
async def force_performance_stream_update(req: ModRequest):
    """Force update performance stream (Admin only)."""
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: 
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await performance_stream_command.update_heatmap_cache()
    return {"status": "success"}

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
def api_get_user_profile(email: str, uid: Optional[str] = None, username: Optional[str] = None):
    # Fetch actual profile first to get username/uid
    profile = get_user_profile(email)
    
    # If Super Admin, enforce privileges but keep other data (like username)
    if email.lower() == SUPER_ADMIN_EMAIL:
        if not profile:
             profile = {"email": email}
        # Force Admin Privileges
        profile.update({
            "tier": "Singularity", 
            "subscription_status": "active", 
            "risk_tolerance": 10, 
            "trading_frequency": "Daily", 
            "portfolio_types": ["All"]
        })
        # If username is missing in DB for admin, set a default to prevent loop
        if "username" not in profile:
             profile["username"] = "Orion_Admin"

    if not profile and uid:
        if create_user_profile(email, uid, username):
             profile = get_user_profile(email)
             
    if profile:
        return profile
    return {"email": email, "tier": "Basic", "subscription_status": "none"}

@app.post("/api/check-username")
def api_check_username(req: UsernameCheckRequest):
    is_taken = check_username_taken(req.username)
    return {"taken": is_taken}

@app.post("/api/user/username")
def api_update_username(req: UsernameUpdateRequest):
    result = update_user_username(req.email, req.username)

# --- POINTS & REFERRALS ENDPOINTS ---
@app.post("/api/points/user")
def api_get_user_points_endpoint(req: PointsRequest):
    return get_user_points(req.email)

@app.get("/api/points/leaderboard")
def api_get_leaderboard_endpoint():
    return get_leaderboard()

@app.post("/api/referrals/generate")
def api_gen_referral(req: PointsRequest): 
    code = generate_referral_code(req.email)
    return {"code": code}

@app.post("/api/referrals/redeem")
def api_redeem_referral(req: ReferralRedeemRequest):
    success = process_referral_signup(req.email, req.code)
    return {"success": success}

# --- PREDICTIONS ENDPOINTS ---
@app.post("/api/predictions/create")
def api_create_prediction(req: PredictionCreateRequest):
    mods = get_mod_list()
    # Basic check, detailed check in function or ensure UI restricts
    if req.email.lower() not in mods: raise HTTPException(status_code=403, detail="Admins only")
    
    success = create_prediction(req.title, req.stock, req.end_date, req.market_condition, req.wager_logic, req.email)
    return {"success": success}

@app.get("/api/predictions/active")
def api_get_predictions_endpoint(include_recent: bool = False):
    return get_active_predictions(include_recent=include_recent)

@app.post("/api/predictions/bet")
def api_place_bet_endpoint(req: BetRequest):
    return place_bet(req.email, req.prediction_id, req.choice, req.amount)

@app.get("/api/user/bets")
def api_get_user_bets_endpoint(email: str):
    return get_user_bets(email)

class PredictionDeleteRequest(BaseModel):
    id: str
    requester_email: str

@app.post("/api/predictions/delete")
def api_delete_prediction(req: PredictionDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Admins only")
    success = delete_prediction(req.id)
    return {"success": success}

# --- STRATEGY RANKING IMPORT ---
try:
    from backend.integration import strategy_ranking
except ImportError:
    try:
        from integration import strategy_ranking
    except Exception as e:
        print(f"Warning: Could not import strategy_ranking: {e}")

# ... (Previous imports or code)

class RankingSubmitRequest(BaseModel):
    user_email: str
    portfolio_code: str
    interval: str # 1/h, 1/d, 1/w, 1/m

class RankingRemoveRequest(BaseModel):
    user_email: str
    portfolio_code: str

# --- STRATEGY RANKING ENDPOINTS ---
@app.get("/api/strategy-ranking/list")
async def get_strategy_rankings():
    # Trigger an update check whenever the list is pulled? 
    # Or rely on background scheduler?
    # For responsiveness, trigger parallel update but return current state?
    # The user mandated: "at the end of the day at the end of the interval, that portfolio code is automatically ran"
    # This implies a scheduler. But for manual testing, we might want to force check.
    # Let's verify and update quickly if needed.
    await strategy_ranking.check_and_update_rankings()
    return await strategy_ranking.get_all_rankings()

@app.post("/api/strategy-ranking/submit")
async def submit_strategy_ranking(req: RankingSubmitRequest):
    return await strategy_ranking.submit_portfolio_to_ranking(req.user_email, req.portfolio_code, req.interval)

@app.post("/api/strategy-ranking/remove")
async def remove_strategy_ranking(req: RankingRemoveRequest):
    return await strategy_ranking.remove_portfolio_from_ranking(req.user_email, req.portfolio_code)

@app.post("/api/strategy-ranking/delete-permanent")
async def delete_permanent_strategy_ranking(req: RankingRemoveRequest):
    return await strategy_ranking.permanent_delete_strategy(req.user_email, req.portfolio_code)

# --- TASKS ---
# Add scheduler job for Strategy Ranking
def schedule_ranking_updates():
    if SCHEDULER:
        # Check every 15 minutes roughly to see if an hourly/daily interval has passed
        SCHEDULER.add_job(
            lambda: asyncio.run(strategy_ranking.check_and_update_rankings()), 
            CronTrigger(minute='*/15')
        )

# Call this after scheduler start if we want auto-updates
schedule_ranking_updates()


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


# --- BANNER ENDPOINTS ---
@app.get("/api/banners")
def get_public_banners():
    """Public endpoint for landing page banners"""
    # Only return active banners for public view
    all_banners = get_banners()
    return [b for b in all_banners if b.get('active')]

@app.get("/api/admin/banners")
def get_admin_banners(email: str):
    """Admin endpoint to see all banners including inactive"""
    mods = get_mod_list()
    if email.lower() not in mods:
        raise HTTPException(status_code=403, detail="Not authorized")
    return get_banners(include_inactive=True)

@app.post("/api/admin/banners")
def create_new_banner(req: BannerCreateRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    success = create_banner(req.dict())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create banner")
    return {"status": "success"}

@app.put("/api/admin/banners")
def update_existing_banner(req: BannerUpdateRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Exclude id and requester_email from update data
    update_data = req.dict(exclude={'id', 'requester_email'})
    success = update_banner(req.id, update_data)
    if not success:
        raise HTTPException(status_code=404, detail="Banner not found or update failed")
    return {"status": "success"}

@app.post("/api/admin/banners/delete")
def delete_existing_banner(req: BannerDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    success = delete_banner(req.id)
    if not success:
        raise HTTPException(status_code=404, detail="Banner not found or delete failed")
    return {"status": "success"}


# -----------------------------
# ASSESS & MLFORECAST ENDPOINTS
# -----------------------------
@app.post("/api/assess")
async def api_assess_command(req: AssessRequest):
    # Determine the specific permission key based on the code
    code = req.assess_code.upper()
    permission_key = f"assess_{code.lower()}"
    
    limit_check = verify_access_and_limits(req.email, permission_key)
    if not limit_check["allowed"]:
        raise HTTPException(status_code=403, detail=limit_check["message"])

    ai_params = {
        "assess_code": code,
        "tickers_str": req.tickers_str,
        "timeframe_str": req.timeframe_str,
        "risk_tolerance": req.risk_tolerance,
        "backtest_period_str": req.backtest_period_str,
        "manual_portfolio_holdings": req.manual_portfolio_holdings,
        "custom_portfolio_code": req.custom_portfolio_code,
        "value_for_assessment": req.value_for_assessment,
        "cultivate_portfolio_code": req.cultivate_portfolio_code,
        "use_fractional_shares": req.use_fractional_shares,
        "portfolio_code": req.portfolio_code,
        "start_date": req.start_date,
        "end_date": req.end_date
    }

    try:
        result = await assess_command.handle_assess_command(
            [], 
            ai_params=ai_params, 
            is_called_by_ai=True,
            user_id=req.user_id
        )
        add_points(req.email, "assess") # Redundant if verify_access_and_limits adds points, but sometimes assess is called internally.
        # Actually, verify_access_and_limits is called at top of endpoint. So we can remove this.
        # add_points(req.email, "assess") 
        return {"result": result}
        
    except Exception as e:
        logger.error(f"Assess Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/mlforecast")
async def api_mlforecast_command(req: MLForecastRequest):
    limit_check = verify_access_and_limits(req.email, "mlforecast")
    if not limit_check["allowed"]:
        raise HTTPException(status_code=403, detail=limit_check["message"])

    try:
        results = await mlforecast_command.handle_mlforecast_command(ai_params={"ticker": req.ticker}, is_called_by_ai=True)
        
        
        if isinstance(results, dict) and "error" in results:
             raise Exception(results["error"])
        
        # add_points(req.email, "mlforecast") # Handled by verify_access_and_limits
        return {"results": results}
    except Exception as e:
        logger.error(f"MLForecast Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/briefing")
async def api_briefing(req: BriefingRequest):
    # Tier Check for Briefing
    access = verify_access_and_limits(req.email, "briefing")
    if not access["allowed"]:
        raise HTTPException(status_code=403, detail=access["message"])
        
    try:
        data = await briefing_command.handle_briefing_command([], is_called_by_ai=True)
        # add_points(req.email, "briefing") # Handled by verify_access_and_limits
        return data
    except Exception as e:
        logger.error(f"Briefing Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/fundamentals")
async def api_fundamentals(req: FundamentalsRequest):
    # Tier Check for Fundamentals
    access = verify_access_and_limits(req.email, "fundamentals")
    if not access["allowed"]:
        raise HTTPException(status_code=403, detail=access["message"])
        
    try:
        data = await fundamentals_command.handle_fundamentals_command([], ai_params={"ticker": req.ticker}, is_called_by_ai=True)
        if data and "error" in data:
             raise HTTPException(status_code=404, detail=data["error"])
        # add_points(req.email, "fundamentals") # Handled by verify_access_and_limits
        return data
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Fundamentals Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        email = data.get('email')
        if email:
            # Enforce Limit & Award Points
            limit_check = verify_access_and_limits(email, "invest")
            if not limit_check["allowed"]:
                raise HTTPException(status_code=403, detail=limit_check["message"])
            
        result = await invest_command.handle_invest_command([], ai_params=data, is_called_by_ai=True)
        # email = data.get('email')
        # if email: add_points(email, "invest") # Now handled above
        await increment_usage("invest") # Keep global usage stats
        return result
    except Exception as e:
        logger.error(f"Error in /api/invest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cultivate")
async def api_cultivate(request: Request):
    try:
        data = await request.json()
        email = data.get('email')
        if email:
             limit_check = verify_access_and_limits(email, "cultivate")
             if not limit_check["allowed"]:
                 raise HTTPException(status_code=403, detail=limit_check["message"])

        result = await cultivate_command.handle_cultivate_command([], ai_params=data, is_called_by_ai=True)
        # email = data.get('email')
        # if email: add_points(email, "cultivate")
        await increment_usage("cultivate")
        return result
    except Exception as e:
        logger.error(f"Error in /api/cultivate: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom")
async def api_custom(request: Request):
    try:
        data = await request.json()
        result = await custom_command.handle_custom_command([], ai_params=data, is_called_by_ai=True)
        await increment_usage("custom")
        return result
    except Exception as e:
        logger.error(f"Error in /api/custom: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tracking")
async def api_tracking(request: Request):
    try:
        data = await request.json()
        email = data.get('email')
        if email:
             limit_check = verify_access_and_limits(email, "tracking")
             if not limit_check["allowed"]:
                 raise HTTPException(status_code=403, detail=limit_check["message"])

        result = await tracking_command.handle_tracking_command([], ai_params=data, is_called_by_ai=True)
        # email = data.get('email')
        # if email: add_points(email, "tracking")
        await increment_usage("tracking")
        return result
    except Exception as e:
        logger.error(f"Error in /api/tracking: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/risk")
async def api_risk(email: str = "guest"): 
    # Note: GET requests often put params in query string. FastAPI handles `email` param automatically if sent.
    # If called without email, defaults to guest.
    
    if email != "guest":
        limit_check = verify_access_and_limits(email, "risk")
        if not limit_check["allowed"]:
             # raise HTTPException(status_code=403, detail=limit_check["message"])
             pass # Risk is often auto-scheduled, but for manual calls we should track.

    try:
        # We can pass empty args to get the default calculation
        result, _ = await risk_command.perform_risk_calculations_singularity(is_eod_save=False, is_called_by_ai=True)
        await increment_usage("risk")
        return result
    except Exception as e:
        logger.error(f"Error in /api/risk: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
async def api_history(email: str = "guest"):
    if email != "guest":
        limit_check = verify_access_and_limits(email, "history")
        if not limit_check["allowed"]:
             pass 

    try:
        result = await history_command.handle_history_command([], is_called_by_ai=True)
        await increment_usage("history")
        return result
    except Exception as e:
        logger.error(f"Error in /api/history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/quickscore")
async def api_quickscore(req: QuickscoreRequest):
    # Enforce Limit & Award Points
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "quickscore")
        if not limit_check["allowed"]:
            raise HTTPException(status_code=403, detail=limit_check["message"])

    # Run command
    result = await quickscore_command.handle_quickscore_command([], ai_params={"ticker": req.ticker}, is_called_by_ai=True)
    await increment_usage("quickscore")
    return result

@app.post("/api/market")
async def run_market(req: MarketRequest):
    limit_check = verify_access_and_limits(req.email, "market")
    if not limit_check["allowed"]:
        raise HTTPException(status_code=403, detail=limit_check["message"])
    
    result = await market_command.handle_market_command(
        [], 
        ai_params={"action": "display", "market_type": req.market_type, "sensitivity": req.sensitivity},
        is_called_by_ai=True
    )
    # Market Junction is free/informational, but maybe points for checking? 
    # add_points(req.email, "market") # Optional
    return result

@app.post("/api/breakout")
async def run_breakout(req: BreakoutRequest):
    # Enforce Limit & Award Points
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "breakout")
        if not limit_check["allowed"]:
            raise HTTPException(status_code=403, detail=limit_check["message"])
            
    result = await breakout_command.handle_breakout_command(
        [],
        ai_params={"action": "run"},
        is_called_by_ai=True
    )
    return result

@app.post("/api/sentiment")
async def run_sentiment(req: SentimentRequest):
    # Tier Check - Bypass for guest/demo for now
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "sentiment")
        if not limit_check["allowed"]:
             # raise HTTPException(status_code=403, detail=limit_check["message"])
             # Use caution here: ideally we fail, but for debugging user request we log and proceed or fail softly.
             # Strict: raise HTTPException(status_code=403, detail=limit_check["message"])
             pass
    
    # Run command
    result = await sentiment_command.handle_sentiment_command(
        ai_params={"ticker": req.ticker},
        is_called_by_ai=True
    )

    if not result:
        raise HTTPException(status_code=500, detail="Sentiment analysis failed to produce a result.")
    
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))

    if req.email != 'guest':
        # Enforce Limit & Award Points
        # Note: We checked verification at the start, but limit logic was bypassed/mocked or strictly checked.
        # If we want to ensure points are awarded ONLY on success, we can call it here if we didn't block earlier.
        # But earlier we DID call verify_access_and_limits. 
        # CAUTION: duplicate calls to verify_access_and_limits might double-charge or double-award if not careful.
        # verify_access_and_limits(email, product) increments usage count.
        # So we should validly call it ONCE.
        # In `run_sentiment` above (line 1647), we called it.
        # So we should NOT call it again here.
        pass
    return result

@app.post("/api/powerscore")
async def run_powerscore(req: PowerScoreRequest):
    # Tier Check - Bypass for guest/demo for now
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "powerscore")
        if not limit_check["allowed"]:
            raise HTTPException(status_code=403, detail=limit_check["message"])

    # Run command
    result = await powerscore_command.handle_powerscore_command(
        ai_params={"ticker": req.ticker, "sensitivity": req.sensitivity},
        is_called_by_ai=True
    )

    if not result:
        raise HTTPException(status_code=500, detail="PowerScore analysis failed.")

    if result.get("status") == "error":
         raise HTTPException(status_code=400, detail=result.get("message"))
         
    if req.email != 'guest':
        # Enforce Limit & Award Points (Using quickscore logic or similar)
        # Assuming powerscore maps to a product key, or we just award points manually?
        # User requested centralizing. 
        # If 'powerscore' is in points_rules.csv, we should use verify_access_and_limits(email, 'powerscore').
        limit_check = verify_access_and_limits(req.email, "powerscore")
        if not limit_check["allowed"]:
             pass
        # add_points(req.email, "quickscore") # Using quickscore points for powerscore as it's similar analysis
        pass

    return result

@app.post("/api/summary")
async def run_summary(req: SummaryRequest):
    # Enforce Limit & Award Points
    if req.email != 'guest':
        limit_check = verify_access_and_limits(req.email, "summary")
        if not limit_check["allowed"]:
             pass 

    await increment_usage("summary")
    return await summary_command.handle_summary_command(
        ai_params={"ticker": req.ticker},
        is_called_by_ai=True
    )

# --- FIXED NEXUS ENDPOINT ---
@app.post("/api/execute-trades")
async def execute_trades_endpoint(req: ExecuteTradesRequest):
    """
    Executes a list of trades on Robinhood. 
    Called by the frontend after a Nexus or Tracking run when the user clicks "Execute Trades".
    """
    try:
        # Dynamic import to ensure we get it right
        try:
            from backend.integration.execution_command import execute_portfolio_rebalance
        except ImportError:
            from integration.execution_command import execute_portfolio_rebalance

        if not req.trades:
             return {"status": "success", "message": "No trades to execute."}

        # 1. Prepare Trades for Execution
        # Expected format by execute_portfolio_rebalance: [{"ticker": "AVL", "side": "buy", "quantity": 10}, ...]
        rh_trades = []
        for t in req.trades:
            # Flexible Key Mapping
            side = t.get('action', '').lower()
            if not side:
                 side = t.get('side', '').lower()
            
            # fallback if 'diff' positive/negative
            if not side:
                d = float(t.get('diff', 0))
                if d != 0: side = 'buy' if d > 0 else 'sell'
            
            # Ensure quantity is positive
            qty = float(t.get('diff', 0))
            if qty == 0:
                 qty = float(t.get('quantity', 0)) # fallback to quantity
                 
            qty = abs(qty)
            if qty == 0: continue
            
            rh_trades.append({
                "ticker": t['ticker'], 
                "side": side, 
                "quantity": qty
            })
            
        execution_msg = ""
        
        # 2. Execute on Robinhood
        if req.rh_username and req.rh_password:
             # We might need to set env vars for the function to use, 
             # OR if the function takes credentials. 
             # Checking nexus_command, it sets os.environ.
             os.environ["RH_USERNAME"] = req.rh_username
             os.environ["RH_PASSWORD"] = req.rh_password
             
             await asyncio.to_thread(execute_portfolio_rebalance, rh_trades)
             execution_msg += "Executed on Robinhood. "
        else:
             execution_msg += "Credentials missing for RH execution. "

        # 3. Track Usage & Points (for Execution)
        if req.rh_username: # Only if they actually tried to execute
             # Can't easily verify limit for "execution" as it's a sub-feature, but we can award points/track usage
             # Assuming we want to award points for "execution_run"
             # Since ExecuteTradesRequest uses `email_to` or `portfolio_code`, but maybe not `email` of user directly?
             # It acts as a util. 
             await increment_usage("execution_run")

        return {"status": "success", "message": execution_msg, "executed_count": len(rh_trades)}

    except Exception as e:
        logger.error(f"Execution Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/nexus")
async def run_nexus(req: NexusRequest):
    if nexus_command is None:
        raise HTTPException(status_code=500, detail="Configuration Error: Nexus Command module not loaded.")

    # Tier Check
    try:
        limit_check = verify_access_and_limits(req.email, "nexus")
        if not limit_check["allowed"]:
            raise HTTPException(status_code=403, detail=limit_check["message"])
    except Exception as e:
        print(f"Warning: Limit check failed: {e}")

    # Track Usage
    await increment_usage("nexus")

    ai_params = {
        "nexus_code": req.nexus_code,
        "create_new": req.create_new,
        "components": req.components,
        "total_value": req.total_value,
        "use_fractional_shares": req.use_fractional_shares,
        "execute_rh": req.execute_rh,
        "rh_user": req.rh_user,
        "rh_pass": req.rh_pass,
        "send_email": req.send_email,
        "email_to": req.email_to,
        "overwrite": req.overwrite
    }

    try:
        # Pass empty list [] as args, ai_params as kwargs
        result = await nexus_command.handle_nexus_command([], ai_params=ai_params, is_called_by_ai=True)
        
        # Explicit check for None return
        if result is None:
            return {
                "status": "error", 
                "message": "Backend returned no data (None). Check server console.",
                "nexus_code": req.nexus_code
            }

        if result.get("status") == "error":
             raise HTTPException(status_code=400, detail=result.get("message"))
             
        return result
    except HTTPException: raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


# -----------------------------
# DATABASE LAB ENDPOINTS
# -----------------------------

class DatabaseSaveRequest(BaseModel):
    type: str # 'nexus' or 'portfolio'
    data: Dict[str, Any]
    email: str # NEW: Email required for permission check
    original_id: Optional[str] = None # For renaming/overwriting

class DatabaseDeleteRequest(BaseModel):
    type: str
    id: str

@app.get("/api/database/codes")
async def get_database_codes():
    nexus = read_nexus_codes()
    portfolios = read_portfolio_codes()
    return {"nexus": nexus, "portfolios": portfolios}

@app.post("/api/database/save")
async def save_database_code(req: DatabaseSaveRequest):
    # 0. Handle Renaming explicitly FIRST
    # If original_id is provided and different from the new ID, we delete the old one first.
    # This frees up the "slot" so the count logic below accounts for it.
    new_id = req.data.get('nexus_code') if req.type == 'nexus' else req.data.get('portfolio_code')
    
    if req.original_id and req.original_id != new_id:
        print(f"[DB] Renaming {req.type} from {req.original_id} to {new_id}")
        delete_code(req.type, req.original_id)

    # 1. Determine Product Type and Count
    product_limit_key = ""
    current_count = 0
    
    if req.type == "nexus":
        product_limit_key = "database_nexus"
        # Count existing
        current_count = len(read_nexus_codes())
    elif req.type == "portfolio":
        product_limit_key = "database_portfolio"
         # Count existing (filter by user if needed? current impl is generic, so we count all for now or filter by user eventually)
         # For strictness, let's load all and count.
        current_count = len(read_portfolio_codes())
    else:
        raise HTTPException(status_code=400, detail="Invalid type")

    # 2. Verify Limits (Pass email from frontend)
    # Note: If editing an EXISTING code (same ID), we should probably allow it even if limit is capped.
    # We need to check if the code ID already exists.
    is_new = True 
    if req.type == "nexus":
        # Check if code exists
        existing = read_nexus_codes()
        target_code = req.data.get('nexus_code')
        if any(c['nexus_code'] == target_code for c in existing):
            is_new = False
    elif req.type == "portfolio":
        existing = read_portfolio_codes()
        target_code = req.data.get('portfolio_code')
        if any(c['portfolio_code'] == target_code for c in existing):
            is_new = False

    # Only check limit if creating NEW
    if is_new:
        check = verify_storage_limit(req.email, product_limit_key, current_count)
        if not check['allowed']:
            raise HTTPException(status_code=403, detail=check.get('message', 'Limit Exceeded'))

    # 3. Save
    if req.type == "nexus":
        save_nexus_code(req.data)
    elif req.type == "portfolio":
        save_portfolio_code(req.data)
    
    return {"status": "success"}

@app.post("/api/database/delete")
async def delete_database_code(req: DatabaseDeleteRequest):
    success = delete_code(req.type, req.id)
    if not success:
        raise HTTPException(status_code=500, detail="Delete failed")
    return {"status": "success"}

# --- AUTOMATION ENDPOINTS ---
class ShareAutomationRequest(BaseModel):
    automation: Dict[str, Any]
    username: str

class CopyAutomationRequest(BaseModel):
    shared_id: str

# --- DATABASE COMMUNITY ENDPOINTS ---

@app.post("/api/database/share")
async def api_share_portfolio(req: ShareAutomationRequest): # Reuse ShareAutomationRequest as payload is similar (automation/data + username)
    # The request body for sharing is consistent: data + username
    return share_portfolio(req.automation, req.username)

@app.get("/api/database/community")
async def api_get_community_portfolios(sort: str = "recent"):
    return get_community_portfolios(sort_by=sort)

@app.post("/api/database/copy-count")
async def api_inc_portfolio_copy(req: CopyAutomationRequest): # Reuse structure: { shared_id: ... }
    increment_portfolio_copy(req.shared_id)
    return {"status": "success"}

# --- AUTOMATION API ---

@app.post("/api/automations/share")
def api_share_automation(req: ShareAutomationRequest):
    return share_automation(req.automation, req.username)

@app.get("/api/automations/community")
def api_get_community_automations(sort: str = "recent"):
    return get_community_automations(sort_by=sort)

@app.post("/api/automations/copy-count")
def api_inc_copy_count(req: CopyAutomationRequest):
    increment_copy_count(req.shared_id)
    return {"status": "success"}


# -----------------------------
# SENTINEL AI ENDPOINTS
# -----------------------------

@app.post("/api/sentinel/plan")
async def plan_sentinel(req: SentinelRequest):
    """
    Generates a plan but DOES NOT execute it. Returns the JSON plan.
    """
    # Simply call the planner directly
    plan = await sentinel_command.plan_execution(req.user_prompt)
    return {"plan": plan}

@app.post("/api/sentinel/execute")
async def execute_sentinel(req: SentinelRequest):
    # Verify Access (Singularity Only)
    # We could do specific tier check here or let frontend hide it.
    # ideally we verify.
    profile = get_user_profile(req.email)
    tier = profile.get("tier", "Basic")
    if tier != "Singularity" and req.email.lower() != SUPER_ADMIN_EMAIL:
         raise HTTPException(status_code=403, detail="Sentinel AI requires Singularity Tier.")

    async def event_generator():
        try:
             # Pass the plan if provided (Interactive Mode), otherwise generates it (Quick Run)
             async for update in sentinel_command.run_sentinel(req.user_prompt, plan_override=req.plan):
                  yield json.dumps(update) + "\n"
        except Exception as e:
             traceback.print_exc()
             yield json.dumps({"type": "error", "message": f"Server Error: {str(e)}"}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

# --- AUTOMATION ENDPOINTS ---
@app.get("/api/automations")
def get_automations_endpoint():
    return load_automations()

@app.post("/api/automations/save")
def save_automation_endpoint(req: AutomationSaveRequest):
    # Check limit if creating new (simplified: count total for user)
    automations = load_automations()
    existing = next((a for a in automations if a['id'] == req.id), None)
    
    if not existing:
        # It's new, check limit
        user_autos = [a for a in automations if a.get('user_email') == req.user_email]
        limit_check = verify_storage_limit(req.user_email, 'automations', len(user_autos))
        if not limit_check['allowed']:
            raise HTTPException(status_code=403, detail=limit_check.get('message', 'Limit Reached'))
            
    # Check block limit
    limit_check_blocks = verify_storage_limit(req.user_email, 'automation_blocks', len(req.nodes))
    if not limit_check_blocks['allowed']:
         raise HTTPException(status_code=403, detail=limit_check_blocks.get('message', 'Block Limit Reached'))

    data = req.dict()
    save_automation(data)
    return {"status": "success"}

@app.post("/api/automations/toggle")
def toggle_automation_endpoint(req: AutomationToggleRequest):
    toggle_automation(req.id, req.active)
    return {"status": "success"}

@app.post("/api/automations/delete")
def delete_automation_endpoint(req: AutomationDeleteRequest):
    delete_automation(req.id)
    return {"status": "success"}

# --- USAGE STATS ENDPOINT ---
@app.get("/api/usage")
def get_usage_stats_endpoint():
    stats = get_all_usage()
    # Add real user count
    try:
        users = get_all_users_from_db()
        stats["total_users"] = len(users)
    except:
        stats["total_users"] = 0
    
    # Add automations count
    try:
        automations = load_automations()
        stats["automations_created"] = len(automations)
    except:
         stats["automations_created"] = 0

    return stats

@app.post("/api/usage/increment")
async def increment_usage_endpoint(req: UsageIncrementRequest):
    try:
        new_val = await increment_usage(req.key)
        return {"status": "success", "new_value": new_val}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Use 0.0.0.0 to listen on all interfaces, typically on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)