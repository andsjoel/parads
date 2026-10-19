import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
import { buildMatchTimeline, isTimelineDate, matchTimelinePath, mergeTimelineDays } from "../src/utils/matchTimeline.js";

function fixture() {
  return { matchPlayers: [
    { entryId: "a", userId: "member", displayName: "Ana", sex: "female", isSetter: true },
    { entryId: "b", userId: "guest", displayName: "Bia", sex: "female", kind: "guest" },
    { entryId: "c", userId: "another", displayName: "Caio" },
  ], games: [
    { id: "g1", index: 1, winnerTeamId: "a-team", loserTeamId: "b-team", winnerPlayers: ["a"], loserPlayers: ["b"], createdAt: "2026-10-18T18:00:00Z" },
    { id: "g2", index: 2, winnerTeamId: "c-team", loserTeamId: "a-team", winnerPlayers: ["c"], loserPlayers: ["a"], createdAt: "2026-10-18T18:20:00Z" },
  ] };
}

test("timeline retains every result and roster in chronological order without changing input", () => {
  const list = fixture(), copy = structuredClone(list), result = buildMatchTimeline(list);
  assert.deepEqual(list, copy);
  assert.deepEqual(result.games.map((game) => game.index), [1, 2]);
  assert.equal(result.teams[0].wins, 1);
  assert.equal(result.teams[0].losses, 1);
  assert.deepEqual(result.teams[0].appearances, [0, 1]);
  assert.equal(result.teams[2].name, "Time 3");
  assert.equal(result.games[0].loser.players[0].isGuest, true);
  assert.equal(result.games[0].winner.players[0].isSetter, true);
  assert.equal(result.participants, 3);
});

test("timeline retains the lineup of each game even when the same team changes players", () => {
  const list = fixture(); list.games[1].loserPlayers = ["b"];
  const result = buildMatchTimeline(list);
  assert.equal(result.games[0].winner.players[0].name, "Ana");
  assert.equal(result.games[1].loser.players[0].name, "Bia");
});

test("empty histories render safely; removed player names have an explicit fallback", () => {
  assert.deepEqual(buildMatchTimeline(null), { games: [], teams: [], participants: 0 });
  const list = fixture(); list.matchPlayers = [];
  assert.equal(buildMatchTimeline(list).games[0].winner.players[0].name, "Atleta indisponível");
});

test("inconsistent order, duplicate games and invalid teams are not silently displayed", () => {
  for (const mutate of [
    (list) => { list.games[1].index = 3; },
    (list) => { list.games[1].id = "g1"; },
    (list) => { list.games[0].winnerTeamId = "b-team"; },
    (list) => { list.games[0].loserPlayers = []; },
  ]) {
    const list = fixture(); mutate(list); assert.throws(() => buildMatchTimeline(list));
  }
});

test("history query is limited to a specific valid date and never scans player profiles", async () => {
  let calls = 0, documents = [];
  const sdk = { collection: (_db, name) => name, where: (...args) => args, limit: (value) => ({ limit: value }), orderBy() {}, startAfter() {},
    query: (...args) => args, getDocs: async (query) => {
      calls++;
      assert.deepEqual(query, ["volley_lists", ["date", "==", "2026-10-18"], { limit: 2 }]);
      return { docs: documents };
    } };
  const entry = new SourceTextModule(await readFile(new URL("../src/services/volleyTimelineService.js", import.meta.url), "utf8"));
  await entry.link((specifier) => {
    const values = specifier === "firebase/firestore" ? sdk : specifier === "../firebase/firebase" ? { db: {} } : { isTimelineDate, mergeTimelineDays };
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  const { getVolleyTimeline } = entry.namespace;
  for (const date of ["2026-02-30", "18/10/2026", "", null]) await assert.rejects(getVolleyTimeline(date));
  assert.equal(calls, 0);
  assert.equal(await getVolleyTimeline("2026-10-18"), null);
  documents = [{ id: "day", data: () => fixture() }];
  assert.equal((await getVolleyTimeline("2026-10-18")).id, "day");
  documents.push(documents[0]);
  await assert.rejects(getVolleyTimeline("2026-10-18"), /mais de uma lista/);
});

test("map routes remain authenticated, allow group members and contain no management operations", async () => {
  const page = await readFile(new URL("../src/pages/AdminMatchTimeline.jsx", import.meta.url), "utf8");
  const routes = await readFile(new URL("../src/routes/AppRoutes.jsx", import.meta.url), "utf8");
  assert.match(page, /if \(!userData\?\.id\) return undefined;/);
  assert.doesNotMatch(page, /if \(!isAdmin\) return/);
  assert.match(page, /if \(current\) setState/);
  assert.match(routes, /path="admin\/matches-map"/);
  assert.match(routes, /path="matches-map"/);
  assert.doesNotMatch(page, /timeline-team-filters|highlightTeam|type="date"/);
  assert.doesNotMatch(page, /getPublicProfile|setDoc|updateDoc|runTransaction/);
});

test("date choices only include days with games, deduplicate dates and use newest first", () => {
  assert.deepEqual(mergeTimelineDays([
    { date: "2026-10-11", totalGames: 3 }, { date: "2026-10-18", totalGames: 15 },
    { date: "2026-10-19", totalGames: 0 }, { date: "invalid", totalGames: 4 },
  ], [{ date: "2026-10-18", totalGames: 15 }]).map((day) => day.date), ["2026-10-18", "2026-10-11"]);
  assert.equal(matchTimelinePath("2026-10-18"), "/matches-map?date=2026-10-18");
  assert.equal(matchTimelinePath("bad"), "/matches-map");
});

test("date catalog uses twenty reports per page and only one bounded active-list lookup", async () => {
  let reportReads = 0, activeReads = 0;
  const reports = Array.from({ length: 20 }, (_, index) => ({ id: `report-${index}`, data: () => ({
    date: index === 0 ? "2026-10-18" : `2026-09-${String(30 - index).padStart(2, "0")}`,
    listId: `day-${index}`, summary: { totalGames: index === 1 ? 0 : 15 },
  }) }));
  const sdk = {
    collection: (_db, name) => name, where: (...values) => ({ where: values }), limit: (value) => ({ limit: value }),
    orderBy: (...values) => ({ orderBy: values }), startAfter: (cursor) => ({ cursor }), query: (...values) => values,
    getDocs: async (query) => {
      if (query[0] === "volley_reports") {
        reportReads++;
        assert.deepEqual(query[1], { orderBy: ["closedAt", "desc"] });
        assert.deepEqual(query.at(-1), { limit: 20 });
        if (reportReads === 1) return { docs: reports };
        assert.equal(query[2].cursor, reports.at(-1));
        return { docs: [{ id: "older", data: () => ({ date: "2026-09-01", summary: { totalGames: 2 } }) }] };
      }
      assert.deepEqual(query, ["volley_lists", { where: ["status", "in", ["open", "in_progress"]] }, { limit: 1 }]);
      activeReads++;
      return { docs: [{ id: "active", data: () => ({ date: "2026-10-19", games: [{ id: "g1" }] }) }] };
    },
  };
  const entry = new SourceTextModule(await readFile(new URL("../src/services/volleyTimelineService.js", import.meta.url), "utf8"));
  await entry.link((specifier) => {
    const values = specifier === "firebase/firestore" ? sdk : specifier === "../firebase/firebase" ? { db: {} } : { isTimelineDate, mergeTimelineDays };
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  const first = await entry.namespace.getVolleyTimelineDays();
  assert.equal(first.days[0].date, "2026-10-19");
  assert.equal(first.activeList.date, "2026-10-19");
  assert.equal(first.activeList.games.length, 1);
  assert.equal(first.days.some((day) => day.date === "2026-09-29"), false);
  assert.equal(first.hasMore, true);
  const second = await entry.namespace.getVolleyTimelineDays({ cursor: first.cursor });
  assert.equal(second.days[0].date, "2026-09-01");
  assert.equal(second.hasMore, false);
  assert.equal(activeReads, 1);
  assert.equal(reportReads, 2);
});
