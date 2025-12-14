# Walkthrough - AI Performance & Timeout Configuration

## Problem
The user requested that all AI hard limits be increased to **600 seconds** to accommodate potentially slow inference times on the VPS, while preventing 504 errors.

## Solution
To safely support a 600s application timeout, the Nginx proxy timeout must be significantly higher to avoid a race condition where the proxy kills the connection just as the application is about to finish.

## Changes Implemented

### 1. Nginx Configuration (`deployment/nginx_config`)
-   **Increased Proxy Timeouts**: Set `proxy_read_timeout`, `proxy_connect_timeout`, and `proxy_send_timeout` to **900 seconds** (15 minutes).
-   **Why**: This provides a 300s buffer above the application timeout, ensuring that valid long-running requests are not interrupted by the web server.

### 2. Backend AI Service (`backend/ai_service.py`)
-   **Default Timeout**: Increased default `timeout` to **600 seconds**.
-   **Logic**: Any call to `ai.generate_content` without an explicit timeout will now wait up to 10 minutes.

### 3. Command Timeouts (`backend/integration/*.py`)
-   **Sentiment Command**: Explicitly set `timeout=600` for AI generation (was 60). Scraping timeout remains strict (45s) to avoid wasting time on dead datasources.
-   **Powerscore Command**: Explicitly set `timeout=600` for AI summary generation (was 60).
-   **Summary Command**: Explicitly set `timeout=600` for business summary generation (was 60).

## Verification
-   **Configuration Check**: Verified 900s usage in `nginx_config`.
-   **Code Check**: Verified 600s usage in python files.
-   **Safe Deployment**: These changes require a backend restart and Nginx reload.

## Next Steps for User
1.  **Pull Changes**: Update the VPS codebase.
2.  **Restart Backend**:
    ```bash
    sudo systemctl restart skynet_backend
    ```
3.  **Reload Nginx** (Critical for the 900s limit to apply):
    ```bash
    sudo systemctl reload nginx
    ```
    *If you don't reload Nginx, it will still kill requests at 600s.*
