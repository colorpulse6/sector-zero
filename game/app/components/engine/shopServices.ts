import type {
  FirstPersonState,
  FPServiceId,
  FPShopItem,
  FPShopPurchaseRequest,
  SaveData,
} from "./types";

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

export function drainShopPurchaseRequest(
  fp: Pick<FirstPersonState, "shopPurchaseRequest">,
): FPShopPurchaseRequest | undefined {
  const request = fp.shopPurchaseRequest;
  fp.shopPurchaseRequest = undefined;
  return request;
}

export function shopPurchaseFeedback(
  request: FPShopPurchaseRequest,
  applied: boolean,
): { text: string; tone: "success" | "error"; frames: number } | null {
  if (!applied) {
    return { text: "PURCHASE UNAVAILABLE", tone: "error", frames: 90 };
  }
  if (request.kind === "service") {
    return { text: "HOUSE POUR SERVED", tone: "success", frames: 90 };
  }
  return null;
}
