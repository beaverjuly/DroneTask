// ──────────────────────────────────────────────────────────────
// mouse_trajectory.js — Exploratory mouse-dynamics quality-control
// measure (8-target click paradigm) for DroneTask.
//
// Provides:
//   jsPsych.plugins['mouse-trajectory']   — the acquisition plugin
//   window.buildMouseTrajectoryTrial(opts) — trial builder used by
//                                            index.html / dev_routes.js
//   window.MOUSE_TRAJECTORY_GEOMETRY       — fixed target geometry (g1)
//   window.MOUSE_TRAJECTORY_MODULE_VERSION
//
// Design (see design_checks/05_mouse_trajectory_qc.md):
//   * Mirrors the fixed 8-target acquisition paradigm used by
//     Shen et al. (2014) and Acien et al. (2022, BeCAPTCHA-Mouse):
//     a central START target, then eight targets shown ONE AT A TIME
//     at fixed positions chosen to mix short/medium/long and
//     horizontal/vertical/oblique movements. Geometry is NOT
//     randomised, so every participant produces the same 8 movements.
//   * A "trajectory" is the movement between two successive target
//     clicks. The START click is trajectory 1's t = 0 reference, so the
//     hand-to-mouse transition after the keyboard-driven memory probes
//     is excluded from every trajectory.
//   * Raw data, not scores: every pointermove sample (plus coalesced
//     samples via getCoalescedEvents() where the browser supports it)
//     and every pointerdown / pointerup event is preserved with its
//     DOMHighResTimeStamp. No client-side resampling — the W3C Pointer
//     Events spec allows browsers to coalesce high-frequency movement,
//     so we save what was dispatched and let the analysis handle it.
//   * Coordinates are normalised to the SQUARE task area
//     (x_norm, y_norm ∈ [0,1], y down; values outside [0,1] are kept
//     when the pointer leaves the area). Because the area is square,
//     one scale factor applies to both axes, so angles are preserved.
//     The area side length in CSS px and devicePixelRatio are stored
//     so pixel units can be reconstructed.
//   * Nothing here excludes a participant. A skip link appears only if
//     a target has gone un-clicked for `skip_link_after_ms`, so a
//     broken pointing device can never trap someone before the survey.
//
// Data layout (see analysis/split_drone_data.py):
//   * 8 rows with trial_type = 'mouse-trajectory', mt_row = 'trajectory'
//     (one per movement; samples/events serialised as JSON strings).
//   * 1 row  with trial_type = 'mouse-trajectory', mt_row = 'summary'.
//   * mt_status and mt_pointer_type_self_report are also added via
//     jsPsych.data.addProperties() so they land on every row and in the
//     metadata table.
//   NOTE: because the 8 trajectory rows share the summary's
//   trial_index, jsPsych's per-trial on_finish(data) callback would
//   receive trajectory row 1, not the summary. Do not attach on_finish
//   to this trial; read the summary via mt_row === 'summary' instead.
//
// Dev route:  ?dev=1&stage=mouse-test&consent=0&mouse_qc=1
//             (adds a post-task overlay of the recorded paths)
// ──────────────────────────────────────────────────────────────

(function () {
  'use strict';

  var MODULE_VERSION = 'mt-1.0.3-2026-10-04';

  // ── Fixed geometry g1 — unit square, x right, y down ──────────
  // Movement table (from → to, length in side units, direction in
  // math convention with y up, orientation, length class):
  //   1  S →T1  0.360    0°  horizontal  medium
  //   2 T1 →T2  0.200   90°  vertical    short
  //   3 T2 →T3  0.720  180°  horizontal  long
  //   4 T3 →T4  0.480  270°  vertical    medium
  //   5 T4 →T5  0.226   45°  oblique     short
  //   6 T5 →T6  0.396  315°  oblique     medium
  //   7 T6 →T7  0.160    0°  horizontal  short
  //   8 T7 →T8  0.834  120°  oblique     long
  // Minimum centre-to-centre distance 0.16 (≈ 4.6 target radii);
  // minimum edge margin 0.065.
  var GEOMETRY = {
    version: 'g1-2026-09-29',
    target_radius_frac: 0.035,   // click target radius, fraction of side
    start_radius_frac: 0.055,    // START target is larger and labelled
    start: { label: 'S', x: 0.50, y: 0.50 },
    targets: [
      { label: 'T1', x: 0.86, y: 0.50 },
      { label: 'T2', x: 0.86, y: 0.30 },
      { label: 'T3', x: 0.14, y: 0.30 },
      { label: 'T4', x: 0.14, y: 0.78 },
      { label: 'T5', x: 0.30, y: 0.62 },
      { label: 'T6', x: 0.58, y: 0.90 },
      { label: 'T7', x: 0.74, y: 0.90 },
      { label: 'T8', x: 0.32, y: 0.18 }
    ]
  };

  function movementMeta(from, to) {
    var dx = to.x - from.x, dy = to.y - from.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    var deg = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360; // y up
    var a = deg % 180;
    var orientation = (a < 20 || a > 160) ? 'horizontal'
                    : (a > 70 && a < 110) ? 'vertical' : 'oblique';
    var lengthClass = len < 0.30 ? 'short' : (len < 0.55 ? 'medium' : 'long');
    return {
      nominal_length: Math.round(len * 1000) / 1000,
      nominal_direction_deg: Math.round(deg * 10) / 10,
      movement_orientation: orientation,
      movement_length_class: lengthClass
    };
  }

  if (typeof window !== 'undefined') {
    window.MOUSE_TRAJECTORY_GEOMETRY = GEOMETRY;
    window.MOUSE_TRAJECTORY_MODULE_VERSION = MODULE_VERSION;
  }

  // ── Helpers ───────────────────────────────────────────────────
  function r1(v) { return Math.round(v * 10) / 10; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function nowPerf() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  }
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement ||
              document.mozFullScreenElement || document.msFullscreenElement);
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Plugin ────────────────────────────────────────────────────
  var plugin = {};

  plugin.info = {
    name: 'mouse-trajectory',
    description: 'START + 8 sequential fixed targets; records raw pointer trajectories.',
    parameters: {
      intro_title: {
        type: jsPsych.plugins.parameterType.STRING,
        default: 'One final activity'
      },
      intro_lines: {
        type: jsPsych.plugins.parameterType.STRING,
        array: true,
        default: [
          'Use your <strong>mouse or trackpad</strong> to click each circle as it appears.',
          'Move at a natural pace. There is no need to rush.',
          'When you are ready, click <strong>Start</strong> in the center of the box.'
        ]
      },
      show_pointer_question: { type: jsPsych.plugins.parameterType.BOOL, default: true },
      pointer_question_text: {
        type: jsPsych.plugins.parameterType.STRING,
        default: 'Which device did you use for this activity?'
      },
      pointer_choices: {
        type: jsPsych.plugins.parameterType.STRING,
        array: true,
        default: ['Mouse', 'Trackpad', 'Other']
      },
      debug_preview: { type: jsPsych.plugins.parameterType.BOOL, default: false },
      skip_link_after_ms: { type: jsPsych.plugins.parameterType.INT, default: 20000 },
      max_samples_per_trajectory: { type: jsPsych.plugins.parameterType.INT, default: 20000 },
      area_size_px: {
        type: jsPsych.plugins.parameterType.INT,
        default: null,
        description: 'Side length of the square task area in CSS px. null = auto-fit.'
      },
      hit_tolerance: {
        type: jsPsych.plugins.parameterType.FLOAT,
        default: 1.05,
        description: 'Multiplier on the drawn radius used for the geometric hit test.'
      }
    }
  };

  plugin.trial = function (display_element, trial) {

    // ── Environment / support ────────────────────────────────────
    var hasPointerEvents = (typeof window.PointerEvent !== 'undefined');
    var coalescedSupported = hasPointerEvents &&
      typeof window.PointerEvent.prototype.getCoalescedEvents === 'function';
    var EV = hasPointerEvents
      ? { move: 'pointermove', down: 'pointerdown', up: 'pointerup' }
      : { move: 'mousemove',   down: 'mousedown',   up: 'mouseup' };

    var side = trial.area_size_px;
    if (!side) {
      var vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
      side = Math.round(Math.max(420, Math.min(760, Math.min(vw, vh) * 0.72)));
    }
    var R  = GEOMETRY.target_radius_frac;
    var RS = GEOMETRY.start_radius_frac;

    // ── Build DOM ────────────────────────────────────────────────
    var introHTML = '';
    for (var li = 0; li < trial.intro_lines.length; li++) {
      introHTML += '<p class="mt-line">' + trial.intro_lines[li] + '</p>';
    }
    display_element.innerHTML =
      '<div class="mt-wrap" aria-labelledby="mt-title">' +
        '<div class="mt-copy">' +
          '<h1 class="mt-title" id="mt-title">' + trial.intro_title + '</h1>' +
          '<div class="mt-intro" id="mt-intro">' + introHTML + '</div>' +
        '</div>' +
        '<div class="mt-area" id="mt-area" aria-label="Mouse activity area" ' +
          'style="width:' + side + 'px;height:' + side + 'px;">' +
          '<div class="mt-target mt-target-start" id="mt-target">' +
            '<span class="mt-target-label">Start</span>' +
          '</div>' +
          '<svg class="mt-preview" id="mt-preview" viewBox="0 0 1000 1000" style="display:none;"></svg>' +
        '</div>' +
        '<div class="mt-status" id="mt-status" aria-live="polite">Click Start to begin</div>' +
        '<button type="button" class="mt-skip" id="mt-skip" style="display:none;">' +
          'Skip this activity' +
        '</button>' +
      '</div>';

    var areaEl   = display_element.querySelector('#mt-area');
    var targetEl = display_element.querySelector('#mt-target');
    var statusEl = display_element.querySelector('#mt-status');
    var skipEl   = display_element.querySelector('#mt-skip');
    var introEl  = display_element.querySelector('#mt-intro');

    areaEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // ── Geometry / coordinate transform ──────────────────────────
    var areaRect = { left: 0, top: 0, side: side };
    var resizedDuringTask = false;
    function refreshRect() {
      var r = areaEl.getBoundingClientRect();
      areaRect = {
        left: r.left || 0,
        top:  r.top  || 0,
        side: (r.width && r.width > 0) ? r.width : side
      };
    }
    refreshRect();
    function onResize() { resizedDuringTask = recording; refreshRect(); }

    function rel(e) {
      return {
        x: (e.clientX - areaRect.left) / areaRect.side,
        y: (e.clientY - areaRect.top)  / areaRect.side
      };
    }

    function placeTarget(pt, radiusFrac, label) {
      var d = radiusFrac * 2 * 100;
      targetEl.style.left   = (pt.x * 100) + '%';
      targetEl.style.top    = (pt.y * 100) + '%';
      targetEl.style.width  = d + '%';
      targetEl.style.height = d + '%';
      targetEl.className = 'mt-target' + (label ? ' mt-target-start' : ' mt-target-step');
      targetEl.innerHTML = label ? '<span class="mt-target-label">' + label + '</span>' : '';
      targetEl.style.display = 'block';
    }
    placeTarget(GEOMETRY.start, RS, 'Start');

    // ── State ────────────────────────────────────────────────────
    var tScreenPerf = nowPerf();
    var recording = false;         // true between START click and 8th hit
    var finished  = false;
    var currentIdx = -1;           // index into GEOMETRY.targets of the visible target
    var current = GEOMETRY.start;  // point currently being hit-tested (START first)
    var currentRadius = RS;
    var trajectories = [];         // completed + in-progress
    var traj = null;               // in-progress trajectory
    var startLatencyMs = null;
    var skipTimer = null;
    var status = 'complete';       // complete | skipped | unsupported
    var totalMisclicksBeforeStart = 0;

    function newTrajectory(id, fromPt, toPt, hitEvt) {
      var meta = movementMeta(fromPt, toPt);
      var p = rel(hitEvt);
      var t = {
        id: id,
        from_label: fromPt.label, to_label: toPt.label,
        target_start: fromPt, target_end: toPt,
        meta: meta,
        t0_event: hitEvt.timeStamp,
        t0_perf: nowPerf(),
        samples: [], events: [],
        n_dispatched: 0, n_coalesced: 0, n_misclicks: 0,
        ptypes: {}, truncated: false, completed: false,
        click_start: [r4(p.x), r4(p.y)], click_end: null,
        duration_ms: null
      };
      // The click that ended the previous trajectory is this one's t = 0.
      t.events.push([0, r4(p.x), r4(p.y), 'down_start',
                     (typeof hitEvt.button === 'number') ? hitEvt.button : -1,
                     hitEvt.pointerType || (hasPointerEvents ? 'unknown' : 'mouse-fallback')]);
      return t;
    }

    function countPtype(t, pt) {
      pt = pt || (hasPointerEvents ? 'unknown' : 'mouse-fallback');
      t.ptypes[pt] = (t.ptypes[pt] || 0) + 1;
    }

    function pushMove(t, e, coalescedFlag) {
      if (t.samples.length >= trial.max_samples_per_trajectory) { t.truncated = true; return; }
      var p = rel(e);
      t.samples.push([r1(e.timeStamp - t.t0_event), r4(p.x), r4(p.y), coalescedFlag]);
    }

    function pushEvent(t, e, kind) {
      var p = rel(e);
      t.events.push([r1(e.timeStamp - t.t0_event), r4(p.x), r4(p.y), kind,
                     (typeof e.button === 'number') ? e.button : -1,
                     e.pointerType || (hasPointerEvents ? 'unknown' : 'mouse-fallback')]);
    }

    function isHit(e) {
      var p = rel(e);
      var dx = p.x - current.x, dy = p.y - current.y;
      return Math.sqrt(dx * dx + dy * dy) <= currentRadius * trial.hit_tolerance;
    }

    function dominantPtype(t) {
      var best = null, bestN = -1;
      for (var k in t.ptypes) {
        if (t.ptypes.hasOwnProperty(k) && t.ptypes[k] > bestN) { best = k; bestN = t.ptypes[k]; }
      }
      return best;
    }

    // ── Skip-control watchdog (safety valve, not part of the measure) ─
    // It is armed for START as well as every numbered target so a broken
    // pointing device cannot trap someone before acquisition begins.
    function armSkipTimer() {
      disarmSkipTimer();
      if (!trial.skip_link_after_ms || trial.skip_link_after_ms <= 0) return;
      skipTimer = jsPsych.pluginAPI.setTimeout(function () {
        skipTimer = null;
        skipEl.style.display = 'inline-block';
        // This is a native button, so Enter and Space activate the existing
        // click handler. Focusing it also makes the escape route immediately
        // reachable when the pointing device itself is unavailable.
        try { skipEl.focus({ preventScroll: true }); }
        catch (err) { skipEl.focus(); }
      }, trial.skip_link_after_ms);
    }
    function disarmSkipTimer() {
      if (skipTimer !== null) { clearTimeout(skipTimer); skipTimer = null; }
      skipEl.style.display = 'none';
    }
    skipEl.addEventListener('click', function () {
      if (finished) return;
      status = 'skipped';
      if (traj) {
        traj.completed = false;
        traj.duration_ms = null;
        trajectories.push(traj);
        traj = null;
      }
      endTask();
    });

    // ── Event handlers ───────────────────────────────────────────
    function onMove(e) {
      if (!recording || !traj) return;
      traj.n_dispatched++;
      countPtype(traj, e.pointerType);
      var list = null;
      if (coalescedSupported && e.type === 'pointermove' &&
          typeof e.getCoalescedEvents === 'function') {
        try { list = e.getCoalescedEvents(); } catch (err) { list = null; }
      }
      if (list && list.length > 0) {
        traj.n_coalesced += list.length;
        for (var i = 0; i < list.length; i++) pushMove(traj, list[i], 1);
      } else {
        pushMove(traj, e, 0);
      }
    }

    function onUp(e) {
      if (!recording || !traj) return;
      pushEvent(traj, e, 'up');
    }

    function onDown(e) {
      if (finished) return;
      // This listener is attached to document so paths remain continuous
      // outside the square. Keep the out-of-area safety control out of the
      // measurement rather than recording its activation as a target miss.
      if (e.target === skipEl || (skipEl.contains && skipEl.contains(e.target))) return;
      var primary = (typeof e.button !== 'number') || e.button === 0;

      if (!recording) {
        // Waiting for the START click.
        if (primary && isHit(e)) {
          startLatencyMs = r1(nowPerf() - tScreenPerf);
          recording = true;
          if (introEl) introEl.classList.add('mt-intro-dim');
          advanceTarget(e);
        } else {
          totalMisclicksBeforeStart++;
        }
        return;
      }

      if (primary && isHit(e)) {
        // Close the current trajectory with this hit …
        pushEvent(traj, e, 'down_hit');
        var p = rel(e);
        traj.click_end = [r4(p.x), r4(p.y)];
        traj.duration_ms = r1(e.timeStamp - traj.t0_event);
        traj.completed = true;
        trajectories.push(traj);
        traj = null;
        // … and open the next one (or finish).
        advanceTarget(e);
      } else {
        pushEvent(traj, e, 'down_miss');
        traj.n_misclicks++;
      }
    }

    function advanceTarget(hitEvt) {
      var fromPt = (currentIdx < 0) ? GEOMETRY.start : GEOMETRY.targets[currentIdx];
      currentIdx++;
      if (currentIdx >= GEOMETRY.targets.length) {
        recording = false;
        targetEl.style.display = 'none';
        statusEl.textContent = 'Activity complete. Thank you.';
        endTask();
        return;
      }
      current = GEOMETRY.targets[currentIdx];
      currentRadius = R;
      refreshRect();
      traj = newTrajectory(currentIdx + 1, fromPt, current, hitEvt);
      placeTarget(current, R, null);
      statusEl.textContent = 'Circle ' + (currentIdx + 1) + ' of ' + GEOMETRY.targets.length;
      armSkipTimer();
    }

    // Listen on document so movement outside the box is still captured.
    document.addEventListener(EV.move, onMove, { passive: true });
    document.addEventListener(EV.down, onDown, { passive: true });
    document.addEventListener(EV.up,   onUp,   { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', refreshRect, { passive: true });

    function removeListeners() {
      document.removeEventListener(EV.move, onMove);
      document.removeEventListener(EV.down, onDown);
      document.removeEventListener(EV.up,   onUp);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', refreshRect);
    }

    // Unsupported environment: never block the participant.
    if (!hasPointerEvents && typeof window.MouseEvent === 'undefined') {
      status = 'unsupported';
      endTask();
      return;
    }

    // START is part of the safety watchdog. advanceTarget() resets the same
    // timer after each successful hit.
    armSkipTimer();

    // ── End of acquisition → optional preview → pointer question ─
    function endTask() {
      if (finished) return;
      finished = true;
      recording = false;
      disarmSkipTimer();
      removeListeners();
      var tEndPerf = nowPerf();

      var proceed = function () {
        if (trial.show_pointer_question && status !== 'unsupported') {
          askPointerType(function (choice, rt) { writeAndFinish(tEndPerf, choice, rt); });
        } else {
          writeAndFinish(tEndPerf, null, null);
        }
      };
      if (trial.debug_preview && trajectories.length) {
        showDebugPreview(proceed);
      } else {
        proceed();
      }
    }

    function showDebugPreview(next) {
      var svg = display_element.querySelector('#mt-preview');
      var colors = ['#ef4444', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
      var out = '';
      // Geometry
      out += '<circle cx="' + (GEOMETRY.start.x * 1000) + '" cy="' + (GEOMETRY.start.y * 1000) +
             '" r="' + (RS * 1000) + '" class="mt-pv-start"/>';
      for (var g = 0; g < GEOMETRY.targets.length; g++) {
        var tg = GEOMETRY.targets[g];
        out += '<circle cx="' + (tg.x * 1000) + '" cy="' + (tg.y * 1000) + '" r="' + (R * 1000) +
               '" class="mt-pv-target"/>' +
               '<text x="' + (tg.x * 1000) + '" y="' + (tg.y * 1000 + 6) + '" class="mt-pv-label">' +
               (g + 1) + '</text>';
      }
      // Paths
      var rows = '';
      for (var i = 0; i < trajectories.length; i++) {
        var t = trajectories[i], pts = '';
        for (var s = 0; s < t.samples.length; s++) {
          pts += (t.samples[s][1] * 1000).toFixed(1) + ',' + (t.samples[s][2] * 1000).toFixed(1) + ' ';
        }
        if (pts) {
          out += '<polyline points="' + pts + '" fill="none" stroke="' + colors[i % colors.length] +
                 '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>';
        }
        rows += '<tr><td style="color:' + colors[i % colors.length] + ';font-weight:700;">' + t.id +
                '</td><td>' + t.from_label + ' to ' + t.to_label + '</td><td>' +
                (t.duration_ms === null ? 'Not available' : t.duration_ms) + '</td><td>' + t.samples.length +
                '</td><td>' + t.n_dispatched + '</td><td>' + t.n_coalesced + '</td><td>' + t.n_misclicks +
                '</td><td>' + escapeHTML(dominantPtype(t) || '') + '</td></tr>';
      }
      svg.innerHTML = out;
      svg.style.display = 'block';
      targetEl.style.display = 'none';
      statusEl.classList.add('mt-status-debug');
      statusEl.innerHTML =
        '<div class="mt-debug">' +
          '<div class="mt-debug-head">Developer preview</div>' +
          '<div class="mt-debug-meta">' +
            '<span><strong>Status</strong> ' + status + '</span>' +
            '<span><strong>Area</strong> ' + Math.round(areaRect.side) + ' px</span>' +
            '<span><strong>Device pixel ratio</strong> ' + (window.devicePixelRatio || 1) + '</span>' +
            '<span><strong>Coalesced events</strong> ' + (coalescedSupported ? 'Yes' : 'No') + '</span>' +
          '</div>' +
          '<div class="mt-debug-table-wrap"><table class="mt-debug-table"><thead><tr>' +
          '<th>Trajectory</th><th>Movement</th><th>Duration ms</th><th>Samples</th>' +
          '<th>Events</th><th>Coalesced</th><th>Misses</th><th>Pointer</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
          '<button type="button" class="mt-btn" id="mt-debug-continue">Continue</button>' +
        '</div>';
      display_element.querySelector('#mt-debug-continue').addEventListener('click', function () {
        svg.style.display = 'none';
        next();
      });
    }

    function askPointerType(cb) {
      var t0 = nowPerf();
      var btns = '';
      for (var i = 0; i < trial.pointer_choices.length; i++) {
        btns += '<button type="button" class="mt-btn mt-choice" data-choice="' +
                escapeHTML(trial.pointer_choices[i]) + '">' + escapeHTML(trial.pointer_choices[i]) +
                '</button>';
      }
      display_element.innerHTML =
        '<div class="mt-wrap" aria-labelledby="mt-question-title">' +
          '<div class="mt-copy">' +
            '<h1 class="mt-title" id="mt-question-title">One last question</h1>' +
            '<p class="mt-line">' + trial.pointer_question_text + '</p>' +
          '</div>' +
          '<div class="mt-choices">' + btns + '</div>' +
        '</div>';
      var nodes = display_element.querySelectorAll('.mt-choice');
      for (var j = 0; j < nodes.length; j++) {
        nodes[j].addEventListener('click', function (ev) {
          var choice = ev.currentTarget.getAttribute('data-choice');
          var rt = r1(nowPerf() - t0);
          cb(choice, rt);
        });
      }
      // Preserve a keyboard-only escape path if the pointing device failed
      // and the participant activated the focused skip button with Enter.
      if (nodes.length) {
        try { nodes[0].focus({ preventScroll: true }); }
        catch (err) { nodes[0].focus(); }
      }
    }

    // ── Serialise + write rows ───────────────────────────────────
    function writeAndFinish(tEndPerf, pointerChoice, pointerRt) {
      var ptypesSeen = {};
      var totalSamples = 0, totalMisclicks = 0, nCompleted = 0, anyTruncated = false;

      for (var i = 0; i < trajectories.length; i++) {
        var t = trajectories[i];
        for (var k in t.ptypes) if (t.ptypes.hasOwnProperty(k)) ptypesSeen[k] = true;
        totalSamples += t.samples.length;
        totalMisclicks += t.n_misclicks;
        if (t.completed) nCompleted++;
        if (t.truncated) anyTruncated = true;

        jsPsych.data.write({
          mt_row: 'trajectory',
          trajectory_id: t.id,
          movement_label: t.from_label + '->' + t.to_label,
          target_start_label: t.from_label,
          target_end_label: t.to_label,
          target_start_x: t.target_start.x,
          target_start_y: t.target_start.y,
          target_end_x: t.target_end.x,
          target_end_y: t.target_end.y,
          nominal_length: t.meta.nominal_length,
          nominal_direction_deg: t.meta.nominal_direction_deg,
          movement_orientation: t.meta.movement_orientation,
          movement_length_class: t.meta.movement_length_class,
          click_start_x: t.click_start[0],
          click_start_y: t.click_start[1],
          click_end_x: t.click_end ? t.click_end[0] : null,
          click_end_y: t.click_end ? t.click_end[1] : null,
          trajectory_duration_ms: t.duration_ms,
          trajectory_completed: t.completed,
          n_samples: t.samples.length,
          n_dispatched_events: t.n_dispatched,
          n_coalesced_samples: t.n_coalesced,
          n_misclicks: t.n_misclicks,
          samples_truncated: t.truncated,
          pointer_type: dominantPtype(t),
          t0_event_ms: r1(t.t0_event),
          t0_perf_ms: r1(t.t0_perf),
          // Compact raw signal. samples: [t_ms, x_norm, y_norm, coalesced]
          // events:  [t_ms, x_norm, y_norm, kind, button, pointerType]
          samples: JSON.stringify(t.samples),
          events:  JSON.stringify(t.events)
        });
      }

      var ptypeList = [];
      for (var p in ptypesSeen) if (ptypesSeen.hasOwnProperty(p)) ptypeList.push(p);
      ptypeList.sort();

      var summary = {
        mt_row: 'summary',
        mt_module_version: MODULE_VERSION,
        mt_geometry_version: GEOMETRY.version,
        mt_geometry_json: JSON.stringify(GEOMETRY),
        mt_status: status,
        mt_n_targets: GEOMETRY.targets.length,
        mt_n_trajectories_completed: nCompleted,
        mt_start_latency_ms: startLatencyMs,
        mt_total_task_ms: r1(tEndPerf - tScreenPerf),
        mt_total_samples: totalSamples,
        mt_total_misclicks: totalMisclicks,
        mt_misclicks_before_start: totalMisclicksBeforeStart,
        mt_any_truncated: anyTruncated,
        mt_area_side_px: Math.round(areaRect.side),
        mt_device_pixel_ratio: window.devicePixelRatio || 1,
        mt_viewport_w: window.innerWidth || null,
        mt_viewport_h: window.innerHeight || null,
        mt_screen_w: (window.screen && screen.width) || null,
        mt_screen_h: (window.screen && screen.height) || null,
        mt_fullscreen: isFullscreen(),
        mt_pointer_events_supported: hasPointerEvents,
        mt_coalesced_supported: coalescedSupported,
        mt_pointer_types_api: ptypeList.join('|'),
        mt_max_touch_points: (typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number')
          ? navigator.maxTouchPoints : null,
        mt_resized_during_task: resizedDuringTask,
        mt_pointer_type_self_report: pointerChoice,
        mt_pointer_question_rt_ms: pointerRt,
        mt_user_agent: (typeof navigator !== 'undefined') ? navigator.userAgent : null
      };

      // Convenience columns for the metadata table (every row).
      jsPsych.data.addProperties({
        mt_status: status,
        mt_pointer_type_self_report: pointerChoice
      });

      display_element.innerHTML = '';
      jsPsych.pluginAPI.clearAllTimeouts();
      jsPsych.finishTrial(summary);
    }
  };

  jsPsych.plugins['mouse-trajectory'] = plugin;

  // ── Trial builder ─────────────────────────────────────────────
  /**
   * Build the mouse-trajectory QC trial.
   * @param {Object} [opts]
   *   .debugPreview  — show recorded paths after the task (dev only)
   *   .skipAfterMs   — per-screen watchdog before the skip button appears
   */
  window.buildMouseTrajectoryTrial = function (opts) {
    opts = opts || {};
    return {
      type: 'mouse-trajectory',
      debug_preview: !!opts.debugPreview,
      skip_link_after_ms: (typeof opts.skipAfterMs === 'number') ? opts.skipAfterMs : 20000,
      data: { trial_category: 'mouse_trajectory_qc' }
    };
  };
})();
