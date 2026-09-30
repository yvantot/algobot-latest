export const snapZoom = value => Math.max(0.5, Math.min(1.5, Math.round(value * 10) / 10));

export function clampFarmCamera(camera, farm) {
  const margin = farm.cell_size;
  camera.x = Math.max(farm.grid_origin.x - margin, Math.min(farm.grid_origin.x + farm.columns * farm.cell_size + margin, camera.x));
  camera.y = Math.max(farm.grid_origin.y - margin, Math.min(farm.grid_origin.y + farm.rows * farm.cell_size + margin, camera.y));
  return camera;
}

export function attachCameraControls({ canvas, engine, camera, enabled, getZoom, setZoom, getFarm, doc = document, win = window }) {
  let drag = null;
  const previousCursor = canvas.style.cursor;
  const previousTouch = canvas.style.touchAction;
  canvas.style.cursor = "grab";
  canvas.style.touchAction = "none";
  const clear = () => { drag = null; canvas.style.cursor = previousCursor || "grab"; };
  function down(event) {
    if (!enabled() || event.target !== canvas || ![0,1].includes(event.button) || event.isPrimary === false) return;
    drag = { id:event.pointerId, x:event.clientX, y:event.clientY, started:false };
  }
  function move(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (!enabled() || !event.buttons || doc.elementFromPoint(event.clientX,event.clientY) !== canvas) { clear(); return; }
    const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
    if (!drag.started && Math.hypot(dx,dy)<6) return;
    drag.started = true;
    const rect = canvas.getBoundingClientRect();
    camera.x -= dx * engine.width()/rect.width/getZoom();
    camera.y -= dy * engine.height()/rect.height/getZoom();
    if (getFarm) clampFarmCamera(camera, getFarm());
    engine.setCamPos(engine.vec2(camera.x,camera.y));
    drag.x=event.clientX; drag.y=event.clientY;
    canvas.style.cursor="grabbing"; event.preventDefault();
  }
  function wheel(event) {
    if (!enabled() || event.target !== canvas || event.ctrlKey || drag) return;
    event.preventDefault();
    const rect=canvas.getBoundingClientRect();
    const point=engine.vec2((event.clientX-rect.left)*engine.width()/rect.width,(event.clientY-rect.top)*engine.height()/rect.height);
    const oldZoom=getZoom();
    if (!event.deltaY) return;
    const zoom=snapZoom(oldZoom - Math.sign(event.deltaY) * .1);
    setZoom(zoom); engine.setCamScale(zoom);
    camera.x+=(point.x-engine.width()/2)*(1/oldZoom-1/zoom);
    camera.y+=(point.y-engine.height()/2)*(1/oldZoom-1/zoom);
    if (getFarm) clampFarmCamera(camera, getFarm());
    engine.setCamPos(engine.vec2(camera.x,camera.y));
  }
  canvas.addEventListener("pointerdown",down);
  win.addEventListener("pointermove",move,{passive:false});
  win.addEventListener("pointerup",clear); win.addEventListener("pointercancel",clear); win.addEventListener("blur",clear);
  canvas.addEventListener("wheel",wheel,{passive:false});
  return () => {
    clear(); canvas.style.cursor=previousCursor; canvas.style.touchAction=previousTouch;
    canvas.removeEventListener("pointerdown",down); canvas.removeEventListener("wheel",wheel);
    win.removeEventListener("pointermove",move); win.removeEventListener("pointerup",clear);
    win.removeEventListener("pointercancel",clear); win.removeEventListener("blur",clear);
  };
}
