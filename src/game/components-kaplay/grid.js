import { k } from "../../lib/kaplay.js";
import { CONFIG } from "../global/global.js";
import { lerpvec2 } from "../utils/math.js";

export function gridmove() {
  return {
    id: "gridmove",
    require: ["gridpos"],

    jumpAnim: null,
    scaleAnim: null,
    grid_move_timer: null,
    grid_move_version: 0,

    updateAxis(x, y) {
      this.grid_x = x;
      this.grid_y = y;
    },

    gridPlace(x, y) {
      this.grid_move_timer?.cancel();
      this.grid_move_version++;
      this.unanimate("pos");
      this.unanimate("scale");
      this.pos = this.gridAxisToWorld(x, y);
      this.updateAxis(x, y);
    },

    gridJump(x, y, duration) {
      this.grid_move_timer?.cancel();
      const version = ++this.grid_move_version;
      const start_pos = this.pos;
      const target_pos = this.gridAxisToWorld(x, y);
      const control_point = k.vec2(start_pos.x + (target_pos.x - start_pos.x) / 2, Math.min(start_pos.y, target_pos.y) - 150);

      const points = [];
      const segments = 3;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const p0 = lerpvec2(start_pos, control_point, t);
        const p1 = lerpvec2(control_point, target_pos, t);
        points.push(lerpvec2(p0, p1, t));
      }

      points.unshift(start_pos);
      points.push(target_pos);

      this.animation.seek(0);

      this.jumpAnim = this.animate("pos", points, {
        duration,
        loops: 1,
        timing: [0, 0.3, 0.5, 0.6, 0.85, 1],
        easing: k.easings.linear,
        interpolation: "spline",
      });

      this.scaleAnim = this.animate("scale", [k.vec2(1, 1), k.vec2(1.2, 0.9), k.vec2(1.3, 0.8), k.vec2(1.4, 0.8), k.vec2(1, 1), k.vec2(1.4, 1.5), k.vec2(0.9, 1.5), k.vec2(0.9, 1.1), k.vec2(1, 1), k.vec2(1.1, 1), k.vec2(1, 1), k.vec2(0.95, 1.05), k.vec2(1, 1)], {
        duration,
        timing: [0, 0.1, 0.15, 0.2, 0.3, 0.5, 0.6, 0.7, 0.9, 0.92, 0.96, 0.98, 1],
        loops: 1,
        easing: k.easings.easeInSine,
      });

      this.grid_move_timer = this.wait(duration, () => {
        if (version === this.grid_move_version) {
          this.updateAxis(x, y);
          this.unanimate("pos");
          this.pos = target_pos;
        }
      });
    },

    gridSlide(x, y, duration) {
      this.grid_move_timer?.cancel();
      this.grid_move_version++;
      const start_pos = this.pos;
      const target_pos = this.gridAxisToWorld(x, y);

      this.animation.seek(0);
      this.animate("pos", [start_pos, target_pos], {
        duration,
        loops: 1,
        easing: k.easings.easeInOutExpo,
      });

      this.updateAxis(x, y);
    },

    destroy() {
      this.grid_move_timer?.cancel();
      this.grid_move_version++;
    },
  };
}

export function gridpos(grid_x, grid_y, offset_x = 0, offset_y = 0) {
  return {
    id: "gridpos",
    require: ["pos"],
    grid_x,
    grid_y,
    offset_x,
    offset_y,

    add() {
      if (grid_x != null && grid_y != null) this.pos = this.gridAxisToWorld();
    },

    gridAxisToWorld(x = this.grid_x, y = this.grid_y) {
      const { cell_size, grid_origin } = CONFIG.FARM;
      const world_x = x * cell_size + this.offset_x + grid_origin.x;
      const world_y = y * cell_size + this.offset_y + grid_origin.y;
      return k.vec2(world_x, world_y);
    },
  };
}
