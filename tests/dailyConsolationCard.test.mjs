import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { create, act } from "react-test-renderer";
import { transformWithEsbuild } from "vite";
import { maintenanceCompensation } from "../src/data/feedCompensation.js";

async function fixture(claim, { compensation = false, stats = {} } = {}) {
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  const listeners = new Map();
  let focusRestored = false, scrollRestored = false;
  globalThis.document = { body: { style: { cssText: "original-body" } }, documentElement: { style: { overflow: "auto" } },
    activeElement: { focus() { focusRestored = true; } },
    addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: (type) => listeners.delete(type) };
  globalThis.window = { scrollY: 230, scrollTo: (x, y) => { scrollRestored = x === 0 && y === 230; } };
  let notify = () => {};
  const auth = { userData: { id: "self", progression: { coins: 8 } }, sessionData: { stats },
    updateSessionData: (changes) => { auth.userData = changes.user; auth.sessionData = { ...auth.sessionData, stats: changes.stats }; notify(); } };
  let calls = 0;
  const modules = {
    react: React, "react/jsx-runtime": jsx, "react-dom": { createPortal: (children) => children },
    "lucide-react": Object.fromEntries(["AlertCircle", "ArrowUpRight", "Check", "Gamepad2", "HeartHandshake", "Percent", "TrendingDown", "X"].map((key) => [key, "svg"])),
    "../contexts/AuthContext": { useAuth: () => auth },
    "../services/dailyConsolationService": {
      claimDailyConsolation: async (listId) => { calls++; assert.equal(compensation, false); assert.equal(listId, "day"); return claim(); },
      claimMaintenanceCompensation: async () => { calls++; assert.equal(compensation, true); return claim(); },
    },
    "../data/feedCompensation": { maintenanceCompensation },
    "../assets/app-backgrounds/manutencao-1.png": { default: "maintenance.png" },
    "../assets/achievements/coin.png": { default: "coin.png" }, "../styles/dailyConsolation.css": {},
  };
  const { code } = await transformWithEsbuild(await readFile(new URL("../src/components/DailyConsolationCard.jsx", import.meta.url), "utf8"), "DailyConsolationCard.jsx", { jsx: "automatic" });
  const entry = new SourceTextModule(code);
  await entry.link((specifier) => {
    const values = modules[specifier]; assert.ok(values, specifier);
    return new SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); });
  });
  await entry.evaluate();
  let view;
  await act(async () => { view = create(React.createElement(entry.namespace.default, { post: compensation ? maintenanceCompensation : { payload: {
    date: "2026-10-18", listId: "day", recipients: { self: { games: 7, losses: 5, reward: 1 } },
  } } })); });
  notify = () => view.update(React.createElement(entry.namespace.default, view.root.props));
  return { view, auth, get calls() { return calls; }, listeners,
    open: async () => act(async () => view.root.findByType("button").props.onClick()),
    get restored() { return focusRestored && scrollRestored; },
    cleanup: async () => { await act(async () => view.unmount()); globalThis.document = previousDocument; globalThis.window = previousWindow; } };
}

test("reward modal shows the copy and three metrics, locks scrolling and immediately updates balance on claim", async () => {
  const f = await fixture(async () => ({ coins: 9, stats: { dailyConsolationClaims: { day: { reward: 1 } } } }));
  try {
    await f.open();
    const dialog = f.view.root.findByProps({ role: "dialog" });
    const output = JSON.stringify(dialog.toJSON?.() || f.view.toJSON());
    assert.match(output, /Políticas Sociais/);
    assert.match(output, /Por aqui tratamos quem perde quase igual quem ganha: como se fosse gente\./);
    assert.equal(dialog.findAll((node) => node.props.className === "feed-report-metric daily-consolation-metric").length, 3);
    assert.match(output, /71,4%/);
    assert.equal(document.body.style.position, "fixed");
    assert.equal(document.body.style.top, "-230px");
    assert.equal(document.documentElement.style.overflow, "hidden");
    const button = dialog.findAllByType("button").find((node) => node.children.includes("resgatar"));
    await act(async () => button.props.onClick());
    assert.equal(f.auth.userData.progression.coins, 9);
    assert.equal(f.calls, 1);
    assert.equal(f.view.toJSON(), null);
    assert.equal(f.view.root.findAllByProps({ "aria-label": "Recompensa disponível" }).length, 0);
    assert.equal(f.view.root.findAllByProps({ role: "dialog" }).length, 0);
    assert.equal(document.body.style.cssText, "original-body");
    assert.equal(document.documentElement.style.overflow, "auto");
    assert.equal(f.restored, true);
  } finally { await f.cleanup(); }
});

test("pending claim suppresses double clicks; failure keeps the reward available and allows retry", async () => {
  let reject;
  const f = await fixture(() => new Promise((_resolve, fail) => { reject = fail; }));
  try {
    await f.open();
    const button = f.view.root.findAllByType("button").find((node) => node.children.includes("resgatar"));
    let pending;
    await act(async () => { pending = button.props.onClick(); button.props.onClick(); });
    assert.equal(f.calls, 1);
    assert.ok(f.view.root.findAllByType("button").some((node) => node.props.disabled && node.children.includes("resgatando...")));
    await act(async () => { reject(Error("Falha temporária")); await pending; });
    assert.equal(f.auth.userData.progression.coins, 8);
    assert.equal(f.view.root.findByProps({ role: "alert" }).children[0], "Falha temporária");
    assert.ok(f.view.root.findAllByType("button").some((node) => !node.props.disabled && node.children.includes("resgatar")));
  } finally { await f.cleanup(); }
});

test("compensation shows the mascot, copy and one coin; claiming removes the card and updates the balance", async () => {
  const f = await fixture(async () => ({ coins: 9, stats: { feedCompensationClaims: { [maintenanceCompensation.id]: { reward: 1 } } } }), { compensation: true });
  try {
    await f.open();
    const output = JSON.stringify(f.view.toJSON());
    assert.match(output, /Me perdoa/);
    assert.match(output, /Desculpe pelo transtorno\. Puxei o cabo sem querer\./);
    assert.match(output, /Aqui está uma compensação pelos problemas técnicos\./);
    assert.equal(f.view.root.findByProps({ alt: "Mascote pedindo desculpas pela manutenção" }).props.src, "maintenance.png");
    assert.equal(f.view.root.findAll((node) => node.props.className === "feed-report-metric daily-consolation-metric").length, 0);
    await act(async () => f.view.root.findAllByType("button").find((node) => node.children.includes("resgatar")).props.onClick());
    assert.equal(f.calls, 1);
    assert.equal(f.auth.userData.progression.coins, 9);
    assert.equal(f.view.toJSON(), null);
    assert.equal(f.restored, true);
  } finally { await f.cleanup(); }
});

test("already redeemed rewards stay hidden after remount, independently for each category", async () => {
  for (const compensation of [false, true]) {
    const stats = compensation ? { feedCompensationClaims: { [maintenanceCompensation.id]: { reward: 1 } } }
      : { dailyConsolationClaims: { day: { reward: 1 } } };
    const f = await fixture(() => { throw Error("Already redeemed"); }, { compensation, stats });
    try { assert.equal(f.view.toJSON(), null); assert.equal(f.calls, 0); }
    finally { await f.cleanup(); }
  }
});
