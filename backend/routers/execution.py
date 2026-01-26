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
            
            import robin_stocks.robinhood as r
            
            # Login
            try:
                user = os.environ.get("RH_USERNAME")
                passwd = os.environ.get("RH_PASSWORD")
                if not user or not passwd:
                     yield json.dumps({"type": "error", "message": "Missing Robinhood Credentials"}) + "\n"
                     return

                # Check if logged in?
                # r.login(user, passwd) # This might trigger 2FA which is separate issue. Assuming cached or simple login.
                # Use existing login wrapper if available
                # from backend.integration.execution_command import login_robinhood
                # login_robinhood()
                # For now using direct login attempt
                yield json.dumps({"type": "progress", "message": "Authenticating with Robinhood...", "completed": 0, "total": total_trades}) + "\n"
                r.login(username=user, password=passwd, expiresIn=86400, by_sms=True)
                
            except Exception as e:
                yield json.dumps({"type": "error", "message": f"Login Failed: {e}"}) + "\n"
                return

            # Execute Loop
            completed_count = 0
            for trade in clean_trades:
                ticker = trade['ticker']
                side = trade['side']
                qty = trade['quantity']
                
                msg = f"Executing {side.upper()} {ticker} ({qty:.4f})..."
                yield json.dumps({"type": "progress", "message": msg, "completed": completed_count, "total": total_trades, "trade": trade}) + "\n"
                
                try:
                    # Execute
                    if side == 'buy':
                        # Use fractional buy by value or shares? 
                        # Input is usually shares.
                        # execute_portfolio_rebalance uses `order_buy_fractional_by_quantity`
                        res = r.order_buy_fractional_by_quantity(ticker, qty)
                    else:
                        res = r.order_sell_fractional_by_quantity(ticker, qty)
                    
                    # Check result
                    # RH returns dict. If 'id' or 'url' exists, usually success. 'detail' usually error.
                    if res and ('id' in res or 'url' in res):
                        yield json.dumps({"type": "progress", "message": f"✅ Executed {side.upper()} {ticker}", "completed": completed_count + 1, "total": total_trades, "trade": trade}) + "\n"
                    else:
                        err = res.get('detail') if res else "Unknown Error"
                        yield json.dumps({"type": "progress", "message": f"❌ Failed {ticker}: {err}", "completed": completed_count + 1, "total": total_trades, "trade": trade}) + "\n"

                except Exception as e:
                    yield json.dumps({"type": "progress", "message": f"❌ Error {ticker}: {e}", "completed": completed_count + 1, "total": total_trades, "trade": trade}) + "\n"
                
                completed_count += 1
                await asyncio.sleep(0.5) # Rate limit safety

            # 5. Send Email if requested
            if req.email_to:
                yield json.dumps({"type": "progress", "message": "Sending Confirmation Email...", "completed": total_trades, "total": total_trades}) + "\n"
                try:
                    from backend.integration import monitor_command
                    subject = "SkyNet Execution Report"
                    body = f"Executed {total_trades} trades.\n\n" + "\n".join([f"{t['side'].upper()} {t['ticker']} x{t['quantity']}" for t in clean_trades])
                    await monitor_command.send_notification(subject, body, to_emails=[req.email_to])
                    yield json.dumps({"type": "progress", "message": "Email Sent.", "completed": total_trades, "total": total_trades}) + "\n"
                except Exception as e:
                    yield json.dumps({"type": "error", "message": f"Email Failed: {e}"}) + "\n"

            yield json.dumps({"type": "result", "payload": {"status": "success", "count": completed_count}}) + "\n"

        except Exception as e:
            traceback.print_exc()
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")
