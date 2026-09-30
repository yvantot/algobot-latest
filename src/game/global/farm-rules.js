import { SoilStates, CropStates } from "./enum.js";

export function isPurchaseAmount(amount) {
  return Number.isSafeInteger(amount) && amount > 0;
}

export function expansionTiles(rows, columns, direction, amount) {
  const tiles = [];
  if (!isPurchaseAmount(amount) || !["row", "column"].includes(direction)) return tiles;
  for (let n = 0; n < amount; n++) {
    if (direction === "row") {
      for (let x = 0; x < columns; x++) tiles.push({ x, y: rows + n });
    } else {
      for (let y = 0; y < rows; y++) tiles.push({ x: columns + n, y });
    }
  }
  return tiles;
}

export function waterRainTiles(farmGridIndex) {
  let count = 0;
  for (const tile of farmGridIndex.values()) {
    if (tile.soil?.soil_state !== SoilStates.READY) continue;
    if (tile.crop && ![CropStates.YOUNG, CropStates.GROWING].includes(tile.crop.crop_state)) continue;
    tile.soil.setSoilState(SoilStates.WATERED);
    count++;
  }
  return count;
}
