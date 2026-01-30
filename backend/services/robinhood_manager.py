import robin_stocks.robinhood as r
import pyotp
import logging
from functools import lru_cache
import time
import threading
from enum import Enum

logger = logging.getLogger("backend.market")

# Simple in-memory cache for portfolio data
RH_CACHE = {}
CACHE_TTL = 300 # 5 minutes

class ConnectionStatus(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    FAILED = "failed"

class RobinhoodManager:
    # Track state per user: { username: { 'status': ConnectionStatus, 'last_attempt': float, 'thread': Thread } }
    _user_states = {}
    _lock = threading.Lock()
    
    RETRY_INTERVAL = 60 # Seconds before retrying a failed login

    @classmethod
    def _get_state(cls, username):
        with cls._lock:
            if username not in cls._user_states:
                cls._user_states[username] = {
                    'status': ConnectionStatus.DISCONNECTED,
                    'last_attempt': 0,
                    'thread': None,
                    'last_error': None
                }
            return cls._user_states[username]

    @classmethod
    def ensure_connected(cls, username, password):
        """
        Non-blocking check. Triggers background login if needed.
        Returns the current status.
        """
        state = cls._get_state(username)
        status = state['status']
        now = time.time()

        if status == ConnectionStatus.CONNECTED:
            return status

        if status == ConnectionStatus.CONNECTING:
             # Already trying
             return status

        # If Failed, check if we should retry
        if status == ConnectionStatus.FAILED:
            if now - state['last_attempt'] < cls.RETRY_INTERVAL:
                return status # Too soon to retry

        # Start Login Thread
        logger.info(f"Triggering background login for {username}...")
        state['status'] = ConnectionStatus.CONNECTING
        state['last_attempt'] = now
        state['thread'] = threading.Thread(target=cls._login_worker, args=(username, password), daemon=True)
        state['thread'].start()
        
        return ConnectionStatus.CONNECTING

    @classmethod
    def _login_worker(cls, username, password):
        try:
            # Attempt Login
            # note: store_session=False to avoid pickling issues or disk writes if preferred, 
            # but True is default. keeping default for now.
            r.login(username, password, store_session=False)
            
            with cls._lock:
                cls._user_states[username]['status'] = ConnectionStatus.CONNECTED
                cls._user_states[username]['last_error'] = None
            
            logger.info(f"Background login SUCCESS for {username}")
            
        except Exception as e:
            logger.error(f"Background login FAILED for {username}: {e}")
            with cls._lock:
                cls._user_states[username]['status'] = ConnectionStatus.FAILED
                cls._user_states[username]['last_error'] = str(e)

    @staticmethod
    def get_portfolio(username, password):
        # 1. Check Cache first (if valid)
        if username in RH_CACHE:
            ts, data = RH_CACHE[username]
            if time.time() - ts < CACHE_TTL:
                return data

        # 2. Check Connection
        status = RobinhoodManager.ensure_connected(username, password)
        
        if status != ConnectionStatus.CONNECTED:
            # Return a special status dict instead of blocking or failing
            state = RobinhoodManager._get_state(username)
            msg = "Connecting to Robinhood..."
            if status == ConnectionStatus.FAILED:
                msg = f"Connection Failed (Retrying in {int(RobinhoodManager.RETRY_INTERVAL - (time.time() - state['last_attempt']))}s). Error: {state.get('last_error')}"
            
            return {
                "equity": 0,
                "equity_formatted": "---",
                "day_change": 0,
                "day_change_pct": 0,
                "status": status.value,
                "message": msg
            }

        # 3. Fetch Data (Synchronous but quick generally if logged in)
        try:
            # Fetch Profiles
            # profiles = r.build_user_profile() # Unused
            
            portfolio = r.profiles.load_portfolio_profile()
            if not portfolio:
                # Session might be invalid?
                # Trigger re-login next time?
                with RobinhoodManager._lock:
                     RobinhoodManager._user_states[username]['status'] = ConnectionStatus.FAILED
                return None

            equity = float(portfolio.get('equity', 0) or 0)
            extended_hours_equity = float(portfolio.get('extended_hours_equity', 0) or 0)
            
            if extended_hours_equity and extended_hours_equity > 0:
                current_val = extended_hours_equity
            else:
                current_val = equity

            prev_close = float(portfolio.get('equity_previous_close', 0) or 0)
            
            day_change_amount = current_val - prev_close
            day_change_pct = (day_change_amount / prev_close) * 100 if prev_close != 0 else 0
            
            result = {
                "equity": current_val,
                "equity_formatted": f"${current_val:,.2f}",
                "day_change": day_change_amount,
                "day_change_pct": day_change_pct,
                "status": "connected"
            }
            
            # Update cache
            RH_CACHE[username] = (time.time(), result)
            return result
            
        except Exception as e:
            logger.error(f"RH Data Fetch Error: {e}")
            # Assume connection died
            with RobinhoodManager._lock:
                 RobinhoodManager._user_states[username]['status'] = ConnectionStatus.FAILED
                 RobinhoodManager._user_states[username]['last_error'] = str(e)
            return None
