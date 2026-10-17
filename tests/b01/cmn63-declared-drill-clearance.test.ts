import { expect, test } from "bun:test"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import fixture from "../fixtures/cmn63-physical-ports.json"

test("production cmn_63 retains all routes with declared drill-hole spacing", (): void => {
  const solver = new HighDensitySolverB01({
    ...fixture as HighDensitySolverB01Props,
    viaHoleDiameter: 0.1016,
    viaHoleClearance: 0.1,
  })
  solver.solve()
  expect(solver.error).toBeNull()
  expect(solver.solved).toBeTrue()
  const routes = solver.getOutput()
  expect(routes).toHaveLength(38)
  const violations: number[] = []
  for (let first = 0; first < routes.length; first++) {
    for (let second = first + 1; second < routes.length; second++) {
      const a = routes[first]!
      const b = routes[second]!
      for (const viaA of a.vias) {
        for (const viaB of b.vias) {
          const centerDistance = Math.hypot(viaA.x - viaB.x, viaA.y - viaB.y)
          if (centerDistance < 1e-6 && a.rootConnectionName === b.rootConnectionName) continue
          if (centerDistance < 0.201599) violations.push(centerDistance)
        }
      }
    }
  }
  expect(violations).toEqual([])
})
