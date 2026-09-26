<script>
  import { onMount } from "svelte";
  import { fly, fade } from "svelte/transition";
  let { check, download, onClose } = $props();
  const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let status = $state(null), error = $state(""), busy = $state(false), downloaded = $state(false), panel;
  function refresh() {
    try { status = check(); error = ""; }
    catch { status = {ready:false,message:"We could not check your data. Keep this page open and tell your researcher."}; }
  }
  onMount(() => {
    const previous = document.activeElement;
    refresh(); panel.focus();
    return () => previous?.focus?.();
  });
  async function save() {
    refresh();
    if (!status?.ready || busy) return;
    busy = true;
    try { await download(); downloaded = true; }
    catch { error = "The download could not start. Please try again. Your data has not been cleared."; }
    finally { busy = false; }
  }
  function keys(event) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }
    if (event.key !== "Tab") return;
    const buttons = [...panel.querySelectorAll("button:not(:disabled)")];
    if (!buttons.length) { event.preventDefault(); return; }
    if (event.shiftKey && [panel,buttons[0]].includes(document.activeElement)) { event.preventDefault(); buttons.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
  }
</script>

<div class="backdrop" transition:fade={{duration:reducedMotion?0:150}}>
  <div class="panel" role="dialog" aria-modal="true" aria-labelledby="finish-title" aria-describedby="finish-status" tabindex="-1" bind:this={panel} onkeydown={keys} transition:fly={{y:18,duration:reducedMotion?0:220}}>
    <h2 id="finish-title">{downloaded ? "Check your downloads" : status?.ready ? "Your data is ready" : "Not ready yet"}</h2>
    <p id="finish-status">{downloaded ? "The download was requested. Check that the JSON file is saved, then send it to your researcher. Your data has not been cleared." : status?.message ?? "Checking your data…"}</p>
    {#if error}<p role="alert">{error}</p>{/if}
    <div class="actions">
      <button disabled={busy} onclick={onClose}>{downloaded ? "Close" : "Keep playing"}</button>
      {#if status?.ready}<button class="download" disabled={busy} onclick={save}>{busy ? "Preparing…" : downloaded ? "Download again" : "Download data"}</button>{/if}
    </div>
  </div>
</div>

<style>
  .backdrop{position:fixed;inset:0;z-index:11000;background:#0006;display:grid;place-items:center;padding:16px}
  .panel{width:min(440px,100%);box-sizing:border-box;background:#f3f4f6;color:#334155;border:4px solid #64748b;border-radius:12px;padding:24px;box-shadow:0 8px 24px #0003}
  h2{font-size:22px;font-weight:800;margin:0 0 14px}p{font-size:17px;line-height:1.5;margin:0 0 20px}.actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap}
  button{font:inherit;font-weight:700;font-size:16px;border:2px solid #64748b;background:#e5e7eb;border-radius:7px;padding:10px 14px;cursor:pointer}.download{background:#bbf7d0;color:#14532d}button:disabled{opacity:.6;cursor:wait}button:focus-visible{outline:3px solid #15803d;outline-offset:3px}[role=alert]{color:#991b1b}
</style>
