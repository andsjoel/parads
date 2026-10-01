/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, Gamepad2, Trophy } from "lucide-react";

import feedBanner from "../assets/app-backgrounds/bg-banner-feed.png";
import OrbitLoader from "../components/OrbitLoader";
import {
  PlayerMiniCard,
  ProfileStickerModal,
} from "../components/profile/ProfileCardPreview";
import { useAuth } from "../contexts/AuthContext";
import {
  getPublicProfileBundles,
  syncAllPublicProfilesOnce,
} from "../services/publicProfileService";
import { subscribeFeedPosts } from "../services/volleyReportService";

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function Feed() {
  const { isAdmin } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profilesById, setProfilesById] = useState({});
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [loadingProfileId, setLoadingProfileId] = useState("");
  const [publicProfilesRevision, setPublicProfilesRevision] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    syncAllPublicProfilesOnce()
      .catch((error) => console.warn("Nao foi possivel atualizar os perfis publicos:", error))
      .finally(() => setPublicProfilesRevision((current) => current + 1));
  }, [isAdmin]);

  useEffect(() => subscribeFeedPosts({
    onChange: (nextPosts) => {
      setPosts(nextPosts);
      setLoading(false);
    },
    onError: (error) => {
      console.error(error);
      setLoading(false);
    },
  }), []);

  useEffect(() => {
    const rankingItems = posts.flatMap((post) => post.payload?.ranking || []);
    const snapshotProfiles = rankingItems.reduce((result, item) => (
      item.profileBundle && item.userId
        ? { ...result, [item.userId]: item.profileBundle }
        : result
    ), {});
    const remoteIds = [...new Set(rankingItems.map((item) => item.userId).filter(Boolean))]
      .filter((id) => !snapshotProfiles[id]);

    setProfilesById((current) => ({ ...snapshotProfiles, ...current }));
    if (!remoteIds.length) return;

    getPublicProfileBundles(remoteIds)
      .then((bundles) => setProfilesById((current) => ({ ...current, ...bundles })))
      .catch((error) => console.error(error));
  }, [posts, publicProfilesRevision]);

  async function openProfile(item) {
    if (!item.userId) return;
    setSelectedPerson({
      id: item.userId,
      name: item.displayName,
    });
    if (profilesById[item.userId]) return;

    try {
      setLoadingProfileId(item.userId);
      const bundles = await getPublicProfileBundles([item.userId]);
      setProfilesById((current) => ({ ...current, ...bundles }));
    } finally {
      setLoadingProfileId("");
    }
  }

  return (
    <main className="min-h-screen pb-28 text-white">
      <section className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
        <div className="feed-banner relative aspect-[3/1] w-full overflow-hidden">
          <img
            src={feedBanner}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="feed-banner-copy absolute inset-y-0 left-0 z-[1] flex w-[64%] flex-col justify-center px-5 py-3">
            <h1 className="font-idv-title text-xl leading-none text-[#fffaf0]">App em construção</h1>
            <p className="mt-2 text-[10px] font-bold leading-snug text-white/70">
              Podem surgir problemas e erros. Por favor, reportem.
            </p>
          </div>
        </div>
        <div className="space-y-4 px-5">
          {loading && <div className="flex justify-center py-10"><OrbitLoader size={30} /></div>}
          {!loading && posts
            .filter((post) => post.type !== "games")
            .map((post) => (
              <FeedReportCard
                key={post.id}
                post={post}
                profilesById={profilesById}
                onOpenProfile={openProfile}
              />
            ))}
        </div>
      </section>

      {selectedPerson && (
        <ProfileStickerModal
          profileBundle={profilesById[selectedPerson.id]}
          fallbackPerson={selectedPerson}
          isLoading={loadingProfileId === selectedPerson.id}
          onClose={() => setSelectedPerson(null)}
        />
      )}
    </main>
  );
}

function FeedReportCard({ post, profilesById, onOpenProfile }) {
  const payload = post.payload || {};
  const ranking = payload.ranking || [];
  const isRanking = post.type === "wins" || post.type === "games";
  const Icon = post.type === "wins"
    ? Trophy
    : post.type === "games"
      ? Gamepad2
      : post.type === "day"
        ? CalendarDays
        : BarChart3;

  return (
    <article className={`feed-report-card feed-report-card--${post.type} p-4`}>
      <header className="mb-4 flex items-center gap-3">
        <div className="feed-report-icon flex h-10 w-10 items-center justify-center"><Icon size={19} /></div>
        <h2 className="min-w-0 flex-1 truncate text-lg font-black">
          {post.type === "wins" ? "Destaques do dia" : post.title}
        </h2>
      </header>

      {isRanking ? (
        <div className="space-y-1.5">
          {ranking.map((item, index) => (
            <div key={item.entryId || `${item.displayName}-${index}`} className="feed-winner-player relative flex items-center">
              <PlayerMiniCard
                person={{ id: item.userId, name: item.displayName }}
                profileBundle={item.profileBundle || profilesById[item.userId]}
                onOpen={item.userId ? () => onOpenProfile(item) : undefined}
              />
              <span className="pointer-events-none absolute right-3 z-20 text-xs font-black text-white/70">
                {post.type === "wins" ? `${item.wins || 0}V` : `${item.gamesPlayed || 0} jogos`}
              </span>
            </div>
          ))}
        </div>
      ) : post.type === "day" ? (
        <div className="grid grid-cols-2 gap-2">
          <FeedMetric value={payload.summary?.totalGames || 0} label="partidas" />
          <FeedMetric value={payload.summary?.totalPlayers || 0} label="presentes" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <FeedMetric value={payload.metrics?.totalDays || 0} label="dias" icon={CalendarDays} />
          <FeedMetric value={payload.metrics?.totalGames || 0} label="partidas" icon={Gamepad2} />
        </div>
      )}

      {payload.date && <p className="mt-3 text-right text-[10px] font-bold text-white/35">{formatDate(payload.date)}</p>}
    </article>
  );
}

function FeedMetric({ value, label, icon: Icon }) {
  return <div className="feed-report-metric">{Icon && <Icon size={14} />}<strong>{value}</strong><span>{label}</span></div>;
}
