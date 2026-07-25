export type ObstacleBenchmarkGridStats = {
  cells: number
  layers: number
  states: number
  obstacleTraceBlockedCells: number
  obstacleViaBlockedCells: number
  obstacleRootCount: number
}

export type ObstacleBenchmarkResult = {
  type: "result"
  sampleIndex: number
  sampleId: string
  sourceProblemId: number
  solved: boolean
  valid: boolean
  failed: boolean
  iterations: number
  durationMs: number
  routeCount: number
  connectionCount: number
  violationCount: number
  error: string | null
  gridStats?: ObstacleBenchmarkGridStats
}

export type ObstacleBenchmarkWorkerOptions = {
  maxIterations: number
  collectStats: boolean
}

export type ObstacleBenchmarkWorkerRequest =
  | {
      type: "run"
      sampleIndex: number
      options: ObstacleBenchmarkWorkerOptions
    }
  | {
      type: "shutdown"
    }
