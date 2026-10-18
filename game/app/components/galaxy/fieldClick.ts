/**
 * What a click on open sector-field space means. Landmark markers catch their own clicks;
 * this runs only when a click lands on the field around them. A click on a star's name, or
 * just outside its hit box on the rendered glow, still means that star; anything else plots
 * a blind coordinate.
 */

/** Reach of a near miss. Wider than the 48px landmark hit box so the glow around it counts. */
export const FIELD_SNAP_RADIUS_PX = 32;
/** Slack around label text so a click between the name and subtitle lines still lands. */
export const LABEL_HIT_PAD_PX = 4;

export interface FieldClickBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FieldClickCandidate {
  key: string;
  center: { x: number; y: number };
  /** Visible label text boxes; empty when the label is hidden. */
  labelBoxes: readonly FieldClickBox[];
  selected: boolean;
}

function finitePoint(point: { x: number; y: number }): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function insideLabel(box: FieldClickBox, x: number, y: number): boolean {
  return x >= box.left - LABEL_HIT_PAD_PX && x <= box.right + LABEL_HIT_PAD_PX
    && y >= box.top - LABEL_HIT_PAD_PX && y <= box.bottom + LABEL_HIT_PAD_PX;
}

/**
 * The landmark a field click belongs to, or null for open space. A name wins over a nearby
 * centre because the player aimed at the text; the selected name wins when two names touch.
 * Otherwise the nearest centre within the snap radius wins.
 */
export function resolveFieldClick(
  x: number,
  y: number,
  candidates: readonly FieldClickCandidate[],
  snapRadiusPx = FIELD_SNAP_RADIUS_PX,
): string | null {
  const live = candidates.filter(candidate => finitePoint(candidate.center));
  const named = live.filter(candidate => candidate.labelBoxes.some(box => insideLabel(box, x, y)));
  if (named.length > 0) {
    return (named.find(candidate => candidate.selected) ?? named[0]).key;
  }
  let nearest: string | null = null;
  let best = snapRadiusPx;
  for (const candidate of live) {
    const distance = Math.hypot(candidate.center.x - x, candidate.center.y - y);
    if (distance <= best) {
      best = distance;
      nearest = candidate.key;
    }
  }
  return nearest;
}
