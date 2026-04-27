# Drone Task – Pavlovia Static Experiment

A browser-based drone-tracking task with memory and demographic questionnaires, migrated from Flask to Pavlovia for online recruitment via Prolific.

## Overview

This experiment presents participants with a series of drone-tracking game blocks (with varying volatility and stochasticity), followed by memory tests and demographics surveys. The original Flask-based implementation has been converted to a fully static, client-side Pavlovia project that saves data to Pavlovia's servers and redirects to Prolific upon completion.

**Key features:**
- Consent screen with bot-check honeypot
- Mobile device rejection (desktop/laptop only)
- 4 experimental blocks with counterbalanced parameters
- Memory task probing item order and proximity
- Demographics survey (age, gender, ethnicity, race, language)
- Dev modes for rapid testing and local iteration
- Pilot mode (no Prolific redirect) for testing on Pavlovia
- Production mode with Prolific success/reject redirects

## Repository Structure

```
DroneTask/
├── index.html                              # Main runtime file (root level)
├── README.md                               # This file
├── static/
│   ├── img/task_assets/reward/             # Drone images (drone0.png – drone4.png)
│   ├── js/
│   │   ├── nivturk-plugins.js              # Client-side save/redirect logic
│   │   ├── jspsych-screen-check.js         # Viewport size validation (optional)
│   │   ├── jspsych-survey-demo.js          # Demographics form
│   │   └── jspsych-survey-template.js      # Survey template
│   ├── lib/
│   │   ├── jquery-3.7.1/jquery-3.7.1.min.js
│   │   ├── jspsych-6.1.0/                  # Core jsPsych library
│   │   ├── jspsych-6.3.1/                  # Extended jsPsych plugins
│   │   └── jspsych-pavlovia-3.2.5.js       # ← YOU MUST ADD THIS FILE
│   └── task/
│       ├── trial.js                        # Main task plugin (drone tracking)
│       ├── memory_task.js                  # Memory task plugin
│       ├── stimuli.js                      # Stimulus sequences & parameters
│       ├── stimuli-details.js              # (compatibility)
│       ├── instructions.js                 # Instruction screens
│       ├── comprehension1.js               # Pre-task comprehension check
│       ├── comprehension2.js               # Post-task comprehension check
│       ├── termination.js                  # Termination screen for failures
│       └── game.min.css                    # Task styling
```

## Setup Instructions

### 1. Download the Pavlovia plugin

Before deployment, you **must** obtain the official jsPsych Pavlovia plugin and place it in `static/lib/`:

- Download `jspsych-pavlovia-3.2.5.js` from the [Pavlovia downloads page](https://pavlovia.org/docs/experiments/create-jspsych) (or current version).
- Place it at: `static/lib/jspsych-pavlovia-3.2.5.js`
- If you use a different version number, update the `<script>` tag in `index.html` line ~42.

### 2. Edit completion codes

In `index.html`, find these lines (~lines 126–127):

```javascript
var CODE_SUCCESS = 'REPLACE_WITH_PROLIFIC_SUCCESS_CODE';
var CODE_REJECT  = 'REPLACE_WITH_PROLIFIC_REJECT_CODE';
```

Replace them with the actual completion codes from your Prolific study configuration page.

### 3. Edit consent form

In `index.html`, find the `consent_trial` definition (~line 160). Replace the placeholder block:

```javascript
// ─── REPLACE THIS BLOCK WITH YOUR ACTUAL CONSENT TEXT ───
'<p><strong>[PLACEHOLDER CONSENT TEXT — replace before launch.]</strong></p>' +
// ... etc ...
// ────────────────────────────────────────────────────────
```

Insert your IRB-approved consent language, including:
- Study title and purpose
- Procedure description (duration, what participants do)
- Risks and benefits
- Confidentiality and data-handling statement
- Compensation details
- Contact information for PI and IRB (if required)
- Statement that participation is voluntary

### 4. Deploy to Pavlovia

1. Create a new experiment on [Pavlovia](https://pavlovia.org/).
2. Initialize a local Git repository:
   ```bash
   git init
   git remote add pavlovia https://gitlab.pavlovia.org/<username>/<experiment-name>.git
   git add .
   git commit -m "Initial commit: Drone task experiment"
   git push -u pavlovia master
   ```
3. On Pavlovia, set the experiment status: **INACTIVE** → **PILOTING** (testing) → **RUNNING** (live).
4. In your Prolific study, use the production link (see below).

## Running the Experiment

### Modes of Operation

The experiment supports three modes, controlled by URL parameters:

#### 1. **Pilot Mode** (default)
Use this to test on Pavlovia without triggering Prolific redirects.

- **Local:** `file:///path/to/index.html?pilot=1`
- **Pavlovia (PILOTING):** `https://run.pavlovia.org/<username>/<experiment>/`

**Behavior:**
- Participants complete the full experiment.
- Data is saved to Pavlovia.
- Final screen shows "Thank you" message; no redirect.
- Safe for testing.

#### 2. **Production Mode** (`pilot=0`)
Use this link in your Prolific study.

**Template:**
```
https://run.pavlovia.org/<username>/<experiment>/?pilot=0&PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
```

**Prolific variable mapping:**
- `{{%PROLIFIC_PID%}}` → Participant ID
- `{{%STUDY_ID%}}` → Study ID
- `{{%SESSION_ID%}}` → Session ID

**Behavior:**
- Participants complete the full experiment.
- Data is saved to Pavlovia.
- On completion:
  - **Passed** (normal behavior) → redirect to Prolific success completion URL.
  - **Failed** (bot-detected or comprehension failures) → redirect to Prolific with reject code.

#### 3. **Dev Mode** (local file:// only)
Rapid testing with reduced trials and selected task stages.

```
file:///path/to/index.html?dev=1&stage=<STAGE>&ntrials=<N>&block=<B>
```

**Parameters:**
- `dev=1` – Enable dev mode (prints debug info to console).
- `stage=full` (default) – Run the full experiment pipeline.
- `stage=instructions` – Instructions and comprehension checks only.
- `stage=bird` – Main drone task only (skips instructions).
- `stage=memory` – Memory task only (for block `<B>`).
- `stage=termination` – Termination screen (failure message).
- `ntrials=<N>` – Limit main block to N trials (default 50).
- `block=<B>` – For memory stage, test block B (1–4).

**Examples:**

Test instructions:
```
file:///path/to/index.html?dev=1&stage=instructions
```

Run drone task with 5 trials:
```
file:///path/to/index.html?dev=1&stage=bird&ntrials=5
```

Test memory task for block 2:
```
file:///path/to/index.html?dev=1&stage=memory&block=2
```

## Copy-Paste Ready Links

### For Piloting on Pavlovia

Replace `<username>` and `<experiment>` with your Pavlovia details.

**Pilot link (shows thank-you, no Prolific redirect):**
```
https://run.pavlovia.org/<username>/<experiment>/
```

Or explicitly:
```
https://run.pavlovia.org/<username>/<experiment>/?pilot=1
```

### For Production on Prolific

**Study Configuration → External study link:**

Copy and paste this into the Prolific study setup (replace placeholders):

```
https://run.pavlovia.org/<username>/<experiment>/?pilot=0&PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
```

### For Local Testing

Desktop/laptop, file:// protocol:

**Full experiment (pilot mode, no Prolific):**
```
file:///Users/yourname/path/to/DroneTask/index.html?pilot=1
```

**Instructions only:**
```
file:///Users/yourname/path/to/DroneTask/index.html?dev=1&stage=instructions
```

**Drone task with 10 trials:**
```
file:///Users/yourname/path/to/DroneTask/index.html?dev=1&stage=bird&ntrials=10
```

**Memory task, block 1:**
```
file:///Users/yourname/path/to/DroneTask/index.html?dev=1&stage=memory&block=1
```

## Pre-Deployment Checklist

- [ ] Pavlovia plugin file (`jspsych-pavlovia-3.2.5.js`) is in `static/lib/`.
- [ ] `CODE_SUCCESS` and `CODE_REJECT` are replaced with real Prolific completion codes.
- [ ] Consent form text is updated with IRB-approved language.
- [ ] Experiment has been tested in **PILOTING** status on Pavlovia with real participants (or self-test).
- [ ] Prolific study link uses the **production template** with `pilot=0`.
- [ ] Prolific study quotas and inclusion criteria are configured.
- [ ] IRB protocol covers online recruitment via Prolific and data storage on Pavlovia servers.
- [ ] Data download pipeline is set up to pull CSVs from Pavlovia project.

## Troubleshooting

### "Pavlovia plugin not detected"

The Pavlovia plugin script did not load. Check:
- Is `jspsych-pavlovia-3.2.5.js` actually in `static/lib/`?
- Does the file path in the `<script>` tag match exactly?
- Are there any network/CORS errors in the browser console?

**Workaround (local dev only):** The experiment will fall back to a local CSV download when the plugin is unavailable. This is **not** suitable for production; data will not reach Pavlovia.

### Participants redirected back to Prolific before experiment ends

- Check URL param: is it `pilot=0` or missing `pilot=`?
- Verify `CODE_SUCCESS` and `CODE_REJECT` are valid Prolific codes (not placeholder text).
- Check browser console for errors during the final `on_finish` callback.

### Mobile device shows error screen

Expected behavior. Participants must use a desktop or laptop. On Prolific, you can restrict the study to desktop/laptop via inclusion criteria if you want to reduce traffic from mobile users.

### Dev mode not working locally (file://)

Some browsers block file:// URLs from accessing other files due to CORS. Options:
1. Use a local HTTP server: `python3 -m http.server 8000` or `npx http-server`.
2. Run from Pavlovia's staging server instead (pilot mode).

## Data and Privacy

- **Pavlovia storage:** All data is saved to Pavlovia servers (encrypted at rest, GDPR-compliant). See [Pavlovia data policy](https://pavlovia.org/terms).
- **Prolific integration:** Participant IDs (`PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID`) are recorded in the jsPsych data for audit and matching.
- **No server logs on your side:** This is a static experiment; no data passes through your institution's servers. All data handling is between Pavlovia and participants' browsers.

## Key Differences from Flask Version

- **No server routes:** `/consent`, `/experiment`, `/redirect_*` routes are replaced with client-side screens and jsPsych logic.
- **No Jinja templates:** All HTML is embedded in `index.html` as jsPsych trial definitions.
- **No Python backend:** Data I/O is handled by Pavlovia's plugin; no metadata or reject logs are written locally.
- **Mobile rejection at client:** Happens in `index.html` before any jsPsych trial runs; no Flask error route needed.
- **Pilot mode toggle:** Simple URL param (`pilot=0/1`) controls Prolific redirect behavior.

## Support & Modifications

- **Task logic:** Do not edit `trial.js`, `memory_task.js`, `stimuli.js`, `instructions.js`, `comprehension1.js`, `comprehension2.js`, or `termination.js` unless you understand the consequences for timing, scoring, and counterbalancing.
- **Styling:** CSS is in `static/task/game.min.css`. Global styles can be added in the `<style>` block of `index.html`.
- **New questions:** Add survey items to `jspsych-survey-demo.js` or extend the demographics block in `index.html`.
- **Questions?** See the [jsPsych documentation](https://www.jspsych.org/) and [Pavlovia documentation](https://pavlovia.org/docs/).

---

**Version:** 3.0-emoji (Pavlovia static)  
**Last updated:** 2024  
**License:** [Specify as needed for your institution]