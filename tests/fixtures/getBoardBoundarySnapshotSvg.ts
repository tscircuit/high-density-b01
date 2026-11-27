import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import type { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

export function getBoardBoundarySnapshotSvg(solver: HighDensitySolverB01) {
  const board = solver.boardGeometry
  if (!board) throw new Error("Expected board geometry for the snapshot")

  const { minX, minY, maxX, maxY } = board.bounds
  const outline = board.outline ?? [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
  const lines: NonNullable<GraphicsObject["lines"]> = [
    {
      points: [...outline, outline[0]!],
      strokeColor: "#18212b",
      strokeWidth: "3px",
    },
  ]
  const circles: NonNullable<GraphicsObject["circles"]> = []

  for (const route of solver.getOutput()) {
    let start = 0
    for (let end = 1; end <= route.route.length; end++) {
      const layer = route.route[start]!.z
      if (route.route[end]?.z === layer) continue
      const points = route.route.slice(start, end)
      start = end
      if (points.length < 2) continue
      lines.push({
        points,
        strokeColor: layer === 0 ? "#c73c3c" : "#2459aa",
        strokeDash: layer === 0 ? undefined : "5 3",
        strokeWidth: route.traceThickness,
      })
    }
    for (const via of route.vias) {
      circles.push({
        center: via,
        radius: route.viaDiameter / 2,
        stroke: "#173975",
        fill: "rgba(36,89,170,0.25)",
      })
    }
  }

  return getSvgFromGraphicsObject(
    { coordinateSystem: "cartesian", lines, circles },
    { backgroundColor: "white" },
  ).replace(/[ \t]+$/gm, "")
}
