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
- `soil.water()` fills prepared soil; `soil.water({rain:true})` also wets unprepared ground without tilling it. `soil.till()` preserves that moisture.
- `soil.consumeWater(seconds, stageDuration)` returns the actual growth time supplied and subtracts only that amount of water.
- Empty soil does not evaporate. Removing a crop during absorption preserves both the real soil object and its remaining water. A newly planted crop consumes the remainder.
- The water mask belongs to soil and masks a decorative wet sprite. The real soil is never reparented into a crop-owned object.
- `crop.cropDestroy(reason)` and raw KAPLAY destruction clean up the crop's timers/indicators and clear only its own tile reference. Late callbacks cannot clear a replacement crop or issue pending rewards.
- `crop.matureNow()` and `crop.markDead()` allow developer controls to change lifecycle state safely. Callers should not assign crop state or manipulate absorption masks directly.
- Fire damage uses `crop.damage(amount, {source:'fire', noTrace:true})`. Crop resistance is applied by the crop. Lethal fire removes the crop entirely without a dead sprite or harvest rewards.

## Fire rules

An initial fire event requires living crops on at least `ceil(actual soil tiles * 2 / 3)` tiles. Off-farm pest placeholders do not count. Initial fires use distinct random planted tiles; spreading does not repeat the planting-density gate.

Fire has three visual stages. It becomes fully grown after two stage intervals and only then attempts to spread to the four orthogonal neighboring crops. Wetness of the destination soil multiplies spread probability by 0.2. A bot can use `bot.is_fire()` and `bot.extinguish()`; `bot.water()` also extinguishes, even if the tile is already wet. Raindrop impact extinguishes before the next simulated fire attack.

Every flame extinguishes as soon as its own crop is killed or removed, even when adjacent crops remain. Damage resolves before spreading, so a lethal tick cannot spread again. Replanting cannot transfer an old flame onto a new crop. A crop that spoils while burning is also removed completely. Fire does not consume soil moisture.

## Rain rules

Each cloud enters horizontally from one side over 5 game seconds, stops above its selected tile, rains for 8 seconds, then leaves over 4 seconds. Cloud travel uses elapsed-time lerp with sine easing to accelerate and decelerate smoothly. Drops appear every 0.8 seconds and accelerate downward with quadratic easing over 0.9 seconds. Rendering includes the remainder between fixed simulation ticks, so movement updates every frame. Arrival/departure phases reset their timing; departure starts at the resting position with no teleport. Soil changes on impact, not when the event banner appears.

Targets are distinct and prefer living crops before bare soil. Tiles already assigned an active cloud are excluded. Rain remains useful on an empty farm: moisture stays until crops are planted. Plant removal while a cloud is raining does not remove the soil or cloud.

## Tuning and scheduling

These are explicit gameplay tuning values, not learned DQN parameters or evidence of learning improvement.

| Setting | Low severity (100 points) | Maximum severity (10,000 points) |
| --- | --- | --- |
| Requested initial fires / clouds | 1 | 8 (limited to eligible tiles) |
| Fire stage interval (largest stage at 12 seconds) | 6 seconds | 6 seconds |
| Fire damage interval / adult spread interval | 1 second / 3 seconds | 1 second / 3 seconds |
| Fire damage before crop resistance, by stage | 1 / 2 / 5 per damage tick | 1 / 2 / 5 per damage tick |
| Spread probability per dry neighbor | 35% | 55% |
| Spread probability per wet neighbor | 7% | 11% |

The scheduler uses `min(10000, 100 + plantedCount * 50 + playerLevel * 100)` points. Scaffolding chooses rain. Challenge/state-optimization chooses randomly among eligible pest and fire events; existing pest eligibility remains more than one third ripe crops. Existing rule bootstrap probability and five-minute event cooldown remain. Failed spawns do not start cooldown or increment scheduled-event telemetry.

Fire growth and damage now use independent clocks. The earlier easy setting delivered only 0.5 effective damage every 3 seconds to wheat, taking roughly two minutes to burn it down. The corrected settings kill all current crop types through their real resistance-aware damage method within 25 game seconds, without relying on spoilage. Crop health and resistance values are unchanged.

Weather uses the game clock and pauses with game speed zero, onboarding, hidden tabs and return to menu. All weather objects belong to one KAPLAY scene owner; destruction clears simulation state, tile fire references, clouds, drops and smoke.

## Artwork

All seven supplied weather PNGs are now included in `public/sprites` and selected automatically by the artwork resolver. Simple inline SVGs remain as fallbacks only when a required sprite is missing. The resolver checks `public/sprites`, `public/assets`, `assets`, and `src/assets` in that order; restart Vite/rebuild after adding or replacing files.

Required names: `icon_cloud.png`, `icon_raindrop.png`, `icon_fire_0.png`, `icon_fire_1.png`, `icon_fire_2.png`, `icon_smoke_0.png`, `icon_smoke_1.png`. `public/sprites` is the preferred location. The supplied files have transparent backgrounds and retain their aspect ratios at the configured cloud, drop, fire-stage, and smoke sizes.

## Verification

The weather timing correction passes 108 automated tests, including integration of real crop health/resistance with fire damage and actual renderer checks across rain phase transitions. The production build passes. Browser testing confirmed falling crop health, crop and flame removal on burned tiles, and the revised cloud/rain cycle. Existing accessibility and bundle-size build warnings remain.

Run `npm test`, `npm run build`, and `npm run verify:artifacts`. Focused regression suites cover soil persistence and replacement, lifecycle cancellation, robot/interpreter completion, fire eligibility/spread/extinguishing, rain impact and priority, event cleanup, and scheduler selection/cooldown.

Verification on 2026-09-14: 100 automated JavaScript tests passed, the production build passed, and all 40 preserved research artifacts matched their baseline. The build still reports existing accessibility warnings and a large JavaScript bundle warning. Browser checks observed absorbing-crop destruction retaining 72% soil water on empty tiles, three-stage fire with smoke and spread, sideways cloud arrival, falling drops extinguishing fire and leaving wet soil, complete removal of a burned crop, and sequential interpreter movement to the expected tile. No browser error logs were reported during those checks. A subsequent production build with all seven supplied PNGs also passed; the artwork resolver tests passed, and browser checks confirmed the supplied fire, smoke, cloud, and raindrop graphics with no browser errors.

For a manual check, open the game developer tools with `\`. Use Batch to till, plant and water, then destroy crops during absorption and inspect remaining soil water. Replant and observe consumption continuing. In World, select fire/rain severity; fire needs at least two thirds planted. Confirm three flame stages, smoke, sideways cloud motion, falling drops, bot extinguishing, and pause/resume behavior. These developer actions are for local testing and should not be included as participant evaluation sessions.
