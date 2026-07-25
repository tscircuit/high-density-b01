import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityRouteObstacle } from "../../lib/obstacle-dataset-types"
import { findRouteGeometryViolations } from "../../lib/routeGeometryValidation"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 uses another layer to cross a foreign trace wall", () => {
  const nodeWithPortPoints: NodeWithPortPoints = {
    capacityMeshNodeId: "foreign-trace-obstacle",
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
    availableZ: [0, 1],
    portPoints: [
      { connectionName: "candidate", x: -4, y: 0, z: 0 },
      { connectionName: "candidate", x: 4, y: 0, z: 0 },
    ],
  }
  const obstacle: HighDensityRouteObstacle = {
    type: "route",
    connectionName: "wall",
    rootConnectionName: "wall",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [
      { x: 0, y: -5, z: 0 },
      { x: 0, y: 5, z: 0 },
    ],
    vias: [],
  }
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints,
    obstacles: [obstacle],
    maxCellCount: 200_000,
  })

  solver.solve()
  const routes = solver.getOutput()

  expect(solver.solved).toBe(true)
  expect(routes).toHaveLength(1)
  expect(routes[0]!.vias).toHaveLength(2)
  expect(findRouteGeometryViolations([obstacle, ...routes])).toHaveLength(0)
})
