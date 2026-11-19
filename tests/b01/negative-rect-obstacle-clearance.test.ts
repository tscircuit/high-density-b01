import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 rejects a negative via clearance on a rectangular obstacle", () => {
  const center = { x: 0.025, y: 0.025 }
  const viaDiameter = 0.3
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: {
      capacityMeshNodeId: "via-at-pad",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      availableZ: [0, 1],
      portPoints: [
        { connectionName: "route", ...center, z: 0 },
        { connectionName: "route", ...center, z: 1 },
      ],
    },
    obstacles: [
      {
        type: "rect",
        connectionName: "pad",
        center,
        width: 0.42,
        height: 0.42,
        zLayers: [0],
        viaClearanceMargin: -viaDiameter / 2,
      },
    ],
    viaDiameter,
  })

  solver.solve()

  expect(solver.failed).toBe(true)
  expect(solver.error).toBe(
    "Rect obstacle 0 must have finite, non-negative clearances",
  )
  expect(solver.failureReason).toBeUndefined()
})
