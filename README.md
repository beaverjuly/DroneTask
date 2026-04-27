# Drone Task (Pavlovia Version)

This repository contains the jsPsych implementation of the Drone Task, optimized for hosting on Pavlovia and integration with Prolific.

## Key Features
- **Pavlovia Integration:** Uses the jsPsych-Pavlovia plugin for data saving.
- **Prolific Ready:** Handles participant ID capture and conditional redirects (success/reject).
- **Flexible Testing:** Toggle experiment stages, trial counts, and modes via URL parameters.
- **Consent Toggle:** Consent is shown by default; `consent=0` skips it for internal testing only.

## Key Differences from Flask Version
- **Data Saving:** Data is saved directly to Pavlovia's Gitlab via the Pavlovia plugin.
- **Consent Handling:** Consent is now a jsPsych trial inside `index.html`, not a separate Flask route.
- **Dev Modes:** Consent can be skipped for dev/testing with `?consent=0`.

## Repository Structure
├── index.html                      # Main experiment entry point & consent trial
├── static/
│   ├── lib/
│   │   └── jspsych-pavlovia-3.2.5.js # Pavlovia jsPsych save plugin
│   ├── task/
│   │   ├── instructions.js         # Instruction flow and visual scoring logic
│   │   └── main_task.js            # Core experiment logic
│   └── css/
│       └── jspsych.css
└── README.md

## Setup Instructions

### 1. Verify the Pavlovia plugin
Confirm that the official jsPsych Pavlovia plugin exists at:
`static/lib/jspsych-pavlovia-3.2.5.js`

If you use a different filename, update the `<script>` tag in `index.html`.

### 2. Configure completion codes
Open `index.html` and replace the placeholder values for `CODE_SUCCESS` and `CODE_REJECT` with your specific Prolific codes.

---

## Running the Experiment

The experiment supports mode toggles through URL parameters.

### URL parameters

| Parameter | Default | Meaning |
|---|---:|---|
| `pilot` | `1` | `pilot=1` shows final thank-you only; `pilot=0` enables Prolific redirect. |
| `consent` | `1` | `consent=1` or missing shows consent; `consent=0` skips consent for dev/testing only. |
| `dev` | `0` | `dev=1` enables local development modes. |
| `stage` | `full` | With `dev=1`, choose `instructions`, `bird`, `memory`, or `termination`. |
| `ntrials` | full block | With `dev=1`, limits main task trials for faster testing. |
| `block` | `1` | With `stage=memory`, selects memory block 1–4. |

### Pavlovia pilot testing

For private testing while the experiment status is **PILOTING**, launch the task from the Pavlovia project dashboard using the **Pilot** button. 

Do **not** rely on the plain URL while the experiment is in PILOTING mode, because Pavlovia requires a time-limited pilot token in the URL.

Typical pilot behavior:
- Data are saved or downloaded according to Pavlovia pilot behavior.
- Final screen shows thank-you.
- No Prolific redirect.

**Optional testing links after launch:**
- Standard Pilot: `https://run.pavlovia.org/<username>/<experiment>/?pilot=1`
- Skip consent for quick internal testing: `https://run.pavlovia.org/<username>/<experiment>/?pilot=1&consent=0`

### Running mode / shareable testing link

For a stable link that can be shared with a supervisor or pilot testers, set the Pavlovia experiment status to **RUNNING** and use:
`https://run.pavlovia.org/<username>/<experiment>/?pilot=1`

This keeps the experiment in pilot behavior at the task-code level:
- Final thank-you screen only.
- No Prolific redirect.
- Consent shown by default.

### Production / Prolific mode

Use this link in the Prolific study setup:
`https://run.pavlovia.org/<username>/<experiment>/?pilot=0&PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`

Behavior:
- Consent shown by default.
- Participant identifiers are saved in the data.
- Normal completion redirects to Prolific success code.
- Low-quality / bot-detected completion redirects to Prolific reject code.

---

## Copy-Paste Ready Links

### Self-test from Pavlovia dashboard
Use the **Pilot** button on Pavlovia when the experiment is in **PILOTING** status.

### Stable supervisor / friend pilot link
*Only use this once the experiment status is **RUNNING**:*
`https://run.pavlovia.org/<username>/<experiment>/?pilot=1`

*With consent skipped for fast internal testing:*
`https://run.pavlovia.org/<username>/<experiment>/?pilot=1&consent=0`

### Prolific production link
`https://run.pavlovia.org/<username>/<experiment>/?pilot=0&PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`

### Local testing with a local server
From the repo root:
`python3 -m http.server 8000`

Then open:
- Main entry: `http://localhost:8000/index.html?dev=1`
- Instructions only: `http://localhost:8000/index.html?dev=1&stage=instructions`
- Drone task (10 trials): `http://localhost:8000/index.html?dev=1&stage=bird&ntrials=10`
- Memory task (block 1): `http://localhost:8000/index.html?dev=1&stage=memory&block=1`
- Skip consent locally: `http://localhost:8000/index.html?dev=1&consent=0`

---

## Pre-Deployment Checklist

- [ ] `index.html` loads without console errors.
- [ ] `static/lib/jspsych-pavlovia-3.2.5.js` exists and matches the script path in `index.html`.
- [ ] `CODE_SUCCESS` and `CODE_REJECT` are replaced with real Prolific completion codes.
- [ ] Consent text in `index.html` is replaced with IRB-approved language.
- [ ] Consent is shown by default.
- [ ] `?consent=0` is used only for internal testing.
- [ ] `?pilot=1` ends with a thank-you screen and no Prolific redirect.
- [ ] `?pilot=0` redirects to Prolific after completion.
- [ ] Data rows include `pilot_mode` and `consent_shown`.
- [ ] The instruction flow has been checked after the reward/loss simplification.
- [ ] Pavlovia PILOTING works via the Pavlovia **Pilot** button.
- [ ] Stable external testing is done only after switching Pavlovia to RUNNING.
- [ ] Prolific study link uses `pilot=0`.
- [ ] Prolific study is restricted to desktop/laptop users if possible.