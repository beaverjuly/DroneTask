// ──────────────────────────────────────────────────────────────
// dev_routes.js — Dev/QA route timeline construction
// ──────────────────────────────────────────────────────────────

function seedFakeBlockData(blockNum, numTrials) {
  numTrials = numTrials || 50;
  var fakeImgs = stimulus_set_images.slice(0, numTrials);
  if (fakeImgs.length < numTrials) {
    console.warn('[DEV] seedFakeBlockData: only ' + fakeImgs.length +
                 ' stimulus images available, need ' + numTrials);
  }
  var design_idx = block_order[blockNum - 1];
  jsPsych.data.write({
    true_vol: factors_vol, true_stc: factors_stc, true_valence: factors_valence,
    latin_square_group: latin_square_group,
    latin_square_order: block_order.join(','),
    latin_square_order_labels: block_order_labels.join('|')
  });
  if (!window.DEV_FAKE_BLOCK_DATA) window.DEV_FAKE_BLOCK_DATA = {};
  var fakeRows = [];
  for (var i = 0; i < numTrials; i++) {
    fakeRows.push({
      trial_type: 'trial', block: blockNum, display_block: blockNum, trial: i + 1,
      stim_img: fakeImgs[i], design_idx: design_idx, canonical_design_idx: design_idx,
      condition_id: getCanonicalConditionId(design_idx),
      true_vol_param: factors_vol[design_idx], true_stc_param: factors_stc[design_idx],
      vol_level: factors_vol[design_idx] === 49 ? 'high' : 'low',
      stc_level: factors_stc[design_idx] === 64 ? 'high' : 'low',
      valence: factors_valence[design_idx],
      latin_square_group: latin_square_group,
      latin_square_order: block_order.join(','),
      latin_square_order_labels: block_order_labels.join('|'),
      randomized: design_idx
    });
  }
  window.DEV_FAKE_BLOCK_DATA[blockNum] = fakeRows;
  console.log('[DEV] Seeded ' + numTrials + ' fake trials → DEV_FAKE_BLOCK_DATA[' + blockNum + ']');
}

function _blockStride(trials, numBlocks) {
  numBlocks = numBlocks || 4;
  if (!trials || trials.length === 0) return 50;
  return Math.ceil(trials.length / numBlocks);
}

function buildDevTimeline(cfg) {
  var timeline = [];
  var skipPreload = false;
  var stage = cfg.stage;

  if (stage === 'instructions') {
    skipPreload = true;
    console.log('[DEV] stage: instructions only');
    timeline = timeline.concat(cfg.welcome, cfg.feedback0, cfg.instructions_loop);
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Instructions complete. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  } else if (stage === 'comprehension') {
    skipPreload = true;
    console.log('[DEV] stage: comprehension checks only');
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:18px;padding:40px;"><strong>[DEV]</strong> Comprehension checks only. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });
    timeline = timeline.concat(cfg.comprehensionTimeline);
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Comprehension checks complete. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  } else if (stage === 'gate') {
    skipPreload = true;
    console.log('[DEV] stage: compatibility gate (removed)');
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Compatibility gate removed. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  } else if (stage === 'survey') {
    // ── Survey / demographics only (no data saving) ──
    skipPreload = true;
    console.log('[DEV] stage: survey only (demographics preview)');
    timeline.push(cfg.feedback1);
    timeline.push(cfg.survey_demographics);
    timeline.push(cfg.finish);

  } else if (stage === 'encoding') {
    console.log('[DEV] stage: encoding, block=' + cfg.devBlock);
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:18px;padding:40px;"><strong>[DEV]</strong> Encoding — block <em>' + cfg.devBlock + '</em>. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });
    var stride = _blockStride(cfg.trials);
    var encStart = (cfg.devBlockNum - 1) * stride;
    var encEnd = cfg.devBlockNum * stride;
    console.log('[DEV] trial stride=' + stride + ', slicing [' + encStart + ', ' + encEnd + ')');
    timeline = timeline.concat(cfg.trials.slice(encStart, encEnd));
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Encoding complete. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  } else if (stage === 'test' || stage === 'recognition') {
    console.log('[DEV] stage: ' + stage + ', block=' + cfg.devBlock);
    timeline.push({
      type: 'call-function',
      func: function () { seedFakeBlockData(cfg.devBlockNum, 50); }
    });
    timeline = timeline.concat(cfg.create_memory_timeline(cfg.devBlockNum));
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Memory test complete. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  } else if (stage === 'block') {
    console.log('[DEV] stage: encoding+test (block ' + cfg.devBlockNum + ')');
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:18px;padding:40px;"><strong>[DEV]</strong> Encoding + Test — block ' + cfg.devBlockNum + '. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });
    var bStride = _blockStride(cfg.trials);
    var bStart = (cfg.devBlockNum - 1) * bStride;
    var bEnd = cfg.devBlockNum * bStride;
    console.log('[DEV] trial stride=' + bStride + ', slicing [' + bStart + ', ' + bEnd + ')');
    timeline = timeline.concat(cfg.trials.slice(bStart, bEnd));
    timeline = timeline.concat(cfg.create_memory_timeline(cfg.devBlockNum));
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Encoding + Test complete. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  } else {
    console.log('[DEV] stage: full experiment' +
                (cfg.devNtrials > 0 ? ' (ntrials=' + cfg.devNtrials + ')' : '') +
                ', version=' + cfg.devVersion);
    var combinedTrials = cfg.buildBlockMemoryTrials();
    if (cfg.SHOW_CONSENT) {
      timeline = timeline.concat(cfg.consent_trial);
    } else {
      console.log('[CONSENT] consent=0 — consent screen SKIPPED.');
    }
    timeline = timeline.concat(
      cfg.enter_fullscreen, cfg.welcome, cfg.feedback0, cfg.instructions_loop,
      combinedTrials, cfg.survey_demographics, cfg.feedback1, cfg.finish
    );
  }

  return { timeline: timeline, skipPreload: skipPreload };
}
