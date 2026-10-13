import { deleteApp, getApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword, deleteUser, initializeAuth,
  inMemoryPersistence, signInWithEmailAndPassword, signOut, updatePassword,
} from "firebase/auth";
import { generateAccessCodeSalt, pendingGuestPassword } from "./accessCodeService";

async function withIsolatedAuth(operation) {
  const app = initializeApp(getApp().options, `guest-${generateAccessCodeSalt()}`);
  const isolatedAuth = initializeAuth(app, { persistence: inMemoryPersistence });
  try {
    return await operation(isolatedAuth);
  } finally {
    await signOut(isolatedAuth).catch(() => {});
    await deleteApp(app);
  }
}

// A separate Auth instance keeps the administrator's session intact.
export function provisionGuestAccount({ email, code, save }) {
  return withIsolatedAuth(async (isolatedAuth) => {
    const credential = await createUserWithEmailAndPassword(isolatedAuth, email, pendingGuestPassword(code));
    try {
      return await save(credential.user.uid);
    } catch (error) {
      await deleteUser(credential.user).catch(() => {});
      throw error;
    }
  });
}

export function replacePendingGuestCode({ email, oldCode, newCode, save }) {
  return withIsolatedAuth(async (isolatedAuth) => {
    const credential = await signInWithEmailAndPassword(isolatedAuth, email, pendingGuestPassword(oldCode));
    await updatePassword(credential.user, pendingGuestPassword(newCode));
    try {
      return await save();
    } catch (error) {
      await updatePassword(credential.user, pendingGuestPassword(oldCode)).catch(() => {});
      throw error;
    }
  });
}
