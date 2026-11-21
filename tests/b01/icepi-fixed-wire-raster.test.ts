import { expect, test } from "bun:test"
import "graphics-debug/matcher"
import { getFixedWireRasterSnapshot } from "../fixtures/getFixedWireRasterSnapshot"
import type { HighDensitySolverB01Props } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import input from "./fixtures/icepi-fixed-wire-raster.json"

test("rasterizes the fixed wire in the iCEPi DDR repair window", async () => {
  const { graphics, exactTests, traceCells, viaCells } =
    getFixedWireRasterSnapshot(input as HighDensitySolverB01Props, "iCEPi")
  expect(exactTests).toBe(1632)
  expect(traceCells).toBe(566)
  expect(viaCells).toBe(1052)
  await expect(graphics).toMatchGraphicsSvg(import.meta.path)
})
