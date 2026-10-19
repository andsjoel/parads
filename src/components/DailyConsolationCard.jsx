/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowUpRight, Check, Gamepad2, HeartHandshake, Percent, TrendingDown, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { claimDailyConsolation } from "../services/dailyConsolationService";
import coinIcon from "../assets/achievements/coin.png";
import "../styles/dailyConsolation.css";

export default function DailyConsolationCard({ post, localPreview = false }) {
  const { userData, sessionData } = useAuth();
  const [open, setOpen] = useState(false);
  const [previewClaimed, setPreviewClaimed] = useState(false);
  const preview = import.meta.env?.DEV === true && localPreview;
  const award = post.payload?.recipients?.[userData?.id];
  if (!award) return null;
  const claimed = preview ? previewClaimed : Boolean(sessionData?.stats?.dailyConsolationClaims?.[post.payload.listId]);
  return (
    <article className="feed-report-card daily-consolation-card flex items-center gap-3 px-4 py-3">
      <div className="feed-report-icon flex h-8 w-8 shrink-0 items-center justify-center"><HeartHandshake size={20} /></div>
      <h2 className="min-w-0 flex-1 whitespace-nowrap text-base font-black">Dia ruim?</h2>
      <div className="daily-consolation-more relative shrink-0">
        <button type="button" onClick={() => setOpen(true)} className="admin-primary-action flex min-h-10 items-center justify-center gap-1 px-3 text-xs font-black">
          {claimed && <Check size={14} />}Ver mais<ArrowUpRight size={15} />
        </button>
        {!claimed && <span className="profile-mission-alert" aria-label="Recompensa disponível">!</span>}
      </div>
      {open && <ConsolationModal post={post} award={award} onClose={() => setOpen(false)} preview={preview} previewClaimed={previewClaimed} onPreviewClaim={() => setPreviewClaimed(true)} />}
    </article>
  );
}

function ConsolationModal({ post, award, onClose, preview, previewClaimed, onPreviewClaim }) {
  const { userData, sessionData, updateSessionData } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [redeemed, setRedeemed] = useState(false);
  const panel = useRef(null), inFlight = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const claimed = redeemed || (preview ? previewClaimed : Boolean(sessionData?.stats?.dailyConsolationClaims?.[post.payload.listId]));
  useEffect(() => {
    const focus = document.activeElement;
    const bodyStyle = document.body.style.cssText, htmlOverflow = document.documentElement.style.overflow;
    const scrollY = window.scrollY;
    Object.assign(document.body.style, { position: "fixed", top: `-${scrollY}px`, width: "100%", overflow: "hidden" });
    document.documentElement.style.overflow = "hidden";
    panel.current?.focus();
    const keydown = (event) => {
      if (event.key === "Escape" && !inFlight.current) close.current();
      if (event.key !== "Tab") return;
      const buttons = [...(panel.current?.querySelectorAll("button:not(:disabled)") || [])];
      const first = buttons[0], last = buttons.at(-1);
      if (!buttons.length || document.activeElement === panel.current || document.activeElement === (event.shiftKey ? first : last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.cssText = bodyStyle;
      document.documentElement.style.overflow = htmlOverflow;
      window.scrollTo(0, scrollY);
      document.removeEventListener("keydown", keydown);
      focus?.focus();
    };
  }, []);

  async function claim() {
    if (inFlight.current || claimed) return;
    if (preview) {
      setRedeemed(true);
      onPreviewClaim();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await claimDailyConsolation(post.payload.listId);
      updateSessionData({
        user: { ...userData, progression: { ...userData.progression, coins: result.coins } },
        stats: result.stats,
      });
      setRedeemed(true);
    } catch (failure) {
      setError(failure.message || "Não foi possível resgatar. Tente novamente.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return createPortal(
    <div className="daily-consolation-overlay" onClick={(event) => { if (event.target === event.currentTarget && !inFlight.current) onClose(); }}>
      <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="daily-consolation-title" className="profile-mission-panel daily-consolation-modal p-5 text-white outline-none">
        <header className="flex items-start justify-between gap-3">
          <h2 id="daily-consolation-title" className="font-idv-title text-2xl leading-tight">Políticas Sociais</h2>
          <button type="button" onClick={onClose} disabled={busy} className="profile-modal-close flex h-9 w-9 shrink-0 items-center justify-center" aria-label="Fechar recompensa"><X size={18} /></button>
        </header>
        <p className="my-5 text-sm leading-relaxed text-white/80">Por aqui tratamos quem perde quase igual quem ganha: como se fosse gente.</p>
        <p className="mb-2 text-right text-xs text-white/45">{post.payload.date?.split("-").reverse().join("/")}</p>
        <div className="grid grid-cols-3 gap-2">
          <Metric icon={Gamepad2} value={award.games} label="jogos" />
          <Metric icon={TrendingDown} value={award.losses} label="derrotas" />
          <Metric icon={Percent} value={`${(award.losses / award.games * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`} label="de derrotas" />
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        <div className="mt-5 flex items-stretch gap-3">
          <span className="daily-consolation-reward flex shrink-0 items-center justify-center gap-2 px-3 text-lg text-[#ffb071]"><img src={coinIcon} alt="Moedas" className="h-6 w-6" />{award.reward}c</span>
          <button type="button" onClick={claim} disabled={busy || claimed} className="profile-mission-claim flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 text-sm disabled:opacity-50">
            {claimed ? <Check size={17} /> : <AlertCircle size={17} />}
            {busy ? "resgatando..." : claimed ? "resgatada" : "resgatar"}
          </button>
        </div>
        {claimed && <p role="status" className="mt-3 text-center text-xs text-[#b8efc3]">Recompensa resgatada.</p>}
      </section>
    </div>, document.body,
  );
}

function Metric({ icon: Icon, value, label }) {
  return <div className="feed-report-metric daily-consolation-metric"><Icon size={16} /><strong>{value}</strong><span>{label}</span></div>;
}
