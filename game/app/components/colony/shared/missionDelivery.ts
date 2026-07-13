// Mission → colony resource deliveries (OW-0).
//
// Pure module — factionLedger style: no window/document, no Date.now/Math.random.
// Completing a PLANET mission delivers a resource payload to a colony; campaign
// (world/level) missions deliver nothing per the open-world design draft
// (docs/superpowers/specs/2026-07-13-open-world-colony-design-draft.md §OW-0).
//
// Payloads are data-driven off PLANET_DEFS themes so a new planet gets a
// sensible payload without touching this file's logic.

import type { PlanetId, SaveData } from "../../engine/types";
import type { ColonyId, ColonyResources, ColonyState } from "./colonyTypes";
import type { ColonyEvent } from "./colonyEvents";
import { Events } from "./colonyEvents";
import { colonyReducer } from "./colonyReducer";
import { PLANET_DEFS } from "../../engine/planets";

/** Reason string recorded on the colony/resourceChanged event for deliveries. */
export const MISSION_DELIVERY_REASON = "mission_delivery";

/** Every planet mission ships this much home, regardless of biome. */
const BASE_DELIVERY: Readonly<Partial<ColonyResources>> = { metal: 60 };

/**
 * Biome flavor bonus, keyed by PlanetDef.theme:
 * lush biomes ship food, frozen/ocean biomes ship water, mineral-rich
 * biomes ship extra metal. Unmapped themes (ruins, crystal) ship base only.
 */
const THEME_DELIVERY_BONUS: Readonly<Record<string, Partial<ColonyResources>>> = {
  jungle: { food: 30 },
  garden: { food: 30 },
  arctic: { water: 30 },
  ocean: { water: 30 },
  desert: { metal: 20 },        // ashfall
  volcanic: { metal: 20 },      // pyraxis
  "fortress-city": { metal: 20 }, // bastion
  "neon-city": { metal: 20 },   // luminos
};

/** Resource payload delivered on completing a mission at the given planet. */
export function deliveryPayloadForPlanet(planetId: PlanetId): Partial<ColonyResources> {
  const def = PLANET_DEFS.find(p => p.id === planetId);
  const bonus = def ? THEME_DELIVERY_BONUS[def.theme] : undefined;
  const payload: Partial<ColonyResources> = { ...BASE_DELIVERY };
  if (bonus) {
    for (const [k, v] of Object.entries(bonus)) {
      const key = k as keyof ColonyResources;
      payload[key] = (payload[key] ?? 0) + (v ?? 0);
    }
  }
  return payload;
}

/**
 * Destination routing: the colony on the mission's planet if one exists,
 * else the player's first colony, else null (no delivery).
 */
export function resolveDeliveryColony(
  colonies: readonly ColonyState[],
  planetId: PlanetId,
): ColonyState | null {
  return colonies.find(c => c.planetId === planetId) ?? colonies[0] ?? null;
}

export interface MissionDelivery {
  colonyId: ColonyId;
  colonyName: string;
  payload: Partial<ColonyResources>;
}

/**
 * Full delivery resolution for a completed planet mission.
 * Returns null when the player has no colonies (nothing to deliver to).
 * Deterministic — the LEVEL_COMPLETE overlay calls this to preview exactly
 * what applyMissionDelivery will do when the player confirms.
 */
export function resolveMissionDelivery(
  planetId: PlanetId,
  colonies: readonly ColonyState[],
): MissionDelivery | null {
  const target = resolveDeliveryColony(colonies, planetId);
  if (!target) return null;
  return {
    colonyId: target.id,
    colonyName: target.name,
    payload: deliveryPayloadForPlanet(planetId),
  };
}

/** The reducer event a delivery is applied through (reason recorded). */
export function missionDeliveryEvent(delivery: MissionDelivery): ColonyEvent {
  return Events.resourceChanged({
    colonyId: delivery.colonyId,
    delta: delivery.payload,
    reason: MISSION_DELIVERY_REASON,
  });
}

/**
 * Apply a planet-mission delivery to the save via the colony reducer.
 * No-op (returns the same save) when the player has no colonies.
 */
export function applyMissionDelivery(
  save: SaveData,
  planetId: PlanetId,
): { save: SaveData; delivery: MissionDelivery | null } {
  const delivery = resolveMissionDelivery(planetId, save.colonies);
  if (!delivery) return { save, delivery: null };
  return { save: colonyReducer(save, missionDeliveryEvent(delivery)), delivery };
}

/** "+80 METAL, +30 FOOD" — display helper for the completion overlay. */
export function deliveryPayloadLabel(payload: Partial<ColonyResources>): string {
  const parts: string[] = [];
  const keys: (keyof ColonyResources)[] = ["metal", "food", "water", "credits"];
  for (const key of keys) {
    const v = payload[key] ?? 0;
    if (v > 0) parts.push(`+${v} ${key.toUpperCase()}`);
  }
  return parts.join(", ");
}
