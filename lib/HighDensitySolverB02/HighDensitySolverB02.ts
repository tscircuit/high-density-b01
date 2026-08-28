import { BaseSolver } from "@tscircuit/solver-utils"
import type { GraphicsObject } from "graphics-debug"
import { defaultB01Params } from "../default-params"
import { getConnectionPortPointPairs } from "../getConnectionPortPointPairs"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../HighDensitySolverB01/HighDensitySolverB01"
import type { HighDensityRouteObstacle } from "../obstacle-dataset-types"
import { findRouteGeometryViolations } from "../routeGeometryValidation"
import type {
  HighDensityIntraNodeRoute,
  NodeWithPortPoints,
  PortPoint,
} from "../types"

type PortPair = [PortPoint, PortPoint]

type InitialCandidate = {
  solver: HighDensitySolverB01
  routes: HighDensityIntraNodeRoute[]
  missingPairs: PortPair[]
  conflictRouteKeys: Set<string>
  fixedRouteCount: number
  shuffleSeed: number
}

type CrossLayerProbeCandidate = {
  route: HighDensityIntraNodeRoute
  blockerKeys: Set<string>
  routeLength: number
}

export type HighDensitySolverB02Stats = {
  applicable: boolean
  initialRouteCount: number
  missingPairCount: number
  blockerRouteCount: number
  repairPairCount: number
  initialIterations: number
  alternateInitialIterations: number
  alternateInitialSolverCount: number
  selectedInitialShuffleSeed: number
  repairIterations: number
  elapsedMs: number
}

export type HighDensitySolverB02Props = Pick<
  HighDensitySolverB01Props,
  | "nodeWithPortPoints"
  | "obstacles"
  | "highResolutionCellSize"
  | "highResolutionCellThickness"
  | "lowResolutionCellSize"
  | "viaDiameter"
  | "maxCellCount"
  | "traceThickness"
  | "traceMargin"
  | "obstacleClearanceMargin"
  | "viaMinDistFromBorder"
  | "showPenaltyMap"
  | "showUsedCellMap"
  | "effort"
>

const INITIAL_MAX_RIPS = 5
const REPAIR_MAX_RIPS = 50
const MAX_PAIR_COUNT = 16
const MAX_REPAIR_PAIR_COUNT = 6
const MAX_CROSS_LAYER_REPAIR_PAIR_COUNT = 8
const MAX_B01_NODE_DIMENSION_MM = 15
const B01_STEP_MULTIPLIER = 50
const CROSS_LAYER_INITIAL_SHUFFLE_SEEDS = [2, 4] as const
const EPSILON = 1e-8
const LAYER_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"]

const getPortPairs = (node: NodeWithPortPoints): PortPair[] => {
  const pointsByConnection = new Map<string, PortPoint[]>()
  for (const point of node.portPoints) {
    const points = pointsByConnection.get(point.connectionName) ?? []
    points.push(point)
    pointsByConnection.set(point.connectionName, points)
  }
  return [...pointsByConnection.values()].flatMap(getConnectionPortPointPairs)
}

const endpointKey = (point: {
  x: number
  y: number
  z: number
  portPointId?: string
}): string => `${point.portPointId ?? ""}|${point.x},${point.y},${point.z}`

const pairKey = (
  connectionName: string,
  start: { x: number; y: number; z: number; portPointId?: string },
  end: { x: number; y: number; z: number; portPointId?: string },
): string => {
  const endpoints = [endpointKey(start), endpointKey(end)].sort()
  return `${connectionName}:${endpoints[0]}:${endpoints[1]}`
}

const getPairKey = ([start, end]: PortPair): string =>
  pairKey(start.connectionName, start, end)

const getRouteKey = (route: HighDensityIntraNodeRoute): string =>
  pairKey(
    route.connectionName,
    route.route[0]!,
    route.route[route.route.length - 1]!,
  )

const getRouteLength = (route: HighDensityIntraNodeRoute): number => {
  let length = 0
  for (let index = 1; index < route.route.length; index += 1) {
    const previous = route.route[index - 1]!
    const point = route.route[index]!
    if (previous.z === point.z) {
      length += Math.hypot(point.x - previous.x, point.y - previous.y)
    }
  }
  return length
}

const hasRouteGeometryViolations = (
  routes: HighDensityIntraNodeRoute[],
  clearance: number,
): boolean =>
  findRouteGeometryViolations(
    routes.map((route) => ({
      ...route,
      traceThickness: route.traceThickness + clearance,
      viaDiameter: route.viaDiameter + clearance,
    })),
  ).length > 0

const getConflictRouteKeys = (
  routes: HighDensityIntraNodeRoute[],
  clearance: number,
): Set<string> => {
  const conflictRouteKeys = new Set<string>()
  for (let indexA = 0; indexA < routes.length; indexA += 1) {
    for (let indexB = indexA + 1; indexB < routes.length; indexB += 1) {
      const routeA = routes[indexA]!
      const routeB = routes[indexB]!
      if (!hasRouteGeometryViolations([routeA, routeB], clearance)) {
        continue
      }
      conflictRouteKeys.add(getRouteKey(routeA))
      conflictRouteKeys.add(getRouteKey(routeB))
    }
  }
  return conflictRouteKeys
}

const toRouteObstacle = (
  route: HighDensityIntraNodeRoute,
): HighDensityRouteObstacle => ({
  type: "route",
  connectionName: route.connectionName,
  rootConnectionName: route.rootConnectionName,
  traceThickness: route.traceThickness,
  viaDiameter: route.viaDiameter,
  route: route.route,
  vias: route.route.slice(1).flatMap((point, index) => {
    const previous = route.route[index]!
    if (point.z === previous.z) return []
    return [
      {
        x: point.x,
        y: point.y,
        zStart: previous.z,
        zEnd: point.z,
      },
    ]
  }),
})

/**
 * Uses a short B01 pass to find a maximal clean partial route set, then
 * reroutes only the missing pairs and the routes that physically block them.
 * The candidate is accepted only when every explicit pair is present and the
 * combined result passes continuous trace/via geometry checks.
 */
export class HighDensitySolverB02 extends BaseSolver {
  override getSolverName(): string {
    return "HighDensitySolverB02"
  }

  readonly constructorParams: HighDensitySolverB02Props
  readonly nodeWithPortPoints: NodeWithPortPoints
  readonly traceThickness: number
  readonly viaDiameter: number
  readonly traceMargin: number
  readonly obstacles: HighDensitySolverB01Props["obstacles"]
  readonly effort: number
  solvedRoutes: HighDensityIntraNodeRoute[] = []
  initialSolver?: HighDensitySolverB01
  alternateInitialSolvers: HighDensitySolverB01[] = []
  repairSolver?: HighDensitySolverB01
  private repairPairCount = 0
  private selectedInitialShuffleSeed = 0

  constructor(params: HighDensitySolverB02Props) {
    super()
    this.constructorParams = params
    this.nodeWithPortPoints = params.nodeWithPortPoints
    this.traceThickness = params.traceThickness ?? 0.1
    this.viaDiameter = params.viaDiameter
    this.traceMargin = params.traceMargin ?? 0.15
    this.obstacles = params.obstacles
    this.effort = params.effort ?? 1
    this.MAX_ITERATIONS = 2
  }

  static isApplicable(params: HighDensitySolverB02Props): boolean {
    const node = params.nodeWithPortPoints
    const pairs = getPortPairs(node)
    const availableZ = new Set(node.availableZ ?? [])
    if (!pairs || pairs.length < 2 || pairs.length > MAX_PAIR_COUNT)
      return false
    if (availableZ.size < 2 || availableZ.size > 4) return false
    if (
      node.width <= 0 ||
      node.height <= 0 ||
      node.width > MAX_B01_NODE_DIMENSION_MM ||
      node.height > MAX_B01_NODE_DIMENSION_MM
    ) {
      return false
    }

    for (const [start, end] of pairs) {
      if (start.connectionName !== end.connectionName) return false
      if (
        (start.rootConnectionName ?? start.connectionName) !==
        (end.rootConnectionName ?? end.connectionName)
      ) {
        return false
      }
      if (!availableZ.has(start.z) || !availableZ.has(end.z)) return false
    }

    const traceThickness = params.traceThickness ?? 0.1
    const traceMargin = params.traceMargin ?? 0.15
    const viaDiameter = params.viaDiameter
    if (
      pairs.some(([start, end]) => start.z !== end.z) &&
      (node.width + EPSILON < viaDiameter ||
        node.height + EPSILON < viaDiameter)
    ) {
      return false
    }
    const terminalPoints = pairs.flat()
    for (let indexA = 0; indexA < terminalPoints.length; indexA += 1) {
      const pointA = terminalPoints[indexA]!
      const rootA = pointA.rootConnectionName ?? pointA.connectionName
      for (
        let indexB = indexA + 1;
        indexB < terminalPoints.length;
        indexB += 1
      ) {
        const pointB = terminalPoints[indexB]!
        const rootB = pointB.rootConnectionName ?? pointB.connectionName
        if (rootA === rootB || pointA.z !== pointB.z) continue
        if (
          Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y) + EPSILON <
          traceThickness + traceMargin
        ) {
          return false
        }
      }
    }

    return params.obstacles.length === 0
  }

  override getConstructorParams(): [HighDensitySolverB02Props] {
    return [this.constructorParams]
  }

  override getOutput(): HighDensityIntraNodeRoute[] {
    return this.solvedRoutes
  }

  computeProgress(): number {
    return this.solved ? 1 : 0
  }

  override _step(): void {
    const startedAt = performance.now()
    if (!HighDensitySolverB02.isApplicable(this.constructorParams)) {
      this.fail("HighDensitySolverB02 is not structurally applicable")
      this.updateStats(false, startedAt, [], [], [])
      return
    }

    const pairs = getPortPairs(this.nodeWithPortPoints)
    this.initialSolver = this.createB01Solver(
      this.nodeWithPortPoints,
      [],
      INITIAL_MAX_RIPS,
      Math.min(this.effort, 0.1),
      0,
    )
    this.initialSolver.solve()
    const initialOutput = this.getB01PartialOutputOrFail(
      this.initialSolver,
      "Initial",
    )
    if (!initialOutput) {
      this.updateStats(true, startedAt, [], [], [])
      return
    }
    let initialRoutes = initialOutput
    const initialRoutesByKey = new Map(
      initialRoutes.map((route) => [getRouteKey(route), route]),
    )
    let missingPairs = pairs.filter(
      (pair) => !initialRoutesByKey.has(getPairKey(pair)),
    )

    if (missingPairs.length === 0) {
      if (!this.acceptValidatedRoutes(initialRoutes, pairs)) {
        this.fail("Initial B01 result failed exact physical validation")
      }
      this.updateStats(true, startedAt, initialRoutes, missingPairs, [])
      return
    }

    const blockerKeys = new Set<string>()
    let repairPairLimit = MAX_REPAIR_PAIR_COUNT
    let repairShuffleSeed = 0
    const hasCrossLayerMissingPair = missingPairs.some(
      ([start, end]) => start.z !== end.z,
    )
    if (hasCrossLayerMissingPair) {
      const selectedInitialCandidate = this.selectCrossLayerInitialCandidate(
        pairs,
        initialRoutes,
        missingPairs,
      )
      if (!selectedInitialCandidate) {
        this.updateStats(true, startedAt, initialRoutes, missingPairs, [])
        return
      }
      initialRoutes = selectedInitialCandidate.routes
      missingPairs = selectedInitialCandidate.missingPairs
      this.selectedInitialShuffleSeed = selectedInitialCandidate.shuffleSeed
      repairShuffleSeed = selectedInitialCandidate.shuffleSeed
      repairPairLimit = MAX_CROSS_LAYER_REPAIR_PAIR_COUNT

      if (missingPairs.length === 0) {
        if (!this.acceptValidatedRoutes(initialRoutes, pairs)) {
          this.fail("Cross-layer initial B01 result failed exact validation")
        }
        this.updateStats(true, startedAt, initialRoutes, missingPairs, [])
        return
      }

      for (const key of selectedInitialCandidate.conflictRouteKeys) {
        blockerKeys.add(key)
      }
      const cleanInitialRoutes = initialRoutes.filter(
        (route) => !blockerKeys.has(getRouteKey(route)),
      )
      for (const missingPair of missingPairs) {
        for (const key of this.getCrossLayerProbeBlockerKeys(
          missingPair,
          cleanInitialRoutes,
        )) {
          blockerKeys.add(key)
        }
      }
    } else {
      const missingDirectRoutes = missingPairs.map(([start, end]) =>
        this.createDirectRoute(start, end),
      )
      for (const route of initialRoutes) {
        if (
          missingDirectRoutes.some((missingRoute) =>
            hasRouteGeometryViolations([missingRoute, route], this.traceMargin),
          )
        ) {
          blockerKeys.add(getRouteKey(route))
        }
      }
    }

    const fixedRoutes = initialRoutes.filter(
      (route) => !blockerKeys.has(getRouteKey(route)),
    )
    const repairPairKeys = new Set([
      ...missingPairs.map(getPairKey),
      ...blockerKeys,
    ])
    const repairPairs = pairs.filter((pair) =>
      repairPairKeys.has(getPairKey(pair)),
    )
    if (
      repairPairs.length < missingPairs.length ||
      repairPairs.length > repairPairLimit
    ) {
      this.fail(
        `Conflict-directed repair requires ${repairPairs.length} pairs; maximum is ${repairPairLimit}`,
      )
      this.updateStats(
        true,
        startedAt,
        initialRoutes,
        missingPairs,
        blockerKeys,
      )
      return
    }

    const repairNode: NodeWithPortPoints = {
      ...this.nodeWithPortPoints,
      capacityMeshNodeId: `${this.nodeWithPortPoints.capacityMeshNodeId}__conflict_repair`,
      portPoints: repairPairs.flat(),
    }
    this.repairPairCount = repairPairs.length
    this.repairSolver = this.createB01Solver(
      repairNode,
      fixedRoutes.map(toRouteObstacle),
      REPAIR_MAX_RIPS,
      Math.max(0.1, Math.min(this.effort, 1)),
      repairShuffleSeed,
    )
    this.repairSolver.solve()
    if (!this.repairSolver.solved) {
      this.fail(
        `Conflict-directed B01 repair failed: ${this.repairSolver.error ?? "unknown error"}`,
      )
      this.updateStats(
        true,
        startedAt,
        initialRoutes,
        missingPairs,
        blockerKeys,
      )
      return
    }

    const repairedRoutes = this.repairSolver.getOutput().map((route) => ({
      ...route,
      regionId: this.nodeWithPortPoints.capacityMeshNodeId,
    }))
    const combinedRoutes = this.legalizeViaCentersInsideBounds([
      ...fixedRoutes,
      ...repairedRoutes,
    ])
    if (!this.acceptValidatedRoutes(combinedRoutes, pairs)) {
      this.fail("HighDensitySolverB02 result failed exact physical validation")
    }
    this.updateStats(true, startedAt, initialRoutes, missingPairs, blockerKeys)
  }

  private selectCrossLayerInitialCandidate(
    pairs: PortPair[],
    seedZeroRoutes: HighDensityIntraNodeRoute[],
    seedZeroMissingPairs: PortPair[],
  ): InitialCandidate | null {
    const seedZeroConflictRouteKeys = getConflictRouteKeys(
      seedZeroRoutes,
      this.traceMargin,
    )
    const candidates: InitialCandidate[] = [
      {
        solver: this.initialSolver!,
        routes: seedZeroRoutes,
        missingPairs: seedZeroMissingPairs,
        conflictRouteKeys: seedZeroConflictRouteKeys,
        fixedRouteCount: seedZeroRoutes.length - seedZeroConflictRouteKeys.size,
        shuffleSeed: 0,
      },
    ]

    for (const shuffleSeed of CROSS_LAYER_INITIAL_SHUFFLE_SEEDS) {
      const solver = this.createB01Solver(
        this.nodeWithPortPoints,
        [],
        INITIAL_MAX_RIPS,
        Math.min(this.effort, 0.1),
        shuffleSeed,
      )
      solver.solve()
      this.alternateInitialSolvers.push(solver)
      const routes = this.getB01PartialOutputOrFail(
        solver,
        `Alternate seed ${shuffleSeed}`,
      )
      if (!routes) return null
      const routeKeys = new Set(routes.map(getRouteKey))
      const missingPairs = pairs.filter(
        (pair) => !routeKeys.has(getPairKey(pair)),
      )
      const conflictRouteKeys = getConflictRouteKeys(routes, this.traceMargin)
      candidates.push({
        solver,
        routes,
        missingPairs,
        conflictRouteKeys,
        fixedRouteCount: routes.length - conflictRouteKeys.size,
        shuffleSeed,
      })
    }

    let selected = candidates[0]!
    for (const candidate of candidates.slice(1)) {
      const hasMoreFixedRoutes =
        candidate.fixedRouteCount > selected.fixedRouteCount
      const hasEqualFixedRoutes =
        candidate.fixedRouteCount === selected.fixedRouteCount
      const hasFewerMissingPairs =
        candidate.missingPairs.length < selected.missingPairs.length
      if (hasMoreFixedRoutes || (hasEqualFixedRoutes && hasFewerMissingPairs)) {
        selected = candidate
      }
    }
    return selected
  }

  private getB01PartialOutputOrFail(
    solver: HighDensitySolverB01,
    phase: string,
  ): HighDensityIntraNodeRoute[] | null {
    if (solver.failed && solver.iterations === 0) {
      this.fail(
        `${phase} B01 setup failed: ${solver.error ?? "unknown setup error"}`,
      )
      return null
    }
    return solver.getOutput()
  }

  private getCrossLayerProbeBlockerKeys(
    pair: PortPair,
    availableRoutes: HighDensityIntraNodeRoute[],
  ): Set<string> {
    const candidates: CrossLayerProbeCandidate[] =
      this.createCrossLayerProbeRoutes(pair).map((route) => {
        const blockerKeys = new Set<string>()
        for (const availableRoute of availableRoutes) {
          if (
            hasRouteGeometryViolations(
              [route, availableRoute],
              this.traceMargin,
            )
          ) {
            blockerKeys.add(getRouteKey(availableRoute))
          }
        }
        return {
          route,
          blockerKeys,
          routeLength: getRouteLength(route),
        }
      })

    let selected = candidates[0]!
    for (const candidate of candidates.slice(1)) {
      if (
        candidate.blockerKeys.size < selected.blockerKeys.size ||
        (candidate.blockerKeys.size === selected.blockerKeys.size &&
          candidate.routeLength < selected.routeLength)
      ) {
        selected = candidate
      }
    }
    return selected.blockerKeys
  }

  private createCrossLayerProbeRoutes([
    start,
    end,
  ]: PortPair): HighDensityIntraNodeRoute[] {
    if (start.z === end.z) return [this.createDirectRoute(start, end)]

    const viaRadius = this.viaDiameter / 2 + EPSILON
    const bounds = this.getNodeBounds()
    const clampInsideViaBounds = (point: { x: number; y: number }) => ({
      x: Math.max(
        bounds.minX + viaRadius,
        Math.min(bounds.maxX - viaRadius, point.x),
      ),
      y: Math.max(
        bounds.minY + viaRadius,
        Math.min(bounds.maxY - viaRadius, point.y),
      ),
    })
    const clampedStart = clampInsideViaBounds(start)
    const clampedEnd = clampInsideViaBounds(end)
    const candidateViaPoints = [
      clampedStart,
      clampedEnd,
      {
        x: this.nodeWithPortPoints.center.x,
        y: this.nodeWithPortPoints.center.y,
      },
      { x: this.nodeWithPortPoints.center.x, y: clampedStart.y },
      { x: this.nodeWithPortPoints.center.x, y: clampedEnd.y },
      { x: clampedStart.x, y: this.nodeWithPortPoints.center.y },
      { x: clampedEnd.x, y: this.nodeWithPortPoints.center.y },
    ]
    const uniqueViaPoints = [
      ...new Map(
        candidateViaPoints.map((point) => [`${point.x},${point.y}`, point]),
      ).values(),
    ]

    return uniqueViaPoints.flatMap((via) => [
      this.createCrossLayerProbeRoute(start, end, via, "horizontal-first"),
      this.createCrossLayerProbeRoute(start, end, via, "vertical-first"),
    ])
  }

  private createCrossLayerProbeRoute(
    start: PortPoint,
    end: PortPoint,
    via: { x: number; y: number },
    startDirection: "horizontal-first" | "vertical-first",
  ): HighDensityIntraNodeRoute {
    const horizontalFirst = startDirection === "horizontal-first"
    const route = this.compactRoutePoints([
      start,
      horizontalFirst
        ? { x: via.x, y: start.y, z: start.z }
        : { x: start.x, y: via.y, z: start.z },
      { x: via.x, y: via.y, z: start.z },
      { x: via.x, y: via.y, z: end.z },
      horizontalFirst
        ? { x: via.x, y: end.y, z: end.z }
        : { x: end.x, y: via.y, z: end.z },
      end,
    ])
    return {
      ...this.createDirectRoute(start, end),
      route,
      vias: [{ x: via.x, y: via.y }],
    }
  }

  private compactRoutePoints(
    points: HighDensityIntraNodeRoute["route"],
  ): HighDensityIntraNodeRoute["route"] {
    return points.filter((point, index) => {
      if (index === 0) return true
      const previous = points[index - 1]!
      return (
        point.x !== previous.x ||
        point.y !== previous.y ||
        point.z !== previous.z
      )
    })
  }

  private legalizeViaCentersInsideBounds(
    sourceRoutes: HighDensityIntraNodeRoute[],
  ): HighDensityIntraNodeRoute[] {
    const bounds = this.getNodeBounds()
    return sourceRoutes.map((sourceRoute) => {
      const route: HighDensityIntraNodeRoute = {
        ...sourceRoute,
        route: sourceRoute.route.map((point) => ({ ...point })),
        vias: sourceRoute.vias.map((via) => ({ ...via })),
      }
      const usedViaIndices = new Set<number>()
      for (let index = 1; index < route.route.length; index += 1) {
        const before = route.route[index - 1]!
        const after = route.route[index]!
        if (before.z === after.z) continue
        const viaIndex = route.vias.findIndex(
          (via, candidateIndex) =>
            !usedViaIndices.has(candidateIndex) &&
            Math.abs(via.x - before.x) <= EPSILON &&
            Math.abs(via.y - before.y) <= EPSILON,
        )
        if (viaIndex < 0) continue
        usedViaIndices.add(viaIndex)
        if (index - 1 === 0 || index === route.route.length - 1) continue
        const viaRadius = route.viaDiameter / 2
        const x = Math.max(
          bounds.minX + viaRadius,
          Math.min(bounds.maxX - viaRadius, before.x),
        )
        const y = Math.max(
          bounds.minY + viaRadius,
          Math.min(bounds.maxY - viaRadius, before.y),
        )
        before.x = x
        before.y = y
        after.x = x
        after.y = y
        route.vias[viaIndex]!.x = x
        route.vias[viaIndex]!.y = y
      }
      return route
    })
  }

  private getNodeBounds(): {
    minX: number
    maxX: number
    minY: number
    maxY: number
  } {
    return {
      minX:
        this.nodeWithPortPoints.center.x - this.nodeWithPortPoints.width / 2,
      maxX:
        this.nodeWithPortPoints.center.x + this.nodeWithPortPoints.width / 2,
      minY:
        this.nodeWithPortPoints.center.y - this.nodeWithPortPoints.height / 2,
      maxY:
        this.nodeWithPortPoints.center.y + this.nodeWithPortPoints.height / 2,
    }
  }

  private createB01Solver(
    nodeWithPortPoints: NodeWithPortPoints,
    obstacles: readonly HighDensityRouteObstacle[],
    maxRips: number,
    effort: number,
    shuffleSeed: number,
  ): HighDensitySolverB01 {
    const solver = new HighDensitySolverB01({
      ...defaultB01Params,
      nodeWithPortPoints,
      obstacles,
      highResolutionCellSize: this.constructorParams.highResolutionCellSize,
      highResolutionCellThickness:
        this.constructorParams.highResolutionCellThickness,
      lowResolutionCellSize: this.constructorParams.lowResolutionCellSize,
      viaDiameter: this.viaDiameter,
      viaMinDistFromBorder:
        this.constructorParams.viaMinDistFromBorder ?? this.viaDiameter / 2,
      maxCellCount: this.constructorParams.maxCellCount,
      traceThickness: this.traceThickness,
      traceMargin: this.traceMargin,
      obstacleClearanceMargin:
        this.constructorParams.obstacleClearanceMargin ?? this.traceMargin,
      showPenaltyMap: this.constructorParams.showPenaltyMap,
      showUsedCellMap: this.constructorParams.showUsedCellMap,
      effort,
      stepMultiplier: B01_STEP_MULTIPLIER,
      hyperParameters: { shuffleSeed },
    })
    solver.MAX_RIPS = maxRips
    return solver
  }

  private createDirectRoute(
    start: PortPoint,
    end: PortPoint,
  ): HighDensityIntraNodeRoute {
    return {
      connectionName: start.connectionName,
      rootConnectionName: start.rootConnectionName ?? start.connectionName,
      regionId: this.nodeWithPortPoints.capacityMeshNodeId,
      traceThickness: this.traceThickness,
      viaDiameter: this.viaDiameter,
      route: [start, end],
      vias: [],
    }
  }

  private acceptValidatedRoutes(
    routes: HighDensityIntraNodeRoute[],
    pairs: PortPair[],
  ): boolean {
    if (routes.length !== pairs.length) return false
    const routesByKey = new Map(
      routes.map((route) => [getRouteKey(route), route]),
    )
    if (routesByKey.size !== pairs.length) return false
    const orderedRoutes: HighDensityIntraNodeRoute[] = []
    for (const pair of pairs) {
      const matchedRoute = routesByKey.get(getPairKey(pair))
      if (!matchedRoute) return false
      const expectedRoot = pair[0].rootConnectionName ?? pair[0].connectionName
      if (
        (matchedRoute.rootConnectionName ?? matchedRoute.connectionName) !==
        expectedRoot
      ) {
        return false
      }
      const first = matchedRoute.route[0]!
      const last = matchedRoute.route[matchedRoute.route.length - 1]!
      const forward =
        endpointKey(first) === endpointKey(pair[0]) &&
        endpointKey(last) === endpointKey(pair[1])
      const reverse =
        endpointKey(first) === endpointKey(pair[1]) &&
        endpointKey(last) === endpointKey(pair[0])
      if (!forward && !reverse) return false
      const orientedRoute = reverse
        ? { ...matchedRoute, route: [...matchedRoute.route].reverse() }
        : matchedRoute
      const normalizedRoute = {
        ...orientedRoute,
        regionId: this.nodeWithPortPoints.capacityMeshNodeId,
      }
      if (!this.isRouteStructurallyValid(normalizedRoute)) return false
      orderedRoutes.push(normalizedRoute)
    }
    if (findRouteGeometryViolations(orderedRoutes).length > 0) {
      return false
    }
    if (hasRouteGeometryViolations(orderedRoutes, this.traceMargin)) {
      return false
    }
    this.solvedRoutes = orderedRoutes
    this.solved = true
    this.failed = false
    return true
  }

  private isRouteStructurallyValid(route: HighDensityIntraNodeRoute): boolean {
    const bounds = {
      minX:
        this.nodeWithPortPoints.center.x - this.nodeWithPortPoints.width / 2,
      maxX:
        this.nodeWithPortPoints.center.x + this.nodeWithPortPoints.width / 2,
      minY:
        this.nodeWithPortPoints.center.y - this.nodeWithPortPoints.height / 2,
      maxY:
        this.nodeWithPortPoints.center.y + this.nodeWithPortPoints.height / 2,
    }
    const availableZ = new Set(this.nodeWithPortPoints.availableZ ?? [])
    if (route.route.length < 2) return false
    for (const point of route.route) {
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isFinite(point.z) ||
        !availableZ.has(point.z) ||
        point.x < bounds.minX - EPSILON ||
        point.x > bounds.maxX + EPSILON ||
        point.y < bounds.minY - EPSILON ||
        point.y > bounds.maxY + EPSILON
      ) {
        return false
      }
    }

    const transitionKeys: string[] = []
    for (let index = 1; index < route.route.length; index += 1) {
      const previous = route.route[index - 1]!
      const point = route.route[index]!
      if (point.z === previous.z) continue
      if (
        Math.abs(point.x - previous.x) > EPSILON ||
        Math.abs(point.y - previous.y) > EPSILON
      ) {
        return false
      }
      transitionKeys.push(`${point.x},${point.y}`)
    }
    const viaKeys = route.vias.map((via) => `${via.x},${via.y}`)
    transitionKeys.sort()
    viaKeys.sort()
    if (
      transitionKeys.length !== viaKeys.length ||
      transitionKeys.some((key, index) => key !== viaKeys[index])
    ) {
      return false
    }

    const viaRadius = route.viaDiameter / 2
    return route.vias.every(
      (via) =>
        Number.isFinite(via.x) &&
        Number.isFinite(via.y) &&
        via.x >= bounds.minX + viaRadius - EPSILON &&
        via.x <= bounds.maxX - viaRadius + EPSILON &&
        via.y >= bounds.minY + viaRadius - EPSILON &&
        via.y <= bounds.maxY - viaRadius + EPSILON,
    )
  }

  private fail(message: string): void {
    this.solved = false
    this.failed = true
    this.error = message
  }

  private updateStats(
    applicable: boolean,
    startedAt: number,
    initialRoutes: HighDensityIntraNodeRoute[],
    missingPairs: PortPair[],
    blockerKeys: Set<string> | string[],
  ): void {
    this.stats = {
      applicable,
      initialRouteCount: initialRoutes.length,
      missingPairCount: missingPairs.length,
      blockerRouteCount:
        blockerKeys instanceof Set ? blockerKeys.size : blockerKeys.length,
      repairPairCount: this.repairPairCount,
      initialIterations: this.initialSolver?.iterations ?? 0,
      alternateInitialIterations: this.alternateInitialSolvers.reduce(
        (total, solver) => total + solver.iterations,
        0,
      ),
      alternateInitialSolverCount: this.alternateInitialSolvers.length,
      selectedInitialShuffleSeed: this.selectedInitialShuffleSeed,
      repairIterations: this.repairSolver?.iterations ?? 0,
      elapsedMs: performance.now() - startedAt,
    } satisfies HighDensitySolverB02Stats
  }

  override visualize(): GraphicsObject {
    return {
      rects: [
        {
          center: this.nodeWithPortPoints.center,
          width: this.nodeWithPortPoints.width,
          height: this.nodeWithPortPoints.height,
          stroke: "gray",
        },
      ],
      points: this.nodeWithPortPoints.portPoints.map((point) => ({
        x: point.x,
        y: point.y,
        label: point.connectionName,
      })),
      lines: this.solvedRoutes.flatMap((route) =>
        route.route.slice(1).flatMap((point, index) => {
          const previous = route.route[index]!
          if (previous.z !== point.z) return []
          return [
            {
              points: [previous, point],
              strokeColor: LAYER_COLORS[point.z] ?? "#6b7280",
              strokeWidth: route.traceThickness,
              label: `${route.connectionName} z=${point.z}`,
            },
          ]
        }),
      ),
      circles: this.solvedRoutes.flatMap((route) =>
        route.vias.map((via) => ({
          center: via,
          radius: route.viaDiameter / 2,
          fill: "rgba(17,24,39,0.35)",
          stroke: "#111827",
          label: `${route.connectionName} via`,
        })),
      ),
      coordinateSystem: "cartesian",
      title: `HighDensitySolverB02 [${this.solvedRoutes.length} routes]`,
    }
  }
}
