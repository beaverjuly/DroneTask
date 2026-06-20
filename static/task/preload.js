// ──────────────────────────────────────────────────────────────
// preload.js — Image preload list + custom Pavlovia-optimised
//               preload trial.
//
// Provides:
//   buildPreloadImageList(stimulusSetImages, practiceStimImages)
//     → returns a de-duplicated preload_images array.
//
//   buildPreloadTrial(skipPreload, preloadImages)
//     → returns a jsPsych `call-function` trial that:
//        • loads images concurrently (bounded parallelism)
//        • decodes them with img.decode() so the bitmaps are in
//          memory, not just the bytes in the HTTP cache
//        • retains every Image object in window.__PRELOADED_IMAGES
//          so the bitmaps stay alive for the rest of the session
//          (this is what eliminates the half-rendered-image glitch
//          observed on Pavlovia — without retention the browser
//          re-fetches and re-decodes at display time)
//        • enforces per-image and overall timeouts so a single bad
//          asset can't stall the loading screen forever
//        • renders a real progress bar and "N / M" counter
//
// The jsPsych 6.3.1 `preload` plugin is intentionally NOT used:
// it doesn't retain Image refs, has no concurrency cap, and won't
// run decode(). All three matter on Pavlovia (GitLab Pages over
// Cloudflare), which is where the original symptoms appeared.
// ──────────────────────────────────────────────────────────────

/**
 * Build the de-duplicated list of images to preload.
 *
 * Emoji practice stimuli are dropped — they're text, not images.
 *
 * @param {string[]} stimulusSetImages  - main-task PNG paths
 * @param {string[]} practiceStimImages - practice stimuli (emojis filtered out)
 * @returns {string[]}
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

  // Block-intro drone art (used at every main-task block transition).
  push('static/img/task_assets/reward/drone0.png');
  push('static/img/task_assets/reward/drone1.png');
  push('static/img/task_assets/reward/drone2.png');
  push('static/img/task_assets/reward/drone3.png');
  push('static/img/task_assets/reward/drone4.png');

  // Main object PNG stimuli (200 items: 4 blocks × 50 unique).
  if (Array.isArray(stimulusSetImages)) {
    for (var i = 0; i < stimulusSetImages.length; i++) push(stimulusSetImages[i]);
  }

  // Practice stimuli that happen to be image paths (emoji strings ignored).
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
 *
 * @param {boolean}  skipPreload   - true for text-only dev stages
 * @param {string[]} preloadImages - from buildPreloadImageList()
 * @returns {Object|null} - a jsPsych call-function trial, or null if skipped
 */
function buildPreloadTrial(skipPreload, preloadImages) {
  if (skipPreload || !preloadImages || preloadImages.length === 0) return null;

  return {
    type: 'call-function',
    async: true,
    func: function(done) {
      // ── Global retention cache ──
      // Keeping every decoded Image alive for the rest of the page
      // lifetime is the single most important step for eliminating
      // the partial-paint glitch during gameplay. The browser will
      // serve subsequent <img src=...> assignments from memory, with
      // no re-fetch and no re-decode.
      if (!window.__PRELOADED_IMAGES) window.__PRELOADED_IMAGES = {};
      var cache = window.__PRELOADED_IMAGES;

      var total = preloadImages.length;
      var loaded = 0;
      var failed = [];
      var startedAt = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();

      // ── Tunables ──
      // CONCURRENCY: 6 is a safe sweet-spot on HTTP/2 / shared-CDN hosts
      //   like Pavlovia. Going higher (e.g. 16) saturates per-host TCP
      //   windows and on some networks actively slows things down.
      // PER_IMAGE_TIMEOUT_MS: any single image that takes longer than
      //   this is abandoned so it can't block the rest of the queue.
      // OVERALL_TIMEOUT_MS: ultimate safety net — if the whole preload
      //   isn't done by this point we proceed with what we have.
      var CONCURRENCY = 6;
      var PER_IMAGE_TIMEOUT_MS = 15000;
      var OVERALL_TIMEOUT_MS = 90000;

      // ── Progress UI ──
      var dispEl = (typeof jsPsych !== 'undefined' && jsPsych.getDisplayElement)
        ? jsPsych.getDisplayElement() : document.body;

      dispEl.innerHTML =
        '<div style="max-width:520px;margin:14vh auto;font-family:' +
          '-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
          'text-align:center;padding:24px;">' +
          '<p id="pl-msg" style="font-size:17px;margin-bottom:14px;color:#222;">' +
            'Loading experiment assets…</p>' +
          '<div style="height:14px;background:#eee;border-radius:7px;' +
            'overflow:hidden;border:1px solid #ddd;">' +
            '<div id="pl-bar" style="height:100%;width:0%;background:' +
              'linear-gradient(90deg,#4a90e2,#357abd);transition:width 0.18s;">' +
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

      // ── Single-image loader ──
      function loadOne(url) {
        return new Promise(function(resolve) {
          // Already cached & decoded? Resolve immediately.
          var existing = cache[url];
          if (existing && existing.complete && existing.naturalWidth > 0) {
            resolve();
            return;
          }

          var img = new Image();
          // No crossOrigin: Pavlovia serves images same-origin, and
          // requesting CORS would force a preflight and (on some
          // configurations) defeat caching.

          var settled = false;
          var to = setTimeout(function() {
            if (settled) return;
            settled = true;
            failed.push(url);
            console.warn('[preload] Timeout (' + PER_IMAGE_TIMEOUT_MS + 'ms):', url);
            resolve();
          }, PER_IMAGE_TIMEOUT_MS);

          img.onload = function() {
            // decode() forces the bitmap into memory NOW, on a
            // background thread where supported. Without this the
            // first <img src=> assignment at display time still
            // triggers a synchronous decode and paints partial scans.
            var afterDecode = function() {
              if (settled) return;
              settled = true;
              clearTimeout(to);
              cache[url] = img; // retain reference
              resolve();
            };
            if (typeof img.decode === 'function') {
              img.decode().then(afterDecode, afterDecode);
            } else {
              afterDecode();
            }
          };

          img.onerror = function() {
            if (settled) return;
            settled = true;
            clearTimeout(to);
            failed.push(url);
            console.warn('[preload] Load error:', url);
            resolve();
          };

          img.src = url;
        });
      }

      // ── Bounded-concurrency worker pool ──
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

        var nowMs = (typeof performance !== 'undefined' && performance.now)
          ? performance.now() : Date.now();
        var elapsed = Math.round(nowMs - startedAt);

        console.log('[preload] Done — loaded=' + loaded + '/' + total +
          ', failed=' + failed.length + ', elapsed=' + elapsed + 'ms' +
          (overallTimedOut ? ' (overall timeout fired)' : ''));
        if (failed.length > 0) {
          console.warn('[preload] Failed URLs (' + failed.length + '):', failed);
        }

        // Persist diagnostics for post-hoc QA on Pavlovia.
        try {
          jsPsych.data.addProperties({
            preload_loaded:           loaded,
            preload_total:            total,
            preload_failed:           failed.length,
            preload_elapsed_ms:       elapsed,
            preload_overall_timeout:  overallTimedOut,
            preload_concurrency:      CONCURRENCY
          });
        } catch (e) { /* non-fatal */ }

        done();
      }

      var overallTo = setTimeout(function() {
        overallTimedOut = true;
        console.warn('[preload] Overall timeout (' + OVERALL_TIMEOUT_MS +
          'ms). Continuing with ' + loaded + '/' + total + ' assets.');
        finish();
      }, OVERALL_TIMEOUT_MS);

      var workers = [];
      var c = Math.min(CONCURRENCY, preloadImages.length);
      for (var w = 0; w < c; w++) workers.push(runWorker());

      Promise.all(workers).then(finish, finish);
    }
  };
}
