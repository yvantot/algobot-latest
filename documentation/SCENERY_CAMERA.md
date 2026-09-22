# Scenery, camera and introduction effects

Drag the exposed farm canvas with the left or middle mouse button to pan. Scroll
over it to zoom around the pointer. The camera controls include a Center farm
button. HTML panels retain their own input: dragging starts only on the canvas,
requires six pixels of movement, and stops on crossing an HTML panel. Modal and
introduction states disable these controls. Ctrl-wheel remains browser input.
Zoom uses exact 10% steps from 50% to 150%, including the on-screen buttons.
The camera center is constrained to the farm rectangle plus one tile on each
side; current farm dimensions are read for every drag/zoom, including upgrades.

The scenery uses the existing grass and flower atlases. One KAPLAY draw component
keeps a deterministic list of decorations for the visible world rectangle, plus
a small margin. Moving farther does not accumulate scene objects. Farm dimensions
and origin are part of the cache key, so expansions clear decorations from the
new farm footprint. Flowers and grass frames 2, 5 and 6 sway using the game clock;
reduced-motion preferences disable that sway.

API references consulted:
- https://v4000.kaplayjs.com/docs/api/DrawSpriteOpt/
- https://v4000.kaplayjs.com/docs/api/ctx/toWorld/

The introduction preserves and restores the player's camera position and zoom.
Its harvest uses the normal coin/EXP/seed orb renderer, with effects owned by the
private demonstration farm and cleaned up on exit. These are visual examples;
they do not grant inventory or write research telemetry. The separate earnings
popup holds for 3.8 seconds and animates out over 450 ms.

Both milestone and completed-introduction confetti use the same non-interactive
component, removed after 4.2 seconds and disabled for reduced motion. Each fire
alternates smoke variants across emissions. Scripted demo pests spawn on their
intended tile and do not run the wandering movement loop.

Validation: 134 automated tests pass; production build passes with existing
accessibility and bundle-size warnings; all 40 research artifact hashes match.
Browser checks covered canvas dragging, HTML wheel isolation, canvas zoom,
scenery during the introduction, the separate timed earnings popup, and visible
milestone confetti. Automated tests cover demo reward isolation and cleanup,
camera restoration, pest placement, smoke variants and expanded-farm exclusion.
