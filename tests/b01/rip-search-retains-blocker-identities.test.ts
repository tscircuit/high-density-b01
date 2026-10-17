import { expect, test } from "bun:test"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import fixture from "../fixtures/topology-merge15693-physical-ports.json"

test("rip search retains different blocking-route sets at the same grid position", (): void => {
  const solver = new HighDensitySolverB01(fixture as HighDensitySolverB01Props)
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.failed).toBeFalse()
  expect(solver.solved).toBeTrue()
  expect(solver.getOutput()).toHaveLength(8)
})
