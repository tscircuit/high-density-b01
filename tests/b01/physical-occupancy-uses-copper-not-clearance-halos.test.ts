import { expect, test } from "bun:test"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import fixture from "../fixtures/topology-merge18259-physical-ports.json"

test("overlapping clearance envelopes do not rip legally spaced physical copper", (): void => {
  const solver = new HighDensitySolverB01(fixture as HighDensitySolverB01Props)
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.solved).toBeTrue()
  expect(solver.failed).toBeFalse()
  expect(solver.getOutput()).toHaveLength(6)
})
