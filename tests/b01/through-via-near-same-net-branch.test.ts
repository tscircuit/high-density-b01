import { expect, test } from "bun:test"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import capture from "./fixtures/stm32mp157-via-at-fixed-port.json"

test("a through-via can share clearance with a fixed endpoint on the same net", (): void => {
  const input = structuredClone(capture)
  const { portPoints, portPointsInPairs } = input.nodeWithPortPoints
  for (const port of [...portPoints, ...portPointsInPairs.flat()]) {
    port.rootConnectionName = "shared_net"
  }

  const solver = new HighDensitySolverB01(input as HighDensitySolverB01Props)
  solver.solve()
  expect(solver.solved).toBeTrue()
  const routes = solver.getOutput()
  expect(routes).toHaveLength(2)

  const viaClearance =
    input.viaDiameter / 2 + input.traceThickness / 2 + input.traceMargin
  const viaBesideOtherBranch = routes.some((route) =>
    route.vias.some((via) =>
      portPoints.some(
        (port) =>
          port.connectionName !== route.connectionName &&
          Math.hypot(via.x - port.x, via.y - port.y) < viaClearance,
      ),
    ),
  )
  expect(viaBesideOtherBranch).toBeTrue()
})
