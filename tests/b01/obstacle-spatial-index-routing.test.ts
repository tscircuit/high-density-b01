import { expect, test } from "bun:test"
import obstacleDatasetJson from "../../fixtures/obstacle-dataset01/obstacle-dataset01.json"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityObstacleDataset } from "../../lib/obstacle-dataset-types"
import { useFullScanObstacleQueries } from "../fixtures/useFullScanObstacleQueries"
import {
  afterColor,
  beforeColor,
  expectPerformanceSvg,
  performanceCanvas,
  projectVisual,
  visualMetric,
  visualPanel,
  visualText,
} from "../fixtures/performanceVisual"

test("B01 indexed obstacles preserve routing steps and reduce candidates", async (): Promise<void> => {
  const dataset = obstacleDatasetJson as HighDensityObstacleDataset
  let candidateCount = 0
  let fullScanCandidateCount = 0
  const workSnapshots = []
  let visualCase:
    | {
        solver: HighDensitySolverB01
        bounds: { minX: number; minY: number; maxX: number; maxY: number }
        candidates: number[]
      }
    | undefined
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
        if (
          !visualCase &&
          sample === dataset.samples[0] &&
          indexName === "obstacleTraceSpatialIndex" &&
          candidates.length > 0 &&
          candidates.length < actual["obstacleTracePrimitives"].length
        ) {
          visualCase = {
            solver: actual,
            bounds: {
              minX: args[0],
              minY: args[1],
              maxX: args[2],
              maxY: args[3],
            },
            candidates: [...candidates],
          }
        }
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
  if (!visualCase)
    throw new Error(
      "Expected a selective trace-obstacle query in the first routing fixture",
    )
  const primitives = visualCase.solver["obstacleTracePrimitives"]
  const routes = visualCase.solver.getOutput()
  const allPoints = [
    ...primitives.flatMap((primitive) => [
      primitive.segmentStart,
      primitive.segmentEnd,
    ]),
    ...routes.flatMap((route) => route.route),
  ]
  const bounds = {
    minX: Math.min(...allPoints.map((point) => point.x)) - 0.3,
    maxX: Math.max(...allPoints.map((point) => point.x)) + 0.3,
    minY: Math.min(...allPoints.map((point) => point.y)) - 0.3,
    maxY: Math.max(...allPoints.map((point) => point.y)) + 0.3,
  }
  const selected = new Set(visualCase.candidates)
  const graphics = performanceCanvas(
    "Reject distant obstacles before running the same exact collision tests",
    `Trace-obstacle detail from ${workSnapshots[0]!.sample}. Both panels retain exactly the same routed copper.`,
  )
  for (const [left, title, color] of [
    [24, "Before: every fixed trace is a candidate", beforeColor],
    [624, "After: only nearby traces are candidates", afterColor],
  ] as const) {
    const count = left === 24 ? primitives.length : selected.size
    visualPanel(
      graphics,
      left,
      title,
      `One real query offers ${count} trace candidates to the unchanged geometry loop.`,
      color,
    )
    const project = projectVisual(bounds, left + 28, 194, 496, 282)
    const scale = project({ x: 1, y: 0 }).x - project({ x: 0, y: 0 }).x
    for (const [index, primitive] of primitives.entries()) {
      const candidate = left === 24 || selected.has(index)
      graphics.lines.push({
        points: [
          project(primitive.segmentStart),
          project(primitive.segmentEnd),
        ],
        strokeWidth: Math.max(0.6, primitive.traceRadius * 2 * scale),
        strokeColor: candidate ? color : "#cbd5e1",
      })
    }
    for (const route of routes) {
      for (let index = 1; index < route.route.length; index++) {
        const a = route.route[index - 1]!
        const b = route.route[index]!
        if (a.z !== b.z) continue
        graphics.lines.push({
          points: [project(a), project(b)],
          strokeColor: "#2563eb",
          strokeWidth: route.traceThickness * scale,
          ...(a.z === 0 ? {} : { strokeDash: "5 3" }),
        })
      }
    }
    if (left !== 24) {
      for (const index of selected) {
        const primitive = primitives[index]!
        graphics.circles.push({
          center: project({
            x: (primitive.segmentStart.x + primitive.segmentEnd.x) / 2,
            y: (primitive.segmentStart.y + primitive.segmentEnd.y) / 2,
          }),
          radius: 5,
          fill: "transparent",
          stroke: afterColor,
        })
      }
    }
    const query = visualCase.bounds
    const queryCenter = project({
      x: (query.minX + query.maxX) / 2,
      y: (query.minY + query.maxY) / 2,
    })
    graphics.circles.push({
      center: queryCenter,
      radius: 13,
      fill: "transparent",
      stroke: "#0891b2",
    })
    graphics.arrows.push({
      start: { x: left + 424, y: 200 },
      end: queryCenter,
      color: "#0891b2",
    })
    visualText(graphics, left + 356, 187, "same query", 14, "#0891b2")
    visualText(
      graphics,
      left + 20,
      492,
      left === 24
        ? "Orange: candidates. Blue: routed copper. Cyan: query location."
        : "Gray: culled. Green rings: nearby candidates. Blue: routed copper.",
      13,
      "#64748b",
    )
  }
  visualMetric(
    graphics,
    "All obstacle candidates returned during this completed fixture",
    workSnapshots[0]!.beforeFullScan.returnedObstacleCandidates,
    workSnapshots[0]!.afterSpatialIndex.returnedObstacleCandidates,
    "All 12 fixtures preserve complete routing output, per-step state, iteration counts, rip events and penalties.",
  )
  await expectPerformanceSvg(graphics, import.meta.path)
})
