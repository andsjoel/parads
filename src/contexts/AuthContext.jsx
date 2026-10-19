/* eslint-disable react/prop-types, react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { clearSessionData, preloadUserSession, updateCachedSession } from "../services/sessionDataService";
import { syncOwnPublicProfile } from "../services/publicProfileService";
import { setPublicProfileCacheScope } from "../utils/publicProfileCache";

const AuthContext = createContext(null);

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function getUserSessionWithRetry(uid, isCurrent) {
  const delays = [0, 250, 500, 1000, 1500];

  for (const delay of delays) {
    if (delay) {
      await wait(delay);
    }
    if (!isCurrent()) return null;

    const session = await preloadUserSession(uid);
    if (!isCurrent()) return null;
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
    updateCachedSession(auth.currentUser?.uid, changes);
    setSessionData((current) => (current ? { ...current, ...changes } : current));
    if (changes.user) setUserData(changes.user);
  }, []);

  useEffect(() => {
    let generation = 0;
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const request = ++generation;
      const current = () => mounted && generation === request && auth.currentUser === firebaseUser;
      try {
        setLoadingAuth(true);
        setPublicProfileCacheScope(firebaseUser?.uid || null);

        if (!firebaseUser) {
          clearSessionData();
          setUserAuth(null);
          setUserData(null);
          setSessionData(null);
          return;
        }

        // First access establishes membership after Auth creates the identity.
        // Do not bootstrap or sign out that temporary session mid-registration.
        if (window.location.pathname.replace(/\/$/, "") === "/register") return;

        const session = await getUserSessionWithRetry(firebaseUser.uid, current);
        if (!current()) return;

        if (!session) {
          console.warn("Usuário autenticado, mas sem registro no Firestore.");
          setUserAuth(null);
          setUserData(null);
          setSessionData(null);
          await signOut(auth);
          return;
        }

        setUserAuth(firebaseUser);
        setUserData(session.user);
        setSessionData(session);

        if (session.security?.passwordChangeRequired) return;

        syncOwnPublicProfile(session.user).catch((error) => {
          console.warn("Nao foi possivel sincronizar o perfil publico:", error);
        });
      } catch (error) {
        if (!current()) return;
        console.error("Erro ao carregar usuário logado:", error);

        setUserAuth(null);
        setUserData(null);
        setSessionData(null);
        await signOut(auth);
      } finally {
        if (current()) setLoadingAuth(false);
      }
    });

    return () => { mounted = false; generation += 1; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userAuth?.uid) return undefined;
    return onSnapshot(doc(db, "account_security", userAuth.uid), async (snapshot) => {
      try {
        if (auth.currentUser !== userAuth) return;
        const security = snapshot.exists() ? snapshot.data() : null;
        updateCachedSession(userAuth.uid, { security });
        setSessionData((current) => current ? { ...current, security } : current);
        if (security?.invalidBefore) {
          const token = await userAuth.getIdTokenResult();
          if (auth.currentUser === userAuth && token.claims.auth_time <= security.invalidBefore) {
            await signOut(auth);
          }
        }
      } catch (error) {
        console.warn("Falha ao verificar a sessao da conta:", error);
      }
    }, (error) => console.warn("Não foi possível acompanhar a segurança da conta:", error));
  }, [userAuth]);

  useEffect(() => {
    if (!userAuth?.uid || sessionData?.security?.passwordChangeRequired) return undefined;

    return onSnapshot(
      doc(db, "user_stats", userAuth.uid),
      (statsSnap) => {
        if (!statsSnap.exists() || auth.currentUser?.uid !== userAuth.uid) return;
        updateCachedSession(userAuth.uid, { stats: statsSnap.data() });
        setSessionData((current) => current
          ? { ...current, stats: statsSnap.data() }
          : current);
      },
      (error) => {
        console.warn("Nao foi possivel acompanhar as estatisticas:", error);
      },
    );
  }, [userAuth?.uid, sessionData?.security?.passwordChangeRequired]);

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
      mustChangePassword: Boolean(sessionData?.security?.passwordChangeRequired),

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
