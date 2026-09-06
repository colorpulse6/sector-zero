"use client";

import { useEffect, useRef, useState } from "react";
import { createHydrationSafeSave } from "./engine/save";
import { applyColonyFixture, findFixture } from "./colony/dev/seedColony";
import { enterColonyExploration } from "./colony/exploration";
import { generateInteriorState } from "./colony/exploration/colonyLayout";
import { stepColonyNpcs } from "./colony/exploration/npc/npcStep";
import type { ColonyNpc } from "./colony/exploration/npc/types";
import type { BuildingType } from "./colony/shared/colonyTypes";
import { createGameState, updateGame } from "./engine/gameEngine";
import { createAshfallForwardCampState } from "./engine/ashfallForwardCamp";
import { createKeplerBlackBoxFirstPersonState } from "./engine/keplerBlackBoxMission";
import { createFirstPersonRuinTemplate } from "./colony/region/poiTemplates";
import { updateFirstPerson } from "./engine/firstPersonEngine";
import { initializeActorPresentation } from "./engine/actorPresentation";
import { ACTOR_CATALOG, retainedActorSpritePaths, syncActorAssets } from "./engine/actorAssets";
import { drawFirstPerson } from "./engine/firstPersonRenderer";
import { GameScreen, type GameState, type Keys, type SaveData, type FirstPersonState } from "./engine/types";
import { getSprite, preloadAll } from "./engine/sprites";
import { getPerfStats, getActorFrameStats, releaseFirstPersonGraphics, setResolutionMode, type ResMode } from "./engine/fpRender";
import { createGradePass } from "./engine/postFx";
import { selectPreset } from "./engine/postFx/presets";
import { tintForHour } from "./colony/exploration/dayNightTint";
import { applyShopPurchase } from "./engine/consumables";
import { drainShopPurchaseRequest, setShopPurchaseFeedback, shopPurchaseFeedback } from "./engine/shopServices";

const SCENES = [
  ["ashfall", "Ashfall camp"], ["colony", "Colony exterior"],
  ["solar_array", "Solar room"], ["farm", "Farm room"], ["water_purifier", "Purifier room"],
  ["habitat_module", "Habitat room"], ["mine", "Mine room"], ["cantina", "Cantina"],
  ["station", "Station combat"], ["kepler", "Kepler ruins"], ["cinder", "Cinder ruins"],
] as const;
type SceneId = typeof SCENES[number][0];
type Runtime = { state: GameState; save: SaveData; sidecar?: ColonyNpc[]; paused: boolean };
const NO_KEYS: Keys = { up: false, down: false, left: false, right: false, strafeLeft: false, strafeRight: false, shoot: false, bomb: false, jump: false };
const VIEWS = [["Front", 0], ["Right side", Math.PI / 2], ["Back", Math.PI], ["Left side", Math.PI * 1.5]] as const;
const round = (n: number) => Number(n.toFixed(4));
const clipBytes = new Map(Object.values(ACTOR_CATALOG).flatMap(set => Object.values(set.clips).map(clip => [clip.path, clip.columns * clip.rows * set.width * set.height * 4] as const)));

function makeRuntime(scene: SceneId): Runtime {
  const fixture = findFixture(scene === "cantina" ? "cantina" : "grown")!;
  const seeded = applyColonyFixture({ ...createHydrationSafeSave(), completedPlanets: ["verdania"] }, { ...fixture, playerCredits: 300 });
  const colony = seeded.save.colonies.find(c => c.id === seeded.colonyId)!;
  let state = createGameState(1, 1), fp: FirstPersonState, sidecar: ColonyNpc[] | undefined;
  if (scene === "ashfall") fp = createAshfallForwardCampState();
  else if (scene === "colony") {
    const entry = enterColonyExploration(seeded.save, seeded.colonyId);
    fp = entry.firstPersonState; sidecar = entry.sceneStack.current.npcSidecar;
  } else if (scene === "kepler") fp = createKeplerBlackBoxFirstPersonState(false);
  else if (scene === "cinder") fp = createFirstPersonRuinTemplate(42);
  else if (scene === "station") {
    // Use the actual campaign phase transition, including its boarding-to-FP
    // conversion and environment art, instead of maintaining a parallel map.
    state = createGameState(5, 3); state.screen = GameScreen.PLAYING; state.levelCompleteTimer = 1;
    state = updateGame(state, NO_KEYS, null, null);
    fp = state.firstPersonState!;
  } else {
    const building = colony.buildings.find(b => b.type === scene as BuildingType)!;
    fp = generateInteriorState(building, colony.layoutSeed, seeded.save.gameClock.hour);
  }
  state.screen = GameScreen.PLAYING;
  state.currentMode = fp.colonyContext ? "colony-exploration" : "first-person";
  state.firstPersonState = fp;
  initializeActorPresentation(fp); syncActorAssets(fp);
  return { state, save: seeded.save, sidecar, paused: false };
}
function actors(fp: FirstPersonState) {
  return [...fp.npcs.map(n => ({ id: `npc:${n.id}`, name: n.name, actor: n })), ...fp.enemies.map(e => ({ id: `enemy:${e.id}`, name: `Hostile ${e.id} · ${e.type}`, actor: e }))];
}
function rotate(fp: FirstPersonState, angle: number) {
  const next = Math.atan2(fp.dirY, fp.dirX) + angle;
  fp.dirX = Math.cos(next); fp.dirY = Math.sin(next);
  fp.planeX = -fp.dirY * .66; fp.planeY = fp.dirX * .66;
}

/** An inspection route over real game factories. Its save exists only in memory. */
export default function GraphicsPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null), gradeRef = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<Runtime | null>(null), held = useRef(new Set<string>());
  const [scene, setScene] = useState<SceneId>("ashfall"), [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false), [night, setNight] = useState(false);
  const [actorId, setActorId] = useState(""), [actorOptions, setActorOptions] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState("Loading static art…"), [viewMessage, setViewMessage] = useState("");
  const [stats, setStats] = useState({ p50: 0, p95: 0, res: "full", cells: 0, frameMiB: 0, sourceMiB: 0, loaded: 0, requested: 0 });
  const [snapshot, setSnapshot] = useState("{}");

  function view(angle: number) {
    const fp = runtime.current?.state.firstPersonState;
    const target = fp && actors(fp).find(n => n.id === actorId)?.actor;
    if (!fp || !target) return;
    const heading = (target.atlasAnimation?.facingAngle ?? 0) + angle;
    for (const radius of [1.85, 1.4, 1.1, .9, .7]) {
      const x = target.x + Math.cos(heading) * radius, y = target.y + Math.sin(heading) * radius;
      let clear = true;
      for (let i = 0; i <= 20; i++) {
        const tile = fp.map.tiles[Math.floor(target.y + (y - target.y) * i / 20)]?.[Math.floor(target.x + (x - target.x) * i / 20)];
        if (!tile || tile === "wall" || tile === "empty") { clear = false; break; }
      }
      if (!clear) continue;
      fp.posX = x; fp.posY = y; fp.dirX = -Math.cos(heading); fp.dirY = -Math.sin(heading);
      fp.planeX = -fp.dirY * .66; fp.planeY = fp.dirX * .66; fp.weaponMotion = undefined;
      setViewMessage(""); canvasRef.current?.focus(); return;
    }
    setViewMessage("That side is blocked by the scene geometry.");
  }

  useEffect(() => {
    const canvas = canvasRef.current, overlay = gradeRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !overlay || !ctx) return;
    const rt = makeRuntime(scene); runtime.current = rt;
    setPaused(false); setNight(false); setViewMessage("");
    const entries = actors(rt.state.firstPersonState!);
    setActorOptions(entries.map(({ id, name }) => ({ id, name })));
    setActorId(entries[0]?.id ?? "");
    const grade = createGradePass(overlay); grade.setEnabled(true);
    let active = true, frameId = 0, last = 0, reportAt = -Infinity;
    void preloadAll().then(() => { if (active) setStatus("Static image loading complete"); });
    const keyDown = (event: KeyboardEvent) => {
      if (document.activeElement !== canvas) return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "q", "e", "z", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) { event.preventDefault(); held.current.add(key); }
    };
    const keyUp = (event: KeyboardEvent) => held.current.delete(event.key.toLowerCase());
    const release = () => held.current.clear();
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", release); canvas.addEventListener("blur", release);
    const frame = (now: number) => {
      if (!active) return;
      const dt = last ? Math.min(50, now - last) : 16.67; last = now;
      const fp = rt.state.firstPersonState!, down = (key: string) => held.current.has(key);
      const keys: Keys = { up: down("w") || down("arrowup"), down: down("s") || down("arrowdown"), left: down("q") || down("arrowleft"), right: down("e") || down("arrowright"), strafeLeft: down("a"), strafeRight: down("d"), shoot: down("z"), bomb: false, jump: false };
      rt.state.audioEvents.length = 0;
      if (!rt.paused) {
        updateFirstPerson(rt.state, keys, dt);
        if (rt.sidecar) stepColonyNpcs(rt.sidecar, fp.npcs, fp.map, dt, !!fp.dialogState?.active);
      }
      // Scene selection is explicit in this inspection route. Normal game door
      // and landing-pad transitions are exercised by the gameplay browser suite.
      fp.colonyTransitionRequest = undefined;
      const purchase = drainShopPurchaseRequest(fp);
      if (purchase && fp.dialogState) {
        const updated = applyShopPurchase(rt.save, purchase);
        if (updated) rt.save = updated;
        setShopPurchaseFeedback(fp.dialogState, shopPurchaseFeedback(purchase, !!updated));
      }
      rt.state.frameCount++;
      ctx.clearRect(0, 0, 480, 854); drawFirstPerson(ctx, rt.state);
      grade.present(canvas, selectPreset(rt.state.currentMode));
      if (now - reportAt >= 200) {
        const perf = getPerfStats(), frames = getActorFrameStats(), paths = retainedActorSpritePaths();
        let reservedBytes = 0, residentBytes = 0, loaded = 0;
        for (const path of paths) {
          reservedBytes += clipBytes.get(path) ?? 0;
          const img = getSprite(path); if (img) { loaded++; residentBytes += img.width * img.height * 4; }
        }
        setStats({ p50: perf.p50, p95: perf.p95, res: perf.res, cells: frames.entries, frameMiB: frames.bytes / 1048576, sourceMiB: residentBytes / 1048576, loaded, requested: paths.size });
        setSnapshot(JSON.stringify({ scene, paused: rt.paused, credits: rt.save.credits, dialogue: !!fp.dialogState?.active, shopOpen: !!fp.dialogState?.shopOpen, x: round(fp.posX), y: round(fp.posY), heading: round(Math.atan2(fp.dirY, fp.dirX)), actors: actors(fp).map(({ id, name, actor }) => ({ id, name, set: actor.atlasAnimation?.set, action: actor.atlasAnimation?.action, clock: round(actor.atlasAnimation?.clockMs ?? 0), x: round(actor.x), y: round(actor.y), facing: round(actor.atlasAnimation?.facingAngle ?? 0), distance: round(actor.atlasAnimation?.walkDistance ?? 0) })), sources: { paths: paths.size, loaded, reservedBytes, residentBytes }, frames, render: perf }, null, 2));
        reportAt = now;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => {
      active = false; cancelAnimationFrame(frameId); grade.dispose(); release(); releaseFirstPersonGraphics();
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", release); canvas.removeEventListener("blur", release); runtime.current = null;
    };
  }, [scene, revision]);

  function togglePause() { const rt = runtime.current; if (rt) { rt.paused = !rt.paused; setPaused(rt.paused); held.current.clear(); } }
  function toggleNight() {
    const fp = runtime.current?.state.firstPersonState; setNight(!night);
    if (fp) fp.environmentArt = { ...fp.environmentArt, environmentTint: tintForHour(night ? 12 : 22) };
  }
  function turn() { const fp = runtime.current?.state.firstPersonState; if (fp) rotate(fp, Math.PI / 2); }

  return <main className="graphics">
    <header><a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`}>SECTOR ZERO</a><span>FIELD TEST / 02</span><a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/quartermaster-pilot/`}>Quartermaster pilot</a></header>
    <div className="layout">
      <section aria-label="Playable graphics inspection"><div className="canvas-wrap">
        <canvas ref={canvasRef} data-testid="graphics-canvas" width={480} height={854} tabIndex={0} aria-label="Explore selected scene" onClick={() => canvasRef.current?.focus()} />
        <canvas ref={gradeRef} width={480} height={854} aria-hidden="true" className="grade" />
      </div></section>
      <aside><p className="eyebrow">LIVE FIRST-PERSON SCENES</p><h1>Graphics inspection</h1><p className="lead">Real maps, actors and game rules.</p>
        <label>Scene<select aria-label="Scene" value={scene} onChange={event => setScene(event.target.value as SceneId)}>{SCENES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <div className="buttons"><button onClick={() => setRevision(n => n + 1)}>Reset scene</button><button onClick={turn}>Turn 90°</button></div>
        <label>Actor<select aria-label="Actor" value={actorId} onChange={event => setActorId(event.target.value)} disabled={!actorOptions.length}>{actorOptions.length ? actorOptions.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>) : <option value="">No actors in this room</option>}</select></label>
        <div className="views">{VIEWS.map(([label, angle]) => <button key={label} disabled={!actorId} onClick={() => view(angle)}>{label}</button>)}</div>
        {viewMessage && <p role="status" className="notice">{viewMessage}</p>}
        <div className="buttons"><button aria-pressed={paused} onClick={togglePause}>{paused ? "Resume simulation" : "Pause simulation"}</button><button aria-pressed={night} onClick={toggleNight}>{night ? "Day lighting" : "Night lighting"}</button></div>
        <p className="controls"><kbd>W A S D</kbd> Move & strafe · <kbd>← →</kbd> Turn<br /><kbd>Z</kbd> Fire / talk / advance / buy</p>
        <div className="touch">{[["↶", "q", "Turn left"], ["↑", "w", "Walk forward"], ["↓", "s", "Walk backward"], ["↷", "e", "Turn right"], ["Z", "z", "Fire or interact"]].map(([label, key, title]) => <button key={key} aria-label={title} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); canvasRef.current?.focus(); held.current.add(key); }} onPointerUp={() => held.current.delete(key)} onPointerCancel={() => held.current.delete(key)} onLostPointerCapture={() => held.current.delete(key)}>{label}</button>)}</div>
        <div className="diagnostics"><p>{status} · Actors {stats.loaded}/{stats.requested} source images</p><p>{stats.p50.toFixed(1)} ms median / {stats.p95.toFixed(1)} ms p95 · {stats.res} resolution</p><p>{stats.cells} cells · {stats.frameMiB.toFixed(1)} / 40 MiB frames</p><p>{stats.sourceMiB.toFixed(1)} / 80 MiB actor sources</p><label>Render resolution<select aria-label="Render resolution" defaultValue="auto" onChange={event => setResolutionMode(event.target.value as ResMode)}><option value="auto">Auto</option><option value="full">Full</option><option value="half">Half</option></select></label></div>
        <details><summary>State snapshot</summary><pre data-testid="graphics-state">{snapshot}</pre></details><p className="footnote">Purchases use an in-memory fixture. Your campaign save is unchanged.</p>
      </aside>
    </div>
    <style jsx>{`
      .graphics{min-height:100vh;background:radial-gradient(ellipse at 25% 40%,#28221b,#0b0e11 65%);color:#d5cdbf;padding:24px 36px;font-family:var(--font-space-mono),monospace}header{max-width:1100px;margin:auto auto 25px;display:flex;justify-content:space-between;gap:15px;border-bottom:1px solid #3b352c;padding-bottom:17px;font-size:10px;letter-spacing:.12em}header a{color:#c6b99f;text-decoration:none}header span{color:#8e806c}.layout{max-width:1020px;margin:auto;display:grid;grid-template-columns:minmax(300px,460px) minmax(300px,420px);gap:55px;align-items:start;justify-content:center}.canvas-wrap{position:relative;width:min(100%,calc(82vh * 480 / 854));margin:auto;box-shadow:0 0 0 1px #453b2d,0 20px 65px #0008}.canvas-wrap canvas{display:block;width:100%;height:auto;outline:none}.canvas-wrap canvas:focus-visible{outline:2px solid #b89560;outline-offset:4px}.grade{position:absolute;inset:0;pointer-events:none}.eyebrow{font-size:10px;letter-spacing:.18em;color:#ae8b58;margin:4px 0 10px}h1{font:700 34px/1.1 Arial,sans-serif;color:#e2dacb;letter-spacing:-.035em;margin:0 0 10px}.lead{font-size:12px;color:#9f9483;margin:0 0 24px}label{display:block;font-size:10px;color:#a99c86;margin:14px 0 7px}select{display:block;width:100%;margin-top:7px;background:#161a1b;color:#d1c7b6;border:1px solid #4d4232;border-radius:3px;padding:10px;font:11px var(--font-space-mono),monospace}button{background:#191b1b;border:1px solid #494032;border-radius:3px;color:#cabcaa;cursor:pointer;padding:10px 8px;font:10px var(--font-space-mono),monospace}button:hover,button[aria-pressed=true]{background:#322a20;border-color:#94754a}button:disabled{opacity:.4;cursor:default}button:focus-visible,select:focus-visible{outline:2px solid #c79e60;outline-offset:2px}.buttons,.views{display:grid;gap:7px;grid-template-columns:1fr 1fr;margin:8px 0}.views{grid-template-columns:repeat(4,1fr)}.controls{font-size:10px;line-height:2;color:#a59984;margin-top:20px}.controls kbd{color:#dbcbb1}.touch{display:flex;gap:7px}.touch button{min-width:46px;font-size:15px;touch-action:none}.notice{font-size:10px;color:#c09969}.diagnostics{margin-top:20px;border-top:1px solid #383126;padding-top:10px;font-size:10px;line-height:1.6;color:#8c806d}.diagnostics p{margin:5px 0}.diagnostics label{display:flex;gap:15px;align-items:center}.diagnostics select{width:auto;margin:0}details{font-size:10px;color:#a7977e;margin-top:15px}summary{cursor:pointer}pre{max-height:260px;overflow:auto;background:#090d10;padding:12px;color:#a8b5b2;font-size:9px;line-height:1.5}.footnote{font-size:9px;color:#6e6558;line-height:1.7;margin-top:20px}@media(max-width:780px){.graphics{padding:18px}.layout{grid-template-columns:1fr;gap:30px}.canvas-wrap{width:min(100%,350px)}aside{width:100%;max-width:430px;margin:auto}header{font-size:9px;flex-wrap:wrap}h1{font-size:30px}}
    `}</style>
  </main>;
}
