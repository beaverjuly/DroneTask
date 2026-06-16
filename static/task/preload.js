// ──────────────────────────────────────────────────────────────
// preload.js — Image preload list and jspsych-preload trial
//
// Provides:
//   buildPreloadImageList(stimulusSetImages, practiceStimImages)
//     → returns the preload_images array
//
//   buildPreloadTrial(skipPreload, preloadImages)
//     → returns a jspsych-preload trial object, or null if skipped
//
// The jspsych-preload plugin (6.3.1) owns the progress bar.
// Its update_loading_progress_bar() already has a null-guard at
// line 188, so no extra wrapper is needed for Pavlovia safety.
// ──────────────────────────────────────────────────────────────

/**
 * Build the list of images to preload.
 * @param {string[]} stimulusSetImages  - main-task PNG paths
 * @param {string[]} practiceStimImages - practice stimuli (emojis filtered out)
 * @returns {string[]}
 */
function buildPreloadImageList(stimulusSetImages, practiceStimImages) {
  var images = [
    'static/img/task_assets/reward/drone0.png',
    'static/img/task_assets/reward/drone1.png',
    'static/img/task_assets/reward/drone2.png',
    'static/img/task_assets/reward/drone3.png',
    'static/img/task_assets/reward/drone4.png'
  ];

  // Main object PNG stimuli.
  if (Array.isArray(stimulusSetImages)) {
    images = images.concat(stimulusSetImages);
  }

  // Practice stimuli that are image paths (emoji strings are ignored).
  if (Array.isArray(practiceStimImages)) {
    images = images.concat(
      practiceStimImages.filter(function(x) {
        return typeof x === 'string' && (x.indexOf('/') !== -1 || x.indexOf('.png') !== -1);
      })
    );
  }

  return images;
}

/**
 * Build a jspsych-preload timeline trial.
 * @param {boolean}  skipPreload  - true for text-only dev stages
 * @param {string[]} preloadImages - from buildPreloadImageList()
 * @returns {Object|null} - jspsych-preload trial, or null if skipped
 */
function buildPreloadTrial(skipPreload, preloadImages) {
  if (skipPreload || !preloadImages || preloadImages.length === 0) {
    return null;
  }

  return {
    type: 'preload',
    images: preloadImages,
    show_progress_bar: true,
    message: '<p style="font-size:16px;font-family:sans-serif;">Loading experiment assets…</p>',
    continue_after_error: true,
    show_detailed_errors: false,
    on_error: function(f) { console.warn('[preload] Failed:', f); }
  };
}
