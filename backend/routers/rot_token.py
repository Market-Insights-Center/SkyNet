import json
import os
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import random

router = APIRouter(prefix="/api/rot", tags=["Rot Token"])

# --- CONSTANTS & CONFIG ---
DATA_FILE_REAL = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'rot_data.json')
DATA_FILE_MOCK = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'rot_data_mock.json')
LAUNCH_DATE_KEY = "launch_date"

# --- DATA MODELS ---

class RotTerm(BaseModel):
    id: str
    term: str
    damage: float
    lifespan_str: str  # e.g. "1d", "4h"
    created_at_iso: str
    
    # Computed / Internal
    lifespan_seconds: float
    decay_constant: float  # k for exponential decay

class RotEvent(BaseModel):
    id: str
    name: str
    damage: float
    lifespan_str: str
    created_at_iso: str
    
    # Computed / Internal
    lifespan_seconds: float

class RotMockPayload(BaseModel):
    count: int = 10

# --- HELPERS ---

import re

def parse_duration(lifespan_str: str) -> float:
    """Parses '1d', '4h', '3w', '30m', '1y', '2.5mo' into seconds."""
    s = lifespan_str.strip().lower()
    
    # Simple regex to capture number and unit
    match = re.match(r'^([\d\.]+)\s*([a-z]*)$', s)
    if not match:
        # Try to parse as raw seconds if no unit
        try:
            return float(s)
        except:
            return 3600.0 # Default 1h
            
    val = float(match.group(1))
    unit = match.group(2)
    
    if not unit or unit == 's' or unit == 'sec' or unit == 'seconds':
        return val
    elif unit in ['m', 'min', 'mins', 'minutes']:
        return val * 60
    elif unit in ['h', 'hr', 'hrs', 'hours']:
        return val * 3600
    elif unit in ['d', 'day', 'days']:
        return val * 86400
    elif unit in ['w', 'wk', 'weeks']:
        return val * 604800
    elif unit in ['mo', 'month', 'months']:
        return val * 2592000 # 30 days approx
    elif unit in ['y', 'yr', 'years']:
        return val * 31536000 # 365 days approx
        
    return val # Default to seconds if unknown unit? or fallback.


def get_db(mode: str = "real"):
    target_file = DATA_FILE_MOCK if mode == "mock" else DATA_FILE_REAL
    
    default_db = {
        LAUNCH_DATE_KEY: datetime.now(timezone.utc).isoformat(),
        "terms": [],
        "events": []
    }
    
    if not os.path.exists(target_file):
        os.makedirs(os.path.dirname(target_file), exist_ok=True)
        save_db(default_db, mode)
        return default_db
        
    try:
        with open(target_file, 'r') as f:
            return json.load(f)
    except:
        return default_db

def save_db(data, mode: str = "real"):
    target_file = DATA_FILE_MOCK if mode == "mock" else DATA_FILE_REAL
    with open(target_file, 'w') as f:
        json.dump(data, f, indent=2)

def calculate_decay_constant(lifespan_seconds: float) -> float:
    # Target: 10% of initial value at end of lifespan
    # V(t) = V0 * e^(-k * t)
    # 0.10 = e^(-k * L)
    # ln(0.10) = -k * L
    # k = -ln(0.10) / L
    # ln(0.10) is approx -2.302585
    if lifespan_seconds <= 0: return 0
    return -math.log(0.10) / lifespan_seconds

def compute_term_value(term: Dict, at_time: datetime) -> float:
    created = datetime.fromisoformat(term['created_at_iso'])
    # Ensure created is timezone-aware if at_time is, or vice versa
    if at_time.tzinfo is not None and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    
    delta = (at_time - created).total_seconds()
    
    lifespan = term['lifespan_seconds']
    
    if delta >= lifespan: return 0
    if delta < 0: return 0 
    
    damage = term['damage']
    k = term['decay_constant']
    
    val = damage * math.exp(-k * delta)
    return max(0, val)

def compute_event_value(event: Dict, at_time: datetime) -> float:
    # Linear Decay to 0 at lifespan
    created = datetime.fromisoformat(event['created_at_iso'])
    if at_time.tzinfo is not None and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
        
    delta = (at_time - created).total_seconds()
    
    if delta < 0: return 0
    lifespan = event['lifespan_seconds']
    
    if delta >= lifespan:
        return 0
    
    # V(t) = D * (1 - t/L)
    val = event['damage'] * (1 - (delta / lifespan))
    return max(0, val)

# --- ROUTES ---

@router.get("/status")
def get_rot_status(mode: str = Query("real")):
    db = get_db(mode)
    now = datetime.now(timezone.utc)
    
    terms = db.get('terms', [])
    events = db.get('events', [])
    
    # Calculate Current Value
    total_val = 0
    terms_enriched = []
    events_enriched = []
    
    for t in terms:
        v = compute_term_value(t, now)
        total_val += v
        terms_enriched.append({**t, "current_value": v})
        
    for e in events:
        v = compute_event_value(e, now)
        total_val += v
        events_enriched.append({**e, "current_value": v})
        
    launch_str = db.get(LAUNCH_DATE_KEY)
    return {
        "current_price": round(total_val, 2),
        "launch_date": launch_str,
        "terms": sorted(terms_enriched, key=lambda x: x['current_value'], reverse=True),
        "events": sorted(events_enriched, key=lambda x: x['current_value'], reverse=True)
    }

@router.get("/history")
def get_rot_history(mode: str = Query("real")):
    db = get_db(mode)
    now = datetime.now(timezone.utc)
    
    terms = db.get('terms', [])
    events = db.get('events', [])
    
    # Generate History (e.g. 100 points since launch)
    launch_str = db.get(LAUNCH_DATE_KEY)
    launch = datetime.fromisoformat(launch_str)
    if launch.tzinfo is None: launch = launch.replace(tzinfo=timezone.utc)
    
    # Ensure launch isn't in future
    if launch > now: launch = now
    
    full_delta = (now - launch).total_seconds()
    
    # Determine resolution
    points = 100
    step = full_delta / points if full_delta > 0 else 0
    
    history = []
    
    # OPTIMIZATION: Pre-parse datetimes so we don't do it 100 * N times
    parsed_terms = []
    for t in terms:
        dt = datetime.fromisoformat(t['created_at_iso'])
        if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
        parsed_terms.append((dt, t))
        
    parsed_events = []
    for e in events:
        dt = datetime.fromisoformat(e['created_at_iso'])
        if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
        parsed_events.append((dt, e))

    if step > 0:
        for i in range(points + 1):
            t_point = launch + timedelta(seconds=step*i)
            # Sum all terms/events active at t_point
            val_at_t = 0
            
            for created, t in parsed_terms:
                if created <= t_point:
                    val_at_t += compute_term_value(t, t_point)
            
            for created, e in parsed_events:
                if created <= t_point:
                    val_at_t += compute_event_value(e, t_point)
            
            history.append({
                "date": t_point.isoformat(),
                "price": round(val_at_t, 2)
            })
            
    return history

@router.post("/terms")
def add_rot_term(payload: Dict[str, Any], mode: str = Query("real")):
    db = get_db(mode)
    
    lifespan_sec = parse_duration(payload.get('lifespan', '1d'))
    k = calculate_decay_constant(lifespan_sec)
    
    new_term = {
        "id": str(uuid.uuid4()),
        "term": payload.get("term", "Unknown"),
        "damage": float(payload.get("damage", 5)),
        "lifespan_str": payload.get("lifespan", "1d"),
        "created_at_iso": datetime.now(timezone.utc).isoformat(),
        "lifespan_seconds": lifespan_sec,
        "decay_constant": k
    }
    
    db['terms'].append(new_term)
    save_db(db, mode)
    return {"success": True, "term": new_term}

@router.post("/events")
def add_rot_event(payload: Dict[str, Any], mode: str = Query("real")):
    db = get_db(mode)
    
    lifespan_sec = parse_duration(payload.get('lifespan', '1d'))
    
    new_event = {
        "id": str(uuid.uuid4()),
        "name": payload.get("name", "Unknown Event"),
        "damage": float(payload.get("damage", 100)),
        "lifespan_str": payload.get("lifespan", "1d"),
        "created_at_iso": datetime.now(timezone.utc).isoformat(),
        "lifespan_seconds": lifespan_sec
    }
    
    db['events'].append(new_event)
    save_db(db, mode)
    return {"success": True, "event": new_event}

@router.put("/terms/{term_id}")
def update_rot_term(term_id: str, payload: Dict[str, Any], mode: str = Query("real")):
    db = get_db(mode)
    
    found = False
    for t in db['terms']:
        if t['id'] == term_id:
            if 'term' in payload: t['term'] = payload['term']
            
            # Recalculate physics if damage/lifespan change
            recalc = False
            if 'damage' in payload: 
                t['damage'] = float(payload['damage'])
                recalc = True
            if 'lifespan' in payload:
                t['lifespan_str'] = payload['lifespan']
                t['lifespan_seconds'] = parse_duration(payload['lifespan'])
                recalc = True
            
            if recalc:
                t['decay_constant'] = calculate_decay_constant(t['lifespan_seconds'])
                
            found = True
            break
            
    if not found:
        raise HTTPException(status_code=404, detail="Term not found")
        
    save_db(db, mode)
    return {"success": True}

@router.put("/events/{event_id}")
def update_rot_event(event_id: str, payload: Dict[str, Any], mode: str = Query("real")):
    db = get_db(mode)
    
    found = False
    for e in db['events']:
        if e['id'] == event_id:
            if 'name' in payload: e['name'] = payload['name']
            
            if 'damage' in payload: e['damage'] = float(payload['damage'])
            if 'lifespan' in payload:
                e['lifespan_str'] = payload['lifespan']
                e['lifespan_seconds'] = parse_duration(payload['lifespan'])
                
            found = True
            break
            
    if not found:
        raise HTTPException(status_code=404, detail="Event not found")
        
    save_db(db, mode)
    return {"success": True}

@router.post("/mock")
def generate_mock_data(mode: str = Query("real")):
    db = get_db(mode)
    
    # 1. Backdate launch if needed
    launch = datetime.now(timezone.utc) - timedelta(days=30)
    db[LAUNCH_DATE_KEY] = launch.isoformat()
    
    terms = []
    events = []
    
    words = ["Skibidi", "Rizz", "Gyatt", "Fanum", "Tax", "Sigma", "Ohio", "Grimace", "Kai", "Cenat"]
    event_names = ["Server Crash", "Meme Review", "Viral Tweet", "Discord Raid", "Algorithm Change"]
    
    # Generate 20 terms
    for _ in range(20):
        created_delta = random.randint(0, 30*24*60*60) # random second in last 30 days
        created_at = launch + timedelta(seconds=created_delta)
        
        lifespan_days = random.randint(1, 14)
        lifespan_str = f"{lifespan_days}d"
        lifespan_sec = lifespan_days * 86400
        
        term = {
            "id": str(uuid.uuid4()),
            "term": random.choice(words) + (f"_{random.randint(1,99)}" if random.random() > 0.5 else ""),
            "damage": float(random.randint(10, 500)),
            "lifespan_str": lifespan_str,
            "created_at_iso": created_at.isoformat(),
            "lifespan_seconds": lifespan_sec,
            "decay_constant": calculate_decay_constant(lifespan_sec)
        }
        terms.append(term)
        
    # Generate 5 events
    for _ in range(5):
        created_delta = random.randint(0, 30*24*60*60)
        created_at = launch + timedelta(seconds=created_delta)
        
        lifespan_hours = random.randint(1, 48)
        lifespan_str = f"{lifespan_hours}h"
        
        evt = {
            "id": str(uuid.uuid4()),
            "name": random.choice(event_names),
            "damage": float(random.randint(100, 1000)),
            "lifespan_str": lifespan_str,
            "created_at_iso": created_at.isoformat(),
            "lifespan_seconds": lifespan_hours * 3600
        }
        events.append(evt)
        
    db['terms'] = terms
    db['events'] = events
    save_db(db, mode)
    
    return {"success": True, "message": "Mock data generated"}

def compute_term_value(term: Dict, at_time: datetime) -> float:
    # Exponential Decay
    created = datetime.fromisoformat(term['created_at_iso'])
    if at_time.tzinfo is not None and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
        
    delta = (at_time - created).total_seconds()
    
    if delta < 0: return 0 
    
    damage = term['damage']
    k = term['decay_constant']
    
    val = damage * math.exp(-k * delta)
    return max(0, val)

def compute_event_value(event: Dict, at_time: datetime) -> float:
    # Linear Decay to 0 at lifespan
    created = datetime.fromisoformat(event['created_at_iso'])
    if at_time.tzinfo is not None and created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
        
    delta = (at_time - created).total_seconds()
    
    if delta < 0: return 0
    lifespan = event['lifespan_seconds']
    
    if delta >= lifespan:
        return 0
    
    # V(t) = D * (1 - t/L)
    val = event['damage'] * (1 - (delta / lifespan))
    return max(0, val)

@router.get("/term_history/{term_id}")
def get_term_history(term_id: str, mode: str = Query("real")):
    db = get_db(mode)
    term = next((t for t in db['terms'] if t['id'] == term_id), None)
    if not term:
        raise HTTPException(status_code=404, detail="Term not found")
        
    created = datetime.fromisoformat(term['created_at_iso'])
    if created.tzinfo is None: created = created.replace(tzinfo=timezone.utc)
    
    # Show history up to NOW, regardless of lifespan
    now = datetime.now(timezone.utc)
    end_time = now
    
    points = 50
    delta = (end_time - created).total_seconds()
    if delta <= 0: return []
    step = delta / points
    
    history = []
    for i in range(points + 1):
        t_point = created + timedelta(seconds=step*i)
        val = compute_term_value(term, t_point)
        history.append({"date": t_point.isoformat(), "value": val})
        
    return history

@router.get("/event_history/{event_id}")
def get_event_history(event_id: str, mode: str = Query("real")):
    db = get_db(mode)
    event = next((e for e in db['events'] if e['id'] == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    created = datetime.fromisoformat(event['created_at_iso'])
    if created.tzinfo is None: created = created.replace(tzinfo=timezone.utc)
    
    # For events (linear decay), we might want to show past the zero point or stop at 0?
    # User asked for "graphs appear on click", implying similar behavior.
    # Linear decay goes to 0 and stays there.
    now = datetime.now(timezone.utc)
    end_time = now
    
    points = 50
    delta = (end_time - created).total_seconds()
    if delta <= 0: return []
    step = delta / points
    
    history = []
    for i in range(points + 1):
        t_point = created + timedelta(seconds=step*i)
        val = compute_event_value(event, t_point)
        history.append({"date": t_point.isoformat(), "value": val})
        
    return history
