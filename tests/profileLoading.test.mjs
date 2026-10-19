import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { create, act } from "react-test-renderer";
import { transformWithEsbuild } from "vite";

async function fixture(auth = {}) {
  let nextFrame = 0, headerMounts = 0;
  const frames = new Map();
  const context = createContext({ window: {
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  } });
  const session = { userData: { id: "member" }, sessionData: {}, updateSessionData() {}, loadingAuth: false, ...auth };
  const source = await readFile(new URL("../src/pages/Profile.jsx", import.meta.url), "utf8");
  const { code } = await transformWithEsbuild(source, "Profile.jsx", { jsx: "automatic" });
  const entry = new SourceTextModule(code, { context });
  await entry.link((specifier) => {
    let values;
    if (specifier === "react") values = React;
    else if (specifier === "react/jsx-runtime") values = jsx;
    else if (specifier.includes("AuthContext")) values = { useAuth: () => session };
    else if (specifier.includes("OrbitLoader")) values = { default: () => React.createElement("span", { role: "status" }, "Carregando") };
    else if (specifier.includes("ProfileHeader")) values = { default: () => { headerMounts++; return React.createElement("header", null, "Perfil"); } };
    else if (specifier.includes("Service")) values = {
      claimProfileMissionRewards: () => { throw Error("Unexpected request"); },
      claimPromotionalMission: () => { throw Error("Unexpected request"); },
    };
    else if (specifier.endsWith(".png")) values = { default: "general-background.png" };
    else values = { default: () => null };
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await entry.evaluate();
  let view;
  await act(async () => { view = create(React.createElement(entry.namespace.default)); });
  return {
    view, session, get mounts() { return headerMounts; }, get pendingFrames() { return frames.size; },
    frame: async () => { const callbacks = [...frames.values()]; frames.clear(); await act(async () => callbacks.forEach((callback) => callback())); },
    refresh: async () => { await act(async () => view.update(React.createElement(entry.namespace.default))); },
    close: async () => { await act(async () => view.unmount()); },
  };
}

test("cached profile paints a loading state before mounting the profile content", async () => {
  const f = await fixture();
  assert.equal(f.view.root.findAllByProps({ role: "status" }).length, 1);
  assert.equal(f.view.root.findByType("main").props.style.backgroundImage, "url(general-background.png)");
  assert.equal(f.mounts, 0);
  await f.frame();
  assert.equal(f.mounts, 0);
  await f.frame();
  assert.equal(f.mounts, 1);
  assert.equal(f.view.root.findAllByProps({ role: "status" }).length, 0);
  await f.close();
});

test("profile stays loading until authentication data is ready without reloading the session", async () => {
  const f = await fixture({ loadingAuth: true, userData: null });
  await f.frame(); await f.frame();
  assert.equal(f.mounts, 0);
  assert.equal(f.view.root.findAllByProps({ role: "status" }).length, 1);
  f.session.loadingAuth = false;
  f.session.userData = { id: "member" };
  await f.refresh();
  assert.ok(f.mounts > 0);
  assert.equal(f.view.root.findAllByProps({ role: "status" }).length, 0);
  await f.close();
});

test("leaving the profile cancels pending rendering on either frame", async () => {
  for (const firstFrame of [false, true]) {
    const f = await fixture();
    if (firstFrame) await f.frame();
    assert.equal(f.pendingFrames, 1);
    await f.close();
    assert.equal(f.pendingFrames, 0);
    await f.frame();
    assert.equal(f.mounts, 0);
  }
});
