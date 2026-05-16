import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

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