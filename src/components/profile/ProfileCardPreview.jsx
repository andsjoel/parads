/* eslint-disable react/prop-types */
import { Loader2, X } from "lucide-react";

import ProfileAchievements from "./ProfileAchievements";
import ProfileHeader from "./ProfileHeader";
import ProfileStats from "./ProfileStats";
import { getProfileAssetUrls } from "../../utils/profileAssets";

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
    getProfileAssetUrls(profile);
  const displayName = getDisplayName(person, profileBundle);

  return (
    <div className="group relative min-w-0 flex-1 overflow-visible rounded-2xl border border-white/10 bg-[#14211d] shadow-[0_10px_26px_rgba(0,0,0,0.18)] transition hover:border-app-primary/30">
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 h-full w-full rounded-2xl object-cover opacity-35"
        />
      )}

      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#14211d] via-[#14211d]/82 to-transparent" />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-l from-black/15 via-transparent to-black/20" />

      <button
        type="button"
        onClick={onOpen}
        className={`relative flex h-9 w-full min-w-0 items-center gap-3 px-2.5 text-left transition active:scale-[0.99] ${
          onRemove ? "pr-9" : ""
        }`}
      >
        <div className="relative h-11 w-11 shrink-0">
          <img
            src={profilePicUrl}
            alt={displayName}
            className="h-full w-full rounded-full object-cover ring-2 ring-white/10"
          />

          {profilePicBorderUrl && (
            <img
              src={profilePicBorderUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full scale-[1.38] object-contain"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black leading-none text-[#fffaf0]">
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

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/75 px-4 pb-4 pt-8 backdrop-blur-sm">
      <article className="profile-sticker-card relative max-h-[92vh] w-full max-w-[430px] overflow-hidden rounded-[2rem] border border-app-primary/25 bg-[#111c18]/92 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.58)]">
        {backgroundUrl && (
          <img
            src={backgroundUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-[0.34]"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-[#111c18]/35 via-[#111c18]/72 to-[#111c18]/96" />
        <div className="profile-sticker-shine pointer-events-none absolute -inset-y-10 left-0 w-[78%]" />
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-app-primary/70 to-transparent" />

        {isLoading ? (
          <div className="relative flex h-[420px] flex-col items-center justify-center gap-3 text-app-primary">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : user ? (
          <div className="relative max-h-[calc(92vh-1.5rem)] overflow-y-auto pr-1">
            <div className="rounded-[1.9rem] border border-white/10 bg-white/[0.035] p-2 shadow-inner">
              <ProfileHeader user={user} readOnly onClose={onClose} />
            </div>

            <div className="mt-3">
              <ProfileStats stats={profileBundle.stats} />
            </div>

            <div className="mt-3">
              <ProfileAchievements inventory={profileBundle.inventory} />
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
    </div>
  );
}
