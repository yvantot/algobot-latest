export const LEARNING_SKILLS = [
 {title:"Commands and directions",quests:["intro_run","intro_build"],text:"Tell a robot where to move.",command:"bot.right",example:"move"},
 {title:"Messages",quests:["intro_say"],text:"Let your robot explain what it is doing.",command:"bot.say"},
 {title:"Steps in order",quests:["intro_sequence","tut_2"],text:"Put actions in order to grow and harvest crops.",command:"bot.plant",example:"plant"},
 {title:"Loops",quests:["intro_loop"],text:"Repeat a small set of instructions.",command:"for"},
 {title:"Checks and choices",quests:["cs_check_0","cs_if_0","cs_cleanup_0"],text:"Check for a crop, then choose whether to plant.",command:"bot.is_planted"},
 {title:"Grid coordinates",quests:["cs_grid_0","cs_jump_0"],text:"Use row and column counts to visit farm tiles.",command:"rows",example:"expand"},
 {title:"Timing",quests:["cs_wait_0"],text:"Wait when a crop needs time to grow.",command:"bot.wait",example:"water"},
 {title:"Random numbers",quests:["cs_random_0"],text:"Use a random value in a program.",command:"randint"},
 {title:"Farm planning",quests:["shop_seed_0","shop_land_0","shop_upgrade_0"],text:"Buy supplies, add space and improve your bots.",command:"shop.buy_row",example:"upgrade"},
 {title:"Row programs",quests:["farm_two_0","loop_row_0","loop_water_0","loop_size_0"],text:"Use loops to care for a row.",command:"for"},
 {title:"Decisions",quests:["if_ready_0","if_else_0","if_row_0","logic_compare_0","logic_and_0"],text:"Combine checks with actions.",command:"if"},
 {title:"Variables",quests:["var_set_0","var_change_0","var_harvest_0","var_crop_0"],text:"Remember values and count your harvest.",command:"bot.say"},
 {title:"Whole-farm loops",quests:["for_count_0","loop_farm_0"],text:"Visit every tile with nested loops.",command:"for"},
 {title:"Functions",quests:["fn_define_0","fn_reuse_0","fn_param_0","fn_return_0"],text:"Name steps, share inputs, and return answers.",command:"bot.plant"},
 {title:"Lists and hazards",quests:["list_crops_0","hazard_bug_0","hazard_fire_0"],text:"Use lists and check your farm for trouble.",command:"bot.is_bug"}
];
export function learningProgress(state,active){return LEARNING_SKILLS.map(skill=>({...skill,completed:skill.quests.filter(key=>state[key]?.is_completed).length,current:skill.quests.includes(active)}));}
