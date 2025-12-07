#!/bin/bash

# SkyNet Quick Update Script
# Usage: ./deployment/update.sh

echo "⬇️  Pulling latest changes..."
git pull

echo "📦 Installing any new dependencies..."
# Check if requirements.txt changed
if git diff --name-only HEAD@{1} HEAD | grep -q "backend/requirements.txt"; then
    echo "🐍 Python requirements changed. Installing..."
    cd backend
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# Check if package.json changed
if git diff --name-only HEAD@{1} HEAD | grep -q "package.json"; then
    echo "📦 Node modules changed. Installing..."
    npm install
fi

echo "🏗️  Building Frontend..."
npm run build

echo "🔄 Restarting Backend..."
pm2 restart mic-backend

echo "✅ Update Complete!"
