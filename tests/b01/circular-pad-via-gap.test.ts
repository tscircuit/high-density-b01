import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityCircleObstacle } from "../../lib/obstacle-dataset-types"

test("B01 fits a via between circular pads without replacing them with boxes", () => {
  const obstacles: HighDensityCircleObstacle[] = [-0.32, 0.32].flatMap((x) =>
    [-0.25, 0.25].map((y) => ({
      type: "circle" as const,
      connectionName: `pad_${x}_${y}`,
      center: { x, y },
      radius: 0.1,
      zLayers: [3],
    })),
  )
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints: {
      capacityMeshNodeId: "round-pad-gap",
      center: { x: 0, y: 0 },
      width: 0.44,
      height: 0.3,
      availableZ: [0, 1, 2, 3],
      portPoints: [
        { connectionName: "signal", x: 0, y: 0, z: 0 },
        { connectionName: "signal", x: 0, y: 0, z: 3 },
      ],
    },
    obstacles,
    highResolutionCellSize: 0.01,
    highResolutionCellThickness: 8,
    lowResolutionCellSize: 0.02,
    traceThickness: 0.1,
    traceMargin: 0.15,
    obstacleClearanceMargin: 0.15,
    viaDiameter: 0.3,
    viaMinDistFromBorder: 0.15,
  })
  solver.solve()
  console.log(
    JSON.stringify({
      circularPadViaGap: {
        solved: solver.solved,
        error: solver.error,
        viaAllowedCount: solver.viaAllowed.reduce(
          (count, allowed) => count + allowed,
          0,
        ),
        viaCenters: Array.from(solver.viaAllowed).flatMap((allowed, cellId) =>
          allowed
            ? [{ x: solver.cellCenterX[cellId], y: solver.cellCenterY[cellId] }]
            : [],
        ),
        transform: solver.gridToBoundsTransform,
      },
    }),
  )
  expect(solver.solved, solver.error ?? "No completed via route").toBe(true)
  expect(solver.failed).toBe(false)
  const routes = solver.getOutput()
  expect(routes).toHaveLength(1)
  expect(routes[0]!.vias.length).toBeGreaterThan(0)
  for (const via of routes[0]!.vias) {
    for (const obstacle of obstacles) {
      const clearance =
        Math.hypot(via.x - obstacle.center.x, via.y - obstacle.center.y) -
        obstacle.radius -
        0.15
      expect(clearance).toBeGreaterThanOrEqual(0.15 - 1e-9)
    }
  }
})
