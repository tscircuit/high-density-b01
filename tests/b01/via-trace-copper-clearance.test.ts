import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 preserves copper clearance when a centered via would overlap a trace", () => {
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: {
      capacityMeshNodeId: "via-conflicts-with-trace",
      center: { x: 0, y: 0 },
      width: 2.1,
      height: 2.1,
      availableZ: [0, 1],
      portPoints: [
        { connectionName: "via", x: 0, y: 0, z: 0 },
        { connectionName: "via", x: 0, y: 0, z: 1 },
        { connectionName: "trace", x: -1.05, y: 0.2, z: 0 },
        { connectionName: "trace", x: 1.05, y: 0.2, z: 0 },
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
  const traceRoute = routes.find((route) => route.connectionName === "trace")!
  const via = viaRoute.vias[0]!
  for (let index = 1; index < traceRoute.route.length; index++) {
    const start = traceRoute.route[index - 1]!
    const end = traceRoute.route[index]!
    if (start.z !== end.z) continue
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const fraction =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((via.x - start.x) * dx + (via.y - start.y) * dy) / lengthSquared,
            ),
          )
    const distance = Math.hypot(
      via.x - start.x - fraction * dx,
      via.y - start.y - fraction * dy,
    )
    expect(distance - 0.15 - 0.05).toBeGreaterThanOrEqual(0.15 - 1e-9)
  }
})
