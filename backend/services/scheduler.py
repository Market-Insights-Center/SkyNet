from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio
import logging

# Import commands
try:
    from backend.integration import (
        risk_command, performance_stream_command, automation_command, strategy_ranking
    )
except ImportError:
    try:
        from integration import (
            risk_command, performance_stream_command, automation_command, strategy_ranking
        )
    except: pass

logger = logging.getLogger("uvicorn")
SCHEDULER = None

def start_scheduler():
    global SCHEDULER
    if SCHEDULER is None:
        SCHEDULER = BackgroundScheduler()
        
        # 1. Risk Job
        def run_risk_job():
            logger.info("Running scheduled Risk Command...")
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(risk_command.handle_risk_command([], ai_params={"assessment_type": "scheduled"}))
                loop.close()
            except Exception as e:
                logger.error(f"Scheduler Error (Risk): {e}")

        SCHEDULER.add_job(run_risk_job, CronTrigger(minute='*/15'))
        
        # 2. Performance Stream Job
        def run_performance_stream_job():
            logger.info("Running scheduled Performance Stream Update...")
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(performance_stream_command.update_heatmap_cache())
                loop.close()
            except Exception as e:
                logger.error(f"Scheduler Error (Performance): {e}")
                
        SCHEDULER.add_job(run_performance_stream_job, CronTrigger(minute='*/15'))

        # 3. Automation Job
        def run_automation_job():
            logger.info("Running scheduled Automation Check...")
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                if automation_command:
                    loop.run_until_complete(automation_command.run_automations())
                loop.close()
            except Exception as e:
                logger.error(f"Scheduler Error (Automation): {e}")

        SCHEDULER.add_job(run_automation_job, CronTrigger(minute='*/15'))

        # 4. Strategy Ranking Job
        def run_strategy_ranking_job():
             logger.info("Running scheduled Strategy Ranking Update...")
             try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(strategy_ranking.check_and_update_rankings())
                loop.close()
             except Exception as e:
                logger.error(f"Scheduler Error (Strategy): {e}")
        
        SCHEDULER.add_job(run_strategy_ranking_job, CronTrigger(minute='*/15'))

        SCHEDULER.start()
        logger.info("Global Scheduler started.")

def stop_scheduler():
    global SCHEDULER
    if SCHEDULER:
        SCHEDULER.shutdown()
        SCHEDULER = None
        logger.info("Global Scheduler stopped.")
