import type { GraphicsObject } from "graphics-debug"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { AffineTransform } from "../../lib/gridToAffineTransform"

type CellRect = { minX: number; minY: number; maxX: number; maxY: number }

export function getFixedWireRasterSnapshot(
  input: HighDensitySolverB01Props,
  board: string,
) {
  const wire = input.obstacles[0]
  if (input.obstacles.length !== 1 || wire?.type !== "route") {
    throw new Error("Expected one fixed wire")
  }
  const solver = new HighDensitySolverB01(input)
  const grid = solver as unknown as {
    getCellRect(cellId: number): CellRect
    gridToBoundsTransform: AffineTransform
    obstacleTraceRootIdsFlat: Array<number[] | undefined>
    obstacleViaRootIdsByCell: Array<number[] | undefined>
  }
  const getCellRect = grid.getCellRect.bind(grid)
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  }
  let exactTests = 0
  // One native wire is the only obstacle. Both trace and via rasterization
  // request the exact cell rectangle immediately before their capsule test.
  grid.getCellRect = (cellId) => {
    const rect = getCellRect(cellId)
    exactTests++
    bounds.minX = Math.min(bounds.minX, rect.minX)
    bounds.minY = Math.min(bounds.minY, rect.minY)
    bounds.maxX = Math.max(bounds.maxX, rect.maxX)
    bounds.maxY = Math.max(bounds.maxY, rect.maxY)
    return rect
  }
  solver.setup()
  if (solver.failed || exactTests === 0)
    throw new Error(solver.error ?? "No fixed-wire cells tested")

  const node = input.nodeWithPortPoints
  const transform = grid.gridToBoundsTransform
  const graphics: GraphicsObject = {
    coordinateSystem: "cartesian",
    texts: [
      {
        x: node.center.x,
        y: node.center.y + node.height / 2 + 1.1,
        text: `${board} · ${exactTests} exact cell tests`,
        fontSize: 0.55,
        color: "#172033",
      },
      {
        x: node.center.x,
        y: node.center.y - node.height / 2 - 0.9,
        text: "Blue fixed wire   ·   Amber tested area",
        fontSize: 0.38,
        color: "#475569",
      },
    ],
    rects: [
      {
        center: node.center,
        width: node.width,
        height: node.height,
        fill: "none",
        stroke: "#64748b",
      },
      {
        center: {
          x: ((bounds.minX + bounds.maxX) / 2) * transform.a + transform.c,
          y: ((bounds.minY + bounds.maxY) / 2) * transform.e + transform.f,
        },
        width: (bounds.maxX - bounds.minX) * Math.abs(transform.a),
        height: (bounds.maxY - bounds.minY) * Math.abs(transform.e),
        fill: "rgba(245, 174, 49, 0.22)",
        stroke: "#b45309",
        label: "Bounds of cells tested for this fixed wire",
      },
    ],
    lines: [
      {
        points: wire.route,
        strokeWidth: wire.traceThickness,
        strokeColor: "#1e3a8a",
        label: wire.connectionName,
      },
    ],
  }
  return {
    exactTests,
    traceCells: grid.obstacleTraceRootIdsFlat.filter(Boolean).length,
    viaCells: grid.obstacleViaRootIdsByCell.filter(Boolean).length,
    graphics,
  }
}
