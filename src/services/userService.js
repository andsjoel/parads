import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

export async function isUsernameAvailable(username) {
  const cleanUsername = username.trim().toLowerCase();
  const usernameRef = doc(db, "usernames", cleanUsername);
  const usernameSnap = await getDoc(usernameRef);

  return !usernameSnap.exists();
}

export async function createUserBaseData({ uid, preRegister, username, authEmail }) {
  const cleanUsername = username.trim().toLowerCase();

  const batch = writeBatch(db);

  const userRef = doc(db, "users", uid);
  const usernameRef = doc(db, "usernames", cleanUsername);
  const statsRef = doc(db, "user_stats", uid);
  const inventoryRef = doc(db, "user_inventory", uid);
  const showcaseRef = doc(db, "user_showcase", uid);
  const preRegisterRef = doc(db, "pre_registered_users", preRegister.id);

  batch.set(userRef, {
    phone: preRegister.phone,
    fullName: preRegister.fullName,
    username: cleanUsername,
    authEmail,
    type: preRegister.type,
    role: "player",

    profile: {
      statusMessage: "",
      selectedBackgroundId: "bg_default",
    },

    progression: {
      level: 1,
      xp: 0,
      coins: 0,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(usernameRef, {
    uid,
    username: cleanUsername,
    createdAt: serverTimestamp(),
  });

  batch.set(statsRef, {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    mvps: 0,
    attendanceConfirmed: 0,
    attendanceMissed: 0,
    currentStreak: 0,
    bestStreak: 0,
    updatedAt: serverTimestamp(),
  });

  batch.set(inventoryRef, {
    backgrounds: ["bg_default"],
    trophies: [],
    medals: [],
    titles: [],
    updatedAt: serverTimestamp(),
  });

  batch.set(showcaseRef, {
    primaryShelf: [],
    secondaryShelf: [],
    selectedTitleId: null,
    updatedAt: serverTimestamp(),
  });

  batch.update(preRegisterRef, {
    claimed: true,
    userId: uid,
    claimedAt: serverTimestamp(),
  });

  await batch.commit();
}