// Embedded 1-click installer scripts (source of truth for in-app download).
// Kept identical to /install-windows.bat and /install-pi.sh at repo root.

export const INSTALL_WINDOWS_BAT = `@echo off
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

if not exist "backend\\.env.docker" (
  copy "backend\\.env.docker.example" "backend\\.env.docker" >nul
  echo [OK] Dibuat file  backend\\.env.docker
  echo.
  echo PENTING: buka file tersebut, ganti JWT_SECRET, isi email/password admin,
  echo dan kunci AI Anda ^(EMERGENT_LLM_KEY biarkan kosong^). Simpan, lalu tekan tombol.
  notepad "backend\\.env.docker"
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
`;

export const INSTALL_PI_SH = `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "============================================"
echo "  Grand Aceh Kuliner POS - Installer Pi/Linux"
echo "============================================"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] Docker belum terpasang. Pasang dulu:"
  echo "  curl -fsSL https://get.docker.com | sh"
  echo "Lalu jalankan ulang skrip ini."
  exit 1
fi

# Raspberry Pi / ARM -> MongoDB 4.4 (versi terbaru tidak jalan di CPU Pi)
if [ ! -f .env ]; then
  ARCH="$(uname -m)"
  case "$ARCH" in
    aarch64|armv7l|armv8*)
      echo "MONGO_IMAGE=mongo:4.4" > .env
      echo "[OK] Terdeteksi ARM ($ARCH) -> memakai mongo:4.4"
      ;;
  esac
fi

NEEDS_EDIT=0
if [ ! -f backend/.env.docker ]; then
  cp backend/.env.docker.example backend/.env.docker
  echo "[OK] Dibuat file backend/.env.docker"
  NEEDS_EDIT=1
fi
if grep -q "GANTI_DENGAN_ACAK" backend/.env.docker; then
  NEEDS_EDIT=1
fi
if [ "\${NEEDS_EDIT}" = "1" ]; then
  echo "Membuka editor untuk mengisi konfigurasi (JWT_SECRET, email/password admin, kunci AI)..."
  EDITOR_BIN="\${EDITOR:-}"
  if [ -z "\${EDITOR_BIN}" ]; then
    if command -v nano >/dev/null 2>&1; then EDITOR_BIN=nano
    elif command -v vi >/dev/null 2>&1; then EDITOR_BIN=vi
    fi
  fi
  if [ -n "\${EDITOR_BIN}" ]; then
    "\${EDITOR_BIN}" backend/.env.docker
  else
    echo "Editor teks tidak ditemukan. Edit manual backend/.env.docker lalu jalankan ulang."
    exit 0
  fi
  if grep -q "GANTI_DENGAN_ACAK" backend/.env.docker; then
    echo "[PERINGATAN] JWT_SECRET masih placeholder. Edit backend/.env.docker lalu jalankan ulang skrip ini."
    exit 1
  fi
fi

echo
echo "Membangun & menjalankan... (unduhan pertama bisa memakan waktu)"
docker compose up -d --build

echo
echo "================= SELESAI ================="
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "Buka di browser:   http://\${IP:-IP-KOMPUTER-INI}"
echo "==========================================="
`;

export const UPDATE_WINDOWS_BAT = `@echo off
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
`;

export const UPDATE_PI_SH = `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "=== Update Grand Aceh Kuliner POS (Pi/Linux) ==="
if [ -d .git ]; then
  echo "Menarik pembaruan terbaru dari Git..."
  git pull --ff-only || echo "(git pull dilewati)"
fi
echo "Membangun ulang & menjalankan versi terbaru..."
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true
echo "Selesai. Aplikasi sudah versi terbaru."
`;

export const BACKUP_WINDOWS_BAT = `@echo off
cd /d "%~dp0"
if not exist backups mkdir backups
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set dt=%%a
set TS=%dt:~0,8%-%dt:~8,6%
set FILE=backups\\gak-backup-%TS%.gz
echo Membuat backup database -^> %FILE%
docker compose exec -T mongo sh -c "mongodump --archive --gzip" > "%FILE%"
echo Selesai. Backup tersimpan di %FILE%
pause
`;

export const BACKUP_PI_SH = `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
mkdir -p backups
TS="$(date +%Y%m%d-%H%M%S)"
FILE="backups/gak-backup-$TS.gz"
echo "Membuat backup database -> $FILE"
docker compose exec -T mongo sh -c 'mongodump --archive --gzip' > "$FILE"
echo "Selesai. Backup tersimpan di $FILE"
find backups -name 'gak-backup-*.gz' -mtime +30 -delete 2>/dev/null || true
`;

export const RESTORE_WINDOWS_BAT = `@echo off
cd /d "%~dp0"
if "%~1"=="" (
  echo Pemakaian: seret file backup .gz ke atas skrip ini,
  echo atau jalankan: restore-windows.bat backups\\gak-backup-XXXX.gz
  echo.
  echo Daftar backup tersedia:
  dir /b backups\\*.gz 2>nul
  pause
  exit /b 1
)
echo PERINGATAN: ini akan MENIMPA seluruh data saat ini dengan isi %~1
set /p ok="Ketik YA untuk lanjut: "
if /i not "%ok%"=="YA" (echo Dibatalkan. ^& pause ^& exit /b 1)
docker compose exec -T mongo sh -c "mongorestore --archive --gzip --drop" < "%~1"
echo Restore selesai.
pause
`;

export const RESTORE_PI_SH = `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
FILE="$1"
if [ -z "$FILE" ]; then
  echo "Pemakaian: ./restore-pi.sh backups/gak-backup-XXXX.gz"
  echo "Daftar backup tersedia:"
  ls -1 backups/*.gz 2>/dev/null || echo "(belum ada backup)"
  exit 1
fi
echo "PERINGATAN: ini akan MENIMPA seluruh data saat ini dengan isi $FILE"
read -p "Ketik YA untuk lanjut: " ok
[ "$ok" = "YA" ] || { echo "Dibatalkan."; exit 1; }
docker compose exec -T mongo sh -c 'mongorestore --archive --gzip --drop' < "$FILE"
echo "Restore selesai."
`;

export const RESTART_WINDOWS_BAT = `@echo off
cd /d "%~dp0"
echo Memuat ulang server...
docker compose restart
echo Server dimuat ulang.
pause
`;

export const RESTART_PI_SH = `#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Memuat ulang server..."
docker compose restart
echo "Server dimuat ulang."
`;

export const SETUP_AUTOBACKUP_PI_SH = `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
DIR="$(pwd)"
mkdir -p backups
chmod +x backup-pi.sh 2>/dev/null || true
LINE="0 23 * * * cd $DIR && ./backup-pi.sh >> $DIR/backups/autobackup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'backup-pi.sh' ; echo "$LINE" ) | crontab -
echo "Backup otomatis harian dipasang setiap pukul 23:00."
echo "Lihat jadwal : crontab -l"
echo "Log          : backups/autobackup.log"
echo "Batalkan     : crontab -e  (hapus baris backup-pi.sh)"
`;

export const BOOTSTRAP_PI_SH = `#!/usr/bin/env bash
set -e
# Install & update Grand Aceh POS LANGSUNG dari GitHub.
# Repo default bisa ditimpa:  REPO_URL=... APP_DIR=... ./bootstrap-pi.sh
REPO="\${REPO_URL:-https://github.com/taqim2609/POS-grand.git}"
APP_DIR="\${APP_DIR:-$HOME/grand-aceh-pos}"

echo "=== Bootstrap Grand Aceh POS (Raspberry Pi / GitHub) ==="
echo "Repo   : $REPO"
echo "Folder : $APP_DIR"
echo

# 1. git
if ! command -v git >/dev/null 2>&1; then
  echo "Memasang git..."
  sudo apt-get update && sudo apt-get install -y git
fi

# 2. Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "Memasang Docker (butuh internet)..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  sudo systemctl enable docker 2>/dev/null || true
  echo "[OK] Docker terpasang."
fi

# 3. Ambil / perbarui kode dari GitHub
if [ -d "$APP_DIR/.git" ]; then
  echo "Proyek sudah ada -> menarik pembaruan (git pull)..."
  git -C "$APP_DIR" pull --ff-only || true
else
  echo "Mengunduh proyek dari GitHub..."
  git clone "$REPO" "$APP_DIR"
fi

# 4. Jalankan installer
cd "$APP_DIR"
chmod +x install-pi.sh update-pi.sh restart-pi.sh backup-pi.sh restore-pi.sh setup-autobackup-pi.sh 2>/dev/null || true
echo "Menjalankan installer..."
sudo ./install-pi.sh
`;

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
