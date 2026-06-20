@echo off
setlocal
title UTM Borrow Launcher
echo ============================================
echo   UTM Borrow - Starting backend + frontend
echo ============================================
echo.

REM ---------- Prerequisite checks ----------
where py >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python is not installed or not on PATH.
  echo         Install Python 3.11+ from https://www.python.org/downloads/
  echo         and tick "Add python.exe to PATH" during setup.
  echo.
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js / npm is not installed or not on PATH.
  echo         Install the LTS version from https://nodejs.org/ then re-run this file.
  echo.
  pause
  exit /b 1
)

REM ---------- First-run setup: backend virtual environment ----------
if not exist "%~dp0backend\.venv\Scripts\python.exe" (
  echo [SETUP] Creating Python virtual environment ^(first run only^)...
  pushd "%~dp0backend"
  py -m venv .venv
  echo [SETUP] Installing backend dependencies...
  ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
  ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
  popd
  echo [SETUP] Backend ready.
  echo.
)

REM ---------- First-run setup: frontend dependencies ----------
if not exist "%~dp0frontend\node_modules\react-scripts" (
  echo [SETUP] Installing frontend dependencies ^(first run only, may take a few minutes^)...
  pushd "%~dp0frontend"
  call npm install
  popd
  echo [SETUP] Frontend ready.
  echo.
)

echo Stopping old instances...
taskkill /f /im node.exe >nul 2>&1
REM Free up backend port 8000 and frontend port 3000 (kill any stale listeners)
for %%P in (8000 3000) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    taskkill /f /pid %%I >nul 2>&1
  )
)
timeout /t 2 /nobreak >nul

echo Starting Backend (FastAPI :8000)...
start "UTM Borrow Backend" cmd /k "cd /d %~dp0backend && .\.venv\Scripts\python.exe -m uvicorn server:app --reload"
timeout /t 3 /nobreak >nul

echo Starting Frontend (React :3000)...
start "UTM Borrow Frontend" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo Done. The browser will open http://localhost:3000 shortly.
echo (If the backend window shows a MongoDB connection error, make sure MongoDB is running.)
pause
