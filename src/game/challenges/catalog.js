export const CHALLENGES = [
  {
    id: "ready-row-v2", title: "Pick the ready crops", prerequisite: "intro_loop",
    rubric: "ready-row-2.0", coins: 30, exp: 40, seeds: 3,
    description: "Visit every tile. Harvest the yellow, ready wheat. Leave the young wheat alone.",
    cases: [[1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 0, 1]],
  },
  {
    id: "changing-row-v2", title: "A row of any size", prerequisite: "intro_loop",
    rubric: "changing-row-2.0", coins: 50, exp: 60, seeds: 5,
    description: "Do the same job on rows of different sizes. Use columns() to find the row length.",
    cases: [[0, 1, 1], [1, 0, 1, 0, 1], [0, 1, 0, 1, 1, 0]],
  },
];

export const CHALLENGE_STORAGE = "algobot_challenge_exposure_v1";

export function hasExposure(storage, participant, task) {
  const ledger = JSON.parse(storage.getItem(CHALLENGE_STORAGE) || "{}");
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) throw Error("Challenge history is unreadable. Export your data before clearing storage.");
  return Boolean(ledger[JSON.stringify([participant, task])]);
}

export function recordExposure(storage, participant, task) {
  const first = !hasExposure(storage, participant, task);
  const ledger = JSON.parse(storage.getItem(CHALLENGE_STORAGE) || "{}");
  ledger[JSON.stringify([participant, task])] = true;
  storage.setItem(CHALLENGE_STORAGE, JSON.stringify(ledger));
  return first;
}
