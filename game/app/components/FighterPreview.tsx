"use client";

/** Deterministic inspection route for the top-down fighter (vertical shooter)
 *  presentation. It drives the REAL renderer (drawGame) and, for the live
 *  scenes, the REAL game update (updateGame) over a seeded Math.random so a
 *  capture at frame N is reproducible. Nothing here touches the campaign save.
 *
 *  Scenes:
 *   showcase — every enemy type at natural size, both bullet families, all
 *              explosion frames, power-ups, player exhaust; no simulation.
 *   live     — World 1 Level 1 played by a scripted pilot (hold fire, weave).
 *   boss     — Rockjaw fight played by the same scripted pilot.
 *  `window.__fighterPreview` exposes step/scene/grade/hide for browser specs. */

import { useEffect, useRef, useState } from "react";
import { createGameState, updateGame } from "./engine/gameEngine";
import { createBossForWorld } from "./engine/bosses";
import { createEnemy } from "./engine/enemies";
import { createExplosion, createSparks, createSpriteExplosion, updateParticles, updateSpriteExplosions } from "./engine/particles";
import { updateBackground } from "./engine/background";
import { drawGame } from "./engine/renderer";
import { createGradePass } from "./engine/postFx";
import { selectPreset } from "./engine/postFx/presets";
import { preloadAll, isLoaded } from "./engine/sprites";
import {
  CANVAS_HEIGHT, CANVAS_WIDTH, ENEMY_DEFS, EnemyType, GameScreen, PowerUpType,
  type Bullet, type GameState, type Keys, type PowerUp,
} from "./engine/types";

const SCENES = [["showcase", "Showcase (static)"], ["live", "Live: World 1-1"], ["boss", "Live: Rockjaw"]] as const;
type SceneId = typeof SCENES[number][0];
type Runtime = { state: GameState; scene: SceneId; paused: boolean; frame: number; hideEnemies: boolean; renderMs: number[] };
const NO_KEYS: Keys = { up: false, down: false, left: false, right: false, strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false };

/** mulberry32 — small deterministic PRNG so live scenes replay identically. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bullet(id: number, x: number, y: number, isPlayer: boolean, variant?: Bullet["variant"]): Bullet {
  return { id, x, y, vx: 0, vy: isPlayer ? -8 : 3, width: isPlayer ? 4 : 6, height: isPlayer ? 12 : 8, damage: 1, isPlayer, piercing: false, variant };
}

function showcaseState(world: number): GameState {
  const state = createGameState(1, 1);
  state.currentWorld = world;
  state.screen = GameScreen.PLAYING;
  state.briefingTimer = 0;
  state.waveDelay = 9999;
  state.player.x = CANVAS_WIDTH / 2 - state.player.width / 2;
  state.player.y = 560;
  state.player.weaponLevel = 3;
  // Every enemy type on a grid; large types on the second row, small on the third.
  const types = Object.values(EnemyType);
  const enemies = types.map((type, i) => {
    const col = i % 5, row = Math.floor(i / 5);
    const def = ENEMY_DEFS[type];
    const e = createEnemy(type, 40 + col * 88 + (48 - def.width) / 2, 70 + row * 96 + (48 - def.height) / 2);
    e.vx = 0; e.vy = 0;
    e.cloaked = false;
    if (i % 3 === 1 && e.maxHp > 1) e.hp = Math.max(1, Math.floor(e.maxHp / 2));
    if (type === EnemyType.CLOAKER) e.cloaked = true;
    if (type === EnemyType.ELITE) { e.lastHitAffinity = "effective"; e.lastHitTimer = 100; }
    return e;
  });
  state.enemies = enemies;
  state.playerBullets = [0, 1, 2, 3, 4].map((i) => ({ ...bullet(i + 1, 120 + i * 60, 420 - i * 18, true), vx: (i - 2) * 1.5 }));
  state.enemyBullets = (["orb", "bolt", "fire", "acid"] as const).map((v, i) => ({ ...bullet(100 + i, 110 + i * 80, 360, false, v), vx: (i - 1.5) * 1.2, vy: 3 }));
  state.explosions = [0, 1, 2, 3, 4, 5, 6].map((frame, i) => ({ ...createSpriteExplosion(50 + i * 62, 480, 56 + (i % 3) * 12), frame }));
  let particles = [...createExplosion(120, 640, 12, "#ff8844"), ...createSparks(120, 640, 6, "#ffcc44"), ...createSparks(360, 640, 4, "#4488ff")];
  for (let i = 0; i < 6; i++) particles = updateParticles(particles);
  state.particles = particles;
  const puTypes = Object.values(PowerUpType).slice(0, 6);
  state.powerUps = puTypes.map((type, i): PowerUp => ({ id: i + 1, type, x: 60 + i * 64, y: 300, width: 28, height: 28, vy: 0 }));
  state.activePowerUps = [];
  return state;
}

function liveState(scene: SceneId): GameState {
  const state = createGameState(1, scene === "boss" ? 5 : 1);
  state.screen = GameScreen.PLAYING;
  state.briefingTimer = 0;
  state.waveDelay = 20;
  state.devInvincible = true;
  state.player.weaponLevel = 3;
  if (scene === "boss") {
    state.boss = createBossForWorld(1);
    state.screen = GameScreen.BOSS_FIGHT;
  }
  return state;
}

function makeRuntime(scene: SceneId, world: number): Runtime {
  return { state: scene === "showcase" ? showcaseState(world) : liveState(scene), scene, paused: false, frame: 0, hideEnemies: false, renderMs: [] };
}

/** Scripted pilot: always firing, weaving left/right on a slow sine. */
function scriptedKeys(frame: number): Keys {
  const weave = Math.sin(frame / 45);
  return { ...NO_KEYS, shoot: true, left: weave < -0.35, right: weave > 0.35, up: frame % 400 < 60, down: frame % 400 >= 200 && frame % 400 < 240 };
}

export default function FighterPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null), gradeRef = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const gradeOn = useRef(true);
  const [scene, setScene] = useState<SceneId>("showcase"), [revision, setRevision] = useState(0), [world, setWorld] = useState(1);
  const [paused, setPaused] = useState(false), [graded, setGraded] = useState(true);
  const [status, setStatus] = useState("Loading art…"), [snapshot, setSnapshot] = useState("{}");

  useEffect(() => {
    const canvas = canvasRef.current, overlay = gradeRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !overlay || !ctx) return;
    const originalRandom = Math.random;
    Math.random = seeded(scene === "boss" ? 7 : 3);
    const rt = makeRuntime(scene, world); runtime.current = rt;
    setPaused(false);
    const grade = createGradePass(overlay); grade.setEnabled(gradeOn.current);
    let active = true, frameId = 0, reportAt = -Infinity;
    void preloadAll().then(() => { if (active) setStatus("Art loaded"); });

    const stepOnce = () => {
      const keys = scriptedKeys(rt.frame);
      if (rt.scene === "showcase") {
        rt.state.background = updateBackground(rt.state.background);
        rt.state.frameCount++;
      } else {
        rt.state.audioEvents.length = 0;
        rt.state = updateGame(rt.state, keys, null, null);
        // Keep the inspection alive across level/boss completion.
        if (rt.state.screen !== GameScreen.PLAYING && rt.state.screen !== GameScreen.BOSS_FIGHT) {
          rt.state.screen = rt.state.boss && !rt.state.boss.defeated ? GameScreen.BOSS_FIGHT : GameScreen.PLAYING;
        }
      }
      rt.frame++;
    };
    const render = () => {
      const state = rt.hideEnemies ? { ...rt.state, enemies: [], boss: null } : rt.state;
      const t0 = performance.now();
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawGame(ctx, state);
      const dt = performance.now() - t0;
      rt.renderMs.push(dt); if (rt.renderMs.length > 120) rt.renderMs.shift();
      grade.present(canvas, selectPreset("shooter"));
    };
    const step = (n: number) => { for (let i = 0; i < n; i++) stepOnce(); render(); publish(); };
    const publish = () => {
      const sorted = [...rt.renderMs].sort((a, b) => a - b);
      const pct = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
      setSnapshot(JSON.stringify({
        scene: rt.scene, world: rt.state.currentWorld, frame: rt.frame, paused: rt.paused, graded: gradeOn.current, loaded: isLoaded(),
        screen: rt.state.screen, enemies: rt.state.enemies.map((e) => ({ type: e.type, x: e.x, y: e.y, w: e.width, h: e.height, hp: e.hp, cloaked: e.cloaked })),
        boss: rt.state.boss ? { x: rt.state.boss.x, y: rt.state.boss.y, w: rt.state.boss.width, h: rt.state.boss.height, hp: rt.state.boss.hp } : null,
        playerBullets: rt.state.playerBullets.length, enemyBullets: rt.state.enemyBullets.length, particles: rt.state.particles.length, explosions: rt.state.explosions.length,
        scrollY: rt.state.background.map((l) => Math.round(l.scrollY)), render: { p50: Number(pct(0.5).toFixed(2)), p95: Number(pct(0.95).toFixed(2)) },
      }, null, 2));
    };
    const api = {
      step, setGrade: (on: boolean) => { gradeOn.current = on; grade.setEnabled(on); setGraded(on); render(); },
      hideEnemies: (hide: boolean) => { rt.hideEnemies = hide; render(); },
      pause: (p: boolean) => { rt.paused = p; setPaused(p); },
    };
    Object.assign(window, { __fighterPreview: api });

    const frame = () => {
      if (!active) return;
      if (!rt.paused) { stepOnce(); render(); }
      if (performance.now() - reportAt >= 250) { publish(); reportAt = performance.now(); }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => {
      active = false; cancelAnimationFrame(frameId); grade.dispose(); runtime.current = null;
      Math.random = originalRandom;
      delete (window as unknown as { __fighterPreview?: unknown }).__fighterPreview;
    };
  }, [scene, revision, world]);

  const api = () => (window as unknown as { __fighterPreview?: { step: (n: number) => void; setGrade: (b: boolean) => void; pause: (b: boolean) => void; hideEnemies: (b: boolean) => void } }).__fighterPreview;

  return <main className="fighter">
    <header><a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`}>SECTOR ZERO</a><span>FIELD TEST / FIGHTER</span><a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/graphics-preview/`}>First-person inspection</a></header>
    <div className="layout">
      <section aria-label="Fighter presentation inspection"><div className="canvas-wrap" data-testid="fighter-frame">
        <canvas ref={canvasRef} data-testid="fighter-canvas" width={480} height={854} aria-label="Fighter battle scene" />
        <canvas ref={gradeRef} width={480} height={854} aria-hidden="true" className="grade" />
      </div></section>
      <aside><p className="eyebrow">TOP-DOWN FIGHTER SCENES</p><h1>Fighter inspection</h1><p className="lead">Real renderer and game rules, seeded random, no save access.</p>
        <label>Scene<select aria-label="Scene" value={scene} onChange={(event) => setScene(event.target.value as SceneId)}>{SCENES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>Backdrop world (showcase)<select aria-label="World" value={world} onChange={(event) => setWorld(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8].map((w) => <option key={w} value={w}>World {w}</option>)}</select></label>
        <div className="buttons">
          <button onClick={() => setRevision((n) => n + 1)}>Reset scene</button>
          <button aria-pressed={paused} onClick={() => api()?.pause(!paused)}>{paused ? "Resume" : "Pause"}</button>
          <button onClick={() => api()?.step(1)}>Step 1 frame</button>
          <button onClick={() => api()?.step(300)}>Step 300 frames</button>
          <button aria-pressed={graded} onClick={() => api()?.setGrade(!graded)}>{graded ? "Grade on — show raw" : "Grade off — show graded"}</button>
        </div>
        <p className="controls">{status}</p>
        <details open><summary>State snapshot</summary><pre data-testid="fighter-state">{snapshot}</pre></details>
      </aside>
    </div>
    <style jsx>{`
      .fighter{min-height:100vh;background:radial-gradient(ellipse at 25% 40%,#161c2a,#07090e 65%);color:#c9d3e0;padding:24px 36px;font-family:var(--font-space-mono),monospace}header{max-width:1100px;margin:auto auto 25px;display:flex;justify-content:space-between;gap:15px;border-bottom:1px solid #2b3545;padding-bottom:17px;font-size:10px;letter-spacing:.12em}header a{color:#9fc3e6;text-decoration:none}header span{color:#6d7f94}.layout{max-width:1020px;margin:auto;display:grid;grid-template-columns:480px minmax(300px,420px);gap:48px;align-items:start;justify-content:center}.canvas-wrap{position:relative;width:480px;height:854px;box-shadow:0 0 0 1px #2d3a4c,0 20px 65px #0008}.canvas-wrap canvas{display:block;width:480px;height:854px;outline:none}.grade{position:absolute;inset:0;pointer-events:none}.eyebrow{font-size:10px;letter-spacing:.18em;color:#5aa4d8;margin:4px 0 10px}h1{font:700 34px/1.1 Arial,sans-serif;color:#e3ecf5;letter-spacing:-.035em;margin:0 0 10px}.lead{font-size:12px;color:#8696a8;margin:0 0 24px}label{display:block;font-size:10px;color:#93a3b6;margin:14px 0 7px}select{display:block;width:100%;margin-top:7px;background:#0f141b;color:#cfd9e4;border:1px solid #32435a;border-radius:3px;padding:10px;font:11px var(--font-space-mono),monospace}button{background:#121920;border:1px solid #32435a;border-radius:3px;color:#c4d2df;cursor:pointer;padding:10px 8px;font:10px var(--font-space-mono),monospace}button:hover,button[aria-pressed=true]{background:#1d2a3a;border-color:#5a86b0}.buttons{display:grid;gap:7px;grid-template-columns:1fr 1fr;margin:8px 0}.controls{font-size:10px;line-height:2;color:#8696a8;margin-top:12px}details{font-size:10px;color:#93a3b6;margin-top:15px}summary{cursor:pointer}pre{max-height:360px;overflow:auto;background:#090d12;padding:12px;color:#a8b5c2;font-size:9px;line-height:1.5}
    `}</style>
  </main>;
}
