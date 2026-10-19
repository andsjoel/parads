/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import OrbitLoader from "../components/OrbitLoader";
import ProfileBackgroundMedia from "../components/profile/ProfileBackgroundMedia";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileStats from "../components/profile/ProfileStats";
import {
  DEFAULT_DISPLAY_CARD_ID,
  getDisplayCard,
} from "../data/displayCardsCatalog";
import {
  getPublicProfileBundle,
  getPublicProfileDirectory,
} from "../services/publicProfileService";
import { getProfileAssetUrls } from "../utils/profileAssets";

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getMemberName(member) {
  return member.profile?.displayName || member.fullName || member.username || "Jogador";
}

function resolveBundleDisplayCard(bundle) {
  const profile = bundle?.user?.profile || {};
  const selectedCardId = profile.selectedDisplayCardId || DEFAULT_DISPLAY_CARD_ID;
  const canUseCard = selectedCardId === DEFAULT_DISPLAY_CARD_ID
    || bundle?.inventory?.displayCards?.includes(selectedCardId);

  return getDisplayCard(canUseCard ? selectedCardId : DEFAULT_DISPLAY_CARD_ID);
}

export default function Cards() {
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const selectionRequestRef = useRef(0);
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [loadingMemberId, setLoadingMemberId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    getPublicProfileDirectory()
      .then((directory) => { if (current) setMembers(directory || []); })
      .catch(() => { if (current) setError("Não foi possível carregar os atletas."); })
      .finally(() => { if (current) setIsLoadingDirectory(false); });
    return () => { current = false; selectionRequestRef.current += 1; };
  }, []);

  useEffect(() => {
    function closeResults(event) {
      if (!searchRef.current?.contains(event.target)) setIsFocused(false);
    }

    document.addEventListener("pointerdown", closeResults);
    return () => document.removeEventListener("pointerdown", closeResults);
  }, []);

  const results = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const filtered = normalizedQuery
      ? members.filter((member) => normalizeSearch([
          member.profile?.displayName,
          member.fullName,
          member.username,
        ].filter(Boolean).join(" ")).includes(normalizedQuery))
      : members;

    return filtered.slice(0, 10);
  }, [members, query]);
  const selectedDisplayCard = useMemo(
    () => selectedBundle ? resolveBundleDisplayCard(selectedBundle) : null,
    [selectedBundle],
  );
  const isImmersiveCard = Boolean(selectedDisplayCard?.immersive);

  async function selectMember(member) {
    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    setQuery(getMemberName(member));
    setIsFocused(false);
    setError("");
    setSelectedBundle(null);
    setLoadingMemberId(member.id);

    try {
      const bundle = await getPublicProfileBundle(member.id, { force: true });
      if (!bundle?.user || !bundle?.inventory || !bundle?.stats) {
        throw new Error("Perfil incompleto ou removido.");
      }
      if (selectionRequestRef.current !== requestId) return;
      setSelectedBundle(bundle);
    } catch (selectionError) {
      if (selectionRequestRef.current !== requestId) return;
      console.error(selectionError);
      setError("Não foi possível carregar essa carta.");
    } finally {
      if (selectionRequestRef.current === requestId) setLoadingMemberId("");
    }
  }

  function clearSelection() {
    selectionRequestRef.current += 1;
    setQuery("");
    setSelectedBundle(null);
    setLoadingMemberId("");
    setError("");
    setIsFocused(false);
  }

  return (
    <main
      className="cards-page relative isolate min-h-screen overflow-hidden px-4 pb-28 pt-5 text-white"
      style={{
        backgroundImage: isImmersiveCard
          ? "none"
          : `linear-gradient(rgba(8, 1, 5, 0.62), rgba(8, 1, 5, 0.84)), url(${generalBackground})`,
      }}
    >
      {isImmersiveCard && (
        <>
          <ProfileBackgroundMedia
            src={selectedDisplayCard.videoUrl}
            animate
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#17051f]/40 via-[#250315]/20 to-[#090107]/88" />
        </>
      )}

      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-8.25rem)] w-full max-w-[430px] flex-col">
        <header className="relative z-30 mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="register-back flex h-11 w-11 shrink-0 items-center justify-center"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>

          <div ref={searchRef} className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/35" size={17} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setIsFocused(true);
              }}
              onFocus={() => setIsFocused(true)}
              placeholder="Buscar atleta"
              className="profile-modal-control h-11 w-full border border-white/10 bg-[#17040a]/90 pl-11 pr-11 text-sm font-bold text-white outline-none placeholder:text-white/30 focus:border-[#ff713f]/70"
              role="combobox"
              aria-expanded={isFocused}
              aria-controls="card-member-results"
            />
            {(query || selectedBundle || loadingMemberId) && (
              <button
                type="button"
                onClick={clearSelection}
                className="absolute right-1.5 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-white/45 transition hover:text-white active:scale-90"
                aria-label="Limpar busca"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}

            {isFocused && (
              <div id="card-member-results" className="profile-theme-menu max-h-64 overflow-y-auto" role="listbox">
                {isLoadingDirectory ? (
                  <div className="flex justify-center py-5"><OrbitLoader size={22} /></div>
                ) : results.length ? results.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    role="option"
                    aria-selected={selectedBundle?.user?.id === member.id}
                    onClick={() => selectMember(member)}
                    className="profile-theme-option flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-[#fffaf0]">{getMemberName(member)}</strong>
                      <small className="block truncate text-[10px] text-white/35">@{member.username || "atleta"}</small>
                    </span>
                  </button>
                )) : (
                  <p className="px-4 py-5 text-center text-xs font-bold text-white/35">Nenhum atleta encontrado.</p>
                )}
              </div>
            )}
          </div>
        </header>

        {error && <p className="mb-3 text-center text-xs font-bold text-red-300">{error}</p>}

        <div className="relative flex min-h-0 flex-1 items-end">
          {selectedBundle ? (
            <MemberDisplayCard bundle={selectedBundle} displayCard={selectedDisplayCard} />
          ) : (
            <EmptyCardSlot isLoading={Boolean(loadingMemberId)} />
          )}
        </div>
      </section>
    </main>
  );
}

function MemberDisplayCard({ bundle, displayCard }) {
  const profile = bundle.user?.profile || {};
  const { backgroundUrl } = getProfileAssetUrls(profile);

  return (
    <article className={`profile-sticker-card relative w-full overflow-hidden p-3 ${displayCard.immersive ? "self-stretch flex flex-col justify-end bg-transparent" : `profile-edit-modal ${displayCard.cardClassName}`}`}>
      {displayCard.hasShine && backgroundUrl && (
        <ProfileBackgroundMedia src={backgroundUrl} animate className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}
      {!displayCard.immersive && <div className={`absolute inset-0 ${displayCard.hasShine ? "bg-gradient-to-b from-[#18050a]/35 via-[#18050a]/72 to-[#18050a]/96" : "bg-gradient-to-b from-[#8f2e10]/25 via-[#5b170c]/72 to-[#2c0908]/96"}`} />}
      {displayCard.hasShine && <div className="profile-sticker-shine pointer-events-none absolute -inset-y-10 left-0 w-[78%]" />}

      <div className={displayCard.immersive ? "immersive-profile-frame relative overflow-hidden" : "relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-white/[0.035] p-2"}>
        <ProfileHeader user={bundle.user} readOnly immersive={displayCard.immersive} />
      </div>
      <div className="relative mt-3">
        <ProfileStats stats={bundle.stats} immersive={displayCard.immersive} />
      </div>
    </article>
  );
}

function EmptyCardSlot({ isLoading }) {
  return (
    <article className="profile-edit-modal relative w-full overflow-hidden p-3" aria-label="Selecione um atleta para visualizar sua carta">
      <div className="absolute inset-0 bg-gradient-to-b from-[#35101b]/55 via-[#17050b]/85 to-[#0d0206]" />
      <div className="relative overflow-hidden rounded-[1.9rem] border border-dashed border-white/10 p-2">
        <div className="relative h-56 overflow-hidden rounded-[1.5rem] bg-white/[0.025]">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.035] via-transparent to-[#ff713f]/[0.035]" />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <OrbitLoader size={32} />
            </div>
          )}
        </div>
        <div className="relative px-5 pb-4 pt-5">
          <div className="profile-status h-10 animate-pulse opacity-35" />
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-5 gap-1.5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-[62px] animate-pulse border border-dashed border-white/10 bg-white/[0.025] [clip-path:polygon(4%_4%,96%_0,100%_88%,91%_100%,3%_94%,0_16%)]" />
        ))}
      </div>
    </article>
  );
}
