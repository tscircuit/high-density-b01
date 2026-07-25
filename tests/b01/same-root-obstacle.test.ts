import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityRouteObstacle } from "../../lib/obstacle-dataset-types"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 permits a candidate to connect through same-root obstacle copper", () => {
  const nodeWithPortPoints: NodeWithPortPoints = {
    capacityMeshNodeId: "same-root-obstacle",
    center: { x: 0, y: 0 },
    width: 10,
    height: 10,
    availableZ: [0],
    portPoints: [
      {
        connectionName: "shared_net_mst1",
        rootConnectionName: "shared_net",
        x: -4,
        y: 0,
        z: 0,
      },
      {
        connectionName: "shared_net_mst1",
        rootConnectionName: "shared_net",
        x: 4,
        y: 0,
        z: 0,
      },
    ],
  }
  const obstacle: HighDensityRouteObstacle = {
    type: "route",
    connectionName: "shared_net_mst0",
    rootConnectionName: "shared_net",
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

  expect(solver.solved).toBe(true)
  expect(solver.getOutput()).toHaveLength(1)
  expect(solver.getOutput()[0]!.rootConnectionName).toBe("shared_net")
})
