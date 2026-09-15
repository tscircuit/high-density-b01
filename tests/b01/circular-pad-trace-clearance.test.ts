import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 applies circular pad clearance only to foreign copper on its layer", () => {
  for (const [obstacleLayer, rootConnectionName] of [
    [0, "foreign"],
    [1, "foreign"],
    [0, "signal"],
  ] as const) {
    const solver = new HighDensitySolverB01({
      ...defaultB01Params,
      nodeWithPortPoints: {
        capacityMeshNodeId: "circle-clearance",
        center: { x: 0, y: 0 },
        width: 4,
        height: 4,
        availableZ: [0, 1],
        portPoints: [
          { connectionName: "signal", x: -1.5, y: 0, z: 0 },
          { connectionName: "signal", x: 1.5, y: 0, z: 0 },
        ],
      },
      obstacles: [
        {
          type: "circle",
          connectionName: "pad",
          rootConnectionName,
          center: { x: 0, y: 0 },
          radius: 0.4,
          zLayers: [obstacleLayer],
        },
      ],
      traceThickness: 0.1,
      traceMargin: 0.15,
      obstacleClearanceMargin: 0.15,
    })
    solver.solve()
    expect(solver.solved, solver.error ?? "Circular-pad route failed").toBe(
      true,
    )
    expect(solver.failed).toBe(false)
    const routes = solver.getOutput()
    expect(routes).toHaveLength(1)
    const route = routes[0]!
    if (rootConnectionName === "signal") continue
    for (let index = 1; index < route.route.length; index++) {
      const start = route.route[index - 1]!
      const end = route.route[index]!
      if (start.z !== obstacleLayer || end.z !== obstacleLayer) continue
      const dx = end.x - start.x
      const dy = end.y - start.y
      const lengthSquared = dx * dx + dy * dy
      const fraction =
        lengthSquared === 0
          ? 0
          : Math.max(
              0,
              Math.min(1, -(start.x * dx + start.y * dy) / lengthSquared),
            )
      expect(
        Math.hypot(start.x + fraction * dx, start.y + fraction * dy),
      ).toBeGreaterThanOrEqual(0.6 - 1e-6)
    }
    for (const via of route.vias) {
      expect(Math.hypot(via.x, via.y)).toBeGreaterThanOrEqual(
        0.4 + route.viaDiameter / 2 + 0.15 - 1e-6,
      )
    }
  }
})
