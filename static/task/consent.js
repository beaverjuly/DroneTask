// ──────────────────────────────────────────────────────────────
// consent.js — IRB consent screen (auto-detected by index.html)
//
// If this file is present and loaded, index.html will show the
// consent screen (unless ?consent=0).  If this file is removed
// from the repository, consent is silently skipped — no code
// changes needed in index.html.
//
// REPLACE the placeholder text below with your IRB-approved
// consent language before deploying to production.
// ──────────────────────────────────────────────────────────────

/**
 * Build the consent trial object.
 *
 * @param {Object} callbacks
 *   .onDecline()  — called when participant clicks "I do not agree"
 *   .onBot()      — called when the honeypot checkbox is triggered
 * @returns {Object} jsPsych html-button-response trial
 */
window.buildConsentTrial = function(callbacks) {
  callbacks = callbacks || {};

  return {
    type: 'html-button-response',
    stimulus:
      '<div style="max-width:820px;margin:auto;text-align:left;font-size:16px;line-height:1.45em;">' +
        '<h2 style="text-align:center;">Consent to participate</h2>' +
        '<p><strong>Study Title:</strong> Drone Tracking and Memory Study</p>' +
        '<p><strong>Purpose of the study:</strong> The purpose of this study is to understand how people learn from changing environments and remember items that appear during a computer-based task.</p>' +
        '<p><strong>What you will do:</strong> You will complete a drone-tracking game, short memory tests, and demographic questions. The study takes approximately 50 minutes.</p>' +
        '<p><strong>Risks:</strong> The risks are minimal and are similar to those of everyday computer use. You may experience mild fatigue or boredom.</p>' +
        '<p><strong>Benefits:</strong> You may not receive direct personal benefits. Your participation may help researchers better understand learning, decision-making, and memory.</p>' +
        '<p><strong>Voluntary participation:</strong> Your participation is voluntary. You may stop at any time by closing the browser window.</p>' +
        '<p><strong>Compensation:</strong> You will receive the base payment described on Prolific. You may also receive a bonus based on task performance and data quality checks, as described in the study listing.</p>' +
        '<p><strong>Confidentiality:</strong> Your responses will be stored for research purposes. Your Prolific ID and session information may be recorded to match study completion and payment, but the data will be analyzed without directly identifying you.</p>' +
        '<p><strong>Contact:</strong> If you have questions about the study, please contact [NAME] at [EMAIL]. If you have questions about your rights as a participant, please contact [IRB CONTACT].</p>' +
        '<p style="margin-top:1.5em;"><strong>By clicking "I agree" below, you confirm that you have read the above and agree to participate.</strong></p>' +
        '<div style="position:absolute;left:-9999px;top:-9999px;height:0;width:0;overflow:hidden;" aria-hidden="true">' +
          '<label>If you would like to be contacted for future studies, check this box: ' +
            '<input type="checkbox" id="future_contact" name="future_contact" tabindex="-1" autocomplete="off">' +
          '</label>' +
        '</div>' +
      '</div>',
    choices: ['I agree and wish to participate', 'I do not agree'],
    on_load: function() {
      var hp = document.getElementById('future_contact');
      if (hp) {
        hp.addEventListener('change', function() {
          if (hp.checked) window._bot_detected = true;
        });
      }
    },
    on_finish: function(data) {
      var hp = document.getElementById('future_contact');
      if (hp && hp.checked) window._bot_detected = true;

      if (window._bot_detected && callbacks.onBot) {
        callbacks.onBot();
      } else if ((data.response !== undefined ? data.response : data.button_pressed) === 1) {
        if (callbacks.onDecline) callbacks.onDecline();
      }
    },
    data: { trial_category: 'consent' }
  };
};
