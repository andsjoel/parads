import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";
import * as firestore from "firebase/firestore";
import { INITIAL_COIN_BALANCE } from "../../src/data/economy.js";

export async function userServiceFor(db, requestAccess = () => { throw new Error("Unexpected API call in data service test"); }) {
  const source = await readFile(new URL("../../src/services/userService.js", import.meta.url), "utf8");
  const entry = new SourceTextModule(source);
  await entry.link((specifier) => {
    const exports = {
      "firebase/firestore": firestore,
      "../utils/publicProfileCache": { invalidatePublicProfileCache() {} },
      "../firebase/firebase": { db },
      "../data/economy": { INITIAL_COIN_BALANCE },
      "./accessGatewayService": { requestAccess },
    }[specifier];
    if (!exports) throw new Error(`Unexpected import: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  return entry.namespace;
}
