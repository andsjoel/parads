import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  documentId,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { rememberPublicProfile } from "../utils/publicProfileCache";

export function getPublicProfileBundle(userId, options) {
  if (!userId) return Promise.resolve(null);
  return rememberPublicProfile(`bundle:${userId}`, () => loadPublicProfileBundle(userId), options);
}

async function loadPublicProfileBundle(userId) {
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

  if (!inventorySnap?.exists() || !statsSnap?.exists()) return null;

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
    uniqueUserIds.map((id) => getPublicProfileBundle(id)),
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

export async function getPublicProfilePreviews(userIds) {
  const results = await Promise.allSettled([...new Set(userIds.filter(Boolean))].map((id) =>
    rememberPublicProfile(`preview:${id}`, async () => {
      const snapshot = await getDoc(doc(db, "public_profiles", id));
      return snapshot.exists() ? { user: { id: snapshot.id, ...snapshot.data() } } : null;
    }, { ttl: 60000 }),
  ));
  return Object.fromEntries(results.flatMap((result) =>
    result.status === "fulfilled" && result.value?.user?.id
      ? [[result.value.user.id, result.value]] : [],
  ));
}

export function getPublicProfileDirectory() {
  return rememberPublicProfile("directory", loadPublicProfileDirectory, { ttl: 30000 });
}

async function loadPublicProfileDirectory() {
  const profilesSnapshot = await getDocs(collection(db, "public_profiles"));
  const ids = profilesSnapshot.docs.map((item) => item.id);
  const activeUserIds = new Set();
  // Preserve orphan filtering without scanning inventories unrelated to the directory.
  for (let index = 0; index < ids.length; index += 30) {
    const snapshot = await getDocs(query(collection(db, "user_inventory"),
      where(documentId(), "in", ids.slice(index, index + 30))));
    snapshot.docs.forEach((item) => activeUserIds.add(item.id));
  }

  return profilesSnapshot.docs
    .filter((profileDoc) => activeUserIds.has(profileDoc.id))
    .map((profileDoc) => ({
      id: profileDoc.id,
      ...profileDoc.data(),
    }))
    .sort((first, second) => {
      const firstName = first.profile?.displayName || first.fullName || first.username || "";
      const secondName = second.profile?.displayName || second.fullName || second.username || "";
      return firstName.localeCompare(secondName, "pt-BR", { sensitivity: "base" });
    });
}

export function getGuideAdminProfile(selfBundle) {
  if (selfBundle?.inventory && selfBundle?.stats
    && (selfBundle.user?.role === "admin" || selfBundle.user?.type === "admin")) {
    return Promise.resolve(selfBundle);
  }
  return rememberPublicProfile("guide-admin", async () => {
    // The role query is normally sufficient; type also supports legacy accounts.
    for (const field of ["role", "type"]) {
      const snapshot = await getDocs(query(collection(db, "public_profiles"),
        where(field, "==", "admin"), limit(10)));
      for (const item of snapshot.docs) {
        const bundle = await getPublicProfileBundle(item.id);
        if (bundle) return bundle;
      }
    }
    return null;
  });
}

function getPublicUserPayload(user) {
  return {
    fullName: user.fullName || "Jogador",
    username: user.username || "",
    type: user.type || "member",
    role: user.role || user.type || "member",
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
