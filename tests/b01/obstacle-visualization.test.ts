import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityRouteObstacle } from "../../lib/obstacle-dataset-types"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 visualization distinguishes immutable obstacles from new routes", () => {
  const nodeWithPortPoints: NodeWithPortPoints = {
    capacityMeshNodeId: "obstacle-visualization",
    center: { x: 0, y: 0 },
    width: 4,
    height: 4,
    availableZ: [0, 1],
    portPoints: [
      { connectionName: "candidate", x: -1, y: 1, z: 0 },
      { connectionName: "candidate", x: 1, y: 1, z: 0 },
    ],
  }
  const obstacle: HighDensityRouteObstacle = {
    type: "route",
    connectionName: "fixed",
    rootConnectionName: "fixed",
    traceThickness: 0.1,
    viaDiameter: 0.3,
    route: [
      { x: -1, y: -1, z: 0 },
      { x: 1, y: -1, z: 0 },
    ],
    vias: [],
  }
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints,
    obstacles: [obstacle],
  })

  solver.solve()
  const graphics = solver.visualize()
  const obstacleLine = graphics.lines?.find((line) =>
    line.label?.startsWith("fixed obstacle fixed"),
  )
  const routedLine = graphics.lines?.find((line) =>
    line.label?.startsWith("B01 route candidate"),
  )

  expect(solver.solved).toBe(true)
  expect(obstacleLine?.strokeDash).toEqual([0.12, 0.08])
  expect(routedLine?.strokeDash).toBeUndefined()
})
