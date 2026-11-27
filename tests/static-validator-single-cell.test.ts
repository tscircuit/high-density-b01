import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 validates exact terminals that occupy one search cell", (): void => {
  let checks = 0
  const params = {
    nodeWithPortPoints: {
      capacityMeshNodeId: "single-cell",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      availableZ: [0],
      portPoints: [
        { connectionName: "signal", x: 0.01, y: 0.01, z: 0 },
        { connectionName: "signal", x: 0.02, y: 0.02, z: 0 },
      ],
    },
    obstacles: [],
    highResolutionCellSize: 0.1,
    lowResolutionCellSize: 0.1,
    viaDiameter: 0.3,
    staticSegmentValidator: (): boolean => {
      checks++
      return false
    },
  }
  const solver = new HighDensitySolverB01(params)
  solver.solve()
  expect(checks).toBeGreaterThan(0)
  expect(solver.failed).toBeTrue()
  expect(solver.solved).toBeFalse()
})
