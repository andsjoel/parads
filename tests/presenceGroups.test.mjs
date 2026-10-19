import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
import { getPresenceGroups, getPresenceLimit } from "../src/utils/presenceGroups.js";

const person = (id, role = "member") => ({ id, role, name: id, username: id });
const user = (id, role = "member") => ({ fullName: id, username: id, role, sex: "male", profile: { displayName: id } });

async function harness(list = {}) {
  const documents = new Map([
    ["volley_lists/day", { status: "open", settersLimit: 4, playersLimit: 26, setters: [], players: [], guests: [], ...list }],
    ["users/admin", user("admin", "admin")], ["users/member", user("member")],
    ["users/guest", user("guest", "guest")],
  ]);
  const auth = { currentUser: { uid: "admin" } };
  const firestore = {
    doc: (_db, collection, id) => `${collection}/${id}`,
    serverTimestamp: () => "server-time",
    runTransaction: async (_db, callback) => {
      const writes = [];
      const result = await callback({
        get: async (ref) => {
          assert.equal(writes.length, 0, "Read after write");
          return { ref, id: ref.split("/").at(-1), exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) };
        },
        update: (ref, changes) => writes.push(() => documents.set(ref, { ...documents.get(ref), ...changes })),
        set: (ref, changes, options) => writes.push(() => documents.set(ref, options?.merge ? { ...documents.get(ref), ...changes } : changes)),
      });
      writes.forEach((write) => write());
      return result;
    },
    getDoc: async (ref) => ({ exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) }),
    writeBatch: () => ({ set() {}, commit: async () => {} }),
    collection() {}, deleteField() {}, getDocs() {}, increment() {}, limit() {}, onSnapshot() {}, query() {}, where() {},
  };
  const cache = new Map();
  const root = new URL("../", import.meta.url);
  const load = async (specifier, parent) => {
    const mock = specifier === "firebase/firestore" ? firestore : specifier === "../firebase/firebase" ? { db: {}, auth } : null;
    if (mock) {
      if (!cache.has(specifier)) cache.set(specifier, new SyntheticModule(Object.keys(mock), function () { for (const [key, value] of Object.entries(mock)) this.setExport(key, value); }));
      return cache.get(specifier);
    }
    if (/\.(webm|mp4|png|gif)$/.test(specifier)) return new SyntheticModule(["default"], function () { this.setExport("default", specifier); });
    const url = new URL(specifier.endsWith(".js") ? specifier : `${specifier}.js`, parent.identifier);
    if (!cache.has(url.href)) cache.set(url.href, new SourceTextModule(await readFile(url, "utf8"), { identifier: url.href }));
    return cache.get(url.href);
  };
  const entry = new SourceTextModule("export * from './src/services/volleyListService.js';", { identifier: new URL("test-entry.js", root).href });
  await entry.link(load);
  await entry.evaluate();
  return { api: entry.namespace, documents, auth, list: () => documents.get("volley_lists/day") };
}

function matchPlayer(entryId, sex = "male", isSetter = false, kind = "member") {
  return { entryId, displayName: entryId, sex, isSetter, kind };
}

function regularTeam(prefix) {
  return [matchPlayer(`${prefix}-s`, "male", true), matchPlayer(`${prefix}-w`, "female"),
    ...Array.from({ length: 4 }, (_, i) => matchPlayer(`${prefix}-${i}`))];
}

function randomTeamsFixture(waiting, loser = regularTeam("loser")) {
  const winner = regularTeam("winner");
  return {
    status: "in_progress", teamsFormedAt: "formed", womenRuleMode: "random", exitAfterTwoWins: false,
    matchPlayers: [...winner, ...loser, ...waiting],
    teams: [winner, loser, waiting].map((players, i) => ({
      id: `team-${i}`, players: players.map((p) => p.entryId), wins: 0, womenRuleMode: "random",
    })),
  };
}

const womenInTeam = (list, team) => list.matchPlayers.filter((p) =>
  team.players.includes(p.entryId) && p.sex === "female" && !p.isSetter
  && p.entryId !== team.temporarySetterEntryId);

test("closing a day publishes exactly one map announcement in the same transaction as the report", async () => {
  const games = [{ id: "game-1", index: 1 }];
  const f = await harness({ status: "in_progress", date: "2026-10-18", games, createdBy: "admin" });
  await f.api.finishVolleyList({ listId: "day" });
  assert.equal(f.list().status, "closed");
  assert.equal(f.documents.get("volley_reports/day").summary.totalGames, 1);
  const post = f.documents.get("feed_posts/match-map_day");
  assert.equal(post.title, "Mapa de Jogos - 18/10");
  assert.equal(post.type, "match_map");
  assert.equal(post.payload.date, "2026-10-18");
  assert.equal(post.payload.listId, "day");
  assert.equal(f.documents.get("app_metrics/volley").totalDays, 1);
  await f.api.finishVolleyList({ listId: "day" });
  assert.equal([...f.documents.keys()].filter((key) => key.startsWith("feed_posts/")).length, 1);
  assert.equal(f.documents.get("app_metrics/volley").totalDays, 1);
  assert.deepEqual(f.list().games, games);
});

test("closing a list without matches does not announce an empty map", async () => {
  const f = await harness({ date: "2026-10-18", games: [] });
  await f.api.finishVolleyList({ listId: "day" });
  assert.equal(f.documents.has("feed_posts/match-map_day"), false);
  assert.equal(f.list().status, "closed");
});

test("new wins record intermediate milestones and undo/redo preserve sequence reward payments", async () => {
  const winner = matchPlayer("winner", "male", true);
  winner.userId = "member";
  winner.stats = { currentWinStreak: 2, bestWinStreak: 2, sequenceMilestoneHits: { 2: 1 } };
  const loser = matchPlayer("loser");
  const { api, documents } = await harness({ status: "in_progress", matchPlayers: [winner, loser],
    teams: [{ id: "a", players: ["winner"] }, { id: "b", players: ["loser"] }], games: [], history: [] });
  documents.set("user_stats/member", { matchesPlayed: 2, wins: 2, currentStreak: 2,
    sequenceMilestoneHits: { 2: 1 }, claimedSequenceMilestoneHits: { 2: 1 }, claimedSequenceRewardAmounts: { 2: 1 } });
  await api.recordTeamWin({ listId: "day", winningTeamIndex: 0 });
  assert.equal(documents.get("user_stats/member").sequenceMilestoneHits[3], 1);
  await api.undoVolleyListAction({ listId: "day" });
  assert.equal(documents.get("user_stats/member").sequenceMilestoneHits[3], 0);
  await api.redoVolleyListAction({ listId: "day" });
  assert.equal(documents.get("user_stats/member").sequenceMilestoneHits[3], 1);
  assert.deepEqual(documents.get("user_stats/member").claimedSequenceRewardAmounts, { 2: 1 });
});

test("undo/redo of old snapshots reverses a backfilled intermediate milestone", async () => {
  const before = { ...matchPlayer("winner"), userId: "member",
    stats: { currentWinStreak: 2, bestWinStreak: 2, sequenceMilestoneHits: { 2: 1 } } };
  const after = { ...before, stats: { ...before.stats, currentWinStreak: 3, bestWinStreak: 3 } };
  const loser = matchPlayer("loser");
  const game = { id: "old-game", index: 1, winnerPlayers: ["winner"], loserPlayers: ["loser"] };
  const teams = [{ id: "a", players: ["winner"] }, { id: "b", players: ["loser"] }];
  const { api, documents } = await harness({ status: "in_progress", teams, matchPlayers: [after, loser], games: [game],
    history: [{ teamsFormed: true, teams, matchPlayers: [before, loser], games: [], attendedUserIds: [] }] });
  documents.set("user_stats/member", { matchesPlayed: 3, wins: 3, currentStreak: 3,
    sequenceMilestoneHits: { 2: 1, 3: 1 }, claimedSequenceMilestoneHits: { 2: 1 } });
  await api.undoVolleyListAction({ listId: "day" });
  assert.equal(documents.get("user_stats/member").sequenceMilestoneHits[3], 0);
  await api.redoVolleyListAction({ listId: "day" });
  assert.equal(documents.get("user_stats/member").sequenceMilestoneHits[3], 1);
});

test("random rule rejects a third woman, including a provisioned guest, on arrival", async () => {
  const waiting = [matchPlayer("s", "male", true), matchPlayer("w1", "female"),
    matchPlayer("w2", "female"), matchPlayer("m1"), matchPlayer("m2")];
  const { api, list } = await harness(randomTeamsFixture(waiting));
  const added = await api.addVolleyMatchPlayer({ listId: "day", userData: {
    id: "guest-woman", ...user("guest-woman", "guest"), sex: "female",
  } });
  assert.equal(added.sex, "female");
  assert.equal(added.kind, "guest");
  assert.equal(list().teams[2].players.length, 5);
  assert.equal(list().teams[3].players.includes(added.entryId), true);
  assert.ok(list().teams.every((team) => womenInTeam(list(), team).length <= 2));
});

test("random rule allows a second woman and still reserves a setter and the first woman", async () => {
  const waiting = [matchPlayer("s", "male", true), matchPlayer("w1", "female"),
    matchPlayer("m1"), matchPlayer("m2"), matchPlayer("m3")];
  const { api, list } = await harness(randomTeamsFixture(waiting));
  const added = await api.addVolleyMatchPlayer({ listId: "day", userData: {
    id: "guest-woman", ...user("guest-woman", "guest"), sex: "female",
  } });
  assert.ok(list().teams[2].players.includes(added.entryId));
  assert.equal(womenInTeam(list(), list().teams[2]).length, 2);

  const reserved = await harness(randomTeamsFixture(Array.from({ length: 4 }, (_, i) => matchPlayer(`m${i}`))));
  const man = await reserved.api.addVolleyMatchPlayer({ listId: "day", userData: { id: "extra", ...user("extra") } });
  assert.equal(reserved.list().teams[2].players.includes(man.entryId), false);
});

test("loser redistribution never adds a third woman to an automatic random team", async () => {
  const waiting = [matchPlayer("s", "male", true), matchPlayer("w1", "female"),
    matchPlayer("w2", "female"), matchPlayer("m1"), matchPlayer("m2")];
  const loser = Array.from({ length: 6 }, (_, i) => matchPlayer(`lost-${i}`, "female", false, i === 0 ? "guest" : "member"));
  const { api, list } = await harness(randomTeamsFixture(waiting, loser));
  await api.recordTeamWin({ listId: "day", winningTeamIndex: 0 });
  assert.ok(list().teams.every((team) => womenInTeam(list(), team).length <= 2));
  const ids = list().teams.flatMap((team) => team.players);
  assert.equal(ids.length, 17);
  assert.equal(new Set(ids).size, 17);
  assert.ok(loser.every((p) => ids.includes(p.entryId)));
});

test("initial random draw enforces at most two women; impossible first twelve stay intact", async () => {
  for (const women of [2, 3, 4, 5]) {
    const players = [matchPlayer("s1", "male", true), matchPlayer("s2", "male", true),
      ...Array.from({ length: women }, (_, i) => matchPlayer(`w${i}`, "female", false, i === 0 ? "guest" : "member")),
      ...Array.from({ length: 10 - women }, (_, i) => matchPlayer(`m${i}`))];
    const { api, list } = await harness({ status: "in_progress", womenRuleMode: "random", matchPlayers: players, teams: [] });
    if (women === 5) {
      await assert.rejects(api.formInitialVolleyTeams({ listId: "day" }), /Nao foi possivel/);
      assert.equal(list().teams.length, 0);
      assert.equal(list().matchPlayers.length, 12);
    } else {
      await api.formInitialVolleyTeams({ listId: "day" });
      for (const team of list().teams) {
        assert.equal(team.players.length, 6);
        assert.ok(womenInTeam(list(), team).length >= 1);
        assert.ok(womenInTeam(list(), team).length <= 2);
      }
    }
  }
});

test("female temporary setter keeps her role without consuming the random female quota", async () => {
  const waiting = [matchPlayer("temp", "female"), matchPlayer("w1", "female"),
    matchPlayer("w2", "female"), matchPlayer("m1"), matchPlayer("m2")];
  const fixture = randomTeamsFixture(waiting);
  fixture.teams[2].temporarySetterEntryId = "temp";
  const { api, list } = await harness(fixture);
  const added = await api.addVolleyMatchPlayer({ listId: "day", userData: { id: "man", ...user("man") } });
  assert.ok(list().teams[2].players.includes(added.entryId));
  assert.equal(list().teams[2].temporarySetterEntryId, "temp");
});

test("manual admin swaps can still place a third woman in a team", async () => {
  const waiting = [matchPlayer("s", "male", true), matchPlayer("w1", "female"),
    matchPlayer("w2", "female"), matchPlayer("m1"), matchPlayer("m2")];
  const { api, list } = await harness(randomTeamsFixture(waiting));
  await api.swapMatchPlayers({ listId: "day", firstEntryId: "winner-w", secondEntryId: "m1" });
  assert.equal(womenInTeam(list(), list().teams[2]).length, 3);
});

test("legacy guests are separated without mutating the list or losing setter flags", () => {
  const legacy = { setters: [person("s"), person("gs", "guest")], players: [person("p"), person("gp", "guest")] };
  const copy = structuredClone(legacy);
  const groups = getPresenceGroups(legacy);
  assert.deepEqual(groups.setters.map((p) => p.id), ["s"]);
  assert.deepEqual(groups.players.map((p) => p.id), ["p"]);
  assert.deepEqual(groups.guests.map((p) => p.id), ["gs", "gp"]);
  assert.equal(groups.guests[0].isSetter, true);
  assert.deepEqual(legacy, copy);
  assert.equal(getPresenceLimit(legacy, "guest"), null);
  assert.equal(getPresenceLimit({ guestsLimit: 6 }, "guest"), null);
  assert.deepEqual(getPresenceGroups(null), { setters: [], players: [], guests: [] });
});

test("admin can add the fifth setter without raising the member limit", async () => {
  const { api, documents, list } = await harness({ setters: Array.from({ length: 4 }, (_, i) => person(`s${i}`)) });
  const teams = [{ id: "t", players: ["x"] }];
  list().teams = teams;
  await api.adminAddVolleyListParticipant({ listId: "day", group: "setter", userData: { id: "member" } });
  assert.equal(list().setters.length, 5);
  assert.equal(list().settersLimit, 4);
  assert.deepEqual(list().teams, teams);
  assert.equal(documents.has("user_stats/member"), false);
});

test("members cannot use admin add or enter a full setter group", async () => {
  const { api, auth, list } = await harness({ setters: Array.from({ length: 4 }, (_, i) => person(`s${i}`)) });
  auth.currentUser.uid = "member";
  await assert.rejects(api.adminAddVolleyListParticipant({ listId: "day", group: "setter", userData: { id: "member" } }));
  await assert.rejects(api.joinVolleyList({ listId: "day", group: "setter", userData: { id: "member" } }));
  assert.equal(list().setters.length, 4);
});

test("public member join and leave preserve the guest list and reject forged users", async () => {
  const { api, auth, list } = await harness({ guests: [person("guest", "guest")] });
  auth.currentUser.uid = "member";
  await assert.rejects(api.joinVolleyList({ listId: "day", group: "player", userData: { id: "admin" } }));
  await api.joinVolleyList({ listId: "day", group: "player", userData: { id: "member" } });
  assert.equal(list().players.length, 1);
  assert.equal(list().guests.length, 1);
  await api.leaveVolleyList({ listId: "day", userId: "member" });
  assert.equal(list().players.length, 0);
  assert.equal(list().guests.length, 1);
});

test("registered guests cannot self-join or leave, even if they forge the supplied role", async () => {
  const { api, auth, list } = await harness({ guests: [person("guest", "guest")] });
  auth.currentUser.uid = "guest";
  await assert.rejects(api.joinVolleyList({ listId: "day", group: "player", userData: { id: "guest", role: "member" } }));
  await assert.rejects(api.joinVolleyList({ listId: "day", group: "guest", userData: { id: "guest" } }));
  await assert.rejects(api.leaveVolleyList({ listId: "day", userId: "guest" }));
  assert.equal(list().guests.length, 1);
});

test("admin routes guests to their own group, allows overbooking and rejects duplicates", async () => {
  const { api, list } = await harness({ guests: Array.from({ length: 6 }, (_, i) => person(`g${i}`, "guest")) });
  await api.adminAddVolleyListParticipant({ listId: "day", group: "setter", userData: { id: "guest", role: "member" } });
  assert.equal(list().guests.length, 7);
  assert.equal(list().setters.length, 0);
  assert.equal(list().guests[6].isSetter, true);
  assert.equal(getPresenceLimit(list(), "guest"), null);
  await assert.rejects(api.adminAddVolleyListParticipant({ listId: "day", group: "player", userData: { id: "guest" } }));
});

test("admin add, remove and swap update all frozen groups without changing the match", async () => {
  const { api, list } = await harness({ status: "in_progress", confirmedSetters: [person("s")], confirmedPlayers: [person("p")], confirmedGuests: [person("old", "guest")], teams: [{ id: "court", players: ["entry"] }], games: [{ winner: "court" }] });
  await api.adminAddVolleyListParticipant({ listId: "day", group: "player", userData: { id: "guest" } });
  assert.equal(list().confirmedGuests.length, 2);
  assert.deepEqual(list().confirmedGuests, list().guests);
  await api.swapVolleyListParticipants({ listId: "day", firstUserId: "old", secondUserId: "guest" });
  assert.deepEqual(list().guests.map((p) => p.id), ["guest", "old"]);
  await api.adminRemoveVolleyListParticipant({ listId: "day", userId: "guest" });
  assert.deepEqual(list().confirmedGuests.map((p) => p.id), ["old"]);
  assert.deepEqual(list().teams, [{ id: "court", players: ["entry"] }]);
  assert.deepEqual(list().games, [{ winner: "court" }]);
});

test("starting a match freezes legacy guests separately and leaves attendance empty", async () => {
  const { api, list } = await harness({ setters: [person("setter"), person("legacy", "guest")], players: [person("member")] });
  await api.startVolleyMatch({ listId: "day" });
  assert.equal(list().confirmedGuests[0].id, "legacy");
  assert.equal(list().confirmedGuests[0].isSetter, true);
  assert.equal(list().confirmedSetters.length, 1);
  assert.deepEqual(list().matchPlayers, []);
});

test("member capacity still applies to players and extra slots never become public vacancies", async () => {
  const { api, auth, documents, list } = await harness({ players: Array.from({ length: 26 }, (_, i) => person(`p${i}`)) });
  await api.adminAddVolleyListParticipant({ listId: "day", group: "player", userData: { id: "member" } });
  assert.equal(list().players.length, 27);
  assert.equal(list().playersLimit, 26);
  documents.set("users/new", user("new"));
  auth.currentUser.uid = "new";
  await assert.rejects(api.joinVolleyList({ listId: "day", group: "player", userData: { id: "new" } }));
  assert.equal(list().players.length, 27);
});

test("guest requests are pending, idempotent and accepted only by an admin", async () => {
  const { api, auth, list } = await harness();
  auth.currentUser.uid = "guest";
  await api.requestVolleyListGuest({ listId: "day" });
  await api.requestVolleyListGuest({ listId: "day" });
  assert.equal(list().guestRequests.length, 1);
  assert.equal(list().guestRequests[0].id, "guest");
  assert.equal(list().guests.length, 0);
  await assert.rejects(api.acceptVolleyListGuest({ listId: "day", userId: "guest" }));
  auth.currentUser.uid = "admin";
  await api.acceptVolleyListGuest({ listId: "day", userId: "guest" });
  assert.equal(list().guests[0].id, "guest");
  assert.deepEqual(list().guestRequests, []);
  await assert.rejects(api.acceptVolleyListGuest({ listId: "day", userId: "guest" }));
  auth.currentUser.uid = "guest";
  await assert.rejects(api.requestVolleyListGuest({ listId: "day" }));
});

test("requests reject members, missing lists and closed lists", async () => {
  const { api, auth, list } = await harness();
  auth.currentUser.uid = "member";
  await assert.rejects(api.requestVolleyListGuest({ listId: "day" }));
  auth.currentUser.uid = "guest";
  await assert.rejects(api.requestVolleyListGuest({ listId: "missing" }));
  list().status = "in_progress";
  await assert.rejects(api.requestVolleyListGuest({ listId: "day" }));
  assert.equal(list().guestRequests, undefined);
});

test("pending requests survive match start and acceptance updates frozen guests", async () => {
  const { api, auth, list } = await harness();
  auth.currentUser.uid = "guest";
  await api.requestVolleyListGuest({ listId: "day" });
  auth.currentUser.uid = "admin";
  await api.startVolleyMatch({ listId: "day" });
  await api.acceptVolleyListGuest({ listId: "day", userId: "guest" });
  assert.equal(list().confirmedGuests[0].id, "guest");
  assert.deepEqual(list().guestRequests, []);
  assert.deepEqual(list().matchPlayers, []);
});

test("manual guest add clears a pending request without requiring it on older lists", async () => {
  const { api, list } = await harness({ guestRequests: [person("guest", "guest")] });
  await api.adminAddVolleyListParticipant({ listId: "day", group: "setter", userData: { id: "guest" } });
  assert.deepEqual(list().guestRequests, []);
  assert.equal(list().guests[0].isSetter, true);
});
