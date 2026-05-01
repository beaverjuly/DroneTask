// ═══════════════════════════════════════════════════════════════════════
// comprehension1.js — Mission mechanics check (with topic-aware review)
//
// Behaviour:
//   • First render: all questions editable, no marks.
//   • On Submit (any wrong):
//       correct  → locked, GREEN border, ✓ badge
//       wrong    → locked, RED   border, "Click to review →" CTA
//                  (radios disabled — cannot be edited until reviewed)
//   • Click on a wrong-locked question → finishTrial({
//         done:false, review_topic:'inst1'|'inst2'|'inst3', ... })
//     The timeline downstream takes the participant to that block, then
//     loops back here.
//   • On re-entry, questions previously CLICKED become editable
//     (ORANGE border, "Please answer again" hint). Other wrong questions
//     remain locked-clickable. Correct ones remain locked-correct.
//   • Submit again validates only the editable questions; locked answers
//     do not change. Once all are correct → finishTrial({done:true,...}).
//
// Question → topic mapping:
//   Q1 main goal              → inst1
//   Q2 collector white/grey   → inst2 (locking)
//   Q3 bag always under drone → inst3 (air currents)
//   Q4 green: catch more = +  → inst2 (bag colour)
//   Q5 red:   catch more = +  → inst2 (bag colour)
//   Q6 idle ends mission      → inst2 (idle warning)
//   Q7 objects + main mission → inst2 (objects)
// ═══════════════════════════════════════════════════════════════════════

jsPsych.plugins['comprehension1'] = (function() {
  var plugin = {};

  plugin.info = {
    name: 'comprehension1',
    parameters: {
      button_label: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Button label',
        default: 'Submit',
        description: 'Label of the submit button.'
      }
    }
  };

  // Questions for this comprehension block, each tagged with the
  // instruction topic to send the participant back to on review.
  var PROMPTS = [
    {
      text: 'Your main goal is to move the collector to catch as many supply fragments as possible.',
      hint: 'Goal',
      options: ['True', 'False'],
      correct: 'True',
      topic: 'inst1'
    },
    {
      text: 'When the collector is white, you can move it. When it is grey, it is locked.',
      hint: 'Collector movement',
      options: ['True', 'False'],
      correct: 'True',
      topic: 'inst2'
    },
    {
      text: 'The supply bag always lands exactly under the drone.',
      hint: 'Air currents',
      options: ['True', 'False'],
      correct: 'False',
      topic: 'inst3'
    },
    {
      text: 'For green supplies, catching more fragments helps you earn more points.',
      hint: 'Green supply',
      options: ['True', 'False'],
      correct: 'True',
      topic: 'inst2'
    },
    {
      text: 'For red supplies, catching more fragments makes you lose more points.',
      hint: 'Red supply',
      options: ['True', 'False'],
      correct: 'False',
      topic: 'inst2'
    },
    {
      text: 'If you stop moving the collector for a long time, the mission may end early.',
      hint: 'Keep moving',
      options: ['True', 'False'],
      correct: 'True',
      topic: 'inst2'
    },
    {
      text: 'You will receive an object with each supply-drop, but your main mission is still supply collection.',
      hint: 'Objects',
      options: ['True', 'False'],
      correct: 'True',
      topic: 'inst2'
    }
  ];

  // Friendly label shown in the "you just reviewed X" banner.
  var TOPIC_LABEL = {
    inst1: 'mission goal',
    inst2: 'collector & supplies',
    inst3: 'air currents',
    inst4: 'full mission'
  };

  function buildStyles() {
    return [
      '<style>',
      'body{min-height:100vh;overflow-y:auto;',
        'background:radial-gradient(circle at top,rgba(232,241,255,.96),rgba(250,250,252,1) 58%);}',
      '.comp-shell{box-sizing:border-box;max-width:920px;margin:32px auto 80px auto;padding:0 18px;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1f2937;}',
      '.comp-card{background:rgba(255,255,255,.97);border:1px solid rgba(148,163,184,.35);',
        'border-radius:18px;box-shadow:0 12px 34px rgba(15,23,42,.12);padding:26px 30px 30px 30px;}',
      '.comp-header{text-align:center;margin-bottom:18px;}',
      '.comp-kicker{display:inline-block;padding:4px 11px;border-radius:999px;',
        'background:#e8f1ff;color:#1d4ed8;font-size:13px;font-weight:800;letter-spacing:.04em;',
        'text-transform:uppercase;margin-bottom:10px;}',
      '.comp-title{margin:0;font-size:26px;line-height:1.25;font-weight:850;}',
      '.comp-subtitle{margin:10px auto 0 auto;max-width:720px;font-size:15px;line-height:1.55;color:#4b5563;}',
      '.comp-banner{margin:14px auto 0 auto;max-width:720px;padding:10px 16px;border-radius:10px;',
        'background:#fef9c3;border:1px solid #fde68a;color:#854d0e;font-size:15px;font-weight:600;}',
      '.comp-progress{display:flex;justify-content:center;gap:6px;margin-top:14px;}',
      '.comp-pip{width:14px;height:14px;border-radius:50%;background:#e5e7eb;border:2px solid #cbd5e1;}',
      '.comp-pip.right{background:#22c55e;border-color:#16a34a;}',
      '.comp-pip.wrong{background:#ef4444;border-color:#dc2626;}',
      '.comp-list{display:grid;gap:12px;margin-top:20px;}',
      '.comp-q{border-radius:14px;padding:14px 16px;transition:transform .12s,box-shadow .15s;',
        'border:1px solid #e5e7eb;background:#fbfdff;}',
      '.comp-q.correct-locked{border:2px solid #16a34a;background:#f0fdf4;}',
      '.comp-q.wrong-locked{border:2px solid #dc2626;background:#fef2f2;cursor:pointer;}',
      '.comp-q.wrong-locked:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(220,38,38,.18);}',
      '.comp-q.wrong-editable{border:2px solid #f59e0b;background:#fffbeb;}',
      '.q-topline{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;}',
      '.q-num{flex:0 0 auto;width:28px;height:28px;border-radius:50%;background:#1f2937;color:#fff;',
        'display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;',
        'margin-top:1px;}',
      '.comp-q.correct-locked .q-num{background:#16a34a;}',
      '.comp-q.wrong-locked .q-num{background:#dc2626;}',
      '.comp-q.wrong-editable .q-num{background:#d97706;}',
      '.q-body{flex:1;min-width:0;}',
      '.q-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px;}',
      '.q-hint{font-size:12px;font-weight:750;color:#64748b;background:#eef2f7;',
        'padding:2px 8px;border-radius:999px;}',
      '.q-status{font-size:13px;font-weight:700;}',
      '.q-status-cta{margin-left:auto;}',
      '.q-text{font-size:17px;line-height:1.48;margin:0;}',
      '.q-options{display:flex;gap:10px;flex-wrap:wrap;margin-left:38px;}',
      '.q-option{display:inline-flex;align-items:center;gap:8px;min-width:96px;padding:8px 12px;',
        'border-radius:999px;background:#fff;border:1px solid #d1d5db;font-size:15px;font-weight:650;}',
      '.q-option.enabled{cursor:pointer;}',
      '.q-option.enabled:hover{border-color:#2563eb;background:#f8fbff;}',
      '.q-option.disabled{opacity:.7;}',
      '.q-option input{width:18px;height:18px;accent-color:#2563eb;}',
      '.q-option.enabled input{cursor:pointer;}',
      '.q-option.disabled input{cursor:not-allowed;}',
      '.submit-wrap{display:flex;justify-content:center;margin-top:22px;}',
      '#comp-submit{font-size:17px;font-weight:800;padding:11px 30px;border-radius:999px;border:none;',
        'color:#fff;background:#2563eb;box-shadow:0 6px 18px rgba(37,99,235,.28);cursor:pointer;}',
      '#comp-submit:hover{background:#1d4ed8;}',
      '@media (max-width:720px){.comp-card{padding:22px 18px 26px 18px;}.comp-title{font-size:23px;}',
        '.q-text{font-size:16px;}.q-options{margin-left:0;}}',
      '</style>'
    ].join('');
  }

  function renderQuestion(prompt, idx, state) {
    var c    = state.correctness[idx]; // null | true | false
    var rev  = state.reviewed[idx];     // bool — has user clicked review
    var resp = state.responses[idx];   // null | option string

    var status;
    if (c === null) status = 'unanswered';
    else if (c === true) status = 'correct-locked';
    else if (c === false && !rev) status = 'wrong-locked';
    else status = 'wrong-editable';

    var inputsDisabled = (status === 'correct-locked' || status === 'wrong-locked');

    var statusEl = '';
    if (status === 'correct-locked') {
      statusEl = '<span class="q-status" style="color:#16a34a;font-size:18px;">✓</span>';
    } else if (status === 'wrong-editable') {
      statusEl = '<span class="q-status" style="color:#d97706;">🔄 Please answer again</span>';
    } else if (status === 'wrong-locked') {
      statusEl = '<span class="q-status q-status-cta" style="color:#dc2626;">' +
                   '🔍 Click to review →</span>';
    }

    var html = '<div class="comp-q ' + status + '" data-q-idx="' + idx + '">';

    html += '<div class="q-topline">';
    html +=   '<div class="q-num">' + (idx + 1) + '</div>';
    html +=   '<div class="q-body">';
    html +=     '<div class="q-meta">';
    html +=       '<span class="q-hint">' + prompt.hint + '</span>';
    html +=       statusEl;
    html +=     '</div>';
    html +=     '<p class="q-text">' + prompt.text + '</p>';
    html +=   '</div>';
    html += '</div>';

    html += '<div class="q-options">';
    for (var j = 0; j < prompt.options.length; j++) {
      var opt = prompt.options[j];
      var isChecked = (resp === opt);
      var optClass = inputsDisabled ? 'q-option disabled' : 'q-option enabled';
      html += '<label class="' + optClass + '">';
      html +=   '<input type="radio" name="q' + idx + '" value="' + opt + '"' +
                  (isChecked ? ' checked' : '') +
                  (inputsDisabled ? ' disabled' : '') +
                  (!inputsDisabled ? ' required' : '') + '>';
      html +=   '<span>' + opt + '</span>';
      html += '</label>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderAll(state, justReviewedTopic) {
    var html = buildStyles();
    html += '<div class="comp-shell"><div class="comp-card">';

    html += '<div class="comp-header">';
    html += '<div class="comp-kicker">Understanding check</div>';
    html += '<h2 class="comp-title">Mission mechanics</h2>';
    html += '<div class="comp-subtitle">' +
              'Answer all questions correctly to continue. ' +
              'If you get any wrong, you must <strong>click the locked question</strong> ' +
              'to review the relevant instructions before you can revise your answer.' +
            '</div>';

    if (justReviewedTopic) {
      html += '<div class="comp-banner">' +
                '✏️  You just reviewed <strong>' +
                  (TOPIC_LABEL[justReviewedTopic] || justReviewedTopic) + '</strong>. ' +
                'Please update your highlighted answer below, then submit again.' +
              '</div>';
    }

    // Progress pips
    html += '<div class="comp-progress">';
    for (var k = 0; k < PROMPTS.length; k++) {
      var pipCls = 'comp-pip';
      if (state.correctness[k] === true) pipCls += ' right';
      else if (state.correctness[k] === false) pipCls += ' wrong';
      html += '<div class="' + pipCls + '" title="Question ' + (k + 1) + '"></div>';
    }
    html += '</div>';
    html += '</div>'; // /comp-header

    html += '<form id="comp-form"><div class="comp-list">';
    for (var i = 0; i < PROMPTS.length; i++) {
      html += renderQuestion(PROMPTS[i], i, state);
    }
    html += '</div>';

    html += '<div class="submit-wrap">';
    html += '<button type="submit" id="comp-submit">Submit answers</button>';
    html += '</div>';
    html += '</form>';

    html += '</div></div>';
    return html;
  }

  plugin.trial = function(display_element, trial) {
    var startTime = performance.now();

    // Persist state across review iterations on window.__comp1State.
    // First entry initialises fresh state; on each loop iteration the
    // existing state is restored.
    if (!window.__comp1State) {
      window.__comp1State = {
        responses:   PROMPTS.map(function() { return null; }),
        correctness: PROMPTS.map(function() { return null; }),
        reviewed:    PROMPTS.map(function() { return false; }),
        attempts: 0
      };
    }
    var state = window.__comp1State;

    // Detect whether we just returned from a review.
    var allComp = jsPsych.data.get().filter({ trial_type: 'comprehension1' }).values();
    var lastComp = allComp.length > 0 ? allComp[allComp.length - 1] : null;
    var justReviewedTopic = (lastComp && lastComp.review_topic) ? lastComp.review_topic : null;

    paint();

    function paint() {
      display_element.innerHTML = renderAll(state, justReviewedTopic);
      bindHandlers();
    }

    function bindHandlers() {
      var listEl = display_element.querySelector('.comp-list');
      var formEl = display_element.querySelector('#comp-form');

      // Click-to-review (delegated on the list)
      listEl.addEventListener('click', onCardClick);

      // Submit
      formEl.addEventListener('submit', onSubmit);
    }

    function onCardClick(e) {
      var card = e.target.closest('.comp-q');
      if (!card || !card.classList.contains('wrong-locked')) return;

      var idx = parseInt(card.getAttribute('data-q-idx'), 10);
      // Mark this question as having been reviewed so it becomes editable
      // when we return.
      state.reviewed[idx] = true;

      finishWith({
        done: false,
        review_topic: PROMPTS[idx].topic,
        clicked_question: idx + 1
      });
    }

    function onSubmit(e) {
      e.preventDefault();

      // Read responses ONLY from currently-editable questions.
      // Locked questions retain their stored state.responses[i] value.
      for (var i = 0; i < PROMPTS.length; i++) {
        var locked = (state.correctness[i] === true) ||
                     (state.correctness[i] === false && !state.reviewed[i]);
        if (locked) continue;

        var checkedEl = display_element.querySelector('input[name="q' + i + '"]:checked');
        state.responses[i] = checkedEl ? checkedEl.value : null;
      }

      // Validate.
      var allCorrect = true;
      for (var j = 0; j < PROMPTS.length; j++) {
        if (state.responses[j] === null) {
          allCorrect = false;
        } else if (state.responses[j] === PROMPTS[j].correct) {
          state.correctness[j] = true;
        } else {
          state.correctness[j] = false;
          allCorrect = false;
        }
      }
      state.attempts += 1;

      if (allCorrect) {
        finishWith({ done: true });
      } else {
        // Re-paint in place — the participant stays on this page until
        // they get all correct or click a wrong-locked card to review.
        // (After a re-paint there is no longer a "just reviewed" banner.)
        justReviewedTopic = null;
        paint();
      }
    }

    function finishWith(extra) {
      var num_errors = 0;
      var correctness_responses = [];
      for (var i = 0; i < PROMPTS.length; i++) {
        if (state.correctness[i] === false) num_errors += 1;
        correctness_responses.push(
          state.correctness[i] === null ? null : (state.correctness[i] ? 1 : 0)
        );
      }

      var data = {
        done: !!extra.done,
        review_topic: extra.review_topic || null,
        clicked_question: typeof extra.clicked_question === 'number' ? extra.clicked_question : null,
        responses: state.responses.slice(),
        correctness_responses: correctness_responses,
        num_errors: num_errors,
        correct_answers: PROMPTS.map(function(q) { return q.correct; }),
        prompts: PROMPTS.map(function(q) { return q.text; }),
        topics: PROMPTS.map(function(q) { return q.topic; }),
        attempts: state.attempts,
        rt: performance.now() - startTime
      };

      if (extra.done) {
        // Reset state so any future fresh run (e.g. retake) starts clean.
        window.__comp1State = null;
      }

      jsPsych.finishTrial(data);
    }
  };

  return plugin;
})();