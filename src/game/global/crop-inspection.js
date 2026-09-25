import { CropStates } from "./enum.js";

export function cropReading(crop, field) {
  const alive = crop && !crop.crop_removed && crop.crop_state !== CropStates.DEAD;
  const ready = alive && crop.crop_state === CropStates.HARVESTABLE && !crop.is_harvesting;
  if (field === "crop_type") return alive ? crop.crop_type : "";
  if (field === "crop_time_left") return ready && Number.isFinite(crop.spoilage_remaining) ? Math.max(0, crop.spoilage_remaining) : -1;
  if (field === "crop_value") return ready ? crop.crop_reward / (crop.spoilage_remaining > crop.crop_spoilage_time / 2 ? 1 : 2) : 0;
  return 0;
}

export const CROP_READINGS = ["crop_value", "crop_time_left", "crop_type"];
