import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const COLLECTION_NAME = "volley_lists";

function buildParticipant(userData) {
  return {
    id: userData.id,
    name: userData.profile?.displayName || userData.fullName || userData.username,
    username: userData.username,
    role: userData.role || "member",
  };
}

function getGroupKey(group) {
  if (group === "setter") return "setters";
  if (group === "player") return "players";

  throw new Error("Grupo invalido.");
}

function removeParticipantFromGroups(list, userId) {
  return {
    setters: (list.setters || []).filter((person) => person.id !== userId),
    players: (list.players || []).filter((person) => person.id !== userId),
  };
}

function getParticipantGroup(list, userId) {
  if ((list.setters || []).some((person) => person.id === userId)) {
    return "setter";
  }

  if ((list.players || []).some((person) => person.id === userId)) {
    return "player";
  }

  return null;
}

export async function getActiveVolleyList() {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("status", "in", ["open", "in_progress"]),
    limit(1),
  );

  const snapshot = await getDocs(q);
  const activeList = snapshot.docs[0];

  if (!activeList) return null;

  return {
    id: activeList.id,
    ...activeList.data(),
  };
}

export async function createVolleyList({ date, adminUser }) {
  const activeList = await getActiveVolleyList();

  if (activeList) {
    throw new Error("Ja existe uma lista aberta.");
  }

  const listRef = doc(collection(db, COLLECTION_NAME));

  const payload = {
    title: "Lista do Volei",
    date,
    status: "open",
    settersLimit: 4,
    playersLimit: 26,
    setters: [],
    players: [],
    guests: [],
    createdBy: adminUser.id,
    createdByName:
      adminUser.profile?.displayName || adminUser.fullName || adminUser.username,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await runTransaction(db, async (transaction) => {
    transaction.set(listRef, payload);
  });

  return {
    id: listRef.id,
    ...payload,
  };
}

export async function joinVolleyList({ listId, group, userData }) {
  const listRef = doc(db, COLLECTION_NAME, listId);
  const groupKey = getGroupKey(group);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);

    if (!listSnap.exists()) {
      throw new Error("Lista nao encontrada.");
    }

    const list = listSnap.data();

    if (list.status !== "open") {
      throw new Error("A lista nao esta aberta.");
    }

    const currentUserGroup = getParticipantGroup(list, userData.id);

    if (currentUserGroup === group) {
      throw new Error("Voce ja esta nesse grupo.");
    }

    const nextGroups = removeParticipantFromGroups(list, userData.id);
    const currentGroup = nextGroups[groupKey] || [];
    const limitKey = group === "setter" ? "settersLimit" : "playersLimit";
    const groupLimit = list[limitKey] || 0;

    if (currentGroup.length >= groupLimit) {
      throw new Error("Esse grupo ja esta cheio.");
    }

    transaction.update(listRef, {
      ...nextGroups,
      [groupKey]: [...currentGroup, buildParticipant(userData)],
      updatedAt: serverTimestamp(),
    });
  });
}

export async function leaveVolleyList({ listId, userId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listRef);

    if (!listSnap.exists()) {
      throw new Error("Lista nao encontrada.");
    }

    const list = listSnap.data();
    const nextGroups = removeParticipantFromGroups(list, userId);

    transaction.update(listRef, {
      ...nextGroups,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function removeVolleyListParticipant({ listId, userId }) {
  return leaveVolleyList({ listId, userId });
}

export async function startVolleyMatch({ listId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await updateDoc(listRef, {
    status: "in_progress",
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function finishVolleyList({ listId }) {
  const listRef = doc(db, COLLECTION_NAME, listId);

  await updateDoc(listRef, {
    status: "closed",
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
