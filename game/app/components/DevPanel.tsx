"use client";

import { useEffect, useRef, useState } from "react";
import { type GameState, GameScreen } from "./engine/types";
import { ALL_LEVELS, WORLD_NAMES } from "./engine/levels";
import { PLANET_DEFS } from "./engine/planets";

interface DevPanelProps {
  gameState: GameState | null;
  onAction: (action: string) => void;
}

export default function DevPanel({ gameState, onAction }: DevPanelProps) {
  const [open, setOpen] = useState(false);
  const fpsRef = useRef(0);
  const frameTimesRef = useRef<number[]>([]);
  const [fps, setFps] = useState(0);

  // FPS counter
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const now = performance.now();
      const times = frameTimesRef.current;
      times.push(now);
      // Keep last 60 frame timestamps
      while (times.length > 60) times.shift();
      if (times.length > 1) {
        const elapsed = times[times.length - 1] - times[0];
        fpsRef.current = Math.round(((times.length - 1) / elapsed) * 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const interval = setInterval(() => setFps(fpsRef.current), 500);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, []);

  // Backtick toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "`") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const screenName = gameState
    ? Object.entries(GameScreen).find(
        ([, v]) => v === gameState.screen
      )?.[0] ?? "?"
    : "N/A";

  if (!open) {
    return (
      <div className="absolute top-2 left-2 z-50">
        <button
          onClick={() => setOpen(true)}
          className="bg-black/60 text-green-400 text-xs px-2 py-1 font-mono border border-green-800 hover:border-green-400 transition-colors"
          title="Dev Panel (`)"
        >
          DEV
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-2 left-2 z-50 w-64 max-h-[90vh] overflow-y-auto bg-black/90 border border-green-800 text-green-400 font-mono text-xs p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-green-800 pb-2">
        <span className="font-bold tracking-wider">DEV PANEL</span>
        <div className="flex items-center gap-3">
          <span className="text-green-600">{fps} FPS</span>
          <button
            onClick={() => setOpen(false)}
            className="text-green-600 hover:text-green-400"
          >
            X
          </button>
        </div>
      </div>

      {/* State Info */}
      <div className="space-y-1 text-green-600">
        <div>Screen: <span className="text-green-400">{screenName}</span></div>
        {gameState && (
          <>
            <div>
              W{gameState.currentWorld}-L{gameState.currentLevel} | Wave {gameState.currentWave}/{gameState.totalWaves}
            </div>
            <div>
              HP: {gameState.player.hp}/{gameState.player.maxHp} | Lives: {gameState.lives}
            </div>
            <div>
              Weapon: Lv{gameState.player.weaponLevel} | Score: {gameState.score}
            </div>
            <div>
              Enemies: {gameState.enemies.length} | Bullets: P{gameState.playerBullets.length}/E{gameState.enemyBullets.length}
            </div>
            {gameState.boss && (
              <div>
                Boss: {gameState.boss.name} HP {gameState.boss.hp}/{gameState.boss.maxHp} P{gameState.boss.phase}
              </div>
            )}
            <div>
              Invincible: <span className={gameState.devInvincible ? "text-yellow-400" : ""}>{gameState.devInvincible ? "ON" : "off"}</span>
              {" | Bank: "}<span className={gameState.player.bankDir !== 0 ? "text-cyan-400" : ""}>{gameState.player.bankDir}</span>
            </div>
          </>
        )}
      </div>

      {/* Level Select */}
      <div className="space-y-1">
        <div className="text-green-600 border-b border-green-900 pb-1">LEVEL SELECT</div>
        <div className="grid grid-cols-5 gap-1">
          {ALL_LEVELS.map((level) => {
            const isCurrent =
              gameState?.currentWorld === level.world &&
              gameState?.currentLevel === level.level;
            return (
              <button
                key={`${level.world}-${level.level}`}
                onClick={() => onAction(`goto-level:${level.world}:${level.level}`)}
                className={`px-1 py-1 text-center border transition-colors ${
                  isCurrent
                    ? "border-green-400 bg-green-400/20 text-green-300"
                    : "border-green-900 hover:border-green-600 text-green-600 hover:text-green-400"
                } ${level.isBoss ? "text-red-400 border-red-900 hover:border-red-600" : ""}`}
                title={`${WORLD_NAMES[level.world - 1]} - ${level.name}`}
              >
                {level.world}-{level.level}
              </button>
            );
          })}
        </div>
      </div>

      {/* Planet Missions */}
      <div className="space-y-1">
        <div className="text-green-600 border-b border-green-900 pb-1">PLANET MISSIONS</div>
        <div className="grid grid-cols-2 gap-1">
          {PLANET_DEFS.map((planet) => (
            <button
              key={planet.id}
              onClick={() => onAction(`goto-planet:${planet.id}`)}
              className="px-1 py-1.5 border border-green-900 hover:border-green-600 text-green-600 hover:text-green-400 transition-colors text-center truncate"
              title={`${planet.name} — ${planet.subtitle} (${planet.objective})`}
              style={{ borderColor: `${planet.color}44` }}
            >
              <span style={{ color: planet.color }}>{planet.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Game Modes */}
      <div className="space-y-1">
        <div className="text-purple-500 border-b border-purple-900 pb-1">GAME MODES</div>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => onAction("goto-ground-run")}
            className="px-1 py-1.5 border border-purple-900 hover:border-purple-500 text-purple-400 hover:text-purple-300 transition-colors text-center"
          >
            GROUND RUN
          </button>
          <button
            onClick={() => onAction("goto-boarding")}
            className="px-1 py-1.5 border border-purple-900 hover:border-purple-500 text-purple-400 hover:text-purple-300 transition-colors text-center"
          >
            BOARDING
          </button>
          <button
            onClick={() => onAction("goto-first-person")}
            className="px-1 py-1.5 border border-purple-900 hover:border-purple-500 text-purple-400 hover:text-purple-300 transition-colors text-center"
          >
            FIRST PERSON
          </button>
          <button
            onClick={() => onAction("goto-turret")}
            className="px-1 py-1.5 border border-purple-900 hover:border-purple-500 text-purple-400 hover:text-purple-300 transition-colors text-center"
          >
            TURRET
          </button>
          <button
            onClick={() => onAction("goto-exploration")}
            className="px-1 py-1.5 border border-purple-900 hover:border-purple-500 text-purple-400 hover:text-purple-300 transition-colors text-center"
          >
            ASHFALL CAMP
          </button>
        </div>
      </div>

      {/* Player Cheats */}
      <div className="space-y-1">
        <div className="text-green-600 border-b border-green-900 pb-1">CHEATS</div>
        <div className="grid grid-cols-2 gap-1">
          <DevButton
            label={gameState?.devInvincible ? "GOD OFF" : "GOD ON"}
            active={gameState?.devInvincible}
            onClick={() => onAction("toggle-invincible")}
          />
          <DevButton label="MAX WPN" onClick={() => onAction("max-weapon")} />
          <DevButton label="+1 LIFE" onClick={() => onAction("add-life")} />
          <DevButton label="FULL HP" onClick={() => onAction("full-hp")} />
          <DevButton label="SKIP WAVE" onClick={() => onAction("skip-wave")} />
          <DevButton label="KILL ALL" onClick={() => onAction("kill-enemies")} />
          <DevButton label="SKIP BRIEF" onClick={() => onAction("skip-briefing")} />
          <DevButton label="SPAWN BOSS" onClick={() => onAction("spawn-boss")} />
          <DevButton label="SPAWN PWR" onClick={() => onAction("spawn-powerup")} />
        </div>
      </div>

      <div className="text-green-900 text-center pt-1">` to toggle</div>
    </div>
  );
}

function DevButton({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1.5 border transition-colors text-center ${
        active
          ? "border-yellow-500 bg-yellow-500/20 text-yellow-400"
          : "border-green-900 hover:border-green-600 text-green-600 hover:text-green-400"
      }`}
    >
      {label}
    </button>
  );
}
