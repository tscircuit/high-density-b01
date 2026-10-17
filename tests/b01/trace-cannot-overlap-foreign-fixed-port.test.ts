import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 trace moves preserve clearance to exact foreign ports, not their grid aliases", (): void => {
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    lowResolutionCellSize: 0.1,
    nodeWithPortPoints: {
      capacityMeshNodeId: "exact-port-clearance",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      availableZ: [0],
      portPoints: [
        { x: -0.31, y: -1, z: 0, connectionName: "moving" },
        { x: -0.31, y: 1, z: 0, connectionName: "moving" },
        { x: 0, y: 0, z: 0, connectionName: "fixed" },
        { x: 1, y: 0, z: 0, connectionName: "fixed" },
      ],
    },
    obstacles: [],
    traceThickness: 0.1524,
    traceMargin: 0.15,
    viaDiameter: 0.2032,
  })
  solver._setup()
  const internal = solver as unknown as {
    connNameToId: Map<string, number>
    pointToCell(point: { x: number; y: number; z: number }): { cellId: number }
    computeMoveCostAndRips(
      connection: number,
      toZ: number,
      fromCell: number,
      toCell: number,
      isVia: boolean,
      rippedHead: number,
      ripCount: number,
      lateralCost: number,
    ): void
    _moveCost: number
  }
  const from = internal.pointToCell({ x: -0.2, y: -0.1, z: 0 }).cellId
  const to = internal.pointToCell({ x: -0.2, y: 0.1, z: 0 }).cellId
  internal.computeMoveCostAndRips(
    internal.connNameToId.get("moving")!, 0, from, to, false, -1, 0, 0.2,
  )
  expect(internal._moveCost).toBe(-1)
})
