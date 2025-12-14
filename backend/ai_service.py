import requests
import json
import logging
import asyncio
import os
import configparser

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
AI_PROVIDER = "LOCAL" # Options: LOCAL, GEMINI
LOCAL_AI_URL = "http://localhost:11434/api/generate"
# Use a higher-performance boolean flag for JSON mode if supported by the model/provider, 
# otherwise we prompt-engineer for it.

# Try to load config
try:
    config = configparser.ConfigParser()
    config_path = os.path.join(os.path.dirname(__file__), 'config.ini')
    if not os.path.exists(config_path):
        config_path = 'config.ini'
    config.read(config_path)
    
    # Load settings if they exist, otherwise defaults
    if 'AI_SETTINGS' in config:
        AI_PROVIDER = config['AI_SETTINGS'].get('PROVIDER', AI_PROVIDER)
        LOCAL_AI_URL = config['AI_SETTINGS'].get('LOCAL_URL', LOCAL_AI_URL)

except Exception:
    pass # Use defaults

class AIService:
    def __init__(self, provider=AI_PROVIDER, local_url=LOCAL_AI_URL, model="llama3"):
        self.provider = provider
        self.local_url = local_url
        self.model = model
        self.lock = asyncio.Lock()

    async def check_connection(self):
        """Checks if the local AI service is reachable."""
        if self.provider != "LOCAL":
            return True
            
        try:
            # Ollama specific check (getting version or listing tags)
            # A simple GET to the base URL or /api/tags usually works
            resp = await asyncio.to_thread(requests.get, self.local_url.replace("/generate", "/tags"), timeout=2)
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"Local AI Connection Failed: {e}")
            return False

    async def generate_content(self, prompt: str, system_instruction: str = None, json_mode: bool = False) -> str:
        """
        Generates content using the configured AI provider.
        
        Args:
            prompt: The user prompt.
            system_instruction: Optional system prompt/context.
            json_mode: If True, tries to force JSON output (Ollama supports format='json').
        """
        async with self.lock:
            if self.provider == "LOCAL":
                return await self._generate_local(prompt, system_instruction, json_mode)
            else:
                return "Gemini Not Implemented via AI Service yet."

    async def _detect_model(self):
        """Attempts to detect the best available model on the local instance."""
        try:
            tags_url = self.local_url.replace("/generate", "/tags")
            resp = await asyncio.to_thread(requests.get, tags_url, timeout=2)
            if resp.status_code == 200:
                models_data = resp.json()
                models = [m['name'] for m in models_data.get('models', [])]
                if not models:
                    logger.warning("No models found in Ollama.")
                    return "llama3" # Default fallback
                
                # Preference list
                for pref in ["llama3", "llama3:latest", "llama2", "mistral", "phi3"]:
                    if any(pref in m for m in models):
                        best = next(m for m in models if pref in m)
                        logger.info(f"Auto-selected model: {best}")
                        return best
                
                # If no preferences match, pick the first one
                return models[0]
        except Exception as e:
            logger.warning(f"Model detection failed: {e}")
            return "llama3"

    async def _generate_local(self, prompt: str, system_instruction: str, json_mode: bool) -> str:
        # Auto-detect model on first run if strictly not set/verified
        # For now, let's just use the configured one, but if it fails with 404, we could retry with detection.
        # Actually, let's just detecting once at startup would be better but self.model is passed in init.
        
        # Let's try to be robust:
        # If the request fails significantly, we might want to know why.
        
        full_prompt = prompt
        if system_instruction:
            full_prompt = f"System: {system_instruction}\n\nUser: {prompt}"

        payload = {
            "model": self.model,
            "prompt": full_prompt,
            "stream": False,
        }
        
        if json_mode:
            payload["format"] = "json"

        import time
        start_time = time.time()
        prompt_len = len(full_prompt)
        logger.info(f"   [Sentinel AI] Requesting generation... Model: {self.model} | Prompt Len: {prompt_len} chars")

        try:
            # logger.info(f"Sending request to Local AI ({self.model})...") 
            response = await asyncio.to_thread(
                requests.post, 
                self.local_url, 
                json=payload, 
                timeout=300 # Increased to 5 minutes for slow local hardware
            )
            
            # If 404, model likely not found.
            if response.status_code == 404:
                logger.warning(f"   [Sentinel AI] Model '{self.model}' not found (404). Auto-detecting...")
                new_model = await self._detect_model()
                if new_model != self.model:
                    self.model = new_model
                    payload["model"] = self.model
                    
                    logger.info(f"   [Sentinel AI] Retrying with model: {self.model}")
                    response = await asyncio.to_thread(requests.post, self.local_url, json=payload, timeout=300)

            duration = time.time() - start_time
            logger.info(f"   [Sentinel AI] Response received in {duration:.2f}s. Status: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"   [Sentinel AI] Error Response: {response.text}")
                response.raise_for_status()
            
            data = response.json()
            return data.get("response", "")
            
        except Exception as e:
            logger.error(f"   [Sentinel AI] Generation Failed: {e}")
            return ""

# Singleton Instance
ai = AIService()
