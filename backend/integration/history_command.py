# --- Imports for history_command ---
import os
import csv
import json
from typing import List, Dict, Optional
import pandas as pd
try:
    from backend.usage_counter import increment_usage
except ImportError:
    try:
        from usage_counter import increment_usage
    except ImportError:
        def increment_usage(*args): pass

# --- Constants ---
# FIX: Use absolute path to ensure file is found regardless of CWD (integration/ -> backend/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RISK_CSV_FILE = os.path.join(BASE_DIR, 'market_data.csv')

# --- Core Logic ---

async def get_risk_history_data(is_called_by_ai: bool = False):
    """
    Reads the market_data.csv and returns structured JSON data for the frontend charts.
    """
    if not os.path.exists(RISK_CSV_FILE):
        return [] # Return empty list if file doesn't exist

    try:
        df = pd.read_csv(RISK_CSV_FILE, on_bad_lines='skip')
        if df.empty:
            return []

        # Ensure Timestamp is sorted
        df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
        df = df.sort_values(by='Timestamp').dropna(subset=['Timestamp'])

        # --- FIX: Filter Erroneous 0 Values ---
        # User requested to remove "erroneous 0 values".
        # Replacing 0 with None (null) causes frontend charts (Recharts/Chart.js) to break the line
        # instead of dipping to 0, which is accurate for missing data.
        cols_to_fix = ['EMA Chance', 'VIX Chance', 'Contraction Probability', 'Combined Prob']
        for col in cols_to_fix:
            if col in df.columns:
                df[col] = df[col].replace({0: None, 0.0: None})
        
        # Also clean up general NaNs to None for JSON compliance
        df = df.where(pd.notnull(df), None)
        
        # --- FIX: Serialization Issue ---
        # df.to_dict() often preserves NumPy types (int64, float64) which fail to serialize 
        # in FastAPI/Uvicorn, causing a 500 Error.
        # Using df.to_json() with date_format='iso' converts everything to standard JSON-safe strings/numbers.
        json_str = df.to_json(orient='records', date_format='iso')
        result = json.loads(json_str)
        
        return result

    except Exception as e:
        print(f"❌ An error occurred reading history: {e}")
        # Return a dictionary with error info instead of crashing
        return {"error": str(e)}

# --- Main Command Handler ---

async def handle_history_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
    """
    Handles the /history command by returning the data.
    """
    await increment_usage('history')
    data = await get_risk_history_data(is_called_by_ai=is_called_by_ai)
    return data