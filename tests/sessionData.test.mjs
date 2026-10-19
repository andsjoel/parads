import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

async function harness() {
  let reads = 0;
  const gates = new Map();
  const api = new SourceTextModule(await readFile(new URL('../src/services/sessionDataService.js', import.meta.url), 'utf8'));
  await api.link((name) => {
    const values = name === 'firebase/firestore' ? {
      doc: (_db, collection, uid) => ({ collection, uid }),
      getDoc: async ({ collection, uid }) => {
        reads++;
        if (gates.has(uid)) await gates.get(uid);
        return { id: uid, exists: () => collection !== 'account_security', data: () => ({ uid, wins: 1 }) };
      },
    } : { db: {} };
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await api.evaluate();
  return { api: api.namespace, reads: () => reads, gates };
}

test('session bootstrap deduplicates and live changes update the cache without extra reads', async () => {
  const { api, reads } = await harness();
  const [first, second] = await Promise.all([api.preloadUserSession('member'), api.preloadUserSession('member')]);
  assert.equal(first, second);
  assert.equal(reads(), 5);
  api.updateCachedSession('other', { stats: { wins: 99 } });
  assert.equal((await api.preloadUserSession('member')).stats.wins, 1);
  api.updateCachedSession('member', { stats: { wins: 9 }, inventory: { backgrounds: ['owned'] } });
  assert.equal((await api.preloadUserSession('member')).stats.wins, 9);
  assert.equal(reads(), 5);
});

test('late bootstrap cannot restore a logged-out account or overwrite another UID', async () => {
  const { api, gates } = await harness();
  let release;
  gates.set('old', new Promise((resolve) => { release = resolve; }));
  const pending = api.preloadUserSession('old');
  api.clearSessionData();
  const current = await api.preloadUserSession('new');
  release();
  assert.equal(await pending, null);
  assert.equal((await api.preloadUserSession('new')), current);
});

test('auth bootstrap does not try to rewrite protected roles on legacy accounts', async () => {
  const auth = await readFile(new URL('../src/contexts/AuthContext.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(auth, /updateDoc|serverTimestamp|isLegacyAdmin/);
  assert.match(auth, /getUserSessionWithRetry\(firebaseUser.uid, current\)/);
});
