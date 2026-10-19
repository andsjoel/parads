import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";

export async function volleyListModule(firestore, db, uid) {
  const cache = new Map();
  const mocks = { "firebase/firestore": firestore, "../firebase/firebase": { db, auth: { currentUser: { uid } } } };
  const entry = new SourceTextModule("export * from './src/services/volleyListService.js';", {
    identifier: new URL("../../volley-test-entry.js", import.meta.url).href,
  });
  await entry.link(async (specifier, parent) => {
    if (mocks[specifier]) {
      if (!cache.has(specifier)) {
        const values = mocks[specifier];
        cache.set(specifier, new SyntheticModule(Object.keys(values), function () {
          for (const [key, value] of Object.entries(values)) this.setExport(key, value);
        }));
      }
      return cache.get(specifier);
    }
    if (/\.(webm|mp4|png|gif|jpg|jpeg|webp|svg)$/.test(specifier)) return new SyntheticModule(["default"], function () { this.setExport("default", specifier); });
    const url = new URL(specifier.endsWith(".js") ? specifier : `${specifier}.js`, parent.identifier);
    if (!cache.has(url.href)) cache.set(url.href, new SourceTextModule(await readFile(url, "utf8"), { identifier: url.href }));
    return cache.get(url.href);
  });
  await entry.evaluate();
  return entry.namespace;
}
