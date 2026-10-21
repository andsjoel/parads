import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";

const root = new URL("../", import.meta.url);
const economy = new SourceTextModule(await readFile(new URL("src/data/economy.js", root), "utf8"));
await economy.link(() => { throw new Error("Unexpected economy dependency"); });
const catalogModule = new SourceTextModule(await readFile(new URL("src/data/profileBackgroundsCatalog.js", root), "utf8"));
await catalogModule.link((specifier) => {
  assert.equal(specifier, "./economy");
  return economy;
});
await catalogModule.evaluate();
const picsModule = new SourceTextModule(await readFile(new URL("src/data/profilePicsCatalog.js", root), "utf8"));
await picsModule.link((specifier) => {
  assert.equal(specifier, "./economy");
  return economy;
});
await picsModule.evaluate();
const catalog = catalogModule.namespace.profileBackgroundsCatalog;
const entries = await readdir(new URL("src/assets/profile-backgrounds/", root), { recursive: true });
const files = entries.filter((entry) => /\.(png|jpe?g|webp|gif|webm|mp4)$/i.test(entry));
const stems = files.map((entry) => path.parse(entry).name);

test("every profile background has a unique catalog entry and a real asset", () => {
  assert.equal(new Set(catalog.map((item) => item.id)).size, catalog.length);
  assert.equal(new Set(catalog.map((item) => item.imageId)).size, catalog.length);
  for (const item of catalog) assert.ok(stems.includes(item.imageId), item.imageId);
  for (const stem of stems) {
    if (stem === "bg-default") continue;
    assert.ok(catalog.some((item) => item.imageId === stem), stem);
  }
});

test("new backgrounds use filename rarities or explicit catalog overrides and their prices", () => {
  const newThemes = new Set(["ghibli", "miranha", "naruto", "pequeno-principe", "rick-morty", "sailor-moon"]);
  const added = catalog.filter((item) => newThemes.has(item.theme) || ["bg-pokemon-5", "bg-pokemon-6"].includes(item.id));
  assert.equal(added.length, 14);
  const rarityOverrides = { "bg-sailor-1": "legendary" };
  for (const item of added) {
    const rarity = rarityOverrides[item.id] || item.imageId.match(/-(rare|epic|legendary)$/)?.[1] || "uncommon";
    assert.equal(item.rarity, rarity, item.id);
    assert.equal(item.price.amount, economy.namespace.ITEM_RARITIES[rarity].price, item.id);
  }
});

test("existing background IDs, assets and rarities stay unchanged", () => {
  for (const item of catalog.filter((entry) => /^bg-normal-\d$/.test(entry.id))) {
    assert.equal(item.imageId, item.id);
    assert.equal(item.rarity, "normal");
  }
  for (const id of ["bg-haikyu-1", "bg-haikyu-2", "bg-haikyu-3", "bg-pokemon-1", "bg-pokemon-2", "bg-pokemon-3", "bg-pokemon-4", "bg-video-multicato"]) {
    const item = catalog.find((entry) => entry.id === id);
    assert.equal(item.imageId, id);
    assert.equal(item.rarity, id === "bg-video-multicato" ? "exclusive" : "uncommon");
  }
});

test("background loader includes GIF covers", async () => {
  const source = await readFile(new URL("src/utils/profileAssets.js", root), "utf8");
  const assets = new SourceTextModule(source, {
    initializeImportMeta(meta) {
      meta.glob = (pattern) => {
        if (pattern.includes("profile-backgrounds")) assert.ok(pattern.includes(",gif,"));
        return {};
      };
    },
  });
  await assets.link((specifier) => {
    if (specifier === "../data/profileBackgroundsCatalog") return catalogModule;
    assert.equal(specifier, "../data/profilePicsCatalog");
    return new SyntheticModule(["profilePicsCatalog"], function () { this.setExport("profilePicsCatalog", []); });
  });
  await assets.evaluate();
});

test("new pics have matching rarity, price and unique IDs", () => {
  const pics = picsModule.namespace.profilePicsCatalog;
  assert.equal(new Set(pics.map((item) => item.id)).size, pics.length);
  for (const [id, rarity] of [["pic-itachi-1", "legendary"], ["pic-miles", "epic"], ["pic-hinata", "epic"], ["pic-hinata-static", "epic"]]) {
    const item = pics.find((entry) => entry.id === id);
    assert.equal(item.rarity, rarity);
    assert.equal(item.price.amount, economy.namespace.ITEM_RARITIES[rarity].price);
  }
});

test("October additions keep filename rarities, thematic grouping and current prices", () => {
  const expectedPics = [
    ["pic-bokuto-1", "haikyu", "epic"], ["pic-bokuto-2", "haikyu", "epic"], ["pic-bokuto-3", "haikyu", "rare"],
    ["pic-kageyama-1", "haikyu", "rare"], ["pic-kageyama-2", "haikyu", "epic"], ["pic-kageyama-3", "haikyu", "legendary"],
    ["pic-ariel-1", "disney", "epic"], ["pic-ariel-2", "disney", "rare"], ["pic-moana-1", "disney", "epic"],
    ["pic-rapunzel-1", "disney", "rare"], ["pic-rapunzel-2", "disney", "epic"], ["pic-rapunzel-3", "disney", "epic"], ["pic-ursula-1", "disney", "epic"],
    ["pic-pokemon-1", "pokemon", "rare"], ["pic-pokemon-2", "pokemon", "rare"], ["pic-pokemon-3", "pokemon", "legendary"],
  ];
  const expectedBackgrounds = [["bg-haikyu-4", "haikyu", "legendary"], ["bg-disney-1", "disney", "rare"],
    ["bg-disney-2", "disney", "epic"], ["bg-disney-3", "disney", "epic"]];
  for (const [items, expected] of [[picsModule.namespace.profilePicsCatalog, expectedPics], [catalog, expectedBackgrounds]]) {
    for (const [id, theme, rarity] of expected) {
      const item = items.find((entry) => entry.id === id);
      assert.ok(item, id);
      assert.equal(item.theme, theme, id);
      assert.equal(item.rarity, rarity, id);
      assert.equal(item.imageId, `${id}-${rarity}`);
      assert.equal(item.price.amount, economy.namespace.ITEM_RARITIES[rarity].price);
    }
  }
});

test("all pics are catalogued and new animations have static thumbnails, including the corrected Gengar GIF", async () => {
  const entries = await readdir(new URL("src/assets/profile-pics/", root), { recursive: true });
  const originals = entries.filter((entry) => /\.(png|jpe?g|webp|gif)$/i.test(entry) && !/-thumb\./.test(entry));
  const pics = picsModule.namespace.profilePicsCatalog;
  const imageStems = pics.map((item) => path.parse(item.imageId).name);
  assert.equal(new Set(imageStems).size, imageStems.length);
  for (const file of originals) {
    const stem = path.parse(file).name;
    if (stem !== "pic-default") assert.ok(imageStems.includes(stem), file);
    if (/\.gif$/i.test(file)) assert.ok(entries.includes(file.replace(/\.gif$/i, "-thumb.webp")), file);
  }
  const gengar = await readFile(new URL("src/assets/profile-pics/pokemon/pic-pokemon-2-rare.gif", root));
  assert.match(gengar.subarray(0, 6).toString("ascii"), /^GIF8[79]a$/);
});

test("equipped catalog IDs resolve named assets and GIF thumbnails, including both Hinata versions", async () => {
  const picEntries = await readdir(new URL("src/assets/profile-pics/", root), { recursive: true });
  const picFiles = picEntries.filter((entry) => /\.(png|jpe?g|webp|gif)$/i.test(entry));
  const source = await readFile(new URL("src/utils/profileAssets.js", root), "utf8");
  const assets = new SourceTextModule(source, {
    initializeImportMeta(meta) {
      meta.glob = (pattern) => {
        const category = pattern.includes("profile-backgrounds") ? "profile-backgrounds" : "profile-pics";
        const entries = category === "profile-backgrounds" ? files : pattern.includes("profile-pic-borders") ? [] : picFiles;
        return Object.fromEntries(entries.map((entry) => {
          const filename = entry.replaceAll("\\", "/");
          return [`../assets/${category}/${filename}`, filename];
        }));
      };
    },
  });
  await assets.link((specifier) => specifier === "../data/profileBackgroundsCatalog" ? catalogModule : picsModule);
  await assets.evaluate();
  const { getProfileAssetUrls, getAssetById } = assets.namespace;
  for (const item of catalog) {
    const result = getProfileAssetUrls({ selectedBackgroundId: item.id });
    assert.ok(result.backgroundUrl.includes(item.imageId), item.id);
  }
  for (const item of picsModule.namespace.profilePicsCatalog) {
    const result = getProfileAssetUrls({ selectedProfilePicId: item.id });
    assert.ok(result.profilePicUrl.includes(item.imageId), item.id);
  }
  assert.equal(getProfileAssetUrls({ selectedProfilePicId: "pic-hinata" }).profilePicUrl, "haykyu/pic-hinata-epic.gif");
  assert.equal(getProfileAssetUrls({ selectedProfilePicId: "pic-hinata" }, { staticPreview: true }).profilePicUrl, "haykyu/pic-hinata-epic-thumb.webp");
  assert.equal(getProfileAssetUrls({ selectedProfilePicId: "pic-hinata-static" }).profilePicUrl, "haykyu/pic-hinata-2-epic.gif");
  assert.equal(getProfileAssetUrls({ selectedProfilePicId: "pic-hinata-static" }, { staticPreview: true }).profilePicUrl, "haykyu/pic-hinata-2-epic-thumb.webp");
  for (const id of ["pic-itachi-1", "pic-miles"]) {
    assert.ok(getProfileAssetUrls({ selectedProfilePicId: id }, { staticPreview: true }).profilePicUrl.endsWith("-thumb.webp"));
  }
  assert.equal(getAssetById({}, "missing", "pic-default"), "");
});
