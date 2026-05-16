import { useMemo, useState } from "react";
import { Lock, X } from "lucide-react";

import { achievementsCatalog } from "../../data/achievementsCatalog";

const achievementImages = import.meta.glob(
  "../../assets/achievements/*.{png,jpg,jpeg,webp}",
  {
    eager: true,
    import: "default",
  },
);

function getImageById(imageId) {
  const entry = Object.entries(achievementImages).find(([path]) =>
    path.includes(`${imageId}.`),
  );

  return entry?.[1] || "";
}

function getUserAchievement(userAchievements, achievementId) {
  return userAchievements.find((item) => item.id === achievementId);
}

function getAchievementLevel(achievement, userAchievement) {
  const level = userAchievement?.level || 1;

  return (
    achievement.levels.find((item) => item.level === level) ||
    achievement.levels[0]
  );
}

function getRarityLabel(rarity) {
  const labels = {
    common: "Comum",
    uncommon: "Incomum",
    rare: "Rara",
    epic: "Épica",
    legendary: "Lendária",
    mythic: "Mítica",
  };

  return labels[rarity] || rarity;
}

export default function ProfileAchievements({ inventory }) {
  const [selectedAchievement, setSelectedAchievement] = useState(null);

  const userAchievements = inventory?.achievements || [];

  const achievements = useMemo(() => {
    return achievementsCatalog.map((achievement) => {
      const userAchievement = getUserAchievement(userAchievements, achievement.id);
      const unlocked = Boolean(userAchievement);
      const currentLevel = getAchievementLevel(achievement, userAchievement);

      return {
        ...achievement,
        unlocked,
        userAchievement,
        currentLevel,
      };
    });
  }, [userAchievements]);

  return (
    <>
      <section className="rounded-[2rem] border border-white/10 bg-[#17231f]/75 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#fffaf0]">
              Conquistas
            </h2>

            <p className="mt-1 text-xs font-semibold text-app-muted">
              Medalhas e troféus desbloqueados no perfil
            </p>
          </div>

          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-app-primary">
            {userAchievements.length}/{achievementsCatalog.length}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2.5">
          {achievements.map((achievement) => {
            const imageUrl = getImageById(achievement.currentLevel.imageId);

            return (
              <button
                key={achievement.id}
                type="button"
                onClick={() => setSelectedAchievement(achievement)}
                className="group flex aspect-square items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] transition active:scale-95"
              >
                <div className="relative flex h-full w-full items-center justify-center">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={achievement.currentLevel.name}
                      className={`
                        h-full w-full object-contain transition
                        ${achievement.unlocked ? "" : "grayscale opacity-35"}
                      `}
                    />
                  )}

                  {!achievement.unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20">
                      <Lock size={15} className="text-white/80" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selectedAchievement && (
        <AchievementModal
          achievement={selectedAchievement}
          onClose={() => setSelectedAchievement(null)}
        />
      )}
    </>
  );
}

function AchievementModal({ achievement, onClose }) {
  const { currentLevel, unlocked } = achievement;

  const imageUrl = getImageById(currentLevel.imageId);

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 px-5 pb-5 backdrop-blur-sm">
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#13201c]/95 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-app-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-orange-500/10 blur-3xl" />

        <div className="relative mb-4 flex items-center justify-between">
          <span className="rounded-full border border-app-primary/20 bg-app-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-app-primary">
            {getRarityLabel(achievement.rarity)}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative rounded-[1.7rem] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.035] to-black/20 p-4 shadow-inner">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div className="absolute inset-2 rounded-full bg-app-primary/10 blur-2xl" />

              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={currentLevel.name}
                  className={`
                    relative h-full w-full object-contain drop-shadow-[0_0_28px_rgba(255,183,3,0.25)]
                    ${unlocked ? "" : "grayscale opacity-40"}
                  `}
                />
              )}

              {!unlocked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
                  <Lock size={26} className="text-white/90" />
                </div>
              )}
            </div>

            <div className="w-full text-center">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-app-muted">
                Conquista
              </p>

              <h2 className="text-xl font-black leading-tight text-[#fffaf0]">
                {currentLevel.name}
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-app-muted">
                {currentLevel.description || achievement.description}
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
          <p className="text-xs font-bold text-white/60">
            {unlocked
              ? "Essa conquista faz parte da sua coleção."
              : "Você ainda não desbloqueou essa conquista."}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left">
      <p className="text-[10px] font-bold uppercase tracking-wide text-app-muted">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-black text-white">
        {value}
      </p>
    </div>
  );
}