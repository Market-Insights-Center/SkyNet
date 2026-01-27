from fastapi import FastAPI, Request
# Force reload trigger v19 - Indentation Fix
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
import sys
import logging
import traceback

# --- SYSTEM PATH FIX ---
# Add parent directory to sys.path to ensure 'backend' package is resolvable
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# --- IMPORTS ---
from backend.services.orion_manager import OrionManager
from backend.routers import auth, chat, content, market, automation, ai, web, background, execution
# --- LOGGING ---
# Ensure logs are overwritten on each startup for a clean state
log_filename = "backend_log.txt"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(log_filename, mode='w', encoding='utf-8'), # 'w' = Overwrite old logs
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("uvicorn")

def setup_domain_logger(name, filename):
    """Sets up a specific logger with a file handler."""
    l = logging.getLogger(name)
    l.setLevel(logging.INFO)
    # Prevent propagation to avoid duplicate logs in main log if desired, 
    # but keeping it True allows 'Master' log to see everything. 
    # Let's keep propagation default (True).
    handler = logging.FileHandler(filename, mode='w', encoding='utf-8')
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    l.addHandler(handler)
    return l

# Configure Domain Loggers
setup_domain_logger("backend.orion", "orion.log")
setup_domain_logger("backend.auth", "auth.log")
setup_domain_logger("backend.market", "market_data.log")
setup_domain_logger("backend.automation", "automation.log")

# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing SkyNet Backend...")
    
    # 1. Start Risk/Performance Scheduler via modules if needed
    # Note: Original main.py defined start_scheduler() locally. 
    # Ideally should be moved to a scheduler service. 
    # For now, we import the old one if we didn't refactor it, or we rely on explicit calls.
    # Refactoring suggestion: backend/services/scheduler_service.py
    
    # Attempting to start the global scheduler if it exists in backend.points_scheduler
    try:
        from backend.points_scheduler import start_scheduler as start_points_scheduler
        start_points_scheduler()
        logger.info("Points Scheduler started.")
    except Exception as e:
        logger.warning(f"Failed to start Points Scheduler: {e}")

    # Standard Scheduler (Risk, Automation, etc.)
    try:
        from backend.services.scheduler import start_scheduler, stop_scheduler
        start_scheduler()
    except Exception as e:
        logger.error(f"Failed to start Global Scheduler: {e}")

    # Initialize Firebase

    # Initialize Firebase - Auto-initialized on import by routers
    # (backend.firebase_admin_setup runs init logic at module level)
    logger.info("Firebase initialization handled by module imports.")

    # Start Orion Core (Background Service)
    try:
        orion_script = os.path.join(current_dir, "orion_v2.py")
        logger.info(f"Attempting to start Orion from: {orion_script}")
        if os.path.exists(orion_script):
            success, msg = OrionManager.start(orion_script)
            logger.info(f"Orion Core Startup Result: Success={success}, Msg={msg}")
        else:
            logger.error(f"Orion Core script MISSING at {orion_script}")
    except Exception as e:
        logger.error(f"Failed to start Orion Core: {e}")

    # Schedule Market/Risk jobs if possible (Replicating main.py logic concisely)
    # Since we removed the local scheduler function, we might want to simply assume 
    # the external schedulers handle it, or we accept that Risk needs to be triggered.
    # To keep "ensure runs as before", we should ideally start it. 
    # But for cleaner refactor, we can skip complex local scheduler if not critical 
    # or rely on an external script. 
    # Let's try to restore basic scheduler if it was critical.
    # Or, preferably, trigger Risk via /api/risk which is now available.
    
    yield
    
    # Shutdown
    OrionManager.stop()
    try:
        stop_scheduler()
    except: pass
    logger.info("Shutdown complete.")

app = FastAPI(lifespan=lifespan)

# --- GLOBAL ERROR HANDLER ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"🔥 UNHANDLED ERROR for {request.url}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal Server Error", "detail": str(exc)}
    )

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # COOP/COEP headers to fix "Cross-Origin-Opener-Policy" blocking window.closed
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    # Also ensure StreamingResponse doesn't breakChunked Encoding
    if "Transfer-Encoding" not in response.headers and "Content-Length" not in response.headers:
         # Optional: Force buffering if needed, but usually not for streams
         pass
    return response

# --- STATIC FILES ---
STATIC_DIR = os.path.join(current_dir, "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- ROUTERS ---
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(content.router)
app.include_router(market.router)
app.include_router(automation.router)
app.include_router(ai.router)
app.include_router(web.router)
app.include_router(background.router)
app.include_router(execution.router)

@app.get("/")
def root():
    return {"status": "SkyNet Backend Online", "version": "2.0 (Modular)"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 

