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
    console.log('[Pavlovia] Session initialization and acknowledged final saving enabled.');
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
 * @param {Object} opts - session, task-version, optional-module, and
 *                        Latin-square metadata. Do not put raw trajectory
 *                        samples here; addProperties copies every field to
 *                        every jsPsych row.
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
        task_version:                 opts.taskVersion,
        stimuli_version:              opts.stimuliVersion,
        task_variant:                 opts.taskVariant,
        mouse_qc_requested:           opts.mouseQcRequested,
        mouse_qc_enabled:             opts.mouseQcEnabled,
        mouse_qc_asset_status:        opts.mouseQcAssetStatus,
        mouse_qc_module_version:      opts.mouseQcModuleVersion,
        mouse_qc_geometry_version:    opts.mouseQcGeometryVersion,
        memory_screening_requested:   opts.memoryScreeningRequested,
        memory_screening_enabled:     opts.memoryScreeningEnabled,
        memory_screening_asset_status: opts.memoryScreeningAssetStatus,
        memory_screening_version:     opts.memoryScreeningVersion,
        memory_screening_status:      opts.memoryScreeningStatus,
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
    var downloadUrl = URL.createObjectURL(blob);
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function(){URL.revokeObjectURL(downloadUrl);},30000);
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
    if (window.DroneDataRecorderActive) {
      return window.DroneDataRecorderActive.finalize(config);
    }
    // A missing recorder is a configuration error, never evidence of saving.
    window.removeEventListener('beforeunload', config.verifyUnload);
    downloadCSV(config.PROLIFIC_PID, config.workerId);
    document.body.innerHTML = '<div style="max-width:640px;margin:12vh auto;text-align:center;font:18px/1.6 system-ui">' +
      '<h1>Recording could not be confirmed</h1><p>A recovery CSV was offered for download. Keep that file and contact the researcher before closing this tab.</p></div>';
  };
}
