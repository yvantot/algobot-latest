import { k } from "../../lib/kaplay.js";
import { CONFIG } from "../global/global.js";

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
    say_objects: new Set(),

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
      this.say_objects.add(text);
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
        this.say_objects.delete(text);
        text.destroy();
      });
    },

    destroy() {
      for (const object of this.say_objects) object.destroy();
      this.say_objects.clear();
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
            easing: k.easings.easeInOutSine,
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
        const particleDuration = duration ?? 1;
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
            duration: particleDuration,
            loops: 1,
            easing: k.easings.easeInOutSine,
          })
          sparkles.animate("pos", [sparkles.pos, k.vec2(sparkles.pos.x, sparkles.pos.y - 25)], {
            duration: particleDuration,
            loops: 1,
            easing: k.easings.easeInOutExpo,
          })
          sparkles.animate("opacity", [0.5, 1, 0], {
            duration: particleDuration,
            loops: 1,
            easing: k.easings.easeInOutSine,
          });

          sparkles.wait(Math.max(0, particleDuration - 0.1), () => {
            sparkles.destroy()
          })
        }

        const timing = duration ? [0.5, 1, 0] : [0.5, 1];
        this.effect.animate("opacity", timing, {
          duration: particleDuration,
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

    destroy() {
      this.icon?.destroy();
      this.icon = null;
    },

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
