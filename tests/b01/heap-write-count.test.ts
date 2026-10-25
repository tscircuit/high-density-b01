import { expect, test } from "bun:test"
import type { Point } from "graphics-debug"
import type { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import { createB01Heap } from "../fixtures/createB01Heap"
import { SwapTypedMinHeap } from "../fixtures/SwapTypedMinHeap"
import {
  afterColor,
  beforeColor,
  expectPerformanceSvg,
  performanceCanvas,
  type PerformanceGraphic,
  visualMetric,
  visualPanel,
  visualText,
} from "../fixtures/performanceVisual"

type HeapStorage = {
  f: Float64Array
  seq: Uint32Array
  id: Int32Array
  ensureCapacity: (size: number) => void
}

type WriteCounter = {
  writes: number
  bySlot?: number[]
  priorityWrites?: Array<{ slot: number; value: number }>
}

type InsertionObservation = {
  initialPriorities: number[]
  finalPriorities: number[]
  insertedPriority: number
  writes: number
  bySlot: number[]
  priorityWrites: Array<{ slot: number; value: number }>
  popOrder: number[]
}

function countWrites(
  heap: HighDensitySolverB01["heap"] | SwapTypedMinHeap,
  counter: WriteCounter,
): void {
  const storage = heap as unknown as HeapStorage
  storage.ensureCapacity(8192)
  for (const field of ["f", "seq", "id"] as const) {
    const array = storage[field]
    const counted = new Proxy(array, {
      get(target, property) {
        const value = Reflect.get(target, property, target)
        return typeof value === "function" ? value.bind(target) : value
      },
      set(target, property, value) {
        const written = Reflect.set(target, property, value, target)
        if (typeof property === "string" && /^\d+$/.test(property)) {
          counter.writes++
          const slot = Number(property)
          if (counter.bySlot)
            counter.bySlot[slot] = (counter.bySlot[slot] ?? 0) + 1
          if (field === "f" && counter.priorityWrites)
            counter.priorityWrites.push({ slot, value: target[slot]! })
        }
        return written
      },
    })
    Object.defineProperty(heap, field, { value: counted, writable: true })
  }
}

function observeInsertion(
  heap: HighDensitySolverB01["heap"] | SwapTypedMinHeap,
  priorities: number[],
  insertedPriority: number,
): InsertionObservation {
  for (const [sequence, priority] of priorities.entries())
    heap.push(priority, sequence, priority)
  const storage = heap as unknown as HeapStorage
  const initialPriorities = Array.from(storage.f.subarray(0, heap.size))
  const counter: WriteCounter = {
    writes: 0,
    bySlot: Array(priorities.length + 1).fill(0),
    priorityWrites: [],
  }
  countWrites(heap, counter)
  heap.push(insertedPriority, priorities.length, insertedPriority)
  const observation: InsertionObservation = {
    initialPriorities,
    finalPriorities: Array.from(storage.f.subarray(0, heap.size)),
    insertedPriority,
    writes: counter.writes,
    bySlot: [...counter.bySlot!],
    priorityWrites: [...counter.priorityWrites!],
    popOrder: [],
  }
  while (heap.size > 0) observation.popOrder.push(heap.pop())
  return observation
}

function getSlotPosition(slot: number, left: number): Point {
  const level = Math.floor(Math.log2(slot + 1))
  const firstSlot = 2 ** level - 1
  return {
    x: left + 20 + ((slot - firstSlot + 0.5) * 512) / 2 ** level,
    y: 220 + level * 72,
  }
}

function addMoveArrow(
  graphics: PerformanceGraphic,
  from: Point,
  to: Point,
  color: string,
  offset: number,
  fromRadius: number,
): void {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy)
  const nx = -dy / distance
  const ny = dx / distance
  graphics.arrows.push({
    start: {
      x: from.x + (dx * fromRadius) / distance + nx * offset,
      y: from.y + (dy * fromRadius) / distance + ny * offset,
    },
    end: {
      x: to.x - (dx * 26) / distance + nx * offset,
      y: to.y - (dy * 26) / distance + ny * offset,
    },
    color,
  })
}

function drawInsertion(
  graphics: PerformanceGraphic,
  left: number,
  observation: InsertionObservation,
  before: boolean,
): void {
  const color = before ? beforeColor : afterColor
  visualPanel(
    graphics,
    left,
    before ? "Before: swap at each level" : "After: copy parents into the hole",
    before
      ? "Parents move down; the inserted entry swaps upward."
      : "Parents move down; the held entry is placed once.",
    color,
  )
  visualText(
    graphics,
    left + 20,
    186,
    `push(${observation.insertedPriority})`,
    16,
    "#2563eb",
  )
  const locations = new Map(
    observation.initialPriorities.map((priority, slot) => [priority, slot]),
  )
  for (let slot = 1; slot < observation.finalPriorities.length; slot++) {
    graphics.lines.push({
      points: [
        getSlotPosition(Math.floor((slot - 1) / 2), left),
        getSlotPosition(slot, left),
      ],
      strokeColor: "#cbd5e1",
    })
  }
  for (const write of observation.priorityWrites) {
    const sourceSlot = locations.get(write.value)
    if (sourceSlot !== write.slot) {
      const source =
        sourceSlot === undefined
          ? { x: left + (before ? 36 : 105), y: 202 }
          : getSlotPosition(sourceSlot, left)
      addMoveArrow(
        graphics,
        source,
        getSlotPosition(write.slot, left),
        write.value === observation.insertedPriority ? "#2563eb" : color,
        before && sourceSlot !== undefined ? 5 : 0,
        sourceSlot === undefined ? 0 : 26,
      )
    }
    // Retain the last observed source even while a swap holds it in a scalar.
    locations.set(write.value, write.slot)
  }
  for (const [slot, priority] of observation.finalPriorities.entries()) {
    const position = getSlotPosition(slot, left)
    const writes = observation.bySlot[slot]!
    graphics.circles.push({
      center: position,
      radius: 24,
      fill: writes ? (before ? "#fff7ed" : "#ecfdf5") : "#f8fafc",
      stroke: writes ? color : "#cbd5e1",
    })
    graphics.texts.push(
      {
        ...position,
        y: position.y - 9,
        text: `slot ${slot}`,
        fontSize: 10,
        color: "#64748b",
        anchorSide: "center",
      },
      {
        ...position,
        y: position.y + 7,
        text: `${observation.initialPriorities[slot] ?? "new"}→${priority}`,
        fontSize: 14,
        color: "#172033",
        anchorSide: "center",
      },
      {
        ...position,
        x: position.x + (writes ? 32 : 0),
        y: position.y + (writes ? 3 : 34),
        text: `${writes} writes`,
        fontSize: 13,
        color: writes ? color : "#94a3b8",
        anchorSide: writes ? "center_left" : "center",
      },
    )
  }
  visualText(
    graphics,
    left + 20,
    494,
    `Insertion: ${observation.writes} scalar writes. Pops: ${observation.popOrder.join(", ")}`,
    13,
    color,
  )
}

test("B01 hole sifts almost halve typed-array writes while retaining the same pops", async (): Promise<void> => {
  const actual = createB01Heap()
  const reference = new SwapTypedMinHeap()
  const actualWork = { writes: 0 }
  const referenceWork = { writes: 0 }
  countWrites(actual, actualWork)
  countWrites(reference, referenceWork)
  let pushes = 0
  let pops = 0
  for (let index = 4096; index > 0; index--) {
    actual.push(index, index, index)
    reference.push(index, index, index)
    pushes++
  }
  while (reference.size > 0) {
    expect(actual.pop()).toBe(reference.pop())
    pops++
  }
  expect(actualWork.writes).toBeGreaterThan(0)
  expect(actualWork.writes).toBeLessThan(referenceWork.writes * 0.55)
  const priorities = [2, 4, 6, 8, 10, 12, 14]
  const insertedPriority = 1
  const before = observeInsertion(
    new SwapTypedMinHeap(),
    priorities,
    insertedPriority,
  )
  const after = observeInsertion(createB01Heap(), priorities, insertedPriority)
  expect(after.initialPriorities).toEqual(before.initialPriorities)
  expect(after.finalPriorities).toEqual(before.finalPriorities)
  expect(after.popOrder).toEqual(before.popOrder)
  expect(after.writes).toBeLessThan(before.writes)
  expect({
    fullWorkload: {
      pushes,
      pops,
      beforeWrites: referenceWork.writes,
      afterWrites: actualWork.writes,
    },
    illustrativeInsertion: { before, after },
  }).toMatchSnapshot("measured writes with identical final heaps and pops")
  const graphics = performanceCanvas(
    "B01 heap: move each parent once, keep the same result",
    "Circles show initial → final priority. Per-slot labels count writes to priority, sequence and ID arrays.",
  )
  drawInsertion(graphics, 24, before, true)
  drawInsertion(graphics, 624, after, false)
  visualMetric(
    graphics,
    `${pushes.toLocaleString("en-US")} pushes + ${pops.toLocaleString("en-US")} pops: typed-array element writes`,
    referenceWork.writes,
    actualWork.writes,
    "All pop results match. Blue arrows carry the inserted entry; orange/green arrows carry parents.",
  )
  await expectPerformanceSvg(graphics, import.meta.path)
})
