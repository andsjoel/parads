import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";
import * as firestore from "firebase/firestore";
import * as rewards from "../../src/utils/dailyConsolation.js";
import * as compensation from "../../src/data/feedCompensation.js";
import { volleyListModule } from "../support/volley-list-module.mjs";
import { createEmulatorEnvironment } from "../support/emulator-environment.mjs";

let env;
before(async () => { env = await createEmulatorEnvironment(); });
after(async () => { await env?.cleanup(); });

async function service(uid) {
  const db = env.rulesEnv.authenticatedContext(uid).firestore();
  const entry = new SourceTextModule(await readFile(new URL("../../src/services/dailyConsolationService.js", import.meta.url), "utf8"));
  await entry.link((specifier) => {
    const values = specifier === "firebase/firestore" ? firestore
      : specifier === "../firebase/firebase" ? { db, auth: { currentUser: { uid } } }
      : specifier === "../data/feedCompensation" ? compensation : rewards;
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  return entry.namespace;
}

test("closing publishes eligible guests atomically once, without crediting coins or touching game history", async () => {
  const list = { date: "2026-10-18", status: "in_progress", createdBy: "fixture-admin", setters: [], players: [], guests: [], teams: [],
    matchPlayers: [{ entryId: "m", userId: "fixture-member", displayName: "Ana" }, { entryId: "g", userId: "fixture-guest", displayName: "Bia", kind: "guest" }],
    games: Array.from({ length: 3 }, (_, i) => ({ id: `game-${i}`, index: i + 1, winnerPlayers: ["m"], loserPlayers: ["g"] })) };
  await env.db.doc("volley_lists/reward-day").set(list);
  const before = (await env.db.doc("users/fixture-guest").get()).data();
  const memberDb = env.rulesEnv.authenticatedContext("fixture-member").firestore();
  await assert.rejects((await volleyListModule(firestore, memberDb, "fixture-member")).finishVolleyList({ listId: "reward-day" }), { code: "permission-denied" });
  assert.equal((await env.db.doc("feed_posts/daily-consolation_reward-day").get()).exists, false);
  const adminDb = env.rulesEnv.authenticatedContext("fixture-admin").firestore();
  const api = await volleyListModule(firestore, adminDb, "fixture-admin");
  await Promise.all([api.finishVolleyList({ listId: "reward-day" }), api.finishVolleyList({ listId: "reward-day" })]);
  const post = (await env.db.doc("feed_posts/daily-consolation_reward-day").get()).data();
  assert.deepEqual(post.payload.recipients, { "fixture-guest": { games: 3, losses: 3, reward: 2 } });
  assert.deepEqual((await env.db.doc("users/fixture-guest").get()).data(), before);
  assert.deepEqual((await env.db.doc("volley_lists/reward-day").get()).data().games, list.games);
  assert.equal((await env.db.doc("app_metrics/volley").get()).data().totalDays, 1);
});

test("ineligible member and outsider cannot claim, and member cannot publish a reward", async () => {
  for (const uid of ["fixture-member", "fixture-outsider"]) {
    await assert.rejects((await service(uid)).claimDailyConsolation("reward-day"));
  }
  const db = env.rulesEnv.authenticatedContext("fixture-member").firestore();
  await assert.rejects(firestore.setDoc(firestore.doc(db, "feed_posts", "fake-bonus"), { type: "daily_consolation" }), { code: "permission-denied" });
});

test("concurrent guest claims pay exactly once, update the public balance and preserve other rewards and purchases", async () => {
  const uid = "fixture-guest";
  const before = (await env.db.doc(`users/${uid}`).get()).data();
  const inventory = (await env.db.doc(`user_inventory/${uid}`).get()).data();
  await env.db.doc(`user_stats/${uid}`).update({ sequenceMilestoneHits: { 2: 3 }, claimedMissionIds: ["wins-2"] });
  const api = await service(uid);
  const results = await Promise.all([api.claimDailyConsolation("reward-day"), api.claimDailyConsolation("reward-day")]);
  assert.equal(results.reduce((sum, value) => sum + value.reward, 0), 2);
  assert.equal((await env.db.doc(`users/${uid}`).get()).data().progression.coins, before.progression.coins + 2);
  assert.equal((await env.db.doc(`public_profiles/${uid}`).get()).data().progression.coins, before.progression.coins + 2);
  const stats = (await env.db.doc(`user_stats/${uid}`).get()).data();
  assert.equal(stats.dailyConsolationClaims["reward-day"].reward, 2);
  assert.deepEqual(stats.sequenceMilestoneHits, { 2: 3 });
  assert.deepEqual(stats.claimedMissionIds, ["wins-2"]);
  assert.deepEqual((await env.db.doc(`user_inventory/${uid}`).get()).data(), inventory);
  assert.equal((await api.claimDailyConsolation("reward-day")).reward, 0);
});

test("registered members and ADMs can redeem their own bonuses, including a missing stats document", async () => {
  for (const uid of ["fixture-member", "fixture-admin"]) {
    await env.db.doc(`feed_posts/daily-consolation_${uid}-day`).set({ type: "daily_consolation", payload: { version: 1, listId: `${uid}-day`, date: "2026-10-18",
      recipients: { [uid]: { games: 5, losses: 5, reward: 3 } } } });
    if (uid === "fixture-member") await env.db.doc(`user_stats/${uid}`).delete();
    const result = await (await service(uid)).claimDailyConsolation(`${uid}-day`);
    assert.equal(result.reward, 3);
    assert.equal((await env.db.doc(`user_stats/${uid}`).get()).data().dailyConsolationClaims[`${uid}-day`].reward, 3);
  }
});

test("one-time compensation gives exactly one coin to member, provisioned guest and ADM, independently from daily rewards", async () => {
  for (const uid of ["fixture-member", "fixture-guest", "fixture-admin"]) {
    const before = (await env.db.doc(`users/${uid}`).get()).data();
    const statsBefore = (await env.db.doc(`user_stats/${uid}`).get()).data();
    const inventory = (await env.db.doc(`user_inventory/${uid}`).get()).data();
    const api = await service(uid);
    const results = await Promise.all([api.claimMaintenanceCompensation(), api.claimMaintenanceCompensation()]);
    assert.equal(results.reduce((total, result) => total + result.reward, 0), 1);
    assert.equal((await env.db.doc(`users/${uid}`).get()).data().progression.coins, before.progression.coins + 1);
    assert.equal((await env.db.doc(`public_profiles/${uid}`).get()).data().progression.coins, before.progression.coins + 1);
    const stats = (await env.db.doc(`user_stats/${uid}`).get()).data();
    assert.deepEqual(stats.dailyConsolationClaims, statsBefore.dailyConsolationClaims);
    assert.equal(stats.feedCompensationClaims[compensation.maintenanceCompensation.id].reward, 1);
    assert.deepEqual((await env.db.doc(`user_inventory/${uid}`).get()).data(), inventory);
    assert.equal((await api.claimMaintenanceCompensation()).reward, 0);
  }
});

test("outsiders and disabled accounts cannot redeem maintenance compensation", async () => {
  for (const uid of ["fixture-outsider", "fixture-disabled"]) {
    await assert.rejects((await service(uid)).claimMaintenanceCompensation(), { code: "permission-denied" });
  }
});
