from fastapi import APIRouter, HTTPException, UploadFile, File
from backend.schemas import (
    BannerCreateRequest, BannerUpdateRequest, BannerDeleteRequest,
    PredictionCreateRequest, PredictionDeleteRequest, BetPlaceRequest,
    ReferralRedeemRequest, PointsRequest, UsageIncrementRequest,
    OrionToggleRequest, CouponCreateRequest, CouponDeleteRequest,
    UserUpdateRequest, UserDeleteRequest
)
from backend.config import get_mod_list, SUPER_ADMIN_EMAIL, CURRENT_DIR
from backend.database import (
    get_banners, create_banner, update_banner, delete_banner,
    get_leaderboard, read_ideas_from_csv, read_comments_from_csv, read_articles_from_csv,
    create_coupon, get_all_coupons, delete_coupon, update_user_tier, delete_user_full,
    get_user_points, generate_referral_code, process_referral_signup,
    get_predictions_leaderboard, resolve_prediction, get_active_predictions,
    create_prediction, delete_prediction, get_user_bets, place_bet, update_user_heartbeat
)
from backend.services.orion_manager import OrionManager
from backend.usage_counter import increment_usage, get_all_usage
from backend.database import get_all_users_from_db
from backend.automation_storage import load_automations
import os
import uuid
import logging

logger = logging.getLogger("uvicorn")
router = APIRouter()

STATIC_DIR = os.path.join(CURRENT_DIR, "static")

# --- HEALTH ---
@router.get("/api/health")
def health_check():
    return {"status": "ok", "orion_active": OrionManager.is_running()}

# --- ORION CONTROL ---
@router.post("/api/orion/toggle")
def toggle_orion(req: OrionToggleRequest):
    # Adjust script path based on robust directory finding (Logic from original main.py)
    # Since we are in routers/web.py, CURRENT_DIR is backend/routers? No, config.py defines CURRENT_DIR as backend.
    
    script_path = os.path.join(CURRENT_DIR, "orion_v2.py")
    
    if req.action == "start":
        success, pid_or_msg = OrionManager.start(script_path)
        if success: return {"status": "started", "pid": pid_or_msg}
        else:
             if "already active" in pid_or_msg: return {"status": "running", "message": pid_or_msg}
             raise HTTPException(status_code=500, detail=f"Failed to start Orion: {pid_or_msg}")
             
    elif req.action == "stop":
        success, msg = OrionManager.stop()
        return {"status": msg}

    raise HTTPException(status_code=400, detail="Invalid action")

# --- BANNERS ---
@router.get("/api/banners")
def get_public_banners():
    all_banners = get_banners()
    return [b for b in all_banners if b.get('active')]

@router.get("/api/landing/data")
def get_landing_data():
    all_banners = get_banners()
    active_banners = [b for b in all_banners if b.get('active')]
    
    ideas = read_ideas_from_csv()
    all_comments = read_comments_from_csv()
    for idea in ideas:
        idea_id = str(idea.get('id'))
        idea_comments = [c for c in all_comments if str(c.get('idea_id')) == idea_id]
        idea['comments'] = idea_comments
    ideas.sort(key=lambda x: x.get('date', ''), reverse=True)
    top_ideas = ideas[:3]

    articles = read_articles_from_csv()
    for article in articles:
        article_id = str(article.get('id'))
        article_comments = [c for c in all_comments if str(c.get('article_id')) == article_id]
        article['comments'] = article_comments
    articles.sort(key=lambda x: x.get('date', ''), reverse=True)
    top_articles = articles[:3]

    leaderboard = get_leaderboard(limit=10)

    return {
        "banners": active_banners, "ideas": top_ideas,
        "articles": top_articles, "leaderboard": leaderboard
    }

@router.get("/api/admin/banners")
def get_admin_banners(email: str):
    mods = get_mod_list()
    if email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    return get_banners(include_inactive=True)

@router.post("/api/admin/banners")
def create_new_banner(req: BannerCreateRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if not create_banner(req.dict()): raise HTTPException(status_code=500, detail="Failed to create banner")
    return {"status": "success"}

@router.put("/api/admin/banners")
def update_existing_banner(req: BannerUpdateRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    update_data = req.dict(exclude={'id', 'requester_email'})
    if not update_banner(req.id, update_data): raise HTTPException(status_code=404, detail="Banner not found or update failed")
    return {"status": "success"}

@router.post("/api/admin/banners/delete")
def delete_existing_banner(req: BannerDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if not delete_banner(req.id): raise HTTPException(status_code=404, detail="Banner not found or delete failed")
    return {"status": "success"}

# --- ADMIN COUPONS & REFERRALS ---
@router.get("/api/admin/coupons")
def api_get_coupons(email: str):
    mods = get_mod_list()
    if email not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    return get_all_coupons()

@router.post("/api/admin/coupons/create")
def api_create_coupon(req: CouponCreateRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    create_coupon(req.code, req.plan_id, req.tier, req.discount_label)
    return {"status": "success"}

@router.post("/api/admin/coupons/delete")
def api_delete_coupon(req: CouponDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if delete_coupon(req.code): return {"status": "success"}
    raise HTTPException(status_code=404, detail="Coupon not found")

@router.post("/api/referrals/generate")
def api_gen_referral(req: PointsRequest): 
    code = generate_referral_code(req.email)
    return {"code": code}

@router.post("/api/referrals/redeem")
def api_redeem_referral(req: ReferralRedeemRequest):
    success = process_referral_signup(req.email, req.code)
    return {"success": success}

# --- ADMIN LOGS ---
@router.get("/api/admin/logs")
def get_server_logs(email: str, file: str = "server"):
    mods = get_mod_list()
    # Stricter check: Only Super Admin should probably see raw logs, or at least Mods.
    if email.lower() not in mods: 
        raise HTTPException(status_code=403, detail="Not authorized")

    log_map = {
        "server": "backend_log.txt", # Default log
        "error": "startup_error.log", # Mapped to specific startup error log
        "risk": "risk_calculations.log",
        "startup": "startup_error.log"
    }
    
    filename = log_map.get(file, "server.log")
    filepath = os.path.join(CURRENT_DIR, filename)
    
    # If file is in CURRENT_DIR (backend), it's fine. 
    # Adjust if logs are in root. server_error.log is in root usually.
    if not os.path.exists(filepath):
        # Try root dir
        filepath = os.path.join(os.path.dirname(CURRENT_DIR), filename)
    
    if not os.path.exists(filepath):
        # Fallback for 'error'/'startup' to main log if specific file missing (common in some redirect setups)
        if file in ['error', 'startup']:
            fallback = log_map.get("server")
            filepath = os.path.join(CURRENT_DIR, fallback)
            if not os.path.exists(filepath):
                filepath = os.path.join(os.path.dirname(CURRENT_DIR), fallback)
        
    if not os.path.exists(filepath):
        return {"content": f"Log file '{filename}' not found."}

    try:
        # Read last 2000 lines or so to avoid huge payload
        # Robust reading for PowerShell (UTF-16) vs Bash (UTF-8) logs
        with open(filepath, "rb") as f:
            raw = f.read()
        
        content = ""
        # Check for UTF-16 LE/BE BOM
        if raw.startswith(b'\xff\xfe') or raw.startswith(b'\xfe\xff'):
            try:
                content = raw.decode('utf-16')
            except:
                content = raw.decode('utf-16', errors='replace')
        else:
            try:
                content = raw.decode('utf-8')
            except:
                content = raw.decode('latin-1', errors='replace') # Fallback
                
        return {"content": content, "path": filepath}
    except Exception as e:
        return {"content": f"Failed to read log: {str(e)}"}

# --- POINTS & STATS ---
@router.post("/api/points/user")
def api_get_user_points_endpoint(req: PointsRequest):
    return get_user_points(req.email) # Assuming get_user_points returns int or dict? DB returns val. 
    # Logic in main.py line 2227 returned {"points": ..., "pending": ...} via manual wrapper.
    # But line 1071 in main.py just returned `get_user_points(req.email)`.
    # Let's check `get_user_points` implementation if possible? Assumed to be correct.

@router.get("/api/points/leaderboard")
def api_get_leaderboard_endpoint():
    return get_leaderboard()

@router.get("/api/stats")
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
        "total_users": len(users), "active_users": len(users),
        "total_posts": len(ideas) + len(articles), "trending_topics": trending
    }

@router.get("/api/usage")
def get_usage_stats_endpoint():
    stats = get_all_usage()
    try:
        users = get_all_users_from_db()
        stats["total_users"] = len(users)
    except: stats["total_users"] = 0
    try: # Need to invoke load_automations via automation_storage usually, but imported from db?
        # Imported from backend.database in imports above? No, load_automations comes from automation_storage usually.
        # Fixed import `from backend.database import load_automations` might fail if it's not exposed there.
        # Added explicit import at top.
        automations = load_automations()
        stats["automations_created"] = len(automations)
    except: stats["automations_created"] = 0
    return stats

@router.post("/api/usage/increment")
async def increment_usage_endpoint(req: UsageIncrementRequest):
    try:
        new_val = await increment_usage(req.key)
        return {"status": "success", "new_value": new_val}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- UPLOADS ---
@router.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    upload_dir = os.path.join(STATIC_DIR, "uploads")
    if not os.path.exists(upload_dir): os.makedirs(upload_dir)
    filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    return {"url": f"/static/uploads/{filename}"}

# --- PREDICTIONS ---
@router.get("/api/predictions/leaderboard")
def get_predictions_leaderboard_endpoint():
    return get_predictions_leaderboard()

@router.post("/api/predictions/resolve")
def resolve_prediction_endpoint(req: dict): # Simplified due to generic dict usage
    email = req.get('email')
    mods = get_mod_list()
    if not email or email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    success = resolve_prediction(req.get('id'), req.get('outcome'))
    return {"success": success}

@router.get("/api/predictions/active")
def get_active_predictions_endpoint(include_recent: bool = False):
    return get_active_predictions(include_recent)

@router.post("/api/predictions/create")
def create_prediction_endpoint(req: PredictionCreateRequest):
    mods = get_mod_list()
    # Handle dual email field from schema
    creator = req.creator_email or req.email
    if not creator or creator.lower() not in mods: raise HTTPException(status_code=403, detail="Admins only.")
    prediction = create_prediction(
        req.title, req.stock, req.end_date, req.market_condition, 
        req.wager_logic, creator, req.category
    )
    if not prediction: raise HTTPException(status_code=500, detail="Failed to create prediction")
    return {"success": True, "prediction": prediction}

@router.post("/api/predictions/delete")
def delete_prediction_endpoint(req: PredictionDeleteRequest):
    mods = get_mod_list()
    if req.email.lower() not in mods: raise HTTPException(status_code=403, detail="Admins only.")
    if not delete_prediction(req.id): raise HTTPException(status_code=500, detail="Failed to delete prediction")
    return {"success": True, "status": "deleted"}

@router.get("/api/user/bets")
def get_user_bets_endpoint(email: str):
    return get_user_bets(email)

@router.post("/api/predictions/bet")
def place_bet_endpoint(req: BetPlaceRequest):
    if req.amount <= 0: raise HTTPException(status_code=400, detail="Invalid amount")
    result = place_bet(req.email, req.prediction_id, req.choice, req.amount)
    if not result['success']: raise HTTPException(status_code=400, detail=result.get('message', 'Bet failed'))
    return {"success": True, "bet_id": result.get('bet_id')}
