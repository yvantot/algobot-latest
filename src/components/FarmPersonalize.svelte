<script>
  import { PLAYER_DATA } from "../game/global/global.js";
  import { AvatarTypes, ModalTypes } from "../game/global/enum.js";
  import { Personalize, Modals } from "./global.svelte.js";

  let selected_avatar = Personalize.AVATAR;
  let new_name = Personalize.FARM_NAME;

  function handleConfirm() {
    Personalize.AVATAR = selected_avatar;
    Personalize.FARM_NAME = new_name;
    Modals[ModalTypes.FARM_PERSONALIZE] = false;
  }
  function handleExit() {
    Modals[ModalTypes.FARM_PERSONALIZE] = false;
  }
</script>

{#if Modals[ModalTypes.FARM_PERSONALIZE]}
  <div class="z-50 fixed inset-0 backdrop-blur-sm flex justify-center items-center">
    <div class="enter-anim relative w-[33vw] h-fit bg-[#ab7440] text-sm rounded-lg border-3 border-[#5f4124] outline-3 outline-[#ffd6af] select-none shadow-lg">
      <button onclick={handleExit} class="absolute right-2 top-0 font-bold text-base">(X)</button>
      <div class="p-4 w-full h-full border-b-3 border-[#815831]">
        <h1 class="text-base font-bold text-center">Personalize</h1>
        <p class="text-xs font-bold text-center mb-4">Customize your farm</p>

        <div class="flex flex-col gap-2 p-2 border-b-4 border-[#815831] bg-[#c5864b] rounded-lg mb-2">
          <p class=" text-sm font-bold">Select Avatar Profile</p>
          <div class="flex gap-2">
            {#each Object.keys(AvatarTypes) as avatar}
              <button class:outline-4={selected_avatar === AvatarTypes[avatar]} onclick={() => (selected_avatar = AvatarTypes[avatar])} class="flex justify-center items-center p-2 border-lg cursor-pointer bg-[#824117] rounded-lg border-t-3 border-[#603514] outline-[#ffd6af] group flex-grow">
                <img src={AvatarTypes[avatar]} alt="Avatar" class="w-12 h-12 object-contain" />
              </button>
            {/each}
          </div>
        </div>
        <div class="flex flex-col gap-2 p-2 border-b-4 border-[#815831] bg-[#c5864b] rounded-lg mb-4">
          <p class=" text-sm font-bold">Change Farm Name</p>
          <input bind:value={new_name} class="outline-0 border-t-2 border-[#815831] text-slate-700 bg-slate-100 rounded p-1 px-2" placeholder="How about Vegetable Land?" type="text" />
        </div>

        <button class="text-sm ml-auto block p-2 border-b-4 border-[#815831] bg-[#c5864b] rounded-lg font-bold outline-3 outline-[#ffd6af] hover:rotate-3 transition-transform" onclick={handleConfirm}>Confirm Changes</button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes scaleup {
    0% {
      transform: scale(0, 0);
    }
    100% {
      transform: scale(1, 1);
    }
  }
  .enter-anim {
    animation: scaleup 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
</style>
