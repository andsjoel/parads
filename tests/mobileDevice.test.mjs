import assert from "node:assert/strict";
import { test } from "node:test";
import { isMobileDevice } from "../src/utils/mobileDevice.js";

test("phones and tablets keep access regardless of viewport or orientation", () => {
  for (const userAgent of [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile",
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",
    "Mozilla/5.0 (Linux; Android 14; Tablet)",
  ]) {
    assert.equal(isMobileDevice({ userAgent }), true, userAgent);
  }
  assert.equal(isMobileDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", maxTouchPoints: 5 }), true);
  assert.equal(isMobileDevice({ userAgent: "", userAgentData: { mobile: true } }), true);
});

test("desktops, including touch laptops and narrow windows, stay blocked", () => {
  for (const userAgent of [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
    "Mozilla/5.0 (X11; Linux x86_64)",
  ]) {
    assert.equal(isMobileDevice({ userAgent, maxTouchPoints: userAgent.includes("Windows") ? 10 : 0, userAgentData: { mobile: false } }), false);
  }
  assert.equal(isMobileDevice(undefined), false);
  assert.equal(isMobileDevice({}), false);
});
