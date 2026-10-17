import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("disjoint blind-via spans do not reserve each other's copper layers", (): void => {
  for (const allowBlindAndBuriedVias of [false, true]) {
    const solver = new HighDensitySolverB01({
      ...defaultB01Params,
      allowBlindAndBuriedVias,
      nodeWithPortPoints: {
        capacityMeshNodeId: "disjoint-via-spans",
        center: { x: 0, y: 0 },
        width: 0.4,
        height: 0.4,
        availableZ: [0, 1, 2, 3],
        portPoints: [
          { x: 0, y: 0, z: 0, connectionName: "a" },
          { x: 0, y: 0, z: 1, connectionName: "a" },
          { x: 0, y: 0, z: 2, connectionName: "b" },
          { x: 0, y: 0, z: 3, connectionName: "b" },
        ],
      },
      obstacles: [],
      traceThickness: 0.1524,
      viaDiameter: 0.2032,
      viaMinDistFromBorder: 0.1016,
    })
    solver.solve()
    expect(solver.solved).toBe(allowBlindAndBuriedVias)
    expect(solver.failed).toBe(!allowBlindAndBuriedVias)
  }
})
