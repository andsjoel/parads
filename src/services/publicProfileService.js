import { doc, getDoc } from "firebase/firestore";

import { db } from "../firebase/firebase";

export async function getPublicProfileBundle(userId) {
  const userRef = doc(db, "users", userId);
  const inventoryRef = doc(db, "user_inventory", userId);
  const statsRef = doc(db, "user_stats", userId);

  const [userSnap, inventorySnap, statsSnap] = await Promise.all([
    getDoc(userRef),
    getDoc(inventoryRef),
    getDoc(statsRef),
  ]);

  if (!userSnap.exists()) return null;

  return {
    user: {
      id: userSnap.id,
      ...userSnap.data(),
    },
    inventory: inventorySnap.exists() ? inventorySnap.data() : null,
    stats: statsSnap.exists() ? statsSnap.data() : null,
  };
}

export async function getPublicProfileBundles(userIds) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const bundles = await Promise.all(uniqueUserIds.map(getPublicProfileBundle));

  return bundles.reduce((profilesById, bundle) => {
    if (!bundle?.user?.id) return profilesById;

    return {
      ...profilesById,
      [bundle.user.id]: bundle,
    };
  }, {});
}
