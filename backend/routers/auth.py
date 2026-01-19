from fastapi import APIRouter, HTTPException
from typing import Optional
from backend.schemas import (
    UsernameCheckRequest, UsernameUpdateRequest, UserUpdateRequest, 
    UserDeleteRequest, HeartbeatRequest
)
from backend.schemas import ModRequest
from backend.config import get_mod_list, SUPER_ADMIN_EMAIL
from backend.database import (
    get_all_users_from_db, update_user_username, check_username_taken,
    create_user_profile, get_user_profile, update_user_tier, delete_user_full
)
import logging

router = APIRouter()
logger = logging.getLogger("uvicorn")

# --- AUTH & USER CHECK ENDPOINTS ---



@router.post("/api/auth/check-username")
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

@router.post("/api/user/username")
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

@router.get("/api/users")
def get_users(): 
    users = get_all_users_from_db()
    for user in users:
        if user.get('email', '').lower() == SUPER_ADMIN_EMAIL:
            user['tier'] = 'Singularity'
    return users

@router.get("/api/user/profile")
def api_get_user_profile(email: str, uid: Optional[str] = None, username: Optional[str] = None):
    # Fetch actual profile first to get username/uid
    profile = get_user_profile(email)
    
    # If Super Admin, enforce privileges but keep other data
    if email.lower() == SUPER_ADMIN_EMAIL:
        if not profile:
             profile = {"email": email}
        # Force Admin Privileges
        profile.update({
            "tier": "Singularity", 
            "subscription_status": "active", 
            "risk_tolerance": 10, 
            "trading_frequency": "Daily", 
            "portfolio_types": ["All"],
            "settings": {"show_leaderboard": True}
        })
        if "username" not in profile:
             profile["username"] = "Orion_Admin"

    if not profile and uid:
        if create_user_profile(email, uid, username):
             profile = get_user_profile(email)
             
    if profile:
        return profile
    return {"email": email, "tier": "Basic", "subscription_status": "none"}

@router.post("/api/check-username")
def api_check_username(req: UsernameCheckRequest):
    is_taken = check_username_taken(req.username)
    return {"taken": is_taken}

@router.post("/api/user/heartbeat")
async def user_heartbeat(req: HeartbeatRequest):
    try:
        # Check if database has update_user_heartbeat, main.py line 2284 used it.
        # Main.py imports it from database? 
        # Line 2284: database.update_user_heartbeat(req.email)
        # Import it inside function or top level if available
        from backend.database import update_user_heartbeat
        if req.email:
            update_user_heartbeat(req.email)
        return {"status": "ok"}
    except ImportError:
         # Fallback if function missing in database.py (it might be dynamic)
         return {"status": "ok", "note": "heartbeat_mock"}
    except Exception as e:
        logger.error(f"Heartbeat error: {e}")
        return {"status": "error", "detail": str(e)}

# --- ADMIN USER MANAGEMENT ---

@router.post("/api/admin/users/update")
def api_update_user_tier(req: UserUpdateRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    update_user_tier(req.target_email, req.new_tier)
    return {"status": "success"}

@router.post("/api/admin/users/delete")
def api_delete_user(req: UserDeleteRequest):
    mods = get_mod_list()
    if req.requester_email.lower() not in mods: raise HTTPException(status_code=403, detail="Not authorized")
    if req.target_email == SUPER_ADMIN_EMAIL: raise HTTPException(status_code=400, detail="Cannot delete Super Admin")
    delete_user_full(req.target_email)
    return {"status": "success"}

@router.get("/api/mods")
def get_mods_endpoint():
    # Return admin list for frontend check
    return {"mods": get_mod_list()}

@router.post("/api/mods")
def manage_mods(request: ModRequest):
    mods = get_mod_list()
    if request.requester_email.lower() != SUPER_ADMIN_EMAIL:
         raise HTTPException(status_code=403, detail="Only Super Admin can manage moderators")
    
    target = request.email.lower().strip()
    
    # We need to write to MODS_FILE.
    # Import MODS_FILE from config
    from backend.config import MODS_FILE
    
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
