import { expect, test } from "bun:test"
import type { HighDensitySolverB01 } from "../../lib/HighDensitySolverB01/HighDensitySolverB01"
import { createB01Heap } from "../fixtures/createB01Heap"
import { SwapTypedMinHeap } from "../fixtures/SwapTypedMinHeap"

type HeapStorage = {
  f: Float64Array
  seq: Uint32Array
  id: Int32Array
  ensureCapacity: (size: number) => void
}

function countWrites(
  heap: HighDensitySolverB01["heap"] | SwapTypedMinHeap,
  counter: { writes: number },
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
        if (typeof property === "string" && /^\d+$/.test(property))
          counter.writes++
        return Reflect.set(target, property, value, target)
      },
    })
    Object.defineProperty(heap, field, { value: counted, writable: true })
  }
}

test("B01 hole sifts almost halve typed-array writes while retaining the same pops", (): void => {
  const actual = createB01Heap()
  const reference = new SwapTypedMinHeap()
  const actualWork = { writes: 0 }
  const referenceWork = { writes: 0 }
  countWrites(actual, actualWork)
  countWrites(reference, referenceWork)
  for (let index = 4096; index > 0; index--) {
    actual.push(index, index, index)
    reference.push(index, index, index)
  }
  while (reference.size > 0) {
    expect(actual.pop()).toBe(reference.pop())
  }
  expect(actualWork.writes).toBeGreaterThan(0)
  expect(actualWork.writes).toBeLessThan(referenceWork.writes * 0.55)
})
