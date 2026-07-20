import { SPRITES } from "./sprites";

const PANEL_INSET = 12;
const PORTRAIT_SIZE = 88;
const PORTRAIT_TEXT_GAP = 12;
const PORTRAIT_PATH_PREFIX = "/sprites/portraits/";

export interface FPDialogRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FPDialogContentLayout {
  portrait: FPDialogRect | null;
  text: FPDialogRect;
}

export interface FPDialogLayoutPlan {
  portraitPath: string | null;
  textOnly: FPDialogContentLayout;
  withPortrait: FPDialogContentLayout;
}

function resolvePortraitPath(key: string | undefined): string | null {
  if (!key || !Object.prototype.hasOwnProperty.call(SPRITES, key)) return null;

  const path = SPRITES[key as keyof typeof SPRITES];
  return path.startsWith(PORTRAIT_PATH_PREFIX) ? path : null;
}

export function planFPDialogLayout(
  panel: FPDialogRect,
  portraitKey?: string,
): FPDialogLayoutPlan {
  const contentX = panel.x + PANEL_INSET;
  const contentY = panel.y + PANEL_INSET;
  const contentWidth = panel.width - PANEL_INSET * 2;
  const portrait: FPDialogRect = {
    x: contentX,
    y: contentY,
    width: PORTRAIT_SIZE,
    height: PORTRAIT_SIZE,
  };
  const portraitTextX = contentX + PORTRAIT_SIZE + PORTRAIT_TEXT_GAP;

  return {
    portraitPath: resolvePortraitPath(portraitKey),
    textOnly: {
      portrait: null,
      text: {
        x: contentX,
        y: contentY,
        width: contentWidth,
        height: PORTRAIT_SIZE,
      },
    },
    withPortrait: {
      portrait,
      text: {
        x: portraitTextX,
        y: contentY,
        width: contentWidth - PORTRAIT_SIZE - PORTRAIT_TEXT_GAP,
        height: PORTRAIT_SIZE,
      },
    },
  };
}
