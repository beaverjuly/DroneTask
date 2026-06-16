// memory_task.js

/*
 * jsPsych plugin for a three-stage temporal memory test.
 *
 * Stage 1: Temporal order judgement ("Which came first?")
 * Stage 2: Intervening-item count ("How many items between these two?")
 * Stage 3: Slider placement after every temporal-distance question.
  For one-intervening-item pairs, the only intervening item is probed.
  For two-intervening-item pairs, the earlier/later intervening probe is balanced within block.
 *
 * Supports main-task PNG image-path stimuli while keeping
 * practice text-emoji stimuli compatible.
 */

jsPsych.plugins['memory-task'] = (function() {
  var plugin = {};

  plugin.info = {
    name: 'memory-task',
    description: 'Three-stage temporal order, distance, and slider placement memory test.',
    parameters: {
      pair_index: {
        type: jsPsych.plugins.parameterType.INT,
        default: undefined
      },
      block_num: {
        type: jsPsych.plugins.parameterType.INT,
        default: undefined
      },
      block_index: {
        type: jsPsych.plugins.parameterType.INT,
        default: 0,
        description: '0-based block index for matching background theme to BLOCK_THEMES.'
      }
    }
  };

  // Fixed pair list (1-based indices within a 50-trial block)
  var PREDEFINED_PAIRS = [
    [2, 4], [6, 9], [7, 10], [11, 13], [16, 18], [17, 20],
    [22, 24], [23, 26], [28, 31], [30, 33], [34, 36], [35, 38],
    [39, 41], [42, 45]
  ];

  var SLIDER_PAIRS_LOCAL =
    (typeof SLIDER_PAIRS !== 'undefined') ? SLIDER_PAIRS : [[2,4],[11,13],[16,18],[22,24],[34,36],[39,41]];

  var BOUNDARY_MIDDLE_PAIRS_LOCAL =
    (typeof BOUNDARY_MIDDLE_PAIRS !== 'undefined') ? BOUNDARY_MIDDLE_PAIRS : [[2,4],[11,13],[39,41]];

  var NONBOUNDARY_MIDDLE_PAIRS_LOCAL =
    (typeof NONBOUNDARY_MIDDLE_PAIRS !== 'undefined') ? NONBOUNDARY_MIDDLE_PAIRS : [[16,18],[22,24],[34,36]];

  if (typeof window !== 'undefined') {
    window.PREDEFINED_PAIRS = PREDEFINED_PAIRS;
  }

  var pairOrderByBlock = {};
  var pairProgressByBlock = {};

  // For two-intervening-item pairs, balance whether the earlier or later
  // intervening item is used as the slider probe within each block.
  var placementProbeByBlock = {};

  var ORDER_LAYOUT_MODE = 'horizontal';
  var ORDER_KEYMAP_MODE = 'visual_fixed_1_left_2_right';

  function nextPairForBlock(block) {
    if (!pairOrderByBlock.hasOwnProperty(block)) {
      pairOrderByBlock[block] = jsPsych.randomization.shuffle(PREDEFINED_PAIRS.slice());
      pairProgressByBlock[block] = 0;
    }
    var order = pairOrderByBlock[block];
    var progress = pairProgressByBlock[block];
    if (progress >= order.length) return null;
    var pair = order[progress];
    pairProgressByBlock[block] = progress + 1;
    return pair;
  }

  function pairEquals(a, b) {
    return a[0] === b[0] && a[1] === b[1];
  }

  function pairInList(pair, list) {
    for (var i = 0; i < list.length; i++) {
      if (pairEquals(pair, list[i])) return true;
    }
    return false;
  }
  function pairKey(pair) {
    return pair[0] + '_' + pair[1];
  }

  function getInterveningIndices(pair) {
    var out = [];
    for (var i = pair[0] + 1; i < pair[1]; i++) {
      out.push(i);
    }
    return out;
  }

  function getDistance2Pairs() {
    return PREDEFINED_PAIRS.filter(function(pair) {
      return getInterveningIndices(pair).length === 2;
    });
  }

  function initPlacementProbeAssignments(block) {
    if (placementProbeByBlock.hasOwnProperty(block)) return;

    placementProbeByBlock[block] = {};

    var distance2Pairs = getDistance2Pairs();
    var shuffledPairs = jsPsych.randomization.shuffle(distance2Pairs.slice());

    shuffledPairs.forEach(function(pair, i) {
      var candidates = getInterveningIndices(pair);

      // For distance-2 pairs, candidates[0] is the earlier intervening item,
      // candidates[1] is the later intervening item.
      var chooseEarlier = (i % 2 === 0);
      placementProbeByBlock[block][pairKey(pair)] = chooseEarlier
        ? candidates[0]
        : candidates[1];
    });
  }

  function choosePlacementProbeIndex(block, pair, pairIndex, candidates) {
    if (!candidates || candidates.length === 0) return null;

    // One-intervening-item pairs are deterministic.
    if (candidates.length === 1) return candidates[0];

    // Two-intervening-item pairs are balanced within block.
    if (candidates.length === 2) {
      initPlacementProbeAssignments(block);

      var key = pairKey(pair);
      if (
        placementProbeByBlock[block] &&
        placementProbeByBlock[block].hasOwnProperty(key)
      ) {
        return placementProbeByBlock[block][key];
      }
    }

    // Fallback for future pair designs with more than two intervening items.
    return candidates[pairIndex % candidates.length];
  }

  function getPlacementTrialType(pair, placementProbeIndex, probeCandidates) {
    var base;

    if (pairInList(pair, BOUNDARY_MIDDLE_PAIRS_LOCAL)) {
      base = 'legacy_boundary_middle_pair';
    } else if (pairInList(pair, NONBOUNDARY_MIDDLE_PAIRS_LOCAL)) {
      base = 'legacy_nonboundary_middle_pair';
    } else if (isSliderPair(pair)) {
      base = 'legacy_slider_pair_other';
    } else {
      base = 'new_all_pair_slider';
    }

    var nCandidates = probeCandidates ? probeCandidates.length : 0;

    if (nCandidates === 1) {
      return base + '_distance1';
    }

    if (nCandidates === 2) {
      if (placementProbeIndex === probeCandidates[0]) {
        return base + '_distance2_earlier_probe';
      }
      if (placementProbeIndex === probeCandidates[1]) {
        return base + '_distance2_later_probe';
      }
      return base + '_distance2_unknown_probe';
    }

    return base + '_distance' + nCandidates;
  }

  function isSliderPair(pair) {
    return pairInList(pair, SLIDER_PAIRS_LOCAL);
  }

  function isEmojiStim(src) {
    return typeof src === 'string' && !src.includes('/') && !src.includes('.');
  }

  function createBlock3Wrapper() {
    var wrap = document.createElement('div');
    wrap.className = 'preview-screen block3-screen';
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'min-height:78vh;width:min(96vw,980px);max-width:980px;margin:0 auto;padding:20px;' +
      'box-sizing:border-box;border-radius:16px;' +
      'background:rgba(255,255,255,.85);' +
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
      'box-shadow:0 8px 32px rgba(0,0,0,.12);';
    return wrap;
  }

  function createStepLabel(text) {
    var label = document.createElement('div');
    label.className = 'step-label padded-text prominent-text';
    label.style.cssText =
      'font-size:28px;text-align:center;margin-bottom:20px;min-height:42px;font-weight:bold;';
    label.textContent = text;
    return label;
  }

  function getStimBoxSize(size) {
    var vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);

    if (size === 'small') {
      return Math.max(58, Math.min(88, Math.floor(vw * 0.10)));
    }

    // Medium cards for temporal-order and distance questions.
    // Keep them large enough to read, but small enough to stay horizontal.
    return Math.max(82, Math.min(132, Math.floor(vw * 0.16)));
  }

  function getStimFontSize(size, boxSize) {
    if (size === 'small') {
      return Math.max(34, Math.min(46, Math.floor(boxSize * 0.52)));
    }

    return Math.max(46, Math.min(72, Math.floor(boxSize * 0.52)));
  }

  function createStimCard(src, size) {
    var card = document.createElement('div');
    var boxSize = getStimBoxSize(size);

    card.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'width:' + boxSize + 'px;height:' + boxSize + 'px;' +
      'border:2px solid rgba(255,255,255,.18);border-radius:12px;' +
      'background:rgba(255,255,255,.08);box-shadow:0 6px 18px rgba(0,0,0,.18);';

    if (isEmojiStim(src)) {
      var span = document.createElement('span');
      span.textContent = src;
      span.style.cssText =
        'font-size:' + getStimFontSize(size, boxSize) + 'px;' +
        'line-height:1;display:flex;align-items:center;justify-content:center;' +
        'width:100%;height:100%;user-select:none;';
      card.appendChild(span);
      return { card: card, img: null, ready: true };
    }

    var img = document.createElement('img');
    img.src = src;
    img.style.cssText =
      'max-width:' + boxSize + 'px;height:auto;max-height:' + boxSize + 'px;' +
      'border-radius:8px;background:rgba(255,255,255,.08);';
    card.appendChild(img);

    return { card: card, img: img, ready: false };
  }

  function createSubtext(text) {
    var p = document.createElement('p');
    p.style.cssText = 'font-size:16px;text-align:center;color:#555;margin:0;';
    p.textContent = text;
    return p;
  }

  function makeChoiceColumn(stim, labelText) {
    var col = document.createElement('div');
    col.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:10px;flex-shrink:0;';

    var stimCard = createStimCard(stim, 'medium');

    var label = document.createElement('div');
    label.style.cssText =
      'font-size:24px;font-weight:bold;color:#333;';
    label.textContent = labelText;

    col.appendChild(stimCard.card);
    col.appendChild(label);

    return { col: col, cardObj: stimCard };
  }

  function waitForCardAssets(cards, onReady) {
    var total = cards.length;
    var loaded = 0;

    function markReady() {
      loaded++;
      if (loaded >= total) onReady();
    }

    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (!c || c.ready || !c.img) {
        markReady();
      } else {
        c.img.addEventListener('load', markReady, { once: true });
        c.img.addEventListener('error', markReady, { once: true });
        if (c.img.complete) {
          markReady();
        }
      }
    }
  }

  plugin.trial = function(display_element, trial) {
    // ── Apply the same sky gradient as the corresponding trial block ──
    // BLOCK_THEMES and skyGradientCSS are exported by trial.js.
    var _themes = window.BLOCK_THEMES || [];
    var _blockIdx = (typeof trial.block_index === 'number') ? trial.block_index : 0;
    var _theme = (_blockIdx >= 0 && _blockIdx < _themes.length)
      ? _themes[_blockIdx]
      : (window.PRACTICE_THEME || { hue: 220, sat: 15 });

    if (typeof window.skyGradientCSS === 'function') {
      document.body.style.background = window.skyGradientCSS(_theme.hue, _theme.sat);
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      // Fallback: clear to neutral
      document.body.style.backgroundImage = '';
    }
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundRepeat = '';

    var block = trial.block_num;

    function _getBlockParamsFromData() {
      try {
        var rec = jsPsych.data.get()
          .filterCustom(function(r) { return Array.isArray(r.true_vol) && r.true_vol.length; })
          .last(1).values()[0];

        if (rec && Array.isArray(rec.true_vol) && Array.isArray(rec.true_stc)) {
          return {
            true_vol: rec.true_vol,
            true_stc: rec.true_stc,
            true_valence: rec.true_valence || null
          };
        }
      } catch (e) {}
      return { true_vol: null, true_stc: null, true_valence: null };
    }

    var _bp = _getBlockParamsFromData();
    var _trueVolParam = (Array.isArray(_bp.true_vol) && _bp.true_vol.length >= block) ? _bp.true_vol[block - 1] : null;
    var _trueStcParam = (Array.isArray(_bp.true_stc) && _bp.true_stc.length >= block) ? _bp.true_stc[block - 1] : null;
    var _valence = (Array.isArray(_bp.true_valence) && _bp.true_valence.length >= block) ? _bp.true_valence[block - 1] : null;

    var _volLevel = (_trueVolParam === null) ? null : (_trueVolParam === 49 ? 'high' : 'low');
    var _stcLevel = (_trueStcParam === null) ? null : (_trueStcParam === 64 ? 'high' : 'low');
    var _condition = (_trueVolParam === null || _trueStcParam === null) ? null : ('vol' + _trueVolParam + '_stc' + _trueStcParam);

    var pair = nextPairForBlock(block);

    if (pair === null) {
      document.body.style.background = '';
      document.body.style.backgroundAttachment = '';
      jsPsych.finishTrial({
        task_phase: 'memory',
        block: block,
        true_vol_param: _trueVolParam,
        true_stc_param: _trueStcParam,
        valence: _valence,
        vol_level: _volLevel,
        stc_level: _stcLevel,
        condition: _condition,
        skipped_pair: true,
        pair_index: trial.pair_index,
        order_layout_mode: ORDER_LAYOUT_MODE,
        order_keymap_mode: 'visual_fixed_1_left_2_right',
        trial1_index: null,
        trial2_index: null,
        stim_left_img: null,
        stim_right_img: null,
        stim_first_actual: null,
        order_choice_side: null,
        order_choice_img: null,
        order_correct: null,
        order_correct_bin: null,
        order_rt: null,
        distance_estimate: null,
        distance_rt: null,
        pair_true_distance: null,
        attempt_number: null,
        timed_out: null,
        placement_slider_value: null,
        placement_rt: null,

        // New clearer probe fields
        was_legacy_slider_pair: null,
        placement_probe_index: null,
        placement_probe_img: null,
        placement_probe_position: null,
        placement_candidate_indices: null,
        placement_num_candidate_items: null,
        placement_trial_type: 'none',
        placement_true_position_pct: null,
        placement_error_from_true_position: null,

        // Legacy compatibility fields
        middle_item_index: null,
        middle_item_img: null,
        middle_item_is_boundary: null,
        placement_true_midpoint_pct: null,
        placement_error_from_true_midpoint: null
      });
      return;
    }

    var idx1 = pair[0];
    var idx2 = pair[1];

    // Pragmatic revision:
    // Every temporal-distance pair now receives a slider placement question.
    // isSliderPair(pair) is retained only as a legacy/special-pair label.
    var hasSlider = true;
    var wasLegacySliderPair = isSliderPair(pair);
    var probeCandidates = getInterveningIndices(pair);

    var placementProbeIndex = choosePlacementProbeIndex(
      block,
      pair,
      trial.pair_index,
      probeCandidates
    );

    var placementProbePosition =
      placementProbeIndex === null
        ? null
        : probeCandidates.indexOf(placementProbeIndex) + 1;

    // Keep older variable name for compatibility with existing rendering,
    // scoring, and analysis code.
    var middleItemIndex = placementProbeIndex;

    var placementTrialType = getPlacementTrialType(
      pair,
      placementProbeIndex,
      probeCandidates
    );

    var block_trials = jsPsych.data.get()
      .filter({ trial_type: 'trial', block: block })
      .filterCustom(function(t) { return t.true_vol_param !== null && t.true_vol_param !== undefined; })
      .values();

    // ── Dev-only fallback ──────────────────────────────────────────
    // jsPsych 6.3.1's data.write() overrides trial_type with the
    // current plugin name, so seeded rows from seedFakeBirdData end
    // up as trial_type:'call-function' and the filter above misses
    // them.  When running a dev test route, the seeded data is stored
    // in window.DEV_FAKE_BLOCK_DATA instead.
    if (block_trials.length === 0 &&
        typeof window.DEV_FAKE_BLOCK_DATA !== 'undefined' &&
        Array.isArray(window.DEV_FAKE_BLOCK_DATA[block])) {
      block_trials = window.DEV_FAKE_BLOCK_DATA[block].slice();
      console.log('[memory-task] Using DEV_FAKE_BLOCK_DATA fallback (' +
                  block_trials.length + ' trials for block ' + block + ')');
    }

    block_trials.sort(function(a, b) {
      return (a.trial || 0) - (b.trial || 0);
    });

    var stim1 = block_trials[idx1 - 1] ? block_trials[idx1 - 1].stim_img : undefined;
    var stim2 = block_trials[idx2 - 1] ? block_trials[idx2 - 1].stim_img : undefined;
    var middleStim =
        (middleItemIndex && block_trials[middleItemIndex - 1])
          ? block_trials[middleItemIndex - 1].stim_img
          : null;
          if (middleItemIndex !== null && middleStim === null) {
            console.warn('[memory-task] Missing placement probe stimulus', {
              block: block,
              pair: pair,
              middleItemIndex: middleItemIndex,
              block_trials_length: block_trials.length
            });
          }

    var true_first_idx = Math.min(idx1, idx2);
    var true_first_img = (true_first_idx === idx1) ? stim1 : stim2;

    var order_images = jsPsych.randomization.shuffle([stim1, stim2]);
    var left_img = order_images[0];
    var right_img = order_images[1];

    var order_choice_side = null, order_choice_img = null, order_correct = null;
    var order_rt = null, distance_rt = null, placement_rt = null;
    var placement_slider_value = null;
    var attempt_number = 1, distance_attempt_number = 1;
    var timed_out = false, responded = false;
    var orderTimeoutID = null;
    var distancePromptShown = false;

    function renderOrderScreen() {
      responded = false;
      var wrap = createBlock3Wrapper();
      wrap.id = 'order-container';
      wrap.style.visibility = 'hidden';

      wrap.appendChild(createStepLabel('Which came first?'));

      var pairWrap = document.createElement('div');
      // Always horizontal
      pairWrap.className = 'b3-pair-horizontal';
      var orderGap = Math.max(18, Math.min(48, Math.floor(window.innerWidth * 0.045)));
      pairWrap.style.cssText =
        'display:flex;flex-direction:row;justify-content:center;align-items:flex-start;' +
        'gap:' + orderGap + 'px;margin-bottom:20px;flex-wrap:nowrap;width:100%;' +
        'max-width:720px;';

      // Keep response labels visually intuitive.
      // Object positions are already randomized, so 1 can always mean left and 2 can always mean right.
      var leftLabel  = '1';
      var rightLabel = '2';

      var leftChoice  = makeChoiceColumn(left_img, leftLabel);
      var rightChoice = makeChoiceColumn(right_img, rightLabel);

      pairWrap.appendChild(leftChoice.col);
      pairWrap.appendChild(rightChoice.col);
      wrap.appendChild(pairWrap);

      var instrWrap = document.createElement('div');
      instrWrap.style.cssText =
        'display:flex;flex-direction:column;align-items:center;min-height:110px;';
      instrWrap.appendChild(createSubtext('Press 1 or 2 to select.'));
      wrap.appendChild(instrWrap);

      display_element.innerHTML = '';
      display_element.appendChild(wrap);

      var start_time = performance.now();

    waitForCardAssets([leftChoice.cardObj, rightChoice.cardObj], function() {
      wrap.style.visibility = 'visible';
    });

      function keyHandler(e) {
        if (e.repeat) return;
        if (window.__memorySuppressKeysUntil && performance.now() < window.__memorySuppressKeysUntil) {
          e.preventDefault();
          return;
        }
        if (responded) return;

        if (e.key === '1' || e.key === '2') {
          e.preventDefault();
          responded = true;
          clearTimeout(orderTimeoutID);
          order_rt = Math.round(performance.now() - start_time);
          var keySide = (e.key === '1') ? 'left' : 'right';

          order_choice_side = keySide;
          order_choice_img  = (keySide === 'left') ? left_img : right_img;
          order_correct = (order_choice_img === true_first_img);
          document.removeEventListener('keydown', keyHandler);
          renderDistancePrompt();
        }
      }

      document.addEventListener('keydown', keyHandler);

      orderTimeoutID = setTimeout(function() {
        if (!responded) {
          responded = true;
          timed_out = true;
          document.removeEventListener('keydown', keyHandler);
          wrap.style.border = '4px solid red';

          var msg = document.createElement('p');
          msg.style.cssText = 'font-size:24px;margin-top:20px;color:#d9534f;';
          msg.textContent = 'No selection made. Please make a selection within the allowed time.';
          wrap.appendChild(msg);

          setTimeout(function() {
            if (attempt_number < 2) {
              attempt_number++;
              renderOrderScreen();
            } else {
              finishTrial(null, Math.abs(idx2 - idx1) - 1, true);
            }
          }, 5000);
        }
      }, 7500);
    }

    function renderDistancePrompt(forceRerender) {
      if (distancePromptShown && forceRerender !== true) return;
      distancePromptShown = true;

      var true_distance = Math.abs(idx2 - idx1) - 1;

      var wrap = createBlock3Wrapper();
      wrap.id = 'distance-container';
      wrap.style.visibility = 'hidden';

      wrap.appendChild(createStepLabel('How many items were shown between these two?'));

      var pairWrap = document.createElement('div');
      var distanceGap = Math.max(22, Math.min(64, Math.floor(window.innerWidth * 0.055)));

      pairWrap.style.cssText =
        'display:flex;flex-direction:row;justify-content:center;align-items:center;' +
        'gap:' + distanceGap + 'px;margin-bottom:20px;flex-wrap:nowrap;width:100%;max-width:760px;';

      var l = createStimCard(left_img, 'medium');
      var r = createStimCard(right_img, 'medium');
      pairWrap.appendChild(l.card);
      pairWrap.appendChild(r.card);
      wrap.appendChild(pairWrap);

      var inputWrap = document.createElement('div');
      inputWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-height:110px;';
      var input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '9';
      input.id = 'distance-input';
      input.maxLength = 1;
      input.style.cssText =
        'font-size:22px;padding:8px;width:200px;text-align:center;margin-top:18px;-moz-appearance:textfield;appearance:textfield;';
      inputWrap.appendChild(input);
      inputWrap.appendChild(createSubtext('Press 0-9 to submit your answer.'));

      var errorEl = document.createElement('p');
      errorEl.id = 'distance-error';
      errorEl.style.cssText = 'color:#d9534f;font-size:18px;margin-top:10px;display:none;';
      inputWrap.appendChild(errorEl);
      wrap.appendChild(inputWrap);

      display_element.innerHTML = '';
      display_element.appendChild(wrap);

      if (!document.getElementById('memory-distance-input-style')) {
        var style = document.createElement('style');
        style.id = 'memory-distance-input-style';
        style.innerHTML =
          '#distance-input::-webkit-outer-spin-button,#distance-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}';
        document.head.appendChild(style);
      }

      var start_time = performance.now();
      var submitted = false, locked = false;

      waitForCardAssets([l, r], function() {
        wrap.style.visibility = 'visible';
        input.focus();
      });

      function showError(msg) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
      }

      function handleSubmit() {
        if (submitted || locked) return;
        var v = parseFloat(input.value);
        if (isNaN(v) || input.value === '') return;
        if (v < 0) v = 0;
        if (v > 9) {
          showError('Value must be 9 or below.');
          return;
        }

        submitted = true;
        clearTimeout(distTimeoutID);

        if (window._memoryDistanceKeyHandler) {
          document.removeEventListener('keydown', window._memoryDistanceKeyHandler);
          delete window._memoryDistanceKeyHandler;
        }

        window.__memorySuppressKeysUntil = performance.now() + 350;
        distance_rt = Math.round(performance.now() - start_time);

        renderSliderScreen(v, true_distance);
      }

      input.addEventListener('keydown', function(e) {
        if (locked) { e.preventDefault(); return; }
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab') return;
        if (e.ctrlKey || e.metaKey) return;
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          input.value = e.key;
          handleSubmit();
          return;
        }
        e.preventDefault();
      });

      input.addEventListener('wheel', function(e) { e.preventDefault(); });
      input.addEventListener('paste', function(e) { e.preventDefault(); });

      window._memoryDistanceKeyHandler = function(e) {
        if (submitted || locked) return;
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          input.value = e.key;
          handleSubmit();
        }
      };

      document.addEventListener('keydown', window._memoryDistanceKeyHandler);

      var distTimeoutID = setTimeout(function() {
        if (!submitted) {
          timed_out = true;
          locked = true;
          wrap.style.border = '4px solid red';
          input.disabled = true;

          var msg = document.createElement('p');
          msg.style.cssText = 'font-size:24px;margin-top:20px;color:#d9534f;';
          msg.textContent = 'No selection made. Please make a selection within the allowed time.';
          wrap.appendChild(msg);

          if (window._memoryDistanceKeyHandler) {
            document.removeEventListener('keydown', window._memoryDistanceKeyHandler);
            delete window._memoryDistanceKeyHandler;
          }

          setTimeout(function() {
            if (distance_attempt_number < 2) {
              distance_attempt_number++;
              distancePromptShown = false;
              renderDistancePrompt(true);
            } else {
              renderSliderScreen(null, true_distance);
            }
          }, 5000);
        }
      }, 7500);
    }

    function renderSliderScreen(dist_est_value, true_distance) {
      if (!middleStim) {
        console.warn('[memory-task] Skipping slider because placement probe stimulus is missing', {
          block: block,
          pair: pair,
          middleItemIndex: middleItemIndex,
          block_trials_length: block_trials.length
        });

        finishTrial(dist_est_value, true_distance, true);
        return;
      }

      // ── Inject slider-unset styles once per page load ───────────────
      if (!document.getElementById('b3-slider-unset-style')) {
        var st = document.createElement('style');
        st.id = 'b3-slider-unset-style';
        st.textContent = [
          // While unset: hide thumb, thicken track to be an obvious click target
          '.b3-slider.unset-thumb{cursor:crosshair;height:14px;}',
          '.b3-slider.unset-thumb::-webkit-slider-runnable-track{',
            'height:14px;background:rgba(80,80,80,.22);border-radius:7px;}',
          '.b3-slider.unset-thumb::-webkit-slider-thumb{',
            'opacity:0;width:1px;height:1px;pointer-events:none;}',
          '.b3-slider.unset-thumb::-moz-range-track{',
            'height:14px;background:rgba(80,80,80,.22);border-radius:7px;}',
          '.b3-slider.unset-thumb::-moz-range-thumb{',
            'opacity:0;width:1px;height:1px;}',
          // After placement: normal thumb
          '.b3-slider{cursor:pointer;height:6px;transition:height .12s;}',
        ].join('');
        document.head.appendChild(st);
      }

      var wrap = createBlock3Wrapper();
      wrap.id = 'slider-container';

      wrap.appendChild(createStepLabel('Where was this object shown between the two objects?'));

      var boundaryWrap = document.createElement('div');
      boundaryWrap.className = 'b3-boundary-card-wrap';
      boundaryWrap.style.cssText = 'margin-bottom:20px;';

      var middleCard = createStimCard(middleStim, 'small');
      boundaryWrap.appendChild(middleCard.card);
      wrap.appendChild(boundaryWrap);

      var lineShell = document.createElement('div');
      lineShell.className = 'b3-line-shell slider-shell';
      lineShell.style.cssText = 'position:relative;width:80%;margin:0 auto 12px;';

      var line = document.createElement('div');
      line.className = 'b3-line slider-line';
      line.style.cssText =
        'position:relative;display:flex;align-items:center;justify-content:space-between;';

      var firstImg  = (true_first_idx === idx1) ? stim1 : stim2;
      var secondImg = (true_first_idx === idx1) ? stim2 : stim1;

      var leftAnchor = createStimCard(firstImg, 'small');
      leftAnchor.card.classList.add('b3-anchor-card', 'left-anchor');
      leftAnchor.card.style.cssText += 'flex-shrink:0;';
      line.appendChild(leftAnchor.card);

      // ── Slider wrapper ──────────────────────────────────────────────
      var sliderWrap = document.createElement('div');
      sliderWrap.className = 'b3-slider-wrap';
      sliderWrap.style.cssText = 'flex:1;margin:0 16px;position:relative;';

      var slider = document.createElement('input');
      slider.className = 'b3-slider unset-thumb';
      slider.type  = 'range';
      slider.min   = '0';
      slider.max   = '100';
      slider.step  = '1';
      slider.value = '50';          // internal value; hidden until first touch
      slider.style.cssText = 'width:100%;display:block;';

      sliderWrap.appendChild(slider);
      line.appendChild(sliderWrap);

      var rightAnchor = createStimCard(secondImg, 'small');
      rightAnchor.card.classList.add('b3-anchor-card', 'right-anchor');
      rightAnchor.card.style.cssText += 'flex-shrink:0;';
      line.appendChild(rightAnchor.card);

      lineShell.appendChild(line);
      wrap.appendChild(lineShell);

      // ── Placement instruction (changes after first touch) ───────────
      var instrText = document.createElement('div');
      instrText.className = 'instruction-text padded-text prominent-subtext';
      instrText.style.cssText =
        'font-size:16px;text-align:center;margin-bottom:16px;font-weight:600;' +
        'color:#c0392b;';
      instrText.textContent =
        '↑ Click on the bar to place your estimate, then drag to adjust.';
      wrap.appendChild(instrText);

      // ── Submit button (disabled until participant places the slider) ─
      var submitBtn = document.createElement('button');
      submitBtn.style.cssText =
        'font-size:18px;padding:10px 32px;border:2px solid #333;border-radius:8px;' +
        'background:#fff;opacity:.4;cursor:not-allowed;';
      submitBtn.textContent = 'Submit';
      submitBtn.disabled = true;
      wrap.appendChild(submitBtn);

      display_element.innerHTML = '';
      display_element.appendChild(wrap);

      var start_time = performance.now();
      var hasPlaced  = false;

      // ── First-placement handler ─────────────────────────────────────
      // Uses mousedown/touchstart so the thumb snaps to the exact click
      // position before the browser fires any input event, and works even
      // if the participant clicks at the current internal value (50).
      function handleFirstPlacement(clientX) {
        if (hasPlaced) return;
        var rect  = slider.getBoundingClientRect();
        var frac  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        var val   = Math.round(frac * 100);
        slider.value = val;
        hasPlaced = true;
        slider.classList.remove('unset-thumb');
        instrText.textContent  = 'Drag to adjust, then click Submit.';
        instrText.style.color  = '#555';
        instrText.style.fontWeight = '400';
        submitBtn.disabled     = false;
        submitBtn.style.opacity   = '1';
        submitBtn.style.cursor    = 'pointer';
      }

      slider.addEventListener('mousedown', function(e) {
        handleFirstPlacement(e.clientX);
      });
      slider.addEventListener('touchstart', function(e) {
        if (e.touches.length > 0) handleFirstPlacement(e.touches[0].clientX);
      }, { passive: true });

      // Track value changes after placement (for the CSS fill trick)
      slider.addEventListener('input', function() {
        slider.style.setProperty('--slider-value', slider.value + '%');
      });

      submitBtn.addEventListener('click', function() {
        if (!hasPlaced) return;
        placement_slider_value = parseInt(slider.value, 10);
        placement_rt = Math.round(performance.now() - start_time);
        finishTrial(dist_est_value, true_distance, false);
      });

      // Timeout: record whatever is on the slider (or null if never placed)
      setTimeout(function() {
        if (placement_slider_value === null) {
          placement_slider_value = hasPlaced ? parseInt(slider.value, 10) : null;
          placement_rt = Math.round(performance.now() - start_time);
          timed_out = true;
          finishTrial(dist_est_value, true_distance, false);
        }
      }, 15000);
    }

    function finishTrial(dist_est, true_distance, skipped) {
      var placement_error_from_true_position = null;
      var true_position_pct = null;

      if (placement_slider_value !== null && middleItemIndex !== null) {
        // General formula:
        // [2,4], probe 3 → 50%
        // [6,9], probe 7 → 33.33%
        // [6,9], probe 8 → 66.67%
        true_position_pct = 100 * (middleItemIndex - idx1) / (idx2 - idx1);
        placement_error_from_true_position = placement_slider_value - true_position_pct;
      }

      // Use the new placementTrialType computed earlier:
      // e.g., legacy_boundary_middle_pair_distance1,
      // new_all_pair_slider_distance2_earlier_probe, etc.
      var placement_type = placementTrialType || 'none';

      var middle_item_is_boundary_value = null;
      if (pairInList(pair, BOUNDARY_MIDDLE_PAIRS_LOCAL)) {
        middle_item_is_boundary_value = 1;
      } else if (pairInList(pair, NONBOUNDARY_MIDDLE_PAIRS_LOCAL)) {
        middle_item_is_boundary_value = 0;
      }

      var trial_data = {
            task_phase: 'memory',
            block: block,
            true_vol_param: _trueVolParam,
            true_stc_param: _trueStcParam,
            valence: _valence,
            vol_level: _volLevel,
            stc_level: _stcLevel,
            condition: _condition,

            order_keymap_mode: 'visual_fixed_1_left_2_right',
            order_layout_mode: ORDER_LAYOUT_MODE,

            pair_index: trial.pair_index,
            trial1_index: idx1,
            trial2_index: idx2,

            stim_left_img: left_img,
            stim_right_img: right_img,
            stim_first_actual: true_first_img,

            order_choice_side: order_choice_side,
            order_choice_img: order_choice_img,
            order_correct: order_correct,
            order_correct_bin: (order_correct === null ? null : (order_correct ? 1 : 0)),
            order_rt: order_rt,

            distance_estimate: dist_est,
            distance_rt: distance_rt,
            pair_true_distance: true_distance,

            attempt_number: attempt_number,
            timed_out: timed_out,
            skipped_pair: skipped || false,

            // Slider response
            placement_slider_value: placement_slider_value,
            placement_rt: placement_rt,

            // New clearer probe fields
            was_legacy_slider_pair: wasLegacySliderPair,
            placement_probe_index: placementProbeIndex,
            placement_probe_img: middleStim,
            placement_probe_position: placementProbePosition,
            placement_candidate_indices: probeCandidates.join(','),
            placement_num_candidate_items: probeCandidates.length,
            placement_trial_type: placement_type,
            placement_true_position_pct: true_position_pct,
            placement_error_from_true_position: placement_error_from_true_position,

            // Legacy compatibility fields
            middle_item_index: middleItemIndex,
            middle_item_img: middleStim,
            middle_item_is_boundary: middle_item_is_boundary_value,
            placement_true_midpoint_pct: true_position_pct,
            placement_error_from_true_midpoint: placement_error_from_true_position
          };

          display_element.innerHTML = '';

          // Clear block gradient so it doesn't leak into non-memory screens.
          document.body.style.background = '';
          document.body.style.backgroundAttachment = '';

          jsPsych.finishTrial(trial_data);
        }

    renderOrderScreen();
  };

  return plugin;
})();