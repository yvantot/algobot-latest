<script>
import { onMount } from "svelte";
import { game } from "../../src/game/game.js";
import QuestFeedback from "../../src/components/QuestFeedback.svelte";
import QuestHUD from "../../src/components/QuestHUD.svelte";
import UnlockFlyOverlay from "../../src/components/UnlockFlyOverlay.svelte";
import { QUEST_FEEDBACK, QUEST_STATE, triggerUnlockFly } from "../../src/components/global.svelte.js";
import { createTransientNotice } from "../../src/components/transient-notice.js";
let notice = $state("");
const transient = createTransientNotice(value => notice = value);
onMount(() => { game(); return () => transient.dispose(); });
let count = 0;
function reward(milestone) {
 QUEST_FEEDBACK.queue.push({ key: `fixture-${count++}`, title: "Your first harvest", milestone, rewards: {coins:25,exp:10,unlocks:["for","while"]} });
 triggerUnlockFly(["for","while"]);
 QUEST_STATE.intro_run.is_completed = true; QUEST_STATE.intro_run.is_claimed = true;
}
</script>
<div style="position:relative;z-index:1000000;display:flex;gap:12px;background:white;padding:10px">
<button onclick={() => reward(false)}>Ordinary reward</button>
<button onclick={() => reward(true)}>Milestone reward</button>
<button onclick={() => QUEST_FEEDBACK.hazardsPending = true}>Farm ready</button>
<button onclick={() => transient.update("Challenge active")}>Challenge notice</button>
<button id="command-menu-button">Command target</button>
<img id="coin-icon" src="/sprites/icon_coin.png" alt="coin" width="24"/>
<span id="player-info">Experience</span>
</div>
<p style="position:relative;z-index:100000">{notice}</p>
<div style="position:relative;width:300px;z-index:100"><QuestHUD/></div>
<QuestFeedback/><UnlockFlyOverlay/>
