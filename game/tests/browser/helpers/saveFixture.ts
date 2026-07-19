import type { Page } from "@playwright/test";

import { migrateSave } from "../../../app/components/engine/save";
import type { SaveData } from "../../../app/components/engine/types";

export const SAVE_STORAGE_KEY = "sector-zero-save";

export function roundTripSaveFixture(fixture: SaveData): SaveData {
  return migrateSave(JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>);
}

export async function installSaveFixture(page: Page, fixture: SaveData): Promise<void> {
  const save = roundTripSaveFixture(fixture);
  await page.addInitScript(
    ({ key, serialized }) => localStorage.setItem(key, serialized),
    { key: SAVE_STORAGE_KEY, serialized: JSON.stringify(save) },
  );
}

export async function readInstalledSave(page: Page): Promise<SaveData> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_STORAGE_KEY);
  if (!raw) throw new Error(`No save installed under ${SAVE_STORAGE_KEY}`);
  return migrateSave(JSON.parse(raw) as Record<string, unknown>);
}
