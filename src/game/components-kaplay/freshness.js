import { k } from "../../lib/kaplay.js";
import { CropStates, FreshnessStates } from "../global/enum.js";
import { triggerDidYouKnow } from "../../components/global.svelte.js";

// Presentation follows the crop's one spoilage clock, avoiding separate timers
// that can fire after harvesting, removal, or sugarcane regrowth.
export function freshness() {
  return {
    id: "freshness",
    require: ["crop"],
    freshness_state: FreshnessStates.FRESH,
    freshness_effects: [],
    freshness_timer: null,

    syncFreshnessDepth() {
      // KAPLAY sorts descendants by absolute z, not relative to their parent.
      const cropDepth = this.ysort_enabled ? this.pos.y + (this.ysort_add ?? 0) : (this.z ?? 0);
      for (const effect of this.freshness_effects) effect.z = cropDepth + 1;
    },

    clearFreshness() {
      this.freshness_timer?.cancel();
      this.freshness_timer = null;
      for (const effect of this.freshness_effects) effect.destroy();
      this.freshness_effects = [];
    },

    initFreshness() {
      this.clearFreshness();
      this.freshness_state = FreshnessStates.FRESH;
      if (this.crop_state !== CropStates.HARVESTABLE) return;
      for (const [x, y] of [[-7, -12], [20, -35], [-16, -41]]) {
        const effect = this.add([k.pos(x, y), k.sprite("icon_sparkle"), k.opacity(1), k.animate(), k.rotate(), k.z(1), k.scale(), k.anchor("bot")]);
        effect.animate("scale", [k.vec2(0.8), k.vec2(1.1)], { duration: 1, direction: "ping-pong", easing: k.easings.easeInOutSine });
        effect.animate("opacity", [0.5, 1], { duration: 1, direction: "ping-pong", easing: k.easings.easeInOutSine });
        this.freshness_effects.push(effect);
      }
      this.syncFreshnessDepth();
    },

    update() {
      if (this.crop_removed || this.is_harvesting || this.crop_state !== CropStates.HARVESTABLE) {
        if (this.freshness_effects.length) this.clearFreshness();
        if (this.crop_state === CropStates.DEAD) this.freshness_state = FreshnessStates.DEAD;
        return;
      }
      this.syncFreshnessDepth();
      const next = this.spoilage_remaining <= this.crop_spoilage_time / 2 ? FreshnessStates.EXPIRING : FreshnessStates.FRESH;
      if (next === this.freshness_state) return;
      this.freshness_state = next;
      triggerDidYouKnow("freshness");
      for (const effect of this.freshness_effects) effect.sprite = this.stateToPath(next);
    },

    stateToPath(state) {
      return state === FreshnessStates.FRESH ? "icon_sparkle" : state === FreshnessStates.EXPIRING ? "icon_fly" : "icon_poison1";
    },

    destroy() { this.clearFreshness(); },
  };
}
