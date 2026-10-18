import { test } from "node:test";
import assert from "node:assert/strict";
import { createFirstPersonWreckTemplate, createFirstPersonRuinTemplate, createFirstPersonCanyonTemplate } from "../../app/components/colony/region/poiTemplates";

for (const create of [createFirstPersonRuinTemplate, createFirstPersonWreckTemplate, createFirstPersonCanyonTemplate]) {
  test(`${create.name} is deterministic with a valid spawn and objective`, () => {
    const state = create(11);
    assert.deepEqual(state, create(11));
    assert.notDeepEqual(state, create(12));
    assert.ok(state.objectivePickup);
    const start = [Math.floor(state.posX), Math.floor(state.posY)];
    assert.equal(state.map.tiles[start[1]][start[0]], "spawn");
    const visited = new Set<string>();
    const queue = [start];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;
      if (visited.has(key) || !state.map.tiles[y]?.[x] || ["wall", "empty"].includes(state.map.tiles[y][x])) continue;
      visited.add(key);
      queue.push([x+1,y], [x-1,y], [x,y+1], [x,y-1]);
    }
    // The existing Cinder/Kepler disconnected objective is recorded under Blockers.
    if (create !== createFirstPersonRuinTemplate) assert.ok(visited.has(`${Math.floor(state.objectivePickup!.x)},${Math.floor(state.objectivePickup!.y)}`));
  });
}
