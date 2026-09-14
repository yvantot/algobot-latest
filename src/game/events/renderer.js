import { k } from "../../lib/kaplay.js";
import { CONFIG } from "../global/global.js";
import { FarmEventSimulation, farmTiles } from "./simulation.js";

const runtimes = new WeakMap();
const configuration = new WeakMap();

export function configureFarmEvents(grid, { shouldRun = () => true } = {}) {
  configuration.set(grid, { shouldRun });
}

function tileCenter(grid, key) {
  const soil = grid.get(key)?.soil;
  if (!soil) return null;
  const pos = soil.gridAxisToWorld();
  return { x: pos.x + CONFIG.FARM.tile_size / 2, y: pos.y + CONFIG.FARM.tile_size / 2 };
}

/** Visual objects are owned by one scene object; no global loops or wall timers. */
class FarmEventRenderer {
  constructor(owner, simulation) {
    this.owner = owner;
    this.simulation = simulation;
    this.fireViews = new Map();
    this.cloudViews = new Map();
    this.dropViews = new Map();
    this.smoke = new Set();
    this.disposed = false;
  }

  sprite(name, width, pos, anchor = "center") {
    return this.owner.add([
      k.pos(pos.x, pos.y), k.sprite(name, { width }), k.anchor(anchor),
      k.scale(1), k.opacity(1), k.z(pos.y),
    ]);
  }

  addSmoke(fire) {
    if (this.disposed || this.simulation.disposed) return;
    const center = tileCenter(this.simulation.grid, fire.key);
    if (!center) return;
    const view = this.sprite(`icon_smoke_${fire.id % 2}`, 24, { x: center.x, y: center.y - 30 });
    view.z = center.y + 50;
    this.smoke.add({ view, age: 0, center, drift: fire.id % 2 ? 10 : -10 });
  }

  syncRemoved(views, states) {
    for (const [id, entry] of views) {
      if (states.has(id)) continue;
      entry.view.destroy();
      views.delete(id);
    }
  }

  update(dt) {
    if (this.disposed) return;
    const simulation = this.simulation;
    this.syncRemoved(this.fireViews, simulation.fires);
    this.syncRemoved(this.cloudViews, simulation.clouds);
    this.syncRemoved(this.dropViews, simulation.drops);

    for (const [key, fire] of simulation.fires) {
      const center = tileCenter(simulation.grid, key);
      if (!center) continue;
      let entry = this.fireViews.get(key);
      if (entry && entry.fire !== fire) {
        entry.view.destroy();
        entry = null;
      }
      if (!entry) {
        const view = this.sprite(`icon_fire_${fire.stage}`, 24 + fire.stage * 12, center, "bot");
        view.onDestroy(() => fire.extinguish("visual_destroyed"));
        entry = { fire, view, stage: fire.stage, smokeClock: 0 };
        this.fireViews.set(key, entry);
      }
      const { view } = entry;
      if (entry.stage !== fire.stage) {
        view.use(k.sprite(`icon_fire_${fire.stage}`, { width: 24 + fire.stage * 12 }));
        entry.stage = fire.stage;
      }
      view.pos = k.vec2(center.x, center.y + 8);
      view.z = center.y + 25;
      const flicker = Math.sin(fire.age * 17 + fire.id) * 0.07;
      view.scale = k.vec2(1 + flicker, 1 - flicker);
      entry.smokeClock += dt;
      if (entry.smokeClock >= 0.65) {
        entry.smokeClock = 0;
        this.addSmoke(fire);
      }
    }

    const centers = simulation.clouds.size
      ? farmTiles(simulation.grid).map(([key]) => tileCenter(simulation.grid, key))
      : [];
    const left = Math.min(...centers.map(pos => pos.x)) - 180;
    const right = Math.max(...centers.map(pos => pos.x)) + 180;
    for (const [id, cloud] of simulation.clouds) {
      const center = tileCenter(simulation.grid, cloud.key);
      if (!center) continue;
      let entry = this.cloudViews.get(id);
      if (!entry) {
        const view = this.sprite("icon_cloud", 76, { x: center.x, y: center.y - 100 });
        view.onDestroy(() => simulation.removeCloud(cloud));
        entry = { view };
        this.cloudViews.set(id, entry);
      }
      const outside = cloud.side < 0 ? left : right;
      let x = center.x;
      if (cloud.phase === "entering") x = outside + (center.x - outside) * cloud.progress;
      if (cloud.phase === "leaving") x = center.x + (outside - center.x) * cloud.progress;
      entry.view.pos = k.vec2(x, center.y - 100);
      entry.view.z = center.y + 200;
    }

    for (const [id, drop] of simulation.drops) {
      const center = tileCenter(simulation.grid, drop.key);
      if (!center) continue;
      let entry = this.dropViews.get(id);
      if (!entry) {
        const view = this.sprite("icon_raindrop", 12, center);
        view.onDestroy(() => simulation.removeDrop(drop));
        entry = { view };
        this.dropViews.set(id, entry);
      }
      const offset = ((drop.id % 3) - 1) * 12;
      entry.view.pos = k.vec2(center.x + offset, center.y - 85 + 85 * drop.progress);
      entry.view.z = center.y + 150;
    }

    for (const particle of this.smoke) {
      particle.age += dt;
      if (particle.age >= 1.2 || !particle.view.exists()) {
        particle.view.destroy();
        this.smoke.delete(particle);
        continue;
      }
      const progress = particle.age / 1.2;
      particle.view.pos = k.vec2(particle.center.x + particle.drift * progress, particle.center.y - 30 - 40 * progress);
      particle.view.opacity = (1 - progress) * 0.65;
      particle.view.scale = k.vec2(0.7 + progress * 0.6);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const views of [this.fireViews, this.cloudViews, this.dropViews]) {
      for (const { view } of views.values()) view.destroy();
      views.clear();
    }
    for (const { view } of this.smoke) view.destroy();
    this.smoke.clear();
  }
}

export function getFarmEventRuntime(grid) {
  const existing = runtimes.get(grid);
  if (existing && existing.owner.exists()) return existing;
  let renderer;
  const simulation = new FarmEventSimulation(grid, {
    onFireRemoved: fire => renderer?.addSmoke(fire),
  });
  const owner = k.add([
    k.pos(0, 0), k.z(100000),
    {
      id: "farm_events",
      update() {
        if (typeof document !== "undefined" && document.hidden) return;
        if (configuration.get(grid)?.shouldRun() === false) return;
        const dt = k.dt();
        if (dt <= 0) return;
        simulation.update(dt);
        renderer.update(dt);
      },
      destroy() {
        simulation.dispose();
        renderer?.dispose();
        if (runtimes.get(grid)?.simulation === simulation) runtimes.delete(grid);
      },
    },
  ]);
  renderer = new FarmEventRenderer(owner, simulation);
  const runtime = { owner, simulation, renderer };
  runtimes.set(grid, runtime);
  return runtime;
}

export function destroyFarmEvents(grid) {
  runtimes.get(grid)?.owner.destroy();
}
