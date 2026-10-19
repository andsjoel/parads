import { createHmac } from "node:crypto";
import { ApiError } from "./apiProtection.js";

export function createSharedRequestLimiter({ db, key, namespace, minuteLimit, dayLimit, ipLimit, subjectLimit = 10, subjectWindow = 600000, now = Date.now }) {
  const opaque = (value) => createHmac("sha256", key).update(value).digest("hex");
  const blocked = new Map();
  return async (ip, subject = null) => {
    const time = now();
    const keys = [[opaque(`ip:${ip}`), ipLimit, 60000]];
    if (subject) keys.push([opaque(subject), subjectLimit, subjectWindow]);
    for (const [id, until] of blocked) if (until <= time) blocked.delete(id);
    if (blocked.has("global") || keys.some(([id]) => blocked.has(id))) {
      throw new ApiError(429, "Muitas tentativas. Aguarde um pouco.", 60);
    }
    try {
      await db.runTransaction(async (tx) => {
        const ref = db.collection("request_limits").doc(namespace);
        const state = (await tx.get(ref)).data() || {};
        const minute = Math.floor(time / 60000);
        const day = Math.floor(time / 86400000);
        const minuteCount = state.minute === minute ? state.minuteCount || 0 : 0;
        const dayCount = state.day === day ? state.dayCount || 0 : 0;
        const entries = Object.fromEntries(Object.entries(state.entries || {}).filter(([, item]) => item.until > time));
        const denied = keys.find(([id, max]) => (entries[id]?.count || 0) >= max);
        const full = Object.keys(entries).length + keys.filter(([id]) => !entries[id]).length > 128;
        if (minuteCount >= minuteLimit || dayCount >= dayLimit || full || denied) {
          const error = new ApiError(429, "Muitas tentativas. Aguarde um pouco.", 60);
          error.bucket = denied?.[0] || "global";
          throw error;
        }
        for (const [id, , duration] of keys) entries[id] = {
          count: (entries[id]?.count || 0) + 1, until: entries[id]?.until || time + duration,
        };
        tx.set(ref, { minute, minuteCount: minuteCount + 1, day, dayCount: dayCount + 1, entries });
      }, { maxAttempts: 2 });
    } catch (error) {
      if (error instanceof ApiError) {
        if (blocked.size >= 128) blocked.delete(blocked.keys().next().value);
        // A blocked phone/IP must not pause unrelated players on this instance.
        blocked.set(error.bucket || "global", time + 2000);
        throw error;
      }
      throw new ApiError(503, "Serviço ocupado. Tente novamente em instantes.");
    }
  };
}
