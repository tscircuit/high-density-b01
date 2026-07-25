import { expect, setDefaultTimeout, test } from "bun:test"

setDefaultTimeout(120_000)
import "graphics-debug/matcher"
import { defaultA08Params, defaultParams } from "../../../lib/default-params"
import { HighDensitySolverA01 } from "../../../lib/HighDensitySolverA01/HighDensitySolverA01"
import { HighDensitySolverA08 } from "../../../lib/HighDensitySolverA08/HighDensitySolverA08"
import {
  findRouteGeometryViolations,
  findSameLayerIntersections,
  validateNoIntersections,
  validateRouteGeometry,
} from "../../fixtures/validateNoIntersections"
import sample004 from "./sample004.json"

function createA01Solver() {
  const solver = new HighDensitySolverA01({
    ...defaultParams,
    nodeWithPortPoints: sample004.nodeWithPortPoints,
  })
  solver.MAX_ITERATIONS = 10_000_000
  solver.solve()
  return solver
}

function createA08Solver() {
  const solver = new HighDensitySolverA08({
    ...defaultA08Params,
    nodeWithPortPoints: sample004.nodeWithPortPoints,
    effort: 10,
  })
  solver.MAX_ITERATIONS = 100_000_000
  solver.solve()
  return solver
}

test("sample004 solve", () => {
  const solver = createA01Solver()

  console.log(
    `solved=${solver.solved} failed=${solver.failed} iterations=${solver.iterations} error=${solver.error}`,
  )
  console.log(
    `routes=${solver.solvedConnectionsMap.size} unsolved=${solver.unsolvedConnections.length}`,
  )

  expect(solver.iterations).toBeGreaterThan(0)
  expect(solver.solved).toBeTrue()

  const graphics = solver.visualize()
  expect(graphics).toBeTruthy()

  const routes = solver.getOutput()
  const intersections = findSameLayerIntersections(routes)

  if (intersections.length > 0) {
    console.log("Found intersections:")
    for (const ix of intersections) {
      console.log(
        `  ${ix.trace1} x ${ix.trace2} on z=${ix.z} at (${ix.point.x.toFixed(3)}, ${ix.point.y.toFixed(3)})`,
      )
    }
  }

  validateNoIntersections(routes)
})

test("sample004 A08 solve", () => {
  const solver = createA08Solver()

  console.log(
    `solved=${solver.solved} failed=${solver.failed} iterations=${solver.iterations} error=${solver.error}`,
  )
  console.log(
    `routes=${solver.getOutput().length} breakoutShrinkCount=${solver.breakoutSolver?.stats?.shrinkCount ?? 0}`,
  )

  expect(solver.iterations).toBeGreaterThan(0)
  expect(solver.solved).toBeTrue()
  expect(solver.failed).toBeFalse()
  expect(solver.breakoutSolver?.stats?.shrinkCount).toBeGreaterThan(0)

  const graphics = solver.visualize()
  expect(graphics).toBeTruthy()

  const routes = solver.getOutput()
  const intersections = findSameLayerIntersections(routes)
  const violations = findRouteGeometryViolations(routes)

  if (intersections.length > 0) {
    console.log("Found intersections:")
    for (const ix of intersections) {
      console.log(
        `  ${ix.trace1} x ${ix.trace2} on z=${ix.z} at (${ix.point.x.toFixed(3)}, ${ix.point.y.toFixed(3)})`,
      )
    }
  }

  if (violations.length > 0) {
    console.log("Found route geometry violations:")
    for (const violation of violations) {
      console.log(
        `  ${violation.trace1} x ${violation.trace2} [${violation.type}] z=${violation.z ?? "all"} dist=${violation.distance.toFixed(3)} req=${violation.requiredDistance.toFixed(3)}`,
      )
    }
  }

  validateNoIntersections(routes)
  validateRouteGeometry(routes)
})
