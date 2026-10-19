// Memory only: never persist account data or use cached values for authorization.
const entries = new Map();
let scope = null;

export function setPublicProfileCacheScope(userId) {
  if (scope === userId) return;
  scope = userId;
  entries.clear();
}

export function invalidatePublicProfileCache(userId) {
  entries.delete("directory");
  entries.delete("guide-admin");
  if (userId) {
    entries.delete(`bundle:${userId}`);
    entries.delete(`preview:${userId}`);
  }
}

export function rememberPublicProfile(key, load, { ttl = 30000, force = false } = {}) {
  const current = entries.get(key);
  if (current?.pending || (!force && current && current.expires > Date.now())) {
    return current.promise;
  }
  // Keep memory bounded even if a tab is left open for many days.
  if (entries.size >= 256) entries.delete(entries.keys().next().value);
  const entry = { pending: true, expires: 0 };
  entry.promise = Promise.resolve().then(load).then((value) => {
    if (entries.get(key) !== entry) return null;
    entry.pending = false;
    entry.expires = Date.now() + (value == null ? 3000 : ttl);
    return value;
  }, (error) => {
    if (entries.get(key) === entry) entries.delete(key);
    throw error;
  });
  entries.set(key, entry);
  return entry.promise;
}
