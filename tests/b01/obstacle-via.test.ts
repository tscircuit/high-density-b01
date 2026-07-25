import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityRouteObstacle } from "../../lib/obstacle-dataset-types"
import { findRouteGeometryViolations } from "../../lib/routeGeometryValidation"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 keeps candidate traces clear of obstacle vias on every layer", () => {
  const nodeWithPortPoints: NodeWithPortPoints = {
    capacityMeshNodeId: "obstacle-via",
    center: { x: 0, y: 0 },
    width: 6,
    height: 6,
    availableZ: [0, 1],
    portPoints: [
      { connectionName: "candidate", x: -2, y: 0, z: 1 },
      { connectionName: "candidate", x: 2, y: 0, z: 1 },
    ],
  }
  const obstacle: HighDensityRouteObstacle = {
    type: "route",
    connectionName: "obstacle",
    rootConnectionName: "obstacle",
    traceThickness: 0.1,
    viaDiameter: 0.6,
    route: [
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 1, z: 1 },
    ],
    vias: [{ x: 0, y: 0 }],
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
  expect(routes[0]!.route.some((point) => Math.abs(point.y) > 0.3)).toBe(true)
  expect(findRouteGeometryViolations([obstacle, ...routes])).toHaveLength(0)
})
