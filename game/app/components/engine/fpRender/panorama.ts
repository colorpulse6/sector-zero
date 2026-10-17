export interface SkyProjection {
  columns: Int32Array;
  frameWidth: number;
  textureWidth: number;
  dirX: number;
  dirY: number;
  planeX: number;
  planeY: number;
}

/** Camera-ray angles provide the same field of view as walls. Translation
 * does not invalidate this distant-sky lookup. Storage belongs to the scene. */
export function skyProjection(previous: SkyProjection | undefined, frameWidth: number, textureWidth: number,
  dirX: number, dirY: number, planeX: number, planeY: number): SkyProjection {
  if (previous && previous.frameWidth === frameWidth && previous.textureWidth === textureWidth
    && previous.dirX === dirX && previous.dirY === dirY && previous.planeX === planeX && previous.planeY === planeY) return previous;
  const projection = previous ?? { columns: new Int32Array(frameWidth), frameWidth, textureWidth, dirX, dirY, planeX, planeY };
  if (projection.columns.length !== frameWidth) projection.columns = new Int32Array(frameWidth);
  Object.assign(projection, { frameWidth, textureWidth, dirX, dirY, planeX, planeY });
  for (let x = 0; x < frameWidth; x++) {
    const cameraX = 2 * x / frameWidth - 1;
    const angle = Math.atan2(dirY + planeY * cameraX, dirX + planeX * cameraX);
    projection.columns[x] = Math.floor((angle + Math.PI) / (2 * Math.PI) * textureWidth + 1e-9) & (textureWidth - 1);
  }
  return projection;
}
