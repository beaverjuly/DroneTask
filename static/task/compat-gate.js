// ═══════════════════════════════════════════════════════════════════════
// compat-gate.js v2 — Emoji & device compatibility screener
//
// Usage:
//   <script src="static/task/compat-gate.js"></script>
//   timeline = timeline.concat(COMPAT_GATE.timeline);
// ═══════════════════════════════════════════════════════════════════════

var COMPAT_GATE = (function () {

  // ── Reset global compatibility flags ────────────────────────────────
  window._compat_os = null;
  window._compat_os_ready = false;
  window._device_incompatible = false;
  window._compat_emoji_passed = false;
  window._compat_all_passed = false;
  window._compat_q1_correct = false;
  window._compat_q2_correct = false;

  // ── Async OS detection ──────────────────────────────────────────────
  (function _detectOS() {
    var ua = navigator.userAgent || '';
    var platform = navigator.platform || '';

    var isMac =
      /Macintosh|MacIntel|MacPPC|Mac68K/i.test(platform) ||
      /Mac OS X/i.test(ua);

    if (!isMac) {
      window._compat_os = {
        isMac: false,
        version: null,
        versionOK: false,
        source: 'not-mac',
        userAgent: ua.substring(0, 200)
      };
      window._compat_os_ready = true;
      return;
    }

    // Chromium Client Hints, when available.
    if (
      navigator.userAgentData &&
      typeof navigator.userAgentData.getHighEntropyValues === 'function'
    ) {
      navigator.userAgentData.getHighEntropyValues(['platformVersion'])
        .then(function (hints) {
          var raw = hints.platformVersion || '';
          var parts = raw.split('.').map(function (x) {
            return parseInt(x, 10);
          });

          var major = parts[0] || 0;
          var minor = parts[1] || 0;

          window._compat_os = {
            isMac: true,
            version: parts,
            versionOK: (major > 14 || (major === 14 && minor >= 4)),
            source: 'client-hints',
            userAgent: ua.substring(0, 200)
          };
          window._compat_os_ready = true;
        })
        .catch(function () {
          _parseUA(ua);
        });
      return;
    }

    _parseUA(ua);
  })();

  function _parseUA(ua) {
    var m = ua.match(/Mac OS X\s+([\d_]+)/i);

    if (m) {
      var parts = m[1].split('_').map(function (x) {
        return parseInt(x, 10);
      });

      var major = parts[0] || 0;
      var minor = parts[1] || 0;
      var isChromium = /Chrome\/|Chromium\//i.test(ua);

      // Chrome may freeze macOS UA at 10_15_7.
      if (major === 10 && isChromium) {
        window._compat_os = {
          isMac: true,
          version: null,
          versionOK: null,
          source: 'ua-frozen-chromium',
          userAgent: ua.substring(0, 200)
        };
      } else {
        window._compat_os = {
          isMac: true,
          version: parts,
          versionOK: (major > 14 || (major === 14 && minor >= 4)),
          source: 'ua-string',
          userAgent: ua.substring(0, 200)
        };
      }
    } else {
      window._compat_os = {
        isMac: true,
        version: null,
        versionOK: null,
        source: 'ua-no-version',
        userAgent: ua.substring(0, 200)
      };
    }

    window._compat_os_ready = true;
  }

  // ── Design tokens ───────────────────────────────────────────────────
  var _CARD =
    'max-width:640px;margin:6vh auto;padding:36px 40px;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;' +
    'line-height:1.6;background:#fff;border-radius:20px;' +
    'box-shadow:0 8px 40px rgba(15,23,42,.10),0 1px 3px rgba(0,0,0,.06);' +
    'border:1px solid rgba(148,163,184,.22);';

  var _KICKER =
    'display:inline-block;padding:4px 12px;border-radius:999px;' +
    'font-size:12px;font-weight:800;letter-spacing:.05em;' +
    'text-transform:uppercase;margin-bottom:14px;';

  var _TITLE =
    'margin:0 0 10px 0;font-size:24px;font-weight:800;line-height:1.3;color:#0f172a;';

  var _BODY = 'font-size:16px;color:#475569;margin:0 0 8px 0;';

  var _EMOJI_GRID =
    'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;' +
    'margin:24px auto;max-width:400px;';

  var _EMOJI_BTN =
    'font-size:46px;padding:16px 0;border-radius:16px;' +
    'border:2px solid #e2e8f0;background:#f8fafc;cursor:pointer;' +
    'transition:border-color .15s,background .15s,transform .1s,box-shadow .15s;' +
    'text-align:center;line-height:1;' +
    'display:flex;align-items:center;justify-content:center;min-height:80px;';

  var _EMOJI_HOVER =
    'onmouseover="this.style.borderColor=\'#3b82f6\';this.style.background=\'#eff6ff\';' +
    'this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 12px rgba(59,130,246,.18)\'" ' +
    'onmouseout="this.style.borderColor=\'#e2e8f0\';this.style.background=\'#f8fafc\';' +
    'this.style.transform=\'none\';this.style.boxShadow=\'none\'"';

  var _CONTINUE_BTN =
    'font-size:16px;font-weight:700;padding:12px 28px;' +
    'border-radius:12px;border:none;cursor:pointer;' +
    'background:#2563eb;color:#fff;' +
    'box-shadow:0 4px 14px rgba(37,99,235,.25);' +
    'transition:background .15s;';

  var FAIL_HTML =
    '<div style="' + _CARD + 'text-align:center;">' +
      '<div style="font-size:48px;margin-bottom:12px;">🚫</div>' +
      '<h2 style="' + _TITLE + 'color:#dc2626;">Device not compatible</h2>' +
      '<p style="' + _BODY + '">Your device or browser does not support the emoji used in this study.</p>' +
      '<p style="' + _BODY + '">Please return the study on Prolific using <strong>Stop without completing</strong>.</p>' +
      '<div style="margin-top:20px;padding:14px 18px;border-radius:12px;' +
        'background:#fef2f2;border:1px solid #fecaca;text-align:left;' +
        'font-size:14px;color:#991b1b;">' +
        'If eligible, you may retake the study using a <strong>Mac laptop or desktop running macOS 14.4+</strong> with Chrome, Firefox, or Safari.' +
      '</div>' +
    '</div>';

  function _failOut(data, reason) {
    data.compat_passed = false;
    data.compat_fail_reason = reason;
    window._device_incompatible = true;
    jsPsych.endExperiment(FAIL_HTML);
  }

  // ── OS result screen ────────────────────────────────────────────────
  function _osResultHTML() {
    var os = window._compat_os || {};

    if (os.isMac === false) {
      return '<div style="' + _CARD + '">' +
        '<div style="' + _KICKER + 'background:#fee2e2;color:#991b1b;">Compatibility check</div>' +
        '<h2 style="' + _TITLE + 'color:#dc2626;">macOS required</h2>' +
        '<p style="' + _BODY + '">This study requires a <strong>Mac laptop or desktop</strong> running <strong>macOS 14.4 or later</strong> because some emoji stimuli are not available on other platforms.</p>' +
        '<p style="' + _BODY + '">Please return the study on Prolific using <strong>Stop without completing</strong>.</p>' +
      '</div>';
    }

    if (os.versionOK === false) {
      var vStr = os.version ? os.version.join('.') : 'unknown';
      return '<div style="' + _CARD + '">' +
        '<div style="' + _KICKER + 'background:#fee2e2;color:#991b1b;">Compatibility check</div>' +
        '<h2 style="' + _TITLE + 'color:#dc2626;">macOS 14.4 or later required</h2>' +
        '<p style="' + _BODY + '">Your macOS version appears to be <strong>' + vStr + '</strong>, which does not support some emoji used in this study.</p>' +
        '<p style="' + _BODY + '">Please return the study on Prolific using <strong>Stop without completing</strong>.</p>' +
      '</div>';
    }

    var badge;
    if (os.versionOK === true) {
      badge =
        '<div style="display:inline-flex;align-items:center;gap:8px;' +
          'padding:8px 14px;border-radius:10px;background:#f0fdf4;' +
          'border:1px solid #bbf7d0;margin-bottom:16px;">' +
          '<span style="font-size:18px;">✅</span>' +
          '<span style="font-size:14px;color:#166534;font-weight:600;">macOS ' +
            (os.version ? os.version.join('.') : '') +
          ' detected</span>' +
        '</div>';
    } else {
      badge =
        '<div style="display:inline-flex;align-items:center;gap:8px;' +
          'padding:8px 14px;border-radius:10px;background:#f0f9ff;' +
          'border:1px solid #bae6fd;margin-bottom:16px;">' +
          '<span style="font-size:18px;">🍎</span>' +
          '<span style="font-size:14px;color:#0c4a6e;font-weight:600;">Mac detected — verifying emoji support next</span>' +
        '</div>';
    }

    return '<div style="' + _CARD + '">' +
      '<div style="' + _KICKER + 'background:#dbeafe;color:#1e40af;">Compatibility check</div>' +
      '<h2 style="' + _TITLE + '">Quick device check</h2>' +
      badge +
      '<p style="' + _BODY + '">This study uses newer emoji. On the next screens you will answer two quick questions to confirm they display correctly on your device.</p>' +
      '<p style="font-size:14px;color:#94a3b8;margin:0;">This takes about 15 seconds.</p>' +
    '</div>';
  }

  var os_check_screen = {
    type: 'html-button-response',
    stimulus:
      '<div id="compat-os-content">' +
        '<div style="' + _CARD + 'text-align:center;">' +
          '<div style="font-size:28px;margin-bottom:6px;">⏳</div>' +
          '<p style="' + _BODY + '">Checking device compatibility…</p>' +
        '</div>' +
      '</div>',
    choices: ['Continue'],
    button_html:
      '<button class="jspsych-btn" style="' + _CONTINUE_BTN +
      '" disabled id="compat-os-btn">%choice%</button>',
    on_load: function () {
      function _applyResult() {
        var os = window._compat_os || {};
        var container = document.getElementById('compat-os-content');
        if (container) container.innerHTML = _osResultHTML();

        var btn = document.getElementById('compat-os-btn');
        if (btn) {
          btn.disabled = false;

          if (os.isMac === false || os.versionOK === false) {
            btn.textContent = 'I understand — I will return the study';
            btn.style.background = '#fee2e2';
            btn.style.color = '#991b1b';
            btn.style.boxShadow = 'none';
          } else {
            btn.textContent = 'Continue to emoji check →';
          }
        }
      }

      if (window._compat_os_ready) {
        _applyResult();
        return;
      }

      var poll = setInterval(function () {
        if (!window._compat_os_ready) return;
        clearInterval(poll);
        _applyResult();
      }, 60);
    },
    on_finish: function (data) {
      var os = window._compat_os || {};

      data.compat_os_is_mac = os.isMac || false;
      data.compat_os_version = os.version ? os.version.join('.') : null;
      data.compat_os_version_ok = os.versionOK;
      data.compat_os_source = os.source || 'unknown';

      if (os.isMac === false) {
        _failOut(data, 'not_a_mac');
      } else if (os.versionOK === false) {
        _failOut(data, 'macos_version_too_old');
      }
    },
    data: { trial_category: 'compat_gate', compat_step: 'os_check' }
  };

  // ── Emoji Q1 ────────────────────────────────────────────────────────
  var emoji_q1 = {
    type: 'html-button-response',
    stimulus:
      '<div style="' + _CARD + '">' +
        '<div style="' + _KICKER + 'background:#dbeafe;color:#1e40af;">Question 1 of 2</div>' +
        '<h2 style="' + _TITLE + '">Which emoji is the <u>saluting face</u>?</h2>' +
        '<p style="' + _BODY + '">Click the correct emoji below.</p>' +
      '</div>',
    choices: ['🫠', '🫡', '🥹', '🫨'],
    button_html:
      '<button class="jspsych-btn" style="' + _EMOJI_BTN + '" ' +
      _EMOJI_HOVER + '>%choice%</button>',
    on_finish: function (data) {
      var bp = parseInt(data.button_pressed, 10);

      data.compat_q1_correct = (bp === 1);
      data.compat_q1_choice = bp;

      window._compat_q1_correct = data.compat_q1_correct;

      console.log('[COMPAT Q1]', {
        button_pressed: data.button_pressed,
        parsed: bp,
        correct: data.compat_q1_correct
      });
    },
    data: { trial_category: 'compat_gate', compat_step: 'emoji_q1' }
  };

  var emoji_q1_conditional = {
    timeline: [emoji_q1],
    conditional_function: function () {
      return !window._device_incompatible;
    }
  };

  // ── Emoji Q2 ────────────────────────────────────────────────────────
  var emoji_q2 = {
    type: 'html-button-response',
    stimulus:
      '<div style="' + _CARD + '">' +
        '<div style="' + _KICKER + 'background:#dbeafe;color:#1e40af;">Question 2 of 2</div>' +
        '<h2 style="' + _TITLE + '">Which emoji is <u>shaking its head side-to-side</u>?</h2>' +
        '<p style="' + _BODY + '">Click the correct emoji below.</p>' +
      '</div>',
    choices: ['🙂‍↕️', '🫡', '🫠', '🙂‍↔️'],
    button_html:
      '<button class="jspsych-btn" style="' + _EMOJI_BTN + '" ' +
      _EMOJI_HOVER + '>%choice%</button>',
    on_finish: function (data) {
      var bp = parseInt(data.button_pressed, 10);

      data.compat_q2_correct = (bp === 3);
      data.compat_q2_choice = bp;

      window._compat_q2_correct = data.compat_q2_correct;

      console.log('[COMPAT Q2]', {
        button_pressed: data.button_pressed,
        parsed: bp,
        correct: data.compat_q2_correct
      });
    },
    data: { trial_category: 'compat_gate', compat_step: 'emoji_q2' }
  };

  var emoji_q2_conditional = {
    timeline: [emoji_q2],
    conditional_function: function () {
      return !window._device_incompatible;
    }
  };

  // ── Evaluate emoji answers ──────────────────────────────────────────
  var emoji_evaluate = {
    type: 'call-function',
    func: function () {
      var passed =
        window._compat_q1_correct === true &&
        window._compat_q2_correct === true;

      window._compat_emoji_passed = passed;

      console.log('[COMPAT EVALUATE]', {
        q1: window._compat_q1_correct,
        q2: window._compat_q2_correct,
        passed: passed
      });

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
      return !window._device_incompatible;
    }
  };

  // ── Keyboard check ──────────────────────────────────────────────────
  var keyboard_check = {
    type: 'html-keyboard-response',
    stimulus:
      '<div style="' + _CARD + 'text-align:center;">' +
        '<div style="display:inline-flex;align-items:center;gap:8px;' +
          'padding:8px 14px;border-radius:10px;background:#f0fdf4;' +
          'border:1px solid #bbf7d0;margin-bottom:18px;">' +
          '<span style="font-size:18px;">✅</span>' +
          '<span style="font-size:14px;color:#166534;font-weight:700;">Emoji check passed</span>' +
        '</div>' +
        '<h2 style="' + _TITLE + '">Keyboard check</h2>' +
        '<p style="' + _BODY + 'margin-bottom:24px;">This study uses <strong>arrow keys</strong>. Please confirm you have a physical keyboard.</p>' +
        '<div style="display:inline-block;padding:14px 28px;border-radius:12px;' +
          'background:#f1f5f9;border:2px solid #cbd5e1;">' +
          '<span style="font-size:15px;color:#334155;font-weight:700;">Press </span>' +
          '<kbd style="display:inline-block;padding:6px 18px;border-radius:8px;' +
            'background:#fff;border:2px solid #94a3b8;font-size:16px;font-weight:800;' +
            'color:#1e293b;box-shadow:0 2px 0 #94a3b8;font-family:inherit;">Space</kbd>' +
          '<span style="font-size:15px;color:#334155;font-weight:700;"> to continue</span>' +
        '</div>' +
      '</div>',
    choices: [' '],
    on_finish: function (data) {
      data.compat_keyboard_ok = true;
      window._device_incompatible = false;
      window._compat_all_passed = true;
    },
    data: { trial_category: 'compat_gate', compat_step: 'keyboard_check' }
  };

  var keyboard_check_conditional = {
    timeline: [keyboard_check],
    conditional_function: function () {
      return !window._device_incompatible;
    }
  };

  // ── Summary ─────────────────────────────────────────────────────────
  var compat_summary = {
    type: 'call-function',
    func: function () {
      var os = window._compat_os || {};
      console.log(
        '[COMPAT] isMac=' + os.isMac +
        ' version=' + (os.version ? os.version.join('.') : 'null') +
        ' versionOK=' + os.versionOK +
        ' source=' + os.source +
        ' emoji=' + !!window._compat_emoji_passed +
        ' incompatible=' + !!window._device_incompatible
      );
    },
    on_finish: function (data) {
      var os = window._compat_os || {};

      data.compat_os_is_mac = os.isMac || false;
      data.compat_os_version = os.version ? os.version.join('.') : null;
      data.compat_os_version_ok = os.versionOK;
      data.compat_os_source = os.source || 'unknown';
      data.compat_emoji_passed = !!window._compat_emoji_passed;
      data.compat_all_passed =
        window._compat_all_passed === true &&
        window._compat_emoji_passed === true &&
        !window._device_incompatible;
      data.compat_user_agent = (os.userAgent || '').substring(0, 200);
    },
    data: { trial_category: 'compat_gate', compat_step: 'summary' }
  };

  return {
    timeline: [
      os_check_screen,
      emoji_q1_conditional,
      emoji_q2_conditional,
      emoji_evaluate_conditional,
      keyboard_check_conditional,
      compat_summary
    ]
  };

})();