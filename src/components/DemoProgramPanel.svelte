<script>
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import DemonstrationBlocks from "./DemonstrationBlocks.svelte";
  let { program, line=-1, index=0, count=1, reduced=false, dynamicGrid=false, working=false }=$props();
  let x=$state(0), y=$state(72), width=$state(260), mounted=$state(false), leaving=$state(false);
  let drag, sizing;
  let height=$state(330);
  function resizeStart(e){if(e.button!==0)return;sizing={x:e.clientX,y:e.clientY,width,height};e.currentTarget.setPointerCapture(e.pointerId);}
  function resizeMove(e){if(!sizing)return;width=Math.max(200,Math.min(window.innerWidth-x-8,sizing.width+e.clientX-sizing.x));height=Math.max(190,Math.min(window.innerHeight-y-8,sizing.height+e.clientY-sizing.y));}
  function resizeKey(e){const dx={ArrowLeft:-20,ArrowRight:20}[e.key]??0,dy={ArrowUp:-20,ArrowDown:20}[e.key]??0;if(dx||dy){e.preventDefault();width=Math.max(200,Math.min(window.innerWidth-x-8,width+dx));height=Math.max(190,Math.min(window.innerHeight-y-8,height+dy));}}
  function clampPosition(nextX,nextY) {
    x=Math.max(8,Math.min(window.innerWidth-width-8,nextX));
    y=Math.max(56,Math.min(window.innerHeight-90,nextY));
  }
  onMount(()=>{
    width=window.innerWidth<900?200:260;
    const halfFarm=count>2?185:125;
    clampPosition(window.innerWidth/2+(index%2?halfFarm+16:-halfFarm-width-16),72+Math.floor(index/2)*280);
    height=count>2?250:330;
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

<aside class:leaving class="clay-menu clay-shell program" style:left="{x}px" style:top="{y}px" style:width="{width}px" style:height="{height}px" style:visibility={mounted?"visible":"hidden"}
  onoutrostart={()=>leaving=true} in:fly={{x:-20,duration:reduced?0:350,easing:cubicOut}} out:fly={{x:-20,duration:reduced?0:220,easing:cubicOut}}>
  <button class="handle" aria-label="Move Bot {program.bot} program; drag or use arrow keys" onpointerdown={start} onpointermove={move} onpointerup={()=>drag=null} onpointercancel={()=>drag=null} onkeydown={keyboard}>Robot program · Bot {program.bot}<span aria-hidden="true">⠿</span></button>
  <p>{program.role ?? "Follow the highlighted block"}</p>
  <div class="workspace">
    <DemonstrationBlocks code={program.code} {line} repeat={program.repeat??0} checkHarvest={program.checkHarvest??false} {dynamicGrid} {working} fit/>
  </div>
  <button class="resize-corner" aria-label="Resize Bot {program.bot} program" onpointerdown={resizeStart} onpointermove={resizeMove} onpointerup={()=>sizing=null} onpointercancel={()=>sizing=null} onkeydown={resizeKey}>↘</button>
</aside>

<style>
  .program{display:flex;flex-direction:column;position:absolute;background:#f3f4f6;border:3px solid #64748b;border-radius:10px;overflow:clip;box-shadow:0 5px 15px #0002;pointer-events:auto}
  .handle{display:flex;justify-content:space-between;align-items:center;width:100%;font:inherit;font-size:16px;font-weight:bold;padding:10px;background:#e5e7eb;color:#334155;border:0;border-bottom:2px solid #94a3b8;cursor:grab;touch-action:none}.handle:active{cursor:grabbing}.handle:focus-visible{outline:3px solid #16a34a;outline-offset:-3px}p{margin:7px 10px;font-size:14px}.workspace{flex:1;min-height:0}.workspace :global(.blocks){height:100%}.resize-corner{position:absolute;right:0;bottom:0;border:0;border-radius:4px;background:#e5e7eb;color:#334155;font-size:20px;cursor:nwse-resize;touch-action:none;width:26px;height:26px}.leaving :global(.blocklyScrollbarVertical),.leaving :global(.blocklyScrollbarHorizontal){visibility:hidden}
</style>
