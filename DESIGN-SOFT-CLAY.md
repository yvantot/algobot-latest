# Soft Clay: reusable interface design direction

## Identity and scope

A calm, tactile interface that feels formed from one continuous clay surface. Controls rise gently from the surface; inputs and selected controls settle into it. Rounded typography and precise interaction make the interface approachable without making it childish.

Derived from the supplied Soft Machine reference. This guide generalizes its material, color, typography and behavior. It does not prescribe a synthesizer layout, instrument controls, audio features or fictional hardware branding. It is independent of Algobot's existing design direction.

**Design read:** reusable application interfaces for people completing focused tasks, expressed through soft clay surfaces and clear physical states.

**Dials: ENERGY 2 / RHYTHM 2 / MOTION 2.** The material supplies character, layout follows the task, and short transitions explain changes. No theatrical page choreography.

## Visual signature

- A continuous cool-gray base, with light consistently coming from the upper left.
- Paired light and dark shadows that describe shallow relief.
- A single warm coral accent marking the primary action or current selection.
- Dark slate type with rounded forms and comfortable reading sizes.
- Clear raised, resting and pressed states that make interaction visible.

Depth is a functional vocabulary. Raised surfaces invite action, inset surfaces receive input or show selection, and flat surfaces carry content. A page of equally raised cards loses this distinction.

## Color tokens

| Token | Value | Role |
| --- | --- | --- |
| `--clay` | `#e4e8ee` | Page and principal surface |
| `--clay-light` | `#ffffff` | Upper-left reflected light |
| `--clay-shadow` | `#b8bec7` | Lower-right soft shadow |
| `--ink` | `#303945` | Headings, body text, essential icons |
| `--ink-muted` | `#596372` | Supporting text and labels |
| `--edge` | `#718093` | Boundaries where identification needs more than shadow |
| `--coral` | `#ff6b5a` | Small active indicators and selected accents |
| `--coral-ink` | `#a73529` | Accent-colored text, focus ring, filled primary action |

Coral attracts attention through contrast with the neutral material. It is not a default fill for every icon, link, divider and heading. Use the deeper coral variant for readable text or a solid primary button with white text.

Calculated flat-color contrast against clay: ink 9.50:1, muted ink 4.95:1, coral ink 5.36:1, and edge 3.28:1. Bright coral is only 2.28:1 against clay, so it cannot be the sole cue for a control, chart distinction or state. Pair it with readable text, a contrasting outline or a shape change. Ink on bright coral is only 4.18:1; avoid that combination for small button labels.

These ratios describe the listed solid colors, not a blanket accessibility certification. Gradients, opacity, disabled states and rendered surfaces need their own checks.

## Material and depth

| Surface | Treatment | Purpose |
| --- | --- | --- |
| Page | Flat clay | Quiet continuous ground |
| Main working area | One shallow raised shell, when useful | Groups the current task |
| Action control | Small paired outer shadow | Indicates something pressable |
| Pressed control | Paired inset shadow | Confirms physical activation |
| Selected option | Inset state plus explicit selection cue | Makes persistent state distinct from hover |
| Input | Shallow inset well plus clear edge | Identifies an editable region |
| Content list or article | Flat, with spacing or restrained rules | Keeps reading separate from interaction |
| Dialog | Stronger outer elevation and neutral backdrop | Establishes a temporary foreground task |

Suggested starting tokens:

```css
:root {
  --clay: #e4e8ee;
  --ink: #303945;
  --ink-muted: #596372;
  --edge: #718093;
  --coral: #ff6b5a;
  --coral-ink: #a73529;
  --relief-control: 3px 3px 7px #b8bec7, -3px -3px 7px #ffffff;
  --relief-shell: 8px 8px 20px #b8bec7, -8px -8px 20px #ffffff;
  --relief-inset: inset 2px 2px 5px #b8bec7, inset -2px -2px 5px #ffffff;
  --radius-control: 10px;
  --radius-group: 18px;
  --radius-shell: 28px;
}
```

These are starting values, not reasons to elevate every container. Use one shell rather than several nested raised panels. Keep shadow offsets small enough that neighboring controls remain visually separate. Shadows supplement labels and boundaries; they never replace them.

Do not import hardware decoration into unrelated products. Screws, speaker grilles, LEDs, knobs and dark display windows belong only where they communicate actual function. The reusable motif is shallow relief, not a simulated instrument.

## Typography

Use `"SF Pro Rounded", "Nunito", "Varela Round", "Segoe UI", system-ui, sans-serif`. This stack uses installed fonts; it does not require a web-font download. A deliberately bundled rounded font is optional when the product needs a consistent face across devices.

| Role | Starting size | Weight and spacing |
| --- | --- | --- |
| Page title | 28–40px, responsive | 650–700, compact line height |
| Section heading | 20–24px | 600–700 |
| Body and form controls | 16px | 400–500, body line height 1.5–1.65 |
| Supporting labels | 14px | 500–600 |
| Short technical annotation | 12–13px | Optional, never essential instructions |

Use sentence case for reading and actions. Restrained small caps can identify short control groups, with modest tracking. Do not turn paragraphs into engraved uppercase labels. Reserve monospace for code, identifiers or values that benefit from aligned digits.

Avoid text shadows on body copy. The shape of the surface should provide the material effect while the text remains sharp.

## Layout and spacing

Start with the user's main task and give it the strongest position and scale. Put related controls next to the content they change. Place secondary actions nearby without giving them equal visual weight.

Use a spacing scale of 4, 8, 12, 16, 24, 32 and 48px. Tight spacing joins a label to its control; larger gaps separate tasks. Typical shell padding is 24–32px on wide screens and 16–20px on small screens. Long-form reading areas should stay around 60–70 characters wide.

The style supports lists, forms, editors, dashboards and content pages. Choose their structure from actual content. Do not automatically add a sidebar, stat cards, a bento grid, a three-column feature section or an instrument-shaped frame.

At narrow widths, stack related groups in reading order, wrap action rows, and keep important controls near their results. Preserve 44px touch targets. Do not shrink an entire desktop interface with a transform. Long labels, validation messages and translated text must reflow without clipping. Dense tables may use a clearly bounded horizontal scroller; the whole page should not scroll sideways.

## Components and states

**Buttons:** shallow relief for ordinary actions; one deeper-coral filled action when stronger emphasis is needed. Use labels that name the outcome, such as Save changes or Add item. Hover slightly strengthens definition. Press moves the face by about 1px and changes its relief. Focus has a visible ring independent of shadow.

**Inputs:** persistent labels above inset wells. Keep entered text dark and provide an edge that remains visible without the shadow. Help and errors sit close to the relevant field. Placeholder text never substitutes for a label.

**Tabs and segmented controls:** one shared shallow tray with the selected option visibly seated. Pair selection with readable weight, a marker or a contrasting boundary. Selection persists after pointer exit and is represented semantically.

**Sliders and adjustable controls:** an inset track and raised handle suit the material. Show the value and units. Provide keyboard input and a direct value-entry alternative where precision matters. Rotary knobs are optional only for tasks where rotation is meaningful.

**Lists and tables:** flat rows with clear headings and restrained separators. Selection and hover are distinct. Do not wrap each row in a raised card.

**Dialogs:** a clay foreground surface with a visible close action. Opening and closing have matching short transitions. Keep focus inside while open and restore it to the trigger afterward. Escape closes dismissible dialogs.

**Feedback:** confirm the action near its result. Small success messages can leave after a readable interval; errors and decisions requiring action remain available. Use plain text and a relevant icon where useful. Coral does not automatically mean error: destructive actions need explicit wording, not just a color change.

Every component needs its applicable default, hover, pressed, focused, selected, disabled, loading, empty and error states. Disabled styling must remain understandable. Empty states explain what belongs there and how to add it; loading states name the work; errors explain the next action.

## Motion

Motion reinforces contact, selection and spatial continuity.

| Interaction | Starting duration | Behavior |
| --- | --- | --- |
| Press | 80–120ms | Small downward movement, immediate feedback |
| Hover or selection | 120–180ms | Definition or state change |
| Tooltip | 120–180ms | Gentle opacity change, at most 4px movement |
| Panel or dialog entrance | 180–240ms | Opacity plus small displacement |
| Panel or dialog exit | 140–180ms | Reverse the spatial direction clearly |

Use `cubic-bezier(0.2, 0.8, 0.2, 1)` for settling transitions. Avoid bounce on text, repeated idle pulses and animated entrances for every content row. Update dragged values immediately. Retain outgoing layout until an exit finishes so content does not jump to another position.

Prefer transform and opacity for motion. Keep expensive shadow changes limited to small controls or crossfade shadow layers. Under reduced motion, remove displacement and overshoot, preserve instant state changes, and retain readable feedback. Continuous animation is appropriate only for real changing information and should pause when hidden.

## Accessibility and resilience

- All controls are reachable and usable with a keyboard, with logical focus order.
- A suggested focus treatment is a 2px coral-ink outline with a 3px offset against clay. Verify it against the actual neighboring surfaces.
- Text remains readable at browser zoom and enlarged text settings.
- Shadows and color are never the only means of identifying inputs or selected states.
- Forced-colors mode retains explicit outlines, native control meaning and visible selection.
- Hover information is also available on focus or through a persistent label.
- Use appropriate native buttons, inputs and selection semantics before introducing custom widgets.

The light material is the baseline identity. A dark theme requires a separately tuned material, lighting and contrast system, not an inverted screenshot. Only offer a theme toggle when both themes are implemented and tested.

## Content and imagery

Use short, concrete language and action-specific labels. Avoid invented metrics, fictional testimonials presented as real, empty promotional sections and decorative badges. The product name can be plain text; this guide does not authorize a new logo or other brand assets.

Use relevant product imagery when the task needs it. Do not add stock illustrations, film grain, background grids, glow or ornamental hardware just to fill space. The material and interaction already provide visual character.

## Delivery review

For each implementation, check that the main task is obvious, flat and raised surfaces have different roles, coral identifies a meaningful moment, and every visible control works. Verify narrow and wide layouts, long content, keyboard operation, zoom, reduced motion, and all shipped themes. Check contrast on rendered states, not just token pairs.

Record what was actually tested. This document defines direction and suggested tokens; it is not a built interface and does not claim browser or interaction testing.

**Anti Slop review:** palette and rounded typography follow the supplied reference; shallow relief explains control states; spacing groups related actions; modest motion explains changes. No instrument layout, fabricated content, generated assets or app changes are included. The guide preserves the reference's tactile identity while giving each visual technique a stated role.

## Algobot application constraints

Use Quicksand for menu UI, as requested by the user. Retain monospace for code. Apply the skin without changing layout, sizes, in/out animation timing, resizing, dragging, or features. Existing game art stays in place.
