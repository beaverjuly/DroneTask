
var stimuli_version = "v09";

// ── Block design ──────────────────────────────────────────────────
// Block 1: reward, high vol / low sto
// Block 2: reward, low vol / high sto
// Block 3: loss,   high vol / low sto
// Block 4: loss,   low vol / high sto
//
// Convention:
//   vol 49 = high volatility,  vol 4  = low volatility
//   stc 64 = high stochasticity, stc 16 = low stochasticity
var factors_vol = [49, 4, 49, 4];
var factors_stc = [16, 64, 16, 64];
var factors_valence = ['reward', 'reward', 'loss', 'loss'];

// ── Latent change-point documentation ─────────────────────────────
// The latent bird/drone trajectory contains abrupt jumps (change points)
// at specific serial positions within each 50-trial block.  These are
// relevant for the slider-memory test which probes items near boundaries.
//
// High-volatility blocks (vol = 49, blocks 1 & 3):
//   Change points at trials: 3, 5, 11, 19, 25, 37, 39, 47
//   (frequent jumps — mean run length ≈ 49 trials equivalent)
//
// Low-volatility blocks (vol = 4, blocks 2 & 4):
//   Change points at trials: 3, 5, 11, 15, 19, 21, 25, 29, 31, 37, 39, 45, 47
//   (infrequent jumps — mean run length ≈ 4 trials)
//
// The six slider-memory pairs that straddle change points:
//   [2,4]   [11,13]   [16,18]   [22,24]   [34,36]   [39,41]
// For each pair the middle item (3, 12, 17, 23, 35, 40) may or may not
// sit on a change point depending on the block's volatility schedule.

var practice_bag_position = [
	[57.349,67.747,56.168,64.153,71.952,78.877,68.78,68.03,75.309,82.184,61.193,61.554,70.756,74.713,79.699,76.142,67.515,73.378,65.231,60.974,66.369,73.609,69.924,66.916,56.155,64.316,67.842,68.096,73.969,58.099,64.794,67.012,57.162,68.873,71.183,81.587,69.566,59.935,72.316,68.248,59.185,59.445,38.543,41.158,50.988,52.986,56.839,46.948,48.404,50.041],
];

var practice_bird_position = [
	[60,65.059,66.155,62.864,68.655,70.523,72.495,68.105,70.667,72.408,69.653,72.037,73.59,75.074,77.065,74.935,71.014,68.79,64.387,63.212,65.737,65.985,66.929,69.298,66.895,65.918,66.772,70.701,71.182,64.827,66.948,63.818,67.023,66.071,70.51,72.607,73.085,70.248,67.869,61.722,54.645,49.667,46.793,47.47,48.123,45.653,42.615,46.261,46.73,45.529],
];

var main_bag_position = [
	[64.156,63.129,56.968,57.266,57.36,59.31,49.356,60.486,52.962,59.27,52.542,49.688,53.735,54.753,49.647,52.083,58.173,56.651,40.297,59.672,52.397,54.937,57.273,45.488,55.807,61.996,54.88,54.442,55.298,53.238,54.505,59.571,61.967,49.315,57.251,54.147,63.469,64.919,59.658,60.26,66.758,68.149,61.875,63.308,67.983,54.367,62.145,63.147,57.057,67.106],
	[57.469,61.621,64.536,59.615,48.402,54.315,48.05,52.486,49.054,49.109,53.196,33.66,28.727,29.297,36.55,37.483,34.501,34.189,12.995,14.754,32.455,32.042,38.824,38.885,57.267,62.13,39.295,40.564,37.255,39.388,45.086,43.359,46.815,42.868,50.335,44.277,59.18,61.941,60.536,71.207,67.673,72.952,66.821,71.182,78.943,68.13,58.684,48.038,45.778,53.062],
	[52.908,68.352,52.696,63.631,58.693,45.1,56.256,60.183,52.719,55.835,68.896,56.718,42.275,50.517,61.909,46.731,52.779,64.315,52.188,45.532,58.88,57.29,49.368,68.955,59.474,57.795,63.868,59.913,44.065,37.609,61.431,60.779,38.365,48.262,59.85,53.103,63.319,61.354,55.169,71.695,54.619,58.867,64.871,57.847,71.886,50.057,76.102,57.701,54.723,58.209],
	[55.713,52.942,71.759,63.362,49.666,51.518,53.588,47.446,56.515,56.052,46.143,29.983,22.959,38.183,23.646,35.351,58.427,16.05,20.861,33.843,27.114,38.66,26.294,43.559,46.929,56.588,54.82,32.1,32.154,40.799,45.131,40.686,38.602,54.266,51.585,44.995,52.599,65.797,44.778,71.627,78.295,82.46,72.351,73.542,83.914,61.181,66.022,36.281,48.135,59.996],
];

var main_bird_position = [
	[60,58.702,61.064,61.064,57.328,57.328,57.328,57.328,57.328,57.328,57.328,51.388,51.388,51.388,53.14,53.14,53.14,53.14,46.517,46.517,52.925,52.925,52.925,52.925,60.691,60.691,54.776,54.776,54.776,54.776,54.776,56.801,56.801,56.801,56.801,56.801,60.625,60.625,60.625,64.419,64.419,64.419,64.419,64.419,64.419,62.109,62.109,57.704,57.704,59.555],
	[60,55.457,63.725,63.725,50.649,50.649,50.649,50.649,50.649,50.649,50.649,29.859,29.859,29.859,35.99,35.99,35.99,35.99,12.81,12.81,35.24,35.24,35.24,35.24,62.424,62.424,39.089,39.089,39.089,39.089,39.089,46.178,46.178,46.178,46.178,46.178,59.564,59.564,59.564,72.844,72.844,72.844,72.844,72.844,72.844,64.759,64.759,49.34,49.34,55.824],
	[60,58.702,61.064,61.064,57.328,57.328,57.328,57.328,57.328,57.328,57.328,51.388,51.388,51.388,53.14,53.14,53.14,53.14,46.517,46.517,52.925,52.925,52.925,52.925,60.691,60.691,54.776,54.776,54.776,54.776,54.776,56.801,56.801,56.801,56.801,56.801,60.625,60.625,60.625,64.419,64.419,64.419,64.419,64.419,64.419,62.109,62.109,57.704,57.704,59.555],
	[60,55.457,63.725,63.725,50.649,50.649,50.649,50.649,50.649,50.649,50.649,29.859,29.859,29.859,35.99,35.99,35.99,35.99,12.81,12.81,35.24,35.24,35.24,35.24,62.424,62.424,39.089,39.089,39.089,39.089,39.089,46.178,46.178,46.178,46.178,46.178,59.564,59.564,59.564,72.844,72.844,72.844,72.844,72.844,72.844,64.759,64.759,49.34,49.34,55.824],
];

function clampSeqValue(x, minVal, maxVal) {
  return Math.max(minVal, Math.min(maxVal, x));
}

function shiftSequence(seq, delta, minVal, maxVal) {
  return seq.map(function(x) {
    return clampSeqValue(x + delta, minVal, maxVal);
  });
}

// base latent sequences
var highVol_base_bird = main_bird_position[0].slice();
var lowVol_base_bird  = main_bird_position[1].slice();

var highVol_base_bag = main_bag_position[0].slice();
var lowVol_base_bag  = main_bag_position[1].slice();

// Uniform shifts applied to the whole sequence
// Adjust these for more or less separation between reward and loss blocks.
var HIGHVOL_SHIFT_DELTA = 6;
var LOWVOL_SHIFT_DELTA  = -4;

// Shifted variants
// Shift both bird and bag by the SAME delta so the task structure stays unchanged.
var highVol_shifted_bird = shiftSequence(highVol_base_bird, HIGHVOL_SHIFT_DELTA, 10, 90);
var highVol_shifted_bag  = shiftSequence(highVol_base_bag,  HIGHVOL_SHIFT_DELTA, 10, 90);

var lowVol_shifted_bird = shiftSequence(lowVol_base_bird, LOWVOL_SHIFT_DELTA, 10, 90);
var lowVol_shifted_bag  = shiftSequence(lowVol_base_bag,  LOWVOL_SHIFT_DELTA, 10, 90);

// Randomize whether REWARD blocks use shifted sequences or LOSS blocks use shifted sequences.
// This is evaluated once at page load, so it stays fixed within a participant.
var reward_uses_shifted_sequences = Math.random() < 0.5;

// Assemble the 4 block-specific sequences conditionally.
// Block 1: reward, high vol / low stc
// Block 2: reward, low vol / high stc
// Block 3: loss,   high vol / low stc
// Block 4: loss,   low vol / high stc
if (reward_uses_shifted_sequences) {
  main_bird_position = [
    highVol_shifted_bird.slice(), // block 1 reward highVol
    lowVol_shifted_bird.slice(),  // block 2 reward lowVol
    highVol_base_bird.slice(),    // block 3 loss highVol
    lowVol_base_bird.slice()      // block 4 loss lowVol
  ];

  main_bag_position = [
    highVol_shifted_bag.slice(), // block 1 reward highVol
    lowVol_shifted_bag.slice(),  // block 2 reward lowVol
    highVol_base_bag.slice(),    // block 3 loss highVol
    lowVol_base_bag.slice()      // block 4 loss lowVol
  ];
} else {
  main_bird_position = [
    highVol_base_bird.slice(),    // block 1 reward highVol
    lowVol_base_bird.slice(),     // block 2 reward lowVol
    highVol_shifted_bird.slice(), // block 3 loss highVol
    lowVol_shifted_bird.slice()   // block 4 loss lowVol
  ];

  main_bag_position = [
    highVol_base_bag.slice(),    // block 1 reward highVol
    lowVol_base_bag.slice(),     // block 2 reward lowVol
    highVol_shifted_bag.slice(), // block 3 loss highVol
    lowVol_shifted_bag.slice()   // block 4 loss lowVol
  ];
}
console.log("[stimuli] reward_uses_shifted_sequences =", reward_uses_shifted_sequences);

var SLIDER_PAIRS = [[2,4],[11,13],[16,18],[22,24],[34,36],[39,41]];
var BOUNDARY_MIDDLE_PAIRS = [[2,4],[11,13],[39,41]];
var NONBOUNDARY_MIDDLE_PAIRS = [[16,18],[22,24],[34,36]];


// ── Drop object distribution (kept for data compatibility) ────────
var drop_obj_distribution_default = [-4.25, -3, -1.75, -0.75, -0.25, 0.25, 0.75, 1.75, 3, 4.25];
var drop_obj_duration_default = [350, 400, 500, 550, 600, 600, 600, 500, 500, 400];

function get_drop_obj_distribution() {
  return drop_obj_distribution_default;
}

function get_drop_obj_duration() {
  return drop_obj_duration_default;
}

// Legacy aliases
var coins_distribution = [];
var coins_duration = [];
for (var _i = 0; _i < 200; _i++) {
  coins_distribution.push(drop_obj_distribution_default.slice());
  coins_duration.push(drop_obj_duration_default.slice());
}

// ── Emoji stimulus pool ───────────────────────────────────────────
// Shuffled per participant; 200 needed for 4 blocks × 50 trials.
var EMOJI_STIMULUS_POOL = [
  "🪃","🪀","👝","🥁","🥞","🪠","🗳️","🪣","🛵","🪥",
  "⚱️","🪨","🪩","🪫","🛷","🪭","🖲️","🏸","⏱️","🥌",
  "👗","🪸","🪴","🪵","🪶","🪷","🤿","🥋","🪺","🎻",
  "👜","🫐","🫑","🫒","🧤","🫔","🫕","🫖","🛥️","🛹",
  "🥅","🧋","🏹","🧮","🧯","🧰","🧱","🎾","🧳","🧴",
  "🧵","🧶","🪒","🧸","👖","🧺","🔌","📌","🧽","🌾",
  "🥏","🛝","🛞","🛟","🧫","🛡","🛢","🪤","🌳","🛺",
  "🪮","🛼","🪈","🪗","🪘","🪙","🪚","🪛","🪜","🖍️",
  "🪞","🪟","🎐","🥊","💐","🩱","🪓","🎡","⛸️","🎣",
  "🪦","🧆","🥪","🌂","🥓","🧣","🎰","🌷","🥕","🧃",
  "🥘","🛴","🎷","🎸","🎹","🎺","💺","🥯","🏈","🫚",
  "🏏","🏐","👡","🏒","🏓","🩴","🦺","🍋‍🟩","🌻","📻",
  "🎽","📠","⚗️","🗄️","🎙️","🧉","🩰","🎍","🔭","🦯",
  "🛰️","🪕","🥫","🥃","🧈","🧼","🍁","⛓️","🧹","🗃️",
  "🐚","🏮","🪢","👛","👞","🫙","🕯️","👢","💈","🥜",
  "⛑️","🕰️","🎱","🧂","🍹","🌵","🥽","🪻","👒","📜",
  "🫛","🚤","☎️","🚧","🥡","🛶","🫘","🏉","🌰","📡",
  "💴","🧄","🍈","💿","📟","🪔","⌨️","🍍","⛺️","🪅",
  "🛋️","📦","🎳","🔬","🛎️","🚪","⌚️","🏺","🗺️","📮",
  "🗞️","🍛","🥨","🪁","🎿","📯","🍠","🚦","🪑","🖌️",
  "🥩","🔦","🧭","🚂","🍨","🥭","🎛️","🍧","🚜","🍿",
  "🧥","🍯","🪇","🧇","🍲","🌺","📽️","🍱","🍶","🥾",
];

// Practice emoji (3, matching the 3 practice trials)
var PRACTICE_EMOJI = ["🍤","🎤","🌲"];