/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, Gift, Image, MessageCircle, Pencil, UserRound, X } from "lucide-react";
import coinIcon from "../../assets/achievements/coin.png";
import eventMascot from "../../assets/app-backgrounds/event-1.png";
import { getPromotionalMissionStates } from "../../data/promotionalMissions";

const icons = { profilePic: UserRound, background: Image, displayName: Pencil, status: MessageCircle };

export default function PromotionalMissions({ user, inventory, stats, collapsed, onExpand, onClaim, isClaiming }) {
  const missions = useMemo(() => getPromotionalMissionStates(user, inventory, stats), [user, inventory, stats]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const modalRef = useRef(null);
  const selected = missions.find((mission) => mission.id === selectedId);
  const hasReward = missions.some((mission) => mission.claimable);

  useEffect(() => {
    if (!selectedId) return undefined;
    const previousFocus = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    modalRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape" && !isClaiming) setSelectedId(null);
      if (event.key !== "Tab") return;
      const buttons = [...(modalRef.current?.querySelectorAll("button:not(:disabled)") || [])];
      const target = event.shiftKey ? buttons.at(-1) : buttons[0];
      if (document.activeElement === (event.shiftKey ? buttons[0] : buttons.at(-1)) || document.activeElement === modalRef.current || !buttons.length) {
        event.preventDefault();
        target?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [selectedId, isClaiming]);

  async function claim() {
    if (!selected?.claimable || isClaiming) return;
    setError("");
    try { await onClaim(selected.id); }
    catch (claimError) { setError(claimError.message || "Não foi possível resgatar a recompensa."); }
  }

  return (
    <section className={`profile-promotions profile-mission-panel mx-5 mb-4 shrink-0 ${collapsed ? "profile-promotions--collapsed" : ""}`} aria-label="Missões especiais">
      <div className="profile-promotions__header flex items-center justify-between gap-2 pl-4 pr-4">
        <img src={eventMascot} alt="" aria-hidden="true" className="profile-promotions__mascot" />
        <h2 className="flex min-w-0 items-center gap-2 text-sm text-[#fffaf0]">
          <Gift size={17} className="shrink-0 text-[#ff8b58]" />
          <span>Missões especiais</span>
        </h2>
        {collapsed ? (
          <button type="button" onClick={onExpand} className="relative flex h-8 items-center gap-1 px-2 text-xs text-[#ff9a61]" aria-expanded="false" aria-controls="promotional-mission-grid">
            ver {hasReward && <span className="profile-mission-alert" aria-label="Recompensa disponível">!</span>}
          </button>
        ) : null}
      </div>
      <div className="profile-promotions__body" aria-hidden={collapsed}>
        <div className="min-h-0 overflow-hidden">
          <div id="promotional-mission-grid" className="grid grid-cols-2 gap-2 px-3 pb-4 pt-2">
            {missions.map((mission) => {
              const Icon = icons[mission.kind];
              return (
                <button key={mission.id} type="button" tabIndex={collapsed ? -1 : 0} onClick={() => { setError(""); setSelectedId(mission.id); }} className={`profile-promotion-item relative flex min-h-[74px] min-w-0 flex-col items-start justify-center gap-2 px-3 py-2 text-left ${mission.claimed ? "profile-promotion-item--claimed" : ""}`} aria-label={`${mission.title}${mission.claimable ? ", recompensa disponível" : mission.claimed ? ", resgatada" : ""}`}>
                  {mission.claimable && <span className="profile-mission-alert" aria-label="Recompensa disponível">!</span>}
                  <span className="flex w-full items-center justify-between gap-2">
                    <Icon size={17} className="shrink-0 text-[#ff9a61]" />
                    {mission.claimed ? <Check size={16} className="text-[#b8efc3]" /> : <span className="inline-flex items-center gap-1 text-xs text-[#ffb071]"><img src={coinIcon} alt="" className="h-4 w-4" />{mission.reward}c</span>}
                  </span>
                  <span className="text-xs leading-tight text-[#fffaf0]">{mission.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {selected && createPortal(
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/75 px-5 py-6 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget && !isClaiming) setSelectedId(null); }}>
          <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="promotional-mission-title" className="profile-mission-panel max-h-[85dvh] w-full max-w-[420px] overflow-y-auto p-5 text-white outline-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-2 text-xs text-[#ff9a61]">Missão especial</p>
                <h3 id="promotional-mission-title" className="font-idv-title text-2xl">{selected.title}</h3>
              </div>
              <button type="button" disabled={isClaiming} onClick={() => setSelectedId(null)} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Fechar missão"><X size={17} /></button>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-white/75">{selected.description}</p>
            <div className="my-5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-lg text-[#ffb071]"><img src={coinIcon} alt="" className="h-6 w-6" />{selected.reward}c</span>
              <span role="status" className={`text-xs ${selected.completed ? "text-[#b8efc3]" : "text-white/45"}`}>{selected.claimed ? "Recompensa resgatada" : selected.completed ? "Concluída" : "Em andamento"}</span>
            </div>
            <p className="mb-4 text-xs text-white/45">Recompensa única por conta.</p>
            {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
            <button type="button" disabled={!selected.claimable || isClaiming} onClick={claim} className="profile-mission-claim flex h-11 w-full items-center justify-center gap-2 text-sm disabled:opacity-35">
              {selected.claimed ? <Check size={17} /> : <AlertCircle size={17} />}
              {isClaiming ? "resgatando..." : selected.claimed ? "resgatada" : "resgatar"}
            </button>
          </div>
        </div>, document.body,
      )}
    </section>
  );
}
