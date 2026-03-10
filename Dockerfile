# Use official Node.js lightweight image
FROM node:18-bullseye-slim

# Install required system dependencies: Python, FFmpeg, and curl
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose API Port
EXPOSE 3000

# Start server (Notice the space after CMD)
CMD["npm", "start"]
