import {
  type Bounds,
  type Point,
  segmentToSegmentMinDistance,
} from "@tscircuit/math-utils"
import Flatbush from "flatbush"

type Segment = { start: Point; end: Point }

interface BoardBoundary {
  containsBounds: (region: { bounds: Bounds; clearance: number }) => boolean
  containsSegment: (segment: Segment & { clearance: number }) => boolean
}

function createRectangularBoardBoundary({
  minX,
  minY,
  maxX,
  maxY,
}: Bounds): BoardBoundary {
  if (
    ![minX, minY, maxX, maxY].every(Number.isFinite) ||
    minX >= maxX ||
    minY >= maxY
  ) {
    throw new Error("B01 received invalid physical board geometry")
  }
  return {
    containsBounds: ({ bounds, clearance }) => {
      const gap = Math.min(
        bounds.minX - minX,
        bounds.minY - minY,
        maxX - bounds.maxX,
        maxY - bounds.maxY,
      )
      return gap > 0 && gap >= clearance
    },
    containsSegment: ({ start, end, clearance }) => {
      const gap = Math.min(
        Math.min(start.x, end.x) - minX,
        Math.min(start.y, end.y) - minY,
        maxX - Math.max(start.x, end.x),
        maxY - Math.max(start.y, end.y),
      )
      return gap > 0 && gap >= clearance
    },
  }
}

function getRectangularOutlineBounds(
  outline: readonly Point[],
): Bounds | undefined {
  const [a, b, c, d, last] = outline
  if (!a || !b || !c || !d || outline.length > 5) return
  if (last && (last.x !== a.x || last.y !== a.y)) return
  if (a.x === c.x || a.y === c.y) return
  if (
    (a.x === b.x && b.y === c.y && c.x === d.x && d.y === a.y) ||
    (a.y === b.y && b.x === c.x && c.y === d.y && d.x === a.x)
  ) {
    return {
      minX: Math.min(a.x, c.x),
      minY: Math.min(a.y, c.y),
      maxX: Math.max(a.x, c.x),
      maxY: Math.max(a.y, c.y),
    }
  }
}

/** Prepare the physical outline once for the solver's clearance queries. */
export function createBoardBoundary({
  bounds,
  outline,
}: {
  bounds: Bounds
  outline?: readonly Point[]
}): BoardBoundary {
  if (!outline?.length) return createRectangularBoardBoundary(bounds)
  const rectangle = getRectangularOutlineBounds(outline)
  if (rectangle) return createRectangularBoardBoundary(rectangle)

  if (
    outline.length < 3 ||
    outline.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))
  ) {
    throw new Error("B01 received invalid physical board geometry")
  }
  let edgeIndex: Flatbush | undefined

  // Grid centers share Y coordinates. Compute the polygon crossings once per
  // row for the even-odd point test, including edges outside the routing window.
  const crossingsByY = new Map<number, number[]>()
  const isInside = ({ x, y }: Point): boolean => {
    let crossings = crossingsByY.get(y)
    if (!crossings) {
      crossings = []
      for (let i = 0; i < outline.length; i++) {
        const start = outline[i]!
        const end = outline[(i + 1) % outline.length]!
        if (start.y > y === end.y > y) continue
        crossings.push(
          start.x + ((y - start.y) * (end.x - start.x)) / (end.y - start.y),
        )
      }
      crossingsByY.set(y, crossings)
    }
    let inside = false
    for (const crossing of crossings) {
      if (x < crossing) inside = !inside
    }
    return inside
  }

  return {
    // A connected box clear of the outline is inside if one corner is inside.
    // An inconclusive bounding-box overlap is resolved by segment checks.
    containsBounds: ({ bounds, clearance }) => {
      const minX = bounds.minX - clearance
      const minY = bounds.minY - clearance
      const maxX = bounds.maxX + clearance
      const maxY = bounds.maxY + clearance
      for (let i = 0; i < outline.length; i++) {
        const start = outline[i]!
        const end = outline[(i + 1) % outline.length]!
        if (
          Math.max(start.x, end.x) >= minX &&
          Math.min(start.x, end.x) <= maxX &&
          Math.max(start.y, end.y) >= minY &&
          Math.min(start.y, end.y) <= maxY
        ) {
          return false
        }
      }
      return isInside({ x: bounds.minX, y: bounds.minY })
    },
    containsSegment: ({ start, end, clearance }) => {
      if (!isInside(start)) return false
      // Clear interior windows only use containsBounds, so they never build
      // an index. Near the edge, index the outline once and reuse it per move.
      if (!edgeIndex) {
        edgeIndex = new Flatbush(outline.length)
        for (let i = 0; i < outline.length; i++) {
          const a = outline[i]!
          const b = outline[(i + 1) % outline.length]!
          edgeIndex.add(
            Math.min(a.x, b.x),
            Math.min(a.y, b.y),
            Math.max(a.x, b.x),
            Math.max(a.y, b.y),
          )
        }
        edgeIndex.finish()
      }
      const nearbyEdges = edgeIndex.search(
        Math.min(start.x, end.x) - clearance,
        Math.min(start.y, end.y) - clearance,
        Math.max(start.x, end.x) + clearance,
        Math.max(start.y, end.y) + clearance,
      )
      for (const index of nearbyEdges) {
        const distance = segmentToSegmentMinDistance(
          start,
          end,
          outline[index]!,
          outline[(index + 1) % outline.length]!,
        )
        if (distance === 0 || distance < clearance) return false
      }
      return true
    },
  }
}
