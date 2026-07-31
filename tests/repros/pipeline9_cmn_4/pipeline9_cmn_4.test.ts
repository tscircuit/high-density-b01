import { expect, setDefaultTimeout, test } from "bun:test"
import "bun-match-svg"
import "graphics-debug/matcher"
import { defaultB01Params } from "../../../lib/default-params"
import { HighDensitySolverB01 } from "../../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityObstacle } from "../../../lib/obstacle-dataset-types"
import type { NodeWithPortPoints } from "../../../lib/types"
import pipeline9Cmn4 from "./pipeline9_cmn_4.json"

setDefaultTimeout(120_000)

const reproduction = pipeline9Cmn4 as {
  nodeWithPortPoints: NodeWithPortPoints
  obstacles: HighDensityObstacle[]
}

test("pipeline9 cmn_4 reproduces the immutable-obstacle routing failure", async () => {
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints: reproduction.nodeWithPortPoints,
    obstacles: reproduction.obstacles,
    obstacleClearanceMargin: 0.095,
    effort: 1,
  })

  solver.solve()

  await expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
  expect(solver.failed).toBeTrue()
  expect(solver.error).toBe("No path found for source_net_3_mst1")
})
