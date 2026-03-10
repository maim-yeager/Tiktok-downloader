require('dotenv').config();
const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');

const app = express();

// Middleware
app.use(express.json());
// CORS enabled so requests work flawlessly from localhost / frontend
app.use(cors());

// API Key Authentication Middleware
const authenticateUser = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Route: TikTok Extractor
app.post('/api/tiktok', authenticateUser, async (req, res) => {
    const { url } = req.body;

    if (!url || !url.includes('tiktok.com')) {
        return res.status(400).json({
            success: false,
            error: "Invalid TikTok URL provided"
        });
    }

    try {
        // Run yt-dlp to extract metadata ONLY (--dump-json)
        const output = await youtubedl(url, {
            dumpJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true
        });

        // Parse extracted yt-dlp metadata
        const title = output.title || "TikTok Video";
        const author = output.uploader || "Unknown";
        const thumbnail = output.thumbnail || "";
        const duration = output.duration || 0;

        // Process formats to find the right URLs
        let noWatermarkUrl = output.url || "";
        let watermarkUrl = "";
        let audioUrl = "";

        if (output.formats && output.formats.length > 0) {
            // Find Audio Only Format
            const audioFormat = output.formats.reverse().find(
                (f) => f.vcodec === 'none' && f.acodec !== 'none'
            );
            if (audioFormat) audioUrl = audioFormat.url;

            // Find Watermarked/Alternate formats if they exist
            const wmFormat = output.formats.find(
                (f) => f.format_note && f.format_note.toLowerCase().includes('watermark')
            );
            if (wmFormat) watermarkUrl = wmFormat.url;
        }

        // Fallback for missing elements
        if (!watermarkUrl) watermarkUrl = noWatermarkUrl; // Fallback if no specific watermark format is provided
        if (!audioUrl && output.requested_downloads) {
            audioUrl = output.requested_downloads[0]?.url || ""; 
        }

        // Final Response Formatting
        res.status(200).json({
            success: true,
            platform: "tiktok",
            title: title,
            author: author,
            thumbnail: thumbnail,
            duration: `${duration} seconds`,
            download: {
                nowatermark: noWatermarkUrl,
                watermark: watermarkUrl,
                audio: audioUrl
            }
        });

    } catch (error) {
        console.error("TikTok Extraction Error:", error.message);
        res.status(500).json({
            success: false,
            error: "TikTok video could not be extracted. It might be private, deleted, or unavailable."
        });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 TikTok API Server running on http://localhost:${PORT}`);
});
