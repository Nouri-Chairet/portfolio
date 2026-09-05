/**
 * assets-src/images/*.{png,jpg,jpeg} -> public/*.webp
 *
 * The project's three project-card shots (car, chess, edu) were converted in
 * an earlier pass and their PNG sources are no longer in the working tree.
 * To re-run this step against the originals, restore them first:
 *
 *   mkdir -p assets-src/images
 *   git show 7439964:public/car.png   > assets-src/images/car.png
 *   git show 7439964:public/chess.png > assets-src/images/chess.png
 *   git show 7439964:public/edu.png   > assets-src/images/edu.png
 *   npm run assets:images
 *
 * Usage: node scripts/convert-images.mjs
 */
import sharp from 'sharp';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, parse } from 'node:path';

const SRC = 'assets-src/images';
const OUT = 'public';
const MAX = 1600; // project cards render at ~300px CSS; 1600 covers 2x on wide screens
const QUALITY = 82;

if (!existsSync(SRC)) {
  console.log(`${SRC} not present — nothing to convert (see header to restore sources).`);
  process.exit(0);
}

const files = readdirSync(SRC).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (!files.length) {
  console.log(`no PNG/JPEG files in ${SRC}.`);
  process.exit(0);
}

for (const file of files) {
  const from = join(SRC, file);
  const to = join(OUT, `${parse(file).name}.webp`);
  const meta = await sharp(from).metadata();
  await sharp(from)
    .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(to);
  const before = statSync(from).size;
  const after = statSync(to).size;
  console.log(
    `${file} (${meta.width}x${meta.height}, ${(before / 1024).toFixed(0)} KB)` +
      ` -> ${parse(to).base} (${(after / 1024).toFixed(0)} KB)`
  );
}
