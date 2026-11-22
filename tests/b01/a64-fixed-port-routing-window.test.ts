import { expect, test } from "bun:test"
import "bun-match-svg"
import { getDdrRoutingWindowSvg } from "../fixtures/getDdrRoutingWindowSvg"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import { findRouteGeometryViolations } from "../../lib/routeGeometryValidation"
import input from "./fixtures/a64-fixed-port-routing-window.json"

test("routes the A64 DDR window with fixed port positions", async () => {
  const solver = new HighDensitySolverB01(input as HighDensitySolverB01Props)
  solver.solve()

  const routes = solver.getOutput()
  expect(solver.solved).toBeTrue()
  expect(routes).toHaveLength(input.nodeWithPortPoints.portPointsInPairs.length)
  expect(solver.iterations).toBeLessThan(30_000)
  const routedNames = new Set(routes.map((route) => route.connectionName))
  const clearanceChecks = [...input.obstacles, ...routes].map((route) => ({
    ...route,
    traceThickness: route.traceThickness + input.traceMargin,
    viaDiameter: route.viaDiameter + input.traceMargin,
  }))
  const violations = findRouteGeometryViolations(clearanceChecks).filter(
    ({ trace1, trace2 }) => routedNames.has(trace1) || routedNames.has(trace2),
  )
  expect(violations).toHaveLength(0)

  const { center, height, portPointsInPairs } = input.nodeWithPortPoints
  const graphics = solver.visualize()
  const text = `${routes.length}/${portPointsInPairs.length} assigned paths connected`
  // The fixed wires span the board. Frame the routes emitted inside this window.
  const lines = graphics.lines.filter((line) =>
    line.label?.startsWith("B01 route "),
  )
  const points = graphics.points.filter((point) => point.label)
  const detail = {
    ...graphics,
    lines,
    points,
    texts: [
      { x: center.x, y: center.y - height / 2 - 0.58, text, fontSize: 0.16 },
    ],
  }
  const svg = getDdrRoutingWindowSvg({
    board: "a64",
    node: input.nodeWithPortPoints,
    detail,
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
