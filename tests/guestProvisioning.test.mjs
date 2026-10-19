import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

async function provider() {
  const calls = [];
  const source = await readFile(new URL('../src/services/guestAccountService.js', import.meta.url), 'utf8');
  const module = new SourceTextModule(source);
  const mocks = {
    'firebase/app': { getApp: () => ({ options: {} }), initializeApp: () => ({}), deleteApp: async () => calls.push('delete-app') },
    'firebase/auth': {
      initializeAuth: () => ({}), inMemoryPersistence: {},
      createUserWithEmailAndPassword: async () => ({ user: { uid: 'preserved-uid' } }),
      signOut: async () => calls.push('sign-out'), updatePassword: async () => {}, signInWithEmailAndPassword: async () => ({}),
    },
    './accessCodeService': { generateAccessCodeSalt: () => 'test-salt', pendingGuestPassword: (code) => `temporary-${code}` },
  };
  await module.link((name) => {
    const values = mocks[name];
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { api: module.namespace, calls };
}

test('lost guest-provision response reconciles the saved invitation and never deletes its Auth UID', async () => {
  const { api, calls } = await provider();
  const saved = { userId: 'preserved-uid', temporaryCode: '654321' };
  const result = await api.provisionGuestAccount({ email: 'synthetic@parads.local', code: '123456',
    save: async () => { throw new Error('Synthetic lost response'); },
    resolveSaved: async (uid) => { assert.equal(uid, saved.userId); return saved; } });
  assert.equal(result, saved);
  assert.deepEqual(calls, ['sign-out', 'delete-app']);
});

test('uncertain guest-provision failure leaves the identity intact instead of destructively guessing', async () => {
  const { api, calls } = await provider();
  await assert.rejects(api.provisionGuestAccount({ email: 'synthetic@parads.local', code: '123456',
    save: async () => { throw new Error('Synthetic offline'); }, resolveSaved: async () => { throw new Error('Still offline'); } }), /Synthetic offline/);
  assert.deepEqual(calls, ['sign-out', 'delete-app']);
});
