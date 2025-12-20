#!/bin/bash
# Full reset for VPS deployment
# Run this to kill all processes, pull latest code, and restart everything.

set -e # Exit on error

echo "🛑 RED ALERT: Killing ALL background processes..."

# 1. Kill PM2 processes
pm2 delete all || echo "PM2 processes already cleared"

# 2. Kill system processes aggressively
pkill -f "python" || echo "No python processes found"
pkill -f "uvicorn" || echo "No uvicorn processes found"
pkill -f "node" || echo "No node processes found"

# 3. Ensure port 8000 is free (Ubuntu/Debian usually has fuser)
if command -v fuser &> /dev/null; then
    fuser -k -9 8000/tcp || echo "Port 8000 was free"
fi

echo "⬇️  Pulling latest code..."
git reset --hard HEAD
git pull
echo "✅ Code pulled. Current Commit:"
git log -1 --oneline

echo "📦 Re-installing dependencies..."
# Frontend
npm install

# Backend
cd backend
if [ -d "venv" ]; then
    source venv/bin/activate
else
    python3 -m venv venv
    source venv/bin/activate
fi
pip install -r requirements.txt
cd ..

echo "🧹 Cleaning old build..."
rm -rf dist

echo "🏗️  Rebuilding Frontend..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ BUILD FAILED: dist directory not found!"
    exit 1
fi

echo "🚀 Restarting Backend..."
# Switch to backend directory for correct path resolution
cd backend
pm2 start "./venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000" --name mic-backend
pm2 save
cd ..

echo "✅ Full Reset Complete! Access your site to verify."
echo "Current Time: $(date)"
