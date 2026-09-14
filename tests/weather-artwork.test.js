import test from "node:test";
import assert from "node:assert/strict";
import { createWeatherArtworkResolver, getWeatherArtwork, WEATHER_SPRITE_NAMES } from "../src/game/events/artwork.js";

test("all weather sprites have self-contained SVG placeholders when original PNGs are absent", () => {
  const artwork = createWeatherArtworkResolver();
  assert.equal(WEATHER_SPRITE_NAMES.length, 7);
  for (const name of WEATHER_SPRITE_NAMES) {
    assert.equal(artwork.isPlaceholder(name), true);
    const url = artwork.get(name);
    assert.match(url, /^data:image\/svg\+xml;charset=utf-8,/);
    const source = decodeURIComponent(url.slice(url.indexOf(",") + 1));
    assert.match(source, /<svg .*viewBox=/);
    assert.match(source, /<path /);
    assert.doesNotMatch(source, /href=|<script|<image/);
    assert.equal(typeof getWeatherArtwork(name), "string", "plain Node imports must remain usable");
  }
});

test("supplied PNGs override placeholders and public sprites take priority over other asset folders", () => {
  const artwork = createWeatherArtworkResolver({
    "/assets/weather/icon_cloud.png": "/assets/cloud-hashed.png",
    "/public/sprites/icon_cloud.png": "/sprites/icon_cloud.png",
    "/src/assets/fire/icon_fire_2.png": "/assets/fire-hashed.png",
    "/public/assets/icon_smoke_0.png": "/assets/icon_smoke_0.png",
    "/public/sprites/icon_irrelevant.png": "/sprites/icon_irrelevant.png",
  });
  assert.equal(artwork.get("icon_cloud"), "/sprites/icon_cloud.png");
  assert.equal(artwork.get("icon_fire_2"), "/assets/fire-hashed.png");
  assert.equal(artwork.get("icon_smoke_0"), "/assets/icon_smoke_0.png");
  assert.equal(artwork.isPlaceholder("icon_fire_2"), false);
  assert.equal(artwork.isPlaceholder("icon_raindrop"), true);
  assert.throws(() => artwork.get("icon_missing"), /Unknown weather sprite/);
});
