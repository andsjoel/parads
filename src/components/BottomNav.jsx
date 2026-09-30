import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  User,
  ChevronRight,
  LayoutGrid,
  LogOut,
  Store,
  X,
} from "lucide-react";
import { GiVolleyballBall } from "react-icons/gi";

import { logoutUser } from "../services/authServices";

const navItems = [
  {
    to: "/feed",
    icon: Home,
  },
  {
    to: "/matches",
    icon: GiVolleyballBall,
  },
  {
    to: "/profile",
    icon: User,
  },
];

export default function BottomNav() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navigate = useNavigate();

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await logoutUser();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  function rotateBackground() {
    const currentAngle =
      Number(
        getComputedStyle(document.documentElement)
          .getPropertyValue("--bg-angle")
          .replace("deg", ""),
      ) || 220;

    const nextAngle = currentAngle + 40;

    document.documentElement.style.setProperty(
      "--bg-angle",
      `${nextAngle}deg`,
    );
  }

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center">

      <div
        className="
        
          pointer-events-auto
          absolute
          inset-x-0
          bottom-0
          h-30
          overflow-hidden
        "
      >
        {/* Blur real */}
        <div
          className="
            absolute inset-0
            backdrop-blur-[22px]
            [mask-image:linear-gradient(to_top,black_35%,transparent_100%)]
            [-webkit-mask-image:linear-gradient(to_top,black_35%,transparent_100%)]
          "
        />

        {/* Gradiente de cor */}
        <div
          className="
            absolute inset-0

            bg-gradient-to-t
            from-[#18050a]/95
            via-[#18050a]/45
            to-transparent
          "
        />
      </div>
      <nav
  className="app-bottom-nav
    pointer-events-auto
    relative z-10
    flex w-full items-center justify-center gap-3
    px-5 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3
    shadow-[0_-10px_35px_rgba(0,0,0,0.25)]
    backdrop-blur-[22px]
    transition-all duration-300
  "
>
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                setIsExpanded(false);
                rotateBackground();
              }}
              className={({ isActive }) =>
                `
                  app-nav-item flex h-11 w-11 items-center justify-center
                  transition-all duration-300 active:scale-95
                  ${
                    isActive
                      ? "app-nav-item--active"
                      : "text-stone-300 hover:bg-white/[0.07] hover:text-white"
                  }
                `
              }
            >
              <Icon size={19} />
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="
            flex h-11 w-8 items-center justify-center rounded-full
            text-slate-400 transition-all duration-300
            hover:bg-white/[0.04] hover:text-white active:scale-95
          "
        >
          <ChevronRight
            size={18}
            className={`transition-transform duration-300 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        <div
          className={`
            flex overflow-hidden rounded-full transition-all duration-300
            ${isExpanded ? "w-[138px] opacity-100" : "w-0 opacity-0"}
          `}
        >
          <NavLink
            to="/shop"
            onClick={() => {
              setIsExpanded(true);
              rotateBackground();
            }}
            className={({ isActive }) => `app-nav-item flex h-11 w-11 shrink-0 items-center justify-center transition-all duration-300 active:scale-95 ${isActive ? "app-nav-item--active" : "text-stone-300 hover:bg-white/[0.07] hover:text-white"}`}
            aria-label="Loja"
          >
            <Store size={18} strokeWidth={2.3} />
          </NavLink>

          <NavLink
            to="/admin"
            onClick={() => {
              setIsExpanded(true);
              rotateBackground();
            }}
            className={({ isActive }) =>
              `
                app-nav-item flex h-11 w-11 shrink-0 items-center justify-center
                transition-all duration-300 active:scale-95
                ${
                    isActive
                    ? "app-nav-item--active"
                    : "text-stone-300 hover:bg-white/[0.07] hover:text-white"
                }
              `
            }
          >
            <LayoutGrid size={18} strokeWidth={2.3} />
          </NavLink>

          <button
            type="button"
            onClick={() => {
              setIsExpanded(false);
              setShowLogoutModal(true);
            }}
            className="
              flex h-11 w-11 shrink-0 items-center justify-center rounded-full
              text-app-danger transition-all duration-300
              hover:bg-app-danger/10 active:scale-95
            "
          >
            <LogOut size={18} strokeWidth={2.3} />
          </button>
        </div>
      </nav>
          
      {showLogoutModal && (
        <div className="pointer-events-auto fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-5 pb-5 backdrop-blur-sm">
          <div className="profile-edit-modal w-full max-w-[420px] p-5 text-white">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="admin-delete-icon flex h-11 w-11 shrink-0 items-center justify-center">
                  <LogOut size={20} />
                </div>
                <div>
                <h2 className="font-idv-title text-2xl">Sair do app?</h2>
                <p className="mt-1 text-sm text-app-muted">
                  Você vai precisar entrar novamente para acessar sua conta.
                </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center text-white/70 disabled:opacity-50"
                aria-label="Fechar"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="register-outline-action h-11 text-sm disabled:opacity-50"
              >
                cancelar
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="admin-delete-action flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <LogOut size={16} />
                {isLoggingOut ? "saindo..." : "sair"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
