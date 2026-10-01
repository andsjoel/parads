import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase/firebase";

export async function updateUserProfile(uid, profile) {
  const userRef = doc(db, "users", uid);
  const publicProfileRef = doc(db, "public_profiles", uid);
  const batch = writeBatch(db);

  batch.update(userRef, {
    profile,
    updatedAt: serverTimestamp(),
  });

  batch.set(publicProfileRef, {
    profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await batch.commit();
}
