# AlgoBot round 2: member collection guide

For team members running gameplay sessions with students. Researcher-side setup and training are in [COLLECTION_DAY_CHECKLIST.md](COLLECTION_DAY_CHECKLIST.md). If the two disagree, ask the lead researcher before continuing.

Game: https://algobot-latest.jidalman-work.workers.dev/

## What each student does

1. Plays the tutorial.
2. Farms for about two minutes.
3. Solves **Your first harvest** in Challenges.
4. Farms for about two more minutes.
5. Solves **Two careful steps** in Challenges.

The game records everything. Your job is to start each student with the right code, keep conditions the same for everyone, and deliver one JSON file per student. Plan about 30 minutes per student; some take longer on the tutorial.

## Participant codes

Each member gets a letter from the lead. Your codes are `R2-<letter><two digits>`, used in order: member A uses `R2-A01`, `R2-A02`, `R2-A03` and so on.

- One code per student, never reused, never shared between members.
- Do not use `R2-P001`. It was used for a staff test and is retired.
- For practice runs use `STAFF-TEST`, and keep that file out of the student folder.
- Write the student's name and code only on the private code list the lead keeps. Never put names in file names, the log sheet or chat.

## Before your first student (once per computer)

- Use a laptop or desktop with a keyboard, in Chrome or Edge. Do not use private or incognito windows; the game needs browser storage.
- Open the game, press `\` (backslash) to open the Dev Console, go to the **DDA** tab and scroll to **Research Data** at the bottom.
- Run one practice session with `STAFF-TEST` (open `…/?study_participant=STAFF-TEST`), download it, and keep it separate.
- Then **Clear Stored Data** (Research Data section) before the first real student.

## Per student

**Set up**

1. Make sure the previous student's JSON is downloaded and uploaded to the shared round-2 folder. Only then click **Clear Stored Data**.
2. In the address bar, open the game with the next code, for example:
   `https://algobot-latest.jidalman-work.workers.dev/?study_participant=R2-A01`
   Open this link directly. Do not load the plain game first.
3. Choose **Start Game**.
4. Open Dev Console (`\`) → DDA tab → **Check Collection**. It must show:
   - Participant: your code, spelled exactly
   - Study conditions: fixed-conditions-v1
   - Build 1.3.9. On the live site it currently also says "UNCOMMITTED CHANGES". That is expected (the Cloudflare build adjusts its own config files) and you can continue.

   If any line is wrong or red, stop and see Troubleshooting. Close the Dev Console (`Esc`) before the student starts.

**While the student plays**

5. The student does the tutorial on their own. Say only: "Play at your own pace. A low score is okay."
6. After the tutorial, the student farms for about two minutes. If they open Challenges too early, the game tells them to keep farming. That is normal.
7. The student opens **Challenges → Your first harvest**, writes a program and runs it. The first program that runs to a score is the one that counts, even if it scores zero. They may use Stop & Edit before that. Later tries are practice only.
8. Back on the farm for about two more minutes, then **Challenges → Two careful steps**, with the same rules.

**Finish**

9. Open Dev Console → **Check Collection**. Both challenges should say **usable training label**. If not, write down the reason shown.
10. Click **Download Dataset JSON**. Check the file is in your Downloads folder (`algobot_dataset_v4_<numbers>.json`).
11. Upload it unchanged to the shared round-2 folder. Do not rename, open or edit it.
12. Fill in one row of the log sheet.

Export every student, including students who left early or did not finish a challenge.

## Do not

- Help with the challenge programs, hint at answers, or let a friend help. Answer only "how do I use the game" questions.
- Click any other Dev Console button. Anything other than Check Collection, Download Dataset JSON and Clear Stored Data marks the session as a developer test and excludes it. Be careful on the DDA tab: the **Force DDA Action Override** buttons sit just above Research Data.
- Clear Stored Data before the file is downloaded **and** uploaded.
- Let the student switch to other tabs or apps. Time on another tab does not count as gameplay.
- Give a student a second go under a new code, or enter a score by hand. A zero is a real score; "no score" stays blank.

## Log sheet (one row per student)

| Column | Example |
| --- | --- |
| Code | R2-A01 |
| Member | A |
| Date and start time | 2026-09-28 09:40 |
| Computer | Lab PC 3 |
| File name | algobot_dataset_v4_1790512345678.json |
| First harvest: usable? | yes |
| Careful steps: usable? | no: unfinished challenge |
| Notes | Left early at 20 min; fire alarm; prior AlgoBot play; any help given |

Write anything unusual in Notes. A recorded deviation is fine; an unrecorded one can make the data unusable.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| "No study conditions", or the participant is `p_…` instead of your code | The code link was not used. If the student has not started, open the code link and Start Game again. If they have, finish, export, and note "no study code". |
| Build is not 1.3.9 | Stop before the student plays and message the lead researcher. ("UNCOMMITTED CHANGES" next to 1.3.9 is expected on the live site.) |
| The page reloaded or the browser closed mid-session | Reopen the same code link and continue. Do not clear data. Note it in the log. |
| A storage warning appears | Download the JSON immediately, then continue. |
| The student opened a challenge by accident and closed it | Do not restart. Continue; note it. |
| The student leaves early | Download the JSON anyway and note the reason. |
| Check Collection says "Developer actions were used" | The session is excluded. Finish and export anyway, note it, and tell the lead. |
