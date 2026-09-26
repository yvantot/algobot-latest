# Game versions

## 1.3.10 system review fixes

- Movement missions check the requested direction and complete left/right trips within a single run instead of rewarding unrelated moves.
- Student programs no longer expose the obsolete loop/condition telemetry hooks; real interpreter execution supplies those observations.
- Dataset imports reject contradictory study/build/feature provenance in duplicate session exports.
- The local prediction diagnostic reads the model's actual input dimensions and weight manifest. Historical models can be selected explicitly with `--model`.
- The shop reference uses the supported `shop.buy_seed` command.
- Compatible dependency security updates resolve the 11 package alerts reported by npm audit; no forced major upgrade was used.

This is a local candidate until deployed. Keep collection on one approved build; record the version change before switching any study computers. Challenge rubrics, model weights and existing collected files are unchanged.

## 1.3.9 round 2 study conditions

Adviser-approved fixed conditions for the round 2 collection. They apply only when the game is opened with a researcher-assigned code (`?study_participant=CODE`); ordinary play is unchanged.

- Speed is fixed at 100% (pause still works).
- Difficulty is fixed at Normal. The rule policy and provisional LSTM still run and their proposed action is logged (`proposedAction`, `fixedDifficulty`), but it is not applied. Difficulty-scheduled hazard events are off.
- Challenge order is fixed: Your first harvest, then Two careful steps; other challenges unlock after both are opened. The second task needs 20 gameplay intervals recorded after the first challenge ended.
- Exports record `collection.study_protocol` (`fixed-conditions-v1`). Prepared samples carry `collection_protocol`; preparation rejects out-of-order study attempts and training refuses to mix collection protocols.
- The audit and Dev Console Check Collection report the study protocol, assigned-code status and uncommitted build changes.
- The Finish prompt points students to the second task after the first is scored.

Scoring rules, feature schema (`active-14f-v2`) and the installed model are unchanged. Round 2 data is a new cohort and cannot be pooled with the September 26 pilot.

## 1.3.8 collection readiness

Challenges accept normal player speed controls. Twenty observed gameplay intervals within the last fifteen minutes unlock first attempts; short prompts and tab switches no longer erase earlier progress. Segment boundaries exclude pauses, speed changes, demos and challenges from counter differences. Export messages explain the remaining collection wait.

New exports declare `active-14f-v2`: the twelve existing inputs plus speed and observation age. Local training, baseline comparisons, packaging and runtime understand both research schemas. The installed provisional model remains unchanged, preserving its 100%-speed input requirements and rule fallback. Keep the new collection round separate from the older pilot. First evaluated scores, Stop & Edit, first exposure, zero scores and unfinished-attempt rules remain unchanged.

The Start Menu reads the version from `package.json`. Version `1.0.0` displays as **Version 1.0**; nonzero patch versions remain visible (for example, `1.0.1`).

For future game releases, update the version with `npm version patch --no-git-tag-version` for fixes, or `npm version minor --no-git-tag-version` for feature releases. This keeps `package.json` and `package-lock.json` synchronized. Commit the version change with the release changes. Restart the development server when checking the release build metadata.

## 1.0

Initial numbered release. Adds the version label to the Start Menu using its existing typography and slate/light-gray styling. The label follows the menu's existing exit fade.

## 1.1

Short opening demo; optional Events and Upgrades lessons in Help reward 50 coins and 25 EXP each once per farm. The Help alert remains until both rewards are collected. Closing a lesson early grants nothing. Required practice ends after the first harvest; loops and conditions follow as missions. Practice workspaces clear between completed lessons after the running program finishes. Blockly labels use plain English, and animated nesting examples accompany requested hints. Did You Know tips are shorter.

Collection still excludes demonstrations and guided practice. Challenges unlock after the shorter tutorial and a valid normal gameplay window. Keep exports from 1.0 and 1.1 identified by build metadata when analyzing learning/collection conditions; the exposure history and first evaluated challenge score rules are unchanged.

## 1.2

Menu alerts use the original alert sprite at its native proportions. Newly available menus keep an alert until opened. Repeat blocks default to two repetitions. Every mission has a real Blockly hint in Blocks mode and a code hint in Text mode. Every requested hint, including replays, increments the help counter and records its mission, editor and level in telemetry.

Challenges offer Recommended and Freestyle. Recommended preserves the task's restricted commands; Freestyle offers robot and programming blocks while keeping main-farm shop/inventory operations outside the isolated challenge. The duplicate Commands & Rewards section is removed. Previously exposed challenges can reopen as practice without a new gameplay observation window.

Attempt and submission exports include play_mode. Freestyle submissions remain practice-only and are rejected as training targets by the shared collection validator. Opening either mode counts as task exposure. Use Recommended for standardized collection; Freestyle cannot be followed by a new first-exposure target for the same task and participant.

## 1.3

The short introduction includes spoilage. Events contains rain, fire and pests. Switching from the last chapter of Events to the shorter Upgrades lesson no longer attempts to render an undefined chapter. Demo rewards are granted after restoring the main farm and closing the overlay.

Thirteen command and programming missions now launch with Start practice on an isolated farm using the real robot, soil and crop components. Lessons supply the required empty, planted or spoiled tiles and a focused block toolbox. The main farm and its program are preserved. The nine shop/crop missions continue on the main farm. Completed practice can be replayed from Mission Path; rewards and unlocks are granted once.

Need help? shows blocks or code according to the editor and closes when an objective advances. The loop mission explicitly requires a loop. Crop checks teach true/false with is_planted, followed by conditional planting on prepared soil. Main-farm commands cannot accidentally complete isolated missions.

Challenges now expose only the Recommended command set. Existing Freestyle export records remain identifiable and excluded from training. Mission practice is logged as guided_practice, never as normal gameplay input or a scored challenge target. Collect on one fixed version: the learning conditions changed from 1.2.

## 1.3.1

Reverts isolated mission practice at the user's request. Missions again use the main farm, original tutorial spotlight, toolbox restrictions and progression. The prior crop-readiness and conditional-harvest lesson pair is restored with its matching command observers. Removed practice launch/replay controls and the separate mission farm. Scored Challenges remain isolated.

Retained the spoilage scene in the short introduction, Events-to-Upgrades chapter-switch fix, Need help? wording and dismissal on progress, explicit Loop instructions, and Recommended-only Challenges.

## 1.3.2

The short introduction ends with the existing nine-bot cooperative farm scene. Its explanation and Your turn! button become available after five seconds of the scene, while the bots keep working. Collection audits distinguish compatible samples from holdout-plan eligibility, report actual target score/category counts and constant features, and surface incomplete build provenance. September 26 pilot data was prepared without editing the original exports or changing deployed weights.
