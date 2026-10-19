import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildSequenceBackfill, sealBackfillPlan, applySequenceBackfill, SEQUENCE_BACKFILL_PROJECT,
} from "../server/sequenceRewardBackfill.js";

function fixture(results = [true, true, true, true, false, true, true, true], starting = 0) {
  const players = [
    { entryId: "a-entry", userId: "a", displayName: "Ana", stats: { currentWinStreak: starting } },
    { entryId: "b-entry", userId: "b", displayName: "Bia", kind: "guest", stats: { currentWinStreak: 0 } },
  ];
  const games = results.map((won, i) => ({ id: `game-${i}`, index: i + 1,
    winnerPlayers: [won ? "a-entry" : "b-entry"], loserPlayers: [won ? "b-entry" : "a-entry"] }));
  const list = { date: "2026-10-18", games, matchPlayers: players,
    history: [{ games: [], matchPlayers: structuredClone(players) }] };
  const statsByUserId = new Map();
  for (const [uid, wonResults, start] of [["a", results, starting], ["b", results.map((won) => !won), 0]]) {
    let streak = start;
    const hits = {};
    for (const won of wonResults) {
      streak = won ? streak + 1 : 0;
      if (won && [2, 5, 10].includes(streak)) hits[streak] = (hits[streak] || 0) + 1;
    }
    statsByUserId.set(uid, { updateTime: `stats-${uid}`, stats: {
      sequenceMilestoneHits: hits, claimedSequenceMilestoneHits: { ...hits },
      currentStreak: streak, wins: wonResults.filter(Boolean).length,
    } });
  }
  const options = { list, listId: "day", date: list.date, listUpdateTime: "list-version", statsByUserId };
  return { options, list, statsByUserId, plan: () => buildSequenceBackfill(options) };
}

function database(f) {
  const docs = new Map([["volley_lists/day", { value: structuredClone(f.list), version: "list-version" }],
    ...[...f.statsByUserId].map(([uid, record]) => [`user_stats/${uid}`, { value: structuredClone(record.stats), version: record.updateTime }])]);
  let writes = 0;
  const db = { projectId: SEQUENCE_BACKFILL_PROJECT, doc: (path) => path,
    runTransaction: async (callback) => {
      const pending = [];
      const result = await callback({
        get: async (path) => {
          assert.equal(pending.length, 0, "Read after write");
          const record = docs.get(path);
          return { updateTime: record?.version, data: () => structuredClone(record?.value) };
        },
        update: (path, fields) => {
          assert.ok(path.startsWith("user_stats/"));
          assert.ok(Object.keys(fields).every((key) => key === "sequenceMilestoneHits" || key === "updatedAt" || key.startsWith("sequenceRewardBackfills.")));
          pending.push(() => {
            const record = docs.get(path);
            for (const [key, value] of Object.entries(fields)) {
              if (key.startsWith("sequenceRewardBackfills.")) {
                record.value.sequenceRewardBackfills ||= {};
                record.value.sequenceRewardBackfills[key.slice("sequenceRewardBackfills.".length)] = value;
              } else record.value[key] = value;
            }
            record.version += "-updated";
            writes++;
          });
        },
      });
      pending.forEach((write) => write());
      return result;
    },
  };
  return { db, docs, writes: () => writes };
}

test("preview reconstructs repeated streaks, excludes already redeemed prizes, and never changes input", () => {
  const f = fixture(), before = structuredClone(f.options);
  const plan = f.plan();
  assert.equal(plan.blocked.length, 0);
  const ana = plan.entries.find((item) => item.uid === "a");
  assert.deepEqual(ana.addedHits, { 3: 2, 4: 1 });
  assert.equal(ana.pendingBefore, 0);
  assert.equal(ana.pendingAfter, 3);
  assert.equal(ana.additionalCoins, 3);
  assert.equal(plan.summary.additionalCoins, 3);
  assert.deepEqual(f.options, before);
});

test("a Domenico-shaped history of two redeemed two-win runs receives no duplicate coins", () => {
  const plan = fixture([true, true, false, true, true]).plan();
  const player = plan.entries.find((item) => item.uid === "a");
  assert.deepEqual(player.addedHits, {});
  assert.equal(player.additionalCoins, 0);
});

test("waiting does not reset a streak and previous-day starting streak is taken from snapshots", () => {
  const f = fixture([true, true, false], 2);
  f.list.matchPlayers.push({ entryId: "c-entry", userId: "c", displayName: "Caio" });
  f.statsByUserId.set("c", { updateTime: "stats-c", stats: {} });
  f.list.games.splice(1, 0, { id: "waiting-game", winnerPlayers: ["b-entry"], loserPlayers: ["c-entry"] });
  f.list.games.forEach((game, index) => { game.index = index + 1; });
  const plan = f.plan();
  assert.equal(plan.blocked.length, 0);
  assert.deepEqual(plan.entries.find((item) => item.uid === "a").addedHits, { 3: 1, 4: 1 });
});

test("ambiguous baseline, missing stats and pre-existing new hits block the migration", () => {
  const missingHistory = fixture();
  missingHistory.list.history = [];
  assert.ok(missingHistory.plan().blocked.some((item) => item.uid === "a"));
  const missingStats = fixture();
  missingStats.statsByUserId.delete("a");
  assert.ok(missingStats.plan().blocked.some((item) => item.uid === "a"));
  const priorNewHits = fixture();
  priorNewHits.statsByUserId.get("a").stats.sequenceMilestoneHits[3] = 1;
  assert.ok(priorNewHits.plan().blocked.some((item) => item.uid === "a"));
});

test("invalid order, missing roster mapping and duplicate identities fail before any write", () => {
  for (const mutate of [
    (f) => { f.list.games[0].index = 2; },
    (f) => { f.list.games[0].winnerPlayers = ["missing"]; },
    (f) => { f.list.matchPlayers[1].userId = "a"; },
  ]) {
    const f = fixture(); mutate(f);
    assert.throws(() => f.plan());
  }
});

test("approved apply changes only milestone counters and audit markers, and is idempotent", async () => {
  const f = fixture(), { db, docs, writes } = database(f);
  const manifest = sealBackfillPlan(f.plan());
  const before = structuredClone(docs);
  const result = await applySequenceBackfill(db, manifest, manifest.digest, () => "server-time");
  assert.equal(result.applied, 2);
  assert.equal(writes(), 2);
  assert.deepEqual(docs.get("volley_lists/day"), before.get("volley_lists/day"));
  const stats = docs.get("user_stats/a").value;
  assert.deepEqual(stats.sequenceMilestoneHits, { 2: 2, 3: 2, 4: 1 });
  assert.deepEqual(stats.claimedSequenceMilestoneHits, before.get("user_stats/a").value.claimedSequenceMilestoneHits);
  assert.equal(stats.currentStreak, before.get("user_stats/a").value.currentStreak);
  assert.equal(stats.wins, before.get("user_stats/a").value.wins);
  assert.deepEqual(await applySequenceBackfill(db, manifest, manifest.digest, () => "server-time"), { applied: 0, skipped: 2 });
  assert.equal(writes(), 2);
});

test("changed games, stats, plans, project or approval hash abort the entire application", async () => {
  for (const scenario of ["list", "stats", "digest", "project", "approval", "forged-plan"]) {
    const f = fixture(), { db, docs, writes } = database(f);
    let manifest = sealBackfillPlan(f.plan()), approval = manifest.digest;
    if (scenario === "list") docs.get("volley_lists/day").version = "changed";
    if (scenario === "stats") docs.get("user_stats/a").version = "changed";
    if (scenario === "digest") manifest.entries[0].afterHits[3] = 900;
    if (scenario === "project") db.projectId = "another-project";
    if (scenario === "approval") approval = "wrong";
    if (scenario === "forged-plan") {
      manifest.entries[0].afterHits[3] = 900;
      const { digest: _digest, ...plan } = manifest;
      manifest = sealBackfillPlan(plan); approval = manifest.digest;
    }
    await assert.rejects(applySequenceBackfill(db, manifest, approval, () => "server-time"));
    assert.equal(writes(), 0);
  }
});

test("an unresolved player prevents applying even the unambiguous players", async () => {
  const f = fixture(); f.list.history = [];
  const manifest = sealBackfillPlan(f.plan());
  const { db, writes } = database(f);
  await assert.rejects(applySequenceBackfill(db, manifest, manifest.digest, () => "server-time"));
  assert.equal(writes(), 0);
});
