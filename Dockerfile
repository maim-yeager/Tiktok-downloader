# ── Stage: base image ──────────────────────────────────────────────────────────
FROM node:20-slim

# Metadata
LABEL maintainer="TikTok API"
LABEL description="TikTok Media Downloader API — yt-dlp + Node.js + Express"

# ── System dependencies ────────────────────────────────────────────────────────
# python3, pip, ffmpeg are required by yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ── Install yt-dlp via pip (kept up-to-date at build time) ────────────────────
# Use a venv to avoid PEP 668 "externally managed environment" error
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir -U pip yt-dlp

# Put the venv on the PATH so `yt-dlp` is found by child_process
ENV PATH="/opt/venv/bin:$PATH"

# ── Node app ───────────────────────────────────────────────────────────────────
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

RUN npm install --omit=dev

# Copy application source
COPY . .

# ── Runtime ───────────────────────────────────────────────────────────────────
EXPOSE 3000

# Run as a non-root user for security
RUN useradd -m appuser && chown -R appuser /app
USER appuser

CMD ["node", "server.js"]
