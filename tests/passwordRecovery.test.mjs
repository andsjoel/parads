import assert from "node:assert/strict";
import { test } from "node:test";
import { createPasswordRecovery, createRecoveryStore } from "../server/passwordRecovery.js";
import handler from "../api/password-recovery.js";

function harness() {
  let clock = 2_000_000;
  const deleted = Symbol("deleted");
  const documents = new Map([
    ["users/admin", { role: "admin" }],
    ["users/member", { role: "member", fullName: "Member", phone: "5561999990000", progression: { coins: 42 } }],
    ["pre_registered_users/5561999990000", { claimed: true, userId: "member", phone: "5561999990000" }],
    ["user_stats/member", { wins: 7 }],
    ["user_inventory/member", { displayCards: ["display-card-shiny"] }],
  ]);
  const snapshot = (ref) => ({ exists: documents.has(ref.path), data: () => documents.get(ref.path) });
  const makeWriter = () => {
    const writes = [];
    return {
      get: async (ref) => snapshot(ref),
      set: (ref, value, options) => writes.push(() => documents.set(ref.path, options?.merge ? { ...documents.get(ref.path), ...value } : value)),
      update: (ref, value) => writes.push(() => {
        assert.ok(documents.has(ref.path));
        const next = { ...documents.get(ref.path), ...value };
        for (const key of Object.keys(next)) if (next[key] === deleted) delete next[key];
        documents.set(ref.path, next);
      }),
      delete: (ref) => writes.push(() => documents.delete(ref.path)),
      commit: async () => writes.forEach((write) => write()),
    };
  };
  const db = {
    collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}` }) }),
    batch: makeWriter,
    async runTransaction(callback) {
      const transaction = makeWriter();
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    },
  };
  const authCalls = [];
  const auth = {
    async updateUser(uid, fields) { authCalls.push({ uid, fields }); },
    async revokeRefreshTokens(uid) { authCalls.push({ revoke: uid }); },
  };
  const fieldValue = {
    serverTimestamp: () => { const time = clock; return { toMillis: () => time }; },
    delete: () => deleted,
  };
  const service = createPasswordRecovery({
    auth, store: createRecoveryStore(db, fieldValue), now: () => clock,
    generatePassword: () => "00123456", wait: async () => {},
  });
  return { service, documents, auth, authCalls, advance: (ms) => { clock += ms; } };
}

test("a member cannot reset someone else's password", async () => {
  const { service, documents, authCalls } = harness();
  await assert.rejects(service.reset("member", "5561999990000"), { status: 403 });
  assert.equal(authCalls.length, 0);
  assert.equal(documents.has("account_security/member"), false);
});

test("admin reset produces eight digits, revokes sessions and preserves all profile data", async () => {
  const { service, documents, authCalls } = harness();
  const result = await service.reset("admin", "5561999990000");
  assert.match(result.temporaryPassword, /^\d{8}$/);
  assert.equal(result.temporaryPassword, "00123456");
  assert.equal(documents.get("account_security/member").passwordChangeRequired, true);
  assert.equal(documents.get("account_security/member").resetState, "ready");
  assert.deepEqual(authCalls, [{ uid: "member", fields: { password: "00123456" } }, { revoke: "member" }]);
  assert.equal(documents.get("users/member").progression.coins, 42);
  assert.equal(documents.get("user_stats/member").wins, 7);
  assert.deepEqual(documents.get("user_inventory/member").displayCards, ["display-card-shiny"]);
  for (const document of documents.values()) assert.equal(JSON.stringify(document).includes(result.temporaryPassword), false);
});

test("reset rejects pending invitations, self-reset and rapid repeat requests", async () => {
  const { service, documents, advance } = harness();
  documents.set("pre_registered_users/5561999991111", { claimed: false });
  await assert.rejects(service.reset("admin", "5561999991111"), { status: 400 });
  documents.set("pre_registered_users/5561999992222", { claimed: true, userId: "admin" });
  await assert.rejects(service.reset("admin", "5561999992222"), { status: 400 });
  await service.reset("admin", "5561999990000");
  advance(1000);
  await assert.rejects(service.reset("admin", "5561999990000"), { status: 429 });
});

test("an older session or the same temporary password cannot complete the reset", async () => {
  const { service, authCalls } = harness();
  await service.reset("admin", "5561999990000");
  await assert.rejects(service.complete({ uid: "member", auth_time: 2000 }, "87654321"), { status: 401 });
  await assert.rejects(service.complete({ uid: "member", auth_time: 2001 }, "00123456"), { status: 400 });
  await assert.rejects(service.complete({ uid: "member", auth_time: 2001 }, "abc"), { status: 400 });
  assert.equal(authCalls.length, 2);
});

test("completing the reset clears the restriction and invalidates temporary sessions", async () => {
  const { service, documents, advance, authCalls } = harness();
  await service.reset("admin", "5561999990000");
  advance(5000);
  assert.deepEqual(await service.complete({ uid: "member", auth_time: 2001 }, "87654321"), { completed: true });
  const security = documents.get("account_security/member");
  assert.equal(security.passwordChangeRequired, false);
  assert.equal(security.invalidBefore, 2005);
  assert.equal(security.resetState, "completed");
  const audit = documents.get(`password_reset_audit/${security.resetId}`);
  assert.equal(audit.status, "completed");
  assert.equal(audit.temporaryHash, undefined);
  assert.deepEqual(authCalls.at(-1), { revoke: "member" });
  await assert.rejects(service.complete({ uid: "member", auth_time: 2006 }, "12345678"), { status: 409 });
});

test("an Auth failure restores access when the password has not changed", async () => {
  const { service, auth, documents } = harness();
  auth.updateUser = async () => { throw new Error("Auth unavailable"); };
  await assert.rejects(service.reset("admin", "5561999990000"));
  assert.equal(documents.has("account_security/member"), false);
});

test("failure after password update keeps the account restricted", async () => {
  const { service, auth, documents } = harness();
  auth.revokeRefreshTokens = async () => { throw new Error("Auth unavailable"); };
  await assert.rejects(service.reset("admin", "5561999990000"));
  assert.equal(documents.get("account_security/member").passwordChangeRequired, true);
  assert.equal(documents.get("account_security/member").resetState, "failed");
});

test("API rejects unauthenticated requests before accessing Admin credentials", async () => {
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = JSON.parse(body); } };
  await handler({ method: "GET", headers: {} }, response);
  assert.equal(response.statusCode, 405);
  await handler({ method: "POST", headers: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.headers["Cache-Control"], "no-store");
});
