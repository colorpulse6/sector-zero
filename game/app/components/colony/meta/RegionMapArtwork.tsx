import React, { useMemo } from "react";
import type { PlanetBiome, RegionNode } from "../shared/colonyTypes";
import { generateRegionTerrain } from "./regionMapTerrain";

// Atmospheric cartography only. Traversal and discovered landmarks come from the
// saved region graph, drawn separately by RegionMapScreen. The contour field is a
// pure function of the region seed and biome, so the same planet always charts the
// same way; it carries no traversal or discovery authority.
export function RegionMapTerrain({ seed, biome }: { seed: number; biome: PlanetBiome }) {
  const terrain = useMemo(() => generateRegionTerrain(seed, biome), [seed, biome]);
  return (
    <svg className="sz-region-terrain" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g className="sz-region-contours" fill="none" stroke="currentColor" strokeLinejoin="round">
        {terrain.contours.map((ring, index) => (
          <polygon key={index} points={ring.points} strokeOpacity={ring.alpha} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <g className="sz-region-ridges" fill="none" stroke="currentColor" strokeLinecap="round">
        {terrain.ridges.map((ridge, index) => (
          <polyline key={index} points={ridge.points} strokeOpacity={ridge.alpha} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <g className="sz-region-specks" fill="currentColor">
        {terrain.specks.map((speck, index) => (
          <circle key={index} cx={speck.x} cy={speck.y} r={speck.r} fillOpacity={speck.alpha} />
        ))}
      </g>
      <g className="sz-region-survey-grid" fill="none" stroke="currentColor">
        {[10, 30, 50, 70, 90].flatMap(x => [10, 30, 50, 70, 90].map(y => (
          <path key={`${x}:${y}`} d={`M ${x - 0.8} ${y} h 1.6 M ${x} ${y - 0.8} v 1.6`} vectorEffect="non-scaling-stroke" />
        )))}
      </g>
    </svg>
  );
}

export function RegionLandmark({ node, decorative = false }: { node: Pick<RegionNode, "intel" | "type">; decorative?: boolean }) {
  const kind = node.intel === "unknown" ? "unknown" : node.type;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" data-landmark={decorative ? undefined : kind} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
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
