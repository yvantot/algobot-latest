<script>
  import { PLAYER_DATA } from "../game/global/global.js";
  import { ModalTypes } from "../game/global/enum.js";
  import { onMount } from "svelte";
  import { CLAIMED_REWARDS, Personalize, Modals } from "./global.svelte.js";

  onMount(() => {
    PLAYER_DATA.updateUI();
  });

  let has_reward = $state(false);
  let poll = $state(0);

  setInterval(() => (poll = poll + (1 % 10)), 500);

  $effect(() => {
    // I'm so ashamed with this, but let's do this for now. My goal is to finish my thesis...
    void poll;
    for (let i = 1; i <= PLAYER_DATA.getLevel(); i++) {
      if (CLAIMED_REWARDS[i] == null) {
        has_reward = true;
        return;
      }
    }
    has_reward = false;
  });

  function toggleModal(modal) {
    for (const v in ModalTypes) {
      Modals[v] = false;
    }

    switch (modal) {
      case ModalTypes.FARM_PERSONALIZE: {
        Modals[ModalTypes.FARM_PERSONALIZE] = true;
        break;
      }
      case ModalTypes.LEVEL_REWARDS: {
        Modals[ModalTypes.LEVEL_REWARDS] = true;
        break;
      }
    }
  }
</script>

<div id="player-info" class="inline-flex items-center text-slate-700 select-none w-[290px]">
  <!-- Avatar Frame -->
  <div
    onclick={(e) => {
      e.stopPropagation();
      toggleModal(ModalTypes.FARM_PERSONALIZE);
    }}
    role="button"
    tabindex="0"
    onkeydown={(e) => void e}
    class="clickable group avatar-frame relative w-18 h-18 flex items-center justify-center -rotate-4 z-10"
  >
    <img src={Personalize.AVATAR} alt="Avatar" class="avatar w-10 h-10 object-contain" />
    <img src="/sprites/ui_player_info/change_icon.png" alt="Change property" class="object-fill group-hover:scale-75 scale-0 absolute -right-3 -top-3 transition-transform" />
  </div>
  <div class="top-[-2.5px] absolute ui_outline w-[267px] h-[82px]"></div>

  <!-- Exp & Name -->
  <div
    onclick={(e) => {
      toggleModal(ModalTypes.LEVEL_REWARDS);
    }}
    role="button"
    tabindex="0"
    onkeydown={(e) => void e}
    class="clickable frame-container left-14 absolute flex flex-col gap-[5px] h-14 w-52"
  >
    <div class="flex flex-col justify-start items-center relative pt-1 px-5">
      {#if has_reward}
        <img src="/sprites/icon_gift.png" class="enter-anim absolute top-[-5px] right-[-35px] w-14 h-14" alt="Gift" />
      {/if}
      <span id="player-level" class="text-sm font-bold whitespace-nowrap text-slate-100">0</span>
      <div class="exp_bar w-full flex-1 overflow-hidden">
        <div id="progress-level" class="exp_progress m-1 h-2 transition-[width] duration-500" style="width: 0px"></div>
      </div>
    </div>

    <button
      onclick={(e) => {
        if (e.target !== e.currentTarget) return;
        e.stopPropagation();
        toggleModal(ModalTypes.FARM_PERSONALIZE);
      }}
      class="clickable absolute left-[30px] right-0 bottom-[-12px] -rotate-1 block name-frame w-[145px] p-1 px-2 text-xs font-bold whitespace-nowrap text-slate-100 text-center group"
    >
      {Personalize.FARM_NAME}
      <img src="/sprites/ui_player_info/change_icon.png" alt="Change property" class="object-fill group-hover:scale-75 scale-0 absolute -right-4 -top-4 transition-transform" />
    </button>
  </div>
</div>

<style>
  .avatar {
    transition: transform 0.3s ease-in-out;
  }
  .clickable {
    cursor: pointer;
  }
  .exp_bar {
    background-image: url("/sprites/ui_player_info/exp_bar.png");
    background-size: 100% 100%;
  }
  .exp_progress {
    background-image: url("/sprites/ui_player_info/exp_progress.png");
    background-size: 100% 100%;
  }
  .ui_outline {
    background-image: url("/sprites/ui_player_info/ui_outline.png");
    background-size: 100% 100%;
  }
  .name-frame {
    background-image: url("/sprites/ui_player_info/name_frame.png");
    background-size: 100% 100%;
  }
  .avatar-frame {
    background-image: url("/sprites/ui_player_info/avatar_frame.png");
    background-size: 100% 100%;
  }
  .frame-container {
    background-image: url("/sprites/ui_player_info/ui_frame.png");
    background-size: 100% 100%;
  }

  @keyframes subtle-rotate {
    from {
      transform: rotate(-5deg);
    }
    to {
      transform: rotate(5deg);
    }
  }

  @keyframes scaleup {
    0% {
      transform: scale(0, 0);
    }
    100% {
      transform: scale(1, 1);
    }
  }

  .enter-anim {
    animation:
      scaleup 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
      subtle-rotate 0.3s ease-in-out infinite alternate;
  }
</style>
