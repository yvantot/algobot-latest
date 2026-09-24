export const CHALLENGES = [
  {
    id: "ready-row-v3", title: "Pick the ready crops", prerequisite: "intro_loop",
    rubric: "ready-row-3.0", tier: "Skilled", skill: "Check before harvesting", coins: 180, exp: 140, seeds: 12,
    description: "Visit every tile. Harvest the yellow, ready wheat. Leave the young wheat alone.",
    cases: [[1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 0, 1]],
  },
  {
    id: "changing-row-v3", title: "A row of any size", prerequisite: "intro_loop",
    rubric: "changing-row-3.0", tier: "Advanced", skill: "Loops that adapt to row size", coins: 280, exp: 220, seeds: 18,
    description: "Do the same job on rows of different sizes. Use columns() to find the row length.",
    cases: [[0, 1, 1], [1, 0, 1, 0, 1], [0, 1, 0, 1, 1, 0]],
  },
  {
    id:"first-harvest-v1",title:"Your first harvest",prerequisite:"intro_loop",rubric:"first-harvest-1.0",
    tier:"Beginner",skill:"Put commands in order",coins:90,exp:80,seeds:8,
    description:"Every crop is ready. Visit the whole row and harvest each one without walking off the farm.",
    cases:[[1,1,1]],
  },
  {
    id:"careful-steps-v1",title:"Two careful steps",prerequisite:"intro_loop",rubric:"careful-steps-1.0",
    tier:"Beginner",skill:"Your first crop checks",coins:120,exp:100,seeds:10,
    description:"Only two tiles, but the ripe wheat changes places. Check before each harvest.",
    cases:[[1,0],[0,1],[1,1]],
  },
  {
    id:"return-home-v1",title:"Back to the barn",prerequisite:"intro_loop",rubric:"return-home-1.0",returnHome:true,
    tier:"Advanced",skill:"Plan the outward and return trip",coins:360,exp:280,seeds:22,
    description:"Harvest the ready wheat across four tiles, then finish back on the first tile.",
    cases:[[1,0,1,0],[0,1,0,1],[1,1,0,1]],
  },
  {
    id:"field-patrol-v1",title:"The master patrol",prerequisite:"intro_loop",rubric:"field-patrol-1.0",returnHome:true,
    tier:"Expert",skill:"Adaptive loops, checks and a return trip",coins:550,exp:400,seeds:30,
    description:"Patrol rows of 5, 7 and 9 tiles. One row has no ready crops. Check every tile and always return to the first tile.",
    cases:[[1,0,1,0,1],[0,0,0,0,0,0,0],[0,1,0,1,1,0,1,0,1]],
  },
];

export const TIER_ORDER = ["Beginner","Skilled","Advanced","Expert"];
export const challengeRules = task => [
  {key:"visited_every_tile",label:"Visit every tile, including the last one."},
  {key:"harvested_all_ready",label:"Harvest every yellow, ready crop."},
  {key:"safe_and_finished",label:"Finish without errors: leave young crops alone, stay inside the row, and end your loop."},
  ...(task.returnHome ? [{key:"returned_home",label:"Finish on the first tile (where Bot 0 started)."}] : []),
];
export const challengeMaxScore = task => task.cases.length * challengeRules(task).length;

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
