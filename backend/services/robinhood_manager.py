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

    MAX_LOGIN_RETRIES = 3
    RATE_LIMIT_COOLDOWN = 900  # 15 minutes
    _rate_limited_until = 0

    @classmethod
    def _get_start_dir(cls):
         import os
         base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
         data_dir = os.path.join(base_dir, 'data')
         if not os.path.exists(data_dir):
             os.makedirs(data_dir)
         return data_dir

    @classmethod
    def _load_cooldown(cls):
        import json, os
        try:
             path = os.path.join(cls._get_start_dir(), 'rh_cooldown.json')
             if os.path.exists(path):
                 with open(path, 'r') as f:
                     data = json.load(f)
                     until = data.get('until', 0)
                     if until > time.time():
                         cls._rate_limited_until = until
                         logger.warning(f"Robinhood Rate Limit Loaded from file. Active until: {time.ctime(until)}")
        except Exception as e:
            logger.error(f"Failed to load RH cooldown: {e}")

    @classmethod
    def _save_cooldown(cls, until):
        import json, os
        try:
            cls._rate_limited_until = until
            path = os.path.join(cls._get_start_dir(), 'rh_cooldown.json')
            with open(path, 'w') as f:
                 json.dump({'until': until}, f)
        except Exception as e:
            logger.error(f"Failed to save RH cooldown: {e}")

    @classmethod
    def _get_state(cls, username):
        # Load cooldown once if not checked
        if cls._rate_limited_until == 0:
            cls._load_cooldown()

        with cls._lock:
            if username not in cls._user_states:
                cls._user_states[username] = {
                    'status': ConnectionStatus.DISCONNECTED,
                    'last_attempt': 0,
                    'thread': None,
                    'last_error': None,
                    'fail_count': 0
                }
            return cls._user_states[username]

    @classmethod
    def ensure_connected(cls, username, password):
        """
        Non-blocking check. Triggers background login if needed.
        Returns the current status.
        """
        # Ensure cooldown is loaded
        if cls._rate_limited_until == 0:
            cls._load_cooldown()

        if time.time() < cls._rate_limited_until:
             wait_min = int((cls._rate_limited_until - time.time()) / 60)
             return {
                 'status': ConnectionStatus.FAILED.value,
                 'message': f"Rate Limited. Retrying in {wait_min}m."
             }
             
        state = cls._get_state(username)
        status = state['status']
        now = time.time()

        if status == ConnectionStatus.CONNECTED:
            return status

        if status == ConnectionStatus.CONNECTING:
             return status

        # If Failed, check if we should retry
        if status == ConnectionStatus.FAILED:
            # Exponential backoff based on fail count
            backoff = cls.RETRY_INTERVAL * (2 ** state.get('fail_count', 0))
            if now - state['last_attempt'] < backoff:
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
            import os
            data_dir = cls._get_start_dir()
            pickle_path = os.path.join(data_dir, 'robinhood.pickle')

            # store_session=True enables creating/reading the pickle file
            res = r.login(username, password, store_session=True, pickle_name=pickle_path)
            
            # Verify login success immediately
            if not r.profiles.load_account_profile(info='account_number'):
                 raise Exception("Login Verification Failed: Could not load account profile.")

            with cls._lock:
                cls._user_states[username]['status'] = ConnectionStatus.CONNECTED
                cls._user_states[username]['last_error'] = None
                cls._user_states[username]['fail_count'] = 0 # Reset on success
            
            logger.info(f"Background login SUCCESS for {username}")
            
        except TypeError as te:
            logger.error(f"Background login TypeError for {username}: {te}")
            with cls._lock:
                cls._user_states[username]['status'] = ConnectionStatus.FAILED
                cls._user_states[username]['last_error'] = "Login Failed: Interactive challenge required or bad credentials."
                cls._user_states[username]['fail_count'] = cls._user_states[username].get('fail_count', 0) + 1
                
        except Exception as e:
            logger.error(f"Background login FAILED for {username}: {str(e)}")
            msg = str(e)
            
            # Check for Rate Limit explicitly
            if '429' in msg or 'Too Many Requests' in msg:
                logger.critical(f"Robinhood Rate Limit Detected for {username}. Backing off for 15 minutes.")
                # Save persistent cooldown
                until = time.time() + cls.RATE_LIMIT_COOLDOWN
                cls._save_cooldown(until)
                msg = "Rate Limited (Too Many Requests). Paused for 15m."
            
            with cls._lock:
                cls._user_states[username]['status'] = ConnectionStatus.FAILED
                cls._user_states[username]['last_error'] = msg
                cls._user_states[username]['fail_count'] = cls._user_states[username].get('fail_count', 0) + 1

    @staticmethod
    def get_portfolio(username, password):
        # 0. Global Rate Limit Check
        if time.time() < RobinhoodManager._rate_limited_until:
             return {
                 "equity": 0, "equity_formatted": "---", "day_change": 0, "day_change_pct": 0,
                 "status": ConnectionStatus.FAILED.value,
                 "message": "Rate Limited. Please wait."
             }

        # 1. Check Cache first (if valid)
        if username in RH_CACHE:
            ts, data = RH_CACHE[username]
            if time.time() - ts < CACHE_TTL:
                return data

        # 2. Check Connection
        res = RobinhoodManager.ensure_connected(username, password)
        
        # Handle dict return (custom rate limit message) or Enum
        if isinstance(res, dict):
             return {
                 "equity": 0, "equity_formatted": "---", "day_change": 0, "day_change_pct": 0,
                 "status": res['status'], "message": res['message']
             }
             
        status = res
        
        if status != ConnectionStatus.CONNECTED:
            # Return a special status dict instead of blocking or failing
            state = RobinhoodManager._get_state(username)
            msg = "Connecting to Robinhood..."
            if status == ConnectionStatus.FAILED:
                msg = f"Connection Failed. Error: {state.get('last_error')}"
            
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
