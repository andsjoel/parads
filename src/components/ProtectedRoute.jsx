import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase/firebase";

export default function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth user:", user);

      setIsAuthenticated(!!user);
    });

    return unsubscribe;
  }, []);

  if (isAuthenticated === null) {
    return (
      <main
        className="
          flex min-h-screen items-center justify-center
          bg-[linear-gradient(220deg,#1d0312_0%,#2b1102_60%,#000000_100%)]
        "
      >
        <span
          className="
            h-6 w-6 animate-spin rounded-full
            border-2 border-white/10
            border-t-app-primary
            shadow-[0_0_18px_rgba(255,183,3,0.35)]
          "
        />
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}