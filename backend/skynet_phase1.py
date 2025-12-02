import cv2
import mediapipe as mp
import math
import time
import threading
import speech_recognition as sr
import pyttsx3
import queue
import sys

# --- CONFIGURATION ---
PINCH_THRESHOLD = 0.04       # Distance between Thumb and Index to trigger a pinch
MIDDLE_TAP_THRESHOLD = 0.05  # Distance between Middle finger and Index for draw toggle
DOUBLE_CLICK_TIME = 0.5      # Seconds allowed between taps
RESET_HOLD_TIME = 1.0        # Seconds to hold Open Palm to reset

class SkyNetController:
    def __init__(self):
        # State Variables
        self.is_running = True
        self.mode = "IDLE"  # IDLE, LISTENING_TICKER
        
        # Gesture Variables
        self.is_pinching = False
        self.last_pinch_time = 0
        self.drawing_active = False
        self.middle_finger_was_touching = False
        self.open_palm_start_time = 0
        
        # MediaPipe Setup
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )
        self.mp_draw = mp.solutions.drawing_utils

        # Voice Engine Setup
        try:
            self.tts_engine = pyttsx3.init()
            self.tts_engine.setProperty('rate', 160)
        except Exception as e:
            print(f"Warning: TTS Engine failed: {e}")
            self.tts_engine = None

        # Speech Recognition Setup
        self.recognizer = sr.Recognizer()
        self.mic = sr.Microphone()
        
        # Calibrate immediately
        with self.mic as source:
            print("Calibrating microphone... (Silence please)")
            self.recognizer.adjust_for_ambient_noise(source, duration=1)

    def speak(self, text):
        """Non-blocking speak function"""
        print(f"SkyNet: {text}")
        if self.tts_engine:
            threading.Thread(target=self._speak_thread, args=(text,), daemon=True).start()

    def _speak_thread(self, text):
        try:
            engine = pyttsx3.init()
            engine.say(text)
            engine.runAndWait()
        except:
            pass

    def listen_loop(self):
        """Continuous listening loop"""
        print("\n[EARS] Listening for 'Open Chart', 'New Idea', 'Portfolio'...")
        
        while self.is_running:
            try:
                with self.mic as source:
                    audio = self.recognizer.listen(source, timeout=2, phrase_time_limit=5)
                
                try:
                    text = self.recognizer.recognize_google(audio).lower()
                    self.process_voice_command(text)
                except sr.UnknownValueError:
                    pass 
                except sr.RequestError:
                    print("[EARS] API Connection Error")

            except sr.WaitTimeoutError:
                continue
            except Exception as e:
                # Suppress generic timeout errors to keep log clean
                continue

    def process_voice_command(self, text):
        """Command State Machine"""
        print(f" -> Heard: '{text}'")

        if self.mode == "IDLE":
            if "open chart" in text:
                self.mode = "LISTENING_TICKER"
                print("\n>>> COMMAND: OPEN_CHART_INITIATED")
                self.speak("Spell the ticker.")
            
            elif "portfolio" in text or "lab" in text:
                print("\n>>> COMMAND: NAVIGATE(/portfolio-lab)")
                self.speak("Opening Portfolio Lab")
            
            elif "news" in text:
                print("\n>>> COMMAND: NAVIGATE(/news)")
                self.speak("Loading News Feed")
            
            elif "new idea" in text or "create idea" in text:
                print("\n>>> COMMAND: OPEN_MODAL(CREATE_IDEA)")
                self.speak("New Idea Template")
            
            elif "profile" in text:
                print("\n>>> COMMAND: NAVIGATE(/profile)")
                self.speak("Opening Profile")

            elif "admin" in text:
                print("\n>>> COMMAND: NAVIGATE(/admin)")
                self.speak("Admin Dashboard")

        elif self.mode == "LISTENING_TICKER":
            if "cancel" in text or "stop" in text:
                self.mode = "IDLE"
                self.speak("Cancelled")
                print(">>> COMMAND: CANCELLED")
            else:
                clean_ticker = text.upper().replace(" ", "").replace(".", "")
                if 2 <= len(clean_ticker) <= 6:
                    print(f"\n>>> COMMAND: OPEN_CHART_TV({clean_ticker})")
                    self.speak(f"Opening {clean_ticker}")
                    self.mode = "IDLE"
                else:
                    self.speak("Ticker not recognized. Try again or say cancel.")

    def calculate_distance(self, p1, p2):
        return math.hypot(p1.x - p2.x, p1.y - p2.y)

    def is_fist(self, landmarks):
        tips = [8, 12, 16, 20]
        knuckles = [5, 9, 13, 17]
        count_down = 0
        for tip, knuckle in zip(tips, knuckles):
            if landmarks[tip].y > landmarks[knuckle].y:
                count_down += 1
        return count_down == 4

    def is_open_palm(self, landmarks):
        tips = [8, 12, 16, 20]
        knuckles = [5, 9, 13, 17]
        count_up = 0
        for tip, knuckle in zip(tips, knuckles):
            if landmarks[tip].y < landmarks[knuckle].y:
                count_up += 1
        return count_up == 4

    def process_gestures(self, landmarks):
        if self.is_open_palm(landmarks):
            if self.open_palm_start_time == 0:
                self.open_palm_start_time = time.time()
            elif (time.time() - self.open_palm_start_time) > RESET_HOLD_TIME:
                if self.mode != "IDLE" or self.drawing_active:
                    print("\n>>> GESTURE: SYSTEM_RESET")
                    self.speak("System Reset")
                    self.mode = "IDLE"
                    self.drawing_active = False
                self.open_palm_start_time = 0
            return
        else:
            self.open_palm_start_time = 0

        if self.is_fist(landmarks):
            wrist_y = landmarks[0].y
            if wrist_y < 0.3:
                sys.stdout.write(f"\r>>> SCROLL: UP      ")
            elif wrist_y > 0.7:
                sys.stdout.write(f"\r>>> SCROLL: DOWN    ")
            sys.stdout.flush()
            return

        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        middle_tip = landmarks[12]

        pinch_dist = self.calculate_distance(thumb_tip, index_tip)
        middle_dist = self.calculate_distance(index_tip, middle_tip)

        currently_pinching = pinch_dist < PINCH_THRESHOLD

        if currently_pinching and not self.is_pinching:
            if (time.time() - self.last_pinch_time) < DOUBLE_CLICK_TIME:
                print("\n>>> GESTURE: DOUBLE_TAP (Action: ZOOM_IN)")
            self.last_pinch_time = time.time()
            self.is_pinching = True
            
        elif not currently_pinching and self.is_pinching:
            self.is_pinching = False

        if self.is_pinching:
            cx, cy = (thumb_tip.x + index_tip.x) / 2, (thumb_tip.y + index_tip.y) / 2
            cursor_cmd = f"CURSOR: [{cx:.2f}, {cy:.2f}]"
            
            middle_touching = middle_dist < MIDDLE_TAP_THRESHOLD
            if middle_touching and not self.middle_finger_was_touching:
                self.drawing_active = not self.drawing_active
                status = "STARTED" if self.drawing_active else "COMPLETED"
                print(f"\n>>> GESTURE: TRIPLE_TAP -> DRAWING_{status}")
                self.speak(f"Drawing {status}")
            
            self.middle_finger_was_touching = middle_touching

            if self.drawing_active:
                sys.stdout.write(f"\r{cursor_cmd} | DRAWING_LINE...   ")
            else:
                sys.stdout.write(f"\r{cursor_cmd}                     ")
            sys.stdout.flush()

    def start(self):
        # 1. Start Voice Thread
        threading.Thread(target=self.listen_loop, daemon=True).start()

        # 2. Initialize Camera with DIRECTSHOW (Fix for Windows)
        print("\n=== SKYNET CONTROLLER (PHASE 1.5) ===")
        print("Attempting to open camera...")

        # Try Index 0 with DirectShow
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        
        # If Index 0 fails or won't open, try Index 1
        if not cap.isOpened():
            print("Camera 0 failed. Trying Camera 1...")
            cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)

        if not cap.isOpened():
            print("\nCRITICAL ERROR: Could not open any webcam.")
            print("1. Check if another app (Zoom/Teams) is using it.")
            print("2. Check Windows Privacy Settings -> Camera.")
            self.is_running = False
            return

        print("Camera ACTIVE. Press 'q' to quit.\n")
        
        fail_count = 0
        while cap.isOpened():
            success, image = cap.read()
            
            if not success:
                fail_count += 1
                if fail_count % 10 == 0:
                    print("Warning: Camera frame empty. Retrying...")
                # Avoid infinite fast loop if camera disconnects
                time.sleep(0.1)
                continue
            
            # Reset fail count on success
            fail_count = 0

            image = cv2.flip(image, 1)
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = self.hands.process(image_rgb)

            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    self.mp_draw.draw_landmarks(image, hand_landmarks, self.mp_hands.HAND_CONNECTIONS)
                    self.process_gestures(hand_landmarks.landmark)

            cv2.putText(image, f"Mode: {self.mode}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            if self.drawing_active:
                cv2.putText(image, "DRAWING", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

            cv2.imshow('SkyNet Vision', image)
            if cv2.waitKey(5) & 0xFF == ord('q'): break

        self.is_running = False
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    SkyNetController().start()