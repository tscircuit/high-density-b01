import obstacleDatasetJson from "../fixtures/obstacle-dataset01/obstacle-dataset01.json"
import { defaultB01Params } from "../lib/default-params"
import { HighDensitySolverB01 } from "../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityObstacleDataset } from "../lib/obstacle-dataset-types"
import { findRouteGeometryViolations } from "../lib/routeGeometryValidation"
import type {
  ObstacleBenchmarkGridStats,
  ObstacleBenchmarkResult,
  ObstacleBenchmarkWorkerOptions,
  ObstacleBenchmarkWorkerRequest,
} from "./benchmark-obstacle-dataset01-common"

const obstacleDataset = obstacleDatasetJson as HighDensityObstacleDataset

function normalizeGridStats(
  stats: HighDensitySolverB01["gridStats"],
): ObstacleBenchmarkGridStats {
  return {
    cells: stats.cells,
    layers: stats.layers,
    states: stats.states,
    obstacleTraceBlockedCells: stats.obstacleTraceBlockedCells,
    obstacleViaBlockedCells: stats.obstacleViaBlockedCells,
    obstacleRootCount: stats.obstacleRootCount,
  }
}

function runSingleSample(
  sampleIndex: number,
  options: ObstacleBenchmarkWorkerOptions,
): ObstacleBenchmarkResult {
  const sample = obstacleDataset.samples[sampleIndex]
  if (!sample) {
    return {
      type: "result",
      sampleIndex,
      sampleId: "missing",
      sourceProblemId: -1,
      solved: false,
      valid: false,
      failed: true,
      iterations: 0,
      durationMs: 0,
      routeCount: 0,
      connectionCount: 0,
      violationCount: 0,
      error: `Obstacle dataset sample ${sampleIndex + 1} not found`,
    }
  }

  const connectionNamesToRoute = new Set(sample.connectionNamesToRoute)
  const nodeWithPortPoints = {
    ...sample.nodeWithPortPoints,
    portPoints: sample.nodeWithPortPoints.portPoints.filter((portPoint) =>
      connectionNamesToRoute.has(portPoint.connectionName),
    ),
  }

  try {
    const solver = new HighDensitySolverB01({
      ...defaultB01Params,
      nodeWithPortPoints,
      obstacles: sample.obstacles,
      maxCellCount: 200_000,
    })
    solver.MAX_ITERATIONS = options.maxIterations

    const start = performance.now()
    solver.solve()
    const durationMs = performance.now() - start
    const routes = solver.getOutput()
    const violations = findRouteGeometryViolations([
      ...sample.obstacles,
      ...routes,
    ])
    const connectionCount = sample.connectionNamesToRoute.length
    const valid = solver.solved && violations.length === 0

    return {
      type: "result",
      sampleIndex,
      sampleId: sample.sampleId,
      sourceProblemId: sample.sourceProblemId,
      solved: solver.solved,
      valid,
      failed: solver.failed,
      iterations: solver.iterations,
      durationMs,
      routeCount: routes.length,
      connectionCount,
      violationCount: violations.length,
      error: solver.error,
      gridStats: options.collectStats
        ? normalizeGridStats(solver.gridStats)
        : undefined,
    }
  } catch (error) {
    return {
      type: "result",
      sampleIndex,
      sampleId: sample.sampleId,
      sourceProblemId: sample.sourceProblemId,
      solved: false,
      valid: false,
      failed: true,
      iterations: 0,
      durationMs: 0,
      routeCount: 0,
      connectionCount: sample.connectionNamesToRoute.length,
      violationCount: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

self.onmessage = (event: MessageEvent<ObstacleBenchmarkWorkerRequest>) => {
  const message = event.data
  if (message.type === "shutdown") return
  self.postMessage(runSingleSample(message.sampleIndex, message.options))
}
