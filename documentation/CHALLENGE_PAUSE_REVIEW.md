# Challenge pause follow-up

Reviewed all `triggerDidYouKnow` calls and engine-speed assignments. Crop freshness, spoilage, seed drops, sugarcane, corn synergy, pest spawning/damage, soil preparation and out-of-bounds actions respect isolated farm behavior. The robot's soil-check command was the remaining unguarded trigger; it now respects the same boundary.

A central guard also rejects tip requests while `ONBOARDING.isModalOpen` is true, including Challenge Farm. Suppressed requests neither replace a pending tip nor consume a tip's first appearance. Challenge scenes continue to run at normal speed and restore the main farm's previous speed and objects when closed.

Verification:

- 223 automated tests pass. Successful solutions and failing programs cover all ten active challenges with tip calls observed, rather than silently stubbed. Pest ending tests also assert no tips are requested.
- Every registered tip is tested behind the central blocking-scene guard, then shown normally after the scene ends.
- Normal farming still shows freshness, soil-check and corn-synergy tips.
- The browser fixture now explicitly models a post-tutorial player and mounts the actual tip popup. Which crop first completed both rows at 6/6 without pausing.
- Production build and diff checks pass. The existing bundle-size warning remains. No challenge scores, rubrics, model weights or participant data were changed.

This guards and tests the identified hidden-tip pause mechanism. It is not a claim that every possible future challenge bug is excluded.
