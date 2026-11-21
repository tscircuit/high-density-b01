import { expect, test } from "bun:test"
import "bun-match-svg"
import { getDdrRoutingWindowSvg } from "../fixtures/getDdrRoutingWindowSvg"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import input from "./fixtures/stm32mp157-via-at-fixed-port.json"

test("checks through-via clearance at the fixed STM32MP157 top-layer ports", async () => {
  const solver = new HighDensitySolverB01(input as HighDensitySolverB01Props)
  solver.solve()

  const fixedPorts = input.nodeWithPortPoints.portPoints.filter(
    (point) => point.z === 0,
  )
  const viaClearance =
    input.viaDiameter / 2 + input.traceThickness / 2 + input.traceMargin
  const conflictingVias = solver
    .getOutput()
    .flatMap((route) =>
      route.vias.filter((via) =>
        fixedPorts.some(
          (port) =>
            route.rootConnectionName !== port.rootConnectionName &&
            Math.hypot(via.x - port.x, via.y - port.y) < viaClearance,
        ),
      ),
    )
  expect(solver.failed).toBeTrue()
  expect(conflictingVias).toHaveLength(1)
  expect(solver.error).toBe("Convergence failure: exceeded MAX_RIPS 200")

  const graphics = solver.visualize()
  graphics.points = graphics.points.filter((point) => point.label)
  graphics.circles.push(
    ...fixedPorts.map((port) => ({
      center: port,
      radius: viaClearance,
      fill: "rgba(245,158,11,0.23)",
      stroke: "#b45309",
      label: "Minimum via-center clearance from the top-layer trace",
    })),
  )
  const { center, height } = input.nodeWithPortPoints
  const texts = [
    {
      x: center.x,
      y: center.y - height / 2 + 0.2,
      fontSize: 0.1,
      text: `${solver.iterations.toLocaleString("en-US")} routing steps`,
    },
    {
      x: center.x,
      y: center.y - height / 2 + 0.04,
      fontSize: 0.09,
      text: "Amber marks fixed-port via clearance",
    },
  ]
  const detail = { ...graphics, texts }
  const svg = getDdrRoutingWindowSvg({
    board: "stmp157",
    node: input.nodeWithPortPoints,
    detail,
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
