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
