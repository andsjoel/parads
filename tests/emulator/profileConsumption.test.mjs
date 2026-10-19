import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";
import * as firestore from "firebase/firestore";
import { createEmulatorEnvironment } from "../support/emulator-environment.mjs";
import { publicProfileModule } from "../support/public-profile-module.mjs";

let env;
before(async () => { env = await createEmulatorEnvironment(); });
after(async () => { await env?.cleanup(); });

test("member, guest and ADM can load previews, complete cards and directory", async () => {
  for (const uid of ["fixture-member", "fixture-guest", "fixture-admin"]) {
    const db = env.rulesEnv.authenticatedContext(uid).firestore();
    const { api } = await publicProfileModule(firestore, db);
    const previews = await api.getPublicProfilePreviews(["fixture-member", "fixture-admin"]);
    assert.equal(previews["fixture-admin"].user.id, "fixture-admin");
    assert.equal(previews["fixture-member"].stats, undefined);
    const bundle = await api.getPublicProfileBundle("fixture-member", { force: true });
    assert.equal(bundle.stats.wins, 3);
    assert.ok(bundle.inventory);
    assert.ok((await api.getPublicProfileDirectory()).some((person) => person.id === "fixture-guest"));
  }
});

test("orphan filtering and fresh stats remain compatible with existing documents", async () => {
  await env.db.doc("public_profiles/synthetic-orphan").set({ fullName: "Removed test member" });
  const db = env.rulesEnv.authenticatedContext("fixture-member").firestore();
  const { api } = await publicProfileModule(firestore, db);
  assert.equal((await api.getPublicProfileDirectory()).some((person) => person.id === "synthetic-orphan"), false);
  const first = await api.getPublicProfileBundle("fixture-member");
  await env.db.doc("user_stats/fixture-member").update({ wins: 4 });
  const updated = await api.getPublicProfileBundle("fixture-member", { force: true });
  assert.equal(first.stats.wins, 3);
  assert.equal(updated.stats.wins, 4);
});

test("unauthenticated and Auth-without-invite clients cannot bypass authorization via new queries", async () => {
  for (const context of [env.rulesEnv.unauthenticatedContext(), env.rulesEnv.authenticatedContext("fixture-outsider")]) {
    const { api } = await publicProfileModule(firestore, context.firestore());
    await assert.rejects(api.getPublicProfileBundle("fixture-member"), { code: "permission-denied" });
    await assert.rejects(api.getPublicProfileDirectory(), { code: "permission-denied" });
  }
});

test("the actual active-list subscription still delivers each result without profile reloads", async () => {
  const source = await readFile(new URL("../../src/services/volleyListService.js", import.meta.url), "utf8");
  const subscription = source.slice(source.indexOf("export function subscribeActiveVolleyList"), source.indexOf("export async function getVolleyAdminUsers"));
  assert.ok(subscription.includes("return onSnapshot"));
  const db = env.rulesEnv.authenticatedContext("fixture-member").firestore();
  const entry = new SourceTextModule(`import { collection, query, where, limit, onSnapshot } from 'sdk'; import { db } from 'db'; const COLLECTION_NAME = 'volley_lists'; ${subscription}`);
  await entry.link((specifier) => {
    const values = specifier === "sdk" ? firestore : { db };
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  let profileGets = 0;
  const { api } = await publicProfileModule({ ...firestore, getDoc: (...args) => { profileGets += 1; return firestore.getDoc(...args); } }, db);
  await api.getPublicProfilePreviews(["fixture-member", "fixture-admin"]);
  assert.equal(profileGets, 2);
  const deliveries = [];
  let waiter;
  const unsubscribe = entry.namespace.subscribeActiveVolleyList({ onChange: (list) => {
    deliveries.push(list?.revision);
    waiter?.();
  }, onError: (error) => waiter?.(error) });
  async function waitFor(revision) {
    if (deliveries.includes(revision)) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Missing revision ${revision}`)), 5000);
      waiter = (error) => {
        if (!error && !deliveries.includes(revision)) return;
        clearTimeout(timer);
        waiter = null;
        if (error) reject(error); else resolve();
      };
    });
  }
  try {
    await waitFor(0);
    for (let revision = 1; revision <= 6; revision += 1) {
      await env.db.doc("volley_lists/fixture-day").update({ revision });
      await waitFor(revision);
    }
    assert.deepEqual(deliveries, [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(profileGets, 2);
  } finally { unsubscribe(); }
});
