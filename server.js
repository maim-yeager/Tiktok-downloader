const express = require('express');
const cors = require('cors');
const { exec } = require('youtube-dl-exec');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'maim1234';

// Middleware
app.use(cors());
app.use(express.json());

// API Key Authentication Middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }
  
  next();
};

// Validate TikTok URL
const isValidTikTokUrl = (url) => {
  const tiktokRegex = /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/;
  return tiktokRegex.test(url);
};

// Extract media info using yt-dlp
const extractTikTokMedia = async (url) => {
  try {
    // Using youtube-dl-exec for better compatibility
    const output = await exec(url, {
      dumpJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
      extractAudio: false,
      format: 'best[height<=1080]',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Parse the output
    const info = JSON.parse(output);
    
    // Extract direct video URLs
    const formats = info.formats || [];
    
    // Find best quality video without watermark
    const noWatermarkFormat = formats.find(f => 
      f.format_note?.includes('watermark') === false && 
      f.vcodec !== 'none' && 
      f.acodec !== 'none'
    ) || formats.find(f => f.vcodec !== 'none' && f.acodec !== 'none');

    // Find video with watermark (if available)
    const watermarkFormat = formats.find(f => 
      f.format_note?.includes('watermark') === true
    );

    // Extract audio URL
    const audioFormat = formats.find(f => 
      f.vcodec === 'none' && f.acodec !== 'none'
    );

    return {
      success: true,
      platform: 'tiktok',
      title: info.title || 'TikTok Video',
      author: info.uploader || info.channel || 'Unknown',
      thumbnail: info.thumbnail || '',
      duration: info.duration_string || info.duration?.toString() || '0',
      download: {
        nowatermark: noWatermarkFormat?.url || info.url || '',
        watermark: watermarkFormat?.url || '',
        audio: audioFormat?.url || ''
      }
    };
  } catch (error) {
    console.error('yt-dlp extraction error:', error);
    throw new Error('Failed to extract TikTok video');
  }
};

// Alternative method using child process (fallback)
const extractWithChildProcess = (url) => {
  return new Promise((resolve, reject) => {
    const ytDlp = spawn('yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--no-call-home',
      '--format', 'best[height<=1080]',
      url
    ]);

    let outputData = '';
    let errorData = '';

    ytDlp.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    ytDlp.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    ytDlp.on('close', (code) => {
      if (code === 0 && outputData) {
        try {
          const info = JSON.parse(outputData);
          resolve(info);
        } catch (parseError) {
          reject(new Error('Failed to parse yt-dlp output'));
        }
      } else {
        reject(new Error(errorData || 'yt-dlp process failed'));
      }
    });

    // Timeout protection
    setTimeout(() => {
      ytDlp.kill();
      reject(new Error('Request timeout'));
    }, 30000); // 30 second timeout
  });
};

// Main endpoint
app.post('/api/tiktok', authenticateApiKey, async (req, res) => {
  try {
    const { url } = req.body;

    // Validate URL presence
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate TikTok URL format
    if (!isValidTikTokUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid TikTok URL format'
      });
    }

    // Extract media information
    const result = await extractTikTokMedia(url);

    // Check if we got valid download URLs
    if (!result.download.nowatermark && !result.download.audio) {
      return res.status(404).json({
        success: false,
        error: 'No downloadable media found for this video'
      });
    }

    // Return success response
    res.json(result);

  } catch (error) {
    console.error('API error:', error);

    // Handle specific error cases
    let errorMessage = 'TikTok video could not be extracted';
    let statusCode = 500;

    if (error.message.includes('private')) {
      errorMessage = 'This video is private';
      statusCode = 403;
    } else if (error.message.includes('removed') || error.message.includes('deleted')) {
      errorMessage = 'This video has been removed';
      statusCode = 404;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout';
      statusCode = 408;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TikTok Downloader API running on http://localhost:${PORT}`);
  console.log(`📝 API Key: ${API_KEY}`);
});
