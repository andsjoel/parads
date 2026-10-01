import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, LogOut, Settings, ShieldCheck, UserPlus, Users, Volleyball, X } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { logoutUser } from "../services/authServices";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";

const publicServices = [
  { title: "Atletas", description: "Lista da galera", icon: Users, to: "#", disabled: true, tone: "athletes" },
  { title: "Arena", description: "Informacoes da quadra", icon: Settings, to: "#", disabled: true, tone: "arena" },
];

const adminServices = [
  { title: "Convites", description: "Quem pode entrar pro time", icon: UserPlus, to: "/admin/pre-registers", tone: "invites" },
  { title: "Lista", description: "Presenca e confirmacoes", icon: ShieldCheck, to: "/admin/volley-list", tone: "list" },
  { title: "Partidas", description: "Chegada, times e resultados", icon: Volleyball, to: "/admin/matches", tone: "matches" },
  { title: "Relatórios", description: "Números e publicações", icon: BarChart3, to: "/admin/reports", tone: "reports" },
];

export default function Admin() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const services = isAdmin ? [...publicServices, ...adminServices] : publicServices;

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await logoutUser();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="admin-page min-h-screen px-5 pb-28 pt-6 text-white" style={{ backgroundImage: `url(${generalBackground})` }}>
      <section className="mx-auto w-full max-w-[420px]">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h1 className="font-idv-title text-3xl text-[#fffaf0]">menu</h1>
          <button type="button" onClick={() => setShowLogoutModal(true)} className="profile-modal-close flex h-11 w-11 items-center justify-center text-red-300" aria-label="Sair do app">
            <LogOut size={19} />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 px-2">
          {services.map((service) => {
            const Icon = service.icon;
            const card = (
              <div className={`group relative flex aspect-square flex-col justify-between overflow-hidden admin-service-card admin-service-card--${service.tone} border border-white/10 bg-[#18050a]/75 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition-all duration-300 active:scale-[0.98] ${service.disabled ? "opacity-45" : "hover:-translate-y-1 hover:border-app-primary/20"}`}>
                <div className="admin-service-icon relative z-10 flex h-12 w-12 items-center justify-center transition-all duration-300 group-hover:scale-105">
                  <Icon size={22} />
                </div>
                <div>
                  <h2 className="relative z-10 text-[15px] font-black text-[#fffaf0]">{service.title}</h2>
                  <p className="relative z-10 mt-1 text-xs leading-relaxed text-[#9aa89f]">{service.description}</p>
                </div>
              </div>
            );

            return service.disabled
              ? <div key={service.title}>{card}</div>
              : <Link key={service.title} to={service.to}>{card}</Link>;
          })}
        </div>
      </section>

      {showLogoutModal && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-5 pb-5 backdrop-blur-sm">
          <div className="profile-edit-modal w-full max-w-[420px] p-5 text-white">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="admin-delete-icon flex h-11 w-11 shrink-0 items-center justify-center"><LogOut size={20} /></div>
                <div>
                  <h2 className="font-idv-title text-2xl">Sair do app?</h2>
                  <p className="mt-1 text-sm text-app-muted">Voce vai precisar entrar novamente.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut} className="profile-modal-close flex h-9 w-9 items-center justify-center"><X size={17} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut} className="register-outline-action h-11 text-sm">cancelar</button>
              <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="admin-delete-action flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-50">
                <LogOut size={16} />{isLoggingOut ? "saindo..." : "sair"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
