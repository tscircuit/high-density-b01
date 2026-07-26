import { expect, test } from "bun:test"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityRouteObstacle } from "../../lib/obstacle-dataset-types"
import type { NodeWithPortPoints } from "../../lib/types"

const pointToSegmentDistance = (
  point: { x: number; y: number },
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number },
): number => {
  const deltaX = segmentEnd.x - segmentStart.x
  const deltaY = segmentEnd.y - segmentStart.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  const projection =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - segmentStart.x) * deltaX +
              (point.y - segmentStart.y) * deltaY) /
              lengthSquared,
          ),
        )
  return Math.hypot(
    point.x - (segmentStart.x + projection * deltaX),
    point.y - (segmentStart.y + projection * deltaY),
  )
}

test("B01 preserves the requested clearance between vias and obstacle traces", () => {
  const traceMargin = 0.15
  const viaDiameter = 0.3
  const nodeWithPortPoints: NodeWithPortPoints = {
    capacityMeshNodeId: "obstacle-clearance-margin",
    center: { x: 0, y: 0 },
    width: 4,
    height: 4,
    availableZ: [0, 1],
    portPoints: [
      { connectionName: "candidate", x: -1, y: 0, z: 0 },
      { connectionName: "candidate", x: 1, y: 0, z: 0 },
    ],
  }
  const obstacle: HighDensityRouteObstacle = {
    type: "route",
    connectionName: "fixed",
    rootConnectionName: "fixed",
    traceThickness: 0.1,
    viaDiameter,
    route: [
      { x: -1.5, y: 1.5, z: 0 },
      { x: 1.5, y: -1.5, z: 0 },
    ],
    vias: [],
  }
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints,
    obstacles: [obstacle],
    highResolutionCellSize: 0.05,
    highResolutionCellThickness: 8,
    lowResolutionCellSize: 0.2,
    traceThickness: 0.1,
    traceMargin,
    obstacleClearanceMargin: traceMargin,
    viaDiameter,
    viaMinDistFromBorder: 0,
    maxCellCount: 500_000,
  })

  solver.solve()
  const [route] = solver.getOutput()
  expect(solver.solved).toBe(true)
  expect(route?.vias.length).toBeGreaterThan(0)

  const minimumCenterDistance =
    obstacle.traceThickness / 2 + viaDiameter / 2 + traceMargin
  for (const via of route?.vias ?? []) {
    expect(
      pointToSegmentDistance(via, obstacle.route[0]!, obstacle.route[1]!),
    ).toBeGreaterThanOrEqual(minimumCenterDistance - 1e-9)
  }
})
