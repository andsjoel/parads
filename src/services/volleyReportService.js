import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

export function subscribeVolleyDashboard({ onChange, onError }) {
  let metrics = null;
  let report = null;
  const emit = () => onChange({ metrics, report });

  const stopMetrics = onSnapshot(
    doc(db, "app_metrics", "volley"),
    (snapshot) => {
      metrics = snapshot.exists() ? snapshot.data() : null;
      emit();
    },
    onError,
  );
  const stopReport = onSnapshot(
    query(collection(db, "volley_reports"), orderBy("closedAt", "desc"), limit(1)),
    (snapshot) => {
      const latest = snapshot.docs[0];
      report = latest ? { id: latest.id, ...latest.data() } : null;
      emit();
    },
    onError,
  );

  return () => {
    stopMetrics();
    stopReport();
  };
}

export async function publishVolleyReportCard({ type, title, payload, reportId, createdBy }) {
  await addDoc(collection(db, "feed_posts"), {
    kind: "volley_report",
    type,
    title,
    payload,
    reportId: reportId || null,
    createdBy: createdBy || null,
    createdAt: serverTimestamp(),
  });
}

export async function removeVolleyReportCard(postId) {
  if (!postId) return;
  await deleteDoc(doc(db, "feed_posts", postId));
}

export function subscribeFeedPosts({ onChange, onError }) {
  return onSnapshot(
    query(collection(db, "feed_posts"), orderBy("createdAt", "desc"), limit(30)),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError,
  );
}
