import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Centralized configuration for SkyNet.
    Uses Pydantic for validation and easy env var loading.
    """
    # General
    APP_NAME: str = "SkyNet Backend"
    VERSION: str = "2.1.0"
    DEBUG: bool = False
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Scheduler
    ENABLE_SCHEDULER: bool = True
    RISK_UPDATE_INTERVAL_MINUTES: int = 15
    PERFORMANCE_UPDATE_INTERVAL_MINUTES: int = 15
    STRATEGY_PNL_UPDATE_INTERVAL_MINUTES: int = 5
    AUTOMATION_CHECK_INTERVAL_SECONDS: int = 60
    
    # APIs & Keys (Loaded from environment)
    OPENAI_API_KEY: str | None = None
    ALPACA_API_KEY: str | None = None
    ALPACA_SECRET_KEY: str | None = None
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# --- Legacy Exports for Compatibility ---
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "admin@skynet.com")

def get_mod_list():
    """Returns a list of moderator emails from env."""
    raw = os.getenv("MOD_LIST", "")
    if not raw:
        return [SUPER_ADMIN_EMAIL]
    return [e.strip().lower() for e in raw.split(",") if e.strip()]

# --- Legacy Constants ---
BASE_DIR = settings.BASE_DIR
# Assuming CURRENT_DIR was traditionally backend/
CURRENT_DIR = os.path.join(BASE_DIR, "backend")
MODS_FILE = os.path.join(CURRENT_DIR, "mods.txt") # Fallback path if used elsewhere

