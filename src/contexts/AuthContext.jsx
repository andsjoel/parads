import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/firebase";

const AuthContext = createContext(null);

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
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
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
    const role = userData?.role || "member";

    return {
      userAuth,
      userData,
      loadingAuth,

      isAuthenticated: !!userAuth && !!userData,

      role,
      isAdmin: role === "admin",
      isMember: role === "member",
      isGuest: role === "guest",
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