import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { hgProblems } from "high-density-dataset-z04"
import { HighDensitySolverA03 } from "../lib/HighDensitySolverA03/HighDensitySolverA03"
import { defaultA03Params } from "../lib/default-params"
import type {
  HighDensityObstacleDataset,
  HighDensityObstacleDatasetSample,
  HighDensityRouteObstacle,
} from "../lib/obstacle-dataset-types"
import { findRouteGeometryViolations } from "../lib/routeGeometryValidation"
import type {
  HighDensityIntraNodeRoute,
  NodeWithPortPoints,
  PortPoint,
} from "../lib/types"

type SourceProblem = {
  readonly id: number
  readonly data: SourceNodeWithPortPoints
}

type SourceNodeWithPortPoints = {
  readonly capacityMeshNodeId: string
  readonly center: { readonly x: number; readonly y: number }
  readonly width: number
  readonly height: number
  readonly portPoints: readonly Readonly<PortPoint>[]
  readonly availableZ?: readonly number[]
}

type GenerationOptions = {
  limit: number
  maxIterations: number
  outputPath: string
}

type SampleGenerationResult =
  | {
      isGenerated: true
      sample: HighDensityObstacleDatasetSample
    }
  | {
      isGenerated: false
      reason: string
    }

const DEFAULT_OUTPUT_PATH =
  "fixtures/obstacle-dataset01/obstacle-dataset01.json"
const SOURCE_DATASET_COMMIT = "137370563bd98310f08baa78f4800cd5a6849274"
const ROUTING_WINDOW_MAX_MM = 15

function parsePositiveInteger(rawText: string, optionName: string): number {
  const parsedNumber = Number.parseInt(rawText, 10)
  if (!Number.isFinite(parsedNumber) || parsedNumber < 1) {
    throw new Error(`${optionName} must be a positive integer`)
  }
  return parsedNumber
}

function parseGenerationOptions(argv: string[]): GenerationOptions | null {
  const options: GenerationOptions = {
    limit: 100,
    maxIterations: 1_000_000,
    outputPath: DEFAULT_OUTPUT_PATH,
  }

  for (const argument of argv) {
    if (argument === "--help" || argument === "-h") {
      console.log(`Usage: bun run generate:obstacle-dataset01 [options]

Options:
  --limit=N             Number of successful samples to write (default: 100)
  --max-iterations=N    A03 iteration cap per preroute solve (default: 1000000)
  --output=PATH         Output JSON path
  --help, -h            Show this help text`)
      return null
    }
    if (argument.startsWith("--limit=")) {
      options.limit = parsePositiveInteger(
        argument.slice("--limit=".length),
        "--limit",
      )
      continue
    }
    if (argument.startsWith("--max-iterations=")) {
      options.maxIterations = parsePositiveInteger(
        argument.slice("--max-iterations=".length),
        "--max-iterations",
      )
      continue
    }
    if (argument.startsWith("--output=")) {
      options.outputPath = argument.slice("--output=".length)
      if (!options.outputPath) throw new Error("--output cannot be empty")
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }

  return options
}

function getSortedConnectionNames(
  nodeWithPortPoints: SourceNodeWithPortPoints,
): string[] {
  return [
    ...new Set(
      nodeWithPortPoints.portPoints.map(
        (portPoint) => portPoint.connectionName,
      ),
    ),
  ].sort((firstName, secondName) => firstName.localeCompare(secondName))
}

function copySourceNodeWithPortPoints(
  sourceNodeWithPortPoints: SourceNodeWithPortPoints,
): NodeWithPortPoints {
  return {
    capacityMeshNodeId: sourceNodeWithPortPoints.capacityMeshNodeId,
    center: { ...sourceNodeWithPortPoints.center },
    width: sourceNodeWithPortPoints.width,
    height: sourceNodeWithPortPoints.height,
    portPoints: sourceNodeWithPortPoints.portPoints.map((portPoint) => ({
      ...portPoint,
    })),
    availableZ: sourceNodeWithPortPoints.availableZ
      ? [...sourceNodeWithPortPoints.availableZ]
      : undefined,
  }
}

function isEligibleProblem(sourceProblem: SourceProblem): boolean {
  const { data: nodeWithPortPoints } = sourceProblem
  const connectionCount = getSortedConnectionNames(nodeWithPortPoints).length

  return (
    nodeWithPortPoints.width <= ROUTING_WINDOW_MAX_MM &&
    nodeWithPortPoints.height <= ROUTING_WINDOW_MAX_MM &&
    connectionCount >= 4
  )
}

function getSourceProblemSelectionRank(sourceProblem: SourceProblem): number {
  return Math.imul(sourceProblem.id, -1640531527) >>> 0
}

function toRouteObstacle(
  route: HighDensityIntraNodeRoute,
  rootConnectionName: string | undefined,
): HighDensityRouteObstacle {
  return {
    type: "route",
    connectionName: route.connectionName,
    rootConnectionName,
    traceThickness: route.traceThickness,
    viaDiameter: route.viaDiameter,
    route: route.route,
    vias: route.vias,
  }
}

function getRootConnectionName(
  connectionName: string,
  nodeWithPortPoints: NodeWithPortPoints,
): string | undefined {
  const matchingPortPoint = nodeWithPortPoints.portPoints.find(
    (portPoint) => portPoint.connectionName === connectionName,
  )
  return matchingPortPoint?.rootConnectionName
}

function generateObstacleSample(
  sourceProblem: SourceProblem,
  options: GenerationOptions,
): SampleGenerationResult {
  const connectionNames = getSortedConnectionNames(sourceProblem.data)
  const nodeWithPortPoints = copySourceNodeWithPortPoints(sourceProblem.data)
  const preRoutedConnectionCount = Math.floor(connectionNames.length / 2)
  const preRoutedConnectionNames = connectionNames.slice(
    0,
    preRoutedConnectionCount,
  )
  const connectionNamesToRoute = connectionNames.slice(preRoutedConnectionCount)
  const preRoutedConnectionNameSet = new Set(preRoutedConnectionNames)
  const preRouteNodeWithPortPoints: NodeWithPortPoints = {
    ...nodeWithPortPoints,
    capacityMeshNodeId: `${nodeWithPortPoints.capacityMeshNodeId}-preroute`,
    portPoints: nodeWithPortPoints.portPoints.filter((portPoint) =>
      preRoutedConnectionNameSet.has(portPoint.connectionName),
    ),
  }
  const solver = new HighDensitySolverA03({
    ...defaultA03Params,
    nodeWithPortPoints: preRouteNodeWithPortPoints,
    maxCellCount: 200_000,
  })
  solver.MAX_ITERATIONS = options.maxIterations
  solver.solve()

  if (!solver.solved) {
    return {
      isGenerated: false,
      reason: solver.error ?? "A03 did not solve the prerouted half",
    }
  }

  const routes = solver.getOutput()
  const violations = findRouteGeometryViolations(routes)
  if (violations.length > 0) {
    return {
      isGenerated: false,
      reason: `A03 preroute has ${violations.length} geometry violations`,
    }
  }

  return {
    isGenerated: true,
    sample: {
      sampleId: `obstacle01-source-z04-${sourceProblem.id}`,
      sourceProblemId: sourceProblem.id,
      nodeWithPortPoints,
      preRoutedConnectionNames,
      connectionNamesToRoute,
      obstacles: routes.map((route) =>
        toRouteObstacle(
          route,
          getRootConnectionName(route.connectionName, nodeWithPortPoints),
        ),
      ),
    },
  }
}

async function writeObstacleDataset(options: GenerationOptions): Promise<void> {
  const sourceProblems: SourceProblem[] = [...hgProblems]
    .filter(isEligibleProblem)
    .sort(
      (firstProblem, secondProblem) =>
        getSourceProblemSelectionRank(firstProblem) -
          getSourceProblemSelectionRank(secondProblem) ||
        firstProblem.id - secondProblem.id,
    )
  const samples: HighDensityObstacleDatasetSample[] = []

  for (const sourceProblem of sourceProblems) {
    if (samples.length >= options.limit) break
    const result = generateObstacleSample(sourceProblem, options)
    if (!result.isGenerated) {
      console.log(
        `sourceProblemId=${sourceProblem.id} skipped reason=${JSON.stringify(result.reason)}`,
      )
      continue
    }

    samples.push(result.sample)
    console.log(
      `sourceProblemId=${sourceProblem.id} generated samples=${samples.length}/${options.limit} obstacles=${result.sample.obstacles.length} remainingConnections=${result.sample.connectionNamesToRoute.length}`,
    )
  }

  if (samples.length < options.limit) {
    throw new Error(
      `Only generated ${samples.length}/${options.limit} requested samples`,
    )
  }

  const obstacleDataset: HighDensityObstacleDataset = {
    format: "high_density_obstacle_dataset",
    formatVersion: 1,
    sourceDataset: "high-density-dataset-z04",
    sourceDatasetCommit: SOURCE_DATASET_COMMIT,
    preRouter: "HighDensitySolverA03",
    routingWindowMaxWidthMm: 15,
    routingWindowMaxHeightMm: 15,
    connectionPartition: "sorted_connection_names_first_half",
    samples,
  }
  const outputPath = resolve(options.outputPath)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify(obstacleDataset, null, 2)}\n`,
    "utf8",
  )
  console.log(`wrote ${outputPath} samples=${samples.length}`)
}

const options = parseGenerationOptions(process.argv.slice(2))
if (options) await writeObstacleDataset(options)
