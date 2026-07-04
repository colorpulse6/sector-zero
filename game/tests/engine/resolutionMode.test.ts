import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePersistedMode } from "../../app/components/engine/fpRender";

// Pins the persisted-resolution contract (fpRender/index.ts). The load-bearing
// case is "auto": the AUTOMATIC downgrade persists "auto" (not "half"), and
// these tests prove that value starts the next session at FULL and re-probes —
// which is what stops a public player who trips one transient downgrade from
// being locked to half-res forever (the DevPanel override is dev-only).

test('persisted "auto" starts at full and re-probes (the value an automatic downgrade writes)', () => {
  assert.deepEqual(resolvePersistedMode("auto"), { resMode: "auto", locked: "full" });
});

test('explicit "half" is sticky — starts locked at half', () => {
  assert.deepEqual(resolvePersistedMode("half"), { resMode: "half", locked: "half" });
});

test('explicit "full" is sticky — starts locked at full', () => {
  assert.deepEqual(resolvePersistedMode("full"), { resMode: "full", locked: "full" });
});

test("first visit (null) and unrecognized values fall back to AUTO at full", () => {
  assert.deepEqual(resolvePersistedMode(null), { resMode: "auto", locked: "full" });
  assert.deepEqual(resolvePersistedMode("garbage"), { resMode: "auto", locked: "full" });
  assert.deepEqual(resolvePersistedMode(""), { resMode: "auto", locked: "full" });
});
