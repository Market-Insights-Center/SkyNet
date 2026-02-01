# --- Imports for powerscore_command ---
import asyncio
import traceback
import math
from typing import List, Dict, Any, Optional, Tuple
import random
import configparser

import yfinance as yf
import numpy as np
import pandas as pd
from tabulate import tabulate
from scipy.stats import percentileofscore
from sklearn.ensemble import RandomForestRegressor

from backend.ai_service import ai

# --- Imports from other command modules ---
from backend.integration.invest_command import calculate_ema_invest
from backend.integration.sentiment_command import handle_sentiment_command, GEMINI_API_LOCK
try:
    from backend.usage_counter import increment_usage
except ImportError:
    try:
        from usage_counter import increment_usage
    except ImportError:
        def increment_usage(*args): pass

# --- Global Variables & Constants ---
YFINANCE_API_SEMAPHORE = asyncio.Semaphore(8)

# --- Helper Functions ---

class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'

async def fetch_step_with_retry(step_name: str, coro_func, *args, retries=3, **kwargs):
    """
    Executes a specific scoring step with dedicated retries and verbose logging.
    Executes sequentially (await) to ensure isolation.
    """
    print(f"   [DEBUG] Starting Step: {step_name}...")
    
    for attempt in range(1, retries + 1):
        try:
            result = await coro_func(*args, **kwargs)
            
            if result is None:
                # Some functions might legitimately return None (e.g. error caught internally),
                # but usually we want to know.
                print(f"   [DEBUG] {step_name} returned None (Attempt {attempt})")
            else:
                print(f"   [DEBUG] {step_name} -> SUCCESS (Attempt {attempt})")
            
            return result
            
        except Exception as e:
            print(f"   [DEBUG] {step_name} -> FAILED (Attempt {attempt}/{retries}): {type(e).__name__} - {str(e)}")
            # traceback.print_exc() # Uncomment if you need full stack traces
            if attempt < retries:
                wait_time = (2 ** (attempt - 1)) + random.uniform(0, 0.5)
                print(f"   [DEBUG] Waiting {wait_time:.2f}s before retry...")
                await asyncio.sleep(wait_time)
            else:
                print(f"   [DEBUG] {step_name} -> PERMANENT FAILURE after {retries} attempts.")
    
    return None

def safe_get(data_dict: Dict, key: str, default: Any = None) -> Any:
    value = data_dict.get(key, default)
    return default if value is None or value == 'None' else value

async def get_yfinance_info_robustly(ticker: str) -> Optional[Dict[str, Any]]:
    async with YFINANCE_API_SEMAPHORE:
        for attempt in range(3):
            try:
                await asyncio.sleep(random.uniform(0.2, 0.5))
                stock_info = await asyncio.to_thread(lambda: yf.Ticker(ticker).info)
                if stock_info and ('regularMarketPrice' in stock_info or 'currentPrice' in stock_info):
                    return stock_info
                else:
                    raise ValueError(f"Incomplete data received for {ticker}")
            except Exception as e:
                if attempt < 2:
                    await asyncio.sleep((attempt + 1) * 2)
        return None 

async def get_yf_download_robustly(tickers: list, **kwargs) -> pd.DataFrame:
    max_retries = 3
    for attempt in range(max_retries):
        try:
            await asyncio.sleep(random.uniform(0.3, 0.7)) 
            kwargs.setdefault('progress', False)
            kwargs.setdefault('auto_adjust', True) 
            
            print(f"   [DEBUG_YF] Downloading data for {tickers} with kwargs: {kwargs}...")
            data = await asyncio.to_thread(yf.download, tickers=tickers, **kwargs)

            if data.empty:
                print(f"   [DEBUG_YF] Returned EMPTY dataframe for {tickers}. Retrying with auto_adjust=False...")
                # Automatic fallback for common yfinance bug
                kwargs['auto_adjust'] = False
                data = await asyncio.to_thread(yf.download, tickers=tickers, **kwargs)

            if data.empty and len(tickers) == 1:
                 raise IOError(f"yf.download returned empty DataFrame for single ticker: {tickers[0]}")
            
            print(f"   [DEBUG_YF] Success. Downloaded {len(data)} rows for {tickers}.")
            return data 
        except Exception as e:
            if attempt < max_retries - 1:
                delay = (attempt + 1) * 3 
                print(f"   -> WARNING: yf.download failed (Attempt {attempt+1}/{max_retries}). Error: {e}. Retrying in {delay}s...")
                await asyncio.sleep(delay)
            else:
                print(f"   -> ❌ ERROR: All yfinance download attempts failed for {tickers}. Last error: {type(e).__name__} - {e}")
                return pd.DataFrame() 
    return pd.DataFrame() 

async def get_yf_data_singularity(tickers: List[str], period: str = "10y", interval: str = "1d", is_called_by_ai: bool = False) -> pd.DataFrame:
    if not tickers: return pd.DataFrame()
    data = await get_yf_download_robustly(
        tickers=list(set(tickers)), period=period, interval=interval,
        group_by='ticker', timeout=30
    )
    if data.empty: return pd.DataFrame()

    all_series = []
    if isinstance(data.columns, pd.MultiIndex):
        for ticker_name in list(set(tickers)): 
            if (ticker_name, 'Close') in data.columns:
                series = pd.to_numeric(data[(ticker_name, 'Close')], errors='coerce').dropna()
                if not series.empty:
                    series.name = ticker_name 
                    all_series.append(series)
    elif 'Close' in data.columns:
        series = pd.to_numeric(data['Close'], errors='coerce').dropna()
        if not series.empty:
            series.name = list(set(tickers))[0]
            all_series.append(series)

    if not all_series: return pd.DataFrame()
    df_out = pd.concat(all_series, axis=1)
    df_out.index = pd.to_datetime(df_out.index)
    return df_out.dropna(axis=0, how='all').dropna(axis=1, how='all')

async def calculate_portfolio_beta_correlation_singularity(
    portfolio_holdings: List[Dict[str, Any]], 
    total_portfolio_value: float,
    backtest_period: str, 
    is_called_by_ai: bool = False 
) -> Optional[tuple[float, float]]:
    if not portfolio_holdings or total_portfolio_value <= 0: return None
    valid_holdings = [h for h in portfolio_holdings if isinstance(h.get('value'), (int, float)) and h['value'] > 1e-9]
    if not valid_holdings:
        if all(h.get('ticker','').upper() == 'CASH' for h in portfolio_holdings): return 0.0, 0.0
        return None

    stock_tickers = [h['ticker'] for h in valid_holdings if h.get('ticker') and h['ticker'].upper() != 'CASH']
    if not stock_tickers: return 0.0, 0.0

    hist_data = await get_yf_data_singularity(list(set(stock_tickers + ['SPY'])), period=backtest_period, interval="1d", is_called_by_ai=True)
    if hist_data.empty or 'SPY' not in hist_data.columns or hist_data['SPY'].dropna().shape[0] < 20: return None

    daily_returns = hist_data.pct_change(fill_method=None).iloc[1:]
    if daily_returns.empty or 'SPY' not in daily_returns.columns: return None

    spy_rets = daily_returns['SPY'].dropna()
    if spy_rets.empty or spy_rets.var() < 1e-12: return None

    market_var = spy_rets.var()
    stock_metrics = {}

    for t in stock_tickers:
        beta, corr = np.nan, np.nan
        if t in daily_returns.columns:
            t_rets = daily_returns[t].dropna()
            aligned = pd.concat([t_rets, spy_rets], axis=1, join='inner').dropna()
            if len(aligned) >= 20:
                tr, mr = aligned.iloc[:,0], aligned.iloc[:,1]
                if tr.var() > 1e-12:
                    try:
                        cov = np.cov(tr, mr)
                        if cov.shape == (2,2): beta = cov[0,1] / market_var
                        corr_mat = np.corrcoef(tr, mr)
                        if corr_mat.shape == (2,2): corr = corr_mat[0,1]
                        if pd.isna(corr): corr = 0.0
                    except: pass
                else: beta, corr = 0.0, 0.0
        stock_metrics[t] = {'beta': beta, 'correlation': corr}
    stock_metrics['CASH'] = {'beta': 0.0, 'correlation': 0.0}

    w_beta, w_corr, total_w = 0.0, 0.0, 0.0
    for h in valid_holdings:
        t = h.get('ticker','UNKNOWN').upper()
        w = h['value'] / total_portfolio_value
        total_w += w
        met = stock_metrics.get(t, {})
        b, c = met.get('beta', 0.0), met.get('correlation', 0.0)
        if not pd.isna(b): w_beta += w * b
        if not pd.isna(c): w_corr += w * c
    
    return w_beta, w_corr

async def get_single_stock_beta_corr(ticker: str, period: str, is_called_by_ai: bool = True) -> tuple[Optional[float], Optional[float]]:
    portfolio = [{'ticker': ticker, 'value': 100.0}]
    result = await calculate_portfolio_beta_correlation_singularity(portfolio, 100.0, period, is_called_by_ai)
    return result if result else (None, None)

async def get_market_invest_score_for_powerscore() -> Optional[float]:
    try:
        vix_data = await get_yf_download_robustly(['^VIX'], period="5d")
        if vix_data.empty: return None

        # Flatten MultiIndex if present
        if isinstance(vix_data.columns, pd.MultiIndex):
            vix_data.columns = vix_data.columns.get_level_values(0)

        if 'Close' not in vix_data.columns: return None
        vix_price = float(vix_data['Close'].iloc[-1])
        vix_likelihood = np.clip(0.01384083 * (vix_price ** 2), 0, 100)

        spy_hist = await get_yf_download_robustly(['SPY'], period="5y", interval="1mo")
        if spy_hist.empty: return None

        # Flatten MultiIndex if present
        if isinstance(spy_hist.columns, pd.MultiIndex):
            spy_hist.columns = spy_hist.columns.get_level_values(0)

        if 'Close' not in spy_hist.columns or len(spy_hist) < 55: return None

        spy_hist['EMA_8'] = spy_hist['Close'].ewm(span=8, adjust=False).mean()
        spy_hist['EMA_55'] = spy_hist['Close'].ewm(span=55, adjust=False).mean()
        
        last_row = spy_hist.iloc[-1]
        try:
             # Extract safely
             ema8 = float(last_row['EMA_8'])
             ema55 = float(last_row['EMA_55'])
        except (TypeError, ValueError, AttributeError):
             return None

        if pd.isna(ema8) or pd.isna(ema55) or ema55 == 0: return None

        x_val = (((ema8 - ema55) / ema55) + 0.5) * 100
        ema_likelihood = np.clip(100 * np.exp(-((45.622216 * x_val / 2750) ** 4)), 0, 100)

        if ema_likelihood < 1e-9: return 0.0

        ratio = vix_likelihood / ema_likelihood
        market_score = 50.0 - (ratio - 1.0) * 100.0
        
        return float(np.clip(market_score, 0, 100))
    except Exception as e:
        print(f"   [DEBUG] Market Score Error: {e}")
        return None

async def calculate_volatility_metrics(ticker: str, period: str) -> tuple[Optional[float], Optional[float]]:
    try:
        hist_data = await get_yf_download_robustly([ticker], period=period, auto_adjust=True)
        if hist_data.empty or 'Close' not in hist_data.columns or len(hist_data) <= 30: return None, None

        hist_data['daily_return'] = hist_data['Close'].pct_change()
        rolling_hv = hist_data['daily_return'].rolling(window=30).std() * (252**0.5)
        hv_series = rolling_hv.dropna()

        if len(hv_series) > 1:
            vol_rank = percentileofscore(hv_series, hv_series.iloc[-1], kind='rank')
        else: vol_rank = None

        return None, vol_rank
    except Exception as e:
        print(f"   [DEBUG] Volatility Error: {e}")
        return None, None

async def handle_fundamentals_command_internal(ai_params: dict, is_called_by_ai: bool = True):
    ticker = ai_params.get("ticker")
    if not ticker: return {"error": "No Ticker"}
    info = await get_yfinance_info_robustly(ticker)
    if not info: return {"error": f"No Data for {ticker}"}

    pe = safe_get(info, 'trailingPE')
    rg = safe_get(info, 'revenueGrowth')
    de = safe_get(info, 'debtToEquity')
    pm = safe_get(info, 'profitMargins')

    total, possible = 0.0, 0.0
    if pe is not None:
        possible += 25
        try: pe_n = float(pe); total += 25 * np.exp(-0.00042 * pe_n**2) if pe_n > 0 else 0
        except: pass
    if rg is not None:
        possible += 25
        try: rg_n = float(rg); total += 25 / (1 + np.exp(-0.11 * ((rg_n * 100) - 12.5)))
        except: pass
    if de is not None:
        possible += 25
        try: de_n = float(de); total += 25 * np.exp(-0.00956 * de_n) if de_n > 0 else 25
        except: pass
    if pm is not None:
        possible += 25
        try: pm_n = float(pm); total += 25 / (1 + np.exp(-0.11 * ((pm_n * 100) - 12.5)))
        except: pass

    final = (total / possible) * 100 if possible > 0 else 0.0
    return {"fundamental_score": final}

def calculate_technical_indicators(data: pd.DataFrame) -> pd.DataFrame:
    try:
        if 'Close' not in data.columns: return data
        delta = data['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14, min_periods=1).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14, min_periods=1).mean()
        with np.errstate(divide='ignore', invalid='ignore'): rs = gain / loss
        rs.replace([np.inf, -np.inf], np.nan, inplace=True)
        data['RSI'] = 100 - (100 / (1 + rs.fillna(0)))
        data['RSI'] = data['RSI'].fillna(50)

        exp1 = data['Close'].ewm(span=12, adjust=False).mean()
        exp2 = data['Close'].ewm(span=26, adjust=False).mean()
        data['MACD'] = (exp1 - exp2).fillna(0)
        data['MACD_Signal'] = data['MACD'].ewm(span=9, adjust=False).mean().fillna(0)

        sma50 = data['Close'].rolling(window=50, min_periods=1).mean()
        sma200 = data['Close'].rolling(window=200, min_periods=1).mean()
        data['SMA_Diff'] = np.where(sma200 != 0, ((sma50 - sma200) / sma200) * 100, 0)
        
        rets = data['Close'].pct_change()
        data['Volatility'] = (rets.rolling(window=30, min_periods=10).std() * np.sqrt(252)).fillna(0)
    except:
        for c in ['RSI', 'MACD', 'MACD_Signal', 'SMA_Diff', 'Volatility']:
            if c not in data: data[c] = 0
    return data

async def handle_mlforecast_command_internal(ai_params: dict, is_called_by_ai: bool = True):
    ticker = ai_params.get("ticker")
    if not ticker: 
        print("   [DEBUG ML] No ticker provided.")
        return []
    
    # Debug: Check Data Download
    print(f"   [DEBUG ML] Downloading 5y data for {ticker}...")
    data = await get_yf_download_robustly([ticker], period="5y", auto_adjust=True)
    
    if data.empty:
        print(f"   [DEBUG ML] Data download empty for {ticker}.")
        return []
    
    print(f"   [DEBUG ML] Downloaded {len(data)} rows. Columns: {data.columns.tolist()}")
    
    if len(data) < 100: 
        print(f"   [DEBUG ML] Insufficient history ({len(data)} rows). Need > 100.")
        return []
        
    if isinstance(data.columns, pd.MultiIndex):
        # Flatten MultiIndex if present, prioritizing the 'Price' level (usually level 0 or level 1 depending on yf version)
        # Try to find which level has 'Close'
        if 'Close' in data.columns.get_level_values(0):
            data.columns = data.columns.get_level_values(0)
        elif 'Close' in data.columns.get_level_values(1):
            data.columns = data.columns.get_level_values(1)
        else:
             # Fallback: just take level 0
             data.columns = data.columns.get_level_values(0)

    data = calculate_technical_indicators(data)
    features = ['RSI', 'MACD', 'MACD_Signal', 'SMA_Diff', 'Volatility']
    
    # Check features exist
    missing_feats = [f for f in features if f not in data.columns]
    if missing_feats:
        print(f"   [DEBUG ML] Missing features: {missing_feats}")
        return []

    results = []
    horizons = {
        "5-Day": 5, 
        "1-Month (21-Day)": 21,
        "3-Month (63-Day)": 63,
        "6-Month (26-Week)": 126,
        "1-Year (52-Week)": 252
    }
    for pname, h in horizons.items():
        try:
            df = data.copy()
            df['Future_Close'] = df['Close'].shift(-h)
            df['Pct_Change'] = np.where(df['Close'] != 0, (df['Future_Close'] - df['Close']) / df['Close'], 0)
            df.dropna(subset=features + ['Pct_Change'], inplace=True)
            
            if len(df) < 30: 
                print(f"   [DEBUG ML] Skipping {pname}: {len(df)} rows after dropna (min 30).")
                continue
            
            X, y = df[features], df['Pct_Change']
            reg = RandomForestRegressor(n_estimators=50, random_state=42, n_jobs=-1, max_depth=10)
            reg.fit(X, y)
            
            last_row = data[features].iloc[-1:]
            if last_row.isnull().values.any(): 
                print(f"   [DEBUG ML] Skipping {pname}: NaN in latest features.")
                continue
            
            pred = reg.predict(last_row)[0] * 100
            print(f"   [DEBUG ML] {pname} Forecast: {pred:.2f}%")
            results.append({"Period": pname, "Est. % Change": f"{pred:+.2f}%"})
        except Exception as e:
            print(f"   [DEBUG ML] Error forecasting {pname}: {e}")
            import traceback
            traceback.print_exc()
            pass
            
    return results

async def get_powerscore_explanation(ticker: str, component_scores: dict, model_to_use: Any = None, lock_to_use: asyncio.Lock = None) -> str:
    # Deprecated args model_to_use/lock_to_use ignored.
    
    score_lines = []
    score_map = {
        'Market': component_scores.get('R'),
        'Beta/Corr': component_scores.get('AB'),
        'Volatility': component_scores.get('AA'),
        'Fundamentals': component_scores.get('F'),
        'Technicals': component_scores.get('Q'),
        'Sentiment': component_scores.get('S'),
        'ML Forecast': component_scores.get('M'),
    }
    for name, score in score_map.items():
        score_lines.append(f"- {name}: {score:.1f}" if score is not None else f"- {name}: N/A")

    prompt = f"""
    Act as a financial analyst. Based *only* on the following Prime component scores for {ticker}, provide a concise (2-3 sentences) summary profile.
    Focus on interpreting the scores to highlight clear strengths and weaknesses.
    Do NOT mention the specific score values numbers. Use qualitative terms (e.g., 'strong', 'weak', 'neutral').
    Do NOT use introductory phrases. Start directly with the analysis.
    
    Scores (0-100 scale):
    {chr(10).join(score_lines)}
    """
    
    print(f"   [DEBUG AI Analyst] Generating Summary for {ticker}...")
    
    try:
        # Use new AI Service
        summary = await ai.generate_content(prompt, system_instruction="You are a financial analyst.")
        if summary:
            return summary.strip()
    except Exception as e:
         print(f"   [DEBUG AI Analyst] Failed: {e}")

    return "AI summary analysis unavailable."

# --- Main Command Handler ---
async def stream_powerscore_analysis(ticker: str, sensitivity: int, is_called_by_ai: bool = False):
    """
    Async generator that yields progress updates and the final result.
    Yields: Dict objects representing event updates.
    """
    # Initialize
    yield {"type": "status", "message": f"Initializing PowerScore Analysis for {ticker}...", "progress": 5}
    await increment_usage('powerscore')
    
    period_map = {1: '10y', 2: '5y', 3: '1y'}
    backtest_period = period_map[sensitivity]
    
    raw = {}
    component_errors = []
    
    # 1. Market Score (R)
    yield {"type": "step_start", "step": "Market Score", "key": "R", "progress": 10}
    raw['R'] = await fetch_step_with_retry("Market Score (R)", get_market_invest_score_for_powerscore)
    if raw['R'] is None: component_errors.append("R (Market)")
    yield {"type": "step_complete", "step": "Market Score", "key": "R", "value": raw['R'], "progress": 20}

    # 2. Beta/Correlation (ABB, ABC)
    yield {"type": "step_start", "step": "Beta/Correlation", "key": "AB", "progress": 25}
    beta_res = await fetch_step_with_retry("Beta/Corr (AB)", get_single_stock_beta_corr, ticker, backtest_period)
    if beta_res: 
        raw['ABB'], raw['ABC'] = beta_res
    else: 
        raw['ABB'], raw['ABC'] = None, None
        component_errors.append("AB (Beta/Corr)")
    yield {"type": "step_complete", "step": "Beta/Correlation", "key": "AB", "value": beta_res, "progress": 40}

    # 3. Volatility (AA)
    yield {"type": "step_start", "step": "Volatility Analysis", "key": "AA", "progress": 45}
    vol_res = await fetch_step_with_retry("Volatility (AA)", calculate_volatility_metrics, ticker, backtest_period)
    raw['AA'] = vol_res[1] if vol_res else None
    if raw['AA'] is None: component_errors.append("AA (Volatility)")
    yield {"type": "step_complete", "step": "Volatility Analysis", "key": "AA", "value": raw['AA'], "progress": 55}

    # 4. Fundamentals (F)
    yield {"type": "step_start", "step": "Fundamentals", "key": "F", "progress": 60}
    fund_res = await fetch_step_with_retry("Fundamentals (F)", handle_fundamentals_command_internal, ai_params={'ticker': ticker})
    raw['F'] = fund_res.get('fundamental_score') if fund_res else None
    if raw['F'] is None: component_errors.append("F (Fundamentals)")
    yield {"type": "step_complete", "step": "Fundamentals", "key": "F", "value": raw['F'], "progress": 70}

    # 5. QuickScore / Technicals (Q)
    yield {"type": "step_start", "step": "Technical Analysis", "key": "Q", "progress": 75}
    q_res = await fetch_step_with_retry("QuickScore (Q)", calculate_ema_invest, ticker, sensitivity, is_called_by_ai=True)
    raw['Q'] = q_res[1] if q_res else None
    if raw['Q'] is None: component_errors.append("Q (Technicals)")
    yield {"type": "step_complete", "step": "Technical Analysis", "key": "Q", "value": raw['Q'], "progress": 85}

    # 6. Sentiment (S)
    yield {"type": "step_start", "step": "Sentiment Analysis", "key": "S", "progress": 88}
    sent_res = await fetch_step_with_retry(
        "Sentiment (S)", 
        handle_sentiment_command, 
        ai_params={'ticker': ticker}, 
        is_called_by_ai=True,
        retries=3 
    )
    if sent_res and isinstance(sent_res, dict):
        if 'sentiment_score_raw' in sent_res:
            raw['S'] = sent_res['sentiment_score_raw']
        else:
            raw['S'] = None
            component_errors.append("S (Sentiment - Missing Key)")
    else:
        raw['S'] = None
        component_errors.append("S (Sentiment - Failed)")
    yield {"type": "step_complete", "step": "Sentiment Analysis", "key": "S", "value": raw['S'], "progress": 92}

    # 7. ML Forecast (M)
    yield {"type": "step_start", "step": "ML Forecast", "key": "M", "progress": 95}
    ml_res = await fetch_step_with_retry("ML Forecast (M)", handle_mlforecast_command_internal, ai_params={'ticker': ticker})
    raw['M'], used_m_period = None, "N/A"
    if ml_res:
        m_period_map = {1: ["1-Year (52-Week)", "6-Month (26-Week)"],
                        2: ["6-Month (26-Week)", "3-Month (63-Day)"],
                        3: ["1-Month (21-Day)", "5-Day"]}
        m_lookup = {item.get("Period"): item for item in ml_res}
        for period in m_period_map[sensitivity]:
            if period in m_lookup:
                try:
                    pct_str = m_lookup[period].get("Est. % Change", "0%").replace('%', '')
                    raw['M'] = float(pct_str)
                    used_m_period = period
                    break 
                except: pass
    if raw['M'] is None: component_errors.append("M (ML Forecast)")
    yield {"type": "step_complete", "step": "ML Forecast", "key": "M", "value": raw['M'], "progress": 98}

    # --- Calculate Prime Scores ---
    yield {"type": "status", "message": "Finalizing Calculations...", "progress": 99}
    
    prime = {}
    def calc_prime_val(val):
        try: return float(val) if pd.notna(val) else None
        except: return None

    raw_abb = calc_prime_val(raw.get('ABB'))
    if raw_abb is not None:
        prime['ABB'] = np.clip(100/(((raw_abb-2)**2)+1) if raw_abb<=2 else 400/((3*(raw_abb-2)**2)+4), 0, 100)

    raw_abc = calc_prime_val(raw.get('ABC'))
    if raw_abc is not None:
        clamped_abc = np.clip(raw_abc, -0.999, 0.999)
        prime['ABC'] = np.clip(1.01*(100*(297**clamped_abc))/((297**clamped_abc)+3), 0, 100)

    if 'ABB' in prime and 'ABC' in prime: prime['AB'] = (prime['ABB'] + prime['ABC']) / 2
    else: prime['AB'] = None

    raw_f = calc_prime_val(raw.get('F'))
    if raw_f is not None: prime['F'] = np.clip(raw_f, 0, 100)

    raw_s = calc_prime_val(raw.get('S')) 
    if raw_s is not None: prime['S'] = np.clip(50 * (raw_s + 1), 0, 100)

    raw_aa = calc_prime_val(raw.get('AA'))
    if raw_aa is not None: prime['AA'] = 100 - raw_aa

    raw_r = calc_prime_val(raw.get('R'))
    if raw_r is not None: prime['R'] = raw_r

    raw_m = calc_prime_val(raw.get('M'))
    if raw_m is not None:
        try:
            m = raw_m
            if sensitivity == 1: prime['M'] = 100/(1+(9*(1.1396**-m)))
            elif sensitivity == 2: prime['M'] = 100/(1+(4*(1.23**-m)))
            else: prime['M'] = 100/(1+(3*(3**-m)))
            prime['M'] = np.clip(prime['M'], 0, 100)
        except: prime['M'] = 50.0

    raw_q = calc_prime_val(raw.get('Q'))
    if raw_q is not None:
        try:
            q = raw_q
            if sensitivity == 1: prime['Q'] = 100/(1+(math.exp(-0.0879*(q-50))))
            elif sensitivity == 2: prime['Q'] = 100/(1+(math.exp(-0.0628*(q-50))))
            else: prime['Q'] = 100/(1+(math.exp(-0.0981*(q-50))))
            prime['Q'] = np.clip(prime['Q'], 0, 100)
        except: prime['Q'] = 50.0

    # --- Final Weighting ---
    weights_map = {
        1: {'R': 0.15, 'AB': 0.15, 'AA': 0.15, 'F': 0.15, 'Q': 0.20, 'S': 0.10, 'M': 0.10},
        2: {'R': 0.20, 'AB': 0.10, 'AA': 0.10, 'F': 0.05, 'Q': 0.25, 'S': 0.15, 'M': 0.15},
        3: {'R': 0.25, 'AB': 0.05, 'AA': 0.05, 'F': 0.00, 'Q': 0.30, 'S': 0.25, 'M': 0.10}
    }
    cur_weights = weights_map[sensitivity]
    w_sum, w_total = 0.0, 0.0
    for k, w in cur_weights.items():
        if prime.get(k) is not None and w > 0:
            w_sum += prime[k] * w
            w_total += w
    
    final_score = np.clip((w_sum / w_total) if w_total > 0 else 0.0, 0, 100)

    # Yield Final Result
    result_payload = {
        "status": "success" if not component_errors else "partial_error",
        "ticker": ticker,
        "sensitivity": sensitivity,
        "powerscore": final_score,
        "prime_scores": {k: v for k, v in prime.items() if v is not None},
        "ai_explanation": await get_powerscore_explanation(ticker, prime, None, None),
        "errors": component_errors if component_errors else None
    }
    yield {"type": "result", "payload": result_payload, "progress": 100}

async def handle_powerscore_command(
    args: List[str] = None,
    ai_params: dict = None,
    is_called_by_ai: bool = False,
    **kwargs
):
    """
    Wrapper for non-streaming callers (AI, CLI). 
    Collects the stream and returns the final result.
    """
    ticker, sensitivity = None, None
    try:
        if is_called_by_ai and ai_params:
            ticker = ai_params.get("ticker")
            sensitivity_raw = ai_params.get("sensitivity")
            sensitivity = int(sensitivity_raw) if sensitivity_raw is not None else None
        elif args and len(args) == 2:
            ticker = args[0].upper()
            sensitivity = int(args[1])
        
        if not ticker or sensitivity not in [1, 2, 3]:
            if is_called_by_ai: return {"status": "error", "message": "Usage: /powerscore <TICKER> <SENSITIVITY 1-3>"}
            else: print("Usage: /powerscore <TICKER> <SENSITIVITY 1-3>"); return None

    except Exception:
         if is_called_by_ai: return {"status": "error", "message": "Invalid input."}
         else: return None

    if not is_called_by_ai:
        print(f"\n--- Generating PowerScore for {ticker} (Sensitivity: {sensitivity}) ---")

    final_result = None
    async for event in stream_powerscore_analysis(ticker, sensitivity, is_called_by_ai):
        if event["type"] == "result":
            final_result = event["payload"]
        elif event["type"] == "status" and not is_called_by_ai:
             print(f"   [STATUS] {event['message']}")
    
    if is_called_by_ai:
        return final_result
    else:
        # CLI Printing Logic (Legacy)
        if not final_result: return None
        raw = {} # Reconstruct raw? Too hard, just print final params if compatible
        # For CLI usage we might just print the summary.
        print(f"FINAL POWERSCORE: {final_result['powerscore']:.2f}")
        return None