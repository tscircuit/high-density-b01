import { expect, test } from "bun:test"
import "graphics-debug/matcher"
import {
  type FixedWireClearanceCase,
  solveFixedWireClearanceCase,
} from "../fixtures/solveFixedWireClearanceCase"
import input from "./fixtures/icepi-fixed-wire-clearance.json"

test("iCEPi DDR repair starts inside the clearance around a foreign wire", async (): Promise<void> => {
  const { solver, graphics, violationCount } = solveFixedWireClearanceCase(
    input as FixedWireClearanceCase,
  )
  expect(solver.solved).toBe(true)
  expect(solver.getOutput()).toHaveLength(1)
  expect(violationCount).toBeGreaterThan(0)
  await expect(graphics).toMatchGraphicsSvg(import.meta.path)
})
