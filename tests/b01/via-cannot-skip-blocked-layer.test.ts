import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("B01 vias cannot jump over an unavailable physical layer", (): void => {
  for (const availableZ of [[0, 2], [0, 1, 2]]) {
    const solver = new HighDensitySolverB01({
      ...defaultB01Params,
      nodeWithPortPoints: {
        capacityMeshNodeId: "blocked-layer",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        availableZ,
        portPoints: [
          { x: -0.5, y: 0, z: 0, connectionName: "signal" },
          { x: 0.5, y: 0, z: 2, connectionName: "signal" },
        ],
      },
      obstacles: [],
      viaDiameter: 0.2032,
    })
    solver.solve()
    expect(solver.solved).toBe(availableZ.length === 3)
    expect(solver.failed).toBe(availableZ.length === 2)
  }
})
