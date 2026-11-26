import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../lib/HighDensitySolverB01/HighDensitySolverB01"

test("copper outside wire routing layers still blocks a through via", () => {
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: {
      capacityMeshNodeId: "native-copper",
      center: { x: 0, y: 0 },
      width: 6,
      height: 6,
      availableZ: [0, 1],
      portPoints: [
        { x: -2, y: 0, z: 0, connectionName: "signal" },
        { x: 2, y: 0, z: 1, connectionName: "signal" },
      ],
    },
    traceThickness: 0.1,
    viaDiameter: 0.4,
    obstacleClearanceMargin: 0.1,
    obstacles: [
      {
        type: "route",
        connectionName: "fixed-bus",
        traceThickness: 0.2,
        viaDiameter: 0.4,
        viaOnly: true,
        route: [
          { x: -3, y: 0, z: 3 },
          { x: 3, y: 0, z: 3 },
        ],
        vias: [],
      },
    ],
  })
  solver.solve()
  expect(solver.failed).toBe(false)
  expect(solver.solved).toBe(true)
  const routes = solver.getOutput()
  expect(routes).toHaveLength(1)
  for (const route of routes) {
    expect(route.vias.length).toBeGreaterThan(0)
    for (const via of route.vias)
      expect(Math.abs(via.y)).toBeGreaterThanOrEqual(0.4 - 1e-9)
  }
})
