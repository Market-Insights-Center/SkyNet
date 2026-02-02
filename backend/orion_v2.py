import cv2
import mediapipe as mp
import math
import time
import threading
import speech_recognition as sr
import pyttsx3
import asyncio
import websockets
import json
import numpy as np
from collections import deque
from ctypes import cast, POINTER
import webbrowser
import sys
import os

# --- LOGGING DEBUG OVERRIDE ---
sys.stdout = open(os.path.join(os.path.dirname(__file__), 'orion_internal.log'), 'a', encoding='utf-8')
sys.stderr = sys.stdout
print(f"[{time.ctime()}] ORION V2 RESTARTED (PID: {os.getpid()})")

# --- DEFENSIVE IMPORTS ---
try:
    import pyautogui
    pyautogui.FAILSAFE = False
except Exception as e:
    print(f"Warning: PyAutoGUI initialization failed ({e}). Running in Headless Mode.")
    class DummyPyAutoGUI:
        def size(self): return 1920, 1080
        def scroll(self, *args): pass
        def moveTo(self, *args, **kwargs): pass
        def click(self, *args, **kwargs): pass
        def rightClick(self, *args, **kwargs): pass
        def doubleClick(self, *args, **kwargs): pass
        def mouseDown(self, *args, **kwargs): pass
        def mouseUp(self, *args, **kwargs): pass
        def write(self, *args, **kwargs): pass
        def hotkey(self, *args, **kwargs): pass
    pyautogui = DummyPyAutoGUI()

try:
    import mediapipe as mp
except Exception as e:
    print(f"Warning: MediaPipe missing ({e}). Vision disabled.")
    mp = None

try:
    import cv2
except Exception as e:
    print(f"Warning: OpenCV missing ({e}). Vision disabled.")
    cv2 = None


# --- OS COMPATIBILITY FIX ---
try:
    from comtypes import CLSCTX_ALL
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
except (ImportError, OSError):
    # Dummy classes for Linux/Non-Windows
    CLSCTX_ALL = None
    AudioUtilities = None
    IAudioEndpointVolume = None


# --- CONFIGURATION ---
PINCH_THRESHOLD = 0.04
PINKY_THRESHOLD = 0.05
DOUBLE_CLICK_TIME = 0.5
WS_PORT = 8001
SMOOTHING_FACTOR = 5  
GESTURE_CONFIDENCE_FRAMES = 3 

pyautogui.FAILSAFE = False

class OrionV2Controller:
    def __init__(self):
        self.is_running = True
        self.mode = "IDLE" 
        self.connected_clients = set()
        self.loop = None
        
        # System Info
        try:
            self.screen_w, self.screen_h = pyautogui.size()
        except:
            print("Warning: Failed to get screen size (Headless/Linux?). Defaulting to 1920x1080.")
            self.screen_w, self.screen_h = 1920, 1080
            self.screen_w = 1920
            self.screen_h = 1080
            
        self.start_time = time.time()

        # Cursor Smoothing
        self.cursor_history_x = deque(maxlen=SMOOTHING_FACTOR)
        self.cursor_history_y = deque(maxlen=SMOOTHING_FACTOR)

        # State Variables
        self.sensitivity_level = 2 
        self.is_pinching = False
        self.pinch_start_time = 0
        self.last_pinch_release_time = 0
        self.is_right_clicking = False
        self.sidebar_visible = False 
        
        # Left Hand States
        self.is_diction_mode = False
        self.is_delete_mode = False
        self.is_freeze_mode = False
        self.last_delete_time = 0
        self.last_sensitivity_change = 0
        self.sensitivity_cooldown = 0.5
        
        # Debouncing Counters
        self.gesture_counters = {
            "scroll_up": 0,
            "scroll_down": 0,
            "right_click": 0,
            "back": 0,
            "diction": 0,
            "delete": 0,
            "freeze": 0,
            "sidebar_toggle": 0,
            "rock_on": 0,
            "triangle": 0
        }
        self.sidebar_toggle_cooldown = 0
        self.last_scroll_time = 0
        self.scroll_cooldown = 0.1
        self.last_nav_time = 0
        self.nav_cooldown = 1.0

        # MediaPipe
        self.hands = None
        self.mp_draw = None
        
        if mp:
            try:
                self.mp_hands = mp.solutions.hands
                self.hands = self.mp_hands.Hands(
                    max_num_hands=2,
                    min_detection_confidence=0.7,
                    min_tracking_confidence=0.7
                )
                self.mp_draw = mp.solutions.drawing_utils
            except Exception as e:
                print(f"MediaPipe Init Error: {e}. Vision disabled.")


        # Audio / TTS
        try:
            self.tts_engine = pyttsx3.init()
            self.tts_engine.setProperty('rate', 160)
        except:
            self.tts_engine = None

        self.recognizer = sr.Recognizer()
        # Voice Settings - increased sensitivity
        self.recognizer.energy_threshold = 300 
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8
        
        self.mic = None
        self.ears_active = False
        self.eyes_active = False

    def initialize_microphone(self):
        # --- AUTO-SELECT MICROPHONE ---
        mic_index = None
        try:
            print("Scanning Microphones...")
            for i, name in enumerate(sr.Microphone.list_microphone_names()):
                print(f"[{i}] {name}")
                if "Microphone Array" in name or "USB" in name:
                    mic_index = i
                    print(f"--> SELECTED: {name}")
                    break
        except Exception as e:
            print(f"Mic Scan Error: {e}")

        if mic_index is not None:
             self.mic = sr.Microphone(device_index=mic_index)
        else:
             self.mic = sr.Microphone()
        
        # Calibration
        try:
            with self.mic as source:
                print("Calibrating microphone...")
                self.recognizer.adjust_for_ambient_noise(source, duration=1.0)
                print("Microphone calibrated.")
        except Exception as e:
            print(f"Mic Error: {e}")

    # --- UTILS ---
    def speak(self, text):
        print(f"Orion: {text}")
        if self.tts_engine:
            threading.Thread(target=self._speak_thread, args=(text,), daemon=True).start()

    def _speak_thread(self, text):
        try:
            engine = pyttsx3.init()
            engine.say(text)
            engine.runAndWait()
        except: pass

    def broadcast_log(self, message, type="SYSTEM"):
        if not self.loop: return
        data = json.dumps({"action": "LOG", "log": message, "type": type})
        try:
            asyncio.run_coroutine_threadsafe(self._send_all(data), self.loop)
        except: pass

    def broadcast_command(self, action, payload=None):
        if not self.loop: return
        data = json.dumps({"action": action, "payload": payload})
        try:
            asyncio.run_coroutine_threadsafe(self._send_all(data), self.loop)
        except: pass
        
    async def _send_all(self, message):
        if self.connected_clients:
            await asyncio.gather(*[client.send(message) for client in self.connected_clients])

    def calculate_distance(self, p1, p2):
        return math.hypot(p1.x - p2.x, p1.y - p2.y)

    def get_sensitivity_margin(self):
        if self.sensitivity_level == 1: return 0.15, 0.85
        if self.sensitivity_level == 2: return 0.25, 0.75
        if self.sensitivity_level == 3: return 0.35, 0.65
        return 0.2, 0.8

    # --- GESTURE LOGIC ---
    def process_hands(self, results):
        # Startup Grace Period to prevent hallucinated gestures on init
        if time.time() - self.start_time < 5.0:
            return

        if not results.multi_hand_landmarks: return

        right_hand = None
        left_hand = None
        
        for i, hand_landmarks in enumerate(results.multi_hand_landmarks):
            label = results.multi_handedness[i].classification[0].label
            if label == "Right": right_hand = hand_landmarks
            if label == "Left": left_hand = hand_landmarks

        if left_hand and right_hand:
            # --- 00. TRIANGLE TERMINATE (Both Hands) ---
            # Index Tips (8) touching, Thumb Tips (4) touching
            l_lms = left_hand.landmark
            r_lms = right_hand.landmark

            dist_index = math.hypot(l_lms[8].x - r_lms[8].x, l_lms[8].y - r_lms[8].y)
            dist_thumb = math.hypot(l_lms[4].x - r_lms[4].x, l_lms[4].y - r_lms[4].y)
            
            # Thresholds for "touching"
            if dist_index < 0.05 and dist_thumb < 0.05:
                 self.gesture_counters["triangle"] = self.gesture_counters.get("triangle", 0) + 1
                 if self.gesture_counters["triangle"] > 15: # ~0.5 - 1s hold
                      self.speak("Terminating Orion")
                      self.initiate_shutdown("Gesture: Triangle")
            else:
                 self.gesture_counters["triangle"] = 0

        if left_hand: self.process_left_hand(left_hand)
        
        # Only process right hand if not in Freeze mode
        if right_hand and not self.is_freeze_mode:
             self.process_right_hand(right_hand)

    def process_right_hand(self, landmarks):
        lms = landmarks.landmark
        current_time = time.time()
        
        # --- 0. TOGGLE SIDEBAR: "SHAKA" (Thumb + Pinky Out) ---
        # Thumb(4) & Pinky(20) extended. 
        # Relaxed check: Simply checking if Pinky is extended (Tip above PIP joint)
        # And Thumb is extended (Tip to left of IP joint for right hand)
        is_pinky_high = lms[20].y < lms[18].y
        is_thumb_out = lms[4].x < lms[3].x 
        
        # Debugging Gesture
        # if current_time - self.last_nav_time > 2.0:
        #    print(f"Pinky: {lms[20].y:.3f} < {lms[18].y:.3f} ({is_pinky_high}) | Thumb: {lms[4].x:.3f} < {lms[3].x:.3f} ({is_thumb_out})")

        if is_pinky_high and is_thumb_out:
             if current_time - self.sidebar_toggle_cooldown > 1.5:
                self.gesture_counters["sidebar_toggle"] += 1
                if self.gesture_counters["sidebar_toggle"] > 3: 
                    self.sidebar_visible = not self.sidebar_visible
                    cmd = "OPEN_SIDEBAR" if self.sidebar_visible else "CLOSE_SIDEBAR"
                    self.broadcast_command(cmd)
                    self.speak("Sidebar Toggle")
                    self.sidebar_toggle_cooldown = current_time
                    self.gesture_counters["sidebar_toggle"] = 0
                    return
        else: self.gesture_counters["sidebar_toggle"] = 0

        # --- 1. SCROLL UP ---
        if lms[8].y < lms[6].y and lms[12].y < lms[10].y and lms[16].y > lms[14].y:
            self.gesture_counters["scroll_up"] += 1
            if self.gesture_counters["scroll_up"] > GESTURE_CONFIDENCE_FRAMES:
                if current_time - self.last_scroll_time > self.scroll_cooldown:
                    pyautogui.scroll(100)
                    self.last_scroll_time = current_time
                return 
        else: self.gesture_counters["scroll_up"] = 0

        # --- 2. SCROLL DOWN ---
        if lms[8].y > lms[6].y and lms[12].y > lms[10].y:
            self.gesture_counters["scroll_down"] += 1
            if self.gesture_counters["scroll_down"] > GESTURE_CONFIDENCE_FRAMES:
                 if current_time - self.last_scroll_time > self.scroll_cooldown:
                    pyautogui.scroll(-100) 
                    self.last_scroll_time = current_time
                 return
        else: self.gesture_counters["scroll_down"] = 0

        # --- 3. CURSOR & CLICK ---
        dist_pinch = self.calculate_distance(lms[8], lms[4])
        is_pinching_now = dist_pinch < PINCH_THRESHOLD
        
        index_up = lms[8].y < lms[6].y
        should_move_cursor = index_up or is_pinching_now

        if should_move_cursor:
            raw_x = lms[8].x
            raw_y = lms[8].y
            min_bound, max_bound = self.get_sensitivity_margin()
            target_x = np.interp(raw_x, [min_bound, max_bound], [0, self.screen_w])
            target_y = np.interp(raw_y, [min_bound, max_bound], [0, self.screen_h])
            
            self.cursor_history_x.append(target_x)
            self.cursor_history_y.append(target_y)
            avg_x = sum(self.cursor_history_x) / len(self.cursor_history_x)
            avg_y = sum(self.cursor_history_y) / len(self.cursor_history_y)
            
            pyautogui.moveTo(avg_x, avg_y, duration=0)

        if is_pinching_now and not self.is_pinching:
            self.is_pinching = True
            self.pinch_start_time = time.time()
            pyautogui.mouseDown()
        elif not is_pinching_now and self.is_pinching:
            self.is_pinching = False
            pyautogui.mouseUp()
            if (time.time() - self.pinch_start_time) < 1.0: 
                if (time.time() - self.last_pinch_release_time) < DOUBLE_CLICK_TIME:
                    pyautogui.doubleClick()
            self.last_pinch_release_time = time.time()

        # RIGHT CLICK (Pinky + Thumb)
        dist_pinky_pinch = self.calculate_distance(lms[20], lms[4])
        if dist_pinky_pinch < PINKY_THRESHOLD:
            self.gesture_counters["right_click"] += 1
            if self.gesture_counters["right_click"] > 5 and not self.is_right_clicking:
                self.is_right_clicking = True
                pyautogui.rightClick()
        else:
            self.gesture_counters["right_click"] = 0
            self.is_right_clicking = False

        # --- 4. BACK (L Shape) ---
        # REMOVED PER USER REQUEST



    def process_left_hand(self, landmarks):
        lms = landmarks.landmark
        current_time = time.time()
        
        # 1. FREEZE / CONTROLS: "OPEN PALM" (All 5 Fingers Up)
        all_fingers_up = all(lms[i].y < lms[i-2].y for i in [8,12,16,20]) and lms[4].y < lms[3].y
        
        if all_fingers_up:
            self.gesture_counters["freeze"] += 1
            if self.gesture_counters["freeze"] > 8: 
                if not self.is_freeze_mode:
                    self.is_freeze_mode = True
                    self.broadcast_command("OPEN_CONTROLS")
                    # self.speak("Controls Open")
        else:
            self.gesture_counters["freeze"] = 0
            if self.is_freeze_mode:
                self.is_freeze_mode = False
                self.broadcast_command("CLOSE_CONTROLS")
                # self.speak("Controls Closed")

        if self.is_freeze_mode: return

        # 2. TERMINATE Replaced by Triangle Gesture
        pass

        # 3. DELETE MODE (3 Fingers: Index, Mid, Ring)
        # Pinky Down.
        if lms[8].y < lms[6].y and lms[12].y < lms[10].y and lms[16].y < lms[14].y and lms[20].y > lms[18].y:
             self.gesture_counters["delete"] += 1
             if self.gesture_counters["delete"] > 5:
                 self.is_delete_mode = True
                 if current_time - self.last_delete_time > 1.0:
                     pyautogui.hotkey('ctrl', 'backspace')
                     self.last_delete_time = current_time
        else:
             self.gesture_counters["delete"] = 0
             self.is_delete_mode = False

        # 4. DICTION MODE (2 Fingers: Index, Mid)
        # Ring/Pinky Down.
        if lms[8].y < lms[6].y and lms[12].y < lms[10].y and lms[16].y > lms[14].y:
             self.gesture_counters["diction"] += 1
             if self.gesture_counters["diction"] > 5:
                 if not self.is_diction_mode:
                     self.is_diction_mode = True
                     self.speak("Diction On")
        else:
             self.gesture_counters["diction"] = 0
             if self.is_diction_mode:
                 self.is_diction_mode = False
        
        # 5. RESET MOUSE (Closed Fist)
        if all(lms[i].y > lms[i-2].y for i in [8,12,16,20]):
             if current_time - self.last_nav_time > 2.0:
                 pyautogui.moveTo(self.screen_w // 2, self.screen_h // 2)
                 self.last_nav_time = current_time

        # 6. SENSITIVITY CYCLE (Middle + Thumb Pinch)
        dist_sens = self.calculate_distance(lms[12], lms[4])
        if dist_sens < PINCH_THRESHOLD:
            if current_time - self.last_sensitivity_change > self.sensitivity_cooldown:
                self.sensitivity_level = (self.sensitivity_level % 3) + 1
                self.speak(f"Sensitivity {self.sensitivity_level}")
                self.last_sensitivity_change = current_time

        # 7. OPEN TRADINGVIEW (Thumb + Pinky Out)
        # Check: Index is DOWN (differentiates from Rock On)
        if lms[4].y < lms[3].y and lms[20].y < lms[18].y:
            if lms[8].y > lms[6].y and lms[12].y > lms[10].y: # Index/Mid Down
                 if current_time - self.last_nav_time > 3.0:
                     webbrowser.open("https://www.tradingview.com/chart")
                     self.speak("Supercharts")
                     self.last_nav_time = current_time


    # --- VOICE LOGIC ---
    def listen_loop(self):
        print("[EARS] Loop Started (Waiting for activation)")
        while self.is_running:
            if not self.ears_active:
                time.sleep(1)
                continue

            if not self.mic:
                self.initialize_microphone()
                print("[EARS] Active")

            try:
                # Use shorter timeout/phrase limits to prevent blocking
                with self.mic as source:
                    # Listening...
                    try:
                        audio = self.recognizer.listen(source, timeout=2, phrase_time_limit=4)
                    except sr.WaitTimeoutError:
                        continue # Just loop back
                
                try:
                    text = self.recognizer.recognize_google(audio).lower()
                    self.process_voice(text)
                except sr.UnknownValueError:
                    pass 
                except Exception as e:
                    print(f"Voice Rec Error: {e}")
            except Exception as e:
                time.sleep(0.5)
                continue

    def process_voice(self, text):
        if not self.is_running: return
        
        # --- FEEDBACK: Tell Frontend what we heard ---
        self.broadcast_command("VOICE_HEARD", text)

        # DICTION MODE: Type EVERYTHING
        if self.is_diction_mode:
            # Check for exit command inside diction
            if "stop diction" in text or "disable diction" in text:
                 self.is_diction_mode = False
                 self.speak("Diction Off")
                 return
            
            print(f"Typing: {text}")
            pyautogui.write(text + " ")
            self.broadcast_log(f'Typing: "{text}"', "VOICE")
            return

        # COMMANDS
        print(f" -> Heard: '{text}'")

        if "shutdown" in text:
            self.initiate_shutdown("Voice: Shutdown")
            return

        if "open chart" in text:
            self.handle_open_chart(text)
            return

        # Explicit voice toggles
        if "start diction" in text or "enable diction" in text:
            self.is_diction_mode = True
            self.speak("Diction On")
            return
        
        if "stop diction" in text or "disable diction" in text:
            self.is_diction_mode = False
            self.speak("Diction Off")
            return

        # Navigation
        if "go to" in text:
            self.handle_nav(text)
            return

    def handle_open_chart(self, text):
        parts = text.split("open chart")
        if len(parts) > 1:
            ticker = parts[1].strip().upper().replace(" ", "")
            if ticker:
                self.speak(f"Opening {ticker}")
                webbrowser.open(f"https://www.tradingview.com/chart?symbol={ticker}")
                self.broadcast_log(f"Opened Chart: {ticker}", "VOICE")

    def handle_nav(self, text):
        pages = {
            "dashboard": "/dashboard",
            "news": "/news",
            "ideas": "/ideas",
            "profile": "/profile",
            "quickscore": "/asset-evaluator",
            "breakout": "/products/comparison-matrix",
            "cultivate": "/cultivate",
            "custom": "/custom",
            "invest": "/invest",
            "tracking": "/tracking",
            "market": "/market-nexus",
            "risk": "/market-nexus?tab=risk",
            "history": "/market-nexus?tab=history",
            "briefing": "/market-nexus?tab=briefing",
            "history": "/market-nexus?tab=history",
            "briefing": "/market-nexus?tab=briefing",
            "fundamentals": "/asset-evaluator?tab=fundamentals",
            "sentiment": "/asset-evaluator?tab=sentiment",
            "powerscore": "/asset-evaluator?tab=powerscore"
        }
        for keyword, route in pages.items():
            if keyword in text:
                self.speak(f"Navigating to {keyword}")
                self.broadcast_command("NAVIGATE", route)
                return

    # --- LIFECYCLE ---
    def initiate_shutdown(self, source):
        self.speak(f"Shutdown by {source}")
        self.broadcast_command("TERMINATE", source)
        self.is_running = False

    def start_camera_and_processing(self):
        """Standard Webcam Loop (Eyes) with robust connection"""
        if not cv2 or not self.hands:
            print("Vision dependencies missing. Loop aborted.")
            self.broadcast_command("VISION_STATUS", {"status": "ERROR", "message": "Dependencies Missing"})
            return

        print("Starting Vision Loop...")
        self.broadcast_command("VISION_STATUS", {"status": "STARTING"})
        
        cap = None
        selected_index = -1
        
        # Try indices 0, 1, 2
        for i in range(3):
            try:
                temp_cap = cv2.VideoCapture(i, cv2.CAP_DSHOW) if sys.platform == 'win32' else cv2.VideoCapture(i)
                if temp_cap.isOpened():
                    # Quick read test
                    ret, _ = temp_cap.read()
                    if ret:
                        cap = temp_cap
                        selected_index = i
                        print(f"Camera found at index {i}")
                        break
                    else:
                        temp_cap.release()
            except: pass
            
        if not cap or not cap.isOpened():
             print("Camera not found on indices 0-2.")
             self.broadcast_command("VISION_STATUS", {"status": "ERROR", "message": "No Camera Found"})
             self.speak("Camera failure")
             return

        self.broadcast_command("VISION_STATUS", {"status": "ACTIVE", "index": selected_index})
        self.speak(f"Vision Online Camera {selected_index}")

        # No NamedWindow on Headless
        
        try:
            with self.mp_hands.Hands(
                max_num_hands=1,
                model_complexity=0,
                min_detection_confidence=0.7,
                min_tracking_confidence=0.7) as hands:
                
                while self.is_running and self.eyes_active and cap.isOpened():
                    success, image = cap.read()
                    if not success:
                        self.broadcast_command("VISION_STATUS", {"status": "ERROR", "message": "Frame Drop"})
                        time.sleep(0.1)
                        continue

                    # Process for gestures
                    image = cv2.flip(image, 1)
                    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    results = hands.process(image_rgb)
                    
                    if results.multi_hand_landmarks:
                        self.process_hands(results)
                    
                    # No imshow() on headless
                    time.sleep(0.01) # Yield slightly

        except Exception as e:
            print(f"Vision Loop Error: {e}")
            self.broadcast_command("VISION_STATUS", {"status": "ERROR", "message": str(e)})
        finally:
            if cap: cap.release()
            self.broadcast_command("VISION_STATUS", {"status": "INACTIVE"})


    async def main_async(self):
        self.loop = asyncio.get_running_loop()
        t_ears = threading.Thread(target=self.listen_loop, daemon=True)
        # Vision is now started on demand
        # t_eyes = threading.Thread(target=self.start_camera_and_processing, daemon=True)
        
        t_ears.start()
        # t_eyes.start()

        print(f"\n=== ORION V2 LISTENING ON {WS_PORT} ===")
        async with websockets.serve(self.ws_handler, "0.0.0.0", WS_PORT):
            while self.is_running:
                await asyncio.sleep(1)

    async def ws_handler(self, websocket):
        self.connected_clients.add(websocket)
        # Broadcast Status on Connect
        try:
            v_stat = "ACTIVE" if self.eyes_active else "INACTIVE"
            a_stat = "ACTIVE" if self.ears_active else "INACTIVE"
            await websocket.send(json.dumps({"action": "VISION_STATUS", "payload": {"status": v_stat}}))
            await websocket.send(json.dumps({"action": "AUDIO_STATUS", "payload": {"status": a_stat}}))
        except: pass
        try:
            async for message in websocket: 
                try:
                    data = json.loads(message)
                    action = data.get("action")
                    
                    if action == "STOP":
                        self.initiate_shutdown("Frontend Button")
                    elif action == "START_VISION":
                        if not hasattr(self, 'vision_thread') or not self.vision_thread.is_alive():
                            self.eyes_active = True
                            self.vision_thread = threading.Thread(target=self.start_camera_and_processing, daemon=True)
                            self.vision_thread.start()
                            # Status handled in thread
                    elif action == "STOP_VISION":
                        self.eyes_active = False 
                        self.speak("Vision System Offline")
                        self.broadcast_command("VISION_STATUS", {"status": "INACTIVE"})
                    elif action == "START_EARS":
                        self.ears_active = True
                        self.speak("Ears Active")
                        self.broadcast_command("AUDIO_STATUS", {"status": "ACTIVE"})
                    elif action == "STOP_EARS":
                        self.ears_active = False
                        self.speak("Ears Sleeping")
                        self.broadcast_command("AUDIO_STATUS", {"status": "INACTIVE"})
                        
                except: pass
        except: pass
        finally: self.connected_clients.remove(websocket)

if __name__ == "__main__":
    controller = OrionV2Controller()
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(controller.main_async())
    except KeyboardInterrupt:
        pass