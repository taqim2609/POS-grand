@echo off
cd /d "%~dp0"
echo === Update Grand Aceh Kuliner POS (Windows) ===
if exist ".git" (
  echo Menarik pembaruan terbaru dari Git...
  git pull --ff-only
)
echo Membangun ulang dan menjalankan versi terbaru...
docker compose up -d --build
docker image prune -f >nul 2>nul
echo.
echo Selesai. Aplikasi sudah versi terbaru.
pause
