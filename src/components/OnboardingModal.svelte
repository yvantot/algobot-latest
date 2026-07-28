<script>
  import { onMount } from "svelte";

  let { isOpen = $bindable(false), onClose } = $props();

  let currentSlide = $state(0);
  let dontShowAgain = $state(false);

  const SLIDES = [
    {
      title: "Welcome to AlgoBot!",
      subtitle: "An Algorithmic Farming Edutainment System",
      description:
        "Learn fundamental programming concepts by coding autonomous robots to manage, plant, water, and harvest your farm!",
      image: "/sprites/art_intro_0.png",
      fallbackText: "Introduction",
      highlights: [
        "Write real code (or use drag-and-drop blocks)",
        "Automate tasks across your entire farm grid",
        "Master loops, conditions, and variables",
      ],
    },
    {
      title: "The Farming Lifecycle",
      subtitle: "Till -> Plant -> Water -> Harvest",
      description:
        "Every crop needs proper care to grow successfully. Follow the essential farming steps:",
      image: "/sprites/art_intro_1.png",
      fallbackText: "Farming Cycle",
      highlights: [
        "Till soil first using bot.till()",
        'Plant seeds with bot.plant("wheat")',
        "Water soil with bot.water() to start growth",
        "Harvest mature crops with bot.harvest() for Coins & EXP",
      ],
    },
    {
      title: "Quests & Algorithmic Automation",
      subtitle: "Complete Quests to Unlock Power-Ups",
      description:
        "Expand your programming toolkit as you complete quest milestones and build an automated farming empire!",
      image: "/sprites/art_intro_2.png",
      fallbackText: "Automation & Quests",
      highlights: [
        "Unlock loops (for, while) to automate repetitive rows",
        "Use conditional statements (if, else) to react to crop states",
        "Unlock higher-tier crops & extra helper robots in the Shop",
      ],
    },
  ];

  onMount(() => {
    const hidden = localStorage.getItem("algobot_hide_onboarding") === "true";
    dontShowAgain = hidden;
  });

  function nextSlide() {
    if (currentSlide < SLIDES.length - 1) {
      currentSlide++;
    } else {
      handleClose();
    }
  }

  function prevSlide() {
    if (currentSlide > 0) {
      currentSlide--;
    }
  }

  function handleClose() {
    if (dontShowAgain) {
      localStorage.setItem("algobot_hide_onboarding", "true");
    } else {
      localStorage.removeItem("algobot_hide_onboarding");
    }
    isOpen = false;
    if (onClose) onClose();
  }
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
  >
    <div
      class="relative w-full max-w-2xl bg-gray-100 text-slate-700 border-4 border-slate-500 rounded-xl shadow-2xl overflow-hidden flex flex-col"
    >
      <!-- Header -->
      <div
        class="flex justify-between items-center bg-gray-200 border-b-2 border-slate-400 px-4 py-2"
      >
        <h2 class="font-bold text-sm text-slate-800 uppercase tracking-wide">
          Tutorial & Onboarding ({currentSlide + 1} / {SLIDES.length})
        </h2>
        <button
          onclick={handleClose}
          class="text-slate-500 hover:text-slate-800 text-lg font-bold px-2 py-0.5 rounded cursor-pointer"
          >✕</button
        >
      </div>

      <!-- Slide Content -->
      <div class="p-6 flex flex-col gap-4 min-h-[360px] justify-between">
        <!-- Title & Subtitle -->
        <div class="text-center space-y-1">
          <h3
            class="text-xl font-extrabold text-slate-800"
            style="font-family: 'Quicksand', sans-serif"
          >
            {SLIDES[currentSlide].title}
          </h3>
          <p
            class="text-xs font-semibold text-green-800 uppercase tracking-wider"
          >
            {SLIDES[currentSlide].subtitle}
          </p>
        </div>

        <!-- Image Slot with Graphic Fallback -->
        <div
          class="relative w-full h-fit bg-gray-200 rounded-lg border-2 border-slate-300 overflow-hidden flex items-center justify-center"
        >
          <img
            src={SLIDES[currentSlide].image}
            alt={SLIDES[currentSlide].title}
            class="w-full h-full object-contain relative z-10"
            onerror={(e) => {
              e.currentTarget.style.display = "none";
              if (e.currentTarget.nextElementSibling) {
                e.currentTarget.nextElementSibling.classList.remove("hidden");
                e.currentTarget.nextElementSibling.classList.add("flex");
              }
            }}
          />
        </div>

        <!-- Highlights List -->
        <div
          class="bg-white border-2 border-slate-300 rounded-lg p-3 space-y-1.5 shadow-inner"
        >
          {#each SLIDES[currentSlide].highlights as highlight}
            <div class="flex items-center gap-2 text-xs text-slate-700">
              <span class="text-green-700 font-bold">✓</span>
              <span>{highlight}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Footer & Controls -->
      <div
        class="flex justify-between items-center bg-gray-200 border-t-2 border-slate-400 px-4 py-3"
      >
        <!-- Don't Show Again Checkbox -->
        <label
          class="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 hover:text-slate-900 font-medium"
        >
          <input
            type="checkbox"
            bind:checked={dontShowAgain}
            class="rounded border-slate-400 text-green-600 focus:ring-green-500 w-4 h-4 cursor-pointer"
          />
          <span>Don't show again on start</span>
        </label>

        <!-- Slide Indicator Dots & Buttons -->
        <div class="flex items-center gap-4">
          <!-- Dots -->
          <div class="flex gap-1.5">
            {#each SLIDES as _, i}
              <button
                onclick={() => (currentSlide = i)}
                class="w-2.5 h-2.5 rounded-full transition-all cursor-pointer {i ===
                currentSlide
                  ? 'bg-slate-700 scale-110'
                  : 'bg-gray-400 hover:bg-slate-500'}"
                aria-label="Go to slide {i + 1}"
              ></button>
            {/each}
          </div>

          <!-- Buttons -->
          <div class="flex gap-2">
            {#if currentSlide > 0}
              <button
                onclick={prevSlide}
                class="px-3 py-1.5 bg-gray-300 hover:bg-gray-400 text-slate-800 font-bold rounded-lg text-xs border border-slate-400 cursor-pointer transition-colors"
              >
                Previous
              </button>
            {/if}

            {#if currentSlide < SLIDES.length - 1}
              <button
                onclick={nextSlide}
                class="px-4 py-1.5 bg-gray-300 hover:bg-gray-400 text-slate-800 font-bold rounded-lg text-xs border border-slate-400 cursor-pointer transition-colors"
              >
                Next
              </button>
            {:else}
              <button
                onclick={handleClose}
                class="px-5 py-1.5 bg-gray-300 hover:bg-gray-400 text-slate-800 font-bold rounded-lg text-xs border border-slate-400 cursor-pointer transition-colors"
              >
                Start Farming
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
