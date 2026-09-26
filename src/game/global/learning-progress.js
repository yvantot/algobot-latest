export const LEARNING_SKILLS = [
 {title:"Commands and directions",quests:["intro_run","intro_build"],text:"Tell a robot where to move.",command:"bot.right",example:"move"},
 {title:"Messages",quests:["intro_say"],text:"Let your robot explain what it is doing.",command:"bot.say"},
 {title:"Steps in order",quests:["intro_sequence","tut_2"],text:"Put actions in order to grow and harvest crops.",command:"bot.plant",example:"plant"},
 {title:"Loops",quests:["intro_loop"],text:"Repeat a small set of instructions.",command:"for"},
 {title:"Checks and choices",quests:["cs_check_0","cs_if_0","cs_cleanup_0"],text:"Check for a crop, then choose whether to plant.",command:"bot.is_planted"},
 {title:"Grid coordinates",quests:["cs_grid_0","cs_jump_0"],text:"Use row and column counts to visit farm tiles.",command:"rows",example:"expand"},
 {title:"Timing",quests:["cs_wait_0"],text:"Wait when a crop needs time to grow.",command:"bot.wait",example:"water"},
 {title:"Random numbers",quests:["cs_random_0"],text:"Use a random value in a program.",command:"randint"},
 {title:"Farm planning",quests:["shop_seed_0","shop_land_0","shop_upgrade_0"],text:"Buy supplies, add space and improve your bots.",command:"shop.buy_row",example:"upgrade"}
];
export function learningProgress(state,active){return LEARNING_SKILLS.map(skill=>({...skill,completed:skill.quests.filter(key=>state[key]?.is_completed).length,current:skill.quests.includes(active)}));}
