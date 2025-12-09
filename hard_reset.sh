#!/bin/bash
echo "Attemping to hard reset application processes..."

# 1. Kill Node/NPM processes
echo "Killing node processes..."
pkill -f "node" || echo "No node processes found"
pkill -f "npm" || echo "No npm processes found"
pkill -f "vite" || echo "No vite processes found"

# 2. Kill Python processes (Backend)
echo "Killing python processes..."
pkill -f "python" || echo "No python processes found"
pkill -f "uvicorn" || echo "No uvicorn processes found"

# 3. Clear install cache (optional but good for hard reset)
# rm -rf node_modules
# rm -rf dist

# 4. Rebuild Front End
echo "Installing dependencies..."
npm install
echo "Building Front End..."
npm run build

# 5. Restart Backend (Assuming using PM2 or similar, otherwise just background it)
# Adjust this based on your actual startup script
echo "Starting Backend..."
nohup python3 backend/main.py > backend.log 2>&1 &

# 6. Serve Frontend (if using a simple serve)
echo "Starting Frontend..."
nohup npm run preview > frontend.log 2>&1 &

echo "Hard reset complete. Check logs for details."
