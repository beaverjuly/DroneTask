// ──────────────────────────────────────────────────────────────
// dev_routes.js — Dev/QA route timeline construction
//
// Provides:
//   seedFakeBlockData(blockNum, numTrials)
//     Seeds window.DEV_FAKE_BLOCK_DATA[blockNum] for dev memory QA.
//     Uses globals: stimulus_set_images, block_order, factors_vol,
//     factors_stc, factors_valence, latin_square_group, block_order_labels,
//     getCanonicalConditionId
//
//   buildDevTimeline(config)
//     Returns { timeline: [...], skipPreload: bool }
//     config: { stage, devBlockNum, devBlock, devNtrials, devVersion,
//               trials, create_memory_timeline,
//               welcome, feedback0, instructions_loop, comprehensionTimeline,
//               consent_trial, buildBlockMemoryTrials, survey_demographics,
//               feedback1, finish, SHOW_CONSENT }
//
//   Recognised ?stage= values (after alias normalisation in index.html's
//   _stageMap — see that file for the alias table):
//     instructions    — inst1..inst4 decks + practice trials, no main task
//     comprehension    — comprehension1/2 loops only, skips inst decks/practice
//     gate             — currently aliased to 'instructions' in index.html;
//                         this file still has a literal branch below in case
//                         a compatibility gate is reintroduced later
//     encoding         — one encoding block only (alias: 'bird')
//     test / recognition — one memory-test block only (alias: 'memory')
//     block            — one encoding block + its memory test
//                         (canonical link name: 'encoding-test', aliased
//                         to 'block' in index.html's _stageMap)
//     (anything else)  — full experiment, optionally capped via ntrials
// ──────────────────────────────────────────────────────────────

/**
 * Seed fake encoding data for dev memory-test routes.
 *
 * jsPsych 6.3.1's data.write() overrides trial_type with the current
 * plugin name, so fake rows stored via data.write() end up as
 * trial_type:'call-function' and are invisible to memory_task.js's
 * filter({trial_type:'trial'}).  This function stores the fake rows
 * in window.DEV_FAKE_BLOCK_DATA instead, which memory_task.js reads
 * as a dev-only fallback when the production query returns 0 rows.
 */
function seedFakeBlockData(blockNum, numTrials) {
  numTrials = numTrials || 50;
  var fakeImgs = stimulus_set_images.slice(0, numTrials);

  if (fakeImgs.length < numTrials) {
    console.warn('[DEV] seedFakeBlockData: only ' + fakeImgs.length +
                 ' stimulus images available, need ' + numTrials);
  }

  var design_idx = block_order[blockNum - 1];

  // Write the parameter record so _getBlockParamsFromData() in
  // memory_task.js can find vol/stc/valence arrays.  This record
  // does NOT rely on trial_type so the 6.3.1 override is harmless.
  jsPsych.data.write({
    true_vol: factors_vol,
    true_stc: factors_stc,
    true_valence: factors_valence,
    latin_square_group: latin_square_group,
    latin_square_order: block_order.join(','),
    latin_square_order_labels: block_order_labels.join('|')
  });

  // Dev fallback store
  if (!window.DEV_FAKE_BLOCK_DATA) window.DEV_FAKE_BLOCK_DATA = {};

  var fakeRows = [];
  for (var i = 0; i < numTrials; i++) {
    fakeRows.push({
      trial_type: 'trial',
      block: blockNum,
      display_block: blockNum,
      trial: i + 1,
      stim_img: fakeImgs[i],

      design_idx: design_idx,
      canonical_design_idx: design_idx,
      condition_id: getCanonicalConditionId(design_idx),

      true_vol_param: factors_vol[design_idx],
      true_stc_param: factors_stc[design_idx],
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

  console.log(
    '[DEV] Seeded ' + numTrials +
    ' fake trials → DEV_FAKE_BLOCK_DATA[' + blockNum + ']' +
    ', design_idx=' + design_idx +
    ', condition=' + getCanonicalConditionId(design_idx)
  );
  console.log('[DEV]   first stim_img = ' + fakeRows[0].stim_img);
  console.log('[DEV]   last  stim_img = ' + fakeRows[fakeRows.length - 1].stim_img);
  console.log('[DEV]   probe spot-check: pair [2,4] idx 3 → ' + fakeRows[2].stim_img);
}

/**
 * Build the dev-route timeline based on ?stage= parameter.
 *
 * @param {Object} cfg
 *   .stage               - normalised stage string
 *   .devBlockNum          - integer block number
 *   .devBlock             - raw block param string
 *   .devNtrials           - trial cap (0 = uncapped)
 *   .devVersion           - version string
 *   .trials               - encoding trial array from make_trials(0, block_order)
 *   .create_memory_timeline - function(blockNum) → memory timeline
 *   .welcome              - welcome trial
 *   .feedback0            - pre-instructions feedback trial
 *   .instructions_loop    - full instruction sequence
 *   .consent_trial        - consent trial object
 *   .buildBlockMemoryTrials - function() → interleaved encoding+memory
 *   .survey_demographics  - demographics survey trial
 *   .feedback1            - post-task feedback trial
 *   .finish               - finish trial
 *   .SHOW_CONSENT         - boolean
 *
 * @returns {{ timeline: Array, skipPreload: boolean }}
 */
function buildDevTimeline(cfg) {
  var timeline = [];
  var skipPreload = false;
  var stage = cfg.stage;

  // ── instructions only ──
  if (stage === 'instructions') {
    skipPreload = true;
    console.log('[DEV] stage: instructions only');
    timeline = timeline.concat(cfg.welcome, cfg.feedback0, cfg.instructions_loop);
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Instructions complete. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  // ── comprehension checks only (skips inst1–inst4 decks + practice) ──
  } else if (stage === 'comprehension') {
    skipPreload = true;
    console.log('[DEV] stage: comprehension checks only (loops until correct, never terminates)');
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:18px;padding:40px;"><strong>[DEV]</strong> Comprehension checks only ' +
                '— wrong-locked questions still route to their review deck. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });
    timeline = timeline.concat(cfg.comprehensionTimeline);
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Comprehension checks complete. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  // ── compatibility gate (removed) ──
  } else if (stage === 'gate') {
    skipPreload = true;
    console.log('[DEV] stage: compatibility gate (removed from runtime)');
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Compatibility gate has been removed. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  // ── encoding block only ──
  } else if (stage === 'encoding') {
    console.log('[DEV] stage: encoding, block=' + cfg.devBlock);
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:18px;padding:40px;"><strong>[DEV]</strong> Encoding — block <em>' +
                cfg.devBlock + '</em>. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });
    var encStart = (cfg.devBlockNum - 1) * 50;
    var encEnd   = cfg.devBlockNum * 50;
    timeline = timeline.concat(cfg.trials.slice(encStart, encEnd));
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Encoding complete. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  // ── memory test only (seeded data) ──
  } else if (stage === 'test' || stage === 'recognition') {
    console.log('[DEV] stage: ' + stage + ', block=' + cfg.devBlock);
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:18px;padding:40px;"><strong>[DEV]</strong> Memory test — block <em>' +
                cfg.devBlock + '</em>. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });
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

  // ── encoding + memory test, one block ──
  } else if (stage === 'block') {
    console.log('[DEV] stage: encoding+test (block ' + cfg.devBlockNum + ')');
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:18px;padding:40px;"><strong>[DEV]</strong> Encoding + Test — block ' +
                cfg.devBlockNum + '. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });
    var bStart = (cfg.devBlockNum - 1) * 50;
    var bEnd   = cfg.devBlockNum * 50;
    timeline = timeline.concat(cfg.trials.slice(bStart, bEnd));
    timeline = timeline.concat(cfg.create_memory_timeline(cfg.devBlockNum));
    timeline.push({
      type: 'html-keyboard-response',
      stimulus: '<p style="font-size:22px;padding:40px;"><strong>[DEV]</strong> Encoding + Test complete. Press any key.</p>',
      choices: jsPsych.ALL_KEYS
    });

  // ── full experiment (dev with ntrials cap, or unrecognised stage) ──
  } else {
    console.log('[DEV] stage: full experiment' +
                (cfg.devNtrials > 0 ? ' (ntrials=' + cfg.devNtrials + ')' : '') +
                ', version=' + cfg.devVersion);
    var combinedTrials = cfg.buildBlockMemoryTrials();

    if (cfg.SHOW_CONSENT) {
      timeline = timeline.concat(cfg.consent_trial);
    } else {
      console.log('[CONSENT] consent=0 — consent screen SKIPPED (dev only).');
    }

    timeline = timeline.concat(
      cfg.enter_fullscreen,
      cfg.welcome,
      cfg.feedback0,
      cfg.instructions_loop,
      combinedTrials,
      cfg.survey_demographics,
      cfg.feedback1,
      cfg.finish
    );
  }

  return { timeline: timeline, skipPreload: skipPreload };
}
