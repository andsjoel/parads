import {
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

export async function isUsernameAvailable(username) {
  const cleanUsername = username.trim().toLowerCase();
  const usernameRef = doc(db, "usernames", cleanUsername);
  const usernameSnap = await getDoc(usernameRef);

  return !usernameSnap.exists();
}

export async function deleteUserCascadeByPreRegister(preRegisterId) {
  const preRegisterRef = doc(db, "pre_registered_users", preRegisterId);
  const preRegisterSnap = await getDoc(preRegisterRef);

  if (!preRegisterSnap.exists()) {
    throw new Error("Convite não encontrado.");
  }

  const preRegister = preRegisterSnap.data();
  const uid = preRegister.userId;

  const batch = writeBatch(db);

  if (!uid) {
    batch.delete(preRegisterRef);
    await batch.commit();
    return;
  }

  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  const username = userSnap.exists()
    ? userSnap.data()?.username
    : null;

  batch.delete(preRegisterRef);
  batch.delete(userRef);
  batch.delete(doc(db, "user_stats", uid));
  batch.delete(doc(db, "user_inventory", uid));
  batch.delete(doc(db, "user_showcase", uid));

  if (username) {
    batch.delete(doc(db, "usernames", username));
  }

  await batch.commit();
}

export async function createUserBaseData({ uid, preRegister, username, authEmail }) {
  const cleanUsername = username.trim().toLowerCase();
  const type = preRegister.type || "member";
  const role = preRegister.role || "member";
  const sex = preRegister.sex || "male";
  const now = new Date();

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
    type,
    sex,
    
    role,

    profile: {
      displayName: preRegister.fullName,
      statusMessage: "",
      selectedBackgroundId: "bg-default-1",
      selectedProfilePicId: "pic-default-1",
      selectedProfilePicBorderId: null,
      selectedStatusIcon: "✦",
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
    backgrounds: ["bg-default-1", "bg-default-2", "bg-default-3"],
    profilePics: ["pic-default-1", "pic-default-2", "pic-default-3"],
    profilePicBorders: ["border-pic-default-1", "border-pic-default-2"],

    achievements: [
      {
        id: "member",
        level: 1,
        unlockedAt: now,
      },
    ],

    accessories: [],
    trophies: [],
    medals: [],
    titles: [],

    updatedAt: serverTimestamp(),
  });

  batch.set(showcaseRef, {
    primaryShelf: ["member"],
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
