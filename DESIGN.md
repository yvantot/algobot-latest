# Algobot Documentation menu design

Status: design specification for the upcoming Documentation menu work. This file
does not describe features as already implemented. Scope is the Documentation
menu and its editor/preview interactions, not a redesign of the whole game.

## Direction and references

Audience: first-year Computer Science students looking up a command while farming
and writing a program. The menu should answer what a command does and how to use
it without requiring a long reading session.

Visual direction comes from the user's chosen references:

- [Quest menu](src/components/Quest.svelte): strong panel outline, compact rows,
  green emphasis for the current mission, and explicit locked requirements.
- [Help & Game Guide](src/components/HelpModal.svelte): Bot Teacher header, light
  surfaces, familiar tabs and framed examples using existing game artwork.
- [Shared panel motion](src/components/interface.svelte.js): visible entrance
  and exit instead of abrupt appearance and disappearance.

Design read: an in-game programming reference for beginner students, using
Algobot's light gray, slate-framed game menus. ENERGY 2 / RHYTHM 2 / MOTION 2.
The selected command and its example are the main focus; scenery and the editor
remain visible where space allows.

## Confirmed product choices

| Area | User-selected direction |
| --- | --- |
| Opening view | Search, categories, current-quest commands, common commands and recently viewed commands |
| Entry content | Command name, one-sentence explanation and short example; expand for details |
| Visual explanation | Optional real-time demonstration where seeing the action helps |
| Search | Simple command-name search with filters |
| Examples | Text and Blockly views; copy and optional insertion into either editor |
| Locked commands | Visible, with their unlock requirements |
| Placement | Compact, resizable reference panel beside the editor |

The layout, sizes and timings below are implementation defaults derived from
these choices and the reference menus. They can be tuned during visual testing.

## Visual vocabulary

| Element | Treatment | Purpose |
| --- | --- | --- |
| Outer panel | `#f3f4f6`, 4px `#64748b` border, 12px radius, one modest shadow | Matches both reference menus and separates the panel from the farm |
| Main text | `#334155`; secondary text `#475569` | Readable instructions on light surfaces |
| Header divider | 2px `#94a3b8` | Separates the stable controls from content |
| Command entries | White, 2px `#cbd5e1` border, 8px radius | Keeps commands individually scannable |
| Selected entry | `#f0fdf4` surface, green outline, `#166534` label | Carries the current-mission emphasis into reference selection |
| Main action | `#bbf7d0` fill, dark slate text, 2px slate border, 6px radius | Matches Quest's action buttons |
| Secondary action | Gray fill and slate text | Keeps Copy, Details and filters quieter than insertion |
| Locked state | `#e5e7eb` surface, readable slate text, lock label | Explains availability without making content unreadable |
| Keyboard focus | 3px green outline with 3px offset | Makes focus visible independently of selection |

Typography uses the game's existing Quicksand UI font. Panel title: 16px bold; command
title: 14–15px bold; body/example: 13–14px; supporting labels: at least 12px.
Code uses the existing code font, including Courier Prime where available.
Monospace is reserved for command names, signatures and code.

Spacing follows the references: 12px panel padding, 8–12px within entries,
16px between sections. Existing Bot Teacher and command/crop/event sprites carry
the game's identity. Pixel artwork remains crisp and keeps its aspect ratio.
No new asset set or font is needed.

## Panel and opening view

Desktop starting width is approximately 400px, adjustable down to 320px when
space permits. Height fits within the viewport with a small outer margin.
Documentation and the active editor can remain open together. Positioning must
preserve the inventory, coins, current mission and useful farm space rather than
covering them with another fixed panel.

The header, search and filter controls stay visible. The results area has one
main vertical scroll region. Categories wrap or collapse into a selector at
narrow widths. Code may scroll horizontally inside its own example area;
ordinary text wraps.

Opening-view order:

1. Bot Teacher portrait, **Documentation** title and accessible close button.
2. Search field, with a clear-query control.
3. Category and availability filters.
4. **For your current mission**, limited to a few directly relevant commands.
5. **Common commands**, a short authored selection rather than usage statistics.
6. **Recently viewed**, a compact list shown only after a command is opened.

The category control also provides access to the full reference. Categories
organize existing material such as movement, farming, checks, programming syntax,
crops and events. Final labels should reflect the actual command catalog.
Current-quest recommendations follow the active quest and prerequisites, not a
new AI recommendation system. Hide an empty recommendation section.

An active search or filter replaces the opening sections with one result list.
Do not repeat the same command across multiple search-result sections.

## Search and filters

- Search command names only, case-insensitively, with surrounding whitespace
  ignored. Partial names work: `water` can find `bot.water`.
- No semantic search, chat box or natural-language interpretation.
- Filters: category and availability (**All**, **Unlocked**, **Locked**).
- **All** availability is the default so locked commands remain discoverable.
- Query and filters combine. Show a small result count and a clear-filters action.
- No results: show the entered query, explain that nothing matches, and offer
  **Clear filters**. Keep the search field available for editing.

## Command entries and details

The compact entry contains its exact command name, one sentence describing the
action, a short text example, and its availability. Clicking **Details** expands
the selected entry. Other long entries stay collapsed to limit reading load.

Expanded content is ordered by what the student needs to act:

1. Text/Blockly example switch.
2. Copy and explicit insertion actions.
3. Arguments, prerequisites and returned value, where applicable.
4. One concise common mistake or gameplay note, where useful.
5. Optional **Watch example** action for supported commands.

Crop and event entries use their existing sprites and a brief summary. Detailed
stats, strengths and weaknesses belong in the expanded area. Numeric values
come from current gameplay definitions, not duplicated prose constants.

Locked entries show the actual quest/research requirement by name. Students can
read examples, but insertion is disabled until the required commands are unlocked.
Do not invent unlock requirements when the data does not define one.

## Copy and insertion

**Copy code** copies the displayed text example and briefly confirms **Copied**.
Clipboard failure leaves selectable code visible with a short explanation.
The Blockly view depicts the actual blocks for the same example, rather than
an image with different behavior.

Insertion uses explicit actions: **Insert into Blockly** and **Insert into text**.
The target bot/editor is visible before insertion. Existing work is preserved:
text goes at the insertion position, and Blockly examples are added as a separate
block group without replacing or silently reconnecting the student's program.
Each insertion is one undoable operation and never automatically runs code.

Unavailable editor modes or unsupported block examples have a visible reason.
Avoid enabled buttons that cannot perform their stated action. Multi-command
examples must respect all of their unlock requirements.

## Optional real-time examples

Use live gameplay demonstrations for spatial or visible actions such as moving,
watering, harvesting and extinguishing, when the command supports a useful small
example. Pure syntax explanations can remain text/Blockly examples.

The preview is started deliberately. It contains the relevant code or blocks,
one concise Bot Teacher explanation, and the visible result on a small example
farm. Provide Replay and Close. Use the existing sprites, animation behavior and
timing language of the farm introduction; avoid autoplaying every result row.

The example farm is isolated from the player's crops, inventory, quest progress
and research telemetry. Closing it restores the previous reference context and
leaves the player's program intact. Loading/error states retain a usable static
example if a preview cannot start.

## Motion, focus and responsive behavior

Panel entrance follows the existing approximately 320ms game-panel motion;
exit follows its approximately 200ms counterpart. Detail expansion uses a short
180–240ms transition. Motion explains opening, selection and feedback, without
making users wait for search results or playing celebrations for routine actions.

Reduced-motion preferences remove travel/scale effects and keep immediate state
changes or brief fades. No uncontrolled repeated preview or decoration animation.

Keyboard access covers search, filters, entry expansion, example mode, insertion,
close and resizing. Focus remains predictable during result updates and returns
to the opener when the panel closes. Escape closes a preview before closing the
reference panel. Status feedback is announced without moving focus. Locked
states use text, not color alone; contrast is checked in implementation.

At widths that cannot hold the editor and reference side by side, switch between
them in the same bounded area while preserving both states. A selected insertion
target remains explicit. Do not squeeze both into unreadable columns or introduce
page-wide horizontal scrolling. Essential actions should offer comfortable touch
targets, approximately 40–44px where practical.

## Implementation acceptance checklist

- The opening view is useful without expanding a long text section.
- Name search and combined filters produce correct, deduplicated results.
- Recommendations follow the current quest; recently viewed commands are real.
- Locked entries show accurate requirements and cannot bypass progression.
- Text and Blockly examples agree with the interpreter's actual command behavior.
- Insertion preserves work, selects the intended bot/editor, supports undo and
  never starts execution automatically.
- A preview cannot modify the player's farm, rewards or research records.
- Panel, detail and preview entrance/exit are visible and honor reduced motion.
- Inventory, editor and farm remain usable at the tested desktop sizes; narrow
  layouts remain readable with keyboard and touch input.
- Empty results, clipboard errors, unavailable examples and preview failures
  have usable states.

## Design document review

- Direction PASS: visual choices are traced to the two requested menu references.
- Scope PASS: the user's six selected feature choices are recorded above.
- Purpose PASS: color, typography, spacing, imagery and motion each serve the
  game reference workflow; no new visual assets are proposed.
- Handoff PASS: interaction states and acceptance checks are specified.

This is a document review only. Runtime behavior, contrast, responsive layout and
accessibility validation remain implementation checks, not completed claims.
