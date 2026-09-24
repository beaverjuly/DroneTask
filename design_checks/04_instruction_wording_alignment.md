# Instruction wording alignment: bird reference → drone task

This document compares the live drone-task wording with the original bird-task wording. The drone version keeps the reference sentence structure wherever the task mechanics are unchanged. Differences are limited to the cover story, the current interface, and the drone task’s reward/loss and expanded-memory design.

## Sources

| Source | Role |
|---|---|
| [`Bird Task 15 Instructions Text.txt`](../Bird%20Task%2015%20Instructions%20Text.txt) | Reference instruction wording. |
| [`Experiment HTML Text.txt`](../Experiment%20HTML%20Text.txt) | Reference welcome, transitions, and closing wording. |
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
| Drop and score | “You will then see the bird dropping a bag of coins.”<br>“If you align your bucket perfectly, you will catch all ten coins!” | “You will then see the drone dropping a supply.”<br>“If you align the collector perfectly, you will catch all ten pieces!” | Cover-story nouns only. |
| Items | “You will also notice that on each turn, a distinct item will appear where the coins fall.”<br>“You should note these items as they appear but you do not need to memorize them.” | “You will also notice that on each turn, a distinct item will appear where the pieces fall.”<br>“You should note these items as they appear, but you do not need to memorize them.” | `coins` → `pieces`; this reference-derived page now appears after practice and immediately before the memory-task explanation. Bell, light-bulb, and hammer examples show that the item differs across turns. |
| Inactivity | “If you do not move the bucket on one or two turns, we assume you are happy with its position.”<br>“However, you should not leave the bucket in one place for more than a few turns.”<br>“If you do, we will warn you, and if you persist, we may have to end the game early!” | The same wording with `collector` replacing `bucket`. | Cover-story noun only. The reminder follows the score explanation and repeats its two static catch-outcome demonstrations. |
| Wind | “The bag will fall near the bird, but the exact position will vary around the bird because it is a windy day!” | “The supply will land near the drone, but the exact position will vary around the drone because it is windy!” | `bag/bird` → `supply/drone`; left/right examples replace front/behind in the side-on display. |
| Drone movement | “The best prediction for its position on one turn is its position on the previous turn, but it may fly to a new location at any time.” | “The best prediction for its position on one turn is its position on the previous turn, but it may move to a new location at any time.” | `fly` → `move`. |
| Strategy | “Your best strategy is to position the bucket directly under where you think the bird is located.” | “Your best strategy is to position the collector directly under where you think the drone is located.” | `bucket/bird` → `collector/drone`. |
| Hidden target | “In the real game, you cannot actually see the bird, only the bag of coins that it drops!” | “In the full game, you cannot actually see the drone, only the supplies that it drops!” | `real` → `full`; cover-story nouns only. |
| Blocks | “The full game will have 4 different environments with 4 different wind conditions.”<br>“You will be reminded each time the environment and bird changes.” | “The full game will have 4 different planets.”<br>“Wind conditions and drone movement can differ between planets.”<br>“You will be reminded each time the planet and drone change.” | `environment` → `planet`; wording avoids claiming four unique parameter combinations when the current design crosses two movement patterns with reward/loss valence. |
| Memory | “You will complete a memory task based on the items that appear.”<br>“You will be asked which item in a pair appeared first, and how far apart you feel the two items were during the game.” | The same two judgments, followed by “when you feel another item appeared between them.” | The third temporal-placement judgment is unique to the drone task. |
| Understanding check | “You will now see some questions testing your understanding of the game.”<br>“You should answer all of them correctly to proceed.” | The same wording, followed by a concise explanation that an incorrect answer opens the relevant instructions and can be answered again. | Describes the current non-terminating review loop accurately. |
| Ready screen | “We are now beginning the game. Good luck!” | “We are now beginning the game.”<br>“Good luck!” | Reference wording retained. |

### Emphasis hierarchy used in the live deck

| Treatment | Purpose | Constraint |
|---|---|---|
| **Bold** | The most important action, rule, or deadline. | At most one continuous bold phrase in each sentence segment. |
| *Italics* | A secondary clarification. | At most one continuous italic phrase in each sentence segment. |
| Bold + italics | Not used. | No phrase is both bold and italic. |

For the inactivity reminder, the live emphasis is: **do not move the collector**, *happy with its position*, **more than a few turns**, *warn you*, and **end the game early!** The same hierarchy is used in the opening instructions, comprehension guidance, planet transitions, and repeated memory-task reminders.

## Drone-only instruction additions

| Addition | Live wording | Why it is necessary |
|---|---|---|
| Green supplies | “The more pieces you catch, the more points you earn.” | Explains reward blocks, which do not exist in the reference task. |
| Red supplies | “The more pieces you catch, the fewer points you lose.” | Explains loss blocks while keeping the same goal: catch as many pieces as possible. |
| Practice sequence | Drone shown with green, drone shown with red, then drone hidden with green; item identities remain hidden in all three scored blocks. | Demonstrates both scoring rules and the hidden-drone mechanic without repeating a second hidden red block or introducing memory items prematurely. |
| Memory demonstration items | Bell, light bulb, and hammer appear only on the item-introduction page. The later memory-question examples use wrench, pushpin, and paperclip from the separate scored-practice identities. | Prevents the memory-question examples from repeating item a/b/c while keeping every example within the practice-only object pool. |
| Third memory judgment | “When did this item appear between the other two items?” | Documents the added temporal-placement measure. |
| Memory timing | Begin within 5 seconds; slider responses auto-submit 7 seconds after the first move. | Documents the live response deadlines. |

## Comprehension alignment

Questions 1–10 follow the reference comprehension in the same order. Questions 11–13 are the minimum additions needed for the drone task’s reward/loss and expanded-memory design. Each live question bolds no more than two words.

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
| 13 | “The memory task asks **three questions**: which item appeared first, how far apart in time two items felt, and when another item appeared between them. These answers do not affect your score.” | True | Preserves both reference judgments and checks the added temporal-placement judgment. |

## Intentional exclusions

The reference task’s short-versus-long version and hypothetical-choice screens are not part of the drone design and are not reintroduced. The drone task instead retains four planet blocks, reward/loss scoring, one hidden-drone practice block, and three memory judgments.
