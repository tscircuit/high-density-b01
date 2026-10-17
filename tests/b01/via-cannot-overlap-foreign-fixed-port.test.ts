import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 vias respect foreign fixed ports on intermediate layers", (): void => {
  const ports = [
    { x: -0.2, y: -0.5, z: 0, connectionName: "via-net" },
    { x: 0.2, y: -0.5, z: 2, connectionName: "via-net" },
    { x: 0.2, y: -0.5, z: 1, connectionName: "wire-net" },
    { x: 0.2, y: 0.5, z: 1, connectionName: "wire-net" },
  ]
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints: {
      capacityMeshNodeId: "via-port-clearance",
      center: { x: 0, y: 0 },
      width: 0.4,
      height: 1,
      availableZ: [0, 1, 2],
      portPoints: ports,
    },
    obstacles: [],
    traceThickness: 0.1524,
    traceMargin: 0.1,
    viaDiameter: 0.2032,
    viaMinDistFromBorder: 0.1016,
  })
  solver._setup()
  const internal = solver as unknown as {
    connNameToId: Map<string, number>
    pointToCell(point: { x: number; y: number; z: number }): { cellId: number }
    computeMoveCostAndRips(
      connection: number, toZ: number, fromCell: number, toCell: number,
      isVia: boolean, rippedHead: number, ripCount: number, lateralCost: number,
      fromZ: number,
    ): void
    _moveCost: number
  }
  const { cellId } = internal.pointToCell({ x: 0.075, y: -0.3, z: 0 })
  expect(solver.viaAllowed[cellId]).toBe(1)
  internal.computeMoveCostAndRips(
    internal.connNameToId.get("via-net")!, 2, cellId, cellId, true, -1, 0, 0, 0,
  )
  expect(internal._moveCost).toBe(-1)
})
