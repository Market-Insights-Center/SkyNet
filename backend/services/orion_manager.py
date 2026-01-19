import subprocess
import logging
import sys
import os

logger = logging.getLogger("backend.orion")

class OrionManager:
    _process = None

    @classmethod
    def start(cls, script_path):
        if cls._process and cls._process.poll() is None:
            return False, "Orion is already active."
        
        try:
            cls._process = subprocess.Popen([sys.executable, script_path])
            logger.info(f"Orion launched with PID: {cls._process.pid}")
            return True, cls._process.pid
        except Exception as e:
            logger.error(f"Failed to start Orion: {e}")
            return False, str(e)

    @classmethod
    def stop(cls):
        if cls._process:
            try:
                cls._process.terminate()
                cls._process = None
                return True, "stopped"
            except Exception as e:
                logger.error(f"Error stopping Orion: {e}")
                try:
                    cls._process.kill()
                    cls._process = None
                except: pass
                return True, "stopped_forced"
        return False, "not_running"

    @classmethod
    def is_running(cls):
        return cls._process and cls._process.poll() is None
