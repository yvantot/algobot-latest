// Public compatibility facade. Each entity owns its own state and lifecycle.
export { soil, addSoilToGrid } from "./soil.js";
export { crop, addCrop } from "./crop.js";
export { freshness } from "./freshness.js";
export { botact, addFarmbot } from "./robot.js";
export { bug, addBug } from "./pest.js";
export { gridpos, gridmove } from "./grid.js";
export { ysort, displaytext, saytext, dropOrbs, effects, popupicon } from "./presentation.js";
