import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import type { HighDensityIntraNodeRoute } from "../../lib/types"

const boardEdgeColor = "#18212b"
const topTraceColor = "#c73c3c"
const bottomTraceColor = "#2459aa"
const viaColor = "#173975"

export function getBoardBoundarySnapshotSvg({
  board,
  routes,
  framePadding = 0,
  viaClearance,
}: {
  board: {
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
    outline?: readonly { x: number; y: number }[]
  }
  routes: readonly HighDensityIntraNodeRoute[]
  framePadding?: number
  viaClearance?: { measured: number; required: number }
}) {
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
      strokeColor: boardEdgeColor,
      strokeWidth: 0.04,
    },
  ]
  const circles: NonNullable<GraphicsObject["circles"]> = []

  for (const route of routes) {
    let start = 0
    for (let end = 1; end <= route.route.length; end++) {
      const layer = route.route[start]!.z
      if (route.route[end]?.z === layer) continue
      const points = route.route.slice(start, end)
      start = end
      if (points.length < 2) continue
      lines.push({
        points,
        strokeColor: layer === 0 ? topTraceColor : bottomTraceColor,
        strokeDash: layer === 0 ? undefined : "5 3",
        strokeWidth: route.traceThickness,
      })
    }
    for (const via of route.vias) {
      circles.push({
        center: via,
        radius: route.viaDiameter / 2,
        stroke: viaColor,
        fill: "rgba(36,89,170,0.25)",
      })
    }
  }

  const texts: NonNullable<GraphicsObject["texts"]> = []
  if (viaClearance) {
    const [via] = circles
    if (circles.length !== 1 || !via) {
      throw new Error("Expected one via in the board clearance snapshot")
    }
    const { measured, required } = viaClearance
    const left = minX + 0.25
    const viaLabelX = via.center.x + via.radius + 0.42
    const edgeLabelY = via.center.y - 0.62
    lines.push(
      {
        points: [
          { x: via.center.x + via.radius, y: via.center.y },
          { x: viaLabelX - 0.08, y: via.center.y },
        ],
        strokeColor: viaColor,
      },
      {
        points: [
          { x: minX, y: edgeLabelY },
          { x: left - 0.08, y: edgeLabelY },
        ],
        strokeColor: boardEdgeColor,
      },
    )
    texts.push(
      {
        x: left,
        y: maxY - 0.32,
        text: "Via clearance at the board edge",
        fontSize: 0.2,
        color: boardEdgeColor,
      },
      {
        x: left,
        y: maxY - 0.71,
        text: `${measured < 0 ? "Copper overhang" : "Copper gap"} ${Math.abs(measured).toFixed(3)} mm`,
        fontSize: 0.19,
        color: measured < required ? "#a52325" : "#176844",
      },
      {
        x: left,
        y: maxY - 0.98,
        text: `Minimum gap ${required.toFixed(2)} mm · Via diameter ${(2 * via.radius).toFixed(2)} mm`,
        fontSize: 0.14,
        color: boardEdgeColor,
      },
      {
        x: viaLabelX,
        y: via.center.y,
        text: "Via copper",
        fontSize: 0.15,
        color: viaColor,
      },
      {
        x: left,
        y: edgeLabelY,
        text: "Physical board edge",
        fontSize: 0.15,
        color: boardEdgeColor,
      },
      {
        x: left,
        y: minY + 0.62,
        text: "Top trace (solid)",
        fontSize: 0.14,
        color: topTraceColor,
      },
      {
        x: left,
        y: minY + 0.34,
        text: "Bottom trace (dashed)",
        fontSize: 0.14,
        color: bottomTraceColor,
      },
    )
    for (const text of texts) text.anchorSide = "center_left"
  }

  // Keep the board in the same frame when via copper extends outside it.
  const points = framePadding
    ? [
        {
          x: minX - framePadding,
          y: minY - framePadding,
          color: "transparent",
        },
        {
          x: maxX + framePadding,
          y: maxY + framePadding,
          color: "transparent",
        },
      ]
    : undefined
  return getSvgFromGraphicsObject(
    { coordinateSystem: "cartesian", lines, circles, points, texts },
    { backgroundColor: "white" },
  ).replace(/[ \t]+$/gm, "")
}
