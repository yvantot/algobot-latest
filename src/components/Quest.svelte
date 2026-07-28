<script>
	import { QUEST_DATA, QuestTypes } from "../game/global/quests.js";
	import { QUEST_STATE, claimQuest } from "./global.svelte.js";
	import { toTitleCase } from "../game/utils/string.js";
	import { createResizable } from "./interface.svelte.js";

	const resize = createResizable();
	let filter = $state("all");

	function getQuests() {
		return Object.entries(QUEST_DATA).filter(([key, data]) => {
			if (filter !== "all" && data.type !== filter) return false;
			return true;
		});
	}

	function getStatus(key) {
		const state = QUEST_STATE[key];
		if (!state) return "locked";
		if (state.is_claimed) return "claimed";
		if (state.is_completed) return "completed";
		
		// Check prereqs
		if (QUEST_DATA[key].prereq && QUEST_DATA[key].prereq.length > 0) {
			for (const req of QUEST_DATA[key].prereq) {
				if (!QUEST_STATE[req] || !QUEST_STATE[req].is_claimed) return "locked";
			}
		}
		return "active";
	}
</script>

<div style="width: {resize.width}px;" class="flex flex-col gap-2 h-[95vh] bg-gray-100 text-sm p-3 rounded-xl shadow-xl overflow-hidden text-slate-700 border-4 border-slate-500">
	<div role="separator" class="resize-handle {resize.is_resizing ? 'resizing-active' : ''}" onmousedown={resize.startResize}></div>
	<div>
		<h1 class="font-bold text-base text-center">Quests</h1>
		<p class="text-xs text-center px-2">Complete objectives to earn coins, EXP, and unlock new code features!</p>
	</div>

	<!-- Category Filters -->
	<div class="flex flex-wrap gap-1 justify-center text-xs">
		<button class="rounded-lg p-1 px-3 bg-gray-300 font-semibold cursor-pointer" class:bg-green-300={filter === 'all'} onclick={() => filter = 'all'}>All</button>
		<button class="rounded-lg p-1 px-3 bg-gray-300 font-semibold cursor-pointer" class:bg-green-300={filter === QuestTypes.TUTORIAL} onclick={() => filter = QuestTypes.TUTORIAL}>Tutorial</button>
		<button class="rounded-lg p-1 px-3 bg-gray-300 font-semibold cursor-pointer" class:bg-green-300={filter === QuestTypes.CROP} onclick={() => filter = QuestTypes.CROP}>Crops</button>
		<button class="rounded-lg p-1 px-3 bg-gray-300 font-semibold cursor-pointer" class:bg-green-300={filter === QuestTypes.CS_CONCEPT} onclick={() => filter = QuestTypes.CS_CONCEPT}>Concepts</button>
	</div>

	<!-- Quest List -->
	<div class="flex flex-col gap-2 flex-grow overflow-y-scroll h-[85vh] p-1 text-xs">
		{#each getQuests() as [key, data]}
			{@const status = getStatus(key)}
			{@const state = QUEST_STATE[key]}
			{#if status !== "locked"}
				<div class="flex flex-col border-2 rounded-lg p-3 gap-2 shadow-sm transition-all {status === 'claimed' ? 'bg-slate-200/80 border-slate-300 opacity-60' : status === 'completed' ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-400'}">
					<div class="flex justify-between items-center">
						<h3 class="font-bold text-sm text-slate-800">{data.title}</h3>
						<span class="font-bold p-1 px-2 text-[10px] bg-[#262b36] text-white rounded uppercase">{data.type}</span>
					</div>
					
					<p class="text-slate-600">{data.description}</p>
					
					{#if data.tip}
						<div class="bg-blue-50 border border-blue-300 rounded p-2 text-[11px] text-blue-900 flex gap-1.5 items-start">
							<span class="font-bold shrink-0">💡 Tip:</span>
							<span>{data.tip}</span>
						</div>
					{/if}
					
					<!-- Progress bar -->
					<div class="flex flex-col gap-1">
						<div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-300">
							<div class="bg-green-500 h-2 rounded-full transition-all duration-300" style="width: {state ? Math.min((state.progress / data.goal) * 100, 100) : 0}%"></div>
						</div>
						<div class="text-right text-[11px] text-slate-500 font-bold">
							{state ? state.progress : 0} / {data.goal}
						</div>
					</div>
					
					<!-- Rewards and Claim -->
					<div class="flex flex-wrap justify-between items-center gap-2 pt-1 border-t border-slate-200">
						<div class="flex flex-wrap gap-1 items-center">
							{#if data.rewards?.exp}
								<span class="text-[11px] bg-green-100 text-green-800 px-2 py-0.5 rounded border border-green-300 font-semibold">+{data.rewards.exp} EXP</span>
							{/if}
							{#if data.rewards?.coins}
								<span class="text-[11px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-300 font-semibold">+{data.rewards.coins} Coins</span>
							{/if}
							{#if data.rewards?.unlocks}
								<span class="text-[11px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-300 font-semibold">Unlocks: {data.rewards.unlocks.join(', ')}</span>
							{/if}
						</div>
						
						{#if status === "completed"}
							<button class="bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-3 rounded shadow transition-colors text-xs cursor-pointer" onclick={() => claimQuest(key)}>Claim</button>
						{:else if status === "claimed"}
							<span class="text-xs text-slate-400 font-bold italic">Claimed</span>
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</div>
</div>
