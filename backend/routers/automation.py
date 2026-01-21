from fastapi import APIRouter, HTTPException
from backend.schemas import (
    NexusRequest, ExecuteTradesRequest, DatabaseSaveRequest, DatabaseDeleteRequest,
    ShareAutomationRequest, CopyAutomationRequest, AutomationSaveRequest,
    AutomationToggleRequest, AutomationDeleteRequest
)
from backend.database import (
    share_automation, get_community_automations, increment_copy_count, verify_access_and_limits,
    delete_community_automation, delete_community_portfolio, verify_storage_limit
)
from backend.integration.database_manager import (
    read_nexus_codes, read_portfolio_codes, save_nexus_code, save_portfolio_code, delete_code
)
from backend.usage_counter import increment_usage

# Attempt imports for integration and automation
try:
    from backend.integration import nexus_command
except ImportError:
    try:
        from integration import nexus_command
    except: pass

try:
    from backend.automation_storage import load_automations, save_automation, delete_automation, toggle_automation
except ImportError:
    try:
        from automation_storage import load_automations, save_automation, delete_automation, toggle_automation
    except: pass

import os
import asyncio
import traceback
import logging

logger = logging.getLogger("uvicorn")
router = APIRouter()

# --- NEXUS ---
@router.post("/api/nexus")
async def run_nexus(req: NexusRequest):
    if nexus_command is None:
        raise HTTPException(status_code=500, detail="Configuration Error: Nexus Command module not loaded.")

    try:
        limit_check = verify_access_and_limits(req.email, "nexus")
        if not limit_check["allowed"]:
            raise HTTPException(status_code=403, detail=limit_check["message"])
    except Exception as e:
        print(f"Warning: Limit check failed: {e}")

    # Not awaiting increment_usage here, will be done inside command or here? 
    # nexus_command.handle_nexus_command does increment_usage('nexus').
    # But we want to ensure it's logged. It is inside handle_nexus_command.

    ai_params = {
        "nexus_code": req.nexus_code, "create_new": req.create_new,
        "components": req.components, "total_value": req.total_value,
        "use_fractional_shares": req.use_fractional_shares,
        "execute_rh": req.execute_rh, "rh_user": req.rh_user,
        "rh_pass": req.rh_pass, "send_email": req.send_email,
        "email_to": req.email_to, "overwrite": req.overwrite
    }

    from fastapi.responses import StreamingResponse
    import json

    async def event_generator():
        q = asyncio.Queue()

        async def progress_callback(msg):
            await q.put({"type": "progress", "message": msg})

        async def runner():
            try:
                # We must accept the new progress_callback arg
                # Note: handle_nexus_command signature was updated to accept progress_callback
                result = await nexus_command.handle_nexus_command(
                    [], 
                    ai_params=ai_params, 
                    is_called_by_ai=True,
                    progress_callback=progress_callback
                )
                
                if result is None:
                    await q.put({"type": "error", "message": "Backend returned no data."})
                elif result.get("status") == "error":
                    await q.put({"type": "error", "message": result.get("message")})
                else:
                    await q.put({"type": "result", "payload": result})
            except Exception as e:
                traceback.print_exc()
                await q.put({"type": "error", "message": f"Internal Error: {str(e)}"})
            finally:
                await q.put(None) # Sentinel

        # Start background task
        asyncio.create_task(runner())

        while True:
            data = await q.get()
            if data is None: break
            yield json.dumps(data) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

@router.post("/api/execute-trades")
async def execute_trades_endpoint(req: ExecuteTradesRequest):
    try:
        try:
            from backend.integration.execution_command import execute_portfolio_rebalance
        except ImportError:
            from integration.execution_command import execute_portfolio_rebalance

        if not req.trades:
             return {"status": "success", "message": "No trades to execute."}

        rh_trades = []
        for t in req.trades:
            side = t.get('action', '').lower()
            if not side: side = t.get('side', '').lower()
            if not side:
                d = float(t.get('diff', 0))
                if d != 0: side = 'buy' if d > 0 else 'sell'
            qty = abs(float(t.get('diff', 0)))
            if qty == 0: qty = float(t.get('quantity', 0))
            if qty == 0: continue
            
            rh_trades.append({"ticker": t['ticker'], "side": side, "quantity": qty})
            
        execution_msg = ""
        if req.rh_username and req.rh_password:
             os.environ["RH_USERNAME"] = req.rh_username
             os.environ["RH_PASSWORD"] = req.rh_password
             await asyncio.to_thread(execute_portfolio_rebalance, rh_trades)
             execution_msg += "Executed on Robinhood. "
        else:
             execution_msg += "Credentials missing for RH execution. "

        if req.rh_username:
             await increment_usage("execution_run")

        return {"status": "success", "message": execution_msg, "executed_count": len(rh_trades)}

    except Exception as e:
        logger.error(f"Execution Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- DATABASE LAB ---
@router.get("/api/database/codes")
async def get_database_codes():
    return {"nexus": read_nexus_codes(), "portfolios": read_portfolio_codes()}

@router.post("/api/database/save")
async def save_database_code(req: DatabaseSaveRequest):
    new_id = req.data.get('nexus_code') if req.type == 'nexus' else req.data.get('portfolio_code')
    if req.original_id and req.original_id != new_id:
        delete_code(req.type, req.original_id)

    product_limit_key = "database_nexus" if req.type == "nexus" else "database_portfolio"
    current_count = len(read_nexus_codes()) if req.type == "nexus" else len(read_portfolio_codes())
    
    is_new = True 
    if req.type == "nexus":
        existing = read_nexus_codes()
        if any(c['nexus_code'] == new_id for c in existing): is_new = False
    elif req.type == "portfolio":
        existing = read_portfolio_codes()
        if any(c['portfolio_code'] == new_id for c in existing): is_new = False

    if is_new:
        check = verify_storage_limit(req.email, product_limit_key, current_count)
        if not check['allowed']:
            raise HTTPException(status_code=403, detail=check.get('message', 'Limit Exceeded'))

    if req.type == "nexus": save_nexus_code(req.data)
    elif req.type == "portfolio": save_portfolio_code(req.data)
    return {"status": "success"}

@router.post("/api/database/delete")
async def delete_database_code(req: DatabaseDeleteRequest):
    if delete_code(req.type, req.id): return {"status": "success"}
    raise HTTPException(status_code=500, detail="Delete failed")

@router.post("/api/database/share")
async def api_share_portfolio(req: ShareAutomationRequest):
    return share_portfolio(req.automation, req.username)

@router.get("/api/database/community")
async def api_get_community_portfolios(sort: str = "recent"):
    return get_community_portfolios(sort_by=sort)

@router.post("/api/database/copy-count")
async def api_inc_portfolio_copy(req: CopyAutomationRequest):
    increment_portfolio_copy(req.shared_id)
    return {"status": "success"}

@router.post("/api/database/community/delete")
async def api_delete_community_portfolio(req: ShareAutomationRequest):
    # Reusing ShareAutomationRequest since it has 'username' (and 'automation' which can hold id for hack or we make a new schema)
    # Actually ShareAutomationRequest has request.automation (dict) and username.
    # We need the ID.
    # Let's use a Generic Dict or specific schema.
    # Schema: AutomationDeleteRequest only has ID.
    # We need ID and Username.
    # Let's use ShareAutomationRequest but pass {id: "..."} as automation?
    # Or just use Body.
    # Let's verify ShareAutomationRequest schema.
    # It imports from backend.schemas.
    pass

@router.post("/api/database/community/delete-item") 
async def api_delete_community_portfolio_real(req: dict):
    # Using dict to avoid schema issues for now, or check schemas.
    # Expected: { "id": "...", "username": "..." }
    res = delete_community_portfolio(req.get('id'), req.get('username'))
    if res['success']: return {"status": "success"}
    raise HTTPException(status_code=403, detail=res['message'])

@router.get("/api/automations")
def get_automations_endpoint():
    return load_automations()

@router.post("/api/automations/save")
def save_automation_endpoint(req: AutomationSaveRequest):
    automations = load_automations()
    existing = next((a for a in automations if a['id'] == req.id), None)
    if not existing:
        user_autos = [a for a in automations if a.get('user_email') == req.user_email]
        limit_check = verify_storage_limit(req.user_email, 'automations', len(user_autos))
        if not limit_check['allowed']:
            raise HTTPException(status_code=403, detail=limit_check.get('message', 'Limit Reached'))
            
    limit_check_blocks = verify_storage_limit(req.user_email, 'automation_blocks', len(req.nodes))
    if not limit_check_blocks['allowed']:
         raise HTTPException(status_code=403, detail=limit_check_blocks.get('message', 'Block Limit Reached'))

    save_automation(req.dict())
    return {"status": "success"}

@router.post("/api/automations/toggle")
def toggle_automation_endpoint(req: AutomationToggleRequest):
    toggle_automation(req.id, req.active)
    return {"status": "success"}

@router.post("/api/automations/delete")
def delete_automation_endpoint(req: AutomationDeleteRequest):
    delete_automation(req.id)
    return {"status": "success"}

@router.post("/api/automations/share")
def api_share_automation(req: ShareAutomationRequest):
    return share_automation(req.automation, req.username)

@router.get("/api/automations/community")
def api_get_community_automations(sort: str = "recent"):
    return get_community_automations(sort_by=sort)

@router.post("/api/automations/copy-count")
def api_inc_copy_count(req: CopyAutomationRequest):
    increment_copy_count(req.shared_id)
    return {"status": "success"}

@router.post("/api/automations/community/delete")
def api_delete_community_automation(req: dict):
    # Expected: { "id": "...", "username": "..." }
    res = delete_community_automation(req.get('id'), req.get('username'))
    if res['success']: return {"status": "success"}
    raise HTTPException(status_code=403, detail=res['message'])
