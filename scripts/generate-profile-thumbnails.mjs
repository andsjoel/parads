import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetDirectories = [
  "src/assets/profile-pics",
  "src/assets/profile-pic-borders",
];

async function generateThumbnail(directory, filename) {
  const source = path.join(directory, filename);
  const basename = path.basename(filename, path.extname(filename));
  const target = path.join(directory, `${basename}-thumb.webp`);
  const sourceStats = await stat(source);

  try {
    const targetStats = await stat(target);
    if (targetStats.mtimeMs >= sourceStats.mtimeMs) return false;
  } catch {
    // The thumbnail does not exist yet.
  }

  await sharp(source, { animated: false, page: 0 })
    .resize({ width: 192, height: 192, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(target);

  return true;
}

let generatedCount = 0;

for (const relativeDirectory of assetDirectories) {
  const directory = path.join(root, relativeDirectory);
  const files = await readdir(directory);
  const gifs = files.filter((filename) => filename.toLowerCase().endsWith(".gif"));

  for (const filename of gifs) {
    if (await generateThumbnail(directory, filename)) generatedCount += 1;
  }
}

console.log(
  generatedCount
    ? `${generatedCount} thumbnail(s) de perfil gerada(s).`
    : "Thumbnails de perfil atualizadas.",
);
