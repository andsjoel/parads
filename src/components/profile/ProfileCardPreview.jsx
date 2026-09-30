/* eslint-disable react/prop-types */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import ProfileHeader from "./ProfileHeader";
import ProfileStats from "./ProfileStats";
import { getProfileAssetUrls } from "../../utils/profileAssets";
import OrbitLoader from "../OrbitLoader";
import {
  DEFAULT_DISPLAY_CARD_ID,
  getDisplayCard,
} from "../../data/displayCardsCatalog";

function getDisplayName(person, bundle) {
  return (
    bundle?.user?.profile?.displayName ||
    bundle?.user?.fullName ||
    person.name ||
    person.username ||
    "Jogador"
  );
}

export function PlayerMiniCard({ person, profileBundle, onOpen, onRemove }) {
  const profile = profileBundle?.user?.profile || {};
  const { backgroundUrl, profilePicUrl, profilePicBorderUrl } =
    getProfileAssetUrls(profile, { staticPreview: true });
  const displayName = getDisplayName(person, profileBundle);

  return (
    <div className="profile-player-mini-card group relative h-11 min-w-0 flex-1 overflow-visible bg-transparent transition">
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt=""
          className="profile-player-mini-background absolute inset-0 h-full w-full rounded-2xl object-cover opacity-35"
        />
      )}

      <div className="profile-player-mini-name-shade absolute inset-0 rounded-2xl bg-gradient-to-r from-[#18050a] via-[#18050a]/82 to-transparent" />
      <div className="profile-player-mini-edge-shade absolute inset-0 rounded-2xl bg-gradient-to-l from-black/15 via-transparent to-black/20" />

      <button
        type="button"
        onClick={onOpen}
        className={`relative flex h-11 w-full min-w-0 items-center gap-3 overflow-visible px-2.5 text-left transition active:scale-[0.99] ${
          onRemove ? "pr-9" : ""
        }`}
      >
        <div className="relative z-10 h-11 w-11 shrink-0 overflow-visible">
          <img
            src={profilePicUrl}
            alt={displayName}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover ring-2 ring-white/10"
          />

          {profilePicBorderUrl && (
            <img
              src={profilePicBorderUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="pointer-events-none absolute inset-0 z-20 h-full w-full scale-[1.21] object-contain"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="profile-player-mini-name block truncate text-sm font-black leading-none text-[#fffaf0]">
            {displayName}
          </span>
        </div>
      </button>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-red-300/20 bg-black/30 text-red-200/85 backdrop-blur-md transition hover:bg-red-500/20 hover:text-red-100 active:scale-95"
        >
          <X size={13} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

export function ProfileStickerModal({
  profileBundle,
  fallbackPerson,
  isLoading,
  onClose,
}) {
  const user = profileBundle?.user;
  const profile = user?.profile || {};
  const { backgroundUrl } = getProfileAssetUrls(profile);
  const selectedCardId = profile.selectedDisplayCardId || DEFAULT_DISPLAY_CARD_ID;
  const canUseSelectedCard =
    selectedCardId === DEFAULT_DISPLAY_CARD_ID ||
    profileBundle?.inventory?.displayCards?.includes(selectedCardId);
  const displayCard = getDisplayCard(
    canUseSelectedCard ? selectedCardId : DEFAULT_DISPLAY_CARD_ID,
  );

  useEffect(() => {
    const scrollY = window.scrollY;
    const previousBody = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.position = previousBody.position;
      document.body.style.top = previousBody.top;
      document.body.style.width = previousBody.width;
      document.body.style.overflow = previousBody.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/75 px-4 pb-4 pt-8 backdrop-blur-sm">
      <article className={`profile-sticker-card profile-edit-modal ${displayCard.cardClassName} relative max-h-[92vh] w-full max-w-[430px] overflow-hidden p-3`}>
        {displayCard.hasShine && backgroundUrl && (
          <img
            src={backgroundUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-[0.3]"
          />
        )}

        <div className={`absolute inset-0 ${displayCard.hasShine ? "bg-gradient-to-b from-[#18050a]/35 via-[#18050a]/72 to-[#18050a]/96" : "bg-gradient-to-b from-[#8f2e10]/25 via-[#5b170c]/72 to-[#2c0908]/96"}`} />
        {displayCard.hasShine && (
          <div className="profile-sticker-shine pointer-events-none absolute -inset-y-10 left-0 w-[78%]" />
        )}
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#ff713f]/75 to-transparent" />

        {isLoading ? (
          <div className="relative flex h-[420px] flex-col items-center justify-center gap-3 text-app-primary">
            <OrbitLoader size={32} />
          </div>
        ) : user ? (
          <div className="relative max-h-[calc(92vh-1.5rem)] overflow-y-auto pr-1">
            <div className="overflow-hidden rounded-[1.9rem] border border-white/10 bg-white/[0.035] p-2 shadow-inner">
              <ProfileHeader user={user} readOnly onClose={onClose} />
            </div>

            <div className="mt-3">
              <ProfileStats stats={profileBundle.stats} />
            </div>

          </div>
        ) : (
          <div className="relative flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white"
            >
              <X size={18} />
            </button>

            <h2 className="text-xl font-black text-[#fffaf0]">
              {fallbackPerson?.name || "Jogador"}
            </h2>
            <p className="mt-2 text-sm font-semibold text-app-muted">
              Nao foi possivel carregar esse perfil agora.
            </p>
          </div>
        )}
      </article>
    </div>,
    document.body,
  );
}
