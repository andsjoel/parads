import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
import * as missions from "../src/data/profileMissions.js";

async function fixture(stats = {}) {
  const docs = new Map([
    ["users/member", { progression: { coins: 10 }, profile: { displayName: "Member" } }],
    ["user_stats/member", stats], ["public_profiles/member", { progression: { coins: 10 } }],
  ]);
  let queue = Promise.resolve(), commits = 0;
  const sdk = {
    doc: (_db, name, id) => `${name}/${id}`, serverTimestamp: () => "now",
    runTransaction: (_db, callback) => {
      const task = queue.then(async () => {
        const writes = [];
        const result = await callback({
          get: async (path) => { assert.equal(writes.length, 0); return { exists: () => docs.has(path), data: () => structuredClone(docs.get(path)) }; },
          update: (path, values) => writes.push(() => {
            const doc = docs.get(path);
            for (const [key, value] of Object.entries(values)) {
              if (key === "progression.coins") doc.progression.coins = value;
              else doc[key] = value;
            }
          }),
          set: (path, values) => writes.push(() => docs.set(path, { ...docs.get(path), ...values })),
        });
        writes.forEach((write) => write());
        if (writes.length) commits++;
        return result;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
  const source = await readFile(new URL("../src/services/profileMissionService.js", import.meta.url), "utf8");
  const entry = new SourceTextModule(source);
  await entry.link((specifier) => {
    const values = specifier === "firebase/firestore" ? sdk : specifier === "../firebase/firebase" ? { db: {} } : missions;
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  return { docs, claim: entry.namespace.claimProfileMissionRewards, commits: () => commits };
}

test("new sequence table rewards each win from two to ten, totaling 22 coins", () => {
  assert.deepEqual(missions.sequenceMilestones, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(missions.sequenceMilestones.map(missions.getSequenceReward), [1, 1, 1, 2, 2, 3, 3, 4, 5]);
  assert.equal(missions.profileMissions.currentStreak.reduce((total, item) => total + item.reward, 0), 22);
});

test("old payments remain valid, upgraded ten-win prize only offers the unpaid difference", async () => {
  const f = await fixture({ sequenceMilestoneHits: { 2: 1, 5: 1, 10: 1 },
    claimedSequenceMilestoneHits: { 2: 1, 5: 1, 10: 1 }, wins: 10 });
  assert.equal(missions.getPendingSequenceRewards(f.docs.get("user_stats/member"))[0].totalReward, 2);
  const result = await f.claim("member", "currentStreak");
  assert.equal(result.reward, 2);
  assert.equal(result.coins, 12);
  assert.equal(result.stats.claimedSequenceRewardAmounts[10], 5);
  assert.equal((await f.claim("member", "currentStreak")).reward, 0);
  assert.equal(f.commits(), 1);
});

test("retroactive intermediate milestones remain claimable after loss and pay exactly once", async () => {
  const f = await fixture({ currentStreak: 0, sequenceMilestoneHits: { 2: 2, 3: 2, 4: 1 },
    claimedSequenceMilestoneHits: { 2: 2 }, claimedMissionIds: ["wins-2"], wins: 4 });
  const [first, second] = await Promise.all([f.claim("member", "currentStreak"), f.claim("member", "currentStreak")]);
  assert.equal(first.reward + second.reward, 3);
  assert.equal(f.docs.get("users/member").progression.coins, 13);
  assert.equal(f.docs.get("public_profiles/member").progression.coins, 13);
  assert.deepEqual(f.docs.get("user_stats/member").claimedMissionIds, ["wins-2"]);
  assert.equal(f.docs.get("user_stats/member").wins, 4);
  f.docs.get("user_stats/member").sequenceMilestoneHits[3]++;
  assert.equal((await f.claim("member", "currentStreak")).reward, 1);
  assert.equal((await f.claim("member", "currentStreak")).reward, 0);
});

test("claiming another category never consumes the sequence rewards", async () => {
  const f = await fixture({ wins: 2, sequenceMilestoneHits: { 3: 1 } });
  await f.claim("member", "wins");
  assert.equal(f.docs.get("user_stats/member").claimedSequenceRewardAmounts, undefined);
  assert.equal(missions.getPendingSequenceRewards(f.docs.get("user_stats/member"))[0].totalReward, 1);
});

test("already earned legacy fifteen/twenty milestones remain visible and redeemable", async () => {
  const f = await fixture({ sequenceMilestoneHits: { 15: 1, 20: 1 }, claimedSequenceMilestoneHits: { 15: 1 } });
  assert.ok(missions.getSequenceMissions(f.docs.get("user_stats/member")).some((item) => item.threshold === 20));
  assert.equal((await f.claim("member", "currentStreak")).reward, 5);
  assert.equal((await f.claim("member", "currentStreak")).reward, 0);
});
