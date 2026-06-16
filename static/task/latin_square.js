// ──────────────────────────────────────────────────────────────
// latin_square.js — Latin-square block-order counterbalancing
//
// Canonical design indices:
//   0 = reward, high volatility / low stochasticity
//   1 = reward, low  volatility / high stochasticity
//   2 = loss,   high volatility / low stochasticity
//   3 = loss,   low  volatility / high stochasticity
//
// The latent position sequences remain attached to their canonical
// design index. The Latin Square only changes the order in which
// participants encounter the four canonical conditions.
//
// Globals set by this file:
//   CANONICAL_CONDITION_LABELS, LATIN_SQUARE_4,
//   hashStringToInt, isPermutationOf0123, getCanonicalConditionId,
//   getLatinSquareGroup, initLatinSquare
//
// After initLatinSquare() is called:
//   latin_square_group, block_order, randomized, block_order_labels
// ──────────────────────────────────────────────────────────────

var CANONICAL_CONDITION_LABELS = [
  'A_reward_highVol_lowStc',
  'B_reward_lowVol_highStc',
  'C_loss_highVol_lowStc',
  'D_loss_lowVol_highStc'
];

var LATIN_SQUARE_4 = [
  [0, 1, 3, 2],
  [1, 2, 0, 3],
  [2, 3, 1, 0],
  [3, 0, 2, 1]
];

function hashStringToInt(s) {
  var h = 0;
  s = String(s || '');

  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0; // force 32-bit integer
  }

  return Math.abs(h);
}

function isPermutationOf0123(arr) {
  if (!Array.isArray(arr) || arr.length !== 4) return false;

  var seen = {};
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] < 0 || arr[i] > 3) return false;
    if (seen[arr[i]]) return false;
    seen[arr[i]] = true;
  }

  return true;
}

function getCanonicalConditionId(designIdx) {
  return CANONICAL_CONDITION_LABELS[designIdx] || ('condition_' + designIdx);
}

/**
 * Determine the participant's Latin-square group.
 * Reads globals: _urlParams, PROLIFIC_PID, workerId, subId, SESSION_ID
 */
function getLatinSquareGroup() {
  // Optional dev override: ?latin_group=0 … 3
  var forced = _urlParams.get('latin_group');

  if (forced !== null && forced !== '') {
    var forcedInt = parseInt(forced, 10);
    if (!isNaN(forcedInt) && forcedInt >= 0 && forcedInt < LATIN_SQUARE_4.length) {
      console.log('[LATIN] Using forced latin_group=' + forcedInt);
      return forcedInt;
    }

    console.warn('[LATIN] Ignoring invalid latin_group=' + forced);
  }

  // Prefer stable external participant IDs when available.
  var idForCounterbalance =
    PROLIFIC_PID ||
    workerId ||
    subId ||
    SESSION_ID ||
    ('debug_' + Date.now());

  return hashStringToInt(idForCounterbalance) % LATIN_SQUARE_4.length;
}

/**
 * Construct the Latin-square derived globals.
 * Call AFTER participant identifiers are defined.
 *
 * Sets globals: latin_square_group, block_order, randomized, block_order_labels
 */
function initLatinSquare() {
  window.latin_square_group = getLatinSquareGroup();
  window.block_order = LATIN_SQUARE_4[latin_square_group].slice();

  if (!isPermutationOf0123(block_order)) {
    throw new Error('[LATIN] Invalid block_order: ' + JSON.stringify(block_order));
  }

  // Backward-compatible alias.
  window.randomized = block_order.slice();

  window.block_order_labels = block_order.map(function(idx) {
    return getCanonicalConditionId(idx);
  });

  if (typeof DEV_MODE !== 'undefined' && DEV_MODE) {
    console.log('[DEV] Latin-square group:', latin_square_group);
    console.log('[DEV] Block order:', block_order);
    console.log('[DEV] Block order labels:', block_order_labels);
  }

  console.log('[LATIN] latin_square_group =', latin_square_group);
  console.log('[LATIN] block_order =', block_order);
  console.log('[LATIN] block_order_labels =', block_order_labels);
}
