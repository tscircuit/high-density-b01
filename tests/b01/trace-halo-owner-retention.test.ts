import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import { findRouteGeometryViolations } from "../../lib/routeGeometryValidation"
import type { PortPoint } from "../../lib/types"

type Point = { x: number; y: number }
type CapturedParams = ConstructorParameters<typeof HighDensitySolverB01>[0] & {
  traceThickness: number
  nodeWithPortPoints: {
    portPointsInPairs: [PortPoint, PortPoint][]
  }
}

const pointToSegmentDistance = (
  point: Point,
  start: Point,
  end: Point,
): number => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) /
              lengthSquared,
          ),
        )
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy)
}

const orientation = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

const segmentDistance = (a: Point, b: Point, c: Point, d: Point): number => {
  if (
    orientation(a, b, c) * orientation(a, b, d) < 0 &&
    orientation(c, d, a) * orientation(c, d, b) < 0
  ) {
    return 0
  }
  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  )
}

test("B01 retains foreign trace clearance contributors when another route is ripped", (): void => {
  // Actual five-pair native input: overlapping clearance halos are owned by
  // different nets. Ripping one owner must not erase the surviving trace.
  const fixturePath = new URL(
    "./fixtures/trace-halo-owner-retention.json.gz",
    import.meta.url,
  )
  const params = JSON.parse(
    gunzipSync(new Uint8Array(readFileSync(fixturePath))).toString(),
  ) as CapturedParams
  const originalParams = structuredClone(params)
  const solver = new HighDensitySolverB01(params)
  solver.solve()

  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  expect(solver.MAX_ITERATIONS).toBe(2_000_000)
  expect(solver.MAX_RIPS).toBe(200)
  expect(params).toEqual(originalParams)
  expect(solver.getConstructorParams()[0]).toMatchObject(originalParams)

  const routes = solver.getOutput()
  const pairs = params.nodeWithPortPoints.portPointsInPairs
  expect(routes).toHaveLength(pairs.length)
  expect(new Set(routes.map((route) => route.rootConnectionName)).size).toBe(
    routes.length,
  )
  for (const route of routes) {
    const pair = pairs.find(
      ([start]) => start.connectionName === route.connectionName,
    )
    expect(pair).toBeDefined()
    expect(route.route[0]).toEqual(pair![0])
    expect(route.route.at(-1)).toEqual(pair![1])
    expect(route.traceThickness).toBe(params.traceThickness)
    expect(
      route.route.every(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
      ),
    ).toBe(true)
  }

  // This contract checks physical copper overlap, not the final declared
  // board clearance supplied by a consumer's later cleanup stage.
  expect(findRouteGeometryViolations(routes)).toHaveLength(0)
  let checkedPairs = 0
  let minimumCopperGap = Infinity
  for (const [leftIndex, left] of routes.entries()) {
    for (const right of routes.slice(leftIndex + 1)) {
      expect(left.rootConnectionName).not.toBe(right.rootConnectionName)
      for (let i = 1; i < left.route.length; i++) {
        const a = left.route[i - 1]!
        const b = left.route[i]!
        if (a.z !== b.z) continue
        for (let j = 1; j < right.route.length; j++) {
          const c = right.route[j - 1]!
          const d = right.route[j]!
          if (c.z !== d.z || a.z !== c.z) continue
          const copperGap =
            segmentDistance(a, b, c, d) -
            (left.traceThickness + right.traceThickness) / 2
          minimumCopperGap = Math.min(minimumCopperGap, copperGap)
          checkedPairs++
        }
      }
    }
  }
  expect(checkedPairs).toBeGreaterThan(0)
  expect(Number.isFinite(minimumCopperGap)).toBe(true)
  expect(minimumCopperGap).toBeGreaterThanOrEqual(-1e-9)
})
