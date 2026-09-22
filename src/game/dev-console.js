export function devInteger(value, min, max, label) {
  if (value === "" || value == null || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return Number(value);
}

export function inspectFarm(grid) {
  return [...grid.entries()].filter(([, tile]) => tile.soil).map(([key, tile]) => ({
    key, soil: tile.soil.soil_state, water: tile.soil.water_remaining ?? 0,
    crop: tile.crop ? { type: tile.crop.crop_type, state: tile.crop.crop_state,
      health: tile.crop.crop_health, freshness: tile.crop.freshness_state } : null,
    fire: tile.fire?.isBurning() ? { stage: tile.fire.stage + 1, age: tile.fire.age } : null,
    bug: !!tile.bug, bots: (tile.bots ?? []).map(bot => bot.bot_index),
  }));
}

export async function executeDevAction(action) {
  const result = await action();
  if (result === false || result?.applied === false || result?.triggered === false) {
    return { ok: false, message: result?.reason || "No change / action rejected" };
  }
  return { ok: true, message: typeof result === "number" ? `${result} affected` : "Completed" };
}
