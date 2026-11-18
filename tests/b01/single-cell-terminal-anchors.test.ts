import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 connects both terminals inside one planar grid cell", (): void => {
  const start = { connectionName: "signal", x: 0.01, y: 0.01, z: 0 }
  const end = { connectionName: "signal", x: 0.02, y: 0.02, z: 0 }
  const node: NodeWithPortPoints = {
    capacityMeshNodeId: "single-cell-terminals",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    availableZ: [0, 1],
    portPoints: [start, end],
  }
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: node,
    obstacles: [],
    highResolutionCellSize: 0.25,
    lowResolutionCellSize: 0.25,
    traceThickness: 0.1,
    viaDiameter: 0.3,
    viaMinDistFromBorder: 0,
  })
  solver.solve()
  expect(solver.solved).toBeTrue()
  const [route] = solver.getOutput()
  expect(route?.route[0]).toMatchObject(start)
  expect(route?.route.at(-1)).toMatchObject(end)
  expect(route?.vias).toEqual([])
})
