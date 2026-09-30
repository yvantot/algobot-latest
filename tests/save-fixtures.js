import { QUEST_DATA } from "../src/game/global/quests.js";
import { CropTypes } from "../src/game/global/enum.js";
export function saveFixture() {
  return {
    schemaVersion: 1, questPathVersion: 1, gameVersion: "test", playthroughId: "farm-a", revision: 1, savedAt: 1,
    owner: { participantId: "student_A", identityKind: "researcher_assigned_code", studyProtocolVersion: "fixed-conditions-v1" },
    payload: {
      rows: 3, columns: 3,
      tiles: Array.from({ length: 9 }, (_, i) => ({ x: i % 3, y: Math.floor(i / 3), soil: { state: 0, water: 0, owner: null }, crop: null })),
      bots: [{ index: 0, x: 0, y: 0, moveDuration: .7, actionDuration: .8, checkDuration: .5, program: { text_code: "", block_xml: "" } }],
      economy: { coins: 50, exp: 0, crops: Object.fromEntries(Object.values(CropTypes).map(type => [type, type === "wheat" ? 5 : 0])) },
      quests: Object.fromEntries(Object.keys(QUEST_DATA).map(key => [key, { progress: 0, is_completed: false, is_claimed: false }])),
      hazards: { fires: [], clouds: [], drops: [], accumulator: 0, sequence: 0 },
    },
  };
}
