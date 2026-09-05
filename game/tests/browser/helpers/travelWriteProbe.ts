import type { Page } from "@playwright/test";

import { SAVE_STORAGE_KEY } from "./saveFixture";

export type TravelWriteKind = "commit" | "resume" | "finalize" | "retreat";

export interface TravelWriteObservation {
  kind: TravelWriteKind;
  transactionId: string;
  beforeBytes: string;
  candidateBytes: string;
  failed: boolean;
}

declare global {
  interface Window {
    __sectorZeroTravelWrites?: TravelWriteObservation[];
  }
}

/** Inject failures at localStorage, after the real UI has produced a candidate. */
export async function installTravelWriteProbe(
  page: Page,
  failures: Partial<Record<TravelWriteKind, number>>,
): Promise<void> {
  await page.addInitScript(({ key, failures }) => {
    const observations: TravelWriteObservation[] = [];
    Object.defineProperty(window, "__sectorZeroTravelWrites", { value: observations });
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function observedTravelWrite(storageKey, value): void {
      if (this !== localStorage || storageKey !== key) {
        originalSetItem.call(this, storageKey, value);
        return;
      }
      const beforeBytes = originalGetItem.call(this, key);
      type TravelSave = {
        galaxyRun?: { activeTravel?: { state: string; transactionId: string } | null };
      };
      let before: TravelSave | null;
      let candidate: TravelSave;
      try {
        before = beforeBytes === null ? null : JSON.parse(beforeBytes) as TravelSave;
        candidate = JSON.parse(value) as TravelSave;
      } catch {
        originalSetItem.call(this, storageKey, value);
        return;
      }
      const previous = before?.galaxyRun?.activeTravel;
      const next = candidate.galaxyRun?.activeTravel;
      const kind: TravelWriteKind | null = before === null
        ? null
        : previous === null && next?.state === "committed"
          ? "commit"
          : previous?.state === "diverted" && next?.state === "resolved"
            ? "retreat"
            : previous && next === null
              ? "finalize"
              : previous && next && previous.state !== next.state
                ? "resume"
                : null;
      if (kind !== null && beforeBytes !== null) {
        const failed = (failures[kind] ?? 0) > 0;
        if (failed) failures[kind] = (failures[kind] ?? 0) - 1;
        observations.push({
          kind,
          transactionId: next?.transactionId ?? previous!.transactionId,
          beforeBytes,
          candidateBytes: value,
          failed,
        });
        if (failed) throw new DOMException("Injected travel write failure", "QuotaExceededError");
      }
      originalSetItem.call(this, storageKey, value);
    };
  }, { key: SAVE_STORAGE_KEY, failures });
}

export function readTravelWriteObservations(page: Page): Promise<TravelWriteObservation[]> {
  return page.evaluate(() => [...(window.__sectorZeroTravelWrites ?? [])]);
}
