import { doc, getDoc } from "firebase/firestore";

import { db } from "../firebase/firebase";

let cachedSession = null;
let pendingSession = null;

export function preloadUserSession(uid) {
  if (!uid) return Promise.resolve(null);
  if (cachedSession?.uid === uid) return Promise.resolve(cachedSession);
  if (pendingSession?.uid === uid) return pendingSession.promise;

  const promise = getDoc(doc(db, "account_security", uid)).then(async (securitySnap) => {
    const security = securitySnap.exists() ? securitySnap.data() : null;
    if (security?.passwordChangeRequired) {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) return null;
      return { uid, user: { id: userSnap.id, ...userSnap.data() }, security, stats: null, inventory: null, showcase: null };
    }
    const [userSnap, statsSnap, inventorySnap, showcaseSnap] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDoc(doc(db, "user_stats", uid)),
      getDoc(doc(db, "user_inventory", uid)),
      getDoc(doc(db, "user_showcase", uid)),
    ]);
    if (!userSnap.exists()) return null;
    return {
      uid,
      security,
      user: { id: userSnap.id, ...userSnap.data() },
      stats: statsSnap.exists() ? statsSnap.data() : null,
      inventory: inventorySnap.exists() ? inventorySnap.data() : null,
      showcase: showcaseSnap.exists() ? showcaseSnap.data() : null,
    };
  }).then((session) => {
    cachedSession = session;
    pendingSession = null;
    return cachedSession;
  }).catch((error) => {
    pendingSession = null;
    throw error;
  });

  pendingSession = { uid, promise };
  return promise;
}

export function clearSessionData() {
  cachedSession = null;
  pendingSession = null;
}
