export const INTRODUCTION_STORY = [
  {
    "title": "A farm that follows your ideas",
    "text": "Welcome to Algobot! Build blocks to tell your robot how to farm. Let’s see what it can do.",
    "code": [
      "// Your instructions become the robot’s actions"
    ],
    "action": "welcome"
  },
  {
    "title": "One command, one action",
    "text": "One block moved Bot 0 one tile right. You choose the blocks; the robot follows them.",
    "code": [
      "bot.right();"
    ],
    "action": "move"
  },
  {
    "title": "Prepare, then plant",
    "text": "The robot dug the soil, then planted wheat. Planting uses one seed. The order matters!",
    "code": [
      "bot.till();",
      "bot.plant(\"wheat\");"
    ],
    "action": "plant"
  },
  {
    "title": "Care makes crops grow",
    "text": "The bot waited while water soaked in. bot.wait pauses one robot so crops have time to grow. This demo uses a short wait; crops can take longer on your farm.",
    "code": [
      "bot.water();",
      "bot.wait(3);",
      "bot.water();",
      "bot.wait(3);"
    ],
    "action": "water"
  },
  {
    "title": "Your harvest earns its keep",
    "text": "That harvest gave us coins and EXP! Spend coins on seeds and upgrades. EXP helps you level up.",
    "code": [
      "bot.harvest();"
    ],
    "action": "harvest"
  },
  {
    "title": "Ripe does not mean forever",
    "text": "See the green gas? The crop spoiled because we did not harvest it in time!",
    "code": [
      "// No harvest: fresh → expiring → rotten"
    ],
    "action": "spoil"
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
        "role": "Soil helper",
        "code": [
          "bot.down();",
          "bot.till();"
        ]
      },
      {
        "bot": 1,
        "role": "New helper",
        "code": [
          "bot.right();",
          "bot.right();",
          "bot.till();"
        ]
      }
    ]
  },
  {
    "title": "Rain lends a hand",
    "text": "Rain watered the soil for us! It can also put out fires.",
    "code": [
      "// Rain waters the soil for you"
    ],
    "action": "rain"
  },
  {
    "action": "fire_loss",
    "title": "Fire can take the whole crop",
    "text": "We left the fire alone. It grew, spread, and burned every crop. Act early to save your farm!",
    "code": []
  },
  {
    "title": "Protect what you grow",
    "text": "The robot put out the fire! Left alone, fire grows and can burn nearby crops.",
    "code": [
      "// On a burning tile",
      "bot.extinguish();"
    ],
    "action": "fire"
  },
  {
    "action": "pest_loss",
    "title": "Small bugs, big damage",
    "text": "These bugs kept biting until every crop was lost. Watch for pests and remove them early!",
    "code": []
  },
  {
    "title": "An uninvited guest",
    "text": "That bug was hurting our wheat. The robot removed it before it could do more damage.",
    "code": [
      "// On a tile with a pest",
      "bot.kill_bug();"
    ],
    "action": "pest"
  },
  {
    "action": "expand",
    "title": "Give your farm more room",
    "text": "You added a row and a column! More tiles give you more room to grow. The same commands are available in Shop.",
    "code": [
      "shop.buy_row();",
      "shop.buy_column();"
    ]
  },
  {
    "action": "upgrade",
    "title": "Help your bots work faster",
    "text": "You made the bot faster! Its loop reads rows and columns, so it visits every tile even after the farm grows.",
    "code": [
      "shop.upgrade_bot_move(0);",
      "shop.upgrade_bot_action(0);"
    ]
  },
  {
    "action": "workflow",
    "title": "A farm that works together",
    "text": "Four bots share a bigger farm! Two grow wheat and potatoes while two harvest mixed crops. Small jobs become a busy team. Build toward this one step at a time.",
    "code": [],
    "programs": [
      {
        "bot": 0,
        "role": "Grower",
        "repeat": 6,
        "code": [
          "bot.say(\"Planting!\");",
          "bot.till();",
          "bot.plant(\"wheat\");",
          "bot.water();",
          "bot.wait(0.7);",
          "bot.water();",
          "bot.wait(0.7);",
          "bot.right();"
        ]
      },
      {
        "bot": 1,
        "role": "Harvester",
        "repeat": 6,
        "checkHarvest": true,
        "code": [
          "bot.say(\"Checking crops!\");",
          "bot.harvest();",
          "bot.right();"
        ]
      },
      {
        "bot": 2,
        "role": "Potato grower",
        "repeat": 6,
        "code": [
          "bot.say(\"Planting!\");",
          "bot.till();",
          "bot.plant(\"potato\");",
          "bot.water();",
          "bot.wait(0.7);",
          "bot.water();",
          "bot.wait(0.7);",
          "bot.right();"
        ]
      },
      {
        "bot": 3,
        "role": "Second harvester",
        "repeat": 6,
        "checkHarvest": true,
        "code": [
          "bot.say(\"Checking crops!\");",
          "bot.harvest();",
          "bot.right();"
        ]
      }
    ]
  },
  {
    "title": "Your first little program",
    "text": "Your turn! Follow one mission at a time. Your first lessons are safe from fire, pests and spoiled crops. Have fun!",
    "code": [],
    "action": "finish"
  }
];
