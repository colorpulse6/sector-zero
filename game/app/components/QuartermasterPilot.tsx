"use client";

import { useEffect, useRef, useState } from "react";
import { createHydrationSafeSave } from "./engine/save";
import { applyColonyFixture, findFixture } from "./colony/dev/seedColony";
import { enterColonyExploration } from "./colony/exploration";
import { stepColonyNpcs } from "./colony/exploration/npc/npcStep";
import type { SceneStack } from "./colony/exploration/sceneStack";
import { createGameState } from "./engine/gameEngine";
import { updateFirstPerson } from "./engine/firstPersonEngine";
import { drawFirstPerson } from "./engine/firstPersonRenderer";
import { GameScreen, type GameState, type Keys, type SaveData } from "./engine/types";
import { preloadAll } from "./engine/sprites";
import { preloadQuartermasterAssets } from "./engine/fpRender/npcAtlas";
import { getPerfStats } from "./engine/fpRender";
import { createGradePass } from "./engine/postFx";
import { selectPreset } from "./engine/postFx/presets";
import { tintForHour } from "./colony/exploration/dayNightTint";
import { applyShopPurchase } from "./engine/consumables";
import { drainShopPurchaseRequest, setShopPurchaseFeedback, shopPurchaseFeedback } from "./engine/shopServices";

type PilotRuntime = { state: GameState; stack: SceneStack; save: SaveData; paused: boolean };
const VIEWS = [["Front", 0], ["Right side", Math.PI / 2], ["Back", Math.PI], ["Left side", Math.PI * 1.5]] as const;
const LABELS = { idle: "Idle", walk: "Walking", work: "Checking inventory" };

/** A self-contained local fixture: this component never hydrates or persists
 * the player's save. Rendering and motion use the same paths as colony play. */
export default function QuartermasterPilot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gradeRef = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<PilotRuntime | null>(null);
  const held = useRef(new Set<string>());
  const [assets, setAssets] = useState("Loading assets…");
  const [paused, setPaused] = useState(false);
  const [night, setNight] = useState(false);
  const [action, setAction] = useState("Idle");
  const [renderMs, setRenderMs] = useState("—");

  function view(angle: number, distance = 0.9) {
    const fp = runtime.current?.state.firstPersonState;
    const npc = fp?.npcs.find(n => n.atlasAnimation);
    if (!fp || !npc) return;
    const heading = (npc.atlasAnimation?.facingAngle ?? Math.PI / 2) + angle;
    // Inspect inside the one-tile workstation offset, so the console cannot
    // obscure the actor when viewing the side that faces it.
    for (const radius of [distance, distance - 0.1, distance - 0.2]) {
      const x = npc.x + Math.cos(heading) * radius, y = npc.y + Math.sin(heading) * radius;
      const cell = fp.map.tiles[Math.floor(y)]?.[Math.floor(x)];
      if (cell !== "floor" && cell !== "door") continue;
      fp.posX = x; fp.posY = y;
      fp.dirX = -Math.cos(heading); fp.dirY = -Math.sin(heading);
      fp.planeX = -fp.dirY * 0.66; fp.planeY = fp.dirX * 0.66;
      fp.weaponMotion = undefined;
      break;
    }
    canvasRef.current?.focus();
  }

  useEffect(() => {
    const canvas = canvasRef.current, overlay = gradeRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !overlay || !ctx) return;
    const fixture = findFixture("day")!;
    const seeded = applyColonyFixture(createHydrationSafeSave(), { ...fixture, playerCredits: 300 });
    const entry = enterColonyExploration(seeded.save, seeded.colonyId);
    const state = createGameState(1, 1);
    state.screen = GameScreen.PLAYING;
    state.currentMode = "colony-exploration";
    state.firstPersonState = entry.firstPersonState;
    state.firstPersonState.missionLabel = "ASHFALL · SUPPLY STATION";
    runtime.current = { state, stack: entry.sceneStack, save: seeded.save, paused: false };
    view(0, 2); // Leave room to watch the whole routine on first arrival.
    const grade = createGradePass(overlay);
    grade.setEnabled(true);
    let active = true, frameId = 0, last = 0, reportAt = 0;
    void Promise.all([preloadAll(), preloadQuartermasterAssets()]).then(([, ready]) => {
      if (active) setAssets(ready ? "Animation assets ready" : "Original art fallback");
    });
    const keyDown = (event: KeyboardEvent) => {
      if (document.activeElement !== canvas) return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "q", "e", "z", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
        event.preventDefault(); held.current.add(key);
      }
    };
    const keyUp = (event: KeyboardEvent) => held.current.delete(event.key.toLowerCase());
    const release = () => held.current.clear();
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", release);
    canvas.addEventListener("blur", release);
    const frame = (now: number) => {
      const rt = runtime.current;
      if (!active || !rt) return;
      const dt = last ? Math.min(50, now - last) : 16.67;
      last = now;
      const down = (key: string) => held.current.has(key);
      const keys: Keys = {
        up: down("w") || down("arrowup"), down: down("s") || down("arrowdown"),
        left: down("q") || down("arrowleft"), right: down("e") || down("arrowright"),
        strafeLeft: down("a"), strafeRight: down("d"), shoot: down("z"), bomb: false, jump: false,
      };
      const fp = state.firstPersonState!;
      state.audioEvents.length = 0;
      updateFirstPerson(state, keys, dt);
      // The preview never performs door/pad navigation. Actual colony tests
      // cover those boundaries; the fixture is devoted to this one station.
      fp.colonyTransitionRequest = undefined;
      if (!rt.paused && rt.stack.current.npcSidecar) {
        stepColonyNpcs(rt.stack.current.npcSidecar, fp.npcs, fp.map, dt, !!fp.dialogState?.active);
      }
      const request = drainShopPurchaseRequest(fp);
      if (request && fp.dialogState) {
        const updated = applyShopPurchase(rt.save, request);
        if (updated) rt.save = updated;
        setShopPurchaseFeedback(fp.dialogState, shopPurchaseFeedback(request, !!updated));
      }
      state.frameCount++;
      ctx.clearRect(0, 0, 480, 854);
      drawFirstPerson(ctx, state);
      grade.present(canvas, selectPreset("colony-exploration"));
      if (now - reportAt > 150) {
        const animation = fp.npcs.find(n => n.atlasAnimation)?.atlasAnimation;
        setAction(fp.dialogState?.active ? "Conversation" : LABELS[animation?.action ?? "idle"]);
        setRenderMs(getPerfStats().p50.toFixed(1));
        reportAt = now;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => {
      active = false; cancelAnimationFrame(frameId); grade.dispose(); release();
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", release); canvas.removeEventListener("blur", release);
      runtime.current = null;
    };
  }, []);

  function pause() {
    const next = !paused;
    setPaused(next);
    if (runtime.current) runtime.current.paused = next;
  }
  function lighting() {
    const next = !night;
    setNight(next);
    const fp = runtime.current?.state.firstPersonState;
    if (fp?.environmentArt) fp.environmentArt = { ...fp.environmentArt, environmentTint: tintForHour(next ? 22 : 12) };
  }

  return (
    <main className="pilot">
      <header className="pilot-header"><a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`}>SECTOR ZERO</a><span>FIELD TEST / 01</span></header>
      <div className="pilot-layout">
        <section className="pilot-stage" aria-label="Playable quartermaster scene">
          <div className="pilot-canvas">
            <canvas ref={canvasRef} width={480} height={854} tabIndex={0} aria-label="Walk around the quartermaster" onClick={() => canvasRef.current?.focus()} />
            <canvas ref={gradeRef} width={480} height={854} aria-hidden="true" className="pilot-grade" />
          </div>
        </section>
        <aside>
          <p className="pilot-kicker">ASHFALL OUTPOST</p>
          <h1>The quartermaster</h1>
          <p className="pilot-lead">Same world. A little more life.</p>
          <p className="pilot-description">Walk around the supply station. Watch him check inventory, take a short walk, and return to work.</p>
          <div className="pilot-status"><span className="pilot-dot" /><span data-testid="pilot-action">{action}</span><small>{paused ? "PAUSED" : "LIVE"}</small></div>
          <p className="pilot-label">TAKE A CLOSER LOOK</p>
          <div className="pilot-views">{VIEWS.map(([label, angle]) => <button key={label} onClick={() => view(angle)}>{label}</button>)}</div>
          <div className="pilot-options"><button aria-pressed={paused} onClick={pause}>{paused ? "Resume character" : "Pause character"}</button><button aria-pressed={night} onClick={lighting}>{night ? "Day lighting" : "Night lighting"}</button></div>
          <div className="pilot-controls"><p><kbd>W A S D</kbd><span>Move & strafe</span></p><p><kbd>← →</kbd><span>Turn</span></p><p><kbd>Z</kbd><span>Talk / advance</span></p></div>
          <div className="pilot-touch">{[["←", "arrowleft", "Turn left"], ["↑", "w", "Walk forward"], ["↓", "s", "Walk backward"], ["→", "arrowright", "Turn right"]].map(([text, key, label]) => <button key={key} aria-label={label} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); held.current.add(key); }} onPointerUp={() => held.current.delete(key)} onPointerCancel={() => held.current.delete(key)} onLostPointerCapture={() => held.current.delete(key)}>{text}</button>)}</div>
          <footer><p>{assets}</p><p>{renderMs} ms median scene render · local preview</p><p>Your campaign save is unchanged.</p></footer>
        </aside>
      </div>
      <style jsx>{`
        .pilot{min-height:100vh;background:radial-gradient(ellipse at 25% 45%,#24201b 0,#0b0d10 58%);color:#d2cec4;padding:24px 40px;font-family:var(--font-space-mono),monospace}
        .pilot-header{max-width:1080px;margin:0 auto 25px;display:flex;justify-content:space-between;border-bottom:1px solid #34312b;padding-bottom:17px;font-size:11px;letter-spacing:.17em;color:#827c71}.pilot-header a{color:#d0c8b9;text-decoration:none}
        .pilot-layout{max-width:980px;margin:auto;display:grid;grid-template-columns:minmax(300px,460px) minmax(270px,370px);gap:68px;align-items:center;justify-content:center}.pilot-stage{display:flex;justify-content:center}.pilot-canvas{position:relative;box-shadow:0 0 0 1px #403a30,0 24px 75px #0009;width:min(100%,calc(78vh * 480 / 854))}.pilot-canvas canvas{display:block;width:100%;height:auto;outline:none}.pilot-canvas canvas:focus-visible{outline:1px solid #ba8c4d;outline-offset:4px}.pilot-grade{position:absolute;inset:0;pointer-events:none}
        .pilot-kicker{font-size:11px;letter-spacing:.22em;color:#b18851;margin-bottom:14px}h1{font-family:Arial,sans-serif;font-size:42px;line-height:1.06;letter-spacing:-.035em;font-weight:700;color:#e2dcd0;margin:0 0 14px}.pilot-lead{font-size:13px;color:#b9b0a0;margin-bottom:22px}.pilot-description{font-size:12px;line-height:1.85;color:#918c83;max-width:330px}.pilot-status{display:flex;gap:10px;align-items:center;border-top:1px solid #38332c;border-bottom:1px solid #38332c;padding:17px 0;margin:27px 0;color:#d3c2a7;font-size:12px}.pilot-status small{margin-left:auto;color:#71695c;font-size:9px;letter-spacing:.16em}.pilot-dot{width:5px;height:5px;border-radius:50%;background:#bd9a62;box-shadow:0 0 10px #bd9a6266}.pilot-label{font-size:9px;letter-spacing:.16em;color:#8c8375;margin:0 0 12px}
        button{cursor:pointer;background:#191a19;border:1px solid #3d3932;border-radius:2px;color:#c6bdad;padding:11px 9px;font-family:inherit;font-size:10px;transition:background .15s,border-color .15s}button:hover,button[aria-pressed=true]{background:#30291f;border-color:#8b7047}button:focus-visible{outline:2px solid #c69a57;outline-offset:3px}.pilot-views{display:grid;grid-template-columns:1fr 1fr;gap:7px}.pilot-options{display:flex;gap:7px;margin-top:9px}.pilot-options button{flex:1;color:#989083}.pilot-controls{border-top:1px solid #302e29;margin-top:27px;padding-top:13px;font-size:10px;color:#877f72}.pilot-controls p{display:flex;align-items:center;gap:20px;margin:9px 0}.pilot-controls kbd{min-width:80px;color:#c5b9a4;font-family:inherit}.pilot-touch{display:flex;gap:8px;margin-top:15px}.pilot-touch button{min-width:45px;font-size:16px;touch-action:none}footer{margin-top:27px;color:#665f54;font-size:9px;line-height:1.7}footer p:first-child{color:#a1927a}
        @media(max-width:750px){.pilot{padding:18px}.pilot-layout{grid-template-columns:1fr;gap:30px}.pilot-canvas{width:min(100%,340px)}aside{max-width:400px;margin:auto;width:100%}h1{font-size:35px}.pilot-description{max-width:none}.pilot-header{margin-bottom:20px}}
      `}</style>
    </main>
  );
}
