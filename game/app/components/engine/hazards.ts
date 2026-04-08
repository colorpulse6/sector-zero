import {
  CANVAS_WIDTH,
  GAME_AREA_HEIGHT,
  type PlanetId,
  type Player,
} from "./types";

// ─── Hazard State ───────────────────────────────────────────────────

export interface HazardInstance {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  timer: number;
  maxTimer: number;
  active: boolean;
  /** Warning glow before activation */
  warning: boolean;
}

export interface HazardState {
  planetId: PlanetId;
  hazards: HazardInstance[];
  globalTimer: number;
  /** Sandstorm / pollen visibility reduction (0-1, 1 = full) */
  visibility: number;
  /** Current push applied to player movement */
  pushX: number;
  pushY: number;
  /** Speed multiplier from environmental effects (frozen zones etc.) */
  speedMultiplier: number;
}

export function createHazardState(planetId: PlanetId): HazardState {
  return {
    planetId,
    hazards: [],
    globalTimer: 0,
    visibility: 1,
    pushX: 0,
    pushY: 0,
    speedMultiplier: 1,
  };
}

// ─── Hazard Update ──────────────────────────────────────────────────

const WARNING_FRAMES = 60; // 1 second warning before activation
const HAZARD_DURATION = 180; // 3 seconds active

export function updateHazards(
  state: HazardState,
  player: Player,
  intensityTier: number
): { damage: number } {
  state.globalTimer++;
  let damage = 0;

  // Reset per-frame effects
  state.pushX = 0;
  state.pushY = 0;
  state.speedMultiplier = 1;
  state.visibility = 1;

  switch (state.planetId) {
    case "verdania":
      damage += updateVineHazards(state, player);
      break;
    case "glaciem":
      damage += updateIceHazards(state, player, intensityTier);
      break;
    case "pyraxis":
      damage += updateLavaHazards(state, player);
      break;
    case "ossuary":
      damage += updateDebrisHazards(state, player);
      break;
    case "abyssia":
      updateCurrentHazards(state, player);
      break;
    case "ashfall":
      updateSandstormHazards(state, intensityTier);
      break;
    case "prismara":
      damage += updateCrystalHazards(state, player);
      break;
    case "genesis":
      damage += updatePollenHazards(state, player);
      break;
    case "luminos":
      damage += updateNeonHazards(state, player);
      break;
    case "bastion":
      damage += updateFortressHazards(state, player);
      break;
  }

  // Update all hazard timers
  state.hazards = state.hazards.filter((h) => {
    h.timer--;
    if (h.timer <= 0 && !h.active) {
      // Warning period ended — activate
      h.active = true;
      h.warning = false;
      h.timer = HAZARD_DURATION;
      return true;
    }
    return h.timer > 0;
  });

  return { damage };
}

// ─── Verdania: Vine Tendrils ────────────────────────────────────────
function updateVineHazards(state: HazardState, player: Player): number {
  let damage = 0;

  // Spawn new vine every 4 seconds
  if (state.globalTimer % 240 === 0) {
    const lane = Math.floor(Math.random() * 4);
    const laneWidth = CANVAS_WIDTH / 4;
    state.hazards.push({
      type: "vine",
      x: lane * laneWidth,
      y: GAME_AREA_HEIGHT - 60,
      width: laneWidth,
      height: 60,
      timer: WARNING_FRAMES,
      maxTimer: WARNING_FRAMES + HAZARD_DURATION,
      active: false,
      warning: true,
    });
  }

  // Check player collision with active vines
  for (const h of state.hazards) {
    if (h.type === "vine" && h.active) {
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      if (px > h.x && px < h.x + h.width && py > h.y && py < h.y + h.height) {
        state.speedMultiplier = 0.4; // slowed in vines
      }
    }
  }

  return damage;
}

// ─── Glaciem: Ice Blasts ────────────────────────────────────────────
function updateIceHazards(state: HazardState, player: Player, intensity: number): number {
  let damage = 0;
  const spawnRate = Math.max(120, 300 - intensity * 30); // faster at higher intensity

  // Spawn ice blast zones
  if (state.globalTimer % spawnRate === 0) {
    const side = Math.random() < 0.5 ? -1 : 1;
    state.hazards.push({
      type: "ice-blast",
      x: side === -1 ? 0 : CANVAS_WIDTH - 100,
      y: Math.random() * (GAME_AREA_HEIGHT - 100),
      width: 100,
      height: GAME_AREA_HEIGHT,
      timer: WARNING_FRAMES,
      maxTimer: WARNING_FRAMES + 120,
      active: false,
      warning: true,
    });
  }

  // Push player when in active ice blast
  for (const h of state.hazards) {
    if (h.type === "ice-blast" && h.active) {
      const px = player.x + player.width / 2;
      if (h.x < CANVAS_WIDTH / 2) {
        // Left side blast pushes right
        if (px < h.x + h.width + 40) state.pushX = 2.5;
      } else {
        // Right side blast pushes left
        if (px > h.x - 40) state.pushX = -2.5;
      }
    }
  }

  return damage;
}

// ─── Pyraxis: Lava Columns ──────────────────────────────────────────
function updateLavaHazards(state: HazardState, player: Player): number {
  let damage = 0;

  // Spawn lava column every 3.5 seconds
  if (state.globalTimer % 210 === 0) {
    const x = 60 + Math.random() * (CANVAS_WIDTH - 120);
    state.hazards.push({
      type: "lava",
      x: x - 30,
      y: GAME_AREA_HEIGHT - 120,
      width: 60,
      height: 120,
      timer: WARNING_FRAMES,
      maxTimer: WARNING_FRAMES + HAZARD_DURATION,
      active: false,
      warning: true,
    });
  }

  // Damage player if in active lava column
  for (const h of state.hazards) {
    if (h.type === "lava" && h.active) {
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      if (px > h.x && px < h.x + h.width && py > h.y) {
        // Only damage once per activation (every 60 frames)
        if (h.timer % 60 === 0 && player.invincibleTimer <= 0) {
          damage++;
        }
      }
    }
  }

  return damage;
}

// ─── Ossuary: Falling Debris ────────────────────────────────────────
function updateDebrisHazards(state: HazardState, player: Player): number {
  let damage = 0;

  // Spawn debris every 3 seconds
  if (state.globalTimer % 180 === 0) {
    const x = Math.random() * (CANVAS_WIDTH - 48);
    state.hazards.push({
      type: "debris",
      x,
      y: -48,
      width: 48,
      height: 48,
      timer: WARNING_FRAMES + 300, // falls for 5 seconds
      maxTimer: WARNING_FRAMES + 300,
      active: true,
      warning: false,
    });
  }

  // Move debris downward and check collision
  for (const h of state.hazards) {
    if (h.type === "debris" && h.active) {
      h.y += 2.5;
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      if (
        px > h.x && px < h.x + h.width &&
        py > h.y && py < h.y + h.height &&
        player.invincibleTimer <= 0
      ) {
        damage++;
        h.timer = 0; // remove on hit
      }
    }
  }

  return damage;
}

// ─── Abyssia: Water Currents ────────────────────────────────────────
function updateCurrentHazards(state: HazardState, player: Player): void {
  // Alternating currents every 5 seconds
  const cycle = Math.floor(state.globalTimer / 300) % 4;
  switch (cycle) {
    case 0: state.pushX = 1.2; break;  // push right
    case 1: state.pushY = -0.8; break; // push up
    case 2: state.pushX = -1.2; break; // push left
    case 3: state.pushY = 0.8; break;  // push down
  }

  // Pressure zones that shrink play area briefly
  if (state.globalTimer % 480 === 0) {
    state.hazards.push({
      type: "pressure",
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: GAME_AREA_HEIGHT,
      timer: 180, // 3 seconds
      maxTimer: 180,
      active: true,
      warning: false,
    });
  }
}

// ─── Ashfall: Sandstorms ────────────────────────────────────────────
function updateSandstormHazards(state: HazardState, intensity: number): void {
  // Sandstorm pulses reduce visibility
  const cyclePeriod = Math.max(180, 360 - intensity * 30);
  const cyclePos = state.globalTimer % cyclePeriod;
  const stormPhase = cyclePos / cyclePeriod;

  // Storm builds up then clears: sin wave
  if (stormPhase > 0.3 && stormPhase < 0.7) {
    const stormIntensity = Math.sin((stormPhase - 0.3) / 0.4 * Math.PI);
    state.visibility = Math.max(0.3, 1 - stormIntensity * 0.7);
    state.pushX = stormIntensity * 1.5 * (Math.sin(state.globalTimer * 0.05) > 0 ? 1 : -1);
  }
}

// ─── Prismara: Crystal Laser Beams ──────────────────────────────────
function updateCrystalHazards(state: HazardState, player: Player): number {
  let damage = 0;

  // Spawn laser beams every 4 seconds
  if (state.globalTimer % 240 === 0) {
    const horizontal = Math.random() < 0.5;
    if (horizontal) {
      const y = 60 + Math.random() * (GAME_AREA_HEIGHT - 120);
      state.hazards.push({
        type: "laser",
        x: 0,
        y: y - 8,
        width: CANVAS_WIDTH,
        height: 16,
        timer: WARNING_FRAMES,
        maxTimer: WARNING_FRAMES + 120,
        active: false,
        warning: true,
      });
    } else {
      const x = 60 + Math.random() * (CANVAS_WIDTH - 120);
      state.hazards.push({
        type: "laser",
        x: x - 8,
        y: 0,
        width: 16,
        height: GAME_AREA_HEIGHT,
        timer: WARNING_FRAMES,
        maxTimer: WARNING_FRAMES + 120,
        active: false,
        warning: true,
      });
    }
  }

  // Check laser collision
  for (const h of state.hazards) {
    if (h.type === "laser" && h.active) {
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      if (px > h.x && px < h.x + h.width && py > h.y && py < h.y + h.height) {
        if (h.timer % 30 === 0 && player.invincibleTimer <= 0) {
          damage++;
        }
      }
    }
  }

  return damage;
}

// ─── Luminos: Neon Electrical Arcs ─────────────────────────────────
function updateNeonHazards(state: HazardState, player: Player): number {
  let damage = 0;

  // Electrical arc columns every 3.5 seconds
  if (state.globalTimer % 210 === 0) {
    const x = 40 + Math.random() * (CANVAS_WIDTH - 80);
    state.hazards.push({
      type: "neon-arc",
      x: x - 20,
      y: 0,
      width: 40,
      height: GAME_AREA_HEIGHT,
      timer: WARNING_FRAMES,
      maxTimer: WARNING_FRAMES + 120,
      active: false,
      warning: true,
    });
  }

  // Flickering blackout zones (neon signs overloading) every 6 seconds
  if (state.globalTimer % 360 === 0) {
    const side = Math.random() < 0.5 ? 0 : CANVAS_WIDTH - 120;
    state.hazards.push({
      type: "blackout",
      x: side,
      y: Math.random() * (GAME_AREA_HEIGHT - 200),
      width: 120,
      height: 200,
      timer: WARNING_FRAMES,
      maxTimer: WARNING_FRAMES + HAZARD_DURATION,
      active: false,
      warning: true,
    });
  }

  // Check arc collision
  for (const h of state.hazards) {
    if (h.type === "neon-arc" && h.active) {
      const px = player.x + player.width / 2;
      if (px > h.x && px < h.x + h.width) {
        if (h.timer % 30 === 0 && player.invincibleTimer <= 0) {
          damage++;
        }
      }
    }
    // Blackout zones reduce visibility when player is inside
    if (h.type === "blackout" && h.active) {
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      if (px > h.x && px < h.x + h.width && py > h.y && py < h.y + h.height) {
        state.visibility = 0.35;
      }
    }
  }

  return damage;
}

// ─── Bastion: Falling Rubble & Fire Zones ──────────────────────────
function updateFortressHazards(state: HazardState, player: Player): number {
  let damage = 0;

  // Falling rubble every 2.5 seconds (heavier than Ossuary debris)
  if (state.globalTimer % 150 === 0) {
    const count = 1 + Math.floor(Math.random() * 2); // 1-2 rubble pieces
    for (let i = 0; i < count; i++) {
      const x = Math.random() * (CANVAS_WIDTH - 56);
      state.hazards.push({
        type: "rubble",
        x,
        y: -56,
        width: 56,
        height: 56,
        timer: WARNING_FRAMES + 300,
        maxTimer: WARNING_FRAMES + 300,
        active: true,
        warning: false,
      });
    }
  }

  // Fire zones from destroyed buildings every 5 seconds
  if (state.globalTimer % 300 === 0) {
    const x = 30 + Math.random() * (CANVAS_WIDTH - 90);
    state.hazards.push({
      type: "fire-zone",
      x,
      y: GAME_AREA_HEIGHT - 80,
      width: 80,
      height: 80,
      timer: WARNING_FRAMES,
      maxTimer: WARNING_FRAMES + HAZARD_DURATION,
      active: false,
      warning: true,
    });
  }

  // Move rubble down and check collision
  for (const h of state.hazards) {
    if (h.type === "rubble" && h.active) {
      h.y += 3;
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      if (
        px > h.x && px < h.x + h.width &&
        py > h.y && py < h.y + h.height &&
        player.invincibleTimer <= 0
      ) {
        damage++;
        h.timer = 0;
      }
    }
    // Fire zone damage
    if (h.type === "fire-zone" && h.active) {
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      if (px > h.x && px < h.x + h.width && py > h.y && py < h.y + h.height) {
        if (h.timer % 45 === 0 && player.invincibleTimer <= 0) {
          damage++;
        }
      }
    }
  }

  return damage;
}

// ─── Genesis: Pollen Bursts ─────────────────────────────────────────
function updatePollenHazards(state: HazardState, player: Player): number {
  let damage = 0;

  // Pollen clouds reduce visibility periodically
  const pollenCycle = state.globalTimer % 360;
  if (pollenCycle > 120 && pollenCycle < 240) {
    state.visibility = Math.max(0.5, 1 - Math.sin((pollenCycle - 120) / 120 * Math.PI) * 0.5);
  }

  // Grab vines every 5 seconds
  if (state.globalTimer % 300 === 0) {
    const x = 40 + Math.random() * (CANVAS_WIDTH - 80);
    state.hazards.push({
      type: "grab-vine",
      x: x - 20,
      y: GAME_AREA_HEIGHT - 40,
      width: 40,
      height: 40,
      timer: WARNING_FRAMES,
      maxTimer: WARNING_FRAMES + 180,
      active: false,
      warning: true,
    });
  }

  // Grab vines slow the player significantly
  for (const h of state.hazards) {
    if (h.type === "grab-vine" && h.active) {
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      if (px > h.x && px < h.x + h.width && py > h.y && py < h.y + h.height) {
        state.speedMultiplier = 0.3;
      }
    }
  }

  return damage;
}

// ─── Hazard Rendering ───────────────────────────────────────────────

export function renderHazards(
  ctx: CanvasRenderingContext2D,
  state: HazardState,
  frameCount: number
): void {
  for (const h of state.hazards) {
    const alpha = h.warning
      ? 0.3 + Math.sin(frameCount * 0.15) * 0.2 // pulsing warning
      : 0.6;

    ctx.save();

    switch (h.type) {
      case "vine":
      case "grab-vine":
        ctx.fillStyle = h.warning
          ? `rgba(50, 200, 80, ${alpha})`
          : `rgba(30, 150, 60, ${alpha})`;
        ctx.fillRect(h.x, h.y, h.width, h.height);
        if (h.active) {
          // Draw vine tendrils
          ctx.strokeStyle = `rgba(60, 220, 90, 0.8)`;
          ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            const vx = h.x + (h.width / 5) * (i + 1);
            ctx.beginPath();
            ctx.moveTo(vx, h.y + h.height);
            ctx.bezierCurveTo(vx - 10, h.y + h.height - 20, vx + 10, h.y + h.height - 40, vx, h.y);
            ctx.stroke();
          }
        }
        break;

      case "ice-blast":
        ctx.fillStyle = h.warning
          ? `rgba(100, 180, 255, ${alpha})`
          : `rgba(150, 220, 255, ${alpha * 0.8})`;
        ctx.fillRect(h.x, 0, h.width, GAME_AREA_HEIGHT);
        break;

      case "lava":
        ctx.fillStyle = h.warning
          ? `rgba(255, 100, 20, ${alpha})`
          : `rgba(255, 60, 0, ${alpha})`;
        ctx.fillRect(h.x, h.y, h.width, h.height);
        if (h.active) {
          // Glow effect
          const grd = ctx.createLinearGradient(h.x, h.y, h.x, h.y + h.height);
          grd.addColorStop(0, "rgba(255, 200, 50, 0.5)");
          grd.addColorStop(1, "rgba(255, 60, 0, 0)");
          ctx.fillStyle = grd;
          ctx.fillRect(h.x - 10, h.y - 20, h.width + 20, h.height + 20);
        }
        break;

      case "debris":
        ctx.fillStyle = `rgba(120, 100, 80, 0.8)`;
        ctx.fillRect(h.x, h.y, h.width, h.height);
        ctx.strokeStyle = `rgba(180, 160, 140, 0.6)`;
        ctx.strokeRect(h.x, h.y, h.width, h.height);
        break;

      case "pressure":
        // Dark vignette edges for pressure zones
        if (h.active) {
          const pAlpha = 0.3 * (h.timer / h.maxTimer);
          const leftGrd = ctx.createLinearGradient(0, 0, 60, 0);
          leftGrd.addColorStop(0, `rgba(0, 20, 60, ${pAlpha})`);
          leftGrd.addColorStop(1, "transparent");
          ctx.fillStyle = leftGrd;
          ctx.fillRect(0, 0, 60, GAME_AREA_HEIGHT);

          const rightGrd = ctx.createLinearGradient(CANVAS_WIDTH - 60, 0, CANVAS_WIDTH, 0);
          rightGrd.addColorStop(0, "transparent");
          rightGrd.addColorStop(1, `rgba(0, 20, 60, ${pAlpha})`);
          ctx.fillStyle = rightGrd;
          ctx.fillRect(CANVAS_WIDTH - 60, 0, 60, GAME_AREA_HEIGHT);
        }
        break;

      case "laser":
        if (h.warning) {
          ctx.strokeStyle = `rgba(200, 50, 255, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          if (h.width > h.height) {
            ctx.beginPath();
            ctx.moveTo(h.x, h.y + h.height / 2);
            ctx.lineTo(h.x + h.width, h.y + h.height / 2);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(h.x + h.width / 2, h.y);
            ctx.lineTo(h.x + h.width / 2, h.y + h.height);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        } else if (h.active) {
          ctx.fillStyle = `rgba(200, 100, 255, ${alpha})`;
          ctx.fillRect(h.x, h.y, h.width, h.height);
          // Bright core
          if (h.width > h.height) {
            ctx.fillStyle = `rgba(255, 200, 255, 0.8)`;
            ctx.fillRect(h.x, h.y + h.height / 2 - 2, h.width, 4);
          } else {
            ctx.fillStyle = `rgba(255, 200, 255, 0.8)`;
            ctx.fillRect(h.x + h.width / 2 - 2, h.y, 4, h.height);
          }
        }
        break;

      case "neon-arc":
        if (h.warning) {
          ctx.strokeStyle = `rgba(200, 80, 255, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.beginPath();
          ctx.moveTo(h.x + h.width / 2, 0);
          ctx.lineTo(h.x + h.width / 2, GAME_AREA_HEIGHT);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (h.active) {
          // Electrical arc column
          const arcAlpha = 0.4 + Math.sin(frameCount * 0.3) * 0.2;
          ctx.fillStyle = `rgba(180, 60, 255, ${arcAlpha})`;
          ctx.fillRect(h.x, 0, h.width, GAME_AREA_HEIGHT);
          // Bright core with flicker
          ctx.fillStyle = `rgba(220, 160, 255, ${0.6 + Math.sin(frameCount * 0.5) * 0.3})`;
          ctx.fillRect(h.x + h.width / 2 - 3, 0, 6, GAME_AREA_HEIGHT);
        }
        break;

      case "blackout":
        if (h.warning) {
          ctx.fillStyle = `rgba(10, 0, 30, ${alpha * 0.5})`;
          ctx.fillRect(h.x, h.y, h.width, h.height);
        } else if (h.active) {
          ctx.fillStyle = `rgba(5, 0, 15, 0.7)`;
          ctx.fillRect(h.x, h.y, h.width, h.height);
          // Flickering neon border
          if (frameCount % 8 < 4) {
            ctx.strokeStyle = `rgba(255, 0, 200, 0.4)`;
            ctx.lineWidth = 1;
            ctx.strokeRect(h.x, h.y, h.width, h.height);
          }
        }
        break;

      case "rubble":
        ctx.fillStyle = `rgba(100, 90, 70, 0.85)`;
        ctx.fillRect(h.x, h.y, h.width, h.height);
        // Cracks
        ctx.strokeStyle = `rgba(60, 55, 45, 0.8)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(h.x + 10, h.y + 10);
        ctx.lineTo(h.x + h.width - 10, h.y + h.height - 10);
        ctx.moveTo(h.x + h.width - 10, h.y + 10);
        ctx.lineTo(h.x + 10, h.y + h.height - 10);
        ctx.stroke();
        break;

      case "fire-zone":
        if (h.warning) {
          ctx.fillStyle = `rgba(255, 120, 20, ${alpha})`;
          ctx.fillRect(h.x, h.y, h.width, h.height);
        } else if (h.active) {
          // Flickering fire
          const fireAlpha = 0.5 + Math.sin(frameCount * 0.2) * 0.15;
          const grd = ctx.createLinearGradient(h.x, h.y, h.x, h.y + h.height);
          grd.addColorStop(0, `rgba(255, 180, 30, ${fireAlpha})`);
          grd.addColorStop(1, `rgba(255, 60, 0, ${fireAlpha * 0.7})`);
          ctx.fillStyle = grd;
          ctx.fillRect(h.x, h.y, h.width, h.height);
          // Hot core
          ctx.fillStyle = `rgba(255, 220, 100, 0.5)`;
          ctx.fillRect(h.x + 15, h.y + 15, h.width - 30, h.height - 30);
        }
        break;
    }

    ctx.restore();
  }

  // Visibility overlay (sandstorm, pollen)
  if (state.visibility < 1) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - state.visibility})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_AREA_HEIGHT);
    ctx.restore();
  }
}
