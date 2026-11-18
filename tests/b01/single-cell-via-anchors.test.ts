import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 retains the grid via between distinct terminal anchors", (): void => {
  const start = { connectionName: "signal", x: 0.01, y: 0.01, z: 0 }
  const end = { connectionName: "signal", x: 0.02, y: 0.02, z: 1 }
  const node: NodeWithPortPoints = {
    capacityMeshNodeId: "single-cell-via",
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
  expect(route?.vias).toHaveLength(1)
  const via = route!.vias[0]!
  let transitions = 0
  for (let index = 1; index < route!.route.length; index += 1) {
    const previous = route!.route[index - 1]!
    const current = route!.route[index]!
    if (previous.z === current.z) continue
    transitions += 1
    expect({ x: previous.x, y: previous.y }).toEqual(via)
    expect({ x: current.x, y: current.y }).toEqual(via)
  }
  expect(transitions).toBe(1)
})
