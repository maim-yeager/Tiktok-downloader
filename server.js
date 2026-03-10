const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { exec } = require("child_process");
const { promisify } = require("util");

dotenv.config();

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "maim1234";

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
}

// ─── TikTok URL Validator ─────────────────────────────────────────────────────
function isValidTikTokUrl(url) {
  return /tiktok\.com\/@[\w.-]+\/video\/\d+|vm\.tiktok\.com\/\w+|vt\.tiktok\.com\/\w+/.test(
    url
  );
}

// ─── yt-dlp Extractor ─────────────────────────────────────────────────────────
async function extractTikTokInfo(url) {
  const TIMEOUT_MS = 30_000;

  // Dump full JSON metadata; no actual download
  const cmd = [
    "yt-dlp",
    "--dump-json",
    "--no-download",
    "--no-warnings",
    "--no-playlist",
    "--user-agent",
    '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"',
    `"${url}"`,
  ].join(" ");

  const { stdout } = await execAsync(cmd, {
    timeout: TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024, // 10 MB
  });

  return JSON.parse(stdout.trim());
}

// ─── Pick best format URLs ────────────────────────────────────────────────────
function resolveMediaUrls(info) {
  const formats = info.formats || [];

  // No-watermark: TikTok encodes the watermark-free stream as format_id
  // containing "h264" or noted as "play_addr" / download_addr in the url
  // yt-dlp exposes it via the `url` field on the best video format.
  // We pick the highest-resolution mp4 without the "wm" flag.
  const videoFormats = formats
    .filter(
      (f) =>
        f.vcodec && f.vcodec !== "none" && f.ext === "mp4" && f.url
    )
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  // "download_addr" streams are watermark-free; "play_addr" may contain one.
  const noWm =
    videoFormats.find((f) => /download|nowm|no_watermark/.test(f.format_id || ""))?.url ||
    videoFormats[0]?.url ||
    info.url ||
    null;

  const wm =
    videoFormats.find((f) => /play|watermark|wm/.test(f.format_id || ""))?.url ||
    videoFormats[1]?.url ||
    noWm;

  // Audio: prefer m4a/mp3 audio-only stream
  const audioFormats = formats
    .filter((f) => f.vcodec === "none" && f.acodec && f.acodec !== "none" && f.url)
    .sort((a, b) => (b.abr || 0) - (a.abr || 0));

  const audio = audioFormats[0]?.url || null;

  return { noWm, wm, audio };
}

// ─── Format duration (seconds → mm:ss) ───────────────────────────────────────
function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── POST /api/tiktok ─────────────────────────────────────────────────────────
app.post("/api/tiktok", requireApiKey, async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ success: false, error: "Missing or invalid 'url' field" });
  }

  const cleanUrl = url.trim();

  if (!isValidTikTokUrl(cleanUrl)) {
    return res.status(400).json({ success: false, error: "Invalid TikTok URL" });
  }

  try {
    const info = await extractTikTokInfo(cleanUrl);
    const { noWm, wm, audio } = resolveMediaUrls(info);

    return res.json({
      success: true,
      platform: "tiktok",
      title: info.title || info.description || "TikTok Video",
      author: info.uploader || info.creator || info.uploader_id || "unknown",
      thumbnail: info.thumbnail || null,
      duration: formatDuration(info.duration),
      download: {
        nowatermark: noWm,
        watermark: wm,
        audio: audio,
      },
    });
  } catch (err) {
    console.error("[yt-dlp error]", err.message || err);

    // Map known yt-dlp stderr patterns to user-friendly messages
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("private") || msg.includes("login")) {
      return res.status(403).json({ success: false, error: "TikTok video is private or requires login" });
    }
    if (msg.includes("removed") || msg.includes("deleted") || msg.includes("unavailable")) {
      return res.status(404).json({ success: false, error: "TikTok video has been removed or is unavailable" });
    }
    if (msg.includes("timeout")) {
      return res.status(504).json({ success: false, error: "Request timed out while extracting video info" });
    }

    return res.status(500).json({ success: false, error: "TikTok video could not be extracted" });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: "Route not found" }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀  TikTok API running on port ${PORT}`));
