
import cv2
import mediapipe as mp
import math
import time
import threading
import speech_recognition as sr
import pyttsx3
import queue
import sys
import asyncio
import websockets
import json
import pyautogui
import numpy as np
from ctypes import cast, POINTER
from comtypes import CLSCTX_ALL
from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
import webbrowser
import screeninfo

# --- CONFIGURATION ---
PINCH_THRESHOLD = 0.04
PINKY_THRESHOLD = 0.06
DOUBLE_CLICK_TIME = 0.4
CLICK_DURATION = 0.3
RESET_HOLD_TIME = 1.0
WS_PORT = 8001
DEFAULT_SENSITIVITY = 2.0
pyautogui.FAILSAFE = False

class SkyNetV2Controller:
    def __init__(self):
        self.is_running = True
        self.mode = "IDLE"  # IDLE, LISTENING_TICKER, DICTION
        self.connected_clients = set()
        self.loop = None
        
        # System Info
        try:
            self.screen_h = pyautogui.size().height
            self.screen_w = pyautogui.size().width
        except:
            self.screen_w = 1920
            self.screen_h = 1080

        # Gesture State
        self.sensitivity = DEFAULT_SENSITIVITY # Levels: 1, 2, 3
        self.is_pinching = False
        self.pinch_start_time = 0
        self.last_pinch_release_time = 0
        self.is_right_clicking = False
        
        # Scroll State
        self.last_scroll_time = 0
        self.scroll_cooldown = 0.05
        
        # Volume State
        self.last_vol_change = 0
        self.vol_cooldown = 0.05
        
        # Nav State
        self.last_nav_time = 0
        self.nav_cooldown = 1.0

        # Diction State
        self.is_diction_mode = False

        # MediaPipe
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=2, # Read both hands
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )
        self.mp_draw = mp.solutions.drawing_utils

        # Audio / TTS
        try:
            self.tts_engine = pyttsx3.init()
            self.tts_engine.setProperty('rate', 160)
        except:
            self.tts_engine = None

        self.recognizer = sr.Recognizer()
        self.mic = sr.Microphone()
        
        # Volume Control Init
        try:
            devices = AudioUtilities.GetSpeakers()
            interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
            self.volume = cast(interface, POINTER(IAudioEndpointVolume))
        except:
            self.volume = None

        # -- CALIBRATION --
        try:
            with self.mic as source:
                # print("Calibrating microphone...") # Ssssh, silent start
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
        except: pass

    # --- UTILS ---
    def speak(self, text):
        print(f"SkyNet: {text}")
        self.broadcast_log(f"AI: {text}", "SYSTEM")
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
        
    async def _send_all(self, message):
        if self.connected_clients:
            await asyncio.gather(*[client.send(message) for client in self.connected_clients])

    # --- HAND TRACKING HELPERS ---
    def get_hand_label(self, index, hand_landmarks, results):
        output = None
        for idx, classification in enumerate(results.multi_handedness):
            if classification.classification[0].index == index:
                # Processed results are flipped for mirror effect, so Label needs flip
                # If we use cv2.flip(image, 1), Left is Right and Right is Left in the capture
                # But MediaPipe "Left" means the person's left hand (which appears on left side if not mirrored)
                # Let's rely on standard: Label is accurate to the person's hand *if* we didn't flip,
                # but we DO flip.
                # Actually, simpler: Test it. Usually 'Right' in output is Right hand.
                label = classification.classification[0].label
                output = label
        return output

    def calculate_distance(self, p1, p2):
        return math.hypot(p1.x - p2.x, p1.y - p2.y)

    # --- GESTURE LOGIC ---
    def process_hands(self, results):
        if not results.multi_hand_landmarks: return

        # Identify Hands
        right_hand = None
        left_hand = None
        
        # Assuming max 2 hands. Results order matches multi_handedness
        for i, hand_landmarks in enumerate(results.multi_hand_landmarks):
            # Hacky robust way: Check x-coordinate if we only have one hand, or use label
            # Using label from results.multi_handedness logic
            label = results.multi_handedness[i].classification[0].label
            if label == "Right": right_hand = hand_landmarks
            if label == "Left": left_hand = hand_landmarks

        if right_hand: self.process_right_hand(right_hand)
        if left_hand: self.process_left_hand(left_hand)

    def process_right_hand(self, landmarks):
        lms = landmarks.landmark
        
        # 1. MOVE CURSOR (Index Pointing)
        # Condition: Index Up, Others Down? Or just index tip tracking?
        # User said: "Index Finger Pointing: Move Cursor"
        # We need to ensure it's pointing, not making a fist or other gesture.
        index_up = lms[8].y < lms[6].y
        middle_down = lms[12].y > lms[10].y
        
        # Mapping Coords to Screen (with Sensitivity)
        # Using Index Tip (8)
        raw_x = lms[8].x
        raw_y = lms[8].y
        
        # Invert X because of camera flip? No, we will flip image *before* processing usually, 
        # but if we flipped image, x=0 is left.
        # Let's assume standard normalized [0,1].
        
        # Center Offset System for better control
        # Define a "neutral box" in the center of the frame.
        # But user asked for simple sensitivity.
        
        # Smooth Move
        if index_up: 
            # Calculate Screen Coordinates
            target_x = np.interp(raw_x, [0.2, 0.8], [0, self.screen_w]) # crop edges
            target_y = np.interp(raw_y, [0.2, 0.8], [0, self.screen_h])
            
            # Apply Sensitivity Scaling? 
            # Actually, direct mapping is often absolute. 
            # If sensitivity is "mouse speed", relative motion is better.
            # But "Cursor follows tip of finger" implies Absolute positioning usually.
            # Let's stick to Absolute for "Point" interface like SkyNet 1.0 but smoother.
            
            # Smoothing (Exponential Moving Average) - Optional, for now direct.
            pyautogui.moveTo(target_x, target_y, duration=0.01) # Very fast

        # 2. LEFT CLICK (Index + Thumb Pinch)
        dist_pinch = self.calculate_distance(lms[8], lms[4])
        is_pinching_now = dist_pinch < PINCH_THRESHOLD
        
        if is_pinching_now and not self.is_pinching:
            self.is_pinching = True
            self.pinch_start_time = time.time()
            pyautogui.mouseDown() # For Drag
            
        elif not is_pinching_now and self.is_pinching:
            self.is_pinching = False
            duration = time.time() - self.pinch_start_time
            pyautogui.mouseUp()
            
            # "Quick tap is click, hold is click and hold" -> mouseUp handles the release of hold
            # Double Click Check:
            if (time.time() - self.last_pinch_release_time) < DOUBLE_CLICK_TIME:
                 pyautogui.doubleClick()
            else:
                 # Single click logic is implicit in down/up, but if it was a distinct "tap" event?
                 # MouseDown+MouseUp = Click.
                 pass
            self.last_pinch_release_time = time.time()

        # 3. RIGHT CLICK (Middle + Thumb Pinch)
        dist_middle_pinch = self.calculate_distance(lms[12], lms[4])
        if dist_middle_pinch < PINCH_THRESHOLD and not self.is_right_clicking:
            self.is_right_clicking = True
            pyautogui.rightClick()
        elif dist_middle_pinch > PINCH_THRESHOLD:
            self.is_right_clicking = False
            
        # 4. SCROLL UP (Two Fingers Up)
        # Index & Middle Up, others down
        if lms[8].y < lms[6].y and lms[12].y < lms[10].y and lms[16].y > lms[14].y:
            if time.time() - self.last_scroll_time > self.scroll_cooldown:
                pyautogui.scroll(100) # Up
                self.last_scroll_time = time.time()

        # 5. SCROLL DOWN (Two Fingers Down)
        # This is tricky with hand landmarks. Fingers pointing down?
        # Or just "Two Fingers pointing down" physically?
        # Using wrist as reference. If tips are below knuckles (greater y).
        if lms[8].y > lms[6].y and lms[12].y > lms[10].y and lms[16].y > lms[14].y:
             # Make sure hand isn't just "fist" -> ensure fingers are extended? 
             # Simpler: Index tip Y > Index MCP Y.
             # But this happens in a fist too.
             # Check if Thumb is out? 
             # Let's rely on specific context or orientation. 
             # If whole hand is pointing down.
             pass
             # Actually, user said "Two Fingers Down". 
             # Let's approximate: Tips are significantly below wrist?
             # Or standard gesture: Index+Middle extended, hand inverted?
             # Let's implement Scroll Down as "Index+Middle+Ring Up" (SkyNet v1 style) if inversion is too hard.
             # User specifically said: "Two Fingers Down: Scroll Down". 
             # Assuming standard "peace sign upside down".
             # Check if Tip y > PIP y for index/middle.
             if lms[8].y > lms[6].y and lms[12].y > lms[10].y:
                 # Ensure ring/pinky are curled (Tips > PIPs? or just check they are generally lower/curled)
                 if time.time() - self.last_scroll_time > self.scroll_cooldown:
                    pyautogui.scroll(-100) 
                    self.last_scroll_time = time.time()

        # 6. TABS & BROWSER NAV (Swipe Hand)
        # Using Palm/Wrist motion velocity? Or position relative to frame edges?
        # "Swipe Hand Left (Palm facing camera)" -> Previous Tab
        # "Swipe Hand Right" -> Next Tab
        # "Swipe Hand Down" -> Close Tab
        # "Swipe Hand Up" -> Open New Tab
        
        # We need velocity tracking for Swipes.
        # Simple implementation: Hand Position Zones (Edges of screen) + Cooldown
        wrist = lms[0]
        if time.time() - self.last_nav_time > self.nav_cooldown:
            if wrist.x < 0.1: # Left Edge
                pyautogui.hotkey('ctrl', 'shift', 'tab')
                self.speak("Previous Tab")
                self.last_nav_time = time.time()
            elif wrist.x > 0.9: # Right Edge
                pyautogui.hotkey('ctrl', 'tab')
                self.speak("Next Tab")
                self.last_nav_time = time.time()
            elif wrist.y < 0.1: # Top Edge
                pyautogui.hotkey('ctrl', 't')
                self.speak("New Tab")
                self.last_nav_time = time.time()
            elif wrist.y > 0.9: # Bottom Edge
                pyautogui.hotkey('ctrl', 'w')
                self.speak("Close Tab")
                self.last_nav_time = time.time()

        # 7. BACK PAGE ("L" Shape)
        # Thumb + Index out, others curled
        is_L = (lms[4].x > lms[3].x if lms[4].x > lms[8].x else lms[4].x < lms[3].x) # Thumb extended?
        # Simpler "L": Index Up, Thumb Out, others down
        if lms[8].y < lms[6].y and lms[12].y > lms[10].y: # Index Up, Middle Down
             # Check Thumb extension
            if self.calculate_distance(lms[4], lms[17]) > 0.15: # Wide thumb
                if time.time() - self.last_nav_time > self.nav_cooldown:
                    pyautogui.hotkey('alt', 'left')
                    self.speak("Back")
                    self.last_nav_time = time.time()

        # 8. OPEN LAST CLOSED (Thumb, Middle, Pinky Out) -> Spider-Man / Rock?
        # "Thumb, Middle, Pinky Out"
        if lms[4].y < lms[3].y and lms[12].y < lms[10].y and lms[20].y < lms[18].y:
            if lms[8].y > lms[6].y and lms[16].y > lms[14].y: # Index/Ring down
                 if time.time() - self.last_nav_time > self.nav_cooldown:
                    pyautogui.hotkey('ctrl', 'shift', 't')
                    self.speak("Restore Tab")
                    self.last_nav_time = time.time()

        # 9. VOLUME & MEDIA
        # Thumbs Up: Vol Up
        # Thumbs Down: Vol Down
        # "OK" Sign: Mute
        # Open Palm Push: Play/Pause
        
        # Thumbs Up/Down
        # Check if only Thumb is active? Or Fist + Thumb?
        # Assuming Fist + Thumb
        if lms[12].y > lms[10].y and lms[16].y > lms[14].y and lms[20].y > lms[18].y: # Fingers curled
             if lms[4].y < lms[3].y and lms[4].y < lms[8].y: # Thumb Up
                 if time.time() - self.last_vol_change > self.vol_cooldown:
                     pyautogui.press('volumeup')
                     self.last_vol_change = time.time()
             elif lms[4].y > lms[3].y and lms[4].y > lms[5].y: # Thumb Down (y increases downwards)
                 if time.time() - self.last_vol_change > self.vol_cooldown:
                     pyautogui.press('volumedown')
                     self.last_vol_change = time.time()
        
        # OK Sign (Index + Thumb Circle, Others Up)
        if self.calculate_distance(lms[8], lms[4]) < PINCH_THRESHOLD:
            if lms[12].y < lms[10].y and lms[16].y < lms[14].y: # Others up
                if time.time() - self.last_vol_change > 2.0: # Long cooldown for mute
                    pyautogui.press('volumemute')
                    self.speak("Mute toggle")
                    self.last_vol_change = time.time()

        # Open Palm Push
        # All fingers up
        all_up = all(lms[i].y < lms[i-2].y for i in [8,12,16,20])
        if all_up:
             # How to detect "Push"? Delta Z? Area size mapping?
             # Or just static "Stop/High Five" gesture triggers Play/Pause?
             # User said "Push (towards screen)".
             # This implies Z-depth change. MediaPipe gives Z.
             # Alternatively, just "Open Palm" held for a moment toggles it.
             if time.time() - self.last_nav_time > 2.0:
                 pyautogui.press('playpause')
                 self.speak("Media Toggle")
                 self.last_nav_time = time.time()


    def process_left_hand(self, landmarks):
        lms = landmarks.landmark
        
        # 1. RESET MOUSE (Closed Fist)
        if all(lms[i].y > lms[i-2].y for i in [8,12,16,20]): # All fingers curled
             current_time = time.time()
             # Need to hold?
             pyautogui.moveTo(self.screen_w // 2, self.screen_h // 2)
             # self.speak("Center") # Too spammy

        # 2. SENSITIVITY (Pinch Middle + Thumb)
        # "Each tap increases gesture sensitivity by 1... cycles 1-3"
        # Check pinch state with cooldown/latch
        pass # Implement state machine later if needed, simple logic:
        # if pinch_event: self.sensitivity = (self.sensitivity % 3) + 1

        # 3. OPEN TRADINGVIEW (Thumb + Pinky Out) -> Shaka
        if lms[4].y < lms[3].y and lms[20].y < lms[18].y: # Thumb/Pinky Up
            if lms[8].y > lms[6].y and lms[12].y > lms[10].y: # Index/Middle Down
                 if time.time() - self.last_nav_time > 3.0:
                     webbrowser.open("https://www.tradingview.com/chart")
                     self.speak("Opening Supercharts")
                     self.last_nav_time = time.time()

        # 4. DICTION (Two Fingers Up Held)
        # Toggle Diction Mode?
        pass

        # 5. CLOSE SKYNET (Rock On: Thumb, Pointer, Pinky)
        # "Thumb, Pointer, Pinky Out" -> ILY sign actually? Or Rock On?
        # User description: "Thumb, Pointer, Pinky Finger Out (Rock On Gesture)"
        # Standard Rock On is Index+Pinky. With Thumb is "I Love You" sign.
        if lms[4].y < lms[3].y and lms[8].y < lms[6].y and lms[20].y < lms[18].y:
            if lms[12].y > lms[10].y and lms[16].y > lms[14].y: # Middle/Ring Down
                if time.time() - self.last_nav_time > 3.0:
                    self.speak("Terminating SkyNet Interface")
                    self.initiate_shutdown("Gesture")


    # --- VOICE LOGIC ---
    def listen_loop(self):
        print("[EARS] Active")
        while self.is_running:
            try:
                with self.mic as source:
                    audio = self.recognizer.listen(source, timeout=3, phrase_time_limit=5)
                try:
                    text = self.recognizer.recognize_google(audio).lower()
                    self.process_voice(text)
                except: pass
            except: continue

    def process_voice(self, text):
        if not self.is_running: return
        print(f" -> Heard: '{text}'")
        self.broadcast_log(f'"{text}"', "VOICE")

        if "sarah connor" in text:
            self.initiate_shutdown("Voice Command")
            return

        if "open chart" in text:
            # "Open Chart [Ticker]"
            # Extract ticker
            parts = text.split("open chart")
            if len(parts) > 1:
                ticker = parts[1].strip().upper().replace(" ", "")
                if ticker:
                    self.speak(f"Opening Chart for {ticker}")
                    webbrowser.open(f"https://www.tradingview.com/chart?symbol={ticker}")
                    
        # Navigate to pages
        pages = {
            "dashboard": "/dashboard",
            "portfolio": "/portfolio-lab",
            "news": "/news",
            "ideas": "/ideas",
            "profile": "/profile",
            "admin": "/admin"
        }
        
        for keyword, route in pages.items():
            if keyword in text and ("go to" in text or "open" in text or "navigate" in text):
                self.speak(f"Navigating to {keyword}")
                # We can't navigate the browser directly unless we know the URL base or use the WS to tell frontend
                # Using WS to tell frontend (if active)
                self.broadcast_command("NAVIGATE", route)
                # Also open new tab if requested? User said "new tab is opened to that page"
                # So maybe webbrowser.open(FULL_URL)
                # Need base URL. Assuming localhost:5173 for dev or autodetection?
                # Let's try sending WS command first; if frontend catches it, it can open window.open
                

    def broadcast_command(self, action, payload):
        if not self.loop: return
        data = json.dumps({"action": action, "payload": payload})
        try:
            asyncio.run_coroutine_threadsafe(self._send_all(data), self.loop)
        except: pass


    # --- LIFECYCLE ---
    def initiate_shutdown(self, source):
        self.speak(f"Shutdown by {source}")
        self.broadcast_command("TERMINATE", source)
        self.is_running = False

    def start_camera_and_processing(self):
        print("Opening Camera (Hidden Mode)...")
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not cap.isOpened(): cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)

        while cap.isOpened() and self.is_running:
            success, image = cap.read()
            if not success:
                time.sleep(0.1)
                continue

            # Flip for processing (mirror effect for user intuition)
            image = cv2.flip(image, 1)
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            results = self.hands.process(image_rgb)
            
            if results.multi_hand_landmarks:
                self.process_hands(results)

            # NO cv2.imshow !! User requested hidden camera.
            
            # Small sleep to save CPU?
            # cv2.waitKey(1) is needed for event loop? No, not if we don't show window.
            time.sleep(0.01)

        cap.release()

    async def main_async(self):
        self.loop = asyncio.get_running_loop()
        
        # Start Threads
        t_ears = threading.Thread(target=self.listen_loop, daemon=True)
        t_eyes = threading.Thread(target=self.start_camera_and_processing, daemon=True)
        
        t_ears.start()
        t_eyes.start()

        print(f"\n=== SKYNET V2 LISTENING ON {WS_PORT} ===")
        async with websockets.serve(self.ws_handler, "0.0.0.0", WS_PORT):
            while self.is_running:
                await asyncio.sleep(1)

    async def ws_handler(self, websocket):
        self.connected_clients.add(websocket)
        try:
            async for message in websocket: pass
        except: pass
        finally: self.connected_clients.remove(websocket)

if __name__ == "__main__":
    controller = SkyNetV2Controller()
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(controller.main_async())
    except KeyboardInterrupt:
        pass
