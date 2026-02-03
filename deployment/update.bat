@echo off
echo ⬇️  Pulling latest changes...
git pull

echo 📦 Installing dependencies...

REM Check/Install Python Deps
if exist backend\requirements.txt (
    echo 🐍 Installing Python requirements...
    cd backend
    if exist .venv\Scripts\activate.bat (
        call .venv\Scripts\activate.bat
    ) else (
        echo Creating venv...
        python -m venv .venv
        call .venv\Scripts\activate.bat
    )
    pip install -r requirements.txt
    cd ..
)

REM Check/Install Node Deps
if exist package.json (
    echo 📦 Installing Node modules...
    call npm install
)

echo 🏗️  Building Frontend...
call npm run build

echo 🔄 Restarting Backend...
REM Using careful start logic if PM2 is missing or different
call pm2 restart mic-backend || (
    echo PM2 restart failed. Attempting direct start...
    cd backend
    start "SkyNet Backend" .venv\Scripts\python.exe main.py
    cd ..
)

echo ✅ Update Complete!
pause
