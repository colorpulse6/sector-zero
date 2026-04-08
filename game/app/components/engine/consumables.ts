import type { ConsumableId, SaveData } from "./types";
import { CONSUMABLE_DEFS, isConsumableUnlocked, getConsumableDef } from "./planets";

// ─── Consumable Inventory Management ────────────────────────────────

export function purchaseConsumable(
  save: SaveData,
  consumableId: ConsumableId
): SaveData | null {
  const def = getConsumableDef(consumableId);
  if (!def) return null;
  if (!isConsumableUnlocked(def, save)) return null;
  if (save.credits < def.cost) return null;

  const currentCount = save.consumableInventory[consumableId] ?? 0;
  if (currentCount >= def.maxCarry) return null;

  return {
    ...save,
    credits: save.credits - def.cost,
    consumableInventory: {
      ...save.consumableInventory,
      [consumableId]: currentCount + 1,
    },
  };
}

export function equipConsumable(
  save: SaveData,
  consumableId: ConsumableId
): SaveData | null {
  const count = save.consumableInventory[consumableId] ?? 0;
  if (count <= 0) return null;
  if (save.equippedConsumables.length >= 3) return null;
  if (save.equippedConsumables.includes(consumableId)) return null;

  return {
    ...save,
    equippedConsumables: [...save.equippedConsumables, consumableId],
  };
}

export function unequipConsumable(
  save: SaveData,
  consumableId: ConsumableId
): SaveData {
  return {
    ...save,
    equippedConsumables: save.equippedConsumables.filter((c) => c !== consumableId),
  };
}

/** Consume one instance of an equipped consumable (used during gameplay) */
export function useConsumable(
  save: SaveData,
  consumableId: ConsumableId
): SaveData | null {
  const count = save.consumableInventory[consumableId] ?? 0;
  if (count <= 0) return null;
  if (!save.equippedConsumables.includes(consumableId)) return null;

  const newCount = count - 1;
  const updated: SaveData = {
    ...save,
    consumableInventory: {
      ...save.consumableInventory,
      [consumableId]: newCount,
    },
  };

  // Auto-unequip if none remaining
  if (newCount <= 0) {
    updated.equippedConsumables = updated.equippedConsumables.filter((c) => c !== consumableId);
  }

  return updated;
}

/** Get all unlocked consumables for the armory shop */
export function getAvailableConsumables(save: SaveData) {
  return CONSUMABLE_DEFS.filter((def) => isConsumableUnlocked(def, save));
}

/** Get all purchasable consumables (unlocked + can afford + not at max) */
export function getPurchasableConsumables(save: SaveData) {
  return CONSUMABLE_DEFS.filter((def) => {
    if (!isConsumableUnlocked(def, save)) return false;
    if (save.credits < def.cost) return false;
    const count = save.consumableInventory[def.id] ?? 0;
    return count < def.maxCarry;
  });
}

// ─── In-Game Consumable Effects ─────────────────────────────────────

export interface ConsumableEffect {
  type: ConsumableId;
  /** Remaining frames for timed effects */
  remainingFrames: number;
  totalFrames: number;
}

export const CONSUMABLE_EFFECT_DURATIONS: Partial<Record<ConsumableId, number>> = {
  "cryo-charge": 180,       // 3 seconds
  "shield-charge": 480,     // 8 seconds
  "weapon-overcharge": 1200, // 20 seconds
  "scanner-pulse": 900,     // 15 seconds
};

/** Apply instant consumable effects, return timed effect if applicable */
export function activateConsumable(
  consumableId: ConsumableId
): { instant: ConsumableId | null; timed: ConsumableEffect | null } {
  const duration = CONSUMABLE_EFFECT_DURATIONS[consumableId];

  if (consumableId === "hull-repair") {
    return { instant: "hull-repair", timed: null };
  }

  if (duration) {
    return {
      instant: null,
      timed: {
        type: consumableId,
        remainingFrames: duration,
        totalFrames: duration,
      },
    };
  }

  return { instant: null, timed: null };
}
