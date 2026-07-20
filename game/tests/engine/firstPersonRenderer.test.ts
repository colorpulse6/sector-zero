import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planFPDialogLayout,
  type FPDialogRect,
} from "../../app/components/engine/fpDialogLayout";
import { drawFPDialogBox } from "../../app/components/engine/firstPersonRenderer";
import { SPRITES } from "../../app/components/engine/sprites";
import type { FirstPersonState } from "../../app/components/engine/types";

const DIALOG_PANEL: FPDialogRect = { x: 16, y: 564, width: 448, height: 140 };
const BODY = "abcdefghijklmnop qrstuvwxyzabcdef";

interface TextCall {
  value: string;
  x: number;
  y: number;
  align: CanvasTextAlign | undefined;
}

interface RecordingCanvas {
  ctx: CanvasRenderingContext2D;
  text: TextCall[];
  images: unknown[][];
  roundRects: unknown[][];
}

function recordingCanvas(): RecordingCanvas {
  const text: TextCall[] = [];
  const images: unknown[][] = [];
  const roundRects: unknown[][] = [];
  const noop = () => undefined;
  const target: Record<PropertyKey, unknown> = {
    fillText(value: unknown, x: unknown, y: unknown) {
      text.push({
        value: String(value),
        x: Number(x),
        y: Number(y),
        align: target.textAlign as CanvasTextAlign | undefined,
      });
    },
    measureText(value: unknown) {
      return { width: String(value).length * 10 };
    },
    drawImage(...args: unknown[]) {
      images.push(args);
    },
    roundRect(...args: unknown[]) {
      roundRects.push(args);
    },
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
  return {
    ctx: proxy as unknown as CanvasRenderingContext2D,
    text,
    images,
    roundRects,
  };
}

function dialogState(portraitKey?: string): FirstPersonState {
  return {
    npcs: [{
      id: 7,
      x: 0,
      y: 0,
      name: "BARTENDER",
      type: "lore",
      dialog: [],
      color: "#44ccff",
      interacted: false,
    }],
    dialogState: {
      active: true,
      npcId: 7,
      lines: [{ speaker: "BARTENDER", text: BODY, portraitKey }],
      currentLine: 0,
      shopOpen: false,
    },
  } as unknown as FirstPersonState;
}

function textCall(recording: RecordingCanvas, value: string): TextCall {
  const call = recording.text.find((candidate) => candidate.value === value);
  assert.ok(call, `missing fillText call for ${JSON.stringify(value)}`);
  return call;
}

test("dialog layout plans exact portrait and text-only rectangles for the live panel", () => {
  const plan = planFPDialogLayout(DIALOG_PANEL, "PORTRAIT_HUB_BARTENDER");

  assert.equal(plan.portraitPath, SPRITES.PORTRAIT_HUB_BARTENDER);
  assert.deepEqual(plan.withPortrait, {
    portrait: { x: 28, y: 576, width: 88, height: 88 },
    text: { x: 128, y: 576, width: 324, height: 88 },
  });
  assert.deepEqual(plan.textOnly, {
    portrait: null,
    text: { x: 28, y: 576, width: 424, height: 88 },
  });
});

test("portrait key resolution fails closed for absent, unknown, wrong-category, and prototype keys", () => {
  const invalidKeys = [
    undefined,
    "NOT_REGISTERED",
    "NPC_HUB_BARTENDER",
    "toString",
    "constructor",
    "__proto__",
  ];

  for (const key of invalidKeys) {
    assert.equal(planFPDialogLayout(DIALOG_PANEL, key).portraitPath, null, String(key));
  }
});

test("loaded eligible portrait draws at 88px and moves speaker and wrapped body into 324px", () => {
  const recording = recordingCanvas();
  const image = { width: 128, height: 128 } as HTMLImageElement;
  const lookupCalls: string[] = [];

  drawFPDialogBox(recording.ctx, dialogState("PORTRAIT_HUB_BARTENDER"), 0, (path) => {
    lookupCalls.push(path);
    return image;
  });

  assert.deepEqual(lookupCalls, [SPRITES.PORTRAIT_HUB_BARTENDER]);
  assert.deepEqual(recording.images, [[image, 28, 576, 88, 88]]);
  assert.deepEqual(textCall(recording, "BARTENDER"), {
    value: "BARTENDER", x: 128, y: 576, align: "left",
  });
  assert.deepEqual(textCall(recording, "abcdefghijklmnop"), {
    value: "abcdefghijklmnop", x: 128, y: 596, align: "left",
  });
  assert.deepEqual(textCall(recording, "qrstuvwxyzabcdef"), {
    value: "qrstuvwxyzabcdef", x: 128, y: 614, align: "left",
  });
  assert.deepEqual(recording.roundRects[0], [16, 564, 448, 140, 8]);
  assert.deepEqual(textCall(recording, "[Z] Close"), {
    value: "[Z] Close", x: 452, y: 690, align: "right",
  });
  assert.deepEqual(textCall(recording, "1 / 1"), {
    value: "1 / 1", x: 28, y: 690, align: "left",
  });
});

test("eligible but unloaded portrait keeps full-width legacy text layout", () => {
  const recording = recordingCanvas();
  const lookupCalls: string[] = [];

  drawFPDialogBox(recording.ctx, dialogState("PORTRAIT_HUB_BARTENDER"), 0, (path) => {
    lookupCalls.push(path);
    return null;
  });

  assert.deepEqual(lookupCalls, [SPRITES.PORTRAIT_HUB_BARTENDER]);
  assert.equal(recording.images.length, 0);
  assert.deepEqual(textCall(recording, "BARTENDER"), {
    value: "BARTENDER", x: 28, y: 576, align: "left",
  });
  assert.deepEqual(textCall(recording, BODY), {
    value: BODY, x: 28, y: 596, align: "left",
  });
});

test("absent, unknown, wrong-category, and prototype keys never attempt portrait loading", () => {
  const invalidKeys = [
    undefined,
    "NOT_REGISTERED",
    "NPC_HUB_BARTENDER",
    "toString",
    "constructor",
    "__proto__",
  ];

  for (const key of invalidKeys) {
    const recording = recordingCanvas();
    const lookupCalls: string[] = [];
    drawFPDialogBox(recording.ctx, dialogState(key), 0, (path) => {
      lookupCalls.push(path);
      return { width: 1, height: 1 } as HTMLImageElement;
    });

    assert.deepEqual(lookupCalls, [], String(key));
    assert.equal(recording.images.length, 0, String(key));
    assert.deepEqual(textCall(recording, "BARTENDER"), {
      value: "BARTENDER", x: 28, y: 576, align: "left",
    }, String(key));
    assert.deepEqual(textCall(recording, BODY), {
      value: BODY, x: 28, y: 596, align: "left",
    }, String(key));
  }
});

test("open shop bypasses portrait handling and retains the 300px shop panel", () => {
  const recording = recordingCanvas();
  const fp = dialogState("PORTRAIT_HUB_BARTENDER");
  fp.npcs[0].type = "merchant";
  fp.dialogState = {
    ...fp.dialogState!,
    shopOpen: true,
    shopItems: [{
      id: "test-item",
      name: "TEST ITEM",
      description: "Legacy shop row",
      cost: 5,
      type: "material",
    }],
  };
  const lookupCalls: string[] = [];

  drawFPDialogBox(recording.ctx, fp, 0, (path) => {
    lookupCalls.push(path);
    return { width: 1, height: 1 } as HTMLImageElement;
  });

  assert.deepEqual(lookupCalls, []);
  assert.equal(recording.images.length, 0);
  assert.deepEqual(recording.roundRects[0], [16, 404, 448, 300, 8]);
  assert.deepEqual(textCall(recording, "BARTENDER — INVENTORY"), {
    value: "BARTENDER — INVENTORY", x: 28, y: 416, align: "left",
  });
  assert.deepEqual(textCall(recording, "[Z] Close Shop"), {
    value: "[Z] Close Shop", x: 354, y: 416, align: "left",
  });
  assert.deepEqual(textCall(recording, "TEST ITEM"), {
    value: "TEST ITEM", x: 32, y: 446, align: "left",
  });
});
