/* eslint-disable react/prop-types, react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

const AuthContext = createContext(null);

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function getUserDocWithRetry(userRef) {
  const delays = [0, 250, 500, 1000, 1500];

  for (const delay of delays) {
    if (delay) {
      await wait(delay);
    }

    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap;
    }
  }

  return null;
}

export function AuthProvider({ children }) {
  const [userAuth, setUserAuth] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setLoadingAuth(true);

        if (!firebaseUser) {
          setUserAuth(null);
          setUserData(null);
          return;
        }

        const userRef = doc(db, "users", firebaseUser.uid);
        const userSnap = await getUserDocWithRetry(userRef);

        if (!userSnap) {
          console.warn("Usuário autenticado, mas sem registro no Firestore.");
          await signOut(auth);

          setUserAuth(null);
          setUserData(null);
          return;
        }

        setUserAuth(firebaseUser);
        setUserData({
          id: userSnap.id,
          ...userSnap.data(),
        });
      } catch (error) {
        console.error("Erro ao carregar usuário logado:", error);

        await signOut(auth);
        setUserAuth(null);
        setUserData(null);
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
      loadingAuth,

      isAuthenticated: !!userAuth && !!userData,

      accountType,
      role,
      isAdmin,
      isMember: !isGuest,
      isGuest,
    };
  }, [userAuth, userData, loadingAuth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}
