import assert from "node:assert/strict";
import { test } from "node:test";
import { Buffer } from "node:buffer";
import process from "node:process";
import { createHmac } from "node:crypto";
import { createRecoveryHandler } from "../api/password-recovery.js";
import { createAccessHandler } from "../api/access-gateway.js";
import { createAccessGateway } from "../server/accessGateway.js";
import { bearerToken, readJsonBody, requestIp } from "../server/apiProtection.js";
import { createSharedRequestLimiter } from "../server/requestLimits.js";
import { invoke, memoryApiDb } from "./support/api-fixture.mjs";

const secret = "synthetic-test-secret-never-a-production-credential";
const key = createHmac("sha256", secret).update("test-limits").digest();

function recoveryFixture(options = {}) {
  const fixture = memoryApiDb();
  const counts = { services: 0, verify: 0, reset: 0, complete: 0 };
  const services = () => {
    counts.services += 1;
    return { db: fixture.db, auth: { verifyIdToken: async () => {
      counts.verify += 1;
      return { uid: "synthetic-member", auth_time: 1000 };
    } } };
  };
  const recovery = () => ({
    reset: async () => { counts.reset += 1; return { temporaryPassword: "12345678" }; },
    complete: async () => { counts.complete += 1; return { completed: true }; },
  });
  const create = () => createRecoveryHandler({ services, secret: () => secret, recovery, now: () => 2000000, ...options });
  return { ...fixture, counts, dbCounts: fixture.counts, create };
}

test("recovery rejects malformed actions, fields and bodies before Admin, token checks or database", async () => {
  const fixture = recoveryFixture();
  const handler = fixture.create();
  for (const body of [null, [], {}, { action: "constructor" }, { action: "reset", inviteId: "../users" },
    { action: "reset", inviteId: "5561000000001", uid: "other" }, { action: "complete", password: "123" },
    { action: "complete", password: "12345678", role: "admin" }, "{", { action: "complete", password: "9".repeat(3000) }]) {
    const result = await invoke(handler, body);
    assert.ok([400, 413].includes(result.statusCode));
  }
  const wrongType = await invoke(handler, {}, { headers: { "content-type": "text/plain" } });
  assert.equal(wrongType.statusCode, 415);
  const tooLarge = await invoke(handler, {}, { headers: { "content-length": "2049" } });
  assert.equal(tooLarge.statusCode, 413);
  assert.equal(fixture.counts.services + fixture.counts.verify + fixture.dbCounts.reads, 0);
});

test("bearer format and size are checked before SDK initialization", async () => {
  const fixture = recoveryFixture();
  for (const authorization of [undefined, [], "Bearer short", "Bearer a.b.c.d", `Bearer ${"a".repeat(9000)}.b.c`]) {
    assert.throws(() => bearerToken({ headers: { authorization } }), { status: 401 });
    assert.equal((await invoke(fixture.create(), { action: "complete", password: "12345678" }, { headers: { authorization } })).statusCode, 401);
  }
  assert.equal(fixture.counts.services, 0);
});

test("JSON byte limits handle parsed bodies, raw buffers and streamed UTF-8 safely", async () => {
  const bytes = Buffer.from(JSON.stringify({ text: "Ação" }));
  const req = { headers: { "content-type": "application/json" }, async *[Symbol.asyncIterator]() {
    for (const byte of bytes) yield Buffer.from([byte]);
  } };
  assert.deepEqual(await readJsonBody(req, 64), { text: "Ação" });
  await assert.rejects(readJsonBody(req, 5), { status: 413 });
  assert.deepEqual(await readJsonBody({ headers: req.headers, body: bytes }, 64), { text: "Ação" });
  await assert.rejects(readJsonBody({ headers: req.headers, body: { text: "ç".repeat(20) } }, 32), { status: 413 });
});

test("trusted Vercel IP cannot be substituted with caller X-Forwarded-For", () => {
  const req = { headers: { "x-forwarded-for": "203.0.113.9", "x-vercel-forwarded-for": "192.0.2.9" }, socket: { remoteAddress: "127.0.0.1" } };
  assert.equal(requestIp(req, false), "127.0.0.1");
  assert.equal(requestIp(req, true), "192.0.2.9");
  req.headers["x-vercel-forwarded-for"] = "invalid";
  assert.equal(requestIp(req, true), "127.0.0.1");
});

test("forty people on shared Wi-Fi complete recovery; two instances enforce one shared IP budget", async () => {
  const fixture = recoveryFixture();
  const first = fixture.create();
  const second = fixture.create();
  for (let index = 0; index < 60; index += 1) {
    assert.equal((await invoke(index % 2 ? first : second, { action: "complete", password: "12345678" })).statusCode, 200);
  }
  const blocked = await invoke(second, { action: "complete", password: "12345678" });
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers["Retry-After"], "60");
  assert.equal(fixture.counts.verify, 60);
  const reads = fixture.dbCounts.reads;
  assert.equal((await invoke(second, { action: "complete", password: "12345678" })).statusCode, 429);
  assert.equal(fixture.dbCounts.reads, reads, "local backoff must avoid another database read");
  assert.equal((await invoke(second, { action: "complete", password: "12345678" }, { socket: { remoteAddress: "192.0.2.2" } })).statusCode, 200);
});

test("flood after the local limit causes no further database or Auth requests on that instance", async () => {
  const fixture = recoveryFixture();
  const handler = fixture.create();
  for (let index = 0; index < 60; index += 1) await invoke(handler, { action: "complete", password: "12345678" });
  const before = { ...fixture.dbCounts };
  for (let index = 0; index < 100; index += 1) assert.equal((await invoke(handler, { action: "complete", password: "12345678" })).statusCode, 429);
  assert.deepEqual(fixture.dbCounts, before);
  assert.equal(fixture.counts.verify, 60);
});

test("database failures fail closed before verifying tokens or changing passwords", async () => {
  const fixture = recoveryFixture();
  fixture.fail(true);
  assert.equal((await invoke(fixture.create(), { action: "reset", inviteId: "5561000000001" })).statusCode, 503);
  assert.equal(fixture.counts.verify + fixture.counts.reset, 0);
});

test("JWT-shaped text never authenticates without Admin verification", async () => {
  const fixture = memoryApiDb();
  let checks = 0;
  const handler = createRecoveryHandler({ secret: () => secret, services: () => ({ db: fixture.db,
    auth: { verifyIdToken: async () => { checks += 1; throw new Error("Synthetic invalid signature"); } } }),
    recovery: () => ({ complete: () => { throw new Error("must not modify Auth"); } }) });
  const result = await invoke(handler, { action: "complete", password: "12345678" });
  assert.equal(result.statusCode, 401);
  assert.equal(checks, 1);
  assert.equal(fixture.counts.writes, 1, "the shared budget precedes token verification");
});

test("server environment switches default safely without changing production configuration", async () => {
  const names = ["PARADS_ACCESS_GATEWAY_ENABLED", "PARADS_API_OPERATIONS_PAUSED", "PARADS_REGISTRATION_DISABLED", "PARADS_PASSWORD_RECOVERY_DISABLED"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  let starts = 0;
  const services = () => { starts += 1; throw new Error("must not initialize"); };
  try {
    process.env.PARADS_ACCESS_GATEWAY_ENABLED = "true";
    process.env.PARADS_API_OPERATIONS_PAUSED = "true";
    assert.equal((await invoke(createAccessHandler({ services }), { action: "login", username: "member" })).statusCode, 503);
    assert.equal((await invoke(createRecoveryHandler({ services }), { action: "complete", password: "12345678" })).statusCode, 503);
    process.env.PARADS_API_OPERATIONS_PAUSED = "false";
    process.env.PARADS_REGISTRATION_DISABLED = "true";
    process.env.PARADS_PASSWORD_RECOVERY_DISABLED = "true";
    assert.equal((await invoke(createAccessHandler({ services }), { action: "lookup", phone: "61999999999" })).statusCode, 503);
    assert.equal((await invoke(createRecoveryHandler({ services }), { action: "complete", password: "12345678" })).statusCode, 503);
    assert.equal(starts, 0);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
  }
});

test("emergency switches suspend expensive operations without initializing Admin", async () => {
  const fixture = recoveryFixture({ enabled: () => false });
  assert.equal((await invoke(fixture.create(), { action: "complete", password: "12345678" })).statusCode, 503);
  assert.equal(fixture.counts.services, 0);
  const handler = createAccessHandler({ enabled: () => true, registrationEnabled: () => false,
    services: () => { throw new Error("must not initialize"); } });
  assert.equal((await invoke(handler, { action: "lookup", phone: "61999999999" })).statusCode, 503);
});

test("suspending registrations preserves existing login aliases", async () => {
  const fixture = memoryApiDb();
  const handler = createAccessHandler({ enabled: () => true, registrationEnabled: () => false,
    secret: () => secret, services: () => ({ db: fixture.db, auth: {} }) });
  assert.equal((await invoke(handler, { action: "login", username: "member" })).body.authEmail, "member@parads.local");
});

test("prototype action names and missing authorize token are rejected before Admin", async () => {
  const handler = createAccessHandler({ enabled: () => true, registrationEnabled: () => true, services: () => { throw new Error("must not initialize"); } });
  for (const action of ["constructor", "__proto__", "toString"]) assert.equal((await invoke(handler, { action })).statusCode, 400);
  assert.equal((await invoke(handler, { action: "authorize", ticket: "proof", username: "newbie" }, { headers: { authorization: undefined } })).statusCode, 401);
});

test("shared minute/day limits hold across instances and replenish only with their window", async () => {
  const fixture = memoryApiDb();
  let clock = 86400000;
  const create = () => createSharedRequestLimiter({ db: fixture.db, key, namespace: "synthetic", minuteLimit: 2, dayLimit: 3, ipLimit: 10, now: () => clock });
  const first = create();
  const second = create();
  await first("192.0.2.1");
  await second("192.0.2.2");
  await assert.rejects(first("192.0.2.3"), { status: 429 });
  clock += 61000;
  await second("192.0.2.1");
  await assert.rejects(first("192.0.2.2"), { status: 429 });
  clock += 86400000;
  await first("192.0.2.1");
  assert.equal(fixture.documents.size, 1);
  assert.equal(fixture.counts.writes, 4);
  assert.equal(JSON.stringify([...fixture.documents.values()]).includes("192.0.2."), false);
});

test("a blocked invitation does not temporarily block unrelated invitations on the same IP", async () => {
  const fixture = memoryApiDb();
  const gateway = createAccessGateway({ db: fixture.db, auth: {}, secret, now: () => 2000000 });
  const verify = { action: "verify", phone: "61999999999", code: "123456" };
  // No invitation is seeded, so normal lookups fail after consuming the limit.
  // Stub equality queries for the bounded legacy fallback.
  const collection = fixture.db.collection;
  fixture.db.collection = (name) => ({ ...collection(name), where: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) }) });
  for (let index = 0; index < 10; index += 1) await assert.rejects(gateway.execute(verify, { ip: "same-wifi" }), { status: 403 });
  await assert.rejects(gateway.execute(verify, { ip: "same-wifi" }), { status: 429 });
  await assert.rejects(gateway.execute({ ...verify, phone: "61999999998" }, { ip: "same-wifi" }), { status: 403 });
});

test("access limit extraction preserves an existing daily counter instead of resetting it", async () => {
  const fixture = memoryApiDb();
  const time = 2000000;
  fixture.documents.set("request_limits/access_gateway", {
    minute: Math.floor(time / 60000), minuteCount: 0,
    day: Math.floor(time / 86400000), dayCount: 3000, entries: {},
  });
  const gateway = createAccessGateway({ db: fixture.db, auth: {}, secret, now: () => time });
  await assert.rejects(gateway.execute({ action: "login", username: "member" }), { status: 429 });
  assert.equal(fixture.counts.writes, 0);
  assert.equal(fixture.documents.get("request_limits/access_gateway").dayCount, 3000);
});

test('absent gateway flag preserves login but refuses onboarding; explicit false/invalid values fail closed', async () => {
  const names = ['PARADS_ACCESS_GATEWAY_ENABLED', 'PARADS_API_OPERATIONS_PAUSED', 'PARADS_REGISTRATION_DISABLED'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const fixture = memoryApiDb();
  let services = 0;
  const options = { secret: () => secret, services: () => { services++; return { db: fixture.db, auth: {} }; } };
  try {
    names.forEach((name) => delete process.env[name]);
    const handler = createAccessHandler(options);
    assert.equal((await invoke(handler, { action: 'login', username: 'member' })).statusCode, 200);
    const reads = fixture.counts.reads;
    assert.equal((await invoke(handler, { action: 'lookup', phone: '61999999999' })).statusCode, 503);
    assert.equal(fixture.counts.reads, reads);
    for (const flag of ['false', 'TRUE', 'typo', '']) {
      process.env.PARADS_ACCESS_GATEWAY_ENABLED = flag;
      assert.equal((await invoke(createAccessHandler(options), { action: 'login', username: 'member' })).statusCode, 503);
    }
    assert.equal(services, 1);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
  }
});
