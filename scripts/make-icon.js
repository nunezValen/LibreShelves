const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

const root = path.join(__dirname, '..');
const src = path.join(root, 'logo.png');
const outDir = path.join(root, 'build', 'icons');
const out = path.join(outDir, 'app.ico');

(async () => {
  try {
    if (!fs.existsSync(src)) {
      console.error('logo.png not found at project root. Place your PNG at ./logo.png');
      process.exit(1);
    }
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const buffer = await pngToIco(src);
    fs.writeFileSync(out, buffer);
    console.log('Created ICO:', out);
  } catch (err) {
    console.error('Failed to create ICO:', err);
    process.exit(1);
  }
})();