import { CONFIG, INVENTORY, DOCUMENT_DATA } from "./global.js";
import { buyLand, buyUpgrade, buyPlants } from "./shop.js";
import { telemetry } from "../ml/telemetry.js";
import { createCommandAPI } from "./command-api.js";
import { createInterpreterInit } from "./interpreter-bindings.js";

// Composition boundary shared by the text and block editors. The command API
// and interpreter adapter themselves have no scene, store or Kaplay imports.
export function createInit(robot, workspace = null, onQuestEvent = null, dependencies = {}) {
  const api = createCommandAPI({
    robot,
    inventory: INVENTORY,
    shop: { buyLand, buyUpgrade, buyPlants },
    telemetry,
    farmSize: () => CONFIG.FARM,
    isUnlocked: (category, key) => DOCUMENT_DATA[category]?.[key]?.is_unlocked ?? true,
    onQuestEvent,
    ...dependencies,
  });
  return createInterpreterInit(api, workspace);
}
