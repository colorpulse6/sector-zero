import type { FPDialogLine, FPNPC, FPShopItem } from "../../engine/types";
import { SPRITES } from "../../engine/sprites";
import { buildServiceShopItem } from "../../engine/shopServices";
import type { InteriorNpcContentId } from "./buildingTiles";

export interface InteriorNpcContext {
  seed: number;
  periodIndex: 0 | 1;
}

export interface InteriorNpcDefinition<
  RoleId extends InteriorNpcContentId = InteriorNpcContentId,
> {
  roleId: RoleId;
  name: string;
  type: FPNPC["type"];
  spriteId: string;
  portraitKey: string;
  color: string;
  buildDialog: (context: InteriorNpcContext) => FPDialogLine[];
  buildShopItems?: (context: InteriorNpcContext) => FPShopItem[];
  canBuy?: boolean;
}

const CANTINA_RUMORS = {
  "hub-regular": [
    "A convoy saw lights moving under the western glass.",
    "The old relay wakes just before the dust turns.",
    "Long-range static has been spelling out colony call signs.",
  ],
  "hub-signal-chaser": [
    "I caught our colony beacon echoing from below the ridge.",
    "Someone is stepping on the emergency band every sixth pulse.",
    "The rumor terminal logs a carrier wave no relay admits sending.",
  ],
} as const;

type CantinaRumorRoleId = keyof typeof CANTINA_RUMORS;

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function selectCantinaRumor(
  roleId: CantinaRumorRoleId,
  context: InteriorNpcContext,
): string {
  const pool = CANTINA_RUMORS[roleId];
  const hash = fnv1a32(`${context.seed}:${roleId}:${context.periodIndex}`);
  return pool[hash % pool.length];
}

export const INTERIOR_NPC_DEFINITIONS: {
  [RoleId in InteriorNpcContentId]: InteriorNpcDefinition<RoleId>;
} = {
  "hub-bartender": {
    roleId: "hub-bartender",
    name: "BARTENDER",
    type: "merchant",
    spriteId: SPRITES.NPC_HUB_BARTENDER,
    portraitKey: "PORTRAIT_HUB_BARTENDER",
    color: "#ffaa44",
    buildDialog: () => [{
      speaker: "BARTENDER",
      text: "House pour is five credits. Rumors come free.",
    }],
    buildShopItems: () => [buildServiceShopItem("cantina-house-pour")],
    canBuy: true,
  },
  "hub-regular": {
    roleId: "hub-regular",
    name: "REGULAR",
    type: "lore",
    spriteId: SPRITES.NPC_HUB_REGULAR,
    portraitKey: "PORTRAIT_HUB_REGULAR",
    color: "#66ccff",
    buildDialog: (context) => [{
      speaker: "REGULAR",
      text: selectCantinaRumor("hub-regular", context),
    }],
  },
  "hub-signal-chaser": {
    roleId: "hub-signal-chaser",
    name: "SIGNAL CHASER",
    type: "lore",
    spriteId: SPRITES.NPC_HUB_SIGNAL_CHASER,
    portraitKey: "PORTRAIT_HUB_SIGNAL_CHASER",
    color: "#cc88ff",
    buildDialog: (context) => [{
      speaker: "SIGNAL CHASER",
      text: selectCantinaRumor("hub-signal-chaser", context),
    }],
  },
};
