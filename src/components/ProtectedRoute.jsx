/* eslint-disable react/prop-types */
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import OrbitLoader from "./OrbitLoader";

export default function ProtectedRoute({ children }) {
  const { loadingAuth, isAuthenticated } = useAuth();

  if (loadingAuth) {
    return (
      <main
        className="
          flex min-h-screen items-center justify-center
          bg-[linear-gradient(220deg,#1d0312_0%,#2b1102_60%,#000000_100%)]
        "
      >
        <OrbitLoader />
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
