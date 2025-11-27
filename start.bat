@echo off
REM Quick Start Script for UPSC Current Affairs Analyzer (Windows)

echo.
echo 🚀 UPSC Current Affairs Analyzer - Quick Start
echo ==============================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

REM Check if .env has API key
findstr /C:"your_gemini_api_key_here" .env >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  WARNING: Please add your Gemini API key to .env file
    echo    Get it from: https://ai.google.dev/
    echo.
    echo    Edit .env and replace:
    echo    VITE_GEMINI_API_KEY=your_gemini_api_key_here
    echo.
    pause
    echo.
)

REM Create uploads directory if it doesn't exist
if not exist "uploads" mkdir uploads

echo ✅ Setup complete!
echo.
echo 🎯 Starting both servers...
echo    - Backend:  http://localhost:3001
echo    - Frontend: http://localhost:5173
echo.
echo Press Ctrl+C to stop both servers
echo.

REM Start both servers
npm run dev:full
