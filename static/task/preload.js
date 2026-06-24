// ──────────────────────────────────────────────────────────────
// preload.js — Blob-URL preload with failure tracking, fallback
//               emoji pool, and per-trial display diagnostics.
//
// Public API (all on window):
//   buildPreloadImageList(stimulusSetImages, practiceStimImages)
//   buildPreloadTrial(skipPreload, preloadImages)     — foreground
//   buildBackgroundPreloadTrial(preloadImages)         — background
//   buildPreloadGateTrial()                            — blocks until done
//   resolvePreloadedUrl(url)     → blob-URL or original
//   ensurePreloaded(url)         → Promise (cache or fetch)
//   isPreloadFailed(url)         → boolean
//   getFallbackEmoji(url)        → deterministic emoji string
//   logDisplayOutcome(url, outcome, fallback)  → records for stamping
//
// Globals:
//   __PRELOADED_IMAGES   — { url: {blobUrl, img, promise, failed} }
//   __PRELOAD_STATUS     — { loaded, total, failed:[], done }
//   __PRELOAD_FAILED_URLS — string[] of URLs that permanently failed
//   __DISPLAY_LOG        — [{url, outcome, fallback}] per stimulus shown
//   FALLBACK_EMOJI       — string[] of 39 uncommon animal/building emoji
// ──────────────────────────────────────────────────────────────

(function () {

  // ── Tunables ──
  var CONCURRENCY        = 6;
  var PER_IMAGE_TIMEOUT  = 30000;
  var OVERALL_TIMEOUT    = 1800000; // 30 min

  // ── Fallback emoji pool ──────────────────────────────────────
  // 39 uncommon, full-body animals + buildings. ALL Unicode 6.0
  // (macOS 10.7+ / Windows 8+ / iOS 5+ / Android 4.1+).
  // No people, body parts, symbols, or animal-head-only emoji.
  var FALLBACK_EMOJI = [
    '\u{1F40A}', // 🐊 crocodile
    '\u{1F40B}', // 🐋 whale
    '\u{1F40C}', // 🐌 snail
    '\u{1F40D}', // 🐍 snake
    '\u{1F40F}', // 🐏 ram
    '\u{1F410}', // 🐐 goat
    '\u{1F411}', // 🐑 ewe
    '\u{1F418}', // 🐘 elephant
    '\u{1F419}', // 🐙 octopus
    '\u{1F41B}', // 🐛 bug
    '\u{1F41C}', // 🐜 ant
    '\u{1F41D}', // 🐝 honeybee
    '\u{1F41E}', // 🐞 ladybeetle
    '\u{1F420}', // 🐠 tropical fish
    '\u{1F421}', // 🐡 blowfish
    '\u{1F422}', // 🐢 turtle
    '\u{1F42A}', // 🐪 dromedary
    '\u{1F42B}', // 🐫 bactrian camel
    '\u{1F401}', // 🐁 mouse
    '\u{1F402}', // 🐂 ox
    '\u{1F403}', // 🐃 water buffalo
    '\u{1F404}', // 🐄 cow
    '\u{1F405}', // 🐅 tiger
    '\u{1F406}', // 🐆 leopard
    '\u{1F407}', // 🐇 rabbit
    '\u{1F408}', // 🐈 cat
    '\u{1F409}', // 🐉 dragon
    '\u{1F3E1}', // 🏡 house with garden
    '\u{1F3E2}', // 🏢 office building
    '\u{1F3E3}', // 🏣 Japanese post office
    '\u{1F3E5}', // 🏥 hospital
    '\u{1F3E6}', // 🏦 bank
    '\u{1F3E8}', // 🏨 hotel
    '\u{1F3EA}', // 🏪 convenience store
    '\u{1F3EB}', // 🏫 school
    '\u{1F3EC}', // 🏬 department store
    '\u{1F3ED}', // 🏭 factory
    '\u{1F3EF}', // 🏯 Japanese castle
    '\u{1F3F0}'  // 🏰 European castle
  ];
  window.FALLBACK_EMOJI = FALLBACK_EMOJI;

  // ── Deterministic URL → emoji mapping ────────────────────────
  // Same URL always maps to the same emoji across sessions and
  // across encoding/memory phases. Uses a simple string hash.
  function _hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  window.getFallbackEmoji = function (url) {
    return FALLBACK_EMOJI[_hashStr(url || '') % FALLBACK_EMOJI.length];
  };

  // ── Globals ──────────────────────────────────────────────────
  function _getCache() {
    if (!window.__PRELOADED_IMAGES)   window.__PRELOADED_IMAGES = {};
    return window.__PRELOADED_IMAGES;
  }
  if (!window.__PRELOAD_FAILED_URLS) window.__PRELOAD_FAILED_URLS = [];
  if (!window.__DISPLAY_LOG)         window.__DISPLAY_LOG = [];

  // ── Failure check ────────────────────────────────────────────
  window.isPreloadFailed = function (url) {
    var entry = _getCache()[url];
    return !!(entry && entry.failed && !entry.blobUrl);
  };

  // ── Display outcome logging ──────────────────────────────────
  // Called by trial.js / memory_task.js after each stimulus display.
  window.logDisplayOutcome = function (url, outcome, fallbackEmoji) {
    window.__DISPLAY_LOG.push({
      url: url || '',
      outcome: outcome || 'unknown',
      fallback: fallbackEmoji || null,
      ts: Date.now()
    });
  };

  // ── Single-image loader ──────────────────────────────────────
  function _loadOne(url) {
    var cache = _getCache();
    var entry = cache[url];
    if (entry && entry.blobUrl)  return Promise.resolve(entry);
    if (entry && entry.promise)  return entry.promise;

    var promise = new Promise(function (resolve) {
      var settled = false;
      var to = setTimeout(function () {
        if (settled) return;
        settled = true;
        console.warn('[preload] Timeout (' + PER_IMAGE_TIMEOUT + 'ms):', url);
        var fail = { blobUrl: null, img: null, promise: null, failed: true };
        cache[url] = fail;
        if (window.__PRELOAD_FAILED_URLS.indexOf(url) === -1) {
          window.__PRELOAD_FAILED_URLS.push(url);
        }
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
            cache[url] = { blobUrl: blobUrl, img: img, promise: null };
            resolve(cache[url]);
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
          cache[url] = { blobUrl: blobUrl, img: null, promise: null };
          resolve(cache[url]);
        };
        img.src = blobUrl;
      }).catch(function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(to);
        console.warn('[preload] Fetch error:', url, err);
        var fail = { blobUrl: null, img: null, promise: null, failed: true };
        cache[url] = fail;
        if (window.__PRELOAD_FAILED_URLS.indexOf(url) === -1) {
          window.__PRELOAD_FAILED_URLS.push(url);
        }
        resolve(null);
      });
    });

    cache[url] = { blobUrl: null, img: null, promise: promise };
    return promise;
  }

  // ── Bounded-concurrency runner ───────────────────────────────
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
        console.warn('[preload] Overall timeout.');
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

  // ── Stamp failure diagnostics into jsPsych data ──────────────
  function _stampDiagnostics(result, mode, elapsed) {
    try {
      jsPsych.data.addProperties({
        preload_loaded:          result.loaded,
        preload_total:           result.total,
        preload_failed:          result.failed.length,
        preload_failed_urls:     JSON.stringify(window.__PRELOAD_FAILED_URLS),
        preload_elapsed_ms:      elapsed,
        preload_overall_timeout: result.overallTimedOut,
        preload_mode:            mode
      });
    } catch (e) { /* non-fatal */ }
  }

  // ──────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────

  window.resolvePreloadedUrl = function (url) {
    var entry = _getCache()[url];
    return (entry && entry.blobUrl) ? entry.blobUrl : url;
  };

  window.ensurePreloaded = function (url) {
    if (!url || typeof url !== 'string') return Promise.resolve(null);
    return _loadOne(url);
  };

  window.buildPreloadImageList = function (stimulusSetImages, practiceStimImages) {
    var seen = Object.create(null);
    var images = [];
    function push(u) {
      if (typeof u !== 'string' || !u || seen[u]) return;
      seen[u] = true; images.push(u);
    }
    if (Array.isArray(stimulusSetImages))
      for (var i = 0; i < stimulusSetImages.length; i++) push(stimulusSetImages[i]);
    if (Array.isArray(practiceStimImages))
      for (var j = 0; j < practiceStimImages.length; j++) {
        var x = practiceStimImages[j];
        if (typeof x === 'string' && (x.indexOf('/') !== -1 || /\.png$/i.test(x)))
          push(x);
      }
    return images;
  };

  // ── Foreground preload trial ─────────────────────────────────
  window.buildPreloadTrial = function (skipPreload, preloadImages) {
    if (skipPreload || !preloadImages || preloadImages.length === 0) return null;
    return {
      type: 'call-function',
      async: true,
      func: function (done) {
        var t0 = performance.now();
        var disp = jsPsych.getDisplayElement();
        disp.innerHTML =
          '<div style="max-width:520px;margin:14vh auto;font-family:' +
            '-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
            'text-align:center;padding:24px;">' +
            '<p style="font-size:17px;margin-bottom:14px;color:#222;">' +
              'Loading experiment assets\u2026</p>' +
            '<div style="height:14px;background:#eee;border-radius:7px;' +
              'overflow:hidden;border:1px solid #ddd;">' +
              '<div id="pl-bar" style="height:100%;width:0%;background:' +
                'linear-gradient(90deg,#4a90e2,#357abd);transition:width .18s;"></div>' +
            '</div>' +
            '<p id="pl-count" style="font-size:13px;color:#666;margin-top:10px;">' +
              '0 / ' + preloadImages.length + '</p>' +
          '</div>';
        var bar = document.getElementById('pl-bar');
        var cnt = document.getElementById('pl-count');
        _runQueue(preloadImages, function (ld, tot) {
          if (bar) bar.style.width = Math.round(ld / tot * 100) + '%';
          if (cnt) cnt.textContent = ld + ' / ' + tot;
        }).then(function (r) {
          _stampDiagnostics(r, 'foreground', Math.round(performance.now() - t0));
          done();
        });
      }
    };
  };

  // ── Background preload trial ─────────────────────────────────
  window.buildBackgroundPreloadTrial = function (preloadImages) {
    if (!preloadImages || preloadImages.length === 0) return null;
    window.__PRELOAD_STATUS = {
      loaded: 0, total: preloadImages.length, failed: [], done: false, startedAt: 0
    };
    return {
      type: 'call-function',
      func: function () {
        var t0 = performance.now();
        window.__PRELOAD_STATUS.startedAt = t0;
        var pill = document.createElement('div');
        pill.id = '__preload_pill';
        pill.style.cssText =
          'position:fixed;top:10px;left:10px;z-index:99999;' +
          'padding:6px 12px;border-radius:999px;' +
          'background:rgba(0,0,0,.55);color:#fff;' +
          'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
          'font-size:12px;font-weight:600;pointer-events:none;transition:opacity .4s;';
        pill.textContent = 'Loading assets\u2026 0 / ' + preloadImages.length;
        document.body.appendChild(pill);
        _runQueue(preloadImages, function (ld, tot) {
          window.__PRELOAD_STATUS.loaded = ld;
          if (pill) pill.textContent = 'Loading assets\u2026 ' + ld + ' / ' + tot;
        }).then(function (r) {
          window.__PRELOAD_STATUS.loaded = r.loaded;
          window.__PRELOAD_STATUS.failed = r.failed;
          window.__PRELOAD_STATUS.done = true;
          _stampDiagnostics(r, 'background', Math.round(performance.now() - t0));
          if (pill) {
            pill.textContent = r.failed.length > 0
              ? 'Assets ready (' + r.loaded + '/' + r.total + ')'
              : 'Assets ready';
            setTimeout(function () { pill.style.opacity = '0'; }, 1500);
            setTimeout(function () {
              if (pill.parentNode) pill.parentNode.removeChild(pill);
            }, 2200);
          }
        });
      }
    };
  };

  // ── Preload-completion gate trial ────────────────────────────
  window.buildPreloadGateTrial = function () {
    return {
      type: 'call-function',
      async: true,
      func: function (done) {
        var status = window.__PRELOAD_STATUS;
        if (!status || status.done) {
          console.log('[preload-gate] already done, proceeding');
          done(); return;
        }
        var gateStart = performance.now();
        var disp = jsPsych.getDisplayElement();
        disp.innerHTML =
          '<style>' +
            '@keyframes gateOrb{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.55}' +
              '50%{transform:translate(-50%,-50%) scale(1.18);opacity:.95}}' +
            '@keyframes gatePulse{0%,100%{opacity:.85}50%{opacity:1}}' +
          '</style>' +
          '<div style="position:fixed;inset:0;z-index:9998;overflow:hidden;' +
            'background:linear-gradient(to bottom,hsl(230,40%,8%),hsl(230,36%,24%));' +
            'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#e2e8f0;">' +
            '<div style="position:absolute;left:50%;top:38%;width:140px;height:140px;' +
              'transform:translate(-50%,-50%);border-radius:50%;' +
              'background:radial-gradient(circle,rgba(120,180,255,.45),transparent 70%);' +
              'animation:gateOrb 2.4s ease-in-out infinite;"></div>' +
            '<div style="position:absolute;left:50%;top:62%;transform:translateX(-50%);' +
              'text-align:center;width:90%;max-width:520px;">' +
              '<div style="font-size:26px;font-weight:800;color:#fff;' +
                'animation:gatePulse 2s ease-in-out infinite;">Preparing your mission\u2026</div>' +
              '<div style="font-size:15px;color:rgba(226,232,240,.65);margin:6px 0 16px;">' +
                'Final calibration before liftoff.</div>' +
              '<div style="height:8px;background:rgba(255,255,255,.12);border-radius:999px;' +
                'overflow:hidden;border:1px solid rgba(255,255,255,.18);">' +
                '<div id="gate-bar" style="height:100%;width:0%;' +
                  'background:linear-gradient(90deg,#7ab6ff,#b794f6);' +
                  'box-shadow:0 0 12px rgba(122,182,255,.7);transition:width .25s;"></div>' +
              '</div>' +
              '<div id="gate-count" style="font-size:13px;color:rgba(226,232,240,.55);' +
                'margin-top:10px;">' + status.loaded + ' / ' + status.total + '</div>' +
            '</div>' +
          '</div>';
        var bar = document.getElementById('gate-bar');
        var cnt = document.getElementById('gate-count');
        var poll = setInterval(function () {
          var s = window.__PRELOAD_STATUS;
          if (!s) { clearInterval(poll); done(); return; }
          var pct = s.total ? Math.round(s.loaded / s.total * 100) : 100;
          if (bar) bar.style.width = pct + '%';
          if (cnt) cnt.textContent = s.loaded + ' / ' + s.total;
          if (s.done) {
            clearInterval(poll);
            if (bar) bar.style.width = '100%';
            var waited = Math.round(performance.now() - gateStart);
            console.log('[preload-gate] released after ' + waited + 'ms');
            try { jsPsych.data.addProperties({ preload_gate_wait_ms: waited }); } catch(e){}
            setTimeout(done, 450);
          }
        }, 120);
      }
    };
  };
})();
