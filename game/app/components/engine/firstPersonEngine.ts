import type { GameState, Keys, FirstPersonState, BoardingMap, FPEnemy, ConsumableId } from "./types";
import { GameScreen, AudioEvent, CANVAS_WIDTH, GAME_AREA_HEIGHT } from "./types";
import { resolveAffinity } from "./enemyClasses";
import { AFFINITY_MULTIPLIER } from "./weaponTypes";
import { createAffinityLabel } from "./floatingLabels";
import { hasSkill, getSkillEffect } from "./skillTree";

// ─── Constants ──────────────────────────────────────────────────────

const MOVE_SPEED = 0.06;
const ROT_SPEED = 0.04;
const COLLISION_RADIUS = 0.25;
const GUN_FIRE_RATE = 15;     // frames between shots
const GUN_FLASH_DURATION = 6; // frames of muzzle flash
const BULLET_RANGE = 12;      // max hit distance in tiles
const BULLET_DAMAGE = 1;
const ENEMY_AGGRO_RANGE = 6;  // tiles
const ENEMY_CONTACT_RANGE = 0.5; // tiles — melee damage
const ENEMY_CONTACT_DAMAGE = 1;
const SENTRY_FIRE_RANGE = 8;
const SENTRY_FIRE_RATE = 120;
const OBJECTIVE_PICKUP_RANGE = 0.55;

type FacingVector = Pick<FirstPersonState, "dirX" | "dirY" | "planeX" | "planeY">;

// ─── Wall collision ─────────────────────────────────────────────────

function isWalkable(map: BoardingMap, x: number, y: number): boolean {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (col < 0 || col >= map.width || row < 0 || row >= map.height) return false;
  const tile = map.tiles[row][col];
  return tile !== "wall" && tile !== "empty";
}

// ─── Line of sight (simplified) ─────────────────────────────────────

function hasLOS(map: BoardingMap, x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist * 3);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const col = Math.floor(px);
    const row = Math.floor(py);
    if (col < 0 || col >= map.width || row < 0 || row >= map.height) return false;
    const tile = map.tiles[row][col];
    if (tile === "wall" || tile === "empty") return false;
  }
  return true;
}

function rotateView(view: FacingVector, angle: number): FacingVector {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    dirX: view.dirX * cos - view.dirY * sin,
    dirY: view.dirX * sin + view.dirY * cos,
    planeX: view.planeX * cos - view.planeY * sin,
    planeY: view.planeX * sin + view.planeY * cos,
  };
}

function moveWithCollision(
  map: BoardingMap,
  posX: number,
  posY: number,
  deltaX: number,
  deltaY: number
): { posX: number; posY: number } {
  let nextX = posX;
  let nextY = posY;

  const candidateX = posX + deltaX;
  const candidateY = posY + deltaY;

  if (isWalkable(map, candidateX + COLLISION_RADIUS * Math.sign(deltaX), posY)) nextX = candidateX;
  if (isWalkable(map, nextX, candidateY + COLLISION_RADIUS * Math.sign(deltaY))) nextY = candidateY;

  return { posX: nextX, posY: nextY };
}

// ─── NPC dialog open (shared: non-colony site + colony hook) ───
// Extracted from the non-colony NPC-interaction block so the colony hook can
// reuse the engine's own dialog-open logic (Phase 5a §H1). Finds an NPC within
// 2.0 tiles that the player faces (dot > 0) and opens its dialog; returns true
// iff a dialog opened. Reads position/facing straight off `fp` — both call
// sites run after fp.posX/posY/dirX/dirY are synced from the frame's locals, so
// a dialog can never open from coords that disagree with fp. The CALLER owns the
// shoot / gunCooldown / canFire gating; this helper does only proximity + facing
// + open plus the audio and bankDir side-effects.
function tryOpenNpcDialog(gs: GameState, fp: FirstPersonState): boolean {
  if (!fp.npcs) return false;
  const { posX, posY, dirX, dirY } = fp;
  const NPC_INTERACT_RANGE = 2.0;
  for (const npc of fp.npcs) {
    const dx = npc.x - posX;
    const dy = npc.y - posY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < NPC_INTERACT_RANGE) {
      // Check if roughly facing the NPC
      const dot = dx * dirX + dy * dirY;
      if (dot > 0) { // NPC is in front of us
        fp.dialogState = {
          active: true,
          npcId: npc.id,
          lines: npc.dialog,
          currentLine: 0,
          shopOpen: false,
          shopItems: npc.shopItems,
        };
        fp.gunCooldown = 15;
        gs.audioEvents.push(AudioEvent.DIALOG_ADVANCE);
        gs.player.bankDir = 0;
        return true; // Dialog opened
      }
    }
  }
  return false;
}

// ─── Main Update ────────────────────────────────────────────────────

export function updateFirstPerson(gs: GameState, keys: Keys, dtMs: number = 16.67): void {
  const fp = gs.firstPersonState;
  if (!fp || gs.levelCompleteTimer > 0) return;

  // Frame-rate-independence factor: 1.0 at 60fps (dtMs = 16.67), capped at 3
  // so a long stall can't teleport the player through walls in a single step.
  const dtF = Math.min(dtMs / 16.67, 3);

  let { posX, posY, dirX, dirY, planeX, planeY } = fp;

  // ── Rotation + movement (frozen while a dialog/shop is open) ──
  // Gating on !dialogState.active holds the player still while talking or
  // shopping (Phase 5a §I) — previously rotation/movement ran before the
  // dialog-active early-return, so the player could walk off mid-dialog in every
  // FP mode (Ashfall included). When no dialog is open this is behavior-identical.
  if (!fp.dialogState?.active) {
    // Left turns toward the player's left (-ROT_SPEED), right toward the right
    // (+ROT_SPEED) — matching rotateView's self-test convention ("Left turn →
    // negative Y" when facing +X) and strafe-left. These signs were previously
    // swapped, inverting turn controls in every FP mode.
    if (keys.left) {
      ({ dirX, dirY, planeX, planeY } = rotateView({ dirX, dirY, planeX, planeY }, -ROT_SPEED * dtF));
    }
    if (keys.right) {
      ({ dirX, dirY, planeX, planeY } = rotateView({ dirX, dirY, planeX, planeY }, ROT_SPEED * dtF));
    }

    // Combine forward/back + strafe into one normalized move so walking a
    // diagonal (W+D etc.) isn't √2 faster than walking straight. Axis mapping
    // matches the old per-key calls: forward=(dirX,dirY), strafe-left=(dirY,-dirX).
    let mForward = 0;
    let mStrafe = 0;
    if (keys.up) mForward += 1;
    if (keys.down) mForward -= 1;
    if (keys.strafeLeft) mStrafe += 1;
    if (keys.strafeRight) mStrafe -= 1;
    if (mForward !== 0 || mStrafe !== 0) {
      const scale = mForward !== 0 && mStrafe !== 0 ? Math.SQRT1_2 : 1;
      const step = MOVE_SPEED * dtF * scale;
      ({ posX, posY } = moveWithCollision(
        fp.map,
        posX,
        posY,
        (dirX * mForward + dirY * mStrafe) * step,
        (dirY * mForward - dirX * mStrafe) * step,
      ));
    }
  }

  fp.posX = posX;
  fp.posY = posY;
  fp.dirX = dirX;
  fp.dirY = dirY;
  fp.planeX = planeX;
  fp.planeY = planeY;

  // ── NPC Dialog System ──
  if (fp.dialogState?.active) {
    const ds = fp.dialogState;

    // Tick down the transient "purchase unavailable" flash and the shop-nav
    // debounce every frame the dialog is open (§I). Both are harmless no-ops for
    // plain dialogs / Ashfall's display-only shop.
    if ((ds.shopFlashFrames ?? 0) > 0) ds.shopFlashFrames = Math.max(0, (ds.shopFlashFrames ?? 0) - dtF);
    if ((ds.shopNavCooldown ?? 0) > 0) ds.shopNavCooldown = Math.max(0, (ds.shopNavCooldown ?? 0) - dtF);

    if (ds.shopOpen && ds.shopCanBuy && ds.shopItems) {
      // ── Buyable shop (quartermaster only, §I) ──
      // Rows 0..n-1 are items; a trailing LEAVE row sits at index n. Up/down move
      // the selection (debounced via shopNavCooldown); interact buys a real
      // consumable row or closes on LEAVE. Never Esc (Game.tsx uses Esc for pause).
      const leaveIndex = ds.shopItems.length;
      let navigated = false;
      if ((ds.shopNavCooldown ?? 0) <= 0) {
        if (keys.up) {
          ds.selectedIndex = Math.max(0, (ds.selectedIndex ?? 0) - 1);
          ds.shopNavCooldown = 8;
          navigated = true;
        } else if (keys.down) {
          ds.selectedIndex = Math.min(leaveIndex, (ds.selectedIndex ?? 0) + 1);
          ds.shopNavCooldown = 8;
          navigated = true;
        }
      }
      // Nav and buy are mutually exclusive per frame: if the selection moved this
      // frame, don't also act on it — a held direction landing on LEAVE the same
      // frame shoot fires must not close the shop instead of buying the prior row.
      if (!navigated && keys.shoot && fp.gunCooldown <= 0) {
        fp.gunCooldown = 15; // Debounce
        const idx = ds.selectedIndex ?? 0;
        if (idx === leaveIndex) {
          fp.dialogState = null; // LEAVE row closes the shop
        } else {
          const item = ds.shopItems[idx];
          if (item && item.type === "consumable" && item.itemId) {
            // One-shot buy signal; Game.tsx drains it → purchaseConsumable. The
            // shop stays open for more purchases. Emit nothing for a non-consumable
            // or itemId-less row (defensive — the quartermaster stocks consumables).
            fp.shopPurchaseRequest = { kind: "consumable", itemId: item.itemId as ConsumableId };
          }
        }
      }
    } else if (keys.shoot && fp.gunCooldown <= 0) {
      // ── Dialog advance + display-only shop (Ashfall + any non-buyable merchant) ──
      // Unchanged observable behavior: shoot advances lines, opens a merchant's
      // shop at the end, closes an open display-only shop, then closes the dialog.
      fp.gunCooldown = 15; // Debounce
      if (ds.shopOpen) {
        ds.shopOpen = false; // Display-only shop — shoot closes it (old behavior)
      } else if (ds.currentLine < ds.lines.length - 1) {
        ds.currentLine++;
      } else {
        // End of dialog — open shop if merchant, otherwise close. The open gate is
        // the per-session `!ds.shopSeen` (NOT the per-NPC `!npc.interacted`), so a
        // merchant's shop REOPENS on the next talk (fresh dialog → shopSeen unset)
        // while still closing cleanly within a session — no display-only soft-lock.
        // `shopCanBuy` is enabled only for a canBuy merchant (the quartermaster);
        // Ashfall/other merchants stay display-only.
        const npc = fp.npcs.find((n) => n.id === ds.npcId);
        if (npc?.type === "merchant" && npc.shopItems && !ds.shopSeen) {
          ds.shopOpen = true;
          ds.shopItems = npc.shopItems;
          ds.shopCanBuy = npc.canBuy === true;
          ds.selectedIndex = 0;
          ds.shopSeen = true;
        } else {
          fp.dialogState = null;
        }
      }
    }
    if (fp.gunCooldown > 0) fp.gunCooldown = Math.max(0, fp.gunCooldown - dtF);
    gs.player.bankDir = 0;
    return; // Don't process movement/combat while in dialog
  }

  // ─── Colony exploration hook + anti-bounce gate (Phase 2) ───
  if (fp.colonyContext) {
    fp.colonyInteractCooldownFrames = Math.max(0, (fp.colonyInteractCooldownFrames ?? 0) - dtF);
    if (!keys.shoot) fp.colonyInteractArmed = true;
    const canFire =
      (fp.colonyInteractArmed ?? true) &&
      (fp.colonyInteractCooldownFrames ?? 0) <= 0 &&
      keys.shoot;
    if (canFire) {
      // NPC targeting takes priority: if an NPC is in range and faced, open its
      // dialog and DISARM (§H1). Disarming forces a shoot-key release before any
      // door/pad can fire, closing the close-frame bounce (a dialog closing with
      // the interact key still held would otherwise trigger door/pad that frame).
      if (tryOpenNpcDialog(gs, fp)) {
        fp.colonyInteractArmed = false;
        return;
      }
      const standingOn = { x: Math.floor(fp.posX), y: Math.floor(fp.posY) };
      const step = Math.abs(fp.dirX) >= Math.abs(fp.dirY)
        ? { x: Math.sign(fp.dirX), y: 0 }
        : { x: 0, y: Math.sign(fp.dirY) };
      const facingTile = { x: standingOn.x + step.x, y: standingOn.y + step.y };
      const padResult = fp.colonyContext.onLandingPadInteract(standingOn);
      if (padResult.kind === "show_exit_menu") {
        fp.colonyTransitionRequest = padResult;
        fp.colonyInteractArmed = false;
      } else {
        const doorResult = fp.colonyContext.onDoorInteract(standingOn, facingTile);
        if (doorResult.kind !== "no_door") {
          fp.colonyTransitionRequest = doorResult;
          fp.colonyInteractArmed = false;
        }
      }
    }
    return;
  }
  // ─── End colony hook block ───

  // ── NPC Interaction (press shoot near NPC) ──
  // Same outer gate as before (npcs present, shoot held, gunCooldown ready); the
  // proximity/facing/open body now lives in tryOpenNpcDialog (§H1). Opening a
  // dialog returns, skipping the shot this frame — behavior-identical.
  if (fp.npcs && keys.shoot && fp.gunCooldown <= 0) {
    if (tryOpenNpcDialog(gs, fp)) return;
  }

  // ── Shooting ──
  if (fp.gunCooldown > 0) fp.gunCooldown = Math.max(0, fp.gunCooldown - dtF);
  if (fp.gunFireTimer > 0) fp.gunFireTimer = Math.max(0, fp.gunFireTimer - dtF);

  if (keys.shoot && fp.gunCooldown <= 0) {
    fp.gunFireTimer = GUN_FLASH_DURATION;
    fp.gunCooldown = GUN_FIRE_RATE;
    gs.audioEvents.push(AudioEvent.PLAYER_SHOOT);

    // Hitscan — check if any enemy is near the center ray
    let closestHit: FPEnemy | null = null;
    let closestDist = BULLET_RANGE;

    for (const enemy of fp.enemies) {
      if (enemy.deathTimer !== 0) continue;

      const dx = enemy.x - posX;
      const dy = enemy.y - posY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > BULLET_RANGE || dist > closestDist) continue;

      // Check if enemy is roughly in crosshair
      // Project enemy onto camera plane
      const invDet = 1.0 / (planeX * dirY - dirX * planeY);
      const transformY = invDet * (-planeY * dx + planeX * dy); // depth
      if (transformY <= 0) continue; // Behind camera

      const transformX = invDet * (dirY * dx - dirX * dy);
      const screenX = Math.floor((CANVAS_WIDTH / 2) * (1 + transformX / transformY));

      // Hit tolerance: enemy must be within ~30% of screen center
      const hitWidth = Math.abs(CANVAS_WIDTH / transformY) * 0.4;
      if (Math.abs(screenX - CANVAS_WIDTH / 2) < hitWidth) {
        // Line of sight check
        if (hasLOS(fp.map, posX, posY, enemy.x, enemy.y)) {
          closestHit = enemy;
          closestDist = dist;
        }
      }
    }

    if (closestHit) {
      // Apply damage with affinity
      let dmg = BULLET_DAMAGE;
      const affinity = resolveAffinity(gs.equippedWeaponType, closestHit.classId);
      dmg *= AFFINITY_MULTIPLIER[affinity];

      if (hasSkill(gs.allocatedSkills, "sharpshooter") && affinity === "effective") {
        dmg *= 1 + getSkillEffect(gs.allocatedSkills, "sharpshooter");
      }
      if (hasSkill(gs.allocatedSkills, "glass-cannon")) {
        dmg *= 1 + getSkillEffect(gs.allocatedSkills, "glass-cannon");
      }

      closestHit.hp -= dmg;
      gs.screenShake = 2;

      // Floating label (in screen space — approximate)
      const label = createAffinityLabel(CANVAS_WIDTH / 2, GAME_AREA_HEIGHT / 2 - 40, affinity);
      if (label) gs.floatingLabels = [...gs.floatingLabels, label];

      if (closestHit.hp <= 0) {
        closestHit.deathTimer = 30; // 0.5s death animation
        gs.score += 200;
        gs.xp += 200;
        gs.kills += 1;
        gs.audioEvents.push(AudioEvent.ENEMY_DESTROY);
      } else {
        gs.audioEvents.push(AudioEvent.BOSS_HIT); // reuse for hit sound
      }
    }
  }

  // ── Enemy AI ──
  for (const enemy of fp.enemies) {
    if (enemy.deathTimer > 0) {
      // deathTimer uses -1 as the "remove me" sentinel; -1 means "already dead"
      // and 0 means "alive" (see the `!== 0` alive-check above). Decrement by
      // dtF ONLY — never floor at 0 — so the countdown lands on <=0 and the
      // transition below sets exactly -1. Flooring at 0 would park a dying
      // enemy at the "alive" value and it would never be removed.
      enemy.deathTimer -= dtF;
      if (enemy.deathTimer <= 0) enemy.deathTimer = -1; // Mark for removal
      continue;
    }
    if (enemy.deathTimer < 0) continue; // Dead

    const dx = posX - enemy.x;
    const dy = posY - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Aggro
    if (!enemy.isAggro && dist < ENEMY_AGGRO_RANGE) {
      if (hasLOS(fp.map, enemy.x, enemy.y, posX, posY)) {
        enemy.isAggro = true;
      }
    }

    if (!enemy.isAggro) continue;

    switch (enemy.type) {
      case "grunt":
      case "charger": {
        // Move toward player
        const speed = (enemy.type === "charger" ? enemy.speed * 1.5 : enemy.speed) * dtF;
        const len = dist || 1;
        const mvx = (dx / len) * speed;
        const mvy = (dy / len) * speed;
        const newX = enemy.x + mvx;
        const newY = enemy.y + mvy;
        if (isWalkable(fp.map, newX, enemy.y)) enemy.x = newX;
        if (isWalkable(fp.map, enemy.x, newY)) enemy.y = newY;

        // Contact damage
        if (dist < ENEMY_CONTACT_RANGE && gs.player.invincibleTimer <= 0) {
          gs.player.hp -= ENEMY_CONTACT_DAMAGE;
          gs.player.invincibleTimer = 60;
          gs.screenShake = 5;
          gs.audioEvents.push(AudioEvent.PLAYER_HIT);
          if (gs.player.hp <= 0) {
            gs.lives -= 1;
            gs.deaths += 1;
            if (gs.lives <= 0) {
              gs.screen = GameScreen.GAME_OVER;
              gs.audioEvents.push(AudioEvent.GAME_OVER);
            } else {
              // Respawn
              gs.player.hp = gs.player.maxHp;
              gs.player.invincibleTimer = 90;
              // Find spawn
              for (let r = 0; r < fp.map.height; r++) {
                for (let c = 0; c < fp.map.width; c++) {
                  if (fp.map.tiles[r][c] === "spawn") {
                    fp.posX = c + 0.5;
                    fp.posY = r + 0.5;
                  }
                }
              }
            }
          }
        }
        break;
      }
      case "sentry": {
        // Stationary — shoots at player (TODO: implement projectiles in FP)
        // For now: hitscan damage at interval
        if (enemy.fireTimer > 0) {
          enemy.fireTimer = Math.max(0, enemy.fireTimer - dtF);
        } else if (dist < SENTRY_FIRE_RANGE && hasLOS(fp.map, enemy.x, enemy.y, posX, posY)) {
          if (gs.player.invincibleTimer <= 0) {
            gs.player.hp -= 1;
            gs.player.invincibleTimer = 40;
            gs.screenShake = 3;
            gs.audioEvents.push(AudioEvent.PLAYER_HIT);
            if (gs.player.hp <= 0) {
              gs.lives -= 1;
              gs.deaths += 1;
              if (gs.lives <= 0) {
                gs.screen = GameScreen.GAME_OVER;
                gs.audioEvents.push(AudioEvent.GAME_OVER);
              } else {
                gs.player.hp = gs.player.maxHp;
                gs.player.invincibleTimer = 90;
              }
            }
          }
          enemy.fireTimer = SENTRY_FIRE_RATE;
          gs.audioEvents.push(AudioEvent.ENEMY_SHOOT);
        }
        break;
      }
    }
  }

  // Remove dead enemies
  fp.enemies = fp.enemies.filter((e) => e.deathTimer !== -1);

  // ── Invincibility ──
  if (gs.player.invincibleTimer > 0) gs.player.invincibleTimer = Math.max(0, gs.player.invincibleTimer - dtF);

  // ── Objective pickup ──
  if (fp.objectivePickup && !fp.objectiveCollected) {
    const pickupDX = fp.objectivePickup.x - posX;
    const pickupDY = fp.objectivePickup.y - posY;
    if (Math.sqrt(pickupDX * pickupDX + pickupDY * pickupDY) <= OBJECTIVE_PICKUP_RANGE) {
      fp.objectiveCollected = true;
      fp.objectivePickup = undefined;
      fp.goalReached = true;
      gs.xp += 250;
      gs.audioEvents.push(AudioEvent.POWER_UP_COLLECT);
    }
  }

  // ── Goal check ──
  const goalCol = Math.floor(posX);
  const goalRow = Math.floor(posY);
  if (goalCol >= 0 && goalCol < fp.map.width && goalRow >= 0 && goalRow < fp.map.height) {
    if (fp.map.tiles[goalRow][goalCol] === "goal") {
      fp.goalReached = true;
    }
  }

  if (fp.goalReached && gs.levelCompleteTimer === 0) {
    gs.levelCompleteTimer = 360;
    gs.xp += 500;
    gs.audioEvents.push(AudioEvent.LEVEL_COMPLETE);
  }

  gs.player.bankDir = (keys.up || keys.down) ? 1 : 0;
}

export function __runFirstPersonSelfTests(): void {
  const turnedLeft = rotateView({ dirX: 1, dirY: 0, planeX: 0, planeY: 0.66 }, -ROT_SPEED);
  console.assert(turnedLeft.dirY < 0, "Left turn should rotate toward negative Y");

  const turnedRight = rotateView({ dirX: 1, dirY: 0, planeX: 0, planeY: 0.66 }, ROT_SPEED);
  console.assert(turnedRight.dirY > 0, "Right turn should rotate toward positive Y");

  const testMap: BoardingMap = {
    width: 5,
    height: 5,
    tileSize: 32,
    tiles: [
      ["wall", "wall", "wall", "wall", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "wall", "wall", "wall", "wall"],
    ],
  };

  const strafeLeft = moveWithCollision(testMap, 2.5, 2.5, 0, -MOVE_SPEED);
  console.assert(strafeLeft.posY < 2.5, "Strafe left should move perpendicular to facing");

  const strafeRight = moveWithCollision(testMap, 2.5, 2.5, 0, MOVE_SPEED);
  console.assert(strafeRight.posY > 2.5, "Strafe right should move perpendicular to facing");

  const objectiveState = {
    map: testMap,
    posX: 2.5,
    posY: 2.5,
    dirX: 1,
    dirY: 0,
    planeX: 0,
    planeY: 0.66,
    moveSpeed: MOVE_SPEED,
    rotSpeed: ROT_SPEED,
    goalReached: false,
    objectivePickup: { x: 2.6, y: 2.5, label: "TEST" },
    objectiveCollected: false,
    enemies: [],
    gunFireTimer: 0,
    gunCooldown: 0,
  };
  const objectiveGame = {
    firstPersonState: objectiveState,
    levelCompleteTimer: 0,
    player: { invincibleTimer: 0, bankDir: 0 },
    xp: 0,
    audioEvents: [],
  } as unknown as GameState;
  updateFirstPerson(objectiveGame, {
    left: false,
    right: false,
    up: false,
    down: false,
    strafeLeft: false,
    strafeRight: false,
    shoot: false,
    bomb: false,
    jump: false,
  });
  console.assert(objectiveState.objectiveCollected, "Objective pickup should collect when player is within range");
  console.assert(objectiveState.goalReached, "Objective pickup should mark the mission complete");

  // ── Frame-rate independence (Task 6) ──
  const noKeys: Keys = {
    left: false, right: false, up: false, down: false,
    strafeLeft: false, strafeRight: false,
    shoot: false, bomb: false, jump: false,
  };
  const openMap: BoardingMap = {
    width: 5,
    height: 5,
    tileSize: 32,
    tiles: [
      ["wall", "wall", "wall", "wall", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "wall", "wall", "wall", "wall"],
    ],
  };
  // Minimal combat FP GameState facing +X in open space.
  const makeFpGame = (fpOverrides: Record<string, unknown> = {}) => {
    const fpState = {
      map: openMap,
      posX: 2.5, posY: 2.5,
      dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
      moveSpeed: MOVE_SPEED, rotSpeed: ROT_SPEED,
      goalReached: false,
      enemies: [] as FPEnemy[],
      gunFireTimer: 0, gunCooldown: 0,
      npcs: [], dialogState: null,
      ...fpOverrides,
    };
    const game = {
      firstPersonState: fpState,
      levelCompleteTimer: 0,
      player: { invincibleTimer: 0, bankDir: 0, hp: 10, maxHp: 10 },
      lives: 3, deaths: 0, score: 0, xp: 0, kills: 0,
      screenShake: 0,
      equippedWeaponType: "kinetic",
      allocatedSkills: [],
      floatingLabels: [],
      audioEvents: [],
    } as unknown as GameState;
    return { game, fpState };
  };

  // 1) Two half-steps (dtMs = 16.67/2) travel the same distance as one full step.
  const HALF_MS = 16.67 / 2;
  const full = makeFpGame();
  updateFirstPerson(full.game, { ...noKeys, up: true }, 16.67);
  const distFull = full.fpState.posX - 2.5;
  const halved = makeFpGame();
  updateFirstPerson(halved.game, { ...noKeys, up: true }, HALF_MS);
  updateFirstPerson(halved.game, { ...noKeys, up: true }, HALF_MS);
  const distHalf = halved.fpState.posX - 2.5;
  console.assert(Math.abs(distFull - distHalf) < 1e-9, "dt: two half-steps must equal one full step");

  // 2) A huge dtMs clamps to 3 frames' worth of movement (not 12).
  const clamped = makeFpGame();
  updateFirstPerson(clamped.game, { ...noKeys, up: true }, 200);
  const distClamped = clamped.fpState.posX - 2.5;
  console.assert(Math.abs(distClamped - MOVE_SPEED * 3) < 1e-9, "dt: dtMs=200 must clamp to 3 frames of movement");

  // 3) A cooldown that overshoots 0 under dtF=3 still fires (the `<= 0` window).
  const cooldownGame = makeFpGame({ gunCooldown: 2 });
  updateFirstPerson(cooldownGame.game, { ...noKeys, shoot: true }, 200);
  console.assert(cooldownGame.fpState.gunFireTimer === GUN_FLASH_DURATION, "dt: cooldown must fire at the <=0 window under dtF=3");

  // 4) A dying enemy still reaches the -1 sentinel and is removed under dtF=3.
  const dyingEnemy = {
    id: 1, x: 3.5, y: 2.5, hp: 0, maxHp: 3, speed: 0.015,
    type: "grunt", aggroRange: 6, isAggro: false, deathTimer: 30,
    fireTimer: 0, classId: "swarm",
  } as unknown as FPEnemy;
  const dying = makeFpGame({ enemies: [dyingEnemy] });
  let dtGuard = 0;
  while (dying.fpState.enemies.length > 0 && dtGuard++ < 40) {
    updateFirstPerson(dying.game, noKeys, 200);
  }
  console.assert(dying.fpState.enemies.length === 0, "dt: dying enemy must reach -1 and be removed under dtF=3");
}

if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
  __runFirstPersonSelfTests();
}
