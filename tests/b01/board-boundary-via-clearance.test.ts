import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 keeps via copper clear of the physical rectangular board edge", () => {
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: {
      capacityMeshNodeId: "board-edge-via",
      center: { x: 1, y: 2 },
      width: 4,
      height: 4,
      availableZ: [0, 1],
      portPoints: [
        { connectionName: "signal", x: 0.22, y: 2, z: 0 },
        { connectionName: "signal", x: 0.22, y: 2, z: 1 },
      ],
    },
    boardGeometry: {
      bounds: { minX: 0, minY: 0, maxX: 4, maxY: 4 },
      minBoardEdgeClearance: 0.15,
    },
    obstacles: [],
    traceThickness: 0.1,
    viaDiameter: 0.6,
  })
  solver.solve()

  expect(solver.solved).toBe(true)
  const [route] = solver.getOutput()
  expect(route!.vias).toHaveLength(1)
  expect(route!.vias[0]!.x).toBeGreaterThanOrEqual(0.45)
})
