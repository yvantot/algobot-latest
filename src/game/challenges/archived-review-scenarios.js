// Frozen assessment definitions for previously exported scores.
export const REVIEW_ARCHIVE = [
  {
    "id": "pest-planner-v1",
    "rubric": "pest-planner-1.0",
    "kind": "planning",
    "title": "Before the pests",
    "tier": "Expert",
    "skill": "State optimization / planning ahead",
    "coins": 650,
    "exp": 500,
    "budget": 4,
    "description": "You have up to four work steps. When your program ends, pests eat what you leave behind. Moving costs the distance in tiles, even for jump; harvesting costs one step. Checks are free. Choose the route with the greatest total coin value. The most valuable single crop may be a trap!",
    "cases": [
      [
        {
          "type": "rice",
          "state": "ready"
        },
        {
          "type": "corn",
          "state": "ready"
        },
        {
          "type": null,
          "state": "young"
        },
        {
          "type": "tomato",
          "state": "ready",
          "timeLeft": 2
        }
      ],
      [
        {
          "type": "tomato",
          "state": "ready",
          "timeLeft": 2
        },
        {
          "type": null,
          "state": "young"
        },
        {
          "type": "rice",
          "state": "ready"
        },
        {
          "type": "corn",
          "state": "ready"
        }
      ]
    ],
    "rules": [
      {
        "key": "best_yield",
        "label": "Collect the maximum possible coin value in four work steps."
      },
      {
        "key": "within_budget",
        "label": "Use at most four work steps; jump costs its distance, harvest costs one."
      },
      {
        "key": "safe_and_finished",
        "label": "Finish without failed commands or an endless loop."
      }
    ],
    "commands": [
      "jump",
      "right",
      "left",
      "harvest",
      "crop_value",
      "crop_time_left",
      "crop_type"
    ],
    "prerequisite": "intro_loop"
  }
];
