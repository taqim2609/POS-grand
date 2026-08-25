@echo off
setlocal
set REPO=https://github.com/taqim2609/POS-grand.git
set APP_DIR=grand-aceh-pos
echo ============================================
echo   Grand Aceh Kuliner POS - Bootstrap Windows
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git belum terpasang. Pasang Git for Windows dulu:
  echo   https://git-scm.com/download/win
  pause
  exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker belum terpasang. Pasang Docker Desktop dulu:
  echo   https://www.docker.com/products/docker-desktop
  pause
  exit /b 1
)

if exist "%APP_DIR%\.git" (
  echo Proyek sudah ada -^> menarik pembaruan...
  cd /d "%APP_DIR%"
  git pull --ff-only
) else (
  echo Mengunduh proyek dari GitHub...
  git clone %REPO% "%APP_DIR%"
  cd /d "%APP_DIR%"
)

echo.
echo Menjalankan installer...
call install-windows.bat
