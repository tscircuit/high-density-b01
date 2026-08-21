import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityRouteObstacle } from "../../lib/obstacle-dataset-types"
import type { NodeWithPortPoints } from "../../lib/types"

const nodeWithPortPoints: NodeWithPortPoints = {
  capacityMeshNodeId: "obstacle-buried-via",
  center: { x: 0, y: 0 },
  width: 6,
  height: 6,
  availableZ: [0, 1, 2, 3],
  portPoints: [
    { connectionName: "candidate", x: -2, y: 0, z: 0 },
    { connectionName: "candidate", x: 2, y: 0, z: 0 },
  ],
}

const createObstacle = (
  via: HighDensityRouteObstacle["vias"][number],
): HighDensityRouteObstacle => ({
  type: "route",
  connectionName: "obstacle",
  rootConnectionName: "obstacle",
  traceThickness: 0.1,
  viaDiameter: 0.6,
  route: [
    { x: 0, y: -1, z: 2 },
    { x: 0, y: 1, z: 2 },
  ],
  vias: [via],
})

test("B01 limits buried obstacle vias to their layer span", () => {
  const buriedViaSolver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints,
    obstacles: [createObstacle({ x: 0, y: 0, zStart: 2, zEnd: 3 })],
    maxCellCount: 200_000,
  })
  const throughViaSolver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints,
    obstacles: [createObstacle({ x: 0, y: 0 })],
    maxCellCount: 200_000,
  })

  buriedViaSolver.solve()
  throughViaSolver.solve()
  const buriedRoute = buriedViaSolver.getOutput()[0]!
  const throughRoute = throughViaSolver.getOutput()[0]!

  expect(buriedViaSolver.solved).toBe(true)
  expect(buriedRoute.route.every(({ z }) => z === 0)).toBe(true)
  expect(buriedRoute.route.every(({ y }) => Math.abs(y) < 1e-9)).toBe(true)
  expect(throughViaSolver.solved).toBe(true)
  expect(throughRoute.route.some(({ y }) => Math.abs(y) > 0.3)).toBe(true)
})
