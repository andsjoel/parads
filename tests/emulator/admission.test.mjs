import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHash } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, updateDoc } from "firebase/firestore";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { createEmulatorEnvironment } from "../support/emulator-environment.mjs";
import { userServiceFor } from "../support/user-service-module.mjs";
import { TEST_PROJECT_ID } from "../support/isolation.mjs";
import { createAccessGateway } from "../../server/accessGateway.js";
import { createAccessHandler } from "../../api/access-gateway.js";

const secret = "synthetic-secret-only-for-local-access-gateway-tests";
const code = "123456";
const codeSalt = "synthetic-salt";
const codeHash = createHash("sha256").update(`${codeSalt}:${code}`).digest("hex");
let env;
let gateway;
let client;
let ticket;
let invite;
before(async () => {
  env = await createEmulatorEnvironment();
  gateway = createAccessGateway({ db: env.db, auth: env.auth, secret });
});
after(async () => { if (client) await deleteApp(client.app).catch(() => {}); await env?.cleanup(); });

async function login(uid, email, existing = false) {
  if (!existing) await env.auth.createUser({ uid, email, password: "12345678" });
  else await env.auth.updateUser(uid, { email, password: "12345678" });
  const app = initializeApp({ projectId: TEST_PROJECT_ID, apiKey: "fake-test-key" }, uid);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:19099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 18080);
  const credential = await signInWithEmailAndPassword(auth, email, "12345678");
  return { app, db, token: await credential.user.getIdToken(), uid };
}

test("public gateway exposes only minimal invitation data and verifies the code server-side", async () => {
  await env.db.doc("pre_registered_users/5561000000007").set({
    enabled: true, claimed: false, userId: null, role: "member", type: "member", sex: "female",
    phone: "5561000000007", fullName: "Synthetic newcomer", accessCodeHash: codeHash, accessCodeSalt: codeSalt,
  });
  invite = await gateway.execute({ action: "lookup", phone: "61000000007" });
  assert.deepEqual(Object.keys(invite).sort(), ["fullName", "id", "phone"]);
  await assert.rejects(gateway.execute({ action: "verify", phone: invite.phone, code: "999999" }), { status: 403 });
  const authorization = await gateway.execute({ action: "verify", phone: invite.phone, code });
  ticket = authorization.ticket;
  invite = { ...invite, ...authorization };
  assert.equal(invite.sex, "female");
  assert.equal(invite.role, "member");
  assert.equal(authorization.accessCodeHash, undefined);
  assert.equal(authorization.userId, undefined);
  assert.equal((await gateway.execute({ action: "username", ticket, username: "newbie" })).available, true);
});

test("new member registration requires a UID-bound grant and commits the app's actual seven-document batch", async () => {
  client = await login("fixture-newcomer", "newbie@parads.local");
  const users = await userServiceFor(client.db);
  await assertFails(users.createUserBaseData({ uid: client.uid, preRegister: invite, username: "newbie", authEmail: "newbie@parads.local" }));
  await assertFails(setDoc(doc(client.db, "registration_grants", client.uid), { expiresAt: new Date(Date.now() + 60_000) }));
  const handler = createAccessHandler({ services: () => ({ db: env.db, auth: env.auth }), secret: () => secret, enabled: () => true, registrationEnabled: () => true });
  let result;
  const response = { setHeader() {}, end(body) { result = JSON.parse(body); } };
  await handler({ method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${client.token}` }, body: { action: "authorize", ticket, username: "newbie" }, socket: { remoteAddress: "127.0.0.1" } }, response);
  assert.equal(response.statusCode, 200, JSON.stringify(result));
  assert.equal(result.completed, false);
  await assertFails(setDoc(doc(client.db, "users", client.uid), {
    phone: invite.phone, inviteId: invite.id, role: "admin", type: "admin", username: "newbie", authEmail: "newbie@parads.local",
  }));
  await assertFails(setDoc(doc(client.db, "users", client.uid), {
    phone: invite.phone, inviteId: invite.id, role: "member", type: "member", username: "newbie", authEmail: "newbie@parads.local",
  }));
  await assertSucceeds(users.createUserBaseData({ uid: client.uid, preRegister: invite, username: "newbie", authEmail: "newbie@parads.local" }));
  const saved = (await getDoc(doc(client.db, "users", client.uid))).data();
  assert.equal(saved.role, "member");
  assert.equal(saved.sex, "female");
  assert.equal(saved.inviteId, invite.id);
  assert.equal((await env.db.doc(`pre_registered_users/${invite.id}`).get()).data().userId, client.uid);
  await assertSucceeds(getDoc(doc(client.db, "volley_lists/fixture-day")));
});

test("a retry recognizes completed registration without resetting coins, inventory or sports history", async () => {
  await env.db.doc(`users/${client.uid}`).update({ "progression.coins": 77 });
  await env.db.doc(`user_stats/${client.uid}`).update({ wins: 19 });
  const retry = await gateway.execute({ action: "authorize", ticket, username: "newbie" }, { token: client.token });
  assert.equal(retry.completed, true);
  assert.equal((await env.db.doc(`users/${client.uid}`).get()).data().progression.coins, 77);
  assert.equal((await env.db.doc(`user_stats/${client.uid}`).get()).data().wins, 19);
  await assertFails(updateDoc(doc(client.db, "users", client.uid), { phone: "5561000000001" }));
  await assertFails(updateDoc(doc(client.db, "users", client.uid), { inviteId: "5561000000001" }));
  await deleteApp(client.app);
});

test("pending guest activation preserves UID, purchases and history and keeps the legacy login alias", async () => {
  const uid = "fixture-guest";
  const phone = "5561000000003";
  const email = "guest.synthetic@parads.local";
  await env.db.doc(`pre_registered_users/${phone}`).update({ accessCodeHash: codeHash, accessCodeSalt: codeSalt, pendingAuthEmail: email });
  await env.db.doc(`users/${uid}`).update({ authEmail: email, "progression.coins": 42 });
  await env.db.doc(`user_inventory/${uid}`).update({ displayCards: ["display-card-shiny"] });
  const before = (await env.db.doc(`user_stats/${uid}`).get()).data();
  const guest = await login(uid, email, true);
  try {
    const lookup = await gateway.execute({ action: "lookup", phone });
    const proof = await gateway.execute({ action: "verify", phone, code });
    await gateway.execute({ action: "authorize", ticket: proof.ticket, username: "visitor" }, { token: guest.token });
    const users = await userServiceFor(guest.db);
    await assertSucceeds(users.createUserBaseData({ uid, preRegister: { ...lookup, ...proof }, username: "visitor", authEmail: email }));
    assert.deepEqual((await env.db.doc(`user_stats/${uid}`).get()).data(), before);
    assert.equal((await env.db.doc(`users/${uid}`).get()).data().progression.coins, 42);
    assert.deepEqual((await env.db.doc(`user_inventory/${uid}`).get()).data().displayCards, ["display-card-shiny"]);
    assert.equal((await env.db.doc(`users/${uid}`).get()).data().firstAccessPending, false);
    assert.equal((await gateway.execute({ action: "login", username: "visitor" })).authEmail, email);
  } finally { await deleteApp(guest.app); }
});

test("expired proofs, regenerated codes and another UID cannot authorize registration", async () => {
  const phone = "5561000000008";
  await env.db.doc(`pre_registered_users/${phone}`).set({ phone, enabled: true, claimed: false, userId: "expected-uid", role: "guest", accessCodeHash: codeHash, accessCodeSalt: codeSalt, pendingAuthEmail: "expected@parads.local" });
  const { ticket: proof } = await gateway.execute({ action: "verify", phone, code });
  const attacker = createAccessGateway({ db: env.db, secret, auth: { verifyIdToken: async () => ({ uid: "other-uid" }), getUser: async () => ({ email: "expected@parads.local" }) } });
  await assert.rejects(attacker.execute({ action: "authorize", ticket: proof, username: "visitor" }, { token: "synthetic" }), { status: 403 });
  const expired = createAccessGateway({ db: env.db, auth: env.auth, secret, now: () => Date.now() + 16 * 60_000 });
  await assert.rejects(expired.execute({ action: "username", ticket: proof, username: "visitor" }), { status: 403 });
  await env.db.doc(`pre_registered_users/${phone}`).update({ accessCodeHash: "0".repeat(64) });
  await assert.rejects(gateway.execute({ action: "username", ticket: proof, username: "visitor" }), { status: 403 });
});

test("the code attempt limit is shared by separate gateway instances", async () => {
  const phone = "5561000000009";
  await env.db.doc(`pre_registered_users/${phone}`).set({ phone, enabled: true, claimed: false, role: "member", accessCodeHash: codeHash, accessCodeSalt: codeSalt });
  const first = createAccessGateway({ db: env.db, auth: env.auth, secret });
  const second = createAccessGateway({ db: env.db, auth: env.auth, secret });
  for (let index = 0; index < 10; index++) {
    await assert.rejects((index % 2 ? first : second).execute({ action: "verify", phone, code: "999999" }), { status: 403 });
  }
  await assert.rejects(second.execute({ action: "verify", phone, code }), { status: 429 });
  const member = env.rulesEnv.authenticatedContext("fixture-member").firestore();
  await assertFails(getDoc(doc(member, "request_limits/access_gateway")));
});
