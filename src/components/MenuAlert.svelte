<script>
  let { label = "New menu available" } = $props();
</script>
<img class="menu-alert" src="/sprites/icon_alert.png" alt={label} width="22" height="36" />
<style>
  .menu-alert{position:absolute;top:-6px;right:-4px;width:22px;height:36px;max-width:none;transform:none;filter:none;animation:none;pointer-events:none}
</style>
