import { QUEST_DATA } from "../src/game/global/quests.js";
import { CropTypes } from "../src/game/global/enum.js";
import { SHOP_DATA, DOCUMENT_DATA, BASE_CROP_DATA } from "../src/game/global/global.js";
import { catalogState } from "../src/game/persistence/schema.js";
export function saveFixture() {
  return {
    schemaVersion: 1, questPathVersion: 1, gameVersion: "test", playthroughId: "farm-a", revision: 1, savedAt: 1, recoveryGeneration: 0,
    owner: { participantId: "student_A", identityKind: "researcher_assigned_code", studyProtocolVersion: "fixed-conditions-v1" },
    payload: {
      rows: 3, columns: 3,
      tiles: Array.from({ length: 9 }, (_, i) => ({ x: i % 3, y: Math.floor(i / 3), soil: { state: 0, water: 0, owner: null }, crop: null })),
      bots: [{ index: 0, x: 0, y: 0, moveDuration: .7, actionDuration: .8, checkDuration: .5, program: { text_code: "", block_xml: "" } }],
      economy: { coins: 50, exp: 0, crops: Object.fromEntries(Object.values(CropTypes).map(type => [type, type === "wheat" ? 5 : 0])) },
      personalize: { FARM_NAME: "Test farm", AVATAR: "/sprites/avatar_farmer.png" },
      tutorial: { active: true, authoredBlocks: [], sequenceBlocks: [] }, feedback: { queue: [], hazardsPending: false }, selection: null,
      ui: { editor: 0, blockBot: 0, textBot: 0, completedDemos: [], entryScreen: "demonstration" },
      claimedRewards: [], challengeRewards: [], exclusions: [], pests: [], lessonFires: [],
      tips: {}, shop: catalogState(SHOP_DATA), documents: catalogState(DOCUMENT_DATA), cropData: structuredClone(BASE_CROP_DATA), startClicked: false, lessonActive: false, lessonQuest: null, difficulty: 0,
      rng: { algorithm: "mulberry32-v1", state: 1 }, inboxes: { nextId: 0, inboxes: [] },
      scheduler: { clock: 1, checkRemaining: 100, lastEventTime: 0, lastCheckTime: 0, eventsTriggered: 0 },
      quests: Object.fromEntries(Object.keys(QUEST_DATA).map(key => [key, { progress: 0, is_completed: false, is_claimed: false }])),
      hazards: { fires: [], clouds: [], drops: [], events: [], accumulator: 0, sequence: 0 },
    },
  };
}
