<script>
  let { tier } = $props();
</script>

<span class="tier" data-tier={tier}>{tier}</span>

<style>
  .tier{display:inline-block;font-family:Quicksand,sans-serif;font-size:13px;line-height:1.4;font-weight:800;padding:4px 8px;border:2px solid #15803d;border-radius:4px;background:#dcfce7;color:#14532d}
  .tier[data-tier="Skilled"]{background:#fef08a;border-color:#a16207;color:#713f12}
  .tier[data-tier="Advanced"]{background:#fee2e2;border-color:#dc2626;color:#991b1b}
  .tier[data-tier="Expert"]{background:#171717;border-color:#525252;color:#fff}
</style>
