import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";

// Inject the SDK/database, never import the production Firebase initializer.
export async function publicProfileModule(firestore, db = {}, before = false) {
  const cache = new SourceTextModule(await readFile(new URL("../../src/utils/publicProfileCache.js", import.meta.url), "utf8"));
  await cache.link(() => { throw new Error("Unexpected cache dependency"); });
  await cache.evaluate();
  const url = new URL(before ? "../fixtures/publicProfileService-before.mjs" : "../../src/services/publicProfileService.js", import.meta.url);
  const entry = new SourceTextModule(await readFile(url, "utf8"));
  await entry.link((specifier) => {
    if (specifier === "../utils/publicProfileCache") return cache;
    const values = { "firebase/firestore": firestore, "../firebase/firebase": { db } }[specifier];
    if (!values) throw new Error(`Unexpected profile dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  return { api: entry.namespace, cache: cache.namespace };
}
