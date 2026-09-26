export const FREESTYLE_COMMANDS = ["left","right","up","down","jump","wait","till","plant","water","harvest","destroy","kill_bug","extinguish","is_tilled","is_watered","is_planted","is_harvestable","is_dead","is_bug","is_fire","crop_value","crop_time_left","crop_type","send","receive","has_message"];
export const nativeChallengeCommand = name => name.startsWith("crop_") || ["send","receive","has_message"].includes(name);
export function challengeCommands(task) {
  return task.playMode === "freestyle" ? FREESTYLE_COMMANDS : task.commands ?? ["right","left","harvest","is_harvestable"];
}
export function challengeEntryAllowed(ready, exposed, playMode = "recommended") {
  return ready || exposed || playMode === "freestyle";
}
