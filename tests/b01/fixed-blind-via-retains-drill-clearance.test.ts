import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("a fixed via outside the signal span still reserves declared drill spacing", (): void => {
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    allowBlindAndBuriedVias: true,
    useExactPortCoordinates: true,
    viaHoleDiameter: 0.1016,
    viaHoleClearance: 0.1,
    nodeWithPortPoints: {
      capacityMeshNodeId: "fixed-drill-hole",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      availableZ: [0, 1],
      portPoints: [
        { x: 0, y: 0, z: 0, connectionName: "signal" },
        { x: 0, y: 0, z: 1, connectionName: "signal" },
      ],
    },
    obstacles: [{
      type: "route",
      connectionName: "fixed",
      traceThickness: 0.1524,
      viaDiameter: 0.2032,
      viaHoleDiameter: 0.1016,
      route: [{ x: 0, y: 0, z: 2 }, { x: 0, y: 0, z: 3 }],
      vias: [{ x: 0, y: 0, zStart: 2, zEnd: 3 }],
    }],
    traceThickness: 0.1524,
    traceMargin: 0.1,
    viaDiameter: 0.2032,
    viaMinDistFromBorder: 0.1016,
  })
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.solved).toBeTrue()
  const [route] = solver.getOutput()
  expect(route!.vias.length).toBeGreaterThan(0)
  for (const via of route!.vias) {
    expect(Math.hypot(via.x, via.y)).toBeGreaterThanOrEqual(0.201599)
  }
})
