import type { FPServiceId, FPShopItem, SaveData } from "./types";

export const CANTINA_SERVICE_DEFS: Record<FPServiceId, {
  name: string;
  description: string;
  cost: number;
}> = {
  "cantina-house-pour": {
    name: "House Pour",
    description: "A local drink and a place at the bar.",
    cost: 5,
  },
};

export function buildServiceShopItem(serviceId: FPServiceId): FPShopItem {
  const def = CANTINA_SERVICE_DEFS[serviceId];
  return { id: serviceId, type: "service", serviceId, ...def };
}

export function purchaseService(save: SaveData, serviceId: FPServiceId): SaveData | null {
  if (!Object.prototype.hasOwnProperty.call(CANTINA_SERVICE_DEFS, serviceId)) return null;
  const def = CANTINA_SERVICE_DEFS[serviceId];
  if (!def || save.credits < def.cost) return null;
  return { ...save, credits: save.credits - def.cost };
}
