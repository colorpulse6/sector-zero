import { CANVAS_WIDTH, CANVAS_HEIGHT, type SaveData, type BestiaryEntry } from "./types";
import { getSprite, SPRITES } from "./sprites";
import { type CockpitHubState, COCKPIT_HOTSPOTS } from "./cockpit";
import { UPGRADE_DEFS, getUpgradeCost, canPurchase, isUpgradeLevelUnlocked, getUnlockRequirement, getXpProgress, getNextEffect, getCurrentEffect } from "./upgrades";
import { CREW, getAvailableConversations, isConversationViewed, countUnread, countTotalUnread } from "./crewDialog";
import { CODEX_CATEGORIES, getEntriesForCategory, isCodexEntryNew, countNewCodexEntries, countNewInCategory } from "./codex";
import { getAvailableQuests, isQuestActive, isQuestCompleted, countAvailableQuests, QUEST_TYPE_NAMES, QUEST_TYPE_ICONS, QUEST_TYPE_COLORS } from "./sideQuests";
import { PLANET_DEFS, isPlanetUnlocked, isPlanetCompleted } from "./planets";
import { WORLD_NAMES } from "./levels";
import { getBestiaryList, getDiscoveredCount, getTotalEnemyCount, ENEMY_LORE } from "./bestiary";
import { ENEMY_CLASS_PROFILES } from "./enemyClasses";
import { WEAPON_TYPE_META } from "./weaponTypes";
import { ENEMY_SPRITE_MAP } from "./enemies";
import { xpForLevel, xpProgress, getMilestones, MAX_PILOT_LEVEL, bonusHp, creditBonus, materialDropBonus, skillPointsAtLevel } from "./pilotLevel";
import { getTreeNodes, canAllocate } from "./skillTree";
import { getAvailableSpecialMissions, isSpecialMissionCompleted } from "./specialMissions";

// ─── Main Cockpit Drawing ───────────────────────────────────────────

export function drawCockpit(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData
): void {
  ctx.save();

  if (state.screen === "hub") {
    drawCockpitHub(ctx, state, save);
  } else if (state.screen === "armory") {
    drawArmoryScreen(ctx, state, save);
  } else if (state.screen === "crew") {
    drawCrewScreen(ctx, state, save);
  } else if (state.screen === "missions") {
    drawMissionsScreen(ctx, state, save);
  } else if (state.screen === "codex") {
    drawCodexScreen(ctx, state, save);
  } else if (state.screen === "bestiary") {
    drawBestiaryScreen(ctx, state, save);
  } else if (state.screen === "pilot") {
    drawPilotScreen(ctx, state, save);
  }

  // Screen transition overlay (fade from black)
  if (state.transitionTimer > 0) {
    const alpha = state.transitionTimer / 12;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  ctx.restore();
}

// ─── Hub Main Screen ────────────────────────────────────────────────

function drawCockpitHub(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData
): void {
  // Background
  const bg = getSprite(SPRITES.COCKPIT_BG);
  if (bg) {
    ctx.drawImage(bg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    // Fallback: dark bridge interior
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Viewport (top area showing stars)
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, "#0a0a20");
    gradient.addColorStop(1, "#080810");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 200);

    // Viewport stars
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137 + 23) % CANVAS_WIDTH;
      const sy = (i * 89 + 11) % 180 + 10;
      const alpha = 0.3 + 0.5 * Math.abs(Math.sin(state.animTimer * 0.015 + i * 1.7));
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Console lines (decorative)
    ctx.strokeStyle = "#1a1a30";
    ctx.lineWidth = 1;
    for (let y = 200; y < CANVAS_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Center console glow
    ctx.fillStyle = "rgba(68, 204, 255, 0.03)";
    ctx.beginPath();
    ctx.ellipse(240, 500, 120, 80, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Ambient Effects ──

  // Floating dust particles
  for (let i = 0; i < 20; i++) {
    const seed = i * 73 + 17;
    const speed = 0.3 + (seed % 5) * 0.15;
    const px = ((seed * 31 + state.animTimer * speed * 0.4) % (CANVAS_WIDTH + 40)) - 20;
    const py = ((seed * 47 + state.animTimer * speed * 0.2) % (CANVAS_HEIGHT - 200)) + 200;
    const alpha = 0.08 + 0.06 * Math.sin(state.animTimer * 0.02 + seed);
    const size = 0.8 + (seed % 3) * 0.4;
    ctx.fillStyle = `rgba(120, 180, 220, ${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Blinking console indicator lights
  const indicators = [
    { x: 20, y: 400, color: "68, 204, 255", rate: 0.04 },
    { x: 460, y: 420, color: "68, 204, 255", rate: 0.05 },
    { x: 35, y: 520, color: "68, 255, 136", rate: 0.03 },
    { x: 445, y: 540, color: "68, 255, 136", rate: 0.06 },
    { x: 15, y: 650, color: "255, 136, 68", rate: 0.02 },
    { x: 465, y: 660, color: "255, 136, 68", rate: 0.04 },
    { x: 50, y: 750, color: "68, 204, 255", rate: 0.035 },
    { x: 430, y: 740, color: "68, 204, 255", rate: 0.055 },
  ];
  for (const ind of indicators) {
    const alpha = 0.15 + 0.35 * Math.max(0, Math.sin(state.animTimer * ind.rate));
    ctx.fillStyle = `rgba(${ind.color}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(ind.x, ind.y, 2, 0, Math.PI * 2);
    ctx.fill();
    // Glow halo
    ctx.fillStyle = `rgba(${ind.color}, ${alpha * 0.2})`;
    ctx.beginPath();
    ctx.arc(ind.x, ind.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle scanline effect
  ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
  for (let y = 0; y < CANVAS_HEIGHT; y += 3) {
    ctx.fillRect(0, y, CANVAS_WIDTH, 1);
  }

  // Title
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#44ccff";
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("UEC VANGUARD — BRIDGE", CANVAS_WIDTH / 2, 220);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`PILOT Lv ${save.pilotLevel}`, CANVAS_WIDTH / 2, 238);

  ctx.fillStyle = "#556666";
  ctx.font = "10px monospace";
  ctx.fillText("SELECT STATION", CANVAS_WIDTH / 2, 252);

  if (save.storyItems.includes("kepler-black-box")) {
    ctx.fillStyle = "#ffaa44";
    ctx.font = "bold 9px monospace";
    ctx.fillText("QUEST ITEM SECURED: KEPLER BLACK BOX", CANVAS_WIDTH / 2, 268);
  }

  // Hotspots
  for (let i = 0; i < COCKPIT_HOTSPOTS.length; i++) {
    const hotspot = COCKPIT_HOTSPOTS[i];
    const isSelected = state.selectedHotspot === i;
    const cx = hotspot.x + hotspot.w / 2;
    const cy = hotspot.y + hotspot.h / 2;

    // Dark backdrop so text is readable over the cockpit art
    ctx.fillStyle = isSelected ? "rgba(0, 8, 20, 0.85)" : "rgba(0, 4, 12, 0.7)";
    ctx.beginPath();
    ctx.roundRect(hotspot.x, hotspot.y, hotspot.w, hotspot.h, 6);
    ctx.fill();

    if (isSelected) {
      // Pulsing glow border
      const pulse = 0.5 + 0.4 * Math.sin(state.animTimer * 0.06);
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#44ccff";
      ctx.strokeStyle = `rgba(68, 204, 255, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(hotspot.x - 2, hotspot.y - 2, hotspot.w + 4, hotspot.h + 4, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner highlight fill
      ctx.fillStyle = "rgba(68, 204, 255, 0.1)";
      ctx.beginPath();
      ctx.roundRect(hotspot.x, hotspot.y, hotspot.w, hotspot.h, 6);
      ctx.fill();
    } else {
      // Visible border for unselected
      ctx.strokeStyle = "rgba(68, 204, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(hotspot.x, hotspot.y, hotspot.w, hotspot.h, 6);
      ctx.stroke();
    }

    // Icon
    ctx.fillStyle = isSelected ? "#44ccff" : "#88aabb";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const icons: Record<string, string> = {
      starmap: "\u2726",   // star
      armory: "\u2692",    // crossed hammers
      crew: "\u263A",      // smiley
      missions: "\u2694",  // crossed swords
      codex: "\u2637",     // trigram
    };
    ctx.fillText(icons[hotspot.id] || "?", cx, cy - 6);

    // Name
    ctx.fillStyle = isSelected ? "#ffffff" : "#bbccdd";
    ctx.font = isSelected ? "bold 11px monospace" : "bold 10px monospace";
    ctx.fillText(hotspot.name, cx, cy + 14);

    // Description
    ctx.fillStyle = isSelected ? "#88ccdd" : "#667788";
    ctx.font = "9px monospace";
    ctx.fillText(hotspot.description, cx, cy + 28);

    // Enter hint (only when selected)
    if (isSelected) {
      const enterPulse = 0.4 + 0.4 * Math.sin(state.animTimer * 0.08);
      ctx.fillStyle = `rgba(68, 204, 255, ${enterPulse})`;
      ctx.font = "bold 9px monospace";
      ctx.fillText("[ENTER]", cx, cy + 42);
    }

    // Notification badges
    drawNotificationBadge(ctx, hotspot, i, save, state);
  }

  // Bottom bar: Credits + Stars
  ctx.fillStyle = "rgba(0, 0, 10, 0.6)";
  ctx.fillRect(0, CANVAS_HEIGHT - 50, CANVAS_WIDTH, 50);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT - 50);
  ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - 50);
  ctx.stroke();

  // Credits
  ctx.shadowBlur = 4;
  ctx.shadowColor = "#44ff88";
  ctx.fillStyle = "#44ff88";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`\u25C6 ${save.credits}`, 16, CANVAS_HEIGHT - 25);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#556666";
  ctx.font = "9px monospace";
  ctx.fillText("CREDITS", 16, CANVAS_HEIGHT - 10);

  // Stars
  ctx.shadowBlur = 4;
  ctx.shadowColor = "#FFD700";
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`\u2605 ${save.totalStars}`, CANVAS_WIDTH - 16, CANVAS_HEIGHT - 25);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#556666";
  ctx.font = "9px monospace";
  ctx.textAlign = "right";
  ctx.fillText("STARS", CANVAS_WIDTH - 16, CANVAS_HEIGHT - 10);

  // Controls hint
  ctx.fillStyle = "#445566";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("\u2190\u2191\u2192\u2193 NAVIGATE   ENTER SELECT   ESC MENU", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 25);
}

// ─── Notification Badges ────────────────────────────────────────────

function drawNotificationBadge(
  ctx: CanvasRenderingContext2D,
  hotspot: typeof COCKPIT_HOTSPOTS[0],
  _index: number,
  save: SaveData,
  _state: CockpitHubState
): void {
  let hasNotification = false;

  if (hotspot.id === "crew") {
    hasNotification = countTotalUnread(save) > 0;
  } else if (hotspot.id === "codex") {
    hasNotification = countNewCodexEntries(save) > 0;
  } else if (hotspot.id === "missions") {
    const hasQuests = countAvailableQuests(save) > 0;
    const hasUnlockedPlanets = PLANET_DEFS.some(p =>
      isPlanetUnlocked(p, save) && !isPlanetCompleted(p.id, save)
    );
    hasNotification = hasQuests || hasUnlockedPlanets;
  }

  if (hasNotification) {
    const bx = hotspot.x + hotspot.w - 4;
    const by = hotspot.y - 4;
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", bx, by);
  }
}

// ─── Sub-Screen Placeholders ────────────────────────────────────────
// These will be fleshed out in Phases 3-6

function drawSubScreenFrame(
  ctx: CanvasRenderingContext2D,
  title: string,
  bgSprite: string | null
): void {
  // Background
  const bg = bgSprite ? getSprite(bgSprite) : null;
  if (bg) {
    ctx.drawImage(bg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Header bar
  ctx.fillStyle = "rgba(0, 0, 10, 0.8)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 50);
  ctx.lineTo(CANVAS_WIDTH, 50);
  ctx.stroke();

  // Back arrow
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2190 BACK", 12, 25);

  // Title
  ctx.shadowBlur = 6;
  ctx.shadowColor = "#44ccff";
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.fillText(title, CANVAS_WIDTH / 2, 25);
  ctx.shadowBlur = 0;
}

function drawArmoryScreen(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData
): void {
  drawSubScreenFrame(ctx, "ARMORY", SPRITES.ARMORY_BG);

  // Credits and XP display
  ctx.fillStyle = "#667788";
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`\u25C6 ${save.credits.toLocaleString()} credits`, 20, 52);
  ctx.fillStyle = "#7766aa";
  ctx.textAlign = "right";
  ctx.fillText(`XP ${save.xp.toLocaleString()}`, CANVAS_WIDTH - 20, 52);

  const startY = 70;
  const rowH = 56;
  const listX = 16;
  const listW = CANVAS_WIDTH - 32;

  // ── Upgrade Rows ──
  for (let i = 0; i < UPGRADE_DEFS.length; i++) {
    const def = UPGRADE_DEFS[i];
    const currentLevel = save.upgrades[def.id];
    const isSelected = state.armorySelected === i;
    const y = startY + i * rowH;

    // Row background
    if (isSelected) {
      const pulse = 0.06 + 0.04 * Math.sin(state.animTimer * 0.06);
      ctx.fillStyle = `rgba(68, 204, 255, ${pulse})`;
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 4);
      ctx.fill();

      ctx.strokeStyle = "#44ccff66";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 4);
      ctx.stroke();
    }

    // Icon (sprite sheet or fallback character)
    const upgradeSheet = getSprite(SPRITES.UPGRADE_ICONS);
    if (upgradeSheet) {
      const iconFrames = 6;
      const iconFW = upgradeSheet.width / iconFrames;
      const iconFH = upgradeSheet.height;
      const iconDrawSize = 32;
      const iconDrawX = listX + 20 - iconDrawSize / 2;
      const iconDrawY = y + (rowH - 4) / 2 - iconDrawSize / 2;
      if (!isSelected) ctx.globalAlpha = 0.5;
      ctx.drawImage(upgradeSheet, i * iconFW, 0, iconFW, iconFH, iconDrawX, iconDrawY, iconDrawSize, iconDrawSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = isSelected ? def.color : "#445566";
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.icon, listX + 20, y + (rowH - 4) / 2);
    }

    // Name
    ctx.fillStyle = isSelected ? "#ffffff" : "#889999";
    ctx.font = isSelected ? "bold 11px monospace" : "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(def.name, listX + 40, y + 14);

    // Level pips
    const pipX = listX + 40;
    const pipY = y + 30;
    for (let lv = 0; lv < def.maxLevel; lv++) {
      const filled = lv < currentLevel;
      ctx.fillStyle = filled ? def.color : "#223344";
      ctx.strokeStyle = filled ? def.color : "#445566";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(pipX + lv * 28, pipY, 22, 8, 2);
      ctx.fill();
      ctx.stroke();
    }

    // Max label
    if (currentLevel >= def.maxLevel) {
      ctx.fillStyle = "#44ff88";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "left";
      ctx.fillText("MAX", pipX + def.maxLevel * 28 + 4, pipY + 4);
    }

    // Cost or lock status (right side)
    const cost = getUpgradeCost(def, currentLevel);
    const nextLevelUnlocked = isUpgradeLevelUnlocked(def, currentLevel + 1, save);
    if (cost !== null) {
      if (!nextLevelUnlocked) {
        ctx.fillStyle = "#554422";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "right";
        ctx.fillText("\u{1F512} LOCKED", listX + listW - 8, y + 14);
      } else {
        const purchasable = canPurchase(save, def, currentLevel);
        ctx.fillStyle = purchasable ? "#44ff88" : "#553333";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`\u25C6 ${cost}`, listX + listW - 8, y + 14);
      }
    }
  }

  // ── Detail Panel (below list) ──
  const detailY = startY + UPGRADE_DEFS.length * rowH + 12;
  const def = UPGRADE_DEFS[state.armorySelected];
  const currentLevel = save.upgrades[def.id];

  // Detail background
  ctx.fillStyle = "rgba(0, 0, 10, 0.6)";
  ctx.beginPath();
  ctx.roundRect(listX, detailY, listW, 140, 6);
  ctx.fill();
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(listX, detailY, listW, 140, 6);
  ctx.stroke();

  // Selected upgrade name
  ctx.shadowBlur = 6;
  ctx.shadowColor = def.color;
  ctx.fillStyle = def.color;
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(def.name, listX + 12, detailY + 10);
  ctx.shadowBlur = 0;

  // Level indicator
  ctx.fillStyle = "#667788";
  ctx.font = "11px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`Lv ${currentLevel}/${def.maxLevel}`, listX + listW - 12, detailY + 12);

  // Description
  ctx.fillStyle = "#88aabb";
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.fillText(def.description, listX + 12, detailY + 32);

  // Current effect
  const curEffect = getCurrentEffect(def, currentLevel);
  if (curEffect) {
    ctx.fillStyle = "#667788";
    ctx.font = "9px monospace";
    ctx.fillText(`Current: ${curEffect}`, listX + 12, detailY + 52);
  }

  // Next effect
  const nextEffect = getNextEffect(def, currentLevel);
  const nextUnlocked = isUpgradeLevelUnlocked(def, currentLevel + 1, save);
  const unlockReq = getUnlockRequirement(def, currentLevel, save);
  const xpProg = getXpProgress(def, currentLevel, save);

  if (nextEffect) {
    ctx.fillStyle = "#44ccff";
    ctx.font = "9px monospace";
    ctx.fillText(`Next: ${nextEffect}`, listX + 12, detailY + 68);

    const btnY = detailY + 90;
    const btnW = 180;
    const btnX = CANVAS_WIDTH / 2 - btnW / 2;

    if (!nextUnlocked) {
      // Locked — show XP progress bar and requirement
      ctx.strokeStyle = "#44336688";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, 30, 4);
      ctx.stroke();

      // XP progress bar inside button
      const barX = btnX + 8;
      const barW = btnW - 16;
      const barY = btnY + 20;
      const barH = 4;
      ctx.fillStyle = "#1a1a2a";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = "#6644aa";
      ctx.fillRect(barX, barY, barW * xpProg, barH);

      ctx.fillStyle = "#886644";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`\u{1F512} ${unlockReq ?? "LOCKED"}`, CANVAS_WIDTH / 2, btnY + 10);
    } else {
      // Unlocked — show purchase button
      const cost = getUpgradeCost(def, currentLevel)!;
      const purchasable = canPurchase(save, def, currentLevel);

      if (purchasable) {
        const pulse = 0.7 + 0.3 * Math.sin(state.animTimer * 0.08);
        ctx.fillStyle = `rgba(68, 255, 136, ${pulse * 0.15})`;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, 30, 4);
        ctx.fill();

        ctx.strokeStyle = "#44ff88";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, 30, 4);
        ctx.stroke();

        ctx.fillStyle = "#44ff88";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`UPGRADE  \u25C6 ${cost}`, CANVAS_WIDTH / 2, btnY + 15);
      } else {
        ctx.strokeStyle = "#33333388";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, 30, 4);
        ctx.stroke();

        ctx.fillStyle = "#553333";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`\u25C6 ${cost}  NEEDED`, CANVAS_WIDTH / 2, btnY + 15);
      }
    }
  } else {
    // Maxed out
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#44ff88";
    ctx.fillStyle = "#44ff88";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("FULLY UPGRADED", CANVAS_WIDTH / 2, detailY + 85);
    ctx.shadowBlur = 0;
  }

  // ── Bottom Bar: Credits ──
  const barY = CANVAS_HEIGHT - 50;
  ctx.fillStyle = "rgba(0, 0, 10, 0.7)";
  ctx.fillRect(0, barY, CANVAS_WIDTH, 50);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, barY);
  ctx.lineTo(CANVAS_WIDTH, barY);
  ctx.stroke();

  ctx.shadowBlur = 4;
  ctx.shadowColor = "#44ff88";
  ctx.fillStyle = "#44ff88";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`\u25C6 ${save.credits}  CREDITS`, CANVAS_WIDTH / 2, barY + 18);
  ctx.shadowBlur = 0;

  // Controls hint
  ctx.fillStyle = "#445566";
  ctx.font = "9px monospace";
  ctx.fillText("\u2191\u2193 SELECT   ENTER UPGRADE   \u2190 BACK", CANVAS_WIDTH / 2, barY + 38);
}

function drawCrewScreen(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData
): void {
  const crew = CREW[state.crewSelected];
  const convos = crew ? getAvailableConversations(crew.id, save) : [];

  // ── Dialog reading view ──
  if (state.crewDialogActive && convos[state.crewConvoIndex]) {
    drawCrewDialog(ctx, state, save, convos[state.crewConvoIndex]);
    return;
  }

  // ── Main crew screen ──
  drawSubScreenFrame(ctx, "CREW QUARTERS", SPRITES.CREW_BG);

  // ── Character Cards (top section) ──
  const cardW = 130;
  const cardH = 160;
  const cardSpacing = 14;
  const totalW = CREW.length * cardW + (CREW.length - 1) * cardSpacing;
  const startX = (CANVAS_WIDTH - totalW) / 2;
  const cardY = 62;

  for (let i = 0; i < CREW.length; i++) {
    const c = CREW[i];
    const cx = startX + i * (cardW + cardSpacing);
    const isSelected = state.crewSelected === i;
    const unread = countUnread(c.id, save);

    // Card background
    if (isSelected) {
      const pulse = 0.08 + 0.04 * Math.sin(state.animTimer * 0.06);
      ctx.fillStyle = `rgba(68, 204, 255, ${pulse})`;
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cardW, cardH, 6);
      ctx.fill();

      ctx.strokeStyle = c.color + "88";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cardW, cardH, 6);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(10, 10, 20, 0.5)";
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cardW, cardH, 6);
      ctx.fill();

      ctx.strokeStyle = "#22334466";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cardW, cardH, 6);
      ctx.stroke();
    }

    // Portrait
    const portraitKey = c.portraitKey as keyof typeof SPRITES;
    const portrait = getSprite(SPRITES[portraitKey]);
    const portraitSize = 64;
    const px = cx + (cardW - portraitSize) / 2;
    const py = cardY + 10;

    if (portrait) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px, py, portraitSize, portraitSize, 4);
      ctx.clip();
      ctx.drawImage(portrait, px, py, portraitSize, portraitSize);
      ctx.restore();
    } else {
      // Fallback portrait circle
      ctx.fillStyle = c.color + "33";
      ctx.beginPath();
      ctx.arc(px + portraitSize / 2, py + portraitSize / 2, portraitSize / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c.color + "66";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = c.color;
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.name[0], px + portraitSize / 2, py + portraitSize / 2);
    }

    // Name
    ctx.fillStyle = isSelected ? "#ffffff" : "#778899";
    ctx.font = isSelected ? "bold 9px monospace" : "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(c.name, cx + cardW / 2, py + portraitSize + 6);

    // Role
    ctx.fillStyle = isSelected ? c.color : "#556677";
    ctx.font = "8px monospace";
    ctx.fillText(c.role, cx + cardW / 2, py + portraitSize + 20);

    // Unread badge
    if (unread > 0) {
      const bx = cx + cardW - 10;
      const by = cardY + 6;
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${unread}`, bx, by);
    }

    // Selection arrows
    if (isSelected) {
      ctx.fillStyle = c.color;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (i > 0) {
        ctx.fillText("\u25C0", cx - 6, cardY + cardH / 2);
      }
      if (i < CREW.length - 1) {
        ctx.fillText("\u25B6", cx + cardW + 6, cardY + cardH / 2);
      }
    }
  }

  // ── Conversation List ──
  const listY = cardY + cardH + 16;
  const listX = 20;
  const listW = CANVAS_WIDTH - 40;
  const rowH = 48;
  const maxVisible = 8;

  if (convos.length === 0) {
    ctx.fillStyle = "#556677";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("No conversations available yet.", CANVAS_WIDTH / 2, listY + 20);
    ctx.fillStyle = "#445566";
    ctx.font = "9px monospace";
    ctx.fillText("Complete more missions to unlock.", CANVAS_WIDTH / 2, listY + 40);
  } else {
    // Section header
    ctx.fillStyle = crew ? crew.color : "#44ccff";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("CONVERSATIONS", listX, listY);

    const convoStartY = listY + 18;
    const scrollOffset = Math.max(0, state.crewConvoIndex - maxVisible + 1);

    for (let i = scrollOffset; i < Math.min(convos.length, scrollOffset + maxVisible); i++) {
      const convo = convos[i];
      const isSelected = state.crewConvoIndex === i;
      const viewed = isConversationViewed(convo.id, save);
      const y = convoStartY + (i - scrollOffset) * rowH;

      // Row background
      if (isSelected) {
        const pulse = 0.06 + 0.03 * Math.sin(state.animTimer * 0.06);
        ctx.fillStyle = `rgba(68, 204, 255, ${pulse})`;
        ctx.beginPath();
        ctx.roundRect(listX, y, listW, rowH - 4, 4);
        ctx.fill();

        ctx.strokeStyle = (crew?.color ?? "#44ccff") + "66";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(listX, y, listW, rowH - 4, 4);
        ctx.stroke();
      }

      // Unread indicator
      if (!viewed) {
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("(!)", listX + 6, y + (rowH - 4) / 2);
      }

      // Title
      const titleX = viewed ? listX + 10 : listX + 30;
      ctx.fillStyle = isSelected ? "#ffffff" : (viewed ? "#778899" : "#ccddee");
      ctx.font = isSelected ? "bold 11px monospace" : "11px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(convo.title, titleX, y + 8);

      // Preview (first line truncated)
      const preview = convo.lines[0]?.text ?? "";
      const maxChars = 38;
      const truncated = preview.length > maxChars ? preview.substring(0, maxChars) + "..." : preview;
      ctx.fillStyle = isSelected ? "#889999" : "#556677";
      ctx.font = "9px monospace";
      ctx.fillText(truncated, titleX, y + 24);
    }

    // Scroll indicators
    if (scrollOffset > 0) {
      ctx.fillStyle = "#44ccff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("\u25B2 more", CANVAS_WIDTH / 2, convoStartY - 6);
    }
    if (scrollOffset + maxVisible < convos.length) {
      const bottomY = convoStartY + maxVisible * rowH;
      ctx.fillStyle = "#44ccff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("\u25BC more", CANVAS_WIDTH / 2, bottomY - 4);
    }
  }

  // ── Bottom Bar ──
  const barY = CANVAS_HEIGHT - 50;
  ctx.fillStyle = "rgba(0, 0, 10, 0.7)";
  ctx.fillRect(0, barY, CANVAS_WIDTH, 50);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, barY);
  ctx.lineTo(CANVAS_WIDTH, barY);
  ctx.stroke();

  ctx.fillStyle = "#445566";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2190\u2192 CHARACTER   \u2191\u2193 SELECT   ENTER READ   \u2190 BACK", CANVAS_WIDTH / 2, barY + 25);
}

// ─── Crew Dialog Reading View ──────────────────────────────────────

function drawCrewDialog(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData,
  convo: { id: string; title: string; lines: { speaker: string; text: string; color: string }[] }
): void {
  // Dark background
  ctx.fillStyle = "#060610";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Starfield ambient
  for (let i = 0; i < 30; i++) {
    const sx = (i * 137 + 23) % CANVAS_WIDTH;
    const sy = (i * 89 + 11) % CANVAS_HEIGHT;
    const alpha = 0.15 + 0.1 * Math.abs(Math.sin(state.animTimer * 0.01 + i));
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Title bar
  ctx.fillStyle = "rgba(0, 0, 10, 0.8)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, 44);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 44);
  ctx.lineTo(CANVAS_WIDTH, 44);
  ctx.stroke();

  // Back arrow
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2190 BACK", 12, 22);

  // Conversation title
  ctx.fillStyle = "#88aabb";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(convo.title, CANVAS_WIDTH / 2, 22);

  // Line counter
  const viewed = isConversationViewed(convo.id, save);
  ctx.fillStyle = viewed ? "#556677" : "#ff8844";
  ctx.font = "9px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`${state.crewDialogLine + 1}/${convo.lines.length}`, CANVAS_WIDTH - 12, 22);

  // ── Current line ──
  const line = convo.lines[state.crewDialogLine];
  if (!line) return;

  // Find the crew member for the portrait
  const crewMember = CREW.find(c => c.name.includes(line.speaker) || c.id.toUpperCase() === line.speaker);

  // Portrait area
  const portraitSize = 96;
  const portraitX = (CANVAS_WIDTH - portraitSize) / 2;
  const portraitY = 70;

  // Portrait glow
  ctx.shadowBlur = 20;
  ctx.shadowColor = line.color;
  ctx.strokeStyle = line.color + "44";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(portraitX - 2, portraitY - 2, portraitSize + 4, portraitSize + 4, 8);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Portrait image
  if (crewMember) {
    const portraitKey = crewMember.portraitKey as keyof typeof SPRITES;
    const portrait = getSprite(SPRITES[portraitKey]);
    if (portrait) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(portraitX, portraitY, portraitSize, portraitSize, 6);
      ctx.clip();
      ctx.drawImage(portrait, portraitX, portraitY, portraitSize, portraitSize);
      ctx.restore();
    } else {
      drawFallbackPortrait(ctx, line.speaker, line.color, portraitX, portraitY, portraitSize);
    }
  } else {
    drawFallbackPortrait(ctx, line.speaker, line.color, portraitX, portraitY, portraitSize);
  }

  // Speaker name
  ctx.shadowBlur = 6;
  ctx.shadowColor = line.color;
  ctx.fillStyle = line.color;
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(line.speaker, CANVAS_WIDTH / 2, portraitY + portraitSize + 14);
  ctx.shadowBlur = 0;

  // Dialog text (word-wrapped)
  const textY = portraitY + portraitSize + 40;
  const textX = 30;
  const textW = CANVAS_WIDTH - 60;
  const lineHeight = 20;

  // Dialog box
  ctx.fillStyle = "rgba(10, 10, 30, 0.7)";
  ctx.beginPath();
  ctx.roundRect(textX - 10, textY - 10, textW + 20, 140, 8);
  ctx.fill();
  ctx.strokeStyle = line.color + "33";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(textX - 10, textY - 10, textW + 20, 140, 8);
  ctx.stroke();

  // Wrap and draw text
  ctx.fillStyle = "#ddeeff";
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const wrappedLines = wrapText(ctx, `"${line.text}"`, textW);
  for (let i = 0; i < wrappedLines.length; i++) {
    ctx.fillText(wrappedLines[i], textX, textY + i * lineHeight);
  }

  // ── Previous lines (faded, above) ──
  // Show up to 2 previous lines as context
  const prevStartY = textY + 140 + 10;
  for (let p = Math.max(0, state.crewDialogLine - 2); p < state.crewDialogLine; p++) {
    const prevLine = convo.lines[p];
    if (!prevLine) continue;
    const offset = state.crewDialogLine - p;
    const alpha = 0.3 / offset;
    const py = prevStartY + (p - Math.max(0, state.crewDialogLine - 2)) * 36;

    ctx.fillStyle = prevLine.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "left";
    ctx.fillText(prevLine.speaker + ":", textX, py);

    ctx.fillStyle = `rgba(200, 210, 220, ${alpha})`;
    ctx.font = "9px monospace";
    const truncatedPrev = prevLine.text.length > 50 ? prevLine.text.substring(0, 50) + "..." : prevLine.text;
    ctx.fillText(`"${truncatedPrev}"`, textX, py + 14);
  }

  // ── Continue prompt ──
  const promptY = CANVAS_HEIGHT - 80;
  const isLastLine = state.crewDialogLine >= convo.lines.length - 1;
  const pulse = 0.5 + 0.5 * Math.sin(state.animTimer * 0.08);

  ctx.fillStyle = `rgba(68, 204, 255, ${pulse * 0.8})`;
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isLastLine ? "[ENTER] CLOSE" : "[ENTER] CONTINUE \u25B6", CANVAS_WIDTH / 2, promptY);
}

// ─── Text Wrapping Helper ──────────────────────────────────────────

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// ─── Fallback Portrait ─────────────────────────────────────────────

function drawFallbackPortrait(
  ctx: CanvasRenderingContext2D,
  name: string,
  color: string,
  x: number,
  y: number,
  size: number
): void {
  ctx.fillStyle = color + "22";
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 6);
  ctx.fill();
  ctx.strokeStyle = color + "66";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 6);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = "bold 32px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name[0] ?? "?", x + size / 2, y + size / 2);
}

function drawMissionsScreen(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData
): void {
  drawSubScreenFrame(ctx, "MISSION BOARD", SPRITES.MISSIONS_BG);

  // ── Tabs ──
  const tabNames = ["SIDE QUESTS", "SPECIAL OPS", "PLANET MISSIONS"];
  const tabColors = ["#44ccff", "#ffaa44", "#ff8844"];
  const tabY = 52;
  const tabH = 26;
  const tabSpacing = 6;
  const tabW = (CANVAS_WIDTH - 24 - tabSpacing * 2) / 3;

  for (let t = 0; t < 3; t++) {
    const tx = 12 + t * (tabW + tabSpacing);
    const isActive = state.missionTab === t;

    if (isActive) {
      ctx.fillStyle = tabColors[t] + "22";
      ctx.beginPath();
      ctx.roundRect(tx, tabY, tabW, tabH, [4, 4, 0, 0]);
      ctx.fill();
      ctx.fillStyle = tabColors[t];
      ctx.fillRect(tx, tabY + tabH - 2, tabW, 2);
    } else {
      ctx.fillStyle = "rgba(10, 10, 20, 0.4)";
      ctx.beginPath();
      ctx.roundRect(tx, tabY, tabW, tabH, [4, 4, 0, 0]);
      ctx.fill();
    }

    ctx.fillStyle = isActive ? tabColors[t] : "#556677";
    ctx.font = isActive ? "bold 9px monospace" : "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tabNames[t], tx + tabW / 2, tabY + tabH / 2);

    // Planet notification badge
    if (t === 1) {
      const unlocked = getAvailableSpecialMissions(save).length;
      if (unlocked > 0) {
        const bx = tx + tabW - 6;
        const by = tabY + 4;
        ctx.fillStyle = "#ffaa44";
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#101010";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${unlocked}`, bx, by);
      }
    }

    if (t === 2) {
      const unlockedNotDone = PLANET_DEFS.filter(p =>
        isPlanetUnlocked(p, save) && !isPlanetCompleted(p.id, save)
      ).length;
      if (unlockedNotDone > 0) {
        const bx = tx + tabW - 6;
        const by = tabY + 4;
        ctx.fillStyle = "#ff4444";
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${unlockedNotDone}`, bx, by);
      }
    }
  }

  if (state.missionTab === 0) {
    drawMissionsQuestsTab(ctx, state, save, tabY + tabH + 6);
  } else if (state.missionTab === 1) {
    drawMissionsSpecialTab(ctx, state, save, tabY + tabH + 6);
  } else {
    drawMissionsPlanetsTab(ctx, state, save, tabY + tabH + 6);
  }

  // ── Bottom Bar ──
  const barY = CANVAS_HEIGHT - 50;
  ctx.fillStyle = "rgba(0, 0, 10, 0.7)";
  ctx.fillRect(0, barY, CANVAS_WIDTH, 50);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, barY);
  ctx.lineTo(CANVAS_WIDTH, barY);
  ctx.stroke();

  ctx.fillStyle = "#445566";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const hint = state.missionTab === 0
    ? "\u2190\u2192 TAB   \u2191\u2193 SELECT   ENTER ACCEPT   \u2190 BACK"
    : "\u2190\u2192 TAB   \u2191\u2193 SELECT   ENTER LAUNCH   \u2190 BACK";
  ctx.fillText(hint, CANVAS_WIDTH / 2, barY + 25);
}

// ─── Side Quests Tab ────────────────────────────────────────────────

function drawMissionsQuestsTab(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData,
  startY: number
): void {
  const quests = getAvailableQuests(save);
  const activeCount = save.activeQuests.length;

  // Active quests counter
  ctx.fillStyle = "#88aabb";
  ctx.font = "9px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`ACTIVE: ${activeCount}/3`, CANVAS_WIDTH - 16, startY);

  const listY = startY + 14;
  const listX = 12;
  const listW = CANVAS_WIDTH - 24;
  const rowH = 68;
  const maxVisible = Math.floor((CANVAS_HEIGHT - listY - 60) / rowH);

  if (quests.length === 0) {
    ctx.fillStyle = "#556677";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("No quests available.", CANVAS_WIDTH / 2, listY + 30);
    ctx.fillStyle = "#445566";
    ctx.font = "9px monospace";
    ctx.fillText("Complete more missions to unlock quests.", CANVAS_WIDTH / 2, listY + 50);
    return;
  }

  const scrollOffset = Math.max(0, state.missionSelected - maxVisible + 1);

  for (let i = scrollOffset; i < Math.min(quests.length, scrollOffset + maxVisible); i++) {
    const quest = quests[i];
    const isSelected = state.missionSelected === i;
    const active = isQuestActive(quest.id, save);
    const completed = isQuestCompleted(quest.id, save);
    const typeColor = QUEST_TYPE_COLORS[quest.type];
    const y = listY + (i - scrollOffset) * rowH;

    // Row background
    if (isSelected) {
      const pulse = 0.06 + 0.03 * Math.sin(state.animTimer * 0.06);
      ctx.fillStyle = `rgba(68, 204, 255, ${pulse})`;
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 6);
      ctx.fill();
      ctx.strokeStyle = typeColor + "66";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 6);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(10, 10, 20, 0.3)";
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 6);
      ctx.fill();
    }

    // Type icon
    ctx.fillStyle = typeColor;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(QUEST_TYPE_ICONS[quest.type], listX + 22, y + (rowH - 4) / 2 - 6);
    ctx.font = "bold 7px monospace";
    ctx.fillText(QUEST_TYPE_NAMES[quest.type], listX + 22, y + (rowH - 4) / 2 + 12);

    // Quest name
    ctx.fillStyle = isSelected ? "#ffffff" : "#aabbcc";
    ctx.font = isSelected ? "bold 11px monospace" : "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(quest.name, listX + 48, y + 6);

    // Description
    ctx.fillStyle = isSelected ? "#889999" : "#556677";
    ctx.font = "9px monospace";
    ctx.fillText(quest.description, listX + 48, y + 22);

    // Offered by
    ctx.fillStyle = quest.offeredByColor + "88";
    ctx.font = "8px monospace";
    ctx.fillText(`${quest.offeredBy.toUpperCase()} \u2022 Level ${quest.targetLevel}`, listX + 48, y + 38);

    // Reward
    ctx.fillStyle = "#44ff88";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`\u25C6 ${quest.reward}`, listX + listW - 8, y + 6);

    // Status badge
    if (completed) {
      ctx.fillStyle = "#44ff88";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("\u2713 DONE", listX + listW - 8, y + 22);
    } else if (active) {
      ctx.fillStyle = "#ffaa44";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("ACTIVE", listX + listW - 8, y + 22);
    }

    // Action hint
    if (isSelected) {
      ctx.textAlign = "right";
      ctx.font = "8px monospace";
      if (active) {
        ctx.fillStyle = "#ff6666";
        ctx.fillText("[ENTER] ABANDON", listX + listW - 8, y + rowH - 18);
      } else if (!completed && activeCount < 3) {
        ctx.fillStyle = "#44ccff";
        ctx.fillText("[ENTER] ACCEPT", listX + listW - 8, y + rowH - 18);
      } else if (!completed) {
        ctx.fillStyle = "#554444";
        ctx.fillText("MAX 3 ACTIVE", listX + listW - 8, y + rowH - 18);
      }
    }
  }

  // Scroll indicators
  if (scrollOffset > 0) {
    ctx.fillStyle = "#44ccff";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("\u25B2 more", CANVAS_WIDTH / 2, listY - 2);
  }
  if (scrollOffset + maxVisible < quests.length) {
    const bottomY = listY + maxVisible * rowH;
    ctx.fillStyle = "#44ccff";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("\u25BC more", CANVAS_WIDTH / 2, bottomY - 4);
  }
}

// ─── Planet Missions Tab ────────────────────────────────────────────

function drawMissionsSpecialTab(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData,
  startY: number
): void {
  const missions = getAvailableSpecialMissions(save);
  const listY = startY + 4;
  const listX = 12;
  const listW = CANVAS_WIDTH - 24;
  const rowH = 72;
  const maxVisible = Math.floor((CANVAS_HEIGHT - listY - 60) / rowH);

  if (missions.length === 0) {
    ctx.fillStyle = "#556677";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("No special missions unlocked.", CANVAS_WIDTH / 2, listY + 30);
    ctx.fillStyle = "#445566";
    ctx.font = "9px monospace";
    ctx.fillText("Story side missions appear here after key campaign discoveries.", CANVAS_WIDTH / 2, listY + 50);
    return;
  }

  const scrollOffset = Math.max(0, state.missionSelected - maxVisible + 1);

  for (let i = scrollOffset; i < Math.min(missions.length, scrollOffset + maxVisible); i++) {
    const mission = missions[i];
    const isSelected = state.missionSelected === i;
    const completed = isSpecialMissionCompleted(mission.id, save);
    const y = listY + (i - scrollOffset) * rowH;

    if (isSelected) {
      const pulse = 0.06 + 0.03 * Math.sin(state.animTimer * 0.06);
      ctx.fillStyle = `rgba(255, 170, 68, ${pulse})`;
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 6);
      ctx.fill();
      ctx.strokeStyle = "#ffaa44aa";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 6);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(10, 10, 20, 0.3)";
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 6);
      ctx.fill();
    }

    ctx.fillStyle = "#ffaa44";
    ctx.font = "bold 17px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("\u25A3", listX + 22, y + (rowH - 4) / 2 - 4);
    ctx.font = "bold 7px monospace";
    ctx.fillText("OPS", listX + 22, y + (rowH - 4) / 2 + 14);

    ctx.fillStyle = isSelected ? "#ffffff" : "#aabbcc";
    ctx.font = isSelected ? "bold 11px monospace" : "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(mission.name, listX + 48, y + 6);

    ctx.fillStyle = "#ffcc88";
    ctx.font = "8px monospace";
    ctx.fillText(`${WORLD_NAMES[mission.world - 1]} • ${mission.subtitle}`, listX + 48, y + 20);

    ctx.fillStyle = isSelected ? "#889999" : "#556677";
    ctx.font = "9px monospace";
    ctx.fillText(mission.description, listX + 48, y + 34);

    if (completed) {
      ctx.fillStyle = "#44ff88";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "right";
      ctx.fillText("\u2713 CLEARED", listX + listW - 8, y + 8);
    }

    if (isSelected) {
      ctx.fillStyle = "#ffaa44";
      ctx.font = "8px monospace";
      ctx.textAlign = "right";
      ctx.fillText("[ENTER] LAUNCH", listX + listW - 8, y + rowH - 18);
    }
  }
}

// ─── Planet Missions Tab ────────────────────────────────────────────

const OBJECTIVE_ICONS: Record<string, string> = {
  collect: "\u2B22",  // hexagon
  survive: "\u23F1",  // stopwatch
  escort: "\u2708",   // airplane
  defend: "\u2694",   // crossed swords
};

const OBJECTIVE_LABELS: Record<string, string> = {
  collect: "COLLECT",
  survive: "SURVIVE",
  escort: "ESCORT",
  defend: "DEFEND",
};

function drawMissionsPlanetsTab(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData,
  startY: number
): void {
  const planets = PLANET_DEFS;
  const listY = startY;
  const listX = 12;
  const listW = CANVAS_WIDTH - 24;
  const rowH = 62;
  const maxVisible = Math.floor((CANVAS_HEIGHT - listY - 60) / rowH);
  const scrollOffset = Math.max(0, state.missionSelected - maxVisible + 1);

  for (let i = scrollOffset; i < Math.min(planets.length, scrollOffset + maxVisible); i++) {
    const planet = planets[i];
    const isSelected = state.missionSelected === i;
    const unlocked = isPlanetUnlocked(planet, save);
    const completed = isPlanetCompleted(planet.id, save);
    const y = listY + (i - scrollOffset) * rowH;

    // Row background
    if (isSelected) {
      const pulse = 0.06 + 0.03 * Math.sin(state.animTimer * 0.06);
      ctx.fillStyle = `rgba(${unlocked ? "255, 136, 68" : "50, 50, 70"}, ${pulse})`;
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 6);
      ctx.fill();
      ctx.strokeStyle = (unlocked ? planet.color : "#333344") + "66";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 6);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(10, 10, 20, 0.3)";
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 6);
      ctx.fill();
    }

    // Planet icon (sprite or fallback dot)
    const iconKey = planet.mapIcon as keyof typeof SPRITES;
    const iconSprite = getSprite(SPRITES[iconKey]);
    const iconCx = listX + 22;
    const iconCy = y + (rowH - 4) / 2 - 2;
    const iconR = 14;

    if (iconSprite && unlocked) {
      // Draw planet sprite clipped to a circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(iconSprite, iconCx - iconR, iconCy - iconR, iconR * 2, iconR * 2);
      ctx.restore();
      // Border ring
      ctx.strokeStyle = planet.color + "88";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Locked or no sprite — dark circle with lock
      ctx.fillStyle = "#1a1a2a";
      ctx.beginPath();
      ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#333344";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#444455";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", iconCx, iconCy);
    }

    // Objective type below icon
    ctx.fillStyle = unlocked ? planet.color : "#444455";
    ctx.font = "bold 6px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(OBJECTIVE_LABELS[planet.objective] ?? "?", iconCx, iconCy + iconR + 7);

    const textX = listX + 46;

    if (!unlocked) {
      // Locked planet
      ctx.fillStyle = "#556666";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(planet.name, textX, y + 6);

      ctx.fillStyle = "#443333";
      ctx.font = "9px monospace";
      const reqLevel = planet.unlockAfterLevel;
      ctx.fillText(`\u{1F512} Requires: Level ${reqLevel} + ${planet.unlockStars}\u2605`, textX, y + 22);

      // World pairing
      ctx.fillStyle = "#334455";
      ctx.font = "8px monospace";
      ctx.fillText(`${WORLD_NAMES[planet.pairedWorld - 1] ?? "???"} sector`, textX, y + 38);
    } else {
      // Unlocked planet
      ctx.fillStyle = isSelected ? "#ffffff" : "#ccddee";
      ctx.font = isSelected ? "bold 11px monospace" : "11px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(planet.name, textX, y + 4);

      // Subtitle
      ctx.fillStyle = isSelected ? planet.color : "#778899";
      ctx.font = "9px monospace";
      ctx.fillText(planet.subtitle, textX, y + 18);

      // Description
      ctx.fillStyle = isSelected ? "#889999" : "#556677";
      ctx.font = "8px monospace";
      const desc = planet.description.length > 44
        ? planet.description.substring(0, 44) + "..."
        : planet.description;
      ctx.fillText(desc, textX, y + 32);

      // World pairing
      ctx.fillStyle = "#445566";
      ctx.font = "8px monospace";
      ctx.fillText(`${WORLD_NAMES[planet.pairedWorld - 1] ?? "???"} sector`, textX, y + 44);

      // Status badge (right side)
      if (completed) {
        ctx.fillStyle = "#44ff88";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText("\u2713 DONE", listX + listW - 8, y + 6);
      } else if (isSelected) {
        const launchPulse = 0.5 + 0.5 * Math.sin(state.animTimer * 0.08);
        ctx.fillStyle = `rgba(255, 136, 68, ${launchPulse})`;
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.fillText("[ENTER] LAUNCH", listX + listW - 8, y + 6);
      }

      // Reward preview (right side, below status)
      ctx.fillStyle = "#667788";
      ctx.font = "8px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      if (!completed) {
        ctx.fillText(`\u25C8 ${planet.material.replace(/-/g, " ")}`, listX + listW - 8, y + 22);
        if (planet.enhancementUnlock) {
          ctx.fillStyle = "#aa44ff88";
          ctx.fillText(`+ ${planet.enhancementUnlock.replace(/-/g, " ")}`, listX + listW - 8, y + 34);
        }
      }
    }
  }

  // Scroll indicators
  if (scrollOffset > 0) {
    ctx.fillStyle = "#ff8844";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("\u25B2 more", CANVAS_WIDTH / 2, listY - 2);
  }
  if (scrollOffset + maxVisible < planets.length) {
    const bottomY = listY + maxVisible * rowH;
    ctx.fillStyle = "#ff8844";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("\u25BC more", CANVAS_WIDTH / 2, bottomY - 4);
  }
}

function drawCodexScreen(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData
): void {
  const cat = CODEX_CATEGORIES[state.codexCategory];
  const entries = cat ? getEntriesForCategory(cat.id, save) : [];

  // ── Reading view ──
  if (state.codexReading && entries[state.codexSelected]) {
    drawCodexReading(ctx, state, save, entries[state.codexSelected]);
    return;
  }

  // ── Main codex screen ──
  drawSubScreenFrame(ctx, "SHIP'S LOG", SPRITES.CODEX_BG);

  // ── Category Tabs ──
  const tabY = 56;
  const tabH = 28;
  const tabSpacing = 4;
  const totalTabW = CANVAS_WIDTH - 20;
  const tabW = (totalTabW - (CODEX_CATEGORIES.length - 1) * tabSpacing) / CODEX_CATEGORIES.length;

  for (let i = 0; i < CODEX_CATEGORIES.length; i++) {
    const c = CODEX_CATEGORIES[i];
    const tx = 10 + i * (tabW + tabSpacing);
    const isActive = state.codexCategory === i;
    const newCount = countNewInCategory(c.id, save);

    // Tab background
    if (isActive) {
      ctx.fillStyle = c.color + "22";
      ctx.beginPath();
      ctx.roundRect(tx, tabY, tabW, tabH, [4, 4, 0, 0]);
      ctx.fill();

      ctx.strokeStyle = c.color + "88";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(tx, tabY, tabW, tabH, [4, 4, 0, 0]);
      ctx.stroke();

      // Active indicator line
      ctx.fillStyle = c.color;
      ctx.fillRect(tx, tabY + tabH - 2, tabW, 2);
    } else {
      ctx.fillStyle = "rgba(10, 10, 20, 0.4)";
      ctx.beginPath();
      ctx.roundRect(tx, tabY, tabW, tabH, [4, 4, 0, 0]);
      ctx.fill();
    }

    // Tab label
    ctx.fillStyle = isActive ? c.color : "#556677";
    ctx.font = isActive ? "bold 8px monospace" : "8px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.name, tx + tabW / 2, tabY + tabH / 2);

    // New badge
    if (newCount > 0) {
      const bx = tx + tabW - 6;
      const by = tabY + 4;
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${newCount}`, bx, by);
    }
  }

  // ── Entry List ──
  const listY = tabY + tabH + 8;
  const listX = 12;
  const listW = CANVAS_WIDTH - 24;
  const rowH = 44;
  const maxVisible = Math.floor((CANVAS_HEIGHT - listY - 60) / rowH);

  if (entries.length === 0) {
    ctx.fillStyle = "#556677";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("No entries unlocked yet.", CANVAS_WIDTH / 2, listY + 30);
    ctx.fillStyle = "#445566";
    ctx.font = "9px monospace";
    ctx.fillText("Complete missions to discover intel.", CANVAS_WIDTH / 2, listY + 50);
  } else {
    const scrollOffset = Math.max(0, state.codexSelected - maxVisible + 1);

    for (let i = scrollOffset; i < Math.min(entries.length, scrollOffset + maxVisible); i++) {
      const entry = entries[i];
      const isSelected = state.codexSelected === i;
      const isNew = isCodexEntryNew(entry.id, save);
      const y = listY + (i - scrollOffset) * rowH;

      // Row background
      if (isSelected) {
        const pulse = 0.06 + 0.03 * Math.sin(state.animTimer * 0.06);
        ctx.fillStyle = `rgba(68, 204, 255, ${pulse})`;
        ctx.beginPath();
        ctx.roundRect(listX, y, listW, rowH - 4, 4);
        ctx.fill();

        ctx.strokeStyle = (cat?.color ?? "#44ccff") + "66";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(listX, y, listW, rowH - 4, 4);
        ctx.stroke();
      }

      // New indicator
      if (isNew) {
        ctx.fillStyle = "#ffaa44";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("NEW", listX + 6, y + (rowH - 4) / 2 - 6);
      }

      // Title
      const titleX = isNew ? listX + 34 : listX + 10;
      ctx.fillStyle = isSelected ? "#ffffff" : (isNew ? "#ccddee" : "#778899");
      ctx.font = isSelected ? "bold 11px monospace" : "11px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(entry.title, titleX, y + 6);

      // Speaker tag (if present)
      if (entry.speaker) {
        ctx.fillStyle = entry.speakerColor ?? "#667788";
        ctx.font = "8px monospace";
        ctx.fillText(entry.speaker, titleX, y + 22);
      } else {
        // Category label as fallback
        ctx.fillStyle = (cat?.color ?? "#667788") + "88";
        ctx.font = "8px monospace";
        ctx.fillText(cat?.name ?? "", titleX, y + 22);
      }

      // Read indicator (right side)
      if (!isNew) {
        ctx.fillStyle = "#334455";
        ctx.font = "8px monospace";
        ctx.textAlign = "right";
        ctx.fillText("\u2713 READ", listX + listW - 8, y + 14);
      }
    }

    // Scroll indicators
    if (scrollOffset > 0) {
      ctx.fillStyle = "#44ccff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("\u25B2 more", CANVAS_WIDTH / 2, listY - 2);
    }
    if (scrollOffset + maxVisible < entries.length) {
      const bottomY = listY + maxVisible * rowH;
      ctx.fillStyle = "#44ccff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("\u25BC more", CANVAS_WIDTH / 2, bottomY - 4);
    }
  }

  // ── Bottom Bar ──
  const barY = CANVAS_HEIGHT - 50;
  ctx.fillStyle = "rgba(0, 0, 10, 0.7)";
  ctx.fillRect(0, barY, CANVAS_WIDTH, 50);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, barY);
  ctx.lineTo(CANVAS_WIDTH, barY);
  ctx.stroke();

  ctx.fillStyle = "#445566";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2190\u2192 CATEGORY   \u2191\u2193 SELECT   ENTER READ   \u2190 BACK", CANVAS_WIDTH / 2, barY + 25);
}

// ─── Bestiary Screen ────────────────────────────────────────────────

function drawBestiaryScreen(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData
): void {
  const entries = getBestiaryList(save.bestiary);

  // ── Detail / Reading view ──
  if (state.bestiaryReading && entries.length > 0) {
    drawBestiaryDetail(ctx, state, entries);
    return;
  }

  // ── List view ──
  drawSubScreenFrame(ctx, "BESTIARY", SPRITES.CODEX_BG);

  const total = getTotalEnemyCount();
  const discovered = getDiscoveredCount(save.bestiary);

  ctx.fillStyle = "#667788";
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`DISCOVERED ${discovered} / ${total}`, 20, 52);

  if (entries.length === 0) {
    ctx.fillStyle = "#556666";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No enemies discovered yet.", CANVAS_WIDTH / 2, 200);
    ctx.fillText("Engage hostiles to populate bestiary.", CANVAS_WIDTH / 2, 220);
    return;
  }

  const listX = 16;
  const listW = CANVAS_WIDTH - 32;
  const startY = 70;
  const rowH = 42;
  const maxVisible = Math.floor((CANVAS_HEIGHT - 140 - startY) / rowH);
  const scrollOffset = Math.max(0, state.bestiarySelected - maxVisible + 1);
  const selected = Math.min(state.bestiarySelected, entries.length - 1);

  for (let i = scrollOffset; i < Math.min(entries.length, scrollOffset + maxVisible); i++) {
    const entry = entries[i];
    const y = startY + (i - scrollOffset) * rowH;
    const isSelected = i === selected;

    if (isSelected) {
      ctx.fillStyle = "rgba(68, 204, 255, 0.1)";
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 4);
      ctx.fill();
      ctx.strokeStyle = "#44ccff44";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(listX, y, listW, rowH - 4, 4);
      ctx.stroke();
    }

    const profile = ENEMY_CLASS_PROFILES[entry.classId];

    // Class tint swatch
    ctx.fillStyle = profile.tint;
    ctx.fillRect(listX + 8, y + 10, 10, 18);

    // Enemy name
    ctx.fillStyle = isSelected ? "#ffffff" : "#889999";
    ctx.font = isSelected ? "bold 12px monospace" : "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(entry.enemyType, listX + 28, y + 8);

    // Class + kill count
    ctx.fillStyle = "#667788";
    ctx.font = "9px monospace";
    ctx.fillText(`${profile.name}  \u00B7  ${entry.killCount} kills`, listX + 28, y + 24);

    // Affinity icons on right
    const rightX = listX + listW - 8;
    ctx.textAlign = "right";
    ctx.font = "8px monospace";
    if (profile.effectiveVs.length > 0) {
      ctx.fillStyle = "#ffdd44";
      ctx.fillText(`\u2B06 ${profile.effectiveVs.map(w => WEAPON_TYPE_META[w].icon).join("")}`, rightX, y + 10);
    }
    if (profile.resistedVs.length > 0) {
      ctx.fillStyle = "#888899";
      ctx.fillText(`\u2B07 ${profile.resistedVs.map(w => WEAPON_TYPE_META[w].icon).join("")}`, rightX, y + 22);
    }
  }

  // Bottom bar
  const barY = CANVAS_HEIGHT - 50;
  ctx.fillStyle = "rgba(0, 0, 10, 0.7)";
  ctx.fillRect(0, barY, CANVAS_WIDTH, 50);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, barY);
  ctx.lineTo(CANVAS_WIDTH, barY);
  ctx.stroke();
  ctx.fillStyle = "#445566";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2191\u2193 SELECT   ENTER VIEW   \u2190 BACK", CANVAS_WIDTH / 2, barY + 25);
}

// ─── Bestiary Detail View ──────────────────────────────────────────
function drawBestiaryDetail(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  entries: BestiaryEntry[]
): void {
  const selected = Math.min(state.bestiarySelected, entries.length - 1);
  const entry = entries[selected];
  const profile = ENEMY_CLASS_PROFILES[entry.classId];

  // Dark background
  ctx.fillStyle = "#060610";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle grid pattern
  ctx.strokeStyle = "#111122";
  ctx.lineWidth = 0.5;
  for (let gx = 0; gx < CANVAS_WIDTH; gx += 20) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let gy = 0; gy < CANVAS_HEIGHT; gy += 20) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(CANVAS_WIDTH, gy);
    ctx.stroke();
  }

  // ── Enemy Sprite (centered, animated bob + slow rotation glow) ──
  const spritePath = ENEMY_SPRITE_MAP[entry.enemyType];
  const sprite = spritePath ? getSprite(spritePath) : null;

  const spriteCx = CANVAS_WIDTH / 2;
  const spriteCy = 140;
  const spriteSize = 96;
  const bob = Math.sin(state.animTimer * 0.04) * 4;

  if (sprite) {
    ctx.save();
    // Glow ring behind sprite (rotating)
    const glowAngle = state.animTimer * 0.02;
    ctx.strokeStyle = profile.tint + "44";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(spriteCx, spriteCy + bob, spriteSize * 0.6, glowAngle, glowAngle + Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = profile.tint + "22";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(spriteCx, spriteCy + bob, spriteSize * 0.7, -glowAngle, -glowAngle + Math.PI);
    ctx.stroke();

    // Enemy sprite with turntable rotation
    const rotAngle = state.animTimer * 0.015;
    const scaleX = Math.cos(rotAngle);
    const absScale = Math.abs(scaleX);
    ctx.save();
    ctx.translate(spriteCx, spriteCy + bob);
    ctx.scale(scaleX, 1);

    // Sprite
    ctx.drawImage(
      sprite,
      -spriteSize / 2,
      -spriteSize / 2,
      spriteSize,
      spriteSize
    );

    // Class tint overlay on the sprite
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.25 * absScale;
    ctx.fillStyle = profile.tint;
    ctx.fillRect(
      -spriteSize / 2,
      -spriteSize / 2,
      spriteSize,
      spriteSize
    );
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.restore();
  } else {
    // Fallback colored circle
    ctx.fillStyle = profile.tint;
    ctx.beginPath();
    ctx.arc(spriteCx, spriteCy + bob, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Title bar ──
  const titleY = spriteCy + spriteSize / 2 + 20;
  ctx.shadowBlur = 8;
  ctx.shadowColor = profile.tint;
  ctx.fillStyle = profile.tint;
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(entry.enemyType, spriteCx, titleY);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#667788";
  ctx.font = "10px monospace";
  ctx.fillText(`CLASS: ${profile.name.toUpperCase()}  \u00B7  ${entry.killCount} KILLS`, spriteCx, titleY + 22);

  // ── Stats row ──
  const statsY = titleY + 46;
  const statsW = CANVAS_WIDTH - 60;
  const statsX = 30;

  ctx.fillStyle = "rgba(0, 0, 10, 0.5)";
  ctx.beginPath();
  ctx.roundRect(statsX, statsY, statsW, 60, 6);
  ctx.fill();
  ctx.strokeStyle = profile.tint + "33";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(statsX, statsY, statsW, 60, 6);
  ctx.stroke();

  // Stat labels + values (2 rows of 2)
  ctx.font = "9px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const col1 = statsX + 12;
  const col2 = statsX + statsW / 2 + 12;
  const row1 = statsY + 10;
  const row2 = statsY + 32;

  ctx.fillStyle = "#667788";
  ctx.fillText("HP", col1, row1);
  ctx.fillText("SPEED", col2, row1);
  ctx.fillText("DAMAGE", col1, row2);
  ctx.fillText("FIRE RATE", col2, row2);

  ctx.fillStyle = "#cccccc";
  ctx.fillText(`${profile.hpMult.toFixed(1)}x`, col1 + 60, row1);
  ctx.fillText(`${profile.speedMult.toFixed(1)}x`, col2 + 80, row1);
  ctx.fillText(`${profile.damageMult.toFixed(1)}x`, col1 + 60, row2);
  ctx.fillText(`${profile.fireRateMult.toFixed(1)}x`, col2 + 80, row2);

  // ── Affinity row ──
  const affY = statsY + 72;
  ctx.textAlign = "center";
  const halfW = CANVAS_WIDTH / 2;

  ctx.fillStyle = "#ffdd44";
  ctx.font = "bold 9px monospace";
  ctx.fillText("EFFECTIVE VS", halfW - halfW / 2, affY);
  ctx.font = "10px monospace";
  ctx.fillStyle = "#ddddaa";
  const effNames = profile.effectiveVs.map((w) => WEAPON_TYPE_META[w].name).join(", ") || "\u2014";
  ctx.fillText(effNames, halfW - halfW / 2, affY + 14);

  ctx.fillStyle = "#888899";
  ctx.font = "bold 9px monospace";
  ctx.fillText("RESISTS", halfW + halfW / 2, affY);
  ctx.font = "10px monospace";
  ctx.fillStyle = "#999999";
  const resNames = profile.resistedVs.map((w) => WEAPON_TYPE_META[w].name).join(", ") || "\u2014";
  ctx.fillText(resNames, halfW + halfW / 2, affY + 14);

  // ── Lore / Intel section ──
  const loreY = affY + 40;
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "left";
  ctx.fillText("ANALYSIS", 24, loreY);

  ctx.fillStyle = "#999999";
  ctx.font = "10px monospace";
  const loreText = ENEMY_LORE[entry.enemyType];
  // Handle explicit newlines in lore text
  const paragraphs = loreText.split("\n");
  let ly = loreY + 16;
  const maxLoreW = CANVAS_WIDTH - 48;
  for (const para of paragraphs) {
    if (para.trim() === "") {
      ly += 8;
      continue;
    }
    const lines = wrapText(ctx, para, maxLoreW);
    for (const line of lines) {
      ctx.fillText(line, 24, ly);
      ly += 14;
    }
  }

  // ── Bottom bar ──
  const barY = CANVAS_HEIGHT - 50;
  ctx.fillStyle = "rgba(0, 0, 10, 0.7)";
  ctx.fillRect(0, barY, CANVAS_WIDTH, 50);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, barY);
  ctx.lineTo(CANVAS_WIDTH, barY);
  ctx.stroke();

  const pulseAlpha = 0.4 + 0.2 * Math.sin(state.animTimer * 0.06);
  ctx.globalAlpha = pulseAlpha;
  ctx.fillStyle = "#445566";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("[ENTER] or [\u2190] CLOSE", CANVAS_WIDTH / 2, barY + 25);
  ctx.globalAlpha = 1;
}

// ─── Codex Reading View ─────────────────────────────────────────────

function drawCodexReading(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  _save: SaveData,
  entry: { title: string; speaker?: string; speakerColor?: string; text: string }
): void {
  // Dark background
  ctx.fillStyle = "#060610";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle grid pattern
  ctx.strokeStyle = "#0a0a1a";
  ctx.lineWidth = 0.5;
  for (let y = 0; y < CANVAS_HEIGHT; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  // Title bar
  ctx.fillStyle = "rgba(0, 0, 10, 0.8)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, 44);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 44);
  ctx.lineTo(CANVAS_WIDTH, 44);
  ctx.stroke();

  // Back arrow
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2190 BACK", 12, 22);

  // Entry title
  const cat = CODEX_CATEGORIES[state.codexCategory];
  ctx.shadowBlur = 6;
  ctx.shadowColor = cat?.color ?? "#44ccff";
  ctx.fillStyle = cat?.color ?? "#44ccff";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  ctx.fillText(entry.title, CANVAS_WIDTH / 2, 22);
  ctx.shadowBlur = 0;

  // Speaker attribution (if present)
  let contentY = 60;
  if (entry.speaker) {
    ctx.fillStyle = entry.speakerColor ?? "#667788";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(entry.speaker, 24, contentY);
    contentY += 20;
  }

  // Content area background
  const contentX = 16;
  const contentW = CANVAS_WIDTH - 32;
  const contentH = CANVAS_HEIGHT - contentY - 60;

  ctx.fillStyle = "rgba(10, 10, 30, 0.5)";
  ctx.beginPath();
  ctx.roundRect(contentX, contentY, contentW, contentH, 6);
  ctx.fill();
  ctx.strokeStyle = (cat?.color ?? "#44ccff") + "22";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(contentX, contentY, contentW, contentH, 6);
  ctx.stroke();

  // Text content (word-wrapped with newline support)
  ctx.fillStyle = "#bbccdd";
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const textX = contentX + 12;
  const textW = contentW - 24;
  const lineHeight = 16;
  let drawY = contentY + 12;

  // Split by explicit newlines first, then word-wrap each paragraph
  const paragraphs = entry.text.split("\n");
  for (const para of paragraphs) {
    if (para.trim() === "") {
      drawY += lineHeight * 0.6;
      continue;
    }
    const wrapped = wrapText(ctx, para, textW);
    for (const wline of wrapped) {
      if (drawY > contentY + contentH - 20) break;
      ctx.fillText(wline, textX, drawY);
      drawY += lineHeight;
    }
  }

  // Close prompt
  const promptY = CANVAS_HEIGHT - 40;
  const pulse = 0.5 + 0.5 * Math.sin(state.animTimer * 0.08);
  ctx.fillStyle = `rgba(68, 204, 255, ${pulse * 0.8})`;
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("[ENTER] or [\u2190] CLOSE", CANVAS_WIDTH / 2, promptY);
}

// ─── Pilot Screen ───────────────────────────────────────────────────

function drawPilotScreen(
  ctx: CanvasRenderingContext2D,
  state: CockpitHubState,
  save: SaveData
): void {
  drawSubScreenFrame(ctx, "PILOT", SPRITES.ARMORY_BG);

  const level = save.pilotLevel;
  const progress = xpProgress(save.xp, level);
  const nextLevelXp = xpForLevel(level + 1);

  // ── Level display ──
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#44ccff";
  ctx.fillStyle = "#44ccff";
  ctx.font = "bold 36px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${level}`, CANVAS_WIDTH / 2, 48);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#667788";
  ctx.font = "10px monospace";
  ctx.fillText("PILOT LEVEL", CANVAS_WIDTH / 2, 42);

  // XP progress bar
  const barX = 40;
  const barY = 92;
  const barW = CANVAS_WIDTH - 80;
  const barH = 10;

  ctx.fillStyle = "#1a1a2a";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 3);
  ctx.fill();

  if (level < MAX_PILOT_LEVEL) {
    ctx.fillStyle = "#44ccff";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, 3);
    ctx.fill();

    ctx.fillStyle = "#667788";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      `${save.xp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP`,
      CANVAS_WIDTH / 2, barY + barH + 6
    );
  } else {
    ctx.fillStyle = "#44ff88";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();

    ctx.fillStyle = "#44ff88";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("MAX LEVEL", CANVAS_WIDTH / 2, barY + barH + 6);
  }

  // ── Passive bonuses ──
  const bonusY = barY + barH + 22;
  ctx.fillStyle = "#445566";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "left";
  ctx.fillText("PASSIVE BONUSES", 20, bonusY);

  ctx.font = "9px monospace";
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText(`+${bonusHp(level)} Max HP`, 20, bonusY + 14);
  ctx.fillText(`+${(creditBonus(level) * 100).toFixed(1)}% Credits`, 160, bonusY + 14);
  ctx.fillText(`+${(materialDropBonus(level) * 100).toFixed(0)}% Drops`, 310, bonusY + 14);

  // ── Skill points ──
  const spY = bonusY + 34;
  ctx.fillStyle = "#ffdd44";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`SKILL POINTS: ${save.skillPoints}`, 20, spY);
  ctx.fillStyle = "#667788";
  ctx.font = "9px monospace";
  ctx.fillText(`(${skillPointsAtLevel(level)} total earned)`, 200, spY);

  // ── Combat Skill Tree ──
  const treeY = spY + 24;
  ctx.fillStyle = "#ff4444";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillText("COMBAT", 20, treeY);

  const nodes = getTreeNodes("combat");
  const nodeStartY = treeY + 18;
  const nodeH = 52;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const y = nodeStartY + i * nodeH;
    const isSelected = state.pilotTreeSelected === i;
    const isAllocated = save.allocatedSkills.includes(node.id);
    const canAlloc = canAllocate(node.id, save.allocatedSkills, save.skillPoints);

    if (isSelected) {
      const pulse = 0.06 + 0.03 * Math.sin(state.animTimer * 0.06);
      ctx.fillStyle = `rgba(68, 204, 255, ${pulse})`;
      ctx.beginPath();
      ctx.roundRect(16, y, CANVAS_WIDTH - 32, nodeH - 4, 4);
      ctx.fill();
      ctx.strokeStyle = "#44ccff44";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(16, y, CANVAS_WIDTH - 32, nodeH - 4, 4);
      ctx.stroke();
    }

    // Connection line
    if (i > 0) {
      ctx.strokeStyle = isAllocated ? node.color + "88" : "#222233";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(36, y - 4);
      ctx.lineTo(36, y + 4);
      ctx.stroke();
    }

    // Icon
    ctx.fillStyle = isAllocated ? node.color : (canAlloc ? "#667788" : "#333344");
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.icon, 36, y + nodeH / 2 - 2);

    // Name
    ctx.fillStyle = isAllocated ? "#ffffff" : (isSelected ? "#cccccc" : "#889999");
    ctx.font = isAllocated ? "bold 11px monospace" : "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(node.name, 56, y + 6);

    // Description
    ctx.fillStyle = "#667788";
    ctx.font = "9px monospace";
    ctx.fillText(node.description, 56, y + 22);

    // Status badge
    ctx.textAlign = "right";
    ctx.font = "bold 9px monospace";
    if (isAllocated) {
      ctx.fillStyle = "#44ff88";
      ctx.fillText("ACTIVE", CANVAS_WIDTH - 24, y + 10);
    } else if (node.isCapstone) {
      ctx.fillStyle = "#ffdd44";
      ctx.fillText(`${node.cost} PTS`, CANVAS_WIDTH - 24, y + 10);
      if (!canAlloc && save.skillPoints >= node.cost) {
        ctx.fillStyle = "#554422";
        ctx.font = "8px monospace";
        ctx.fillText("REQUIRES ALL NODES", CANVAS_WIDTH - 24, y + 24);
      }
    } else if (canAlloc) {
      ctx.fillStyle = "#44ccff";
      ctx.fillText(`${node.cost} PT`, CANVAS_WIDTH - 24, y + 10);
    } else {
      ctx.fillStyle = "#333344";
      ctx.fillText("LOCKED", CANVAS_WIDTH - 24, y + 10);
    }
  }

  // ── Milestones ──
  const milestonesY = nodeStartY + nodes.length * nodeH + 10;
  ctx.fillStyle = "#445566";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "left";
  ctx.fillText("MILESTONES", 20, milestonesY);

  const milestones = getMilestones(level);
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    const my = milestonesY + 14 + i * 14;
    ctx.fillStyle = m.unlocked ? "#44ff88" : "#334455";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${m.unlocked ? "\u2713" : "\u2022"} Lv ${m.level}: ${m.label}`, 28, my);
  }

  // ── Bottom bar ──
  const bottomBarY = CANVAS_HEIGHT - 50;
  ctx.fillStyle = "rgba(0, 0, 10, 0.7)";
  ctx.fillRect(0, bottomBarY, CANVAS_WIDTH, 50);
  ctx.strokeStyle = "#22334488";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, bottomBarY);
  ctx.lineTo(CANVAS_WIDTH, bottomBarY);
  ctx.stroke();
  ctx.fillStyle = "#445566";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u2191\u2193 SELECT   ENTER ALLOCATE   \u2190 BACK", CANVAS_WIDTH / 2, bottomBarY + 25);
}
