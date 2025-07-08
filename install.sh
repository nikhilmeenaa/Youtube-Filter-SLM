#!/bin/bash

# YouTube Smart Filter Extension - Installation Script
echo "🎯 YouTube Smart Filter Extension Setup"
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
REQUIRED_VERSION="16.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 16+."
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Build the extension
echo "🔨 Building extension..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build extension"
    exit 1
fi

echo "✅ Extension built successfully"

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist folder not found"
    exit 1
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked' and select the 'dist' folder"
echo "4. Visit YouTube.com and click the extension icon"
echo ""
echo "Development commands:"
echo "  npm run dev    - Build with auto-reload"
echo "  npm run build  - Production build"
echo ""
echo "🔧 For icon creation, see: icons/icon-placeholder.txt"
echo ""
echo "Happy filtering! 🚀" 