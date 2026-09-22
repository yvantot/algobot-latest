<script>
  import { onMount } from "svelte";
  import { k } from "../lib/kaplay.js";
  import { farm_grid_index } from "../game/game.js";
  import { currentQuest, ONBOARDING, robots } from "./global.svelte.js";
  import { CONFIG } from "../game/global/global.js";
  onMount(() => {
    const drawing = k.add([k.pos(0, 0), k.layer("entities"), k.z(100000), { draw() {
      const quest = currentQuest();
      if (ONBOARDING.isModalOpen || !["intro_run", "intro_build", "tut_2", "intro_loop"].includes(quest)) return;
      const robot = robots[0];
      if (!robot) return;
      const x = quest === "intro_run" ? 1 : robot.grid_x;
      const y = quest === "intro_run" ? 0 : robot.grid_y;
      const tile = farm_grid_index.get(`${y}-${x}`);
      if (!tile?.soil) return;
      k.drawRect({ pos: tile.soil.pos, width: CONFIG.FARM.tile_size, height: CONFIG.FARM.tile_size,
        anchor: "center", fill: false, outline: { width: 3, color: k.rgb(255, 230, 120) }, radius: 5 });
    } }]);
    return () => drawing.destroy();
  });
</script>
