<script>
	import { QUEST_DATA } from "../game/global/quests.js";
	import { QUEST_STATE, claimQuest } from "./global.svelte.js";

	let { onOpenQuestMenu, onOpenBlockEditor } = $props();

	let expanded = $state({});

	function toggleExpand(key, e, isCurrentlyExpanded) {
		e.stopPropagation();
		expanded[key] = !isCurrentlyExpanded;
	}

	function getActiveQuests() {
		return Object.entries(QUEST_DATA)
			.filter(([key, data]) => {
				const state = QUEST_STATE[key];
				if (!state || state.is_completed || state.is_claimed) return false;
				if (data.prereq && data.prereq.length > 0) {
					for (const req of data.prereq) {
						if (!QUEST_STATE[req] || !QUEST_STATE[req].is_claimed) return false;
					}
				}
				return true;
			})
			.slice(0, 3);
	}

	function getCompletedQuests() {
		return Object.entries(QUEST_DATA).filter(([key, data]) => {
			const state = QUEST_STATE[key];
			return state && state.is_completed && !state.is_claimed;
		});
	}
</script>

<div class="flex flex-col gap-2 w-[300px]">
	<!-- Completed Quests Popup List -->
	{#each getCompletedQuests() as [key, data], index (key)}
		{@const isExpanded = expanded[key] ?? index === 0}
		<div
			role="button"
			tabindex="0"
			class="completed-card animate-bounce-short relative overflow-hidden cursor-pointer"
			onclick={() => onOpenQuestMenu?.()}
			onkeydown={(e) => e.key === "Enter" && onOpenQuestMenu?.()}
		>
			<div class="absolute inset-0 bg-amber-200 opacity-25 pulse-bg pointer-events-none"></div>

			<div class="flex justify-between items-center mb-1">
				<h4 class="font-bold text-amber-900 text-xs uppercase tracking-wide">Quest Completed</h4>
				<button type="button" class="toggle-btn" onclick={(e) => toggleExpand(key, e, isExpanded)}>
					{isExpanded ? "▲" : "▼"}
				</button>
			</div>

			<p class="text-xs text-slate-800 font-bold mb-2 font-mono">
				{data.title}
			</p>

			{#if isExpanded}
				<p class="text-[11px] text-slate-700 mb-2 italic border-t border-amber-300 pt-1">
					{data.description}
				</p>
			{/if}

			<!-- Reward Badges -->
			<div class="flex flex-wrap gap-1 mb-2">
				{#if data.rewards?.exp}
					<span class="reward-badge bg-emerald-200 text-emerald-950 border border-emerald-500">+{data.rewards.exp} EXP</span>
				{/if}
				{#if data.rewards?.coins}
					<span class="reward-badge bg-amber-200 text-amber-950 border border-amber-500">+{data.rewards.coins} Coins</span>
				{/if}
				{#if data.rewards?.unlocks}
					{#each data.rewards.unlocks as unlock}
						<span class="reward-badge bg-indigo-200 text-indigo-950 border border-indigo-500 font-mono">{unlock}</span>
					{/each}
				{/if}
			</div>

			<button
				type="button"
				class="claim-btn"
				onclick={(e) => {
					e.stopPropagation();
					claimQuest(key);
				}}
			>
				Claim Reward
			</button>
		</div>
	{/each}

	<!-- Active Quests HUD -->
	<div
		role="button"
		tabindex="0"
		class="quests-panel focus-glow cursor-pointer"
		onclick={() => onOpenQuestMenu?.()}
		onkeydown={(e) => e.key === "Enter" && onOpenQuestMenu?.()}
	>
		<div class="flex justify-between items-center border-b-2 border-emerald-600/40 pb-1.5 mb-2">
			<div>
				<h3 class="text-xs font-black uppercase text-emerald-900 tracking-wider">Active Quests</h3>
				<p class="text-[10px] text-emerald-700 font-medium">Primary Goal Focus</p>
			</div>
			<span class="text-[10px] text-slate-500 font-semibold bg-white/80 px-2 py-0.5 rounded border border-slate-300">View All</span>
		</div>

		<div class="flex flex-col gap-3">
			{#each getActiveQuests() as [key, data], index}
				{@const state = QUEST_STATE[key]}
				{@const isExpanded = expanded[key] ?? index === 0}
				<div class="text-xs flex flex-col gap-1.5 border-b-2 border-slate-200 pb-2 last:border-0 last:pb-0">
					<div class="flex justify-between items-center">
						<span class="font-bold text-slate-900 flex-1 font-mono text-xs">{data.title}</span>
						<div class="flex items-center gap-1">
							<span class="text-[11px] text-emerald-800 font-black">{state ? state.progress : 0}/{data.goal}</span>
							<button type="button" class="toggle-btn" onclick={(e) => toggleExpand(key, e, isExpanded)}>
								{isExpanded ? "▲" : "▼"}
							</button>
						</div>
					</div>

					{#if isExpanded}
						<p class="text-[11px] text-slate-600 leading-snug">
							{data.description}
						</p>
						{#if data.tip}
							<div class="bg-amber-100/90 border-2 border-amber-400 rounded-lg p-2 text-xs text-amber-950 my-0.5 flex flex-col gap-0.5">
								<span class="font-bold text-[10px] uppercase text-amber-800">Tip</span>
								<span class="leading-tight">{data.tip}</span>
							</div>
						{/if}
						<div class="flex flex-wrap gap-1 mt-0.5 text-xs">
							{#if data.rewards?.exp}
								<span class="reward-badge bg-emerald-200 text-emerald-950 border border-emerald-400 mb-1">+{data.rewards.exp} EXP</span>
							{/if}
							{#if data.rewards?.coins}
								<span class="reward-badge bg-amber-200 text-amber-950 border border-amber-400 mb-1">+{data.rewards.coins} Coins</span>
							{/if}
							{#if data.rewards?.unlocks}
								<div class="w-full flex flex-wrap gap-1 items-center mt-1">
									<span class="font-bold text-[10px] text-slate-600 uppercase">Unlocks</span>
									{#each data.rewards.unlocks as unlock}
										<span class="reward-badge bg-indigo-200 text-indigo-950 border border-indigo-400 font-mono text-[10px] mb-1">{unlock}</span>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Progress Bar -->
					<div class="w-full bg-slate-300 rounded-full h-2 overflow-hidden border border-slate-400/50">
						<div class="bg-gradient-to-r from-emerald-500 to-green-400 h-2 rounded-full transition-all duration-300" style="width: {state ? Math.min((state.progress / data.goal) * 100, 100) : 0}%"></div>
					</div>
				</div>
			{:else}
				<p class="text-xs text-slate-500 italic text-center py-2">No active quests.</p>
			{/each}
		</div>

		<!-- Open Block Command Editor Button -->
		<button
			type="button"
			class="editor-btn mt-2"
			onclick={(e) => {
				e.stopPropagation();
				onOpenBlockEditor?.();
			}}
		>
			Open Block Command Editor
		</button>
	</div>
</div>

<style>
	.quests-panel {
		background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
		border: 3px solid #10b981;
		border-radius: 0.85rem;
		padding: 0.85rem;
		box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
		color: #1e293b;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.focus-glow {
		animation: eye-catch-pulse 2.5s infinite ease-in-out;
	}

	@keyframes eye-catch-pulse {
		0%, 100% {
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6), 0 10px 25px -5px rgba(16, 185, 129, 0.25);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(16, 185, 129, 0), 0 12px 30px -3px rgba(16, 185, 129, 0.45);
		}
	}

	.completed-card {
		background: linear-gradient(135deg, #fefce8 0%, #fef08a 100%);
		border: 3px solid #ca8a04;
		border-radius: 0.85rem;
		padding: 0.85rem;
		box-shadow: 0 10px 20px -3px rgba(202, 138, 4, 0.3);
		color: #1e293b;
	}

	.reward-badge {
		padding: 2px 7px;
		border-radius: 0.375rem;
		font-weight: 800;
		font-size: 10px;
	}

	.claim-btn {
		width: 100%;
		background-color: #16a34a;
		color: white;
		font-weight: 800;
		padding: 6px 10px;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
		cursor: pointer;
		transition: background-color 0.15s;
		border: none;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}
	.claim-btn:hover {
		background-color: #15803d;
	}

	.editor-btn {
		width: 100%;
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
		color: white;
		font-weight: 800;
		padding: 5px 8px;
		border-radius: 0.5rem;
		font-size: 0.7rem;
		box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
		cursor: pointer;
		transition: all 0.15s ease-in-out;
		border: none;
		text-align: center;
	}
	.editor-btn:hover {
		background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
		transform: translateY(-1px);
	}

	.toggle-btn {
		color: #475569;
		font-size: 10px;
		padding: 0 4px;
		font-weight: 800;
		background: none;
		border: none;
		cursor: pointer;
		transition: color 0.15s;
	}
	.toggle-btn:hover {
		color: #0f172a;
	}

	@keyframes bounce-short {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-4px);
		}
	}
	.animate-bounce-short {
		animation: bounce-short 0.6s ease-in-out;
	}

	@keyframes pulse {
		0% {
			opacity: 0.15;
		}
		50% {
			opacity: 0.35;
		}
		100% {
			opacity: 0.15;
		}
	}
	.pulse-bg {
		animation: pulse 2s infinite;
	}
</style>
