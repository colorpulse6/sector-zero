import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  type GameState,
  type FirstPersonState,
  type BoardingMap,
} from "./types";
import { castAllRays, type RayHit } from "./raycaster";
import { drawDashboard } from "./dashboard";
import { getSprite, SPRITES } from "./sprites";

// ─── Colors ─────────────────────────────────────────────────────────

const CEILING_COLOR_TOP = "#050510";
const CEILING_COLOR_BOT = "#0a0a20";
const FLOOR_COLOR_TOP = "#1a1a2a";
const FLOOR_COLOR_BOT = "#0a0a15";

// Wall colors by tile type (fallback when no texture)
const WALL_COLORS: Record<string, { light: string; dark: string }> = {
  wall:  { light: "#3a4a5a", dark: "#2a3a4a" },
  empty: { light: "#2a2a3a", dark: "#1a1a2a" },
};

function getSpritePathOrFallback(path: string | undefined, fallback: string): string {
  return path ?? fallback;
}

function createDepthBuffer(wallHits: (RayHit | null)[]): number[] {
  const zBuffer: number[] = new Array(CANVAS_WIDTH);
  for (let x = 0; x < CANVAS_WIDTH; x++) {
    zBuffer[x] = wallHits[x]?.distance ?? 999;
  }
  return zBuffer;
}

if (process.env.NODE_ENV !== "production") {
  console.assert(
    getSpritePathOrFallback(undefined, SPRITES.BOARDING_TILES) === SPRITES.BOARDING_TILES,
    "Fallback sprite path should return the provided default"
  );
}

// ─── Mini-map ───────────────────────────────────────────────────────

function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  fp: FirstPersonState
): void {
  const scale = 3;
  const mw = fp.map.width * scale;
  const mh = fp.map.height * scale;
  const mx = CANVAS_WIDTH - mw - 8;
  const my = 8;

  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);

  for (let r = 0; r < fp.map.height; r++) {
    for (let c = 0; c < fp.map.width; c++) {
      const tile = fp.map.tiles[r][c];
      if (tile === "wall") {
        ctx.fillStyle = "#334";
        ctx.fillRect(mx + c * scale, my + r * scale, scale, scale);
      } else if (tile === "goal") {
        ctx.fillStyle = "#0f8";
        ctx.fillRect(mx + c * scale, my + r * scale, scale, scale);
      } else if (tile === "door") {
        ctx.fillStyle = "#264";
        ctx.fillRect(mx + c * scale, my + r * scale, scale, scale);
      }
    }
  }

  if (fp.objectivePickup) {
    ctx.fillStyle = "#ffaa44";
    ctx.fillRect(mx + fp.objectivePickup.x * scale - 1, my + fp.objectivePickup.y * scale - 1, scale, scale);
  }

  // Player position + direction
  const px = mx + fp.posX * scale;
  const py = my + fp.posY * scale;
  ctx.fillStyle = "#44ccff";
  ctx.beginPath();
  ctx.arc(px, py, 2, 0, Math.PI * 2);
  ctx.fill();

  // Direction line
  ctx.strokeStyle = "#44ccff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + fp.dirX * 8, py + fp.dirY * 8);
  ctx.stroke();
}

// ─── HUD Overlay ────────────────────────────────────────────────────

function drawCrosshair(ctx: CanvasRenderingContext2D): void {
  const cx = CANVAS_WIDTH / 2;
  const cy = GAME_AREA_HEIGHT / 2;
  ctx.strokeStyle = "rgba(68, 204, 255, 0.4)";
  ctx.lineWidth = 1;
  // Small cross
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx - 3, cy);
  ctx.moveTo(cx + 3, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy - 3);
  ctx.moveTo(cx, cy + 3);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();
}

function drawCompass(ctx: CanvasRenderingContext2D, fp: FirstPersonState): void {
  // Direction indicator at top center
  const angle = Math.atan2(fp.dirY, fp.dirX);
  const dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  const idx = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;

  ctx.fillStyle = "#44ccff88";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(dirs[idx], CANVAS_WIDTH / 2, 8);
}

function drawObjectiveBillboard(
  ctx: CanvasRenderingContext2D,
  fp: FirstPersonState
): void {
  if (!fp.objectivePickup) return;

  const dx = fp.objectivePickup.x - fp.posX;
  const dy = fp.objectivePickup.y - fp.posY;
  const invDet = 1.0 / (fp.planeX * fp.dirY - fp.dirX * fp.planeY);
  const transformX = invDet * (fp.dirY * dx - fp.dirX * dy);
  const transformY = invDet * (-fp.planeY * dx + fp.planeX * dy);

  if (transformY <= 0.1) return;

  const screenX = Math.floor((CANVAS_WIDTH / 2) * (1 + transformX / transformY));
  const size = Math.max(18, Math.floor(GAME_AREA_HEIGHT / transformY) * 0.3);
  const drawX = Math.floor(screenX - size / 2);
  const drawY = Math.floor(GAME_AREA_HEIGHT / 2 - size * 0.6);

  ctx.save();
  ctx.shadowColor = "#ffaa44";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(255, 168, 68, 0.9)";
  ctx.fillRect(drawX, drawY, size, size);
  ctx.strokeStyle = "#fff1b3";
  ctx.lineWidth = 2;
  ctx.strokeRect(drawX, drawY, size, size);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff1b3";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(fp.objectivePickup.label, screenX, Math.max(14, drawY - 6));
  ctx.restore();
}

// ─── Enemy Billboards (Doom-style sprites in 3D space) ──────────────

function drawEnemyBillboards(
  ctx: CanvasRenderingContext2D,
  fp: FirstPersonState,
  wallHits: (RayHit | null)[],
  frameCount: number
): void {
  const enemySprite = getSprite(SPRITES.FP_ENEMY_FRONT);
  const enemyFlinchSprite = getSprite(SPRITES.FP_ENEMY_FLINCH);
  const enemyDeathSprite = getSprite(SPRITES.FP_ENEMY_DEATH);

  const zBuffer = createDepthBuffer(wallHits);

  // Sort enemies by distance (farthest first)
  const sorted = [...fp.enemies]
    .filter((e) => e.deathTimer >= 0) // exclude fully dead
    .map((e) => {
      const dx = e.x - fp.posX;
      const dy = e.y - fp.posY;
      return { enemy: e, dist: dx * dx + dy * dy, dx, dy };
    })
    .sort((a, b) => b.dist - a.dist);

  for (const { enemy, dx, dy } of sorted) {
    // Transform enemy position to camera space
    const invDet = 1.0 / (fp.planeX * fp.dirY - fp.dirX * fp.planeY);
    const transformX = invDet * (fp.dirY * dx - fp.dirX * dy);
    const transformY = invDet * (-fp.planeY * dx + fp.planeX * dy); // depth

    if (transformY <= 0.1) continue; // Behind camera

    const spriteScreenX = Math.floor((CANVAS_WIDTH / 2) * (1 + transformX / transformY));

    // Sprite size on screen (based on distance)
    const spriteHeight = Math.abs(Math.floor(GAME_AREA_HEIGHT / transformY)) * 0.6;
    const spriteWidth = spriteHeight;

    const drawStartX = Math.floor(spriteScreenX - spriteWidth / 2);
    const drawStartY = Math.floor(GAME_AREA_HEIGHT / 2 - spriteHeight / 2);

    // Clip to screen and check z-buffer
    const startX = Math.max(0, drawStartX);
    const endX = Math.min(CANVAS_WIDTH - 1, drawStartX + Math.floor(spriteWidth));

    // Check if any column of this sprite is in front of the wall
    let visible = false;
    for (let x = startX; x <= endX; x++) {
      if (transformY < zBuffer[x]) {
        visible = true;
        break;
      }
    }
    if (!visible) continue;

    // Draw the sprite
    const isDying = enemy.deathTimer > 0;
    const sprite = isDying ? enemyDeathSprite : enemySprite;

    if (sprite) {
      ctx.save();
      // Only draw columns that are in front of walls
      ctx.beginPath();
      for (let x = startX; x <= endX; x++) {
        if (transformY < zBuffer[x]) {
          ctx.rect(x, 0, 1, GAME_AREA_HEIGHT);
        }
      }
      ctx.clip();

      if (isDying && enemyDeathSprite) {
        // Death: single image, fade out
        ctx.globalAlpha = enemy.deathTimer / 30;
        ctx.drawImage(enemyDeathSprite, drawStartX, drawStartY, spriteWidth, spriteHeight);
        ctx.globalAlpha = 1;
      } else if (isDying) {
        // Fallback death fade
        ctx.globalAlpha = enemy.deathTimer / 30;
        if (enemySprite) ctx.drawImage(enemySprite, drawStartX, drawStartY, spriteWidth, spriteHeight);
        ctx.globalAlpha = 1;
      } else if (enemy.hp < enemy.maxHp && enemyFlinchSprite) {
        // Flinch: show hurt sprite briefly when damaged
        ctx.drawImage(enemyFlinchSprite, drawStartX, drawStartY, spriteWidth, spriteHeight);
      } else if (sprite) {
        ctx.drawImage(sprite, drawStartX, drawStartY, spriteWidth, spriteHeight);
      }

      ctx.restore();
    } else {
      // Fallback: colored billboard rectangle
      const color = isDying ? "#ff222288" : (enemy.isAggro ? "#ff4444" : "#cc2222");
      ctx.save();
      ctx.beginPath();
      for (let x = startX; x <= endX; x++) {
        if (transformY < zBuffer[x]) {
          ctx.rect(x, 0, 1, GAME_AREA_HEIGHT);
        }
      }
      ctx.clip();

      if (isDying) {
        ctx.globalAlpha = enemy.deathTimer / 30;
      }

      ctx.fillStyle = color;
      ctx.fillRect(drawStartX, drawStartY, spriteWidth, spriteHeight);

      // Eyes
      if (!isDying) {
        ctx.fillStyle = "#ff0000";
        const eyeY = drawStartY + spriteHeight * 0.3;
        ctx.beginPath();
        ctx.arc(spriteScreenX - spriteWidth * 0.15, eyeY, Math.max(2, spriteWidth * 0.06), 0, Math.PI * 2);
        ctx.arc(spriteScreenX + spriteWidth * 0.15, eyeY, Math.max(2, spriteWidth * 0.06), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // HP bar above sprite (only when aggro and not dying)
    if (enemy.isAggro && !isDying && enemy.hp < enemy.maxHp) {
      const barW = spriteWidth * 0.6;
      const barH = 3;
      const barX = spriteScreenX - barW / 2;
      const barY = drawStartY - 8;
      ctx.fillStyle = "#330000";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = enemy.hp / enemy.maxHp > 0.5 ? "#44ff44" : "#ff4444";
      ctx.fillRect(barX, barY, barW * (enemy.hp / enemy.maxHp), barH);
    }
  }
}

function drawPropBillboards(
  ctx: CanvasRenderingContext2D,
  fp: FirstPersonState,
  wallHits: (RayHit | null)[]
): void {
  const zBuffer = createDepthBuffer(wallHits);
  const props = fp.props ?? [];
  if (props.length === 0) return;

  const sorted = [...props]
    .map((prop) => {
      const dx = prop.x - fp.posX;
      const dy = prop.y - fp.posY;
      return { prop, dist: dx * dx + dy * dy, dx, dy };
    })
    .sort((a, b) => b.dist - a.dist);

  for (const { prop, dx, dy } of sorted) {
    const invDet = 1.0 / (fp.planeX * fp.dirY - fp.dirX * fp.planeY);
    const transformX = invDet * (fp.dirY * dx - fp.dirX * dy);
    const transformY = invDet * (-fp.planeY * dx + fp.planeX * dy);
    if (transformY <= 0.1) continue;

    const spriteScreenX = Math.floor((CANVAS_WIDTH / 2) * (1 + transformX / transformY));
    const baseSize = Math.abs(Math.floor(GAME_AREA_HEIGHT / transformY)) * 0.6;
    const spriteHeight = Math.max(20, baseSize * (prop.scale ?? 1));
    const spriteWidth = spriteHeight;
    const drawStartX = Math.floor(spriteScreenX - spriteWidth / 2);
    const drawStartY = Math.floor(GAME_AREA_HEIGHT / 2 - spriteHeight * 0.55);
    const startX = Math.max(0, drawStartX);
    const endX = Math.min(CANVAS_WIDTH - 1, drawStartX + Math.floor(spriteWidth));

    let visible = false;
    for (let x = startX; x <= endX; x++) {
      if (transformY < zBuffer[x]) {
        visible = true;
        break;
      }
    }
    if (!visible) continue;

    const sprite = getSprite(prop.sprite);

    ctx.save();
    ctx.beginPath();
    for (let x = startX; x <= endX; x++) {
      if (transformY < zBuffer[x]) {
        ctx.rect(x, 0, 1, GAME_AREA_HEIGHT);
      }
    }
    ctx.clip();

    if (sprite) {
      ctx.drawImage(sprite, drawStartX, drawStartY, spriteWidth, spriteHeight);
    } else {
      ctx.fillStyle = "rgba(255, 188, 88, 0.55)";
      ctx.fillRect(drawStartX, drawStartY, spriteWidth, spriteHeight);
      ctx.strokeStyle = "#fff1b3";
      ctx.strokeRect(drawStartX, drawStartY, spriteWidth, spriteHeight);
    }

    ctx.restore();

    if (prop.label) {
      ctx.fillStyle = "#ffdd99";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(prop.label, spriteScreenX, Math.max(12, drawStartY - 4));
    }
  }
}

// ─── Gun HUD (bottom center, like Doom) ─────────────────────────────

function drawGunHUD(
  ctx: CanvasRenderingContext2D,
  fp: FirstPersonState,
  frameCount: number
): void {
  const gunSprite = getSprite(SPRITES.FP_GUN_SHEET);
  const isFiring = fp.gunFireTimer > 0;

  // Bob effect when moving
  const bobX = Math.sin(frameCount * 0.1) * 3;
  const bobY = Math.abs(Math.cos(frameCount * 0.1)) * 2;

  const gunW = 200;
  const gunH = 200;
  const gunX = CANVAS_WIDTH / 2 - gunW / 2 + bobX;
  const gunY = GAME_AREA_HEIGHT - gunH + 20 + bobY;

  if (gunSprite) {
    // Gun sheet: 2 frames side-by-side (idle, firing)
    const frameW = gunSprite.width / 2;
    const frameH = gunSprite.height;
    const frameIdx = isFiring ? 1 : 0;

    ctx.drawImage(
      gunSprite,
      frameIdx * frameW, 0, frameW, frameH,
      gunX, gunY, gunW, gunH
    );
  } else {
    // Fallback: simple gun shape
    ctx.fillStyle = "#2a3a4a";
    // Gun body
    ctx.fillRect(gunX + gunW / 2 - 15, gunY + 40, 30, 100);
    // Barrel
    ctx.fillStyle = "#3a4a5a";
    ctx.fillRect(gunX + gunW / 2 - 5, gunY + 10, 10, 40);
    // Grip
    ctx.fillStyle = "#1a2a3a";
    ctx.fillRect(gunX + gunW / 2 - 10, gunY + 120, 20, 40);

    // Muzzle flash
    if (isFiring) {
      ctx.fillStyle = "#ffdd44";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#ffaa00";
      ctx.beginPath();
      ctx.arc(gunX + gunW / 2, gunY + 10, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Energy cell glow
    ctx.fillStyle = "#44ccff44";
    ctx.fillRect(gunX + gunW / 2 - 8, gunY + 60, 16, 20);
  }
}

// ─── Main Renderer ──────────────────────────────────────────────────

// ─── NPC Billboards ─────────────────────────────────────────────────

// Map NPC names to sprite keys
const NPC_SPRITE_MAP: Record<string, string> = {
  "Commander Voss": SPRITES.NPC_VOSS,
  "Doc Kael": SPRITES.NPC_KAEL,
  "Lt. Reyes": SPRITES.NPC_REYES,
  "Survivor": SPRITES.NPC_SURVIVOR,
  "Scavenger": SPRITES.NPC_SCAVENGER,
};

function drawNPCBillboards(
  ctx: CanvasRenderingContext2D,
  fp: FirstPersonState,
  wallHits: (RayHit | null)[],
  frameCount: number
): void {
  if (!fp.npcs || fp.npcs.length === 0) return;

  const zBuffer: number[] = new Array(CANVAS_WIDTH);
  for (let x = 0; x < CANVAS_WIDTH; x++) {
    zBuffer[x] = wallHits[x]?.distance ?? 999;
  }

  const sorted = [...fp.npcs]
    .map((npc) => {
      const dx = npc.x - fp.posX;
      const dy = npc.y - fp.posY;
      return { npc, dist: dx * dx + dy * dy, dx, dy };
    })
    .sort((a, b) => b.dist - a.dist);

  for (const { npc, dx, dy } of sorted) {
    const invDet = 1.0 / (fp.planeX * fp.dirY - fp.dirX * fp.planeY);
    const transformX = invDet * (fp.dirY * dx - fp.dirX * dy);
    const transformY = invDet * (-fp.planeY * dx + fp.planeX * dy);

    if (transformY <= 0.1) continue;

    const spriteScreenX = Math.floor((CANVAS_WIDTH / 2) * (1 + transformX / transformY));
    const spriteHeight = Math.abs(Math.floor(GAME_AREA_HEIGHT / transformY)) * 0.6;
    const spriteWidth = spriteHeight * 0.4; // Tall portrait ratio

    const drawStartX = Math.floor(spriteScreenX - spriteWidth / 2);
    const drawStartY = Math.floor(GAME_AREA_HEIGHT / 2 - spriteHeight / 3); // Feet on ground

    const startX = Math.max(0, drawStartX);
    const endX = Math.min(CANVAS_WIDTH - 1, drawStartX + Math.floor(spriteWidth));

    let visible = false;
    for (let x = startX; x <= endX; x++) {
      if (transformY < zBuffer[x]) { visible = true; break; }
    }
    if (!visible) continue;

    ctx.save();
    ctx.beginPath();
    for (let x = startX; x <= endX; x++) {
      if (transformY < zBuffer[x]) {
        ctx.rect(x, 0, 1, GAME_AREA_HEIGHT);
      }
    }
    ctx.clip();

    // Try to use sprite
    const spritePath = NPC_SPRITE_MAP[npc.name];
    const sprite = spritePath ? getSprite(spritePath) : null;

    if (sprite) {
      ctx.drawImage(sprite, drawStartX, drawStartY, spriteWidth, spriteHeight);
    } else {
      // Fallback colored shape
      ctx.fillStyle = npc.color + "22";
      ctx.beginPath();
      ctx.arc(spriteScreenX, drawStartY + spriteHeight * 0.3, spriteWidth * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = npc.color;
      ctx.fillRect(drawStartX + spriteWidth * 0.15, drawStartY + spriteHeight * 0.2, spriteWidth * 0.7, spriteHeight * 0.8);
      ctx.beginPath();
      ctx.arc(spriteScreenX, drawStartY + spriteHeight * 0.12, spriteWidth * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // Name tag above
    if (transformY < 5) {
      ctx.fillStyle = npc.color;
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(npc.name, spriteScreenX, drawStartY - 4);

      // Type indicator icon
      const typeIcon = npc.type === "merchant" ? "$" : npc.type === "quest" ? "!" : "?";
      ctx.fillStyle = npc.type === "merchant" ? "#ffaa44" : npc.type === "quest" ? "#44ccff" : "#aa88ff";
      ctx.font = `bold ${Math.max(10, spriteWidth * 0.3)}px monospace`;
      ctx.fillText(typeIcon, spriteScreenX, drawStartY - 16);
    }

    ctx.restore();
  }
}

// ─── Dialog Box ─────────────────────────────────────────────────────

function drawDialogBox(
  ctx: CanvasRenderingContext2D,
  fp: FirstPersonState,
  frameCount: number
): void {
  const ds = fp.dialogState;
  if (!ds || !ds.active) return;

  const boxH = ds.shopOpen ? 300 : 140;
  const boxY = GAME_AREA_HEIGHT - boxH - 10;
  const boxX = 16;
  const boxW = CANVAS_WIDTH - 32;

  // Background
  ctx.fillStyle = "rgba(0, 0, 10, 0.9)";
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 8);
  ctx.fill();

  // Border
  const npc = fp.npcs.find((n) => n.id === ds.npcId);
  const borderColor = npc?.color ?? "#44ccff";
  ctx.strokeStyle = borderColor + "88";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 8);
  ctx.stroke();

  if (ds.shopOpen && ds.shopItems) {
    // ── Shop UI ──
    ctx.fillStyle = "#ffaa44";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${npc?.name ?? "SHOP"} — INVENTORY`, boxX + 12, boxY + 12);

    ctx.fillStyle = "#667788";
    ctx.font = "9px monospace";
    ctx.fillText("[Z] Close Shop", boxX + boxW - 110, boxY + 12);

    for (let i = 0; i < ds.shopItems.length; i++) {
      const item = ds.shopItems[i];
      const iy = boxY + 34 + i * 52;

      // Item background
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.roundRect(boxX + 8, iy, boxW - 16, 46, 4);
      ctx.fill();

      // Item name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(item.name, boxX + 16, iy + 8);

      // Description
      ctx.fillStyle = "#889999";
      ctx.font = "9px monospace";
      ctx.fillText(item.description, boxX + 16, iy + 24);

      // Price
      ctx.fillStyle = "#44ff88";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`◆ ${item.cost}`, boxX + boxW - 16, iy + 14);
    }
  } else {
    // ── Dialog text ──
    const line = ds.lines[ds.currentLine];
    if (!line) return;

    // Speaker name
    ctx.fillStyle = borderColor;
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(line.speaker, boxX + 12, boxY + 12);

    // Dialog text — word wrap
    ctx.fillStyle = "#cccccc";
    ctx.font = "12px monospace";
    const words = line.text.split(" ");
    let textLine = "";
    let ty = boxY + 32;
    const maxWidth = boxW - 24;

    for (const word of words) {
      const test = textLine + (textLine ? " " : "") + word;
      if (ctx.measureText(test).width > maxWidth && textLine) {
        ctx.fillText(textLine, boxX + 12, ty);
        textLine = word;
        ty += 18;
      } else {
        textLine = test;
      }
    }
    if (textLine) ctx.fillText(textLine, boxX + 12, ty);

    // Advance prompt
    const prompt = ds.currentLine < ds.lines.length - 1
      ? "[Z] Continue"
      : npc?.type === "merchant" && !npc.interacted
        ? "[Z] Open Shop"
        : "[Z] Close";

    const promptPulse = 0.5 + 0.5 * Math.sin(frameCount * 0.08);
    ctx.globalAlpha = promptPulse;
    ctx.fillStyle = "#667788";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.fillText(prompt, boxX + boxW - 12, boxY + boxH - 14);
    ctx.globalAlpha = 1;

    // Page indicator
    ctx.fillStyle = "#445566";
    ctx.font = "8px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${ds.currentLine + 1} / ${ds.lines.length}`, boxX + 12, boxY + boxH - 14);
  }
}

export function drawFirstPerson(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  const fp = state.firstPersonState;
  if (!fp) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  ctx.clip();

  const wallTexturePath = getSpritePathOrFallback(fp.environmentArt?.wallSprite, SPRITES.BOARDING_TILES);
  const wallTexture = getSprite(wallTexturePath);
  const skyTexture = fp.environmentArt?.skySprite ? getSprite(fp.environmentArt.skySprite) : null;
  const floorTexture = fp.environmentArt?.floorSprite ? getSprite(fp.environmentArt.floorSprite) : null;
  const ceilingTexture = fp.environmentArt?.ceilingSprite ? getSprite(fp.environmentArt.ceilingSprite) : null;

  // ── Ceiling / sky ──
  if (skyTexture) {
    const offset = ((Math.atan2(fp.dirY, fp.dirX) + Math.PI) / (Math.PI * 2)) * skyTexture.width;
    const pattern = ctx.createPattern(skyTexture, "repeat-x");
    if (pattern) {
      ctx.save();
      ctx.translate(-offset, 0);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, CANVAS_WIDTH + skyTexture.width, GAME_AREA_HEIGHT / 2);
      ctx.restore();
      ctx.fillStyle = "rgba(28, 12, 10, 0.18)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT / 2);
    }
  } else if (ceilingTexture) {
    const pattern = ctx.createPattern(ceilingTexture, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT / 2);
    }
  } else {
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, GAME_AREA_HEIGHT / 2);
    ceilGrad.addColorStop(0, CEILING_COLOR_TOP);
    ceilGrad.addColorStop(1, CEILING_COLOR_BOT);
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT / 2);
  }

  // ── Floor ──
  if (floorTexture) {
    const pattern = ctx.createPattern(floorTexture, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, GAME_AREA_HEIGHT / 2, CANVAS_WIDTH, GAME_AREA_HEIGHT / 2);
      ctx.fillStyle = "rgba(10, 8, 12, 0.28)";
      ctx.fillRect(0, GAME_AREA_HEIGHT / 2, CANVAS_WIDTH, GAME_AREA_HEIGHT / 2);
    }
  } else {
    const floorGrad = ctx.createLinearGradient(0, GAME_AREA_HEIGHT / 2, 0, GAME_AREA_HEIGHT);
    floorGrad.addColorStop(0, FLOOR_COLOR_TOP);
    floorGrad.addColorStop(1, FLOOR_COLOR_BOT);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, GAME_AREA_HEIGHT / 2, CANVAS_WIDTH, GAME_AREA_HEIGHT / 2);
  }

  // ── Cast rays ──
  const hits = castAllRays(
    fp.map,
    fp.posX, fp.posY,
    fp.dirX, fp.dirY,
    fp.planeX, fp.planeY,
    CANVAS_WIDTH
  );

  // ── Draw walls ──
  for (let x = 0; x < CANVAS_WIDTH; x++) {
    const hit = hits[x];
    if (!hit) continue;

    // Calculate wall strip height
    const lineHeight = Math.floor(GAME_AREA_HEIGHT / hit.distance);
    const drawStart = Math.max(0, Math.floor(GAME_AREA_HEIGHT / 2 - lineHeight / 2));
    const drawEnd = Math.min(GAME_AREA_HEIGHT - 1, Math.floor(GAME_AREA_HEIGHT / 2 + lineHeight / 2));
    const stripHeight = drawEnd - drawStart;

    if (wallTexture) {
      const isBoardingTiles = wallTexturePath === SPRITES.BOARDING_TILES;
      const texWidth = isBoardingTiles ? wallTexture.width / 3 : wallTexture.width;
      const texHeight = wallTexture.height;
      const texX = Math.floor(hit.wallX * texWidth);
      const srcX = isBoardingTiles
        ? texWidth + Math.min(texX, texWidth - 1)
        : Math.min(texX, texWidth - 1);

      ctx.drawImage(
        wallTexture,
        srcX, 0, 1, texHeight,    // Source: 1-pixel-wide column from texture
        x, drawStart, 1, stripHeight  // Dest: 1-pixel-wide column on screen
      );

      // Darken one side for depth (side 1 = horizontal wall = darker)
      if (hit.side === 1) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fillRect(x, drawStart, 1, stripHeight);
      }

      // Distance fog
      const fogAmount = Math.min(0.7, hit.distance * 0.08);
      if (fogAmount > 0.05) {
        ctx.fillStyle = `rgba(5, 5, 16, ${fogAmount})`;
        ctx.fillRect(x, drawStart, 1, stripHeight);
      }
    } else {
      // Flat color fallback
      const colors = WALL_COLORS[hit.tileType] ?? WALL_COLORS.wall;
      ctx.fillStyle = hit.side === 1 ? colors.dark : colors.light;
      ctx.fillRect(x, drawStart, 1, stripHeight);

      // Distance fog
      const fogAmount = Math.min(0.7, hit.distance * 0.08);
      ctx.fillStyle = `rgba(5, 5, 16, ${fogAmount})`;
      ctx.fillRect(x, drawStart, 1, stripHeight);
    }
  }

  // ── Door highlights ──
  // Doors are walkable but we can add a subtle glow when looking at one
  for (let x = CANVAS_WIDTH / 2 - 2; x <= CANVAS_WIDTH / 2 + 2; x++) {
    const hit = hits[x];
    if (!hit) continue;
    // Check tile in front of the wall we hit
    const checkX = hit.mapX + (hit.side === 0 ? (fp.dirX > 0 ? -1 : 1) : 0);
    const checkY = hit.mapY + (hit.side === 1 ? (fp.dirY > 0 ? -1 : 1) : 0);
    if (checkX >= 0 && checkX < fp.map.width && checkY >= 0 && checkY < fp.map.height) {
      if (fp.map.tiles[checkY][checkX] === "door") {
        ctx.fillStyle = "rgba(68, 204, 102, 0.05)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
        break;
      }
    }
  }

  // ── Static props ──
  drawPropBillboards(ctx, fp, hits);

  // ── Enemy billboards ──
  drawEnemyBillboards(ctx, fp, hits, state.frameCount);

  // ── NPC billboards ──
  drawNPCBillboards(ctx, fp, hits, state.frameCount);

  // ── Objective marker ──
  drawObjectiveBillboard(ctx, fp);

  // ── Gun HUD ──
  drawGunHUD(ctx, fp, state.frameCount);

  // ── Damage flash ──
  if (state.player.invincibleTimer > 50) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.15)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
  }

  // ── Crosshair ──
  drawCrosshair(ctx);

  // ── Compass ──
  drawCompass(ctx, fp);

  // ── Mini-map ──
  drawMiniMap(ctx, fp);

  // ── Level complete banner ──
  if (state.levelCompleteTimer > 0) {
    const alpha = Math.min(1, state.levelCompleteTimer / 30);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, GAME_AREA_HEIGHT / 2 - 44, CANVAS_WIDTH, 88);
    ctx.shadowColor = "#44ff88";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#44ff88";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AREA SECURED", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 - 10);
    ctx.font = "14px monospace";
    ctx.fillStyle = "#aaffcc";
    ctx.shadowBlur = 8;
    ctx.fillText("OBJECTIVE COMPLETE", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 + 20);
    ctx.restore();
  }

  // ── NPC interaction prompt ──
  if (fp.npcs && !fp.dialogState?.active) {
    for (const npc of fp.npcs) {
      const dx = npc.x - fp.posX;
      const dy = npc.y - fp.posY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dot = dx * fp.dirX + dy * fp.dirY;
      if (dist < 2.0 && dot > 0) {
        ctx.fillStyle = "#44ccff";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`[Z] Talk to ${npc.name}`, CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 + 60);
        break;
      }
    }
  }

  // ── Dialog box ──
  if (fp.dialogState?.active) {
    drawDialogBox(ctx, fp, state.frameCount);
  }

  // ── Controls hint ──
  if (!fp.dialogState?.active) {
    ctx.fillStyle = "#44668844";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("← → TURN   ↑ ↓ / W S MOVE   A D STRAFE   Z INTERACT", CANVAS_WIDTH / 2, GAME_AREA_HEIGHT - 8);
  }

  ctx.restore();

  // Dashboard
  drawDashboard(ctx, state);
}
