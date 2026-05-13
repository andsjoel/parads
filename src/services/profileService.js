import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export async function updateUserProfile(uid, profile) {
  const userRef = doc(db, "users", uid);

  await updateDoc(userRef, {
    profile,
    updatedAt: serverTimestamp(),
  });
}