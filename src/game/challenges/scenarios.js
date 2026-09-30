const bed = (type, state = "young", extra = {}) => ({ type, state, ...extra });
const safe = {key:"safe_and_finished",label:"Finish without failed commands or an endless loop."};
export const SCENARIO_CHALLENGES = [
  {id:"corn-sequence-v2",rubric:"corn-sequence-2.0",kind:"sequence",title:"From soil to supper",tier:"Beginner",skill:"Sequential algorithm",coins:150,exp:120,
    description:"Bring me corn grown on this bare patch. The farm follows normal growth and watering times, so patience matters!",
    cases:[[bed(null,"bare")]], rules:[{key:"grew_corn",label:"Plant and harvest corn on every tile."},safe],
    commands:["till","plant","water","wait","harvest","is_watered","is_harvestable"]},
  {id:"corn-row-v2",rubric:"corn-row-2.0",kind:"sequence",title:"Supper for the whole row",tier:"Skilled",skill:"Sequences across several tiles",coins:240,exp:180,
    description:"Fill my corn order from this two-tile patch. How you divide your time is up to you. Crops grow and absorb water in real time.",
    cases:[[bed(null,"bare"),bed(null,"bare")]], rules:[{key:"grew_corn",label:"Plant and harvest corn on every tile."},safe],
    commands:["right","left","till","plant","water","wait","harvest","is_watered","is_harvestable"]},
  {id:"crop-clinic-v2",rubric:"crop-clinic-2.0",kind:"clinic",actionLinkedSyntax:true,title:"The crop clinic",tier:"Skilled",skill:"Conditional algorithm",coins:260,exp:210,
    description:"Three patients, three jobs: harvest ready crops, water young crops, and clear dead crops. Their positions change. Use checks and if/else to decide.",
    cases:[[bed("corn","ready"),bed("rice"),bed("wheat","dead")],[bed("wheat","dead"),bed("corn","ready"),bed("rice")]],
    rules:[{key:"treated_every_crop",label:"Harvest each ready crop, water each young crop, and destroy each dead crop."},{key:"used_condition",label:"Run an if/else decision to choose the treatment."},safe],
    commands:["right","left","harvest","water","destroy","is_dead","is_harvestable"]},
  {id:"irrigation-loop-v2",rubric:"irrigation-loop-2.0",kind:"irrigation",actionLinkedSyntax:true,title:"One loop, any field",tier:"Skilled",skill:"Looping and efficiency",coins:300,exp:240,
    description:"Water every young crop with one reusable loop. Rows have 2, 4 and 6 tiles. Use columns(). Only water and movement spend the action budget: two actions per tile minus one.",
    cases:[2,4,6].map(n=>Array.from({length:n},()=>bed("rice"))),
    rules:[{key:"watered_every_crop",label:"Leave every crop watered."},{key:"used_loop",label:"Water every crop from inside a loop."},{key:"within_budget",label:"Use at most 2 × columns() − 1 water/movement actions."},safe],
    commands:["right","left","water","is_watered"]},
  {id:"harvest-priority-v1",rubric:"harvest-priority-1.0",kind:"greedy",title:"Which crop first?",tier:"Advanced",skill:"Greedy algorithm",coins:420,exp:340,
    description:"Harvest the highest-priority crop first, then compare again. Priority = current coin value ÷ seconds left. Read every tile before choosing. Clocks are frozen in this priority exercise; ties may go in either order.",
    cases:[[bed("corn","ready",{timeLeft:3}),bed("tomato","ready",{timeLeft:8}),bed("potato","ready",{timeLeft:40})],
      [bed("rice","ready",{timeLeft:4}),bed("potato","ready",{timeLeft:40}),bed("corn","ready",{timeLeft:12})]],
    rules:[{key:"harvested_every_crop",label:"Harvest all three crops."},{key:"greedy_order",label:"At every harvest, choose the remaining crop with the largest value ÷ seconds-left ratio."},safe],
    commands:["jump","right","left","harvest","crop_value","crop_time_left","crop_type"]},
  {id:"pest-planner-v2",rubric:"pest-planner-2.0",kind:"planning",requireYield:true,title:"Before the pests",tier:"Expert",skill:"State optimization / planning ahead",coins:650,exp:500,budget:4,
    description:"You have up to four work steps. When your program ends, pests eat what you leave behind. Moving costs the distance in tiles, even for jump; harvesting costs one step. Checks are free. Choose the route with the greatest total coin value. No harvest earns no points. The most valuable single crop may be a trap!",
    cases:[[bed("rice","ready"),bed("corn","ready"),bed(null),bed("tomato","ready",{timeLeft:2})],
      [bed("tomato","ready",{timeLeft:2}),bed(null),bed("rice","ready"),bed("corn","ready")]],
    rules:[{key:"best_yield",label:"Collect the maximum possible coin value in four work steps."},{key:"within_budget",label:"Harvest crops within four work steps; jump costs its distance, harvest costs one."},safe],
    commands:["jump","right","left","harvest","crop_value","crop_time_left","crop_type"]},
  {id:"team-harvest-v1",rubric:"team-harvest-1.0",kind:"team",title:"Pass it on",tier:"Advanced",skill:"Multi-bot communication",coins:500,exp:380,
    description:"A two-bot harvest crew! Bot 0 grows the wheat. Bot 1 collects it. Send the ready column number to Bot 1 so it knows where to work. Both programs start together.",
    cases:[2,3].map(n=>Array.from({length:n},()=>bed("wheat"))),
    rules:[{key:"team_harvest",label:"Bot 0 supplies the water; Bot 1 harvests all the wheat."},
      {key:"shared_work",label:"Bot 1 receives each ripe crop's column number from Bot 0 before harvesting it."},safe],
    commands:["jump","right","left","water","wait","harvest","is_watered","is_harvestable","send","has_message","receive"]},
].map(task=>({...task,prerequisite:"tut_2"}));

// State = position, remaining steps and harvested mask. Kept independent of the
// student's program so the rubric can compare routes without prescribing code.
export function bestRouteValue(values, budget, position = 0, mask = 0, memo = new Map()) {
  const key = `${position}:${budget}:${mask}`;
  if (memo.has(key)) return memo.get(key);
  let best = 0;
  values.forEach((value, next) => {
    const cost = Math.abs(next - position) + 1;
    if (value <= 0 || mask & (1 << next) || cost > budget) return;
    best = Math.max(best, value + bestRouteValue(values, budget-cost, next, mask | (1<<next), memo));
  });
  memo.set(key,best); return best;
}
