import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Crown, History, RotateCw, Trophy, Users, Volleyball, X } from "lucide-react";
import OrbitLoader from "../components/OrbitLoader";
import { useAuth } from "../contexts/AuthContext";
import { getVolleyTimeline, getVolleyTimelineDays } from "../services/volleyTimelineService";
import { buildMatchTimeline, mergeTimelineDays } from "../utils/matchTimeline";
import generalBackground from "../assets/app-backgrounds/bg-geral.png";
import "../styles/matchTimeline.css";

const COLORS = ["#ff773d", "#13d5e8", "#52e0a4", "#ff51a5", "#eac453", "#bd9aff", "#f28f91", "#a8dce1"];
const tone = (team) => COLORS[team.index % COLORS.length];
const time = (value) => value && !Number.isNaN(Date.parse(value))
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";

export default function AdminMatchTimeline() {
  const { isAdmin, userData } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [dayOptions, setDayOptions] = useState({ loading: true, days: [], cursor: null, hasMore: false, error: "" });
  const [loadingMoreDays, setLoadingMoreDays] = useState(false);
  const date = params.get("date") || dayOptions.days[0]?.date || "";
  const [state, setState] = useState({ loading: true, list: null, error: "" });
  const [revision, setRevision] = useState(0);
  const [selectedGame, setSelectedGame] = useState(null);
  const closeGame = useCallback(() => setSelectedGame(null), []);

  useEffect(() => {
    if (!userData?.id) return undefined;
    let current = true;
    setDayOptions({ loading: true, days: [], cursor: null, hasMore: false, error: "" });
    getVolleyTimelineDays().then((options) => {
      if (current) setDayOptions({ ...options, loading: false, error: "" });
    }).catch(() => {
      if (current) setDayOptions({ loading: false, days: [], cursor: null, hasMore: false, error: "Não foi possível carregar as datas dos jogos." });
    });
    return () => { current = false; };
  }, [revision, userData?.id]);

  useEffect(() => {
    if (!userData?.id || dayOptions.loading) return undefined;
    if (!date) { setState({ loading: false, list: null, error: "" }); return undefined; }
    let current = true;
    setState({ loading: true, list: null, error: "" });
    setSelectedGame(null);
    const request = dayOptions.activeList?.date === date ? Promise.resolve(dayOptions.activeList) : getVolleyTimeline(date);
    request.then((list) => {
      if (current) setState({ loading: false, list, error: "" });
    }).catch((error) => {
      if (current) setState({ loading: false, list: null, error: error.message || "Não foi possível carregar o histórico." });
    });
    return () => { current = false; };
  }, [date, dayOptions.loading, dayOptions.activeList, revision, userData?.id]);

  const result = useMemo(() => {
    try { return { timeline: buildMatchTimeline(state.list) }; }
    catch (error) { return { error: error.message, timeline: { games: [], teams: [], participants: 0 } }; }
  }, [state.list]);
  const { games, teams, participants } = result.timeline;
  const error = state.error || result.error || dayOptions.error;
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const selectableDays = mergeTimelineDays(dayOptions.days, state.list?.date === date && games.length
    ? [{ date, totalGames: games.length }] : []);
  const loading = state.loading || dayOptions.loading;

  async function loadMoreDays() {
    if (loadingMoreDays || !dayOptions.hasMore) return;
    setLoadingMoreDays(true);
    try {
      const options = await getVolleyTimelineDays({ cursor: dayOptions.cursor });
      setDayOptions((current) => ({ ...current, cursor: options.cursor, hasMore: options.hasMore,
        days: mergeTimelineDays(current.days, options.days), error: "" }));
    } catch {
      setDayOptions((current) => ({ ...current, error: "Não foi possível carregar mais datas." }));
    } finally { setLoadingMoreDays(false); }
  }

  return (
    <main className="match-timeline-page" style={{ backgroundImage: `url(${generalBackground})` }}>
      <div className="match-timeline-content">
        <header className="match-timeline-header">
          <button type="button" onClick={() => navigate(isAdmin ? "/admin/reports" : "/menu")} className="register-outline-action timeline-icon-button" aria-label="Voltar" title="Voltar"><ArrowLeft size={20} /></button>
          <div className="min-w-0 flex-1"><p className="timeline-eyebrow">Pelada</p><h1 className="font-idv-title text-2xl">Mapa dos jogos</h1></div>
          <button type="button" onClick={() => setRevision((value) => value + 1)} disabled={loading} className="profile-modal-close timeline-icon-button disabled:opacity-40" aria-label="Atualizar histórico" title="Atualizar histórico"><RotateCw size={18} /></button>
        </header>
        <div className="timeline-date-row">
          <label className="timeline-date"><CalendarDays size={17} /><select aria-label="Data da pelada" value={selectableDays.some((day) => day.date === date) ? date : ""} disabled={dayOptions.loading || !selectableDays.length} onChange={(event) => setParams({ date: event.target.value })}>
            {!selectableDays.length && <option value="">{dayOptions.loading ? "Carregando datas…" : "Nenhum dia com jogos"}</option>}
            {selectableDays.map((day) => <option key={day.date} value={day.date}>{day.date.split("-").reverse().join("/")}</option>)}
          </select><ChevronDown size={16} /></label>
          {dayOptions.hasMore && <button type="button" onClick={loadMoreDays} disabled={loadingMoreDays} className="profile-modal-close timeline-icon-button disabled:opacity-40" aria-label="Carregar datas anteriores" title="Carregar datas anteriores"><History size={18} className={loadingMoreDays ? "animate-spin" : ""} /></button>}
        </div>

        {loading ? <div className="timeline-loading"><OrbitLoader /></div> : error ? (
          <p role="alert" className="report-error p-4 text-sm text-red-200">{error}</p>
        ) : !games.length ? (
          <section className="timeline-empty"><Volleyball size={34} /><h2 className="font-idv-title text-xl">Nenhuma partida registrada</h2></section>
        ) : (
          <>
            <div className="timeline-totals">
              <div className="timeline-total"><Volleyball size={18} /><strong>{games.length}</strong><span>partidas</span></div>
              <div className="timeline-total"><Users size={18} /><strong>{participants}</strong><span>atletas</span></div>
              <div className="timeline-total"><Crown size={18} /><strong>{teams.length}</strong><span>times</span></div>
            </div>
            <section className="timeline-map-section" aria-label="Mapa cronológico das partidas">
              <div className="timeline-map-scroll" tabIndex={0} aria-label="Confrontos por equipe">
                <div className="timeline-map-grid" style={{ "--lane-count": teams.length, "--map-width": `${52 + teams.length * 88}px` }}>
                  <div className="timeline-map-heading">
                    <span className="timeline-round-heading">Jogo</span>
                    {teams.map((team) => <div key={team.id} className="timeline-lane-heading" style={{ "--team-color": tone(team) }}><strong>{team.name}</strong><small>{team.wins}V · {team.losses}D</small></div>)}
                  </div>
                  {games.map((game, gameIndex) => {
                    const winner = teamsById.get(game.winner.teamId), loser = teamsById.get(game.loser.teamId);
                    return (
                      <div key={game.id} className="timeline-map-row">
                        <button type="button" className="timeline-round" onClick={() => setSelectedGame(gameIndex)} title={`Ver partida ${game.index}`} aria-label={`Ver partida ${game.index}`}><strong>{String(game.index).padStart(2, "0")}</strong><small>{time(game.recordedAt)}</small></button>
                        <span aria-hidden="true" className="timeline-match-link" style={{ left: `${96 + Math.min(winner.index, loser.index) * 88}px`, width: `${Math.abs(winner.index - loser.index) * 88}px` }} />
                        {teams.map((team) => {
                          const won = team.id === winner.id, lost = team.id === loser.id;
                          const first = team.appearances[0], last = team.appearances.at(-1);
                          return <div key={team.id} style={{ "--team-color": tone(team) }} className="timeline-map-cell">
                            {gameIndex >= first && gameIndex <= last && <span aria-hidden="true" className={`timeline-team-track ${gameIndex === first ? "is-first" : ""} ${gameIndex === last ? "is-last" : ""}`} />}
                            {(won || lost) && <button type="button" className={`timeline-game-node ${won ? "is-winner" : "is-loser"}`} onClick={() => setSelectedGame(gameIndex)} title={`${team.name}: ${won ? "vitória" : "derrota"} na partida ${game.index}`} aria-label={`${team.name}, ${won ? "vitória" : "derrota"}, partida ${game.index}`}><span>{won ? <Trophy size={15} /> : <X size={15} />}</span><strong>{won ? "V" : "D"}</strong></button>}
                          </div>;
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
            <footer className="timeline-finish"><span /><Volleyball size={17} /><p>Última partida registrada · #{games.at(-1).index}</p></footer>
          </>
        )}
      </div>
      {selectedGame !== null && games[selectedGame] && <GameDetails game={games[selectedGame]} teamsById={teamsById} onClose={closeGame} onPrevious={selectedGame > 0 ? () => setSelectedGame((value) => value - 1) : null} onNext={selectedGame < games.length - 1 ? () => setSelectedGame((value) => value + 1) : null} />}
    </main>
  );
}

function GameDetails({ game, teamsById, onClose, onPrevious, onNext }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const scrollY = window.scrollY;
    const previousBody = { overflow: document.body.style.overflow, position: document.body.style.position,
      top: document.body.style.top, width: document.body.style.width };
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";
    dialogRef.current?.focus();
    function keyboard(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const buttons = dialogRef.current?.querySelectorAll("button:not(:disabled)");
        const first = buttons?.[0], last = buttons?.[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      Object.assign(document.body.style, previousBody);
      document.documentElement.style.overflow = rootOverflow;
      document.removeEventListener("keydown", keyboard);
      window.scrollTo(0, scrollY);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return createPortal(
    <div className="timeline-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="timeline-game-title" className="profile-edit-modal timeline-game-dialog">
        <header><div><p className="timeline-eyebrow">{time(game.recordedAt)}</p><h2 id="timeline-game-title" className="font-idv-title text-2xl">Partida {game.index}</h2></div><button type="button" onClick={onClose} className="profile-modal-close timeline-icon-button" aria-label="Fechar confronto" title="Fechar confronto"><X size={20} /></button></header>
        <div className="timeline-result-grid">
          {[[game.winner, true], [game.loser, false]].map(([side, won]) => {
            const team = teamsById.get(side.teamId);
            return <section key={side.teamId} className="timeline-result-team" style={{ "--team-color": tone(team) }}>
              <div className="timeline-result-inner"><header><span className={won ? "timeline-won" : "timeline-lost"}>{won ? <Trophy size={14} /> : <X size={14} />}{won ? "Venceu" : "Perdeu"}</span><h3 className="font-idv-title text-xl">{team.name}</h3></header>
                <ul>{side.players.map((player) => <li key={player.entryId} className={`${player.isSetter ? "is-setter" : ""} ${player.sex === "female" ? "is-woman" : ""}`}><span>{player.name}</span>{player.isGuest && <small title="Convidado" aria-label="Convidado">C</small>}</li>)}</ul>
              </div>
            </section>;
          })}
        </div>
        <footer><button type="button" disabled={!onPrevious} onClick={onPrevious} className="register-outline-action timeline-icon-button disabled:opacity-25" aria-label="Partida anterior" title="Partida anterior"><ChevronLeft size={21} /></button><span>#{String(game.index).padStart(2, "0")}</span><button type="button" disabled={!onNext} onClick={onNext} className="register-outline-action timeline-icon-button disabled:opacity-25" aria-label="Próxima partida" title="Próxima partida"><ChevronRight size={21} /></button></footer>
      </section>
    </div>, document.body,
  );
}
