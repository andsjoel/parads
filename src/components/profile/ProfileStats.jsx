import { useEffect, useRef, useState } from "react";
import { Trophy, Swords, Flame, CalendarDays, Crown } from "lucide-react";

const statsConfig = [
  { key: "matchesPlayed", label: "Partidas", icon: Swords },
  { key: "wins", label: "Vitórias", icon: Trophy },
  { key: "attendanceConfirmed", label: "Frequência", icon: CalendarDays },
  { key: "currentStreak", label: "Sequência", icon: Flame },
  { key: "bestStreak", label: "Recorde", icon: Crown },
];

export default function ProfileStats({ stats }) {
  const [selectedStat, setSelectedStat] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        setSelectedStat(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  function handleSelectStat(key) {
    setSelectedStat((current) => (current === key ? null : key));
  }

  return (
    <section
      ref={wrapperRef}
      className="rounded-[2rem] border border-white/10 bg-[#17231f]/75 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl"
    >
      <div className="flex w-full gap-2 overflow-hidden">
        {statsConfig.map((item) => {
          const Icon = item.icon;
          const value = stats?.[item.key] ?? 0;
          const isSelected = selectedStat === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelectStat(item.key)}
              className={`
                flex h-[66px] min-w-0 flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center
                transition-all duration-300 active:scale-95
                ${
                  isSelected
                    ? "flex-[1.9] border-app-primary/40 bg-app-primary/12 shadow-[0_0_22px_rgba(255,183,3,0.16)]"
                    : "flex-1 border-white/10 bg-white/[0.04]"
                }
              `}
            >
              <Icon
                size={16}
                className={isSelected ? "text-app-primary" : "text-white/70"}
              />

              <strong
                className={`
                  mt-1 font-black leading-none text-[#fffaf0] transition-all duration-300
                  ${isSelected ? "text-lg" : "text-xl"}
                `}
              >
                {value}
              </strong>

              <span
                className={`
                  max-w-full overflow-hidden whitespace-nowrap text-[9px] font-bold uppercase tracking-wide text-app-muted
                  transition-all duration-300
                  ${
                    isSelected
                      ? "mt-1 max-h-4 opacity-100"
                      : "mt-0 max-h-0 opacity-0"
                  }
                `}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}