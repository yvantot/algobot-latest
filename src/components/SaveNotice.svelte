<script>
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";

  let { status, onRetry, onLeave, onDismiss } = $props();
  let showSaved = $state(true), recovering = $state(false), timer;
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const failed = $derived(status.phase === "error");
  const visible = $derived(failed || !!status.notice || showSaved);
  function brieflyShowSaved() {
    clearTimeout(timer);
    showSaved = true;
    timer = setTimeout(() => showSaved = false, 3500);
  }
  onMount(() => { brieflyShowSaved(); return () => clearTimeout(timer); });
  $effect(() => {
    if (failed) recovering = true;
    else if (status.phase === "saved" && recovering) {
      recovering = false;
      brieflyShowSaved();
    }
  });
</script>

{#if visible}
  <aside class="save-notice" role="status" aria-live="polite" aria-label="Farm save status"
    transition:fly={{ x: reduced ? 0 : 12, duration: reduced ? 0 : 180 }}>
    <strong>{failed ? "Could not save" : status.notice ? "Farm notice" : status.phase === "saving" ? "Saving…" : "Farm saved"}</strong>
    {#if failed}<p>{status.error?.message}</p>{/if}
    {#if status.notice && status.notice !== status.error?.message}<p>{status.notice}</p>{/if}
    {#if failed || status.notice}
      <div class="actions">
        {#if failed}
          <button onclick={onRetry}>Retry save</button>
          <button onclick={onLeave}>Leave without saving</button>
        {/if}
        {#if status.notice}<button onclick={() => { showSaved = false; onDismiss(); }}>Dismiss</button>{/if}
      </div>
    {/if}
  </aside>
{/if}

<style>
  .save-notice{position:fixed;right:12px;bottom:12px;z-index:10001;box-sizing:border-box;width:max-content;max-width:min(360px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;padding:12px 14px;background:#ab7440;color:#fff;border:2px solid #f2e0cf;border-bottom:5px solid #7c552f;border-radius:8px;font-family:Quicksand,sans-serif;font-size:14px;line-height:1.5;overflow-wrap:anywhere}
  strong{font-size:15px;color:#17100a}p{margin:6px 0 0;color:#17100a;font-weight:600}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}button{font:inherit;font-weight:700;color:#334155;background:#f2e0cf;border:2px solid #7c552f;border-radius:6px;padding:8px 10px;min-height:44px;cursor:pointer}button:hover{background:#fff7ed}button:focus-visible{outline:3px solid #17100a;outline-offset:2px}
</style>
