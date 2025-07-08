# 🎯 YouTube Smart Filter Extension

An intelligent browser extension that uses AI to automatically filter YouTube videos based on content categories. The extension runs machine learning models directly in your browser for privacy and speed.

## ✨ Features

- **🧠 AI-Powered Classification**: Uses transformers.js to run lightweight ML models in-browser
- **🏷️ Smart Categories**: Automatically categorizes videos into 8 different types:
  - 📚 Educational
  - 🎬 Entertainment
  - 📰 News
  - 💻 Technology
  - 🎮 Gaming
  - 🎵 Music
  - ⚽ Sports
  - 😂 Comedy

- **🎛️ Flexible Filtering**: Choose to show only selected categories or hide specific ones
- **📊 Real-time Statistics**: Track processed and filtered video counts
- **🚀 Fast Performance**: Lightweight keyword-based fallback when ML models aren't available
- **🔒 Privacy-First**: All processing happens locally in your browser
- **💫 Smooth Animations**: Beautiful transitions and visual feedback

## 🚀 Installation

### For Users

1. **Download the Extension**:
   - Download the latest release from GitHub
   - Or clone this repository

2. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the extension folder

3. **Start Filtering**:
   - Visit YouTube.com
   - Click the extension icon to open settings
   - Select your preferred categories
   - Click "Apply Filters"

### For Developers

```bash
# Clone the repository
git clone <repository-url>
cd slm-youtube-filter-extension

# Install dependencies
npm install

# Build the extension
npm run build

# Or run in development mode with auto-rebuild
npm run dev
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 16+ and npm
- Chrome/Chromium browser
- Basic knowledge of browser extensions

### Project Structure

```
slm-youtube-filter-extension/
├── manifest.json          # Extension manifest
├── popup.html             # Extension popup UI
├── popup.css              # Popup styles
├── popup.js               # Popup logic
├── content.js             # Content script (runs on YouTube)
├── content.css            # Content script styles
├── background.js          # Background service worker
├── package.json           # Node.js dependencies
├── webpack.config.js      # Build configuration
└── README.md              # This file
```

### Building

```bash
# Development build with watching
npm run dev

# Production build
npm run build

# The built extension will be in the `dist/` folder
```

### Loading in Browser

1. Build the extension: `npm run build`
2. Open Chrome → Extensions → Developer mode ON
3. Click "Load unpacked" → Select `dist/` folder
4. Visit YouTube and test the extension

## 🎮 Usage

### Basic Usage

1. **Install and Enable**: Load the extension in your browser
2. **Visit YouTube**: Go to youtube.com
3. **Open Settings**: Click the extension icon in the toolbar
4. **Select Categories**: Check/uncheck categories you want to see
5. **Apply Filters**: Click "Apply Filters" to start filtering

### Filter Modes

- **Show Only**: Display only videos from selected categories
- **Hide Selected**: Hide videos from selected categories

### Statistics

The extension tracks:
- **Videos Processed**: Total number of videos analyzed
- **Videos Filtered**: Number of videos currently hidden/shown

## 🧠 AI Technology

### Machine Learning Pipeline

1. **Text Extraction**: Extracts title, description, and channel name
2. **AI Classification**: Uses DistilBERT (or fallback keywords) for categorization
3. **Smart Filtering**: Applies user preferences with smooth animations

### Supported Models

- **Primary**: DistilBERT via transformers.js (66MB, loads automatically)
- **Fallback**: Keyword-based classification (instant, no download)

### Browser Compatibility

- **Chrome/Chromium**: Full support with WebGPU acceleration
- **Firefox**: Supports CPU-based inference
- **Safari**: Limited support (fallback classification only)

## ⚙️ Configuration

### Default Settings

```javascript
{
  categories: {
    educational: true,    // ✅ Enabled by default
    entertainment: true,  // ✅ Enabled by default
    news: false,         // ❌ Disabled by default
    technology: false,   // ❌ Disabled by default
    gaming: false,       // ❌ Disabled by default
    music: false,        // ❌ Disabled by default
    sports: false,       // ❌ Disabled by default
    comedy: false        // ❌ Disabled by default
  },
  mode: 'show'          // Show only selected categories
}
```

### Storage

Settings are stored locally using Chrome's storage API:
- `filterSettings`: User preferences
- `filterStats`: Usage statistics

## 🔧 Advanced Features

### Custom Categories

You can extend the extension with custom categories by modifying the keyword lists in `content.js`:

```javascript
this.categoryKeywords = {
  educational: ['tutorial', 'learn', 'education', ...],
  // Add your custom category here
  custom: ['keyword1', 'keyword2', ...]
};
```

### Performance Tuning

- **Model Loading**: First load takes ~10-30 seconds for AI model download
- **Processing Speed**: ~100-500 videos per second after model loads
- **Memory Usage**: ~100-200MB for the AI model
- **CPU Usage**: Minimal after initial processing

## 🐛 Troubleshooting

### Common Issues

1. **Extension Not Working on YouTube**:
   - Refresh the YouTube page
   - Check if extension is enabled
   - Look for errors in browser console

2. **AI Model Not Loading**:
   - Check internet connection
   - Clear browser cache
   - Extension will fallback to keyword classification

3. **Videos Not Being Filtered**:
   - Make sure you clicked "Apply Filters"
   - Check if categories are selected correctly
   - Try refreshing the page

### Debug Mode

Enable debug logging by opening browser console on YouTube:

```javascript
// In browser console
localStorage.setItem('youtube-filter-debug', 'true');
```

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Guidelines

- Follow existing code style
- Add comments for complex logic
- Test on multiple YouTube pages
- Ensure backward compatibility

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **Transformers.js**: For making ML models accessible in browsers
- **YouTube**: For the platform (educational use only)
- **OpenAI**: For AI development insights
- **Chrome Extensions**: For the extension platform

## 📞 Support

- **Issues**: Report bugs on GitHub Issues
- **Feature Requests**: Open a discussion on GitHub
- **Questions**: Check existing issues or create a new one

---

**Note**: This extension is for educational and personal use only. It is not affiliated with YouTube or Google. 