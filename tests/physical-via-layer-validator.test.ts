import { expect, test } from "bun:test"
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
  expect(viaChecks).toBeGreaterThan(0)
  const output = solver.getOutput()[0]!
  expect(output.vias).toHaveLength(1)
  expect(
    Math.hypot(output.vias[0]!.x, output.vias[0]!.y),
  ).toBeGreaterThanOrEqual(0.45)
  expect(output.route[0]).toMatchObject(
    params.nodeWithPortPoints.portPoints[0]!,
  )
  expect(output.route.at(-1)).toMatchObject(
    params.nodeWithPortPoints.portPoints[1]!,
  )
  for (let index = 1; index < output.route.length; index++) {
    const start = output.route[index - 1]!,
      end = output.route[index]!
    if (start.z !== end.z)
      expect(Math.hypot(start.x - end.x, start.y - end.y)).toBeLessThan(1e-9)
  }
})
