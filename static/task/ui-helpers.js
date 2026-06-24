// ──────────────────────────────────────────────────────────────
// ui-helpers.js — Shared UI functions used by multiple scripts
//
// Must load BEFORE instructions.js and index.html's inline script,
// which both call glowSquaresScreen() at the top level.
// ──────────────────────────────────────────────────────────────

/**
 * Build an HTML string for a "glow" transition screen with drifting ▪️
 * particles and a pulsing title glow.
 *
 * jsPsych replaces display_element's innerHTML per trial, so only one
 * of these is ever in the DOM at a time — fixed class/keyframe names
 * are safe to reuse across every call site.
 *
 * @param {string} innerHTML - the content to display inside the glow wrap
 * @param {Object} [opts]
 *   .minHeight  — CSS height for the centred wrap (default '38vh')
 *   .glowColor  — 'r,g,b' triplet for the title's pulsing glow
 *   .density    — number of drifting ▪️ particles (default 7)
 *
 * Tag any element you want to pulse-glow with class="glow-title".
 */
window.glowSquaresScreen = function (innerHTML, opts) {
  opts = opts || {};
  var minHeight = opts.minHeight || '38vh';
  var glowColor = opts.glowColor || '30,64,175';
  var density   = opts.density   || 7;

  var lefts  = [8, 20, 34, 48, 62, 76, 90, 16, 56, 84];
  var sizes  = [10, 14, 8, 12, 10, 7, 11, 9, 13, 6];
  var durs   = [3.4, 2.8, 3.6, 2.5, 3.1, 3.3, 2.7, 3.0, 2.9, 3.5];
  var delays = [0, .5, 1.2, .3, .9, 1.6, .7, 1.1, .2, 1.4];

  var particles = '';
  for (var p = 0; p < density; p++) {
    particles +=
      '<div class="glow-particle" style="left:' + lefts[p % lefts.length] + '%;' +
      'animation-duration:' + durs[p % durs.length] + 's;' +
      'animation-delay:' + delays[p % delays.length] + 's;' +
      'font-size:' + sizes[p % sizes.length] + 'px;">\u25AA\uFE0F</div>';
  }

  return (
    '<style>' +
      '@keyframes glow-drift{' +
        '0%{transform:translateY(0) scale(1);opacity:0}' +
        '10%{opacity:.55}90%{opacity:.55}' +
        '100%{transform:translateY(-50vh) scale(0.2);opacity:0}' +
      '}' +
      '@keyframes glow-pop{' +
        '0%{transform:scale(0.86);opacity:0}' +
        '65%{transform:scale(1.035);opacity:1}' +
        '100%{transform:scale(1);opacity:1}' +
      '}' +
      '@keyframes glow-pulse{' +
        '0%,100%{text-shadow:0 0 6px rgba(' + glowColor + ',.25)}' +
        '50%{text-shadow:0 0 20px rgba(' + glowColor + ',.55)}' +
      '}' +
      '.glow-wrap{position:relative;overflow:hidden;min-height:' + minHeight + ';' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'animation:glow-pop .5s cubic-bezier(.2,.8,.3,1.1) both;}' +
      '.glow-particle{position:absolute;bottom:-10px;pointer-events:none;' +
        'animation:glow-drift linear infinite;}' +
      '.glow-title{animation:glow-pulse 2.2s ease-in-out infinite;}' +
    '</style>' +
    '<div class="glow-wrap">' +
      particles +
      '<div style="position:relative;z-index:1;width:100%;">' + innerHTML + '</div>' +
    '</div>'
  );
};
