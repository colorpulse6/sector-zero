import type { BoardingMap } from "../../../engine/types";
import type { Tile } from "./types";

const NEIGHBORS: Tile[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]; // N,E,S,W

function walkable(map: BoardingMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const t = map.tiles[y][x];
  return t === "floor" || t === "door";
}
// Pack (x,y) into one number for Map keys: collision-free while width < 1000 — the
// 24×24 colony exterior map is well within range (see task notes).
const key = (x: number, y: number) => y * 1000 + x;

/** Deterministic 4-dir A*. Returns waypoint tiles AFTER start, ending at goal, or [] if
 *  unreachable or start===goal. Tie-break: lower f, then lower h, then insertion order
 *  (neighbors always expanded N,E,S,W) — so identical inputs yield identical paths. */
export function findPath(map: BoardingMap, start: Tile, goal: Tile): Tile[] {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!walkable(map, goal.x, goal.y)) return [];
  const h = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);

  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const open: { x: number; y: number; g: number; f: number }[] = [];
  gScore.set(key(start.x, start.y), 0);
  open.push({ x: start.x, y: start.y, g: 0, f: h(start.x, start.y) });

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const o = open[i], b = open[bi];
      if (o.f < b.f || (o.f === b.f && (o.f - o.g) < (b.f - b.g))) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    if (cur.x === goal.x && cur.y === goal.y) {
      const out: Tile[] = [];
      let k = key(cur.x, cur.y);
      while (cameFrom.has(k)) {
        out.push({ x: k % 1000, y: Math.floor(k / 1000) });
        k = cameFrom.get(k)!;
      }
      out.reverse();
      return out;
    }
    const ck = key(cur.x, cur.y);
    if (cur.g > (gScore.get(ck) ?? Infinity)) continue;
    for (const n of NEIGHBORS) {
      const nx = cur.x + n.x, ny = cur.y + n.y;
      if (!walkable(map, nx, ny)) continue;
      const nk = key(nx, ny), ng = cur.g + 1;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        cameFrom.set(nk, ck);
        open.push({ x: nx, y: ny, g: ng, f: ng + h(nx, ny) });
      }
    }
  }
  return [];
}
