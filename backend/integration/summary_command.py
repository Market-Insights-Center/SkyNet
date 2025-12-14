# --- summary_command.py ---
import asyncio
import yfinance as yf
from backend.ai_service import ai
from backend.database import get_cached_summary, save_cached_summary

# Helpers
async def get_yf_info(ticker: str) -> dict:
    try:
        return await asyncio.to_thread(lambda: yf.Ticker(ticker).info)
    except:
        return {}

async def handle_summary_command(
    args: list = None,
    ai_params: dict = None,
    is_called_by_ai: bool = False,
    **kwargs
):
    """
    Generates a very brief 2-3 sentence summary of the company/ticker.
    """
    ticker = None
    if is_called_by_ai and ai_params: ticker = ai_params.get("ticker")
    elif args: ticker = args[0]
    
    if not ticker:
        return {"status": "error", "message": "No ticker provided"}

    ticker = ticker.upper()
    
    # 1. Check Cache
    cached_summary = get_cached_summary(ticker)
    if cached_summary:
        print(f"   [DEBUG] Using cached summary for {ticker}")
        return {
            "status": "success",
            "ticker": ticker,
            "summary": cached_summary
        }

    # 2. Fetch Info
    print(f"   [DEBUG SUMMARY] Fetching yfinance info for {ticker}...")
    info = await get_yf_info(ticker)
    if not info:
        print(f"   [DEBUG SUMMARY] No info found for {ticker}.")

    name = info.get('longName', ticker)
    sector = info.get('sector', 'Unknown Sector')
    industry = info.get('industry', 'Unknown Industry')
    desc = info.get('longBusinessSummary')
    
    # If we have a description, we can summarize it.
    # If not, we ask the AI to use its internal knowledge.
    
    prompt = ""
    if desc and len(desc) > 50:
        truncated_desc = desc[:2000]
        prompt = f"""
        Summarize the following company business description into exactly 2 clear, professional sentences for an investor dashboard.
        Focus on what they do and their primary market.
        
        Company: {name} ({ticker})
        Description: {truncated_desc}
        """
    else:
        print(f"   [DEBUG SUMMARY] No description found. Using fallback prompt.")
        prompt = f"""
        Provide a 2-sentence summary of what the company {name} ({ticker}) does.
        Focus on their sector ({sector}, {industry}) and primary business model.
        """

    import re
    try:
        print(f"   [DEBUG SUMMARY] Requesting AI generation (Prompt Len: {len(prompt)})...")
        summary = await ai.generate_content(prompt, system_instruction="You are a concise financial summarizer.")
        print(f"   [DEBUG SUMMARY] AI Response: {summary[:50] if summary else 'None'}...")
        
        if summary:
             # Force cleanup of stubborn AI intros
            # Matches "Here is a [2-sentence] summary [of/about] [Company]:" or just "summary:"
            summary = re.sub(r'(?i)^(here is|this is).*?summary.*?:', '', summary.strip()).strip()
            summary = re.sub(r'(?i)^sure, here is.*?:\s*', '', summary).strip()
            
            # 3. Save to Cache
            save_cached_summary(ticker, summary)
            
        return {
            "status": "success",
            "ticker": ticker,
            "summary": summary.strip() if summary else "No summary generated."
        }
    except Exception as e:
        print(f"   [DEBUG SUMMARY] Error: {e}")
        return {"status": "error", "message": str(e)}
