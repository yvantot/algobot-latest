<script>
  let {task, collected=false}=$props();
</script>
<div class="rewards" aria-label={collected ? "Rewards collected" : "Challenge rewards"}>
  <div><img src="/sprites/icon_coin.png" alt=""/><span><strong>{collected?"+":""}{task.coins}</strong> coins</span></div>
  <div><img src="/sprites/exp.png" alt=""/><span><strong>{collected?"+":""}{task.exp}</strong> EXP</span></div>
  <div><img src="/sprites/icon_wheat.png" alt=""/><span><strong>{collected?"+":""}{task.seeds}</strong> wheat seeds</span></div>
</div>
<style>
 .rewards{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}.rewards>div{flex:1 1 95px;display:flex;align-items:center;gap:8px;padding:12px 10px;border:2px solid #d6b56c;border-radius:8px;background:#fff8df;color:#334155}.rewards img{width:28px;height:32px;object-fit:contain;image-rendering:pixelated;flex-shrink:0}.rewards span{font-size:14px;line-height:1.4}.rewards strong{display:block;font-size:19px}
</style>
