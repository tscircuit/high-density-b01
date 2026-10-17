export const getPortAlignedGridCoordinates = (
  min: number,
  max: number,
  cellSize: number,
  portCoordinates: number[],
): number[] => {
  const count = Math.max(1, Math.ceil((max - min) / cellSize))
  const coordinates = [
    ...Array.from({ length: count + 1 }, (_, index) =>
      min + ((max - min) * index) / count,
    ),
    ...portCoordinates.filter((coordinate) => coordinate >= min && coordinate <= max),
  ].sort((left, right) => left - right)
  return coordinates.filter(
    (coordinate, index) => index === 0 || coordinate - coordinates[index - 1]! > 1e-6,
  )
}

export const getCoordinateLowerBound = (
  coordinates: number[],
  target: number,
): number => {
  let low = 0
  let high = coordinates.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (coordinates[middle]! < target) low = middle + 1
    else high = middle
  }
  return low
}

export const getNearestCoordinateIndex = (
  coordinates: number[],
  target: number,
): number => {
  const right = getCoordinateLowerBound(coordinates, target)
  if (right === 0) return 0
  if (right === coordinates.length) return right - 1
  return target - coordinates[right - 1]! <= coordinates[right]! - target
    ? right - 1
    : right
}
