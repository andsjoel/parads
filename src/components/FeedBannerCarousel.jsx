import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Pause, Play } from "lucide-react";
import feedBanner from "../assets/app-backgrounds/bg-banner-feed.png";
import eventBanner from "../assets/app-backgrounds/bg-banner-event-1.png";

const duration = 7000;
const slides = [
  { id: "construction", image: feedBanner, label: "App em construção" },
  { id: "missions", image: eventBanner, label: "Missões especiais" },
];

export default function FeedBannerCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState(null);
  const [manualPause, setManualPause] = useState(false);
  const [focusPause, setFocusPause] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const elapsedRef = useRef(0);
  const paused = manualPause || focusPause || hidden;

  useEffect(() => {
    const onVisibilityChange = () => setHidden(document.hidden);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => setReducedMotion(preference.matches);
    document.addEventListener("visibilitychange", onVisibilityChange);
    preference.addEventListener("change", onMotionChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      preference.removeEventListener("change", onMotionChange);
    };
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const startedAt = performance.now();
    let finished = false;
    const timer = window.setTimeout(() => {
      finished = true;
      elapsedRef.current = 0;
      setPreviousIndex(reducedMotion ? null : activeIndex);
      setActiveIndex((activeIndex + 1) % slides.length);
    }, Math.max(0, duration - elapsedRef.current));
    return () => {
      window.clearTimeout(timer);
      if (!finished) elapsedRef.current = Math.min(duration, elapsedRef.current + performance.now() - startedAt);
    };
  }, [activeIndex, paused, reducedMotion]);

  useEffect(() => {
    if (previousIndex === null) return undefined;
    const timer = window.setTimeout(() => setPreviousIndex(null), 520);
    return () => window.clearTimeout(timer);
  }, [previousIndex]);

  return (
    <section className="feed-banner-carousel" aria-label="Avisos do Parads" aria-roledescription="carrossel" onFocusCapture={(event) => setFocusPause(event.target.tagName !== "BUTTON")} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusPause(false); }}>
      <div className="feed-banner relative aspect-[3/1] w-full overflow-hidden">
        {slides.map((slide, index) => {
          const active = index === activeIndex;
          const outgoing = index === previousIndex;
          return (
            <div key={slide.id} role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${slides.length}: ${slide.label}`} aria-hidden={!active} className={`feed-banner-slide ${active ? "feed-banner-slide--active" : ""} ${outgoing ? "feed-banner-slide--outgoing" : ""} ${active && previousIndex !== null ? "feed-banner-slide--entering" : ""}`}>
              <img src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" />
              <div className="feed-banner-copy absolute inset-y-0 left-0 z-[1] flex w-[64%] flex-col justify-center px-4 py-2">
                {slide.id === "construction" ? (
                  <>
                    <h1 className="font-idv-title text-xl leading-none text-[#fffaf0]">App em construção</h1>
                    <p className="mt-1.5 text-[10px] font-bold leading-snug text-white/70">Podem surgir problemas e erros. Por favor, reportem.</p>
                  </>
                ) : (
                  <>
                    <h2 className="font-idv-title text-sm leading-tight text-[#fffaf0]">Complete desafios e desbloqueie recompensas.</h2>
                    <Link to="/profile" tabIndex={active ? 0 : -1} className="register-paper-action mt-1.5 inline-flex h-8 shrink-0 items-center justify-center gap-2 self-start px-3 text-xs text-[#210019]">
                      Ver missões <ArrowRight size={14} strokeWidth={2.5} />
                    </Link>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => setManualPause((current) => !current)} className="feed-carousel-toggle absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center text-white/85" aria-label={manualPause ? "Retomar carrossel" : "Pausar carrossel"} title={manualPause ? "Retomar carrossel" : "Pausar carrossel"}>
          {manualPause ? <Play size={13} /> : <Pause size={13} />}
        </button>
      </div>
      <div className="feed-carousel-timer" aria-hidden="true">
        <span key={activeIndex} className="feed-carousel-timer__fill" style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? "paused" : "running" }} />
      </div>
    </section>
  );
}
