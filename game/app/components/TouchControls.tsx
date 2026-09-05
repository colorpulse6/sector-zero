"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { CANVAS_WIDTH, CANVAS_HEIGHT, GAME_AREA_HEIGHT, type GameMode } from "./engine/types";
import type { InputIntent } from "./engine/inputIntents";
export { getTouchControlHint } from "./engine/inputIntents";

export const TOUCH_CONTROLS_FOOTER_HEIGHT = "calc(164px + max(12px, env(safe-area-inset-bottom)))";
export const TOUCH_GAMEPLAY_CANVAS_MAX_HEIGHT = `calc(100dvh - ${TOUCH_CONTROLS_FOOTER_HEIGHT})`;
export const TOUCH_GAMEPLAY_CANVAS_WIDTH = `min(${CANVAS_WIDTH}px, 100vw, calc(${TOUCH_GAMEPLAY_CANVAS_MAX_HEIGHT} * ${CANVAS_WIDTH / CANVAS_HEIGHT}))`;

export interface TouchControlsProps {
  mode: GameMode;
  onPress: (sourceId: string, intent: InputIntent) => void;
  onRelease: (sourceId: string) => void;
  onAim: (position: { x: number; y: number } | null, held: boolean) => void;
}

type Control = { label: string; text: string; intents: InputIntent[] };
type Position = { x: number; y: number };
type Owner = { control: Control | null; sources: string[] };
type PointerOwner = Owner & {
  target: HTMLElement;
  pad: HTMLElement | null;
  aim: Position | null;
};
type KeyOwner = Owner & { key: string };

const control = (label: string, text: string, ...intents: InputIntent[]): Control => ({ label, text, intents });
const FIRE = control("Fire", "FIRE", "primary");
const BOMB = control("Bomb", "BOMB", "secondary");
const JUMP = control("Jump", "JUMP", "jump");
const DASH = control("Dash", "DASH", "dash");
const LOOK_LEFT = control("Look left", "LOOK ◀", "turn-left");
const LOOK_RIGHT = control("Look right", "LOOK ▶", "turn-right");
const FIRST_PERSON_ACTION = control("Fire / interact", "FIRE / INTERACT", "primary");
const COLONY_ACTION = control("Interact", "INTERACT", "primary");
const TURRET_AIM_KEYS: Readonly<Partial<Record<string, Control>>> = {
  ArrowLeft: control("Aim turret", "", "move-left"),
  ArrowRight: control("Aim turret", "", "move-right"),
  ArrowUp: control("Aim turret", "", "move-up"),
  ArrowDown: control("Aim turret", "", "move-down"),
};

const MOVEMENT_PAD: (Control | null)[] = [
  control("Move up left", "↖", "move-up", "move-left"),
  control("Move up", "↑", "move-up"),
  control("Move up right", "↗", "move-up", "move-right"),
  control("Move left", "←", "move-left"), null,
  control("Move right", "→", "move-right"),
  control("Move down left", "↙", "move-down", "move-left"),
  control("Move down", "↓", "move-down"),
  control("Move down right", "↘", "move-down", "move-right"),
];
const GROUND_PAD: (Control | null)[] = [
  null, control("Aim up", "AIM ↑", "move-up"), null,
  control("Move left", "←", "move-left"), null, control("Move right", "→", "move-right"),
  null, control("Aim down", "AIM ↓", "move-down"), null,
];
const FIRST_PERSON_PAD: (Control | null)[] = [
  null, control("Move forward", "↑", "move-up"), null,
  control("Strafe left", "←", "strafe-left"), null, control("Strafe right", "→", "strafe-right"),
  null, control("Move backward", "↓", "move-down"), null,
];

const PROFILE_NAMES: Record<GameMode, string> = {
  shooter: "Shooter", "base-defense": "Shooter", "mech-duel": "Shooter",
  "ground-run": "Ground", boarding: "Boarding", "first-person": "First-person",
  "colony-exploration": "Colony", turret: "Turret",
};

const BUTTON_STYLE: CSSProperties = {
  minWidth: 44, minHeight: 44, padding: 4,
  borderWidth: 1, borderStyle: "solid", borderColor: "#57dfe77a",
  borderRadius: 8, color: "#c5fcff", background: "#03151bd9",
  touchAction: "none", pointerEvents: "auto", userSelect: "none",
  WebkitUserSelect: "none", font: "inherit", fontSize: 10, fontWeight: 700,
  cursor: "pointer", lineHeight: 1.2,
};
const LABEL_STYLE: CSSProperties = { color: "#91d8df", fontSize: 9, letterSpacing: 1.5, marginBottom: 6 };

function releaseCapture(owner: PointerOwner, pointerId: number) {
  if (owner.target.hasPointerCapture(pointerId)) owner.target.releasePointerCapture(pointerId);
}

export default function TouchControls({ mode, onPress, onRelease, onAim }: TouchControlsProps) {
  const callbacks = useRef({ onPress, onRelease, onAim });
  callbacks.current = { onPress, onRelease, onAim };
  const pointers = useRef(new Map<number, PointerOwner>());
  const keys = useRef(new Map<string, KeyOwner>());
  const clicks = useRef(new Map<string, Owner & { timer: ReturnType<typeof setTimeout> }>());
  const suppressClicksUntil = useRef(new Map<string, number>());
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const firstPerson = mode === "first-person" || mode === "colony-exploration";
  const cells = mode === "ground-run" ? GROUND_PAD : firstPerson ? FIRST_PERSON_PAD : MOVEMENT_PAD;

  const updatePressed = useCallback(() => {
    const labels = new Set<string>();
    for (const owner of [...pointers.current.values(), ...keys.current.values(), ...clicks.current.values()]) {
      if (owner.control) labels.add(owner.control.label);
      if ("aim" in owner && owner.aim) labels.add("Aim turret");
    }
    setPressed(labels);
  }, []);

  const releaseSources = useCallback((owner: Owner) => {
    for (const source of owner.sources) callbacks.current.onRelease(source);
    owner.sources = [];
  }, []);

  const setControl = useCallback((owner: Owner, next: Control | null, prefix: string) => {
    if (owner.control === next) return;
    releaseSources(owner);
    owner.control = next;
    owner.sources = next?.intents.map((intent) => `${prefix}:${intent}`) ?? [];
    next?.intents.forEach((intent, index) => callbacks.current.onPress(owner.sources[index], intent));
  }, [releaseSources]);

  const finishPointer = useCallback((pointerId: number) => {
    const owner = pointers.current.get(pointerId);
    if (!owner) return;
    pointers.current.delete(pointerId);
    const label = owner.target.getAttribute("aria-label");
    if (label) suppressClicksUntil.current.set(label, Date.now() + 500);
    releaseSources(owner);
    releaseCapture(owner, pointerId);
    if (owner.aim) {
      const remaining = [...pointers.current.values()].filter((item) => item.aim).at(-1);
      callbacks.current.onAim(remaining?.aim ?? null, Boolean(remaining));
    }
    updatePressed();
  }, [releaseSources, updatePressed]);

  const clear = useCallback(() => {
    const ownedPointers = [...pointers.current.entries()];
    pointers.current.clear();
    for (const [pointerId, owner] of ownedPointers) {
      const label = owner.target.getAttribute("aria-label");
      if (label) suppressClicksUntil.current.set(label, Date.now() + 500);
      releaseSources(owner);
      releaseCapture(owner, pointerId);
    }
    for (const owner of keys.current.values()) {
      if (owner.control) suppressClicksUntil.current.set(owner.control.label, Date.now() + 500);
      releaseSources(owner);
    }
    keys.current.clear();
    for (const owner of clicks.current.values()) {
      clearTimeout(owner.timer);
      releaseSources(owner);
    }
    clicks.current.clear();
    callbacks.current.onAim(null, false);
    updatePressed();
  }, [releaseSources, updatePressed]);

  useEffect(() => {
    const releasePointer = (event: globalThis.PointerEvent) => finishPointer(event.pointerId);
    const releaseKey = (event: globalThis.KeyboardEvent) => {
      for (const [source, owner] of keys.current) {
        if (owner.key !== (event.code || event.key)) continue;
        if (owner.control) suppressClicksUntil.current.set(owner.control.label, Date.now() + 500);
        releaseSources(owner);
        keys.current.delete(source);
      }
      updatePressed();
    };
    const visibilityChange = () => { if (document.hidden) clear(); };
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);
    window.addEventListener("lostpointercapture", releasePointer);
    window.addEventListener("keyup", releaseKey);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
      window.removeEventListener("lostpointercapture", releasePointer);
      window.removeEventListener("keyup", releaseKey);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibilityChange);
      clear();
    };
  }, [mode, clear, finishPointer, releaseSources, updatePressed]);

  const startPointer = (event: PointerEvent<HTMLButtonElement>, item: Control) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    finishPointer(event.pointerId);
    const owner: PointerOwner = {
      target: event.currentTarget, pad: event.currentTarget.closest("[data-movement-pad]"),
      control: null, sources: [], aim: null,
    };
    pointers.current.set(event.pointerId, owner);
    suppressClicksUntil.current.set(item.label, Date.now() + 500);
    event.currentTarget.setPointerCapture(event.pointerId);
    setControl(owner, item, `control:${event.pointerId}`);
    updatePressed();
  };

  const movePointer = (event: PointerEvent<HTMLElement>) => {
    const owner = pointers.current.get(event.pointerId);
    if (!owner?.pad) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = owner.pad.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const next = x >= 0 && x < 1 && y >= 0 && y < 1 ? cells[Math.floor(y * 3) * 3 + Math.floor(x * 3)] : null;
    if (owner.control !== next) {
      setControl(owner, next, `control:${event.pointerId}`);
      updatePressed();
    }
  };

  const pressKey = (event: KeyboardEvent<HTMLButtonElement>, item: Control) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    const key = event.code || event.key;
    const source = `control:keyboard:${item.label}:${key}`;
    if (keys.current.has(source)) return;
    const owner: KeyOwner = { key, control: null, sources: [] };
    keys.current.set(source, owner);
    suppressClicksUntil.current.set(item.label, Date.now() + 500);
    setControl(owner, item, source);
    updatePressed();
  };

  const releaseControlKeys = (label: string) => {
    for (const [source, owner] of keys.current) {
      if (owner.control?.label !== label) continue;
      suppressClicksUntil.current.set(label, Date.now() + 500);
      releaseSources(owner);
      keys.current.delete(source);
    }
    updatePressed();
  };

  const renderButton = (item: Control, style?: CSSProperties) => (
    <button
      key={item.label}
      type="button"
      aria-label={item.label}
      aria-pressed={pressed.has(item.label)}
      title={item.label}
      style={{ ...BUTTON_STYLE, ...style, ...(pressed.has(item.label) ? { background: "#12515def", borderColor: "#bafaff" } : {}) }}
      onPointerDown={(event) => startPointer(event, item)}
      onPointerMove={movePointer}
      onPointerUp={(event) => finishPointer(event.pointerId)}
      onPointerCancel={(event) => finishPointer(event.pointerId)}
      onLostPointerCapture={(event) => finishPointer(event.pointerId)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") pressKey(event, item);
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") event.preventDefault();
      }}
      onBlur={() => releaseControlKeys(item.label)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        // Real pointers and held keys already own their actions. A virtual click
        // from assistive technology gets a short, cancellable activation.
        const pointerType = (event.nativeEvent as globalThis.PointerEvent).pointerType;
        if (event.detail !== 0 || pointerType || Date.now() < (suppressClicksUntil.current.get(item.label) ?? 0) || clicks.current.has(item.label)) return;
        const owner = { control: null, sources: [], timer: setTimeout(() => {
          const active = clicks.current.get(item.label);
          if (!active) return;
          releaseSources(active);
          clicks.current.delete(item.label);
          updatePressed();
        }, 100) } as Owner & { timer: ReturnType<typeof setTimeout> };
        clicks.current.set(item.label, owner);
        setControl(owner, item, `control:activate:${item.label}`);
        updatePressed();
      }}
    >{item.text}</button>
  );

  const pointInAimArea = (event: PointerEvent<HTMLButtonElement>): Position => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };

  return (
    <div
      role="group"
      aria-label={`${PROFILE_NAMES[mode]} controls`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2, fontFamily: "monospace", lineHeight: 1.2 }}
    >
      {mode === "turret" ? (
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: TOUCH_GAMEPLAY_CANVAS_WIDTH, height: `calc(100% - ${TOUCH_CONTROLS_FOOTER_HEIGHT})` }}>
          <button
            type="button"
            aria-label="Aim turret"
            aria-description="Drag to aim. When focused, use the arrow keys to adjust aim. Firing has a separate button."
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: `${GAME_AREA_HEIGHT / CANVAS_HEIGHT * 100}%`, background: "transparent", border: 0, padding: 0, pointerEvents: "auto", touchAction: "none", cursor: "crosshair" }}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              finishPointer(event.pointerId);
              const aim = pointInAimArea(event);
              pointers.current.set(event.pointerId, { target: event.currentTarget, pad: null, control: null, sources: [], aim });
              event.currentTarget.setPointerCapture(event.pointerId);
              callbacks.current.onAim(aim, true);
              updatePressed();
            }}
            onPointerMove={(event) => {
              const owner = pointers.current.get(event.pointerId);
              if (owner?.aim) {
                const aim = pointInAimArea(event);
                owner.aim = aim;
                // Keep the most recently moved owner last for multi-touch release.
                pointers.current.delete(event.pointerId);
                pointers.current.set(event.pointerId, owner);
                callbacks.current.onAim(aim, true);
              } else if (event.pointerType === "mouse" && event.buttons === 0 && ![...pointers.current.values()].some((item) => item.aim)) {
                callbacks.current.onAim(pointInAimArea(event), false);
              }
            }}
            onPointerUp={(event) => finishPointer(event.pointerId)}
            onPointerCancel={(event) => finishPointer(event.pointerId)}
            onLostPointerCapture={(event) => finishPointer(event.pointerId)}
            onPointerLeave={() => {
              if (![...pointers.current.values()].some((item) => item.aim)) callbacks.current.onAim(null, false);
            }}
            onKeyDown={(event) => {
              const direction = TURRET_AIM_KEYS[event.key];
              if (direction) pressKey(event, direction);
            }}
            onBlur={() => releaseControlKeys("Aim turret")}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
          >
            <span style={{ ...LABEL_STYLE, position: "absolute", left: "max(12px, env(safe-area-inset-left))", top: "max(12px, env(safe-area-inset-top))", padding: "5px 7px", background: "#021016b3", pointerEvents: "none" }}>
              {pressed.has("Aim turret") ? "AIMING" : "DRAG TO AIM · ARROW KEYS"}
            </span>
          </button>
        </div>
      ) : (
        <div style={{ position: "absolute", left: "max(12px, env(safe-area-inset-left))", bottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div style={LABEL_STYLE}>{firstPerson ? "MOVE / STRAFE" : mode === "ground-run" ? "MOVE / AIM" : "MOVE"}</div>
          <div
            data-movement-pad
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 44px)", gridTemplateRows: "repeat(3, 44px)", gap: 4, pointerEvents: "auto", touchAction: "none" }}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              finishPointer(event.pointerId);
              pointers.current.set(event.pointerId, { target: event.currentTarget, pad: event.currentTarget, control: null, sources: [], aim: null });
              event.currentTarget.setPointerCapture(event.pointerId);
              movePointer(event);
            }}
            onPointerMove={movePointer}
            onPointerUp={(event) => finishPointer(event.pointerId)}
            onPointerCancel={(event) => finishPointer(event.pointerId)}
            onLostPointerCapture={(event) => finishPointer(event.pointerId)}
          >
            {cells.map((item, index) => item ? renderButton(item, { fontSize: item.text.length > 2 ? 9 : 24 }) : <span key={`empty-${index}`} aria-hidden="true" />)}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", right: "max(12px, env(safe-area-inset-right))", bottom: "max(12px, env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 8, width: 116 }}>
        {firstPerson && (
          <div style={{ display: "flex", gap: 4 }}>
            {renderButton(LOOK_LEFT, { flex: 1 })}
            {renderButton(LOOK_RIGHT, { flex: 1 })}
          </div>
        )}
        {renderButton(firstPerson ? mode === "colony-exploration" ? COLONY_ACTION : FIRST_PERSON_ACTION : FIRE, { minHeight: 52 })}
        {!firstPerson && mode !== "turret" && renderButton(mode === "ground-run" ? JUMP : mode === "boarding" ? DASH : BOMB)}
      </div>
    </div>
  );
}
