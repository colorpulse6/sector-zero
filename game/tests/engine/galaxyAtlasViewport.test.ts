import { test } from "node:test";
import assert from "node:assert/strict";
import { cellKey, coord } from "../../app/components/engine/galaxy/coordinates";
import {
  ATLAS_PAN_STEP_UNITS,
  ATLAS_VIEW_LEVEL_METADATA,
  ATLAS_ZOOM_MAX,
  ATLAS_ZOOM_MIN,
  atlasViewportReducer,
  createAtlasViewportState,
  panActionFromArrowKey,
  panActionFromTouchControl,
  screenToWorld,
  selectedTargetIdFor,
  targetFromCoordinateForm,
  targetFromDomContact,
  targetFromKeyboardContact,
  targetFromPointer,
  targetFromTouch,
  worldToScreen,
  zoomAction,
  zoomActionFromPinch,
  type AtlasViewportContact,
  type AtlasViewportState,
  type ViewportSize,
} from "../../app/components/galaxy/atlasViewport";

const SIZES: readonly ViewportSize[] = [
  { width: 480, height: 714 },
  { width: 854, height: 480 },
  { width: 1365, height: 768 },
];

const ASHFALL: AtlasViewportContact = {
  targetId: "contact:ashfall",
  contactId: "contact:ashfall",
  coordinate: coord(0, 0, 1024, 512),
};

const VANGUARD: AtlasViewportContact = {
  targetId: "contact:vanguard",
  contactId: "contact:vanguard",
  coordinate: coord(0, 0, 512, 512),
};

const PROCEDURAL_SIGNAL: AtlasViewportContact = {
  targetId: "target:signal:0:0:1536:1024",
  contactId: "contact:signal:0:0:1536:1024",
  coordinate: coord(0, 0, 1536, 1024),
};

function sectorState(
  center = coord(0, 0, 2048, 2048),
  zoom = 0.75,
): AtlasViewportState {
  return createAtlasViewportState({
    viewLevel: "sector",
    center,
    zoom,
    selectedTargetId: null,
  });
}

test("world and screen projection round-trip fixed-point coordinates at every viewport size", () => {
  const coordinate = coord(0, 0, 1792, 1792);

  for (const size of SIZES) {
    for (const zoom of [ATLAS_ZOOM_MIN, 0.65, ATLAS_ZOOM_MAX]) {
      const state = sectorState(coord(0, 0, 2048, 1536), zoom);
      assert.deepEqual(
        screenToWorld(worldToScreen(coordinate, state, size), state, size),
        coordinate,
      );
    }
  }
});

test("projection-only display changes never change fixed cell identity", () => {
  const coordinate = coord(0, 0, 700, 900);
  const expectedCellKey = cellKey(coordinate);

  for (const size of SIZES) {
    for (const center of [
      coord(0, 0, 0, 0),
      coord(0, 0, 2048, 2048),
      coord(0, 0, 4095, 4095),
    ]) {
      for (const zoom of [ATLAS_ZOOM_MIN, 1, ATLAS_ZOOM_MAX]) {
        const state = sectorState(center, zoom);
        const projected = screenToWorld(
          worldToScreen(coordinate, state, size),
          state,
          size,
        );
        assert.equal(cellKey(projected), expectedCellKey);
      }
    }
  }
});

test("viewport state contains only the four authoritative display fields", () => {
  const state = sectorState();
  assert.deepEqual(Object.keys(state).sort(), [
    "center",
    "selectedTargetId",
    "viewLevel",
    "zoom",
  ]);
});

test("pan and zoom reducers clamp to named G0 limits", () => {
  const state = sectorState(coord(0, 0, 100, 4000), 1);
  const panned = atlasViewportReducer(state, {
    type: "pan",
    deltaX: -1000,
    deltaY: 1000,
  });
  assert.deepEqual(panned.center, coord(0, 0, 0, 4095));

  const zoomedOut = atlasViewportReducer(panned, {
    type: "zoom",
    zoom: ATLAS_ZOOM_MIN / 10,
  });
  assert.equal(zoomedOut.zoom, ATLAS_ZOOM_MIN);

  const zoomedIn = atlasViewportReducer(zoomedOut, {
    type: "zoom",
    zoom: ATLAS_ZOOM_MAX * 10,
  });
  assert.equal(zoomedIn.zoom, ATLAS_ZOOM_MAX);
});

test("view metadata exposes the four G0 conceptual Atlas levels", () => {
  assert.deepEqual(ATLAS_VIEW_LEVEL_METADATA.galaxy, {
    purpose: "non-interactive-frame",
    fieldInteractive: false,
    handoffContactId: null,
  });
  assert.deepEqual(ATLAS_VIEW_LEVEL_METADATA.sector, {
    purpose: "functional-field",
    fieldInteractive: true,
    handoffContactId: null,
  });
  assert.deepEqual(ATLAS_VIEW_LEVEL_METADATA.system, {
    purpose: "selected-contact-detail",
    fieldInteractive: false,
    handoffContactId: null,
  });
  assert.deepEqual(ATLAS_VIEW_LEVEL_METADATA.region, {
    purpose: "ashfall-handoff",
    fieldInteractive: false,
    handoffContactId: "contact:ashfall",
  });

  let state = sectorState();
  for (const viewLevel of ["galaxy", "sector", "system", "region"] as const) {
    state = atlasViewportReducer(state, { type: "set-view", viewLevel });
    assert.equal(state.viewLevel, viewLevel);
  }
});

test("the non-interactive galaxy frame ignores field pan, zoom, and selection", () => {
  const galaxy = atlasViewportReducer(sectorState(), {
    type: "set-view",
    viewLevel: "galaxy",
  });

  assert.deepEqual(
    atlasViewportReducer(galaxy, {
      type: "pan",
      deltaX: 100,
      deltaY: 100,
    }),
    galaxy,
  );
  assert.deepEqual(
    atlasViewportReducer(galaxy, { type: "zoom", zoom: 2 }),
    galaxy,
  );
  assert.deepEqual(
    atlasViewportReducer(galaxy, {
      type: "select-contact",
      targetId: ASHFALL.targetId,
    }),
    galaxy,
  );
});

test("pointer, touch, DOM, and keyboard contact paths produce the same Atlas target", () => {
  const state = sectorState();
  const point = worldToScreen(ASHFALL.coordinate, state, SIZES[0]);
  const contacts = [VANGUARD, ASHFALL];
  const expected = { kind: "contact", contactId: "contact:ashfall" } as const;

  assert.deepEqual(targetFromPointer(point, state, SIZES[0], contacts), expected);
  assert.deepEqual(targetFromTouch(point, state, SIZES[0], contacts), expected);
  assert.deepEqual(targetFromDomContact(ASHFALL.targetId, contacts), expected);
  assert.deepEqual(
    targetFromKeyboardContact(VANGUARD.targetId, "next", contacts),
    expected,
  );
});

test("keyboard contact navigation advances from the persisted contact identity", () => {
  const state = sectorState();
  const contacts = [VANGUARD, PROCEDURAL_SIGNAL, ASHFALL];
  const point = worldToScreen(PROCEDURAL_SIGNAL.coordinate, state, SIZES[0]);
  const pointerTarget = targetFromPointer(point, state, SIZES[0], contacts);
  const domTarget = targetFromDomContact(PROCEDURAL_SIGNAL.targetId, contacts);

  assert.deepEqual(pointerTarget, domTarget);
  const selectedTargetId = selectedTargetIdFor(pointerTarget);
  assert.equal(selectedTargetId, PROCEDURAL_SIGNAL.contactId);
  assert.deepEqual(
    targetFromKeyboardContact(selectedTargetId, "next", contacts),
    { kind: "contact", contactId: ASHFALL.contactId },
  );
  assert.deepEqual(
    targetFromKeyboardContact(selectedTargetId, "previous", contacts),
    { kind: "contact", contactId: VANGUARD.contactId },
  );
});

test("pointer, touch, and normalized coordinate form paths produce one coordinate target", () => {
  const coordinate = coord(0, 0, 1792, 1792);
  const state = sectorState();
  const point = worldToScreen(coordinate, state, SIZES[1]);
  const expected = { kind: "coordinate", coordinate } as const;

  assert.deepEqual(targetFromPointer(point, state, SIZES[1], []), expected);
  assert.deepEqual(targetFromTouch(point, state, SIZES[1], []), expected);
  assert.deepEqual(
    targetFromCoordinateForm({
      sectorX: " 0 ",
      sectorY: 0,
      localX: "1792",
      localY: " 1792 ",
    }),
    expected,
  );
});

test("coordinate form normalization rejects fractional, unsafe, cross-sector, and out-of-bounds values", () => {
  assert.equal(
    targetFromCoordinateForm({
      sectorX: 0,
      sectorY: 0,
      localX: "1.5",
      localY: 2,
    }),
    null,
  );
  assert.equal(
    targetFromCoordinateForm({
      sectorX: 0,
      sectorY: 0,
      localX: String(Number.MAX_SAFE_INTEGER + 1),
      localY: 2,
    }),
    null,
  );
  assert.equal(
    targetFromCoordinateForm({
      sectorX: 1,
      sectorY: 0,
      localX: 100,
      localY: 100,
    }),
    null,
  );
  assert.equal(
    targetFromCoordinateForm({
      sectorX: 0,
      sectorY: 0,
      localX: 4096,
      localY: 100,
    }),
    null,
  );
});

test("contact and coordinate selection actions share the single selected-target field", () => {
  const contactSelected = atlasViewportReducer(sectorState(), {
    type: "select-contact",
    targetId: ASHFALL.targetId,
  });
  assert.equal(contactSelected.selectedTargetId, "contact:ashfall");

  const coordinateSelected = atlasViewportReducer(contactSelected, {
    type: "select-coordinate",
    coordinate: coord(0, 0, 1792, 1792),
  });
  assert.equal(
    coordinateSelected.selectedTargetId,
    "coordinate:0:0:1792:1792",
  );
});

test("arrow keys and labeled touch controls dispatch the same pan action", () => {
  const pairs = [
    ["ArrowLeft", "left"],
    ["ArrowRight", "right"],
    ["ArrowUp", "up"],
    ["ArrowDown", "down"],
  ] as const;

  for (const [key, direction] of pairs) {
    assert.deepEqual(
      panActionFromArrowKey(key),
      panActionFromTouchControl(direction),
    );
  }
  assert.deepEqual(panActionFromArrowKey("ArrowRight"), {
    type: "pan",
    deltaX: ATLAS_PAN_STEP_UNITS,
    deltaY: 0,
  });
  assert.equal(panActionFromArrowKey("Enter"), null);
});

test("touch pinch converts to the shared zoom action and cannot commit a target", () => {
  const pinch = zoomActionFromPinch(100, 150, 1);
  assert.deepEqual(pinch, zoomAction(1.5));

  const state = sectorState();
  const next = atlasViewportReducer(state, pinch);
  assert.equal(next.zoom, 1.5);
  assert.equal(next.selectedTargetId, null);

  assert.deepEqual(
    zoomActionFromPinch(100, 10000, ATLAS_ZOOM_MAX),
    zoomAction(ATLAS_ZOOM_MAX),
  );
});
