import type { Page } from "@playwright/test";

import { migrateSave } from "../../../app/components/engine/save";
import type { SaveData } from "../../../app/components/engine/types";

export const SAVE_STORAGE_KEY = "sector-zero-save";
const FIXTURE_INSTALL_MARKER = `${SAVE_STORAGE_KEY}:browser-fixture-installed`;

export function roundTripSaveFixture(fixture: SaveData): SaveData {
  return migrateSave(JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>);
}

export async function installSaveFixture(page: Page, fixture: SaveData): Promise<void> {
  const save = roundTripSaveFixture(fixture);
  await page.addInitScript(
    ({ key, marker, serialized }) => {
      if (sessionStorage.getItem(marker) !== null) return;
      localStorage.setItem(key, serialized);
      sessionStorage.setItem(marker, "true");
    },
    {
      key: SAVE_STORAGE_KEY,
      marker: FIXTURE_INSTALL_MARKER,
      serialized: JSON.stringify(save),
    },
  );
}

export async function readInstalledSave(page: Page): Promise<SaveData> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);
  if (!raw) throw new Error(`No save installed under ${SAVE_STORAGE_KEY}`);
  return migrateSave(JSON.parse(raw) as Record<string, unknown>);
}

/** Compare serialized Legacy domain fields directly, before save migration. */
export function readLegacyDomainBytes(page: Page): Promise<string> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) throw new Error("No installed save to inspect");
    const save = JSON.parse(raw) as Record<string, unknown>;
    // The experience selector, Galaxy state, and coordinator journal are shared
    // authority metadata. Every remaining field belongs to Legacy progression.
    for (const field of [
      "activeExperience", "galaxyRun", "saveRevision", "appliedOutcomeIds", "outcomeRecoveryRecords",
    ]) delete save[field];
    return JSON.stringify(save);
  }, SAVE_STORAGE_KEY);
}

export function readInstalledSaveBytes(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);
}
