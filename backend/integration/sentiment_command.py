# --- sentiment_command.py ---
# Standalone module for the /sentiment command.

import asyncio
import json
import re
import requests
import yfinance as yf
import pandas as pd
import numpy as np
import configparser
import os
import json
import asyncio
from bs4 import BeautifulSoup
from urllib.parse import quote_plus
from urllib3.exceptions import InsecureRequestWarning
import urllib3
from tabulate import tabulate
from typing import Optional, Dict, Any, List 

from backend.ai_service import ai

# --- Module-Specific Configuration ---
urllib3.disable_warnings(InsecureRequestWarning)
# Kept for compatibility if imported elsewhere, but effectively unused by AI Service internals
GEMINI_API_LOCK = asyncio.Lock() 
YFINANCE_API_SEMAPHORE = asyncio.Semaphore(8)

# --- Common Headers for Scraping ---
STD_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://www.google.com/'
}

# --- Helper Functions ---

class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'

async def with_retry(coro_func, *args, retries=1, delay=1, **kwargs):
    """
    Retries an async function call up to `retries` times.
    Logs specific failure reasons for debugging.
    """
    source_name = coro_func.__name__
    
    for attempt in range(retries + 1):
        try:
            result = await coro_func(*args, **kwargs)
            return result
        except Exception as e:
            if attempt < retries:
                # wait_time = delay * (2 ** attempt) + np.random.uniform(0, 1) # Too slow for VPS
                await asyncio.sleep(0.5) 
            else:
                 print(f"   [DEBUG] {source_name} failed permanently. Error: {e}")
    return None 

async def get_company_name(ticker: str) -> str:
    try:
        stock_info = await asyncio.to_thread(lambda: yf.Ticker(ticker).info)
        if stock_info:
            return stock_info.get('longName') or stock_info.get('shortName') or ticker
        return ticker 
    except Exception:
        return ticker 

async def scrape_finviz_headlines(ticker: str) -> list[str]:
    headlines = []
    try:
        url = f"https://finviz.com/quote.ashx?t={ticker}"
        response = await asyncio.to_thread(requests.get, url, headers=STD_HEADERS, timeout=10, verify=False)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        news_table = soup.find(id='news-table')

        if news_table:
            # Try new selector first
            for link in news_table.find_all('a', class_='tab-link-news'):
                headlines.append(link.get_text(strip=True))
            # Fallback to old selector if needed
            if not headlines:
                 for link in news_table.find_all('a', class_='news-link-left'):
                     headlines.append(link.get_text(strip=True))
        
        print(f"   [DEBUG] Finviz: Found {len(headlines)} headlines.")

    except Exception as e:
        print(f"   [DEBUG] Finviz Error for {ticker}: {e}")
    return headlines[:15]


async def scrape_google_news(ticker: str, company_name: str) -> list[str]:
    headlines = set()
    try:
        query = f'"{ticker}" stock news'
        encoded_query = quote_plus(query)
        url = f"https://www.google.com/search?q={encoded_query}&tbm=nws&tbs=qdr:w"
        
        response = await asyncio.to_thread(requests.get, url, headers=STD_HEADERS, timeout=10, verify=False)
        
        if response.status_code == 429:
            print("   [DEBUG] Google News: Rate limit (429).")
            return []
        
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        for item in soup.select('div[role="heading"]'):
             title = item.get_text(strip=True)
             if title: headlines.add(title)
        
        if not headlines:
             for h3 in soup.find_all('h3'):
                 headlines.add(h3.get_text(strip=True))

        print(f"   [DEBUG] Google News: Found {len(headlines)} headlines.")
    except Exception as e:
        print(f"   [DEBUG] Google News Error for {ticker}: {e}")
    return list(headlines)[:10]  # Reduced from 15 to 10 for speed


async def scrape_reddit_combined(ticker: str, company_name: str) -> list[str]:
    post_titles = set()
    reddit_headers = {'User-Agent': 'Mozilla/5.0 (compatible; SkyNetBot/1.0)'}
    
    encoded_query = quote_plus(f'"{ticker}"')
    subreddits = ['wallstreetbets', 'stocks', 'investing'] 
    
    for sub in subreddits:
        try:
            url = f"https://old.reddit.com/r/{sub}/search/?q={encoded_query}&restrict_sr=1&sort=new&t=week"
            resp = await asyncio.to_thread(requests.get, url, headers=reddit_headers, timeout=10, verify=False)
            if resp.status_code != 200: continue
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            for link in soup.find_all('a', class_='search-title'):
                title = link.get_text(strip=True)
                if title: post_titles.add(title)
        except Exception: pass
    
    print(f"   [DEBUG] Reddit: Found {len(post_titles)} total titles.")
    return list(post_titles)[:5] # Reduced to 5 for speed


async def scrape_yahoo_finance_news(ticker: str) -> list[str]:
    headlines = []
    try:
        news_data = await asyncio.to_thread(lambda: yf.Ticker(ticker).news)
        if news_data:
            for item in news_data:
                t = item.get('title')
                if t: headlines.append(t)
        print(f"   [DEBUG] Yahoo Finance: Found {len(headlines)} headlines.")
    except Exception as e:
        print(f"   [DEBUG] Yahoo Finance Error: {e}")
    
    return headlines[:15]


async def get_ai_sentiment_analysis(
    text_to_analyze: str,
    topic_name: str,
    # Legacy args ignored
    model_to_use: Any = None, 
    lock_to_use: asyncio.Lock = None
) -> Optional[Dict[str, Any]]:
    
    # Huge performance optimization for Local AI: Truncate heavily.
    # 8500 chars (approx 2k tokens) is too much for standard local inference without waiting minutes.
    # Reducing to 4000 chars (approx 1k tokens) for speed.
    # UPDATE: Reducing further to 2000 chars to ensure <60s response on slow VPS.
    truncated_text = text_to_analyze[:2000]

    print(f"   [DEBUG] Sentinel AI Input Size: {len(truncated_text)} chars")

    prompt = f"""
    Analyze the sentiment for '{topic_name}' based on the text below.
    
    CRITICAL: You MUST return strictly valid JSON. Do not wrap it in markdown code blocks. 
    Do not add conversational text. Start with {{ and end with }}.

    Format:
    {{
      "sentiment_score": float, 
      "summary": "string",
      "keywords": [
          {{"term": "string", "score": float}},
          {{"term": "string", "score": float}}
      ]
    }}
    
    Constraints:
    - sentiment_score must be between -1.0 (very negative) and 1.0 (very positive).
    - Provide a specific score with high precision (e.g. 0.235, -0.671). Round to the nearest 0.001.
    - Extract 5-10 key "driver keywords" or short phrases from the text that drive the sentiment.
    - Assign a specific sentiment impact score (-1.0 to 1.0) to each keyword, also with 0.001 precision.
    - summary should be 1-2 sentences.
    
    TEXT TO ANALYZE:
    {truncated_text}
    """

    for attempt in range(3):
        try:
            # Using new AI Service with json_mode=True
            response_text = await ai.generate_content(prompt, system_instruction="You are a JSON-only sentiment analysis API.", json_mode=True)
            
            if response_text:
                raw_text = response_text.strip()
                # print(f"   [DEBUG] Raw AI Response Preview: {raw_text[:100]}...")

                # --- ADVANCED CLEANING ---
                # 1. Find the first '{' and last '}'
                start_idx = raw_text.find('{')
                end_idx = raw_text.rfind('}')

                if start_idx == -1 or end_idx == -1:
                    print(f"   [DEBUG] AI Response did not contain JSON brackets. Raw: {raw_text}")
                    # Try again
                    continue
                
                # Extract just the JSON part
                json_str = raw_text[start_idx : end_idx + 1]

                try:
                    parsed_json = json.loads(json_str)
                    # Basic validation
                    if "sentiment_score" in parsed_json:
                        return parsed_json
                    else:
                        print(f"   [DEBUG] JSON parsed but missing 'sentiment_score': {parsed_json.keys()}")
                except json.JSONDecodeError as je:
                    print(f"   [DEBUG] JSON Decode Error on substring: {je}")
                    # print(f"   [DEBUG] Substring was: {json_str}")
                    pass # Retry

        except Exception as e:
            print(f"   [DEBUG] AI Generation/Parsing Failed (Attempt {attempt+1}): {e}")
            await asyncio.sleep(1)
                    
    print("   [DEBUG] All AI attempts failed.")
    return None

# --- Main Command Handler (Modified) ---
async def handle_sentiment_command(
    args: list = None,
    ai_params: dict = None,
    is_called_by_ai: bool = False,
    gemini_model_override: Optional[Any] = None, 
    api_lock_override: Optional[asyncio.Lock] = None, 
    **kwargs 
):
    ticker = None
    if is_called_by_ai and ai_params: ticker = ai_params.get("ticker")
    elif args: ticker = args[0]
    
    if not ticker:
        msg = "Usage: /sentiment <TICKER>"
        if not is_called_by_ai: print(msg)
        return {"status": "error", "message": msg} if is_called_by_ai else None

    ticker = ticker.upper().strip()
    
    if not is_called_by_ai:
        print(f"\n--- AI Sentiment Analysis for {ticker} ---")
        print("-> Fetching Data (Finviz, Google, Reddit, Yahoo)...")

    company_name = await get_company_name(ticker)

    # Execute scrapes
    results = await asyncio.gather(
        with_retry(scrape_finviz_headlines, ticker, retries=1),
        with_retry(scrape_google_news, ticker, company_name, retries=1),
        with_retry(scrape_reddit_combined, ticker, company_name, retries=1),
        with_retry(scrape_yahoo_finance_news, ticker, retries=1),
        return_exceptions=True
    )

    headlines_finviz = results[0] if isinstance(results[0], list) else []
    headlines_google = results[1] if isinstance(results[1], list) else []
    reddit_titles = results[2] if isinstance(results[2], list) else []
    headlines_yahoo = results[3] if isinstance(results[3], list) else []

    all_text = headlines_finviz + headlines_google + reddit_titles + headlines_yahoo
    combined_text = "\n".join(all_text)

    count_msg = (
        f"Sources Found: Finviz({len(headlines_finviz)}), "
        f"Google({len(headlines_google)}), "
        f"Reddit({len(reddit_titles)}), "
        f"Yahoo({len(headlines_yahoo)})"
    )
    if not is_called_by_ai: print(f"   [DEBUG] {count_msg}")

    # Don't fail immediately on empty text, try to return a neutral result or error object
    # to avoid 400 Bad Request if the frontend expects JSON.
    if not combined_text.strip():
        message = f"Could not find any recent text for {ticker}. {count_msg}. Scrapers may be blocked."
        if not is_called_by_ai: print(f"-> {message}")
        return {
            "status": "error", 
            "message": message, 
            "details": count_msg,
            "sentiment_score_raw": 0,
            "summary": "No data found."
        }

    analysis = await get_ai_sentiment_analysis(combined_text, f"{ticker} ({company_name})")

    if not analysis:
        msg = "AI analysis failed to return valid JSON."
        if not is_called_by_ai: print(f"-> {msg}")
        # Return a fallback JSON structure instead of None to prevent 400s
        return {
            "status": "error", 
            "message": msg,
            "sentiment_score_raw": 0.0,
            "summary": "AI Analysis Failed."
        }

    raw_score = float(analysis.get("sentiment_score", 0.0))
    summary = analysis.get("summary", "N/A")
    keywords = analysis.get("keywords", [])

    if not is_called_by_ai:
        print("\n--- Sentiment Results ---")
        
        # Color logic
        color = Colors.RESET
        if raw_score > 0.20:
            color = Colors.GREEN
        elif raw_score < -0.20:
            color = Colors.RED
        else: # between -0.20 and 0.20
            color = Colors.YELLOW

        print(f"Score: {color}{raw_score:.2f}{Colors.RESET} (-1.0 to 1.0)")
        print(f"Summary: {summary}")
        print("-------------------------")

    return {
        "status": "success",
        "ticker": ticker,
        "sentiment_score_raw": raw_score,
        "summary": summary,
        "keywords": keywords,
        "source_counts": count_msg
    }