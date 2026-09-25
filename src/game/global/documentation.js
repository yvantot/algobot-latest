export const DOC_CATEGORIES = { bot_movement:"Movement", bot_farm_actions:"Farming", bot_checks:"Checks", syntax:"Programming", globals:"Globals", shop:"Shop", inventory:"Inventory", crops:"Crops", events:"Events" };
const simple = ["up","down","left","right","till","water","harvest","destroy","kill_bug","extinguish"];
const checks = {is_tilled:"bot_check_tilled",is_watered:"bot_check_watered",is_planted:"bot_check_planted",is_harvestable:"bot_is_harvestable",is_bug:"bot_is_bug",is_fire:"bot_is_fire",is_dead:"bot_is_dead"};
const number = value => ({shadow:{type:"math_number",fields:{NUM:value}}});
export function commandExample(category, name) {
  if (category === "bot_checks" && ["crop_value","crop_time_left","crop_type"].includes(name)) return {
    code:`bot.say(bot.${name}(0, 0));`, block:{type:"bot_say",inputs:{TEXT:{block:{type:`bot_${name}`,inputs:{X:number(0),Y:number(0)}}}}}, requires:["say"],
  };
  if (category.startsWith("bot_") && simple.includes(name)) return {code:`bot.${name}();`,block:{type:`bot_${name}`}};
  if (category === "bot_checks" && checks[name]) return {code:`bot.${name}()`,block:{type:checks[name]}};
  if (category === "bot_farm_actions" && name === "plant") return {code:'bot.plant("wheat");',block:{type:"bot_plant",fields:{TYPE:"wheat"}}};
  if (name === "say" && category === "bot_farm_actions") return {code:'bot.say("Hello, farmer!");',block:{type:"bot_say",inputs:{TEXT:{shadow:{type:"text",fields:{TEXT:"Hello, farmer!"}}}}}};
  if (name === "wait" && category === "bot_farm_actions") return {code:"bot.wait(1);",block:{type:"bot_wait",inputs:{AMOUNT:number(1)}}};
  if (name === "jump" && category === "bot_movement") return {code:"bot.jump(0, 0);",block:{type:"bot_jump",inputs:{X:number(0),Y:number(0)}}};
  if (category === "globals" && ["rows","columns"].includes(name)) return {code:`${name}()`,block:{type:`global_${name}`}};
  if(category === "globals" && ["randint","randfloat"].includes(name))return {code:`${name}(0, 10)`,block:{type:`math_${name}`,fields:{LOWER:0,UPPER:10}}};
  if(category === "shop") {
    if(name==="buy_seed")return {code:'shop.buy_seed("wheat", 1);',block:{type:"shop_buy_seed",fields:{TYPE:"wheat"},inputs:{AMOUNT:number(1)}}};
    if(["buy_row","buy_column"].includes(name))return {code:`shop.${name}();`,block:{type:`shop_${name}`}};
    if(name.startsWith("upgrade_bot_"))return {code:`shop.${name}(0);`,block:{type:`shop_${name}`,fields:{BOT:0}}};
  }
  if(category==="inventory"&&name==="seed")return {code:'inventory.seeds("wheat")',block:{type:"inventory_seeds",fields:{TYPE:"wheat"}}};
  if(category==="inventory"&&name==="coin")return {code:"inventory.coins()",block:{type:"inventory_coins"}};
  if (category === "syntax" && name === "for") return {code:"for (var count = 0; count < 2; count++) {\n  bot.right();\n}",block:{type:"controls_repeat_ext",inputs:{TIMES:number(2),DO:{block:{type:"bot_right"}}}},requires:["right"]};
  if (category === "syntax" && name === "if") return {code:"if (bot.is_harvestable()) {\n  bot.harvest();\n}",block:{type:"controls_if",inputs:{IF0:{block:{type:"bot_is_harvestable"}},DO0:{block:{type:"bot_harvest"}}}},requires:["is_harvestable","harvest"]};
  return null;
}
export function documentationEntries(data, quests) {
  return Object.entries(data).flatMap(([category, entries]) => Object.entries(entries).map(([name, value]) => {
    const example = commandExample(category,name);
    const fullName = category.startsWith("bot_") ? `bot.${name}` : ["shop","inventory"].includes(category) ? `${category}.${name}` : name;
    const requirement = Object.values(quests).find(q => q.rewards?.unlocks?.includes(name))?.title;
    return {id:`${category}/${name}`,category,name,fullName,...value,example,
      code:example?.code ?? value.example ?? "", requirement,
      unlocked:value.is_unlocked !== false,
      summary:(value.definition ?? "").split(/(?<=\.)\s/)[0]};
  }));
}
export function filterDocumentation(entries, query, category, availability) {
  const term=query.trim().toLowerCase();
  return entries.filter(e => e.fullName.toLowerCase().includes(term) && (category==="all"||e.category===category) && (availability==="all"||(availability==="unlocked")===e.unlocked));
}
export function insertionProblem(entry, entries) {
  if (!entry.unlocked) return entry.requirement ? `Complete “${entry.requirement}” to unlock.` : "This command is locked.";
  if (!entry.example) return "This is a reference example; insertion is not available.";
  const locked=(entry.example.requires ?? []).find(name => entries.some(e => e.name===name && !e.unlocked));
  return locked ? `Unlock ${locked} before inserting this example.` : "";
}
export function recommendedCommands(quest, entries) {
  const names = quest?.concept === "for" ? ["for","right"] : quest?.concept === "if" ? ["if","is_harvestable","harvest"] : /move|movement|direction/i.test(quest?.description ?? "") ? ["right","down"] : null;
  const text=`${quest?.description ?? ""} ${quest?.tip ?? ""}`.toLowerCase();
  return entries.filter(e => e.category.startsWith("bot_") || e.category==="syntax").filter(e => names ? names.includes(e.name) : new RegExp(`\\b${e.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`).test(text)).slice(0,4);
}
