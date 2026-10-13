import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function getAdminServices() {
  let app = getApps().find((candidate) => candidate.name === "password-recovery");
  if (!app) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) {
      const error = new Error("A recuperação de senha ainda não foi configurada no servidor.");
      error.status = 503;
      throw error;
    }
    if (projectId !== "parads-app-26f23") {
      const error = new Error("A credencial do servidor pertence a outro projeto Firebase.");
      error.status = 503;
      throw error;
    }
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, "password-recovery");
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}
import process from "node:process";
