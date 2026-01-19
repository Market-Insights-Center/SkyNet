# Health Dashboard Implementation

## Goal
Add a visual health status indicator to the frontend to verify backend connectivity and Orion service status.

## Frontend Changes
### [NEW] `src/components/HealthStatus.jsx`
- Polls `/health` endpoint every 30 seconds.
- Displays connection status (Online/Offline).
- Displays Orion service status.
- Styled with glassmorphism to match existing aesthetic.

### [MODIFY] `src/App.jsx`
- Import `HealthStatus`
- Add to the main layout, fixed at bottom right or integrated into a Dashboard page.
