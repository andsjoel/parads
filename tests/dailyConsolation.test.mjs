import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDailyConsolationPost, buildDailyConsolationRecipients, dailyConsolationPostId, getDailyConsolationReward } from "../src/utils/dailyConsolation.js";

test("daily consolation uses exact percentages, minimum games and the highest non-cumulative tier", () => {
  for (const [games, losses, reward] of [[1,1,0],[2,2,0],[3,2,1],[3,3,2],[4,4,2],[5,5,3],
    [5,4,2],[7,5,1],[7,6,2],[20,13,1],[20,12,0],[10,8,2],[10,7,1],[10,10,3],[100,65,1],[100,64,0]]) {
    assert.equal(getDailyConsolationReward(games, losses), reward, `${losses}/${games}`);
  }
  for (const args of [[0,0],[-1,1],[3,4],[3,-1],[3.5,3],[3,NaN],[Infinity,3],["3",3]]) {
    assert.equal(getDailyConsolationReward(...args), 0);
  }
});

function fixture() {
  return { date: "2026-10-18", createdBy: "admin", matchPlayers: [
    { entryId: "a", userId: "member", displayName: "Ana" },
    { entryId: "b", userId: "guest", kind: "guest", displayName: "Bia" },
    { entryId: "legacy", displayName: "Convidado antigo" },
  ], games: Array.from({ length: 5 }, (_, i) => ({ id: `game-${i}`, winnerPlayers: ["a"], loserPlayers: ["b", "legacy"] })) };
}

test("uses actual game rosters, includes provisioned guests and excludes nonparticipants, legacy guests and mock accounts", () => {
  const list = fixture();
  list.matchPlayers.push({ entryId: "absent", userId: "absent" }, { entryId: "mock", userId: "mock_test" });
  list.games[0].loserPlayers.push("mock");
  const original = structuredClone(list);
  assert.deepEqual(buildDailyConsolationRecipients(list), { guest: { games: 5, losses: 5, reward: 3 } });
  const post = buildDailyConsolationPost(list, "day");
  assert.equal(post.payload.listId, "day");
  assert.equal(post.type, "daily_consolation");
  assert.equal(post.title, "Dia ruim?");
  assert.deepEqual(list, original);
  assert.equal(dailyConsolationPostId("day"), "daily-consolation_day");
  assert.throws(() => dailyConsolationPostId("bad/id"));
});

test("no bonus for an empty day; duplicate games, rosters and account entries cannot inflate awards", () => {
  assert.equal(buildDailyConsolationPost({ games: [] }, "day"), null);
  let list = fixture(); list.games.push(list.games[0]);
  assert.throws(() => buildDailyConsolationRecipients(list));
  list = fixture(); list.games[0].winnerPlayers.push("b");
  assert.throws(() => buildDailyConsolationRecipients(list));
  list = fixture(); list.matchPlayers.push({ entryId: "duplicate", userId: "guest" });
  list.games[0].loserPlayers.push("duplicate");
  assert.throws(() => buildDailyConsolationRecipients(list));
});
