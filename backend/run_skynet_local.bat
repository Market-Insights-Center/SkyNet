@echo off
echo Starting SkyNet V2 Local Bridge...

cd /d "%~dp0"

IF EXIST venv (
    echo Activating virtual environment...
    call venv\Scripts\activate
) ELSE (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate
    echo Installing dependencies...
    pip install -r requirements.txt
    pip install pyaudio
)

echo.
echo ===================================================
echo  PLEASE ENSURE WEB CAMERA IS CONNECTED
echo  KEEP THIS WINDOW OPEN WHILE USING SKYNET
echo ===================================================
echo.

python skynet_v2.py

echo.
echo SkyNet has stopped.
pause
