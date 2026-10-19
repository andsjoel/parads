import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase/app';
import * as authSdk from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, getDoc, doc } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createEmulatorEnvironment } from '../support/emulator-environment.mjs';
import { frontendAccessFor } from '../support/frontend-access-module.mjs';
import { userServiceFor } from '../support/user-service-module.mjs';
import { TEST_PROJECT_ID } from '../support/isolation.mjs';
import { createAccessHandler } from '../../api/access-gateway.js';
import { pendingGuestPassword } from '../../src/services/accessCodeService.js';

const code = '123456';
const salt = 'synthetic-salt';
const hash = createHash('sha256').update(`${salt}:${code}`).digest('hex');
const secret = 'synthetic-front-to-api-integration-only-not-production';
let env, app, auth, db, api, actions, users;
before(async () => {
  env = await createEmulatorEnvironment();
  app = initializeApp({ projectId: TEST_PROJECT_ID, apiKey: 'fake-test-key' }, 'frontend-api');
  auth = authSdk.getAuth(app);
  authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:19099', { disableWarnings: true });
  db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 18080);
  const handler = createAccessHandler({ services: () => env, secret: () => secret, enabled: () => true, registrationEnabled: () => true });
  ({ api, actions } = await frontendAccessFor(handler, auth, authSdk));
  users = await userServiceFor(db, api.requestAccess);
});
after(async () => { if (app) await deleteApp(app); await env?.cleanup(); });

test('frontend lookup, code, username, Auth, authorization, data batch and ordinary login work together', async () => {
  const phone = '5561000000011';
  await env.db.doc(`pre_registered_users/${phone}`).set({ phone, fullName: 'Synthetic member', role: 'member', type: 'member', enabled: true, claimed: false, accessCodeSalt: salt, accessCodeHash: hash });
  const invite = await api.findFirstAccessInvite('61 00000-0011');
  await assert.rejects(api.validateFirstAccessCode(invite, '999999'), { status: 403 });
  const proof = await api.validateFirstAccessCode(invite, code);
  const registration = { ...invite, ...proof };
  assert.equal(await users.isUsernameAvailable('newmember', proof.ticket), true);
  const credential = await authSdk.createUserWithEmailAndPassword(auth, 'newmember@parads.local', '12345678');
  assert.equal((await api.authorizeFirstAccess(registration, 'newmember', credential.user)).completed, false);
  await users.createUserBaseData({ uid: credential.user.uid, preRegister: registration, username: 'newmember', authEmail: 'newmember@parads.local' });
  await api.logoutUser();
  const email = await api.resolveLoginEmail(' NEWMEMBER ');
  const logged = await authSdk.signInWithEmailAndPassword(auth, email, '12345678');
  assert.equal(logged.user.uid, credential.user.uid);
  assert.equal((await env.db.doc(`users/${logged.user.uid}`).get()).data().role, 'member');
  assert.ok(actions.includes('lookup') && actions.includes('verify') && actions.includes('username') && actions.includes('authorize') && actions.includes('login'));
});

test('guest activation keeps UID, purchases, balances and stats and supports chosen-password login after a lost response', async () => {
  await api.logoutUser();
  const uid = 'fixture-guest';
  const phone = '5561000000003';
  const email = 'guest.synthetic@parads.local';
  await env.auth.updateUser(uid, { email, password: pendingGuestPassword(code) });
  await env.db.doc(`pre_registered_users/${phone}`).update({ pendingAuthEmail: email, accessCodeSalt: salt, accessCodeHash: hash });
  await env.db.doc(`users/${uid}`).update({ authEmail: email, 'progression.coins': 73 });
  await env.db.doc(`user_inventory/${uid}`).update({ displayCards: ['owned-exclusive'] });
  const previousStats = (await env.db.doc(`user_stats/${uid}`).get()).data();
  const invite = await api.findFirstAccessInvite(phone);
  const registration = { ...invite, ...await api.validateFirstAccessCode(invite, code) };
  const credential = await authSdk.signInWithEmailAndPassword(auth, registration.pendingAuthEmail, pendingGuestPassword(code));
  await api.authorizeFirstAccess(registration, 'visiting', credential.user);
  await authSdk.updatePassword(credential.user, '87654321');
  await users.createUserBaseData({ uid, preRegister: registration, username: 'visiting', authEmail: email });
  // Ignore the completed registration response, then perform ordinary login.
  await api.logoutUser();
  const logged = await authSdk.signInWithEmailAndPassword(auth, await api.resolveLoginEmail('visiting'), '87654321');
  assert.equal(logged.user.uid, uid);
  assert.equal((await env.db.doc(`users/${uid}`).get()).data().progression.coins, 73);
  assert.deepEqual((await env.db.doc(`user_stats/${uid}`).get()).data(), previousStats);
  assert.deepEqual((await env.db.doc(`user_inventory/${uid}`).get()).data().displayCards, ['owned-exclusive']);
});

test('frontend can log in without a gateway flag while onboarding stays closed', async () => {
  const handler = createAccessHandler({ services: () => env, secret: () => secret });
  const { api: loginOnly } = await frontendAccessFor(handler, auth, authSdk);
  await loginOnly.logoutUser();
  const email = await loginOnly.resolveLoginEmail('newmember');
  const logged = await authSdk.signInWithEmailAndPassword(auth, email, '12345678');
  assert.ok(logged.user.uid);
  await assert.rejects(loginOnly.findFirstAccessInvite('61000000012'), { status: 503 });
});

test('new frontend works before and after the staged rules replacement without migrating an account', async () => {
  const oldRules = await readFile(new URL('../fixtures/pre-release.rules', import.meta.url), 'utf8');
  const candidate = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const config = { projectId: TEST_PROJECT_ID, firestore: { host: '127.0.0.1', port: 18080 } };
  const legacyEnv = await initializeTestEnvironment({ ...config, firestore: { ...config.firestore, rules: oldRules } });
  let restored;
  try {
    await api.logoutUser();
    const phone = '5561000000012';
    await env.db.doc(`pre_registered_users/${phone}`).set({ phone, fullName: 'Synthetic transition', role: 'member', type: 'member', enabled: true, claimed: false, accessCodeSalt: salt, accessCodeHash: hash });
    const invite = await api.findFirstAccessInvite(phone);
    const registration = { ...invite, ...await api.validateFirstAccessCode(invite, code) };
    const credential = await authSdk.createUserWithEmailAndPassword(auth, 'transition@parads.local', '12345678');
    await api.authorizeFirstAccess(registration, 'transition', credential.user);
    await users.createUserBaseData({ uid: credential.user.uid, preRegister: registration, username: 'transition', authEmail: 'transition@parads.local' });
    const before = (await getDoc(doc(db, 'users', credential.user.uid))).data();
    restored = await initializeTestEnvironment({ ...config, firestore: { ...config.firestore, rules: candidate } });
    assert.deepEqual((await getDoc(doc(db, 'users', credential.user.uid))).data(), before);
  } finally {
    if (!restored) restored = await initializeTestEnvironment({ ...config, firestore: { ...config.firestore, rules: candidate } });
    await legacyEnv.cleanup();
    await restored.cleanup();
  }
});
