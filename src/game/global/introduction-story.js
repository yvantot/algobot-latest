export const INTRODUCTION_STORY = [
  {
    "title": "A farm that follows your ideas",
    "text": "Welcome to Algobot! Build blocks to tell your robot how to farm. Let’s see what it can do.",
    "code": [
      "// Your instructions become the robot’s actions"
    ],
    "action": "welcome",
    "scene": "basics"
  },
  {
    "title": "One command, one action",
    "text": "One block moved Bot 0 one tile right. You choose the blocks; the robot follows them.",
    "code": [
      "bot.right();"
    ],
    "action": "move",
    "scene": "basics"
  },
  {
    "title": "Prepare, then plant",
    "text": "The robot dug the soil, then planted wheat. Planting uses one seed. The order matters!",
    "code": [
      "bot.till();",
      "bot.plant(\"wheat\");"
    ],
    "action": "plant",
    "scene": "basics"
  },
  {
    "title": "Care makes crops grow",
    "text": "Water, then wait. Water again when the soil dries. Crops grow faster in this demo.",
    "code": [
      "bot.water();",
      "bot.wait(3);",
      "bot.water();",
      "bot.wait(3);"
    ],
    "action": "water",
    "scene": "basics"
  },
  {
    "title": "Your harvest earns its keep",
    "text": "That harvest gave us coins and EXP! Spend coins on seeds and upgrades. EXP helps you level up.",
    "code": [
      "bot.harvest();"
    ],
    "action": "harvest",
    "scene": "basics"
  },
  {
    "title": "Ripe does not mean forever",
    "text": "See the green gas? The crop spoiled because we did not harvest it in time!",
    "code": [
      "// No harvest: fresh → expiring → rotten"
    ],
    "action": "spoil",
    "scene": "spoil"
  },
  {
    "title": "More helpers, better plans",
    "text": "Two bots, two jobs! Each robot follows its own blocks. You can unlock more helpers later.",
    "code": [
      "// Bot 0",
      "bot.down();",
      "bot.till();",
      "// Bot 1",
      "bot.right();",
      "bot.right();",
      "bot.till();"
    ],
    "action": "bots",
    "programs": [
      {
        "bot": 0,
        "forever": true, "role": "Soil helper",
        "code": [
          "bot.down();",
          "bot.till();"
        ]
      },
      {
        "bot": 1,
        "forever": true, "role": "New helper",
        "code": [
          "bot.right();",
          "bot.right();",
          "bot.till();"
        ]
      }
    ],
    "scene": "helpers"
  },
  {
    "title": "Rain lends a hand",
    "text": "Rain watered the soil for us! It can also put out fires.",
    "code": [
      "// Rain waters the soil for you"
    ],
    "action": "rain",
    "scene": "rain"
  },
  {
    "action": "fire_loss",
    "title": "Fire can take the whole crop",
    "text": "We left the fire alone. It grew, spread, and burned every crop. Act early to save your farm!",
    "code": [],
    "scene": "fire"
  },
  {
    "title": "Protect what you grow",
    "text": "The robot put out the fire! Left alone, fire grows and can burn nearby crops.",
    "code": [
      "// On a burning tile",
      "bot.extinguish();"
    ],
    "action": "fire",
    "scene": "fire"
  },
  {
    "action": "pest_loss",
    "title": "Small bugs, big damage",
    "text": "These bugs kept biting until every crop was lost. Watch for pests and remove them early!",
    "code": [],
    "scene": "pests"
  },
  {
    "title": "An uninvited guest",
    "text": "That bug was hurting our wheat. The robot removed it before it could do more damage.",
    "code": [
      "// On a tile with a pest",
      "bot.kill_bug();"
    ],
    "action": "pest",
    "scene": "pests"
  },
  {
    "action": "upgrade",
    "title": "Help your bots work faster",
    "text": "You made the bot faster! Watch it visit the whole farm. Next, let’s give that speedy helper more room.",
    "code": [
      "shop.upgrade_bot_move(0);",
      "shop.upgrade_bot_action(0);"
    ],
    "scene": "shop"
  },
  {
    "action": "expand",
    "title": "Give your farm more room",
    "text": "You added a row and a column! More tiles give you more room to grow. The same commands are available in Shop.",
    "code": [
      "shop.buy_row();",
      "shop.buy_column();"
    ],
    "scene": "shop"
  },
  {
    "action": "workflow",
    "title": "A farm that works together",
    "text": "Nine bots, three teams! Planters sow, waterers help crops grow, and harvesters make room for the next crop. Each bot keeps working on its own job.",
    "code": [],
    "programs": [
      {
        "bot": 0,
        "forever": true, "job": "plant", "role": "Planters · Bots 0, 3, 6",
        "code": [
          "bot.say(\"Seeds coming through!\");",
          "bot.till();",
          "bot.plant(\"wheat\");",
          "bot.right();"
        ]
      },
      {
        "bot": 1,
        "forever": true, "job": "water", "role": "Waterers · Bots 1, 4, 7",
        "code": [
          "bot.say(\"Water delivery!\");",
          "bot.water();",
          "bot.right();"
        ]
      },
      {
        "bot": 2,
        "forever": true, "job": "harvest", "role": "Harvesters · Bots 2, 5, 8",
        "checkHarvest": true,
        "code": [
          "bot.say(\"Ready for harvest!\");",
          "bot.harvest();",
          "bot.right();"
        ]
      }
    ],
    "scene": "team"
  },
  {
    "title": "Your first little program",
    "text": "Your turn! Follow one mission at a time. Your first lessons are safe from fire, pests and spoiled crops. Have fun!",
    "code": [],
    "action": "finish",
    "scene": "team"
  }
];

export const DEMO_LESSONS = {
  basics: { title: "Meet your farm", actions: ["welcome", "move", "plant", "water", "harvest", "finish"] },
  events: { title: "Protect your crops", actions: ["spoil", "rain", "fire_loss", "fire", "pest_loss", "pest"], coins: 50, exp: 25 },
  upgrades: { title: "Grow your farm", actions: ["bots", "upgrade", "expand", "workflow"], coins: 50, exp: 25 },
};
export function demonstrationStory(lesson = "basics") {
  return DEMO_LESSONS[lesson].actions.map(action => INTRODUCTION_STORY.find(step => step.action === action));
}
export function claimDemoReward(completed, lesson, grant) {
  const reward = DEMO_LESSONS[lesson];
  if (!reward?.coins || completed.includes(lesson)) return false;
  completed.push(lesson);
  grant(reward);
  return true;
}
