import type { FPEnemy } from "./types";

/** Approved 2026-10-18. Original transparent cutouts; dimensions and standing
 * foot rows are measured at alpha >= 128. These are front-facing billboards,
 * with procedural feedback until directional animation sheets are authored. */
export const APPROVED_HOSTILES = {
  grunt: { path: "/sprites/actors/approved/grunt.png", width: 1024, height: 1536, footRow: 1505, scale: 1.42 },
  charger: { path: "/sprites/actors/approved/charger.png", width: 1245, height: 1263, footRow: 1240, scale: 1.18 },
  sentry: { path: "/sprites/actors/approved/sentry.png", width: 1218, height: 1292, footRow: 1273, scale: 1.58 },
} as const;

export function approvedHostilePresentation(enemy: FPEnemy) {
  const source = APPROVED_HOSTILES[enemy.type] ?? APPROVED_HOSTILES.grunt;
  const animation = enemy.atlasAnimation;
  let height = 1;
  if (enemy.deathTimer > 0) height = 0.18 + 0.82 * Math.max(0, Math.min(1, enemy.deathTimer / 30));
  else if (animation?.action === "walk") height += Math.sin(animation.walkDistance / 1.2 * Math.PI * 2) * 0.025;
  else if (animation?.action === "attack") height += Math.sin(Math.min(1, animation.clockMs / 400) * Math.PI) * 0.1;
  else if (animation?.action === "hurt") height -= Math.sin(Math.min(1, animation.clockMs / 180) * Math.PI) * 0.08;
  return {
    scale: source.scale * height,
    widthFactor: source.width / source.height / height,
    groundLine: source.footRow / source.height,
  };
}
