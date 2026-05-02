// ═══════════════════════════════════════════════════════════════════════
// compat-gate.js — Emoji & device compatibility screener
//
// Drop-in jsPsych 6 plugin for Pavlovia + Prolific experiments that use
// newer emoji (Unicode 14.0+). Place BEFORE the consent form so
// incompatible participants can return the study immediately, before
// completing any substantive content.
//
// ── What it checks ─────────────────────────────────────────────────────
//   1.  Platform / OS: macOS 14.4+ required (via navigator.userAgent).
//       Windows, Linux, ChromeOS, and older macOS are flagged.
//   2.  Emoji rendering: two forced-choice identification questions
//       using face/body emoji from Unicode 14.0–15.1 that do NOT
//       overlap with the object emoji used in the memory task.
//       Chance of passing both by guessing: 1/4 × 1/4 = 6.25%.
//   3.  Physical keyboard: a "press spacebar" interstitial confirms
//       the participant has a keyboard (catches tablets with external
//       displays that bypassed the mobile UA check).
//
// ── Prolific compliance ────────────────────────────────────────────────
//   • The screener is short (<30 s). Incompatible participants are
//     told to return the study via "Stop without completing".
//   • The study description should state the macOS requirement.
//   • Data is tagged `trial_category: 'compat_gate'` so screened-out
//     participants can be identified and compensated per Prolific policy.
//   • `window._device_incompatible` is set to true on failure, which
//     downstream code (e.g. on_finish in jsPsych.init) can check to
//     avoid flagging screen-outs as low-quality or rejected.
//
// ── Usage ──────────────────────────────────────────────────────────────
//   <script src="static/task/compat-gate.js"></script>
//
//   // In timeline assembly (index.html):
//   timeline = timeline.concat(COMPAT_GATE.timeline);
//   // … then consent_trial, welcome, etc.
//
//   // The exported timeline is a flat array of jsPsych trial objects.
//   // If all checks pass, execution continues normally.
//   // If any check fails, jsPsych.endExperiment() is called with a
//   // return-study message.
// ═══════════════════════════════════════════════════════════════════════

var COMPAT_GATE = (function () {

  // ── Shared styles ────────────────────────────────────────────────────
  var _SHELL =
    'max-width:760px;margin:6vh auto;font-family:-apple-system,' +
    'BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;' +
    'line-height:1.6;text-align:left;padding:0 20px;';

  var _HEADER =
    'font-size:22px;font-weight:800;margin-bottom:16px;';

  var _EMOJI_ROW =
    'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:20px 0;';

  var _EMOJI_BTN =
    'font-size:48px;padding:14px 20px;border-radius:14px;' +
    'border:2px solid #d1d5db;background:#fff;cursor:pointer;' +
    'transition:border-color .12s,background .12s,transform .1s;' +
    'min-width:76px;text-align:center;line-height:1;';

  // ── Screen-out message (shown by jsPsych.endExperiment) ──────────────
  var FAIL_HTML =
    '<div style="' + _SHELL + '">' +
      '<h2 style="color:#b00020;">Device not compatible</h2>' +
      '<p style="font-size:17px;">Your device or browser does not appear ' +
        'compatible with the emoji used in this study.</p>' +
      '<p style="font-size:16px;">Please return the study on Prolific ' +
        'using <strong>Stop without completing</strong>.</p>' +
      '<p style="font-size:15px;color:#555;">If eligible, you may retake ' +
        'the study using a <strong>Mac laptop or desktop running macOS 14.4 ' +
        'or later</strong> with a recent version of Chrome, Firefox, or Safari.</p>' +
    '</div>';

  // ── Helper: end the experiment on failure ────────────────────────────
  function _failOut(data, reason) {
    data.compat_passed = false;
    data.compat_fail_reason = reason;
    window._device_incompatible = true;
    jsPsych.endExperiment(FAIL_HTML);
  }

  // ────────────────────────────────────────────────────────────────────
  // Trial 1: Platform / OS check (automatic, no user interaction)
  // ────────────────────────────────────────────────────────────────────
  var os_check = {
    type: 'call-function',
    func: function () {
      var ua = navigator.userAgent || '';
      var platform = navigator.platform || '';

      // Detect macOS
      var isMac = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(platform) ||
                  /Mac OS X/i.test(ua);

      var macVersion = null;
      if (isMac) {
        // e.g. "Mac OS X 10_15_7" or "Mac OS X 14_4_1"
        var m = ua.match(/Mac OS X\s+([\d_]+)/i);
        if (m) {
          var parts = m[1].split('_').map(Number);
          macVersion = parts;
        }
      }

      // Check macOS 14.4+
      var versionOK = false;
      if (macVersion) {
        var major = macVersion[0] || 0;
        var minor = macVersion[1] || 0;
        if (major > 14 || (major === 14 && minor >= 4)) {
          versionOK = true;
        }
      }

      window._compat_os = {
        isMac: isMac,
        macVersion: macVersion,
        versionOK: versionOK,
        userAgent: ua.substring(0, 200)
      };
    },
    data: { trial_category: 'compat_gate', compat_step: 'os_detect' }
  };

  // ────────────────────────────────────────────────────────────────────
  // Trial 2: OS gate — if not macOS 14.4+, screen out immediately.
  // Shown only if the OS check failed.
  // ────────────────────────────────────────────────────────────────────
  var os_gate_fail = {
    type: 'html-button-response',
    stimulus:
      '<div style="' + _SHELL + '">' +
        '<h2 style="color:#b00020;">macOS 14.4+ required</h2>' +
        '<p style="font-size:17px;">This study requires a <strong>Mac laptop ' +
          'or desktop running macOS 14.4 or later</strong> because some emoji ' +
          'stimuli are not available on other platforms.</p>' +
        '<p style="font-size:16px;">Please return the study on Prolific using ' +
          '<strong>Stop without completing</strong>.</p>' +
        '<p style="font-size:15px;color:#555;">We apologize for the ' +
          'inconvenience. This restriction is needed for a pilot version ' +
          'of the study and may be relaxed in a future version.</p>' +
      '</div>',
    choices: ['I understand — I will return the study'],
    on_finish: function (data) {
      _failOut(data, 'os_not_macos_14_4_plus');
    },
    data: { trial_category: 'compat_gate', compat_step: 'os_gate_fail' }
  };

  var os_gate_fail_conditional = {
    timeline: [os_gate_fail],
    conditional_function: function () {
      var os = window._compat_os || {};
      // Show the fail screen if NOT macOS 14.4+
      return !os.versionOK;
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // Trial 3: Emoji forced-choice Q1
  //   "Which emoji is the saluting face?"
  //   Options: 🫠 🫡 🥹 🫨    Correct: 🫡 (index 1)
  // ────────────────────────────────────────────────────────────────────
  var emoji_q1 = {
    type: 'html-button-response',
    stimulus:
      '<div style="' + _SHELL + '">' +
        '<div style="' + _HEADER + '">Compatibility check (1 of 2)</div>' +
        '<p style="font-size:17px;">This study uses newer emoji. ' +
          'Please answer to confirm they display correctly on your device.</p>' +
        '<p style="font-size:18px;font-weight:700;">' +
          'Which emoji below is the <u>saluting face</u>?</p>' +
        '<div style="' + _EMOJI_ROW + '" id="compat-q1-row"></div>' +
        '<p style="font-size:14px;color:#888;">Click the emoji to select.</p>' +
      '</div>',
    choices: ['🫠', '🫡', '🥹', '🫨'],
    button_html:
      '<button class="jspsych-btn" style="' + _EMOJI_BTN + '">%choice%</button>',
    on_finish: function (data) {
      // button_pressed is 0-indexed; correct = index 1 (🫡)
      var bp = parseInt(data.button_pressed, 10);
      data.compat_q1_correct = (bp === 1);
      data.compat_q1_choice = bp;
    },
    data: { trial_category: 'compat_gate', compat_step: 'emoji_q1' }
  };

  // Show Q1 only if OS check passed
  var emoji_q1_conditional = {
    timeline: [emoji_q1],
    conditional_function: function () {
      var os = window._compat_os || {};
      return os.versionOK === true;
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // Trial 4: Emoji forced-choice Q2
  //   "Which emoji is shaking its head side-to-side?"
  //   Options: 🙂‍↕️ 🫡 🫠 🙂‍↔️    Correct: 🙂‍↔️ (index 3)
  // ────────────────────────────────────────────────────────────────────
  var emoji_q2 = {
    type: 'html-button-response',
    stimulus:
      '<div style="' + _SHELL + '">' +
        '<div style="' + _HEADER + '">Compatibility check (2 of 2)</div>' +
        '<p style="font-size:18px;font-weight:700;">' +
          'Which emoji below is <u>shaking its head side-to-side</u>?</p>' +
        '<div style="' + _EMOJI_ROW + '" id="compat-q2-row"></div>' +
        '<p style="font-size:14px;color:#888;">Click the emoji to select.</p>' +
      '</div>',
    choices: ['🙂‍↕️', '🫡', '🫠', '🙂‍↔️'],
    button_html:
      '<button class="jspsych-btn" style="' + _EMOJI_BTN + '">%choice%</button>',
    on_finish: function (data) {
      // Correct = index 3 (🙂‍↔️)
      var bp = parseInt(data.button_pressed, 10);
      data.compat_q2_correct = (bp === 3);
      data.compat_q2_choice = bp;
    },
    data: { trial_category: 'compat_gate', compat_step: 'emoji_q2' }
  };

  var emoji_q2_conditional = {
    timeline: [emoji_q2],
    conditional_function: function () {
      var os = window._compat_os || {};
      return os.versionOK === true;
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // Trial 5: Evaluate emoji answers — screen out if either wrong
  // ────────────────────────────────────────────────────────────────────
  var emoji_evaluate = {
    type: 'call-function',
    func: function () {
      var trials = jsPsych.data.get()
        .filter({ trial_category: 'compat_gate' }).values();

      var q1 = null, q2 = null;
      for (var i = 0; i < trials.length; i++) {
        if (trials[i].compat_step === 'emoji_q1') q1 = trials[i];
        if (trials[i].compat_step === 'emoji_q2') q2 = trials[i];
      }

      var passed = !!(q1 && q1.compat_q1_correct && q2 && q2.compat_q2_correct);
      window._compat_emoji_passed = passed;

      if (!passed) {
        window._device_incompatible = true;
        jsPsych.endExperiment(FAIL_HTML);
      }
    },
    data: { trial_category: 'compat_gate', compat_step: 'emoji_evaluate' }
  };

  var emoji_evaluate_conditional = {
    timeline: [emoji_evaluate],
    conditional_function: function () {
      var os = window._compat_os || {};
      return os.versionOK === true;
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // Trial 6: Keyboard check — press spacebar to confirm physical keyboard
  // ────────────────────────────────────────────────────────────────────
  var keyboard_check = {
    type: 'html-keyboard-response',
    stimulus:
      '<div style="' + _SHELL + 'text-align:center;">' +
        '<div style="font-size:20px;font-weight:700;margin-bottom:14px;">' +
          '✅ Emoji check passed</div>' +
        '<p style="font-size:17px;">This study requires a <strong>physical ' +
          'keyboard</strong> (arrow keys).</p>' +
        '<p style="font-size:22px;font-weight:700;margin:28px 0;">' +
          'Press <kbd style="padding:6px 14px;border:2px solid #333;' +
          'border-radius:6px;background:#f5f5f5;font-size:18px;">' +
          'Space</kbd> to continue</p>' +
      '</div>',
    choices: [' '],
    on_finish: function (data) {
      data.compat_keyboard_ok = true;
    },
    data: { trial_category: 'compat_gate', compat_step: 'keyboard_check' }
  };

  var keyboard_check_conditional = {
    timeline: [keyboard_check],
    conditional_function: function () {
      var os = window._compat_os || {};
      return os.versionOK === true && window._compat_emoji_passed === true;
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // Trial 7: Record final compat result (always runs)
  // ────────────────────────────────────────────────────────────────────
  var compat_summary = {
    type: 'call-function',
    func: function () {
      var os = window._compat_os || {};
      console.log(
        '[COMPAT] OS: isMac=' + os.isMac +
        ', version=' + (os.macVersion ? os.macVersion.join('.') : 'unknown') +
        ', versionOK=' + os.versionOK +
        ', emoji_passed=' + window._compat_emoji_passed +
        ', device_incompatible=' + !!window._device_incompatible
      );
    },
    on_finish: function (data) {
      var os = window._compat_os || {};
      data.compat_os_is_mac = os.isMac || false;
      data.compat_os_version = os.macVersion ? os.macVersion.join('.') : null;
      data.compat_os_version_ok = os.versionOK || false;
      data.compat_emoji_passed = window._compat_emoji_passed || false;
      data.compat_all_passed = !window._device_incompatible;
      data.compat_user_agent = (os.userAgent || '').substring(0, 200);
    },
    data: { trial_category: 'compat_gate', compat_step: 'summary' }
  };

  // ────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────
  return {
    // The full timeline to concat into your experiment.
    // Insert BEFORE consent_trial in your timeline.
    timeline: [
      os_check,
      os_gate_fail_conditional,
      emoji_q1_conditional,
      emoji_q2_conditional,
      emoji_evaluate_conditional,
      keyboard_check_conditional,
      compat_summary
    ],

    // Expose individual trials for custom arrangements.
    trials: {
      os_check:             os_check,
      os_gate_fail:         os_gate_fail_conditional,
      emoji_q1:             emoji_q1_conditional,
      emoji_q2:             emoji_q2_conditional,
      emoji_evaluate:       emoji_evaluate_conditional,
      keyboard_check:       keyboard_check_conditional,
      compat_summary:       compat_summary
    }
  };
})();
