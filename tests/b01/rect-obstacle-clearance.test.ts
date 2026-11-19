import { expect, test } from "bun:test"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityRectObstacle } from "../../lib/obstacle-dataset-types"

test("B01 clears a pad escape with separate trace and via clearances", () => {
  const viaDiameter = 0.3
  const viaClearanceMargin = 0.35
  const pads: HighDensityRectObstacle[] = [
    {
      type: "rect",
      connectionName: "upper-pad",
      center: { x: 0, y: 0.4 },
      width: 0.42,
      height: 0.42,
      zLayers: [0],
      traceClearanceMargin: 0.1,
      viaClearanceMargin,
    },
    {
      type: "rect",
      connectionName: "lower-pad",
      center: { x: 0, y: -0.4 },
      width: 0.42,
      height: 0.42,
      zLayers: [0],
      traceClearanceMargin: 0.1,
      viaClearanceMargin,
    },
  ]
  const props: HighDensitySolverB01Props = {
    nodeWithPortPoints: {
      capacityMeshNodeId: "pad-escape",
      center: { x: 0, y: 0 },
      width: 3,
      height: 2,
      availableZ: [0, 1],
      portPoints: [
        { connectionName: "escape", x: 0, y: 0, z: 0 },
        { connectionName: "escape", x: 0.55, y: 0, z: 1 },
      ],
    },
    obstacles: pads,
    highResolutionCellSize: 0.05,
    lowResolutionCellSize: 0.05,
    traceThickness: 0.1,
    traceMargin: 0.15,
    obstacleClearanceMargin: 0.15,
    viaDiameter,
  }
  const blockedSolver = new HighDensitySolverB01({
    ...props,
    obstacles: pads.map((pad) => ({ ...pad, traceClearanceMargin: undefined })),
  })
  blockedSolver.solve()
  expect(blockedSolver.failed).toBe(true)
  expect(blockedSolver.failureReason).toBe("no_path")

  const solver = new HighDensitySolverB01(props)
  solver.solve()

  expect(solver.solved).toBe(true)
  const [route] = solver.getOutput()
  expect(route?.vias).toHaveLength(1)
  const via = route!.vias[0]!
  const requiredCenterDistance = viaDiameter / 2 + viaClearanceMargin
  for (const pad of pads) {
    const dx = Math.max(0, Math.abs(via.x - pad.center.x) - pad.width / 2)
    const dy = Math.max(0, Math.abs(via.y - pad.center.y) - pad.height / 2)
    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(requiredCenterDistance)
  }
})
