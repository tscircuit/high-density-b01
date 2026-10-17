import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 preserves both physical ports when a route occupies one grid cell", (): void => {
  const points = [
    { x: 0.02237867, y: 0.0454661189, z: 3, connectionName: "signal" },
    { x: 0, y: 0.065818767857, z: 3, connectionName: "signal" },
  ]
  const nodeWithPortPoints: NodeWithPortPoints = {
    capacityMeshNodeId: "single-cell-route",
    center: { x: 0.011189335, y: 0.065818767857 },
    width: 0.02237867,
    height: 0.131637535714,
    availableZ: [3],
    portPoints: points,
  }
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints,
    obstacles: [],
    traceThickness: 0.1524,
    viaDiameter: 0.2032,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  const route = solver.getOutput()[0]!
  expect(route.route).toHaveLength(2)
  expect(route.route[0]).toMatchObject(points[0]!)
  expect(route.route.at(-1)).toMatchObject(points[1]!)
  expect(route.vias).toEqual([])
})
