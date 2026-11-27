import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 routes through the board around a concave cutout", () => {
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: {
      capacityMeshNodeId: "concave-board",
      center: { x: 4, y: 4 },
      width: 8,
      height: 8,
      availableZ: [0, 1],
      portPoints: [
        { connectionName: "signal", x: 1, y: 6, z: 0 },
        { connectionName: "signal", x: 7, y: 6, z: 1 },
      ],
    },
    boardGeometry: {
      bounds: { minX: 0, minY: 0, maxX: 8, maxY: 8 },
      outline: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
        { x: 5, y: 8 },
        { x: 5, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 8 },
        { x: 0, y: 8 },
      ],
      minBoardEdgeClearance: 0.2,
    },
    obstacles: [],
    traceThickness: 0.1,
    viaDiameter: 0.3,
  })
  solver.solve()

  expect(solver.solved).toBe(true)
  const [route] = solver.getOutput()
  expect(route!.vias).toHaveLength(1)
  let crossesCenterlineWithinBoard = false
  for (let i = 1; i < route!.route.length; i++) {
    const a = route!.route[i - 1]!
    const b = route!.route[i]!
    if (a.z !== b.z || a.x === b.x) continue
    if (Math.min(a.x, b.x) > 4 || Math.max(a.x, b.x) < 4) continue
    const yAtCutout = a.y + ((4 - a.x) / (b.x - a.x)) * (b.y - a.y)
    expect(yAtCutout).toBeLessThanOrEqual(2.75)
    crossesCenterlineWithinBoard = true
  }
  expect(crossesCenterlineWithinBoard).toBe(true)
})
