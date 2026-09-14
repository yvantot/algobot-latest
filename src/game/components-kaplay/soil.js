import { k } from "../../lib/kaplay.js";
import { SoilStates } from "../global/enum.js";
import { CONFIG } from "../global/global.js";
import { gridpos } from "./grid.js";

// A full reservoir supplies one growth stage. Only consumeWater removes water;
// an empty tile does not evaporate, and replacing a crop preserves the remainder.
export function soil(state = SoilStates.INITIAL) {
  return {
    id: "soil",
    require: ["gridpos", "sprite", "animate"],
    soil_state: state,
    water_remaining: state === SoilStates.WATERED ? 1 : 0,
    soil_water_mask: null,
    soil_removed: false,

    add() {
      this.refreshSoilVisual();
      this.animate("opacity", [0, 1], { duration: 0.5, loops: 1, easing: k.easings.easeInOutSine });
    },

    isWatered() {
      return !this.soil_removed && this.water_remaining > 0;
    },

    water({ prepare = false, rain = false } = {}) {
      if (this.soil_removed || (this.soil_state === SoilStates.INITIAL && !prepare && !rain)) return false;
      const changed = this.water_remaining < 1;
      this.water_remaining = 1;
      if (prepare || this.soil_state !== SoilStates.INITIAL) this.soil_state = SoilStates.WATERED;
      this.refreshSoilVisual();
      return changed;
    },

    till() {
      if (this.soil_removed || this.soil_state !== SoilStates.INITIAL) return false;
      this.soil_state = this.isWatered() ? SoilStates.WATERED : SoilStates.READY;
      this.refreshSoilVisual();
      return true;
    },

    setSoilState(next) {
      if (this.soil_removed) return;
      if (next === SoilStates.WATERED) {
        this.water({ prepare: true });
        return;
      }
      if (next === SoilStates.READY && this.soil_state === SoilStates.INITIAL) {
        this.till();
        return;
      }
      this.soil_state = next;
      this.water_remaining = 0;
      this.refreshSoilVisual();
    },

    consumeWater(seconds, stageDuration) {
      if (!this.isWatered() || !Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(stageDuration) || stageDuration <= 0) return 0;
      const consumed = Math.min(seconds, this.water_remaining * stageDuration);
      this.water_remaining = Math.max(0, this.water_remaining - consumed / stageDuration);
      if (this.water_remaining < 1e-9) this.water_remaining = 0;
      this.soil_state = this.water_remaining > 0 ? SoilStates.WATERED : SoilStates.READY;
      this.refreshSoilVisual();
      return consumed;
    },

    refreshSoilVisual() {
      if (this.soil_removed) return;
      // The actual soil stays in place. Its child masks only a decorative wet
      // sprite; neither crop removal nor mask cleanup can remove the real soil.
      this.frame = this.soil_state === SoilStates.INITIAL ? SoilStates.INITIAL : this.isWatered() ? SoilStates.READY : this.soil_state;
      if (!this.isWatered()) {
        this.soil_water_mask?.destroy();
        this.soil_water_mask = null;
        return;
      }
      // Untilled ground stores rain invisibly; tilling exposes its wet reservoir.
      if (this.soil_state === SoilStates.INITIAL) return;
      const size = CONFIG.FARM.tile_size;
      if (!this.soil_water_mask) {
        this.soil_water_mask = this.add([
          k.pos(size / 2, size / 2 - 5), k.circle(size * 0.71),
          k.anchor("center"), k.mask("intersect"), k.layer("soil"),
        ]);
        this.soil_water_mask.add([
          k.pos(-size / 2, -size / 2 + 5), k.sprite("soil", { frame: SoilStates.WATERED }),
        ]);
      }
      this.soil_water_mask.radius = size * 0.71 * Math.sqrt(this.water_remaining);
    },

    destroy() {
      if (this.soil_removed) return;
      this.soil_removed = true;
      this.soil_water_mask?.destroy();
      this.soil_water_mask = null;
    },
  };
}

export function addSoilToGrid(x, y, state = SoilStates.INITIAL) {
  return k.add([k.pos(), k.sprite("soil"), k.z(0), k.animate(), k.opacity(0), k.scale(1), k.layer("soil"), gridpos(x, y), soil(state)]);
}
