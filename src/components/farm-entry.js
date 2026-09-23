// A fresh farm is a new game even when this browser has been used before.
export function farmEntryScreen(isNewFarm, preferences) {
  if (isNewFarm) return "demonstration";
  return preferences.getItem("algobot_hide_onboarding") === "true" ? null : "onboarding";
}
