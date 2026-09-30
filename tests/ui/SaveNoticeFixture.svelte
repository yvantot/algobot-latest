<script>
  import { onMount } from "svelte";
  import SaveNotice from "../../src/components/SaveNotice.svelte";
  let status = $state({ phase: "saved", savedAt: 1, notice: "", error: null });
  onMount(() => {
    const timer = setInterval(() => status.savedAt++, 2000);
    return () => clearInterval(timer);
  });
</script>
<main><h1>Save notification verification</h1>
  <button onclick={() => { status.phase = "error"; status.error = { message: "Storage could not save. Your last saved farm is safe." }; }}>Fail save</button>
  <button onclick={() => status.notice = "Activity was not saved. Try accepting the challenge again."}>Activity notice</button>
</main>
<SaveNotice {status} onRetry={() => { status.phase = "saved"; status.error = null; }} onLeave={() => {}} onDismiss={() => status.notice = ""}/>
