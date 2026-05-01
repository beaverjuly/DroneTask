// instructions.js

// ═══════════════════════════════════════════════════════════════════
// A — Game-accurate mock-up library
// ═══════════════════════════════════════════════════════════════════
var MOCK_SCENE = {
  width:    '80vw',
  height:   '80vh',
  maxWidth: '1400px'
};

function mockFrame(innerHTML, frameStyle, scale) {
  scale = scale || 1;
  var w = (80 * scale) + 'vw';
  var h = (80 * scale) + 'vh';
  return (
    '<div style="' +
      'position:relative;' +
      'width:' + w + ';' +
      'height:' + h + ';' +                  // ← explicit vh, not padding-bottom
      'max-width:' + MOCK_SCENE.maxWidth + ';' +
      'margin:18px auto;border-radius:14px;overflow:hidden;' +
      'box-shadow:0 12px 30px rgba(0,0,0,.28);' +
      'border:2px solid rgba(255,255,255,.08);' +
      'background:linear-gradient(to bottom,' +
        'hsl(210,38%,18%) 0%,hsl(210,38%,28%) 30%,hsl(210,38%,42%) 55%,' +
        'hsl(210,44%,58%) 72%,hsl(210,48%,72%) 85%,hsl(210,46%,80%) 100%);' +
      (frameStyle || '') +
    '">' +
      '<div style="position:absolute;left:0;right:0;bottom:0;height:22%;' +
        'background:linear-gradient(to bottom,hsl(210,46%,80%) 0%,hsl(210,42%,74%) 100%);' +
        'border-top:1px solid rgba(255,255,255,.2);"></div>' +
      innerHTML +
    '</div>'
  );
}

function buildScene(opts) {
  opts = opts || {};
  var droneX     = opts.droneX;
  var collectorX = (typeof opts.collectorX === 'number') ? opts.collectorX : 50;
  var bagX       = opts.bagX;
  var valence    = opts.valence || 'reward';
  var locked     = !!opts.collectorLocked;
  var scoreText  = opts.scoreText;
  var itemEmoji  = opts.itemEmoji;
  var itemTop  = (typeof opts.itemTop === 'number') ? opts.itemTop : 30;
  var scoreTop = (typeof opts.scoreTop === 'number') ? opts.scoreTop : 40;
  var pieces     = [];

  if (itemEmoji) {
    var itemX = (typeof opts.itemX === 'number') ? opts.itemX : 50;
    var itemSize = (typeof opts.itemSize === 'number') ? opts.itemSize : 110;
    var itemFontSize = (typeof opts.itemFontSize === 'number') ? opts.itemFontSize : 58;

    pieces.push(
      '<div style="position:absolute;left:' + itemX + '%;top:' + itemTop + '%;' +
        'transform:translate(-50%,-50%);' +
        'width:' + itemSize + 'px;height:' + itemSize + 'px;' +
        'background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.22);' +
        'border-radius:14px;display:flex;align-items:center;justify-content:center;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:14;">' +
        '<span style="font-size:' + itemFontSize + 'px;line-height:1;">' + itemEmoji + '</span>' +
      '</div>'
    );
  }

  if (typeof droneX === 'number') {
    pieces.push(
      '<div style="position:absolute;left:' + droneX + '%;top:7%;' +
        'transform:translateX(-50%);font-size:36px;opacity:.9;' +
        'filter:drop-shadow(0 4px 8px rgba(0,0,0,.4));">🛸</div>'
    );
  }

  if (scoreText) {
    var scoreColor = (valence === 'loss')
      ? (scoreText === '0' ? '#FFD700' : '#FF4444')
      : '#39FF14';
    var scoreX = (typeof bagX === 'number') ? bagX : 50;
    pieces.push(
      '<div style="position:absolute;left:' + scoreX + '%;top:' + scoreTop + '%;' +
        'transform:translate(-50%,-50%);font-size:40px;font-weight:800;' +
        'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
        'color:' + scoreColor + ';text-shadow:0 2px 10px rgba(0,0,0,.5);z-index:15;">' +
        scoreText + '</div>'
    );
  }

  pieces.push(
    '<div style="position:absolute;left:8%;width:84%;top:78%;height:3px;' +
      'transform:translateY(-50%);border-radius:999px;' +
      'background:rgba(255,255,255,.55);box-shadow:0 0 8px rgba(255,255,255,.15);"></div>'
  );

  var boxBg     = locked ? 'rgba(100,100,120,.7)'  : 'rgba(255,255,255,.88)';
  var boxBorder = locked ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.65)';
  var boxShadow = locked
    ? '0 2px 6px rgba(0,0,0,.3)'
    : '0 0 0 1px rgba(255,255,255,.15),0 3px 10px rgba(0,0,0,.25)';
  pieces.push(
    '<div style="position:absolute;left:' + collectorX + '%;top:78%;' +
      'transform:translate(-50%,-50%);width:12%;min-width:60px;max-width:120px;height:22px;">' +
      '<div style="position:absolute;inset:0;border-radius:999px;background:' + boxBg + ';' +
        'border:2px solid ' + boxBorder + ';box-shadow:' + boxShadow + ';"></div>' +
    '</div>'
  );

  if (typeof bagX === 'number') {
    var bagBg = (valence === 'loss')
      ? 'radial-gradient(circle,hsl(0,65%,55%) 0%,hsl(0,50%,40%) 100%)'
      : 'radial-gradient(circle,hsl(130,60%,55%) 0%,hsl(130,45%,38%) 100%)';
    pieces.push(
      '<div style="position:absolute;left:' + bagX + '%;top:71%;' +
        'transform:translate(-50%,-50%);width:24px;height:24px;' +
        'border-radius:50%;background:' + bagBg + ';' +
        'border:2px solid rgba(255,255,255,.55);z-index:11;' +
        'box-shadow:0 0 12px rgba(255,255,255,.22),0 3px 8px rgba(0,0,0,.4);"></div>'
    );
  }

  if (opts.showFragments && typeof bagX === 'number') {
    var fragColor = (valence === 'loss')
      ? 'linear-gradient(180deg,hsl(0,78%,62%),hsl(0,62%,42%))'
      : 'linear-gradient(180deg,hsl(130,75%,62%),hsl(130,62%,42%))';
    [-3.5, -2, -0.7, 0.7, 2, 3.5].forEach(function (off, i) {
      pieces.push(
        '<div style="position:absolute;left:calc(' + bagX + '% + ' + off + 'vw);' +
          'top:74%;transform:translate(-50%,-50%) scale(.9) rotate(' + (i * 35) + 'deg);' +
          'width:10px;height:10px;border-radius:2px;background:' + fragColor + ';' +
          'box-shadow:0 0 4px rgba(255,255,255,.35);"></div>'
      );
    });
  }

  return pieces.join('');
}

function callout(labelXPct, labelYPct, targetXPct, targetYPct, text, accent) {
  var c = accent || '#ffec80';
  var key = 'a' + Math.floor(Math.random() * 1e9);
  return (
    '<svg style="position:absolute;inset:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:25;overflow:visible;" viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<defs><marker id="' + key + '" viewBox="0 0 10 10" refX="8" refY="5" ' +
        'markerWidth="3" markerHeight="3" orient="auto-start-reverse">' +
        '<path d="M 0 0 L 10 5 L 0 10 z" fill="' + c + '"/></marker></defs>' +
      '<line x1="' + labelXPct + '" y1="' + labelYPct + '" x2="' + targetXPct + '" y2="' + targetYPct + '" ' +
        'stroke="' + c + '" stroke-width="0.7" stroke-linecap="round" ' +
        'marker-end="url(#' + key + ')" vector-effect="non-scaling-stroke"/>' +
    '</svg>' +
    '<div style="position:absolute;left:' + labelXPct + '%;top:' + labelYPct + '%;' +
      'transform:translate(-50%,-50%);background:' + c + ';color:#1a1a1a;' +
      'font-size:13px;font-weight:700;padding:3px 8px;border-radius:5px;' +
      'white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35);z-index:26;' +
      'font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">' + text + '</div>'
  );
}

function mockGame(opts, callouts, scale) {
  var inner = buildScene(opts);
  if (callouts && callouts.length) inner += callouts.join('');
  return mockFrame(inner, null, scale);
}

// ═══════════════════════════════════════════════════════════════════
// B — Text helpers
// ═══════════════════════════════════════════════════════════════════

function pageBody(headline, body, opts) {
  opts = opts || {};
  return (
    '<div style="font-size:20px;line-height:1.7;text-align:center;max-width:800px;margin:0 auto;">' +
      '<div style="font-size:25px;font-weight:800;color:' + (opts.headColor || '#1f2937') + ';margin-bottom:14px;">' +
        headline + '</div>' +
      (body ? '<div>' + body + '</div>' : '') +
    '</div>'
  );
}

function blockIntroHTML(lines, accentColor, turnLabel) {
  var c = accentColor || '#1f2937';
  var bullets = lines.map(function (l) {
    return '<li style="margin:8px 0;">' + l + '</li>';
  }).join('');
  return (
    '<div style="font-size:20px;line-height:1.6;text-align:center;' +
      'max-width:540px;margin:36px auto;padding:22px 28px;' +
      'border-radius:16px;background:#fafbfc;border:2px solid ' + c + '33;' +
      'box-shadow:0 6px 18px rgba(0,0,0,.06);">' +
      (turnLabel
        ? '<div style="font-size:13px;font-weight:700;color:#999;letter-spacing:.5px;' +
          'text-transform:uppercase;margin-bottom:10px;">' + turnLabel + '</div>'
        : '') +
      '<ul style="list-style:none;padding:0;margin:0 auto;text-align:left;' +
        'display:inline-block;font-size:18px;">' + bullets + '</ul>' +
      '<div style="margin-top:18px;font-size:15px;color:#555;">' +
        'Press <strong>space</strong> or click <strong>Next</strong> to begin.' +
      '</div>' +
    '</div>'
  );
}

function pill(text, bg, fg) {
  return (
    '<span style="display:inline-block;padding:2px 10px;border-radius:999px;' +
      'background:' + bg + ';color:' + fg + ';font-weight:700;font-size:14px;">' + text + '</span>'
  );
}

// Colour helpers for inline text.
function green(text) { return '<span style="color:#0a7f2e;font-weight:700;">' + text + '</span>'; }
function red(text)   { return '<span style="color:#b00020;font-weight:700;">' + text + '</span>'; }
function gold(text)  { return '<span style="color:#b58a00;font-weight:700;">' + text + '</span>'; }

// Injected into page-1 HTML of every instruction node so jsPsych's back
// button is cleanly hidden when there is nothing to go back to.
// jsPsych replaces the content div on each page navigation, so this tag
// only lives while page 1 is shown; Prev reappears from page 2 onwards.
var HIDE_PREV = '<style>#jspsych-instructions-back{display:none!important}</style>';

// ═══════════════════════════════════════════════════════════════════
// C — Instruction pages
// ═══════════════════════════════════════════════════════════════════

// ── inst1: Goal + movement ─────────────────────────────────────────
var inst1 = {
  type: 'instructions',
  pages: [
    pageBody('🧑‍🚀 Your mission',
      'A drone drops <strong>supplies</strong> to a rail. Use a <strong>collector</strong> to catch them.<br><br>'),

    pageBody('Here is the scene.') +
      mockGame(
        { droneX: 50, collectorX: 50 },
        [
          callout(20, 10, 48, 10, 'Drone'),

          // label above-left, arrow points to collector button
          callout(30, 63, 50, 78, 'Collector'),

          // label above-right, arrow points to rail line
          callout(70, 63, 58, 78, 'Rail'),
        ]
      ) +
      '<div style="font-size:13px;color:#888;text-align:center;margin-top:-6px;">' +
        'Labels are tutorial-only' +
      '</div>',

    pageBody('How to move',
      'Press <strong>⬅️ Left</strong> and <strong>➡️ Right</strong> on keyboard to move the collector.<br>'),

  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

// ── Block-intro: practice 1 ────────────────────────────────────────
var block_intro_practice1 = {
  type: 'instructions',
  pages: [
    blockIntroHTML([
      'Let us warm up!',
      'Try sliding ↔️ the collector along the rail.'
    ], '#3b6db8')
  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

// ── inst2: Locking · bag · bag colour · items ──────────────────────
var inst2_locking_and_bag = {
  type: 'instructions',
  pages: [

    // P1: locking
    pageBody('The collector <strong>is locked ⏹️</strong> just before each bag drops',
      'It turns grey, you cannot move it until the next turn.') +
      '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;' +
        'margin-top:16px;width:80vw;max-width:1400px;margin-left:auto;margin-right:auto;">' +
        '<div style="flex:1;min-width:280px;">' +
          '<div style="text-align:center;font-size:14px;font-weight:700;color:#0a7f2e;margin-bottom:4px;">' +
            '✅ movable (white)</div>' +
          mockGame({ droneX: 50, collectorX: 50, collectorLocked: false },
            [callout(78, 75, 56, 78, 'movable', '#fff3a3')], 0.45) +
        '</div>' +
        '<div style="flex:1;min-width:280px;">' +
          '<div style="text-align:center;font-size:14px;font-weight:700;color:#444;margin-bottom:4px;">' +
            '⏹️ locked (grey)</div>' +
          mockGame({ droneX: 50, collectorX: 50, collectorLocked: true },
            [callout(78, 75, 56, 78, 'locked', '#cccccc')], 0.45) +
        '</div>' +
      '</div>',

    // P2: bag drops + score
    pageBody('Supply bags disintegrate 💥 just before hitting the rail',
      'Your score is based on how many bag fragments you catch.<br>' +
      '<strong> Catch more ➡ Better score</strong>') +
      '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;' +
        'margin-top:10px;width:80vw;max-width:1400px;margin-left:auto;margin-right:auto;">' +
        '<div style="flex:1;min-width:280px;">' +
          '<div style="text-align:center;font-size:14px;font-weight:700;color:#0a7f2e;margin-bottom:4px;">' +
            'Catch all fragments</div>' +
          mockGame({ droneX: 50, collectorX: 50, collectorLocked: true,
            bagX: 50, valence: 'reward', showFragments: true, scoreText: '+10' }, null, 0.45) +
        '</div>' +
        '<div style="flex:1;min-width:280px;">' +
          '<div style="text-align:center;font-size:14px;font-weight:700;color:#666;margin-bottom:4px;">' +
            'Catch fewer fragments</div>' +
          mockGame({ droneX: 60, collectorX: 35, collectorLocked: true,
            bagX: 60, valence: 'reward', showFragments: true, scoreText: '+3' }, null, 0.45) +
        '</div>' +
      '</div>',

    // P3: bag colour rule
    pageBody('🟢🔴 Two kinds of supply',
      'Your mission is <strong>always the same</strong>: ' +
      'Catch as <strong>many</strong> fragments as possible!') +
      '<div style="display:flex;gap:18px;justify-content:center;flex-wrap:wrap;' +
        'margin-top:16px;width:80vw;max-width:1400px;margin-left:auto;margin-right:auto;">' +

        '<div style="flex:1;min-width:250px;padding:18px 22px;' +
          'border-radius:14px;background:#f6fff7;border:2px solid #d8efdc;">' +
          '<div style="font-size:20px;font-weight:800;color:#0a7f2e;margin-bottom:8px;">' +
            pill('Green supply', '#0a7f2e', '#fff') + '</div>' +
          '<div style="font-size:17px;line-height:1.6;color:#1f2937;">' +
            'Catch more = ' + green('earn more points') + '<br>' +
            '<span style="font-size:14px;color:#555;">Perfect: ' + green('+10') + ' &nbsp;·&nbsp; Worst: ' + gold('0') + '</span>' +
          '</div>' +
          mockGame({ droneX: 50, collectorX: 50, collectorLocked: true,
            bagX: 50, valence: 'reward', showFragments: true, scoreText: '+10' }, null, 0.45) +
        '</div>' +

        '<div style="flex:1;min-width:250px;padding:18px 22px;' +
          'border-radius:14px;background:#fff7f7;border:2px solid #f0d7d7;">' +
          '<div style="font-size:20px;font-weight:800;color:#b00020;margin-bottom:8px;">' +
            pill('Red supply', '#b00020', '#fff') + '</div>' +
          '<div style="font-size:17px;line-height:1.6;color:#1f2937;">' +
            'Catch more = ' + red('lose fewer points') + '<br>' +
            '<span style="font-size:14px;color:#555;">Perfect: ' + gold('0') + ' &nbsp;·&nbsp; Worst: ' + red('−10') + '</span>' +
          '</div>' +
          mockGame({ droneX: 50, collectorX: 50, collectorLocked: true,
            bagX: 50, valence: 'loss', showFragments: true, scoreText: '0' }, null, 0.45) +
        '</div>' +

      '</div>' +
      '<div style="font-size:17px;text-align:center;margin-top:16px;color:#333;">' +
        '<strong> Final score ➡ bonus pay 💰</strong>' +
      '</div>',

    // P4: items + keep responding
    pageBody('You also receive an object with each bag dropped',
      'We may ask about objects you received, ' +
      'but <em>no need</em> to remember them.<br><br>' +
      '⚠️ <strong style="color:#b00020;">Keep moving your collector.</strong><br>' +
      'If you do not move the collector for a long time, the mission will be <em>aborted early</em>.') +
      mockGame({
        droneX: 50,
        collectorX: 50,
        collectorLocked: true,
        bagX: 50,
        valence: 'reward',
        showFragments: true,
        scoreText: '+10',
        scoreTop: 47,
        itemEmoji: '🧩',
        itemTop: 31,
        itemSize: 100,
        itemFontSize: 56
      },
      [callout(80, 24, 53, 31, 'object received')],0.6),

  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

// ── Block-intros: green bag, drone visible ─────────────────────────
var block_intro_green_seen = {
  type: 'instructions',
  pages: [
    blockIntroHTML([
      ' <strong>3 practice turns.</strong>',
      '🟢 Catch more = ' + green('earn more') + ' (+0 to +10 per turn).',
    ], '#0a7f2e', 'Practice · green supply')
  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

// ── Block-intros: red bag, drone visible ───────────────────────────
var block_intro_red_seen = {
  type: 'instructions',
  pages: [
    blockIntroHTML([
      ' <strong> Now a different kind of supply!</strong> 3 practice turns.',
      '🔴 Catch more = ' + red('lose less') + ' (−10 to 0 per turn).'
    ], '#b00020', 'Practice · red supply')
  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

// ── inst3: Wind + drone behaviour + drone-disappears ───────────────
var inst3_drone_disappears = {
  type: 'instructions',
  pages: [

    // P1a: air currents / bag shift
    pageBody('🤔 Noticed something?',
      'The bag lands <strong>near</strong> the drone, but unpredictable air currents 💨 can <strong>shift</strong> it slightly.<br>' +
      'So the bag may land a little left or right of the drone.') +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;' +
        'margin-top:10px;width:80vw;max-width:1400px;margin-left:auto;margin-right:auto;">' +
        (function () {
          var bags = [44, 50, 56];
          var labels = ['shifted left', 'near the drone', 'shifted right'];
          return labels.map(function (label, i) {
            return (
              '<div style="flex:1;min-width:200px;">' +
                mockGame({
                  droneX: 50,
                  collectorX: 50,
                  collectorLocked: true,
                  bagX: bags[i],
                  valence: 'reward'
                }, null, 0.28) +
                '<div style="text-align:center;font-size:14px;color:#555;margin-top:-6px;">' + label + '</div>' +
              '</div>'
            );
          }).join('');
        })() +
      '</div>',

    // P1b: drone hovers, then moves farther
    pageBody('🤔 Noticed something?',
      'The drone usually <strong>hovers around one area</strong> for a few supply-drops.<br>' +
      'Then it may <strong>move to a new place</strong> and hover there for another few drops.') +
      '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;' +
        'margin-top:10px;width:86vw;max-width:1400px;margin-left:auto;margin-right:auto;">' +
        (function () {
          var drones = [44, 47, 45, 62, 64];
          var bags   = [46, 45, 48, 60, 66];
          var labels = ['drop 1', 'drop 2', 'drop 3', 'moves farther', 'hovers nearby'];
          return labels.map(function (label, i) {
            return (
              '<div style="flex:1;min-width:150px;">' +
                mockGame({
                  droneX: drones[i],
                  collectorX: drones[i],
                  collectorLocked: true,
                  bagX: bags[i],
                  valence: 'reward'
                }, null, 0.22) +
                '<div style="text-align:center;font-size:13px;color:#555;margin-top:-6px;">' + label + '</div>' +
              '</div>'
            );
          }).join('');
        })() +
      '</div>',

    // P1c: strategy tip
    pageBody('🤫 Want to catch more?',
      'Place your collector <strong>under where you think the drone is</strong>.<br><br>' +
      '👉 This gives you the <em>best chance</em> to catch fragments, even when air currents shift the bag.') +
      mockGame({
        droneX: 50,
        collectorX: 50,
        collectorLocked: true,
        bagX: 55,
        valence: 'reward',
        showFragments: true,
        scoreText: '+8'
      },
      [callout(74, 24, 50, 10, 'estimate drone location'),
      callout(72, 70, 50, 60, 'place collector nearby')],
      0.65),

    // P2: drone disappears
    pageBody('🚨 In the real mission, you cannot see the drone',
      'You can only see the supply being dropped, <br>' + 
      '🧐 So you must <strong>infer</strong> where the drone is from where the bag lands.',
      { headColor: '#b00020' }) +
      '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;' +
        'margin-top:10px;width:80vw;max-width:1400px;margin-left:auto;margin-right:auto;">' +
        '<div style="flex:1;min-width:280px;">' +
          '<div style="text-align:center;font-size:14px;font-weight:700;color:#0a7f2e;margin-bottom:4px;">' +
            '💡 drone visible</div>' +
          mockGame({ droneX: 55, collectorX: 50, collectorLocked: true,
            bagX: 57, valence: 'reward', showFragments: true, scoreText: '+8' }, null, 0.45) +
        '</div>' +
        '<div style="flex:1;min-width:280px;">' +
          '<div style="text-align:center;font-size:14px;font-weight:700;color:#b00020;margin-bottom:4px;">' +
            '🚨 drone hidden</div>' +
          mockGame({ collectorX: 50, collectorLocked: true,
            bagX: 57, valence: 'reward', showFragments: true, scoreText: '+8' }, null, 0.45) +
        '</div>' +
      '</div>',

  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

// ── Block-intros: green bag, drone hidden ──────────────────────────
var block_intro_green_hidden = {
  type: 'instructions',
  pages: [
    blockIntroHTML([
      ' <strong>3 turns.</strong> Drone <strong>invisible</strong>.',
      '🟢 Catch more = ' + green('earn more') + ' (+0 to +10).'
    ], '#0a7f2e', 'Practice · green supply · no drone')
  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

// ── Block-intros: red bag, drone hidden ────────────────────────────
var block_intro_red_hidden = {
  type: 'instructions',
  pages: [
    blockIntroHTML([
      ' <strong>3 practice turns.</strong> Drone <strong>invisible</strong>.',
      '🔴 Catch more = ' + red('lose fewer points') + ' (−10 to 0).'
    ], '#b00020', 'Practice · red supply · no drone')
  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

// ── inst4: Full game + memory ──────────────────────────────────────
var inst4_full_game = {
  type: 'instructions',
  pages: [

    // P1: 4 drones
    pageBody('🧑‍🚀 Your mission, in brief.',
      'You will be sent to <strong>4 different planets</strong>, each with a <strong>different drone</strong>.<br>' + 
      'Each drone <strong>moves differently</strong>.<br>' +
      'On each planet, the supplies will be <strong>either</strong> ' + green('green') + ' or ' + red('red') + '.<br><br>' +
      '<strong>Always try to catch as many fragments as possible.</strong>') +
      '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;' +
        'margin-top:16px;max-width:780px;margin-left:auto;margin-right:auto;">' +

        '<div style="flex:1;min-width:240px;padding:14px 18px;border-radius:14px;' +
          'background:#f6fff7;border:2px solid #d8efdc;">' +
          '<div style="font-size:20px;font-weight:800;color:#0a7f2e;margin-bottom:6px;">' +
            pill('Green bag', '#0a7f2e', '#fff') + '</div>' +
          '<div style="font-size:16px;color:#1f2937;line-height:1.5;">' +
            'Catch more = ' + green('earn more points') + '<br>' +
            '<span style="font-size:14px;color:#555;">Perfect: ' + green('+10') +
            ' &nbsp;·&nbsp; Worst: ' + gold('0') + '</span>' +
          '</div>' +
        '</div>' +

        '<div style="flex:1;min-width:240px;padding:14px 18px;border-radius:14px;' +
          'background:#fff7f7;border:2px solid #f0d7d7;">' +
          '<div style="font-size:20px;font-weight:800;color:#b00020;margin-bottom:6px;">' +
            pill('Red bag', '#b00020', '#fff') + '</div>' +
          '<div style="font-size:16px;color:#1f2937;line-height:1.5;">' +
            'Catch more = ' + red('lose fewer points') + '<br>' +
            '<span style="font-size:14px;color:#555;">Perfect: ' + gold('0') +
            ' &nbsp;·&nbsp; Worst: ' + red('−10') + '</span>' +
          '</div>' +
        '</div>' ,

    // P2: memory test
    pageBody('👽 With every supply drop, you also receive an <strong>object</strong> 🤲.<br>' +
      'After the collection mission on each planet, we will ask about the objects you received.') +
      '<ol style="font-size:18px;line-height:1.8;text-align:left;' +
        'max-width:620px;margin:14px auto;">' +
        '<li><strong>Which</strong> of two objects did you receive <strong>first</strong>?</li>' +
        '<li><strong>How many</strong> objects were received <strong>between</strong> two objects?</li>' +
        '<li><strong>When</strong> did you receive one object <strong>between</strong> two other objects?</li>' +
      '</ol>' +
      '<div style="font-size:17px;text-align:center;margin-top:8px;color:#555;">' +
        'These questions do not affect your score — just answer as best you can 😎' +
      '</div>',

    // P3: slider example
    pageBody('Question example',
      'Move the slider to indicate <strong>when</strong> you received the top object in between the other two.') +
      '<div style="display:flex;justify-content:center;align-items:flex-end;' +
        'gap:18px;margin:20px auto 8px auto;width:82%;max-width:660px;">' +

        '<div style="width:84px;height:84px;border-radius:12px;background:#f0f3f7;' +
          'border:2px solid #c2c8d0;display:flex;align-items:center;' +
          'justify-content:center;font-size:40px;">🌲</div>' +

        '<div style="flex:1;text-align:center;">' +
          '<div style="margin-bottom:12px;font-size:40px;">🎤</div>' +
          '<input type="range" min="0" max="100" value="50" style="width:100%;">' +
        '</div>' +

        '<div style="width:84px;height:84px;border-radius:12px;background:#f0f3f7;' +
          'border:2px solid #c2c8d0;display:flex;align-items:center;' +
          'justify-content:center;font-size:40px;">🍤</div>' +

      '</div>',

    // P4: priority
    pageBody('🧑‍🚀 Remember',
      '<strong> Collect more ➡ Better score 💯 </strong><br><br>' +
      'For ' + green('green bags') + ': catch more = earn more points<br>' +
      'For ' + red('red bags') + ': catch more = lose fewer points<br><br>' +
      '🧑‍🔬 Examine the objects carefully, but your <em>main mission</em> is <strong>supply collection</strong>.'),

  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

// ═══════════════════════════════════════════════════════════════════
// D — Quiz, ready, recovery screens
// ═══════════════════════════════════════════════════════════════════

var quiz = {
  type: 'instructions',
  pages: [
    pageBody('To ensure your mission is clear, <br><br>' +
      '<strong>answer the following questions correctly.</strong>')
  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

var ready = {
  type: 'instructions',
  pages: [
    HIDE_PREV +
    '<div style="font-size:21px;line-height:1.8;text-align:center;">' +
      '<strong style="font-size:28px;"> You are being teleported now...</strong>' +
      '<br><br> <strong> 🌠 Good luck! 🌌</strong>' +
    '</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

var inst1_incorrect = {
  type: 'instructions',
  pages: [
    HIDE_PREV +
    pageBody('🫣 Some answers were incorrect.',
      'The instructions will be repeated. Please read carefully.',
      { headColor: '#b00020' })
  ],
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

var inst3_incorrect = {
  type: 'instructions',
  pages: [
    pageBody('😶‍🌫️ You did not respond.',
      'Your mission must be aborted now.', { headColor: '#b00020' })
  ],
  show_clickable_nav: false
};

var inst_summary = {
  type: 'instructions',
  pages: [].concat(
    [
      pageBody('🫣 You did not answer all questions correctly.',
        'The instructions will be repeated.<br><strong>Focus on the rules below.</strong>',
        { headColor: '#b00020' })
    ],
    inst1.pages,
    inst2_locking_and_bag.pages,
    inst3_drone_disappears.pages,
    inst4_full_game.pages,
    [
      pageBody('🫡 Now',
        'Try answer the questions again.<br>' +
        '<strong>Answer them correctly to start your journey!</strong>')
    ]
  ),
  show_clickable_nav: true,
  button_label_previous: 'Prev',
  button_label_next: 'Next'
};

// ═══════════════════════════════════════════════════════════════════
// E — Comprehension hooks (unchanged)
// ═══════════════════════════════════════════════════════════════════

var num_loops = 0;
var comprehension1 = { type: 'comprehension1' };
var comprehension2 = { type: 'comprehension2' };