import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { create, act } from "react-test-renderer";
import { transformWithEsbuild } from "vite";
import * as missions from "../src/data/profileMissions.js";

async function fixture(stats, activeStat = "currentStreak") {
  const context = createContext({ document: { addEventListener() {}, removeEventListener() {}, body: { style: {} } } });
  const source = await readFile(new URL("../src/components/profile/ProfileStats.jsx", import.meta.url), "utf8");
  const { code } = await transformWithEsbuild(source, "ProfileStats.jsx", { jsx: "automatic" });
  const entry = new SourceTextModule(code, { context });
  await entry.link((specifier) => {
    let values;
    if (specifier === "react") values = React;
    else if (specifier === "react/jsx-runtime") values = jsx;
    else if (specifier === "react-dom") values = { createPortal: (node) => node };
    else if (specifier === "lucide-react") values = Object.fromEntries(
      ["AlertCircle", "CalendarDays", "Check", "Crown", "Flame", "Swords", "Trophy", "X"].map((name) => [name, `icon-${name}`]),
    );
    else if (specifier.endsWith(".png")) values = { default: "coin.png" };
    else if (specifier === "../../data/profileMissions") values = missions;
    else throw Error(`Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await entry.evaluate();
  const props = { stats, activeStat, missionsEnabled: true, onSelectStat() {}, onClaimRewards() {} };
  let view;
  await act(async () => { view = create(React.createElement(entry.namespace.default, props)); });
  const hasClass = (node, name) => node.props.className?.split(" ").includes(name);
  return {
    view,
    row: () => view.root.findAll((node) => node.type === "div" && hasClass(node, "profile-mission-row"))[0],
    claim: () => view.root.findAll((node) => node.type === "button" && hasClass(node, "profile-mission-claim"))[0],
    update: async (stats) => { await act(async () => view.update(React.createElement(entry.namespace.default, { ...props, stats }))); },
    close: async () => { await act(async () => view.unmount()); },
  };
}

const sequenceStats = (hits, claims, current = 2) => ({
  currentStreak: current, currentWinStreak: current,
  sequenceMilestoneHits: { 2: hits }, claimedSequenceMilestoneHits: { 2: claims },
});

test("claimed milestone stays highlighted and checked while its streak is still active", async () => {
  const f = await fixture(sequenceStats(2, 2));
  assert.match(f.row().props.className, /--completed/);
  assert.match(f.row().props.className, /--claimed/);
  assert.equal(f.view.root.findAllByType("icon-Check").length, 1);
  assert.equal(f.claim().props.disabled, true);
  const more = f.view.root.findAllByType("button").find((button) => button.children.includes("ver mais"));
  await act(async () => more.props.onClick());
  assert.ok(f.view.root.findAllByType("p").some((node) => node.children.join("") === "1 missões concluídas"));
  await f.close();
});

test("claim shows confirmation until a loss; a new run makes the milestone redeemable again", async () => {
  const f = await fixture(sequenceStats(2, 1));
  assert.match(f.row().props.className, /--completed/);
  assert.equal(f.claim().props.disabled, false);
  await f.update(sequenceStats(2, 2));
  assert.match(f.row().props.className, /--claimed/);
  assert.equal(f.claim().props.disabled, true);
  await f.update(sequenceStats(2, 2, 0));
  assert.doesNotMatch(f.row().props.className, /--completed|--claimed/);
  await f.update(sequenceStats(3, 2));
  assert.match(f.row().props.className, /--completed/);
  assert.equal(f.claim().props.disabled, false);
  assert.equal(f.view.root.findAllByType("icon-Check").length, 0);
  await f.close();
});

test("third win keeps the redeemed two-win milestone and unlocks the three-win prize", async () => {
  const f = await fixture(sequenceStats(2, 2));
  await f.update({ ...sequenceStats(2, 2, 3), sequenceMilestoneHits: { 2: 2, 3: 1 } });
  const rows = f.view.root.findAll((node) => node.type === "div" && node.props.className?.split(" ").includes("profile-mission-row"));
  assert.match(rows[0].props.className, /--claimed/);
  assert.match(rows[1].props.className, /--completed/);
  assert.doesNotMatch(rows[1].props.className, /--claimed/);
  assert.equal(f.claim().props.disabled, false);
  await f.update({ ...sequenceStats(2, 2, 3), sequenceMilestoneHits: { 2: 2, 3: 1 },
    claimedSequenceMilestoneHits: { 2: 2, 3: 1 }, claimedSequenceRewardAmounts: { 3: 1 } });
  assert.equal(f.view.root.findAllByType("icon-Check").length, 2);
  assert.equal(f.claim().props.disabled, true);
  await f.update({ ...sequenceStats(2, 2, 0), sequenceMilestoneHits: { 2: 2, 3: 1 },
    claimedSequenceMilestoneHits: { 2: 2, 3: 1 }, claimedSequenceRewardAmounts: { 3: 1 } });
  assert.equal(f.view.root.findAllByType("icon-Check").length, 0);
  await f.close();
});

test("losing removes the active highlight but preserves previously earned unclaimed coins", async () => {
  const stats = sequenceStats(2, 1, 0);
  const copy = structuredClone(stats);
  const f = await fixture(stats);
  assert.doesNotMatch(f.row().props.className, /--completed|--claimed/);
  assert.equal(f.claim().props.disabled, false);
  assert.equal(missions.getPendingSequenceRewards(stats)[0].totalReward, 1);
  assert.deepEqual(stats, copy);
  await f.close();
});

test("non-repeatable missions retain completed and claimed confirmation", async () => {
  const f = await fixture({ wins: 2, claimedMissionIds: ["wins-2"] }, "wins");
  assert.match(f.row().props.className, /--completed/);
  assert.match(f.row().props.className, /--claimed/);
  assert.equal(f.row().findAllByType("icon-Check").length, 1);
  assert.equal(f.claim().props.disabled, true);
  await f.close();
});
