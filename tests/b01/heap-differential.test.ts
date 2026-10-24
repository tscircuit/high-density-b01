import { expect, test } from "bun:test"
import { createB01Heap } from "../fixtures/createB01Heap"
import { SwapTypedMinHeap } from "../fixtures/SwapTypedMinHeap"

test("B01 hole sifts preserve every active heap slot and pop across ties, wrapping and growth", (): void => {
  const actual = createB01Heap()
  const reference = new SwapTypedMinHeap()
  const priorities = [
    NaN,
    Infinity,
    -Infinity,
    0,
    -0,
    1,
    -1,
    Number.MIN_VALUE,
    -Number.MIN_VALUE,
    Number.MAX_VALUE,
  ]
  const sequences = [
    0,
    -0,
    1,
    1,
    -1,
    2 ** 32 - 1,
    2 ** 32,
    2 ** 32 + 1,
    2 ** 53 - 1,
    1.75,
    -1.75,
    NaN,
    Infinity,
  ]
  let randomState = 314159265
  const assertSlots = (): void => {
    expect(actual.size).toBe(reference.size)
    for (const field of ["seq", "id"] as const) {
      expect(actual[field].subarray(0, actual.size)).toEqual(
        reference[field].subarray(0, reference.size),
      )
    }
    // Compare priorities explicitly because typed-array equality rejects NaNs.
    for (let index = 0; index < actual.size; index++) {
      if (!Object.is(actual["f"][index], reference["f"][index])) {
        throw new Error(`Priority differs at active heap slot ${index}`)
      }
    }
  }
  for (let index = 0; index < 4097; index++) {
    const priority = 4097 - index
    const sequence = sequences[index % sequences.length]!
    const id = index % 2 ? index + 2 ** 32 : -index - 2 ** 31
    actual.push(priority, sequence, id)
    reference.push(priority, sequence, id)
    assertSlots()
  }
  expect(actual["f"].length).toBe(8192)
  while (reference.size > 0) {
    expect(actual.pop()).toBe(reference.pop())
    assertSlots()
  }
  for (let operation = 0; operation < 10_000; operation++) {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
    if (operation % 997 === 0) {
      actual.clear()
      reference.clear()
    } else if (
      reference.size > 0 &&
      (randomState % 3 === 0 || reference.size >= 256)
    ) {
      expect(actual.pop()).toBe(reference.pop())
    } else {
      const priority = priorities[randomState % priorities.length]!
      const sequence = sequences[(randomState >>> 8) % sequences.length]!
      const id = sequences[(randomState >>> 16) % sequences.length]!
      actual.push(priority, sequence, id)
      reference.push(priority, sequence, id)
    }
    assertSlots()
  }
  while (reference.size > 0) {
    expect(actual.pop()).toBe(reference.pop())
    assertSlots()
  }
})
