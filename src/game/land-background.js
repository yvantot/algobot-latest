export function addLandBackground(engine, farm) {
  const width = farm.columns * farm.tile_size + (farm.columns - 1) * farm.gap + 50;
  const height = farm.rows * farm.tile_size + (farm.rows - 1) * farm.gap + 50;
  return [[-10, "#896338"], [-25, farm.bg_soil]].map(([offset, color]) => engine.add([
    engine.pos(farm.grid_origin.x - 25, farm.grid_origin.y + offset),
    engine.rect(width, height, { radius: 30 }), engine.color(color),
    engine.anchor("topleft"), engine.layer("land_bg"),
  ]));
}
