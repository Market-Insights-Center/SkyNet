import robin_stocks.robinhood as r
import pyotp
import logging
from functools import lru_cache
import time

logger = logging.getLogger("backend.market")

# Simple in-memory cache for portfolio data to avoid hitting RH API rate limits/login spam
# Key: email, Value: (timestamp, data)
RH_CACHE = {}
CACHE_TTL = 300 # 5 minutes

class RobinhoodManager:
    @staticmethod
    def login(username, encrypted_pass, mfa_code=None):
        """
        Attempt to login to Robinhood.
        Note: 'encrypted_pass' is currently passed as plain text in this prototype phase 
        as per user instructions (stored in firestore). In production, decrypt here.
        """
        try:
            # If MFA is set up with a TOTP secret (tricky without user interaction), 
            # we might need that. For now, we assume simple login or handle the challenge/input flow?
            # User said "simply entering their username and password", implies no MFA or stored MFA secret.
            # If MFA is required, this will fail or require console input (which we can't do easily).
            # We'll try standard login.
            
            # NOTE: r.login stores session in pickle. We might want to persist this?
            # For now, we login on demand or check validity.
            
            resp = r.login(username, encrypted_pass, store_session=True)
            return True, "Logged in"
        except Exception as e:
            logger.error(f"RH Login Failed for {username}: {e}")
            return False, str(e)

    @staticmethod
    def get_portfolio(username, password):
        # Check cache
        if username in RH_CACHE:
            ts, data = RH_CACHE[username]
            if time.time() - ts < CACHE_TTL:
                return data

        success, msg = RobinhoodManager.login(username, password)
        if not success:
            return None

        try:
            # Fetch Profiles
            profiles = r.build_user_profile()
            
            # Calculate total equity
            # method 1: load_portfolio_profile gives equity
            portfolio = r.profiles.load_portfolio_profile()
            
            if not portfolio:
                return None

            equity = float(portfolio.get('equity', 0) or 0)
            extended_hours_equity = float(portfolio.get('extended_hours_equity', 0) or 0)
            
            # Use extended hours if available and different/active?
            # Usually just use valid equity.
            if extended_hours_equity and extended_hours_equity > 0:
                current_val = extended_hours_equity
            else:
                current_val = equity

            # Get Previous Close for PnL
            # 'equity_previous_close'
            prev_close = float(portfolio.get('equity_previous_close', 0) or 0)
            
            # Simple PnL
            day_change_amount = current_val - prev_close
            day_change_pct = (day_change_amount / prev_close) * 100 if prev_close != 0 else 0
            
            result = {
                "equity": current_val,
                "equity_formatted": f"${current_val:,.2f}",
                "day_change": day_change_amount,
                "day_change_pct": day_change_pct,
                # "year_change": None  # Feature removed due to API limitations
            }
            
            # Update cache
            RH_CACHE[username] = (time.time(), result)
            return result
            
        except Exception as e:
            logger.error(f"RH Data Fetch Error: {e}")
            return None
