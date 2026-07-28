import { k } from "../../lib/kaplay.js";
import { robots, triggerDidYouKnow } from "../../components/global.svelte.js";
import { FreshnessStates, CropStates, SoilStates, IconTypes, OrbTypes, CropTypes } from "../global/enum.js";
import { CROP_DATA, CONFIG, SAY_DATA, PLAYER_DATA, INVENTORY, DOCUMENT_DATA } from "../global/global.js";
import { play_sfx } from "../utils/sound.js";

import { lerp, lerpvec2 } from "../utils/math.js";

export function ysort(is_enabled = true, add = 0) {
  return {
    id: "ysort",
    require: ["z", "pos"],
    ysort_enabled: is_enabled,
    ysort_add: add,

    update() {
      if (this.ysort_enabled) this.z = this.pos.y + this.ysort_add;
    },
  };
}

// Adding an opt seems to break this shit. The sizes change, the anchor also, wtf is going on
export function displaytext(text = "", offset_x = 0, offset_y = 0, opt = {}) {
  return {
    id: "displaytext",
    require: ["pos"],

    display_offset_x: offset_x,
    display_offset_y: offset_y,
    display_text: text,
    display_obj: null,
    display_size: null,
    display_width: null,
    display_color: null,

    update() {
      this.display_obj.z = this.pos.y + 1;
    },

    add() {
      const { size = this.display_size, width = this.display_width, color = this.display_color } = opt;
      this.display_size = size ? size : 16;
      this.display_width = width ?? 64;
      this.display_color = color ?? k.WHITE;

      const pos = k.vec2(0 + this.display_offset_x, 0 + this.display_offset_y);
      this.display_obj = this.add([
        k.z(),
        k.opacity(1),
        k.anchor(k.vec2(-1, -1)), // This is the default anchor for KAPLAY objects
        k.text(text, {
          size: this.display_size,
          width: this.display_width,
          align: "center",
          font: "Chintzy",
        }),
        k.pos(pos),
        k.color(this.display_color),
      ]);
    },

    setDisplayColor(color) {
      this.display_obj.color = color;
    },
  };
}

export function saytext(offset_x, offset_y, opt = { size: 14, height: 80, duration: 3, color: "#1d293d" }) {
  return {
    id: "saytext",
    require: ["pos"],
    say_offset_x: offset_x,
    say_offset_y: offset_y,
    say_size: opt.size,
    say_height: opt.height,
    say_duration: opt.duration,
    say_color: opt.color,
    say_z: k.height(),
    say_stack: 0,

    sayText(say_text, color = "#fafafa", textcolor = this.say_color) {
      if (this.say_stack > 6) this.say_stack = 0;
      this.say_stack += 1;
      this.say_z += 1;
      const pos = k.vec2(this.pos.x + this.say_offset_x, this.pos.y + this.say_offset_y);
      const text_width = Math.max(80, String(say_text).length * (this.say_size / 1.5));
      const rand_pos = k.vec2(pos.x, pos.y - this.say_stack * 20);
      const text = k.add([
        k.text(say_text, {
          size: this.say_size,
          width: text_width,
          align: "center",
          font: "Quicksand",
        }),
        k.pos(pos),
        k.color(textcolor),
        k.opacity(0),
        k.timer(),
        k.z(this.say_z),
        k.animate(),
        k.scale(1, 1),
        k.anchor("bot"),
      ]);
      text.add([k.color(color), k.pos(0, 0 + this.say_size / 2), k.anchor("bot"), k.outline(2, k.Color.fromHex("#cf676e")), k.animate(), k.opacity(1), k.z(this.say_z - 1), k.rect(text_width, this.say_size + 10, { radius: 5 })]);
      text.animate("opacity", [0, 1, 0], {
        duration: this.say_duration,
        timing: [0, 0.8, 1],
        loops: 1,
      });
      text.animate("scale", [k.vec2(0.8, 0.8), k.vec2(1, 1), k.vec2(0, 0)], {
        duration: this.say_duration,
        timing: [0, 0.8, 1],
        loops: 1,
        easing: k.easings.easeInOutExpo,
      });
      text.animate("pos", [k.vec2(pos), rand_pos], {
        duration: 1,
        loops: 1,
        easing: k.easings.easeInOutSine,
      });
      text.wait(this.say_duration, () => {
        this.say_stack = Math.max(this.say_stack - 1, 0);
        text.destroy();
      });
    },
  };
}

export function soil(state = SoilStates.INITIAL) {
  return {
    id: "soil",
    require: ["gridpos", "sprite"],

    soil_state: state,

    add() {
      this.frame = this.soil_state;
      this.animation.seek(0);
      this.unanimateAll();

      this.animate("opacity", [0, 1], {
        duration: 0.5,
        loops: 1,
        easing: k.easings.easeInOutSine,
      });
    },

    setSoilState(state) {
      this.soil_state = state;
      this.frame = this.soil_state;
    },
  };
}

export function crop(farm_grid_index, type, state = CropStatesEnum.YOUNG) {
  return {
    id: "crop",
    require: ["gridpos", "timer", "animate", "rotate", "freshness", "dropOrbs"],

    crop_type: type,
    crop_grow_time: 0,
    crop_grow_duration: CROP_DATA[type].duration,
    crop_state: state,
    crop_health: CROP_DATA[type].health,
    crop_duration: CROP_DATA[type].duration,
    crop_reward: CROP_DATA[type].reward,
    crop_exp: CROP_DATA[type].exp,
    crop_spoilage_time: CROP_DATA[type].spoilage_time,
    crop_resistance: CROP_DATA[type].resistance,
    crop_seed_drop_chance: CROP_DATA[type].seed_drop_chance,
    absorbing_water: false,

    crop_soil_water: null,
    crop_soil_parent: null,
    crop_mask: null,
    crop_expiry_timer: null,

    cropDestroy() {
      const tile = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
      this.destroy()
      tile.crop = null;
    },

    damage(amount) {
      this.crop_health -= amount;
      console.log(this.crop_health)
      this.animation.seek(0);
      this.animate("scale", [k.vec2(1), k.vec2(1.2, 0.8), k.vec2(1), k.vec2(0.8, 1.2), k.vec2(1)], {
        duration: 0.2,
        loops: 1,
        easing: k.easings.easeInOutSine,
      });
      this.animate("opacity", [1, 0, 1], {
        duration: 0.2,
        loops: 1,
        easing: k.easings.easeInOutSine,
      });
      if (this.crop_health <= 0) {
        this.animate("opacity", [1, 0], {
          duration: 0.2,
          loops: 1,
          easing: k.easings.easeInOutSine,
        });
        this.wait(0.2, () => this.cropDestroy())
      }
    },

    harvest() {
      const tile = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
      this.animation.seek(0);
      this.unanimateAll();
      this.angle = 0;
      this.animate("scale", [k.vec2(1), k.vec2(1.2, 0.8), k.vec2(1), k.vec2(0.8, 1.2), k.vec2(1)], {
        duration: 0.5,
        loops: 1,
        easing: k.easings.easeInOutSine,
      });
      if (this.crop_type !== CropTypes.SUGARCANE) {
        this.animate("opacity", [1, 0], {
          duration: 0.5,
          loops: 1,
          easing: k.easings.easeInOutSine,
        });
      }
      const dropping_seed = Math.random() < this.crop_seed_drop_chance;
      if (dropping_seed) {
        triggerDidYouKnow("seed_drop");
        this.wait(0.5, () => {
          INVENTORY.changeCrops(this.crop_type, 1)
          this.dropOrbs(this, 1, `icon_seedpack`, 0.4);
        })
      }

      this.wait(0.5, () => {
        const total_exp = this.crop_exp / (this.freshness_state === FreshnessStates.FRESH ? 1 : 2);
        PLAYER_DATA.changeExp(total_exp);
        this.dropOrbs(this, total_exp, OrbTypes.EXP);
        this.wait(0.5, () => {
          const total_coin = this.crop_reward / (this.freshness_state === FreshnessStates.FRESH ? 1 : 2);
          INVENTORY.changeCoins(total_coin);
          play_sfx("collect")
          this.dropOrbs(this, total_coin, OrbTypes.COIN);

          if (this.crop_type === CropTypes.SUGARCANE) {
            triggerDidYouKnow("sugarcane");
            this.animation.seek(0);
            this.animate("angle", [-3, 3], {
              duration: 1,
              direction: "ping-pong",
              easing: k.easings.easeInOutSine,
            });
            this.crop_state = CropStates.GROWING;
            this.sprite = `${this.crop_type}${this.crop_state}`;
          } else {
            this.cropDestroy();
          }
        });
      });
    },

    add() {
      if (this.crop_type === CropTypes.CORN) {
        k.loop(1, () => {
          if (this.crop_state === CropStates.HARVESTABLE || this.crop_state === CropStates.DEAD) {
            this.effectsEnabled(false);
            return;
          };
          const count = this.countAdjacentCrop(this.grid_x, this.grid_y, this.crop_type);
          this.effectsEnabled(count !== 0);
          if (count === 0) return;
          triggerDidYouKnow("corn_synergy");
          this.showEffects("upgrade", "medium", null);
          this.crop_grow_duration = this.crop_duration - count * 6;
        });
      }

      this.tag(this.crop_type);
      this.sprite = this.crop_type + this.crop_state;
      this.animate("angle", [-3, 3], {
        duration: 1,
        direction: "ping-pong",
        easing: k.easings.easeInOutSine,
      });
    },

    update() {
      const { soil } = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
      if (soil == null) return;
      if (this.absorbing_water) {
        this.crop_grow_time += k.dt();
        const progress = this.crop_grow_time / this.crop_grow_duration;

        this.crop_mask.radius = lerp(45, 0, progress);

        if (progress >= 1) {
          this.crop_grow_time = 0;
          this.absorbing_water = false;
          soil.parent = this.crop_soil_parent;
          soil.pos = this.crop_soil_water.pos;
          soil.setSoilState(SoilStates.READY);

          if (this.crop_state === CropStates.YOUNG) {
            this.crop_state = CropStates.GROWING;
          } else if (this.crop_state === CropStates.GROWING) {
            this.crop_state = CropStates.HARVESTABLE;
            // When it's harvestable, start timer
            this.initFreshness();

            // This avoids queue hell with wait
            if (this.crop_expiry_timer) this.crop_expiry_timer.cancel()

            // A very shitty implementation right now, but hey, this works
            // Why this is shitty is because there's no way to stop this... it should be rather processed in update
            // But basically, let's just say right now that, if it became an adult, start counting
            this.crop_expiry_timer = this.wait(this.crop_spoilage_time, () => {
              if (this.crop_state === CropStates.HARVESTABLE) {
                this.crop_state = CropStates.DEAD;
                this.sprite = `${type}${this.crop_state}`;
                triggerDidYouKnow("spoilage");
              }
            });
          }
          this.sprite = `${type}${this.crop_state}`;

          this.crop_mask.destroy();
          this.crop_soil_water.destroy();
        }
      }

      if (soil.soil_state === SoilStates.WATERED && this.absorbing_water === false) {
        this.absorbing_water = true;
        this.crop_soil_parent = soil.parent;

        const offset_mask = 5;
        this.crop_soil_water = addSoilToGrid(soil.grid_x, soil.grid_y, SoilStates.WATERED);
        this.crop_mask = k.add([k.circle(45), k.pos(this.crop_soil_water.pos.x + 64 / 2, this.crop_soil_water.pos.y + 64 / 2 - offset_mask), k.anchor("center"), k.mask("subtract"), k.timer()]);
        soil.pos = k.vec2(0 - 64 / 2, 0 - 64 / 2 + offset_mask);
        soil.frame = SoilStates.READY;
        soil.parent = this.crop_mask;
      }
    },

    countAdjacentCrop(x, y, type) {
      let count = 0;

      const dirs = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ];

      for (let i = 0; i < dirs.length; i++) {
        const tile = farm_grid_index.get(`${y + dirs[i][0]}-${x + dirs[i][1]}`);
        if (!tile) continue;
        if (!tile.crop) continue;
        const { crop } = tile;
        if (crop.crop_type === type) {
          count += 1;
        }
      }
      return count;
    },
  };
}

export function freshness() {
  return {
    id: "freshness",
    require: ["crop"],
    freshness_state: FreshnessStates.FRESH,
    freshness_effects: {},
    freshness_timer: null,

    update() {
      if (this.crop_state === CropStates.GROWING || this.crop_state === CropStates.YOUNG) {
        if (this.freshness_timer) this.freshness_timer.cancel();
        if (this.freshness_effects.a) this.freshness_effects.a.destroy();
        if (this.freshness_effects.b) this.freshness_effects.b.destroy();
        if (this.freshness_effects.c) this.freshness_effects.c.destroy();
      }
    },

    initFreshness() {
      this.freshness_state = FreshnessStates.FRESH;
      if (this.crop_state !== CropStates.HARVESTABLE) return

      // Create the new effects
      this.freshness_effects.a = this.add([k.pos(-7, -12), k.sprite(this.stateToPath(this.freshness_state)), k.opacity(1), k.animate(), k.z(k.height()), k.scale(), k.anchor("bot")]);
      this.freshness_effects.b = this.add([k.pos(+20, -35), k.sprite(this.stateToPath(this.freshness_state)), k.opacity(1), k.animate(), k.z(k.height()), k.scale(), k.anchor("bot")]);
      this.freshness_effects.c = this.add([k.pos(-16, -41), k.sprite(this.stateToPath(this.freshness_state)), k.opacity(1), k.animate(), k.z(k.height()), k.scale(), k.anchor("bot")]);

      const { a, b, c } = this.freshness_effects

      for (const particles of [a, b, c]) {
        particles.animation.seek(0);
        particles.animate("angle", [6, -6], {
          duration: 1,
          direction: "ping-pong",
          easing: k.easings.easeInOutSine,
        });
        particles.animate("scale", [k.vec2(1, 1), k.vec2(1.2, 1.2)], {
          duration: 1,
          direction: "ping-pong",
          easing: k.easings.easeInOutSine,
        });
        particles.animate("opacity", [0.5, 1], {
          duration: 1,
          direction: "ping-pong",
          easing: k.easings.easeInOutSine,
        });
      }

      // A really shitty way to write this lol, but fuck it, let's make it work first
      this.freshness_timer = this.wait(this.crop_spoilage_time / 2, () => {
        this.freshness_state = FreshnessStates.EXPIRING;
        triggerDidYouKnow("freshness");
        a.sprite = this.stateToPath(this.freshness_state);
        b.sprite = this.stateToPath(this.freshness_state);
        c.sprite = this.stateToPath(this.freshness_state);

        for (const particles of [a, b, c]) {
          const rand_pos = [];
          const rand_angle = [];
          particles.opacity = 1
          for (let i = 0; i < 10; i++) {
            rand_angle.push(k.rand(-10, 10));
            const x = k.rand(-15, 15);
            const y = k.rand(0, -50);
            rand_pos.push(k.vec2(x, y));
          }

          particles.unanimateAll();
          particles.animation.seek(0);
          particles.animate("angle", rand_angle, {
            duration: 1,
            direction: "ping-pong",
            easing: k.easings.easeInOutSine,
          });
          particles.animate("scale", [k.vec2(1, 1), k.vec2(1.3, 1.3)], {
            duration: 1,
            direction: "ping-pong",
            easing: k.easings.easeInOutSine,
          });
          particles.animate("pos", rand_pos, {
            duration: this.crop_spoilage_time / 2,
            direction: "ping-pong",
            easing: k.easings.easeInOutExpo,
          });
        }
        this.freshness_timer = this.wait(this.crop_spoilage_time / 2, () => {
          this.freshness_state = FreshnessStates.DEAD;
          a.sprite = `${this.stateToPath(this.freshness_state)}1`;
          b.sprite = `${this.stateToPath(this.freshness_state)}2`;
          c.sprite = `${this.stateToPath(this.freshness_state)}1`;

          for (const particles of [a, b, c]) {
            particles.unanimateAll();
            particles.animation.seek(0);
            particles.animate("scale", [k.vec2(0, 0), k.vec2(1.5, 1.5)], {
              duration: 1,
              easing: k.easings.easeInOutSine,
            });
            const rand_x = k.rand(-10, 10);
            particles.animate("pos", [k.vec2(rand_x, 0), k.vec2(rand_x + k.rand(-10, 10), k.rand(0, -50))], {
              duration: 1,
              easing: k.easings.easeInOutSine,
            });
            particles.animate("opacity", [0, 1, 0], {
              duration: 1,
              easing: k.easings.easeInOutSine,
            });
          }
        });
      });
    },

    stateToPath(state) {
      switch (state) {
        case FreshnessStates.FRESH: {
          return "icon_sparkle";
        }
        case FreshnessStates.EXPIRING: {
          return "icon_fly";
        }
        case FreshnessStates.DEAD: {
          return "icon_poison";
        }
      }
    },
  };
}

export function dropOrbs() {
  return {
    id: "dropOrbs",
    require: ["gridpos"],

    dropOrbs(object, count, sprite, size = 1) {
      const pos = this.gridAxisToWorld(object.grid_x, object.grid_y);

      // const orb_div = {
      // 	0: 0,
      // 	1: 0,
      // 	2: 0,
      // };

      // // Random-based drop (less performance but addictive)
      // let remaining = Math.floor(count);
      // while (remaining > 0) {
      // 	if (remaining >= 10 && k.rand() < 0.05) {
      // 		orb_div[2] += 1;
      // 		remaining -= 10;
      // 	} else if (remaining >= 5 && k.rand() < 0.15) {
      // 		orb_div[1] += 1;
      // 		remaining -= 5;
      // 	} else {
      // 		orb_div[0] += 1;
      // 		remaining -= 1;
      // 	}
      // }

      // Math-based drop
      // const orb_div = {
      // 	0: (count % 10) % 5,
      // 	1: Math.floor((count % 10) / 5),
      // 	2: Math.floor(count / 10),
      // };

      const orbs = [];

      for (let i = 0; i < count; i++) {
        orbs.push(k.add([k.pos(), k.sprite(`${sprite}`), k.z(k.height()), k.animate(), k.opacity(), k.timer(), k.anchor("bot"), k.scale(0.3, 0.3)]));
      }

      for (const orb of orbs) {
        const rand_x = k.rand(pos.x - 30, pos.x + 30);
        const rand_y = k.rand(pos.y, pos.y + 20);
        orb.animation.seek(0);
        orb.animate("scale", [k.vec2(0.3, 0.3), k.vec2(size + 0.2, size + 0.2), k.vec2(size, size)], {
          duration: 1,
          loops: 1,
          easing: k.easings.easeInOutExpo,
        });
        orb.animate("pos", [pos, k.vec2(rand_x, rand_y - 40), k.vec2(rand_x, rand_y)], {
          duration: 1,
          timing: [0, 0.8, 1],
          loops: 1,
          easing: k.easings.easeInOutExpo,
        });
        orb.wait(1, () => {
          orb.unanimateAll();
          orb.animation.seek(0);
          orb.animate("opacity", [1, 0], {
            duration: 0.7,
            loops: 1,
            easing: k.easeInOutSine,
          });
          orb.animate("pos", [k.vec2(rand_x, rand_y), k.vec2(0, 0)], {
            duration: 1,
            loops: 1,
            easing: k.easings.easeInOutExpo,
          });
          orb.wait(1, () => orb.destroy());
        });
      }
    },
  };
}

// This would be dope if I can specify the color lmao, but nah, no time for that
export function effects(counter_rotate = false) {
  return {
    id: "effects",
    require: ["gridpos"],
    effect: null,


    update() {
      if (this.effect) this.effect.z = this.z + 1;
      if (counter_rotate && this.effect) this.effect.angle = -this.angle;
    },

    effectsEnabled(enable) {
      if (this.effect == null) return
      if (enable) this.effect.opacity = 1
      else this.effect.opacity = 0
    },

    showEffects(type, size, duration = null) {
      if (this.effect && duration == null) return;
      const pos = this.gridAxisToWorld(this.grid_x, this.grid_y);

      if (type === "upgrade") {
        const a = this.add([k.pos(k.randi(-20, 20), k.randi(0, -40)), k.sprite("icon_sparkle"), k.opacity(1), k.animate(), k.timer(), k.z(k.height()), k.scale(), k.anchor("bot")]);
        const b = this.add([k.pos(k.randi(-20, 20), k.randi(0, -40)), k.sprite("icon_sparkle"), k.opacity(1), k.animate(), k.timer(), k.z(k.height()), k.scale(), k.anchor("bot")]);
        const c = this.add([k.pos(k.randi(-20, 20), k.randi(0, -40)), k.sprite("icon_sparkle"), k.opacity(1), k.animate(), k.timer(), k.z(k.height()), k.scale(), k.anchor("bot")]);

        // This would be better as a children so it'd follow the parent
        if (this.effect == null) this.effect = this.add([k.pos(), k.sprite("effect_" + size), k.opacity(0), k.animate(), k.z(), k.anchor("bot"), k.rotate()])
        else {
          this.effect.sprite = "effect_" + size
        }

        this.effect.animation.seek(0);

        for (let sparkles of [a, b, c]) {
          const rand_scale_start = k.randi(0, 1);
          sparkles.animate("scale", [k.vec2(rand_scale_start, rand_scale_start), k.vec2(1, 1), k.vec2(0.5, 0.5)], {
            duration: duration,
            loops: 1,
            easing: k.easings.easeInOutSine,
          })
          sparkles.animate("pos", [sparkles.pos, k.vec2(sparkles.pos.x, sparkles.pos.y - 25)], {
            duration: duration,
            loops: 1,
            easing: k.easings.easeInOutExpo,
          })
          sparkles.animate("opacity", [0.5, 1, 0], {
            duration: duration,
            loops: 1,
            easing: k.easings.easeInOutSine,
          });

          sparkles.wait(duration - 0.1, () => {
            sparkles.destroy()
          })
        }

        const timing = duration ? [0.5, 1, 0] : [0.5, 1];
        this.effect.animate("opacity", timing, {
          duration: duration,
          loops: 1,
          easing: k.easings.easeInOutSine,
        });
      }
    }
  }
}

// Let's make it simple right now, extend later
export function popupicon() {
  return {
    id: "popupicon",
    require: ["gridpos"],
    icon: null,

    showIcon(type, duration, is_animate = true) {
      const pos = this.gridAxisToWorld(this.grid_x, this.grid_y);

      if (this.icon == null) this.icon = k.add([k.pos(pos.x, pos.y), k.sprite("icon_" + type), k.opacity(0), k.animate(), k.z(k.height()), k.scale(0.7, 0.7), k.anchor("bot")]);
      else this.icon.sprite = "icon_" + type;

      this.icon.animation.seek(0);

      if (is_animate) {
        this.icon.animate("pos", [k.vec2(pos.x, pos.y), k.vec2(pos.x, pos.y - 25)], {
          duration: duration + 0.5,
          loops: 1,
          easing: k.easings.easeInOutExpo,
        });
        this.icon.animate("opacity", [0, 1, 0], {
          duration: duration + 0.5,
          loops: 1,
          easing: k.easings.easeInOutSine,
        });
      } else {
        this.icon.animate("opacity", [0, 1, 0], {
          timing: [0, 0.1, 1],
          duration: duration + 0.5,
          loops: 1,
          easing: k.easings.easeInOutSine,
        });
      }
    },
  };
}

export function botact(id, farm_grid_index) {
  return {
    id: "bot",
    require: ["gridpos", "gridmove", "sprite", "timer"],

    bot_index: id,
    botmove_duration: CONFIG.BOT.move_duration, // This is the default value
    botact_duration: CONFIG.BOT.action_duration, // This is the default value
    botcheck_duration: CONFIG.BOT.check_duration, // This is the default value
    is_available: true,

    add() {
      this.botJump(0, 0);
    },
    update() {
      const tile = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
      const bots = tile?.bots;
      if (bots) {
        if (bots.length === 0 || bots.length === 1) {
          this.display_obj.opacity = 1;
          this.display_obj.anchor = k.vec2(-1, -1)
          this.anchor = k.vec2(0, 1);
        }
        if (bots.length > 1) {
          for (let i = 0; i < bots.length; i++) {
            k.readd(bots[i])
            if (bots[i].bot_index === this.bot_index) {
              this.display_obj.opacity = 1;
              this.anchor = k.vec2(0, i + 1)
              this.display_obj.anchor = k.vec2(-1, ((i + 1) + (i * 2.55)) - 1.5) // Don't ask what the fuck these numbers mean...
            } else {
              this.display_obj.opacity = 0;
            }
          }
        }
      }
    },

    showError(str) {
      this.sayText(str, "#ffb8bd", "#763c40");
      this.setDisplayColor(k.RED);
      this.wait(this.botact_duration, () => {
        this.is_available = true;
        this.setDisplayColor(k.GREEN);
      });
    },

    performAct(animate = true, duration = CONFIG.BOT.action_duration, callback = null) {
      this.is_available = false;
      this.setDisplayColor(k.YELLOW);

      this.wait(duration, () => {
        this.is_available = true;
        this.setDisplayColor(k.GREEN);
        if (callback) callback();
      });

      if (animate) {
        const t = duration / 2;
        this.tween(k.vec2(1, 1), k.vec2(1.1, 0.9), t, (v) => (this.scale = v), k.easings.easeInSine).onEnd(() => {
          this.tween(k.vec2(0.9, 1.1), k.vec2(1, 1), t, (v) => (this.scale = v), k.easings.easeOutSine);
        });
      }
    },

    checkTilled(callback = null, x = this.grid_x, y = this.grid_y) {
      const { soil } = farm_grid_index.get(`${y}-${x}`);
      let val = null;
      if (soil.soil_state === SoilStates.READY || soil.soil_state === SoilStates.WATERED) val = true;
      else val = false;
      triggerDidYouKnow("bot_check");
      this.showIcon(IconTypes.MGLASS, this.botcheck_duration);
      play_sfx("bot_act")
      this.performAct(true, this.botcheck_duration, () => callback(val));
    },
    checkWatered(callback = null, x = this.grid_x, y = this.grid_y) {
      const { soil } = farm_grid_index.get(`${y}-${x}`);
      let val = null;
      if (soil.soil_state === SoilStates.WATERED) val = true;
      else val = false;
      this.showIcon(IconTypes.MGLASS, this.botcheck_duration);
      play_sfx("bot_act")
      this.performAct(true, this.botcheck_duration, () => callback(val));
    },
    checkDead(callback = null, x = this.grid_x, y = this.grid_y) {
      const { crop = null } = farm_grid_index.get(`${y}-${x}`);
      if (crop) {
        this.showIcon(IconTypes.MGLASS, this.botcheck_duration);
        play_sfx("bot_act")
        this.performAct(true, this.botcheck_duration, () => callback(crop.crop_state === CropStates.DEAD));
      } else {
        this.showError(SAY_DATA.farm.error.no_plant);
        this.performAct(true, this.botcheck_duration, () => callback(null));
      }
    },
    checkPlanted(callback = null, x = this.grid_x, y = this.grid_y) {
      let val = null;
      const { crop = null } = farm_grid_index.get(`${y}-${x}`);
      if (crop) val = true;
      else val = false;
      this.showIcon(IconTypes.MGLASS, this.botcheck_duration);
      play_sfx("bot_act")
      this.performAct(true, this.botcheck_duration, () => callback(val));
    },
    isHarvestable(callback = null, x = this.grid_x, y = this.grid_y) {
      let val = null;
      const { crop = null } = farm_grid_index.get(`${y}-${x}`);
      if (crop && crop.crop_state === CropStates.HARVESTABLE) val = true;
      else val = false;
      this.showIcon(IconTypes.MGLASS, this.botcheck_duration);
      play_sfx("bot_act")
      this.performAct(true, this.botcheck_duration, () => callback(val));
    },


    isWithinBounds(x, y) {
      if (x < 0 || y < 0 || x >= CONFIG.FARM.columns || y >= CONFIG.FARM.rows) return false;
      return true;
    },

    isBug(callback = null, x = this.grid_x, y = this.grid_y) {
      let val = null;
      const { bug = null } = farm_grid_index.get(`${y}-${x}`);
      if (bug) val = true;
      else val = false;
      this.showIcon(IconTypes.MGLASS, this.botcheck_duration);
      play_sfx("bot_act")
      this.performAct(true, this.botcheck_duration, () => callback(val));
    },

    botMovedTo(current_x, current_y, to_x, to_y, duration) {
      // Delete the old bot copy immediately
      const old_tile = farm_grid_index.get(`${current_y}-${current_x}`)
      if (!old_tile) return;
      if (old_tile?.bots) {
        const index = old_tile.bots.findIndex(bot => bot.bot_index === this.bot_index)
        if (index !== -1) old_tile.bots.splice(index, 1);
      }

      const new_tile = farm_grid_index.get(`${to_y}-${to_x}`);
      if (!new_tile) return;
      if (new_tile?.bots == null) {
        new_tile.bots = [];
      }
      this.wait(duration, () => new_tile.bots.push(this))
    },

    botJump(x = this.grid_x, y = this.grid_y, callback = null) {
      this.performAct(false, this.botmove_duration, callback);

      if (this.isWithinBounds(x, y)) {
        this.botMovedTo(this.grid_x, this.grid_y, x, y, this.botmove_duration);
        this.gridJump(x, y, this.botmove_duration);
        play_sfx("bot_jump")
        return true;
      } else {
        triggerDidYouKnow("out_of_bounds");
        this.showError(SAY_DATA.farm.error.out_of_bounds);
        return false;
      }
    },

    botWait(duration, callback = null) {
      this.performAct(false, duration, callback);
      play_sfx("bot_act")
      this.showIcon(IconTypes.TIMER, duration, false);
      return true;
    },

    botKillBug(callback = null, x = this.grid_x, y = this.grid_y) {
      this.performAct(true, this.botact_duration, callback);

      const key = `${y}-${x}`;
      const tile = farm_grid_index.get(key);
      const { bug = null } = farm_grid_index.get(key);

      if (bug) {
        this.showIcon(IconTypes.SPARK, this.botcheck_duration);
        play_sfx("bot_kill")
        bug.bugDestroy();
      } else {
        this.showError(SAY_DATA.farm.error.no_bug);
      }
    },

    botTill(callback = null, x = this.grid_x, y = this.grid_y) {
      this.performAct(true, this.botact_duration, callback);

      const { soil } = farm_grid_index.get(`${y}-${x}`);
      if (soil.soil_state === SoilStates.INITIAL) {
        soil.setSoilState(SoilStates.READY);
        this.showIcon(IconTypes.HOE, this.botact_duration);
        play_sfx("bot_till")
        triggerDidYouKnow("soil");
        return true;
      } else {
        this.showError(SAY_DATA.farm.error.till_tilled);
        return false;
      }
    },

    botWater(callback = null, x = this.grid_x, y = this.grid_y) {
      this.performAct(true, this.botact_duration, callback);

      const { soil, crop = null } = farm_grid_index.get(`${y}-${x}`);

      if (crop && crop.crop_state === CropStates.HARVESTABLE) {
        this.showError(SAY_DATA.farm.error.water_harvestable);
        return false;
      } else if (crop && crop.crop_state === CropStates.DEAD) {
        this.showError(SAY_DATA.farm.error.crop_dead);
        return false;
      } else if (soil.soil_state === SoilStates.READY) {
        soil.setSoilState(SoilStates.WATERED);
        this.showIcon(IconTypes.DROPLET, this.botact_duration);
        play_sfx("bot_water")
        return true;
      } else if (soil.soil_state === SoilStates.INITIAL) {
        this.showError(SAY_DATA.farm.error.water_initial);
        return false;
      } else if (soil.soil_state === SoilStates.WATERED) {
        this.showError(SAY_DATA.farm.error.water_watered);
        return false;
      }
      return false;
    },

    botPlant(type, callback = null, x = this.grid_x, y = this.grid_y) {
      this.performAct(true, this.botact_duration, callback);

      if (DOCUMENT_DATA.crops[type] && !DOCUMENT_DATA.crops[type].is_unlocked) {
        this.showError(SAY_DATA.farm.error.crop_locked);
        return false;
      }

      const key = `${y}-${x}`;
      const tile = farm_grid_index.get(key);
      const { soil, crop = null } = farm_grid_index.get(key);

      if (crop == null && (soil.soil_state === SoilStates.READY || soil.soil_state === SoilStates.WATERED)) {
        if (INVENTORY.crops[type] > 0) {
          this.showIcon(IconTypes.SEEDPACK, this.botact_duration);
          play_sfx("plant")
          const crop = addCrop(farm_grid_index, type, this.grid_x, this.grid_y);
          farm_grid_index.set(key, { ...tile, crop });
          INVENTORY.changeCrops(type, -1);
          return true;
        } else {
          this.showError(SAY_DATA.farm.error.insufficient_resources);
          return false;
        }
      } else if (soil.soil_state === SoilStates.INITIAL) {
        this.showError(SAY_DATA.farm.error.plant_initial);
        return false;
      } else if (crop != null) {
        this.showError(SAY_DATA.farm.error.plant_planted);
        return false;
      }
      return false;
    },

    botHarvest(callback = null, x = this.grid_x, y = this.grid_y) {
      this.performAct(true, this.botact_duration, callback);

      const key = `${y}-${x}`;
      const tile = farm_grid_index.get(key);
      const { soil, crop = null } = farm_grid_index.get(key);

      if (crop && crop.crop_state === CropStates.HARVESTABLE) {
        const harvestedType = crop.crop_type;
        crop.harvest();
        play_sfx("plant")
        return harvestedType;
      } else if (crop && crop.crop_state === CropStates.GROWING) {
        this.showError(SAY_DATA.farm.error.harvest_not_ready);
        return null;
      } else if (crop && crop.crop_state === CropStates.DEAD) {
        this.showError(SAY_DATA.farm.error.crop_dead);
        return null;
      } else {
        this.showError(SAY_DATA.farm.error.no_plant);
        return null;
      }
    },

    botDestroy(callback = null, x = this.grid_x, y = this.grid_y) {
      this.performAct(true, this.botact_duration, callback);

      const key = `${y}-${x}`;
      const tile = farm_grid_index.get(key);
      const { crop = null } = farm_grid_index.get(key);

      if (crop && !crop.absorbing_water) {
        crop.wait(0.5, () => {
          crop.showIcon(IconTypes.ANGEL, this.botact_duration);
          play_sfx("plant")
          crop.cropDestroy()
        });
        return true;
      } else if (crop && crop.absorbing_water) {
        this.showError(SAY_DATA.farm.error.destroy_absoring);
        return false;
      } else {
        this.showError(SAY_DATA.farm.error.no_plant);
        return false;
      }
    },
  };
}

// gridmove provides grid movement abilities, it mostly operates based on gridpos data
export function gridmove() {
  return {
    id: "gridmove",
    require: ["gridpos"],

    jumpAnim: null,
    scaleAnim: null,

    updateAxis(x, y) {
      this.grid_x = x;
      this.grid_y = y;
    },

    gridPlace(x, y) {
      this.pos = this.gridAxisToWorld(x, y);
      this.updateAxis(x, y);
    },

    gridJump(x, y, duration) {
      const start_pos = this.pos;
      const target_pos = this.gridAxisToWorld(x, y);
      const control_point = k.vec2(start_pos.x + (target_pos.x - start_pos.x) / 2, start_pos.y - (start_pos.y / target_pos.y) * 150);

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

      this.wait(duration, () => this.updateAxis(x, y))
    },

    gridSlide(x, y, duration) {
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

export function addSoilToGrid(x, y, state = SoilStates.INITIAL) {
  return k.add([k.pos(), k.sprite("soil"), k.z(0), k.animate(), k.opacity(0), k.scale(k.vec2(1, 1)), k.layer("soil"), gridpos(x, y), soil(state)]);
}

export function addFarmbot(id, farm_grid_index, x = 0, y = 0) {
  const object = k.add([
    "botact",
    k.pos(),
    k.sprite("robot"),
    k.anchor("bot"),
    k.z(),
    k.scale(),
    k.animate(),
    k.timer(),
    gridpos(x, y, CONFIG.FARM.tile_size / 2, CONFIG.FARM.tile_size / 2 - 15),
    gridmove(),
    ysort(),
    saytext(0, -70),
    popupicon(),
    effects(),
    displaytext(id, -64 / 2, -58, { size: 20, color: k.GREEN }),
    botact(id, farm_grid_index)]);
  robots.push(object);
  return object;
}

export function addCrop(farm_grid_index, type, x, y, state = CropStates.YOUNG) {
  // prettier-ignore
  return k.add([
    k.pos(),
    k.sprite(`${type}${state}`),
    k.anchor("bot"),
    k.z(),
    k.rotate(),
    k.animate(),
    k.timer(),
    k.scale(k.vec2(1)),
    k.opacity(1),
    effects(true),
    freshness(),
    gridpos(x, y, CONFIG.FARM.tile_size / 2, CONFIG.FARM.tile_size / 2),
    ysort(),
    popupicon(),
    dropOrbs(),
    crop(farm_grid_index, type, state),
  ]);
}

// Spawn outside of the farm
// If outside, go to the farm
// If inside the farm, lock it inside and various bug behaviours
export function bug(farm_grid_index) {
  return {
    id: "bug",
    require: ["gridpos", "gridmove", "sprite", "animate", "timer"],
    bug_damage: 10,
    bug_jump_duration: 0.5,
    bug_attack_timer: null,
    bug_move_timer: null,

    bugDestroy() {
      const tile = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
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
      this.wait(duration, () => {
        if (tile && tile.bug === this) {
          tile.bug = null;
          this.destroy();
        }
      });
    },

    add() {
      // 1. Spawn outside of the farm
      this.spawnOutside();

      // Register the bug in the grid immediately on spawn
      this.updateGridIndex(this.grid_x, this.grid_y);

      this.bug_attack_timer = k.loop(2.25, () => {
        const current_tile = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
        if (current_tile && current_tile.crop) {
          const crop = current_tile.crop;
          if (crop.crop_state === CropStates.HARVESTABLE) {
            const total_damage = this.bug_damage * crop.crop_resistance.bug;
            if (total_damage > 0) {
              triggerDidYouKnow("bug_damage");
              crop.showIcon(IconTypes.TEARS, 0.5);
              crop.damage(total_damage)
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

      this.bug_move_timer = k.loop(5, () => {
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
      // Clear current position from the grid index
      const current_tile = farm_grid_index.get(`${this.grid_y}-${this.grid_x}`);
      if (current_tile && current_tile.bug === this) {
        current_tile.bug = null;
      }

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

export function addBug(farm_grid_index) {
  triggerDidYouKnow("bugs");
  return k.add([k.pos(), k.sprite("bug"), k.z(0), k.scale(1, 1), k.animate(), k.timer(), k.anchor("bot"), ysort(), gridpos(null, null, CONFIG.FARM.tile_size / 2, CONFIG.FARM.tile_size + 15), gridmove(), bug(farm_grid_index)]);
}
