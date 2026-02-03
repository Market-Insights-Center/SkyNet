from fastapi import APIRouter
from typing import List, Dict, Any
import datetime

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/summary")
async def get_dashboard_summary():
    """
    Aggregates data for the Unified Strategy Dashboard.
    """
    # Mock data for now, eventually this should pull from DB/Services
    
    # 1. Active Automations
    # In real app: fetch from AutomationService.get_active()
    active_automations = [
        {"id": "auto_1", "name": "Spy Momentum", "status": "running", "next_run": "10:30 AM"},
        {"id": "auto_2", "name": "Risk Check", "status": "running", "next_run": "10:45 AM"},
    ]

    # 2. Strategy PnL
    # In real app: fetch from PortfolioService
    strategy_pnl = {
        "daily": 1250.50,
        "daily_pct": 1.2,
        "weekly": 4500.00,
        "total": 15000.00
    }

    # 3. Recent Actions
    # In real app: fetch from AuditLog
    recent_actions = [
        {"time": "10:15 AM", "action": "Manual Override", "details": "Disable Sell Logic"},
        {"time": "10:00 AM", "action": "Optimization", "details": "Updated 'Trend' params"},
        {"time": "09:45 AM", "action": "System", "details": "Risk Check Passed"}
    ]

    # 4. Market Overview
    # In real app: fetch from MarketService (SPY cache)
    market_overview = {
        "spy_price": 450.25,
        "spy_change": 0.5,
        "status": "Bullish",
        "vix": 14.2
    }

    return {
        "active_automations": active_automations,
        "strategy_pnl": strategy_pnl,
        "recent_actions": recent_actions,
        "market_overview": market_overview
    }
