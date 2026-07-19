import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createGameState,
  createPlanetGameState,
  getHazardState,
} from "../../app/components/engine/gameEngine";
import { PLANET_DEFS } from "../../app/components/engine/planets";
import { drawGame } from "../../app/components/engine/renderer";
import { GameScreen } from "../../app/components/engine/types";

interface CanvasEvent {
  operation: string;
  args: unknown[];
  fillStyle?: unknown;
}

function recordingCanvas(): { ctx: CanvasRenderingContext2D; events: CanvasEvent[] } {
  const events: CanvasEvent[] = [];
  const state: Record<PropertyKey, unknown> = {};
  const gradient = {
    addColorStop(...args: unknown[]) {
      events.push({ operation: "addColorStop", args });
    },
  };
  const target: Record<PropertyKey, unknown> = {
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    createPattern() { return null; },
    measureText(value: unknown) { return { width: String(value).length * 7 }; },
  };
  const proxy = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      return (...args: unknown[]) => {
        events.push({ operation: String(property), args, fillStyle: state.fillStyle });
      };
    },
    set(_object, property, value) {
      state[property] = value;
      return true;
    },
  });
  return { ctx: proxy as unknown as CanvasRenderingContext2D, events };
}

test("planet gameplay dispatches the authored objective presentation", () => {
  const state = createPlanetGameState("ossuary");
  state.screen = GameScreen.PLAYING;
  const recording = recordingCanvas();

  drawGame(recording.ctx, state);

  assert.ok(
    recording.events.some(
      (event) => event.operation === "fillText" && event.args[0] === "DEFEND",
    ),
    "the planet objective HUD should be drawn by the active renderer",
  );
});

test("planet gameplay draws the significant actor for collect, escort, and defend objectives", () => {
  const collect = createPlanetGameState("verdania");
  collect.screen = GameScreen.PLAYING;
  collect.objective!.collectibles = [{
    id: 99,
    x: 7,
    y: 9,
    width: 12,
    height: 14,
    vy: 0,
    lifetime: 60,
    maxLifetime: 60,
  }];
  const collectRecording = recordingCanvas();
  drawGame(collectRecording.ctx, collect);
  assert.ok(
    collectRecording.events.some(
      (event) => event.operation === "arc" && event.args[0] === 13 && event.args[1] === 16,
    ),
    "collect missions should draw their collectible",
  );

  const escort = createPlanetGameState("pyraxis");
  escort.screen = GameScreen.PLAYING;
  const escortRecording = recordingCanvas();
  drawGame(escortRecording.ctx, escort);
  assert.ok(
    escortRecording.events.some(
      (event) => event.operation === "fill" && event.fillStyle === "#44ddff",
    ),
    "escort missions should draw their escort craft",
  );

  const defend = createPlanetGameState("ossuary");
  defend.screen = GameScreen.PLAYING;
  const defendRecording = recordingCanvas();
  drawGame(defendRecording.ctx, defend);
  assert.ok(
    defendRecording.events.some(
      (event) => event.operation === "fill" && event.fillStyle === "#334466",
    ),
    "defend missions should draw their protected structure",
  );
});

test("every planet renders its live hazard state and objective kind", () => {
  const objectiveLabels = {
    collect: "SALVAGE",
    survive: "SURVIVE",
    escort: "ESCORT",
    defend: "DEFEND",
  } as const;

  for (const [index, planet] of PLANET_DEFS.entries()) {
    const state = createPlanetGameState(planet.id);
    state.screen = GameScreen.PLAYING;
    const hazards = getHazardState();
    assert.equal(hazards?.planetId, planet.id);
    const marker = { x: 11 + index, y: 23 + index, width: 7, height: 9 };
    hazards!.hazards.push({
      type: "debris",
      ...marker,
      timer: 60,
      maxTimer: 60,
      active: true,
      warning: false,
    });
    const recording = recordingCanvas();

    drawGame(recording.ctx, state);

    assert.ok(
      recording.events.some(
        (event) => event.operation === "fillRect" &&
          event.args[0] === marker.x && event.args[1] === marker.y &&
          event.args[2] === marker.width && event.args[3] === marker.height,
      ),
      `${planet.id} should render its current hazard geometry`,
    );
    assert.ok(
      recording.events.some(
        (event) => event.operation === "fillText" &&
          event.args[0] === objectiveLabels[planet.objective],
      ),
      `${planet.id} should render its ${planet.objective} objective HUD`,
    );
  }
});

test("planet composition layers background, combat, authored state, foreground, and HUD in order", () => {
  const state = createPlanetGameState("ossuary");
  state.screen = GameScreen.PLAYING;
  state.particles = [{
    x: 301,
    y: 302,
    vx: 0,
    vy: 0,
    life: 10,
    maxLife: 10,
    size: 3,
    color: "#ff00aa",
    type: "spark",
  }];
  const hazards = getHazardState();
  assert.ok(hazards);
  hazards.hazards.push({
    type: "debris",
    x: 211,
    y: 212,
    width: 13,
    height: 14,
    timer: 60,
    maxTimer: 60,
    active: true,
    warning: false,
  });
  const recording = recordingCanvas();

  drawGame(recording.ctx, state);

  const indexOf = (predicate: (event: CanvasEvent) => boolean, label: string) => {
    const index = recording.events.findIndex(predicate);
    assert.notEqual(index, -1, `missing ${label}`);
    return index;
  };
  const stages = [
    indexOf(
      (event) => event.operation === "addColorStop" && event.args[1] === "#15120a",
      "planet background",
    ),
    indexOf(
      (event) => event.operation === "fill" && event.fillStyle === "#667788",
      "common combat player",
    ),
    indexOf(
      (event) => event.operation === "fill" && event.fillStyle === "#334466",
      "defend structure",
    ),
    indexOf(
      (event) => event.operation === "fillRect" && event.args[0] === 211 && event.args[1] === 212,
      "planet hazard",
    ),
    indexOf(
      (event) => event.operation === "fillRect" && event.args[0] === 301 && event.args[1] === 302,
      "common particle foreground",
    ),
    indexOf(
      (event) => event.operation === "arc" && event.fillStyle === "#998866",
      "planet foreground",
    ),
    indexOf(
      (event) => event.operation === "fillText" && event.args[0] === "DEFEND",
      "objective HUD",
    ),
    indexOf(
      (event) => event.operation === "fillText" && event.args[0] === "SCORE 0",
      "dashboard",
    ),
  ];

  assert.deepEqual([...stages].sort((a, b) => a - b), stages);
});

test("non-planet shooters remain on the generic background and combat path", () => {
  const state = createGameState(4, 1);
  state.screen = GameScreen.PLAYING;
  const recording = recordingCanvas();

  drawGame(recording.ctx, state);

  assert.ok(
    recording.events.some(
      (event) => event.operation === "fillRect" && event.fillStyle === "#050608" &&
        event.args[0] === 0 && event.args[1] === 0,
    ),
    "world 4 should retain its generic procedural background fallback",
  );
  assert.ok(
    recording.events.some(
      (event) => event.operation === "fill" && event.fillStyle === "#667788",
    ),
    "generic combat should still draw the player",
  );
  assert.equal(
    recording.events.some(
      (event) => event.operation === "fillText" &&
        ["SALVAGE", "SURVIVE", "ESCORT", "DEFEND"].includes(String(event.args[0])),
    ),
    false,
  );
});

test("the Ashfall Galaxy operation inherits planet presentation and operation identity", () => {
  const state = createPlanetGameState("ashfall");
  state.galaxyOperation = { id: "op:ashfall-sortie", label: "ASHFALL SORTIE" };
  state.screen = GameScreen.PLAYING;
  const recording = recordingCanvas();

  drawGame(recording.ctx, state);

  assert.ok(recording.events.some(
    (event) => event.operation === "addColorStop" && event.args[1] === "#1f1508",
  ));
  assert.ok(recording.events.some(
    (event) => event.operation === "fillText" && event.args[0] === "SURVIVE",
  ));
  assert.ok(recording.events.some(
    (event) => event.operation === "fillText" && event.args[0] === "ASHFALL SORTIE",
  ));
});
