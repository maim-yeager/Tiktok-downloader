# Use official Node.js lightweight image
FROM node:18-bullseye-slim

# Install required system dependencies: Python, FFmpeg, curl, wget, and SSL certs
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies (ignoring optional/fund warnings to keep it clean)
RUN npm install --no-fund --no-audit

# Copy application code
COPY . .

# Expose API Port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
