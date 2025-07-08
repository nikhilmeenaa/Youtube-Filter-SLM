const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Function to generate an icon
function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Set background
    ctx.fillStyle = '#4285f4'; // Google Blue
    ctx.fillRect(0, 0, size, size);

    // Draw "YT" text
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YT', size / 2, size / 2);

    // Save the icon
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buffer);
    console.log(`Generated icon${size}.png`);
}

// Generate icons in different sizes
[16, 32, 48, 128].forEach(size => generateIcon(size)); 