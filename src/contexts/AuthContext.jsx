/* eslint-disable react/prop-types, react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { clearSessionData, preloadUserSession } from "../services/sessionDataService";

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

        const session = await getUserSessionWithRetry(firebaseUser.uid);

        if (!session) {
          console.warn("Usuário autenticado, mas sem registro no Firestore.");
          await signOut(auth);

          setUserAuth(null);
          setUserData(null);
          return;
        }

        setUserAuth(firebaseUser);
        setUserData(session.user);
        setSessionData(session);
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

  const value = useMemo(() => {
    const accountType = userData?.type || userData?.role || "member";
    const role = userData?.role || "player";
    const isAdmin = accountType === "admin" || role === "admin";
    const isGuest = accountType === "guest" || role === "guest";

    return {
      userAuth,
      userData,
      sessionData,
      loadingAuth,

      isAuthenticated: !!userAuth && !!userData,

      accountType,
      role,
      isAdmin,
      isMember: !isGuest,
      isGuest,
    };
  }, [userAuth, userData, sessionData, loadingAuth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}
