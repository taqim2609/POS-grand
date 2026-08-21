#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Memuat ulang server..."
docker compose restart
echo "Server dimuat ulang."
