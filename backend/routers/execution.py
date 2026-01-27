from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio
import traceback
import os

router = APIRouter()

class TradeItem(BaseModel):
    ticker: str
    action: Optional[str] = None
    side: Optional[str] = None # 'buy' or 'sell'
    quantity: float
    diff: Optional[float] = None
    
    # Allow flexible input (action or side, diff or quantity)
    def get_side(self):
        s = self.side or self.action
        return s.lower() if s else 'buy'
        
    def get_qty(self):
        return self.quantity or self.diff or 0.0

class ExecutionRequest(BaseModel):
    trades: List[TradeItem]
    rh_username: Optional[str] = None
    rh_password: Optional[str] = None
    email_to: Optional[str] = None

@router.post("/execute-trades")
async def execute_trades_stream(req: ExecutionRequest):
    """
    Streams execution progress for a list of trades using SSE-like JSON chunks.
    """
    async def event_generator():
        try:
            # 1. Setup & Auth
            yield json.dumps({"type": "progress", "message": "Initializing Execution Engine...", "completed": 0, "total": len(req.trades)}) + "\n"
            
            # Set credentials for this session if provided
            if req.rh_username: os.environ["RH_USERNAME"] = req.rh_username
            if req.rh_password: os.environ["RH_PASSWORD"] = req.rh_password
            
            # 2. Import Execution Logic lazily to ensure env vars are picked up
            try:
                from backend.integration.execution_command import execute_portfolio_rebalance
            except ImportError:
                from integration.execution_command import execute_portfolio_rebalance

            # 3. Normalize Trades
            clean_trades = []
            for t in req.trades:
                clean_trades.append({
                    'ticker': t.ticker,
                    'side': t.get_side(),
                    'quantity': t.get_qty()
                })
            
            total_trades = len(clean_trades)
            yield json.dumps({"type": "progress", "message": f"Queued {total_trades} trades for execution.", "completed": 0, "total": total_trades}) + "\n"

            # 4. Execute One by One (to stream progress)
            # We can't use the bulk `execute_portfolio_rebalance` easily if we want granular streaming per trade 
            # unless we modify it. 
            # OR, we assume `execute_portfolio_rebalance` prints to stdout and we capture it? 
            # Better: We re-implement the loop here for granular control, calling the core execution function for each.
            
            # Actually, `execute_portfolio_rebalance` handles login and bulk processing. 
            # Replicating it here might miss safety checks.
            # Let's try to mock the progress callback if possible? 
            # Alternatively, we execute one by one.
            
            # Let's do one-by-one execution to ensure we can report progress back to UI.
            # We need to Login ONCE.
            
            # Login (SKIPPING FOR DUMMY TEST)
            # try:
            #     # Use shared login function with MFA support
            #     from backend.integration.execution_command import login_to_robinhood
            #     if not login_to_robinhood():
            #         yield json.dumps({"type": "error", "message": "Login Failed (MFA/Creds)"}) + "\n"
            #         return
            #     
            #     yield json.dumps({"type": "progress", "message": "Authenticated successfully.", "completed": 0, "total": total_trades}) + "\n"
                
            # except Exception as e:
            #     yield json.dumps({"type": "error", "message": f"Login Failed: {e}"}) + "\n"
            #     return
            yield json.dumps({"type": "progress", "message": "Authenticated (Simulated)", "completed": 0, "total": total_trades}) + "\n"
                
            # except Exception as e:
            #    yield json.dumps({"type": "error", "message": f"Login Failed: {e}"}) + "\n"
            #    return

            # --- DUMMY EXECUTION MODE (REQUESTED FOR TESTING) ---
            # 5. Execute Loop (Simulated)
            completed_count = 0
            for trade in clean_trades:
                ticker = trade['ticker']
                side = trade['side']
                qty = trade['quantity']
                
                msg = f"Simulating {side.upper()} {ticker} ({qty:.4f})..."
                yield json.dumps({"type": "progress", "message": msg, "completed": completed_count, "total": total_trades, "trade": trade}) + "\n"
                
                await asyncio.sleep(0.8) # Simulate network delay
                
                # Always succeed for simulation
                yield json.dumps({"type": "progress", "message": f"✅ Executed {side.upper()} {ticker} (SIMULATED)", "completed": completed_count + 1, "total": total_trades, "trade": trade}) + "\n"
                
                completed_count += 1
                await asyncio.sleep(0.2) 

            # 6. Send Email if requested (Simulated)
            if req.email_to:
                yield json.dumps({"type": "progress", "message": "Sending Confirmation Email (Simulating)...", "completed": total_trades, "total": total_trades}) + "\n"
                await asyncio.sleep(1.0)
                yield json.dumps({"type": "progress", "message": "Email Sent (Simulated).", "completed": total_trades, "total": total_trades}) + "\n"

            yield json.dumps({"type": "result", "payload": {"status": "success", "count": completed_count}}) + "\n"

        except Exception as e:
            traceback.print_exc()
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")
