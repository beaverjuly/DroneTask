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

    // Initialise shared status object so the gate trial can poll it.
    window.__PRELOAD_STATUS = {
      loaded: 0,
      total:  preloadImages.length,
      failed: [],
      done:   false,
      startedAt: 0
    };

    return {
      type: 'call-function',
      func: function () {
        var t0 = performance.now();
        var total = preloadImages.length;
        window.__PRELOAD_STATUS.startedAt = t0;

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
          // Update shared status on every progress tick so the gate
          // trial (if/when it runs) can read live values.
          window.__PRELOAD_STATUS.loaded = loaded;
          if (pill) pill.textContent = 'Loading assets\u2026 ' + loaded + ' / ' + _total;
        }).then(function (result) {
          var elapsed = Math.round(performance.now() - t0);
          window.__PRELOAD_STATUS.loaded = result.loaded;
          window.__PRELOAD_STATUS.failed = result.failed;
          window.__PRELOAD_STATUS.done   = true;
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

  /**
   * Preload-completion gate. Insert this trial right BEFORE the main
   * task. If background preload is already done, the gate skips
   * instantly (no UI flash). Otherwise it shows a "Preparing your
   * mission…" screen with a live progress bar and waits for the
   * background queue to drain before letting the main task begin.
   *
   * This prevents the main task from starting with un-cached images,
   * which would otherwise force trial.js into a fallback fetch that
   * duplicates the still-in-flight preload request.
   */
  window.buildPreloadGateTrial = function () {
    return {
      type: 'call-function',
      async: true,
      func: function (done) {
        var status = window.__PRELOAD_STATUS;

        // No preload was scheduled, or it's already complete → no wait.
        if (!status || status.done) {
          console.log('[preload-gate] already done, proceeding');
          done();
          return;
        }

        console.log('[preload-gate] waiting on background preload: ' +
                    status.loaded + ' / ' + status.total);
        var gateStart = performance.now();

        var disp = (typeof jsPsych !== 'undefined' && jsPsych.getDisplayElement)
          ? jsPsych.getDisplayElement() : document.body;

        // Cosmic backdrop matching the "Starting mission" aesthetic.
        // Uses CSS-only glow particles so no extra assets are needed.
        disp.innerHTML =
          '<style>' +
            '@keyframes gateOrb{' +
              '0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.55}' +
              '50%{transform:translate(-50%,-50%) scale(1.18);opacity:.95}' +
            '}' +
            '@keyframes gateDrift{' +
              '0%{transform:translateY(0) translateX(0);opacity:.0}' +
              '20%{opacity:.55}' +
              '100%{transform:translateY(-40vh) translateX(var(--dx,0));opacity:0}' +
            '}' +
            '@keyframes gatePulse{0%,100%{opacity:.85}50%{opacity:1}}' +
          '</style>' +
          '<div id="gate-root" style="' +
            'position:fixed;inset:0;z-index:9998;overflow:hidden;' +
            'background:linear-gradient(to bottom,' +
              'hsl(230,40%,8%) 0%,hsl(230,38%,16%) 45%,hsl(230,36%,24%) 100%);' +
            'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
            'color:#e2e8f0;">' +
            // floating glow particles
            (function () {
              var s = '';
              for (var i = 0; i < 14; i++) {
                var left  = Math.round(Math.random() * 100);
                var dx    = Math.round((Math.random() - 0.5) * 16);
                var delay = (Math.random() * 6).toFixed(2);
                var dur   = (5 + Math.random() * 4).toFixed(2);
                var size  = (4 + Math.random() * 6).toFixed(1);
                s += '<div style="position:absolute;left:' + left + '%;bottom:-5%;' +
                      'width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
                      'background:radial-gradient(circle,rgba(140,180,255,.85),rgba(140,180,255,0));' +
                      '--dx:' + dx + 'vw;' +
                      'animation:gateDrift ' + dur + 's linear ' + delay + 's infinite;"></div>';
              }
              return s;
            })() +
            // central glowing orb
            '<div style="position:absolute;left:50%;top:38%;' +
              'width:140px;height:140px;transform:translate(-50%,-50%);' +
              'border-radius:50%;' +
              'background:radial-gradient(circle,rgba(120,180,255,.45) 0%,' +
                'rgba(80,120,200,.18) 45%,transparent 70%);' +
              'animation:gateOrb 2.4s ease-in-out infinite;"></div>' +
            '<div style="position:absolute;left:50%;top:38%;' +
              'width:60px;height:60px;transform:translate(-50%,-50%);' +
              'border-radius:50%;' +
              'background:radial-gradient(circle,#fff 0%,rgba(180,220,255,.6) 60%,transparent 100%);' +
              'animation:gateOrb 1.6s ease-in-out infinite;' +
              'filter:blur(.5px);"></div>' +
            // text + progress
            '<div style="position:absolute;left:50%;top:62%;' +
              'transform:translateX(-50%);text-align:center;width:90%;max-width:520px;">' +
              '<div style="font-size:26px;font-weight:800;color:#fff;' +
                'letter-spacing:.02em;animation:gatePulse 2s ease-in-out infinite;">' +
                'Preparing your mission\u2026' +
              '</div>' +
              '<div style="font-size:15px;color:rgba(226,232,240,.65);' +
                'margin-top:6px;margin-bottom:16px;">' +
                'Final calibration before liftoff.' +
              '</div>' +
              '<div style="height:8px;background:rgba(255,255,255,.12);' +
                'border-radius:999px;overflow:hidden;' +
                'border:1px solid rgba(255,255,255,.18);">' +
                '<div id="gate-bar" style="height:100%;width:0%;' +
                  'background:linear-gradient(90deg,#7ab6ff,#b794f6);' +
                  'box-shadow:0 0 12px rgba(122,182,255,.7);' +
                  'transition:width .25s ease-out;"></div>' +
              '</div>' +
              '<div id="gate-count" style="font-size:13px;color:rgba(226,232,240,.55);' +
                'margin-top:10px;letter-spacing:.04em;">' +
                status.loaded + ' / ' + status.total +
              '</div>' +
            '</div>' +
          '</div>';

        var bar   = document.getElementById('gate-bar');
        var count = document.getElementById('gate-count');

        var pollId = setInterval(function () {
          var s = window.__PRELOAD_STATUS;
          if (!s) { clearInterval(pollId); done(); return; }
          var pct = s.total ? Math.round((s.loaded / s.total) * 100) : 100;
          if (bar)   bar.style.width = pct + '%';
          if (count) count.textContent = s.loaded + ' / ' + s.total;
          if (s.done) {
            clearInterval(pollId);
            // Brief "ready" beat so the bar visibly hits 100%.
            if (bar) bar.style.width = '100%';
            var waited = Math.round(performance.now() - gateStart);
            console.log('[preload-gate] released after ' + waited + 'ms');
            try {
              jsPsych.data.addProperties({ preload_gate_wait_ms: waited });
            } catch (e) {}
            setTimeout(done, 450);
          }
        }, 120);
      }
    };
  };
})();

