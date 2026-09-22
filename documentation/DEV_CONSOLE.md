# Dev Console

Press backslash outside an editor/input to open or close the console. Escape
closes it, including from an input. Drag its header to move it; use its lower
right corner to resize. The panel stays within viewport size limits.

The Testing tab groups the controls used for reproducing gameplay bugs:

- Pause and 0.25×, 0.5×, 1×, 2×, 4× simulation speeds; stop all programs.
- End protected practice explicitly before testing hazards. This changes the
  current game, so use a testing session rather than a participant session.
- Fire, rain and pests with validated 100–10,000 difficulty points. Normal event
  eligibility and DDA multipliers still apply; the log reports rejection reasons.
- Clear weather, including clouds/drops/fire, and remove pests (including those
  approaching from outside the farm).
- Replace crops with a ripe dry farm, ripe watered farm, rotten farm, or empty
  farm. Setup stops programs, clears hazards and uses the entity lifecycle APIs.
  Seeds for the selected crop are provisioned for the setup.
- Till/water/mature/rot/destroy/extinguish the chosen tile, then inspect it.
- Add 1–20 bots to the chosen tile to reproduce stack rendering. Spawn animations
  and tile registration finish when simulation resumes if it is paused.
- Download a plain JSON diagnostic snapshot of tiles, scheduler and action log.
  Existing dataset exports remain in DDA. The diagnostic download is not a save
  file and cannot restore a session.

The World, Player, Quests, Bot, Batch, Inspect and DDA tabs remain available.
Inspection and scheduler data refresh twice a second while the console is open;
tile controls are unavailable during the introduction or blocking reward dialog.
Action logging awaits returned promises, reports rejected actions, and blocks
duplicate clicks while pending. Callback-driven bot animations still use the
game's normal timing.

Validation: 139 tests pass, production build passes, and all 40 preserved research
artifact hashes match. Browser checks exercised pause/resume, wet-farm setup,
protected-fire rejection, fire/rain spawn and cleanup, crop rot/removal, bot
stacking, inspection, empty-farm reset, and 100%/110% zoom buttons. Existing build
accessibility and bundle-size warnings remain.
