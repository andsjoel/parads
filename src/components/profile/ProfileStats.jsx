/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CalendarDays, Check, Crown, Flame, Swords, Trophy, X } from "lucide-react";

import coinIcon from "../../assets/achievements/coin.png";
import {
  getClaimableMissions,
  getPendingSequenceRewards,
  getProfileStatValue,
  profileMissions,
} from "../../data/profileMissions";

const statsConfig = [
  { key: "matchesPlayed", label: "Partidas", icon: Swords },
  { key: "wins", label: "Vitórias", icon: Trophy },
  { key: "attendanceConfirmed", label: "Frequência", icon: CalendarDays },
  { key: "currentStreak", label: "Sequência", icon: Flame },
  { key: "bestStreak", label: "Recorde", icon: Crown },
];

export default function ProfileStats({ stats, missionsEnabled = false, isClaiming = false, onClaimRewards }) {
  const [selectedStat, setSelectedStat] = useState(null);
  const [showAllMissions, setShowAllMissions] = useState(false);
  const wrapperRef = useRef(null);
  const currentMissionRef = useRef(null);
  const claimedIds = useMemo(() => new Set(stats?.claimedMissionIds || []), [stats?.claimedMissionIds]);
  const claimable = useMemo(() => getClaimableMissions(stats), [stats]);
  const pendingSequenceRewards = useMemo(
    () => getPendingSequenceRewards(stats),
    [stats],
  );
  const pendingSequenceByThreshold = useMemo(
    () => new Map(pendingSequenceRewards.map((item) => [item.threshold, item])),
    [pendingSequenceRewards],
  );
  const claimableByCategory = useMemo(
    () => {
      const result = claimable.reduce((categories, item) => ({
        ...categories,
        [item.category]: (categories[item.category] || 0) + item.reward,
      }), {});
      const sequenceTotal = pendingSequenceRewards.reduce(
        (total, item) => total + item.totalReward,
        0,
      );
      if (sequenceTotal) result.currentStreak = sequenceTotal;
      return result;
    },
    [claimable, pendingSequenceRewards],
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (showAllMissions) return;
      if (!wrapperRef.current?.contains(event.target)) setSelectedStat(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showAllMissions]);

  useEffect(() => {
    if (!showAllMissions || !selectedStat || !currentMissionRef.current) return;
    currentMissionRef.current.scrollIntoView({ block: "center" });
  }, [selectedStat, showAllMissions]);

  useEffect(() => {
    if (!showAllMissions) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showAllMissions]);

  const selectedConfig = statsConfig.find((item) => item.key === selectedStat);
  const selectedMissions = selectedStat ? profileMissions[selectedStat] || [] : [];
  const selectedValue = selectedStat ? getProfileStatValue(stats, selectedStat) : 0;
  const pendingSequenceIndex = selectedStat === "currentStreak"
    ? selectedMissions.findIndex((item) => pendingSequenceByThreshold.has(item.threshold))
    : -1;
  const currentMissionIndex = pendingSequenceIndex >= 0
    ? pendingSequenceIndex
    : selectedMissions.findIndex((item) => selectedValue < item.threshold);
  const focusIndex = currentMissionIndex < 0 ? selectedMissions.length - 1 : currentMissionIndex;
  const totalReward =
    claimable.reduce((total, item) => total + item.reward, 0) +
    pendingSequenceRewards.reduce((total, item) => total + item.totalReward, 0);
  const compactStart = Math.max(
    0,
    Math.min(focusIndex - 1, selectedMissions.length - 3),
  );
  const compactMissions = selectedMissions.slice(compactStart, compactStart + 3);
  const completedCount = selectedMissions.filter((item) => {
    if (item.category === "currentStreak") {
      return (stats?.sequenceMilestoneHits?.[item.threshold] || 0) > 0;
    }
    return selectedValue >= item.threshold;
  }).length;

  function renderMissionRow(item, shouldFocus = false) {
    const pendingSequence = item.category === "currentStreak"
      ? pendingSequenceByThreshold.get(item.threshold)
      : null;
    const completed = selectedValue >= item.threshold || Boolean(pendingSequence);
    const claimed = item.category !== "currentStreak" && claimedIds.has(item.id);
    return (
      <div
        key={item.id}
        ref={shouldFocus ? currentMissionRef : null}
        className={`profile-mission-row ${completed ? "profile-mission-row--completed" : ""} ${claimed ? "profile-mission-row--claimed" : ""}`}
      >
        <span className="min-w-0 flex-1 text-xs font-bold leading-tight">{item.description}</span>
        {claimed ? (
          <Check size={17} strokeWidth={3} className="shrink-0 text-[#b8efc3]" />
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black">
            <img src={coinIcon} alt="" className="h-4 w-4 object-contain" />
            {pendingSequence ? pendingSequence.totalReward : item.reward}c
            {pendingSequence?.pendingCount > 1 && (
              <small className="text-[9px] text-white/45">x{pendingSequence.pendingCount}</small>
            )}
          </span>
        )}
      </div>
    );
  }

  return (
    <section ref={wrapperRef} className="profile-stats min-h-0 px-5 pb-1 pt-1">
      <div className="profile-stat-tabs relative z-[2] flex w-full gap-1 overflow-visible">
        {statsConfig.map((item) => {
          const Icon = item.icon;
          const value = getProfileStatValue(stats, item.key);
          const isSelected = selectedStat === item.key;
          const hasReward = missionsEnabled && Boolean(claimableByCategory[item.key]);

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedStat((current) => current === item.key ? null : item.key)}
              className={`profile-stat-item flex h-[62px] min-w-0 flex-col items-center justify-center px-2 py-1.5 text-center transition-all duration-300 active:scale-95 ${isSelected ? "profile-stat-item--selected profile-stat-item--connected flex-[1.9]" : "flex-1"}`}
            >
              {hasReward && <span className="profile-mission-alert" aria-label="Recompensa disponível">!</span>}
              <Icon size={16} className={isSelected ? "text-[#ff713f]" : "text-white/45"} />
              <strong className={`mt-1 font-semibold leading-none text-[#fffaf0] transition-all duration-300 ${isSelected ? "text-lg" : "text-xl"}`}>{value}</strong>
              <span className={`max-w-full overflow-hidden whitespace-nowrap text-[9px] font-normal uppercase text-white/35 transition-all duration-300 ${isSelected ? "mt-1 max-h-4 opacity-100" : "mt-0 max-h-0 opacity-0"}`}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {missionsEnabled && selectedConfig && (
        <div className="profile-mission-panel profile-mission-panel--connected mt-2 p-3 pt-2">
          <div className="space-y-1.5">
            {compactMissions.map((item) => renderMissionRow(item))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setShowAllMissions(true)} className="profile-mission-more h-10 px-3 text-xs font-black">
              ver mais
            </button>
            <button type="button" disabled={!totalReward || isClaiming} onClick={onClaimRewards} className="profile-mission-claim inline-flex h-10 items-center justify-center gap-2 px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-35">
              <AlertCircle size={16} />{isClaiming ? "resgatando..." : "resgatar"}
            </button>
          </div>
        </div>
      )}

      {missionsEnabled && showAllMissions && selectedConfig && createPortal((
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-5 py-6 backdrop-blur-sm">
          <div className="profile-mission-panel flex max-h-[80vh] w-full max-w-[420px] flex-col p-4">
            <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
              <div>
                <h3 className="font-idv-title text-2xl text-[#fffaf0]">{selectedConfig.label}</h3>
                <p className="text-xs font-semibold text-white/45">{completedCount} missões concluídas</p>
              </div>
              <button type="button" onClick={() => setShowAllMissions(false)} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center text-white" aria-label="Fechar missões">
                <X size={17} />
              </button>
            </div>

            <div className="profile-mission-list min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {selectedMissions.map((item, index) => renderMissionRow(item, index === focusIndex))}
            </div>

            <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
              {totalReward > 0 ? (
                <span className="inline-flex items-center gap-1 text-sm font-black text-[#b8efc3]">
                  <img src={coinIcon} alt="" className="h-5 w-5 object-contain" />{totalReward}c
                </span>
              ) : <span />}
              <button type="button" disabled={!totalReward || isClaiming} onClick={onClaimRewards} className="profile-mission-claim inline-flex h-10 items-center justify-center gap-2 px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-35">
                <AlertCircle size={16} />{isClaiming ? "resgatando..." : "resgatar"}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </section>
  );
}
