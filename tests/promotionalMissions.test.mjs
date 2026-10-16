import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";

async function harness() {
  const documents = new Map([
    ["users/member", { fullName: "Gabriel", profile: { displayName: "Gabriel", statusMessage: "" }, progression: { coins: 10, xp: 4 } }],
    ["user_inventory/member", { profilePics: [], backgrounds: [], profilePicBorders: [], displayCards: [] }],
    ["user_stats/member", { wins: 8, claimedMissionIds: ["wins-2"], sequenceMilestoneHits: { 2: 3 } }],
    ["public_profiles/member", { fullName: "Gabriel", progression: { coins: 10 } }],
  ]);
  let commits = 0;
  let queue = Promise.resolve();
  const firestore = {
    doc: (_db, collection, id) => `${collection}/${id}`,
    serverTimestamp: () => "server-time",
    runTransaction: (_db, callback) => {
      const run = queue.then(async () => {
        const writes = [];
        const result = await callback({
          get: async (ref) => {
            assert.equal(writes.length, 0, "Read after write");
            return { exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) };
          },
          update: (ref, changes) => writes.push(() => {
            const current = structuredClone(documents.get(ref));
            assert.ok(current, `Missing document ${ref}`);
            for (const [key, value] of Object.entries(changes)) {
              if (key === "progression.coins") current.progression.coins = value;
              else current[key] = value;
            }
            documents.set(ref, current);
          }),
          set: (ref, changes, options) => writes.push(() => documents.set(ref, options?.merge ? { ...documents.get(ref), ...changes } : changes)),
        });
        writes.forEach((write) => write());
        if (writes.length) commits += 1;
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
  const modules = new Map();
  const root = new URL("../", import.meta.url);
  const mocks = { "firebase/firestore": firestore, "../firebase/firebase": { db: {} } };
  const link = async (specifier, parent) => {
    if (/\.(webm|mp4|png|gif)$/.test(specifier)) {
      return new SyntheticModule(["default"], function () { this.setExport("default", specifier); });
    }
    if (mocks[specifier]) {
      if (!modules.has(specifier)) {
        const values = mocks[specifier];
        modules.set(specifier, new SyntheticModule(Object.keys(values), function () {
          for (const [key, value] of Object.entries(values)) this.setExport(key, value);
        }));
      }
      return modules.get(specifier);
    }
    const url = new URL(specifier.endsWith(".js") ? specifier : `${specifier}.js`, parent.identifier);
    if (!modules.has(url.href)) {
      modules.set(url.href, new SourceTextModule(await readFile(url, "utf8"), { identifier: url.href }));
    }
    return modules.get(url.href);
  };
  const module = new SourceTextModule(`
    export * from './src/data/promotionalMissions.js';
    export * from './src/services/promotionalMissionService.js';
    export * from './src/services/profileStoreService.js';
    export * from './src/services/profileService.js';
  `, { identifier: new URL("test-entry.js", root).href });
  await module.link(link);
  await module.evaluate();
  return { api: module.namespace, documents, commits: () => commits };
}

test("legacy profiles qualify retroactively, without writing or requiring new fields", async () => {
  const { api, documents, commits } = await harness();
  const user = documents.get("users/member");
  user.profile = { displayName: "Gabs", statusMessage: "Bora jogar" };
  const states = api.getPromotionalMissionStates(user, { profilePics: ["pic-normal-1"], backgrounds: ["bg-normal-1"] });
  assert.equal(states.length, 4);
  assert.ok(states.every((mission) => mission.claimable && mission.reward === 1));
  assert.equal(commits(), 0);
});

test("defaults, empty input, higher rarities and unknown assets do not qualify", async () => {
  const { api, documents } = await harness();
  const user = documents.get("users/member");
  user.profile.statusMessage = "   ";
  const states = api.getPromotionalMissionStates(user, { profilePics: ["pic-default", "pic-anime-1", "unknown"], backgrounds: ["bg-default", "bg-pokemon-1", "bg-pokemon-5"] });
  assert.ok(states.every((mission) => !mission.claimable));
  assert.equal(api.qualifiesForPromotionalPurchase({ rarity: "uncommon" }), false);
  assert.equal(api.qualifiesForPromotionalPurchase({ rarity: "normal" }), true);
});

test("claim adds exactly one coin, only marks the selected mission and preserves sports stats", async () => {
  const { api, documents } = await harness();
  documents.get("user_inventory/member").profilePics.push("pic-normal-2");
  documents.get("user_inventory/member").backgrounds.push("bg-normal-1");
  const result = await api.claimPromotionalMission("member", "customization-v1-pic");
  assert.equal(result.coins, 11);
  assert.equal(result.reward, 1);
  assert.deepEqual(result.stats.claimedPromotionalMissionIds, ["customization-v1-pic"]);
  assert.deepEqual(result.stats.claimedMissionIds, ["wins-2"]);
  assert.deepEqual(result.stats.sequenceMilestoneHits, { 2: 3 });
  assert.equal(documents.get("users/member").progression.xp, 4);
  assert.equal(documents.get("public_profiles/member").progression.coins, 11);
  const states = api.getPromotionalMissionStates(documents.get("users/member"), documents.get("user_inventory/member"), result.stats);
  assert.equal(states.find((mission) => mission.kind === "background").claimable, true);
  assert.equal(states.find((mission) => mission.kind === "profilePic").claimable, false);
});

test("repeated and concurrent claims only credit a mission once", async () => {
  const { api, documents } = await harness();
  documents.get("user_inventory/member").profilePics.push("pic-normal-1");
  const results = await Promise.all([api.claimPromotionalMission("member", "customization-v1-pic"), api.claimPromotionalMission("member", "customization-v1-pic")]);
  assert.equal(results.reduce((total, result) => total + result.reward, 0), 1);
  assert.equal(documents.get("users/member").progression.coins, 11);
});

test("ineligible, invalid and missing-account claims never change balances", async () => {
  const { api, documents, commits } = await harness();
  await assert.rejects(api.claimPromotionalMission("member", "customization-v1-pic"));
  await assert.rejects(api.claimPromotionalMission("member", "invalid"));
  await assert.rejects(api.claimPromotionalMission("missing", "customization-v1-pic"));
  assert.equal(documents.get("users/member").progression.coins, 10);
  assert.equal(commits(), 0);
});

test("normal purchases persist eligibility and never refund automatically", async () => {
  const { api, documents } = await harness();
  const result = await api.purchaseProfileItem({ uid: "member", type: "profilePic", itemId: "pic-normal-3" });
  assert.equal(result.coins, 9);
  assert.equal(result.promotionalProgress.profilePicPurchased, true);
  const claimed = await api.claimPromotionalMission("member", "customization-v1-pic");
  assert.equal(claimed.coins, 10);
  await api.purchaseProfileItem({ uid: "member", type: "background", itemId: "bg-normal-1" });
  assert.equal(documents.get("users/member").promotionalProgress.profilePicPurchased, true);
  assert.equal(documents.get("users/member").promotionalProgress.backgroundPurchased, true);
});

test("saving an untouched profile does not qualify; later reverting personalization preserves eligibility", async () => {
  const { api, documents } = await harness();
  await api.updateUserProfile("member", { displayName: "Gabriel", statusMessage: "" });
  assert.ok(api.getPromotionalMissionStates(documents.get("users/member")).every((mission) => !mission.claimable));
  await api.updateUserProfile("member", { displayName: "Gabs", statusMessage: "Vamos!" });
  await api.updateUserProfile("member", { displayName: "Gabriel", statusMessage: "" });
  const states = api.getPromotionalMissionStates(documents.get("users/member"));
  assert.equal(states.find((mission) => mission.kind === "displayName").claimable, true);
  assert.equal(states.find((mission) => mission.kind === "status").claimable, true);
  assert.equal(documents.get("public_profiles/member").profile.displayName, "Gabriel");
});
