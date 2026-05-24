import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  User,
  ChevronRight,
  LayoutGrid,
  LogOut,
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
    <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-5">

      <div
        className="
        
          pointer-events-auto
          absolute
          inset-x-0
          bottom-[-40px]
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
            from-[#101716]/95
            via-[#101716]/45
            to-transparent
          "
        />
      </div>
      <nav
  className="
    pointer-events-auto
    flex items-center gap-1.5
    rounded-full
    border border-white/12
    bg-[#17231f]/75
    px-2 py-1.5
    shadow-[0_14px_40px_rgba(0,0,0,0.32)]
    backdrop-blur-3xl
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
                  flex h-11 w-11 items-center justify-center rounded-full
                  transition-all duration-300 active:scale-95
                  ${
                    isActive
                      ? "bg-app-primary text-[#1b1300] shadow-[0_0_22px_rgba(255,183,3,0.38)]"
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
            ${isExpanded ? "w-[92px] opacity-100" : "w-0 opacity-0"}
          `}
        >
          <NavLink
            to="/admin"
            onClick={() => {
              setIsExpanded(true);
              rotateBackground();
            }}
            className={({ isActive }) =>
              `
                flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                transition-all duration-300 active:scale-95
                ${
                  isActive
                    ? "bg-app-primary text-[#1b1300] shadow-[0_0_22px_rgba(255,183,3,0.38)]"
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
        <div className="pointer-events-auto fixed inset-0 z-[90] flex items-end justify-center bg-black/60 px-5 pb-5 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[1.8rem] border border-white/10 bg-[#13201c]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-white">Sair do app?</h2>
                <p className="mt-1 text-sm text-app-muted">
                  Você vai precisar entrar novamente para acessar sua conta.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-stone-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="h-12 rounded-full border border-white/10 bg-white/[0.06] text-sm font-black text-white active:scale-[0.98]"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="h-12 rounded-full bg-app-danger text-sm font-black text-white shadow-[0_10px_30px_rgba(251,113,133,0.24)] active:scale-[0.98] disabled:opacity-50"
              >
                {isLoggingOut ? "Saindo..." : "Sair"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
