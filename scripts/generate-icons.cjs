/**
 * Generates multi-resolution Windows ICO and public assets from assets/icon.svg
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SIZES = [16, 24, 32, 48, 64, 128, 256];

async function generateIco(svgPath, destPaths) {
  if (!fs.existsSync(svgPath)) {
    throw new Error(`SVG file not found: ${svgPath}`);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  // Render PNG buffers for each size
  const frames = await Promise.all(
    SIZES.map(async (size) => {
      const buf = await sharp(svgBuffer, { density: 300 })
        .resize(size, size)
        .png()
        .toBuffer();
      return { size, buf };
    })
  );

  // Construct ICO binary buffer
  // Header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(frames.length, 4); // Count

  let offset = 6 + frames.length * 16;
  const entries = [];

  for (const frame of frames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(frame.size >= 256 ? 0 : frame.size, 0); // Width (0 means 256)
    entry.writeUInt8(frame.size >= 256 ? 0 : frame.size, 1); // Height (0 means 256)
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(frame.buf.length, 8); // Size of image data
    entry.writeUInt32LE(offset, 12); // Image data offset

    entries.push(entry);
    offset += frame.buf.length;
  }

  const icoBuffer = Buffer.concat([
    header,
    ...entries,
    ...frames.map((f) => f.buf),
  ]);

  for (const destPath of destPaths) {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(destPath, icoBuffer);
    console.log(`[+] Successfully wrote ${destPath} (${icoBuffer.length} bytes, ${frames.length} frames)`);
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const sourceSvg = path.join(root, 'assets', 'icon.svg');
  const targetAssetsIco = path.join(root, 'assets', 'icon.ico');
  const targetPublicIco = path.join(root, 'public', 'assets', 'icon.ico');
  const targetFaviconIco = path.join(root, 'public', 'favicon.ico');
  const targetAssetsPng = path.join(root, 'assets', 'icon.png');
  const targetPublicPng = path.join(root, 'public', 'assets', 'icon.png');
  const targetPublicSvg = path.join(root, 'public', 'assets', 'icon.svg');

  // Ensure public/assets/icon.svg is in sync
  const publicAssetsDir = path.join(root, 'public', 'assets');
  if (!fs.existsSync(publicAssetsDir)) {
    fs.mkdirSync(publicAssetsDir, { recursive: true });
  }
  fs.copyFileSync(sourceSvg, targetPublicSvg);
  console.log(`[+] Synced SVG to ${targetPublicSvg}`);

  // Generate 256x256 high-resolution PNG for Windows toasts, splash screen, and preview
  const png256 = await sharp(sourceSvg, { density: 300 }).resize(256, 256).png().toBuffer();
  fs.writeFileSync(targetAssetsPng, png256);
  fs.writeFileSync(targetPublicPng, png256);
  console.log(`[+] Generated high-res PNG at ${targetAssetsPng}`);

  await generateIco(sourceSvg, [targetAssetsIco, targetPublicIco, targetFaviconIco]);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed to generate icons:', err);
    process.exit(1);
  });
}

module.exports = { generateIco };
