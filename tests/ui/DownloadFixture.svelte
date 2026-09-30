<script>
  import FinishDataPrompt from "../../src/components/FinishDataPrompt.svelte";
  let opened=$state(false), ready=$state(false), recovery=$state(false), fail=$state(false), count=$state(0);
  // Explicit upload modes use synthetic promises, never a research endpoint.
  const uploadMode=new URLSearchParams(location.search).get("upload");
  let sends=$state(0);
</script>
<h1>Data prompt test fixture — no research data</h1>
<button onclick={()=>{ready=false;recovery=false;opened=true;}}>Test not ready</button>
<button onclick={()=>{ready=true;recovery=false;fail=false;opened=true;}}>Test ready</button>
<button onclick={()=>{ready=false;recovery=true;fail=false;opened=true;}}>Test recovery</button>
<button onclick={()=>{ready=true;recovery=false;fail=true;opened=true;}}>Test download error</button>
<p>Test download requests: {count}</p>
<p>Test upload requests: {sends}</p>
{#if opened}<FinishDataPrompt check={()=>({ready,canDownload:recovery,message:ready ? "Your gameplay and challenge score are ready to download. Send the downloaded file to your researcher." : recovery ? "Your first opening ended without a score. Download your data for researcher review. Do not clear your data." : "Complete the tutorial, keep playing until Challenges unlocks, then submit a challenge program. A low score is okay!"})}
  download={async()=>{if(fail)throw Error("fixture failure");count++;}}
  upload={uploadMode ? async()=>{sends++;if(uploadMode==="pending")await new Promise(()=>{});await new Promise(r=>setTimeout(r,300));if(uploadMode==="fail" || (uploadMode==="retry" && sends===1))throw Error("fixture offline");} : null} onClose={()=>opened=false}/>{/if}
