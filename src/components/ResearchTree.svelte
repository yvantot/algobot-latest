<script>
 import {QUEST_STATE,currentQuest} from "./global.svelte.js";
 import {QUEST_DATA} from "../game/global/quests.js";
 import {learningProgress} from "../game/global/learning-progress.js";
 let {onClose,onPractice,onReference,onPreview}=$props();
 const active=$derived(currentQuest());
 const skills=$derived(learningProgress(QUEST_STATE,active));
 const completed=$derived(skills.filter(skill=>skill.completed===skill.quests.length).length);
</script>
<section class="learning" aria-label="Learning Progress">
 <header><img src="/sprites/bot_teacher.png" alt="Bot Teacher"/><div><h1>Learning Progress</h1><p>{completed} of {skills.length} skill groups practiced</p></div><button class="close" aria-label="Close learning progress" onclick={onClose}>✕</button></header>
 <p>See what you have practiced through missions and what to try next.</p>
 {#if active}<section class="next"><h2>Practice next</h2><strong>{QUEST_DATA[active].title}</strong><p>{QUEST_DATA[active].description}</p><button class="primary" onclick={onPractice}>Open current mission</button></section>{/if}
 <div class="skills">{#each skills as skill}<article class:current={skill.current}>
 <div class="title"><h2>{skill.title}</h2><span>{skill.completed===skill.quests.length?"Practiced":skill.current?"Now practicing":skill.completed?"In progress":"Coming up"}</span></div>
 <p>{skill.text}</p><progress max={skill.quests.length} value={skill.completed} aria-label={skill.title+" missions completed"}></progress><small>{skill.completed} / {skill.quests.length} missions completed</small>
 <div class="actions"><button onclick={()=>onReference(skill.command)}>View commands</button>{#if skill.example}<button onclick={()=>onPreview(skill.example)}>Watch example</button>{/if}</div>
 </article>{/each}</div>
 <p class="note">Progress comes from completed missions. Keep practicing these ideas in your own programs.</p>
</section>
<style>
.learning{width:400px;max-width:calc(100vw - 24px);height:90vh;background:#f3f4f6;border:4px solid #64748b;border-radius:12px;padding:14px;color:#334155;display:flex;flex-direction:column;gap:12px;font-size:15px}header{display:flex;gap:12px;align-items:center;border-bottom:2px solid #94a3b8;padding-bottom:10px}header .close{margin-left:auto}header img{width:48px;image-rendering:pixelated}h1{font-size:20px;font-weight:bold}h2{font-size:16px;font-weight:bold}p{line-height:1.45;margin:4px 0}.skills{overflow:auto;min-height:0;flex:1}article,.next{border:2px solid #cbd5e1;border-radius:8px;background:white;padding:12px;margin-bottom:10px}.next,.current{border-color:#4ade80;background:#f0fdf4}.title{display:flex;gap:8px;justify-content:space-between;align-items:center}.title span,small,.note{font-size:13px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}button{font:inherit;padding:8px;border:2px solid #94a3b8;border-radius:6px;background:#e5e7eb;cursor:pointer;font-weight:bold}button.primary{background:#bbf7d0}button:focus-visible{outline:3px solid #16a34a;outline-offset:2px}progress{display:block;width:100%;height:10px;margin:8px 0;accent-color:#16a34a}
</style>
