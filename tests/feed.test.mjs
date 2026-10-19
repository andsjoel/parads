import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { create, act } from "react-test-renderer";
import { transformWithEsbuild } from "vite";
import { matchTimelinePath } from "../src/utils/matchTimeline.js";
import { maintenanceCompensation } from "../src/data/feedCompensation.js";

async function feedFixture(stats = { feedCompensationClaims: { [maintenanceCompensation.id]: { reward: 1 } } }) {
  let subscription, stopped = false;
  const previews = [];
  const source = await readFile(new URL("../src/pages/Feed.jsx", import.meta.url), "utf8");
  const { code } = await transformWithEsbuild(source, "Feed.jsx", { jsx: "automatic" });
  const modules = {
    react: React,
    "react/jsx-runtime": jsx,
    "lucide-react": { ArrowUpRight: "svg", BarChart3: "svg", CalendarDays: "svg", Gamepad2: "svg", Route: "svg", Trophy: "svg" },
    "react-router-dom": { Link: ({ to, children, ...props }) => React.createElement("a", { href: to, ...props }, children) },
    "../utils/matchTimeline": { matchTimelinePath },
    "../components/FeedBannerCarousel": { default: () => React.createElement("aside", { "data-testid": "banner" }) },
    "../components/DailyConsolationCard": { default: ({ post }) => React.createElement("article", { "data-testid": post.type === "maintenance_compensation" ? "compensation" : "consolation" }, post.title) },
    "../data/feedCompensation": { maintenanceCompensation },
    "../assets/app-backgrounds/bg-geral.png": { default: "background.png" },
    "../components/OrbitLoader": { default: () => React.createElement("span", { role: "status" }) },
    "../contexts/AuthContext": { useAuth: () => ({ userData: { id: "self" }, sessionData: { stats } }) },
    "../hooks/usePublicProfiles": {
      usePublicProfilePreviews: (ids) => { previews.push(ids); return {}; },
      useSelectedPublicProfile: () => ({ bundle: {}, loading: false }),
    },
    "../services/volleyReportService": { subscribeFeedPosts: (callbacks) => {
      subscription = callbacks;
      return () => { stopped = true; };
    } },
    "../services/volleyListService": { buildMockProfileBundle: () => ({}) },
    "../components/profile/ProfileCardPreview": {
      PlayerMiniCard: ({ person, onOpen }) => React.createElement("button", { onClick: onOpen }, person.name),
      ProfileStickerModal: ({ onClose }) => React.createElement("div", { role: "dialog" }, React.createElement("button", { onClick: onClose }, "Fechar")),
    },
  };
  const entry = new SourceTextModule(code);
  await entry.link((specifier) => {
    const values = modules[specifier];
    assert.ok(values, `Unexpected feed dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await entry.evaluate();
  let view;
  await act(async () => { view = create(React.createElement(entry.namespace.default)); });
  return {
    view, previews, get stopped() { return stopped; },
    deliver: async (posts) => { await act(async () => subscription.onChange(posts)); },
    close: async () => { await act(async () => view.unmount()); },
  };
}

test("empty feed keeps the banner and background without a guide, ADM lookup or messages", async () => {
  const f = await feedFixture();
  assert.equal(f.view.root.findAllByProps({ role: "status" }).length, 1);
  await f.deliver([]);
  assert.equal(f.view.root.findAllByProps({ role: "status" }).length, 0);
  assert.equal(f.view.root.findAllByProps({ "data-testid": "banner" }).length, 1);
  assert.equal(f.view.root.findAllByType("button").length, 0);
  assert.equal(f.view.root.findAllByProps({ role: "log" }).length, 0);
  assert.ok(f.previews.every((ids) => ids.length === 0));
  assert.equal(f.view.root.findByType("main").props.style.backgroundImage, "url(background.png)");
  await f.close();
  assert.equal(f.stopped, true);
});

test("published highlights still update live and open and close player cards", async () => {
  const f = await feedFixture();
  await f.deliver([{ id: "day", type: "wins", payload: {
    date: "2026-10-19", ranking: [{ userId: "player", displayName: "Ana", wins: 3 }],
  } }]);
  assert.equal(f.view.root.findAllByType("article").length, 1);
  assert.ok(JSON.stringify(f.view.toJSON()).includes("Destaques do dia"));
  const player = f.view.root.findByType("button");
  await act(async () => player.props.onClick());
  assert.equal(f.view.root.findAllByProps({ role: "dialog" }).length, 1);
  await act(async () => f.view.root.findAllByType("button").find((button) => button.children.includes("Fechar")).props.onClick());
  assert.equal(f.view.root.findAllByProps({ role: "dialog" }).length, 0);
  await f.deliver([]);
  assert.equal(f.view.root.findAllByType("article").length, 0);
  assert.equal(f.view.root.findAllByType("button").length, 0);
  await f.close();
});

test("map announcement links to the exact date without fetching any player profiles", async () => {
  const f = await feedFixture();
  await f.deliver([{ id: "match-map_day", type: "match_map", title: "Mapa de Jogos - 18/10", payload: { date: "2026-10-18", listId: "day", totalGames: 15 } }]);
  assert.equal(f.view.root.findByType("a").props.href, "/matches-map?date=2026-10-18");
  assert.ok(JSON.stringify(f.view.toJSON()).includes("Veja o histórico dos jogos desse dia."));
  assert.ok(f.previews.every((ids) => ids.length === 0));
  await f.close();
});

test("daily consolation feed card is rendered only for an eligible account", async () => {
  const f = await feedFixture();
  await f.deliver([{ id: "reward-other", type: "daily_consolation", payload: { recipients: { other: { reward: 2 } } } }]);
  assert.equal(f.view.root.findAllByType("article").length, 0);
  await f.deliver([{ id: "reward-self", type: "daily_consolation", title: "Dia ruim?", payload: { recipients: { self: { reward: 1 } } } }]);
  assert.equal(f.view.root.findAllByProps({ "data-testid": "consolation" }).length, 1);
  assert.ok(f.previews.every((ids) => ids.length === 0));
  await f.close();
});

test("maintenance compensation appears without extra queries and redeemed daily rewards stay hidden", async () => {
  const f = await feedFixture({ dailyConsolationClaims: { day: { reward: 1 } } });
  await f.deliver([{ id: "reward-self", type: "daily_consolation", payload: { listId: "day", recipients: { self: { reward: 1 } } } }]);
  assert.equal(f.view.root.findAllByProps({ "data-testid": "compensation" }).length, 1);
  assert.equal(f.view.root.findAllByProps({ "data-testid": "consolation" }).length, 0);
  assert.ok(f.previews.every((ids) => ids.length === 0));
  await f.close();
  const source = await readFile(new URL("../src/pages/Feed.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localPreview|local-consolation-preview|listId: "local-preview"/);
});

test("retired guide styles, ADM query and external message font are removed", async () => {
  const [css, service, cache, html] = await Promise.all([
    "../src/styles/global.css", "../src/services/publicProfileService.js", "../src/utils/publicProfileCache.js", "../index.html",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  assert.doesNotMatch(css, /feed-guide|feed-member-guide|feed-page--welcome/);
  assert.doesNotMatch(service, /getGuideAdminProfile/);
  assert.doesNotMatch(cache, /guide-admin/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|Nunito/);
});
