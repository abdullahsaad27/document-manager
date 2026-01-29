@echo off
echo ==========================================
echo      Auto Update Script - Document Manager
echo ==========================================

echo [1/4] Adding changes...
git add .

set "msg=%~1"
if "%msg%"=="" (
    set /p "msg=Enter commit message (Press Enter for 'Auto update'): "
)
if "%msg%"=="" set "msg=Auto update"

echo [2/4] Committing: "%msg%"...
git commit -m "%msg%"

echo [3/4] Pushing to GitHub...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Push failed.
    pause
    exit /b %ERRORLEVEL%
)

echo [4/4] Deploying to GitHub Pages...
call npm run deploy
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Deploy failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==========================================
echo      SUCCESS! Website updated.
echo ==========================================
if "%~1"=="" pause