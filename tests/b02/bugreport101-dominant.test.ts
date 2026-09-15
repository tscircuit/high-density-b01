import { expect, test } from "bun:test"
import "graphics-debug/matcher"
import {
  defaultB02Params,
  findRouteGeometryViolations,
  HighDensitySolverB02,
  type HighDensityIntraNodeRoute,
  type NodeWithPortPoints,
  type PortPoint,
} from "../../lib"
import nodeJson from "./bugreport101-dominant-node.json"

const { portPointsInPairs, ...nodeFields } = nodeJson
const expectedPairs = portPointsInPairs as unknown as Array<
  [PortPoint, PortPoint]
>
const node = {
  ...nodeFields,
  portPoints: expectedPairs.flat(),
} as NodeWithPortPoints

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

test("B02 repairs Bug 101's dominant high-density node", async () => {
  const first = createSolver()
  const second = createSolver()
  const firstRoutes = first.getOutput()

  expect(first.solved).toBeTrue()
  expect(first.failed).toBeFalse()
  expect(firstRoutes).toHaveLength(11)
  expect(second.getOutput()).toEqual(firstRoutes)

  for (let index = 0; index < expectedPairs.length; index += 1) {
    const [expectedStart, expectedEnd] = expectedPairs[index]!
    const route = firstRoutes[index]!
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
  }

  const clearanceInflatedRoutes = firstRoutes.map((route) => ({
    ...route,
    traceThickness: route.traceThickness + 0.1,
    viaDiameter: route.viaDiameter + 0.1,
  }))
  expect(findRouteGeometryViolations(clearanceInflatedRoutes)).toHaveLength(0)
  expect(first.stats).toMatchObject({
    applicable: true,
    initialRouteCount: 10,
    missingPairCount: 1,
    blockerRouteCount: 2,
    repairPairCount: 3,
  })
  expect(first.stats.initialIterations).toBeLessThanOrEqual(600)
  expect(first.stats.repairIterations).toBeLessThanOrEqual(200)
  expect(second.stats.initialIterations).toBe(first.stats.initialIterations)
  expect(second.stats.repairIterations).toBe(first.stats.repairIterations)

  await expect(first.visualize()).toMatchGraphicsSvg(import.meta.path, {
    svgName: "bugreport101-dominant-b02",
  })
})
