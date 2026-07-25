import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 rejects routing windows larger than 15x15mm", () => {
  const nodeWithPortPoints: NodeWithPortPoints = {
    capacityMeshNodeId: "oversized-window",
    center: { x: 0, y: 0 },
    width: 15.1,
    height: 10,
    availableZ: [0, 1],
    portPoints: [
      { connectionName: "candidate", x: -4, y: 0, z: 0 },
      { connectionName: "candidate", x: 4, y: 0, z: 0 },
    ],
  }
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints,
    obstacles: [],
  })

  solver.solve()

  expect(solver.failed).toBe(true)
  expect(solver.error).toContain("only supports routing windows up to 15x15mm")
})
