/* eslint-disable react/prop-types */
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
      className="profile-stats px-5 pb-4 pt-6"
    >
      <div className="flex w-full gap-2 overflow-visible">
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
                profile-stat-item flex h-[66px] min-w-0 flex-col items-center justify-center px-2 py-2 text-center
                transition-all duration-300 active:scale-95
                ${
                  isSelected
                    ? "profile-stat-item--selected flex-[1.9]"
                    : "flex-1"
                }
              `}
            >
              <Icon
                size={16}
                className={isSelected ? "text-[#5bc0ff]" : "text-white/45"}
              />

              <strong
                className={`
                  mt-1 font-semibold leading-none text-[#fffaf0] transition-all duration-300
                  ${isSelected ? "text-lg" : "text-xl"}
                `}
              >
                {value}
              </strong>

              <span
                className={`
                  max-w-full overflow-hidden whitespace-nowrap text-[9px] font-normal uppercase text-white/35
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
