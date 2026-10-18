import { test } from "node:test";
import assert from "node:assert/strict";
import { galaxyAtAshfall } from "../browser/fixtures/routeFixtures";
import { enterColonyExploration, stepColonyExploration } from "../../app/components/colony/exploration";
import { projectGalaxyRunToLegacySave, advanceGalaxyWorldCycles } from "../../app/components/engine/galaxy/galaxyProjection";
import { quoteGalaxyColonyCommission, commitGalaxyColonyCommission } from "../../app/components/engine/galaxy/galaxyColonyManagement";

const COLONY = "galaxy:ashfall-primary";
function readySave() {
  const save = structuredClone(galaxyAtAshfall);
  save.galaxyRun!.colonies.find(colony => colony.id === COLONY)!.resources.metal = 80;
  return save;
}
function ok<T extends { ok: boolean }>(value: T): Extract<T, { ok: true }> {
  assert.equal(value.ok, true, JSON.stringify(value));
  return value as Extract<T, { ok: true }>;
}

test("Ashfall entry reads the same construction cost as management", () => {
  const visit = enterColonyExploration(projectGalaxyRunToLegacySave(readySave()), COLONY);
  const overseer = visit.firstPersonState.npcs.find(npc => npc.name === "Overseer Ashfall Primary")!;
  assert.match(overseer.dialog.map(line => line.text).join(" "), /A solar array takes 80 metal and 1 cycle to raise/);
});

test("Ashfall Overseer refreshes after a canonical commission without rebuilding the walk", () => {
  const save = readySave();
  const visit = enterColonyExploration(projectGalaxyRunToLegacySave(save), COLONY);
  const npc = visit.firstPersonState.npcs.find(npc => npc.name === "Overseer Ashfall Primary")!;
  const text = () => npc.dialog.map(line => line.text).join(" ");
  assert.match(text(), /80 metal/);
  const map = visit.firstPersonState.map;
  const sidecar = visit.sceneStack.current.npcSidecar;
  const position = { x: npc.x, y: npc.y };
  const quote = ok(quoteGalaxyColonyCommission(save, COLONY, "solar_array")).quote;
  const built = ok(commitGalaxyColonyCommission(save, quote)).save;
  stepColonyExploration(visit.sceneStack, projectGalaxyRunToLegacySave(built), 0);
  assert.match(text(), /solar array's going up/);
  assert.match(text(), /yard's empty/);
  assert.doesNotMatch(text(), /80 metal|No buildings yet/);
  assert.equal(visit.firstPersonState.map, map);
  assert.equal(visit.sceneStack.current.npcSidecar, sidecar);
  assert.deepEqual({ x: npc.x, y: npc.y }, position);
  const completed = ok(advanceGalaxyWorldCycles(built, 1)).save;
  stepColonyExploration(visit.sceneStack, projectGalaxyRunToLegacySave(completed), 0);
  assert.match(text(), /solar array's online/);
  assert.equal(visit.firstPersonState.map, map);
});

test("dialogue refresh preserves an open conversation and leaves other colonies unchanged", () => {
  const projected = projectGalaxyRunToLegacySave(readySave());
  const visit = enterColonyExploration(projected, COLONY);
  const npc = visit.firstPersonState.npcs.find(entry => entry.name === "Overseer Ashfall Primary")!;
  const openLines = npc.dialog;
  visit.firstPersonState.dialogState = {
    active: true, npcId: npc.id, lines: openLines, currentLine: 1, shopOpen: false,
  };
  const updated = structuredClone(projected);
  updated.colonies.find(colony => colony.id === COLONY)!.resources.metal = 20;
  stepColonyExploration(visit.sceneStack, updated, 0);
  assert.match(npc.dialog.map(line => line.text).join(" "), /20 metal/);
  assert.equal(visit.firstPersonState.dialogState.lines, openLines);
  assert.equal(visit.firstPersonState.dialogState.currentLine, 1);

  const legacy = structuredClone(projected);
  legacy.colonies[0].id = "legacy-colony";
  const other = enterColonyExploration(legacy, "legacy-colony");
  const oldDialogs = other.firstPersonState.npcs.map(entry => entry.dialog);
  legacy.colonies[0].resources.metal = 20;
  stepColonyExploration(other.sceneStack, legacy, 0);
  other.firstPersonState.npcs.forEach((entry, index) => assert.equal(entry.dialog, oldDialogs[index]));
});
