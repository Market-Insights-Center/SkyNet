
import asyncio
from playwright.async_api import async_playwright
import time
import re

async def run():
    print("Launching Browser...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=["--start-maximized"])
        context = await browser.new_context(viewport=None)
        page = await context.new_page()
        
        try:
            print("Navigating to Sentinel AI (Correct Route)...")
            await page.goto("http://localhost:5173/sentinel-ai", timeout=60000, wait_until="domcontentloaded")
            
            print("Page Initialized. Waiting 8s for Startup Animation & Transition...")
            time.sleep(8) 
            
            print(f"Page Title: {await page.title()}")

            # Targeted Selector
            print("Looking for input textarea...")
            input_locator = page.locator("textarea[placeholder*='Initialize']")
            try:
                await input_locator.wait_for(state="visible", timeout=20000)
                print("Found textarea by placeholder!")
            except:
                print("Placeholder selector failed. Trying generic textarea...")
                input_locator = page.locator("textarea").first
                await input_locator.wait_for(state="visible", timeout=10000)

            # --- USE TEST PROMPT BUTTON ---
            print("Clicking 'Test Prompt' button...")
            test_btn = page.locator("button[title='Use Test Prompt']")
            if await test_btn.count() > 0:
                await test_btn.click()
                print("Test Prompt Inserted.")
                # Small delay to let React state update
                time.sleep(1)
            else:
                print("Test Prompt button NOT found! Falling back to manual type.")
                query = "I have the following list of tickers:\nLITE, DXYZ, TER, PALL, SFTBY\nPlease compare all of the tickers using your general research, their ML forecast numbers on each time frame, their quickscore numbers on each time frame, and their AAPC, IV, IVR, Beta, and Correlation using Assess score A.\n\nPlease make sure to generate a final summary ordering the assets based on the strongest buy based on the found and calculated information to the weakest buy signal"
                await input_locator.fill(query)

            
            # Action Loop
            print("Starting Action Loop (Max 300s)...")
            start_time = time.time()
            last_log_count = 0
            execution_started = False
            
            retry_interval = 15
            last_retry = 0

            while time.time() - start_time < 300:
                # 1. Check for Success Modal
                if await page.locator("text=MISSION REPORT").count() > 0:
                    print("Report Detected!")
                    break
                
                # 2. Check Logs
                logs_text = ""
                try:
                    log_locator = page.locator("div.overflow-y-auto >> div.space-y-1")
                    if await log_locator.count() > 0:
                        logs_text = await log_locator.inner_text()
                        if "System Idle" not in logs_text and len(logs_text) > 50:
                            execution_started = True
                        
                        if logs_text and len(logs_text) > last_log_count + 5:
                            print(f"--- Live Log Update ---")
                            lines = logs_text.split('\n')
                            print('\n'.join(lines[-5:]))
                            print("-----------------------")
                            last_log_count = len(logs_text)
                except:
                    pass

                # 3. Retry Execution if Idle
                if not execution_started and (time.time() - last_retry > retry_interval):
                    print("Status is Idle. Retrying Execute Action...")
                    last_retry = time.time()
                    
                    # Try Button Click
                    run_btn = page.locator("button", has_text=re.compile(r"EXECUTE|RUN", re.IGNORECASE)).first
                    if await run_btn.count() > 0 and not await run_btn.is_disabled():
                         print("Clicking Execute Button...")
                         await run_btn.click(force=True)
                    else:
                        print("Button not found or disabled.")

                    # Try Enter Key
                    print("Pressing Enter in Textarea...")
                    await input_locator.focus()
                    await input_locator.press("Enter")
                
                await asyncio.sleep(2)

            # Scroll
            for i in range(5):
                await page.mouse.wheel(0, 700)
                time.sleep(1)
            
            # Checks
            if await page.locator("text=MISSION REPORT").count() > 0:
                actions = page.locator("button[title='Copy Report']")
                if await actions.count() > 0:
                     print("Found Copy Button.")
                
                await page.screenshot(path="sentinel_report_final_success.png", full_page=True)
                print("Test Complete. Verified.")
            else:
                print("Timeout reached without Mission Report.")
                await page.screenshot(path="timeout_fail.png")

        except Exception as e:
            print(f"Error during interaction: {e}")
            message = str(e)
            if "Target closed" in message:
                print("Browser closed unexpectedly.")
            else:
                await page.screenshot(path="error_final_fix.png")
            
        finally:
            print("Closing browser...")
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
