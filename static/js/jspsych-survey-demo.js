/**
 * jspsych-survey-demo
 * A jsPsych plugin for the Niv lab demographics form.
 */

jsPsych.plugins['survey-demo'] = (function() {

  var plugin = {};

  plugin.info = {
    name: 'survey-demo',
    description: '',
    parameters: {
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
    // Define HTML.
    //---------------------------------------//

    var html = '';

    html += `<style>
      .survey-demo-wrap {
        min-height: 100vh;
        width: 100vw;
        box-sizing: border-box;
        padding: 32px 0 42px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        color: #111827;
      }

      .survey-demo-container {
        display: grid;
        grid-template-columns: 38% 62%;
        width: min(78vw, 900px);
        margin: 0 auto;
        background: rgba(255, 255, 255, .88);
        border: 1px solid rgba(148, 163, 184, .28);
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 16px 36px rgba(15, 23, 42, .09);
      }

      .survey-demo-row {
        display: contents;
        text-align: left;
        font-size: 16px;
        line-height: 1.45;
      }

      .survey-demo-prompt {
        padding: 16px 20px;
        border-top: 1px solid rgba(226, 232, 240, .92);
        background: rgba(248, 250, 252, .76);
        font-weight: 760;
        color: #111827;
      }

      .survey-demo-response {
        padding: 16px 20px;
        border-top: 1px solid rgba(226, 232, 240, .92);
        color: #1f2937;
        background: rgba(255, 255, 255, .70);
      }

      .survey-demo-row:first-child .survey-demo-prompt,
      .survey-demo-row:first-child .survey-demo-response {
        border-top: none;
      }

      .survey-demo-row:hover .survey-demo-prompt,
      .survey-demo-row:hover .survey-demo-response {
        background: rgba(240, 253, 244, .72);
      }

      .survey-demo-prompt label {
        display: inline-block;
        padding: 0;
      }

      .survey-demo-prompt small {
        color: #6b7280;
        font-weight: 650;
      }

      .survey-demo-response label {
        display: inline-block;
        padding: 0 16px 7px 0;
        cursor: pointer;
      }

      .survey-demo-response input[type='radio'],
      .survey-demo-response input[type='checkbox'] {
        width: 16px;
        height: 16px;
        margin: 0 7px 0 0;
        accent-color: #22c55e;
        vertical-align: -2px;
        cursor: pointer;
      }

      .survey-demo-response input[type='number'],
      .survey-demo-response input[type='text'] {
        height: 34px;
        box-sizing: border-box;
        border: 1px solid rgba(148, 163, 184, .65);
        border-radius: 11px;
        padding: 4px 9px;
        font-size: 15px;
        background: #ffffff;
        color: #111827;
        outline: none;
        transition: border-color .14s ease, box-shadow .14s ease, transform .14s ease;
      }

      .survey-demo-response input[type='number']:focus,
      .survey-demo-response input[type='text']:focus {
        border-color: #22c55e;
        box-shadow: 0 0 0 3px rgba(34, 197, 94, .16);
      }

      .survey-demo-response input[type='number'] {
        width: 74px;
        margin-right: 8px;
      }

      .survey-demo-response input[type='text'] {
        width: 150px;
      }

      .survey-demo-footer {
        margin: 14px auto 0 auto;
        width: min(78vw, 900px);
        text-align: right;
      }

      .survey-demo-footer input[type=submit] {
        background: linear-gradient(135deg, #86efac, #67e8f9);
        padding: 12px 26px;
        border: none;
        border-radius: 999px;
        margin-top: 6px;
        margin-bottom: 20px;
        font-size: 16px;
        font-weight: 850;
        color: #111827;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(34, 197, 94, .22);
        transition: transform .14s ease, box-shadow .14s ease;
      }

      .survey-demo-footer input[type=submit]:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 28px rgba(34, 197, 94, .30);
      }

      @media (max-width: 760px) {
        .survey-demo-container {
          grid-template-columns: 1fr;
          width: min(90vw, 620px);
        }

        .survey-demo-prompt {
          padding-bottom: 6px;
          border-top: 1px solid rgba(226, 232, 240, .92);
        }

        .survey-demo-response {
          padding-top: 8px;
          border-top: none;
        }

        .survey-demo-footer {
          width: min(90vw, 620px);
        }
      }
    </style>`;

    html += '<div class="survey-demo-wrap"><form id="jspsych-survey-demo">';

    html += '<div class="survey-demo-container">';

    // Item 1: Age
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="age">What is your age?</label></div>';
    html += '<div class="survey-demo-response">';
    html += '<input type="number" name="age" min="0" max="100" size="20" required>';
    html += '</div></div>';

    // Item 2: Gender
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="gender-categorical">What is your gender?</label></div>';
    html += '<div class="survey-demo-response">';
    html += '<label><input type="radio" name="gender-categorical" value="Male" required>Male</label>';
    html += '<label><input type="radio" name="gender-categorical" value="Female" required>Female</label>';
    html += '<label><input type="radio" name="gender-categorical" value="Rather not say" required>Rather not say</label>';
    html += '<label><input type="radio" name="gender-categorical" value="Other" required>Other</label>';
    html += '<input type="text" name="gender-free-response" maxlength="24" size="10">';
    html += '</div></div>';

    // Item 3: Height
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="height">What is your height? <small>(feet, inches)</small></label></div>';
    html += '<div class="survey-demo-response">';
    html += '<input type="number" name="height_feet" min="1" max="10" size="20" required>';
    html += '<input type="number" name="height_inches" min="0" max="12" size="20" required>';
    html += '</div></div>';

    // Item 4: Weight
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="weight">What is your current weight? <small>(lbs.)</small></label></div>';
    html += '<div class="survey-demo-response">';
    html += '<input type="number" name="weight" min="0" max="500" size="20" required>';
    html += '</div></div>';

    // Item 5: Ethnicity
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="ethnicity">What is your ethnicity?</label></div>';
    html += '<div class="survey-demo-response">';
    html += '<label><input type="radio" name="ethnicity" value="Hispanic or Latino" required>Hispanic or Latino</label><br>';
    html += '<label><input type="radio" name="ethnicity" value="Not Hispanic or Latino" required>Not Hispanic or Latino</label><br>';
    html += '<label><input type="radio" name="ethnicity" value="Unknown" required>Unknown</label><br>';
    html += '<label><input type="radio" name="ethnicity" value="Rather not say" required>Rather not say</label>';
    html += '</div></div>';

    // Item 6: Race
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="race">What is your race? <small>(Choose all that apply)</small></label></div>';
    html += '<div class="survey-demo-response">';
    html += '<label><input type="checkbox" name="race" value="American Indian/Alaska Native">American Indian/Alaska Native</label><br>';
    html += '<label><input type="checkbox" name="race" value="Asian">Asian</label><br>';
    html += '<label><input type="checkbox" name="race" value="Native Hawaiian or other Pacific Islander">Native Hawaiian or other Pacific Islander</label><br>';
    html += '<label><input type="checkbox" name="race" value="Black or African American">Black or African American</label><br>';
    html += '<label><input type="checkbox" name="race" value="White">White</label><br>';
    html += '<label><input type="checkbox" name="race" value="Rather not say">Rather not say</label>';
    html += '<label><input type="checkbox" name="race" value="Other">Other</label>';
    html += '</div></div>';

    // Item 7: English first language
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="language">Is English your first language?</label></div>';
    html += '<div class="survey-demo-response">';
    html += '<label><input type="radio" name="language" value="Yes" required>Yes</label>';
    html += '<label><input type="radio" name="language" value="No" required>No</label>';
    html += '</div></div>';

    // Item 8: Fluency
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="fluency">How well do you speak English?</label></div>';
    html += '<div class="survey-demo-response">';
    html += '<label><input type="radio" name="fluency" value="Very well" required>Very well</label>';
    html += '<label><input type="radio" name="fluency" value="Well" required>Well</label>';
    html += '<label><input type="radio" name="fluency" value="Not well" required>Not well</label>';
    html += '<label><input type="radio" name="fluency" value="Not at all" required>Not at all</label>';
    html += '</div></div>';

    html += '</div>';

    html += '<div class="survey-demo-footer">';
    html += '<input type="submit" value="' + trial.button_label + '">';
    html += '</div>';

    html += '</form></div>';

    display_element.innerHTML = html;

    //---------------------------------------//
    // Define functions.
    //---------------------------------------//

    window.onbeforeunload = function() {
      window.scrollTo(0, 0);
    };

    display_element.querySelector('#jspsych-survey-demo').addEventListener('submit', function(event) {
      event.preventDefault();

      var checkboxes = display_element.querySelectorAll('input[name="race"]');
      var checkedOne = Array.prototype.slice.call(checkboxes).some(function(x) {
        return x.checked;
      });

      if (!checkedOne) {
        alert('Please choose at least one option for the race question.');
      } else {
        var endTime = performance.now();
        var response_time = endTime - startTime;

        var question_data = serializeArray(this);
        question_data = objectifyForm(question_data);

        var trialdata = {
          rt: response_time,
          responses: question_data
        };

        display_element.innerHTML = '';
        jsPsych.finishTrial(trialdata);
      }
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

      if (field.type === 'select-multiple') {
        for (var n = 0; n < field.options.length; n++) {
          if (!field.options[n].selected) continue;
          serialized.push({
            name: field.name,
            value: field.options[n].value
          });
        }
      } else if ((field.type !== 'checkbox' && field.type !== 'radio') || field.checked) {
        serialized.push({
          name: field.name,
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

  return plugin;

})();