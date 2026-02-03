from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio
import logging
from backend.config import settings

# Robust Imports
logger = logging.getLogger("uvicorn")

# Lazy import helper to avoid circular dependencies or startup crashes
def get_command_module(module_name):
    try:
        if module_name == "risk":
            from backend.integration import risk_command
            return risk_command
        elif module_name == "performance":
            from backend.integration import performance_stream_command
            return performance_stream_command
        elif module_name == "automation":
            from backend.integration import automation_command
            return automation_command
        elif module_name == "strategy":
            from backend.integration import strategy_ranking
            return strategy_ranking
    except ImportError as e:
        logger.error(f"Failed to import {module_name} module: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error importing {module_name}: {e}")
        return None

SCHEDULER = None

def run_async_job(name, coroutine_func, *args):
    """Helper to run async jobs in the scheduler."""
    logger.info(f"Running scheduled job: {name}")
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        if args:
            loop.run_until_complete(coroutine_func(*args))
        else:
            loop.run_until_complete(coroutine_func())
        loop.close()
    except Exception as e:
        logger.error(f"Scheduler Error ({name}): {e}")

def start_scheduler():
    global SCHEDULER
    if not settings.ENABLE_SCHEDULER:
        logger.info("Scheduler disabled via config.")
        return

    if SCHEDULER is None:
        SCHEDULER = BackgroundScheduler()
        logger.info("Initializing Global Scheduler...")

        # 1. Risk Job
        risk_mod = get_command_module("risk")
        if risk_mod:
            SCHEDULER.add_job(
                run_async_job,
                CronTrigger(minute=f'*/{settings.RISK_UPDATE_INTERVAL_MINUTES}'),
                args=["Risk Command", risk_mod.handle_risk_command, [], {"assessment_type": "scheduled"}]
            )

        # 2. Performance Stream Job
        perf_mod = get_command_module("performance")
        if perf_mod:
            SCHEDULER.add_job(
                run_async_job,
                CronTrigger(minute=f'*/{settings.PERFORMANCE_UPDATE_INTERVAL_MINUTES}'),
                args=["Performance Stream", perf_mod.update_heatmap_cache]
            )

        # 3. Automation Job
        auto_mod = get_command_module("automation")
        if auto_mod:
            # Note: Automation runs frequently, e.g. every minute
            SCHEDULER.add_job(
                run_async_job,
                CronTrigger(minute='*'), # Every minute
                args=["Automation Check", auto_mod.run_automations]
            )

        # 4. Strategy Ranking Job (Execution/Rebalancing)
        strat_mod = get_command_module("strategy")
        if strat_mod:
            # 4a. Execution Job
            SCHEDULER.add_job(
                run_async_job,
                CronTrigger(minute=f'*/{settings.PERFORMANCE_UPDATE_INTERVAL_MINUTES}'),
                args=["Strategy Ranking (Exec)", strat_mod.check_and_update_rankings]
            )
            
            # 4b. PnL Update Job (Valuation Only)
            SCHEDULER.add_job(
                run_async_job,
                CronTrigger(minute=f'*/{settings.STRATEGY_PNL_UPDATE_INTERVAL_MINUTES}'),
                args=["Strategy PnL Update", strat_mod.update_valuations_only]
            )

        SCHEDULER.start()
        logger.info("Global Scheduler started successfully.")

def stop_scheduler():
    global SCHEDULER
    if SCHEDULER:
        SCHEDULER.shutdown()
        SCHEDULER = None
        logger.info("Global Scheduler stopped.")
