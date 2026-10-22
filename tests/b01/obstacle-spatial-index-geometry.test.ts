import { expect, test } from "bun:test"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityObstacle } from "../../lib/obstacle-dataset-types"
import { useFullScanObstacleQueries } from "../fixtures/useFullScanObstacleQueries"

function createProps(margin: number): HighDensitySolverB01Props {
  const obstacles: HighDensityObstacle[] = []
  for (let index = 0; index < 18; index++) {
    const x = (index % 6) * 0.9 - 2.25
    const y = Math.floor(index / 6) * 1.1 - 1.1
    const connectionName = index % 3 === 0 ? "candidate" : `fixed_${index}`
    obstacles.push({
      type: "route",
      connectionName,
      traceThickness: 0.07 + (index % 4) * 0.03,
      viaDiameter: 0.2 + (index % 3) * 0.1,
      route: [
        { x: x - 0.16, y: y - 0.32, z: index % 2 === 0 ? 3 : 7 },
        { x: x + 0.19, y: y + 0.26, z: index % 2 === 0 ? 3 : 7 },
      ],
      vias: [{ x, y, ...(index % 2 === 0 ? { zStart: 7, zEnd: 11 } : {}) }],
    })
    obstacles.push({
      type: "rect",
      connectionName,
      center: { x: x + 0.12, y: y - 0.15 },
      width: 0.13 + (index % 3) * 0.08,
      height: 0.35,
      ccwRotationDegrees: index * 17,
      zLayers: index % 2 === 0 ? [3, 11] : [7],
    })
  }
  return {
    nodeWithPortPoints: {
      capacityMeshNodeId: "indexed-obstacle-geometry",
      center: { x: 0, y: 0 },
      width: 6,
      height: 4,
      availableZ: [3, 7, 11],
      portPoints: [
        { connectionName: "candidate", x: -2.87, y: -0.13, z: 3 },
        { connectionName: "candidate", x: 2.83, y: 0.17, z: 7 },
        { connectionName: "other", x: -2.71, y: 1.19, z: 11 },
        { connectionName: "other", x: 2.77, y: -1.23, z: 3 },
      ],
    },
    obstacles,
    highResolutionCellSize: 0.2,
    highResolutionCellThickness: 2,
    lowResolutionCellSize: 0.4,
    viaDiameter: 0.3,
    traceThickness: 0.1,
    traceMargin: 0.15,
    obstacleClearanceMargin: margin,
  }
}

test("B01 indexed geometry matches full scans on every grid move", () => {
  let comparedMoves = 0
  let blockedMoves = 0
  for (const margin of [0, 0.15, -0.12]) {
    const props = createProps(margin)
    const actual = new HighDensitySolverB01(structuredClone(props))
    const reference = new HighDensitySolverB01(structuredClone(props))
    actual.setup()
    reference.setup()
    useFullScanObstacleQueries(reference)
    for (
      let segmentIndex = 0;
      segmentIndex < actual["unsolvedSegs"].length;
      segmentIndex++
    ) {
      const segment = actual["unsolvedSegs"][segmentIndex]!
      actual["activeConnSeg"] = segment
      reference["activeConnSeg"] = reference["unsolvedSegs"][segmentIndex]!
      for (let cellId = 0; cellId < actual.planeSize; cellId++) {
        const viaMove = { activeConn: segment.connId, cellId }
        const viaBlocked = actual["isViaMoveBlockedByObstacleGeometry"](viaMove)
        expect(viaBlocked).toBe(
          reference["isViaMoveBlockedByObstacleGeometry"](viaMove),
        )
        comparedMoves++
        if (viaBlocked) blockedMoves++
        for (let layer = 0; layer < actual.layers; layer++) {
          for (
            let edge = actual.neighborOffset[cellId]!;
            edge < actual.neighborOffset[cellId + 1]!;
            edge++
          ) {
            const move = {
              activeConn: segment.connId,
              layer,
              fromCellId: cellId,
              toCellId: actual.neighborIds[edge]!,
            }
            const blocked =
              actual["isLateralMoveBlockedByObstacleGeometry"](move)
            expect(blocked).toBe(
              reference["isLateralMoveBlockedByObstacleGeometry"](move),
            )
            comparedMoves++
            if (blocked) blockedMoves++
          }
        }
      }
    }
  }
  expect(comparedMoves).toBeGreaterThan(10_000)
  expect(blockedMoves).toBeGreaterThan(100)
  expect(blockedMoves).toBeLessThan(comparedMoves)
})
