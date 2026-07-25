import {
  datasetZ04ProblemCount,
  type Z04SampleResult,
  type Z04SolverKey,
  type Z04SolverMode,
  type Z04WorkerOptions,
} from "./run-dataset-z04-benchmark-common"

type CliOptions = {
  solverKeys: Z04SolverKey[]
  maxIterations: number
  limit?: number
  sample?: number
  concurrency: number
  showStats: boolean
  mode?: Z04SolverMode
}

type WorkerRequest =
  | {
      type: "run"
      sampleIndex: number
      options: Z04WorkerOptions
    }
  | {
      type: "shutdown"
    }

type SolverSummary = {
  solverKey: Z04SolverKey
  solverLabel: string
  results: Z04SampleResult[]
  processedCount: number
  completedCount: number
  validCount: number
  failedCount: number
  avgDurationMs: number
  p50DurationMs: number
  p95DurationMs: number
  avgIterations: number
  totalWallTimeMs: number
}

const HELP_TEXT = `
Usage: ./benchmark.sh [options]

Runs the dataset Z04 benchmark for the selected solvers and reports both
per-solver results and the union of problems solved validly by any provided
solver.

Typical flow:
  ./benchmark.sh
  ./benchmark.sh --solver A01,A03 --limit 100

Options:
  --solver LIST         Comma-separated solver list (default: A03)
  --concurrency N       Number of worker loops per solver run (default: 4)
  --limit N             Only run first N problems
  --sample NUM          Run one 1-based problem number
  --mode MODE           Optional shared mode: default|repro|fast|strict
  --max-iterations N    Solver MAX_ITERATIONS (default: 1000000)
  --stats               Print average grid stats for each solver
  --help, -h            Show this help message
`.trim()

const SOLVER_LABELS: Record<Z04SolverKey, string> = {
  a01: "HighDensitySolverA01",
  a02: "HighDensitySolverA02",
  a03: "HighDensitySolverA03",
  a05: "HighDensitySolverA05",
  a08: "HighDensitySolverA08",
}

const CLI_TO_SOLVER_KEY: Record<string, Z04SolverKey> = {
  A01: "a01",
  A02: "a02",
  A03: "a03",
  A05: "a05",
  A08: "a08",
}

const MODE_COMPATIBILITY: Record<Z04SolverKey, readonly Z04SolverMode[]> = {
  a01: [],
  a02: ["fast", "strict"],
  a03: ["default", "repro"],
  a05: ["default", "repro"],
  a08: [],
}

function parsePositiveInteger(rawValue: string, optionName: string): number {
  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be a positive integer`)
  }
  return parsed
}

function parseMode(value: string): Z04SolverMode {
  if (
    value === "default" ||
    value === "repro" ||
    value === "fast" ||
    value === "strict"
  ) {
    return value
  }
  throw new Error(`Unknown mode: ${value}`)
}

function parseSolverList(value: string): Z04SolverKey[] {
  const tokens = value
    .split(",")
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)

  if (tokens.length === 0) {
    throw new Error("--solver must include at least one solver")
  }

  const solverKeys: Z04SolverKey[] = []
  const seen = new Set<Z04SolverKey>()
  for (const token of tokens) {
    const solverKey = CLI_TO_SOLVER_KEY[token]
    if (!solverKey) {
      throw new Error(`Unknown solver: ${token}`)
    }
    if (!seen.has(solverKey)) {
      seen.add(solverKey)
      solverKeys.push(solverKey)
    }
  }
  return solverKeys
}

function parseArgs(argv: string[]): CliOptions | null {
  let solverKeys: Z04SolverKey[] = ["a03"]
  let maxIterations = 1_000_000
  let limit: number | undefined
  let sample: number | undefined
  let concurrency = 4
  let showStats = false
  let mode: Z04SolverMode | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    const takeValue = () => {
      const next = argv[index + 1]
      if (next === undefined) {
        throw new Error(`Missing value for ${arg}`)
      }
      index += 1
      return next
    }

    if (arg === "--help" || arg === "-h") {
      console.log(HELP_TEXT)
      return null
    }

    if (arg === "--solver") {
      solverKeys = parseSolverList(takeValue())
      continue
    }

    if (arg.startsWith("--solver=")) {
      solverKeys = parseSolverList(arg.slice("--solver=".length))
      continue
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

    if (arg === "--mode") {
      mode = parseMode(takeValue())
      continue
    }

    if (arg.startsWith("--mode=")) {
      mode = parseMode(arg.slice("--mode=".length))
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
    solverKeys,
    maxIterations,
    limit,
    sample,
    concurrency,
    showStats,
    mode,
  }
}

function getModeForSolver(
  solverKey: Z04SolverKey,
  mode: Z04SolverMode | undefined,
): Z04SolverMode | undefined {
  if (!mode) return undefined
  return MODE_COMPATIBILITY[solverKey].includes(mode) ? mode : undefined
}

function formatSolverName(solverKey: Z04SolverKey) {
  return solverKey.toUpperCase()
}

function getPercentileDurationMs(
  results: Z04SampleResult[],
  percentile: number,
): number {
  if (results.length === 0) return 0
  const sortedDurations = results
    .map((result) => result.durationMs)
    .sort((firstDuration, secondDuration) => firstDuration - secondDuration)
  const percentileIndex = Math.min(
    sortedDurations.length - 1,
    Math.ceil(percentile * sortedDurations.length) - 1,
  )
  return sortedDurations[percentileIndex]!
}

async function runSolverBenchmark(
  solverKey: Z04SolverKey,
  options: CliOptions,
  sampleIndices: number[],
): Promise<SolverSummary> {
  const sampleCount = sampleIndices.length
  const workerCount = Math.min(options.concurrency, sampleIndices.length)
  const results: Array<Z04SampleResult | undefined> = new Array(sampleCount)
  const workerOptions: Z04WorkerOptions = {
    solverKey,
    solverMode: getModeForSolver(solverKey, options.mode),
    maxIterations: options.maxIterations,
    collectStats: options.showStats,
  }

  let nextJobPointer = 0
  let processedCount = 0
  let completedCount = 0
  let validCount = 0
  let failedCount = 0

  const workerScriptUrl = new URL(
    "./run-dataset-z04-benchmark.worker.ts",
    import.meta.url,
  )

  const benchmarkStart = performance.now()
  const workers = Array.from(
    { length: workerCount },
    () => new Worker(workerScriptUrl.href, { type: "module" }),
  )

  const assignJob = (worker: Worker) => {
    const sampleIndex = sampleIndices[nextJobPointer]
    if (sampleIndex === undefined) {
      worker.postMessage({ type: "shutdown" } satisfies WorkerRequest)
      return
    }
    nextJobPointer += 1
    worker.postMessage({
      type: "run",
      sampleIndex,
      options: workerOptions,
    } satisfies WorkerRequest)
  }

  console.log()
  console.log(
    `Running ${formatSolverName(solverKey)} (${SOLVER_LABELS[solverKey]}) on ${sampleCount}/${datasetZ04ProblemCount} problems`,
  )
  if (workerOptions.solverMode) {
    console.log(`Mode: ${workerOptions.solverMode}`)
  }
  console.log(`Workers: ${workerCount}`)
  console.log(`Max iterations: ${options.maxIterations}`)

  await new Promise<void>((resolve, reject) => {
    let done = false

    for (let workerIndex = 0; workerIndex < workers.length; workerIndex += 1) {
      const worker = workers[workerIndex]!

      worker.onmessage = (event: MessageEvent<Z04SampleResult>) => {
        const result = event.data
        results[result.sampleIndex] = result

        processedCount += 1
        if (result.solved) completedCount += 1
        if (result.valid) validCount += 1
        if (result.failed) failedCount += 1

        const completedRate =
          (completedCount / Math.max(1, processedCount)) * 100
        const validRate = (validCount / Math.max(1, processedCount)) * 100
        const status = result.valid
          ? "valid"
          : result.solved
            ? "invalid"
            : result.failed
              ? "failed"
              : "incomplete"

        console.log(
          `[${formatSolverName(solverKey)} worker ${workerIndex + 1}] problem ${result.problemId} progress=${processedCount}/${sampleCount} status=${status} duration=${(result.durationMs / 1000).toFixed(3)}s iterations=${result.iterations} routes=${result.routes} violations=${result.violationCount} completed=${completedCount}/${processedCount} (${completedRate.toFixed(1)}%) valid=${validCount}/${processedCount} (${validRate.toFixed(1)}%)`,
        )
        if (result.error) {
          console.log(`  error: ${result.error}`)
        }

        if (processedCount >= sampleCount && !done) {
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

  const totalWallTimeMs = performance.now() - benchmarkStart
  const completedResults = results.filter((result): result is Z04SampleResult =>
    Boolean(result),
  )
  const avgDurationMs =
    completedResults.reduce((sum, result) => sum + result.durationMs, 0) /
    Math.max(1, completedResults.length)
  const p50DurationMs = getPercentileDurationMs(completedResults, 0.5)
  const p95DurationMs = getPercentileDurationMs(completedResults, 0.95)
  const avgIterations =
    completedResults.reduce((sum, result) => sum + result.iterations, 0) /
    Math.max(1, completedResults.length)

  console.log(`${formatSolverName(solverKey)} summary:`)
  console.log(`  processed=${completedResults.length}/${sampleCount}`)
  console.log(`  completed=${completedCount}`)
  console.log(`  valid=${validCount}`)
  console.log(`  failed=${failedCount}`)
  console.log(
    `  completionRate=${((completedCount / Math.max(1, completedResults.length)) * 100).toFixed(1)}%`,
  )
  console.log(
    `  validRate=${((validCount / Math.max(1, completedResults.length)) * 100).toFixed(1)}%`,
  )
  console.log(`  P50 duration=${(p50DurationMs / 1000).toFixed(3)}s`)
  console.log(`  P95 duration=${(p95DurationMs / 1000).toFixed(3)}s`)
  console.log(`  avg duration=${(avgDurationMs / 1000).toFixed(3)}s`)
  console.log(`  avgIterations=${avgIterations.toFixed(0)}`)
  console.log(`  wallTime=${(totalWallTimeMs / 1000).toFixed(2)}s`)

  if (options.showStats && completedResults.length > 0) {
    const average = (pick: (result: Z04SampleResult) => number) =>
      completedResults.reduce((sum, result) => sum + pick(result), 0) /
      Math.max(1, completedResults.length)

    console.log("  gridStats:")
    console.log(
      `    cells=${average((r) => r.gridStats?.cells ?? 0).toFixed(0)}`,
    )
    console.log(
      `    layers=${average((r) => r.gridStats?.layers ?? 0).toFixed(1)}`,
    )
    console.log(
      `    states=${average((r) => r.gridStats?.states ?? 0).toFixed(0)}`,
    )
    console.log(
      `    neighborEdges=${average((r) => r.gridStats?.neighborEdges ?? 0).toFixed(0)}`,
    )
    console.log(
      `    ripStateBuckets=${average((r) => r.gridStats?.ripStateBuckets ?? 0).toFixed(1)}`,
    )
  }

  return {
    solverKey,
    solverLabel: SOLVER_LABELS[solverKey],
    results: completedResults,
    processedCount: completedResults.length,
    completedCount,
    validCount,
    failedCount,
    avgDurationMs,
    p50DurationMs,
    p95DurationMs,
    avgIterations,
    totalWallTimeMs,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options === null) return

  if (options.sample !== undefined && options.sample > datasetZ04ProblemCount) {
    throw new Error(`--sample must be between 1 and ${datasetZ04ProblemCount}`)
  }
  const sampleCount =
    options.limit === undefined
      ? datasetZ04ProblemCount
      : Math.min(datasetZ04ProblemCount, options.limit)
  const sampleIndices =
    options.sample === undefined
      ? Array.from({ length: sampleCount }, (_, index) => index)
      : [options.sample - 1]
  const selectedSampleCount = sampleIndices.length

  console.log("Dataset Z04 benchmark")
  console.log("=".repeat(72))
  console.log(
    `Solvers: ${options.solverKeys.map((solverKey) => formatSolverName(solverKey)).join(", ")}`,
  )
  console.log(`Problems: ${selectedSampleCount}/${datasetZ04ProblemCount}`)
  console.log("Typical flow: ./benchmark.sh")

  const solverSummaries: SolverSummary[] = []
  for (const solverKey of options.solverKeys) {
    solverSummaries.push(
      await runSolverBenchmark(solverKey, options, sampleIndices),
    )
  }

  const unionValidProblemIds = new Set<number>()
  const unionCompletedProblemIds = new Set<number>()

  for (const summary of solverSummaries) {
    for (const result of summary.results) {
      if (result.solved) unionCompletedProblemIds.add(result.problemId)
      if (result.valid) unionValidProblemIds.add(result.problemId)
    }
  }

  console.log()
  console.log("Union summary:")
  console.log(
    `  validByAnySolver=${unionValidProblemIds.size}/${selectedSampleCount} (${((unionValidProblemIds.size / selectedSampleCount) * 100).toFixed(1)}%)`,
  )
  console.log(
    `  completedByAnySolver=${unionCompletedProblemIds.size}/${selectedSampleCount} (${((unionCompletedProblemIds.size / selectedSampleCount) * 100).toFixed(1)}%)`,
  )

  console.log()
  console.log("Per-solver valid counts:")
  for (const summary of solverSummaries) {
    console.log(
      `  ${formatSolverName(summary.solverKey)}=${summary.validCount}/${selectedSampleCount} (${((summary.validCount / selectedSampleCount) * 100).toFixed(1)}%)`,
    )
  }
}

await main()
