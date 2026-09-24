export function isolateScene(engine) {
  const originals = engine.get().map(object => ({ object, hidden: object.hidden, paused: object.paused }));
  const camera = engine.getCamPos(), zoom = engine.getCamScale(), speed = engine.debug.timeScale;
  for (const { object } of originals) {
    if (object.sceneryBackground) continue;
    object.paused = true;
    if (object.layer !== "grass_bg") object.hidden = true;
  }
  engine.debug.timeScale = 1;
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const { object, hidden, paused } of originals) if (object.exists()) {
      object.hidden = hidden; object.paused = paused;
    }
    engine.debug.timeScale = speed;
    engine.setCamPos(camera); engine.setCamScale(zoom);
  };
}
