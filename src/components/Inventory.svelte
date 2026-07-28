<script>
  import { CropTypes } from "../game/global/enum.js";
  import { INVENTORY } from "../game/global/global.js";
</script>

<div>
  <div class="text-slate-100 select-none pointer-events-none">
    <div class="flex flex-col gap-0">
      <div class="flex items-center relative text-sm bg-transparent w-fit p-1">
        <p
          class="-z-10 font-bold left-6 w-20 text-right absolute bg-none backdrop-blur-lg backdrop-brightness-75 rounded-lg p-2 shadow"
          id="coin"
        >
          {INVENTORY.coins}
        </p>
        <img
          id="coin-icon"
          class="z-10 p-1 rounded-lg bg-none backdrop-blur-lg backdrop-brightness-75"
          alt="gold coin icon"
          src="/sprites/icon_coin.png"
        />
      </div>
      <div class="flex items-center relative text-sm w-fit rounded-lg p-1">
        <p
          class="-z-10 font-bold left-6 w-20 text-right absolute bg-none backdrop-blur-lg backdrop-brightness-75 rounded-lg p-2 shadow"
          id="wheat"
        >
          {INVENTORY.crops.wheat}
        </p>
        <img
          class="z-10 p-1 rounded-lg bg-none backdrop-blur-lg backdrop-brightness-75"
          alt="wheat crop icon"
          src="/sprites/icon_wheat.png"
        />
      </div>
      <div class="flex items-center relative text-sm w-fit rounded-lg p-1">
        <p
          class="-z-10 font-bold left-6 w-20 text-right absolute bg-none backdrop-blur-lg backdrop-brightness-75 rounded-lg p-2 shadow"
          id="corn"
        >
          {INVENTORY.crops.corn}
        </p>
        <img
          class="z-10 p-1 rounded-lg bg-none backdrop-blur-lg backdrop-brightness-75"
          alt="corn crop icon"
          src="/sprites/icon_corn.png"
        />
      </div>
      <div class="flex items-center relative text-sm w-fit rounded-lg p-1">
        <p
          class="-z-10 font-bold left-6 w-20 text-right absolute bg-none backdrop-blur-lg backdrop-brightness-75 rounded-lg p-2 shadow"
          id="rice"
        >
          {INVENTORY.crops.rice}
        </p>
        <img
          class="z-10 p-1 rounded-lg bg-none backdrop-blur-lg backdrop-brightness-75"
          alt="rice crop icon"
          src="/sprites/icon_rice.png"
        />
      </div>
      <div class="flex items-center relative text-sm w-fit rounded-lg p-1">
        <p
          class="-z-10 font-bold left-6 w-20 text-right absolute bg-none backdrop-blur-lg backdrop-brightness-75 rounded-lg p-2 shadow"
          id="sugarcane"
        >
          {INVENTORY.crops.sugarcane}
        </p>
        <img
          class="z-10 p-1 rounded-lg bg-none backdrop-blur-lg backdrop-brightness-75"
          alt="sugarcane crop icon"
          src="/sprites/icon_sugarcane.png"
        />
      </div>
      <div class="flex items-center relative text-sm w-fit rounded-lg p-1">
        <p
          class="-z-10 font-bold left-6 w-20 text-right absolute bg-none backdrop-blur-lg backdrop-brightness-75 rounded-lg p-2 shadow"
          id="potato"
        >
          {INVENTORY.crops.potato}
        </p>
        <img
          class="z-10 p-1 rounded-lg bg-none backdrop-blur-lg backdrop-brightness-75"
          alt="potato crop icon"
          src="/sprites/icon_potato.png"
        />
      </div>
      <div class="flex items-center relative text-sm w-fit rounded-lg p-1">
        <p
          class="-z-10 font-bold left-6 w-20 text-right absolute bg-none backdrop-blur-lg backdrop-brightness-75 rounded-lg p-2 shadow"
          id="tomato"
        >
          {INVENTORY.crops.tomato}
        </p>
        <img
          class="z-10 p-1 rounded-lg bg-none backdrop-blur-lg backdrop-brightness-75"
          alt="tomato crop icon"
          src="/sprites/icon_tomato.png"
        />
      </div>
    </div>
  </div>
</div>

<style>
  img {
    pointer-events: none;
    user-select: none;
    object-fit: contain;
    height: 40px;
    width: 40px;
  }
</style>
