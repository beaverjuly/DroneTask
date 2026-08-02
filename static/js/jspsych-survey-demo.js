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
        position: relative;
        overflow: hidden;
        isolation: isolate;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        color: #111827;
        background:
          radial-gradient(circle at 12% 18%, rgba(253, 224, 71, .22), transparent 25%),
          radial-gradient(circle at 88% 15%, rgba(103, 232, 249, .24), transparent 27%),
          linear-gradient(145deg, #f8fafc 0%, #f0fdf4 46%, #eff6ff 100%);
      }

      .survey-demo-wrap::before,
      .survey-demo-wrap::after {
        content: '';
        position: absolute;
        z-index: -1;
        width: 260px;
        height: 260px;
        border-radius: 50%;
        filter: blur(3px);
        opacity: .34;
        animation: survey-demo-float 7s ease-in-out infinite;
      }

      .survey-demo-wrap::before {
        left: -90px;
        top: 28%;
        background: linear-gradient(135deg, rgba(74, 222, 128, .55), rgba(103, 232, 249, .24));
      }

      .survey-demo-wrap::after {
        right: -100px;
        bottom: 8%;
        background: linear-gradient(135deg, rgba(251, 191, 36, .46), rgba(192, 132, 252, .24));
        animation-delay: -3.5s;
      }

      #jspsych-survey-demo {
        position: relative;
        z-index: 1;
      }

      .survey-demo-heading {
        width: min(78vw, 900px);
        margin: 0 auto 18px;
        text-align: center;
        animation: survey-demo-rise .6s cubic-bezier(.2,.8,.3,1.1) both;
      }

      .survey-demo-kicker {
        display: inline-block;
        padding: 5px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,.82);
        border: 1px solid rgba(34,197,94,.28);
        color: #166534;
        font-size: 12px;
        font-weight: 850;
        letter-spacing: .08em;
        text-transform: uppercase;
        box-shadow: 0 6px 18px rgba(34,197,94,.12);
      }

      .survey-demo-heading h1 {
        margin: 10px 0 4px;
        font-size: 28px;
        line-height: 1.2;
        color: #0f172a;
      }

      .survey-demo-heading p {
        margin: 0;
        color: #475569;
        font-size: 15px;
      }

      .survey-demo-signal {
        display: flex;
        justify-content: center;
        align-items: flex-end;
        gap: 5px;
        height: 18px;
        margin-top: 9px;
      }

      .survey-demo-signal span {
        width: 22px;
        height: 4px;
        border-radius: 999px;
        background: linear-gradient(90deg, #22c55e, #38bdf8);
        animation: survey-demo-signal 1.8s ease-in-out infinite;
      }

      .survey-demo-signal span:nth-child(2) { animation-delay: -.6s; }
      .survey-demo-signal span:nth-child(3) { animation-delay: -1.2s; }

      .survey-demo-error {
        display: none;
        width: min(78vw, 900px);
        box-sizing: border-box;
        margin: 0 auto 12px;
        padding: 10px 16px;
        border-radius: 12px;
        background: rgba(254,242,242,.96);
        border: 1px solid #fca5a5;
        color: #991b1b;
        font-size: 14px;
        font-weight: 750;
        text-align: center;
        box-shadow: 0 8px 22px rgba(153,27,27,.10);
      }

      .survey-demo-error.visible {
        display: block;
        animation: survey-demo-rise .3s ease-out both;
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
        box-shadow: 0 16px 36px rgba(15, 23, 42, .11), 0 0 0 1px rgba(255,255,255,.62);
        animation: survey-demo-rise .7s .08s cubic-bezier(.2,.8,.3,1.1) both;
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

      .survey-demo-row.invalid .survey-demo-prompt,
      .survey-demo-row.invalid .survey-demo-response {
        background: rgba(254, 242, 242, .92);
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

      .survey-demo-response input[aria-invalid='true'] {
        border-color: #dc2626;
        box-shadow: 0 0 0 3px rgba(220,38,38,.13);
      }

      .survey-demo-response input[type='number'] {
        width: 86px;
        margin-right: 8px;
      }

      #age { width: 94px; }
      #height-inches { width: 96px; }

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

      @keyframes survey-demo-rise {
        from { opacity: 0; transform: translateY(14px) scale(.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes survey-demo-float {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
        50% { transform: translate3d(18px, -22px, 0) scale(1.06); }
      }

      @keyframes survey-demo-signal {
        0%, 100% { transform: scaleX(.72); opacity: .52; }
        50% { transform: scaleX(1.08); opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .survey-demo-wrap::before,
        .survey-demo-wrap::after,
        .survey-demo-heading,
        .survey-demo-container,
        .survey-demo-signal span {
          animation: none;
        }
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

        .survey-demo-heading,
        .survey-demo-error {
          width: min(90vw, 620px);
        }
      }
    </style>`;

    html += '<div class="survey-demo-wrap"><form id="jspsych-survey-demo" novalidate>';

    html += '<div class="survey-demo-heading">';
    html += '<div class="survey-demo-kicker">Almost finished</div>';
    html += '<h1>A few final questions</h1>';
    html += '<p>Please check your entries, then continue to save your record.</p>';
    html += '<div class="survey-demo-signal" aria-hidden="true"><span></span><span></span><span></span></div>';
    html += '</div>';

    html += '<div class="survey-demo-error" id="survey-demo-error" role="alert" aria-live="polite"></div>';

    html += '<div class="survey-demo-container">';

    // Item 1: Age
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="age">What is your age?</label></div>';
    html += '<div class="survey-demo-response">';
    html += '<input type="number" id="age" name="age" min="18" max="120" step="1" ' +
      'inputmode="numeric" placeholder="18–120" title="Enter a whole number from 18 to 120." required>';
    html += '</div></div>';

    // Item 2: Gender
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="gender-categorical">What is your gender?</label></div>';
    html += '<div class="survey-demo-response">';
    html += '<label><input type="radio" name="gender-categorical" value="Male" required>Male</label>';
    html += '<label><input type="radio" name="gender-categorical" value="Female" required>Female</label>';
    html += '<label><input type="radio" name="gender-categorical" value="Rather not say" required>Rather not say</label>';
    html += '<label><input type="radio" name="gender-categorical" value="Other" required>Other</label>';
    html += '<input type="text" id="gender-free-response" name="gender-free-response" ' +
      'maxlength="24" size="10" placeholder="Please specify" aria-label="Please specify gender" disabled>';
    html += '</div></div>';

    // Item 3: Height
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="height">What is your height? <small>(feet, inches)</small></label></div>';
    html += '<div class="survey-demo-response">';
    html += '<input type="number" id="height-feet" name="height_feet" min="3" max="8" step="1" ' +
      'inputmode="numeric" placeholder="feet" aria-label="Height in feet" ' +
      'title="Enter a whole number from 3 to 8 feet." required>';
    html += '<input type="number" id="height-inches" name="height_inches" min="0" max="11" step="1" ' +
      'inputmode="numeric" placeholder="inches" aria-label="Additional height in inches" ' +
      'title="Enter a whole number from 0 to 11 inches." required>';
    html += '</div></div>';

    // Item 4: Weight
    html += '<div class="survey-demo-row">';
    html += '<div class="survey-demo-prompt"><label for="weight">What is your current weight? <small>(lbs.)</small></label></div>';
    html += '<div class="survey-demo-response">';
    html += '<input type="number" id="weight" name="weight" min="50" max="1000" step="any" ' +
      'inputmode="decimal" placeholder="lbs." title="Enter a value from 50 to 1000 pounds." required>';
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

    var form = display_element.querySelector('#jspsych-survey-demo');
    var errorEl = display_element.querySelector('#survey-demo-error');
    var genderOtherInput = display_element.querySelector('#gender-free-response');

    function clearValidationState() {
      errorEl.textContent = '';
      errorEl.classList.remove('visible');
      var invalidInputs = form.querySelectorAll('[aria-invalid="true"]');
      for (var i = 0; i < invalidInputs.length; i++) {
        invalidInputs[i].removeAttribute('aria-invalid');
      }
      var invalidRows = form.querySelectorAll('.survey-demo-row.invalid');
      for (var j = 0; j < invalidRows.length; j++) {
        invalidRows[j].classList.remove('invalid');
      }
    }

    function showValidationError(input, message) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        var row = input.closest ? input.closest('.survey-demo-row') : null;
        if (row) row.classList.add('invalid');
        input.focus();
      }
      errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }

    function selectedRadio(name) {
      return form.querySelector('input[name="' + name + '"]:checked');
    }

    function updateGenderOtherState() {
      var selectedGender = selectedRadio('gender-categorical');
      var isOther = !!selectedGender && selectedGender.value === 'Other';
      genderOtherInput.disabled = !isOther;
      genderOtherInput.required = isOther;
      if (!isOther) genderOtherInput.value = '';
    }

    var genderRadios = form.querySelectorAll('input[name="gender-categorical"]');
    for (var g = 0; g < genderRadios.length; g++) {
      genderRadios[g].addEventListener('change', updateGenderOtherState);
    }

    form.addEventListener('input', function(event) {
      if (event.target && event.target.removeAttribute) {
        event.target.removeAttribute('aria-invalid');
        var row = event.target.closest ? event.target.closest('.survey-demo-row') : null;
        if (row) row.classList.remove('invalid');
      }
      errorEl.classList.remove('visible');
    });

    form.addEventListener('submit', function(event) {
      event.preventDefault();

      clearValidationState();

      var ageInput = form.querySelector('#age');
      var age = ageInput.valueAsNumber;
      if (!Number.isFinite(age) || !Number.isInteger(age) || age < 18 || age > 120) {
        return showValidationError(ageInput, 'Please enter your age as a whole number from 18 to 120.');
      }

      var genderInput = selectedRadio('gender-categorical');
      var allowedGenders = ['Male', 'Female', 'Rather not say', 'Other'];
      if (!genderInput || allowedGenders.indexOf(genderInput.value) === -1) {
        return showValidationError(
          form.querySelector('input[name="gender-categorical"]'),
          'Please select a gender option.'
        );
      }
      if (genderInput.value === 'Other' && genderOtherInput.value.trim().length === 0) {
        return showValidationError(genderOtherInput, 'Please specify your gender, or choose another option.');
      }

      var feetInput = form.querySelector('#height-feet');
      var inchesInput = form.querySelector('#height-inches');
      var feet = feetInput.valueAsNumber;
      var inches = inchesInput.valueAsNumber;
      if (!Number.isFinite(feet) || !Number.isInteger(feet) || feet < 3 || feet > 8) {
        return showValidationError(feetInput, 'Please enter height in feet as a whole number from 3 to 8.');
      }
      if (!Number.isFinite(inches) || !Number.isInteger(inches) || inches < 0 || inches > 11) {
        return showValidationError(inchesInput, 'Please enter additional inches as a whole number from 0 to 11.');
      }

      var weightInput = form.querySelector('#weight');
      var weight = weightInput.valueAsNumber;
      if (!Number.isFinite(weight) || weight < 50 || weight > 1000) {
        return showValidationError(weightInput, 'Please enter a weight from 50 to 1000 lbs.');
      }

      var requiredMissing = form.querySelector('input[required]:invalid');
      if (requiredMissing) {
        return showValidationError(requiredMissing, 'Please answer all required questions before continuing.');
      }

      var checkboxes = display_element.querySelectorAll('input[name="race"]');
      var checkedOne = Array.prototype.slice.call(checkboxes).some(function(x) {
        return x.checked;
      });

      if (!checkedOne) {
        return showValidationError(checkboxes[0], 'Please choose at least one option for the race question.');
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
