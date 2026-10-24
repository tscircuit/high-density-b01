import { expect, test } from "bun:test"
import obstacleDatasetJson from "../../fixtures/obstacle-dataset01/obstacle-dataset01.json"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityObstacleDataset } from "../../lib/obstacle-dataset-types"
import { SwapTypedMinHeap } from "../fixtures/SwapTypedMinHeap"

test("B01 hole sifts preserve real routing pops, iterations and copper for fixed seeds", (): void => {
  const dataset = obstacleDatasetJson as HighDensityObstacleDataset
  for (const sample of dataset.samples) {
    const names = new Set(sample.connectionNamesToRoute)
    for (const shuffleSeed of [0, 17]) {
      const props = {
        ...defaultB01Params,
        nodeWithPortPoints: {
          ...sample.nodeWithPortPoints,
          portPoints: sample.nodeWithPortPoints.portPoints.filter((point) => names.has(point.connectionName)),
        },
        obstacles: sample.obstacles,
        maxCellCount: 200_000,
        hyperParameters: { shuffleSeed },
      }
      const actual = new HighDensitySolverB01(structuredClone(props))
      const reference = new HighDensitySolverB01(structuredClone(props))
      actual.setup()
      reference.setup()
      reference["heap"] = new SwapTypedMinHeap() as unknown as HighDensitySolverB01["heap"]
      const pops: number[][] = [[], []]
      for (const [index, solver] of [actual, reference].entries()) {
        const heap = solver["heap"]
        const pop = heap.pop.bind(heap)
        heap.pop = (): number => {
          const id = pop()
          pops[index]!.push(id)
          return id
        }
        solver.solve()
      }
      expect(actual.solved).toBe(true)
      expect(actual.failed).toBe(reference.failed)
      expect(actual.error).toBe(reference.error)
      expect(actual.iterations).toBe(reference.iterations)
      expect(pops[0]).toEqual(pops[1])
      expect(actual.getOutput()).toEqual(reference.getOutput())
      expect(actual["totalRipEvents"]).toBe(reference["totalRipEvents"])
      expect(actual["penalty2d"]).toEqual(reference["penalty2d"])
      expect(actual["usedCellsFlat"]).toEqual(reference["usedCellsFlat"])
    }
  }
})
