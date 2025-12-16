import csv
import os
import shutil
from typing import List, Dict, Any, Union

# Define paths
NEXUS_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "nexus_portfolios.csv")
PORTFOLIO_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "portfolio_codes_database.csv")

def read_nexus_codes() -> List[Dict[str, Any]]:
    codes = []
    if not os.path.exists(NEXUS_DB_PATH):
        return []
    
    with open(NEXUS_DB_PATH, mode='r', newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader, None) # Skip header
        if not header: return []
        
        for row in reader:
            if not row or len(row) < 3: continue
            
            nexus_code = row[0]
            try:
                num_components = int(row[1])
                frac_shares = row[2].lower() == 'true'
                components = []
                
                # Components start from index 3, 3 items per component (Type, Value, Weight)
                current_idx = 3
                for _ in range(num_components):
                    if current_idx + 2 < len(row):
                        c_type = row[current_idx]
                        c_val = row[current_idx+1]
                        c_weight = float(row[current_idx+2])
                        components.append({
                            "type": c_type,
                            "value": c_val,
                            "weight": c_weight
                        })
                        current_idx += 3
                
                codes.append({
                    "id": nexus_code, # Use code as ID
                    "type": "nexus",
                    "nexus_code": nexus_code,
                    "num_components": num_components,
                    "frac_shares": frac_shares,
                    "components": components
                })
            except Exception as e:
                print(f"Error parsing nexus row {row}: {e}")
                continue
    return codes

def read_portfolio_codes() -> List[Dict[str, Any]]:
    codes = []
    if not os.path.exists(PORTFOLIO_DB_PATH):
        return []

    with open(PORTFOLIO_DB_PATH, mode='r', newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        # Handle cases where header might be missing or complex
        # We assume standard header present based on file inspection
        header = next(reader, None)
        if not header: return []

        for row in reader:
            if not row or len(row) < 8: continue
            
            try:
                portfolio_code = row[0]
                ema_sens = int(row[1])
                amp = float(row[2])
                num_portfolios = int(row[3])
                # frac_shares in portfolio db is 'yes'/'no' usually or true/false
                frac_shares = row[4].lower() in ['yes', 'true']
                risk_tol = row[5]
                risk_type = row[6]
                remove_cap = row[7].lower() in ['yes', 'true']
                user_id = row[8] if len(row) > 8 else ""
                
                components = []
                # Components start from index 9, 2 items per component (Tickers, Weight)
                current_idx = 9
                for _ in range(num_portfolios):
                    if current_idx + 1 < len(row):
                        tickers = row[current_idx]
                        weight = float(row[current_idx+1])
                        components.append({
                            "tickers": tickers, # specific key for portfolio
                            "weight": weight
                        })
                        current_idx += 2
                
                codes.append({
                    "id": portfolio_code,
                    "type": "portfolio",
                    "portfolio_code": portfolio_code,
                    "ema_sensitivity": ema_sens,
                    "amplification": amp,
                    "frac_shares": frac_shares,
                    "risk_tolerance": risk_tol,
                    "risk_type": risk_type,
                    "remove_amplification_cap": remove_cap,
                    "user_id": user_id,
                    "components": components
                })
            except Exception as e:
                print(f"Error parsing portfolio row {row}: {e}")
                continue
    return codes

def save_nexus_code(data: Dict[str, Any]):
    # Read existing
    all_codes = read_nexus_codes()
    # Remove existing if any
    all_codes = [c for c in all_codes if c['nexus_code'] != data['nexus_code']]
    # Append new
    all_codes.append(data)
    
    # Write back
    header = ["nexus_code", "num_components", "frac_shares", 
              "component_1_type", "component_1_value", "component_1_weight",
              "component_2_type", "component_2_value", "component_2_weight",
              "component_3_type", "component_3_value", "component_3_weight",
              "component_4_type", "component_4_value", "component_4_weight",
              "component_5_type", "component_5_value", "component_5_weight"] # extended header

    with open(NEXUS_DB_PATH, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        
        for c in all_codes:
            row = [
                c['nexus_code'],
                len(c['components']),
                str(c['frac_shares']).lower()
            ]
            for comp in c['components']:
                row.extend([comp['type'], comp['value'], comp['weight']])
            writer.writerow(row)

def save_portfolio_code(data: Dict[str, Any]):
    # Read existing
    all_codes = read_portfolio_codes()
    # Remove existing if any
    all_codes = [c for c in all_codes if c['portfolio_code'] != data['portfolio_code']]
    # Append new
    all_codes.append(data)
    
    # Write back
    header = ["portfolio_code","ema_sensitivity","amplification","num_portfolios",
              "frac_shares","risk_tolerance","risk_type","remove_amplification_cap",
              "user_id",
              "tickers_1","weight_1","tickers_2","weight_2","tickers_3","weight_3",
              "tickers_4","weight_4","tickers_5","weight_5","tickers_6","weight_6",
              "tickers_7","weight_7","tickers_8","weight_8","tickers_9","weight_9",
              "tickers_10","weight_10"]

    with open(PORTFOLIO_DB_PATH, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        
        for c in all_codes:
            frac = 'yes' if c['frac_shares'] else 'no'
            cap = 'true' if c['remove_amplification_cap'] else 'false'
            
            row = [
                c['portfolio_code'],
                c['ema_sensitivity'],
                c['amplification'],
                len(c['components']),
                frac,
                c['risk_tolerance'],
                c['risk_type'],
                cap,
                c.get('user_id', '')
            ]
            for comp in c['components']:
                row.extend([comp['tickers'], comp['weight']])
            writer.writerow(row)

def delete_code(code_type: str, code_id: str):
    if code_type == "nexus":
        all_codes = read_nexus_codes()
        all_codes = [c for c in all_codes if c['nexus_code'] != code_id]
        
        # Write back (Reuse save logic partially or plain write)
        # Easier to reuse the write logic from save but we need to pass full list.
        # Let's just reimplement simple write here to avoid circular dep or changing save sig significantly
        header = ["nexus_code", "num_components", "frac_shares", 
              "component_1_type", "component_1_value", "component_1_weight",
              "component_2_type", "component_2_value", "component_2_weight"] # simplified
        
        with open(NEXUS_DB_PATH, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(header)
            for c in all_codes:
                row = [c['nexus_code'], len(c['components']), str(c['frac_shares']).lower()]
                for comp in c['components']:
                     row.extend([comp['type'], comp['value'], comp['weight']])
                writer.writerow(row)
                
    elif code_type == "portfolio":
        all_codes = read_portfolio_codes()
        all_codes = [c for c in all_codes if c['portfolio_code'] != code_id]
        
        header = ["portfolio_code","ema_sensitivity","amplification","num_portfolios",
              "frac_shares","risk_tolerance","risk_type","remove_amplification_cap",
              "user_id",
              "tickers_1","weight_1","tickers_2","weight_2","tickers_3","weight_3",
              "tickers_4","weight_4","tickers_5","weight_5","tickers_6","weight_6",
              "tickers_7","weight_7","tickers_8","weight_8","tickers_9","weight_9",
              "tickers_10","weight_10"]
        
        with open(PORTFOLIO_DB_PATH, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(header)
            for c in all_codes:
                frac = 'yes' if c['frac_shares'] else 'no'
                cap = 'true' if c['remove_amplification_cap'] else 'false'
                row = [
                    c['portfolio_code'], c['ema_sensitivity'], c['amplification'],
                    len(c['components']), frac, c['risk_tolerance'], c['risk_type'],
                    cap, c.get('user_id', '')
                ]
                for comp in c['components']:
                    row.extend([comp['tickers'], comp['weight']])
                writer.writerow(row)
