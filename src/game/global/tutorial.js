// Mutable gameplay policy; UI progression lives in the quest store.
export const tutorialPolicy = { protected: false };

export const INTRO_QUESTS = ["intro_run", "intro_build", "intro_say", "intro_sequence", "tut_2"];

export function activeQuest(definitions, states) {
  return Object.keys(definitions).find(key => !states[key]?.is_completed &&
    (definitions[key].prereq || []).every(id => states[id]?.is_claimed));
}

export function movementQuest(key, { authored = false, inLoop = false, sequence = false, x, y } = {}) {
  if (key === "intro_run" && authored && x === 1 && y === 0) return key;
  if (key === "intro_build" && authored) return key;
  if (key === "intro_sequence" && sequence && !inLoop) return key;
  if (key === "intro_loop" && inLoop) return key;
  return null;
}

export const INTRO_HINTS = {
  intro_run: ["Open Bot in the blocks menu.", "Drag Move right into the empty work area.", "Press Start. Watch your robot move one tile right."],
  intro_build: ["Your work area is ready for a new block.", "Open Bot and drag in Move down.", "Press Start to move down one tile."],
  intro_say: ["Open Bot.", "Drag in Say. Click its text and type Hello!", "Press Start. Your robot will show your message."],
  intro_sequence: ["Open Bot.", "Connect Move left above Move right. The blocks should snap together.", "Press Start once. Your robot goes left, then right. It follows blocks from top to bottom."],
  tut_2: ["Use the Farm category on the robot's current tile.", "Till, plant wheat, then water. When the soil dries, water again.", "Run Harvest crop only when the wheat is fully grown. Your crop cannot spoil during practice."],
  intro_loop: ["You already made a left-then-right trip. A loop does the same trip again.", "Open Loops. Drag in repeat and set its number to 2. Put Move left and Move right inside it.", "Press Start. Watch your robot do the trip twice. Start one tile away from the left edge."],
};
