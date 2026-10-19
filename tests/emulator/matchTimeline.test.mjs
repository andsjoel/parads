import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";
import * as firestore from "firebase/firestore";
import * as timelineUtils from "../../src/utils/matchTimeline.js";
import { volleyListModule } from "../support/volley-list-module.mjs";
import { createEmulatorEnvironment } from "../support/emulator-environment.mjs";

let env;
before(async () => {
  env = await createEmulatorEnvironment();
  await env.db.doc("volley_lists/fixture-day").set({ date: "2026-10-18", status: "in_progress", createdBy: "fixture-admin",
    setters: [], players: [], guests: [], teams: [], matchPlayers: [
      { entryId: "m", userId: "fixture-member", displayName: "Ana", kind: "member" },
      { entryId: "g", userId: "fixture-guest", displayName: "Bia", kind: "guest" },
    ], games: [{ id: "game-1", index: 1, winnerTeamId: "team-a", loserTeamId: "team-b",
      winnerPlayers: ["m"], loserPlayers: ["g"], createdAt: "2026-10-18T21:00:00Z" }] });
});
after(async () => { await env?.cleanup(); });

async function timelineService(uid) {
  const db = env.rulesEnv.authenticatedContext(uid).firestore();
  const entry = new SourceTextModule(await readFile(new URL("../../src/services/volleyTimelineService.js", import.meta.url), "utf8"));
  await entry.link((specifier) => {
    const values = specifier === "firebase/firestore" ? firestore : specifier === "../firebase/firebase" ? { db } : timelineUtils;
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  return entry.namespace;
}

test("member cannot close the day or publish its announcement, and the failed transaction changes nothing", async () => {
  const db = env.rulesEnv.authenticatedContext("fixture-member").firestore();
  const api = await volleyListModule(firestore, db, "fixture-member");
  await assert.rejects(api.finishVolleyList({ listId: "fixture-day" }), { code: "permission-denied" });
  assert.equal((await env.db.doc("volley_lists/fixture-day").get()).data().status, "in_progress");
  assert.equal((await env.db.doc("feed_posts/match-map_fixture-day").get()).exists, false);
});

test("ADM closes and announces the map atomically; repeating does not duplicate post or metrics", async () => {
  const db = env.rulesEnv.authenticatedContext("fixture-admin").firestore();
  const api = await volleyListModule(firestore, db, "fixture-admin");
  const before = (await env.db.doc("user_stats/fixture-member").get()).data();
  await Promise.all([api.finishVolleyList({ listId: "fixture-day" }), api.finishVolleyList({ listId: "fixture-day" })]);
  const post = (await env.db.doc("feed_posts/match-map_fixture-day").get()).data();
  assert.equal(post.title, "Mapa de Jogos - 18/10");
  assert.equal(post.payload.date, "2026-10-18");
  assert.equal(post.type, "match_map");
  assert.equal((await env.db.doc("app_metrics/volley").get()).data().totalDays, 1);
  assert.equal((await env.db.doc("volley_reports/fixture-day").get()).data().summary.totalGames, 1);
  assert.equal((await env.db.doc("volley_lists/fixture-day").get()).data().games.length, 1);
  assert.deepEqual((await env.db.doc("user_stats/fixture-member").get()).data(), before);
});

test("member, guest and ADM load available dates and the complete map with the current rules", async () => {
  for (const uid of ["fixture-member", "fixture-guest", "fixture-admin"]) {
    const api = await timelineService(uid);
    const dates = await api.getVolleyTimelineDays();
    assert.deepEqual(dates.days.map((day) => day.date), ["2026-10-18"]);
    const list = await api.getVolleyTimeline("2026-10-18");
    const timeline = timelineUtils.buildMatchTimeline(list);
    assert.equal(timeline.games.length, 1);
    assert.equal(timeline.participants, 2);
  }
});

test("outsider cannot list game dates or read a map even with a valid date", async () => {
  const api = await timelineService("fixture-outsider");
  await assert.rejects(api.getVolleyTimelineDays(), { code: "permission-denied" });
  await assert.rejects(api.getVolleyTimeline("2026-10-18"), { code: "permission-denied" });
});
