# --- Imports for history_command ---
import os
import csv
import json
from typing import List, Dict, Optional
import pandas as pd

# --- Constants ---
RISK_CSV_FILE = 'market_data.csv'

# --- Core Logic ---

async def get_risk_history_data(is_called_by_ai: bool = False):
    """
    Reads the market_data.csv and returns structured JSON data for the frontend charts.
    """
    if not os.path.exists(RISK_CSV_FILE):
        return [] # Return empty list instead of error dict to prevent frontend crash

    try:
        df = pd.read_csv(RISK_CSV_FILE, on_bad_lines='skip')
        if df.empty:
            return []

        # Ensure Timestamp is sorted
        df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
        df = df.sort_values(by='Timestamp').dropna(subset=['Timestamp'])
        
        # Convert to list of dicts for JSON response
        # We replace NaN with None (which becomes null in JSON)
        result = df.where(pd.notnull(df), None).to_dict(orient='records')
        
        return result

    except Exception as e:
        print(f"❌ An error occurred reading history: {e}")
        return {"error": str(e)}

# --- Main Command Handler ---

async def handle_history_command(args: List[str], ai_params: Optional[Dict] = None, is_called_by_ai: bool = False):
    """
    Handles the /history command by returning the data.
    """
    data = await get_risk_history_data(is_called_by_ai=is_called_by_ai)
    return data