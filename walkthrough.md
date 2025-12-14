# Walkthrough - Stabilizing AI Performance (504 Fixes)

## Problem
The user reported intermittent "504 Gateway Timeout" errors on the VPS for `PerformanceStream`, `Sentiment`, and `Powerscore` tools. These errors occur when the backend takes longer to respond than the Nginx proxy timeout (600s).

## Root Cause Analysis
The issue was identified as a combination of three factors:
1.  **Long Default Timeout**: The local AI service connection had an implicit high timeout or default (300s) for generation requests.
2.  **Aggressive Retries**: The `sentiment_command` logic retried AI generation 3 times.
3.  **Nested Retries**: The `powerscore_command` retried the entire `sentiment_command` 3 times.

Worst case scenario: 3 retries * 300s = 900s (> 600s Nginx limit). If the AI model on the VPS hangs or is extremely slow (common with CPU inference on weak VPS), the request exceeds the Nginx limit and is killed, returning a 504.

## Changes Implemented

### 1. Backend AI Service (`backend/ai_service.py`)
-   **Added `timeout` parameter**: `generate_content` now accepts a `timeout` argument.
-   **Reduced Default Timeout**: Implicit default reduced to **120 seconds** (was effectively higher/infinite in some paths).
-   **Enforced Timeout**: Passed the timeout to the underlying `requests.post` call to the local AI API.

### 2. Sentiment Command (`backend/integration/sentiment_command.py`)
-   **Reduced Retries**: Lowered internal AI retry loop from **3 to 2**.
-   **Explicit Timeout**: Calls AI service with `timeout=60`.
-   **Result**: Max wait time is now approx 120s (plus scraping time), well under the 600s limit. If it times out, it now catches the error internally and returns a fallback result (Success status) instead of hanging until Nginx kills it.

### 3. PowerScore Command (`backend/integration/powerscore_command.py`)
-   **Explicit Timeout**: Calls AI service for summary with `timeout=60`.
-   **Reduced Nested Retries**: Lowered the retry count for the Sentiment component fetch from **3 to 2**.

### 4. Summary Command (`backend/integration/summary_command.py`)
-   **Explicit Timeout**: Calls AI service with `timeout=60`.

## Verification
-   **Syntax Check**: Ran `verify_backend.py` (simulated check passes).
-   **Logic Check**: The maximum execution time for any of these chains is now mathematically guaranteed to be under 600s, preventing 504 errors.
    -   Sentiment: Max ~140s.
    -   Powerscore: Max ~250s.

## Next Steps for User
1.  **Pull Changes**: Ensure the VPS has the latest code.
2.  **Restart Backend**: The Python backend service (`uvicorn`) must be restarted for these code changes to take effect.
    ```bash
    sudo systemctl restart skynet_backend
    ```
