import { test } from "node:test";
import assert from "node:assert/strict";
import { drawDashboard } from "../../app/components/engine/dashboard";
import { createGameState } from "../../app/components/engine/gameEngine";
import { drawGame } from "../../app/components/engine/renderer";
import { GameScreen, type GameState } from "../../app/components/engine/types";

function recordingCanvas(): { ctx: CanvasRenderingContext2D; text: string[] } {
  const text: string[] = [];
  const noop = () => undefined;
  const gradient = { addColorStop: noop };
  const target: Record<PropertyKey, unknown> = {
    fillText(value: unknown) { text.push(String(value)); },
    measureText(value: unknown) { return { width: String(value).length * 7 }; },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    createPattern() { return null; },
  };
  const proxy = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      return noop;
    },
    set(object, property, value) {
      object[property] = value;
      return true;
    },
  });
  return { ctx: proxy as unknown as CanvasRenderingContext2D, text };
}

function operationState(): GameState {
  const state = createGameState(1, 1);
  return {
    ...state,
    galaxyOperation: { id: "op:hostile-picket", label: "HOSTILE PICKET" },
  };
}

test("galaxy operation briefing presents operation identity and no compatibility campaign identity", () => {
  const { ctx, text } = recordingCanvas();
  const state = operationState();
  state.screen = GameScreen.BRIEFING;
  state.briefingTimer = 500;

  drawGame(ctx, state);

  assert.ok(text.includes("GALAXY OPERATION"), JSON.stringify(text));
  assert.ok(text.includes("HOSTILE PICKET"), JSON.stringify(text));
  assert.equal(text.some((line) => /WORLD|LEVEL|SECTOR|AURELIA BELT/.test(line)), false, JSON.stringify(text));
});

test("galaxy shooter dashboard presents operation identity while legacy remains unchanged", () => {
  const operation = recordingCanvas();
  const operationGame = operationState();
  operationGame.screen = GameScreen.PLAYING;
  drawDashboard(operation.ctx, operationGame);
  assert.ok(operation.text.includes("HOSTILE PICKET"), JSON.stringify(operation.text));
  assert.equal(operation.text.some((line) => line.startsWith("SECTOR ")), false, JSON.stringify(operation.text));

  const legacy = recordingCanvas();
  const legacyGame = createGameState(1, 1);
  legacyGame.screen = GameScreen.PLAYING;
  drawDashboard(legacy.ctx, legacyGame);
  assert.ok(legacy.text.includes("SECTOR 1-1"), JSON.stringify(legacy.text));
});
