/*
 * nivturk-plugins.js  (Pavlovia / static version)
 * ---------------------------------------------------------------
 * The original Flask-based version POSTed data to server routes
 * (/experiment, /redirect_success, /redirect_reject, /redirect_error).
 *
 * This rewrite removes all Flask calls. Data saving is handled by
 * the Pavlovia plugin (added to the timeline in index.html). This
 * file now only provides:
 *   - pass_message(msg): console-log passthrough (no-op network).
 *   - redirect_success(workerId, assignmentId, hitId, code):
 *       triggers a Pavlovia-side data save (if available) and then
 *       sends the participant to the Prolific success URL.
 *   - redirect_reject([workerId, assignmentId, hitId,] code_or_err):
 *       same, but routes to the Prolific decoy URL (4-arg form) or
 *       shows an in-page error screen (1-arg legacy form).
 *   - redirect_error(error): shows an in-page error screen.
 *
 * If the Pavlovia plugin is NOT loaded (e.g. local file:// dev), a
 * CSV download of jsPsych data is triggered instead so you can
 * still inspect the output. This preserves local dev utility.
 * ---------------------------------------------------------------
 */

(function () {

  // ───────────────────────────────────────────────────────────
  // Configurable Prolific endpoints (fixed; only the completion
  // code varies between success and reject).
  // ───────────────────────────────────────────────────────────
  var PROLIFIC_BASE_URL = 'https://app.prolific.com/submissions/complete?cc=';

  // ───────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────
  function _isPavloviaAvailable() {
    return (typeof pavlovia !== 'undefined') ||
           (typeof jsPsych !== 'undefined' &&
            typeof jsPsych.plugins !== 'undefined' &&
            typeof jsPsych.plugins['pavlovia'] !== 'undefined');
  }

  function _downloadCsvFallback(filename) {
    try {
      if (typeof jsPsych === 'undefined' || !jsPsych.data) return;
      var csv = jsPsych.data.get().csv();
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || ('jspsych_data_' + Date.now() + '.csv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('[nivturk-plugins] Local CSV download triggered:', a.download);
    } catch (err) {
      console.error('[nivturk-plugins] Local CSV download failed:', err);
    }
  }

  function _showInPageError(msg) {
    try {
      // Try to clear the jsPsych display if it exists.
      var el = document.querySelector('.jspsych-display-element') || document.body;
      el.innerHTML =
        '<div style="max-width:640px;margin:10vh auto;font-family:sans-serif;' +
        'text-align:center;padding:24px;border:1px solid #ddd;border-radius:8px;' +
        'background:#fff;">' +
        '<h2 style="color:#b00020;">Something went wrong</h2>' +
        '<p style="font-size:16px;">' + (msg || 'An error occurred.') + '</p>' +
        '<p style="font-size:14px;color:#555;">Please return the study on Prolific ' +
        'and contact the researcher if the problem persists.</p>' +
        '</div>';
    } catch (e) {
      alert(msg || 'An error occurred.');
    }
  }

  function _redirectTo(url) {
    try {
      window.location.replace(url);
    } catch (e) {
      window.location.href = url;
    }
  }

  // ───────────────────────────────────────────────────────────
  // Public API (globals, to match the old signature)
  // ───────────────────────────────────────────────────────────

  // Original behaviour: POST a message to Flask. No server now, so
  // we simply log it. Kept to preserve any existing call sites.
  window.pass_message = function (msg) {
    console.log('[nivturk-plugins] pass_message:', msg);
  };

  // Successful completion: save data, then redirect to Prolific
  // success URL with the completion code.
  //
  // Signature preserved:
  //   redirect_success(workerId, assignmentId, hitId, code_success)
  window.redirect_success = function (workerId, assignmentId, hitId, code_success) {
    var url = PROLIFIC_BASE_URL + encodeURIComponent(code_success || '');

    if (_isPavloviaAvailable()) {
      // The Pavlovia "finish" timeline trial already saves data.
      // We just redirect here. A short delay gives Pavlovia's
      // asynchronous save a chance to complete on slow networks.
      console.log('[nivturk-plugins] Success redirect via Pavlovia. URL =', url);
      setTimeout(function () { _redirectTo(url); }, 750);
    } else {
      // Local / static dev: fall back to CSV download.
      _downloadCsvFallback('drone_task_success_' + (workerId || 'anon') + '.csv');
      console.log('[nivturk-plugins] (dev) Would redirect to:', url);
      // Still redirect so the flow matches production behaviour.
      setTimeout(function () { _redirectTo(url); }, 1500);
    }
  };

  // Unsuccessful completion.
  // Preserves BOTH original call signatures:
  //   redirect_reject(workerId, assignmentId, hitId, code_reject)  -> Prolific decoy
  //   redirect_reject(errorCode)                                    -> show error page
  window.redirect_reject = function () {
    if (arguments.length >= 4) {
      var workerId     = arguments[0];
      var code_reject  = arguments[3];
      var url = PROLIFIC_BASE_URL + encodeURIComponent(code_reject || '');

      if (_isPavloviaAvailable()) {
        console.log('[nivturk-plugins] Reject redirect via Pavlovia. URL =', url);
        setTimeout(function () { _redirectTo(url); }, 750);
      } else {
        _downloadCsvFallback('drone_task_reject_' + (workerId || 'anon') + '.csv');
        console.log('[nivturk-plugins] (dev) Would redirect to:', url);
        setTimeout(function () { _redirectTo(url); }, 1500);
      }
    } else {
      // Legacy single-arg form: treat as an error code and show a
      // static in-page error screen (no server-side /error/<n>).
      var error = arguments[0];
      _showInPageError('Error code: ' + error);
    }
  };

  // Error path: show an in-page error screen. No Flask /error/ route.
  window.redirect_error = function (error) {
    _showInPageError('Error code: ' + error);
  };

})();
