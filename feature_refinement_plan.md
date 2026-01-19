# Feature Refinement Plan

## 1. Silence Risk Updates
**Goal**: Stop "RISK" updates from cluttering the main terminal.
- **File**: `backend/integration/risk_command.py`
- **Action**: Locate print statements related to periodic risk updates (e.g., "RISK: ...") and either comment them out or wrap them in a debug flag checkout.

## 2. Admin Detailed Logs
**Goal**: Allow admins to view server logs from the dashboard.
- **Backend**:
    - [NEW] Endpoint `GET /api/admin/logs` in `backend/routers/web.py` (or new `routers/admin.py`?).
    - Functionality: Reads the last N lines of `server.log` (or `startup.log` / `server_error.log`).
    - Security: Strictly restricted to Super Admins.
- **Frontend**:
    - [MODIFY] `src/pages/AdminDashboard.jsx`:
        - Add "Logs" tab.
        - Add `LogViewer` component (terminal style).

## 3. Orion Core Explanation
**Goal**: Explain to user.
- **Context**: `OrionManager` is a process supervisor. `orion_v2.py` is the actual core script (likely the "AI" or "Automation" brain).
- **Deliverable**: Clear, non-technical + technical explanation in final response.

## 4. VPS Deployment
**Goal**: Git message.
- **Deliverable**: A standard git commit/push command set.
