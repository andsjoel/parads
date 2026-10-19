import process from "node:process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { FieldValue } from "firebase-admin/firestore";
import {
  buildSequenceBackfill, sealBackfillPlan, applySequenceBackfill, snapshotVersion,
  SEQUENCE_BACKFILL_PROJECT,
} from "../server/sequenceRewardBackfill.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = new Map();
for (const argument of process.argv.slice(2)) {
  const [key, ...parts] = argument.split("=");
  if (!["--date", "--output", "--input", "--apply", "--approved-sha256", "--project"].includes(key) || args.has(key)) throw Error("Argumento inválido ou duplicado.");
  args.set(key, parts.join("=") || true);
}
function artifactPath(value) {
  if (typeof value !== "string") throw Error("Caminho de artefato obrigatório.");
  const target = resolve(root, value), base = resolve(root, ".firebase", "sequence-rewards");
  const path = relative(base, target);
  if (!path || path.startsWith("..") || isAbsolute(path) || !target.endsWith(".json")) throw Error("Artefatos devem ficar em .firebase/sequence-rewards/*.json (ignorado pelo Git).");
  return target;
}
const applying = args.has("--apply");
if (applying && (args.get("--apply") !== true || args.has("--date") || args.has("--output"))) throw Error("Aplicação exige --apply sem valor e somente os argumentos da prévia aprovada.");
if (!applying && ["--input", "--approved-sha256", "--project"].some((key) => args.has(key))) throw Error("A prévia aceita somente --date e --output.");
let manifest, output;
if (applying) {
  if (args.get("--project") !== SEQUENCE_BACKFILL_PROJECT || !/^[a-f0-9]{64}$/.test(args.get("--approved-sha256"))) throw Error("Aplicação exige projeto explícito e hash aprovado da prévia.");
  manifest = JSON.parse(await readFile(artifactPath(args.get("--input")), "utf8"));
} else {
  const date = args.get("--date");
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date) throw Error("Informe --date=AAAA-MM-DD. O padrão é somente leitura.");
  output = artifactPath(args.get("--output") || `.firebase/sequence-rewards/${date}-preview.json`);
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw Error("Não misture este comando operacional com os testes emulados.");
Object.assign(process.env, loadEnv("development", root, ["FIREBASE_ADMIN_"]));
const { getAdminServices } = await import("../server/firebaseAdmin.js");
const { db } = getAdminServices();
if (applying) {
  console.log(JSON.stringify(await applySequenceBackfill(db, manifest, args.get("--approved-sha256"), () => FieldValue.serverTimestamp())));
} else {
  const snapshot = await db.collection("volley_lists").where("date", "==", args.get("--date")).limit(2)
    .select("date", "games", "matchPlayers", "history").get();
  if (snapshot.size !== 1) throw Error("Esperada exatamente uma lista nessa data; nenhuma gravação realizada.");
  const day = snapshot.docs[0], list = day.data();
  const ids = [...new Set((list.matchPlayers || []).map((player) => player.userId).filter(Boolean))];
  if (!ids.length || ids.length > 100) throw Error("Quantidade de participantes fora do escopo seguro.");
  const stats = await db.getAll(...ids.map((uid) => db.doc(`user_stats/${uid}`)), {
    fieldMask: ["sequenceMilestoneHits", "claimedSequenceMilestoneHits", "claimedSequenceRewardAmounts", "sequenceRewardBackfills"],
  });
  manifest = sealBackfillPlan(buildSequenceBackfill({ list, listId: day.id, date: list.date,
    listUpdateTime: snapshotVersion(day), statsByUserId: new Map(stats.map((item) => [item.id,
      { stats: item.data(), updateTime: snapshotVersion(item) }])) }));
  await mkdir(resolve(root, ".firebase", "sequence-rewards"), { recursive: true });
  await writeFile(output, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ mode: "READ_ONLY_PREVIEW", output: relative(root, output), digest: manifest.digest,
    games: manifest.games, ...manifest.summary, blocked: manifest.blocked }, null, 2));
}
