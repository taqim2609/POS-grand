@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo ============================================
echo   Grand Aceh Kuliner POS - Installer Windows
echo ============================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker belum terpasang.
  echo Pasang Docker Desktop dulu: https://www.docker.com/products/docker-desktop
  echo Setelah terpasang dan berjalan, jalankan ulang skrip ini.
  pause
  exit /b 1
)

if not exist "backend\.env.docker" (
  copy "backend\.env.docker.example" "backend\.env.docker" >nul
  echo [OK] Dibuat file  backend\.env.docker
  echo.
  echo PENTING: buka file tersebut, ganti JWT_SECRET, isi email/password admin,
  echo dan kunci AI Anda ^(EMERGENT_LLM_KEY biarkan kosong^). Simpan, lalu tekan tombol.
  notepad "backend\.env.docker"
  echo Tekan sembarang tombol jika sudah selesai mengedit...
  pause >nul
)

echo.
echo Membangun dan menjalankan... (unduhan pertama bisa memakan waktu)
docker compose up -d --build
if errorlevel 1 (
  echo [ERROR] Gagal menjalankan. Pastikan Docker Desktop sedang berjalan.
  pause
  exit /b 1
)

echo.
echo ================= SELESAI =================
echo Cari IP komputer ini dengan perintah:  ipconfig  (lihat IPv4 Address)
echo Buka di browser:   http://IP-KOMPUTER-INI
echo Contoh:            http://192.168.1.100
echo ===========================================
pause
