/**
 * jsPsych plugin for pavlovia.org
 * Original author Alain Pitiot, copyright (c) 2020 Ilixa Ltd., MIT License.
 * Local revision 2026.10.26 waits for server acknowledgements. Checkpoints
 * save snapshots without closing the current Pavlovia session.
 */
jsPsych.plugins.pavlovia = (function () {
  'use strict';
  var VERSION = '2026.10.26.acknowledged';
  var TIMEOUT_MS = 20000, MAX_ATTEMPTS = 3, RETRY_DELAYS_MS = [750, 2000];
  var config = null, serverParameters = new Map(), queue = Promise.resolve();
  var lastStored = null, finalReceipt = null, finalCsv = null, beforeUnloadListener = null, pageHideListener = null;
  var state = { version: VERSION, status: 'NOT_INITIALIZED', storage_mode: null,
    active_operation: null, last_error: null, last_receipt: null, close_beacon_queued: null };
  var plugin = {};

  function bytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    if (typeof Blob !== 'undefined') return new Blob([text]).size;
    return unescape(encodeURIComponent(text)).length;
  }
  function failure(operation, status, message, retryable) {
    var error = new Error(message || 'The server has not confirmed this operation.');
    error.name = 'PavloviaTransportError'; error.operation = operation;
    error.status = Number(status) || 0; error.retryable = !!retryable;
    return error;
  }
  function errorRecord(error) {
    return { name: error && error.name || 'Error', operation: error && error.operation || 'transport',
      status: Number(error && error.status) || 0, retryable: !!(error && error.retryable),
      attempts: Number(error && error.attempts) || 1,
      message: error && error.message || 'Server confirmation unavailable.' };
  }
  function enqueue(action) {
    var result = queue.then(action); queue = result.catch(function () {}); return result;
  }
  function delay(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function request(options, operation) {
    return new Promise(function (resolve, reject) {
      $.ajax(Object.assign({ dataType: 'json', timeout: TIMEOUT_MS }, options)).done(function (data) {
        if (data && typeof data === 'object' && data.error) {
          reject(failure(operation, 0, 'The server rejected the ' + operation + ' request.', false));
        } else resolve(data);
      }).fail(function (xhr, textStatus) {
        var status = Number(xhr && xhr.status) || 0;
        reject(failure(operation, status, 'The ' + operation + ' request was not confirmed' +
          (status ? ' (HTTP ' + status + ').' : ' (' + (textStatus === 'timeout' ? 'timeout' : 'connection error') + ').'),
          status === 0 || status === 408 || status === 429 || status >= 500));
      });
    });
  }
  async function withRetry(action, maxAttempts) {
    maxAttempts = maxAttempts || MAX_ATTEMPTS;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try { return { data: await action(), attempts: attempt }; }
      catch (error) {
        error.attempts = attempt;
        if (!error.retryable || attempt === maxAttempts) throw error;
        await delay(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
      }
    }
  }
  function apiPath() {
    return config.pavlovia.URL.replace(/\/$/, '') + '/api/v2/experiments/' +
      encodeURIComponent(config.experiment.fullpath) + '/sessions';
  }
  function requireOpen() {
    if (!config || !config.session || config.session.status !== 'OPEN')
      throw failure('session', 0, 'A confirmed open Pavlovia session is required.', false);
  }
  function timestamp() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) +
      '_' + ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2) + '.' +
      ('0' + d.getSeconds()).slice(-2) + '.' + d.getMilliseconds();
  }
  function filename(options) {
    if (options.key) {
      if (typeof options.key !== 'string' || /[\\/\u0000-\u001f]/.test(options.key) ||
          options.key.length > 240 || !/\.csv$/i.test(options.key))
        throw failure('filename', 0, 'The data filename is not valid.', false);
      return options.key;
    }
    var participant = String(options.participantId || 'PARTICIPANT').replace(/[^a-zA-Z0-9_.-]/g, '_');
    return config.experiment.name + '_' + participant + '_SESSION_' + timestamp() + '.csv';
  }
  function offerDownload(key, csv) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, key); return;
    }
    var link = document.createElement('a'), url = window.URL.createObjectURL(blob);
    link.href = url; link.download = key;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
  }
  function attachExitProtection() {
    if (!beforeUnloadListener) {
      beforeUnloadListener = function (event) {
        if (!config || !config.session || config.session.status !== 'OPEN') return;
        event.preventDefault(); event.returnValue = '';
      };
      window.addEventListener('beforeunload', beforeUnloadListener);
    }
    if (!pageHideListener) {
      pageHideListener = function (event) {
        if (event && event.persisted) return;
        if (!config || !config.session || config.session.status !== 'OPEN') return;
        if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
          state.close_beacon_queued = false; return;
        }
        // Only a small close signal. The recorder journals and checkpoints
        // completed rows; a full CSV must never be submitted through Beacon.
        try {
          var body = new FormData(); body.append('isCompleted', 'false');
          state.close_beacon_queued = navigator.sendBeacon(
            apiPath() + '/' + config.session.token + '/delete', body) === true;
        } catch (error) { state.close_beacon_queued = false; }
        // Queued is not acknowledged. Do not mark this session closed here.
      };
      window.addEventListener('pagehide', pageHideListener);
    }
  }
  function detachExitProtection() {
    if (beforeUnloadListener) window.removeEventListener('beforeunload', beforeUnloadListener);
    if (pageHideListener) window.removeEventListener('pagehide', pageHideListener);
    beforeUnloadListener = null; pageHideListener = null;
  }
  async function initialize(options) {
    options = options || {};
    if (config && config.session && config.session.status === 'OPEN')
      return Object.assign(plugin.state(), { acknowledged: true, session_open: true });
    if (config && config.session && config.session.status === 'CLOSED')
      throw failure('init', 0, 'This session is closed. Start a new session to continue.', false);
    state.active_operation = 'init'; state.status = 'INITIALIZING';
    try {
      var configured = await withRetry(function () {
        return request({ url: options.configURL || 'config.json', type: 'GET' }, 'configuration');
      });
      var next = configured.data;
      if (next && next.psychoJsManager) {
        delete next.psychoJsManager; next.pavlovia = { URL: 'https://pavlovia.org' };
      }
      if (!next || !next.experiment || !next.experiment.name || !next.experiment.fullpath ||
          !next.pavlovia || !next.pavlovia.URL)
        throw failure('configuration', 0, 'The Pavlovia configuration is incomplete.', false);
      config = next; serverParameters = new Map();
      new URLSearchParams(window.location.search.slice(1)).forEach(function (value, key) {
        if (key.indexOf('__') === 0) serverParameters.set(key, value);
      });
      var body = {};
      if (serverParameters.has('__pilotToken')) body.pilotToken = serverParameters.get('__pilotToken');
      // No client idempotency key exists for session creation. Automatically
      // retrying an ambiguous POST could reserve more than one server credit.
      var opened = await withRetry(function () {
        return request({ url: apiPath(), type: 'POST', data: body }, 'session opening');
      }, 1);
      if (!opened.data || !opened.data.token || !opened.data.experiment)
        throw failure('session opening', 0, 'The server returned an incomplete session acknowledgement.', false);
      config.session = { token: opened.data.token, status: 'OPEN' };
      config.experiment.status = opened.data.experiment.status2;
      config.experiment.saveIncompleteResults = opened.data.experiment.saveIncompleteResults;
      state.storage_mode = config.experiment.status === 'RUNNING' && !serverParameters.has('__pilotToken') ? 'upload' : 'download';
      state.status = 'OPEN'; state.last_error = null;
      attachExitProtection(); return Object.assign(plugin.state(), { acknowledged: true, session_open: true });
    } catch (error) {
      state.status = 'INIT_FAILED'; state.last_error = errorRecord(error); throw error;
    } finally { state.active_operation = null; }
  }
  async function store(options) {
    requireOpen();
    if (!options || typeof options.csv !== 'string')
      throw failure('upload', 0, 'CSV data is required for this save.', false);
    var key = filename(options);
    if (lastStored && lastStored.key === key && lastStored.csv === options.csv)
      return Object.assign({}, lastStored.receipt);
    var receipt = { disposition: state.storage_mode === 'upload' ? 'uploaded' : 'downloaded',
      acknowledged: false, filename: key, payload_bytes: bytes(options.csv), attempts: 0,
      session_closed: false, local_download_offered: false };
    if (state.storage_mode === 'upload') {
      var response = await withRetry(function () {
        return request({ url: apiPath() + '/' + config.session.token + '/results', type: 'POST',
          data: { key: key, value: options.csv } }, 'data upload');
      });
      receipt.attempts = response.attempts; receipt.acknowledged = true;
    } else { offerDownload(key, options.csv); receipt.local_download_offered = true; }
    // One exact snapshot is retained only until the next snapshot or final
    // close. A failed close retry therefore cannot offer the same file twice.
    lastStored = { key: key, csv: options.csv, receipt: receipt };
    state.last_receipt = Object.assign({}, receipt); return receipt;
  }
  async function closeSession(options) {
    options = options || {};
    if (config && config.session && config.session.status === 'CLOSED')
      return { acknowledged: true, session_closed: true, already_closed: true, attempts: 0 };
    requireOpen();
    var response = await withRetry(function () {
      return request({ url: apiPath() + '/' + config.session.token, type: 'DELETE',
        data: { isCompleted: options.isCompleted === true } }, 'session closing');
    });
    config.session.status = 'CLOSED'; state.status = 'CLOSED'; detachExitProtection();
    return { acknowledged: true, session_closed: true, attempts: response.attempts };
  }
  async function runOperation(name, action) {
    state.active_operation = name;
    try {
      var receipt = await action(); state.last_error = null;
      state.last_receipt = Object.assign({}, receipt); return receipt;
    } catch (error) { state.last_error = errorRecord(error); throw error; }
    finally { state.active_operation = null; }
  }
  plugin.initialize = function (options) { return enqueue(function () { return initialize(options); }); };
  plugin.checkpoint = function (options) {
    return enqueue(function () { return runOperation('checkpoint', function () { return store(options); }); });
  };
  plugin.finalize = function (options) {
    options = options || {};
    return enqueue(function () {
      return runOperation('finalize', async function () {
        if (finalReceipt) {
          if ((!options.key || finalReceipt.filename === options.key) && options.csv === finalCsv)
            return Object.assign({}, finalReceipt);
          throw failure('finalize', 0, 'This session has already been finalized.', false);
        }
        var receipt = await store(options);
        var closed = await closeSession({ isCompleted: options.isCompleted !== false });
        receipt.session_closed = closed.session_closed; receipt.close_attempts = closed.attempts;
        finalReceipt = Object.assign({}, receipt); finalCsv = options.csv; lastStored = null; return receipt;
      });
    });
  };
  plugin.closeSession = function (options) {
    return enqueue(function () { return runOperation('close', function () { return closeSession(options); }); });
  };
  plugin.state = function () {
    return { version: VERSION, status: state.status, storage_mode: state.storage_mode,
      active_operation: state.active_operation,
      last_error: state.last_error ? Object.assign({}, state.last_error) : null,
      last_receipt: state.last_receipt ? Object.assign({}, state.last_receipt) : null,
      close_beacon_queued: state.close_beacon_queued };
  };
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function blockingFailure(display, trial, error, retry, csv, key) {
    console.error('[Pavlovia transport]', errorRecord(error));
    if (typeof trial.errorCallback === 'function') {
      try { trial.errorCallback(errorRecord(error)); } catch (callbackError) {
        console.error('[Pavlovia error callback]', callbackError && callbackError.name || 'Error');
      }
    }
    display.innerHTML = '<div style="max-width:680px;margin:12vh auto;text-align:center;padding:28px;line-height:1.6">' +
      '<h2>' + (trial.command === 'init' ? 'The session could not connect' : 'Your save has not been confirmed') + '</h2>' +
      '<p>Please keep this tab open. Check your connection, then try again.</p>' +
      '<p>' + escapeHtml(error.message || 'Server confirmation unavailable.') + '</p>' +
      '<button type="button" id="pavlovia-retry">Try again</button>' +
      (csv ? ' <button type="button" id="pavlovia-recovery">Download recovery file</button>' : '') +
      '<p>If the problem continues, contact the researcher.</p></div>';
    display.querySelector('#pavlovia-retry').addEventListener('click', retry);
    if (csv) display.querySelector('#pavlovia-recovery').addEventListener('click', function () {
      offerDownload(key || 'drone_task_recovery.csv', csv);
    });
  }
  plugin.info = { name: 'pavlovia', description: 'Acknowledged Pavlovia session and data transport', parameters: {
    command: { type: jsPsych.plugins.parameterType.STRING, default: 'init' },
    participantId: { type: jsPsych.plugins.parameterType.STRING, default: 'PARTICIPANT' },
    key: { type: jsPsych.plugins.parameterType.STRING, default: null },
    errorCallback: { type: jsPsych.plugins.parameterType.FUNCTION, default: null }
  } };
  plugin.trial = function (display, trial) {
    var busy = false, command = String(trial.command || 'init').toLowerCase();
    var csv = command === 'finish' || command === 'checkpoint' ? jsPsych.data.get().csv() : null;
    // Capture the filename once for every automatic and manual retry.
    var key = trial.key || null;
    function run() {
      if (busy) return; busy = true;
      display.innerHTML = '<div style="max-width:680px;margin:12vh auto;text-align:center;padding:28px">' +
        '<h2>' + (command === 'init' ? 'Connecting your session' : 'Saving your responses') + '</h2>' +
        '<p>Please keep this tab open.</p></div>';
      var operation;
      try {
        if (csv !== null && !key) { requireOpen(); key = filename(trial); }
        if (command === 'init') operation = plugin.initialize();
        else if (command === 'finish') operation = plugin.finalize({ participantId: trial.participantId, key: key, csv: csv });
        else if (command === 'checkpoint') operation = plugin.checkpoint({ participantId: trial.participantId, key: key, csv: csv });
        else operation = Promise.reject(failure('command', 0, 'The Pavlovia command is not supported.', false));
      } catch (error) { operation = Promise.reject(error); }
      operation.then(function (receipt) {
        display.innerHTML = '';
        jsPsych.finishTrial({ pavlovia_command: command, pavlovia_transport_version: VERSION,
          pavlovia_acknowledged: receipt.acknowledged === true, pavlovia_session_closed: receipt.session_closed === true,
          pavlovia_filename: receipt.filename || null, pavlovia_disposition: receipt.disposition || null,
          pavlovia_payload_bytes: receipt.payload_bytes || null, pavlovia_attempts: receipt.attempts || null });
      }).catch(function (error) { busy = false; blockingFailure(display, trial, error, run, csv, key); });
    }
    run();
  };
  return plugin;
})();
