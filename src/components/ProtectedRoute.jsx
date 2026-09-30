/* eslint-disable react/prop-types */
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";

export default function ProtectedRoute({ children }) {
  const { loadingAuth, isAuthenticated } = useAuth();

  if (loadingAuth) {
    return (
      <main
        className="auth-loading-page flex min-h-screen items-center justify-center"
        style={{ backgroundImage: `url(${generalBackground})` }}
      >
        <span className="register-idv-loader" role="status" aria-label="Carregando">
          <span />
        </span>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
