import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

export function createB01Heap(): HighDensitySolverB01["heap"] {
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints: {
      capacityMeshNodeId: "heap-test",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      availableZ: [0, 1],
      portPoints: [],
    },
    obstacles: [],
  })
  solver.setup()
  return solver["heap"]
}
