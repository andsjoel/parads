import {
  doc,
  getDoc,
  runTransaction,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { INITIAL_COIN_BALANCE } from "../data/economy";
import { requestAccess } from "./accessGatewayService";
import { invalidatePublicProfileCache } from "../utils/publicProfileCache";

export async function isUsernameAvailable(username, ticket = null) {
  const cleanUsername = username.trim().toLowerCase();
  if (ticket) return (await requestAccess({ action: "username", username: cleanUsername, ticket })).available;
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

  batch.delete(doc(db, "invite_access_codes", preRegisterId));

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
  batch.delete(doc(db, "public_profiles", uid));

  if (username) {
    batch.delete(doc(db, "usernames", username));
  }

  await batch.commit();
  invalidatePublicProfileCache(uid);
}

export async function createUserBaseData({ uid, preRegister, username, authEmail }) {
  const cleanUsername = username.trim().toLowerCase();
  if (preRegister.pendingAuthEmail) {
    return activateGuestBaseData({ uid, preRegister, username: cleanUsername, authEmail });
  }
  const role = preRegister.role || preRegister.type || "member";
  const type = role;
  const sex = preRegister.sex || "male";
  const now = new Date();

  const batch = writeBatch(db);

  const userRef = doc(db, "users", uid);
  const usernameRef = doc(db, "usernames", cleanUsername);
  const statsRef = doc(db, "user_stats", uid);
  const inventoryRef = doc(db, "user_inventory", uid);
  const showcaseRef = doc(db, "user_showcase", uid);
  const publicProfileRef = doc(db, "public_profiles", uid);
  const preRegisterRef = doc(db, "pre_registered_users", preRegister.id);

  batch.set(userRef, {
    inviteId: preRegister.id,
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
      selectedBackgroundId: "bg-default",
      selectedProfilePicId: "pic-default",
      selectedProfilePicBorderId: null,
      selectedDisplayCardId: "display-card-orange",
      selectedStatusIcon: "✦",
    },

    progression: {
      level: 1,
      xp: 0,
      coins: INITIAL_COIN_BALANCE,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(publicProfileRef, {
    fullName: preRegister.fullName,
    username: cleanUsername,
    type,
    sex,
    role,
    profile: {
      displayName: preRegister.fullName,
      statusMessage: "",
      selectedBackgroundId: "bg-default",
      selectedProfilePicId: "pic-default",
      selectedProfilePicBorderId: null,
      selectedDisplayCardId: "display-card-orange",
      selectedStatusIcon: "âœ¦",
    },
    progression: { coins: INITIAL_COIN_BALANCE },
    updatedAt: serverTimestamp(),
  });

  batch.set(usernameRef, {
    uid,
    username: cleanUsername,
    authEmail,
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
    claimedMissionIds: [],
    sequenceMilestoneHits: {},
    claimedSequenceMilestoneHits: {},
    updatedAt: serverTimestamp(),
  });

  batch.set(inventoryRef, {
    backgrounds: [],
    profilePics: [],
    profilePicBorders: [],
    displayCards: [],

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

async function activateGuestBaseData({ uid, preRegister, username, authEmail }) {
  return runTransaction(db, async (transaction) => {
    const inviteRef = doc(db, "pre_registered_users", preRegister.id);
    const userRef = doc(db, "users", uid);
    const usernameRef = doc(db, "usernames", username);
    const [inviteSnap, userSnap, usernameSnap] = await Promise.all([
      transaction.get(inviteRef), transaction.get(userRef), transaction.get(usernameRef),
    ]);
    const invite = inviteSnap.data();
    if (!inviteSnap.exists() || !invite.enabled || invite.claimed
      || invite.userId !== uid || !userSnap.exists()) {
      throw new Error("Convite indisponível.");
    }
    if (usernameSnap.exists()) throw new Error("Esse usuário já está em uso.");
    const user = userSnap.data();
    const changes = { username, authEmail, inviteId: preRegister.id, firstAccessPending: false, updatedAt: serverTimestamp() };
    transaction.update(userRef, changes);
    transaction.set(doc(db, "public_profiles", uid), {
      fullName: user.fullName, username, profile: user.profile,
      role: user.role, type: user.type, sex: user.sex,
      progression: { coins: user.progression?.coins ?? INITIAL_COIN_BALANCE },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(usernameRef, { uid, username, authEmail, createdAt: serverTimestamp() });
    transaction.update(inviteRef, { claimed: true, userId: uid, claimedAt: serverTimestamp() });
  });
}
