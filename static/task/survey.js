// ──────────────────────────────────────────────────────────────
// survey.js — Post-task demographics / debrief survey
//
// Provides:
//   buildSurveyTrial()
//     → jsPsych survey-demo trial object
//
// Loaded by index.html. Uses the jspsych-survey-demo plugin
// (static/js/jspsych-survey-demo.js), which must be loaded first.
//
// To test in isolation:
//   ?dev=1&stage=survey&consent=0
// ──────────────────────────────────────────────────────────────

/**
 * Build the demographics / debrief survey trial.
 *
 * @param {Object} [opts]
 *   .buttonLabel  - label for the submit button (default: 'Continue')
 * @returns {Object} jsPsych trial
 */
window.buildSurveyTrial = function (opts) {
  opts = opts || {};
  return {
    type: 'survey-demo',
    button_label: opts.buttonLabel || 'Continue'
  };
};
