@echo off
setlocal enabledelayedexpansion
title Mumble Web - Setup

echo.
echo ============================================================
echo   Mumble Web Setup
echo ============================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download it from https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER%

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm not found.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
echo [OK] npm %NPM_VER%
echo.

:: Clean old node_modules
if exist node_modules (
    echo [1/3] Removing old node_modules ...
    powershell -NoProfile -Command "Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue" 2>nul
    if exist node_modules (
        echo       Still locked - waiting 3s and retrying ...
        timeout /t 3 /nobreak >nul
        powershell -NoProfile -Command "Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue" 2>nul
    )
    if exist node_modules (
        echo [WARN] Could not fully remove node_modules. Continuing anyway.
    ) else (
        echo       Done.
    )
) else (
    echo [1/3] No old node_modules to clean.
)

:: Remove old lockfile so npm does not try to upgrade its format
if exist package-lock.json (
    del /q package-lock.json
    echo       Removed old package-lock.json.
)
echo.

:: Install
echo [2/3] Installing dependencies (this takes a minute) ...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm install failed. See output above.
    pause & exit /b 1
)
echo       Done.
echo.

:: Build
echo [3/3] Building ...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed. See output above.
    pause & exit /b 1
)
echo       Done.
echo.

echo ============================================================
echo   Success!  Built files are in the  dist/  folder.
echo   Serve that folder with any static web server, e.g.:
echo     npx serve dist
echo ============================================================
echo.
pause
