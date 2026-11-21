import type { GraphicsObject, Point } from "graphics-debug"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityRouteObstacle } from "../../lib/obstacle-dataset-types"
import { findRouteGeometryViolations } from "../../lib/routeGeometryValidation"

export type FixedWireClearanceCase = Omit<
  HighDensitySolverB01Props,
  "obstacles"
> & {
  obstacles: HighDensityRouteObstacle[]
  obstacleClearanceMargin: number
}

export function solveFixedWireClearanceCase(input: FixedWireClearanceCase): {
  solver: HighDensitySolverB01
  graphics: GraphicsObject
  violationCount: number
} {
  const solver = new HighDensitySolverB01(input)
  solver.solve()
  const margin = input.obstacleClearanceMargin
  const violations = findRouteGeometryViolations(
    [...solver.getOutput(), ...input.obstacles].map((route) => ({
      ...route,
      traceThickness: route.traceThickness + margin,
      viaDiameter: route.viaDiameter + margin,
    })),
  )

  const terminal = input.nodeWithPortPoints.portPoints[0]!
  const nearTerminal = (point: Point): boolean =>
    Math.hypot(point.x - terminal.x, point.y - terminal.y) <=
    4 * input.viaDiameter
  const view = solver.visualize()
  const graphics: GraphicsObject = {
    points: [{ ...terminal, color: "#124d65" }],
    lines: [
      ...input.obstacles.map((wire) => ({
        points: wire.route,
        strokeWidth: wire.traceThickness + 2 * margin,
        strokeColor: "#fde6ad",
      })),
      ...view.lines.flatMap((line) => {
        const first = line.points.findIndex(nearTerminal)
        if (first < 0) return []
        const last = line.points.findLastIndex(nearTerminal)
        return [
          {
            ...line,
            points: line.points.slice(Math.max(0, first - 1), last + 2),
            strokeColor: line.strokeDash ? "#374151" : line.strokeColor,
            strokeDash: undefined,
          },
        ]
      }),
    ],
    circles: [
      ...input.obstacles.flatMap((wire) =>
        wire.route.map((center) => ({
          center,
          radius: wire.traceThickness / 2 + margin,
          fill: "rgba(245,174,49,0.24)",
          stroke: "none",
        })),
      ),
      ...view.circles.filter((via) => nearTerminal(via.center)),
    ],
  }
  return { solver, graphics, violationCount: violations.length }
}
