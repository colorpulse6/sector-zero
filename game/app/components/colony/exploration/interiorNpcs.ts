import type { FPNPC } from "../../engine/types";
import type { InteriorNpcSlot } from "./buildingTiles";
import { INTERIOR_NPC_DEFINITIONS } from "./cantinaContent";

function normalizeHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

export function resolveInteriorSchedule(
  schedule: InteriorNpcSlot["schedule"],
  hour: number,
): { periodIndex: 0 | 1; anchor: { x: number; y: number } | null } {
  const normalizedHour = normalizeHour(hour);
  const elapsedSinceStart = schedule.map((period) =>
    normalizeHour(normalizedHour - normalizeHour(period.startHour)),
  );
  const periodIndex: 0 | 1 = elapsedSinceStart[0] < elapsedSinceStart[1] ? 0 : 1;
  return { periodIndex, anchor: schedule[periodIndex].anchor };
}

export function generateInteriorNpcs(
  slots: readonly InteriorNpcSlot[],
  entryHour: number,
  seed: number,
): FPNPC[] {
  return slots.flatMap((slot, slotIndex) => {
    const { periodIndex, anchor } = resolveInteriorSchedule(slot.schedule, entryHour);
    if (!anchor) return [];

    const definition = INTERIOR_NPC_DEFINITIONS[slot.contentId];
    const context = { seed, periodIndex };
    return [{
      id: slotIndex + 1,
      x: anchor.x + 0.5,
      y: anchor.y + 0.5,
      name: definition.name,
      type: definition.type,
      dialog: definition.buildDialog(context).map((line) => ({
        ...line,
        portraitKey: definition.portraitKey,
      })),
      shopItems: definition.buildShopItems?.(context),
      color: definition.color,
      interacted: false,
      sprite: definition.spriteId,
      canBuy: definition.canBuy,
    }];
  });
}
