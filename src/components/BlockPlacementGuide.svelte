<script>
  import { onMount } from "svelte";
  import * as Blockly from "blockly";
  import "blockly/blocks";
  let { mission } = $props();
  let host, connected = $state(false);
  let nested = $derived(mission === "intro_loop" || mission === "cs_if_0");
  onMount(() => {
    const workspace = Blockly.inject(host, { readOnly: true, renderer: "zelos", scrollbars: false, sounds: false, zoom: { startScale: 1, maxScale: 1, minScale: .4 } });
    const append = state => Blockly.serialization.blocks.append(state, workspace);
    const number = n => ({ shadow: { type: "math_number", fields: { NUM: n } } });
    let parent, child, socket;
    if (mission === "intro_loop") {
      parent = append({ type: "controls_repeat_ext", x: 16, y: 16, inputs: { TIMES: number(2) } });
      child = append({ type: "bot_left", x: 90, y: 130, next: { block: { type: "bot_right" } } });
      socket = parent.getInput("DO").connection;
    } else if (mission === "cs_if_0") {
      parent = append({ type: "controls_if", x: 16, y: 16, inputs: { IF0: { block: { type: "bot_is_harvestable" } } } });
      child = append({ type: "bot_harvest", x: 90, y: 130 });
      socket = parent.getInput("DO0").connection;
    } else if (mission === "intro_sequence") {
      parent = append({ type: "bot_left", x: 16, y: 16 });
      child = append({ type: "bot_right", x: 90, y: 125 });
      socket = parent.nextConnection;
    } else {
      const type = { intro_run: "bot_right", intro_build: "bot_down", intro_say: "bot_say", tut_2: "bot_till" }[mission] ?? "bot_say";
      append({ type, x: 16, y: 16, ...(type === "bot_say" ? { inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "Hello!" } } } } } : {}) });
    }
    const observer = new ResizeObserver(() => { Blockly.svgResize(workspace); workspace.zoomToFit(); });
    observer.observe(host);
    let frame;
    const timer = setTimeout(() => {
      if (!socket || !child) return;
      const origin = child.getRelativeToSurfaceXY();
      const parentPosition = parent.getRelativeToSurfaceXY();
      const destination = socket.getOffsetInBlock();
      const childOffset = child.previousConnection.getOffsetInBlock();
      const dx = parentPosition.x + destination.x - childOffset.x - origin.x;
      const dy = parentPosition.y + destination.y - childOffset.y - origin.y;
      const start = performance.now();
      const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1600;
      let last = 0;
      function move(now) {
        const progress = duration ? Math.min(1, (now - start) / duration) : 1;
        const eased = 1 - Math.pow(1 - progress, 3);
        child.moveBy(dx * (eased - last), dy * (eased - last)); last = eased;
        if (progress < 1) frame = requestAnimationFrame(move);
        else { socket.connect(child.previousConnection); connected = true; workspace.zoomToFit(); }
      }
      frame = requestAnimationFrame(move);
    }, 900);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); observer.disconnect(); workspace.dispose(); };
  });
</script>

<div class="example">
  <strong>{nested ? (connected ? "Inside! Now this action belongs to the block." : "Watch: put the action INSIDE the open space.") : "Snap blocks together, then press Start."}</strong>
  <div class="blocks" bind:this={host} aria-label="Animated example of connecting blocks"></div>
  <p>Try it in your own blocks. This example does not run your bot.</p>
</div>

<style>
  .example{background:white;border:2px solid #94a3b8;border-radius:8px;padding:8px;margin-top:8px;color:#334155}strong,p{font-size:14px;line-height:1.4}.blocks{height:210px;width:100%;overflow:hidden}p{margin:6px 0}
</style>
