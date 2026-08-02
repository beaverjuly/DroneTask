jsPsych.plugins["trial"] = (function () {
  var plugin = {};

  plugin.info = {
    name: "trial",
    description: "",
    parameters: {
      dummy: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: "dummy",
        default: null,
        description: "starting location"
      },
      show_missing: {
        type: jsPsych.plugins.parameterType.BOOL,
        array: false,
        default: false
      },
      show_drone: {
        type: jsPsych.plugins.parameterType.BOOL,
        array: false,
        default: false
      },
      show_drone: {
        type: jsPsych.plugins.parameterType.BOOL,
        array: false,
        default: false
      },
      is_moving_practice: {
        type: jsPsych.plugins.parameterType.BOOL,
        array: false,
        default: false
      },
      canvas_size: {
        type: jsPsych.plugins.parameterType.INT,
        array: true,
        pretty_name: "Canvas size",
        default: [2000, 2000],
        description:
          "Array containing the height (first value) and width (second value) of the canvas element."
      },
      choices: {
        type: jsPsych.plugins.parameterType.KEYCODE,
        array: true,
        pretty_name: "Choices",
        default: [' ', 'arrowleft', 'arrowright'],
        description: "Keys corresponding to each context (space, left, right)."
      },
      strong_warning: {
        type: jsPsych.plugins.parameterType.BOOL,
        array: false,
        default: false
      },
      missing_msg_warning_number: {
        type: jsPsych.plugins.parameterType.BOOL,
        array: false,
        default: 15
      },
      bucket_position: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        default: null,
        description: "location of the collector."
      },
      stayed: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        default: 1,
        description: "0 if the collector moved this trial, otherwise 1."
      },
      supply_distribution: {
        type: jsPsych.plugins.parameterType.INT,
        array: true,
        pretty_name: "distribution of drop objects",
        default: [-4.25, -3, -1.75, -0.75, -0.25, 0.25, 0.75, 1.75, 3, 4.25],
        description: "horizontal spread of fragments around bag landing position"
      },
      supply_duration: {
        type: jsPsych.plugins.parameterType.INT,
        array: true,
        default: [350, 400, 500, 550, 600, 600, 600, 500, 500, 400],
        description: "legacy duration parameter"
      },
      bag_position: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        pretty_name: "x of outcome position",
        default: 35,
        description: "x of outcome position"
      },
      drone_position: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        default: null,
        description: "x of the drone (legacy name kept for data compatibility)"
      },
      drone_start_position: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        default: null,
        description: "starting x position of the drone animation"
      },
      animate_drone: {
        type: jsPsych.plugins.parameterType.BOOL,
        array: false,
        default: false,
        description: "whether the visible drone should animate from start to target"
      },
      drone_animation_duration: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        default: 900,
        description: "duration of visible drone travel animation in ms"
      },
      no_response_duration: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        default: 1500
      },
      response_remaining_duration: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        default: 2500
      },
      drop_duration: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        default: 5000
      },
      missing_duration: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        default: 7500
      },
      stim_img: {
        type: jsPsych.plugins.parameterType.STRING,
        array: false,
        default: null,
        description: "Emoji character for the memory component."
      },
      hide_stimulus: {
        type: jsPsych.plugins.parameterType.BOOL,
        array: false,
        default: false,
        description:
          "If true, keep the stimulus hidden even after the outcome appears."
      },
      valence: {
        type: jsPsych.plugins.parameterType.STRING,
        array: false,
        default: "reward",
        description: "'reward' or 'loss' — controls visual mode for this trial."
      },
      vol_level: {
        type: jsPsych.plugins.parameterType.STRING,
        array: false,
        default: null
      },
      block_index: {
        type: jsPsych.plugins.parameterType.INT,
        array: false,
        default: 0,
        description: "0-based block index for theming (0-3)."
      }
    }
  };

  /* ── Block gradient themes (CSS-only, no images) ── */
  var BLOCK_THEMES = [
    { hue: 210, sat: 38, label: "Block 1" }, // cool blue
    { hue: 165, sat: 32, label: "Block 2" }, // teal
    { hue: 270, sat: 30, label: "Block 3" }, // purple
    { hue: 340, sat: 28, label: "Block 4" }  // rose
  ];

  // Practice uses a fully neutral grey gradient.
  var PRACTICE_THEME = {
    hue: 210,
    sat: 0,
    skyGradient:
      "linear-gradient(to bottom," +
      "#2b2f35 0%,#3b4047 30%,#565c65 55%," +
      "#747c86 72%,#969da5 85%,#b3b8bd 100%)",
    groundGradient: "linear-gradient(to bottom,#b3b8bd 0%,#a2a8ae 100%)"
  };

  // Expose for memory_task.js to use matching backgrounds
  window.BLOCK_THEMES = BLOCK_THEMES;
  window.PRACTICE_THEME = PRACTICE_THEME;

  function getBlockTheme(trial) {
    var idx = typeof trial.block_index === "number" ? trial.block_index : 0;
    if (idx < 0 || idx >= BLOCK_THEMES.length) return PRACTICE_THEME;
    return BLOCK_THEMES[idx];
  }

  function skyGradientCSS(h, s) {
    return (
      "linear-gradient(to bottom," +
      "hsl(" + h + "," + s + "%,18%) 0%," +
      "hsl(" + h + "," + s + "%,28%) 30%," +
      "hsl(" + h + "," + s + "%,42%) 55%," +
      "hsl(" + h + "," + (s + 6) + "%,58%) 72%," +
      "hsl(" + h + "," + (s + 10) + "%,72%) 85%," +
      "hsl(" + h + "," + (s + 8) + "%,80%) 100%)"
    );
  }
  window.skyGradientCSS = skyGradientCSS;

  function groundGradientCSS(h, s) {
    return (
      "linear-gradient(to bottom," +
      "hsl(" + h + "," + (s + 8) + "%,80%) 0%," +
      "hsl(" + h + "," + (s + 4) + "%,74%) 100%)"
    );
  }

  function getValenceConfig(valence) {
    if (valence === "loss") {
      return {
        feedback_sign: function (c) {
          return c - 10;
        },
        feedback_color: function (c) {
          var v = c - 10;
          return v === 0 ? "#FFD700" : "#FF4444";
        },
        bagClass: "loss",
        peClass: "loss"
      };
    }

    return {
      feedback_sign: function (c) {
        return c;
      },
      feedback_color: function (c) {
        return c === 10 ? "#39FF14" : c === 0 ? "#FFD700" : "#39FF14";
      },
      bagClass: "reward",
      peClass: "reward"
    };
  }

  function make_html(trial) {
    var valence = trial.valence || "reward";
    var theme = getBlockTheme(trial);
    var h = theme.hue;
    var s = theme.sat;
    var skyBackground = theme.skyGradient || skyGradientCSS(h, s);
    var groundBackground = theme.groundGradient || groundGradientCSS(h, s);
    var gameContainerClass = theme.skyGradient
      ? "game-container practice-theme"
      : "game-container";

    var html = "";
    html +=
      '<div class="' + gameContainerClass + '" style="background:' +
      skyBackground +
      ';">';
    html +=
      '<div class="bg-ground" style="background:' +
      groundBackground +
      ';"></div>';
    html += '<div class="main-container">';

    html += '<div class="slider-rail" id="slider-rail"></div>';

    // Collector box — kept, but the "YOU" label is removed.
    html +=
      '<div class="collector-wrap" id="collector" style="left:' +
      trial.bucket_position +
      '%;">' +
      '<div class="collector-box" id="collector-box"></div>' +
      "</div>";

    // Drone indicator (practice only)
    var showDroneNow = trial.show_drone || trial.show_drone;
    var droneStart = (
      typeof trial.drone_start_position === "number"
        ? trial.drone_start_position
        : trial.drone_position
    );

    var droneClass = "drone-el";
    if (showDroneNow) {
      droneClass += " visible outcome-phase";
    }

    html +=
      '<div class="' + droneClass + '" id="drone" style="left:' +
      droneStart +
      '%;">&#128760;</div>';

    // PE line is kept in the DOM but never displayed (legacy element).
    html += '<div class="pe-line" id="pe-line" style="display:none;"></div>';

    // Fragment layer — fragments from the bag burst are appended here.
    html += '<div class="fragment-layer" id="fragment-layer"></div>';

    // Bag dot (hidden initially). Drop animation is driven by the .dropping class.
    html += '<div class="bag-dot" id="bag-dot" style="display:none;"></div>';

    // Feedback value (hidden initially)
    html += '<div class="fb-value" id="fb" style="display:none;"></div>';

    // Stimulus card (hidden initially)
    // Supports both practice text emojis and main-task PNG image paths.
    html +=
      '<div class="stimulus-card" id="stimulus-card" style="display:none;">' +
      '<span class="emoji-stim" id="emoji-stim"></span>' +
      '<img class="stimulus-img" id="stimulus-img" alt="memory item" style="display:none;">' +
      '</div>';

    html += "</div>";
    html += "</div>";
    return html;
  }

  function clampPercent(x, minVal, maxVal) {
    return Math.max(minVal, Math.min(maxVal, x));
  }

  function isImageStim(src) {
    return typeof src === "string" && (src.indexOf("/") !== -1 || /\.png$/i.test(src));
  }

  function move_collector(trial, info) {
    var key = info.key;
    var x = trial.bucket_position;
    var step = 2;

    // jsPsych 6.3.1 returns key as a lowercase string (e.g. 'arrowright')
    if (key === 'arrowright') x = x + step;
    else if (key === 'arrowleft') x = x - step;

    if (x > 90) x = 90;
    else if (x < 10) x = 10;

    var collector = document.getElementById("collector");
    if (collector) collector.style.left = x + "%";

    trial.bucket_position = x;
    return trial;
  }

  function setCollectorUnlocked() {
    var box = document.getElementById("collector-box");
    var wrap = document.getElementById("collector");
    if (box) box.classList.remove("locked");
    if (wrap) wrap.classList.remove("locked");
  }

  function setCollectorLocked() {
    var box = document.getElementById("collector-box");
    var wrap = document.getElementById("collector");
    if (box) box.classList.add("locked");
    if (wrap) wrap.classList.add("locked");
  }

  function computeCaptureCount(distance) {
    if (distance <= 1.5) return 10;
    if (distance <= 3.0) return 9;
    if (distance <= 4.5) return 8;
    if (distance <= 6.0) return 7;
    if (distance <= 7.5) return 6;
    if (distance <= 9.0) return 5;
    if (distance <= 10.5) return 4;
    if (distance <= 12.0) return 3;
    if (distance <= 14.0) return 2;
    if (distance <= 16.0) return 1;
    return 0;
  }

  /* ── Bag explosion: spawn fragments at the landing point ── */
  /* ── Bag explosion: spawn fragments at the landing point ── */
  function showBagExplosion(trial, captureCount, valenceClass) {
    var layer = document.getElementById("fragment-layer");
    if (!layer) return;

    // Clear any leftover fragments from a previous trial.
    layer.innerHTML = "";

    var defaultDist = [-4.25, -3, -1.75, -0.75, -0.25, 0.25, 0.75, 1.75, 3, 4.25];
    var offsets =
      Array.isArray(trial.supply_distribution) && trial.supply_distribution.length
        ? trial.supply_distribution
        : defaultDist;

    var bagX = clampPercent(trial.bag_position, 12, 88);

    offsets.forEach(function (offset, i) {
      var frag = document.createElement("div");
      frag.className = "bag-fragment " + valenceClass;

      var dxVw = offset * 1.15;

      // small upward pop
      var dyVh = -(0.6 + Math.random() * 0.5);

      // slight per-fragment fall variation so they don't hit in one flat line
      var fallVh = 4.5 + Math.random() * 0.9;

      // a middle falling point for a more curved trajectory
      var fallMidVh = 2.5 + Math.random() * 0.5;

      // individual speed variation
      var durationMs = 450 + Math.random() * 120;

      var rotDeg = Math.random() * 160 - 80;
      var delayMs = Math.random() * 12;

      frag.style.left = bagX + "%";
      frag.style.setProperty("--dx", dxVw + "vw");
      frag.style.setProperty("--dx-mid", dxVw * 0.72 + "vw");
      frag.style.setProperty("--dy", dyVh + "vh");
      frag.style.setProperty("--fall-mid", fallMidVh + "vh");
      frag.style.setProperty("--fall", fallVh + "vh");
      frag.style.setProperty("--rot", rotDeg + "deg");
      frag.style.animationDelay = delayMs + "ms";
      frag.style.animationDuration = durationMs + "ms";

      layer.appendChild(frag);
    });
  }

  function fly(trial) {
    var valence = trial.valence || "reward";
    var va = getValenceConfig(valence);

    // Timing — bag drop begins at bagDelay, lands at landDelay (drop duration matches CSS).
    var lockDelay = 300;
    var bagDelay = lockDelay + 200;          // ~500 ms — bag appears at top, drop animation begins
    var dropDuration = 720;                  // matches @keyframes bagDropDown duration
    var landDelay = bagDelay + dropDuration - 200; // explosion begins
    var valueDelay = landDelay + 100;        // ~1120 ms — value appears shortly after explosion
    var itemDelay = valueDelay + 300;        // ~1420 ms — item card appears

    setCollectorLocked();

    // — Step 1: bag dot appears at the top and drops to the landing point.
    setTimeout(function () {
      // Keep the drone visible during visible practice trials.
      // Do not reset left here if it has already traveled during the response phase.
      if (trial.show_drone || trial.show_drone) {
        var drone = document.getElementById("drone");
        if (drone) {
          if (!trial.animate_drone) {
            drone.style.left = trial.drone_position + "%";
          }
          drone.classList.add("visible", "outcome-phase");
        }
      }

      // Place bag dot at the true bag x; the .dropping class animates it from
      // the top of the game area down to the landing point above the rail.
      var bagDot = document.getElementById("bag-dot");
      if (bagDot) {
        var bagLeft = clampPercent(trial.bag_position, 12, 88);
        bagDot.style.left = bagLeft + "%";
        // Reset any state from a previous trial.
        bagDot.className = "bag-dot " + va.bagClass;
        bagDot.style.display = "block";
        // Force a reflow so the animation reliably restarts on re-show.
        void bagDot.offsetWidth;
        bagDot.classList.add("dropping");
      }

      // PE line is intentionally NOT displayed.
    }, bagDelay);

    // — Step 2: bag has landed → pulse + fragment burst.
    setTimeout(function () {
      var distance = Math.abs(trial.bucket_position - trial.bag_position);
      var captureCount = computeCaptureCount(distance);
      trial.supply_caught = captureCount;

      // Switch from drop animation to landing pulse. The pulse fades out the
      // bag dot while the fragments take over the visual space.
      var bagDot = document.getElementById("bag-dot");
      if (bagDot) {
        bagDot.classList.remove("dropping");
        bagDot.classList.add("landed");
      }

      showBagExplosion(trial, captureCount, va.bagClass);
    }, landDelay);

    // — Step 3: feedback value text appears near the landing position.
    setTimeout(function () {
      var captureCount = trial.supply_caught;
      var valueChange = va.feedback_sign(captureCount);
      var displayText;

      if (valueChange > 0) displayText = "+" + valueChange;
      else if (valueChange < 0) displayText = String(valueChange);
      else displayText = "0";

      var color = va.feedback_color(captureCount);

      var fb = document.getElementById("fb");
      if (fb) {
        fb.textContent = displayText;
        fb.style.color = color;
        fb.style.left = clampPercent(trial.bag_position, 12, 88) + "%";
        fb.style.display = "block";
      }
    }, valueDelay);

    // — Step 4: item stimulus card appears.
    // Practice stimuli are text emojis; main-task stimuli are PNG paths.
    setTimeout(function () {
      var card = document.getElementById("stimulus-card");
      var emojiEl = document.getElementById("emoji-stim");
      var imgEl = document.getElementById("stimulus-img");

      if (card && trial.stim_img && !trial.hide_stimulus) {
        if (isImageStim(trial.stim_img)) {
          var _url = trial.stim_img;
          var _failed = typeof isPreloadFailed === "function" && isPreloadFailed(_url);
          _stim_preload_failed = _failed;

          if (_failed) {
            // ── Fallback: show deterministic emoji instead of broken image ──
            var _emoji = typeof getFallbackEmoji === "function"
              ? getFallbackEmoji(_url) : "\u2753";
            _stim_display_outcome = "fallback_emoji";
            _stim_fallback_emoji  = _emoji;
            if (imgEl)   { imgEl.removeAttribute("src"); imgEl.style.display = "none"; }
            if (emojiEl) { emojiEl.textContent = _emoji; emojiEl.style.display = "block"; }
            if (typeof logDisplayOutcome === "function")
              logDisplayOutcome(_url, "fallback_emoji", _emoji);
          } else {
            // ── Normal: resolve from blob cache (instant) or JIT load ──
            if (emojiEl) { emojiEl.textContent = ""; emojiEl.style.display = "none"; }
            if (imgEl) {
              var _resolved = typeof resolvePreloadedUrl === "function"
                ? resolvePreloadedUrl(_url) : _url;
              var _isBlob = _resolved.indexOf("blob:") === 0;
              var _showImg = function () {
                imgEl.style.display = "block";
                imgEl.style.visibility = "hidden";
                imgEl.src = _resolved;
                if (typeof imgEl.decode === "function") {
                  imgEl.decode().then(function () { imgEl.style.visibility = "visible"; },
                                      function () { imgEl.style.visibility = "visible"; });
                } else { imgEl.style.visibility = "visible"; }
              };

              if (_isBlob) {
                _stim_display_outcome = "cached";
                _showImg();
                if (typeof logDisplayOutcome === "function")
                  logDisplayOutcome(_url, "cached", null);
              } else if (typeof ensurePreloaded === "function") {
                ensurePreloaded(_url).then(function (entry) {
                  if (entry && entry.blobUrl) {
                    _resolved = entry.blobUrl;
                    _stim_display_outcome = "jit_success";
                  } else {
                    _stim_display_outcome = "direct_load";
                  }
                  _showImg();
                  if (typeof logDisplayOutcome === "function")
                    logDisplayOutcome(_url, _stim_display_outcome, null);
                });
              } else {
                _stim_display_outcome = "direct_load";
                _showImg();
                if (typeof logDisplayOutcome === "function")
                  logDisplayOutcome(_url, "direct_load", null);
              }
            }
          }
        } else {
          if (imgEl) {
            imgEl.removeAttribute("src");
            imgEl.style.display = "none";
          }
          if (emojiEl) {
            emojiEl.textContent = trial.stim_img;
            emojiEl.style.display = "block";
          }
        }

        card.style.left = clampPercent(trial.bag_position, 18, 82) + "%";
        card.style.display = "flex";
      }
    }, itemDelay);

    // — Step 5: cleanup — clear bag, fragments, value, card, drone, landing marker.
    setTimeout(function () {
      var fb = document.getElementById("fb");
      var card = document.getElementById("stimulus-card");
      var bagDot = document.getElementById("bag-dot");
      var peLine = document.getElementById("pe-line");
      var drone = document.getElementById("drone");
      var fragLayer = document.getElementById("fragment-layer");

      if (fb) fb.style.display = "none";
      if (card) card.style.display = "none";
      if (bagDot) {
        bagDot.style.display = "none";
        bagDot.classList.remove("dropping", "landed");
      }
      if (peLine) peLine.style.display = "none";
      if (drone && !trial.animate_drone) {
        drone.classList.remove("visible", "outcome-phase");
      }
      if (fragLayer) fragLayer.innerHTML = "";
    }, itemDelay + 2800);
  }

plugin.trial = function (display_element, trial) {
    var _trial_onset_perf =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    var _trial_onset_elapsed =
      typeof jsPsych !== "undefined" && jsPsych.totalTime
        ? jsPsych.totalTime()
        : null;

    var _bucket_start_pos = trial.bucket_position;
    var _bucket_end_pos   = trial.bucket_position;
    var _stim_display_outcome  = null;   // 'cached'|'jit_success'|'fallback_emoji'|'direct_load'
    var _stim_preload_failed   = false;
    var _stim_fallback_emoji   = null;
    var _rt_first_move_ms = null;
    var _rt_last_move_ms  = null;
    var _num_moves        = 0;

    var _record_move_if_changed = function (prev_pos) {
      if (trial.bucket_position !== prev_pos) {
        var now =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        var ms = now - _trial_onset_perf;
        if (_rt_first_move_ms === null) _rt_first_move_ms = ms;
        _rt_last_move_ms = ms;
        _num_moves += 1;
        _bucket_end_pos = trial.bucket_position;
      }
    };

    if (trial.show_drone && !trial.show_drone) trial.show_drone = trial.show_drone;

    if (trial.is_moving_practice) {
      trial.no_response_duration = 5000;
    }

    display_element.innerHTML = make_html(trial);
    setCollectorUnlocked();

    if ((trial.show_drone || trial.show_drone) && trial.animate_drone) {
      jsPsych.pluginAPI.setTimeout(function () {
        var drone = display_element.querySelector('#drone');
        if (drone) {
          var startX = (
            typeof trial.drone_start_position === 'number'
              ? trial.drone_start_position
              : trial.drone_position
          );

          drone.style.left = startX + '%';
          drone.classList.add('visible', 'outcome-phase');

          // Force reflow so the transition reliably starts from startX.
          void drone.offsetWidth;

          drone.style.transition =
            'left ' + (trial.drone_animation_duration || 900) +
            'ms cubic-bezier(.22,.61,.36,1), opacity 0.3s';
          drone.style.left = trial.drone_position + '%';
        }
      }, 80);
    }

    var collector = document.getElementById("collector");
    if (collector) collector.style.left = trial.bucket_position + "%";

    // ── Next button for the slider warm-up ──────────────────────────
    if (trial.is_moving_practice) {
      // Tip shown when participant clicks Next before sliding at all.
      var tipEl = document.createElement('div');
      tipEl.id = 'practice-tip';
      tipEl.textContent = '← Try sliding with the arrow keys first! →';
      tipEl.style.cssText =
        'position:fixed;bottom:90px;right:40px;' +
        'background:#fffbeb;border:1px solid #fde68a;color:#854d0e;' +
        'font-size:15px;font-weight:600;' +
        'padding:10px 18px;border-radius:10px;' +
        'box-shadow:0 6px 18px rgba(133,77,14,.14);' +
        'opacity:0;transition:opacity 0.3s;' +
        'pointer-events:none;z-index:998;';
      display_element.appendChild(tipEl);

      var nextBtn = document.createElement('button');
      nextBtn.id  = 'practice-next-btn';
      nextBtn.textContent = 'Next →';
      nextBtn.style.cssText =
        'position:fixed;bottom:32px;right:40px;' +
        'padding:10px 26px;font-size:16px;font-weight:700;' +
        'border:none;border-radius:8px;cursor:pointer;z-index:999;' +
        'background:#fff;color:#1f2937;' +
        'box-shadow:0 3px 12px rgba(0,0,0,.25);';
      nextBtn.addEventListener('click', function () {
        if (_num_moves === 0) {
          // Participant hasn't slid yet — flash the tip instead of advancing.
          tipEl.style.opacity = '1';
          setTimeout(function () { tipEl.style.opacity = '0'; }, 2200);
        } else {
          end_trial(1);
        }
      });
      display_element.appendChild(nextBtn);
    }

    var keyboardListener1 = null;
    var keyboardListener  = null;

    var after_response = function (info) {
      var prev_pos = trial.bucket_position;
      trial = move_collector(trial, info);
      _record_move_if_changed(prev_pos);
    };

    var after_1st_response = function (info) {
      jsPsych.pluginAPI.clearAllTimeouts();
      jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener1);
      trial.stayed = 0;

      var prev_pos = trial.bucket_position;
      trial = move_collector(trial, info);
      _record_move_if_changed(prev_pos);

      keyboardListener = jsPsych.pluginAPI.getKeyboardResponse({
        callback_function: after_response,
        valid_responses: trial.choices,
        rt_method: "performance",
        persist: true,
        allow_held_key: true
      });

      // Practice: keyboard stays live; Next button drives end_trial.
      if (!trial.is_moving_practice) {
        setTimeout(function () {
          jsPsych.pluginAPI.cancelAllKeyboardResponses();
          fly(trial);
          jsPsych.pluginAPI.setTimeout(function () {
            end_trial(1);
          }, trial.drop_duration);
        }, trial.response_remaining_duration);
      }
    };

    setTimeout(function () {
      keyboardListener1 = jsPsych.pluginAPI.getKeyboardResponse({
        callback_function: after_1st_response,
        valid_responses: trial.choices,
        rt_method: "performance",
        persist: false,
        allow_held_key: true
      });
    }, 20);

    var missed_response = function () {
      jsPsych.pluginAPI.cancelAllKeyboardResponses();

      function warningCard(icon, title, body, footer, tone) {
        var styles = {
          orange: {
            bg: '#fff7ed',
            border: '#fb923c',
            title: '#9a3412',
            footer: '#7c2d12'
          },
          red: {
            bg: '#fef2f2',
            border: '#ef4444',
            title: '#991b1b',
            footer: '#7f1d1d'
          },
          blue: {
            bg: '#eff6ff',
            border: '#93c5fd',
            title: '#1e3a8a',
            footer: '#1e40af'
          }
        };

        var s = styles[tone] || styles.orange;

        return (
          '<div style="' +
            'max-width:760px;margin:18vh auto;padding:34px 42px;' +
            'border-radius:22px;background:' + s.bg + ';' +
            'border:2px solid ' + s.border + ';' +
            'box-shadow:0 14px 42px rgba(15,23,42,.18);' +
            'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
            'text-align:center;line-height:1.55;color:#1f2937;">' +

            '<div style="font-size:44px;margin-bottom:10px;">' + icon + '</div>' +

            '<div style="' +
              'font-size:30px;font-weight:850;margin-bottom:14px;color:' + s.title + ';">' +
              title +
            '</div>' +

            '<p style="font-size:20px;margin:0 0 14px 0;">' +
              body +
            '</p>' +

            '<p style="font-size:17px;margin:0;color:' + s.footer + ';">' +
              footer +
            '</p>' +
          '</div>'
        );
      }

      var msg;

      if (trial.is_moving_practice) {
        msg = warningCard(
          '⚠️',
          'Still there?',
          'Please move your collector with the arrow keys.',
          'Your mission will end early if you leave your collector for many trials.',
          'orange'
        );
      } else if (trial.strong_warning) {
        msg = warningCard(
          '⚠️',
          'Still there?',
          'Please move your collector with the arrow keys.',
          'Your mission will end early if you leave your collector for many trials.',
          'red'
        );
      } else {
        msg = warningCard(
          '⚠️',
          'Still there?',
          'Please move your collector with the arrow keys.',
          'Your mission will end early if you leave your collector for many trials.',
          'orange'
        );
      }

      display_element.innerHTML = msg;

      jsPsych.pluginAPI.setTimeout(function () {
        end_trial(0);
      }, trial.missing_duration);
    };

    var end_trial = function (completed) {
      jsPsych.pluginAPI.clearAllTimeouts();
      jsPsych.pluginAPI.cancelAllKeyboardResponses();

      setCollectorUnlocked();

      var supply_caught_value = completed === 1 ? trial.supply_caught : null;

      // Score = the points shown to the participant.
      // reward: score === supply_caught (0 to +10)
      // loss:   score === supply_caught - 10 (-10 to 0)
      var score_value = null;
      if (supply_caught_value !== null) {
        var _va = getValenceConfig(trial.valence || 'reward');
        score_value = _va.feedback_sign(supply_caught_value);
      }

      var _trial_duration_ms = null;
      try {
        var now =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        _trial_duration_ms = now - _trial_onset_perf;
      } catch (e) {}

      var movement_duration_ms =
        _rt_first_move_ms !== null && _rt_last_move_ms !== null
          ? _rt_last_move_ms - _rt_first_move_ms
          : null;

      var miss_reason = null;
      if (completed === 0) miss_reason = "no_move_timeout";

      var trial_data = {
        drone_position:       trial.drone_position,
        bag_position:        trial.bag_position,
        bucket_position:     trial.bucket_position,
        completed:           completed,
        stayed:              trial.stayed,
        supply_caught:        supply_caught_value,
        score:               score_value,
        valence:             trial.valence || "reward",
        bucket_start_pos:    _bucket_start_pos,
        bucket_end_pos:      _bucket_end_pos,
        num_moves:           _num_moves,
        rt_first_move_ms:    _rt_first_move_ms,
        rt_last_move_ms:     _rt_last_move_ms,
        movement_duration_ms: movement_duration_ms,
        trial_onset_elapsed: _trial_onset_elapsed,
        trial_duration_ms:   _trial_duration_ms,
        miss_reason:         miss_reason,
        true_vol_param:
          typeof trial.true_vol_param !== "undefined" ? trial.true_vol_param : null,
        true_stc_param:
          typeof trial.true_stc_param !== "undefined" ? trial.true_stc_param : null,
        vol_level: typeof trial.vol_level !== "undefined" ? trial.vol_level : null,
        stc_level: typeof trial.stc_level !== "undefined" ? trial.stc_level : null,
        stim_display_outcome:  _stim_display_outcome,
        stim_preload_failed:   _stim_preload_failed,
        stim_fallback_emoji:   _stim_fallback_emoji
      };

      display_element.innerHTML = "";
      jsPsych.finishTrial(trial_data);
    };

    // Practice: no auto-advance; Next button is the only exit.
    if (!trial.is_moving_practice) {
      jsPsych.pluginAPI.setTimeout(function () {
        if (trial.show_missing) {
          missed_response();
        } else {
          jsPsych.pluginAPI.cancelAllKeyboardResponses();
          fly(trial);
          jsPsych.pluginAPI.setTimeout(function () {
            end_trial(1);
          }, trial.drop_duration);
        }
      }, trial.no_response_duration);
    }
  };

  return plugin;
})();
