import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("disjoint blind-via copper spans retain declared drill-hole clearance", (): void => {
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    allowBlindAndBuriedVias: true,
    useExactPortCoordinates: true,
    viaHoleDiameter: 0.1016,
    viaHoleClearance: 0.1,
    nodeWithPortPoints: {
      capacityMeshNodeId: "separate-drill-holes",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      availableZ: [0, 1, 2, 3],
      portPoints: [
        { x: -0.6, y: 0, z: 0, connectionName: "a" },
        { x: 0.6, y: 0, z: 1, connectionName: "a" },
        { x: -0.6, y: 0, z: 2, connectionName: "b" },
        { x: 0.6, y: 0, z: 3, connectionName: "b" },
      ],
    },
    obstacles: [],
    traceThickness: 0.1524,
    traceMargin: 0.1,
    viaDiameter: 0.2032,
    viaMinDistFromBorder: 0.1016,
  })
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.solved).toBeTrue()
  const [first, second] = solver.getOutput()
  expect(first!.vias.length).toBeGreaterThan(0)
  expect(second!.vias.length).toBeGreaterThan(0)
  for (const a of first!.vias) {
    for (const b of second!.vias) {
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.201599)
    }
  }
})
