# Instruction wording alignment: bird reference → drone task

This audit records the participant-facing wording now implemented in the drone task. It uses the bird task as the language template and changes only the cover-story terms or mechanics that differ in the drone version.

| Reference source | Used for |
|---|---|
| [`Bird Task 15 Instructions Text.txt`](./Bird%20Task%2015%20Instructions%20Text.txt) | Core game instructions, practice language, the full-game explanation, quiz, ready screen, and no-response screen. |
| [`Experiment HTML Text.txt`](./Experiment%20HTML%20Text.txt) | Welcome, pre-instruction message, end-of-game message, finish message, and the post-block memory transition. |

## Required terminology substitutions

| Bird reference term | Drone-task wording | Reason |
|---|---|---|
| bird | drone | Drone cover story. |
| bag of coins | supply / pieces | A supply breaks into catchable pieces in the current animation. |
| bucket | collector | Current response control. |
| ground / land | rail | Current landing reference in the scene. |
| environment | planet | Current block cover story. |
| light / dark scene | white / grey collector | The current task signals movement availability through the collector rather than scene brightness. |
| real game | full game | Existing drone-task label. |

## Entry, movement, and scoring screens

| Current drone screen | Reference wording | Implemented drone wording | Necessary adaptation |
|---|---|---|---|
| Welcome | “Welcome to the bird game!”<br>“Please follow the instructions and complete the task.”<br>“There will be a game, followed by a questionnaire.” | “Welcome to the drone game!”<br>“Please follow the instructions and complete the task. It will take approximately 45 minutes.”<br>“There will be a game, followed by a questionnaire.” | `bird` → `drone`; current duration retained. |
| Welcome: payment-quality reminder | “Bonus money will be processed based on game performance and questionnaire data quality checks.”<br>“To ensure maximal payment…” | “Bonus payment will be processed based on game performance and questionnaire data quality checks.”<br>“To ensure maximal payment, please read all instructions, pay close attention to the game, and read through every questionnaire item.” | Only “money” → “payment”; reference sentence retained. |
| Before You Start | “You will now see the instructions for the task.”<br>“Please pay attention to the instructions and complete the comprehension check…” | “You will now see the instructions for the game.”<br>“Please pay attention to the instructions and complete the comprehension check.”<br>“You must answer every question correctly before the game starts.” | The current comprehension loop allows review until correct, so it does not threaten termination for wrong answers. |
| Your task | “In this game, birds drop bags of coins onto the ground. Your goal is to catch as many coins as you can by moving your bucket to where you think the coins will land.” | “In this game, drones drop supplies toward the rail. Your goal is to catch as many pieces as you can by moving your collector to where you think the pieces will land.” | Cover-story noun changes; “toward the rail” matches the animated supply drop. |
| Game-screen labels | Reference uses a labelled game image. | “Drone,” “Collector,” and “Rail,” with “These labels only appear during instructions.” | Same orientation function with the current scene elements. |
| How to move | “You should use right and left arrow keys to move the bucket.” | “You should use the right (→) and left (←) arrow keys to move the collector.” | `bucket` → `collector`; visible key symbols retained. |
| First movement practice | “Now give it a try. Make a response by using the left or right arrow key.” | “Now give it a try.”<br>“Make a response by using the left (←) or right (→) arrow key.” | Same instruction, with visual key labels. |
| Collector locks and unlocks | “After you position the bucket, the sky will slightly darken. At this time you can no longer move the bucket.”<br>“A new turn begins when the scene lights up again…” | “After you position the collector, it will turn grey. At this time you can no longer move the collector. A new turn begins when the collector turns white again. At this time you are once again able to move the collector.” | The current task uses collector colour, not scene brightness, to show movable versus locked states. |
| Supply drop and catch score | “You will then see the bird dropping a bag of coins.”<br>“The bag explodes near the land and the coins fall.”<br>“If you align your bucket perfectly, you will catch all ten coins!” | “You will then see the drone dropping a supply.”<br>“The supply breaks into pieces near the rail and the pieces fall.”<br>“If you align the collector perfectly, you will catch all ten pieces!” | `bird/bag/coins/bucket/land` replaced with drone-task terms; score, rather than coins alone, is shown because of loss blocks. |
| Green and red supply rule | No corresponding bird-task valence manipulation. | Green: “you earn from 0 to +10 points on each turn. The more pieces you catch, the more points you earn.”<br>Red: “your score is from −10 to 0 points on each turn. The more pieces you catch, the fewer points you lose.” | Added drone-task reward/loss manipulation; both rules preserve the same primary goal: catch as many pieces as possible. |
| Bonus reminder | “Your bonus is determined by the number of coins that you catch…” | “Your bonus is determined by your final score across the game.” | Necessary because red-supply turns can contribute negative points. |
| Items and response persistence | “On each turn, a distinct item will appear where the coins fall.”<br>“You should note these items as they appear but you do not need to memorize them.”<br>“If you do not move the bucket on one or two turns…” | “On each turn, a distinct item will appear where the pieces fall.”<br>“You should note these items as they appear, but you do not need to memorize them.”<br>“If you do not move the collector on one or two turns, we assume you are happy with its position…” | `coins/bucket` → `pieces/collector`; reference inactivity contingency retained. |
| Green visible-drone practice | “Now give it a try. Notice that you can only move your bucket when the scene is light.” | “For these 3 practice turns, the supplies will be green.”<br>“Now give it a try. Notice that you can only move the collector when it is white.” | Adds the required green reward rule and current white/grey movement signal. |
| Red visible-drone practice | No corresponding loss version. | “For these 3 practice turns, the supplies will be red.”<br>“You will see your score on the screen, from −10 to 0. The more pieces you catch, the fewer points you lose.” | Added loss-block parallel to the green practice. |

## Wind, hidden drone, and full-game screens

| Current drone screen | Reference wording | Implemented drone wording | Necessary adaptation |
|---|---|---|---|
| Wind | “The bag will fall near the bird, but the exact position will vary around the bird because it is a windy day!” | “The supply will land near the drone, but the exact position will vary around the drone because it is windy!” | `bag/bird` → `supply/drone`; “land” matches the rail-based display. |
| Wind examples | “The bag might fall in front of the bird… just under… behind the bird.” | “might land to the left of the drone,” “or just under the drone,” “or to the right of the drone.” | Left/right is the relevant spatial dimension in the side-on drone display. |
| Unpredictable movement | “The best prediction for its position on one turn is its position on the previous turn, but it may fly to a new location at any time.” | “The best prediction for its position on one turn is its position on the previous turn, but it may move to a new location at any time.” | Only `fly` → `move`. The visual divider says “OR,” preserving the stochastic—not deterministic—interpretation. |
| Best strategy | “Your best strategy is to position the bucket directly under where you think the bird is located.” | “Your best strategy is to position the collector directly under where you think the drone is located.” | `bucket/bird` → `collector/drone`. |
| Hidden drone in the full game | “In the real game, you cannot actually see the bird, only the bag of coins that it drops!”<br>“You have to estimate where the bird is located based on where it has been.” | “In the full game, you cannot actually see the drone, only the supplies that it drops!”<br>“You have to estimate where the drone is located based on where it has been.” | `real` → `full`; cover-story noun changes only. |
| Green hidden-drone practice | Reference asks participants to try turns while noticing movement and landing. | “Now give it a try. You will play 3 practice turns with the drone hidden.”<br>“Your goal is to catch as many pieces as you can…” | Adds hidden-drone version and green reward rule. |
| Red hidden-drone practice | No corresponding loss version. | “Now try a different kind of supply. You will play 3 practice turns with the drone hidden.”<br>“Catching more pieces means losing fewer points, from −10 to 0 points per turn.” | Added loss-block parallel. |
| Full game: block structure | “The full game will have 4 different environments with 4 different wind conditions. Each… will also have a different bird with different flying behavior.” | “The full game will have 4 different planets. Each planet will have a drone. Wind conditions and drone movement can differ between planets. You will be reminded each time the planet and drone change.” | `environment/bird` → `planet/drone`; avoids incorrectly claiming four unique wind/movement parameter combinations in the current two-pattern × valence design. |
| Full game: supply colour | No corresponding bird-task valence manipulation. | “On each planet, the supplies will all be green or all be red. In both cases, your goal is to catch as many pieces as you can.” | Adds the current reward/loss block structure without changing the participant’s goal. |
| Per-planet transition | Reference: “You will be reminded each time the environment and bird changes.” | “A new planet and drone.”<br>“Wind conditions and drone movement can differ from planet to planet.”<br>“[GREEN/RED] SUPPLIES” plus the matching score rule. | Current animated block-transition design retained; wording matches the full-game explanation and colour rule. |
| Planet start | “We are now beginning the game.” | “We are now beginning Planet [n].” | Makes the existing per-planet animation informative. |

## Items, memory, comprehension, and closing screens

| Current drone screen | Reference wording | Implemented drone wording | Necessary adaptation |
|---|---|---|---|
| Memory-task overview | “You will complete a memory task based on the items that appear.”<br>“You will be asked which item in a pair appeared first, and how far apart you feel the two items were during the game.” | “You should note these items as they appear, but you do not need to memorize them.”<br>“You will complete a memory task based on the items that appear.”<br>“You will be asked which item in a pair appeared first, how far apart in time you feel the two items were during the game, and when you feel another item appeared between them.” | Retains both original memory judgments and adds the drone task’s third placement judgment. |
| Memory examples: order | Reference wording: “which item in a pair appeared first.” | “Which item in the pair appeared first during the game?” | Same judgment, phrased as the live prompt. |
| Memory examples: distance | Reference wording: “how far apart you feel the two items were during the game.” | “How far apart in time did you feel these two items were during the game?” | Same judgment, grammatical direct-question form. |
| Memory examples: added placement judgment | No corresponding bird-task question. | “When did this item appear between the other two items?”<br>Endpoints: “Closer to first item” / “Closer to second item.” | Added temporal-placement measure; concise endpoints remain legible on narrow screens. |
| Memory response rules | No matching reference timing rule. | “Begin each response within 5 seconds. For a slider question, after your first move, your answer submits automatically in 7 seconds.”<br>“Enter or Space to confirm.” | Documents current task timing and both supported submit keys. |
| Post-planet memory transition | Reference code creates a memory test following a game block. | “You will now complete a memory task based on the items that appeared on this planet.”<br>“For each set of items, you will answer three questions…” | Current animated transition spells out all three memory judgments and the response timing. |
| Understanding check | “You will now see some questions testing your understanding of the game. You should answer all of them correctly to proceed.” | Same wording, plus: “If any answer is incorrect, review the relevant instructions and then answer that question again.” | The current comprehension interaction reviews only the relevant deck and repeats until correct rather than terminating for an incorrect answer. |
| Comprehension prompts | Reference covers goal, movement, lock, wind, strategy, hidden bird, items, and four environments. | The 13 live prompts use the corresponding drone terms, plus green/red scoring, four planets, and all three memory judgments. | Incorporates the reward/loss and third-memory-question additions; full-game question asks the accurate fact “How many planets are in the full game?” |
| Ready screen | “We are now beginning the game. Good luck!” | “We are now beginning the game.”<br>“Good luck!” | Exact reference wording in the existing animated screen. |
| No-response screen | “You did not respond. We must terminate the game here.” | “You did not respond.”<br>“We must terminate the game here.” | Exact reference wording. |
| Game completion | “Thank you for completing the game. Proceed to the next screen to finish.” | “Thank you for completing the game.”<br>“Next, please answer a few final questions about yourself.” | Retains the current post-game survey step. |
| Final save screen | “Please press ‘Finish’ to exit and record results for bonus payments.” | “Press ‘Thumbs up!’ to finish and save your responses for bonus payment.” | The label matches the current completion control and pilot/Prolific-saving workflow. |
| Loading gate | No direct bird-task equivalent. | “Preparing the game…”<br>“Please wait while the game finishes loading.” | Operational current-task screen; removed unrelated “mission/liftoff” language. |

## Navigation and layout consistency check

All jsPsych instruction decks now use a shared, reserved navigation footer in [`index.html`](../index.html). The page content scrolls in its own row above the footer, so controls never cover instruction text or demonstration graphics.

| Element | Standardized behavior |
|---|---|
| Previous button | Left slot, fixed size and styling. It remains visible but disabled on a deck’s first page, then becomes active on later pages. |
| Next button | Right slot, fixed size and styling. Labels such as “Continue” and “Thumbs up!” retain the same visual treatment. |
| Position | Bottom-centre footer at desktop and on narrow screens; both button slots retain the same alignment. |
| Content clearance | A separate scrollable content row keeps the footer outside all text and demonstrations rather than layering it over the page. |
| Rail warm-up | The “try sliding along the rail” screen uses the same footer dimensions and coordinates, with a reserved non-overlapping row for its “try sliding first” message. |
| Space key | Every practice-introduction screen that says “Press **space** or click **Next** to begin” accepts either input. |
| Comprehension form | The 13-question form keeps its purpose-specific “Check answers” control; its corrected 920-pixel wrapper now bounds every question card and response. Review instruction decks use the shared Previous/Next footer. |

Visual QA was run with the local task at 1440 × 960, 1280 × 720, and 375 × 812. The footer stayed at identical coordinates across welcome, short instruction, dense visual, comprehension-review, and rail warm-up screens. At each size, the content, warm-up game, feedback message, and footer occupied separate non-overlapping bounds. Space-key advancement and the movement-before-Next guard were also exercised in the live sequence.

## Practice item separation check

Practice and instruction examples now use dedicated emoji that are separate from the 200 real-game PNG items and from the real-game fallback-emoji pool.

| Context | Assigned emoji | Check |
|---|---|---|
| Rail-movement warm-up | 🐬 | Assigned uniquely for data consistency; the item remains hidden on this movement-only turn. |
| Visible-drone green practice | 🐧 · 🐦 · 🐓 | Three distinct visible items. |
| Visible-drone red practice | 🐕 · 🐖 · 🐎 | Three distinct visible items. |
| Hidden-drone green practice | 🐒 · 🦀 · 🦃 | Three distinct visible items. |
| Hidden-drone red practice | 🦅 · 🦆 · 🦉 | Three distinct visible items. |
| Memory-instruction demonstration | 🐸 · 🐔 · 🦌 | Separate demonstration-only set; none is reused during practice. |
| Real-game separation | 200 unique PNG items | No practice concept matches a real-game stimulus filename; no practice or demonstration emoji appears in the 39-symbol main-task fallback pool. |

Runtime and browser checks confirmed 13 unique configured practice definitions, 12 unique visible practice items, matching saved `stim_img` values, and no retained shrimp, microphone, or pine-tree symbols.

## Intentional reference exclusions

The bird reference includes a short-versus-long version and later hypothetical-choice material. Those screens do not exist in the current drone design, so they were not reintroduced. The drone task instead retains its four planet blocks, reward/loss manipulation, three memory judgments, and non-terminating comprehension review.
