/* jspsych-fullscreen.js
 * Josh de Leeuw
 *
 * toggle fullscreen mode in the browser
 *
 */

jsPsych.plugins.fullscreen = (function() {

  var plugin = {};

  plugin.info = {
    name: 'fullscreen',
    description: '',
    parameters: {
      fullscreen_mode: {
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: 'Fullscreen mode',
        default: true,
        array: false,
        description: 'If true, experiment will enter fullscreen mode. If false, the browser will exit fullscreen mode.'
      },
      message: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Message',
        default: '<p>The experiment will switch to full screen mode when you press the button below</p>',
        array: false,
        description: 'HTML content to display above the button to enter fullscreen mode.'
      },
      button_label: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Button label',
        default:  'Continue',
        array: false,
        description: 'The text that appears on the button to enter fullscreen.'
      },
      delay_after: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: 'Delay after',
        default: 1000,
        array: false,
        description: 'The length of time to delay after entering fullscreen mode before ending the trial.'
      },
    }
  }

  plugin.trial = function(display_element, trial) {

    // Use the current Fullscreen API directly. The original jsPsych 6 plug-in
    // skipped every browser exposing the old WebKit keyboard constant, which
    // can incorrectly bypass fullscreen in modern Safari/WebKit.
    if(trial.fullscreen_mode){
        display_element.innerHTML = trial.message +
          '<button id="jspsych-fullscreen-btn" class="jspsych-btn">'+trial.button_label+'</button>' +
          '<div id="jspsych-fullscreen-status" role="status" aria-live="polite" ' +
            'style="min-height:24px;margin-top:12px;text-align:center;font-size:15px;color:#991b1b;"></div>';

        var button = display_element.querySelector('#jspsych-fullscreen-btn');
        var status = display_element.querySelector('#jspsych-fullscreen-status');

        button.addEventListener('click', function() {
          if (button.disabled) return;
          button.disabled = true;
          status.textContent = 'Entering full screen…';
          status.style.color = '#475569';

          var request;
          if (typeof window.requestTaskFullscreen === 'function') {
            request = window.requestTaskFullscreen();
          } else {
            var element = document.documentElement;
            var requestMethod = element.requestFullscreen ||
              element.mozRequestFullScreen || element.webkitRequestFullscreen ||
              element.msRequestFullscreen;
            try {
              request = requestMethod
                ? Promise.resolve(requestMethod.call(element))
                : Promise.reject(new Error('Full-screen mode is unavailable.'));
            } catch (error) {
              request = Promise.reject(error);
            }
          }

          Promise.resolve(request).then(function() {
            window._hasEnteredFullscreen = true;
            endTrial(true);
          }).catch(function() {
            button.disabled = false;
            status.style.color = '#991b1b';
            status.textContent = 'Full-screen mode did not open. Please click the button to try again.';
          });
        });
    } else {
        // This is an intentional end-of-task exit, so suppress the reminder.
        window._hasEnteredFullscreen = false;
        document.body.classList.remove('fullscreen-warning-visible');
        var reminder = document.getElementById('fs-remind');
        if (reminder) {
          reminder.style.display = 'none';
          reminder.setAttribute('aria-hidden', 'true');
        }
        if ( document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement ) {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
        endTrial(true);
    }

    function endTrial(success) {

      display_element.innerHTML = '';

      jsPsych.pluginAPI.setTimeout(function(){

        var trial_data = {
          success: success !== false
        };

        jsPsych.finishTrial(trial_data);

      }, trial.delay_after);

    }

  };

  return plugin;
})();
