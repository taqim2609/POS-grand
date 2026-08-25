@echo off
cd /d "%~dp0"
if not exist backups mkdir backups
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set dt=%%a
set TS=%dt:~0,8%-%dt:~8,6%
set FILE=backups\gak-backup-%TS%.gz
echo Membuat backup database -^> %FILE%
docker compose exec -T mongo sh -c "mongodump --archive --gzip" > "%FILE%"
echo Selesai. Backup tersimpan di %FILE%
pause
