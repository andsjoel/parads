/* eslint-disable react/prop-types, react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { clearSessionData, preloadUserSession } from "../services/sessionDataService";
import {
  syncAllPublicProfilesOnce,
  syncOwnPublicProfile,
} from "../services/publicProfileService";

const AuthContext = createContext(null);

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function getUserSessionWithRetry(uid) {
  const delays = [0, 250, 500, 1000, 1500];

  for (const delay of delays) {
    if (delay) {
      await wait(delay);
    }

    const session = await preloadUserSession(uid);
    if (session) return session;
  }

  return null;
}

export function AuthProvider({ children }) {
  const [userAuth, setUserAuth] = useState(null);
  const [userData, setUserData] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const updateSessionData = useCallback((changes) => {
    setSessionData((current) => (current ? { ...current, ...changes } : current));
    if (changes.user) setUserData(changes.user);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setLoadingAuth(true);

        if (!firebaseUser) {
          clearSessionData();
          setUserAuth(null);
          setUserData(null);
          setSessionData(null);
          return;
        }

        let session = await getUserSessionWithRetry(firebaseUser.uid);

        if (!session) {
          console.warn("Usuário autenticado, mas sem registro no Firestore.");
          await signOut(auth);

          setUserAuth(null);
          setUserData(null);
          return;
        }

        const isLegacyAdmin = session.user.type === "admin" || session.user.role === "admin";
        if (isLegacyAdmin && (session.user.type !== "admin" || session.user.role !== "admin")) {
          await updateDoc(doc(db, "users", firebaseUser.uid), {
            type: "admin",
            role: "admin",
            updatedAt: serverTimestamp(),
          });
          session = {
            ...session,
            user: { ...session.user, type: "admin", role: "admin" },
          };
        }

        setUserAuth(firebaseUser);
        setUserData(session.user);
        setSessionData(session);

        syncOwnPublicProfile(session.user).catch((error) => {
          console.warn("Nao foi possivel sincronizar o perfil publico:", error);
        });

        const accountType = session.user.type || session.user.role;
        if (accountType === "admin" || session.user.role === "admin") {
          syncAllPublicProfilesOnce().catch((error) => {
            console.warn("Nao foi possivel atualizar os perfis publicos:", error);
          });
        }
      } catch (error) {
        console.error("Erro ao carregar usuário logado:", error);

        await signOut(auth);
        setUserAuth(null);
        setUserData(null);
        setSessionData(null);
      } finally {
        setLoadingAuth(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!userAuth?.uid) return undefined;

    return onSnapshot(
      doc(db, "user_stats", userAuth.uid),
      (statsSnap) => {
        if (!statsSnap.exists()) return;
        setSessionData((current) => current
          ? { ...current, stats: statsSnap.data() }
          : current);
      },
      (error) => {
        console.warn("Nao foi possivel acompanhar as estatisticas:", error);
      },
    );
  }, [userAuth?.uid]);

  const value = useMemo(() => {
    const accountType = userData?.type || userData?.role || "member";
    const role = userData?.role || "player";
    const isAdmin = accountType === "admin" || role === "admin";
    const isGuest = accountType === "guest" || role === "guest";

    return {
      userAuth,
      userData,
      sessionData,
      updateSessionData,
      loadingAuth,

      isAuthenticated: !!userAuth && !!userData,

      accountType,
      role,
      isAdmin,
      isMember: !isGuest,
      isGuest,
    };
  }, [userAuth, userData, sessionData, loadingAuth, updateSessionData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}
