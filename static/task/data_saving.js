// ──────────────────────────────────────────────────────────────
// data_saving.js — Environment detection and data-saving logic
//
// Provides:
//   initEnvironment(urlParams, devMode, pilotMode)
//     → { IS_LOCAL_ENV, IS_PAVLOVIA, hasPavloviaPlugin,
//         FORCE_PAVLOVIA_SAVE, USE_PAVLOVIA, DATA_SAVE_MODE }
//     Also prints the startup environment banner.
//
//   buildMetadataStampTrial(env, ids)
//     → call-function trial that runs jsPsych.data.addProperties()
//
//   buildPavloviaPrefixTrial()
//     → pavlovia init trial
//
//   buildPavloviaSuffixTrial(participantId)
//     → pavlovia finish trial
//
//   downloadCSV(prolificPid, workerId)
//     → triggers browser CSV download, returns filename or null
//
//   buildOnFinishCallback(env, config)
//     → on_finish function for jsPsych.init
// ──────────────────────────────────────────────────────────────

/**
 * Detect hosting environment and choose data-saving strategy.
 */
function initEnvironment(urlParams, devMode, pilotMode) {
  var IS_LOCAL_ENV =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:';

  var IS_PAVLOVIA =
    window.location.hostname.indexOf('pavlovia.org') !== -1;

  var hasPavloviaPlugin =
    typeof jsPsych !== 'undefined' &&
    typeof jsPsych.plugins !== 'undefined' &&
    typeof jsPsych.plugins['pavlovia'] !== 'undefined';

  var FORCE_PAVLOVIA_SAVE = urlParams.get('pavlovia_save') === '1';
  var USE_PAVLOVIA = IS_PAVLOVIA && hasPavloviaPlugin && (!devMode || FORCE_PAVLOVIA_SAVE);

  var DATA_SAVE_MODE = USE_PAVLOVIA ? 'pavlovia' : 'download';

  console.log('───────── Environment ─────────');
  console.log('  IS_LOCAL_ENV      =', IS_LOCAL_ENV);
  console.log('  IS_PAVLOVIA       =', IS_PAVLOVIA);
  console.log('  DEV_MODE          =', devMode);
  console.log('  PILOT_MODE        =', pilotMode);
  console.log('  hasPavloviaPlugin =', hasPavloviaPlugin);
  console.log('  USE_PAVLOVIA      =', USE_PAVLOVIA);
  console.log('  DATA_SAVE_MODE    =', DATA_SAVE_MODE);
  console.log('──────────────────────────────');

  if (USE_PAVLOVIA) {
    console.log('[Pavlovia] init + finish trials will be inserted. DATA_SAVE_MODE = pavlovia.');
  } else {
    console.log('[Pavlovia] skipped — ' +
      (IS_LOCAL_ENV ? 'local environment' :
       devMode      ? 'dev-mode (?pavlovia_save=1 to override)' :
                       'plugin not found') + '. DATA_SAVE_MODE = download.');
  }

  return {
    IS_LOCAL_ENV: IS_LOCAL_ENV,
    IS_PAVLOVIA: IS_PAVLOVIA,
    hasPavloviaPlugin: hasPavloviaPlugin,
    FORCE_PAVLOVIA_SAVE: FORCE_PAVLOVIA_SAVE,
    USE_PAVLOVIA: USE_PAVLOVIA,
    DATA_SAVE_MODE: DATA_SAVE_MODE
  };
}

/**
 * Build a call-function trial that stamps metadata on every data row.
 * Must run BEFORE any task trials and BEFORE the Pavlovia finish trial.
 *
 * @param {Object} env  - from initEnvironment()
 * @param {Object} ids  - { PROLIFIC_PID, STUDY_ID, SESSION_ID, workerId, subId }
 * @param {Object} opts - { pilotMode, devMode, showConsent, latinSquareGroup,
 *                          blockOrder, blockOrderLabels }
 */
function buildMetadataStampTrial(env, ids, opts) {
  return {
    type: 'call-function',
    func: function() {
      jsPsych.data.addProperties({
        PROLIFIC_PID:                 ids.PROLIFIC_PID,
        STUDY_ID:                     ids.STUDY_ID,
        SESSION_ID:                   ids.SESSION_ID,
        workerId:                     ids.workerId,
        subId:                        ids.subId,
        pilot_mode:                   opts.pilotMode,
        dev_mode:                     opts.devMode,
        consent_shown:                opts.showConsent,
        data_save_mode:               env.DATA_SAVE_MODE,
        is_pavlovia:                  env.IS_PAVLOVIA,
        is_local_env:                 env.IS_LOCAL_ENV,
        latin_square_group:           opts.latinSquareGroup,
        latin_square_order:           opts.blockOrder.join(','),
        latin_square_order_labels:    opts.blockOrderLabels.join('|'),
        reward_uses_shifted_sequences:
          (typeof reward_uses_shifted_sequences !== 'undefined')
            ? reward_uses_shifted_sequences : null
      });
      console.log('[DATA] addProperties applied — all future data rows stamped with session metadata.');
    }
  };
}

/**
 * Trigger a browser CSV download of all jsPsych data.
 * @returns {string|null} filename on success, null on failure
 */
function downloadCSV(prolificPid, workerId) {
  try {
    var csv = jsPsych.data.get().csv();
    var filename = 'drone_task_' +
      (prolificPid || workerId || 'unknown') + '_' +
      new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('[DATA] CSV downloaded: ' + filename + ' (' + csv.length + ' bytes)');
    return filename;
  } catch (e) {
    console.error('[DATA] CSV download failed:', e);
    return null;
  }
}

/**
 * Build the on_finish callback for jsPsych.init.
 *
 * @param {Object} env    - from initEnvironment()
 * @param {Object} config - { PROLIFIC_PID, workerId, assignmentId, hitId,
 *                            PILOT_MODE, DEV_MODE, CODE_SUCCESS, CODE_REJECT,
 *                            getConsentDeclined, getLowQuality, verifyUnload }
 *   getConsentDeclined / getLowQuality are getter functions so we capture
 *   the value at on_finish time, not at construction time.
 */
function buildOnFinishCallback(env, config) {
  return function() {
    window.removeEventListener('beforeunload', config.verifyUnload);

    // Append interaction log to the last data row.
    var interaction_data = jsPsych.data.getInteractionData();
    jsPsych.data.addDataToLastTrial({ interactions: interaction_data.json() });

    // 0. Device incompatible.
    if (window._device_incompatible) {
      console.log('[COMPAT] Participant screened out — device incompatible.');
      if (env.DATA_SAVE_MODE === 'download') downloadCSV(config.PROLIFIC_PID, config.workerId);
      return;
    }

    // 1. Declined consent.
    if (config.getConsentDeclined()) {
      var declineMsg = config.PILOT_MODE
        ? '<h2>You have declined to participate</h2>' +
          '<p>Thank you for your interest. No data has been saved.</p>' +
          '<p style="font-size:14px;color:#555;">You may now close this tab.</p>'
        : '<h2>You have declined to participate</h2>' +
          '<p>Thank you for your interest. No data has been saved.</p>' +
          '<p style="font-size:14px;color:#555;">Please return to Prolific and ' +
          'select "Return study" so you are not charged for this session. ' +
          'You may now close this tab.</p>';
      document.body.innerHTML =
        '<div style="max-width:640px;margin:10vh auto;font-family:sans-serif;' +
        'text-align:center;padding:24px;border:1px solid #ddd;border-radius:8px;' +
        'background:#fff;">' + declineMsg + '</div>';
      return;
    }

    // 2. Download mode (local / dev).
    if (env.DATA_SAVE_MODE === 'download') {
      var savedFile = downloadCSV(config.PROLIFIC_PID, config.workerId);
      document.body.innerHTML =
        '<div style="max-width:640px;margin:10vh auto;font-family:sans-serif;' +
        'text-align:center;padding:24px;border:1px solid #ddd;border-radius:8px;' +
        'background:#fff;">' +
        '<h2>Session Complete</h2>' +
        (savedFile
          ? '<p style="font-size:16px;">Data saved as<br><code style="font-size:13px;' +
            'background:#f0f0f0;padding:2px 8px;border-radius:4px;">' + savedFile + '</code></p>'
          : '<p style="font-size:16px;color:#d9534f;">CSV download may have failed. ' +
            'Check browser downloads.</p>') +
        '<p style="font-size:13px;color:#777;">' +
        (config.DEV_MODE ? '[DEV] ' : '') + 'save_mode=' + env.DATA_SAVE_MODE + '</p>' +
        '<p style="font-size:14px;color:#555;">You may now close this tab.</p>' +
        '</div>';
      console.log('[DATA] on_finish complete — mode=' + env.DATA_SAVE_MODE);
      return;
    }

    // 3. Pavlovia pilot.
    if (config.PILOT_MODE) {
      console.log('[MODE] Pilot complete — data uploaded via Pavlovia finish trial.');
      document.body.innerHTML =
        '<div style="max-width:640px;margin:10vh auto;font-family:sans-serif;' +
        'text-align:center;padding:24px;border:1px solid #ddd;border-radius:8px;' +
        'background:#fff;">' +
        '<h2>Thank you for participating!</h2>' +
        '<p style="font-size:16px;">Your responses have been recorded.</p>' +
        '<p style="font-size:14px;color:#555;">You may now close this tab.</p>' +
        '</div>';
      return;
    }

    // 4. Pavlovia production: Prolific redirect.
    if (config.getLowQuality()) {
      redirect_reject(config.workerId, config.assignmentId, config.hitId, config.CODE_REJECT);
    } else {
      redirect_success(config.workerId, config.assignmentId, config.hitId, config.CODE_SUCCESS);
    }
  };
}
