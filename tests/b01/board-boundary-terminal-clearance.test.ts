import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 checks the actual board clearance of terminals in the same grid cell", () => {
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: {
      capacityMeshNodeId: "board-edge-terminals",
      center: { x: 2, y: 2 },
      width: 4,
      height: 4,
      availableZ: [0, 1],
      // Both ports share the cell centered at x = 0.25 mm, which clears the 0.21 mm limit.
      portPoints: [
        { connectionName: "signal", x: 0.205, y: 2, z: 0 },
        { connectionName: "signal", x: 0.26, y: 2, z: 0 },
      ],
    },
    boardGeometry: {
      bounds: { minX: 0.06, minY: 0, maxX: 4, maxY: 4 },
      minBoardEdgeClearance: 0.1,
    },
    obstacles: [],
    highResolutionCellSize: 0.1,
    traceThickness: 0.1,
    viaDiameter: 0.3,
  })
  solver.solve()

  expect(solver.failed).toBe(true)
  expect(solver.error).toContain("Route terminals cannot clear the board edge")
  expect(solver.getOutput()).toHaveLength(0)
})
