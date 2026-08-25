@echo off
cd /d "%~dp0"
echo Memuat ulang server...
docker compose restart
echo Server dimuat ulang.
pause
