import { SCENARIO_CHALLENGES } from "./archived-scenarios.js";
import { REVIEW_ARCHIVE } from "./archived-review-scenarios.js";

export const HISTORICAL_CHALLENGES = [
  {
    id: "ready-row-v3", title: "Pick the ready crops", prerequisite: "intro_loop",
    rubric: "ready-row-3.0", tier: "Skilled", skill: "Check before harvesting", coins: 180, exp: 140,
    description: "Visit every tile. Harvest the yellow, ready wheat. Leave the young wheat alone.",
    cases: [[1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 0, 1]],
  },
  {
    id: "changing-row-v3", title: "A row of any size", prerequisite: "intro_loop",
    rubric: "changing-row-3.0", tier: "Advanced", skill: "Loops that adapt to row size", coins: 280, exp: 220,
    description: "Do the same job on rows of different sizes. Use columns() to find the row length.",
    cases: [[0, 1, 1], [1, 0, 1, 0, 1], [0, 1, 0, 1, 1, 0]],
  },
  {
    id:"first-harvest-v1",title:"Your first harvest",prerequisite:"intro_loop",rubric:"first-harvest-1.0",
    tier:"Beginner",skill:"Put commands in order",coins:90,exp:80,
    description:"Every crop is ready. Visit the whole row and harvest each one without walking off the farm.",
    cases:[[1,1,1]],
  },
  {
    id:"careful-steps-v1",title:"Two careful steps",prerequisite:"intro_loop",rubric:"careful-steps-1.0",
    tier:"Beginner",skill:"Your first crop checks",coins:120,exp:100,
    description:"Only two tiles, but the ripe wheat changes places. Check before each harvest.",
    cases:[[1,0],[0,1],[1,1]],
  },
  {
    id:"return-home-v1",title:"Back to the barn",prerequisite:"intro_loop",rubric:"return-home-1.0",returnHome:true,
    tier:"Advanced",skill:"Plan the outward and return trip",coins:360,exp:280,
    description:"Harvest the ready wheat across four tiles, then finish back on the first tile.",
    cases:[[1,0,1,0],[0,1,0,1],[1,1,0,1]],
  },
  {
    id:"field-patrol-v1",title:"The master patrol",prerequisite:"intro_loop",rubric:"field-patrol-1.0",returnHome:true,
    tier:"Expert",skill:"Adaptive loops, checks and a return trip",coins:550,exp:400,
    description:"Patrol rows of 5, 7 and 9 tiles. One row has no ready crops. Check every tile and always return to the first tile.",
    cases:[[1,0,1,0,1],[0,0,0,0,0,0,0],[0,1,0,1,1,0,1,0,1]],
  },
  ...SCENARIO_CHALLENGES,
  ...REVIEW_ARCHIVE.filter(task => !SCENARIO_CHALLENGES.some(old => old.id === task.id)),
];
