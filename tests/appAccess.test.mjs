import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import { transformWithEsbuild } from "vite";
import { MAINTENANCE_ENABLED } from "../src/config/appStatus.js";

const source = await readFile(new URL("../src/app/App.jsx", import.meta.url), "utf8");
const { code } = await transformWithEsbuild(source, "App.jsx", { jsx: "automatic" });

async function renderApp({ maintenance, mobile, pathname }) {
  const context = createContext({ window: { navigator: {}, location: { pathname } } });
  const components = {
    "../routes/AppRoutes": "Routes",
    "../components/DesktopBlocked": "DesktopBlocked",
    "../components/MaintenanceScreen": "MaintenanceScreen",
  };
  const entry = new SourceTextModule(code, { context });
  await entry.link(async (specifier) => {
    let exports;
    if (specifier === "react/jsx-runtime") exports = { jsx: (type, props) => ({ type, props }) };
    else if (specifier === "../config/appStatus") exports = { MAINTENANCE_ENABLED: maintenance };
    else if (specifier === "../utils/mobileDevice") exports = { isMobileDevice: () => mobile };
    else if (specifier === "../contexts/AuthContext") exports = { AuthProvider: "AuthProvider" };
    else if (components[specifier]) exports = { default: components[specifier] };
    else throw new Error(`Unexpected import: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await entry.evaluate();
  return entry.namespace.default();
}

test("maintenance is enabled for this release", () => {
  assert.equal(MAINTENANCE_ENABLED, true);
});

test("only the local development environment bypasses maintenance", async () => {
  const config = await readFile(new URL("../src/config/appStatus.js", import.meta.url), "utf8");
  for (const dev of [true, false, undefined]) {
    const entry = new SourceTextModule(config, {
      initializeImportMeta(meta) { meta.env = { DEV: dev }; },
    });
    await entry.link(() => { throw new Error("Unexpected config dependency"); });
    await entry.evaluate();
    assert.equal(entry.namespace.MAINTENANCE_ENABLED, dev !== true);
  }
});

test("maintenance overrides every route and desktop blocking without mounting authentication", async () => {
  for (const pathname of ["/", "/login", "/list", "/matches", "/profile", "/admin/volley-list", "/admin/matches", "/unknown"]) {
    for (const mobile of [true, false]) {
      const result = await renderApp({ maintenance: true, mobile, pathname });
      assert.equal(result.type, "MaintenanceScreen", pathname);
      assert.equal(result.props.children, undefined);
    }
  }
});

test("disabling maintenance restores the existing mobile and desktop flow", async () => {
  const mobile = await renderApp({ maintenance: false, mobile: true, pathname: "/list" });
  assert.equal(mobile.type, "AuthProvider");
  assert.equal(mobile.props.children.type, "Routes");
  const desktop = await renderApp({ maintenance: false, mobile: false, pathname: "/" });
  assert.equal(desktop.type, "DesktopBlocked");
});
