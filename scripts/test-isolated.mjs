import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { readdir, readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { TEST_PROJECT_ID, EMULATOR_HOSTS, isolatedEnvironment } from "../tests/support/isolation.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 24 || (nodeMajor === 24 && nodeMinor < 12)) throw new Error("TEST_ISOLATION: Node 24.12+ required");
const mode = process.argv[2];
if (process.argv.length !== 3 || !["unit", "emulator", "integration"].includes(mode)) {
  throw new Error("Use npm test or npm run test:emulators; custom projects/hosts are forbidden");
}
const env = isolatedEnvironment(process.env, mode === "unit" ? "unit" : "emulator");
const config = JSON.parse(await readFile(join(root, "firebase.emulators.json"), "utf8"));
for (const [service, key] of [["auth", "FIREBASE_AUTH_EMULATOR_HOST"], ["firestore", "FIRESTORE_EMULATOR_HOST"], ["hub", "FIREBASE_EMULATOR_HUB"]]) {
  const { host, port } = config.emulators[service];
  if (`${host}:${port}` !== EMULATOR_HOSTS[key]) throw new Error("TEST_ISOLATION: emulator config mismatch");
}
if (config.firestore.rules !== "firestore.rules" || config.emulators.ui.enabled !== false || config.emulators.singleProjectMode !== true) {
  throw new Error("TEST_ISOLATION: unexpected emulator configuration");
}

let args;
if (mode === "emulator") {
  // A portable JDK can be supplied without changing the system Java installation.
  const tools = join(root, ".test-tools");
  const portable = (await readdir(tools, { withFileTypes: true }).catch(() => [])).find((entry) => entry.isDirectory() && entry.name.startsWith("jdk-21"));
  if (portable) {
    env.JAVA_HOME = join(tools, portable.name);
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";
    env[pathKey] = `${join(env.JAVA_HOME, "bin")}${process.platform === "win32" ? ";" : ":"}${env[pathKey] || ""}`;
  }
  const java = spawnSync(env.JAVA_HOME ? join(env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java") : "java", ["-version"], { env, encoding: "utf8" });
  const major = Number(/version "(\d+)/.exec(java.stderr || java.stdout || "")?.[1]);
  if (java.error || java.status !== 0 || major < 21 || !major) throw new Error("TEST_ISOLATION: Java 21+ required; no emulator or test was started");
  await mkdir(join(root, ".firebase", "test-config"), { recursive: true });
  env.XDG_CONFIG_HOME = join(root, ".firebase", "test-config");
  env.FIREBASE_EMULATORS_PATH = join(root, ".firebase", "emulators");
  args = [join(root, "node_modules/firebase-tools/lib/bin/firebase.js"), "emulators:exec", "--only", "auth,firestore", "--project", TEST_PROJECT_ID, "--config", "firebase.emulators.json", "--non-interactive", 'node scripts/test-isolated.mjs integration'];
} else {
  const directory = mode === "unit" ? "tests" : "tests/emulator";
  const files = (await readdir(join(root, directory))).filter((name) => name.endsWith(".test.mjs")).sort().map((name) => join(directory, name));
  if (!files.length) throw new Error("No test files found");
  env.NODE_OPTIONS = `--import=${new URL("../tests/support/network-guard.mjs", import.meta.url).href}`;
  args = ["--experimental-vm-modules", "--import", new URL("../tests/support/network-guard.mjs", import.meta.url).href, "--test", "--test-concurrency=1", ...files];
}

const child = spawn(process.execPath, args, { cwd: resolve(root), env, stdio: "inherit" });
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
