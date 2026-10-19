export function memoryApiDb() {
  const documents = new Map();
  const counts = { reads: 0, writes: 0, transactions: 0 };
  let queue = Promise.resolve();
  let fail = false;
  const snapshot = (path) => ({ exists: documents.has(path), data: () => structuredClone(documents.get(path)) });
  const db = {
    collection: (name) => ({ doc: (id) => ({
      path: `${name}/${id}`, get: async () => { counts.reads += 1; return snapshot(`${name}/${id}`); },
    }) }),
    runTransaction(callback, options) {
      const next = queue.then(async () => {
        counts.transactions += 1;
        if (options?.maxAttempts !== 2) throw new Error("Test expected bounded transaction retries");
        if (fail) throw new Error("Synthetic database unavailable");
        const writes = [];
        const result = await callback({
          get: async (ref) => { counts.reads += 1; return snapshot(ref.path); },
          set: (ref, data) => writes.push(() => { counts.writes += 1; documents.set(ref.path, data); }),
        });
        writes.forEach((write) => write());
        return result;
      });
      queue = next.catch(() => {});
      return next;
    },
  };
  return { db, documents, counts, fail: (value) => { fail = value; } };
}

export async function invoke(handler, body, overrides = {}) {
  const headers = { "content-type": "application/json", authorization: "Bearer e30.e30.synthetic" };
  const req = { method: "POST", body, socket: { remoteAddress: "192.0.2.1" }, ...overrides,
    headers: { ...headers, ...overrides.headers } };
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = JSON.parse(value); } };
  await handler(req, res);
  return res;
}
