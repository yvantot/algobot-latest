<script>
  import { onMount } from "svelte";
  import * as Blockly from "blockly";
  import "blockly/blocks";
  let { mission, example } = $props();
  let host, connected = $state(false);
  let nested = $derived(["intro_loop","cs_if_0","cs_cleanup_0"].includes(mission));
  onMount(() => {
    const workspace = Blockly.inject(host, { readOnly: true, renderer: "zelos", scrollbars: false, sounds: false, zoom: { startScale: 1, maxScale: 1, minScale: .4 } });
    const append = state => Blockly.serialization.blocks.append(state, workspace);
    const parent = append({...example.block,x:16,y:16});
    const input = ["DO", "DO0", "TEXT"].map(name=>parent.getInput(name)?.connection).find(connection=>connection?.targetBlock());
    const socket = input ?? parent.nextConnection;
    const target = socket?.targetBlock();
    const child = target && !target.isShadow() ? target : null;
    const childConnection = child?.previousConnection ?? child?.outputConnection;
    if (child && childConnection) { socket.disconnect(); child.moveBy(85,105); }
    const observer = new ResizeObserver(() => { Blockly.svgResize(workspace); workspace.zoomToFit(); });
    observer.observe(host);
    let frame;
    const timer = setTimeout(() => {
      if (!socket || !child) return;
      const origin = child.getRelativeToSurfaceXY();
      const parentPosition = parent.getRelativeToSurfaceXY();
      const destination = socket.getOffsetInBlock();
      const childOffset = childConnection.getOffsetInBlock();
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
        else { socket.connect(childConnection); connected = true; workspace.zoomToFit(); }
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
