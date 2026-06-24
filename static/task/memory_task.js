// memory_task.js

/*
 * jsPsych plugin for a three-stage temporal memory test.
 *
 * Stage 1: Temporal order judgement ("Which came first?")
 * Stage 2: Intervening-item count ("How many items between these two?")
 * Stage 3: Slider placement after every temporal-distance question.
 * For one-intervening-item pairs, the only intervening item is probed.
 * For two-intervening-item pairs, the earlier/later intervening probe is balanced within block.
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
    return typeof src === 'string' && src.indexOf('/') === -1 && src.indexOf('.') === -1;
  }

  function cardBaseShadow() {
    return '0 0 16px rgba(0,0,0,.3),0 0 6px rgba(255,255,255,.08)';
  }

  function selectedCardShadow(accentGlow) {
    return '0 0 22px ' + accentGlow + ',0 0 10px rgba(255,255,255,.18)';
  }

  function styleSliderRail(rail) {
    rail.style.height = '6px';
    rail.style.background = 'rgba(255,255,255,.22)';
    rail.style.borderRadius = '999px';
    rail.style.boxShadow = 'inset 0 0 8px rgba(0,0,0,.25)';
  }

  function styleSliderThumb(thumb, active, accentFull, accentBorder, accentGlow) {
    thumb.style.width = active ? '22px' : '20px';
    thumb.style.height = active ? '22px' : '20px';
    thumb.style.borderRadius = '50%';
    thumb.style.background = active ? accentFull : 'rgba(255,255,255,.42)';
    thumb.style.border = active
      ? '2px solid ' + accentBorder
      : '2px solid rgba(255,255,255,.55)';
    thumb.style.boxShadow = active
      ? '0 0 18px ' + accentGlow + ',0 0 8px rgba(255,255,255,.18)'
      : '0 0 8px rgba(0,0,0,.25)';
  }

  function createBlock3Wrapper() {
    var wrap = document.createElement('div');
    wrap.className = 'preview-screen block3-screen';
    wrap.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'min-height:78vh;width:min(96vw,980px);max-width:980px;margin:0 auto;padding:20px;' +
      'box-sizing:border-box;';
    return wrap;
  }

  function createStepLabel(text) {
    var label = document.createElement('div');
    label.className = 'step-label padded-text prominent-text';
    label.style.cssText =
      'font-size:32px;text-align:center;margin-bottom:22px;min-height:42px;' +
      'font-weight:bold;color:#fff;' +
      'text-shadow:0 2px 12px rgba(0,0,0,.5),0 0 24px rgba(0,0,0,.25);';
    label.textContent = text;
    return label;
  }

  function getStimBoxSize(size) {
    var vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    var base = Math.min(vw, vh * 1.2); // adapts to aspect ratio

    if (size === 'large') {
      return Math.max(130, Math.min(190, Math.floor(base * 0.20)));
    }
    if (size === 'small') {
      return Math.max(80, Math.min(115, Math.floor(base * 0.13)));
    }
    // Medium — order/distance pair cards
    return Math.max(115, Math.min(180, Math.floor(base * 0.20)));
  }

  function getStimFontSize(size, boxSize) {
    if (size === 'small') {
      return Math.max(38, Math.min(56, Math.floor(boxSize * 0.55)));
    }
    return Math.max(52, Math.min(84, Math.floor(boxSize * 0.55)));
  }

  function createStimCard(src, size) {
    var card = document.createElement('div');
    var boxSize = getStimBoxSize(size);

    card.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'width:' + boxSize + 'px;height:' + boxSize + 'px;' +
      'border:2px solid rgba(255,255,255,.25);border-radius:14px;' +
      'background:rgba(0,0,0,.18);' +
      'box-shadow:' + cardBaseShadow() + ';';

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
    img.style.cssText =
      'max-width:' + boxSize + 'px;height:auto;max-height:' + boxSize + 'px;' +
      'border-radius:8px;background:rgba(255,255,255,.08);visibility:hidden;';

    var _failed = typeof isPreloadFailed === 'function' && isPreloadFailed(src);

    if (_failed) {
      var emoji = typeof getFallbackEmoji === 'function'
        ? getFallbackEmoji(src) : '\u2753';
      var fallbackSpan = document.createElement('span');
      fallbackSpan.textContent = emoji;
      fallbackSpan.style.cssText =
        'font-size:' + getStimFontSize(size, boxSize) + 'px;' +
        'line-height:1;display:flex;align-items:center;justify-content:center;' +
        'width:100%;height:100%;user-select:none;';
      card.appendChild(fallbackSpan);
      if (typeof logDisplayOutcome === 'function') {
        logDisplayOutcome(src, 'fallback_emoji', emoji);
      }
      return {
        card: card,
        img: null,
        ready: true,
        preload_failed: true,
        fallback_emoji: emoji
      };
    }

    card.appendChild(img);
    var resolvedSrc = (typeof resolvePreloadedUrl === 'function')
      ? resolvePreloadedUrl(src) : src;
    var isBlob = resolvedSrc.indexOf('blob:') === 0;
    var outcome = isBlob ? 'cached' : 'jit_success';

    var showFn = function() {
      img.src = resolvedSrc;
      if (typeof img.decode === 'function') {
        img.decode().then(
          function() { img.style.visibility = 'visible'; },
          function() { img.style.visibility = 'visible'; }
        );
      } else {
        img.addEventListener('load', function() {
          img.style.visibility = 'visible';
        }, { once: true });

        if (img.complete) {
          img.style.visibility = 'visible';
        }
      }
    };

    if (isBlob) {
      showFn();
      if (typeof logDisplayOutcome === 'function') {
        logDisplayOutcome(src, 'cached', null);
      }
    } else if (typeof ensurePreloaded === 'function') {
      ensurePreloaded(src).then(function(entry) {
        if (entry && entry.blobUrl) {
          resolvedSrc = entry.blobUrl;
        } else {
          outcome = 'direct_load';
        }
        showFn();
        if (typeof logDisplayOutcome === 'function') {
          logDisplayOutcome(src, outcome, null);
        }
      });
    } else {
      outcome = 'direct_load';
      showFn();
      if (typeof logDisplayOutcome === 'function') {
        logDisplayOutcome(src, 'direct_load', null);
      }
    }

    return {
      card: card,
      img: img,
      ready: false,
      preload_failed: false,
      fallback_emoji: null
    };
  }

  function createSubtext(text) {
    var p = document.createElement('p');
    p.style.cssText =
      'font-size:17px;text-align:center;color:rgba(255,255,255,.7);margin:0;' +
      'text-shadow:0 1px 6px rgba(0,0,0,.4);';
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
      'font-size:26px;font-weight:bold;color:rgba(255,255,255,.85);' +
      'text-shadow:0 2px 8px rgba(0,0,0,.4);';
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
    var _themes = window.BLOCK_THEMES || [];
    var _blockIdx = (typeof trial.block_index === 'number') ? trial.block_index : 0;
    var _theme = (_blockIdx >= 0 && _blockIdx < _themes.length)
      ? _themes[_blockIdx]
      : (window.PRACTICE_THEME || { hue: 220, sat: 15 });

    var _hue = _theme.hue || 210;
    var _accentFull = 'hsla(' + _hue + ',72%,56%,.9)';
    var _accentBorder = 'hsla(' + _hue + ',72%,56%,1)';
    var _accentGlow = 'hsla(' + _hue + ',72%,56%,.5)';
    var _accentSoft = 'hsla(' + _hue + ',55%,56%,.55)';
    var _accentFrame = 'hsla(' + _hue + ',72%,56%,.55)';
    var _accentFrameGlow = '0 0 16px hsla(' + _hue + ',72%,56%,.25)';
    var _accentText = 'hsl(' + _hue + ',65%,45%)';

    function _fadeTransition(renderFn) {
      var de = display_element;
      de.style.transition = 'opacity .18s ease-out';
      de.style.opacity = '0';
      setTimeout(function() {
        renderFn();
        de.style.opacity = '0';
        void de.offsetHeight;
        de.style.transition = 'opacity .22s ease-in';
        de.style.opacity = '1';
      }, 200);
    }

    if (typeof window.skyGradientCSS === 'function') {
      document.body.style.background = window.skyGradientCSS(_theme.hue, _theme.sat);
      document.body.style.backgroundAttachment = 'fixed';
    } else {
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
        order_keymap_mode: ORDER_KEYMAP_MODE,
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
        was_legacy_slider_pair: null,
        placement_probe_index: null,
        placement_probe_img: null,
        placement_probe_position: null,
        placement_candidate_indices: null,
        placement_num_candidate_items: null,
        placement_trial_type: 'none',
        placement_true_position_pct: null,
        placement_error_from_true_position: null,
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

    var middleItemIndex = placementProbeIndex;

    var placementTrialType = getPlacementTrialType(
      pair,
      placementProbeIndex,
      probeCandidates
    );

    var block_trials = jsPsych.data.get()
      .filter({ trial_type: 'trial', block: block })
      .filterCustom(function(t) {
        return t.true_vol_param !== null && t.true_vol_param !== undefined;
      })
      .values();

    if (
      block_trials.length === 0 &&
      typeof window.DEV_FAKE_BLOCK_DATA !== 'undefined' &&
      Array.isArray(window.DEV_FAKE_BLOCK_DATA[block])
    ) {
      block_trials = window.DEV_FAKE_BLOCK_DATA[block].slice();
      console.log(
        '[memory-task] Using DEV_FAKE_BLOCK_DATA fallback (' +
        block_trials.length + ' trials for block ' + block + ')'
      );
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

    var _left_preload_failed = typeof isPreloadFailed === 'function' && isPreloadFailed(left_img);
    var _right_preload_failed = typeof isPreloadFailed === 'function' && isPreloadFailed(right_img);
    var _left_fallback_emoji = _left_preload_failed && typeof getFallbackEmoji === 'function'
      ? getFallbackEmoji(left_img) : null;
    var _right_fallback_emoji = _right_preload_failed && typeof getFallbackEmoji === 'function'
      ? getFallbackEmoji(right_img) : null;

    var order_choice_side = null;
    var order_choice_img = null;
    var order_correct = null;
    var order_rt = null;
    var distance_rt = null;
    var placement_rt = null;
    var placement_slider_value = null;
    var attempt_number = 1;
    var distance_attempt_number = 1;
    var timed_out = false;
    var responded = false;
    var orderTimeoutID = null;
    var distancePromptShown = false;

    function _showTimeoutBadge(parentEl) {
      var badge = document.createElement('div');
      badge.style.cssText =
        'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;' +
        'padding:10px 22px;border-radius:999px;' +
        'background:rgba(217,83,79,.92);color:#fff;' +
        'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
        'font-size:14px;font-weight:600;letter-spacing:.02em;' +
        'box-shadow:0 4px 16px rgba(217,83,79,.35);' +
        'transition:opacity .4s;pointer-events:none;';
      badge.textContent = 'Please respond within the allowed time';
      document.body.appendChild(badge);
      setTimeout(function() { badge.style.opacity = '0'; }, 2500);
      setTimeout(function() {
        if (badge.parentNode) badge.parentNode.removeChild(badge);
      }, 3000);
    }

    function renderOrderScreen() {
      responded = false;
      var wrap = createBlock3Wrapper();
      wrap.id = 'order-container';
      wrap.style.visibility = 'hidden';

      wrap.appendChild(createStepLabel('Which came first?'));

      var pairWrap = document.createElement('div');
      var orderGap = Math.max(18, Math.min(48, Math.floor(window.innerWidth * 0.045)));
      pairWrap.style.cssText =
        'display:flex;flex-direction:row;justify-content:center;align-items:flex-start;' +
        'gap:' + orderGap + 'px;margin-bottom:20px;flex-wrap:nowrap;width:100%;max-width:720px;';

      var leftChoice = makeChoiceColumn(left_img, '←');
      var rightChoice = makeChoiceColumn(right_img, '→');

      pairWrap.appendChild(leftChoice.col);
      pairWrap.appendChild(rightChoice.col);
      wrap.appendChild(pairWrap);

      var instrWrap = document.createElement('div');
      instrWrap.style.cssText =
        'display:flex;flex-direction:column;align-items:center;min-height:60px;';
      instrWrap.appendChild(createSubtext('← → to select, Enter to confirm'));
      wrap.appendChild(instrWrap);

      display_element.innerHTML = '';
      display_element.appendChild(wrap);

      var start_time = performance.now();
      var hasInteracted = false;
      var currentSide = null;

      waitForCardAssets([leftChoice.cardObj, rightChoice.cardObj], function() {
        wrap.style.visibility = 'visible';
      });

      function resetChoiceFrame(choice) {
        choice.cardObj.card.style.border = '2px solid rgba(255,255,255,.38)';
        choice.cardObj.card.style.boxShadow = cardBaseShadow();
        choice.cardObj.card.style.transform = 'none';
      }

      function applyChoiceFrame(choice) {
        choice.cardObj.card.style.border = '3px solid ' + _accentBorder;
        choice.cardObj.card.style.boxShadow = selectedCardShadow(_accentGlow);
        choice.cardObj.card.style.transform = 'translateY(-2px)';
      }

      function highlightSide(side) {
        resetChoiceFrame(leftChoice);
        resetChoiceFrame(rightChoice);

        if (side === 'left') {
          applyChoiceFrame(leftChoice);
        } else {
          applyChoiceFrame(rightChoice);
        }
      }

      function submitOrder() {
        if (responded) return;
        responded = true;
        clearTimeout(orderTimeoutID);
        document.removeEventListener('keydown', keyHandler);
        order_rt = Math.round(performance.now() - start_time);
        order_choice_side = currentSide;
        order_choice_img = (currentSide === 'left') ? left_img : right_img;
        order_correct = (order_choice_img === true_first_img);
        window.__memorySuppressKeysUntil = performance.now() + 350;
        _fadeTransition(function() { renderDistancePrompt(); });
      }

      function keyHandler(e) {
        if (e.repeat) return;
        if (window.__memorySuppressKeysUntil && performance.now() < window.__memorySuppressKeysUntil) {
          e.preventDefault();
          return;
        }
        if (responded) return;

        var side = null;
        if (e.key === 'ArrowLeft' || e.key === '1') side = 'left';
        if (e.key === 'ArrowRight' || e.key === '2') side = 'right';

        if (side) {
          e.preventDefault();
          hasInteracted = true;
          currentSide = side;
          highlightSide(side);
        } else if ((e.key === 'Enter' || e.key === ' ') && hasInteracted) {
          e.preventDefault();
          submitOrder();
        }
      }

      document.addEventListener('keydown', keyHandler);

      orderTimeoutID = setTimeout(function() {
        if (responded) return;
        if (hasInteracted) {
          submitOrder();
        } else {
          responded = true;
          timed_out = true;
          document.removeEventListener('keydown', keyHandler);
          _showTimeoutBadge(wrap);
          setTimeout(function() {
            if (attempt_number < 2) {
              attempt_number++;
              _fadeTransition(function() { renderOrderScreen(); });
            } else {
              finishTrial(null, Math.abs(idx2 - idx1) - 1, true);
            }
          }, 3000);
        }
      }, 10000);
    }

    function renderDistancePrompt(forceRerender) {
      if (distancePromptShown && forceRerender !== true) return;
      distancePromptShown = true;

      var true_distance = Math.abs(idx2 - idx1) - 1;
      var STEP = 5;
      var FINE_STEP = 1;
      var curVal = 50;
      var hasPlaced = false;

      var wrap = createBlock3Wrapper();
      wrap.id = 'distance-container';
      wrap.style.visibility = 'hidden';

      wrap.appendChild(createStepLabel('How far apart in time did these two feel?'));

      var pairWrap = document.createElement('div');
      var gapPx = Math.max(22, Math.min(64, Math.floor(window.innerWidth * 0.055)));
      pairWrap.style.cssText =
        'display:flex;justify-content:center;align-items:center;' +
        'gap:' + gapPx + 'px;margin-bottom:22px;width:100%;max-width:760px;';
      var l = createStimCard(left_img, 'medium');
      var r = createStimCard(right_img, 'medium');
      pairWrap.appendChild(l.card);
      pairWrap.appendChild(r.card);
      wrap.appendChild(pairWrap);

      var barOuter = document.createElement('div');
      barOuter.style.cssText =
        'position:relative;width:80%;max-width:520px;height:40px;margin:0 auto;';

      var rail = document.createElement('div');
      rail.style.cssText =
        'position:absolute;left:0;right:0;top:50%;' +
        'transform:translateY(-50%);';
      styleSliderRail(rail);
      barOuter.appendChild(rail);

      for (var tk = 0; tk <= 10; tk++) {
        var tick = document.createElement('div');
        tick.style.cssText =
          'position:absolute;top:50%;width:1px;height:' + (tk % 5 === 0 ? '16' : '10') + 'px;' +
          'transform:translate(-50%,-50%);background:rgba(255,255,255,.15);left:' + (tk * 10) + '%;';
        barOuter.appendChild(tick);
      }

      var thumb = document.createElement('div');
      thumb.style.cssText =
        'position:absolute;top:50%;width:20px;height:20px;border-radius:50%;' +
        'transform:translate(-50%,-50%);transition:left .08s,background .15s,box-shadow .15s;' +
        'background:rgba(255,255,255,.4);border:2px solid rgba(255,255,255,.5);' +
        'left:50%;z-index:2;';
      barOuter.appendChild(thumb);
      wrap.appendChild(barOuter);

      var labelRow = document.createElement('div');
      labelRow.style.cssText =
        'display:flex;justify-content:space-between;width:80%;max-width:520px;margin:4px auto 0;';
      var lbl1 = document.createElement('span');
      lbl1.textContent = 'Very close';
      lbl1.style.cssText = 'font-size:15px;color:rgba(255,255,255,.7);font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.4);';
      var lbl2 = document.createElement('span');
      lbl2.textContent = 'Very far';
      lbl2.style.cssText = 'font-size:15px;color:rgba(255,255,255,.7);font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,.4);';
      labelRow.appendChild(lbl1);
      labelRow.appendChild(lbl2);
      wrap.appendChild(labelRow);

      var instrEl = document.createElement('div');
      instrEl.style.cssText =
        'font-size:16px;color:rgba(255,200,200,.95);font-weight:600;text-align:center;margin-top:14px;text-shadow:0 1px 6px rgba(0,0,0,.5);';
      instrEl.textContent = '← → to move, Enter to confirm';
      wrap.appendChild(instrEl);

      display_element.innerHTML = '';
      display_element.appendChild(wrap);

      var start_time = performance.now();
      var submitted = false;
      var distTimeoutID = null;

      function updateThumb() {
        thumb.style.left = curVal + '%';

        if (hasPlaced) {
          styleSliderThumb(thumb, true, _accentFull, _accentBorder, _accentGlow);
          instrEl.textContent = '← → to adjust, Enter to confirm';
          instrEl.style.color = 'rgba(255,255,255,.65)';
          instrEl.style.fontWeight = '400';
        } else {
          styleSliderThumb(thumb, false, _accentFull, _accentBorder, _accentGlow);
        }
      }

      updateThumb();

      waitForCardAssets([l, r], function() {
        wrap.style.visibility = 'visible';
      });

      function handleKey(e) {
        if (submitted) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          hasPlaced = true;
          curVal = Math.max(0, curVal - (e.shiftKey ? FINE_STEP : STEP));
          updateThumb();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          hasPlaced = true;
          curVal = Math.min(100, curVal + (e.shiftKey ? FINE_STEP : STEP));
          updateThumb();
        } else if ((e.key === 'Enter' || e.key === ' ') && hasPlaced) {
          e.preventDefault();
          submitted = true;
          clearTimeout(distTimeoutID);
          document.removeEventListener('keydown', handleKey);
          distance_rt = Math.round(performance.now() - start_time);
          window.__memorySuppressKeysUntil = performance.now() + 350;
          _fadeTransition(function() { renderSliderScreen(curVal, true_distance); });
        }
      }

      document.addEventListener('keydown', handleKey);

      distTimeoutID = setTimeout(function() {
        if (submitted) return;
        submitted = true;
        document.removeEventListener('keydown', handleKey);
        distance_rt = Math.round(performance.now() - start_time);
        window.__memorySuppressKeysUntil = performance.now() + 350;

        if (!hasPlaced) {
          timed_out = true;
          _showTimeoutBadge(wrap);
          setTimeout(function() {
            if (distance_attempt_number < 2) {
              distance_attempt_number++;
              distancePromptShown = false;
              _fadeTransition(function() { renderDistancePrompt(true); });
            } else {
              _fadeTransition(function() { renderSliderScreen(null, true_distance); });
            }
          }, 3000);
        } else {
          _fadeTransition(function() { renderSliderScreen(curVal, true_distance); });
        }
      }, 10000);
    }

    function renderSliderScreen(dist_est_value, true_distance) {
      if (!middleStim) {
        console.warn('[memory-task] Skipping slider — no probe stimulus', {
          block: block,
          pair: pair,
          middleItemIndex: middleItemIndex
        });
        finishTrial(dist_est_value, true_distance, true);
        return;
      }

      var STEP = 5;
      var FINE_STEP = 1;
      var curVal = 50;
      var hasPlaced = false;

      var wrap = createBlock3Wrapper();
      wrap.id = 'slider-container';

      wrap.appendChild(createStepLabel('Where was this object shown between the two?'));

      var probeWrap = document.createElement('div');
      probeWrap.style.cssText = 'text-align:center;margin-bottom:16px;';
      var probeCard = createStimCard(middleStim, 'large');

      probeCard.card.style.width = 'fit-content';
      probeCard.card.style.height = 'fit-content';
      probeCard.card.style.minWidth = '0';
      probeCard.card.style.minHeight = '0';
      probeCard.card.style.padding = '10px';
      probeCard.card.style.display = 'inline-flex';
      probeCard.card.style.border = '3px solid ' + _accentBorder;
      probeCard.card.style.borderRadius = '18px';
      probeCard.card.style.background = 'rgba(0,0,0,.20)';
      probeCard.card.style.boxShadow = selectedCardShadow(_accentGlow);

      if (probeCard.img) {
        probeCard.img.style.maxWidth = '150px';
        probeCard.img.style.maxHeight = '150px';
        probeCard.img.style.width = 'auto';
        probeCard.img.style.height = 'auto';
        probeCard.img.style.display = 'block';
        probeCard.img.style.borderRadius = '10px';
      }

      probeWrap.appendChild(probeCard.card);
      wrap.appendChild(probeWrap);

      var barRow = document.createElement('div');
      barRow.style.cssText =
        'display:flex;align-items:center;width:86%;max-width:680px;margin:0 auto;gap:12px;';

      var firstImg = (true_first_idx === idx1) ? stim1 : stim2;
      var secondImg = (true_first_idx === idx1) ? stim2 : stim1;

      var leftAnchor = createStimCard(firstImg, 'small');
      leftAnchor.card.style.flexShrink = '0';
      var rightAnchor = createStimCard(secondImg, 'small');
      rightAnchor.card.style.flexShrink = '0';

      var trackOuter = document.createElement('div');
      trackOuter.style.cssText = 'flex:1;position:relative;height:40px;';

      var rail = document.createElement('div');
      rail.style.cssText =
        'position:absolute;left:0;right:0;top:50%;height:6px;' +
        'transform:translateY(-50%);background:rgba(255,255,255,.2);border-radius:3px;';
      trackOuter.appendChild(rail);

      for (var tk = 0; tk <= 10; tk++) {
        var tick = document.createElement('div');
        tick.style.cssText =
          'position:absolute;top:50%;width:1px;height:' + (tk % 5 === 0 ? '16' : '10') + 'px;' +
          'transform:translate(-50%,-50%);background:rgba(0,0,0,.1);' +
          'left:' + (tk * 10) + '%;';
        trackOuter.appendChild(tick);
      }

      var thumb = document.createElement('div');
      thumb.style.cssText =
        'position:absolute;top:50%;' +
        'transform:translate(-50%,-50%);' +
        'transition:left .08s,background .15s,box-shadow .15s,border .15s;' +
        'left:50%;z-index:2;';
      styleSliderThumb(thumb, false, _accentFull, _accentBorder, _accentGlow);
      trackOuter.appendChild(thumb);

      barRow.appendChild(leftAnchor.card);
      barRow.appendChild(trackOuter);
      barRow.appendChild(rightAnchor.card);
      wrap.appendChild(barRow);

      var labelRow = document.createElement('div');
      labelRow.style.cssText =
        'display:flex;justify-content:space-between;width:86%;max-width:680px;' +
        'margin:4px auto 0;padding:0 80px;';
      var lblL = document.createElement('span');
      lblL.textContent = 'Closer to left';
      lblL.style.cssText = 'font-size:13px;color:rgba(255,255,255,.55);text-shadow:0 1px 4px rgba(0,0,0,.3);';
      var lblR = document.createElement('span');
      lblR.textContent = 'Closer to right';
      lblR.style.cssText = 'font-size:13px;color:rgba(255,255,255,.55);text-shadow:0 1px 4px rgba(0,0,0,.3);';
      labelRow.appendChild(lblL);
      labelRow.appendChild(lblR);
      wrap.appendChild(labelRow);

      var instrEl = document.createElement('div');
      instrEl.style.cssText =
        'font-size:16px;color:rgba(255,200,200,.95);font-weight:600;text-align:center;margin-top:14px;text-shadow:0 1px 6px rgba(0,0,0,.5);';
      instrEl.textContent = '← → to place, Enter to confirm';
      wrap.appendChild(instrEl);

      display_element.innerHTML = '';
      display_element.appendChild(wrap);

      var start_time = performance.now();
      var sliderTimeoutID = null;

      function updateThumb() {
        thumb.style.left = curVal + '%';

        if (hasPlaced) {
          styleSliderThumb(thumb, true, _accentFull, _accentBorder, _accentGlow);
          instrEl.textContent = '← → to adjust, Enter to confirm';
          instrEl.style.color = 'rgba(255,255,255,.65)';
          instrEl.style.fontWeight = '400';
        } else {
          styleSliderThumb(thumb, false, _accentFull, _accentBorder, _accentGlow);
        }
      }

      updateThumb();

      waitForCardAssets([probeCard, leftAnchor, rightAnchor], function() {
        wrap.style.visibility = 'visible';
      });

      function handleKey(e) {
        if (placement_slider_value !== null) return;

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          hasPlaced = true;
          var step = e.shiftKey ? FINE_STEP : STEP;
          curVal = Math.max(0, curVal - step);
          updateThumb();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          hasPlaced = true;
          var step2 = e.shiftKey ? FINE_STEP : STEP;
          curVal = Math.min(100, curVal + step2);
          updateThumb();
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!hasPlaced) return;
          placement_slider_value = curVal;
          placement_rt = Math.round(performance.now() - start_time);
          clearTimeout(sliderTimeoutID);
          document.removeEventListener('keydown', handleKey);
          window.__memorySuppressKeysUntil = performance.now() + 350;
          finishTrial(dist_est_value, true_distance, false);
        }
      }

      document.addEventListener('keydown', handleKey);

      sliderTimeoutID = setTimeout(function() {
        if (placement_slider_value === null) {
          placement_rt = Math.round(performance.now() - start_time);
          document.removeEventListener('keydown', handleKey);

          if (hasPlaced) {
            placement_slider_value = curVal;
            finishTrial(dist_est_value, true_distance, false);
          } else {
            timed_out = true;
            _showTimeoutBadge(wrap);
            placement_slider_value = null;
            setTimeout(function() {
              finishTrial(dist_est_value, true_distance, false);
            }, 3000);
          }
        }
      }, 15000);
    }

    function finishTrial(dist_est, true_distance, skipped) {
      var placement_error_from_true_position = null;
      var true_position_pct = null;

      if (placement_slider_value !== null && middleItemIndex !== null) {
        true_position_pct = 100 * (middleItemIndex - idx1) / (idx2 - idx1);
        placement_error_from_true_position = placement_slider_value - true_position_pct;
      }

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

        order_keymap_mode: ORDER_KEYMAP_MODE,
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
        distance_attempt_number: distance_attempt_number,
        timed_out: timed_out,
        skipped_pair: skipped || false,

        placement_slider_value: placement_slider_value,
        placement_rt: placement_rt,

        was_legacy_slider_pair: wasLegacySliderPair,
        placement_probe_index: placementProbeIndex,
        placement_probe_img: middleStim,
        placement_probe_position: placementProbePosition,
        placement_candidate_indices: probeCandidates.join(','),
        placement_num_candidate_items: probeCandidates.length,
        placement_trial_type: placement_type,
        placement_true_position_pct: true_position_pct,
        placement_error_from_true_position: placement_error_from_true_position,

        middle_item_index: middleItemIndex,
        middle_item_img: middleStim,
        middle_item_is_boundary: middle_item_is_boundary_value,
        placement_true_midpoint_pct: true_position_pct,
        placement_error_from_true_midpoint: placement_error_from_true_position,

        stim_left_preload_failed: _left_preload_failed,
        stim_right_preload_failed: _right_preload_failed,
        stim_left_fallback_emoji: _left_fallback_emoji,
        stim_right_fallback_emoji: _right_fallback_emoji
      };

      display_element.innerHTML = '';

      document.body.style.background = '';
      document.body.style.backgroundAttachment = '';

      jsPsych.finishTrial(trial_data);
    }

    renderOrderScreen();
  };

  return plugin;
})();