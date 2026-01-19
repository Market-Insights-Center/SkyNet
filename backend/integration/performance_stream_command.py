import asyncio
import pandas as pd
import yfinance as yf
import requests
from io import StringIO
from typing import List, Dict, Any, Optional
import logging
import json
import os
import datetime
from concurrent.futures import ThreadPoolExecutor

# Reuse existing commands if possible, but for bulk/specialized nature we might just import what we need
# or implement efficient bulk versions here.
try:
    from backend.integration import assess_command, quickscore_command
except ImportError:
    from integration import assess_command, quickscore_command

logger = logging.getLogger("performance_stream_command")

# Cache File
HEATMAP_CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "heatmap_cache.json")
DETAILS_CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "heatmap_details_cache.json")

def get_sp500_list() -> List[str]:
    """Fetches S&P 500 symbols from Wikipedia."""
    try:
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=15)
        dfs = pd.read_html(StringIO(response.text))
        df = dfs[0]
        # Clean symbols
        symbols = [str(s).replace('.', '-') for s in df['Symbol'].tolist()]
        # Get sectors too if possible
        sector_map = dict(zip(df['Symbol'].apply(lambda x: str(x).replace('.', '-')), df['GICS Sector']))
        return symbols, sector_map
    except Exception as e:
        logger.error(f"Error fetching S&P 500 list: {e}")
        return [], {}

async def fetch_bulk_market_data(tickers: List[str]):
    """Fetches price and market cap data for all tickers."""
    # Split into chunks of 100 to avoid request URL length issues or timeouts
    chunk_size = 100
    chunks = [tickers[i:i + chunk_size] for i in range(0, len(tickers), chunk_size)]
    
    all_data = {}
    
    for chunk in chunks:
        try:
            # Helper to run blocking yf.download in thread
            def download_chunk():
                return yf.download(
                    chunk, 
                    period="1y", 
                    interval="1d", 
                    group_by='ticker', 
                    progress=False, 
                    auto_adjust=True,
                    threads=True
                )
            
            data = await asyncio.to_thread(download_chunk)
            
            # Debug logs removed
            if data.empty: 
                continue

            # If only one ticker, yf structure is different (no top level ticker index)
            if len(chunk) == 1:
                # Handle single ticker case if needed
                pass 

            for ticker in chunk:
                try:
                    # Access data safely
                    if isinstance(data.columns, pd.MultiIndex):
                        if ticker not in data.columns.get_level_values(0): 
                             # print(f"DEBUG: {ticker} not in multiindex columns") # Too spammy
                             continue
                        hist = data[ticker]['Close'].dropna()
                    else:
                        # Flat structure for single ticker?
                        if ticker != chunk[0]: continue
                        hist = data['Close'].dropna()
                        
                    if hist.empty: 
                        continue
                    
                    # Calculate Changes
                    current_price = float(hist.iloc[-1])
                    prev_close = float(hist.iloc[-2]) if len(hist) > 1 else current_price
                    week_close = float(hist.iloc[-6]) if len(hist) > 6 else current_price
                    month_close = float(hist.iloc[-22]) if len(hist) > 22 else current_price
                    year_close = float(hist.iloc[0])
                    
                    change_d = ((current_price - prev_close) / prev_close) * 100
                    change_w = ((current_price - week_close) / week_close) * 100
                    change_m = ((current_price - month_close) / month_close) * 100
                    change_y = ((current_price - year_close) / year_close) * 100

                    all_data[ticker] = {
                        "price": current_price,
                        "change_d": change_d,
                        "change_w": change_w,
                        "change_m": change_m,
                        "change_y": change_y,
                    }
                    # print(f"DEBUG: Processed {ticker}: {current_price}, {change_d}")
                except Exception as e:
                     continue
        except Exception as e:
            logger.error(f"Chunk download error: {e}")
        except Exception as e:
            logger.error(f"Chunk download error: {e}")
            
    return all_data

async def fetch_ticker_meta(ticker):
    """Fetches metadata (Market Cap, Name) for a single ticker."""
    try:
        t = yf.Ticker(ticker)
        # fast_info is generally faster
        mcap = t.fast_info.market_cap
        # name = t.info.get('shortName') # This triggers a slow API call usually
        # To avoid rate limits on 500 stocks, we might skip name or use wikipedia name if available?
        # Let's try fast_info only first.
        return ticker, mcap
    except:
        return ticker, 1e9 # Fallback to 1B size to ensure it at least renders if fetch fails

async def update_heatmap_cache():
    """Background job to update market data."""
    logger.info("Starting Heatmap Update...")
    
    tickers, sector_map = get_sp500_list()
    if not tickers:
        logger.error("No tickers found.")
        return []

    # 1. Bulk Price Data
    try:
        market_data = await fetch_bulk_market_data(tickers)
    except Exception as e:
        logger.error(f"Failed to fetch bulk data: {e}")
        print(f"DEBUG: Failed to fetch bulk data: {e}")
        market_data = {}

    # 2. Build Tree Structure (Combine Sector + Price + Meta)
    tree_structure = {} # { Sector: [ {name, size, change, ...} ] }
    
    # Check for legacy cache to speed up/fallback?
    # For now, simplistic approach: Fetch clean.
    
    processed_count = 0
    
    async def process_ticker(ticker):
        sector = sector_map.get(ticker, "Unknown")
        m_data = market_data.get(ticker, {})
        
        # Meta fetch (Market Cap)
        # using the async wrapper fetch_ticker_meta
        meta = await fetch_ticker_meta(ticker)
        size = meta[1] if meta and len(meta) > 1 else 0 # fetch_ticker_meta returns (ticker, mcap)
        if hasattr(meta, 'get'): size = meta.get('marketCap', 0) # Handle if it returns dict (legacy?)
        
        # Validate Size
        # fetch_ticker_meta returns (ticker, mcap) tuple in current def.
        
        # Fallback size if 0 (otherwise Treemap hides it)
        if not size or size == 0: size = 1000000000 # 1B default

        return sector, {
            "name": ticker,
            "size": size,
            "color": m_data.get('change_d', 0), # Default to day change
            "price": m_data.get('price', 0),
            "changes": {
                "day": m_data.get('change_d', 0),
                "week": m_data.get('change_w', 0),
                "month": m_data.get('change_m', 0),
                "year": m_data.get('change_y', 0),
            }
        }

    # Run concurrent tasks for metadata
    # fetch_ticker_meta is async, so we await it properly via gather
    tasks = [process_ticker(t) for t in tickers]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    for res in results:
        if isinstance(res, Exception):
            # print(f"DEBUG: Task exception: {res}")
            continue
        if not res: continue
        
        sec, data_node = res
        if sec not in tree_structure: tree_structure[sec] = []
        tree_structure[sec].append(data_node)
        processed_count += 1

    final_output = []
    for sector, children in tree_structure.items():
        children.sort(key=lambda x: x['size'], reverse=True)
        final_output.append({
            "name": sector,
            "children": children
        })
        
    # Detailed count
    total_stocks = sum(len(x['children']) for x in final_output)

    # Save to Cache
    try:
        with open(HEATMAP_CACHE_FILE, 'w') as f:
            json.dump(final_output, f)
        logger.info(f"Heatmap Cache Updated. {len(final_output)} sectors found.")
        
    except Exception as e:
        logger.error(f"Failed to save cache: {e}")

    if not final_output:
        logger.warning("Heatmap update produced EMPTY output!")

    return final_output

def get_cached_heatmap(timeframe="day"):
    if not os.path.exists(HEATMAP_CACHE_FILE):
        return []
        
    try:
        with open(HEATMAP_CACHE_FILE, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        logger.error(f"Error reading heatmap cache: {e}")
        return []

# Caching SPY data for calculations to avoid fetching on every click
SPY_CACHE = {}

def get_spy_history():
    """Returns cached SPY history for calculations."""
    now = datetime.datetime.now()
    if 'data' in SPY_CACHE and 'time' in SPY_CACHE:
        if (now - SPY_CACHE['time']).total_seconds() < 3600: # 1 hour cache
            return SPY_CACHE['data']
    
    try:
        spy = yf.download("^GSPC", period="1y", interval="1d", progress=False, ignore_tz=True, auto_adjust=True) 
        # Note: yfinance might return MultiIndex if single ticker depending on version, handle safe
        closes = spy['Close']
        if isinstance(closes, pd.DataFrame): closes = closes.iloc[:, 0]
        
        # Force timezone naive
        if pd.api.types.is_datetime64_any_dtype(closes.index):
             closes.index = closes.index.tz_localize(None)

        SPY_CACHE['data'] = closes
        SPY_CACHE['time'] = now
        return closes
    except Exception as e:
        logger.error(f"Failed to fetch SPY history: {e}")
        return pd.Series()

async def get_stock_details(ticker: str):
    """Fetches details for the flip card: Trend, Scores, News."""
    print(f"--- DEBUG: Fetching Details for {ticker} ---")
    
    history = []
    prices = [] 
    dates = []
    market_cap = 0
    volume = 0
    current_price = 0.0
    
    # 1. Fetch Stock Data
    try:
        t = yf.Ticker(ticker)
        # Fetch 1y history
        print(f"DEBUG: Fetching 1y history for {ticker}...")
        df = t.history(period="1y", interval="1d")
        print(f"DEBUG: Ticker {ticker} history shape: {df.shape}")
        
        if not df.empty:
            # Current Price
            current_price = float(df['Close'].iloc[-1])
            print(f"DEBUG: Current price: {current_price}")
            
            # Metadata
            try:
                # Market Cap with fallback
                mc_val = None
                try:
                    mc_val = t.fast_info.market_cap
                except:
                    pass
                
                if mc_val is None:
                    try:
                        # Fallback to info dict (slower but sometimes necessary)
                        mc_val = t.info.get('marketCap')
                    except:
                        pass
                
                market_cap = float(mc_val) if mc_val is not None else 0
                
                # Volume from history (most reliable for "last" volume)
                vol_val = df['Volume'].iloc[-1]
                volume = int(vol_val) if vol_val is not None else 0
                print(f"DEBUG: Market Cap: {market_cap}, Volume: {volume}")
            except Exception as e:
                print(f"DEBUG: Metadata fetch error: {e}")
                pass

            history = [{"date": str(d.date()), "price": float(v)} for d, v in df['Close'].items()]
            prices = df['Close'].tolist()
            dates = df.index
        else:
            print("DEBUG: History DF is empty.")
            
    except Exception as e:
        logger.error(f"History fetch failed for {ticker}: {e}")
        print(f"DEBUG: History fetch exception: {e}")

    # 2. Advanced Calcs (Quickscore & Assess Code A)
    qs_res = { "short": 0, "medium": 0, "long": 0 }
    beta_val = "---"
    corr_val = "---"
    
    if len(prices) > 30:
        try:
            prices_series = pd.Series(prices)
            
            # --- Quickscores (0-100) ---
            # 1. Short Term (RSI-14 scaled)
            delta = prices_series.diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            qs_short = rsi.iloc[-1] if not pd.isna(rsi.iloc[-1]) else 50
            
            # 2. Medium Term (Price vs SMA 50)
            sma50 = prices_series.rolling(window=50).mean().iloc[-1]
            # Create a score based on distance from SMA. +/- 10% = 0-100 range? 
            # Simple logic: 50 + (pct_diff * 500). If 10% above, 50+50=100.
            if not pd.isna(sma50):
                diff_pct = (current_price - sma50) / sma50
                qs_med = 50 + (diff_pct * 400) # Sensitivity
                qs_med = min(max(qs_med, 0), 100)
            else: qs_med = 50
            
            # 3. Long Term (Price vs SMA 200)
            if len(prices) > 200:
                sma200 = prices_series.rolling(window=200).mean().iloc[-1]
                if not pd.isna(sma200):
                    diff_pct_long = (current_price - sma200) / sma200
                    qs_long = 50 + (diff_pct_long * 300) 
                    qs_long = min(max(qs_long, 0), 100)
                else: qs_long = 50
            else:
                qs_long = qs_med # Fallback
                
            qs_res = {
                "short": round(qs_short, 1),
                "medium": round(qs_med, 1),
                "long": round(qs_long, 1)
            }
            
            # --- Assess Code A (Beta & Correlation) ---
            # Combined fetch strategy (Robust alignment)
            print("DEBUG: Fetching Combined Data (Stock + SPY)...")
            # Fetch 1y of both
            combined_df = yf.download(
                [ticker, "^GSPC"], 
                period="1y", 
                interval="1d", 
                progress=False, 
                group_by='ticker', 
                auto_adjust=True, 
                threads=False
            )
            
            # Handle MultiIndex columns
            try:
                if not combined_df.empty:
                    # Extract Close series directly
                    # Structure usually: (Ticker, 'Close')
                    # We need to handle case where columns are flat if only 1 ticker (shouldn't happen with list inputs but safe to check)
                    
                    if isinstance(combined_df.columns, pd.MultiIndex):
                        stock_close = combined_df[ticker]['Close'] if (ticker, 'Close') in combined_df.columns else combined_df[ticker]
                        spy_close = combined_df['^GSPC']['Close'] if ('^GSPC', 'Close') in combined_df.columns else combined_df['^GSPC']
                    else:
                        # Fallback parsing (rare with group_by='ticker')
                        stock_close = combined_df['Close'] # Likely wrong if flat
                        spy_close = pd.Series()

                    # Deduplicate Indices
                    stock_close = stock_close[~stock_close.index.duplicated(keep='first')]
                    spy_close = spy_close[~spy_close.index.duplicated(keep='first')]
                    
                    # Align (Inner Join via panda concat)
                    aligned = pd.concat([stock_close, spy_close], axis=1, join='inner').dropna()
                    print(f"DEBUG: Combined & Aligned Data Points: {len(aligned)}")

                    if len(aligned) > 20:
                        a_ret = aligned.iloc[:, 0].pct_change().dropna()
                        s_ret = aligned.iloc[:, 1].pct_change().dropna()
                        
                        # Re-align after pct_change drop
                        aligned_ret = pd.concat([a_ret, s_ret], axis=1, join='inner')
                        
                        if len(aligned_ret) > 20:
                            a_final = aligned_ret.iloc[:, 0]
                            s_final = aligned_ret.iloc[:, 1]
                            
                            # Correlation
                            corr = a_final.corr(s_final)
                            corr_val = f"{corr:.2f}"
                            print(f"DEBUG: Calculated Correlation: {corr_val}")
                            
                            # Beta
                            cov = a_final.cov(s_final)
                            var = s_final.var()
                            if var > 0:
                                beta = cov / var
                                beta_val = f"{beta:.2f}"
                                print(f"DEBUG: Calculated Beta: {beta_val}")
                    else:
                        print(f"DEBUG: Insufficient overlapping data after fetch.")
                else:
                    print("DEBUG: Combined DF is empty")
            except Exception as e_inner:
                print(f"DEBUG: Combined Calc Logic Error: {e_inner}")
                logger.error(f"Combined Calc Error: {e_inner}")

        except Exception as e:
            logger.error(f"Calc failed for {ticker}: {e}")
            print(f"DEBUG: Calc exception: {e}")

    # 3. News
    news = []
    try:
        print("DEBUG: Fetching News...")
        t = yf.Ticker(ticker)
        raw_news = t.news
        print(f"DEBUG: Raw News Count: {len(raw_news) if raw_news else 0}")
        # Increased to 5 as requested
        if raw_news and len(raw_news) > 0:
             print(f"DEBUG: First News Item Keys: {raw_news[0].keys()}")
             
        for n in raw_news:
            try:
                # Handle Nested Content (New Yahoo Structure)
                target = n
                if 'content' in n and isinstance(n['content'], dict):
                    target = n['content']
                    
                # Title (Check both locations)
                title = target.get('title') or target.get('headline')
                if not title:
                     title = n.get('title') or n.get('headline')
                
                if not title: continue 
                
                # Link - Prioritize direct source links (Check both locations)
                link = target.get('clickThroughUrl') or n.get('clickThroughUrl')
                
                if not link:
                    link = target.get('canonicalUrl') or n.get('canonicalUrl')
                if not link:
                    link = target.get('url') or n.get('url')
                if not link:
                    link = target.get('link') or n.get('link')
                
                # Ensure Absolute URL (Fix for "Opening within website" issue)
                if link and isinstance(link, str) and not link.startswith('http'):
                     link = f"https://finance.yahoo.com{link}"
                elif not link:
                     link = "#"
                    
                # Parsing Timestamp (Priority: providerPublishTime (int) -> pubDate (ISO))
                ts = 0
                if 'providerPublishTime' in target:
                    ts = int(target['providerPublishTime'])
                elif 'providerPublishTime' in n:
                    ts = int(n['providerPublishTime'])
                elif 'pubDate' in target:
                    try:
                        dt = datetime.datetime.strptime(target['pubDate'].replace('Z', '+0000'), "%Y-%m-%dT%H:%M:%S%z")
                        ts = int(dt.timestamp())
                    except: pass
                
                # Formatted Time Label
                time_label = ""
                if ts > 0:
                    dt_obj = datetime.datetime.fromtimestamp(ts)
                    time_label = dt_obj.strftime("%b %d, %I:%M %p")
                else:
                    time_label = target.get('pubDate', "") or n.get('pubDate', "")

                # Publisher / Source
                publisher = "Unknown"
                if 'provider' in target and isinstance(target['provider'], dict):
                    publisher = target['provider'].get('displayName') or "Unknown"
                elif 'publisher' in target:
                     publisher = target['publisher']
                
                news.append({ 
                    "title": title, 
                    "publisher": str(publisher), 
                    "time_label": time_label,
                    "link": link,
                    "timestamp": ts
                })
            except Exception as item_e:
                print(f"DEBUG: Failed to parse news item: {item_e}")
                continue
            
        # Sort by timestamp descending (Newest First)
        news.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Keep top 5
        news = news[:5]
        
        # Cleanup
        for n in news: n.pop('timestamp', None)
            
        print(f"DEBUG: Filtered News Count: {len(news)}")
    except Exception as e:
        print(f"DEBUG: News fetch exception: {e}")
    
    return {
        "ticker": ticker,
        "price": current_price,
        "history": history,
        "quickscore": qs_res,
        "assess_code_a": {
             "beta": beta_val,
             "correlation": corr_val
        },
        "marketCap": market_cap,
        "volume": volume,
        "news": news
    }
