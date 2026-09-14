import { k } from "../../lib/kaplay.js";
import { CONFIG } from "../global/global.js";
import { CropStates, CropTypes, IconTypes } from "../global/enum.js";
import { triggerDidYouKnow } from "../../components/global.svelte.js";
import { gridpos, gridmove } from "./grid.js";
import { ysort } from "./presentation.js";

export function bug(farm_grid_index, config = {}) {
  return {
    id: "bug",
    require: ["gridpos", "gridmove", "sprite", "animate", "timer"],
    bug_damage: config.damage ?? 10,
    bug_jump_duration: config.jump_duration ?? 0.5,
    bug_attack_interval: config.attack_interval ?? 2.25,
    bug_move_interval: config.move_interval ?? 5.0,
    bug_attack_timer: null,
    bug_move_timer: null,
    spawned_at: Date.now(),

    releaseBugTile() {
      // A bug reserves its destination before its jump finishes. Clear by
      // identity so dying mid-jump cannot leave that reservation behind.
      for (const [key, tile] of farm_grid_index) {
        if (tile.bug !== this) continue;
        tile.bug = null;
        if (!tile.soil && !tile.crop && !tile.bots?.length && !tile.fire) farm_grid_index.delete(key);
      }
    },

    destroy() {
      this.is_dying = true;
      this.bug_attack_timer?.cancel();
      this.bug_move_timer?.cancel();
      this.releaseBugTile();
    },

    bugDestroy() {
      if (this.is_dying) return;
      this.is_dying = true;
      this.releaseBugTile();
      const duration = 0.3;
      if (this.bug_attack_timer) {
        this.bug_attack_timer.cancel();
      }
      if (this.bug_move_timer) {
        this.bug_move_timer.cancel();
      }

      this.animation.seek(0);
      this.unanimateAll();
      this.animate("scale", [k.vec2(1), k.vec2(1.2, 0.8), k.vec2(1), k.vec2(0.8, 1.2), k.vec2(1)], {
        duration,
        loops: 1,
        easing: k.easings.easeInOutSine,
      });
      this.animate("opacity", [1, 0], {
        duration,
        loops: 1,
        easing: k.easings.easeInOutSine,
      });
      this.wait(duration, () => this.destroy());
    },

    add() {
      // 1. Spawn outside of the farm
      this.spawnOutside();

      // Register the bug in the grid immediately on spawn
      this.updateGridIndex(this.grid_x, this.grid_y);

      this.bug_attack_timer = this.loop(this.bug_attack_interval, () => {
        if (this.is_dying) return;
        const current_tile = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
        if (current_tile && current_tile.crop) {
          const crop = current_tile.crop;
          if (crop.crop_state === CropStates.HARVESTABLE) {
            const total_damage = this.bug_damage * crop.crop_resistance.bug;
            if (total_damage > 0) {
              triggerDidYouKnow("bug_damage");
              crop.showIcon(IconTypes.TEARS, 0.5);
              crop.damage(this.bug_damage, { source: "bug" });
              this.animation.seek(0);
              this.unanimateAll()
              this.animate("scale", [k.vec2(1), k.vec2(1.2, 0.8), k.vec2(1), k.vec2(0.8, 1.2), k.vec2(1)], {
                duration: 0.2,
                loops: 1,
                easing: k.easings.easeInOutSine,
              });
            }
          }
        }
      });

      this.bug_move_timer = this.loop(this.bug_move_interval, () => {
        if (this.is_dying) return;
        // Calculate max bounds based on CONFIG
        const max_x = CONFIG.FARM.columns - 1;
        const max_y = CONFIG.FARM.rows - 1;

        const isInside =
          this.grid_x >= 0 && this.grid_x <= max_x &&
          this.grid_y >= 0 && this.grid_y <= max_y;

        // 1. If currently inside the farm on a tile with a Rice crop, stay put (bait mechanic)
        if (isInside) {
          const current_tile = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
          if (current_tile?.crop?.crop_type === CropTypes.RICE) {
            return; // Already eating rice, don't move!
          }
        }

        let dir_x = 0;
        let dir_y = 0;

        // 2. Check neighbouring tiles for a Rice crop
        let rice_neighbor = null;
        const dirs = [
          [0, -1], // Up
          [1, 0],  // Right
          [0, 1],  // Down
          [-1, 0], // Left
        ];

        // Shuffle directions so if multiple rice crops are around, bug picks randomly among them
        const shuffled_dirs = [...dirs].sort(() => Math.random() - 0.5);

        for (const [dx, dy] of shuffled_dirs) {
          const nx = this.grid_x + dx;
          const ny = this.grid_y + dy;
          const neighbor_tile = farm_grid_index.get(`${ny}-${nx}`);
          if (
            neighbor_tile?.crop?.crop_type === CropTypes.RICE &&
            !neighbor_tile.bug
          ) {
            rice_neighbor = { dx, dy };
            break;
          }
        }

        if (rice_neighbor) {
          // Prioritize moving to the rice crop neighbor
          dir_x = rice_neighbor.dx;
          dir_y = rice_neighbor.dy;
        } else if (!isInside) {
          // 3. If outside and no adjacent rice, strictly move towards the farm
          dir_x = this.grid_x < 0 ? 1 : (this.grid_x > max_x ? -1 : 0);
          dir_y = this.grid_y < 0 ? 1 : (this.grid_y > max_y ? -1 : 0);
        } else {
          // 4. Inside the farm without adjacent rice: random movement locked inside
          dir_x = this.getRandomDir();
          dir_y = this.getRandomDir();

          if (this.grid_x + dir_x < 0) dir_x = 0;
          if (this.grid_x + dir_x > max_x) dir_x = 0;
          if (this.grid_y + dir_y < 0) dir_y = 0;
          if (this.grid_y + dir_y > max_y) dir_y = 0;
        }

        // Calculate the intended destination
        const target_x = this.grid_x + dir_x;
        const target_y = this.grid_y + dir_y;

        // Skip jump if no movement is chosen
        if (dir_x === 0 && dir_y === 0) return;

        // Look up the tile data in your grid index
        const target_tile = farm_grid_index.get(`${target_y}-${target_x}`);

        // Check whether a bug exists, if it does, don't jump
        if (target_tile && target_tile.bug) {
          return;
        }

        // Update the grid index so other bugs know this tile is about to be occupied
        this.updateGridIndex(target_x, target_y);

        // Jump to the new position
        this.gridJump(target_x, target_y, this.bug_jump_duration);
      });
    },

    getRandomDir() {
      const random = Math.random();
      if (random < 0.33) {
        return -1;
      } else if (random < 0.66) {
        return 1;
      } else {
        return 0;
      }
    },

    spawnOutside() {
      // Pick a random edge to spawn on: 0=Top, 1=Right, 2=Bottom, 3=Left
      const edge = Math.floor(Math.random() * 4);
      const cols = CONFIG.FARM.columns;
      const rows = CONFIG.FARM.rows;

      const spawn_distance = 5;

      if (edge === 0) {
        this.grid_x = Math.floor(Math.random() * cols);
        this.grid_y = -spawn_distance; // 5 blocks above the farm
      } else if (edge === 1) {
        // 0-indexed max x is (cols - 1), so +5 makes it cols + 4
        this.grid_x = (cols - 1) + spawn_distance;
        this.grid_y = Math.floor(Math.random() * rows);
      } else if (edge === 2) {
        this.grid_x = Math.floor(Math.random() * cols);
        // 0-indexed max y is (rows - 1), so +5 makes it rows + 4
        this.grid_y = (rows - 1) + spawn_distance;
      } else {
        this.grid_x = -spawn_distance; // 5 blocks left of the farm
        this.grid_y = Math.floor(Math.random() * rows);
      }
      this.pos = this.gridAxisToWorld();
    },

    updateGridIndex(new_x, new_y) {
      this.releaseBugTile();

      // Add to new position in the grid index
      const target_key = `${new_y}-${new_x}`;
      const target_tile = farm_grid_index.get(target_key);

      if (!target_tile) {
        // If no soil/tile object exists there yet, create a placeholder
        farm_grid_index.set(target_key, { bug: this });
      } else {
        target_tile.bug = this;
      }
    },
  };
}

export function addBug(farm_grid_index, config = {}) {
  triggerDidYouKnow("bugs");
  return k.add([
    k.pos(),
    k.sprite("bug"),
    k.z(0),
    k.scale(1, 1),
    k.animate(),
    k.timer(),
    k.anchor("bot"),
    ysort(),
    gridpos(null, null, CONFIG.FARM.tile_size / 2, CONFIG.FARM.tile_size + 15),
    gridmove(),
    bug(farm_grid_index, config),
  ]);
}
