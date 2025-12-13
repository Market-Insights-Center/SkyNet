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

# --- CONFIGURATION ---
PINCH_THRESHOLD = 0.04       
PINKY_THRESHOLD = 0.06
DOUBLE_CLICK_TIME = 0.5      
CLICK_DURATION = 0.3         
RESET_HOLD_TIME = 1.0        
WS_PORT = 8001               
SENSITIVITY = 2.0            

class OrionController:
    def __init__(self):
        self.is_running = True
        self.mode = "IDLE"
        self.connected_clients = set()
        self.loop = None  
        
        # Gesture State
        self.is_pinching = False
        self.pinch_start_time = 0
        self.last_pinch_release_time = 0
        self.is_pinky_pinching = False
        
        self.rock_sign_start_time = 0
        self.shaka_start_time = 0
        self.scroll_gesture_time = 0
        self.spider_start_time = 0
        
        # MediaPipe
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )
        self.mp_draw = mp.solutions.drawing_utils

        # Audio
        try:
            self.tts_engine = pyttsx3.init()
            self.tts_engine.setProperty('rate', 160)
        except:
            self.tts_engine = None

        self.recognizer = sr.Recognizer()
        self.mic = sr.Microphone()
        try:
            with self.mic as source:
                print("Calibrating microphone...")
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
        except Exception as e:
            print(f"Microphone init warning: {e}")

    # --- SHUTDOWN LOGIC ---
    def initiate_shutdown(self, trigger_source):
        print(f"\n[SYSTEM] Shutdown initiated by {trigger_source}")
        self.broadcast_command("TERMINATE", None, f"Kill Code: {trigger_source}")
        self.speak("Terminating Session.")
        def shutdown_sequence():
            time.sleep(2.0)
            self.is_running = False
            print("[SYSTEM] Core Loops Terminated.")
        threading.Thread(target=shutdown_sequence, daemon=True).start()

    # --- WEBSOCKETS ---
    async def ws_handler(self, websocket):
        self.connected_clients.add(websocket)
        try:
            async for message in websocket: pass
        except: pass
        finally: self.connected_clients.remove(websocket)

    def broadcast_command(self, action, payload=None, log_message=None):
        if not self.loop: return
        data = json.dumps({"action": action, "payload": payload, "log": log_message})
        try:
            asyncio.run_coroutine_threadsafe(self._send_all(data), self.loop)
        except: pass

    async def _send_all(self, message):
        if self.connected_clients:
            await asyncio.gather(*[client.send(message) for client in self.connected_clients])

    # --- VOICE ---
    def speak(self, text):
        print(f"Orion: {text}")
        self.broadcast_command("LOG", None, f"AI: {text}")
        if self.tts_engine:
            threading.Thread(target=self._speak_thread, args=(text,), daemon=True).start()

    def _speak_thread(self, text):
        try:
            engine = pyttsx3.init()
            engine.say(text)
            engine.runAndWait()
        except: pass

    def listen_loop(self):
        print("[EARS] Active")
        while self.is_running:
            try:
                with self.mic as source:
                    audio = self.recognizer.listen(source, timeout=2, phrase_time_limit=5)
                try:
                    text = self.recognizer.recognize_google(audio).lower()
                    self.process_voice_command(text)
                except: pass
            except: continue

    def process_voice_command(self, text):
        if not self.is_running: return
        print(f" -> Heard: '{text}'")
        self.broadcast_command("VOICE_HEARD", text)

        if "sarah connor" in text or "terminate" in text:
            self.initiate_shutdown("Voice Command")
            return
        
        if "close" in text or "cancel" in text:
            self.speak("Closing Chart")
            self.broadcast_command("CLOSE_CHART", None, "Voice: Close")
            return

        if self.mode == "IDLE":
            if "open chart" in text:
                self.mode = "LISTENING_TICKER"
                self.speak("Spell the ticker.")
                self.broadcast_command("STATUS", "LISTENING_TICKER", "Waiting for ticker...")
            elif "portfolio" in text:
                self.speak("Portfolio Lab")
                self.broadcast_command("NAVIGATE", "/portfolio-lab", "Navigating: Portfolio")
            elif "news" in text:
                self.speak("News Feed")
                self.broadcast_command("NAVIGATE", "/news", "Navigating: News")
            elif "new idea" in text:
                self.speak("Create Idea")
                self.broadcast_command("OPEN_MODAL", "CREATE_IDEA", "Opening Modal")
            elif "profile" in text:
                self.speak("Profile")
                self.broadcast_command("NAVIGATE", "/profile")
            elif "admin" in text:
                self.speak("Admin")
                self.broadcast_command("NAVIGATE", "/admin")

        elif self.mode == "LISTENING_TICKER":
            if "cancel" in text:
                self.mode = "IDLE"
                self.speak("Cancelled")
                self.broadcast_command("RESET", None, "Cancelled")
            else:
                clean_ticker = text.upper().replace(" ", "").replace(".", "")
                if 2 <= len(clean_ticker) <= 6:
                    self.speak(f"Opening {clean_ticker}")
                    self.broadcast_command("OPEN_CHART", clean_ticker, f"Chart: {clean_ticker}")
                    self.mode = "IDLE"
                else:
                    self.speak("Try again.")

    # --- GESTURE UTILS ---
    def calculate_distance(self, p1, p2):
        return math.hypot(p1.x - p2.x, p1.y - p2.y)

    def is_fist(self, landmarks):
        return all(landmarks[t].y > landmarks[k].y for t, k in zip([8,12,16,20], [5,9,13,17]))

    def is_rock_sign(self, landmarks):
        index_up = landmarks[8].y < landmarks[6].y
        pinky_up = landmarks[20].y < landmarks[18].y
        middle_down = landmarks[12].y > landmarks[10].y
        ring_down = landmarks[16].y > landmarks[14].y
        return index_up and pinky_up and middle_down and ring_down

    def is_two_finger_point(self, landmarks):
        """Index & Middle UP (Scroll Wheel UP)"""
        index_up = landmarks[8].y < landmarks[6].y
        middle_up = landmarks[12].y < landmarks[10].y
        ring_down = landmarks[16].y > landmarks[14].y
        pinky_down = landmarks[20].y > landmarks[18].y
        return index_up and middle_up and ring_down and pinky_down

    def is_three_finger_point(self, landmarks):
        """Index, Middle, Ring UP (Scroll Wheel DOWN)"""
        index_up = landmarks[8].y < landmarks[6].y
        middle_up = landmarks[12].y < landmarks[10].y
        ring_up = landmarks[16].y < landmarks[14].y
        pinky_down = landmarks[20].y > landmarks[18].y
        return index_up and middle_up and ring_up and pinky_down

    def is_shaka(self, landmarks):
        index_down = landmarks[8].y > landmarks[6].y
        middle_down = landmarks[12].y > landmarks[10].y
        ring_down = landmarks[16].y > landmarks[14].y
        pinky_up = landmarks[20].y < landmarks[18].y
        return index_down and middle_down and ring_down and pinky_up

    def is_spider_man_sign(self, landmarks):
        """Spider-Man / ILY Sign: Thumb, Middle, Pinky UP. Index, Ring DOWN."""
        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        middle_tip = landmarks[12]
        ring_tip = landmarks[16]
        pinky_tip = landmarks[20]
        index_pip = landmarks[6]
        middle_pip = landmarks[10]
        ring_pip = landmarks[14]
        pinky_pip = landmarks[18]
        middle_up = middle_tip.y < middle_pip.y
        pinky_up = pinky_tip.y < pinky_pip.y
        index_down = index_tip.y > index_pip.y
        ring_down = ring_tip.y > ring_pip.y
        return middle_up and pinky_up and index_down and ring_down

    # --- GESTURE PROCESSING ---
    def process_gestures(self, landmarks):
        if not self.is_running: return

        index_tip = landmarks[8]
        raw_x = index_tip.x
        raw_y = index_tip.y
        
        cx = (raw_x - 0.5) * SENSITIVITY + 0.5
        cy = (raw_y - 0.5) * SENSITIVITY + 0.5
        cx = max(0.0, min(1.0, cx))
        cy = max(0.0, min(1.0, cy))
        
        cursor_state = "open"

        # KILL SWITCH (Rock On)
        if self.is_rock_sign(landmarks):
            if self.rock_sign_start_time == 0:
                self.rock_sign_start_time = time.time()
            elif (time.time() - self.rock_sign_start_time) > 1.2:
                self.initiate_shutdown("Gesture (Rock On)")
                self.rock_sign_start_time = 0
            return
        else:
            self.rock_sign_start_time = 0

        # CLOSE CHART (Spider-Man)
        if self.is_spider_man_sign(landmarks):
            if self.spider_start_time == 0:
                self.spider_start_time = time.time()
            elif (time.time() - self.spider_start_time) > 0.8:
                self.broadcast_command("CLOSE_CHART", None, "Gesture: Close (Spider-Man)")
                self.spider_start_time = 0
            return
        else:
            self.spider_start_time = 0

        # RESET (Shaka)
        if self.is_shaka(landmarks):
            if self.shaka_start_time == 0:
                self.shaka_start_time = time.time()
            elif (time.time() - self.shaka_start_time) > 1.0:
                self.broadcast_command("RESET_VIEW", None, "Gesture: Shaka")
                self.shaka_start_time = 0
            return
        else:
            self.shaka_start_time = 0

        # WHEEL UP (2 Fingers)
        if self.is_two_finger_point(landmarks):
            if (time.time() - self.scroll_gesture_time) > 0.15: 
                self.broadcast_command("WHEEL", "UP", "Gesture: Scroll/Zoom Up")
                self.scroll_gesture_time = time.time()
            return

        # WHEEL DOWN (3 Fingers)
        if self.is_three_finger_point(landmarks):
            if (time.time() - self.scroll_gesture_time) > 0.15:
                self.broadcast_command("WHEEL", "DOWN", "Gesture: Scroll/Zoom Down")
                self.scroll_gesture_time = time.time()
            return

        # DRAG / PAN (Fist)
        if self.is_fist(landmarks):
            cursor_state = "closed"
            self.broadcast_command("DRAG", {"x": cx, "y": cy}, "Gesture: Drag (Fist)")
            self.broadcast_command("CURSOR", {"x": cx, "y": cy, "state": "closed"})
            return 

        # ZOOM / CLICK (Pinch)
        thumb = landmarks[4]
        index = landmarks[8]
        pinky = landmarks[20]

        pinch_dist = self.calculate_distance(thumb, index)
        pinky_pinch_dist = self.calculate_distance(thumb, pinky)

        is_pinching_now = pinch_dist < PINCH_THRESHOLD

        if is_pinching_now and not self.is_pinching:
            self.is_pinching = True
            self.pinch_start_time = time.time()
            if (time.time() - self.last_pinch_release_time) < DOUBLE_CLICK_TIME:
                self.broadcast_command("ZOOM", "IN", "Gesture: Timeframe In")

        elif not is_pinching_now and self.is_pinching:
            self.is_pinching = False
            self.last_pinch_release_time = time.time()
            if (time.time() - self.pinch_start_time) < CLICK_DURATION:
                self.broadcast_command("CLICK", None, "Gesture: Click")

        is_pinky_now = pinky_pinch_dist < PINKY_THRESHOLD
        if is_pinky_now and not self.is_pinky_pinching:
            self.is_pinky_pinching = True
            self.broadcast_command("ZOOM", "OUT", "Gesture: Timeframe Out")
        elif not is_pinky_now:
            self.is_pinky_pinching = False

        self.broadcast_command("CURSOR", {"x": cx, "y": cy, "state": cursor_state})

    # --- MAIN ---
    def start_camera(self):
        print("Opening Camera...")
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        if not cap.isOpened(): cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)
        
        while cap.isOpened() and self.is_running:
            success, image = cap.read()
            if not success: 
                time.sleep(0.1)
                continue

            image = cv2.flip(image, 1)
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = self.hands.process(image_rgb)

            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    self.mp_draw.draw_landmarks(image, hand_landmarks, self.mp_hands.HAND_CONNECTIONS)
                    self.process_gestures(hand_landmarks.landmark)

            cv2.imshow('Orion Vision Node', image)
            if cv2.waitKey(5) & 0xFF == ord('q'): 
                self.is_running = False
                break

        cap.release()
        cv2.destroyAllWindows()

    async def main_async(self):
        self.loop = asyncio.get_running_loop()
        threading.Thread(target=self.listen_loop, daemon=True).start()
        threading.Thread(target=self.start_camera, daemon=True).start()

        # CRITICAL FIX: Bind to "0.0.0.0" to allow VPS connections
        print(f"\n=== ORION LISTENING ON {WS_PORT} ===")
        async with websockets.serve(self.ws_handler, "0.0.0.0", WS_PORT):
            while self.is_running:
                await asyncio.sleep(1)

if __name__ == "__main__":
    controller = OrionController()
    try:
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        asyncio.run(controller.main_async())
    except: pass