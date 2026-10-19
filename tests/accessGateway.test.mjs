import assert from "node:assert/strict";
import { test } from "node:test";
import { createAccessGateway, validateAccessPayload } from "../server/accessGateway.js";
import { createAccessHandler } from "../api/access-gateway.js";

const secret = "synthetic-secret-only-for-local-access-gateway-tests";

test("access gateway rejects malformed payloads before touching Admin services", async () => {
  let calls = 0;
  const handler = createAccessHandler({ services() { calls++; throw new Error("must not initialize"); } });
  for (const body of [null, [], {}, { action: "delete" }, { action: "lookup", phone: "123" }, { action: "verify", phone: "61999999999", code: "000000", role: "admin" }, { action: "login", username: "../users" }]) {
    let output;
    const res = { setHeader() {}, end(value) { output = JSON.parse(value); } };
    await handler({ method: "POST", headers: { "content-type": "application/json" }, body }, res);
    assert.equal(res.statusCode, 400);
    assert.ok(output.error);
  }
  assert.equal(calls, 0);
});

test("access gateway refuses oversized, non-JSON and non-POST requests without services", async () => {
  const handler = createAccessHandler({ services() { throw new Error("must not initialize"); } });
  for (const [req, expected] of [
    [{ method: "GET", headers: {} }, 405],
    [{ method: "POST", headers: {} }, 415],
    [{ method: "POST", headers: { "content-type": "application/jsonp" } }, 415],
    [{ method: "POST", headers: { "content-type": "application/json", "content-length": "5000" } }, 413],
    [{ method: "POST", headers: { "content-type": "application/json" }, body: "{" }, 400],
    [{ method: "POST", headers: { "content-type": "application/json" }, body: { action: "lookup", phone: "9".repeat(5000) } }, 413],
  ]) {
    const res = { setHeader() {}, end() {} };
    await handler(req, res);
    assert.equal(res.statusCode, expected);
  }
});

test("forged tickets and missing bearer tokens never reach the database", async () => {
  const gateway = createAccessGateway({ secret, db: { collection() { throw new Error("database touched"); } }, auth: {} });
  for (const ticket of ["", "forged.signature", "e30.invalid.extra"]) {
    await assert.rejects(gateway.execute({ action: "authorize", ticket, username: "newbie" }), { status: 403 });
  }
});

test("valid public shapes are narrowly defined and reject optional privilege fields", () => {
  assert.doesNotThrow(() => validateAccessPayload({ action: "login", username: "visitor" }));
  assert.doesNotThrow(() => validateAccessPayload({ action: "verify", phone: "61999999999", code: "123456" }));
  for (const field of ["uid", "role", "enabled", "expiresAt", "authEmail", "userId"]) {
    assert.throws(() => validateAccessPayload({ action: "authorize", ticket: "proof", username: "newbie", [field]: "forged" }), { status: 400 });
  }
});

test("an explicitly disabled gateway prevents valid requests from initializing Admin services", async () => {
  let calls = 0;
  const handler = createAccessHandler({ enabled: () => false, services() { calls++; throw new Error("must not initialize"); } });
  const res = { setHeader() {}, end() {} };
  await handler({ method: "POST", headers: { "content-type": "application/json" }, body: { action: "login", username: "visitor" } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(calls, 0);
});

test("shared-IP budget accommodates forty registrations worth of API calls and then enforces the limit", async () => {
  const documents = new Map();
  const db = {
    collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}`, get: async () => ({ data: () => documents.get(`${name}/${id}`) }) }) }),
    runTransaction: async (callback) => callback({
      get: async (ref) => ({ data: () => documents.get(ref.path) }),
      set: (ref, value) => documents.set(ref.path, value),
    }),
  };
  const first = createAccessGateway({ db, auth: {}, secret, now: () => 2_000_000 });
  const second = createAccessGateway({ db, auth: {}, secret, now: () => 2_000_000 });
  for (let index = 0; index < 240; index++) {
    await (index % 2 ? first : second).execute({ action: "login", username: "visitor" }, { ip: "synthetic-shared-wifi" });
  }
  await assert.rejects(second.execute({ action: "login", username: "visitor" }, { ip: "synthetic-shared-wifi" }), { status: 429 });
});
