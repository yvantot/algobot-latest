# Algorithm challenges

The board has ten challenges. Pick the ready crops, A row of any size, and The master patrol are retired from the menu. Their original definitions remain available only for reading historical exports.

| Task | Scored behavior | Coins / EXP |
| --- | --- | --- |
| Your first harvest | Visit the row and harvest ripe wheat safely | 90 / 80 |
| Two careful steps | Check crops across three two-tile arrangements | 120 / 100 |
| Back to the barn | Harvest safely and return home | 360 / 280 |
| From soil to supper | Grow and harvest corn using normal farming behavior | 150 / 120 |
| Supper for the whole row | Grow and harvest corn on two bare tiles | 240 / 180 |
| The crop clinic | Choose treatment for ripe, young and dead crops | 260 / 210 |
| One loop, any field | Water changing row sizes within the action budget using a loop | 300 / 240 |
| Which crop first? | Repeatedly choose the greatest current value / freshness time | 420 / 340 |
| Before the pests | Maximize harvested value within four work steps | 650 / 500 |
| Pass it on | Coordinate a grower and harvester through messages | 500 / 380 |

All farms use the existing robot, soil, crop, harvest reward effects and pest components. Challenge actions cannot spend main-farm resources or enter normal-gameplay telemetry. Coins and EXP are granted once through the existing reward claim mechanism.

Main-farm tips are suppressed by isolated crop, robot and pest components. As a second guard, `triggerDidYouKnow` refuses to open tips while a blocking scene is active, without marking those tips as seen. This prevents a hidden tip from pausing the challenge engine. Regression coverage runs successful and failed programs across all ten active challenges, checks pest endings, and verifies that normal-farm tips remain available. The browser fixture explicitly disables introductory practice so tutorial suppression cannot mask a leaked tip.

## Normal growth

The two corn challenges use normal frame-driven growth and water absorption, with timing information read from BASE_CROP_DATA. This frozen copy of the game's original crop data is scoped to the challenge farm; main-farm DDA changes cannot alter assessment conditions. Corn has two 30-second stages; neighboring corn provides the same speed benefit as on the main farm. Ripe corn spoils after 13 seconds. One water dose feeds one stage. No challenge calls advanceGrowth from bot.wait or prescribes an exact command sequence. Checks, movement and waiting all allow the engine clock to advance. Dry crops cannot grow.

Pass it on uses the same lifecycle for wheat (two one-second stages, then 20 seconds before spoilage). The player writes two separate programs, in Blockly or text. Both run together; Bot 0 waters, Bot 1 harvests, and each ready column must be received before its harvest. Both sources are retained in the submitted JSON program bundle.

Challenge text editing shares the Bot Command CodeMirror setup: JavaScript highlighting, line numbers, bracket matching, history, search and command help. Completion lists use the task's allowed commands rather than main-farm quest locks. Each team bot has an independent editor and history; switching to Blockly and back preserves authored text. The challenge runner owns execution and scoring, and text is read-only during a run. The editor component does not read or write main-farm robot state or telemetry.

## Main-game bot communication

Available in the Farming Blockly category, text coding and Documentation:

- bot.send(botNumber, message): send text, a finite number, or a boolean to an existing bot on the same farm.
- bot.has_message(): test whether this bot has a queued message.
- bot.receive(): remove and return the oldest message; return empty text when none exists.

Each bot has a 32-message inbox. Text is limited to 200 characters. Inboxes reset on farm reload or bot removal. A waiting loop should include bot.wait so another bot can work. Use Start All for collaborating main-farm programs. Challenge farms have separate inboxes, cleared between attempts and cases.

## Crop readings and fixed exercises

bot.crop_value(column, row), bot.crop_time_left(column, row) and bot.crop_type(column, row) read actual objects on the robot's farm. Expiring crops use the normal half-value reward. They are available in main-game text, Blockly and Documentation.

Clinic, irrigation, greedy and planning exercises explicitly freeze crop lifecycle while the student thinks and runs the fixed test cases. The greedy rule is an exercise heuristic, not a claim of universally optimal farming.

Before the pests uses a work-step budget, not random arrival timing: harvest costs one; movement costs tile distance, including jump. A dynamic-programming oracle scores the best achievable value without requiring a particular implementation. Finishing the program ends the available work period. Real pests then jump in and damage the remaining crops twice over about 1.4 seconds. This ending lasts about 2.2 seconds and can be stopped. The challenge uses susceptible crops; potato immunity is not overridden. This hazard configuration belongs only to the challenge scene.

## Research and verification

Corn tasks use corn-sequence-v2 and corn-row-v2; team coordination uses team-harvest-v1. Crop clinic and irrigation now use crop-clinic-v2 and irrigation-loop-v2: the successful treatment must execute inside an if statement, and each successful watering must execute inside a loop, respectively. An unrelated empty statement does not earn that point. The pest task uses pest-planner-v2: no harvested yield earns zero points, including safety and budget criteria.

New attempts use assessor protocol algobot-live-cases-5.0 and crop_profile baseline, with fixed robot timings for both team members. Earlier IDs and rubrics remain readable through the historical catalog. Training rejects mixed task IDs, rubric versions or assessor protocols; normalized scores alone do not make these interchangeable. Use exports from one reviewed build for a new collection.

The preparation CLI requires an explicit task ID. For example, use careful-steps-v1 for Two careful steps after choosing and piloting a consistent task for the collection protocol. Previously documented ready-row-v3 is retired from the menu and is only an option for historical data. No model weights are changed by this work.

Tests exercise normal absorption without bot.wait, actual live-farm setup and soil survival after harvest, pest damage and cleanup, both team programs, syntax failures, missing communication, stuck loops, interruption, exports and historical rubrics. UI verification uses the isolated fixture and does not save participant records.

## Availability and stopped runs

Challenge navigation and invitations appear only after the tutorial and a usable recent normal-gameplay window. Opening rechecks readiness before recording exposure. New attempts use assessor protocol 5: Stop & Edit keeps the same attempt open; the first fully evaluated submission fixes the label even if it fails. Stops and later scored retries remain in the export. Closing before any evaluated submission leaves an unscored attempt. Historical assessor protocols remain unchanged.
