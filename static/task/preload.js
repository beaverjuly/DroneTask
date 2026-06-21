// ──────────────────────────────────────────────────────────────
// preload.js — Blob-URL preload with bounded concurrency
//
// Provides:
//   buildPreloadImageList(stimulusSetImages, practiceStimImages)
//     → de-duplicated array of image paths to preload.
//
//   buildPreloadTrial(skipPreload, preloadImages)
//     → jsPsych call-function trial (async).  Downloads every
//       image via fetch(), converts to an in-memory blob, and
//       stores a blob-URL + decoded Image in:
//
//         window.__PRELOADED_IMAGES[originalUrl] = {
//           blobUrl: "blob:…",
//           img:     Image          // decoded & retained
//         }
//
//       Downstream code calls resolvePreloadedUrl(url) to get the
//       blob-URL (falls back to the original URL on cache miss).
//       Because blob-URLs reference in-memory data the browser
//       never re-fetches over the network, and because the Image
//       is decoded the bitmap is ready immediately.
//
//   resolvePreloadedUrl(originalUrl)
//     → blob-URL if preloaded, else the original URL unchanged.
//       Safe to call before preload runs (returns the original).
// ──────────────────────────────────────────────────────────────

/**
 * Resolve an original asset URL to its in-memory blob-URL.
 * Both trial.js and memory_task.js call this so that every
 * <img src=…> assignment reads from RAM, not from the network.
 */
window.resolvePreloadedUrl = function(originalUrl) {
  var cache = window.__PRELOADED_IMAGES;
  var entry = cache && cache[originalUrl];
  return (entry && entry.blobUrl) ? entry.blobUrl : originalUrl;
};

/**
 * Build the de-duplicated list of images to preload.
 */
function buildPreloadImageList(stimulusSetImages, practiceStimImages) {
  var seen = Object.create(null);
  var images = [];

  function push(url) {
    if (typeof url !== 'string' || !url) return;
    if (seen[url]) return;
    seen[url] = true;
    images.push(url);
  }

  // Block-intro drone art — kept in the preload list even if
  // index.html no longer uses it, so that any straggling ref
  // still resolves from the cache.  Harmless to include.
  push('static/img/task_assets/reward/drone0.png');
  push('static/img/task_assets/reward/drone1.png');
  push('static/img/task_assets/reward/drone2.png');
  push('static/img/task_assets/reward/drone3.png');
  push('static/img/task_assets/reward/drone4.png');

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
}

/**
 * Build the preload trial.
 */
function buildPreloadTrial(skipPreload, preloadImages) {
  if (skipPreload || !preloadImages || preloadImages.length === 0) return null;

  return {
    type: 'call-function',
    async: true,
    func: function(done) {
      if (!window.__PRELOADED_IMAGES) window.__PRELOADED_IMAGES = {};
      var cache = window.__PRELOADED_IMAGES;

      var total = preloadImages.length;
      var loaded = 0;
      var failed = [];
      var t0 = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();

      // ── Tunables ──
      var CONCURRENCY        = 6;
      var PER_IMAGE_TIMEOUT  = 30000;   // generous for slow Pavlovia
      var OVERALL_TIMEOUT    = 120000;

      // ── Progress UI ──
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
            '0 / ' + total + '</p>' +
        '</div>';

      var bar   = document.getElementById('pl-bar');
      var count = document.getElementById('pl-count');

      function updateProgress() {
        var pct = Math.round((loaded / total) * 100);
        if (bar)   bar.style.width = pct + '%';
        if (count) count.textContent = loaded + ' / ' + total;
      }

      // ── Single-image loader (fetch → blob → objectURL → decode) ──
      function loadOne(url) {
        return new Promise(function(resolve) {
          // Already cached?
          if (cache[url] && cache[url].blobUrl) { resolve(); return; }

          var settled = false;
          var to = setTimeout(function() {
            if (settled) return;
            settled = true;
            failed.push(url);
            console.warn('[preload] Timeout (' + PER_IMAGE_TIMEOUT + 'ms):', url);
            resolve();
          }, PER_IMAGE_TIMEOUT);

          fetch(url).then(function(resp) {
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return resp.blob();
          }).then(function(blob) {
            var blobUrl = URL.createObjectURL(blob);

            // Create an Image from the blob-URL and decode it so
            // the bitmap is warm and ready for instant display.
            var img = new Image();
            img.onload = function() {
              var done2 = function() {
                if (settled) return;
                settled = true;
                clearTimeout(to);
                cache[url] = { blobUrl: blobUrl, img: img };
                resolve();
              };
              if (typeof img.decode === 'function') {
                img.decode().then(done2, done2);
              } else {
                done2();
              }
            };
            img.onerror = function() {
              // Blob created but image decode failed — unusual.
              if (settled) return;
              settled = true;
              clearTimeout(to);
              cache[url] = { blobUrl: blobUrl, img: null };
              resolve();
            };
            img.src = blobUrl;
          }).catch(function(err) {
            if (settled) return;
            settled = true;
            clearTimeout(to);
            failed.push(url);
            console.warn('[preload] Fetch error:', url, err);
            resolve();
          });
        });
      }

      // ── Bounded-concurrency pool ──
      var nextIdx = 0;
      function runWorker() {
        if (nextIdx >= preloadImages.length) return Promise.resolve();
        var url = preloadImages[nextIdx++];
        return loadOne(url).then(function() {
          loaded++;
          updateProgress();
          return runWorker();
        });
      }

      var finished = false;
      var overallTimedOut = false;

      function finish() {
        if (finished) return;
        finished = true;
        clearTimeout(overallTo);

        var now = (typeof performance !== 'undefined' && performance.now)
          ? performance.now() : Date.now();
        var elapsed = Math.round(now - t0);

        console.log('[preload] Done — loaded=' + loaded + '/' + total +
          ', failed=' + failed.length + ', elapsed=' + elapsed + 'ms' +
          (overallTimedOut ? ' (overall timeout)' : ''));
        if (failed.length > 0) {
          console.warn('[preload] Failed URLs (' + failed.length + '):', failed);
        }

        try {
          jsPsych.data.addProperties({
            preload_loaded:          loaded,
            preload_total:           total,
            preload_failed:          failed.length,
            preload_elapsed_ms:      elapsed,
            preload_overall_timeout: overallTimedOut,
            preload_concurrency:     CONCURRENCY
          });
        } catch (e) { /* non-fatal */ }

        done();
      }

      var overallTo = setTimeout(function() {
        overallTimedOut = true;
        console.warn('[preload] Overall timeout (' + OVERALL_TIMEOUT +
          'ms). Continuing with ' + loaded + '/' + total + ' assets.');
        finish();
      }, OVERALL_TIMEOUT);

      var workers = [];
      var c = Math.min(CONCURRENCY, preloadImages.length);
      for (var w = 0; w < c; w++) workers.push(runWorker());

      Promise.all(workers).then(finish, finish);
    }
  };
}
