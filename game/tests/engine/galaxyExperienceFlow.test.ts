import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attemptCanonicalPersistence,
  attemptCanonicalTransitionPersistence as persistTransition,
  beginGalaxyExperience,
  galaxyCloseTransition,
  experienceReturnLabel,
  galaxyPoiRecoverySurface,
  isInteractiveKeyboardTarget,
  legacyProgressionSnapshot,
  mapSurfaceForExperience,
  operationSurfaceLabel,
  returnSurfaceForOperation,
} from "../../app/components/engine/galaxy/experienceFlow";
import { migrateSave } from "../../app/components/engine/save";
import type { SaveData } from "../../app/components/engine/types";
import {
  createOutcomeEnvelope,
  type CanonicalSaveStore,
} from "../../app/components/engine/missionOutcome";
import { planRoute } from "../../app/components/engine/galaxy/routePlanner";
import { commitTravel } from "../../app/components/engine/galaxy/travelResolver";

function legacyFixture() {
  return migrateSave({
    currentWorld: 6,
    levels: { "5-3": { completed: true, stars: 3, highScore: 42_000 } },
    credits: 9_999,
    xp: 2_400,
    completedQuests: ["q-reyes-1-1"],
    materials: ["phase-crystal"],
    activeExperience: "legacy",
    galaxyRun: null,
  });
}

test("beginning a galaxy experience creates a run without changing legacy progression", () => {
  const legacy = legacyFixture();
  const legacyBefore = legacyProgressionSnapshot(legacy);

  const begun = beginGalaxyExperience(legacy);

  assert.equal(begun.activeExperience, "galaxy");
  assert.notEqual(begun.galaxyRun, null);
  assert.deepEqual(legacyProgressionSnapshot(begun), legacyBefore);
});

test("beginning an existing galaxy experience resumes its canonical run", () => {
  const begun = beginGalaxyExperience(legacyFixture());
  assert.ok(begun.galaxyRun);
  const resumedSave = {
    ...begun,
    activeExperience: "legacy" as const,
    galaxyRun: { ...begun.galaxyRun, worldCycle: 17 },
  };

  const resumed = beginGalaxyExperience(resumedSave);

  assert.equal(resumed.activeExperience, "galaxy");
  assert.equal(resumed.galaxyRun?.worldCycle, 17);
  assert.deepEqual(
    legacyProgressionSnapshot(resumed),
    legacyProgressionSnapshot(resumedSave),
  );
});

test("experience selector routes legacy to the numbered map and galaxy to the Atlas", () => {
  assert.equal(mapSurfaceForExperience("legacy"), "legacy_star_map");
  assert.equal(mapSurfaceForExperience("galaxy"), "galaxy_atlas");
});

test("closing the Galaxy Atlas exits to the selector without exposing Legacy launchers", () => {
  assert.deepEqual(galaxyCloseTransition(), {
    surface: "experience_selector",
    clearGalaxyOverlays: true,
    legacyLaunchersReachable: false,
  });
});

test("a galaxy operation returns to the Atlas without changing legacy progression", () => {
  const begun = beginGalaxyExperience(legacyFixture());
  assert.ok(begun.galaxyRun);
  const legacyBefore = legacyProgressionSnapshot(begun);
  const completed = {
    ...begun,
    galaxyRun: {
      ...begun.galaxyRun,
      worldCycle: begun.galaxyRun.worldCycle + 1,
      appliedOutcomeIds: ["operation:test:complete"],
    },
  };

  assert.equal(returnSurfaceForOperation(completed), "galaxy_atlas");
  assert.deepEqual(legacyProgressionSnapshot(completed), legacyBefore);
});

test("global game shortcuts yield to interactive controls and their descendants", () => {
  assert.equal(isInteractiveKeyboardTarget({ tagName: "BUTTON" }), true);
  assert.equal(isInteractiveKeyboardTarget({ tagName: "A", getAttribute: (name: string) => name === "href" ? "/atlas" : null }), true);
  assert.equal(isInteractiveKeyboardTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isInteractiveKeyboardTarget({ tagName: "DIV", getAttribute: (name: string) => name === "role" ? "button" : null }), true);
  assert.equal(isInteractiveKeyboardTarget({
    tagName: "SPAN",
    closest: (selector: string) => selector.includes("button") ? { tagName: "BUTTON" } : null,
  }), true);
  assert.equal(isInteractiveKeyboardTarget({ tagName: "CANVAS" }), false);
  assert.equal(isInteractiveKeyboardTarget(null), false);
});

test("operation surface labels override compatibility coordinates without changing legacy labels", () => {
  assert.equal(
    operationSurfaceLabel({ galaxyOperation: { id: "op:hostile-picket", label: "HOSTILE PICKET" } }, "Aurelia Belt — Level 1"),
    "HOSTILE PICKET",
  );
  assert.equal(operationSurfaceLabel({}, "Aurelia Belt — Level 1"), "Aurelia Belt — Level 1");
});

test("galaxy operation and POI exits consistently name the Atlas destination", () => {
  assert.equal(experienceReturnLabel(true), "RETURN TO ATLAS");
  assert.equal(experienceReturnLabel(false), "RETURN TO HUB");
});

test("canonical persistence reports failure without consuming a later retry", () => {
  const value = { cycle: 7 };
  let attempts = 0;
  const persist = (candidate: typeof value) => {
    attempts += 1;
    assert.strictEqual(candidate, value);
    if (attempts === 1) throw new Error("quota exceeded");
  };

  assert.deepEqual(attemptCanonicalPersistence(value, persist), { ok: false });
  assert.deepEqual(attemptCanonicalPersistence(value, persist), { ok: true });
  assert.equal(attempts, 2);
});

test("POI recovery exposes Atlas only when no unresolved or rejected journal exists", () => {
  assert.equal(galaxyPoiRecoverySurface({ ok: true, pending: null }), "atlas");
  assert.equal(galaxyPoiRecoverySurface({ ok: true, pending: { preparedFactId: "history:prepared" } }), "poi_outcome");
  assert.equal(galaxyPoiRecoverySurface({ ok: false }), "blocked");
});

function transitionFixture() {
  const base = beginGalaxyExperience(legacyFixture());
  base.materials.push("bio-fiber");
  assert.ok(base.galaxyRun);
  const route = planRoute(base.galaxyRun, { kind: "contact", contactId: "contact:ashfall" });
  assert.ok(route.ok);
  const committed = commitTravel(base, route.plan);
  assert.ok(committed.ok && committed.save);
  const candidate = committed.save;
  let current = structuredClone(base);
  const writes: SaveData[] = [];
  const store: CanonicalSaveStore = {
    read: () => structuredClone(current),
    write: (save) => {
      writes.push(structuredClone(save));
      current = structuredClone(save);
    },
  };
  return {
    base, candidate, store, writes,
    replaceCurrent: (save: SaveData) => { current = structuredClone(save); },
  };
}

test("canonical transition writes a detached candidate only after reading an unchanged base", () => {
  const { base, candidate, store } = transitionFixture();
  const events: string[] = [];
  const result = persistTransition({
    read: () => { events.push("read"); return store.read(); },
    write: (save) => {
      events.push("write");
      assert.notStrictEqual(save, candidate);
      assert.notStrictEqual(save.galaxyRun, candidate.galaxyRun);
      store.write(save);
    },
  }, base, candidate);
  assert.deepEqual(events, ["read", "write"]);
  assert.deepEqual(result, { status: "saved", save: candidate });
  assert.deepEqual(store.read(), candidate);
});

for (const [name, change] of [
  ["newer Legacy progress", (save: SaveData) => { save.credits += 10; save.saveRevision += 1; }],
  ["newer Galaxy progress", (save: SaveData) => { save.galaxyRun!.worldCycle += 1; save.saveRevision += 1; }],
  ["same-revision nested Legacy drift", (save: SaveData) => { save.levels["5-3"].highScore += 1; }],
  ["same-revision Galaxy drift", (save: SaveData) => { save.galaxyRun!.resources.supply += 1; }],
  ["same-revision array order drift", (save: SaveData) => { save.materials.reverse(); }],
] as const) {
  test(`canonical transition rejects ${name} without overwriting storage`, () => {
    const { base, candidate, store, writes, replaceCurrent } = transitionFixture();
    const latest = structuredClone(base);
    change(latest);
    replaceCurrent(latest);

    const result = persistTransition(store, base, candidate);

    assert.deepEqual(result, { status: "conflict", latest });
    assert.equal(writes.length, 0);
    assert.deepEqual(store.read(), latest);
  });
}

test("canonical transition equality ignores object property order at every depth", () => {
  const { base, candidate, store, writes, replaceCurrent } = transitionFixture();
  function reverseKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).reverse()
      .map(([key, entry]) => [key, reverseKeys(entry)]));
  }
  replaceCurrent(reverseKeys(base) as SaveData);

  assert.equal(persistTransition(store, base, candidate).status, "saved");
  assert.equal(writes.length, 1);
  assert.deepEqual(store.read(), candidate);
});

test("canonical transition recognizes the exact same-ID candidate without another write", () => {
  const { base, candidate, store, writes, replaceCurrent } = transitionFixture();
  replaceCurrent(candidate);

  assert.deepEqual(persistTransition(store, base, candidate), { status: "saved", save: candidate });
  assert.equal(writes.length, 0);
  assert.equal(store.read().galaxyRun?.activeTravel?.transactionId,
    candidate.galaxyRun?.activeTravel?.transactionId);
});

test("canonical transition rejects same-ID travel when another saved field has changed", () => {
  const { base, candidate, store, writes, replaceCurrent } = transitionFixture();
  const latest = structuredClone(candidate);
  latest.xp += 10;
  replaceCurrent(latest);

  assert.deepEqual(persistTransition(store, base, candidate), { status: "conflict", latest });
  assert.equal(writes.length, 0);
  assert.deepEqual(store.read(), latest);
});

test("canonical transition read failure does not write or consume the candidate", () => {
  const { base, candidate, store, writes } = transitionFixture();
  const error = new Error("storage unavailable");
  const before = structuredClone({ base, candidate });

  assert.deepEqual(persistTransition({ ...store, read: () => { throw error; } }, base, candidate),
    { status: "write_failed", error });
  assert.equal(writes.length, 0);
  assert.deepEqual({ base, candidate }, before);
  assert.equal(persistTransition(store, base, candidate).status, "saved");
});

test("canonical transition write failure preserves storage and the same retry identity", () => {
  const { base, candidate, store, writes } = transitionFixture();
  const error = new Error("quota exceeded");
  const before = structuredClone({ base, candidate });

  assert.deepEqual(persistTransition({ ...store, write: () => { throw error; } }, base, candidate),
    { status: "write_failed", error });
  assert.deepEqual(store.read(), base);
  assert.deepEqual({ base, candidate }, before);
  assert.equal(persistTransition(store, base, candidate).status, "saved");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].galaxyRun?.activeTravel?.transactionId,
    candidate.galaxyRun?.activeTravel?.transactionId);
});

test("canonical transition recognizes a write that persisted the exact candidate then threw", () => {
  const { base, candidate, store, writes } = transitionFixture();
  const result = persistTransition({
    ...store,
    write: (save) => { store.write(save); throw new Error("post-write failure"); },
  }, base, candidate);

  assert.deepEqual(result, { status: "saved", save: candidate });
  assert.equal(writes.length, 1);
  assert.deepEqual(persistTransition(store, base, candidate), { status: "saved", save: candidate });
  assert.equal(writes.length, 1);
});

test("canonical transition does not let a throwing writer mutate its retained snapshots", () => {
  const { base, candidate, store } = transitionFixture();
  const before = structuredClone({ base, candidate });
  const result = persistTransition({
    ...store,
    write: (save) => {
      save.galaxyRun!.resources.supply = 0;
      save.completedQuests.push("writer-mutated");
      throw new Error("failed");
    },
  }, base, candidate);

  assert.equal(result.status, "write_failed");
  assert.deepEqual({ base, candidate }, before);
  assert.deepEqual(store.read(), base);
  assert.deepEqual(persistTransition(store, base, candidate), { status: "saved", save: candidate });
});

for (const transition of ["travel", "prepared POI recovery"] as const) {
  test(`${transition} candidate cannot overwrite an unrelated root update`, () => {
    const { base, candidate: travelCandidate, store, writes, replaceCurrent } = transitionFixture();
    if (transition === "prepared POI recovery") base.activeExperience = "legacy";
    const candidate = transition === "travel" ? travelCandidate : structuredClone(base);
    if (transition === "prepared POI recovery") candidate.outcomeRecoveryRecords.push({
      version: 2,
      kind: "legacy_poi_prepared",
      envelope: createOutcomeEnvelope({
        version: 1,
        routeKind: "poi",
        routeIdentity: {
          kind: "poi", originColonyId: "home", nodeId: "ashfall-cinder-relay",
          engine: "firstPerson", templateId: "fp-ruin-cinder-relay", rewardEligible: true,
        },
        missionId: "poi:prepared-test",
        launchId: "prepared-test",
        expectedRevision: base.saveRevision,
        persistenceAuthority: "legacy",
        returnTarget: "legacy-colony-exterior",
        declaredFields: ["colonies", "planets", "missionsSinceStart"],
        launchSnapshot: {
          colonies: base.colonies, planets: base.planets, missionsSinceStart: base.missionsSinceStart,
        },
      }, "success", { version: 2, kind: "poi_prepared_v2" }),
    });
    const latest = structuredClone(base);
    latest.credits += 5;
    replaceCurrent(latest);

    assert.deepEqual(persistTransition(store, base, candidate), { status: "conflict", latest });
    assert.equal(writes.length, 0);
    assert.deepEqual(store.read(), latest);
  });
}
