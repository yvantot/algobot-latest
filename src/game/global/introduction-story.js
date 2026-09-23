export const INTRODUCTION_STORY = [
  { title: "A farm that follows your ideas", text: "Welcome to Algobot! Build blocks to tell your robot how to farm. Let’s see what it can do.", code: ["// Your instructions become the robot’s actions"], action: "welcome" },
  { title: "One command, one action", text: "One block moved Bot 0 one tile right. You choose the blocks; the robot follows them.", code: ["bot.right();"], action: "move" },
  { title: "Prepare, then plant", text: "The robot dug the soil, then planted wheat. Planting uses one seed. The order matters!", code: ["bot.till();", 'bot.plant("wheat");'], action: "plant" },
  { title: "Care makes crops grow", text: "The wheat grew after we watered it. When the soil dries, water again.", code: ["bot.water();", "// Wait for the soil to dry", "bot.water();"], action: "water" },
  { title: "Your harvest earns its keep", text: "That harvest gave us coins and EXP! Spend coins on seeds and upgrades. EXP helps you level up.", code: ["bot.harvest();"], action: "harvest" },
  { title: "Ripe does not mean forever", text: "See the green gas? The crop spoiled because we did not harvest it in time!", code: ["// No harvest: fresh → expiring → rotten"], action: "spoil" },
  { title: "More helpers, better plans", text: "Two bots, two jobs! Each robot follows its own blocks. You can unlock more helpers later.", code: ["// Bot 0", "bot.down();", "bot.till();", "// Bot 1", "bot.right();", "bot.right();", "bot.till();"], action: "bots" },
  { title: "Rain lends a hand", text: "Rain watered the soil for us! It can also put out fires.", code: ["// Rain waters the soil for you"], action: "rain" },
  { title: "Protect what you grow", text: "The robot put out the fire! Left alone, fire grows and can burn nearby crops.", code: ["// On a burning tile", "bot.extinguish();"], action: "fire" },
  { title: "An uninvited guest", text: "That bug was hurting our wheat. The robot removed it before it could do more damage.", code: ["// On a tile with a pest", "bot.kill_bug();"], action: "pest" },
  { title: "Your first little program", text: "Your turn! Follow one mission at a time. Your first lessons are safe from fire, pests and spoiled crops. Have fun!", code: ["bot.right();", "// Your first mission starts with this one block"], action: "finish" },
];
