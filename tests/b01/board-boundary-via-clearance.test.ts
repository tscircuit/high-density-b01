import { expect, test } from "bun:test"
import "bun-match-svg"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import { getBoardBoundarySnapshotSvg } from "../fixtures/getBoardBoundarySnapshotSvg"

test("B01 routes a layer change next to the physical board edge", async () => {
  const board = {
    bounds: { minX: 0, minY: 0, maxX: 4, maxY: 4 },
    minBoardEdgeClearance: 0.05,
  }
  const viaDiameter = 0.6
  const solver = new HighDensitySolverB01({
    nodeWithPortPoints: {
      capacityMeshNodeId: "board-edge-via",
      center: { x: 0.7, y: 2 },
      width: 4,
      height: 4,
      availableZ: [0, 1],
      portPoints: [
        { connectionName: "signal", x: 0.12, y: 2, z: 0 },
        { connectionName: "signal", x: 0.12, y: 2, z: 1 },
      ],
    },
    boardGeometry: board,
    obstacles: [],
    traceThickness: 0.1,
    viaDiameter,
  })
  solver.solve()

  expect(solver.solved).toBe(true)
  const routes = solver.getOutput()
  const [route] = routes
  expect(route!.vias).toHaveLength(1)
  const viaClearance = route!.vias[0]!.x - viaDiameter / 2 - board.bounds.minX
  expect(viaClearance).toBeGreaterThanOrEqual(board.minBoardEdgeClearance)
  const svg = getBoardBoundarySnapshotSvg({
    board,
    routes,
    framePadding: viaDiameter / 2,
    viaClearance: {
      measured: viaClearance,
      required: board.minBoardEdgeClearance,
    },
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
