@echo off
echo ===========================================
echo  Fixing SkyNet Desktop App Dependencies
echo ===========================================
echo.

cd electron

echo [1/3] Installing Dependencies...
call npm install

echo.
echo [2/3] Rebuilding Native Modules (RobotJS)...
echo This may take a moment...
call npx electron-rebuild -f -w robotjs

echo.
echo [3/3] Done! You can now run "npm start" inside the electron folder.
echo.
pause
