// Dynamic Difficulty Adjustment (DDA) Controller
// Modulates game mechanics in real-time based on DQN policy recommendations:
// 1. Crop Growth Speeds & Spoilage Windows
// 2. Pest & Fire Event Frequencies
// 3. Adaptive Pedagogical Scaffolding (Hints & Visual Priority Pulses)

import { CROP_DATA } from "../global/global.js";

export const DDA_ACTIONS = {
  NORMAL: 0,           // Baseline parameters
  SCAFFOLD: 1,         // Logic Wall mitigation (extend spoilage, slow pests, speed growth)
  CHALLENGE: 2,        // High-proficiency engagement (faster spoilage, increased events)
  GREEDY_GUIDE: 3,     // Assist Greedy Choice (highlight highest priority crop)
  STATE_OPTIMIZE: 4,   // Stochastic Event Modulation for Long-term Planning
};

export const DDA_ACTION_NAMES = {
  0: "Normal Mode",
  1: "Scaffold Mode (Logic Wall Helper)",
  2: "Challenge Mode (High Skill)",
  3: "Greedy Choice Tutor",
  4: "State Optimization Mode",
};

class DDAController {
  constructor() {
    this.currentAction = DDA_ACTIONS.NORMAL;
    this.growthMultiplier = 1.0;
    this.spoilageMultiplier = 1.0;
    this.bugSpawnMultiplier = 1.0;
    this.fireSpawnMultiplier = 1.0;
    this.activeHint = "";

    // Save original crop base stats
    this.baseCropStats = {};
    for (const [cropKey, data] of Object.entries(CROP_DATA)) {
      this.baseCropStats[cropKey] = {
        duration: data.duration,
        spoilage_time: data.spoilage_time,
      };
    }
  }

  applyAction(actionId, stage = 1) {
    this.currentAction = actionId;

    switch (actionId) {
      case DDA_ACTIONS.SCAFFOLD:
        // Logic Wall Assistance: Make crops grow 30% faster, spoil 50% slower, reduce pests by 70%
        this.growthMultiplier = 0.7;
        this.spoilageMultiplier = 1.5;
        this.bugSpawnMultiplier = 0.3;
        this.fireSpawnMultiplier = 0.3;
        this.activeHint = "💡 Tip: Order matters! Make sure to till the soil before planting seeds.";
        break;

      case DDA_ACTIONS.CHALLENGE:
        // Challenge Mode: Spoil 20% faster, pests spawn 50% more frequently
        this.growthMultiplier = 1.0;
        this.spoilageMultiplier = 0.8;
        this.bugSpawnMultiplier = 1.5;
        this.fireSpawnMultiplier = 1.3;
        this.activeHint = "🔥 Challenge Active: Pests and spoilage are faster! Can you automate with a loop?";
        break;

      case DDA_ACTIONS.GREEDY_GUIDE:
        // Scaffold Greedy Logic
        this.growthMultiplier = 1.0;
        this.spoilageMultiplier = 1.2;
        this.bugSpawnMultiplier = 1.0;
        this.fireSpawnMultiplier = 1.0;
        this.activeHint = "⚖️ Greedy Choice Tip: Always inspect your crops and harvest the one closest to spoiling first!";
        break;

      case DDA_ACTIONS.STATE_OPTIMIZE:
        // State Optimization Stage
        this.growthMultiplier = 0.9;
        this.spoilageMultiplier = 1.1;
        this.bugSpawnMultiplier = 1.2;
        this.fireSpawnMultiplier = 1.2;
        this.activeHint = "🧠 State Strategy Tip: Prepare for unexpected pests by checking crop status inside loops!";
        break;

      case DDA_ACTIONS.NORMAL:
      default:
        this.growthMultiplier = 1.0;
        this.spoilageMultiplier = 1.0;
        this.bugSpawnMultiplier = 1.0;
        this.fireSpawnMultiplier = 1.0;
        this.activeHint = "";
        break;
    }

    // Apply live overrides to CROP_DATA
    for (const [cropKey, base] of Object.entries(this.baseCropStats)) {
      if (CROP_DATA[cropKey]) {
        CROP_DATA[cropKey].duration = Math.max(1, Math.round(base.duration * this.growthMultiplier));
        CROP_DATA[cropKey].spoilage_time = Math.max(5, Math.round(base.spoilage_time * this.spoilageMultiplier));
      }
    }
  }

  getDDAState() {
    return {
      actionId: this.currentAction,
      actionName: DDA_ACTION_NAMES[this.currentAction] || "Normal Mode",
      growthMultiplier: this.growthMultiplier,
      spoilageMultiplier: this.spoilageMultiplier,
      bugSpawnMultiplier: this.bugSpawnMultiplier,
      fireSpawnMultiplier: this.fireSpawnMultiplier,
      activeHint: this.activeHint,
    };
  }
}

export const dda = new DDAController();
