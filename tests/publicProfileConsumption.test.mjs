import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
import * as React from "react";
import { create, act } from "react-test-renderer";
import { publicProfileModule } from "./support/public-profile-module.mjs";

function sdkFixture(count = 40) {
  const documents = new Map();
  const ids = Array.from({ length: count }, (_, index) => `player-${String(index).padStart(2, "0")}`);
  for (const id of ids) {
    documents.set(`public_profiles/${id}`, { fullName: id, role: id === ids[0] ? "admin" : "member" });
    documents.set(`user_inventory/${id}`, { displayCards: [] });
    documents.set(`user_stats/${id}`, { wins: 1 });
  }
  const counts = { gets: 0, queries: 0, documents: 0, writes: 0 };
  let fail = false;
  let gate = null;
  const snapshot = (path) => ({ id: path.split("/")[1], exists: () => documents.has(path), data: () => structuredClone(documents.get(path)) });
  const sdk = {
    doc: (_db, name, id) => `${name}/${id}`,
    collection: (_db, name) => name,
    query: (name, ...clauses) => ({ name, clauses }),
    where: (field, op, value) => ({ field, op, value }),
    limit: (count) => ({ count }), documentId: () => "__name__",
    serverTimestamp: () => "synthetic-time",
    getDoc: async (path) => {
      counts.gets += 1;
      counts.documents += 1;
      if (gate) await gate;
      if (fail) throw new Error("Synthetic unavailable");
      return snapshot(path);
    },
    getDocs: async (ref) => {
      counts.queries += 1;
      let docs = [...documents.keys()].filter((path) => path.startsWith(`${ref.name || ref}/`)).map(snapshot);
      for (const clause of ref.clauses || []) {
        if (clause.count) docs = docs.slice(0, clause.count);
        else docs = docs.filter((doc) => {
          const value = clause.field === "__name__" ? doc.id : doc.data()[clause.field];
          return clause.op === "in" ? clause.value.includes(value) : value === clause.value;
        });
      }
      counts.documents += Math.max(1, docs.length);
      return { docs };
    },
    setDoc: async () => { counts.writes += 1; },
    writeBatch: () => ({ set: () => { counts.writes += 1; }, commit: async () => {} }),
  };
  return { sdk, ids, documents, counts, fail: (value) => { fail = value; }, gate: (value) => { gate = value; } };
}

async function hooksFor(api) {
  const entry = new SourceTextModule(await readFile(new URL("../src/hooks/usePublicProfiles.js", import.meta.url), "utf8"));
  await entry.link((specifier) => {
    const values = specifier === "react" ? React : api;
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  return entry.namespace;
}

test("equivalent roster: seven deliveries cost 630 reads before, 30 after; new arrival only one", async (t) => {
  const old = sdkFixture();
  const before = await publicProfileModule(old.sdk, {}, true);
  for (let delivery = 0; delivery < 7; delivery += 1) await before.api.getPublicProfileBundles(old.ids.slice(0, 30));
  assert.equal(old.counts.gets, 630);

  const next = sdkFixture();
  const { api } = await publicProfileModule(next.sdk);
  const hooks = await hooksFor(api);
  let rendered;
  function Probe({ ids, revision }) {
    rendered = hooks.usePublicProfilePreviews(ids);
    return React.createElement("span", null, revision);
  }
  let view;
  await act(async () => { view = create(React.createElement(Probe, { ids: next.ids.slice(0, 30), revision: 0 })); });
  for (let delivery = 1; delivery < 7; delivery += 1) {
    await act(async () => { view.update(React.createElement(Probe, { ids: next.ids.slice(0, 30).reverse(), revision: delivery })); });
  }
  assert.equal(next.counts.gets, 30);
  assert.equal(Object.keys(rendered).length, 30);
  await act(async () => { view.update(React.createElement(Probe, { ids: next.ids.slice(0, 31), revision: 7 })); });
  assert.equal(next.counts.gets, 31);
  await act(async () => view.unmount());
  t.diagnostic("30 players / 7 identical-roster deliveries: 630 -> 30 document gets (-95.2%); realtime deliveries retained: 7");
});

test("own live stats and embedded profiles require no remote reads", async () => {
  const fixture = sdkFixture();
  const { api } = await publicProfileModule(fixture.sdk);
  const hooks = await hooksFor(api);
  let result;
  const self = (wins) => ({ user: { id: fixture.ids[0] }, inventory: {}, stats: { wins } });
  const mock = { user: { id: "mock_person" }, inventory: {}, stats: {} };
  function Probe({ bundle }) {
    result = hooks.usePublicProfilePreviews([fixture.ids[0], "mock_person"], { selfBundle: bundle, embedded: { mock_person: mock } });
    return null;
  }
  let view;
  await act(async () => { view = create(React.createElement(Probe, { bundle: self(1) })); });
  await act(async () => view.update(React.createElement(Probe, { bundle: self(2) })));
  assert.equal(result[fixture.ids[0]].stats.wins, 2);
  assert.equal(fixture.counts.gets, 0);
  assert.equal(fixture.counts.gets + fixture.counts.queries, 0);
  await act(async () => view.unmount());
});

test("full cards load on demand, refresh stats on reopening and ignore late closed requests", async () => {
  const fixture = sdkFixture();
  const { api } = await publicProfileModule(fixture.sdk);
  const hooks = await hooksFor(api);
  let result;
  function Probe({ id }) { result = hooks.useSelectedPublicProfile(id); return null; }
  let view;
  await act(async () => { view = create(React.createElement(Probe, { id: fixture.ids[0] })); });
  assert.equal(fixture.counts.gets, 3);
  assert.equal(result.bundle.stats.wins, 1);
  await act(async () => view.update(React.createElement(Probe, { id: null })));
  fixture.documents.get(`user_stats/${fixture.ids[0]}`).wins = 8;
  await act(async () => view.update(React.createElement(Probe, { id: fixture.ids[0] })));
  assert.equal(result.bundle.stats.wins, 8);
  assert.equal(fixture.counts.gets, 6);
  let release;
  fixture.gate(new Promise((resolve) => { release = resolve; }));
  await act(async () => view.update(React.createElement(Probe, { id: fixture.ids[1] })));
  await act(async () => view.update(React.createElement(Probe, { id: null })));
  await act(async () => { release(); });
  assert.equal(result.bundle, null);
  await act(async () => view.unmount());
});

test("directory re-entry preserves all members and orphan filtering: 800 -> 80 reads", async () => {
  const old = sdkFixture();
  const before = await publicProfileModule(old.sdk, {}, true);
  for (let visit = 0; visit < 10; visit += 1) assert.equal((await before.api.getPublicProfileDirectory()).length, 40);
  assert.equal(old.counts.documents, 800);
  const fixture = sdkFixture();
  const { api, cache } = await publicProfileModule(fixture.sdk);
  for (let visit = 0; visit < 10; visit += 1) assert.equal((await api.getPublicProfileDirectory()).length, 40);
  assert.equal(fixture.counts.documents, 80);
  fixture.documents.delete(`user_inventory/${fixture.ids[1]}`);
  cache.invalidatePublicProfileCache(fixture.ids[1]);
  assert.equal((await api.getPublicProfileDirectory()).length, 39);
});

test("concurrent requests deduplicate, errors retry and account switches discard pending data", async () => {
  const fixture = sdkFixture();
  const { api, cache } = await publicProfileModule(fixture.sdk);
  await Promise.all([api.getPublicProfileBundle(fixture.ids[0]), api.getPublicProfileBundle(fixture.ids[0])]);
  assert.equal(fixture.counts.gets, 3);
  fixture.fail(true);
  await assert.rejects(api.getPublicProfileBundle(fixture.ids[1]));
  fixture.fail(false);
  assert.ok(await api.getPublicProfileBundle(fixture.ids[1]));
  assert.equal(await api.getPublicProfileBundle("missing"), null);
  let loads = 0;
  await cache.rememberPublicProfile("ttl-test", () => ++loads, { ttl: -1 });
  await cache.rememberPublicProfile("ttl-test", () => ++loads);
  assert.equal(loads, 2);
  let release;
  fixture.gate(new Promise((resolve) => { release = resolve; }));
  const pending = api.getPublicProfileBundle(fixture.ids[2]);
  await Promise.resolve();
  cache.setPublicProfileCacheScope("other-account");
  release();
  assert.equal(await pending, null);
  fixture.gate(null);
  assert.ok(await api.getPublicProfileBundle(fixture.ids[2]));
});

test("negative cache expires and failed requests do not poison subsequent previews", async () => {
  const fixture = sdkFixture();
  const { api } = await publicProfileModule(fixture.sdk);
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    assert.equal(await api.getPublicProfileBundle("new-player"), null);
    for (const name of ["public_profiles", "user_inventory", "user_stats"]) fixture.documents.set(`${name}/new-player`, {});
    assert.equal(await api.getPublicProfileBundle("new-player"), null);
    now += 3001;
    assert.ok(await api.getPublicProfileBundle("new-player"));
    fixture.fail(true);
    assert.deepEqual(await api.getPublicProfilePreviews([fixture.ids[1]]), {});
    fixture.fail(false);
    assert.ok((await api.getPublicProfilePreviews([fixture.ids[1]]))[fixture.ids[1]]);
  } finally { Date.now = originalNow; }
});

test("automatic whole-group writes removed; existing realtime subscriptions retained", async () => {
  const fixture = sdkFixture();
  fixture.ids.forEach((id) => fixture.documents.set(`users/${id}`, fixture.documents.get(`public_profiles/${id}`)));
  const before = await publicProfileModule(fixture.sdk, {}, true);
  await before.api.syncAllPublicProfilesOnce();
  await before.api.syncAllPublicProfilesOnce();
  assert.equal(fixture.counts.documents, 40);
  assert.equal(fixture.counts.writes, 40);
  const auth = await readFile(new URL("../src/contexts/AuthContext.jsx", import.meta.url), "utf8");
  const feed = await readFile(new URL("../src/pages/Feed.jsx", import.meta.url), "utf8");
  const match = await readFile(new URL("../src/pages/MatchList.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(auth + feed, /syncAllPublicProfiles/);
  assert.match(auth, /syncOwnPublicProfile\(session.user\)/);
  assert.match(auth, /onSnapshot\(doc\(db, "account_security"/);
  assert.match(auth, /onSnapshot\(\s*doc\(db, "user_stats"/);
  assert.match(feed, /useEffect\(\(\) => subscribeFeedPosts/);
  assert.match(match, /const unsubscribe = subscribeActiveVolleyList/);
  assert.match(match, /return unsubscribe/);
});
