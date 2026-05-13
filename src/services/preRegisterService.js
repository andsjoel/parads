import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const COLLECTION_NAME = "pre_registered_users";

export async function getPreRegisters() {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function createPreRegister({ fullName, phone, type }) {
  const phoneWithCountry = `55${phone}`;

  const payload = {
    fullName: fullName.trim(),
    phone: phoneWithCountry,
    type,
    enabled: true,
    claimed: false,
    userId: null,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTION_NAME, phoneWithCountry), payload);

  return {
    id: phoneWithCountry,
    ...payload,
  };
}

export async function deletePreRegister(id) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}