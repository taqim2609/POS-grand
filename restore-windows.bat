@echo off
cd /d "%~dp0"
if "%~1"=="" (
  echo Pemakaian: seret file backup .gz ke atas skrip ini,
  echo atau jalankan: restore-windows.bat backups\gak-backup-XXXX.gz
  echo.
  echo Daftar backup tersedia:
  dir /b backups\*.gz 2>nul
  pause
  exit /b 1
)
echo PERINGATAN: ini akan MENIMPA seluruh data saat ini dengan isi %~1
set /p ok="Ketik YA untuk lanjut: "
if /i not "%ok%"=="YA" (echo Dibatalkan. & pause & exit /b 1)
docker compose exec -T mongo sh -c "mongorestore --archive --gzip --drop" < "%~1"
echo Restore selesai.
pause
