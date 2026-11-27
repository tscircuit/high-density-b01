import "bun-match-svg"
import { expect, test } from "bun:test"
import { getSvgFromGraphicsObject } from "graphics-debug"
import { HighDensitySolverB01 } from "../lib/HighDensitySolverB01/HighDensitySolverB01"

type Point = { x: number; y: number; z: number }

test("B01 validates through-via copper outside its routing layers", (): void => {
  let viaChecks = 0
  const params = {
    nodeWithPortPoints: {
      capacityMeshNodeId: "inner-layer-handoff",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      availableZ: [1, 2],
      portPoints: [
        { connectionName: "signal", x: 0.01, y: 0.02, z: 1 },
        { connectionName: "signal", x: 0.02, y: 0.03, z: 2 },
      ],
    },
    obstacles: [],
    highResolutionCellSize: 0.05,
    lowResolutionCellSize: 0.2,
    viaDiameter: 0.35,
    traceThickness: 0.08,
    traceMargin: 0.1,
    viaMinDistFromBorder: 0.175,
    staticSegmentValidator: ({
      start,
      end,
    }: {
      start: Point
      end: Point
    }): boolean => {
      if (start.z === end.z) return true
      viaChecks++
      return Math.hypot(start.x, start.y) >= 0.45
    },
  }
  const solver = new HighDensitySolverB01(params)
  solver.solve()
  expect(solver.solved).toBeTrue()
  const output = solver.getOutput()[0]!
  const via = output.vias[0]!
  const gap = Math.hypot(via.x, via.y) - 0.35
  const graphics = solver.visualize()
  graphics.circles = [
    ...(graphics.circles ?? []),
    {
      center: { x: 0, y: 0 },
      radius: 0.175,
      fill: "rgba(128,128,128,0.3)",
      stroke: "#475569",
      label: "Top-layer pad",
    },
  ]
  graphics.texts = [
    {
      x: 0,
      y: 0.8,
      fontSize: 0.08,
      color: "#334155",
      text: `Through-via to pad gap: ${gap.toFixed(3)} mm; minimum 0.100 mm`,
    },
  ]
  expect(
    getSvgFromGraphicsObject(graphics, { backgroundColor: "white" }),
  ).toMatchSvgSnapshot(import.meta.path)
})
