/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { BarChart3, CalendarDays, ClipboardList, Gamepad2, MessageCircle, Palette, Store, Target, Trophy, User } from "lucide-react";
import { GiVolleyballBall } from "react-icons/gi";

import feedBanner from "../assets/app-backgrounds/bg-banner-feed.png";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import OrbitLoader from "../components/OrbitLoader";
import {
  PlayerMiniCard,
  ProfileStickerModal,
} from "../components/profile/ProfileCardPreview";
import { useAuth } from "../contexts/AuthContext";
import {
  getPublicProfileBundle,
  getPublicProfileBundles,
  getPublicProfileDirectory,
  syncAllPublicProfilesOnce,
} from "../services/publicProfileService";
import { subscribeFeedPosts } from "../services/volleyReportService";
import { buildMockProfileBundle } from "../services/volleyListService";

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
  const [guideAdmin, setGuideAdmin] = useState(null);

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
    const snapshotProfiles = rankingItems.reduce((result, item, index) => {
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
    const remoteIds = [...new Set(rankingItems.map((item) => item.userId).filter(Boolean))]
      .filter((id) => !snapshotProfiles[id]);

    setProfilesById((current) => ({ ...snapshotProfiles, ...current }));
    if (!remoteIds.length) return;

    getPublicProfileBundles(remoteIds)
      .then((bundles) => setProfilesById((current) => ({ ...current, ...bundles })))
      .catch((error) => console.error(error));
  }, [posts, publicProfilesRevision]);

  useEffect(() => {
    if (loading || posts.length || guideAdmin) return undefined;

    let isCurrent = true;
    getPublicProfileDirectory()
      .then((members) => {
        const admin = members.find((member) => member.role === "admin" || member.type === "admin");
        if (!admin) return null;
        return getPublicProfileBundle(admin.id).then((bundle) => ({ admin, bundle }));
      })
      .then((result) => {
        if (!isCurrent || !result?.bundle) return;
        const entry = {
          userId: result.admin.id,
          displayName: result.bundle.user?.profile?.displayName
            || result.bundle.user?.fullName
            || "ADM",
        };
        setGuideAdmin(entry);
        setProfilesById((current) => ({
          ...current,
          [entry.userId]: result.bundle,
        }));
      })
      .catch((error) => console.warn("Não foi possível carregar o perfil do ADM:", error));

    return () => {
      isCurrent = false;
    };
  }, [guideAdmin, loading, posts.length]);

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
    <main
      className={`feed-page text-white ${!loading && posts.length === 0 ? "feed-page--welcome" : "min-h-screen pb-28"}`}
      style={{ backgroundImage: `url(${generalBackground})` }}
    >
      <section className="feed-content mx-auto flex w-full max-w-[420px] flex-col gap-4">
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
        <div className="feed-posts space-y-4 px-5">
          {loading && <div className="flex justify-center py-10"><OrbitLoader size={30} /></div>}
          {!loading && posts.length === 0 && (
            <MemberQuickGuide
              admin={guideAdmin}
              adminBundle={guideAdmin ? profilesById[guideAdmin.userId] : null}
              onOpenProfile={openProfile}
            />
          )}
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

const memberGuideItems = [
  {
    title: "welcome",
    description: "Bem-vindo! 😊 Olha esse guia rápido:",
  },
  {
    icon: ClipboardList,
    title: "Lista",
    description: "Aqui é onde será lançada a lista todo domingo. Coloque seu nome para participar!",
  },
  {
    icon: GiVolleyballBall,
    title: "Partidas",
    description: "Nesse você acompanha os jogos e sua vez de jogar.",
  },
  {
    icon: User,
    title: "Perfil",
    description: "O perfil é todo seu para customizar! Suas estatísticas e moedas também ficam lá.",
  },
  {
    icon: Palette,
    title: "Personalização",
    description: "No perfil você escolhe foto, borda, capa, carta, ícone e status.",
  },
  {
    icon: Target,
    title: "Missões",
    description: "Toque em cada estatística para acompanhar e resgatar suas recompensas.",
  },
  {
    icon: Store,
    title: "Loja",
    description: "Use suas moedas para liberar novos itens de personalização.",
  },
  {
    title: "finish",
    description: "Agora clique no meu card lá em cima para ver como fica uma carta personalizada!",
  },
  {
    title: "catchphrase",
    description: "Ah, e lembre-se: ISSO NÃO É UMA DEMOCRACIA!",
  },
];

// Kept in memory across navigation; a page reload starts a new conversation.
const guideConversation = { isOpen: false, visibleCount: 0 };

function MemberQuickGuide({ admin, adminBundle, onOpenProfile }) {
  const [isOpen, setIsOpen] = useState(guideConversation.isOpen);
  const [visibleCount, setVisibleCount] = useState(guideConversation.visibleCount);
  const [isTyping, setIsTyping] = useState(false);
  const messagesRef = useRef(null);
  const followMessagesRef = useRef(true);

  useEffect(() => {
    if (!admin || !isOpen) return undefined;
    const limit = memberGuideItems.length;
    if (visibleCount >= limit) return undefined;

    const typingTimer = window.setTimeout(() => setIsTyping(true), 650);
    const messageTimer = window.setTimeout(() => {
      setIsTyping(false);
      guideConversation.visibleCount = visibleCount + 1;
      setVisibleCount(guideConversation.visibleCount);
    }, visibleCount === 0 ? 2500 : 5500);

    return () => {
      window.clearTimeout(typingTimer);
      window.clearTimeout(messageTimer);
    };
  }, [admin, isOpen, visibleCount]);

  useEffect(() => {
    const container = messagesRef.current;
    if (container && followMessagesRef.current) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [visibleCount, isTyping]);

  return (
    <div className="feed-guide-chat">
      <div className="feed-guide-sender">
      {admin && (
        <PlayerMiniCard
          person={{ id: admin.userId, name: admin.displayName }}
          profileBundle={adminBundle}
          onOpen={() => onOpenProfile(admin)}
        />
      )}
      {!isOpen && (
        <button type="button" onClick={() => {
          followMessagesRef.current = true;
          guideConversation.isOpen = true;
          setIsOpen(true);
        }} className="register-paper-action mt-3 flex h-11 w-full items-center justify-center gap-2 text-sm font-black">
          <MessageCircle size={18} /> abrir mensagem
        </button>
      )}
      </div>

      <div
        ref={messagesRef}
        className="feed-guide-messages"
        role="log"
        aria-label="Mensagens do ADM"
        aria-live="polite"
        onScroll={(event) => {
          const container = event.currentTarget;
          followMessagesRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 48;
        }}
      >
        {memberGuideItems.slice(0, visibleCount).map(({ icon: Icon, title, description }) => (
          <div key={title} className="feed-guide-bubble">
            {Icon && <span className="feed-guide-icon flex h-8 w-8 shrink-0 items-center justify-center"><Icon size={17} /></span>}
            <div className="min-w-0">
              {Icon && <strong className="mb-1 block text-sm font-black text-[#fffaf0]">{title}</strong>}
              <p className="text-xs font-semibold leading-relaxed text-white/80">{description}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="feed-guide-bubble feed-guide-typing" role="status" aria-label="ADM está digitando">
            <span /><span /><span />
          </div>
        )}
      </div>
    </div>
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
