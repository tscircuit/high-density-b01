import {
  isPointInsidePolygon,
  type Point,
  segmentToSegmentMinDistance,
} from "@tscircuit/math-utils"

export function fitsInsideBoard({
  outline,
  start,
  end,
  clearance,
}: {
  outline: readonly Point[]
  start: Point
  end: Point
  clearance: number
}): boolean {
  const minX = Math.min(start.x, end.x) - clearance
  const maxX = Math.max(start.x, end.x) + clearance
  const minY = Math.min(start.y, end.y) - clearance
  const maxY = Math.max(start.y, end.y) + clearance
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!
    const b = outline[(i + 1) % outline.length]!
    if (
      Math.max(a.x, b.x) < minX ||
      Math.min(a.x, b.x) > maxX ||
      Math.max(a.y, b.y) < minY ||
      Math.min(a.y, b.y) > maxY
    ) {
      continue
    }
    const distance = segmentToSegmentMinDistance(start, end, a, b)
    if (distance === 0 || distance < clearance) return false
  }
  // With no boundary intersections, an inside start keeps the entire segment inside.
  return isPointInsidePolygon(start, outline)
}
