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
          return { ref, exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) };
        },
        update: (ref, changes) => writes.push(() => documents.set(ref, { ...documents.get(ref), ...changes })),
        set: (ref, changes) => writes.push(() => documents.set(ref, changes)),
      });
      writes.forEach((write) => write());
      return result;
    },
    collection() {}, deleteField() {}, getDoc() {}, getDocs() {}, increment() {}, limit() {}, onSnapshot() {}, query() {}, where() {}, writeBatch() {},
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

test("legacy guests are separated without mutating the list or losing setter flags", () => {
  const legacy = { setters: [person("s"), person("gs", "guest")], players: [person("p"), person("gp", "guest")] };
  const copy = structuredClone(legacy);
  const groups = getPresenceGroups(legacy);
  assert.deepEqual(groups.setters.map((p) => p.id), ["s"]);
  assert.deepEqual(groups.players.map((p) => p.id), ["p"]);
  assert.deepEqual(groups.guests.map((p) => p.id), ["gs", "gp"]);
  assert.equal(groups.guests[0].isSetter, true);
  assert.deepEqual(legacy, copy);
  assert.equal(getPresenceLimit(legacy, "guest"), 6);
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
  assert.equal(getPresenceLimit(list(), "guest"), 6);
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
