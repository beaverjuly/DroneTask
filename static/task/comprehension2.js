// ═══════════════════════════════════════════════════════════════════════
// comprehension2.js — Full mission rules check (with topic-aware review)
//
// Same architecture as comprehension1.js — see that file for full notes.
//
// Question → topic mapping:
//   Q1 drone hidden in real mission       → inst3
//   Q2 drone visible all 4 planets (False) → inst3
//   Q3 drone hovers then jumps             → inst3
//   Q4 best strategy (place under est)     → inst3
//   Q5 how many planets/drones (4)         → inst4
//   Q6 memory questions don't change score → inst4
// ═══════════════════════════════════════════════════════════════════════

jsPsych.plugins['comprehension2'] = (function() {
  var plugin = {};

  plugin.info = {
    name: 'comprehension2',
    parameters: {
      button_label: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Button label',
        default: 'Submit',
        description: 'Label of the submit button.'
      }
    }
  };

  var PROMPTS = [
    {
      text: 'In the real mission, the drone is hidden, so you must infer where it is from the supply drops.',
      hint: 'Hidden drone',
      options: ['True', 'False'],
      correct: 'True',
      topic: 'inst3'
    },
    {
      text: 'The drone stays visible during all four planets in the full mission.',
      hint: 'Hidden drone',
      options: ['True', 'False'],
      correct: 'False',
      topic: 'inst3'
    },
    {
      text: 'The drone may hover around one area for a few supply-drops, then move to a new place.',
      hint: 'Drone movement',
      options: ['True', 'False'],
      correct: 'True',
      topic: 'inst3'
    },
    {
      text: 'Your best strategy is to place the collector under where you think the drone currently is.',
      hint: 'Best strategy',
      options: ['True', 'False'],
      correct: 'True',
      topic: 'inst3'
    },
    {
      text: 'How many planets / drone environments are in the full mission?',
      hint: 'Full mission',
      options: ['1', '2', '3', '4'],
      correct: '4',
      topic: 'inst4'
    },
    {
      text: 'The object-memory questions do not change your collection score; answer them as best you can.',
      hint: 'Memory priority',
      options: ['True', 'False'],
      correct: 'True',
      topic: 'inst4'
    }
  ];

  var TOPIC_LABEL = {
    inst1: 'mission goal',
    inst2: 'collector & supplies',
    inst3: 'drone behaviour',
    inst4: 'full mission & memory'
  };

  function buildStyles() {
    return [
      '<style>',
      'body{min-height:100vh;overflow-y:auto;',
        'background:radial-gradient(circle at top,rgba(245,243,255,.96),rgba(250,250,252,1) 58%);}',
      '.comp-shell{box-sizing:border-box;max-width:900px;margin:36px auto 80px auto;padding:0 18px;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1f2937;}',
      '.comp-card{background:rgba(255,255,255,.97);border:1px solid rgba(148,163,184,.35);',
        'border-radius:18px;box-shadow:0 12px 34px rgba(15,23,42,.12);padding:26px 30px 30px 30px;}',
      '.comp-header{text-align:center;margin-bottom:18px;}',
      '.comp-kicker{display:inline-block;padding:4px 11px;border-radius:999px;',
        'background:#f3e8ff;color:#7e22ce;font-size:13px;font-weight:800;letter-spacing:.04em;',
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
      '.q-num{flex:0 0 auto;width:28px;height:28px;border-radius:50%;background:#312e81;color:#fff;',
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
      '.q-option{display:inline-flex;align-items:center;gap:8px;min-width:86px;padding:8px 12px;',
        'border-radius:999px;background:#fff;border:1px solid #d1d5db;font-size:15px;font-weight:650;}',
      '.q-option.enabled{cursor:pointer;}',
      '.q-option.enabled:hover{border-color:#7e22ce;background:#fcfaff;}',
      '.q-option.disabled{opacity:.7;}',
      '.q-option input{width:18px;height:18px;accent-color:#7e22ce;}',
      '.q-option.enabled input{cursor:pointer;}',
      '.q-option.disabled input{cursor:not-allowed;}',
      '.submit-wrap{display:flex;justify-content:center;margin-top:22px;}',
      '#comp-submit{font-size:17px;font-weight:800;padding:11px 30px;border-radius:999px;border:none;',
        'color:#fff;background:#7e22ce;box-shadow:0 6px 18px rgba(126,34,206,.26);cursor:pointer;}',
      '#comp-submit:hover{background:#6b21a8;}',
      '@media (max-width:720px){.comp-card{padding:22px 18px 26px 18px;}.comp-title{font-size:23px;}',
        '.q-text{font-size:16px;}.q-options{margin-left:0;}}',
      '</style>'
    ].join('');
  }

  function renderQuestion(prompt, idx, state) {
    var c    = state.correctness[idx];
    var rev  = state.reviewed[idx];
    var resp = state.responses[idx];

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
    html +=   '<div class="comp-kicker">Understanding Check</div>';
    html +=   '<p class="comp-subtitle">' +
                'To confirm understanding of the mission, complete the following questions.<br>' +
                'For any incorrect question, you must <strong>click the question to review the instructions</strong>, ' +
                'then revise your answer to continue.<br>' +
                '<strong>Answer all questions correctly to start the mission!</strong>' +
              '</p>';
    html += '</div>';

    if (justReviewedTopic) {
      html += '<div class="comp-banner">' +
                'You just reviewed <strong>' +
                  (TOPIC_LABEL[justReviewedTopic] || justReviewedTopic) + '</strong>. ' +
                'Please update your highlighted answer below, then submit again.' +
              '</div>';
    }

    html += '<div class="comp-progress">';
    for (var k = 0; k < PROMPTS.length; k++) {
      var pipCls = 'comp-pip';
      if (state.correctness[k] === true) pipCls += ' right';
      else if (state.correctness[k] === false) pipCls += ' wrong';
      html += '<div class="' + pipCls + '" title="Question ' + (k + 1) + '"></div>';
    }
    html += '</div>';
    html += '</div>';

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

    if (!window.__comp2State) {
      window.__comp2State = {
        responses:   PROMPTS.map(function() { return null; }),
        correctness: PROMPTS.map(function() { return null; }),
        reviewed:    PROMPTS.map(function() { return false; }),
        attempts: 0
      };
    }
    var state = window.__comp2State;

    var allComp = jsPsych.data.get().filter({ trial_type: 'comprehension2' }).values();
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
      listEl.addEventListener('click', onCardClick);
      formEl.addEventListener('submit', onSubmit);
    }

    function onCardClick(e) {
      var card = e.target.closest('.comp-q');
      if (!card || !card.classList.contains('wrong-locked')) return;
      var idx = parseInt(card.getAttribute('data-q-idx'), 10);
      state.reviewed[idx] = true;
      finishWith({
        done: false,
        review_topic: PROMPTS[idx].topic,
        clicked_question: idx + 1
      });
    }

    function onSubmit(e) {
      e.preventDefault();
      for (var i = 0; i < PROMPTS.length; i++) {
        var locked = (state.correctness[i] === true) ||
                     (state.correctness[i] === false && !state.reviewed[i]);
        if (locked) continue;
        var checkedEl = display_element.querySelector('input[name="q' + i + '"]:checked');
        state.responses[i] = checkedEl ? checkedEl.value : null;
      }
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
        window.__comp2State = null;
      }
      jsPsych.finishTrial(data);
    }
  };

  return plugin;
})();