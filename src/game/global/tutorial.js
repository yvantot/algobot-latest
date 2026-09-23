// Mutable gameplay policy; UI progression lives in the quest store.
export const tutorialPolicy = { protected: false };

export const INTRO_QUESTS = ["intro_run", "intro_build", "intro_say", "intro_sequence", "tut_2", "intro_loop"];

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
  intro_run: ["Open Bot in the blocks menu.", "Drag bot.right into the empty work area.", "Press Start. Watch your robot move one tile right."],
  intro_build: ["Remove your old block.", "Open Bot and drag in bot.down.", "Press Start to move down one tile."],
  intro_say: ["Remove your movement blocks. Open Bot.", "Drag in bot.say. Click its text and type Hello!", "Press Start. Your robot will show your message."],
  intro_sequence: ["Remove your old blocks. Open Bot.", "Connect bot.left above bot.right. The blocks should snap together.", "Press Start once. Your robot goes left, then right. It follows blocks from top to bottom."],
  tut_2: ["Use the Farm category on the robot's current tile.", "Till, plant wheat, then water. When the soil dries, water again.", "Run bot.harvest only when the wheat is fully grown. Your crop cannot spoil during practice."],
  intro_loop: ["You already made a left-then-right trip. A loop does the same trip again.", "Open Loops. Drag in repeat and set its number to 2. Put bot.left and bot.right inside it.", "Press Start. Watch your robot do the trip twice. Start one tile away from the left edge."],
};
