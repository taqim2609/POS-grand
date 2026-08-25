FROM node:20-bookworm-slim

# Chromium sistem (dipakai whatsapp-web.js via CHROME_BIN) — mendukung x86 & ARM64.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ca-certificates fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_BIN=/usr/bin/chromium

WORKDIR /app/whatsapp-service

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001
CMD ["node", "index.js"]
