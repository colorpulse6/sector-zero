"use client";

import styles from "../OpeningScreen.module.css";

export interface GalaxyExperienceGateProps {
  hasGalaxyRun: boolean;
  ready: boolean;
  onGalaxy: () => void;
  onLegacy: () => void;
}

export function GalaxyExperienceGate({
  hasGalaxyRun,
  ready,
  onGalaxy,
  onLegacy,
}: GalaxyExperienceGateProps) {
  return (
    <section
      aria-labelledby="experience-gate-title"
      aria-busy={!ready}
      className={styles.choices}
    >
      <div className={styles.choice}>
        <button type="button" disabled={!ready} onClick={onGalaxy} className={`${styles.launchButton} ${styles.primary}`} aria-describedby="galaxy-choice-context">
          {ready ? (hasGalaxyRun ? "CONTINUE GALAXY" : "BEGIN GALAXY") : "LOADING SAVE"}
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
        <p id="galaxy-choice-context" className={styles.choiceContext}>Explore a persistent galaxy.</p>
      </div>
      <div className={styles.choice}>
        <button type="button" disabled={!ready} onClick={onLegacy} className={`${styles.launchButton} ${styles.secondary}`} aria-describedby="legacy-choice-context">
          LEGACY CAMPAIGN
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
        <p id="legacy-choice-context" className={styles.choiceContext}>40 missions across eight sectors.</p>
      </div>
      {!ready && <p role="status" className={styles.loading}>Reading your saved progress…</p>}
    </section>
  );
}
