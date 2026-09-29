# Instruction wording alignment: bird reference → drone task

This document compares the live drone-task wording with the original bird-task wording. The drone version keeps the reference sentence structure wherever the task mechanics are unchanged. Differences are limited to the cover story, the current interface, and the drone task’s reward/loss and expanded-memory design.

## Sources

| Source | Role |
|---|---|
| [`Bird Task 15 Instructions Text.txt`](./Bird%20Task%2015%20Instructions%20Text.txt) | Reference instruction wording. |
| [`Experiment HTML Text.txt`](./Experiment%20HTML%20Text.txt) | Reference welcome, transitions, and closing wording. |
| [`birdTask/static/task/comprehension1.js`](../../birdTask/static/task/comprehension1.js) | Ten-question reference comprehension check used by the bird task. |
| [`static/task/instructions.js`](../static/task/instructions.js) | Live drone instructions. |
| [`static/task/comprehension.js`](../static/task/comprehension.js) | Live drone comprehension check. |

## Necessary terminology changes

| Reference term | Drone-task term | Why it changes |
|---|---|---|
| bird / invisible drone | hidden drone | Drone cover story and hidden target. |
| bag of coins / coins | supply / pieces | Current drop animation. |
| bucket / box | collector | Current response control. |
| ground / land | rail | Current landing surface. |
| environment | planet | Current block cover story. |
| light / dark scene | white / grey collector | Current movement-availability signal. |
| flying | movement | A drone may move without a visible flight animation. |

## Instruction alignment

| Topic | Bird-task reference | Live drone wording | Necessary adaptation |
|---|---|---|---|
| Welcome | “Welcome to the bird game!”<br>“Please follow the instructions and complete the task.”<br>“There will be a game, followed by a questionnaire.” | “Welcome to the drone game!”<br>“Please follow the instructions and complete the task.”<br>“There will be a game, followed by a questionnaire.” | `bird` → `drone`; the current 45-minute estimate and payment-quality reminder remain. |
| Goal | “In this game, birds drop bags of coins onto the ground.”<br>“Your goal is to catch as many coins as you can by moving your bucket to where you think the coins will land.” | “In this game, drones drop supplies toward the rail.”<br>“Your goal is to catch as many pieces as you can by moving your collector to where you think the pieces will land.” | Cover-story nouns and landing surface only. |
| Movement | “You should use right and left arrow keys to move the bucket.” | “You should use the right (→) and left (←) arrow keys to move the collector.” | `bucket` → `collector`; key symbols clarify the response. |
| Lock and new turn | “After you position the bucket, the sky will slightly darken.”<br>“A new turn begins when the scene lights up again.” | “After you position the collector, it will turn grey.”<br>“A new turn begins when the collector turns white again.” | The collector, rather than the scene, now shows whether movement is available. |
| Drop and score | “You will then see the bird dropping a bag of coins.”<br>“If you align your bucket perfectly, you will catch all ten coins!” | “You will then see the drone dropping a supply.”<br>“If you align the collector perfectly, you will catch all ten pieces!” | Cover-story nouns change. The live task reports pieces caught as the per-turn score, then determines the bonus from the final score because red turns can contribute losses. The far-miss demonstration shows the game-accurate yellow `0`, rather than implying that a large miss still earns points. |
| Items | “You will also notice that on each turn, a distinct item will appear where the coins fall.”<br>“You should note these items as they appear but you do not need to memorize them.” | “You will also notice that on each turn, a distinct item will appear where the pieces fall.”<br>“You should note these items as they appear, but you do not need to memorize them.” | `coins` → `pieces`. Bell, light-bulb, and hammer examples establish that the item changes; three green item-visible practice turns then occur immediately before the memory-question explanation. |
| Inactivity | “If you do not move the bucket on one or two turns, we assume you are happy with its position.”<br>“However, you should not leave the bucket in one place for more than a few turns.”<br>“If you do, we will warn you, and if you persist, we may have to end the game early!” | The same wording with `collector` replacing `bucket`. | Cover-story noun only. The reminder follows the score explanation and repeats its two static catch-outcome demonstrations. |
| Wind | “The bag will fall near the bird, but the exact position will vary around the bird because it is a windy day!” | “The supply will land near the drone, but the exact position will vary around the drone because it is windy!” | `bag/bird` → `supply/drone`; left/right examples replace front/behind in the side-on display. |
| Drone movement | “The best prediction for its position on one turn is its position on the previous turn, but it may fly to a new location at any time.” | “The best prediction for its position on one turn is its position on the previous turn, but it may move to a new location at any time.” | `fly` → `move`. |
| Strategy | “Your best strategy is to position the bucket directly under where you think the bird is located.” | “Your best strategy is to position the collector directly under where you think the drone is located.” | `bucket/bird` → `collector/drone`. |
| Hidden target | “In the real game, you cannot actually see the bird, only the bag of coins that it drops!” | “In the full game, you cannot actually see the drone, only the supplies that it drops!” | `real` → `full`; cover-story nouns only. |
| Blocks | “The full game will have 4 different environments with 4 different wind conditions.”<br>“You will be reminded each time the environment and bird changes.” | “The full game will have 4 different planets.”<br>“Wind conditions and drone movement can differ between planets.”<br>“You will be reminded each time the planet and drone change.” | `environment` → `planet`; wording avoids claiming four unique parameter combinations when the current design crosses two movement patterns with reward/loss valence. |
| Memory | “You will complete a memory task based on the items that appear.”<br>“You will be asked which item in a pair appeared first, and how far apart you feel the two items were during the game.” | The same two judgments, followed by “when you feel another item appeared between them.” | The third temporal-placement judgment is unique to the drone task. Each judgment then has a matched, arrow-key try-out screen. |
| Understanding check | “You will now see some questions testing your understanding of the game.”<br>“You should answer all of them correctly to proceed.” | The same wording, followed by a concise explanation that an incorrect answer opens the relevant instructions and can be answered again. | Describes the current non-terminating review loop accurately. |
| Ready screen | “We are now beginning the game. Good luck!” | “We are now beginning the game.”<br>“Good luck!” | Reference wording retained. |

### Emphasis hierarchy used in the live deck

| Treatment | Purpose | Constraint |
|---|---|---|
| **Bold** | The most important action, rule, or deadline. | At most one continuous bold phrase in each sentence segment. |
| *Italics* | A secondary clarification. | At most one continuous italic phrase in each sentence segment. |
| Bold + italics | Not used. | Scoring-direction words such as `more` and `fewer` use italics without bold. |

For the inactivity reminder, the live emphasis is: **do not move the collector**, *happy with its position*, **more than a few turns**, *warn you*, and **end the game early!**

## Drone-only instruction additions

| Addition | Live wording | Why it is necessary |
|---|---|---|
| Green supplies | “Green supplies **add points** to your score.”<br>“The *more* pieces you catch, the *more* points you earn.” | Green scoring is introduced and explained fully before the first three-turn scored-practice block. Its practice-start reminder contains only “For these 3 practice turns, the supplies will be green,” the green scoring scale, and the standard start control. This wording is a necessary drone-task addition, not verbatim Bird Task wording. The closest reference says, “You will see how many coins you win on the screen, from 0 to 10.” |
| Red supplies | “Red supplies **reduce loss** of points.”<br>“The *more* pieces you catch, the *fewer* points you lose.” | Red is introduced only after the item introduction, memory-question explanation, and planet overview. The final reminder shows the red scale from −10 to −0 points before three red practice turns. |
| Practice sequence | One green movement turn → three visible-drone green turns → three hidden-drone green turns → item introduction → three hidden-drone, item-visible green turns → memory-question explanation → planet overview → red lesson → three hidden-drone, item-visible red turns. | Every practice before the final red lesson uses green supplies. In every three-turn practice, the latent drone moves a randomized small distance from turn 1 to 2, then reverses direction and moves a randomized, much larger distance from turn 2 to 3. Each supply begins at a fixed, randomized position a little to the left or right of the drone and falls straight down, as in the real game. Practice-trial items first become visible in a dedicated three-turn block immediately after the source-aligned item introduction and immediately before the memory questions; the final red block integrates the complete task. |
| Memory demonstration items | Bell, light bulb, and hammer appear only on the static item-introduction examples. The item-visible green practice shows wrench, pushpin, and paperclip, which are then reused in the memory-question examples. The final red practice uses magnet, fire extinguisher, and ladder. | Memory examples concern items participants actually saw, do not repeat item a/b/c, and remain separate from all 200 experimental stimuli. |
| Memory try-outs | “Try it now by pressing **← or →**.” | Three matched screens let participants practise the first-item, temporal-distance, and temporal-placement responses. Each repeats “*These questions will not affect your score*” and the same 5-/7-second timing notice below the demonstration. |
| Drone visual | Instruction mock-ups and visible practice trials use the same enlarged, neutral CSS drone shape. | Avoids platform-specific emoji rendering and prevents the drone itself from resembling a memory item. |
| Third memory judgment | “When did this item appear between the other two items?” | Documents the added temporal-placement measure. |
| Memory timing | Begin within 5 seconds; slider responses auto-submit 7 seconds after the first move. | The same timing notice appears beneath each of the three memory try-outs, matching the live response deadlines. |

## Comprehension alignment

Questions 1–10 follow the reference comprehension in the same order. Questions 11–12 are the minimum additions needed for the drone task’s reward/loss design. Each live question bolds no more than two words.

### Reference-aligned questions

| # | Reference comprehension wording | Live drone wording | Answer and adaptation |
|---:|---|---|---|
| 1 | “Your goal is to move the box as close to the invisible drone as you can.” | “**Your goal** is to move the collector as close to the hidden drone as you can.” | True. `box` → `collector`; `invisible` → `hidden`. |
| 2 | “The drone never changes its location.” | “The drone **never changes** its location.” | False. Wording retained. |
| 3 | “You can move the box both when it is bright and when it is darkened.” | “You can move the **collector** both when it is white and when it is grey.” | False. Uses the current white/grey movement signal. |
| 4 | “The bag will fall near the drone, but the exact position will vary around the drone.” | “The supply will land near the drone, but its **exact position** will vary around the drone.” | True. `bag` → `supply`; `fall` → `land`. |
| 5 | “Your best strategy is to place the box directly under where you think the invisible drone is.” | “Your **best strategy** is to place the collector directly under where you think the hidden drone is.” | True. Cover-story nouns only. |
| 6 | “If you leave the box in one place for a long time, the game may end early.” | “If you leave the collector in one place for a long time, the game may **end early**.” | True. `box` → `collector`. |
| 7 | “You will receive a bonus based on how closely your box tracks the invisible drone.” | “Your bonus is based on your **final score** across the game.” | True. Necessary because red turns can contribute negative points. |
| 8 | “You should note these items as they appear, but you do not need to memorize them.” | “You should note these items as they appear, but you **do not** need to memorize them.” | True. Wording retained. |
| 9 | “There will be a memory task after each environment based on the items that appear.” | “There will be a **memory task** after each planet based on the items that appear.” | True. `environment` → `planet`. |
| 10 | “All of the environments have the same wind patterns, and drones with the same flying route.” | “All planets have the **same wind** patterns and drones with the same movement.” | False. `environment` → `planet`; `flying route` → `movement`. |

### Drone-only questions

| # | Live drone wording | Answer | Design purpose |
|---:|---|---|---|
| 11 | “For **green supplies**, catching more pieces means earning more points.” | True | Reward-block rule. |
| 12 | “For **red supplies**, catching more pieces means losing fewer points.” | True | Loss-block rule. |

## Intentional exclusions

The reference task’s short-versus-long version and hypothetical-choice screens are not part of the drone design and are not reintroduced. The drone task instead retains four planet blocks, reward/loss scoring, staged hidden-drone practice, and three memory judgments.

The reference deck does not contain a separate introduction for item-visible practice trials. Its “Now that you know how the game works, try playing a few turns…” page precedes an item-hidden movement-and-drop practice, so that wording is not repurposed for the drone task’s added item-visible block. In the reference pipeline, the four-environment explanation follows the item and memory explanation; the drone task keeps the four-planet explanation in the same relative position.
