# Game versions

The Start Menu reads the version from `package.json`. Version `1.0.0` displays as **Version 1.0**; nonzero patch versions remain visible (for example, `1.0.1`).

For future game releases, update the version with `npm version patch --no-git-tag-version` for fixes, or `npm version minor --no-git-tag-version` for feature releases. This keeps `package.json` and `package-lock.json` synchronized. Commit the version change with the release changes. Restart the development server when checking the release build metadata.

## 1.0

Initial numbered release. Adds the version label to the Start Menu using its existing typography and slate/light-gray styling. The label follows the menu's existing exit fade.
