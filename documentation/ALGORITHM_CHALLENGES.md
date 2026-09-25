# Algorithm challenge expansion

The original six challenge IDs and their rubrics remain. Six new challenges cover five kinds of reasoning, bringing the board to twelve tasks. The board shows the skill before expansion as well as difficulty and rewards.

| Task | Skill and scored behavior | Coins / EXP |
| --- | --- | --- |
| From soil to supper | Sequence: till, plant corn, water/wait twice, then harvest | 150 / 120 |
| Supper for the whole row | Repeat the corn sequence on two bare tiles | 240 / 180 |
| The crop clinic | Conditional decisions: harvest ready crops, water young crops, remove dead crops across changed arrangements | 260 / 210 |
| One loop, any field | Execute a loop and water rows of 2, 4 and 6 tiles within a work budget | 300 / 240 |
| Which crop first? | Greedy selection: repeatedly maximize current value divided by remaining freshness time | 420 / 340 |
| Before the storm | Plan the route with maximum total value within four work steps | 650 / 500 |

All use the game's actual robot, crop and soil components in an isolated farm. Main-farm resources and telemetry are not changed by test actions. Coins and EXP are awarded through the existing claim mechanism only after passing. Students can use blocks or text, stop a run, retry, preview cases, and inspect individual failed rules.

## Student crop readings

Available in normal gameplay and relevant challenges, through text, Blockly and Documentation:

- `bot.crop_value(column, row)`: current coin value if harvestable, otherwise 0. Expiring crops use their actual half-value reward.
- `bot.crop_time_left(column, row)`: remaining seconds before a ready crop spoils, otherwise -1.
- `bot.crop_type(column, row)`: living crop name or empty text.

Coordinates start at zero. Readings do not move the bot or consume a challenge work step. They read the robot's own farm, so challenge code cannot inspect the main farm. Normal-play readings are logged as crop_inspection events, without changing the frozen LSTM feature schema.

## Timing and scoring choices

The sequence tasks deliberately use one-second growth stages. Time advances through the shared crop lifecycle when bot.wait completes. As in normal gameplay, the crop needs a water dose for each of its two stages. Waiting alone cannot grow a dry crop.

Clinic, irrigation, greedy and planning crops stay in their initial states while students think. The greedy exercise freezes freshness numbers and explicitly teaches one priority rule; value/time is an exercise heuristic, not a claim of universally optimal farming.

The planning task uses a fixed storm deadline measured in work steps, not random wall-clock hazards. Harvest costs one, movement costs tile distance, including jump. A dynamic-programming scoring oracle searches position, remaining budget and harvested subset. It accepts any program that achieves the best total yield. Students are not required to implement dynamic programming; the assessed skill is state optimization and planning ahead. The first case makes a greedy choice of the most valuable individual crop lose to a better combination. The storm is represented by the work-step deadline; it does not spawn the main game's random rain or pest events.

Loop and condition tasks observe executed interpreter nodes rather than searching submitted text. All tasks retain instruction/action limits and immediate cancellation. Invalid moves/actions fail the current case; missing or stopped submissions are not invented zero scores.

## Research use

Each new task has its own task ID and rubric. Automatic exports retain first-submission checks and, for planning, earned value, optimum and work steps. The existing importer validates them against the selected task's rubric. Prepare and evaluate one task at a time; a normalized score on one task is not interchangeable with another skill or difficulty.

`ready-row-v3` remains the default model-training target. This expansion does not replace deployed weights, train a model, or establish validity of a general programming-skills assessment. Use a consistent build and task order during collection.

## Verification

Automated tests run solutions for all new tasks through the real interpreter and actual crop/soil/robot methods, with the engine clock controlled for testing. They also reject wrong action order, blind treatment, unrolled watering, wrong greedy order, over-budget movement, long waits and endless loops. Separate tests check crop-reading values and the planning optimum. UI checks use the isolated fixture, which does not save participant sessions.

All 207 tests passed and the production build passed. Browser checks completed the sequence task (3/3, reward claimed) and both planning layouts (6/6, 20/20 and 30/30 possible value). Existing bundle-size warnings remain.
