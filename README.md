# TikTok Media Downloader API

A professional REST API built with **Node.js + Express** that extracts direct
download URLs and metadata from TikTok videos using **yt-dlp** — no
third-party APIs, no file storage on the server.

---

## Features

| Feature | Details |
|---|---|
| Videos (no watermark) | Highest-quality mp4 stream |
| Videos (with watermark) | Alternative stream when available |
| Slideshow videos | Handled by yt-dlp automatically |
| Audio extraction | Best audio-only stream (m4a/mp3) |
| Quality | Up to 1080p (highest available) |
| Auth | API-key header (`x-api-key`) |
| Security | CORS, input validation, error mapping |

---

## Project Structure

```
tiktok-api/
├── server.js          # Express application
├── package.json
├── Dockerfile
├── .dockerignore
├── .env.example       # Copy to .env and edit
└── README.md
```

---

## Quick Start (Local)

### Prerequisites

- Node.js ≥ 18
- Python 3 + pip
- `yt-dlp` on your PATH (`pip install yt-dlp`)
- `ffmpeg` on your PATH

### 1 — Clone / unzip and install

```bash
npm install
```

### 2 — Configure environment

```bash
cp .env.example .env
# Edit .env — set API_KEY to a strong secret
```

### 3 — Run

```bash
npm start
# or for hot-reload during development:
npm run dev
```

The server starts on **http://localhost:3000**.

---

## API Reference

### Health check

```
GET /health
→ { "status": "ok" }
```

---

### Extract TikTok media

```
POST /api/tiktok
```

**Headers**

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `x-api-key` | your API key (e.g. `maim1234`) |

**Request body**

```json
{
  "url": "https://www.tiktok.com/@username/video/123456789"
}
```

Supported URL formats:
- `https://www.tiktok.com/@username/video/VIDEO_ID`
- `https://vm.tiktok.com/SHORT_CODE`
- `https://vt.tiktok.com/SHORT_CODE`

**Success response (200)**

```json
{
  "success": true,
  "platform": "tiktok",
  "title": "Video title or description",
  "author": "username",
  "thumbnail": "https://...",
  "duration": "0:15",
  "download": {
    "nowatermark": "https://... (direct mp4 URL)",
    "watermark":   "https://... (direct mp4 URL)",
    "audio":       "https://... (direct audio URL)"
  }
}
```

**Error responses**

| HTTP | `error` message |
|---|---|
| 401 | `Unauthorized` |
| 400 | `Missing or invalid 'url' field` |
| 400 | `Invalid TikTok URL` |
| 403 | `TikTok video is private or requires login` |
| 404 | `TikTok video has been removed or is unavailable` |
| 504 | `Request timed out while extracting video info` |
| 500 | `TikTok video could not be extracted` |

---

## cURL Example

```bash
curl -X POST http://localhost:3000/api/tiktok \
  -H "Content-Type: application/json" \
  -H "x-api-key: maim1234" \
  -d '{"url":"https://www.tiktok.com/@username/video/123456789"}'
```

---

## Deploy to Render (Docker)

Render's free tier supports Docker deployments with auto-HTTPS.

### Step-by-step

1. **Push your code** to a GitHub repository (public or private).

2. **Create a new Web Service** on [render.com](https://render.com):
   - Connect your GitHub repo
   - Set **Environment** → `Docker`
   - Render auto-detects the `Dockerfile`

3. **Set environment variables** in the Render dashboard
   (Settings → Environment):

   | Key | Value |
   |---|---|
   | `API_KEY` | your secret key |
   | `PORT` | `3000` (Render also injects this automatically) |

4. Click **Deploy** — Render builds the Docker image and starts the service.

5. Your API is live at:
   ```
   https://your-service-name.onrender.com/api/tiktok
   ```

> **Note:** Render free-tier instances spin down after 15 minutes of
> inactivity. Upgrade to a paid plan for always-on behaviour.

---

## How It Works

```
Client ──POST /api/tiktok──► Express
                                │
                    validate URL & API key
                                │
                    spawn yt-dlp --dump-json
                    (no download, metadata only)
                                │
                    parse format list
                    pick best no-wm / wm / audio URLs
                                │
                    return JSON with direct CDN URLs
                                ▼
Client receives direct TikTok CDN URLs and streams the media itself
```

The server **never stores any media file**. All returned URLs point directly
to TikTok's CDN and are valid for the duration of the session returned by
yt-dlp (usually several hours).

---

## Updating yt-dlp

TikTok changes its API frequently. Keep yt-dlp up-to-date:

```bash
# Local
pip install -U yt-dlp

# Docker — rebuild the image
docker build --no-cache -t tiktok-api .
```

On Render, trigger a manual deploy to rebuild the image with the latest
yt-dlp version.

---

## License

MIT
