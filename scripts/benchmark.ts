import obstacleDatasetJson from "../fixtures/obstacle-dataset01/obstacle-dataset01.json"
import type { HighDensityObstacleDataset } from "../lib/obstacle-dataset-types"
import type {
  ObstacleBenchmarkResult,
  ObstacleBenchmarkWorkerOptions,
  ObstacleBenchmarkWorkerRequest,
} from "./benchmark-obstacle-dataset01-common"

type CliOptions = {
  maxIterations: number
  limit?: number
  sample?: number
  concurrency: number
  showStats: boolean
}

const obstacleDataset = obstacleDatasetJson as HighDensityObstacleDataset

const HELP_TEXT = `
Usage: ./benchmark.sh [options]

Runs HighDensitySolverB01 against obstacle-dataset01. Each sample contains
frozen routes produced by A03 and asks B01 to route the remaining connections.
A sample is valid only when all requested routes are produced and the combined
pre-routed plus newly routed geometry has no DRC violations.

Options:
  --concurrency N       Number of worker loops (default: 4)
  --limit N             Only run the first N samples
  --sample N            Run one 1-based sample number
  --max-iterations N    Solver MAX_ITERATIONS (default: 1000000)
  --stats               Print average obstacle grid stats
  --help, -h            Show this help message
`.trim()

function parsePositiveInteger(rawValue: string, optionName: string): number {
  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be a positive integer`)
  }
  return parsed
}

function parseArgs(argv: string[]): CliOptions | null {
  let maxIterations = 1_000_000
  let limit: number | undefined
  let sample: number | undefined
  let concurrency = 4
  let showStats = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    const takeValue = () => {
      const next = argv[index + 1]
      if (next === undefined) throw new Error(`Missing value for ${arg}`)
      index += 1
      return next
    }

    if (arg === "--help" || arg === "-h") {
      console.log(HELP_TEXT)
      return null
    }
    if (arg === "--concurrency") {
      concurrency = parsePositiveInteger(takeValue(), "--concurrency")
      continue
    }
    if (arg.startsWith("--concurrency=")) {
      concurrency = parsePositiveInteger(
        arg.slice("--concurrency=".length),
        "--concurrency",
      )
      continue
    }
    if (arg === "--limit") {
      limit = parsePositiveInteger(takeValue(), "--limit")
      continue
    }
    if (arg.startsWith("--limit=")) {
      limit = parsePositiveInteger(arg.slice("--limit=".length), "--limit")
      continue
    }
    if (arg === "--sample") {
      sample = parsePositiveInteger(takeValue(), "--sample")
      continue
    }
    if (arg.startsWith("--sample=")) {
      sample = parsePositiveInteger(arg.slice("--sample=".length), "--sample")
      continue
    }
    if (arg === "--max-iterations") {
      maxIterations = parsePositiveInteger(takeValue(), "--max-iterations")
      continue
    }
    if (arg.startsWith("--max-iterations=")) {
      maxIterations = parsePositiveInteger(
        arg.slice("--max-iterations=".length),
        "--max-iterations",
      )
      continue
    }
    if (arg === "--stats") {
      showStats = true
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  if (limit !== undefined && sample !== undefined) {
    throw new Error("--limit and --sample cannot be used together")
  }

  return {
    maxIterations,
    limit,
    sample,
    concurrency,
    showStats,
  }
}

function getPercentileDurationMs(
  results: ObstacleBenchmarkResult[],
  percentile: number,
): number {
  if (results.length === 0) return 0
  const durations = results
    .map((result) => result.durationMs)
    .sort((firstDuration, secondDuration) => firstDuration - secondDuration)
  const percentileIndex = Math.min(
    durations.length - 1,
    Math.ceil(percentile * durations.length) - 1,
  )
  return durations[percentileIndex]!
}

async function runBenchmark(
  options: CliOptions,
  sampleIndices: number[],
): Promise<void> {
  const workerCount = Math.min(options.concurrency, sampleIndices.length)
  const results = new Map<number, ObstacleBenchmarkResult>()
  const workerOptions: ObstacleBenchmarkWorkerOptions = {
    maxIterations: options.maxIterations,
    collectStats: options.showStats,
  }
  const workerScriptUrl = new URL(
    "./benchmark-obstacle-dataset01.worker.ts",
    import.meta.url,
  )
  const workers = Array.from(
    { length: workerCount },
    () => new Worker(workerScriptUrl.href, { type: "module" }),
  )

  let nextJobPointer = 0
  let processedCount = 0
  let solvedCount = 0
  let validCount = 0
  let failedCount = 0

  const assignJob = (worker: Worker) => {
    const sampleIndex = sampleIndices[nextJobPointer]
    if (sampleIndex === undefined) {
      worker.postMessage({
        type: "shutdown",
      } satisfies ObstacleBenchmarkWorkerRequest)
      return
    }
    nextJobPointer += 1
    worker.postMessage({
      type: "run",
      sampleIndex,
      options: workerOptions,
    } satisfies ObstacleBenchmarkWorkerRequest)
  }

  const start = performance.now()
  await new Promise<void>((resolve, reject) => {
    let done = false
    for (let workerIndex = 0; workerIndex < workers.length; workerIndex += 1) {
      const worker = workers[workerIndex]!
      worker.onmessage = (event: MessageEvent<ObstacleBenchmarkResult>) => {
        const result = event.data
        results.set(result.sampleIndex, result)
        processedCount += 1
        if (result.solved) solvedCount += 1
        if (result.valid) validCount += 1
        if (result.failed) failedCount += 1

        const status = result.valid
          ? "valid"
          : result.solved
            ? "invalid"
            : result.failed
              ? "failed"
              : "incomplete"
        console.log(
          `[worker ${workerIndex + 1}] sample=${result.sampleIndex + 1} source=${result.sourceProblemId} progress=${processedCount}/${sampleIndices.length} status=${status} duration=${(result.durationMs / 1000).toFixed(3)}s iterations=${result.iterations} routes=${result.routeCount} connections=${result.connectionCount} violations=${result.violationCount} valid=${validCount}/${processedCount} (${((validCount / processedCount) * 100).toFixed(1)}%)`,
        )
        if (result.error) console.log(`  error: ${result.error}`)

        if (processedCount >= sampleIndices.length && !done) {
          done = true
          for (const activeWorker of workers) activeWorker.terminate()
          resolve()
          return
        }
        assignJob(worker)
      }
      worker.onerror = (error) => {
        if (done) return
        done = true
        for (const activeWorker of workers) activeWorker.terminate()
        reject(error)
      }
      assignJob(worker)
    }
  })

  const completedResults = [...results.values()]
  const wallTimeMs = performance.now() - start
  const averageDurationMs =
    completedResults.reduce((sum, result) => sum + result.durationMs, 0) /
    Math.max(1, completedResults.length)
  const averageIterations =
    completedResults.reduce((sum, result) => sum + result.iterations, 0) /
    Math.max(1, completedResults.length)

  console.log()
  console.log("B01 obstacle-dataset01 summary:")
  console.log(`  processed=${processedCount}/${sampleIndices.length}`)
  console.log(
    `  solved=${solvedCount}/${processedCount} (${((solvedCount / processedCount) * 100).toFixed(1)}%)`,
  )
  console.log(
    `  valid=${validCount}/${processedCount} (${((validCount / processedCount) * 100).toFixed(1)}%)`,
  )
  console.log(`  failed=${failedCount}`)
  console.log(
    `  P50 duration=${(getPercentileDurationMs(completedResults, 0.5) / 1000).toFixed(3)}s`,
  )
  console.log(
    `  P95 duration=${(getPercentileDurationMs(completedResults, 0.95) / 1000).toFixed(3)}s`,
  )
  console.log(`  avg duration=${(averageDurationMs / 1000).toFixed(3)}s`)
  console.log(`  avgIterations=${averageIterations.toFixed(0)}`)
  console.log(`  wallTime=${(wallTimeMs / 1000).toFixed(3)}s`)

  if (options.showStats) {
    const resultsWithStats = completedResults.filter(
      (result) => result.gridStats !== undefined,
    )
    const average = (
      pick: (
        stats: NonNullable<ObstacleBenchmarkResult["gridStats"]>,
      ) => number,
    ) =>
      resultsWithStats.reduce(
        (sum, result) => sum + pick(result.gridStats!),
        0,
      ) / Math.max(1, resultsWithStats.length)

    console.log("  gridStats:")
    console.log(`    cells=${average((stats) => stats.cells).toFixed(0)}`)
    console.log(`    layers=${average((stats) => stats.layers).toFixed(1)}`)
    console.log(
      `    obstacleTraceBlockedCells=${average((stats) => stats.obstacleTraceBlockedCells).toFixed(0)}`,
    )
    console.log(
      `    obstacleViaBlockedCells=${average((stats) => stats.obstacleViaBlockedCells).toFixed(0)}`,
    )
    console.log(
      `    obstacleRootCount=${average((stats) => stats.obstacleRootCount).toFixed(1)}`,
    )
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  if (options === null) return

  const datasetSize = obstacleDataset.samples.length
  if (options.sample !== undefined && options.sample > datasetSize) {
    throw new Error(`--sample must be between 1 and ${datasetSize}`)
  }
  const sampleCount =
    options.limit === undefined
      ? datasetSize
      : Math.min(datasetSize, options.limit)
  const sampleIndices =
    options.sample === undefined
      ? Array.from({ length: sampleCount }, (_, index) => index)
      : [options.sample - 1]

  console.log("HighDensitySolverB01 obstacle benchmark")
  console.log("=".repeat(72))
  console.log(`Dataset: obstacle-dataset01`)
  console.log(`Samples: ${sampleIndices.length}/${datasetSize}`)
  console.log(`Workers: ${Math.min(options.concurrency, sampleIndices.length)}`)
  console.log(`Max iterations: ${options.maxIterations}`)
  await runBenchmark(options, sampleIndices)
}

await main()
