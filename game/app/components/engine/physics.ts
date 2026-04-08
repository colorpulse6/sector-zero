// ─── AABB Collision Detection ────────────────────────────────────────

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// ─── Spatial Hash Grid ───────────────────────────────────────────────

const CELL_SIZE = 64;

export class SpatialHash {
  private cells = new Map<string, number[]>();

  clear(): void {
    this.cells.clear();
  }

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  insert(id: number, x: number, y: number, w: number, h: number): void {
    const minCX = Math.floor(x / CELL_SIZE);
    const maxCX = Math.floor((x + w) / CELL_SIZE);
    const minCY = Math.floor(y / CELL_SIZE);
    const maxCY = Math.floor((y + h) / CELL_SIZE);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const k = this.key(cx, cy);
        const list = this.cells.get(k);
        if (list) {
          list.push(id);
        } else {
          this.cells.set(k, [id]);
        }
      }
    }
  }

  query(x: number, y: number, w: number, h: number): Set<number> {
    const result = new Set<number>();
    const minCX = Math.floor(x / CELL_SIZE);
    const maxCX = Math.floor((x + w) / CELL_SIZE);
    const minCY = Math.floor(y / CELL_SIZE);
    const maxCY = Math.floor((y + h) / CELL_SIZE);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const list = this.cells.get(this.key(cx, cy));
        if (list) {
          for (const id of list) {
            result.add(id);
          }
        }
      }
    }

    return result;
  }
}

// ─── Distance helpers ────────────────────────────────────────────────

export function distSq(
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
