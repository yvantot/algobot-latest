# Farm lifecycles and weather

This change separates crop, soil, robot, interpreter, and weather responsibilities. It does not retrain or replace the saved research models or samples.

## Ownership

| Module | Responsibility |
| --- | --- |
| `src/game/components-kaplay/soil.js` | Preparation, water reservoir, wet-soil mask, soil visuals. |
| `src/game/components-kaplay/crop.js` | Growth, health, spoilage, harvest rewards, crop cleanup. |
| `src/game/components-kaplay/freshness.js` | Crop freshness indicator and its cleanup. |
| `src/game/components-kaplay/robot.js` | Farm commands, tile queries, command completion, bot occupancy. |
| `src/game/components-kaplay/grid.js` | Grid coordinates and movement. |
| `src/game/components-kaplay/pest.js` | Pest movement, damage, removal. |
| `src/game/components-kaplay/presentation.js` | Shared display, effects, reward orbs. |
| `src/game/components-kaplay/components.js` | Compatibility exports for existing callers. |
| `src/game/global/command-api.js` | Commands with injected robot, inventory, shop, telemetry and quest dependencies. |
| `src/game/global/interpreter-bindings.js` | JS-Interpreter bindings and conversion only. |
| `src/game/global/interpreter.js` | Default application dependency composition. |
| `src/game/events/simulation.js` | Fire/cloud/drop state and deterministic game-time rules. No rendering or UI dependencies. |
| `src/game/events/renderer.js` | KAPLAY scene objects, animation and pause integration. |
| `src/game/events/motion.js` | Game-time durations and eased cloud/drop interpolation between simulation ticks. |
| `src/game/events/difficulty.js` | Event severity parameters. |
| `src/game/ml/event-scheduler.js` | Eligibility, DDA event selection and cooldown. |

Factories preserve existing imports. Rendering components still use application services for effects and rewards; this is a separation of lifecycle ownership, not a complete replacement of every global store.

## Soil and crop contract

- `soil.water_remaining` is a reservoir from 0 to 1. A full reservoir supplies one growth stage.
- `soil.water()` fills prepared soil; `soil.water({rain:true})` also wets unprepared ground without tilling it. Rain does not prepare ground. Till, plant, then water to supply growth.
- `soil.consumeWater(seconds, stageDuration)` returns the actual growth time supplied and subtracts only that amount of water.
- When no living crop remains, soil resets to its dry state and discards its growth dose. A separate wet-soil visual shrinks away over 0.25 game seconds. Untilled soil returns to INITIAL; prepared soil returns to READY. Removing or replacing a crop during absorption leaves the real soil intact, but a replacement requires fresh watering, even if planted during that visual animation. Soil queries its occupant through an injected callback; crops do not manage soil cleanup.
- Robot stacks restore the original `k.readd()` ordering by tile occupancy, once per stack per frame, and display only the top bot's label. Returning robots render in their new stack position instead of their creation order.
- Freshness restores the original rotating/pulsing sparkles, randomized flying insects, and rising/fading green `icon_poison1`/`icon_poison2` gas for rotten crops. State transitions follow the single crop spoilage clock; destruction and harvest clean up the effects.
- Freshness sparkles and flies use the crop's global draw depth plus one and follow depth changes, keeping them in front of their crop.
- The water mask belongs to soil and masks a decorative wet sprite. The real soil is never reparented into a crop-owned object.
- `crop.cropDestroy(reason)` and raw KAPLAY destruction clean up the crop's timers/indicators and clear only its own tile reference. Late callbacks cannot clear a replacement crop or issue pending rewards.
- `crop.matureNow()` and `crop.markDead()` allow developer controls to change lifecycle state safely. Callers should not assign crop state or manipulate absorption masks directly.
- Fire damage uses `crop.damage(amount, {source:'fire', noTrace:true})`. Crop resistance is applied by the crop. Lethal fire removes the crop entirely without a dead sprite or harvest rewards.

## Fire rules

An initial fire event requires living crops on at least `ceil(actual soil tiles * 2 / 3)` tiles. Off-farm pest placeholders do not count. Initial fires use distinct random planted tiles; spreading does not repeat the planting-density gate.

Fire has three visual stages. It begins spreading to the four orthogonal neighboring crops at its second (medium) stage, after one stage interval. Maximum growth follows after two intervals and starts the short lethal burn phase. Wetness of the destination soil multiplies spread probability by 0.2. A bot can use `bot.is_fire()` and `bot.extinguish()`; `bot.water()` also extinguishes, even if the tile is already wet. Raindrop impact extinguishes before the next simulated fire attack.

Every flame extinguishes as soon as its own crop is killed or removed, even when adjacent crops remain. Damage resolves before spreading, so a lethal tick cannot spread again. Replanting cannot transfer an old flame onto a new crop. A crop that spoils while burning is also removed completely. Fire does not consume soil moisture.

## Rain rules

Each cloud enters horizontally from one side over 5 game seconds, stops above its selected tile, rains for 8–12 seconds according to event points, then leaves over 4 seconds. It fades and scales from 65% to full size during entry, reversing that animation during exit. Cloud travel uses elapsed-time lerp with sine easing to accelerate and decelerate smoothly. Drops appear every 0.8–0.5 seconds according to event points and accelerate downward with quadratic easing over 0.9 seconds. Rendering includes the remainder between fixed simulation ticks, so movement updates every frame. Arrival/departure phases reset their timing; departure starts at the resting position with no teleport. Soil changes on impact, not when the event banner appears.

Targets are distinct and prefer living crops before bare soil. Tiles already assigned an active cloud are excluded. Rain can target empty tiles, but their water drains away quickly; it is not stored for future crops. Plant removal while a cloud is raining does not remove the soil or cloud.

## Tuning and scheduling

These are explicit gameplay tuning values, not learned DQN parameters or evidence of learning improvement.

| Setting | Low severity (100 points) | Maximum severity (10,000 points) |
| --- | --- | --- |
| Requested initial fires / clouds | 1 | 8 (limited to eligible tiles) |
| Fire stage interval / time to largest stage | 8 seconds / 16 seconds | 6 seconds / 12 seconds |
| Juvenile damage interval / adult spread interval | 1.5 seconds / 0.8 seconds | 1 second / 0.5 seconds |
| Small / medium fire damage before crop resistance | 0.15 / 0.3 per tick | 0.25 / 0.5 per tick |
| Time to burn down a crop after maximum fire growth | 2.2 seconds | 1.8 seconds |
| Mature damage interval | 0.25 seconds | 0.2 seconds |
| Rain duration / drop interval | 8 seconds / 0.8 seconds | 12 seconds / 0.5 seconds |
| Spread probability per dry neighbor | 35% | 55% |
| Spread probability per wet neighbor | 7% | 11% |

The scheduler uses `min(10000, 100 + plantedCount * 50 + playerLevel * 100)` points. Scaffolding chooses rain. Challenge/state-optimization chooses randomly among eligible pest and fire events; existing pest eligibility remains more than one third ripe crops. Existing rule bootstrap probability and five-minute event cooldown remain. Failed spawns do not start cooldown or increment scheduled-event telemetry.

Fire growth, damage, damage interval, spread interval/probability, rain duration/intensity, and initial entity count all derive from the supplied event points. Presentation travel times remain readable at every severity. Each spawned event keeps its settings snapshot, including propagated flames; the scheduler and DDA remain responsible for choosing the points. Existing pest tuning is unchanged.

Fire growth and damage use independent clocks. Small/medium flames deal 10%/20% of the points-based juvenile damage setting. At maximum growth, fire snapshots the damage needed to consume its current crop, using the crop-owned resistance calculation, and delivers it over approximately two game seconds. Health drops on short damage ticks; the final tick consumes the remainder. This makes mature burn duration comparable across crop types while juvenile damage still reflects resistance. Extinguishing cancels the remaining burn immediately. The first spread attempt happens at the start of the medium stage, with further attempts throughout medium and maximum growth. Regression tests use every deployed crop's actual health and resistance at 100, 500, 2,000 and 10,000 points: healthy young crops survive to the largest flame and an actual spread attempt, and burn down through damage within one simulation tick of the configured mature duration. Already weakened or naturally expiring crops can still die earlier; fire does not grant immunity or suspend spoilage. Crop health and resistance values are unchanged.

Weather uses the game clock and pauses with game speed zero, onboarding, hidden tabs and return to menu. All weather objects belong to one KAPLAY scene owner; destruction clears simulation state, tile fire references, clouds, drops and smoke.

## Artwork

All seven supplied weather PNGs are now included in `public/sprites` and selected automatically by the artwork resolver. Simple inline SVGs remain as fallbacks only when a required sprite is missing. The resolver checks `public/sprites`, `public/assets`, `assets`, and `src/assets` in that order; restart Vite/rebuild after adding or replacing files.

Required names: `icon_cloud.png`, `icon_raindrop.png`, `icon_fire_0.png`, `icon_fire_1.png`, `icon_fire_2.png`, `icon_smoke_0.png`, `icon_smoke_1.png`. `public/sprites` is the preferred location. The supplied files have transparent backgrounds and retain their aspect ratios at the configured cloud, drop, fire-stage, and smoke sizes.

## Verification

The rendering restoration was compared against the pre-refactor implementation in Git. Browser checks confirmed stacks with only the top bot's label, foreground sparkles and flies, and green gas on rotten crops, with no runtime errors. Added regressions cover a 12-bot stack with departure, return and removal, animation transitions and cleanup, and spreading at the medium fire stage.

Verified on 2026-09-14: all 116 JavaScript tests pass, the production build passes, and all 40 preserved research artifacts match their baseline. Browser checks confirmed foreground freshness effects, dry soil after crop death, rain landing on empty tiles, cloud departure with reduced opacity/size, and mature fire spreading while its original crop is still present. The subsequent mature-damage adjustment was verified with real crop integration tests covering substantial health loss, the 1.8–2.2 second deadline, spreading before death, and extinguishing during that interval. No browser error logs were reported during the preceding visual checks. Existing accessibility and bundle-size build warnings remain.

Run `npm test`, `npm run build`, and `npm run verify:artifacts`. Focused regression suites cover empty-soil draining, replacement crops, watering during drain, freshness depth, lifecycle cancellation, robot/interpreter completion, fire eligibility/spread/extinguishing, points-based weather settings, rain impact/priority, cloud fade/scale continuity, event cleanup, and scheduler selection/cooldown.

The September 14 water-policy revision supersedes earlier tests of persistent empty-soil water. Saved research models and samples are preserved; these gameplay checks do not establish learning improvement.

For a manual check, open the game developer tools with `\`. Use Batch to till, plant and water, then destroy crops during absorption: water should shrink away quickly, leaving dry soil. Replant and confirm growth waits for fresh watering. Instant Grow All should show sparkles in front, followed by flies as freshness declines. In World, select fire/rain severity; fire needs at least two thirds planted. Confirm three flame stages with time to spread before damage kills healthy crops, smoke and flame removal after death, sideways clouds fading/scaling in and out, falling drops, bot extinguishing, and pause/resume. These developer actions are for local testing and should not be included as participant evaluation sessions.
