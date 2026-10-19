/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BarChart3, CalendarDays, Gamepad2, Route as RouteIcon, Trophy } from "lucide-react";

import FeedBannerCarousel from "../components/FeedBannerCarousel";
import DailyConsolationCard from "../components/DailyConsolationCard";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import OrbitLoader from "../components/OrbitLoader";
import {
  PlayerMiniCard,
  ProfileStickerModal,
} from "../components/profile/ProfileCardPreview";
import { useAuth } from "../contexts/AuthContext";
import { usePublicProfilePreviews, useSelectedPublicProfile } from "../hooks/usePublicProfiles";
import { subscribeFeedPosts } from "../services/volleyReportService";
import { buildMockProfileBundle } from "../services/volleyListService";
import { matchTimelinePath } from "../utils/matchTimeline";
import { maintenanceCompensation } from "../data/feedCompensation";

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function Feed() {
  const { userData, sessionData } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const selfBundle = useMemo(() => userData?.id ? {
    user: userData, inventory: sessionData?.inventory, stats: sessionData?.stats,
  } : null, [userData, sessionData?.inventory, sessionData?.stats]);

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

  const snapshotProfiles = useMemo(() => {
    const rankingItems = posts.flatMap((post) => post.payload?.ranking || []);
    return rankingItems.reduce((result, item, index) => {
      if (!item.userId) return result;
      if (item.profileBundle) {
        return { ...result, [item.userId]: item.profileBundle };
      }
      if (item.userId.startsWith("mock_")) {
        return {
          ...result,
          [item.userId]: buildMockProfileBundle({
            userId: item.userId,
            displayName: item.displayName,
            sex: item.sex || "male",
            isSetter: Boolean(item.isSetter),
          }, index),
        };
      }
      return result;
    }, {});
  }, [posts]);
  const profileIds = posts.flatMap((post) => post.payload?.ranking || []).map((item) => item.userId);
  const profilesById = usePublicProfilePreviews(profileIds, { selfBundle, embedded: snapshotProfiles });
  const selectedProfile = useSelectedPublicProfile(selectedPerson?.id,
    selectedPerson?.id === userData?.id ? selfBundle : snapshotProfiles[selectedPerson?.id]);

  function openProfile(item) {
    if (!item.userId) return;
    setSelectedPerson({
      id: item.userId,
      name: item.displayName,
    });
  }

  return (
    <main
      className="feed-page min-h-screen pb-28 text-white"
      style={{ backgroundImage: `url(${generalBackground})` }}
    >
      <section className="feed-content mx-auto flex w-full max-w-[420px] flex-col gap-4">
        <FeedBannerCarousel />
        <div className="feed-posts space-y-4 px-5">
          {userData?.id && !sessionData?.stats?.feedCompensationClaims?.[maintenanceCompensation.id] && <DailyConsolationCard post={maintenanceCompensation} />}
          {loading && <div className="flex justify-center py-10"><OrbitLoader size={30} /></div>}
          {!loading && posts
            .filter((post) => post.type !== "games" && (post.type !== "daily_consolation" || (post.payload?.recipients?.[userData?.id] && !sessionData?.stats?.dailyConsolationClaims?.[post.payload.listId])))
            .map((post) => post.type === "daily_consolation" ? <DailyConsolationCard key={post.id} post={post} /> : (
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
          profileBundle={selectedProfile.bundle}
          fallbackPerson={selectedPerson}
          isLoading={selectedProfile.loading}
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
  const Icon = post.type === "match_map"
    ? RouteIcon
    : post.type === "wins"
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
        <h2 className={`min-w-0 flex-1 font-black ${post.type === "match_map" ? "text-base leading-snug" : "truncate text-lg"}`}>
          {post.type === "wins" ? "Destaques do dia" : post.title}
        </h2>
      </header>

      {post.type === "match_map" ? (
        <div>
          <p className="text-sm leading-relaxed text-white/65">Veja o histórico dos jogos desse dia.</p>
          <Link to={matchTimelinePath(payload.date)} className="admin-primary-action mt-4 flex min-h-11 w-full items-center justify-between gap-3 px-4 text-sm font-black"><span className="flex items-center gap-2"><RouteIcon size={17} />Abrir mapa</span><ArrowUpRight size={19} /></Link>
        </div>
      ) : isRanking ? (
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
