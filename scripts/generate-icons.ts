/**
 * Generates the PWA icon set from the same mark used in the product UI.
 * Run with `npm run gen:icons`.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "icons");

function mark(size: number, maskable: boolean): Buffer {
  const padding = maskable ? size * 0.2 : size * 0.12;
  const inner = size - padding * 2;
  const scale = inner / 32;
  const offset = padding;

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.22}" fill="#0b1220"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M12.6 4.5h6.8v5.4l3.9 7.2A6.5 6.5 0 0 1 24.6 22v4.2a4 4 0 0 1-4 4h-9.2a4 4 0 0 1-4-4V22a6.5 6.5 0 0 1 1.3-4.9l3.9-7.2V4.5Z" transform="translate(0.4 0)" fill="#0c2a2f" stroke="#1aa6b7" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="7.4" y="17.4" width="17.2" height="8.6" rx="1.8" fill="#1aa6b7"/>
  </g>
</svg>`,
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const targets: Array<[string, number, boolean]> = [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["icon-maskable-512.png", 512, true],
    ["apple-touch-icon.png", 180, true],
  ];

  for (const [name, size, maskable] of targets) {
    const png = await sharp(mark(size, maskable)).png().toBuffer();
    await writeFile(path.join(OUT, name), png);
    console.log(`[icons] ${name} (${png.length} bytes)`);
  }

  console.log("[icons] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[icons] failed:", err);
  process.exit(1);
});