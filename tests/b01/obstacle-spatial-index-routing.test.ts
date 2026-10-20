import { expect, test } from "bun:test"
import obstacleDatasetJson from "../../fixtures/obstacle-dataset01/obstacle-dataset01.json"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityObstacleDataset } from "../../lib/obstacle-dataset-types"
import { useFullScanObstacleQueries } from "../fixtures/useFullScanObstacleQueries"

test("B01 indexed obstacles preserve routing steps and reduce candidates", () => {
  const dataset = obstacleDatasetJson as HighDensityObstacleDataset
  let candidateCount = 0
  let fullScanCandidateCount = 0
  for (const sample of dataset.samples.slice(0, 12)) {
    const connectionNames = new Set(sample.connectionNamesToRoute)
    const props = {
      ...defaultB01Params,
      nodeWithPortPoints: {
        ...sample.nodeWithPortPoints,
        portPoints: sample.nodeWithPortPoints.portPoints.filter((point) => connectionNames.has(point.connectionName)),
      },
      obstacles: sample.obstacles,
      maxCellCount: 200_000,
    }
    const actual = new HighDensitySolverB01(structuredClone(props))
    const reference = new HighDensitySolverB01(structuredClone(props))
    actual.setup()
    reference.setup()
    useFullScanObstacleQueries(reference)
    for (const [indexName, primitiveName] of [
      ["obstacleTraceSpatialIndex", "obstacleTracePrimitives"],
      ["obstacleViaSpatialIndex", "obstacleViaPrimitives"],
      ["obstacleRectSpatialIndex", "obstacleRectPrimitives"],
    ] as const) {
      const index = actual[indexName]
      if (index === null) continue
      const search = index.search.bind(index)
      index.search = (...args): number[] => {
        const candidates = search(...args)
        candidateCount += candidates.length
        fullScanCandidateCount += actual[primitiveName].length
        return candidates
      }
    }
    while (!reference.solved && !reference.failed) {
      actual.step()
      reference.step()
      expect([actual.solved, actual.failed, actual.error]).toEqual([reference.solved, reference.failed, reference.error])
      expect(actual.openSet).toEqual(reference.openSet)
      expect(actual["nodePool"].length).toBe(reference["nodePool"].length)
      expect(actual["ripChain"].length).toBe(reference["ripChain"].length)
    }
    expect(actual.getOutput()).toEqual(reference.getOutput())
    expect(actual.iterations).toBe(reference.iterations)
    expect(actual["totalRipEvents"]).toBe(reference["totalRipEvents"])
    expect(actual["penalty2d"]).toEqual(reference["penalty2d"])
    expect(actual["usedCellsFlat"]).toEqual(reference["usedCellsFlat"])
  }
  expect(fullScanCandidateCount).toBeGreaterThan(100)
  expect(candidateCount).toBeLessThan(fullScanCandidateCount / 2)
})
