# Drone Task

This repository contains the jsPsych implementation of the Drone Task, optimized for Pavlovia hosting, Prolific recruitment, and internal pilot testing. It includes a drone-based collection game (reward/loss blocks) and object-memory tests.

### ⚠️ Pilot Compatibility Requirements
The current pilot uses newer emoji stimuli that require specific hardware/software to render correctly.
* **Allowed:** Mac laptop/desktop, macOS 14.4+, recent Safari/Chrome/Firefox, physical keyboard.
* **Not Allowed:** Windows, Chromebook, Linux, iOS/Android phones or tablets.
* *Note:* A compatibility gate (`static/task/compat-gate.js`) blocks incompatible users automatically. This should be treated as a technical screen-out, not low-quality behavior.

---

## Setup Instructions

1.  **Verify Plugins:** Ensure `static/lib/jspsych-pavlovia-3.2.5.js` and `static/task/compat-gate.js` exist. If paths change, update the `<script>` tags in `index.html`.
2.  **Prolific Codes:** In `index.html`, replace `CODE_SUCCESS` and `CODE_REJECT` placeholders with real Prolific completion codes.
3.  **Consent Form:** Replace placeholder contact fields in `index.html` with IRB-approved language. 

---

## 2. URL Parameters & Controls

Modify the task behavior by appending these parameters to the URL (e.g., `?pilot=1&consent=0`).

| Parameter | Default | Action |
| :--- | :--- | :--- |
| `pilot` | `1` | `1` = ends with a thank-you screen (no Prolific redirect). `0` = Production mode (redirects to Prolific). |
| `consent` | `1` | `1` = shows consent. `0` = skips consent for internal debugging. |
| `gate` | `1` | `1` = runs Mac/OS/Emoji check. `0` = skips gate for internal debugging. |
| `dev` | `0` | `1` = enables development routes (skips Pavlovia saving). |
| `stage` | `full` | If `dev=1`, choose: `instructions`, `encoding` (`bird`), `test` (`memory`), `block` (`block1`/`block2`), or `termination`. |
| `block` | `1` | If `dev=1`, selects memory block 1–4. |
| `ntrials` | `full` | If `dev=1`, limits main task trials for faster testing. |

---

## 3. Testing & Deployment Links

### Local Development (`python3 -m http.server 8000`)
* **Full Task:** `http://localhost:8000/index.html`
* **Skip Gate (Debug):** `http://localhost:8000/index.html?gate=0`
* **Instructions Only:** `http://localhost:8000/index.html?dev=1&stage=instructions`
* **Short Block + Memory:** `http://localhost:8000/index.html?dev=1&stage=block&block=1&ntrials=5`

### Pavlovia Pilot (Internal Use)
When experiment status is **PILOTING**, launch directly using the **Pilot button** on the Pavlovia dashboard. *(Do not rely on plain URLs here, as Pavlovia requires time-limited pilot tokens).*

### Stable Supervisor/Lab Pilot Link
Once experiment status is **RUNNING**, use this link to share a safe, non-redirecting version:
`https://run.pavlovia.org/<username>/DroneTask/?pilot=1`
* *Note on `dev=1` in Pavlovia:* Adding `dev=1` to a Pavlovia link will still trigger the compatibility gate, but it will skip normal Pavlovia data saving and jump to specific task sections.

### Prolific Production Link
Once ready for real data collection, use this in Prolific:
`https://run.pavlovia.org/<username>/DroneTask/?pilot=0&PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`

---

## Repository Structure

* `index.html`: Main entry point (timeline, URL params, consent, data saving, Prolific redirects).
* `inspect_task_design.ipynb`: Notebook for inspecting block structure, reward/loss assignment, temporal-order counterbalancing, and memory pairs. Generates outputs to `design_checks/`.
* **`static/task/`**
    * `compat-gate.js`: Device/OS/Emoji/Keyboard screener.
    * `trial.js`: Core drone collection plugin.
    * `memory_task.js`: Object-memory test.
    * `instructions.js`, `comprehension1.js`, `comprehension2.js`: Flow and checks.
    * `stimuli.js` & `stimuli-details.js`: Trajectories, reward/loss factors, and emoji pools.
    * `game.min.css`: Core styling.

---

## Data Saving
Pavlovia saving is automatically enabled when hosted on Pavlovia, the plugin is loaded, and `dev` mode is off. Data rows will include:
* `PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID`, `workerId`, `subId`
* `pilot_mode`, `consent_shown`, `device_compatible`

---

## Pre-Deployment Checklist

**Code & Setup**
- [ ] `index.html` loads without console errors.
- [ ] Plugin files (`jspsych-pavlovia-3.2.5.js` & `compat-gate.js`) exist and paths are correct.
- [ ] `trial.js`, `memory_task.js`, `instructions.js`, and comprehension scripts pass `node --check`.

**Prolific & Consent**
- [ ] Consent text uses IRB-approved language and is shown by default.
- [ ] `CODE_SUCCESS` and `CODE_REJECT` match Prolific setup.
- [ ] Prolific study description explicitly states the Mac/macOS/keyboard requirements.
- [ ] Production URL uses `pilot=0`. `consent=0` and `gate=0` are strictly removed.

**Task Behavior**
- [ ] Compatibility gate blocks incorrect devices; `device_compatible` is saved in data.
- [ ] Incompatible users are instructed to return the Prolific study.
- [ ] Practice drone motion is visible before hidden-drone instructions.
- [ ] Practices include both green/reward and red/loss scoring.
- [ ] Main task keeps the drone hidden.
- [ ] Object frames and temporal-order questions (horizontal layout) render correctly on Macs.
- [ ] Temporal-order key mapping is counterbalanced and recorded.

**Pavlovia Environment**
- [ ] Pavlovia **PILOTING** works via the dashboard Pilot button.
- [ ] Stable external pilot testing uses **RUNNING** status with `pilot=1`.