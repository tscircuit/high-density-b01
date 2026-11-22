import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import type { NodeWithPortPoints } from "../../lib/types"

type BoardOverview = GraphicsObject &
  Required<Pick<GraphicsObject, "rects" | "circles">>

type DdrRoutingWindow = {
  board: "a64" | "stmp157"
  node: Pick<NodeWithPortPoints, "center" | "width" | "height">
  detail: GraphicsObject
}

export function getDdrRoutingWindowSvg({
  board,
  node,
  detail,
}: DdrRoutingWindow): string {
  const boardFile = new URL(`./${board}-fixed-copper.json.gz`, import.meta.url)
  const overview: BoardOverview = JSON.parse(
    gunzipSync(readFileSync(boardFile)).toString("utf8"),
  )
  overview.rects.push({
    center: node.center,
    width: node.width,
    height: node.height,
    fill: "rgba(245,158,11,0.22)",
    stroke: "#92400e",
  })
  overview.circles.push({
    center: node.center,
    radius: Math.max(node.width, node.height) / 2 + 1.35,
    fill: "none",
    stroke: "#92400e",
  })
  const panel = {
    svgWidth: 535,
    svgHeight: 460,
    backgroundColor: "white",
  } as const
  const boardSvg = getSvgFromGraphicsObject(overview, panel)
  const detailSvg = getSvgFromGraphicsObject(detail, panel)
  const boardName = board === "a64" ? "Allwinner A64" : "STM32MP157"
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1110" height="555" viewBox="0 0 1110 555">
  <metadata>Board geometry adapted from OLIMEX Ltd. OLINUXINO hardware under CC BY-SA 3.0 US (https://creativecommons.org/licenses/by-sa/3.0/us/).</metadata>
  <rect width="1110" height="555" fill="white"/>
  <g font-family="sans-serif" fill="#172033">
    <text x="20" y="32" font-size="23">${boardName} DDR routing window</text>
    <text x="20" y="65" font-size="16">Board with fixed copper</text>
    <text x="567" y="65" font-size="16">Selected routing window</text>
  </g>
  <g transform="translate(6 70)">${boardSvg}</g>
  <g transform="translate(555 70)">${detailSvg}</g>
</svg>`.replace(/[ \t]+$/gm, "")
}
