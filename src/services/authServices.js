import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { requestAccess } from "./accessGatewayService";

export async function resolveLoginEmail(username) {
  const cleanUsername = username.trim().toLowerCase();
  const result = await requestAccess({ action: "login", username: cleanUsername });
  return result.authEmail;
}

export async function logoutUser() {
  await signOut(auth);
}
