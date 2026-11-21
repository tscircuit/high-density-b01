import { expect, test } from "bun:test"
import "graphics-debug/matcher"
import { getFixedWireRasterSnapshot } from "../fixtures/getFixedWireRasterSnapshot"
import type { HighDensitySolverB01Props } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import input from "./fixtures/h616-fixed-wire-raster.json"

test("rasterizes the fixed wire in the H616 DDR repair window", async () => {
  const { graphics, exactTests, traceCells, viaCells } =
    getFixedWireRasterSnapshot(input as HighDensitySolverB01Props, "H616")
  expect(exactTests).toBe(1052)
  expect(traceCells).toBe(340)
  expect(viaCells).toBe(700)
  await expect(graphics).toMatchGraphicsSvg(import.meta.path)
})
