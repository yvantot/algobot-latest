# Game versions

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
