# YouTube Smart Filter Extension 🎬

Hey! 👋 This is a browser extension I made to help filter out unwanted content from YouTube. It uses some ML magic to automatically detect and blur videos that might be clickbait/spam/etc.

## What it does 🤔

- Automatically blurs out videos that look spammy or clickbaity
- Works on both desktop YouTube and mobile (m.youtube.com)
- Shows you why a video was filtered (clickbait, spam, etc)
- Super lightweight - doesn't slow down your browsing
- Works in background - no need to click anything

## Installation 🚀

1. Clone this repo:
```bash
git clone https://github.com/nikhilmeena/youtube-smart-filter.git
cd youtube-smart-filter
```

2. Install dependencies:
```bash
npm install   # or yarn if you prefer
```

3. Build the extension:
```bash
npm run build
```

4. Load it in Chrome:
- Go to chrome://extensions
- Turn on "Developer mode" (top right)
- Click "Load unpacked"
- Select the `dist` folder

And you're good to go! 🎉

## Features ✨

- **Smart Detection**: Uses ML to figure out what videos to filter
- **Custom Rules**: Add your own keywords/channels to filter
- **Auto-start**: Starts filtering as soon as you open YouTube
- **Mobile Support**: Works on m.youtube.com too!
- **Dark Mode**: Cuz who doesn't love dark mode? 🌙

## Known Issues 🐛

- Sometimes takes a sec to start filtering after page load
- Might miss some videos during fast scrolling
- Occassionally shows "model loading" message (just refresh)

## Todo List 📝

- [ ] Add support for custom filter categories
- [ ] Make the popup UI look prettier
- [ ] Add stats dashboard
- [ ] Fix that annoying bug with autoplay
- [ ] Maybe add Firefox support?

## Contributing 🤝

Feel free to submit PRs! Just make sure to:
1. Test your changes
2. Update docs if needed
3. Follow the coding style

## License 📄

MIT - do whatever you want with it! Just don't blame me if something breaks 😅

---
Made with ☕ and 🤔 by Nikhil Meena 