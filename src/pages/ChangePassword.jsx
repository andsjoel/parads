import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { Check, Eye, EyeOff, KeyRound, LogOut } from "lucide-react";
import { auth } from "../firebase/firebase";
import { useAuth } from "../contexts/AuthContext";
import { completePasswordRecovery } from "../services/passwordRecoveryService";
import OrbitLoader from "../components/OrbitLoader";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";

export default function ChangePassword() {
  const { loadingAuth, isAuthenticated, mustChangePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (password.length !== 8 || password !== confirmation) {
      setError("Informe 8 números e confirme a mesma senha.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await completePasswordRecovery(password);
      await signOut(auth);
      navigate("/login", { replace: true, state: { passwordChanged: true } });
    } catch (changeError) {
      setError(changeError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingAuth && !saving) return <main className="flex min-h-screen items-center justify-center"><OrbitLoader /></main>;
  if (!isAuthenticated && !saving) return <Navigate to="/login" replace />;
  if (!mustChangePassword && !saving) return <Navigate to="/feed" replace />;

  return (
    <main className="admin-page flex min-h-[100dvh] items-center justify-center px-5 py-8 text-white" style={{ backgroundImage: `url(${generalBackground})` }}>
      <form onSubmit={submit} className="profile-edit-modal w-full max-w-[390px] p-6">
        <div className="feed-report-icon mb-4 flex h-12 w-12 items-center justify-center"><KeyRound size={24} /></div>
        <h1 className="font-idv-title text-3xl">Crie sua nova senha</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">Sua senha foi redefinida pelo admin. Escolha uma nova para continuar.</p>
        <div className="mt-6 space-y-4">
          {[{ label: "Nova senha", value: password, change: setPassword }, { label: "Confirmar senha", value: confirmation, change: setConfirmation }].map(({ label, value, change }) => (
            <label key={label} className="block text-xs text-white/55">
              {label}
              <div className="relative mt-2">
                <input type={visible ? "text" : "password"} inputMode="numeric" autoComplete="new-password" value={value} onChange={(event) => change(event.target.value.replace(/\D/g, "").slice(0, 8))} disabled={saving} maxLength={8} required placeholder="8 números" className="admin-input h-12 w-full px-4 pr-12 text-lg text-white outline-none" />
                <button type="button" onClick={() => setVisible((current) => !current)} className="absolute inset-y-0 right-2 flex w-9 items-center justify-center text-white/45" aria-label={visible ? "Ocultar senhas" : "Mostrar senhas"}>
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          ))}
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={saving || password.length !== 8 || confirmation.length !== 8} className="admin-primary-action mt-6 flex h-12 w-full items-center justify-center gap-2 text-sm disabled:opacity-40"><Check size={18} />{saving ? "Salvando..." : "Salvar nova senha"}</button>
        <button type="button" disabled={saving} onClick={() => signOut(auth)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 text-xs text-white/45"><LogOut size={15} /> sair da conta</button>
      </form>
    </main>
  );
}
