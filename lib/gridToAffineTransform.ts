/**
 * Affine transform that maps grid cell-center coordinates to full problem
 * bounds.
 *
 * The grid uses `Math.floor(size / cellSize)` cells, so cell centers don't
 * reach the edges of the bounds.  This transform maps the first cell center
 * to the bounds origin and the last cell center to the bounds far edge,
 * so output points span the entire problem bounds.
 *
 * Matrix form:
 *   | a  b  c |   x' = a*x + b*y + c
 *   | d  e  f |   y' = d*x + e*y + f
 */
export interface AffineTransform {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

/**
 * Compute the affine transform that maps grid cell-center coordinates to the
 * full problem bounds.
 *
 * For cols > 1 the mapping is:
 *   first cell center  (col=0,       x = origin + 0.5*cell) → origin
 *   last  cell center  (col=cols-1,  x = origin + (cols-0.5)*cell) → origin + width
 *
 * For cols == 1 the single cell center is placed at the bounds center.
 */
export function computeGridToAffineTransform(params: {
  originX: number
  originY: number
  rows: number
  cols: number
  cellSizeMm: number
  width: number
  height: number
}): AffineTransform {
  const { originX, originY, rows, cols, cellSizeMm, width, height } = params

  let a: number
  let c: number
  if (cols > 1) {
    a = width / ((cols - 1) * cellSizeMm)
    c = originX * (1 - a) - 0.5 * cellSizeMm * a
  } else {
    // Single column: translate center to bounds center
    a = 1
    c = originX + width / 2 - (originX + 0.5 * cellSizeMm)
  }

  let e: number
  let f: number
  if (rows > 1) {
    e = height / ((rows - 1) * cellSizeMm)
    f = originY * (1 - e) - 0.5 * cellSizeMm * e
  } else {
    e = 1
    f = originY + height / 2 - (originY + 0.5 * cellSizeMm)
  }

  return { a, b: 0, c, d: 0, e, f }
}

/** Apply an affine transform to a 2D point (returns a new object). */
export function applyAffineTransformToPoint(
  t: AffineTransform,
  p: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: t.a * p.x + t.b * p.y + t.c,
    y: t.d * p.x + t.e * p.y + t.f,
  }
}
