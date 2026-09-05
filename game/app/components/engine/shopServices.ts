import type {
  FirstPersonState,
  FPDialogState,
  FPServiceId,
  FPShopItem,
  FPShopPurchaseRequest,
  SaveData,
} from "./types";

export type ShopPurchaseFeedback = {
  text: string;
  tone: "success" | "error";
  frames: number;
} | null;

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
): ShopPurchaseFeedback {
  if (!applied) {
    return { text: "PURCHASE UNAVAILABLE", tone: "error", frames: 90 };
  }

  switch (request.kind) {
    case "service":
      return { text: "HOUSE POUR SERVED", tone: "success", frames: 90 };
    case "consumable":
      return null;
    default: {
      const exhaustiveRequest: never = request;
      return exhaustiveRequest;
    }
  }
}

export function setShopPurchaseFeedback(
  dialog: Pick<FPDialogState, "shopFlashFrames" | "shopFlashText" | "shopFlashTone">,
  feedback: ShopPurchaseFeedback,
): void {
  if (feedback === null) {
    dialog.shopFlashFrames = 0;
    dialog.shopFlashText = undefined;
    dialog.shopFlashTone = undefined;
    return;
  }

  dialog.shopFlashFrames = feedback.frames;
  dialog.shopFlashText = feedback.text;
  dialog.shopFlashTone = feedback.tone;
}
