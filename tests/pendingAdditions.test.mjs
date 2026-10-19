import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import * as React from "react";
import { create, act } from "react-test-renderer";
import { usePendingAdditions } from "../src/hooks/usePendingAdditions.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

async function fixture(scope = "day-1") {
  let api;
  function Probe({ scope }) { api = usePendingAdditions(scope); return null; }
  let view;
  await act(async () => { view = create(React.createElement(Probe, { scope })); });
  return { get api() { return api; }, update: async (scope) => {
    await act(async () => { view.update(React.createElement(Probe, { scope })); });
  }, close: async () => { await act(async () => view.unmount()); } };
}

test("arrival feedback is immediate, double clicks do not duplicate writes, success clears pending", async () => {
  const f = await fixture();
  const gate = deferred();
  let request, calls = 0;
  const action = () => { calls++; return gate.promise; };
  await act(async () => {
    request = f.api.add({ id: "player", name: "Ana" }, action);
    const duplicate = await f.api.add({ id: "player" }, action);
    assert.equal(duplicate.ok, false);
  });
  assert.equal(calls, 1);
  assert.equal(f.api.pending[0].name, "Ana");
  await act(async () => { gate.resolve({ entryId: "confirmed" }); await request; });
  assert.deepEqual(await request, { ok: true, value: { entryId: "confirmed" } });
  assert.equal(f.api.pending.length, 0);
  assert.equal(f.api.failures.length, 0);
  await f.close();
});

test("failed arrival retains player for retry; concurrent requests settle independently", async () => {
  const f = await fixture();
  const first = deferred(), second = deferred();
  let a, b;
  await act(async () => {
    a = f.api.add({ id: "a", name: "Ana", isSetter: true }, () => first.promise);
    b = f.api.add({ id: "b", name: "Bia" }, () => second.promise);
  });
  assert.equal(f.api.pending.length, 2);
  await act(async () => { first.reject(new Error("unavailable")); await a; });
  assert.equal(f.api.pending[0].id, "b");
  assert.equal(f.api.failures[0].isSetter, true);
  await act(async () => { await f.api.add(f.api.failures[0], async () => "retried"); });
  assert.equal(f.api.failures.length, 0);
  assert.equal(f.api.pending[0].id, "b");
  await act(async () => { second.resolve(); await b; });
  assert.equal(f.api.pending.length, 0);
  await f.close();
});

test("late completion from another day does not affect current arrivals; unmount is safe", async () => {
  const f = await fixture();
  const old = deferred(), current = deferred();
  let a, b;
  await act(async () => { a = f.api.add({ id: "same" }, () => old.promise); });
  await f.update("day-2");
  assert.equal(f.api.pending.length, 0);
  await act(async () => { b = f.api.add({ id: "same" }, () => current.promise); });
  await act(async () => { old.reject(new Error("late")); await a; });
  assert.equal(f.api.failures.length, 0);
  assert.equal(f.api.pending.length, 1);
  await f.close();
  current.resolve();
  assert.equal((await b).ok, true);
});

test("arrival UI clears the search before dispatch, without clearing it on a late response", async () => {
  const source = await readFile(new URL("../src/pages/AdminVolleyList.jsx", import.meta.url), "utf8");
  const handler = source.slice(source.indexOf("function handleAddUser("), source.indexOf("function handleAddGuest("));
  assert.ok(handler.indexOf('setSearch("")') < handler.indexOf("arrivals.add("));
  assert.equal((handler.match(/setSearch/g) || []).length, 1);
  assert.match(source, /handleAddUser\(item.user, item.isSetter, false\)/);
  assert.match(source, /role="status"/);
  assert.match(source, /não foi adicionado/);
});
