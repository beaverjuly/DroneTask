/* jspsych-survey-template.js
 * A jsPsych plugin extension for measuring items on a Likert scale.
 *
 * Authors: Sam Zorowitz, Dan Bennett
 */

jsPsych.plugins['survey-template'] = (function() {

  var plugin = {};

  plugin.info = {
    name: 'survey-template',
    description: '',
    parameters: {
      items: {
        type: jsPsych.plugins.parameterType.HTML_STRING,
        array: true,
        pretty_name: 'Items',
        description: 'The questions associated with the survey'
      },
      scale: {
        type: jsPsych.plugins.parameterType.HTML_STRING,
        array: true,
        pretty_name: 'Scale',
        description: 'The response options associated with the survey'
      },
      reverse: {
        type: jsPsych.plugins.parameterType.BOOL,
        array: true,
        pretty_name: 'Reverse scoring',
        default: [],
        description: 'If true, the corresponding item will be reverse scored'
      },
      infrequency_items: {
        type: jsPsych.plugins.parameterType.INT,
        array: true,
        pretty_name: 'Infrequency items',
        description: 'Infrequency-check item numbers, 0-indexed',
        default: null
      },
      instructions: {
        type: jsPsych.plugins.parameterType.HTML_STRING,
        pretty_name: 'Instructions',
        description: 'The instructions associated with the survey',
        default: ''
      },
      randomize_question_order: {
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: 'Randomize question order',
        default: true,
        description: 'If true, the order of the questions will be randomized'
      },
      scale_repeat: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Scale repeat',
        default: 10,
        description: 'The number of items before the scale repeats'
      },
      survey_width: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Survey width',
        default: 900,
        description: 'The number of pixels occupied by the survey'
      },
      item_width: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Item width',
        default: 50,
        description: 'The percentage of a row occupied by an item text'
      },
      button_label: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Button label',
        default: 'Continue',
        description: 'The text that appears on the button to finish the trial.'
      }
    }
  };

  plugin.trial = function(display_element, trial) {

    //---------------------------------------//
    // Define survey HTML.
    //---------------------------------------//

    var html = '';

    var n = trial.scale.length;
    var x1 = trial.item_width;
    var x2 = (100 - trial.item_width) / n;
    var widthPx = trial.survey_width;

    html += `<style>
      .survey-template-wrap {
        min-height: 100vh;
        width: 100vw;
        box-sizing: border-box;
        padding: 32px 0 42px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        color: #111827;
      }

      .survey-template-instructions {
        width: min(${widthPx}px, 86vw);
        margin: 0 auto 14px auto;
        font-size: 16px;
        line-height: 1.55;
        color: #1f2937;
      }

      .survey-template-instructions:empty {
        display: none;
      }

      .survey-template-instructions p {
        margin: 0 0 10px 0;
      }

      .survey-template-container {
        display: grid;
        grid-template-columns: ${x1}% repeat(${n}, ${x2}%);
        grid-template-rows: auto;
        width: min(${widthPx}px, 86vw);
        margin: 0 auto;
        background: rgba(255, 255, 255, .88);
        border: 1px solid rgba(148, 163, 184, .28);
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 16px 36px rgba(15, 23, 42, .09);
      }

      .survey-template-row {
        display: contents;
      }

      .survey-template-header {
        padding: 16px 8px 12px 8px;
        text-align: center;
        font-size: 13px;
        font-weight: 750;
        line-height: 1.25;
        color: #334155;
        background: rgba(248, 250, 252, .86);
        border-bottom: 1px solid rgba(226, 232, 240, .92);
      }

      .survey-template-prompt {
        padding: 15px 18px;
        text-align: left;
        font-size: 15px;
        line-height: 1.35;
        font-weight: 650;
        color: #111827;
        background: rgba(248, 250, 252, .76);
        border-top: 1px solid rgba(226, 232, 240, .92);
      }

      .survey-template-response {
        padding: 15px 0;
        font-size: 13px;
        text-align: center;
        line-height: 1.15;
        background: rgba(255, 255, 255, .70);
        border-top: 1px solid rgba(226, 232, 240, .92);
      }

      .survey-template-row:hover .survey-template-prompt,
      .survey-template-row:hover .survey-template-response {
        background: rgba(240, 249, 255, .72);
      }

      .survey-template-response input[type='radio'] {
        position: relative;
        width: 17px;
        height: 17px;
        accent-color: #38bdf8;
        cursor: pointer;
      }

      .survey-template-response .pseudo-input {
        position: relative;
        height: 0;
        width: 0;
        display: inline-block;
      }

      .survey-template-response .pseudo-input:after {
        position: absolute;
        left: 8px;
        top: -6px;
        height: 2px;
        width: calc(min(${widthPx}px, 86vw) * ${x2 / 100} - 100%);
        background: rgba(203, 213, 225, .90);
        content: "";
      }

      .survey-template-response:last-child .pseudo-input:after {
        display: none;
      }

      .survey-template-footer {
        margin: 14px auto 0 auto;
        width: min(${widthPx}px, 86vw);
        padding: 0;
        text-align: right;
      }

      .survey-template-footer input[type=submit] {
        background: linear-gradient(135deg, #93c5fd, #c4b5fd);
        padding: 12px 26px;
        border: none;
        border-radius: 999px;
        margin-top: 6px;
        margin-bottom: 20px;
        font-size: 16px;
        font-weight: 850;
        color: #111827;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(96, 165, 250, .22);
        transition: transform .14s ease, box-shadow .14s ease;
      }

      .survey-template-footer input[type=submit]:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 28px rgba(96, 165, 250, .30);
      }

      .survey-template-block {
        position: absolute;
        top: 0%;
        -webkit-transform: translate3d(0, -100%, 0);
        transform: translate3d(0, -100%, 0);
      }

      @media (max-width: 760px) {
        .survey-template-container {
          width: 92vw;
          font-size: 14px;
        }

        .survey-template-instructions,
        .survey-template-footer {
          width: 92vw;
        }

        .survey-template-header {
          font-size: 11px;
          padding-left: 4px;
          padding-right: 4px;
        }

        .survey-template-prompt {
          font-size: 14px;
          padding: 13px 12px;
        }

        .survey-template-response {
          padding: 13px 0;
        }
      }
    </style>`;

    html += '<div class="survey-template-wrap">';
    html += '<form name="survey-template" id="survey-template-submit">';

    if (trial.instructions && String(trial.instructions).trim() !== '') {
      html += '<div class="survey-template-instructions" id="instructions">';
      html += trial.instructions;
      html += '</div>';
    }

    var item_order = [];
    for (var i = 0; i < trial.items.length; i++) {
      item_order.push(i);
    }

    if (trial.randomize_question_order) {
      item_order = jsPsych.randomization.shuffle(item_order);

      while (
        !(trial.infrequency_items === null) &&
        trial.infrequency_items.toString().includes([item_order[0]])
      ) {
        item_order = jsPsych.randomization.shuffle(item_order);
      }
    }

    html += '<div class="survey-template-container">';

    for (var row = 0; row < trial.items.length; row++) {
      var qid = ('0' + String(item_order[row] + 1)).slice(-2);

      var values = [];
      for (var j = 0; j < trial.scale.length; j++) {
        values.push(j);
      }

      if (trial.reverse[item_order[row]]) {
        values = values.reverse();
      }

      if (row % trial.scale_repeat === 0) {
        html += '<div class="survey-template-header"></div>';
        for (var h = 0; h < trial.scale.length; h++) {
          html += '<div class="survey-template-header">' + trial.scale[h] + '</div>';
        }
      }

      html += '<div class="survey-template-row">';
      html += '<div class="survey-template-prompt">' + trial.items[item_order[row]] + '</div>';

      for (var k = 0; k < values.length; k++) {
        html += '<div class="survey-template-response">';
        html += '<div class="pseudo-input"></div>';
        html += '<input type="radio" name="Q' + qid + '" value="' + values[k] + '" id="' + k + '" tabindex="-1" required>';
        html += '</div>';
      }

      html += '</div>';
    }

    html += '</div>';

    html += '<div class="survey-template-footer">';
    html += '<input type="submit" value="' + trial.button_label + '">';
    html += '</div>';

    html += '</form>';

    html += '<div class="survey-template-block" tabindex="-1">';
    html += '<form id="survey-template-form">';
    html += '<input type="radio" name="Q00" value="0" tabindex="-1">';
    html += '<input type="radio" name="Q00" value="1" tabindex="-1">';
    html += '<input type="radio" name="Q00" value="2" tabindex="-1">';
    html += '</form>';
    html += '</div>';

    html += '</div>';

    display_element.innerHTML = html;

    //---------------------------------------//
    // Response handling.
    //---------------------------------------//

    window.onbeforeunload = function() {
      window.scrollTo(0, 0);
    };

    var key_events = [];
    var mouse_events = [];
    var radio_events = [];

    function log_event(event) {
      var response_time = performance.now() - startTime;

      if (event.screenX > 0) {
        mouse_events.push(response_time);
      } else {
        key_events.push(response_time);
      }

      if (event.target.type === 'radio') {
        radio_events.push(response_time);
      }
    }

    document.addEventListener('click', log_event);

    display_element.querySelector('#survey-template-submit').addEventListener('submit', function(event) {
      event.preventDefault();

      var endTime = performance.now();
      var response_time = endTime - startTime;

      var question_data = serializeArray(this);
      var responses = objectifyForm(question_data);

      var straightlining = detectStraightLining(question_data);
      var zigzagging = detectZigZagging(question_data, trial.scale);

      var honeypot = serializeArray(display_element.querySelector('#survey-template-form'));
      honeypot = (honeypot.length > 0) ? 1 : 0;

      var trialdata = {
        responses: responses,
        rt: response_time,
        item_order: item_order,
        radio_events: radio_events,
        key_events: key_events,
        mouse_events: mouse_events,
        straightlining: straightlining,
        zigzagging: zigzagging,
        honeypot: honeypot
      };

      document.removeEventListener('click', log_event);

      display_element.innerHTML = '';
      jsPsych.finishTrial(trialdata);
    });

    var startTime = performance.now();
  };

  var serializeArray = function(form) {
    var serialized = [];

    for (var i = 0; i < form.elements.length; i++) {
      var field = form.elements[i];

      if (
        !field.name ||
        field.disabled ||
        field.type === 'file' ||
        field.type === 'reset' ||
        field.type === 'submit' ||
        field.type === 'button'
      ) {
        continue;
      }

      if ((field.type !== 'checkbox' && field.type !== 'radio') || field.checked) {
        serialized.push({
          name: field.name,
          position: field.id,
          value: field.value
        });
      }
    }

    return serialized;
  };

  function objectifyForm(formArray) {
    var returnArray = {};
    for (var i = 0; i < formArray.length; i++) {
      returnArray[formArray[i].name] = formArray[i].value;
    }
    return returnArray;
  }

  function detectStraightLining(formArray) {
    if (!formArray || formArray.length === 0) return null;

    var counts = [];

    for (var i = 0; i < formArray.length; i++) {
      var loc = parseInt(formArray[i].position, 10);
      if (counts[loc] > 0) {
        counts[loc]++;
      } else {
        counts[loc] = 1;
      }
    }

    counts = Array.from(counts, function(item) {
      return item || 0;
    });

    return Math.max.apply(null, counts) / formArray.length;
  }

  function detectZigZagging(formArray, scale) {
    if (!formArray || formArray.length < 2) return null;

    var score = 0;

    for (var i = 0; i < formArray.length - 1; i++) {
      var a = parseInt(formArray[i].position, 10);
      var b = parseInt(formArray[i + 1].position, 10);
      var delta = Math.abs(a - b);

      if (delta === 1 || delta === (scale.length - 1)) {
        score++;
      }
    }

    return score / (formArray.length - 1);
  }

  return plugin;

})();