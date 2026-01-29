@echo off
chcp 65001 >nul
setlocal

echo "=================================================="
echo "      Document Expert - Setup & Run Script"
echo "=================================================="

:: 1. Check for Node.js
echo [1/3] Checking Node.js installation...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo Node.js is installed.

:: 2. Check and Install Dependencies
echo [2/3] Checking dependencies...
if not exist "node_modules" (
    echo Dependencies not found. Installing latest versions...
    call npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies.
        pause
        exit /b 1
    )
) else (
    echo Dependencies are already installed.
)

:: 3. Start the Application
echo [3/3] Starting the application...
echo.
echo The application will start in your default browser.
echo Press Ctrl+C to stop the server.
echo.

call npm run dev

endlocal
