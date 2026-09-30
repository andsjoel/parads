import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronRight, ClipboardList, Home, LayoutGrid, Store, User } from "lucide-react";
import { GiVolleyballBall } from "react-icons/gi";

const navItems = [
  { to: "/feed", icon: Home, label: "Inicio" },
  { to: "/list", icon: ClipboardList, label: "Lista" },
  { to: "/matches", icon: GiVolleyballBall, label: "Partidas" },
  { to: "/profile", icon: User, label: "Perfil" },
];

export default function BottomNav() {
  const [isExpanded, setIsExpanded] = useState(false);

  function rotateBackground() {
    const currentAngle = Number(getComputedStyle(document.documentElement)
      .getPropertyValue("--bg-angle").replace("deg", "")) || 220;
    document.documentElement.style.setProperty("--bg-angle", `${currentAngle + 40}deg`);
  }

  function handleNavigation(keepExpanded = false) {
    setIsExpanded(keepExpanded);
    rotateBackground();
  }

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center">
      <nav className="app-bottom-nav pointer-events-auto relative z-10 flex w-full items-center justify-center gap-2 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_35px_rgba(0,0,0,0.25)] backdrop-blur-[22px] transition-all duration-300">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={() => handleNavigation(false)} aria-label={label} className={({ isActive }) => `app-nav-item flex h-11 w-11 items-center justify-center transition-all duration-300 active:scale-95 ${isActive ? "app-nav-item--active" : "text-stone-300 hover:bg-white/[0.07] hover:text-white"}`}>
            <Icon size={19} />
          </NavLink>
        ))}

        <button type="button" onClick={() => setIsExpanded((current) => !current)} className="flex h-11 w-7 items-center justify-center text-slate-400 transition-all duration-300 hover:bg-white/[0.04] hover:text-white active:scale-95" aria-label="Mais opcoes">
          <ChevronRight size={18} className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
        </button>

        <div className={`flex overflow-hidden transition-all duration-300 ${isExpanded ? "w-[92px] opacity-100" : "w-0 opacity-0"}`}>
          <NavLink to="/shop" onClick={() => handleNavigation(true)} className={({ isActive }) => `app-nav-item flex h-11 w-11 shrink-0 items-center justify-center transition-all duration-300 active:scale-95 ${isActive ? "app-nav-item--active" : "text-stone-300 hover:bg-white/[0.07] hover:text-white"}`} aria-label="Loja">
            <Store size={18} strokeWidth={2.3} />
          </NavLink>
          <NavLink to="/menu" onClick={() => handleNavigation(true)} className={({ isActive }) => `app-nav-item flex h-11 w-11 shrink-0 items-center justify-center transition-all duration-300 active:scale-95 ${isActive ? "app-nav-item--active" : "text-stone-300 hover:bg-white/[0.07] hover:text-white"}`} aria-label="Menu">
            <LayoutGrid size={18} strokeWidth={2.3} />
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
