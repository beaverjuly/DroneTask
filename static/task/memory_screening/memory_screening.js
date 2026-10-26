/* Optional initial encoding and temporal-order assessment.
 *
 * Public API
 *   buildMemoryScreeningTimeline({seed, runId, onComplete})
 *     -> {timeline, state, design}
 *
 * Twenty green-supply turns use an independent fixed series and twenty
 * reserved object identities. Ten order questions cover each identity once.
 * The participant-facing flow never calls this assessment practice. Parent
 * timelines own saving, continuation, and the neutral early-completion screen.
 * This file does not change the main task's stimuli, timing, bonus, or memory
 * plugin. All rows carry an explicit phase tag for independent analysis.
 */
(function (root) {
  'use strict';

  var VERSION = 'ms-3.4.0-2026-10-25';
  var SERIES_VERSION = 'ms-hidden-medium-v5';
  var ITEM_VERSION = 'ms-objects-normed-g2';
  var N_ENCODING = 20;
  var N_PAIRS = 10;
  var MIN_CORRECT = 6;
  var ORDER_TIMEOUT_MS = 5000;
  // Identity and semantic aliases are audited against the actual main/practice
  // pools. Emoji-SP IDs refer to Ferre et al. (2023), whose Facebook-rendered
  // norms guide selection, not validated ratings of our Apple-rendered assets.
  var RESERVED_ITEMS = [
    { emoji: '🧦', concept: 'socks', family: 'clothing', norm_id: 837, aliases: ['sock'], detail: 'paired socks with contrasting heel and toe' },
    { emoji: '🧤', concept: 'gloves', family: 'clothing', norm_id: 835, aliases: ['glove'], detail: 'paired gloves with separate fingers and cuffs' },
    { emoji: '🧣', concept: 'scarf', family: 'clothing', norm_id: 834, aliases: ['neck-scarf'], detail: 'folded fabric, stripes and fringed ends' },
    { emoji: '👖', concept: 'jeans', family: 'clothing', norm_id: 833, aliases: ['trousers','pants'], detail: 'two denim legs, pockets and waistband' },
    { emoji: '🧢', concept: 'billed-cap', family: 'clothing', norm_id: 862, aliases: ['baseball-cap','sports-cap'], detail: 'curved visor and segmented crown' },
    { emoji: '🧽', concept: 'sponge', family: 'household', norm_id: 994, aliases: ['cleaning-sponge'], detail: 'porous yellow block and green scouring layer' },
    { emoji: '🧴', concept: 'lotion-bottle', family: 'household', norm_id: 988, aliases: ['pump-bottle','lotion'], detail: 'pump nozzle, bottle contour and label' },
    { emoji: '🚪', concept: 'door', family: 'fixture', norm_id: 982, aliases: ['wooden-door'], detail: 'wooden panels, frame and handle' },
    { emoji: '🔌', concept: 'electric-plug', family: 'electrical', norm_id: 894, aliases: ['electrical-plug','power-plug','plug'], detail: 'prongs, molded housing and curved cable' },
    { emoji: '📼', concept: 'videocassette', family: 'media', norm_id: 906, aliases: ['video-cassette','videotape','vhs'], detail: 'two reels, tape window and rectangular housing' },
    { emoji: '🔍', concept: 'magnifying-glass', family: 'optical', norm_id: 907, aliases: ['left-pointing-magnifying-glass','right-pointing-magnifying-glass'], detail: 'circular lens, rim and angled handle' },
    { emoji: '🔩', concept: 'nut-and-bolt', family: 'hardware', norm_id: 967, aliases: ['bolt-and-nut','nut-bolt'], detail: 'threaded shaft and hexagonal nut' },
    { emoji: '📋', concept: 'clipboard', family: 'stationery', norm_id: 951, aliases: ['clip-board'], detail: 'metal clip, board edge and ruled sheet' },
    { emoji: '📜', concept: 'scroll', family: 'stationery', norm_id: 920, aliases: ['parchment'], detail: 'rolled ends and lines on parchment' },
    { emoji: '📻', concept: 'radio', family: 'electrical', norm_id: 881, aliases: ['portable-radio'], detail: 'speaker grille, tuning scale and antenna' },
    { emoji: '🥢', concept: 'chopsticks', family: 'utensil', norm_id: 628, aliases: ['chopstick'], detail: 'two tapered sticks and decorated grips' },
    { emoji: '🧱', concept: 'brick', family: 'hardware', norm_id: 640, aliases: ['bricks'], detail: 'terracotta block, holes and textured edges' },
    { emoji: '🧪', concept: 'test-tube', family: 'laboratory', norm_id: 971, aliases: ['testtube'], detail: 'glass tube, colored liquid and small stopper' },
    { emoji: '📁', concept: 'file-folder', family: 'stationery', norm_id: 944, aliases: ['folder','open-file-folder'], detail: 'tabbed folder with overlapping leaves' },
    { emoji: '💈', concept: 'barber-pole', family: 'fixture', norm_id: 672, aliases: ['barbers-pole'], detail: 'striped cylinder with capped ends' }
  ];

  // Twenty equal shifts, including baseline -> turn 1, balance ten left
  // and ten right movements. Geometry is independent of item/test assignment.
  // The target stays hidden, as in the main task. Fixed amplitude removes
  // movement-size differences without claiming constant subjective surprise.
  var DRONE_INITIAL_POSITION = 50;
  // Midpoint of mean absolute shifts WHEN the main drone changes position,
  // rounded to 0.01 pp. Each block contributes 15 actual shifts; the 34 zero
  // shifts, unknown initial baseline, and between-block jumps are excluded.
  // Source vol=4 averages 14.099333 pp; vol=49 averages 4.000600 pp under
  // both reward/loss assignments. Their labels run opposite to movement.
  var DRONE_STEP_SIZE = 9.05;
  var DRONE_STEP_METRIC = 'mean_absolute_nonzero_main_drone_shift';
  var DRONE_DIRECTIONS = [1,1,-1,-1,1,-1,-1,1,-1,-1,1,1,-1,1,1,-1,1,1,-1,-1];
  var DRONE_ANIMATION_DURATION = 450;
  // Midpoint of the main groups' mean absolute rendered circle distances.
  // The real renderer clamps supply centres to 12..88 percent of the rail.
  // Source stc=16 averages 3.38752 pp; stc=64 averages 2.52705 pp after
  // that clamp. Equal magnitudes control unsigned distance while these
  // balanced, nonalternating signs vary its direction independently of items.
  var SUPPLY_OFFSET_SIZE = 2.957285;
  var SUPPLY_OFFSET_METRIC = 'mean_absolute_rendered_drone_to_landing_distance';
  var SUPPLY_DIRECTIONS = [1,1,-1,1,-1,-1,1,-1,-1,1,-1,-1,1,1,-1,-1,1,1,-1,1];

  // Main memory questions use serial gaps of two or three. Here, disjoint
  // pairs give all twenty screening items exactly one opportunity in a test.
  var PAIRS = [
    [1, 3], [2, 4], [5, 8], [6, 9], [7, 10],
    [11, 14], [12, 15], [13, 16], [17, 19], [18, 20]
  ];

  function hashSeed(seed) {
    var value = String(seed), h = 2166136261;
    for (var i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededRandom(seed) {
    var state = hashSeed(seed);
    return function () {
      state += 0x6D2B79F5;
      var t = state;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffled(values, random) {
    var out = values.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function round(value) { return Math.round(value * 1000000) / 1000000; }

  function normalizeIdentity(value) {
    return String(value).normalize('NFKC').replace(/[\uFE0E\uFE0F]/g, '')
      .toLowerCase().replace(/_/g, '-');
  }

  function validateItems(mainPool, practiceItems, fallbackItems) {
    var forbiddenConcepts = {}, forbiddenEmoji = {}, seen = {};
    (mainPool || []).forEach(function (src) {
      forbiddenConcepts[normalizeIdentity(String(src).split('/').pop().replace(/\.png$/i, ''))] = true;
    });
    (practiceItems || []).forEach(function (item) {
      if (typeof item === 'string') forbiddenEmoji[normalizeIdentity(item)] = true;
      else if (item) {
        forbiddenConcepts[normalizeIdentity(item.concept)] = true;
        forbiddenEmoji[normalizeIdentity(item.emoji)] = true;
      }
    });
    (fallbackItems || root.FALLBACK_EMOJI || []).forEach(function(emoji) {
      forbiddenEmoji[normalizeIdentity(emoji)] = true;
    });
    RESERVED_ITEMS.forEach(function (item) {
      var identity = normalizeIdentity(item.emoji);
      var overlaps = [item.concept].concat(item.aliases || []).some(function(alias) {
        return forbiddenConcepts[normalizeIdentity(alias)];
      });
      if (seen[identity] || forbiddenEmoji[identity] || overlaps) {
        throw new Error('Memory assessment item identity is duplicated or reserved elsewhere: ' + item.concept);
      }
      seen[identity] = true;
    });
    return true;
  }

  function createDesign(options) {
    options = options || {};
    var seed = String(options.seed === undefined ? ITEM_VERSION : options.seed);
    var random = seededRandom(seed + '|items');
    validateItems(options.mainPool || root.STIMULUS_IMAGE_POOL,
      options.practiceItems || root.PRACTICE_STIMULUS_ITEMS);
    var items, valid = false;
    // Avoid semantic pairs (e.g., socks versus gloves) and runs of three
    // same-family objects without choosing item order from pilot outcomes.
    for (var attempt = 0; attempt < 10000 && !valid; attempt++) {
      items = shuffled(RESERVED_ITEMS, random);
      valid = PAIRS.every(function(pair) {
        return items[pair[0] - 1].family !== items[pair[1] - 1].family;
      }) && items.every(function(item, i) {
        return i < 2 || item.family !== items[i - 1].family || item.family !== items[i - 2].family;
      });
    }
    if (!valid) throw new Error('Could not construct distinct-family memory questions.');
    items = items.map(function(item) {
      return copy(item, { img: 'static/task/memory_screening/items/' + item.concept + '.png' });
    });
    var starts = [], position = DRONE_INITIAL_POSITION;
    var drone = DRONE_DIRECTIONS.map(function(direction) {
      starts.push(position);
      position = round(position + direction * DRONE_STEP_SIZE);
      return position;
    });
    var offsets = SUPPLY_DIRECTIONS.map(function(direction) {
      return round(direction * SUPPLY_OFFSET_SIZE);
    });
    var bags = drone.map(function(x, i) { return round(x + offsets[i]); });
    var changes = drone.map(function() { return false; });
    random = seededRandom(seed + '|test');
    var correctSides = shuffled(['left', 'left', 'left', 'left', 'left',
      'right', 'right', 'right', 'right', 'right'], random);
    var pairs = shuffled(PAIRS, random).map(function (pair, i) {
      var first = items[pair[0] - 1].img;
      var second = items[pair[1] - 1].img;
      return {
        pair_index: i + 1,
        item1_trial: pair[0], item2_trial: pair[1],
        item1_img: first, item2_img: second,
        item1_concept: items[pair[0] - 1].concept, item2_concept: items[pair[1] - 1].concept,
        correct_side: correctSides[i],
        left_img: correctSides[i] === 'left' ? first : second,
        right_img: correctSides[i] === 'right' ? first : second
      };
    });
    return {
      version: VERSION, series_version: SERIES_VERSION, seed: seed,
      run_id: options.runId || 'ms-' + hashSeed(seed).toString(16),
      item_version: ITEM_VERSION, drone_visible: false, series_seed: 'memory-screen-medium-v5',
      drone_initial_position: DRONE_INITIAL_POSITION, drone_step_size: DRONE_STEP_SIZE,
      drone_step_metric: DRONE_STEP_METRIC,
      drone_directions: DRONE_DIRECTIONS.slice(), drone_start_positions: starts,
      drone_animation_duration_ms: DRONE_ANIMATION_DURATION,
      supply_offset_size: SUPPLY_OFFSET_SIZE, supply_offset_metric: SUPPLY_OFFSET_METRIC,
      supply_directions: SUPPLY_DIRECTIONS.slice(),
      items: items, stimuli: items.map(function (item) { return item.img; }),
      preload_images: items.map(function(item) { return item.img; }), drone_positions: drone, bag_positions: bags,
      wind_offsets: offsets, change_points: changes, pairs: pairs,
      n_encoding: N_ENCODING, n_pairs: N_PAIRS, min_correct: MIN_CORRECT,
      order_timeout_ms: ORDER_TIMEOUT_MS
    };
  }

  function evaluateResponses(responses) {
    responses = responses || [];
    // Count at most one recorded answer for each configured question. Missing
    // and timed-out answers count as incorrect, and fewer than ten rows can
    // never accidentally produce a passed result.
    var byPair = {}, duplicates = 0, invalid = 0;
    responses.forEach(function (row) {
      row = row || {};
      var id = Number(row.pair_index);
      if (!Number.isInteger(id) || id < 1 || id > N_PAIRS) invalid++;
      else if (byPair[id]) duplicates++;
      else byPair[id] = row;
    });
    var correct = 0, answered = 0, timedOut = 0, recorded = 0;
    Object.keys(byPair).forEach(function (id) {
      var row = byPair[id]; recorded++;
      var hasChoice = row.order_choice_side === 'left' || row.order_choice_side === 'right';
      if (hasChoice) answered++;
      if (row.timed_out) timedOut++;
      if (hasChoice && !row.timed_out && (row.order_correct === true || row.order_correct_bin === 1)) correct++;
    });
    var complete = recorded === N_PAIRS && duplicates === 0 && invalid === 0;
    return {
      n_correct: correct, n_pairs: N_PAIRS, min_correct: MIN_CORRECT,
      n_order_answered: answered, n_order_recorded: recorded,
      n_timed_out: timedOut, n_duplicate_pairs: duplicates,
      n_invalid_pairs: invalid, complete: complete,
      passed: complete && correct >= MIN_CORRECT,
      status: complete ? (correct >= MIN_CORRECT ? 'passed' : 'failed') : 'incomplete'
    };
  }

  function phaseData(category, design) {
    return {
      memory_screening: true, task_phase: 'memory_screening',
      trial_category: category,
      screening_run_id: design.run_id, screening_seed: design.seed,
      screening_series_version: design.series_version,
      screening_item_version: design.item_version,
      screening_drone_visible: design.drone_visible,
      screening_drone_step_metric: design.drone_step_metric,
      screening_supply_offset_size: design.supply_offset_size,
      screening_supply_offset_metric: design.supply_offset_metric,
      memory_screening_version: VERSION,
      block: 0, display_block: 0, practice_no: 0,
      design_idx: -1, canonical_design_idx: -1, condition_id: 'memory_screening'
    };
  }

  function copy(base, extra) {
    var result = {};
    Object.keys(base).forEach(function (key) { result[key] = base[key]; });
    Object.keys(extra || {}).forEach(function (key) { result[key] = extra[key]; });
    return result;
  }

  function cardImage(src) {
    if (typeof src === 'string' && src.indexOf('/') !== -1) {
      var resolved = typeof root.resolvePreloadedUrl === 'function' ? root.resolvePreloadedUrl(src) : src;
      return '<img src="' + resolved + '" alt="" draggable="false">';
    }
    return src; // simple characters remain supported by the isolated QA tests
  }

  function installPlugins(jsPsych) {
    if (!jsPsych || !jsPsych.plugins) return;
    if (!jsPsych.plugins['memory-screening-message']) {
      jsPsych.plugins['memory-screening-message'] = {
        info: { name: 'memory-screening-message', parameters: {
          title: { type: jsPsych.plugins.parameterType.STRING, default: '' },
          body: { type: jsPsych.plugins.parameterType.HTML_STRING, default: '' }
        } },
        trial: function (display, trial) {
          var start = performance.now(), done = false;
          display.innerHTML = '<div class="ms-instruction-container"><div class="ms-instruction-copy">' +
            '<h1>' + trial.title + '</h1>' + trial.body +
            '<p class="ms-start-hint">Press <strong>Space</strong> or click <strong>Next</strong> to begin.</p>' +
            '</div><button type="button" class="ms-next">Next &gt;</button></div>';
          function finish() {
            if (done) return;
            done = true;
            document.removeEventListener('keydown', key);
            display.innerHTML = '';
            jsPsych.finishTrial({ rt: Math.round(performance.now() - start) });
          }
          function key(e) {
            if (e.repeat) return;
            if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); finish(); }
          }
          document.addEventListener('keydown', key);
          display.querySelector('.ms-next').addEventListener('click', finish);
        }
      };
    }
    if (!jsPsych.plugins['memory-screening-order']) {
      jsPsych.plugins['memory-screening-order'] = {
        info: { name: 'memory-screening-order', parameters: {
          left_img: { type: jsPsych.plugins.parameterType.STRING, default: null },
          right_img: { type: jsPsych.plugins.parameterType.STRING, default: null },
          correct_side: { type: jsPsych.plugins.parameterType.STRING, default: null },
          response_timeout_ms: { type: jsPsych.plugins.parameterType.INT, default: ORDER_TIMEOUT_MS }
        } },
        trial: function (display, trial) {
          var start = performance.now(), wholeStart = start, finished = false, timer;
          var attempt = 1, attempts = [], waiting = false;
          display.innerHTML = '<div class="ms-order-screen"><div class="ms-order-panel">' +
            '<h1>Which item in the pair appeared first during the game?</h1>' +
            '<div class="ms-order-options"><div class="ms-order-option">' +
              '<div class="ms-order-card" role="img" aria-label="left item">' + cardImage(trial.left_img) + '</div>' +
              '<span class="ms-order-key" aria-hidden="true">←</span></div>' +
              '<div class="ms-order-option"><div class="ms-order-card" role="img" aria-label="right item">' + cardImage(trial.right_img) + '</div>' +
              '<span class="ms-order-key" aria-hidden="true">→</span></div></div>' +
            '<p class="ms-order-instruction">Press <strong>← or →</strong>.</p>' +
            '<p class="ms-order-timing">Begin your response within <strong>5 seconds</strong>.</p>' +
            '</div></div>';
          function finish(side) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            document.removeEventListener('keydown', key);
            var timedOut = side === null;
            var isCorrect = !timedOut && side === trial.correct_side;
            if (!timedOut) attempts.push({
              attempt_number: attempt, timed_out: false,
              rt_ms: Math.round(performance.now() - start), choice_side: side
            });
            root.__memorySuppressKeysUntil = performance.now() + 350;
            display.innerHTML = '';
            jsPsych.finishTrial({
              order_choice_side: side,
              order_choice_img: side === null ? null : (side === 'left' ? trial.left_img : trial.right_img),
              order_correct: isCorrect, order_correct_bin: isCorrect ? 1 : 0,
              order_rt: timedOut ? null : Math.round(performance.now() - start),
              timed_out: timedOut, response_timeout_ms: trial.response_timeout_ms,
              attempt_number: attempt, had_timeout: attempts.some(function (row) { return row.timed_out; }),
              order_attempts_json: JSON.stringify(attempts),
              order_total_duration_ms: Math.round(performance.now() - wholeStart),
              order_keymap_mode: 'visual_fixed_1_left_2_right', order_layout_mode: 'horizontal'
            });
          }
          function key(e) {
            if (e.repeat || waiting || finished) return;
            if (root.__memorySuppressKeysUntil && performance.now() < root.__memorySuppressKeysUntil) {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === '1' || e.key === '2') e.preventDefault();
              return;
            }
            if (e.key === 'ArrowLeft' || e.key === '1') { e.preventDefault(); finish('left'); }
            if (e.key === 'ArrowRight' || e.key === '2') { e.preventDefault(); finish('right'); }
          }
          function beginAttempt() {
            waiting = false;
            start = performance.now();
            document.addEventListener('keydown', key);
            timer = setTimeout(function () {
              if (finished || waiting) return;
              waiting = true;
              document.removeEventListener('keydown', key);
              attempts.push({ attempt_number: attempt, timed_out: true, rt_ms: null, choice_side: null });
              var badge = document.createElement('div');
              badge.className = 'ms-timeout-badge';
              badge.setAttribute('role', 'status');
              badge.textContent = 'Please respond within 5 seconds';
              display.appendChild(badge);
              // Match the main order question's reminder and one retry. An
              // answered question is never repeated or given correctness feedback.
              timer = setTimeout(function () {
                if (badge.parentNode) badge.parentNode.removeChild(badge);
                if (attempt < 2) { attempt++; beginAttempt(); }
                else finish(null);
              }, 3000);
            }, trial.response_timeout_ms);
          }
          beginAttempt();
        }
      };
    }
  }

  function buildTimeline(options) {
    options = options || {};
    var jsPsych = root.jsPsych;
    if (!jsPsych || !jsPsych.plugins || !jsPsych.plugins.trial) {
      throw new Error('The initial memory assessment requires jsPsych and the encoding trial plugin.');
    }
    installPlugins(jsPsych);
    var design = createDesign(options);
    var state = { status: 'pending', passed: null, summary: null, n_encoding_completed: 0 };
    var responses = [], collector = 50, timeline = [];
    timeline.push({
      type: 'memory-screening-message', title: 'The game will now begin.',
      body: '<p>On this planet, the <strong>drone will be hidden</strong>.</p>' +
        '<p>The supplies will be <strong>green</strong>.</p>',
      data: phaseData('memory_screening_instruction', design),
      on_start: function () {
        state.status = 'running'; state.passed = null;
        collector = 50; responses = []; state.n_encoding_completed = 0;
        jsPsych.data.addProperties({
          memory_screening_version: VERSION,
          memory_screening_status: 'running', memory_screening_passed: null,
          memory_screening_n_correct: 0, memory_screening_n_pairs: N_PAIRS,
          memory_screening_min_correct: MIN_CORRECT,
          memory_screening_n_encoding_completed: 0,
          memory_screening_n_order_answered: 0,
          memory_screening_n_order_recorded: 0,
          memory_screening_n_timed_out: 0,
          memory_screening_seed: design.seed,
          memory_screening_run_id: design.run_id,
          memory_screening_series_version: SERIES_VERSION,
          memory_screening_item_version: ITEM_VERSION,
          memory_screening_drone_visible: design.drone_visible,
          memory_screening_geometry_seed: design.series_seed,
          memory_screening_drone_initial_position: design.drone_initial_position,
          memory_screening_drone_step_size: design.drone_step_size,
          memory_screening_drone_step_metric: design.drone_step_metric,
          memory_screening_supply_offset_size: design.supply_offset_size,
          memory_screening_supply_offset_metric: design.supply_offset_metric
        });
      }
    });
    design.items.forEach(function (item, index) {
      timeline.push({
        type: 'trial',
        data: copy(phaseData('memory_screening_encoding', design), {
          trial: index + 1, screening_trial: index + 1,
          stim_img: item.img, stimulus_emoji: item.emoji, stimulus_concept: item.concept,
          screening_drone_start_position: design.drone_start_positions[index],
          screening_drone_step: design.drone_directions[index] * design.drone_step_size,
          screening_drone_direction: design.drone_directions[index] < 0 ? 'left' : 'right',
          screening_drone_animation_duration_ms: design.drone_animation_duration_ms,
          screening_wind_offset: design.wind_offsets[index],
          screening_supply_side: design.supply_directions[index] < 0 ? 'left' : 'right',
          screening_change_point: design.change_points[index]
        }),
        true_vol_param: null, true_stc_param: null, vol_level: null,
        valence: 'reward', condition_id: 'memory_screening',
        stim_img: item.img, block_index: -1,
        supply_distribution: [-4.25, -3, -1.75, -0.75, -0.25, 0.25, 0.75, 1.75, 3, 4.25],
        supply_duration: [350, 400, 500, 550, 600, 600, 600, 500, 500, 400],
        bag_position: design.bag_positions[index],
        drone_position: design.drone_positions[index],
        drone_start_position: design.drone_start_positions[index],
        animate_drone: false, show_drone: design.drone_visible, drone_animation_duration: design.drone_animation_duration_ms,
        is_moving_practice: false, show_missing: false, strong_warning: false,
        hide_stimulus: false,
        on_start: function (trial) { trial.bucket_position = collector; },
        on_finish: function (data) {
          if (typeof data.bucket_position === 'number') collector = data.bucket_position;
          if (data.completed === 1) state.n_encoding_completed++;
        }
      });
    });
    timeline.push({
      type: 'memory-screening-message', title: 'You will now complete a memory task.',
      body: '<p>You will be asked which item in a pair <strong>appeared first</strong> during the game.</p>' +
        '<p>Use <strong>← or →</strong> to choose the item.</p>' +
        '<p>Begin each response within <strong>5 seconds</strong>.</p>' +
        '<p class="memory-no-score-emphasis"><em>These questions will not affect your score.</em></p>',
      data: phaseData('memory_screening_instruction', design)
    });
    design.pairs.forEach(function (pair) {
      timeline.push({
        type: 'memory-screening-order',
        left_img: pair.left_img, right_img: pair.right_img,
        correct_side: pair.correct_side,
        response_timeout_ms: ORDER_TIMEOUT_MS,
        data: copy(phaseData('memory_screening_order', design), copy(pair, {
          true_first_img: pair.item1_img,
          pair_true_distance: pair.item2_trial - pair.item1_trial - 1
        })),
        on_finish: function (data) { responses.push(copy(data)); }
      });
    });
    timeline.push({
      type: 'call-function', func: function () {},
      data: phaseData('memory_screening_summary', design),
      on_start: function (trial) {
        var result = evaluateResponses(responses);
        // A complete order assessment cannot pass if encoding was interrupted.
        if (state.n_encoding_completed !== N_ENCODING) {
          result.passed = false; result.status = 'incomplete';
        }
        var summary = {
          memory_screening_version: VERSION,
          memory_screening_status: result.status,
          memory_screening_passed: result.passed,
          memory_screening_n_correct: result.n_correct,
          memory_screening_n_pairs: N_PAIRS,
          memory_screening_min_correct: MIN_CORRECT,
          memory_screening_n_encoding_completed: state.n_encoding_completed,
          memory_screening_n_order_answered: result.n_order_answered,
          memory_screening_n_order_recorded: result.n_order_recorded,
          memory_screening_n_timed_out: result.n_timed_out,
          memory_screening_seed: design.seed,
          memory_screening_run_id: design.run_id,
          memory_screening_series_version: SERIES_VERSION,
          memory_screening_item_version: ITEM_VERSION,
          memory_screening_drone_visible: design.drone_visible,
          memory_screening_geometry_seed: design.series_seed,
          memory_screening_drone_initial_position: design.drone_initial_position,
          memory_screening_drone_step_size: design.drone_step_size,
          memory_screening_drone_step_metric: design.drone_step_metric,
          memory_screening_drone_directions_json: JSON.stringify(design.drone_directions),
          memory_screening_supply_offset_size: design.supply_offset_size,
          memory_screening_supply_offset_metric: design.supply_offset_metric,
          memory_screening_supply_directions_json: JSON.stringify(design.supply_directions),
          memory_screening_drone_positions_json: JSON.stringify(design.drone_positions),
          memory_screening_bag_positions_json: JSON.stringify(design.bag_positions),
          memory_screening_items_json: JSON.stringify(design.items),
          memory_screening_pairs_json: JSON.stringify(design.pairs)
        };
        state.status = result.status; state.passed = result.passed; state.summary = summary;
        trial.data = copy(trial.data, summary);
        collector = 50;
      },
      on_finish: function (data) {
        // Large item, pair and geometry arrays belong to the summary row.
        // Copy only scalar outcomes to every other row.
        var scalarSummary = {};
        Object.keys(state.summary).forEach(function(key) {
          if (!/_json$/.test(key) && (state.summary[key] === null || typeof state.summary[key] !== 'object')) {
            scalarSummary[key] = state.summary[key];
          }
        });
        jsPsych.data.addProperties(scalarSummary);
        if (typeof options.onComplete === 'function') options.onComplete(copy(state.summary), state, data);
      }
    });
    return { timeline: timeline, state: state, design: design };
  }

  var api = {
    version: VERSION, series_version: SERIES_VERSION, item_version: ITEM_VERSION,
    n_encoding: N_ENCODING, n_pairs: N_PAIRS, min_correct: MIN_CORRECT,
    order_timeout_ms: ORDER_TIMEOUT_MS,
    createDesign: createDesign, evaluateResponses: evaluateResponses,
    validateItems: validateItems, reserved_items: RESERVED_ITEMS,
    buildTimeline: buildTimeline
  };
  root.MemoryScreening = api;
  root.MEMORY_SCREENING_MODULE_VERSION = VERSION;
  root.buildMemoryScreeningTimeline = buildTimeline;
  installPlugins(root.jsPsych);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
