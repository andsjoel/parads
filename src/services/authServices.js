import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { buildAuthEmail } from "../utils/authEmail";

export async function resolveLoginEmail(username) {
  const cleanUsername = username.trim().toLowerCase();
  const snapshot = await getDoc(doc(db, "usernames", cleanUsername));
  return snapshot.data()?.authEmail || buildAuthEmail(cleanUsername);
}

export async function logoutUser() {
  await signOut(auth);
}
