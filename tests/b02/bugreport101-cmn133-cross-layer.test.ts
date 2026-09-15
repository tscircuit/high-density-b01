import { expect, test } from "bun:test"
import {
  defaultB02Params,
  findRouteGeometryViolations,
  HighDensitySolverB02,
  type HighDensityIntraNodeRoute,
  type NodeWithPortPoints,
  type PortPoint,
} from "../../lib"
import nodeJson from "./bugreport101-cmn133-node.json"

const { portPointsInPairs, ...nodeFields } = nodeJson
const expectedPairs = portPointsInPairs as unknown as Array<
  [PortPoint, PortPoint]
>
const node = {
  ...nodeFields,
  portPoints: expectedPairs.flat(),
} as NodeWithPortPoints
const EPSILON = 1e-8

const endpointIdentity = (
  point: HighDensityIntraNodeRoute["route"][number],
): string => `${point.x},${point.y},${point.z},${point.portPointId ?? ""}`

const createSolver = (): HighDensitySolverB02 => {
  const solver = new HighDensitySolverB02({
    ...defaultB02Params,
    nodeWithPortPoints: structuredClone(node),
    obstacles: [],
    traceThickness: 0.15,
    traceMargin: 0.1,
    viaDiameter: 0.3,
    effort: 1,
  })
  solver.solve()
  return solver
}

test("B02 repairs Bug 101's cross-layer cmn133 node", () => {
  const first = createSolver()
  const second = createSolver()
  const firstRoutes = first.getOutput()
  const availableZ = new Set(node.availableZ!)
  const bounds = {
    minX: node.center.x - node.width / 2,
    maxX: node.center.x + node.width / 2,
    minY: node.center.y - node.height / 2,
    maxY: node.center.y + node.height / 2,
  }

  expect(first.solved).toBeTrue()
  expect(first.failed).toBeFalse()
  expect(firstRoutes).toHaveLength(9)
  expect(second.getOutput()).toEqual(firstRoutes)

  for (let pairIndex = 0; pairIndex < expectedPairs.length; pairIndex += 1) {
    const [expectedStart, expectedEnd] = expectedPairs[pairIndex]!
    const route = firstRoutes[pairIndex]!
    expect(endpointIdentity(route.route[0]!)).toBe(
      endpointIdentity(expectedStart),
    )
    expect(endpointIdentity(route.route.at(-1)!)).toBe(
      endpointIdentity(expectedEnd),
    )
    expect(route.rootConnectionName).toBe(
      expectedStart.rootConnectionName ?? expectedStart.connectionName,
    )
    expect(route.regionId).toBe(node.capacityMeshNodeId)

    const transitionKeys: string[] = []
    for (let pointIndex = 0; pointIndex < route.route.length; pointIndex += 1) {
      const point = route.route[pointIndex]!
      expect(availableZ.has(point.z)).toBeTrue()
      expect(point.x).toBeGreaterThanOrEqual(bounds.minX - EPSILON)
      expect(point.x).toBeLessThanOrEqual(bounds.maxX + EPSILON)
      expect(point.y).toBeGreaterThanOrEqual(bounds.minY - EPSILON)
      expect(point.y).toBeLessThanOrEqual(bounds.maxY + EPSILON)
      if (pointIndex === 0) continue
      const previous = route.route[pointIndex - 1]!
      if (previous.z === point.z) continue
      expect(point.x).toBe(previous.x)
      expect(point.y).toBe(previous.y)
      transitionKeys.push(`${point.x},${point.y}`)
    }
    const viaKeys = route.vias.map((via) => `${via.x},${via.y}`)
    expect(transitionKeys.sort()).toEqual(viaKeys.sort())
    const viaRadius = route.viaDiameter / 2
    for (const via of route.vias) {
      expect(via.x).toBeGreaterThanOrEqual(bounds.minX + viaRadius - EPSILON)
      expect(via.x).toBeLessThanOrEqual(bounds.maxX - viaRadius + EPSILON)
      expect(via.y).toBeGreaterThanOrEqual(bounds.minY + viaRadius - EPSILON)
      expect(via.y).toBeLessThanOrEqual(bounds.maxY - viaRadius + EPSILON)
    }
  }

  const clearanceInflatedRoutes = firstRoutes.map((route) => ({
    ...route,
    traceThickness: route.traceThickness + 0.1,
    viaDiameter: route.viaDiameter + 0.1,
  }))
  expect(findRouteGeometryViolations(clearanceInflatedRoutes)).toHaveLength(0)
  expect(first.stats).toMatchObject({
    applicable: true,
    initialRouteCount: 7,
    missingPairCount: 2,
    blockerRouteCount: 5,
    repairPairCount: 7,
    alternateInitialSolverCount: 2,
    selectedInitialShuffleSeed: 4,
  })
  expect(first.stats.initialIterations).toBeLessThanOrEqual(350)
  expect(first.stats.alternateInitialIterations).toBeLessThanOrEqual(550)
  expect(first.stats.repairIterations).toBeLessThanOrEqual(2_150)
  expect(second.stats.initialIterations).toBe(first.stats.initialIterations)
  expect(second.stats.alternateInitialIterations).toBe(
    first.stats.alternateInitialIterations,
  )
  expect(second.stats.repairIterations).toBe(first.stats.repairIterations)

  const infeasiblePortalSpacingNode = structuredClone(node)
  const pointA = infeasiblePortalSpacingNode.portPoints[6]!
  const pointB = infeasiblePortalSpacingNode.portPoints[8]!
  pointB.x = pointA.x
  pointB.y = pointA.y + 0.225
  pointB.z = pointA.z
  expect(
    HighDensitySolverB02.isApplicable({
      ...defaultB02Params,
      nodeWithPortPoints: infeasiblePortalSpacingNode,
      obstacles: [],
      traceThickness: 0.15,
      traceMargin: 0.1,
      viaDiameter: 0.3,
    }),
  ).toBeFalse()
})
