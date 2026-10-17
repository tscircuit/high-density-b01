import { expect, test } from "bun:test"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import fixture from "../fixtures/cmn63-physical-ports.json"

test("physical terminal coordinates retain routing capacity in production cmn_63", (): void => {
  const solver = new HighDensitySolverB01(fixture as HighDensitySolverB01Props)
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.solved).toBeTrue()
  expect(solver.failed).toBeFalse()
  const routes = solver.getOutput()
  expect(routes).toHaveLength(38)
  for (const port of fixture.nodeWithPortPoints.portPoints) {
    expect(routes.some((route) =>
      route.connectionName === port.connectionName &&
      [route.route[0]!, route.route.at(-1)!].some((point) =>
        point.x === port.x && point.y === port.y && point.z === port.z,
      ),
    )).toBeTrue()
  }
})
