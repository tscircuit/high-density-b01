import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityObstacle } from "../../lib/obstacle-dataset-types"
import type { NodeWithPortPoints } from "../../lib/types"

test("B01 fits a legal via between circular BGA pads", (): void => {
  const pitch = 0.65
  const padDiameter = 0.35
  const viaDiameter = 0.35
  const clearance = 0.1
  const node: NodeWithPortPoints = {
    capacityMeshNodeId: "circular-pad-channel",
    center: { x: 0, y: 0 },
    width: pitch,
    height: pitch,
    availableZ: [0, 1],
    portPoints: [
      { connectionName: "signal", x: -pitch / 2, y: 0, z: 0 },
      { connectionName: "signal", x: pitch / 2, y: 0, z: 1 },
    ],
  }
  const centers = [-pitch / 2, pitch / 2].flatMap((x) =>
    [-pitch / 2, pitch / 2].map((y) => ({ x, y })),
  )
  for (const shape of ["rect", "circle"] as const) {
    const obstacles: HighDensityObstacle[] = centers.map((center) => ({
      connectionName: "foreign_pad",
      center,
      zLayers: [0],
      type: "rect",
      shape,
      width: padDiameter,
      height: padDiameter,
    }))
    const solver = new HighDensitySolverB01({
      nodeWithPortPoints: node,
      obstacles,
      highResolutionCellSize: 0.01,
      lowResolutionCellSize: 0.01,
      traceThickness: 0.08,
      traceMargin: clearance,
      obstacleClearanceMargin: clearance,
      viaDiameter,
      viaMinDistFromBorder: 0,
    })
    solver.solve()
    expect(solver.solved).toBe(shape === "circle")
    if (shape !== "circle") continue
    const [route] = solver.getOutput()
    expect(route?.vias.length).toBeGreaterThan(0)
    expect(route?.route[0]).toMatchObject({ x: -pitch / 2, y: 0, z: 0 })
    expect(route?.route.at(-1)).toMatchObject({ x: pitch / 2, y: 0, z: 1 })
    for (const via of route!.vias) {
      for (const center of centers) {
        expect(
          Math.hypot(via.x - center.x, via.y - center.y) -
            padDiameter / 2 -
            viaDiameter / 2,
        ).toBeGreaterThanOrEqual(clearance)
      }
    }
  }
})
