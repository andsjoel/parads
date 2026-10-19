import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { FieldValue } from "firebase-admin/firestore";
import { doc, getDoc } from "firebase/firestore";
import { createEmulatorEnvironment } from "../support/emulator-environment.mjs";
import { TEST_PROJECT_ID } from "../support/isolation.mjs";
import { TEST_PASSWORD } from "../fixtures/security.mjs";
import { invoke } from "../support/api-fixture.mjs";
import { createRecoveryHandler } from "../../api/password-recovery.js";
import { createPasswordRecovery, createRecoveryStore } from "../../server/passwordRecovery.js";
import { createSharedRequestLimiter } from "../../server/requestLimits.js";

const secret = "synthetic-api-protection-tests-not-real-credentials";
const apps = new Map();
let env;
let first;
let second;
let updates = 0;
let saved;
let adminToken;
before(async () => {
  env = await createEmulatorEnvironment();
  const auth = {
    verifyIdToken: (...args) => env.auth.verifyIdToken(...args),
    updateUser: (...args) => { updates += 1; return env.auth.updateUser(...args); },
    revokeRefreshTokens: (...args) => env.auth.revokeRefreshTokens(...args),
  };
  const create = () => createRecoveryHandler({ secret: () => secret, services: () => ({ auth, db: env.db }),
    recovery: ({ auth, db }) => createPasswordRecovery({ auth, store: createRecoveryStore(db, FieldValue), generatePassword: () => "12345678" }) });
  first = create();
  second = create();
  saved = await memberData();
  adminToken = await login("fixture-admin");
});
after(async () => {
  for (const app of apps.values()) await deleteApp(app);
  await env?.cleanup();
});

async function login(uid, password = TEST_PASSWORD) {
  if (!apps.has(uid)) {
    const app = initializeApp({ projectId: TEST_PROJECT_ID, apiKey: "fake-test-key" }, `stage4-${uid}`);
    connectAuthEmulator(getAuth(app), "http://127.0.0.1:19099", { disableWarnings: true });
    apps.set(uid, app);
  }
  const credential = await signInWithEmailAndPassword(getAuth(apps.get(uid)), `${uid}@example.test`, password);
  return credential.user.getIdToken(true);
}

async function memberData() {
  const result = {};
  for (const name of ["users", "user_inventory", "user_stats", "public_profiles", "user_showcase"]) {
    result[name] = (await env.db.doc(`${name}/fixture-member`).get()).data();
  }
  result.invite = (await env.db.doc("pre_registered_users/5561000000002").get()).data();
  return result;
}

function call(handler, token, body) {
  return invoke(handler, body, { headers: { authorization: `Bearer ${token}` } });
}

test("real emulator tokens for member, guest and outsider cannot reset another account", async () => {
  for (const uid of ["fixture-member", "fixture-guest", "fixture-outsider"]) {
    const token = await login(uid);
    const result = await call(first, token, { action: "reset", inviteId: "5561000000002" });
    assert.equal(result.statusCode, 403);
  }
  assert.equal(updates, 0);
});

test("admin sessions invalidated in Firestore are rejected within the existing transaction", async () => {
  const claims = await env.auth.verifyIdToken(adminToken);
  const ref = env.db.doc("account_security/fixture-admin");
  await ref.set({ invalidBefore: claims.auth_time });
  try {
    assert.equal((await call(first, adminToken, { action: "reset", inviteId: "5561000000002" })).statusCode, 401);
    assert.equal(updates, 0);
  } finally { await ref.delete(); }
});

test("concurrent and repeated reset requests change the synthetic Auth password only once", async () => {
  const body = { action: "reset", inviteId: "5561000000002" };
  const results = await Promise.all([call(first, adminToken, body), call(second, adminToken, body)]);
  assert.equal(results.filter((result) => result.statusCode === 200).length, 1);
  assert.ok(results.every((result) => [200, 429, 503].includes(result.statusCode)));
  assert.equal(updates, 1);
  assert.equal(results.find((result) => result.statusCode === 200).body.temporaryPassword, "12345678");
  assert.equal((await call(second, adminToken, body)).statusCode, 429);
  assert.equal(updates, 1);
  assert.deepEqual(await memberData(), saved);
});

test("concurrent completion preserves profile data and does not repeat the password update", async () => {
  const token = await login("fixture-member", "12345678");
  const body = { action: "complete", password: "87654321" };
  const results = await Promise.all([call(first, token, body), call(second, token, body)]);
  assert.equal(results.filter((result) => result.statusCode === 200).length, 1);
  assert.ok(results.every((result) => [200, 401, 409, 503].includes(result.statusCode)));
  assert.equal(updates, 2);
  const freshToken = await login("fixture-member", "87654321");
  assert.equal((await call(first, freshToken, body)).statusCode, 409);
  assert.equal(updates, 2);
  assert.deepEqual(await memberData(), saved);
  const state = (await env.db.doc("account_security/fixture-member").get()).data();
  assert.equal(state.passwordChangeRequired, false);
  const audit = (await env.db.doc(`password_reset_audit/${state.resetId}`).get()).data();
  assert.equal(audit.temporaryHash, undefined);
  assert.equal(JSON.stringify({ state, audit }).includes("12345678"), false);
  assert.equal(JSON.stringify({ state, audit }).includes("87654321"), false);
});

test("shared limiter uses emulator transactions and its counters stay private to every client role", async () => {
  const options = { db: env.db, key: secret, namespace: "stage4_limiter", minuteLimit: 4, dayLimit: 6, ipLimit: 3, now: () => 2000000 };
  const firstLimit = createSharedRequestLimiter(options);
  const secondLimit = createSharedRequestLimiter(options);
  await firstLimit("192.0.2.1");
  await secondLimit("192.0.2.1");
  await firstLimit("192.0.2.1");
  await assert.rejects(secondLimit("192.0.2.1"), { status: 429 });
  await secondLimit("192.0.2.2");
  await assert.rejects(firstLimit("192.0.2.3"), { status: 429 });
  assert.equal((await env.db.doc("request_limits/stage4_limiter").get()).data().minuteCount, 4);
  for (const uid of ["fixture-admin", "fixture-member", "fixture-guest"]) {
    const db = env.rulesEnv.authenticatedContext(uid).firestore();
    await assert.rejects(getDoc(doc(db, "request_limits", "password_recovery")), { code: "permission-denied" });
  }
});
