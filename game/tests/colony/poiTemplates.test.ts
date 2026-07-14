import { test } from "node:test";
import assert from "node:assert/strict";
import { createBoardingWreckTemplate, createFirstPersonRuinTemplate, createGroundRunCanyonTemplate } from "../../app/components/colony/region/poiTemplates";
import { getBoardingGoal, getBoardingSpawn } from "../../app/components/engine/boardingLevel";
import { getGoalPosition, getSpawnPosition } from "../../app/components/engine/groundLevel";

test("all three POI templates are deeply deterministic", () => {
  assert.deepEqual(createFirstPersonRuinTemplate(11), createFirstPersonRuinTemplate(11));
  assert.deepEqual(createBoardingWreckTemplate(22), createBoardingWreckTemplate(22));
  assert.deepEqual(createGroundRunCanyonTemplate(33), createGroundRunCanyonTemplate(33));
  assert.notDeepEqual(createFirstPersonRuinTemplate(11), createFirstPersonRuinTemplate(12));
});

test("POI templates contain valid spawns, goals, and objectives", () => {
  const fp = createFirstPersonRuinTemplate(1);
  assert.ok(fp.objectivePickup);
  assert.equal(fp.map.tiles[Math.floor(fp.posY)][Math.floor(fp.posX)], "spawn");
  assert.notEqual(fp.map.tiles[Math.floor(fp.objectivePickup!.y)][Math.floor(fp.objectivePickup!.x)], "wall");

  const boarding = createBoardingWreckTemplate(2);
  const bSpawn = getBoardingSpawn(boarding.map);
  const bGoal = getBoardingGoal(boarding.map);
  assert.notDeepEqual(bSpawn, bGoal);

  const ground = createGroundRunCanyonTemplate(3);
  const gSpawn = getSpawnPosition(ground.tileMap);
  const gGoal = getGoalPosition(ground.tileMap);
  assert.ok(gGoal.x > gSpawn.x);
});
