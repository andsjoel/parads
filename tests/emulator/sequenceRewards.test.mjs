import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";
import * as firestore from "firebase/firestore";
import * as missions from "../../src/data/profileMissions.js";
import { createEmulatorEnvironment } from "../support/emulator-environment.mjs";

let env;
before(async () => { env = await createEmulatorEnvironment(); });
after(async () => { await env?.cleanup(); });

async function service(uid) {
  const db = env.rulesEnv.authenticatedContext(uid).firestore();
  const source = await readFile(new URL("../../src/services/profileMissionService.js", import.meta.url), "utf8");
  const entry = new SourceTextModule(source);
  await entry.link((specifier) => {
    const values = specifier === "firebase/firestore" ? firestore
      : specifier === "../firebase/firebase" ? { db } : missions;
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  return entry.namespace;
}

test("real transactions redeem backfilled prizes once under concurrent member requests", async () => {
  const uid = "fixture-member";
  await env.db.doc(`users/${uid}`).update({ "progression.coins": 10 });
  await env.db.doc(`user_stats/${uid}`).update({ currentStreak: 0, sequenceMilestoneHits: { 2: 2, 3: 2, 4: 1 },
    claimedSequenceMilestoneHits: { 2: 2 }, claimedSequenceRewardAmounts: {} });
  const inventoryBefore = (await env.db.doc(`user_inventory/${uid}`).get()).data();
  const api = await service(uid);
  const results = await Promise.all([api.claimProfileMissionRewards(uid, "currentStreak"), api.claimProfileMissionRewards(uid, "currentStreak")]);
  assert.equal(results.reduce((total, item) => total + item.reward, 0), 3);
  assert.equal((await env.db.doc(`users/${uid}`).get()).data().progression.coins, 13);
  assert.equal((await env.db.doc(`public_profiles/${uid}`).get()).data().progression.coins, 13);
  const stats = (await env.db.doc(`user_stats/${uid}`).get()).data();
  assert.equal(stats.currentStreak, 0);
  assert.equal(stats.claimedSequenceMilestoneHits[3], 2);
  assert.equal(stats.claimedSequenceRewardAmounts[3], 2);
  assert.deepEqual((await env.db.doc(`user_inventory/${uid}`).get()).data(), inventoryBefore);
  assert.equal((await api.claimProfileMissionRewards(uid, "currentStreak")).reward, 0);
});

test("registered guest redeems a sequence reward without changing identity or inventory", async () => {
  const uid = "fixture-guest";
  await env.db.doc(`user_stats/${uid}`).update({ sequenceMilestoneHits: { 2: 1, 3: 1 }, claimedSequenceMilestoneHits: { 2: 1 } });
  const before = (await env.db.doc(`users/${uid}`).get()).data();
  const result = await (await service(uid)).claimProfileMissionRewards(uid, "currentStreak");
  assert.equal(result.reward, 1);
  const after = (await env.db.doc(`users/${uid}`).get()).data();
  assert.equal(after.progression.coins, before.progression.coins + 1);
  for (const key of ["role", "phone", "username", "inviteId"]) assert.equal(after[key], before[key]);
});

test("outsider cannot invoke the client sequence claim against a group member", async () => {
  const before = (await env.db.doc("users/fixture-member").get()).data();
  await assert.rejects((await service("fixture-outsider")).claimProfileMissionRewards("fixture-member", "currentStreak"), { code: "permission-denied" });
  assert.deepEqual((await env.db.doc("users/fixture-member").get()).data(), before);
});
