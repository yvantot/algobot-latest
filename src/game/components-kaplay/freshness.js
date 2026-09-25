import { k } from "../../lib/kaplay.js";
import { CropStates, FreshnessStates } from "../global/enum.js";
import { triggerDidYouKnow } from "../../components/global.svelte.js";

// Presentation follows the crop's one spoilage clock, avoiding separate timers
// that can fire after harvesting, removal, or sugarcane regrowth.
export function freshness({ showTips = true } = {}) {
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
      if (this.crop_state !== CropStates.HARVESTABLE) return;
      this.showFreshness(FreshnessStates.FRESH);
    },

    showFreshness(state) {
      if (this.crop_removed || this.is_harvesting) return;
      this.freshness_state = state;
      if (!this.freshness_effects.length) {
        for (const [x, y] of [[-7, -12], [20, -35], [-16, -41]]) {
          this.freshness_effects.push(this.add([k.pos(x, y), k.sprite("icon_sparkle"), k.opacity(1), k.animate(), k.rotate(), k.z(1), k.scale(), k.anchor("bot")]));
        }
      }
      for (const [index, effect] of this.freshness_effects.entries()) {
        effect.unanimateAll();
        effect.animation.seek(0);
        effect.opacity = 1;
        effect.sprite = state === FreshnessStates.DEAD ? `icon_poison${index === 1 ? 2 : 1}` : this.stateToPath(state);
        const pingPong = { duration: 1, direction: "ping-pong", easing: k.easings.easeInOutSine };
        if (state === FreshnessStates.FRESH) {
          effect.animate("angle", [6, -6], pingPong);
          effect.animate("scale", [k.vec2(1), k.vec2(1.2)], pingPong);
          effect.animate("opacity", [0.5, 1], pingPong);
        } else if (state === FreshnessStates.EXPIRING) {
          const angles = [], positions = [];
          for (let i = 0; i < 10; i++) {
            angles.push(k.rand(-10, 10));
            positions.push(k.vec2(k.rand(-15, 15), k.rand(0, -50)));
          }
          effect.animate("angle", angles, pingPong);
          effect.animate("scale", [k.vec2(1), k.vec2(1.3)], pingPong);
          effect.animate("pos", positions, { duration: this.crop_spoilage_time / 2, direction: "ping-pong", easing: k.easings.easeInOutExpo });
        } else {
          const options = { duration: 1, easing: k.easings.easeInOutSine };
          const x = k.rand(-10, 10);
          effect.animate("scale", [k.vec2(0), k.vec2(1.5)], options);
          effect.animate("pos", [k.vec2(x, 0), k.vec2(x + k.rand(-10, 10), k.rand(0, -50))], options);
          effect.animate("opacity", [0, 1, 0], options);
        }
      }
      this.syncFreshnessDepth();
    },

    update() {
      if (this.crop_removed || this.is_harvesting || ![CropStates.HARVESTABLE, CropStates.DEAD].includes(this.crop_state)) {
        if (this.freshness_effects.length) this.clearFreshness();
        return;
      }
      this.syncFreshnessDepth();
      const next = this.crop_state === CropStates.DEAD ? FreshnessStates.DEAD
        : this.spoilage_remaining <= this.crop_spoilage_time / 2 ? FreshnessStates.EXPIRING : FreshnessStates.FRESH;
      if (next === this.freshness_state && this.freshness_effects.length) return;
      if (next === FreshnessStates.EXPIRING && showTips) triggerDidYouKnow("freshness");
      this.showFreshness(next);
    },

    stateToPath(state) {
      return state === FreshnessStates.FRESH ? "icon_sparkle" : state === FreshnessStates.EXPIRING ? "icon_fly" : "icon_poison1";
    },

    destroy() { this.clearFreshness(); },
  };
}
