<script>
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import DemonstrationBlocks from "./DemonstrationBlocks.svelte";
  let { program, line=-1, index=0, count=1, reduced=false, dynamicGrid=false }=$props();
  let x=$state(0), y=$state(72), width=$state(260), mounted=$state(false), leaving=$state(false);
  let drag;
  function clampPosition(nextX,nextY) {
    x=Math.max(8,Math.min(window.innerWidth-width-8,nextX));
    y=Math.max(56,Math.min(window.innerHeight-90,nextY));
  }
  onMount(()=>{
    width=window.innerWidth<900?200:260;
    const halfFarm=count>2?185:125;
    clampPosition(window.innerWidth/2+(index%2?halfFarm+16:-halfFarm-width-16),72+Math.floor(index/2)*280);
    mounted=true;
  });
  function start(event) {
    if(event.button!==0)return;
    drag={x:event.clientX,y:event.clientY,left:x,top:y};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event) { if(drag)clampPosition(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y); }
  function keyboard(event) {
    const delta={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[event.key];
    if(delta){event.preventDefault();clampPosition(x+delta[0],y+delta[1]);}
  }
</script>

<aside class:leaving class="program" style:left="{x}px" style:top="{y}px" style:width="{width}px" style:visibility={mounted?"visible":"hidden"}
  onoutrostart={()=>leaving=true} in:fly={{x:-20,duration:reduced?0:350,easing:cubicOut}} out:fly={{x:-20,duration:reduced?0:220,easing:cubicOut}}>
  <button class="handle" aria-label="Move Bot {program.bot} program; drag or use arrow keys" onpointerdown={start} onpointermove={move} onpointerup={()=>drag=null} onpointercancel={()=>drag=null} onkeydown={keyboard}>Robot program · Bot {program.bot}<span aria-hidden="true">⠿</span></button>
  <p>{program.role ?? "Follow the highlighted block"}</p>
  <div class:compact={count>2}>
    <DemonstrationBlocks code={program.code} {line} repeat={program.repeat??0} checkHarvest={program.checkHarvest??false} {dynamicGrid}/>
  </div>
</aside>

<style>
  .program{position:absolute;background:#f3f4f6;border:3px solid #64748b;border-radius:10px;overflow:clip;box-shadow:0 5px 15px #0002;pointer-events:auto}
  .handle{display:flex;justify-content:space-between;align-items:center;width:100%;font:inherit;font-size:16px;font-weight:bold;padding:10px;background:#e5e7eb;color:#334155;border:0;border-bottom:2px solid #94a3b8;cursor:grab;touch-action:none}.handle:active{cursor:grabbing}.handle:focus-visible{outline:3px solid #16a34a;outline-offset:-3px}p{margin:7px 10px;font-size:14px}.compact :global(.blocks){height:140px}.leaving :global(.blocklyScrollbarVertical),.leaving :global(.blocklyScrollbarHorizontal){visibility:hidden}
</style>
