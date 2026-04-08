import {
  CANVAS_WIDTH,
  BULLET_SPEED,
  type Bullet,
  type Player,
  type WeaponType,
} from "./types";
import { getSprite, SPRITES } from "./sprites";

let bulletIdCounter = 0;

export function resetBulletIds(): void {
  bulletIdCounter = 0;
}

function createBullet(
  x: number,
  y: number,
  vx: number,
  vy: number,
  isPlayer: boolean,
  damage: number = 1,
  piercing: boolean = false,
  weaponType?: WeaponType
): Bullet {
  return {
    id: ++bulletIdCounter,
    x,
    y,
    vx,
    vy,
    width: isPlayer ? 4 : 6,
    height: isPlayer ? 12 : 8,
    damage,
    isPlayer,
    piercing,
    weaponType,
  };
}

export function firePlayerWeapon(
  player: Player,
  weaponLevel: number,
  weaponType: WeaponType = "kinetic"
): Bullet[] {
  const cx = player.x + player.width / 2;
  const top = player.y;
  const bullets: Bullet[] = [];
  const damage = 1;

  switch (weaponLevel) {
    case 1:
      // Single shot
      bullets.push(createBullet(cx - 2, top, 0, -BULLET_SPEED, true, damage, false, weaponType));
      break;

    case 2:
      // Double shot
      bullets.push(createBullet(cx - 8, top, 0, -BULLET_SPEED, true, damage, false, weaponType));
      bullets.push(createBullet(cx + 4, top, 0, -BULLET_SPEED, true, damage, false, weaponType));
      break;

    case 3:
      // Triple spread
      bullets.push(createBullet(cx - 2, top, 0, -BULLET_SPEED, true, damage, false, weaponType));
      bullets.push(createBullet(cx - 8, top, -1.5, -BULLET_SPEED, true, damage, false, weaponType));
      bullets.push(createBullet(cx + 4, top, 1.5, -BULLET_SPEED, true, damage, false, weaponType));
      break;

    case 4:
      // Quad spread
      bullets.push(createBullet(cx - 6, top, -0.5, -BULLET_SPEED, true, damage, false, weaponType));
      bullets.push(createBullet(cx + 2, top, 0.5, -BULLET_SPEED, true, damage, false, weaponType));
      bullets.push(createBullet(cx - 12, top, -2, -BULLET_SPEED, true, damage, false, weaponType));
      bullets.push(createBullet(cx + 8, top, 2, -BULLET_SPEED, true, damage, false, weaponType));
      break;

    case 5:
    default:
      // Full spread + center
      bullets.push(createBullet(cx - 2, top, 0, -BULLET_SPEED, true, damage, false, weaponType));
      bullets.push(createBullet(cx - 8, top, -1, -BULLET_SPEED, true, damage, false, weaponType));
      bullets.push(createBullet(cx + 4, top, 1, -BULLET_SPEED, true, damage, false, weaponType));
      bullets.push(createBullet(cx - 14, top, -2.5, -BULLET_SPEED, true, damage, false, weaponType));
      bullets.push(createBullet(cx + 10, top, 2.5, -BULLET_SPEED, true, damage, false, weaponType));
      break;
  }

  return bullets;
}

export function fireSideGunners(player: Player, weaponType: WeaponType = "kinetic"): Bullet[] {
  const leftX = player.x - 16;
  const rightX = player.x + player.width + 8;
  const y = player.y + 8;

  return [
    createBullet(leftX, y, 0, -BULLET_SPEED * 0.8, true, 1, false, weaponType),
    createBullet(rightX, y, 0, -BULLET_SPEED * 0.8, true, 1, false, weaponType),
  ];
}

export function updateBullets(
  bullets: Bullet[],
  canvasHeight: number
): Bullet[] {
  return bullets
    .map((b) => ({
      ...b,
      x: b.x + b.vx,
      y: b.y + b.vy,
    }))
    .filter(
      (b) =>
        b.y > -20 &&
        b.y < canvasHeight + 20 &&
        b.x > -20 &&
        b.x < CANVAS_WIDTH + 20
    );
}

// Player bullet sprite sheet: 4 frames (small crystal, medium crystal, large burst, missile)
// Map weapon levels to frames: 1→0, 2→1, 3→2, 4-5→3
function getPlayerBulletFrame(weaponLevel: number): number {
  if (weaponLevel <= 1) return 0;
  if (weaponLevel === 2) return 1;
  if (weaponLevel === 3) return 2;
  return 3;
}

export function drawPlayerBullets(
  ctx: CanvasRenderingContext2D,
  bullets: Bullet[],
  weaponLevel: number = 1,
  hasRapidFire: boolean = false
): void {
  const sheet = getSprite(SPRITES.PLAYER_BULLETS);

  if (sheet) {
    const frameCount = 4;
    const frameW = sheet.width / frameCount;
    const frameH = sheet.height;
    const frameIdx = getPlayerBulletFrame(weaponLevel);
    // Crop to content center (similar to player ship — content in center ~50%)
    const cropTop = Math.floor(frameH * 0.2);
    const cropH = Math.floor(frameH * 0.6);

    const glowColor = hasRapidFire ? "#ff6600" : "#44ccff";

    for (const b of bullets) {
      ctx.save();
      // Glow effect behind the sprite
      ctx.shadowBlur = 6 + weaponLevel * 2;
      ctx.shadowColor = glowColor;

      const drawW = b.width + 16;
      const drawH = b.height + 16;
      const drawX = b.x + b.width / 2 - drawW / 2;
      const drawY = b.y + b.height / 2 - drawH / 2;

      // Tint orange during rapid fire
      if (hasRapidFire) {
        ctx.globalAlpha = 0.85;
      }

      ctx.drawImage(sheet, frameIdx * frameW, cropTop, frameW, cropH, drawX, drawY, drawW, drawH);
      ctx.restore();
    }
  } else {
    // Procedural fallback
    let glowColor: string;
    let fillColor: string;
    let coreColor: string;
    let blurSize: number;

    if (hasRapidFire) {
      glowColor = "#ff6600";
      fillColor = "#ff9944";
      coreColor = "#ffddaa";
      blurSize = 10 + weaponLevel;
    } else {
      glowColor = "#44ccff";
      fillColor = "#88eeff";
      coreColor = "#ffffff";
      blurSize = 6 + weaponLevel * 2;
    }

    for (const b of bullets) {
      ctx.save();
      ctx.shadowBlur = blurSize;
      ctx.shadowColor = glowColor;
      ctx.fillStyle = fillColor;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.shadowBlur = 0;
      ctx.fillStyle = coreColor;
      ctx.fillRect(b.x + 1, b.y + 1, b.width - 2, b.height - 2);

      if (weaponLevel >= 3) {
        ctx.globalAlpha = 0.2 + (weaponLevel - 3) * 0.1;
        ctx.fillStyle = glowColor;
        ctx.fillRect(b.x - 1, b.y + b.height, b.width + 2, 4 + weaponLevel);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }
  }
}

// Enemy bullet sprite sheet: 4 frames (red orb, purple bolt, fire comet, green acid)
const ENEMY_BULLET_FRAME: Record<string, number> = {
  orb: 0,
  bolt: 1,
  fire: 2,
  acid: 3,
};

const ENEMY_BULLET_GLOW: Record<string, string> = {
  orb: "#ff4444",
  bolt: "#9944ff",
  fire: "#ff6600",
  acid: "#44cc44",
};

export function drawEnemyBullets(
  ctx: CanvasRenderingContext2D,
  bullets: Bullet[]
): void {
  const sheet = getSprite(SPRITES.ENEMY_BULLETS);

  if (sheet) {
    const frameCount = 4;
    const frameW = sheet.width / frameCount;
    const frameH = sheet.height;
    // Crop to content center
    const cropTop = Math.floor(frameH * 0.2);
    const cropH = Math.floor(frameH * 0.6);

    for (const b of bullets) {
      ctx.save();
      const variant = b.variant ?? "orb";
      const frameIdx = ENEMY_BULLET_FRAME[variant] ?? 0;
      ctx.shadowBlur = 6;
      ctx.shadowColor = ENEMY_BULLET_GLOW[variant] ?? "#ff4444";

      const drawSize = b.width + 12;
      const drawX = b.x + b.width / 2 - drawSize / 2;
      const drawY = b.y + b.height / 2 - drawSize / 2;

      ctx.drawImage(sheet, frameIdx * frameW, cropTop, frameW, cropH, drawX, drawY, drawSize, drawSize);
      ctx.restore();
    }
  } else {
    // Procedural fallback
    for (const b of bullets) {
      ctx.save();
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#ff4444";
      ctx.fillStyle = "#ff6666";
      ctx.beginPath();
      ctx.arc(b.x + b.width / 2, b.y + b.height / 2, b.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
}
