import { robots } from "../components/global.svelte";
import { k, initKaplay } from "../lib/kaplay.js";
import { addFarmbot, addSoilToGrid } from "./components-kaplay/components.js";
import { lerpvec2 } from "./utils/math.js";
import { CAMERA, CONFIG, setGridOrigin, setCameraCenter } from "./global/global.js";

export const farm_grid_index = new Map();

let bg_land = null;
let bg_land_shadow = null

export function createLandBackground() {
  bg_land?.destroy();
  bg_land_shadow?.destroy();

  const farm = CONFIG.FARM;
  const new_height = farm.rows * farm.tile_size + (farm.rows - 1) * farm.gap
  const new_width = farm.columns * farm.tile_size + (farm.columns - 1) * farm.gap
  bg_land_shadow = k.add([
    k.pos(farm.grid_origin.x - 25, farm.grid_origin.y - 10),
    k.rect(new_width + 50, new_height + 50, { radius: 30 }),
    k.color("#896338"),
    k.anchor("topleft"),
    k.layer("land_bg"),
  ]);

  bg_land = k.add([
    k.pos(farm.grid_origin.x - 25, farm.grid_origin.y - 25),
    k.rect(new_width + 50, new_height + 50, { radius: 30 }),
    k.color(farm.bg_soil),
    k.anchor("topleft"),
    k.layer("land_bg"),
  ]);
}


export function game() {
  initKaplay();
  setGridOrigin(k, CONFIG.FARM);
  setCameraCenter(k, CAMERA);

  // Fonts
  k.loadFont("Quicksand", "/fonts/Quicksand.ttf");
  k.loadFont("Chintzy", "/fonts/chintzy.ttf");
  k.loadFont("Chintzys", "/fonts/chintzys.ttf");
  // Wheat
  k.loadSprite("wheat_young", "/sprites/wheat_young.png");
  k.loadSprite("wheat_growing", "/sprites/wheat_growing.png");
  k.loadSprite("wheat_harvestable", "/sprites/wheat_harvestable.png");
  k.loadSprite("wheat_dead", "/sprites/wheat_dead.png");
  // Corn
  k.loadSprite("corn_young", "/sprites/corn_young.png");
  k.loadSprite("corn_growing", "/sprites/corn_growing.png");
  k.loadSprite("corn_harvestable", "/sprites/corn_harvestable.png");
  k.loadSprite("corn_dead", "/sprites/corn_dead.png");
  // Tomato
  k.loadSprite("tomato_young", "/sprites/tomato_young.png");
  k.loadSprite("tomato_growing", "/sprites/tomato_growing.png");
  k.loadSprite("tomato_harvestable", "/sprites/tomato_harvestable.png");
  k.loadSprite("tomato_dead", "/sprites/tomato_dead.png");
  // Potato
  k.loadSprite("potato_young", "/sprites/potato_young.png");
  k.loadSprite("potato_growing", "/sprites/potato_growing.png");
  k.loadSprite("potato_harvestable", "/sprites/potato_harvestable.png");
  k.loadSprite("potato_dead", "/sprites/potato_dead.png");
  // Sugarcane
  k.loadSprite("sugarcane_young", "/sprites/sugarcane_young.png");
  k.loadSprite("sugarcane_growing", "/sprites/sugarcane_growing.png");
  k.loadSprite("sugarcane_harvestable", "/sprites/sugarcane_harvestable.png");
  k.loadSprite("sugarcane_dead", "/sprites/sugarcane_dead.png");
  // Rice
  k.loadSprite("rice_young", "/sprites/rice_young.png");
  k.loadSprite("rice_growing", "/sprites/rice_growing.png");
  k.loadSprite("rice_harvestable", "/sprites/rice_harvestable.png");
  k.loadSprite("rice_dead", "/sprites/rice_dead.png");

  k.loadSprite("robot", "/sprites/bot.png");
  k.loadSprite("soil", "/sprites/soil_tileset.png", { sliceX: 3, sliceY: 1 });

  // BG
  k.loadSprite("flowers_tile", "/sprites/tileset_flowers.png", { sliceX: 7, sliceY: 1 });
  k.loadSprite("grasses_tile", "/sprites/tileset_grass.png", { sliceX: 10, sliceY: 1 });

  // Icons Crop
  k.loadSprite("icon_corn", "/sprites/icon_corn.png");
  k.loadSprite("icon_wheat", "/sprites/icon_wheat.png");
  k.loadSprite("icon_tomato", "/sprites/icon_tomato.png");
  k.loadSprite("icon_sugarcane", "/sprites/icon_sugarcane.png");
  k.loadSprite("icon_potato", "/sprites/icon_potato.png");

  // Icons
  k.loadSprite("icon_coin", "/sprites/icon_coin.png");
  k.loadSprite("icon_angel", "/sprites/icon_angel.png");
  k.loadSprite("icon_droplet", "/sprites/icon_droplet.png");
  k.loadSprite("icon_hoe", "/sprites/icon_hoe.png");
  k.loadSprite("icon_mglass", "/sprites/icon_mglass.png");
  k.loadSprite("icon_seedpack", "/sprites/icon_seedpack.png");
  k.loadSprite("icon_timer", "/sprites/icon_timer.png");
  k.loadSprite("icon_spark", "/sprites/icon_spark.png");
  k.loadSprite("icon_tears", "/sprites/icon_tears.png");
  k.loadSprite("icon_sparkle", "/sprites/icon_sparkle.png");
  k.loadSprite("icon_fly", "/sprites/icon_fly.png");
  k.loadSprite("icon_poison1", "/sprites/icon_poison1.png");
  k.loadSprite("icon_poison2", "/sprites/icon_poison2.png");

  // Orbs
  k.loadSprite("coin", "/sprites/coin.png");
  k.loadSprite("exp", "/sprites/exp.png");

  // BG
  k.loadSprite("bg_grass", "/sprites/bg_grass.png");

  // Events
  k.loadSprite("bug", "/sprites/bug_purple.png");

  // Effect
  k.loadSprite("effect_large", "/sprites/effect_large.png");
  k.loadSprite("effect_medium", "/sprites/effect_medium.png");

  // Sounds
  k.loadSound("bot_act", "/sounds/sound_bot_act.wav");
  k.loadSound("bot_jump", "/sounds/sound_bot_jump.wav");
  k.loadSound("plant", "/sounds/sound_plant.mp3");
  k.loadSound("bot_till", "/sounds/sound_bot_till.mp3");
  k.loadSound("bot_water", "/sounds/sound_bot_water.mp3");
  k.loadSound("bot_kill", "/sounds/sound_bot_kill.mp3");
  k.loadSound("collect", "/sounds/sound_collect.mp3");

  // UI Sounds
  // k.loadSound("ui_hover", "/sounds/sound_ui_hover.mp3");
  // k.loadSound("ui_click", "/sounds/sound_ui_click.mp3");

  k.setLayers(["grass_bg", "land_bg", "soil", "entities"], "entities");

  k.scene("farm", () => {
    const farm = CONFIG.FARM;

    // Grass background
    k.setBackground(farm.bg_grass);
    k.add([k.pos(k.center()), k.sprite("bg_grass"), k.anchor("center"), k.layer("grass_bg")]);
    createLandBackground()

    // Add tiles first, also add bots property
    for (let i = 0; i < farm.rows; i++) {
      for (let j = 0; j < farm.columns; j++) {
        const soil = addSoilToGrid(j, i);
        farm_grid_index.set(`${i}-${j}`, { soil, bots: [] });
      }
    }
    // Then add the bots
    addFarmbot(robots.length, farm_grid_index, 0, 0);

    let cam_accelerate = 1
    const keys = {};

    window.addEventListener("keydown", (e) => {
      if (!k.isFocused()) return;
      keys[e.key.toLowerCase()] = true;
      cam_accelerate += 0.2
      if (e.key === "Shift") cam_accelerate *= 2
      cam_accelerate = Math.min(cam_accelerate, 10)
    });

    window.addEventListener("keyup", (e) => {
      keys[e.key.toLowerCase()] = false;
      if (!keys.a && !keys.d && !keys.w && !keys.s) cam_accelerate = 1
    });

    window.addEventListener("blur", () => {
      Object.keys(keys).forEach(k => keys[k] = false);
      if (!keys.a && !keys.d && !keys.w && !keys.s) cam_accelerate = 1
    });

    k.onMousePress(() => {
      printFarmGridIndex()
    })

    k.onUpdate(() => {
      // console.log("-------------")
      // farm_grid_index.get(`0-0`).bots.forEach((bot) => console.log("Bots in 0-0: ", bot.bot_index))

      const new_cam_pos = k.vec2(CAMERA.x, CAMERA.y)
      if (keys.a) new_cam_pos.x -= 1 * cam_accelerate
      if (keys.d) new_cam_pos.x += 1 * cam_accelerate
      if (keys.w) new_cam_pos.y -= 1 * cam_accelerate
      if (keys.s) new_cam_pos.y += 1 * cam_accelerate

      CAMERA.x = new_cam_pos.x
      CAMERA.y = new_cam_pos.y
      k.setCamPos(new_cam_pos)
    })
  });

  k.go("farm");
}

export function printFarmGridIndex() {
  const farm = CONFIG.FARM
  console.log("-------------------")
  for (let y = 0; y < farm.rows; y++) {
    for (let x = 0; x < farm.columns; x++) {
      const bots = farm_grid_index.get(`${y}-${x}`)?.bots
      if (bots) console.log(`${y}-${x}: `, ...bots.map((bot) => bot.bot_index), `Length: ${bots.length}`)
    }
  }
}