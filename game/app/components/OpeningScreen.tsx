"use client";

import React, { useRef, useState } from "react";
import { GalaxyExperienceGate, type GalaxyExperienceGateProps } from "./galaxy/GalaxyExperienceGate";
import { useModalFocus } from "./ui/ModalFocus";

interface OpeningScreenProps extends GalaxyExperienceGateProps {
  muted: boolean;
  onToggleMute: () => void;
  playerName?: string;
}

type HelpPanel = "controls" | "story";

function OpeningHelp({ panel, onClose }: { panel: HelpPanel; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useModalFocus({ rootRef, onEscape: onClose });

  return (
    <div className="sz-opening-help-backdrop">
      <div
        ref={rootRef}
        className="sz-opening-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="opening-help-title"
        tabIndex={-1}
        onKeyDown={event => event.stopPropagation()}
      >
        <header className="sz-opening-help-header">
          <p className="sz-opening-eyebrow">VANGUARD / FIELD NOTES</p>
          <button type="button" onClick={onClose} className="sz-opening-close-button">
            CLOSE <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="sz-opening-help-body" role="region" aria-label={panel === "controls" ? "Controls content" : "Story content"} tabIndex={0}>
          <h2 id="opening-help-title">{panel === "controls" ? "Controls" : "The story so far"}</h2>
          {panel === "controls" ? (
            <>
              <p>Every mission calls for a different approach. Active-mode controls appear during play.</p>
              <dl className="sz-opening-controls">
                <div><dt>Choose your course</dt><dd>Click or tap a button. On a keyboard, use <kbd>Tab</kbd> to focus and <kbd>Enter</kbd> or <kbd>Space</kbd> to select.</dd></div>
                <div><dt>Move &amp; aim</dt><dd>Use the arrow keys or <kbd>WASD</kbd>. In first-person, left/right arrows turn and <kbd>A</kbd> / <kbd>D</kbd> strafe. Touch controls adapt to your current mode.</dd></div>
                <div><dt>Fight &amp; explore</dt><dd><kbd>Z</kbd> or <kbd>Shift</kbd> fires in combat. <kbd>Space</kbd> fires in space, jumps on the ground and dashes while boarding. In colonies, use the on-screen interaction prompts.</dd></div>
                <div><dt>Take a moment</dt><dd><kbd>P</kbd> pauses during play. <kbd>M</kbd> toggles sound. <kbd>Escape</kbd> closes panels or returns to the previous screen.</dd></div>
              </dl>
            </>
          ) : (
            <div className="sz-opening-story">
              <p className="sz-opening-eyebrow">THE YEAR 2847</p>
              <p>Humanity has spread across the stars. Thousands of colony worlds. A golden age of expansion.</p>
              <p className="sz-opening-story-accent">Then The Signal arrived.</p>
              <p>An electromagnetic whisper from the void. Coming from a region every star chart labeled FORBIDDEN.</p>
              <h3>SECTOR ZERO</h3>
              <p>The colonies closest to the source fell silent first. Then entire systems went dark.</p>
              <p>Survivors spoke of hostiles unlike anything in our records.</p>
              <h3>THE HOLLOW</h3>
              <p>An alien hivemind. Fast. Adaptive. Relentless. They consumed everything in their path.</p>
              <p>The United Earth Coalition has one option remaining.</p>
              <p>Send a strike team into Sector Zero. Find the source of The Signal. Destroy the Hollow Mind. End this war.</p>
              <p className="sz-opening-story-accent">Whatever the cost.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OpeningScreen({
  ready, hasGalaxyRun, onGalaxy, onLegacy, muted, onToggleMute, playerName,
}: OpeningScreenProps) {
  const [panel, setPanel] = useState<HelpPanel | null>(null);

  return (
    <main className="sz-opening" data-opening-screen aria-label="Sector Zero opening screen">
      {/* Decorative key art; gameplay remains on the canvas beneath this screen. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="sz-opening-art"
        src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/images/ui/sector-zero-key-art.webp`}
        alt=""
        width={1672}
        height={941}
        fetchPriority="high"
      />
      <div className="sz-opening-shade" aria-hidden="true" />
      <div className="sz-opening-composition" inert={panel !== null}>
        <header className="sz-opening-header">
          <p className="sz-opening-ship-label">
            <svg viewBox="0 0 24 38" fill="none" aria-hidden="true">
              <path d="M12 1v36M8 7v18l4 7 4-7V7M4 14v9l8 10 8-10v-9M10 4l2-3 2 3" />
            </svg>
            UEC VANGUARD
          </p>
          <button type="button" className="sz-opening-sound-button" onClick={onToggleMute} aria-pressed={muted}>
            SOUND {muted ? "OFF" : "ON"}
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 10v4h4l5 4V6l-5 4H3Z" />
              {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14" />}
            </svg>
          </button>
        </header>

        <div className="sz-opening-content">
          <h1 id="experience-gate-title" className="sz-opening-wordmark" aria-label="SECTOR ZERO">
            <span>SECTOR</span>{" "}<span>ZERO</span>
          </h1>
          <p className="sz-opening-subtitle">THE LAST PILOT OF SECTOR ZERO</p>
          <div className="sz-opening-rule" aria-hidden="true" />
          <p className="sz-opening-premise">The signal is calling. Choose your course.</p>
          <GalaxyExperienceGate className="sz-opening-choices" ready={ready} hasGalaxyRun={hasGalaxyRun} onGalaxy={onGalaxy} onLegacy={onLegacy} />
          <div className="sz-opening-insignia" aria-hidden="true"><span /></div>
          <nav className="sz-opening-help-links" aria-label="Before you launch">
            <button type="button" onClick={() => setPanel("controls")} disabled={!ready}>CONTROLS</button>
            <button type="button" onClick={() => setPanel("story")} disabled={!ready}>THE STORY SO FAR</button>
          </nav>
          {playerName && playerName !== "Guest" && <p className="sz-opening-pilot">PILOT / {playerName}</p>}
        </div>
      </div>
      {panel && <OpeningHelp panel={panel} onClose={() => setPanel(null)} />}
    </main>
  );
}
