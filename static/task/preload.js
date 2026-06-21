// ──────────────────────────────────────────────────────────────
// preload.js — Blob-URL preload, with foreground and background
//                modes, plus on-demand single-image fetching.
//
// Provides:
//   buildPreloadImageList(stimulusSetImages, practiceStimImages)
//     → de-duplicated array of image paths to preload.
//
//   buildPreloadTrial(skipPreload, preloadImages)
//     → FOREGROUND trial: blocks the timeline with a visible
//       progress bar. Used for dev routes that skip the
//       instructions/comprehension blocks.
//
//   buildBackgroundPreloadTrial(preloadImages)
//     → BACKGROUND trial: returns immediately after kicking off
//       the loader. Loading continues while subsequent trials
//       (instructions / comprehension / practice) run. Each
//       image goes into the same blob cache the foreground
//       loader uses, so by the time the main task starts, most
//       or all images should be ready. A small status pill in
//       the corner shows progress unobtrusively.
//
//   ensurePreloaded(url)
//     → Promise. If the image is already cached, resolves
//       immediately. If not, fetches and caches it now. Called
//       just-in-time by trial.js / memory_task.js so a
//       not-yet-preloaded image is still cached BEFORE display.
//
//   resolvePreloadedUrl(originalUrl)
//     → blob-URL if preloaded, else the original URL unchanged.
//
//   Global cache shape:
//     window.__PRELOADED_IMAGES[originalUrl] = {
//       blobUrl: "blob:…",     // in-memory; instant src=
//       img:     Image,        // decoded & retained
//       promise: Promise       // pending load, used by ensurePreloaded
//     }
// ──────────────────────────────────────────────────────────────

(function () {
  // ── Tunables ──
  var CONCURRENCY        = 6;
  var PER_IMAGE_TIMEOUT  = 30000;
  var OVERALL_TIMEOUT    = 180000;

  function _getCache() {
    if (!window.__PRELOADED_IMAGES) window.__PRELOADED_IMAGES = {};
    return window.__PRELOADED_IMAGES;
  }

  // ── Single-image loader (fetch → blob → objectURL → decode) ──
  // Returns a Promise that resolves to the cache entry (or null on
  // failure). De-duplicates concurrent calls for the same URL via
  // the `promise` field on the cache entry.
  function _loadOne(url) {
    var cache = _getCache();
    var entry = cache[url];

    // Already complete?
    if (entry && entry.blobUrl) return Promise.resolve(entry);

    // Already in flight? Return the same promise.
    if (entry && entry.promise) return entry.promise;

    // Start a new load.
    var promise = new Promise(function (resolve) {
      var settled = false;
      var to = setTimeout(function () {
        if (settled) return;
        settled = true;
        console.warn('[preload] Timeout (' + PER_IMAGE_TIMEOUT + 'ms):', url);
        cache[url] = { blobUrl: null, img: null, promise: null, failed: true };
        resolve(null);
      }, PER_IMAGE_TIMEOUT);

      fetch(url).then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.blob();
      }).then(function (blob) {
        var blobUrl = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
          var done = function () {
            if (settled) return;
            settled = true;
            clearTimeout(to);
            var newEntry = { blobUrl: blobUrl, img: img, promise: null };
            cache[url] = newEntry;
            resolve(newEntry);
          };
          if (typeof img.decode === 'function') {
            img.decode().then(done, done);
          } else {
            done();
          }
        };
        img.onerror = function () {
          if (settled) return;
          settled = true;
          clearTimeout(to);
          var newEntry = { blobUrl: blobUrl, img: null, promise: null };
          cache[url] = newEntry;
          resolve(newEntry);
        };
        img.src = blobUrl;
      }).catch(function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(to);
        console.warn('[preload] Fetch error:', url, err);
        cache[url] = { blobUrl: null, img: null, promise: null, failed: true };
        resolve(null);
      });
    });

    cache[url] = { blobUrl: null, img: null, promise: promise };
    return promise;
  }

  // ── Bounded-concurrency runner ──
  function _runQueue(urls, onProgress, overallTimeoutMs) {
    var total = urls.length;
    var loaded = 0;
    var failed = [];
    var nextIdx = 0;
    var finished = false;
    var overallTimedOut = false;

    return new Promise(function (resolve) {
      function finish() {
        if (finished) return;
        finished = true;
        clearTimeout(overallTo);
        resolve({ loaded: loaded, total: total,
                  failed: failed, overallTimedOut: overallTimedOut });
      }

      var overallTo = setTimeout(function () {
        overallTimedOut = true;
        console.warn('[preload] Overall timeout. Continuing with ' +
                     loaded + '/' + total + '.');
        finish();
      }, overallTimeoutMs || OVERALL_TIMEOUT);

      function worker() {
        if (nextIdx >= total) return Promise.resolve();
        var url = urls[nextIdx++];
        return _loadOne(url).then(function (entry) {
          loaded++;
          if (!entry || !entry.blobUrl) failed.push(url);
          if (typeof onProgress === 'function') onProgress(loaded, total);
          return worker();
        });
      }

      var workers = [];
      var c = Math.min(CONCURRENCY, total);
      for (var w = 0; w < c; w++) workers.push(worker());
      Promise.all(workers).then(finish, finish);
    });
  }

  // ──────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────

  window.resolvePreloadedUrl = function (originalUrl) {
    var entry = _getCache()[originalUrl];
    return (entry && entry.blobUrl) ? entry.blobUrl : originalUrl;
  };

  /**
   * Just-in-time preload. Called by trial.js / memory_task.js
   * immediately before showing an image. Returns a Promise that
   * resolves when the image is in the cache (or has failed
   * permanently). Already-cached images resolve instantly.
   */
  window.ensurePreloaded = function (url) {
    if (!url || typeof url !== 'string') return Promise.resolve(null);
    return _loadOne(url);
  };

  window.buildPreloadImageList = function (stimulusSetImages, practiceStimImages) {
    var seen = Object.create(null);
    var images = [];

    function push(url) {
      if (typeof url !== 'string' || !url) return;
      if (seen[url]) return;
      seen[url] = true;
      images.push(url);
    }

    if (Array.isArray(stimulusSetImages)) {
      for (var i = 0; i < stimulusSetImages.length; i++) push(stimulusSetImages[i]);
    }

    if (Array.isArray(practiceStimImages)) {
      for (var j = 0; j < practiceStimImages.length; j++) {
        var x = practiceStimImages[j];
        if (typeof x === 'string' &&
            (x.indexOf('/') !== -1 || /\.png$/i.test(x))) {
          push(x);
        }
      }
    }

    return images;
  };

  /**
   * FOREGROUND preload trial. Blocks the timeline with a visible
   * progress bar. Use this when the participant is about to need
   * the images immediately (e.g. dev stages that skip instructions).
   */
  window.buildPreloadTrial = function (skipPreload, preloadImages) {
    if (skipPreload || !preloadImages || preloadImages.length === 0) return null;

    return {
      type: 'call-function',
      async: true,
      func: function (done) {
        var t0 = performance.now();
        var disp = (typeof jsPsych !== 'undefined' && jsPsych.getDisplayElement)
          ? jsPsych.getDisplayElement() : document.body;

        disp.innerHTML =
          '<div style="max-width:520px;margin:14vh auto;font-family:' +
            '-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
            'text-align:center;padding:24px;">' +
            '<p id="pl-msg" style="font-size:17px;margin-bottom:14px;color:#222;">' +
              'Loading experiment assets\u2026</p>' +
            '<div style="height:14px;background:#eee;border-radius:7px;' +
              'overflow:hidden;border:1px solid #ddd;">' +
              '<div id="pl-bar" style="height:100%;width:0%;background:' +
                'linear-gradient(90deg,#4a90e2,#357abd);transition:width .18s;">' +
              '</div>' +
            '</div>' +
            '<p id="pl-count" style="font-size:13px;color:#666;margin-top:10px;">' +
              '0 / ' + preloadImages.length + '</p>' +
          '</div>';

        var bar   = document.getElementById('pl-bar');
        var count = document.getElementById('pl-count');

        _runQueue(preloadImages, function (loaded, total) {
          var pct = Math.round((loaded / total) * 100);
          if (bar)   bar.style.width = pct + '%';
          if (count) count.textContent = loaded + ' / ' + total;
        }).then(function (result) {
          var elapsed = Math.round(performance.now() - t0);
          console.log('[preload:fg] loaded=' + result.loaded + '/' + result.total +
            ', failed=' + result.failed.length + ', elapsed=' + elapsed + 'ms');
          try {
            jsPsych.data.addProperties({
              preload_loaded:          result.loaded,
              preload_total:           result.total,
              preload_failed:          result.failed.length,
              preload_elapsed_ms:      elapsed,
              preload_overall_timeout: result.overallTimedOut,
              preload_mode:            'foreground'
            });
          } catch (e) { /* non-fatal */ }
          done();
        });
      }
    };
  };

  /**
   * BACKGROUND preload trial. Returns IMMEDIATELY so the timeline
   * proceeds to the next trial (instructions, comprehension, etc.).
   * Loading continues in the background. A small status pill in
   * the top-right corner shows progress.
   */
  window.buildBackgroundPreloadTrial = function (preloadImages) {
    if (!preloadImages || preloadImages.length === 0) return null;

    return {
      type: 'call-function',
      func: function () {
        var t0 = performance.now();
        var total = preloadImages.length;

        var pill = document.createElement('div');
        pill.id = '__preload_pill';
        pill.style.cssText =
          'position:fixed;top:10px;right:10px;z-index:99999;' +
          'padding:6px 12px;border-radius:999px;' +
          'background:rgba(0,0,0,.55);color:#fff;' +
          'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
          'font-size:12px;font-weight:600;letter-spacing:.02em;' +
          'box-shadow:0 2px 8px rgba(0,0,0,.2);pointer-events:none;' +
          'transition:opacity .4s;';
        pill.textContent = 'Loading assets\u2026 0 / ' + total;
        document.body.appendChild(pill);

        _runQueue(preloadImages, function (loaded, _total) {
          if (pill) pill.textContent = 'Loading assets\u2026 ' + loaded + ' / ' + _total;
        }).then(function (result) {
          var elapsed = Math.round(performance.now() - t0);
          console.log('[preload:bg] loaded=' + result.loaded + '/' + result.total +
            ', failed=' + result.failed.length + ', elapsed=' + elapsed + 'ms');
          try {
            jsPsych.data.addProperties({
              preload_loaded:          result.loaded,
              preload_total:           result.total,
              preload_failed:          result.failed.length,
              preload_elapsed_ms:      elapsed,
              preload_overall_timeout: result.overallTimedOut,
              preload_mode:            'background'
            });
          } catch (e) { /* non-fatal */ }

          if (pill) {
            pill.textContent = result.failed.length > 0
              ? 'Assets ready (' + result.loaded + '/' + result.total + ')'
              : 'Assets ready';
            setTimeout(function () { pill.style.opacity = '0'; }, 1500);
            setTimeout(function () {
              if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
            }, 2200);
          }
        });

        // Return immediately — call-function trial ends here,
        // next trial (instructions) starts right away.
      }
    };
  };
})();
