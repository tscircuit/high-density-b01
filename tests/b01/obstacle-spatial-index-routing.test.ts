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
  const workSnapshots = []
  for (const sample of dataset.samples.slice(0, 12)) {
    const previousCandidateCount = candidateCount
    const previousFullScanCandidateCount = fullScanCandidateCount
    let spatialQueries = 0
    let fullScanQueries = 0
    const connectionNames = new Set(sample.connectionNamesToRoute)
    const props = {
      ...defaultB01Params,
      nodeWithPortPoints: {
        ...sample.nodeWithPortPoints,
        portPoints: sample.nodeWithPortPoints.portPoints.filter((point) =>
          connectionNames.has(point.connectionName),
        ),
      },
      obstacles: sample.obstacles,
      maxCellCount: 200_000,
    }
    const actual = new HighDensitySolverB01(structuredClone(props))
    const reference = new HighDensitySolverB01(structuredClone(props))
    actual.setup()
    reference.setup()
    useFullScanObstacleQueries(reference)
    for (const indexName of [
      "obstacleTraceSpatialIndex",
      "obstacleViaSpatialIndex",
      "obstacleRectSpatialIndex",
    ] as const) {
      const index = actual[indexName]
      if (index === null) continue
      const search = index.search.bind(index)
      index.search = (...args): number[] => {
        const candidates = search(...args)
        spatialQueries++
        candidateCount += candidates.length
        return candidates
      }
      const originalIndex = reference[indexName]!
      const fullScan = originalIndex.search.bind(originalIndex)
      originalIndex.search = (...args): number[] => {
        const candidates = fullScan(...args)
        fullScanQueries++
        fullScanCandidateCount += candidates.length
        return candidates
      }
    }
    while (!reference.solved && !reference.failed) {
      actual.step()
      reference.step()
      expect([actual.solved, actual.failed, actual.error]).toEqual([
        reference.solved,
        reference.failed,
        reference.error,
      ])
      expect(actual.openSet).toEqual(reference.openSet)
      expect(actual["nodePool"].length).toBe(reference["nodePool"].length)
      expect(actual["ripChain"].length).toBe(reference["ripChain"].length)
    }
    expect(actual.getOutput()).toEqual(reference.getOutput())
    expect(actual.iterations).toBe(reference.iterations)
    expect(actual["totalRipEvents"]).toBe(reference["totalRipEvents"])
    expect(actual["penalty2d"]).toEqual(reference["penalty2d"])
    expect(actual["usedCellsFlat"]).toEqual(reference["usedCellsFlat"])
    expect(spatialQueries).toBe(fullScanQueries)
    // Candidates are entries returned to the unchanged exact-geometry loops,
    // before their layer/net filters and possible early exits. They are not
    // timings or counts of exact predicates that actually execute.
    workSnapshots.push({
      sample: sample.sampleId,
      beforeFullScan: {
        queries: fullScanQueries,
        returnedObstacleCandidates:
          fullScanCandidateCount - previousFullScanCandidateCount,
      },
      afterSpatialIndex: {
        queries: spatialQueries,
        returnedObstacleCandidates: candidateCount - previousCandidateCount,
      },
      preservedRouting: {
        solved: actual.solved,
        failed: actual.failed,
        // Absolute iteration counts are compared live above. Record their
        // equality here so shared runtime changes do not rewrite this golden.
        iterationDeltaFromFullScan: actual.iterations - reference.iterations,
        ripEvents: actual["totalRipEvents"],
        routeCount: actual.getOutput().length,
      },
    })
  }
  expect(fullScanCandidateCount).toBeGreaterThan(100)
  expect(candidateCount).toBeLessThan(fullScanCandidateCount / 2)
  expect(workSnapshots).toMatchSnapshot(
    "same routing with fewer candidates offered to exact obstacle checks",
  )
})
