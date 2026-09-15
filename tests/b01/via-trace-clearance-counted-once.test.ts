import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 counts trace clearance once when placing a nearby via", () => {
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: {
      capacityMeshNodeId: "via-beside-trace",
      center: { x: 0, y: 0 },
      width: 2.1,
      height: 2.1,
      availableZ: [0, 1],
      portPoints: [
        { connectionName: "via", x: 0, y: 0, z: 0 },
        { connectionName: "via", x: 0, y: 0, z: 1 },
        { connectionName: "trace", x: -1.05, y: 0.4, z: 0 },
        { connectionName: "trace", x: 1.05, y: 0.4, z: 0 },
      ],
    },
    obstacles: [],
    highResolutionCellSize: 0.1,
    highResolutionCellThickness: 8,
    lowResolutionCellSize: 0.1,
    viaDiameter: 0.3,
    viaMinDistFromBorder: 0.15,
    traceThickness: 0.1,
    traceMargin: 0.15,
  })
  solver.solve()
  expect(solver.solved, solver.error ?? "No completed route").toBe(true)
  const routes = solver.getOutput()
  expect(routes).toHaveLength(2)
  const viaRoute = routes.find((route) => route.connectionName === "via")!
  expect(viaRoute.vias).toHaveLength(1)
  // A centered via clears the foreign trace by at least 0.4 - 0.15 - 0.05.
  // Routing it away from the center would indicate a second clearance halo.
  expect(viaRoute.vias[0]!.x).toBeCloseTo(0, 9)
  expect(viaRoute.vias[0]!.y).toBeCloseTo(0, 9)
})
