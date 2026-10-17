import { expect, test } from "bun:test"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import fixture from "../fixtures/topology-merge18093-physical-ports.json"

test("physical grids include legal via sites between clearance circles and boundaries", (): void => {
  const solver = new HighDensitySolverB01(fixture as HighDensitySolverB01Props)
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.failed).toBeFalse()
  expect(solver.solved).toBeTrue()
  expect(solver.getOutput()).toHaveLength(9)
})
