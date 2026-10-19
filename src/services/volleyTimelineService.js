import { collection, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { isTimelineDate, mergeTimelineDays } from "../utils/matchTimeline";

const DAY_PAGE_SIZE = 20;

export async function getVolleyTimelineDays({ cursor = null } = {}) {
  const reportQuery = query(collection(db, "volley_reports"), orderBy("closedAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []), limit(DAY_PAGE_SIZE));
  const reports = await getDocs(reportQuery);
  const days = reports.docs.map((snapshot) => {
    const report = snapshot.data();
    return { date: report.date, listId: report.listId || snapshot.id, totalGames: report.summary?.totalGames || 0 };
  });
  let activeList = null;
  // Only the first page needs the single active day; older pages use small reports.
  if (!cursor) {
    const active = await getDocs(query(collection(db, "volley_lists"),
      where("status", "in", ["open", "in_progress"]), limit(1)));
    const snapshot = active.docs[0];
    if (snapshot) {
      const list = snapshot.data();
      if (!days.some((day) => day.date === list.date && day.listId !== snapshot.id)) activeList = { ...list, id: snapshot.id };
      days.push({ date: list.date, listId: snapshot.id, totalGames: (list.games || []).length });
    }
  }
  return { days: mergeTimelineDays(days), cursor: reports.docs.at(-1) || null, hasMore: reports.docs.length === DAY_PAGE_SIZE, activeList };
}

export async function getVolleyTimeline(date) {
  if (!isTimelineDate(date)) throw Error("Escolha uma data válida.");
  const snapshot = await getDocs(query(collection(db, "volley_lists"), where("date", "==", date), limit(2)));
  if (snapshot.docs.length > 1) throw Error("Há mais de uma lista nessa data. Revise antes de exibir os resultados.");
  const day = snapshot.docs[0];
  return day ? { ...day.data(), id: day.id } : null;
}
