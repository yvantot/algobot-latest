// Mutable gameplay policy; UI progression lives in the quest store.
export const tutorialPolicy = { protected: false };

export const INTRO_QUESTS = ["intro_run", "intro_build", "tut_2", "intro_loop"];

export function activeQuest(definitions, states) {
  return Object.keys(definitions).find(key => !states[key]?.is_completed &&
    (definitions[key].prereq || []).every(id => states[id]?.is_claimed));
}

export function movementQuest(key, { authored = false, inLoop = false } = {}) {
  if (key === "intro_run") return key;
  if (key === "intro_build" && authored) return key;
  if (key === "intro_loop" && inLoop) return key;
  return null;
}

export const INTRO_HINTS = {
  intro_run: ["Find the Start button above the blocks.", "The prepared bot.right block moves one tile right.", "Press Start once and watch the robot move."],
  intro_build: ["Open the Bot category in the editor.", "Drag a movement block into the workspace. Remove the old block if you need to.", "Try bot.down, then press Start. Choose a direction with a free tile."],
  tut_2: ["Use the Farm category on the robot's current tile.", "Till, plant wheat, then water. Wait until the wheat is ready.", "Run bot.harvest only when the wheat is fully grown. Your crop cannot spoil during practice."],
  intro_loop: ["Open Loops and choose repeat.", "Put movement blocks inside repeat. The robot must make two successful moves inside a loop.", "Repeat twice: bot.left then bot.right. Start away from the left edge; this route returns to the same tile."],
};
