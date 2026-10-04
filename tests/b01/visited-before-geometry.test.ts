import { expect, test } from "bun:test"
import {
  HighDensitySolverB01,
  type HighDensitySolverB01Props,
} from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import type { NodeWithPortPoints } from "../../lib/types"
import { FrozenB01VisitedSolver } from "../fixtures/frozen-b01-visited-solver"

function createProps(
  seed: number,
  layers: number[],
): HighDensitySolverB01Props {
  const node: NodeWithPortPoints = {
    capacityMeshNodeId: "visited-geometry",
    center: { x: 0, y: 0 },
    width: 4,
    height: 4,
    availableZ: layers,
    portPoints: [
      { connectionName: "a", x: -1.5, y: -0.5, z: layers[0]! },
      { connectionName: "a", x: 1.5, y: 0.5, z: layers[0]! },
      { connectionName: "b", x: -1.5, y: 0.5, z: layers[0]! },
      { connectionName: "b", x: 1.5, y: -0.5, z: layers[0]! },
      { connectionName: "c", x: -0.5, y: -1.5, z: layers[0]! },
      { connectionName: "c", x: 0.5, y: 1.5, z: layers[0]! },
    ],
  }
  return {
    nodeWithPortPoints: node,
    highResolutionCellSize: 0.2,
    highResolutionCellThickness: 2,
    lowResolutionCellSize: 0.4,
    viaDiameter: 0.3,
    traceThickness: 0.1,
    traceMargin: 0.1,
    viaMinDistFromBorder: 0.1,
    hyperParameters: { shuffleSeed: seed },
    obstacles: [
      {
        type: "route",
        connectionName: "wall",
        traceThickness: 0.1,
        viaDiameter: 0.3,
        route: [
          { x: 0.125, y: -2, z: layers[0]! },
          { x: 0.125, y: 2, z: layers[0]! },
        ],
        vias: [{ x: 0.125, y: 1.75, zStart: layers[0], zEnd: layers.at(-1) }],
      },
      {
        type: "rect",
        connectionName: "rect",
        center: { x: 0.75, y: -1.5 },
        width: 0.25,
        height: 0.25,
        ccwRotationDegrees: 17,
        zLayers: layers,
      },
    ],
  }
}

function observeGeometryScans(solver: HighDensitySolverB01): () => number {
  let count = 0
  const primitives = solver["obstacleTracePrimitives"]
  const iterator = primitives[Symbol.iterator]
  // Instrument only the private primitive traversal. Geometry methods and
  // their native identity guards remain intact in this work-count check.
  Object.defineProperty(primitives, Symbol.iterator, {
    value(): ReturnType<typeof iterator> {
      count++
      return iterator.call(primitives)
    },
  })
  return () => count
}

function ripIds(solver: HighDensitySolverB01, head: number): number[] {
  const chain = solver["ripChain"]
  const ids: number[] = []
  for (let index = head; index >= 0; index = chain.prev[index]!) {
    ids.push(chain.connId[index]!)
  }
  return ids
}

function comparePublicStep(
  actual: HighDensitySolverB01,
  reference: HighDensitySolverB01,
): void {
  expect([
    actual.solved,
    actual.failed,
    actual.error,
    actual.iterations,
  ]).toEqual([
    reference.solved,
    reference.failed,
    reference.error,
    reference.iterations,
  ])
  expect(Object.is(actual.progress, reference.progress)).toBeTrue()
  expect(actual.openSet).toEqual(reference.openSet)
  expect(actual.activeConnection).toEqual(reference.activeConnection)
  expect(actual.unsolvedConnections).toEqual(reference.unsolvedConnections)
  expect(actual.solvedConnectionsMap).toEqual(reference.solvedConnectionsMap)
  expect(actual.getOutput()).toEqual(reference.getOutput())
  expect(actual.gridStats).toEqual(reference.gridStats)
  expect(actual.MAX_ITERATIONS).toBe(reference.MAX_ITERATIONS)
  expect(actual["baseSearchBudgetIters"]).toBe(
    reference["baseSearchBudgetIters"],
  )
  expect(actual["searchIterations"]).toBe(reference["searchIterations"])
  expect(actual["totalRipEvents"]).toBe(reference["totalRipEvents"])
  expect(actual["ripCount"]).toEqual(reference["ripCount"])
  expect(actual["heap"]).toEqual(reference["heap"])
  expect(actual["seqCounter"]).toBe(reference["seqCounter"])
  expect(actual["usedCellsFlat"]).toEqual(reference["usedCellsFlat"])
  expect(actual["sharedCellsFlat"]).toEqual(reference["sharedCellsFlat"])
  expect(actual["penalty2d"]).toEqual(reference["penalty2d"])
  expect(actual["visitedStamp"]).toEqual(reference["visitedStamp"])
  expect(actual["bestGStamp"]).toEqual(reference["bestGStamp"])
  expect(actual["bestGValue"]).toEqual(reference["bestGValue"])
  const pool = actual["nodePool"]
  const frozenPool = reference["nodePool"]
  expect(pool.length).toBe(frozenPool.length)
  for (let index = 0; index < pool.length; index++) {
    for (const key of ["z", "cellId", "g", "parent", "ripCount"] as const) {
      expect(Object.is(pool[key][index], frozenPool[key][index])).toBeTrue()
    }
    expect(ripIds(actual, pool.ripHead[index]!)).toEqual(
      ripIds(reference, frozenPool.ripHead[index]!),
    )
  }
}

test("B01 skips visited geometry with exact routing and dispatch", () => {
  let savedGeometryScans = 0
  let originalGeometryScans = 0
  let comparedSteps = 0
  let observedRips = false
  const scenarios = [
    {
      seed: 0,
      layers: [0, 1],
      multiplier: 1,
      margin: 0,
      preoccupied: false,
    },
    {
      seed: 1,
      layers: [3, 7],
      multiplier: 3,
      margin: 0.1,
      preoccupied: false,
    },
    {
      seed: 2,
      layers: [0],
      multiplier: 2,
      margin: -0,
      preoccupied: false,
    },
    {
      seed: 0,
      layers: [0, 1],
      multiplier: 5,
      margin: -0.025,
      preoccupied: false,
    },
    {
      seed: 1,
      layers: [0, 1],
      multiplier: 1,
      margin: Number.NaN,
      preoccupied: false,
    },
    {
      seed: 2,
      layers: [0, 1],
      multiplier: 2,
      margin: 0,
      preoccupied: true,
    },
  ]
  for (const scenario of scenarios) {
    const props = {
      ...createProps(scenario.seed, scenario.layers),
      stepMultiplier: scenario.multiplier,
      obstacleClearanceMargin: scenario.margin,
    }
    if (scenario.preoccupied) props.obstacles = []
    const actual = new HighDensitySolverB01(structuredClone(props))
    const reference = new FrozenB01VisitedSolver(structuredClone(props))
    actual.step()
    reference.step()
    comparePublicStep(actual, reference)
    if (scenario.preoccupied) {
      // Seed an existing owner footprint so discarded and accepted moves both
      // prepare rip chains. Logical rip IDs must match despite unused appends.
      actual["usedCellsFlat"].fill(1)
      reference["usedCellsFlat"].fill(1)
    }
    const actualScans = observeGeometryScans(actual)
    const referenceScans = observeGeometryScans(reference)
    while (!reference.solved && !reference.failed) {
      if (reference.iterations > 20_000) {
        throw new Error("Unbounded B01 fixture")
      }
      actual.step()
      reference.step()
      comparePublicStep(actual, reference)
      comparedSteps++
    }
    if (referenceScans() > 0) {
      expect(actualScans()).toBeLessThan(referenceScans())
    } else {
      expect(actualScans()).toBe(0)
    }
    savedGeometryScans += referenceScans() - actualScans()
    originalGeometryScans += referenceScans()
    observedRips ||= actual["totalRipEvents"] > 0
    expect(actual.getConstructorParams()).toEqual(
      reference.getConstructorParams(),
    )
  }
  expect(comparedSteps).toBeGreaterThan(100)
  expect(savedGeometryScans).toBeGreaterThan(100)
  expect(observedRips).toBeTrue()
  console.log({
    comparedSteps,
    originalGeometryScans,
    savedGeometryScans,
    observedRips,
  })

  // Private methods are still callable/customizable at runtime. Preserve
  // their original call order and settings access when dispatch is changed.
  for (const customization of [
    "state",
    "cost",
    "geometry",
    "rip-setting",
    "settings-container",
  ] as const) {
    const props = createProps(1, [0, 1])
    const actual = new HighDensitySolverB01(structuredClone(props))
    const reference = new FrozenB01VisitedSolver(structuredClone(props))
    const calls = [0, 0]
    for (const [index, solver] of [actual, reference].entries()) {
      if (customization === "settings-container") {
        const settings = solver.hyperParameters
        Object.defineProperty(solver, "hyperParameters", {
          get(): typeof settings {
            calls[index] = calls[index]! + 1
            return settings
          },
        })
      } else if (customization === "rip-setting") {
        Object.defineProperty(solver.hyperParameters, "ripCost", {
          get(): number {
            calls[index] = calls[index]! + 1
            return 8.125
          },
        })
      } else {
        const name =
          customization === "state"
            ? "getSearchStateIdx"
            : customization === "cost"
              ? "computeMoveCostAndRips"
              : "isLateralMoveBlockedByObstacleGeometry"
        const original = solver[name]
        Object.defineProperty(solver, name, {
          value(...args: unknown[]): unknown {
            calls[index] = calls[index]! + 1
            const result = Reflect.apply(original, this, args)
            if (customization === "cost" && this["_moveCost"] >= 0) {
              this["_moveCost"] += 0.03125
            }
            return result
          },
        })
      }
    }
    while (!reference.solved && !reference.failed) {
      if (reference.iterations > 20_000) {
        throw new Error("Unbounded custom fixture")
      }
      actual.step()
      reference.step()
      comparePublicStep(actual, reference)
      expect(calls[0]).toBe(calls[1])
    }
    expect(calls[0]).toBeGreaterThan(0)
  }
})
