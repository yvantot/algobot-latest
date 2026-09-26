# Game versions

The Start Menu reads the version from `package.json`. Version `1.0.0` displays as **Version 1.0**; nonzero patch versions remain visible (for example, `1.0.1`).

For future game releases, update the version with `npm version patch --no-git-tag-version` for fixes, or `npm version minor --no-git-tag-version` for feature releases. This keeps `package.json` and `package-lock.json` synchronized. Commit the version change with the release changes. Restart the development server when checking the release build metadata.

## 1.0

Initial numbered release. Adds the version label to the Start Menu using its existing typography and slate/light-gray styling. The label follows the menu's existing exit fade.

## 1.1

Short opening demo; optional Events and Upgrades lessons in Help reward 50 coins and 25 EXP each once per farm. The Help alert remains until both rewards are collected. Closing a lesson early grants nothing. Required practice ends after the first harvest; loops and conditions follow as missions. Practice workspaces clear between completed lessons after the running program finishes. Blockly labels use plain English, and animated nesting examples accompany requested hints. Did You Know tips are shorter.

Collection still excludes demonstrations and guided practice. Challenges unlock after the shorter tutorial and a valid normal gameplay window. Keep exports from 1.0 and 1.1 identified by build metadata when analyzing learning/collection conditions; the exposure history and first evaluated challenge score rules are unchanged.
