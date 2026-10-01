/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { BarChart3, CalendarDays, Gamepad2, Send, Trash2, Trophy } from "lucide-react";

import OrbitLoader from "../components/OrbitLoader";
import { useAuth } from "../contexts/AuthContext";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import {
  publishVolleyReportCard,
  removeVolleyReportCard,
  subscribeFeedPosts,
  subscribeVolleyDashboard,
} from "../services/volleyReportService";

function formatDate(value) {
  if (!value) return "Sem data";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function rankingWithLastPlaceTies(items, field) {
  const sorted = [...(items || [])].sort((a, b) => (b[field] || 0) - (a[field] || 0));
  if (sorted.length <= 5) return sorted;
  const lastValue = sorted[4]?.[field] || 0;
  return sorted.filter((item, index) => index < 5 || (item[field] || 0) === lastValue);
}

function PublishButton({ busy, published, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={`report-publish-button ${published ? "is-remove" : ""} flex h-9 items-center justify-center gap-2 px-3 text-xs font-black disabled:opacity-50`}>
      {published ? <Trash2 size={14} /> : <Send size={14} />}
      {published ? "remover do feed" : "postar no feed"}
    </button>
  );
}

export default function AdminReports() {
  const { isAdmin, userData } = useAuth();
  const [dashboard, setDashboard] = useState({ metrics: null, report: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => subscribeVolleyDashboard({
    onChange: (next) => {
      setDashboard(next);
      setLoading(false);
    },
    onError: (nextError) => {
      console.error(nextError);
      setError("Não foi possível carregar os relatórios.");
      setLoading(false);
    },
  }), []);

  useEffect(() => subscribeFeedPosts({
    onChange: setPosts,
    onError: (nextError) => console.error(nextError),
  }), []);

  const report = dashboard.report;
  const metrics = dashboard.metrics || {};
  const topWins = useMemo(
    () => rankingWithLastPlaceTies(report?.winsRanking, "wins"),
    [report?.winsRanking],
  );

  if (!isAdmin) return <Navigate to="/menu" replace />;

  function getPublishedPost(type) {
    return posts.find((post) => post.reportId === report?.id && post.type === type);
  }

  async function togglePublication(id, title, payload) {
    if (!report || busy) return;
    try {
      setBusy(id);
      setError("");
      const publishedPost = getPublishedPost(id);
      if (publishedPost) {
        await removeVolleyReportCard(publishedPost.id);
      } else {
        await publishVolleyReportCard({
          type: id,
          title,
          payload,
          reportId: report.id,
          createdBy: userData?.id,
        });
      }
    } catch (publishError) {
      console.error(publishError);
      setError("Não foi possível atualizar o feed.");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return <main className="reports-page flex min-h-screen items-center justify-center" style={{ backgroundImage: `url(${generalBackground})` }}><OrbitLoader /></main>;
  }

  return (
    <main className="reports-page min-h-screen px-5 pb-28 pt-6 text-white" style={{ backgroundImage: `url(${generalBackground})` }}>
      <section className="mx-auto w-full max-w-[420px] space-y-4">
        <header>
          <h1 className="font-idv-title text-3xl text-[#fffaf0]">Relatórios</h1>
          <p className="mt-1 text-xs font-bold text-white/45">Histórico geral e último dia encerrado</p>
        </header>

        {error && <p className="report-error px-3 py-2 text-xs font-bold text-red-200">{error}</p>}

        <section className="report-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-black">Geral</h2>
            <BarChart3 size={19} className="text-app-primary" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="report-metric"><CalendarDays size={16} /><strong>{metrics.totalDays || 0}</strong><span>dias</span></div>
            <div className="report-metric"><Gamepad2 size={16} /><strong>{metrics.totalGames || 0}</strong><span>partidas</span></div>
          </div>
          {report && <div className="mt-3 flex justify-end"><PublishButton busy={busy === "general"} published={Boolean(getPublishedPost("general"))} onClick={() => togglePublication("general", "Números da pelada", { metrics: { totalDays: metrics.totalDays || 0, totalGames: metrics.totalGames || 0 } })} /></div>}
        </section>

        {!report ? (
          <section className="report-card p-6 text-center">
            <p className="font-black">Aguardando encerramento</p>
          </section>
        ) : (
          <>
            <section className="report-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase text-app-primary">Última pelada</p><h2 className="mt-1 text-xl font-black">{formatDate(report.date)}</h2></div>
                <CalendarDays size={20} className="text-app-primary" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="report-metric"><strong>{report.summary?.totalGames || 0}</strong><span>partidas</span></div>
                <div className="report-metric"><strong>{report.summary?.totalPlayers || 0}</strong><span>presentes</span></div>
              </div>
              <div className="mt-3 flex justify-end"><PublishButton busy={busy === "day"} published={Boolean(getPublishedPost("day"))} onClick={() => togglePublication("day", `Pelada de ${formatDate(report.date)}`, { date: report.date, summary: { totalGames: report.summary?.totalGames || 0, totalPlayers: report.summary?.totalPlayers || 0 } })} /></div>
            </section>

            <RankingCard title="Ranking de vitórias" icon={Trophy} items={topWins} valueKey="wins" suffix="V" action={<PublishButton busy={busy === "wins"} published={Boolean(getPublishedPost("wins"))} onClick={() => togglePublication("wins", "Destaques do dia", { date: report.date, ranking: topWins })} />} />
          </>
        )}
      </section>
    </main>
  );
}

function RankingCard({ title, icon: Icon, items, valueKey, suffix, action }) {
  return (
    <section className="report-card p-4">
      <div className="mb-3 flex items-center gap-2"><Icon size={18} className="text-app-primary" /><h2 className="text-base font-black">{title}</h2></div>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div key={item.entryId || `${item.displayName}-${index}`} className="report-ranking-row flex items-center gap-3 px-3 py-2">
            <strong className="w-5 text-center text-app-primary">{index + 1}</strong>
            <span className="min-w-0 flex-1 truncate text-sm font-black">{item.displayName}</span>
            <span className="text-xs font-black text-white/60">{item[valueKey] || 0}{suffix}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">{action}</div>
    </section>
  );
}
