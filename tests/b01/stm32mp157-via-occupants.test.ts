import { expect, setDefaultTimeout, test } from "bun:test"
import { createHash } from "node:crypto"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import input from "./fixtures/stm32mp157-via-occupants.json"

setDefaultTimeout(120_000)

test("replays the STM32MP157 DDR routing window across rip-ups", (): void => {
  const solver = new HighDensitySolverB01(input as HighDensitySolverB01Props)
  const start = performance.now()
  solver.solve()
  console.log(
    "STM32MP157 routing window seconds:",
    (performance.now() - start) / 1000,
  )

  expect(solver.failed).toBeTrue()
  expect(solver.error).toBe("HighDensitySolverB01 ran out of iterations")
  expect(solver.iterations).toBe(2_000_000)
  const copperHash = createHash("sha256")
    .update(JSON.stringify(solver.getOutput()))
    .digest("hex")
  expect(copperHash).toBe(
    "911317cb9975a4c927d27040e8eb5297f453d1c4b860849d77a8255c78586ba3",
  )
})
