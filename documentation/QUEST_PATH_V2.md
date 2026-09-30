# Quest path v2

The curriculum contains 38 required quests, the optional return-value lesson,
and five optional crop quests. Existing quest IDs are preserved. New exports
identify the path as introduction_version = guided-v2.

The order moves from commands and farming through loops, checks, variables,
comparisons, while/for, functions, lists, and hazard patrols. Corn, rice, potato,
sugarcane, and tomato unlock through chapter rewards. Each optional crop goal is
three harvests. Optional rewards do not interrupt the main HUD.

## Completion and practice

The shared code runner records executed syntax and completed command callbacks.
Concept quests require successful runs, the intended syntax around the action,
and the relevant results. Empty loops, uncalled functions, hardcoded counters,
failed actions, and stopped runs cannot substitute for the intended program.
The same observer evaluates Blockly-generated JavaScript and text programs.
The bundled interpreter's minified AST fields are normalized without changing
the interpreter or exposing a student-callable completion hook.

Practice preparation starts Bot 0 at the lesson's first tile, supplies seeds
up to a fixed minimum, and sets up ready, growing, or spoiled crops as needed.
Automatic preparation only touches unoccupied lesson tiles. The **Reset lesson
tiles** control explicitly replaces crops in the named practice area, preserves
the program, and cannot run while a robot is busy. It is available for retries.
Lesson crops absorb water and grow normally; ready crops are protected from
spoilage while students edit. The while lesson starts with a
watered, growing crop. Bug and fire lessons place harmless hazards at both ends
of the farm; leaving the lesson releases its protections and owned hazards.

Lesson protection is released when the active quest changes, including the
completed-but-unclaimed state and switching out of an optional lesson. HUD
removal also releases it after its outro finishes. A following lesson can
establish fresh protection on its own practice tiles. The separate initial
tutorial protection ends when the player presses **Start farming**.

Three deliberate adaptations make the roadmap executable on the existing farm:

- A three-tile row repeats the first two tiles, then handles the last tile
  without moving. Moving right three times would leave a three-column farm.
  The dimension-based lesson uses columns minus one for the same reason.
- Column and row numbers start at zero. The for lesson visits 0 through
  columns minus one. Blockly list positions remain one-based.
- Occupied player crops are preserved until the player chooses Reset lesson
  tiles. Cleanup can prepare a spoiled crop immediately on an empty tile.

The new **Plant crop** value-input block supports variables, parameters, and
list items. The existing **Plant** dropdown remains available.

## Help

Need help advances through four levels: category, exact block, incomplete
program, and full answer with an explanation. The first two levels do not show
the solution. Blockly highlights the category and available matching block;
variable blocks appear after the learner creates a variable. Text hints include
comments and highlight the line to complete.

Before general advice, hints check for disconnected blocks, empty loops, seed
shortages, unprepared or occupied soil, farm edges, and common robot errors.
Idle/error offers retain their existing thresholds. Hints remain unpenalized;
the mission, editor mode, and capped level are recorded in hint telemetry.

## Verification and research

- Run npm test for graph, rewards, setup lifecycle, hint construction, and
  interpreter checks, including every concept answer in both editor modes.
  The lifecycle suite also checks every quest against all six crop types using
  the actual soil and crop components: automatic setup, explicit reset,
  absorption, growth to harvest, removal and replanting, empty-tile drainage,
  sugarcane regrowth, and spoilage protection followed by lesson release.
  Intentionally spoiled cleanup crops remain spoiled. Hazard spawning is
  stubbed in this crop-lifecycle matrix; hazard behavior has separate tests.
- Run npm run build for the production build.
- Open /tests/ui/quests.html under the Vite dev server for real rendering,
  keyboard, hint, setup, and completion checks. This fixture does not start
  participant collection and is not a production entry point.
- Open /tests/ui/protection.html and press **Run protection checks** to verify
  the real HUD reset/completion/switch/unmount flow, practice-hazard cleanup,
  crop spoilage resuming, event spawning after release, and the actual
  **Start farming** control. The fixture pauses simulation except for reset
  movement, then advances crop lifetimes explicitly for deterministic checks.
  All seven integration checks passed on 2026-09-30; see
  [the captured results](protection-checks.png).

Existing training files are not migrated or edited. Deploy this curriculum
between collection rounds. Do not pool guided-v1 and guided-v2 attempts without
accounting for their changed task order, support, and goals. Completion rates,
hint rates, and median times require new participant sessions; implementation
tests do not establish those study outcomes.
