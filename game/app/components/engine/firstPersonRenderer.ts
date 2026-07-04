import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  type GameState,
  type FirstPersonState,
} from "./types";
import { drawDashboard } from "./dashboard";
import { getSprite, SPRITES } from "./sprites";
import {
  drawFirstPersonPixel,
  currentFrame,
  currentScene,
  projectBillboard,
} from "./fpRender";

// The 3D scene (ceiling/sky, floor, walls, billboards) renders through the
// per-pixel pipeline in ./fpRender. This module owns only the vector overlays
// drawn on top of the presented frame.

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

  const padTiles = fp.map.landingPadTiles;
  const foundationTiles = fp.map.foundationTiles;
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
      } else if (foundationTiles?.has(`${c},${r}`)) {
        ctx.fillStyle = "#a87830";  // amber — under construction
        ctx.fillRect(mx + c * scale, my + r * scale, scale, scale);
      } else if (padTiles?.has(`${c},${r}`)) {
        ctx.fillStyle = "#0aa";  // cyan — landing pad
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

// ─── Projected overlays (scene-space entities, vector-drawn) ────────

/** Occlusion check per the overlay projection convention: project at canvas
 *  dims, scale the z-buffer index by the framebuffer ratio (framebuffer may
 *  render at a lower internal resolution from Task 5 on). */
function isOccluded(screenX: number, dist: number): boolean {
  const fb = currentFrame();
  let col = (screenX * fb.w / CANVAS_WIDTH) | 0;
  if (col < 0) col = 0;
  if (col > fb.w - 1) col = fb.w - 1;
  return dist >= fb.zbuf[col];
}

// Extracted from the classic drawEnemyBillboards: the HP bar above damaged,
// aggro'd, alive enemies. Sprite drawing itself lives in the pixel pipeline.
function drawEnemyHpBars(ctx: CanvasRenderingContext2D, fp: FirstPersonState): void {
  const scene = currentScene();
  if (!scene) return;
  for (const enemy of fp.enemies) {
    // classic: isAggro && !isDying && hp < maxHp (dead already filtered out)
    if (enemy.deathTimer !== 0) continue;
    if (!enemy.isAggro || enemy.hp >= enemy.maxHp) continue;
    const p = projectBillboard(scene, enemy.x, enemy.y, CANVAS_WIDTH, GAME_AREA_HEIGHT);
    if (!p || isOccluded(p.screenX, p.dist)) continue;
    const spriteHeight = p.size;                     // classic spriteWidth === spriteHeight
    const drawStartY = Math.floor(GAME_AREA_HEIGHT / 2 - spriteHeight / 2);
    const barW = spriteHeight * 0.6;
    const barH = 3;
    const barX = p.screenX - barW / 2;
    const barY = drawStartY - 8;
    ctx.fillStyle = "#330000";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = enemy.hp / enemy.maxHp > 0.5 ? "#44ff44" : "#ff4444";
    ctx.fillRect(barX, barY, barW * (enemy.hp / enemy.maxHp), barH);
  }
}

// Extracted from the classic drawNPCBillboards: name tag + type icon.
function drawNPCTags(ctx: CanvasRenderingContext2D, fp: FirstPersonState): void {
  const scene = currentScene();
  if (!scene || !fp.npcs || fp.npcs.length === 0) return;
  for (const npc of fp.npcs) {
    const p = projectBillboard(scene, npc.x, npc.y, CANVAS_WIDTH, GAME_AREA_HEIGHT);
    if (!p || p.dist >= 5) continue;                 // classic: tag only when transformY < 5
    if (isOccluded(p.screenX, p.dist)) continue;
    const spriteHeight = p.size;
    const spriteWidth = spriteHeight * 0.4;          // classic tall portrait ratio
    const drawStartY = Math.floor(GAME_AREA_HEIGHT / 2 - spriteHeight / 3);

    ctx.fillStyle = npc.color;
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(npc.name, p.screenX, drawStartY - 4);

    // Type indicator icon
    const typeIcon = npc.type === "merchant" ? "$" : npc.type === "quest" ? "!" : "?";
    ctx.fillStyle = npc.type === "merchant" ? "#ffaa44" : npc.type === "quest" ? "#44ccff" : "#aa88ff";
    ctx.font = `bold ${Math.max(10, spriteWidth * 0.3)}px monospace`;
    ctx.fillText(typeIcon, p.screenX, drawStartY - 16);
  }
}

// Extracted from the classic drawPropBillboards: the floating `label` text
// (Ashfall props like "CAMP RIG" depend on it).
function drawPropLabels(ctx: CanvasRenderingContext2D, fp: FirstPersonState): void {
  const scene = currentScene();
  const props = fp.props ?? [];
  if (!scene || props.length === 0) return;
  for (const prop of props) {
    if (!prop.label) continue;
    const p = projectBillboard(scene, prop.x, prop.y, CANVAS_WIDTH, GAME_AREA_HEIGHT);
    if (!p || isOccluded(p.screenX, p.dist)) continue;
    const spriteHeight = Math.max(20, p.size * (prop.scale ?? 1));
    const drawStartY = Math.floor(GAME_AREA_HEIGHT / 2 - spriteHeight * 0.55);
    ctx.fillStyle = "#ffdd99";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(prop.label, p.screenX, Math.max(12, drawStartY - 4));
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
    // Buyable shops (quartermaster, §I) get row selection + a LEAVE row; a
    // display-only shop (Ashfall, shopCanBuy falsy) keeps the classic browse UI.
    const canBuy = ds.shopCanBuy === true;
    const selectedIndex = ds.selectedIndex ?? 0;
    const leaveIndex = ds.shopItems.length;

    ctx.fillStyle = "#ffaa44";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${npc?.name ?? "SHOP"} — INVENTORY`, boxX + 12, boxY + 12);

    ctx.fillStyle = "#667788";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    const headerHint = canBuy
      ? (selectedIndex === leaveIndex ? "[Z] LEAVE" : "[Z] BUY  ↑↓ SELECT")
      : "[Z] Close Shop";
    ctx.fillText(headerHint, boxX + boxW - 12, boxY + 12);
    ctx.textAlign = "left";

    for (let i = 0; i < ds.shopItems.length; i++) {
      const item = ds.shopItems[i];
      const iy = boxY + 34 + i * 52;
      const selected = canBuy && selectedIndex === i;

      // Item background (highlighted when selected)
      ctx.fillStyle = selected ? "rgba(255, 170, 68, 0.18)" : "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.roundRect(boxX + 8, iy, boxW - 16, 46, 4);
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = "#ffaa44";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(boxX + 8, iy, boxW - 16, 46, 4);
        ctx.stroke();
      }

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
      ctx.textAlign = "left";
    }

    // Trailing LEAVE row (buyable shops only)
    if (canBuy) {
      const ly = boxY + 34 + ds.shopItems.length * 52;
      const selected = selectedIndex === leaveIndex;
      ctx.fillStyle = selected ? "rgba(255, 170, 68, 0.18)" : "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.roundRect(boxX + 8, ly, boxW - 16, 26, 4);
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = "#ffaa44";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(boxX + 8, ly, boxW - 16, 26, 4);
        ctx.stroke();
      }
      ctx.fillStyle = "#cccccc";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "left";
      ctx.fillText("LEAVE", boxX + 16, ly + 7);
    }

    // Transient generic "purchase unavailable" flash (§I)
    if ((ds.shopFlashFrames ?? 0) > 0) {
      ctx.fillStyle = "#ff6666";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PURCHASE UNAVAILABLE", boxX + boxW / 2, boxY + boxH - 14);
      ctx.textAlign = "left";
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

    // Advance prompt. At end-of-dialog a merchant's shop opens while it hasn't
    // been shown this session (§I per-session gate), so key off ds.shopSeen — this
    // keeps the prompt accurate now that reopening is no longer `!npc.interacted`.
    const prompt = ds.currentLine < ds.lines.length - 1
      ? "[Z] Continue"
      : npc?.type === "merchant" && !ds.shopSeen
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

// ─── Main Renderer ──────────────────────────────────────────────────

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

  // ── 3D scene (per-pixel pipeline: sky/ceiling, floor, walls, billboards) ──
  // Door highlight is now an emissive light in the scene (sceneInput.ts),
  // superseding the classic screen-wash overlay that used to run here.
  drawFirstPersonPixel(ctx, fp);

  // ── Projected entity overlays ──
  drawPropLabels(ctx, fp);
  drawEnemyHpBars(ctx, fp);
  drawNPCTags(ctx, fp);

  // ── Objective marker ── (deliberately draws through walls — wayfinding)
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
