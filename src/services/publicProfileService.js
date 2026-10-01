import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

export async function getPublicProfileBundle(userId) {
  const userRef = doc(db, "public_profiles", userId);
  const inventoryRef = doc(db, "user_inventory", userId);
  const statsRef = doc(db, "user_stats", userId);

  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return null;

  const [inventoryResult, statsResult] = await Promise.allSettled([
    getDoc(inventoryRef),
    getDoc(statsRef),
  ]);
  const inventorySnap = inventoryResult.status === "fulfilled"
    ? inventoryResult.value
    : null;
  const statsSnap = statsResult.status === "fulfilled"
    ? statsResult.value
    : null;

  return {
    user: {
      id: userSnap.id,
      ...userSnap.data(),
    },
    inventory: inventorySnap?.exists() ? inventorySnap.data() : null,
    stats: statsSnap?.exists() ? statsSnap.data() : null,
  };
}

export async function getPublicProfileBundles(userIds) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const results = await Promise.allSettled(
    uniqueUserIds.map(getPublicProfileBundle),
  );

  return results.reduce((profilesById, result) => {
    if (result.status !== "fulfilled") {
      console.warn("Nao foi possivel carregar um perfil publico:", result.reason);
      return profilesById;
    }

    const bundle = result.value;
    if (!bundle?.user?.id) return profilesById;

    return {
      ...profilesById,
      [bundle.user.id]: bundle,
    };
  }, {});
}

function getPublicUserPayload(user) {
  return {
    fullName: user.fullName || "Jogador",
    username: user.username || "",
    type: user.type || "member",
    role: user.role || "member",
    sex: user.sex || "male",
    profile: user.profile || {},
    progression: {
      coins: user.progression?.coins || 0,
    },
    updatedAt: serverTimestamp(),
  };
}

export async function syncOwnPublicProfile(user) {
  if (!user?.id) return;

  await setDoc(
    doc(db, "public_profiles", user.id),
    getPublicUserPayload(user),
    { merge: true },
  );
}

export async function syncAllPublicProfiles() {
  const usersSnap = await getDocs(collection(db, "users"));
  const users = usersSnap.docs;

  for (let index = 0; index < users.length; index += 400) {
    const batch = writeBatch(db);

    users.slice(index, index + 400).forEach((userSnap) => {
      batch.set(
        doc(db, "public_profiles", userSnap.id),
        getPublicUserPayload(userSnap.data()),
        { merge: true },
      );
    });

    await batch.commit();
  }
}

let publicProfilesSyncPromise = null;

export function syncAllPublicProfilesOnce() {
  if (!publicProfilesSyncPromise) {
    publicProfilesSyncPromise = syncAllPublicProfiles().catch((error) => {
      publicProfilesSyncPromise = null;
      throw error;
    });
  }

  return publicProfilesSyncPromise;
}
