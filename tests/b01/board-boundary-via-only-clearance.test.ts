import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 checks via clearance when the entire window clears the board for traces", () => {
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: {
      capacityMeshNodeId: "via-only-board-edge",
      center: { x: 2.12, y: 2 },
      width: 4,
      height: 4,
      availableZ: [0, 1],
      portPoints: [
        { connectionName: "signal", x: 0.17, y: 2, z: 0 },
        { connectionName: "signal", x: 0.17, y: 2, z: 1 },
      ],
    },
    boardGeometry: {
      bounds: { minX: 0, minY: -1, maxX: 5, maxY: 5 },
      minBoardEdgeClearance: 0.05,
    },
    obstacles: [],
    traceThickness: 0.1,
    viaDiameter: 0.6,
  })
  solver.solve()

  expect(solver.solved).toBe(true)
  const [route] = solver.getOutput()
  expect(route!.vias).toHaveLength(1)
  expect(route!.vias[0]!.x).toBeGreaterThanOrEqual(0.35)
})
