# --- Imports for mlforecast_command ---
import asyncio
import uuid
import traceback
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any

import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from tabulate import tabulate
# Set non-interactive backend for server environments
plt.switch_backend('Agg')
try:
    from backend.usage_counter import increment_usage
except ImportError:
    try:
        from usage_counter import increment_usage
    except ImportError:
        def increment_usage(*args): pass

# --- Helper Function 1: Technical Indicators (from Singularity) ---
def calculate_technical_indicators(data: pd.DataFrame, freq: str = 'D') -> pd.DataFrame:
    """
    Calculates a set of technical indicators and adds them to the DataFrame.
    This version is from the main Singularity 19.09.25 file.
    freq: 'D' for daily, 'W' for weekly. Affects window sizes.
    """
    try:
        if 'Close' not in data.columns:
            raise KeyError("Required 'Close' column not found.")
        
        # 1. 14-day RSI (Relative Strength Index)
        # Use 14 periods for daily, 3 periods for weekly (~14-15 days)
        rsi_window = 14 if freq == 'D' else 3
        delta = data['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=rsi_window).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=rsi_window).mean()
        with np.errstate(divide='ignore', invalid='ignore'):
            rs = gain / loss
        rs.replace([np.inf], 999999, inplace=True)
        rs.fillna(0, inplace=True)
        data['RSI'] = 100 - (100 / (1 + rs))

        # 2. MACD value and MACD signal line (EWM spans are less freq-dependent)
        exp1 = data['Close'].ewm(span=12, adjust=False).mean()
        exp2 = data['Close'].ewm(span=26, adjust=False).mean()
        data['MACD'] = exp1 - exp2
        data['MACD_Signal'] = data['MACD'].ewm(span=9, adjust=False).mean()

        # 3. The percentage difference between the 50-day and 200-day SMAs
        # Use 50/200 for daily, 10/40 for weekly (approx 50/200 trading days)
        sma50_window = 50 if freq == 'D' else 10
        sma200_window = 200 if freq == 'D' else 40
        sma50 = data['Close'].rolling(window=sma50_window).mean()
        sma200 = data['Close'].rolling(window=sma200_window).mean()
        data['SMA_Diff'] = ((sma50 - sma200) / sma200) * 100

        # 4. 30-day historical volatility
        # Use 30 for daily, 6 for weekly (approx 30 trading days)
        vol_window = 30 if freq == 'D' else 6
        # Annualization factor
        ann_factor = np.sqrt(252) if freq == 'D' else np.sqrt(52)
        data['Volatility'] = data['Close'].pct_change().rolling(window=vol_window).std() * ann_factor
        
        return data
    except Exception:
        # Return original dataframe if indicators fail, allowing downstream to handle missing columns
        return data

# --- Helper Function 2: Graph Plotting (from Singularity) ---
def plot_advanced_forecast_graph(ticker, historical_data, forecast_points, weekly_forecast_points=None):
    """
    Generates and saves a graph showing historical prices, a predictive weekly
    forecast path, and the key forecast points that anchor the path.
    This version is from the main Singularity 19.09.25 file.
    """
    try:
        plt.style.use('dark_background')
        fig, ax = plt.subplots(figsize=(14, 8))

        past_year_data = historical_data.iloc[-252:]
        ax.plot(past_year_data.index, past_year_data['Close'], 
               label='Past Year Price', color='grey', linewidth=1.5)
        
        last_date = past_year_data.index[-1]
        last_price = past_year_data['Close'].iloc[-1]
        
        # Plot the adjusted weekly forecast path
        if weekly_forecast_points:
            weekly_dates = [p['date'] for p in weekly_forecast_points]
            weekly_prices = [p['price'] for p in weekly_forecast_points]
            complete_weekly_dates = [last_date] + weekly_dates
            complete_weekly_prices = [last_price] + weekly_prices
            ax.plot(complete_weekly_dates, complete_weekly_prices, 
                   label='Adjusted Weekly Forecast Path', linestyle=':', color='yellow', 
                   linewidth=1.5, alpha=0.9)

        # Plot the main, annotated forecast points
        if forecast_points:
            forecast_points.sort(key=lambda p: p['date'])
            forecast_dates = [fp['date'] for fp in forecast_points]
            forecast_prices = [fp['price'] for fp in forecast_points]
            
            ax.plot(forecast_dates, forecast_prices, 
                   label='Key Forecasts (Anchors)', linestyle='None', color='cyan', 
                   marker='o', markersize=8, markerfacecolor='cyan')

            for fp in forecast_points:
                ax.annotate(f"${fp['price']:.2f}",
                            xy=(fp['date'], fp['price']),
                            xytext=(5, -15), textcoords='offset points',
                            color='cyan', fontsize=10, fontweight='bold',
                            bbox=dict(boxstyle='round,pad=0.3', facecolor='black', 
                                    edgecolor='cyan', alpha=0.7))
            
            # Set X-Axis to a Fixed 2-Year Span
            axis_start_date = last_date - pd.Timedelta(days=365)
            axis_end_date = last_date + pd.Timedelta(days=365)
            ax.set_xlim(axis_start_date, axis_end_date)
        
        # Finalize Plot
        ax.set_title(f"{ticker} Price History and Multi-Period Forecast", 
                    color='white', fontsize=16, fontweight='bold')
        ax.set_xlabel("Date", color='white', fontsize=12)
        ax.set_ylabel("Price (USD)", color='white', fontsize=12)
        ax.legend(facecolor='black', edgecolor='white', labelcolor='white', 
                 framealpha=0.8, loc='upper left')
        ax.grid(True, color='dimgray', linestyle='-', linewidth=0.3, alpha=0.3)
        ax.tick_params(axis='x', colors='white', rotation=45, labelsize=10)
        ax.tick_params(axis='y', colors='white', labelsize=10)
        
        for spine in ax.spines.values():
            spine.set_color('white')
        
        fig.tight_layout()

        # Define Static Directory
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        STATIC_DIR = os.path.join(BASE_DIR, "static")
        if not os.path.exists(STATIC_DIR):
            os.makedirs(STATIC_DIR)
            
        filename = f"ml_advanced_forecast_{ticker}_{uuid.uuid4().hex[:6]}.png"
        filepath = os.path.join(STATIC_DIR, filename)
        
        plt.savefig(filepath, facecolor='black', edgecolor='black', dpi=300, 
                   bbox_inches='tight')
        plt.close(fig)
        print(f"📂 Advanced forecast graph saved: {filename}")
        return filename
        
    except Exception as e:
        print(f"❌ An error occurred during graph plotting: {e}")
        traceback.print_exc()
        return None

# --- Main Command Handler (from Singularity, with MultiIndex fix) ---
# --- Main Command Handler (from Singularity, with MultiIndex fix) ---
# --- Main Command Handler (from Singularity, with MultiIndex fix) ---
async def handle_mlforecast_command(args: List[str] = None, ai_params: dict = None, is_called_by_ai: bool = False):
    """
    Handles the /mlforecast command. Supports batch processing via 'tickers_source'.
    """


    await increment_usage('mlforecast')
    # print("[DEBUG] Skipped increment_usage")

    
    tickers = []
    if is_called_by_ai and ai_params:
        # Check for list source first
        source = ai_params.get("tickers_source")
        if isinstance(source, list):
            tickers = source
        elif isinstance(source, str):
            if "," in source: tickers = [t.strip().upper() for t in source.split(",")]
            else: tickers = [source.upper()]
        
        # Fallback to single ticker
        if not tickers and ai_params.get("ticker"):
            tickers = [ai_params.get("ticker")]
            
    elif args:
        # Check if args[0] contains commas
        if "," in args[0]:
            tickers = [t.strip().upper() for t in args[0].split(",")]
        else:
            tickers = [args[0].upper()]
    else:
        ticker_input = input("Enter the stock ticker for the ML forecast: ")
        if ticker_input.strip():
             tickers = [ticker_input.strip().upper()]

    if not tickers:
        message = "Usage: /mlforecast <TICKER> or <TICKER1,TICKER2...>"
        if not is_called_by_ai: print(message)
        return {"error": message} if is_called_by_ai else None

    aggregated_table = []
    last_graph = None
    
    # Process tickers in parallel
    tasks = [_run_single_forecast_impl(t, is_called_by_ai, ai_params) for t in tickers]
    results = await asyncio.gather(*tasks, return_exceptions=True)


    for i, res in enumerate(results):
        if isinstance(res, Exception):
            print(f"Error processing {tickers[i]}: {res}")
            traceback.print_exc()

        elif res and isinstance(res, dict):
            if "error" in res:
                print(f"Error processing {tickers[i]}: {res['error']}")
            if "table" in res: aggregated_table.extend(res["table"])
            if "graph" in res: last_graph = res["graph"]

    if is_called_by_ai:
        if not aggregated_table and not last_graph:
             # Check if we have errors for all tickers
             if len(results) > 0 and all(isinstance(r, Exception) or (isinstance(r, dict) and "error" in r) for r in results):
                 return {"error": "All tickers failed to process."}
        return {"table": aggregated_table, "graph": last_graph}
        
# Internal helper function containing the original logic
async def _run_single_forecast_impl(ticker: str, is_called_by_ai: bool, ai_params: dict = None):

    if not is_called_by_ai:
        print("\n--- Advanced Machine Learning Price Forecast ---")
        print(f"-> Running advanced forecast for {ticker}...")



    try:
        # 1. Data Fetching and Prep
        data_daily = pd.DataFrame()
        
        # --- START OF FIX: Robust Retry Logic ---
        fetch_periods_map = {"10-Year": "10y", "5-Year": "5y", "3-Year": "3y", "1-Year": "1y"}
        successful_period_name = None
        
        for period_name, period_str in fetch_periods_map.items():
            if not is_called_by_ai: print(f"-> Attempting to fetch {period_name} of historical data...")
            
            for attempt in range(3):
                try:
                    # Retry logic with exponential backoff
                    await asyncio.sleep(0.5 * (attempt + 1))
                    
                    # Use Ticker object for better isolation than yf.download
                    ticker_obj = yf.Ticker(ticker)

                    temp_data = await asyncio.to_thread(
                        ticker_obj.history, period=period_str, auto_adjust=True
                    )
                    
                    if not temp_data.empty and len(temp_data) > 504: # Need > 2 years of data for 1-year forecast
                        data_daily = temp_data
                        successful_period_name = period_name
                        if not is_called_by_ai: print(f"   -> Successfully fetched {successful_period_name} of data.")
                        break # Break retry loop
                except Exception as e:
                    if not is_called_by_ai: print(f"   -> Retry {attempt+1}/{3} failed for {period_name}: {e}")
                    await asyncio.sleep(1.0 * (attempt + 1))
            
            if not data_daily.empty:
                break # Break period loop if success
        # --- END OF FIX ---
        
        if data_daily.empty:
            message = f"❌ Error: Not enough historical data found for {ticker} to perform a forecast."
            if not is_called_by_ai: print(message)
            return {"error": message} if is_called_by_ai else None

        # --- CRITICAL FIX: Flatten MultiIndex columns right after download ---
        if isinstance(data_daily.columns, pd.MultiIndex):
            data_daily.columns = data_daily.columns.get_level_values(0)
        # --- END OF FIX ---

        # --- FIX: Resample and drop NaN weeks to avoid sparse data issues ---
        data_weekly = data_daily.resample('W-FRI').last().dropna(subset=['Close'])
        # --- END FIX ---
        
        all_forecast_horizons = {
            "5-Day": {"days": 5, "data": data_daily, "min_hist_days": 90},
            "1-Month (21-Day)": {"days": 21, "data": data_daily, "min_hist_days": 180},
            "3-Month (63-Day)": {"days": 63, "data": data_daily, "min_hist_days": 365},
            "6-Month (26-Week)": {"days": 26, "data": data_weekly, "min_hist_days": 1095}, # ~2 years of weekly data
            "1-Year (52-Week)": {"days": 52, "data": data_weekly, "min_hist_days": 1825}, # ~3.5 years of weekly data
        }
        
        available_data_days = (data_daily.index[-1] - data_daily.index[0]).days
        forecast_horizons_to_run = {
            name: params for name, params in all_forecast_horizons.items()
            if available_data_days >= params["min_hist_days"]
        }

        if not forecast_horizons_to_run:
            message = f"❌ Error: The fetched data ({successful_period_name}) is not sufficient for any forecast horizons."
            if not is_called_by_ai: print(message)
            return {"error": message} if is_called_by_ai else None

        results, forecast_points, weekly_forecast_points_raw = [], [], []
        last_price = data_daily['Close'].iloc[-1]
        true_last_date = data_daily.index[-1]

        # 2. Generate Key Forecasts
        for period_name, params in forecast_horizons_to_run.items():
            if not is_called_by_ai: print(f"\n-> Processing {period_name} forecast...")
            horizon, data = params["days"], params["data"].copy()
            
            # --- FIX: Determine frequency and pass to indicator function ---
            freq_unit = 'W' if params["data"] is data_weekly else 'D'
            data = calculate_technical_indicators(data, freq=freq_unit)
            # --- END FIX ---

            features = ['RSI', 'MACD', 'MACD_Signal', 'SMA_Diff', 'Volatility']
            
            if not all(feature in data.columns and not data[feature].isnull().all() for feature in features):
                if not is_called_by_ai: print(f"   -> Skipping {period_name}: Missing one or more required technical indicators.")
                continue

            data['Future_Close'] = data['Close'].shift(-horizon)
            data['Pct_Change'] = (data['Future_Close'] - data['Close']) / data['Close']
            data['Direction'] = (data['Future_Close'] > data['Close']).astype(int)
            data.dropna(subset=features + ['Direction', 'Pct_Change'], inplace=True)

            if len(data) < 50:
                if not is_called_by_ai: print(f"   -> Skipping {period_name}: Not enough training data ({len(data)} rows).")
                continue

            X, y_direction, y_magnitude = data[features], data['Direction'], data['Pct_Change']
            clf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1).fit(X, y_direction)
            reg = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1).fit(X, y_magnitude)
            
            last_features = X.iloc[-1:]
            direction_pred = clf.predict(last_features)[0]
            confidence = clf.predict_proba(last_features)[0][direction_pred] * 100
            magnitude_pred = reg.predict(last_features)[0] * 100
            
            results.append({"Ticker": ticker, "Period": period_name, "Prediction": "UP" if direction_pred == 1 else "DOWN", "Confidence": f"{confidence:.0f}%", "Est. % Change": f"{magnitude_pred:+.2f}%"})
            
            # Use the freq_unit variable defined above
            forecast_date = true_last_date + pd.Timedelta(weeks=horizon) if freq_unit == 'W' else true_last_date + pd.Timedelta(days=horizon)
            forecast_price = last_price * (1 + (magnitude_pred / 100))
            forecast_points.append({'date': forecast_date, 'price': forecast_price})

        if is_called_by_ai:
            pass # Continue to step 3 instead of returning early


        # 3. Generate Detailed Weekly Forecast Path with Realistic Variation
        # Use daily interpolation with volatility-based noise for a more natural look
        if not is_called_by_ai: print("\n-> Generating detailed forecast path...")
        
        # Calculate historical daily volatility for realistic noise
        daily_returns = data_daily['Close'].pct_change().dropna()
        hist_volatility = daily_returns.std()  # Daily volatility
        
        # Collect all key points: [Start] + [Anchors sorted by date]
        key_points = {true_last_date: last_price}
        for pt in forecast_points:
            key_points[pt['date']] = pt['price']
            
        sorted_dates = sorted(key_points.keys())
        adjusted_weekly_path = []
        
        # Use a seeded random generator for reproducibility
        rng = np.random.default_rng(seed=42)
        
        # Interpolate between each segment with daily resolution
        for i in range(len(sorted_dates) - 1):
            start_date = sorted_dates[i]
            end_date = sorted_dates[i+1]
            start_price = key_points[start_date]
            end_price = key_points[end_date]
            
            days_diff = (end_date - start_date).days
            if days_diff <= 0: continue
            
            # Calculate daily log return for this segment
            if start_price <= 0 or end_price <= 0:
                growth_rate = 0
            else:
                growth_rate = np.log(end_price / start_price) / days_diff
            
            # Generate daily points with controlled noise
            # Noise should sum to zero over the segment to hit the target exactly
            segment_noise = rng.normal(0, hist_volatility * 0.3, days_diff)  # Damped volatility
            # Adjust noise to ensure we hit the end target (drift correction)
            cumulative_noise = np.cumsum(segment_noise)
            if len(cumulative_noise) > 0:
                correction = cumulative_noise[-1] / days_diff
                segment_noise = segment_noise - correction
            
            current_sim_date = start_date
            day_idx = 0
            cumulative_noise_effect = 0
            
            while current_sim_date < end_date:
                dt = (current_sim_date - start_date).days
                
                # Base interpolated price
                base_price = start_price * np.exp(growth_rate * dt)
                
                # Add accumulated noise effect (makes the path wavy but still reaches target)
                if day_idx < len(segment_noise):
                    cumulative_noise_effect += segment_noise[day_idx]
                
                noisy_price = base_price * (1 + cumulative_noise_effect)
                
                # Add point (skip start to avoid dupes)
                if current_sim_date > start_date:
                    adjusted_weekly_path.append({
                        'date': current_sim_date, 
                        'price': max(noisy_price, 0.01)  # Ensure positive price
                    })
                
                # Daily resolution
                current_sim_date += pd.Timedelta(days=1)
                day_idx += 1
                
        # Add final point exactly
        adjusted_weekly_path.append({'date': sorted_dates[-1], 'price': key_points[sorted_dates[-1]]})
        if not is_called_by_ai: print(f"   -> Generated {len(adjusted_weekly_path)} forecast points.")

        # 5. Output Final Results
        print("\n" + "="*80)
        print(f"--- Advanced Forecast Results for {ticker} (based on {successful_period_name} of data) ---")
        graph_filename = None
        if results:
            if not is_called_by_ai: print(tabulate(results, headers="keys", tablefmt="pretty"))
            
            # Check if graph generation should be skipped
            skip_graph = False
            if is_called_by_ai and ai_params and ai_params.get("skip_graph"):
                 skip_graph = True

            if not skip_graph:
                if not is_called_by_ai: print("\n-> Generating forecast graph...")
                graph_filename = plot_advanced_forecast_graph(ticker, data_daily, forecast_points, adjusted_weekly_path)
            
            if is_called_by_ai:
                # Prepare Chart Data
                # Historical (Last 1 Year)
                hist_context = data_daily.iloc[-365:].copy().reset_index()
                # Handle unknown column names for Date
                d_col = 'Date' if 'Date' in hist_context.columns else hist_context.columns[0]
                
                chart_data_hist = []
                for _, row in hist_context.iterrows():
                    d_val = row[d_col]
                    d_str = d_val.isoformat() if hasattr(d_val, 'isoformat') else str(d_val)
                    chart_data_hist.append({"date": d_str, "price": float(row['Close'])})
                
                chart_data_forecast = []
                for pt in adjusted_weekly_path:
                    d_str = pt['date'].isoformat()
                    chart_data_forecast.append({"date": d_str, "price": float(pt['price'])})
                    
                chart_anchors = []
                # Map periods to labels roughly based on duration or just pass index
                # Simpler: just pass the point, frontend can show price/date
                for idx, pt in enumerate(forecast_points):
                    chart_anchors.append({
                        "date": pt['date'].isoformat(),
                        "price": float(pt['price']),
                        "label": f"Target {idx+1}" # Simple label
                    })

                return {
                    "table": results, 
                    "graph": graph_filename,
                    "chart_data": {
                        "historical": chart_data_hist,
                        "forecast": chart_data_forecast,
                        "anchors": chart_anchors
                    }
                }
        else:
            if not is_called_by_ai: print("Could not generate any forecasts due to insufficient data across all time horizons.")
            if is_called_by_ai: return {"error": "Insufficient data"}
        print("="*80)

    except Exception as e:
        message = f"❌ An unexpected error occurred during the forecast: {e}"
        print(message)
        traceback.print_exc()
        return {"error": message} if is_called_by_ai else None