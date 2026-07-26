import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityRectObstacle } from "../../lib/obstacle-dataset-types"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 routes around a fixed rectangular obstacle", () => {
  const nodeWithPortPoints: NodeWithPortPoints = {
    capacityMeshNodeId: "rect-obstacle",
    center: { x: 0, y: 0 },
    width: 6,
    height: 6,
    availableZ: [0, 1],
    portPoints: [
      { connectionName: "candidate", x: -2, y: 0, z: 0 },
      { connectionName: "candidate", x: 2, y: 0, z: 0 },
    ],
  }
  const obstacle: HighDensityRectObstacle = {
    type: "rect",
    connectionName: "fixed_rect",
    rootConnectionName: "fixed_rect",
    center: { x: 0, y: 0 },
    width: 0.5,
    height: 4,
    ccwRotationDegrees: 15,
    zLayers: [0],
  }
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints,
    obstacles: [obstacle],
    highResolutionCellSize: 0.05,
    highResolutionCellThickness: 8,
    lowResolutionCellSize: 0.2,
    traceThickness: 0.1,
    traceMargin: 0.15,
    obstacleClearanceMargin: 0.15,
    viaDiameter: 0.3,
    viaMinDistFromBorder: 0,
    maxCellCount: 500_000,
  })

  solver.solve()
  const [route] = solver.getOutput()

  expect(solver.solved).toBe(true)
  expect(route?.route.some((point) => point.z === 1)).toBe(true)
  expect(solver.gridStats.obstacleRectCount).toBe(1)
})
