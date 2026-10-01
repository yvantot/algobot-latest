// Frozen definitions for the original normal-speed corn challenges.
export const CORN_ARCHIVE = [
  {
    "id": "corn-sequence-v2",
    "rubric": "corn-sequence-2.0",
    "kind": "sequence",
    "title": "From soil to supper",
    "tier": "Beginner",
    "skill": "Sequential algorithm",
    "coins": 150,
    "exp": 120,
    "description": "Bring me corn grown on this bare patch. The farm follows normal growth and watering times, so patience matters!",
    "cases": [
      [
        {
          "type": null,
          "state": "bare"
        }
      ]
    ],
    "rules": [
      {
        "key": "grew_corn",
        "label": "Plant and harvest corn on every tile."
      },
      {
        "key": "safe_and_finished",
        "label": "Finish without failed commands or an endless loop."
      }
    ],
    "commands": [
      "till",
      "plant",
      "water",
      "wait",
      "harvest",
      "is_watered",
      "is_harvestable"
    ],
    "prerequisite": "tut_2"
  },
  {
    "id": "corn-row-v2",
    "rubric": "corn-row-2.0",
    "kind": "sequence",
    "title": "Supper for the whole row",
    "tier": "Skilled",
    "skill": "Sequences across several tiles",
    "coins": 240,
    "exp": 180,
    "description": "Fill my corn order from this two-tile patch. How you divide your time is up to you. Crops grow and absorb water in real time.",
    "cases": [
      [
        {
          "type": null,
          "state": "bare"
        },
        {
          "type": null,
          "state": "bare"
        }
      ]
    ],
    "rules": [
      {
        "key": "grew_corn",
        "label": "Plant and harvest corn on every tile."
      },
      {
        "key": "safe_and_finished",
        "label": "Finish without failed commands or an endless loop."
      }
    ],
    "commands": [
      "right",
      "left",
      "till",
      "plant",
      "water",
      "wait",
      "harvest",
      "is_watered",
      "is_harvestable"
    ],
    "prerequisite": "tut_2"
  }
];
