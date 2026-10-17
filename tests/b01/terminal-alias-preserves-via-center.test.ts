import { expect, test } from "bun:test"
import { defaultB01Params } from "../../lib/default-params"
import { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"

test("restoring exact terminal aliases preserves an adjacent via center", (): void => {
  const solver = new HighDensitySolverB01({
    ...defaultB01Params,
    nodeWithPortPoints: {
      capacityMeshNodeId: "terminal-via",
      center: { x: 0, y: 0 },
      width: 0.4,
      height: 0.4,
      availableZ: [0, 1],
      portPoints: [
        { x: 0, y: 0, z: 0, connectionName: "a" },
        { x: 0, y: 0, z: 1, connectionName: "a" },
      ],
    },
    obstacles: [],
    traceThickness: 0.1524,
    viaDiameter: 0.2032,
    viaMinDistFromBorder: 0.1016,
  })
  solver.solve()
  expect(solver.solved).toBeTrue()
  const route = solver.getOutput()[0]!
  expect(route.route[0]).toMatchObject({ x: 0, y: 0, z: 0 })
  expect(route.route.at(-1)).toMatchObject({ x: 0, y: 0, z: 1 })
  for (let i = 1; i < route.route.length; i++) {
    const a = route.route[i - 1]!, b = route.route[i]!
    if (a.z === b.z) continue
    expect({ x: a.x, y: a.y }).toEqual(route.vias[0]!)
    expect({ x: b.x, y: b.y }).toEqual(route.vias[0]!)
  }
})
