import React from "react";
import type { RegionNode } from "../shared/colonyTypes";

// Atmospheric cartography only. Traversal and discovered landmarks come from the
// saved region graph, drawn separately by RegionMapScreen.
export function RegionMapTerrain() {
  return (
    <svg className="sz-region-terrain" viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        {Array.from({ length: 18 }, (_, index) => {
          const offset = index * 22;
          return <path key={index} d={`M ${-210 + offset} -30 C ${30 + offset} 140, ${-80 + offset} 270, ${160 + offset} 330 S ${160 + offset} 610, ${420 + offset} 850`} />;
        })}
        {Array.from({ length: 12 }, (_, index) => {
          const offset = index * 18;
          return <path key={index} d={`M ${1050 - offset} 30 C ${680 - offset} 60, ${1080 - offset} 300, ${900 - offset} 430 S ${700 - offset} 580, ${1100 - offset} 780`} />;
        })}
      </g>
      <g className="sz-region-survey-grid" fill="none" stroke="currentColor" strokeWidth="1">
        {[100, 300, 500, 700, 900].flatMap(x => [100, 300, 500, 700].map(y => (
          <path key={`${x}:${y}`} d={`M ${x - 4} ${y} h 8 M ${x} ${y - 4} v 8`} />
        )))}
      </g>
    </svg>
  );
}

export function RegionLandmark({ node }: { node: RegionNode }) {
  const kind = node.intel === "unknown" ? "unknown" : node.type;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" data-landmark={kind} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
      {kind === "unknown" ? (
        <><circle cx="16" cy="16" r="3" /><path d="M 9 9 a 10 10 0 0 0 0 14 M 23 9 a 10 10 0 0 1 0 14" /></>
      ) : kind === "colony_site" || kind === "neutral_village" || kind === "abandoned_colony" ? (
        <><path d="M 5 25 V 16 L 16 7 L 27 16 V 25 Z M 12 25 V 18 H 20 V 25 M 16 7 V 3 L 23 5 L 16 7" /></>
      ) : kind === "wreck" || kind === "crash_site" ? (
        <><path d="M 3 19 L 25 7 L 19 23 L 14 18 L 10 24 Z M 14 18 L 21 12 M 6 27 H 12 M 24 25 H 28" /></>
      ) : kind === "ruins" || kind === "hollow_bunker" || kind === "raider_outpost" ? (
        <><path d="M 5 26 H 27 M 8 26 V 13 H 13 V 26 M 18 26 V 8 H 23 V 26 M 6 9 L 11 5 L 16 9 M 18 5 H 24" /></>
      ) : kind === "cave" ? (
        <><path d="M 3 26 L 11 8 L 16 14 L 22 5 L 29 26 Z M 12 26 Q 16 11 21 26" /></>
      ) : (
        <><path d="M 16 4 L 28 16 L 16 28 L 4 16 Z" /><circle cx="16" cy="16" r="4" /></>
      )}
    </svg>
  );
}
