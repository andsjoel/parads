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

async function generateDirectoryThumbnails(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      await generateDirectoryThumbnails(path.join(directory, entry.name));
    } else if (entry.name.toLowerCase().endsWith(".gif")) {
      if (await generateThumbnail(directory, entry.name)) generatedCount += 1;
    }
  }
}

for (const relativeDirectory of assetDirectories) {
  await generateDirectoryThumbnails(path.join(root, relativeDirectory));
}

console.log(
  generatedCount
    ? `${generatedCount} thumbnail(s) de perfil gerada(s).`
    : "Thumbnails de perfil atualizadas.",
);
