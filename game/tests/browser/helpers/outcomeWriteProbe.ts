import type { Page } from "@playwright/test";

import { SAVE_STORAGE_KEY } from "./saveFixture";

export type OutcomeWriteKind = "commit" | "acknowledgement" | "other";

export interface OutcomeWriteObservation {
  kind: OutcomeWriteKind;
  outcomeId: string | null;
  failed: boolean;
  atlasMounted: boolean;
  regionMounted: boolean;
}

interface OutcomeWriteProbeState {
  failCommitWrites: number;
  failAcknowledgementWrites: number;
  observations: OutcomeWriteObservation[];
}

declare global {
  interface Window {
    __sectorZeroOutcomeWriteProbe?: OutcomeWriteProbeState;
  }
}

function probeState(page: Page): Promise<OutcomeWriteProbeState> {
  return page.evaluate(() => {
    const probe = window.__sectorZeroOutcomeWriteProbe;
    if (!probe) throw new Error("Outcome write probe was not installed");
    return structuredClone(probe);
  });
}

export async function installOutcomeWriteProbe(
  page: Page,
  failures: { commit?: number; acknowledgement?: number },
): Promise<void> {
  await page.addInitScript(
    ({ key, failCommitWrites, failAcknowledgementWrites }) => {
      const probe: OutcomeWriteProbeState = {
        failCommitWrites,
        failAcknowledgementWrites,
        observations: [],
      };
      Object.defineProperty(window, "__sectorZeroOutcomeWriteProbe", {
        configurable: false,
        value: probe,
      });

      const originalGetItem = Storage.prototype.getItem;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function observedOutcomeWrite(storageKey, value): void {
        if (this !== localStorage || storageKey !== key) {
          originalSetItem.call(this, storageKey, value);
          return;
        }

        let candidate: Record<string, unknown> | null = null;
        let current: Record<string, unknown> | null = null;
        try {
          candidate = JSON.parse(value) as Record<string, unknown>;
          const currentRaw = originalGetItem.call(this, storageKey);
          current = currentRaw === null
            ? null
            : JSON.parse(currentRaw) as Record<string, unknown>;
        } catch {
          originalSetItem.call(this, storageKey, value);
          return;
        }

        const records = Array.isArray(candidate.outcomeRecoveryRecords)
          ? candidate.outcomeRecoveryRecords
          : [];
        const currentRecords = Array.isArray(current?.outcomeRecoveryRecords)
          ? current.outcomeRecoveryRecords
          : [];
        const currentIds = new Set(Array.isArray(current?.appliedOutcomeIds)
          ? current.appliedOutcomeIds.filter((entry): entry is string => typeof entry === "string")
          : []);
        const pendingCommit = records.find((entry) => {
          if (typeof entry !== "object" || entry === null) return false;
          const receipt = entry as Record<string, unknown>;
          return receipt.kind === "applied_return" && receipt.returnPending === true &&
            typeof receipt.outcomeId === "string" && !currentIds.has(receipt.outcomeId);
        }) as Record<string, unknown> | undefined;
        const acknowledgement = records.find((entry) => {
          if (typeof entry !== "object" || entry === null) return false;
          const receipt = entry as Record<string, unknown>;
          if (receipt.kind !== "applied_return" || receipt.returnPending !== false ||
            typeof receipt.outcomeId !== "string") return false;
          return currentRecords.some((currentEntry) => {
            if (typeof currentEntry !== "object" || currentEntry === null) return false;
            const currentReceipt = currentEntry as Record<string, unknown>;
            return currentReceipt.kind === "applied_return" && currentReceipt.returnPending === true &&
              currentReceipt.outcomeId === receipt.outcomeId;
          });
        }) as Record<string, unknown> | undefined;
        const kind: OutcomeWriteKind = pendingCommit
          ? "commit"
          : acknowledgement
            ? "acknowledgement"
            : "other";
        const outcomeId = pendingCommit?.outcomeId ?? acknowledgement?.outcomeId ?? null;
        const shouldFail = kind === "commit" && probe.failCommitWrites > 0
          ? (probe.failCommitWrites -= 1, true)
          : kind === "acknowledgement" && probe.failAcknowledgementWrites > 0
            ? (probe.failAcknowledgementWrites -= 1, true)
            : false;
        probe.observations.push({
          kind,
          outcomeId: typeof outcomeId === "string" ? outcomeId : null,
          failed: shouldFail,
          atlasMounted: document.querySelector('[aria-label="Galaxy Atlas"]') !== null,
          regionMounted: document.querySelector('[aria-label="Region map"]') !== null,
        });
        if (shouldFail) throw new DOMException("Injected outcome write failure", "QuotaExceededError");
        originalSetItem.call(this, storageKey, value);
      };
    },
    {
      key: SAVE_STORAGE_KEY,
      failCommitWrites: failures.commit ?? 0,
      failAcknowledgementWrites: failures.acknowledgement ?? 0,
    },
  );
}

export async function readOutcomeWriteObservations(
  page: Page,
): Promise<OutcomeWriteObservation[]> {
  return (await probeState(page)).observations;
}
