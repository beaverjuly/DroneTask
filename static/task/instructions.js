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

// Planet mini-card: shows only sky + ground + rail + collector + drone.
// Each planet has a unique sky hue so the 4-planet grid is visually distinct at a glance.
function mockPlanet(hue, sat, planetNum, droneX, collectorX, scale) {
  scale  = scale       || 0.22;
  droneX = droneX      || 50;
  collectorX = collectorX || droneX;
  var w   = (80 * scale) + 'vw';
  var h   = (80 * scale) + 'vh';
  var sky = 'linear-gradient(to bottom,' +
    'hsl(' + hue + ',' + sat + '%,12%) 0%,' +
    'hsl(' + hue + ',' + sat + '%,22%) 35%,' +
    'hsl(' + hue + ',' + sat + '%,36%) 60%,' +
    'hsl(' + hue + ',' + (sat + 8) + '%,52%) 78%,' +
    'hsl(' + hue + ',' + (sat + 12) + '%,65%) 100%)';
  var gnd = 'linear-gradient(to bottom,' +
    'hsl(' + hue + ',' + (sat + 5) + '%,62%) 0%,' +
    'hsl(' + hue + ',' + sat + '%,52%) 100%)';
  return (
    '<div style="position:relative;width:' + w + ';height:' + h + ';' +
      'border-radius:12px;overflow:hidden;flex-shrink:0;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.4);' +
      'border:2px solid rgba(255,255,255,.12);' +
      'background:' + sky + ';margin:0 auto;">' +
      '<div style="position:absolute;left:0;right:0;bottom:0;height:22%;' +
        'background:' + gnd + ';border-top:1px solid rgba(255,255,255,.18);"></div>' +
      '<div style="position:absolute;left:' + droneX + '%;top:8%;' +
        'transform:translateX(-50%);font-size:22px;opacity:.85;">🛸</div>' +
      '<div style="position:absolute;left:8%;width:84%;top:78%;height:3px;' +
        'transform:translateY(-50%);border-radius:999px;' +
        'background:rgba(255,255,255,.55);box-shadow:0 0 8px rgba(255,255,255,.15);"></div>' +
      '<div style="position:absolute;left:' + collectorX + '%;top:78%;' +
        'transform:translate(-50%,-50%);width:14%;min-width:32px;height:14px;">' +
        '<div style="position:absolute;inset:0;border-radius:999px;' +
          'background:rgba(255,255,255,.88);border:2px solid rgba(255,255,255,.65);' +
          'box-shadow:0 0 0 1px rgba(255,255,255,.15),0 2px 8px rgba(0,0,0,.25);"></div>' +
      '</div>' +
      '<div style="position:absolute;bottom:24%;left:50%;transform:translateX(-50%);' +
        'font-size:9px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.6px;' +
        'text-transform:uppercase;white-space:nowrap;">Planet ' + planetNum + '</div>' +
    '</div>'
  );
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
    HIDE_PREV +
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
    HIDE_PREV +
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
    HIDE_PREV +
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
    HIDE_PREV +
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
      'The drone <strong>hovers in one area</strong> for several drops, then <strong>jumps</strong> to a new area.') +
      '<div style="display:flex;align-items:flex-start;gap:12px;justify-content:center;' +
        'margin-top:14px;width:86vw;max-width:1400px;margin-left:auto;margin-right:auto;">' +

        '<!-- Group 1: hovering phase -->' +
        '<div style="flex:3;min-width:0;background:rgba(255,255,255,.07);' +
          'border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:10px 8px 6px;">' +
          '<div style="text-align:center;font-size:16px;font-weight:700;color:hsl(224, 58%, 48%);' +
            'letter-spacing:.3px;margin-bottom:6px;">🔁 Hovering nearby</div>' +
          '<div style="display:flex;gap:6px;justify-content:center;">' +
            (function () {
              return [
                { droneX: 44, bagX: 46, label: 'drop 1' },
                { droneX: 47, bagX: 45, label: 'drop 2' },
                { droneX: 45, bagX: 48, label: 'drop 3' }
              ].map(function (d) {
                return (
                  '<div style="flex:1;min-width:0;text-align:center;">' +
                    mockGame({ droneX: d.droneX, collectorX: d.droneX,
                      collectorLocked: true, bagX: d.bagX, valence: 'reward' }, null, 0.24) +
                    '<div style="font-size:11px;color:#888;margin-top:2px;">' + d.label + '</div>' +
                  '</div>'
                );
              }).join('');
            })() +
          '</div>' +
        '</div>' +

        '<!-- Arrow divider -->' +
        '<div style="display:flex;align-items:center;padding-top:38px;' +
          'font-size:26px;color:#ccc;flex-shrink:0;">➜</div>' +

        '<!-- Group 2: jump phase -->' +
        '<div style="flex:2;min-width:0;background:rgba(255,220,100,.08);' +
          'border:1px solid rgba(255,220,100,.25);border-radius:12px;padding:10px 8px 6px;">' +
          '<div style="text-align:center;font-size:16px;font-weight:700;color:hsl(38, 100%, 45%);' +
            'letter-spacing:.3px;margin-bottom:6px;">⏩ Jumps to new area</div>' +
          '<div style="display:flex;gap:6px;justify-content:center;">' +
            (function () {
              return [
                { droneX: 66, bagX: 64, label: 'drop 4' },
                { droneX: 63, bagX: 66, label: 'drop 5' }
              ].map(function (d) {
                return (
                  '<div style="flex:1;min-width:0;text-align:center;">' +
                    mockGame({ droneX: d.droneX, collectorX: d.droneX,
                      collectorLocked: true, bagX: d.bagX, valence: 'reward' }, null, 0.24) +
                    '<div style="font-size:11px;color:#888;margin-top:2px;">' + d.label + '</div>' +
                  '</div>'
                );
              }).join('');
            })() +
          '</div>' +
        '</div>' +

      '</div>',

    // P1c: strategy tip
    pageBody('🤫 Want to catch more?',
      'Place your collector <strong>right under where the drone is</strong>.<br><br>' +
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
    pageBody('⚠️ In the real mission, you cannot see the drone',
      'You can only see the supply being dropped, <br>' + 
      '🧐 So you must <strong>infer</strong> where the drone is from where the bag lands.',
      { headColor: '#b00020' }) +
      '<div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;' +
        'margin-top:10px;width:80vw;max-width:1400px;margin-left:auto;margin-right:auto;">' +
        '<div style="flex:1;min-width:280px;">' +
          '<div style="text-align:center;font-size:14px;font-weight:700;color:#0a7f2e;margin-bottom:4px;">' +
            '✔️ drone visible</div>' +
          mockGame({ droneX: 55, collectorX: 50, collectorLocked: true,
            bagX: 57, valence: 'reward', showFragments: true, scoreText: '+8' }, null, 0.45) +
        '</div>' +
        '<div style="flex:1;min-width:280px;">' +
          '<div style="text-align:center;font-size:14px;font-weight:700;color:#b00020;margin-bottom:4px;">' +
            '❔ drone hidden</div>' +
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

    // P1: 4 planets, each with a unique drone
    HIDE_PREV +
    pageBody('🧑‍🚀 You will visit <strong>4 planets</strong>.',
      'Each has a <strong>unique drone</strong> that moves differently.<br>' +
      'On each planet, the supply will be <em>all</em> ' + green('green') +
      ', or <em>all</em> ' + red('red') + '.<br>' +
      '<strong>Always catch as many fragments as possible.</strong>') +

      '<div style="display:flex;gap:14px;justify-content:center;align-items:flex-start;' +
        'margin-top:20px;width:90vw;max-width:1400px;margin-left:auto;margin-right:auto;">' +
        (function () {
          var planets = [
            { hue: 210, sat: 42, droneX: 35, collectorX: 35 },
            { hue: 265, sat: 32, droneX: 62, collectorX: 62 },
            { hue:  22, sat: 48, droneX: 50, collectorX: 50 },
            { hue: 158, sat: 38, droneX: 72, collectorX: 72 }
          ];
          return planets.map(function (p, i) {
            return (
              '<div style="flex:1;min-width:0;text-align:center;">' +
                mockPlanet(p.hue, p.sat, i + 1, p.droneX, p.collectorX, 0.22) +
                '<div style="font-size:12px;color:#666;margin-top:6px;font-style:italic;">' +
                  'unique movement' +
                '</div>' +
              '</div>'
            );
          }).join('');
        })() +
      '</div>' +

      '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;' +
        'margin-top:20px;max-width:680px;margin-left:auto;margin-right:auto;">' +
        '<div style="flex:1;min-width:200px;padding:10px 16px;border-radius:10px;' +
          'background:#f6fff7;border:1.5px solid #c6e8cc;font-size:15px;">' +
          pill('Green supply', '#0a7f2e', '#fff') +
          ' Catch more = ' + green('earn more') + '<br>' +
          '<span style="font-size:13px;color:#555;">Best: ' + green('+10') + '&nbsp;·&nbsp;Worst: ' + gold('0') + '</span>' +
        '</div>' +
        '<div style="flex:1;min-width:200px;padding:10px 16px;border-radius:10px;' +
          'background:#fff7f7;border:1.5px solid #f0c8c8;font-size:15px;">' +
          pill('Red supply', '#b00020', '#fff') +
          ' Catch more = ' + red('lose less') + '<br>' +
          '<span style="font-size:13px;color:#555;">Best: ' + gold('0') + '&nbsp;·&nbsp;Worst: ' + red('−10') + '</span>' +
        '</div>' +
      '</div>' ,

// P2: object questions overview — revised for key-controlled bars
pageBody('👽 Examine each object carefully',
  'After each planet mission, we will ask about the objects from that planet.<br><br>' +
  '🧑‍🚀 <em>No need</em> to remember them, your main mission is supply collection') +
  '<div style="display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:14px;' +
    'width:86vw;max-width:980px;margin:18px auto 8px auto;">' +

    '<div style="background:#f8fafc;border:1px solid #d6dee8;border-radius:14px;' +
      'padding:16px 14px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.05);">' +
      '<div style="font-size:34px;margin-bottom:8px;">🍤 ⇄ 🧩</div>' +
      '<div style="font-size:15px;line-height:1.45;color:#4b5563;">Which object came <strong>first</strong>?<br>' +
        '<span style="font-size:13px;color:#888;">← → to select, Enter to confirm</span></div>' +
    '</div>' +

    '<div style="background:#f8fafc;border:1px solid #d6dee8;border-radius:14px;' +
      'padding:16px 14px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.05);">' +
      '<div style="margin-bottom:8px;position:relative;height:18px;">' +
        '<div style="position:absolute;left:10%;right:10%;top:50%;height:4px;transform:translateY(-50%);' +
          'background:rgba(0,0,0,.12);border-radius:2px;"></div>' +
        '<div style="position:absolute;left:35%;top:50%;width:12px;height:12px;border-radius:50%;' +
          'transform:translate(-50%,-50%);background:rgba(59,130,246,.8);border:2px solid rgba(59,130,246,1);"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:6px;padding:0 8%;">' +
        '<span>Very close</span><span>Very far</span></div>' +
      '<div style="font-size:15px;line-height:1.45;color:#4b5563;">How <strong>far apart</strong> in time did these feel?<br>' +
        '<span style="font-size:13px;color:#888;">← → to move, Enter to confirm</span></div>' +
    '</div>' +

    '<div style="background:#f8fafc;border:1px solid #d6dee8;border-radius:14px;' +
      'padding:16px 14px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.05);">' +
      '<div style="font-size:34px;margin-bottom:8px;">🌲 ⇠ 🎤 ⇢ 🍤</div>' +
      '<div style="font-size:15px;line-height:1.45;color:#4b5563;"><strong>Where</strong> in time did one appear between the other two?<br>' +
        '<span style="font-size:13px;color:#888;">← → to place on the bar</span></div>' +
    '</div>' +
    '</div>' +
    '<div style="max-width:680px;margin:14px auto 0;padding:12px 18px;' +
      'border-radius:10px;background:#f0f5ff;border:1px solid #c8d8f0;text-align:center;' +
      'font-size:14px;color:#4b5563;">' +
      '🛠️ All questions are answered using <strong>← → arrow keys</strong> ' +
      'and <strong>Enter</strong> — no mouse or typing needed.' +
    '</div>' ,

// P3: placement example — revised for key-controlled bar with larger probe
pageBody('Example placement question',
  'Use <strong>← →</strong> to place the highlighted object on the bar between the other two, ' +
  'then press <strong>Enter</strong> to confirm.') +
  '<div style="max-width:760px;margin:20px auto 10px auto;padding:20px 24px;' +
    'border-radius:18px;background:#f8fafc;border:1px solid #d6dee8;' +
    'box-shadow:0 8px 24px rgba(15,23,42,.08);">' +

    '<div style="text-align:center;margin-bottom:14px;">' +
      '<div style="display:inline-flex;width:110px;height:110px;border-radius:14px;' +
        'background:white;border:3px solid rgba(59,130,246,.55);' +
        'align-items:center;justify-content:center;font-size:56px;' +
        'box-shadow:0 0 16px rgba(59,130,246,.25),0 4px 12px rgba(0,0,0,.08);">🎤</div>' +
      '<div style="font-size:13px;color:#3b82f6;font-weight:600;margin-top:6px;">Place this object</div>' +
    '</div>' +

    '<div style="display:flex;align-items:center;gap:14px;width:100%;">' +

      '<div style="width:80px;text-align:center;flex-shrink:0;">' +
        '<div style="width:72px;height:72px;margin:0 auto;border-radius:12px;background:white;' +
          'border:2px solid #c2c8d0;display:flex;align-items:center;justify-content:center;' +
          'font-size:36px;box-shadow:0 3px 10px rgba(0,0,0,.06);">🌲</div>' +
      '</div>' +

      '<div style="flex:1;text-align:center;min-width:200px;position:relative;">' +
        '<div style="height:6px;background:rgba(0,0,0,.12);border-radius:3px;position:relative;margin:14px 0;">' +
          '<div style="position:absolute;left:38%;top:50%;width:18px;height:18px;border-radius:50%;' +
            'transform:translate(-50%,-50%);background:rgba(59,130,246,.9);' +
            'border:2px solid rgba(59,130,246,1);box-shadow:0 0 10px rgba(59,130,246,.5);"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;color:#888;margin-top:2px;">' +
          '<span>Closer to 🌲</span><span>Closer to 🍤</span>' +
        '</div>' +
      '</div>' +

      '<div style="width:80px;text-align:center;flex-shrink:0;">' +
        '<div style="width:72px;height:72px;margin:0 auto;border-radius:12px;background:white;' +
          'border:2px solid #c2c8d0;display:flex;align-items:center;justify-content:center;' +
          'font-size:36px;box-shadow:0 3px 10px rgba(0,0,0,.06);">🍤</div>' +
      '</div>' +

    '</div>' +
    '</div>'
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
    HIDE_PREV +
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
    '<style>' +
    '@keyframes tp-drift{' +
      '0%{transform:translateY(0) scale(1);opacity:0}' +
      '10%{opacity:1}' +
      '90%{opacity:1}' +
      '100%{transform:translateY(-60vh) scale(0.3);opacity:0}' +
    '}' +
    '@keyframes tp-pulse{' +
      '0%,100%{transform:scale(1);opacity:0.7}' +
      '50%{transform:scale(1.15);opacity:1}' +
    '}' +
    '@keyframes tp-glow{' +
      '0%,100%{text-shadow:0 0 8px rgba(99,102,241,.3)}' +
      '50%{text-shadow:0 0 24px rgba(99,102,241,.6),0 0 48px rgba(139,92,246,.3)}' +
    '}' +
    '.tp-wrap{position:relative;overflow:hidden;min-height:50vh;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;}' +
    '.tp-particle{position:absolute;bottom:-20px;font-size:22px;pointer-events:none;' +
      'animation:tp-drift linear infinite;}' +
    '.tp-title{font-size:30px;font-weight:850;margin-bottom:14px;' +
      'animation:tp-glow 2s ease-in-out infinite;}' +
    '.tp-luck{font-size:26px;font-weight:700;animation:tp-pulse 1.8s ease-in-out infinite;}' +
    '</style>' +
    '<div class="tp-wrap">' +
      '<div class="tp-particle" style="left:8%;animation-duration:3.2s;animation-delay:0s;">▪️</div>' +
      '<div class="tp-particle" style="left:20%;animation-duration:2.8s;animation-delay:0.4s;font-size:16px;">▪️</div>' +
      '<div class="tp-particle" style="left:35%;animation-duration:3.5s;animation-delay:1.1s;">▪️</div>' +
      '<div class="tp-particle" style="left:50%;animation-duration:2.6s;animation-delay:0.2s;font-size:18px;">▪️</div>' +
      '<div class="tp-particle" style="left:65%;animation-duration:3.0s;animation-delay:0.8s;">▪️</div>' +
      '<div class="tp-particle" style="left:78%;animation-duration:3.4s;animation-delay:1.5s;font-size:14px;">▪️</div>' +
      '<div class="tp-particle" style="left:90%;animation-duration:2.9s;animation-delay:0.6s;">▪️</div>' +
      '<div class="tp-particle" style="left:44%;animation-duration:3.8s;animation-delay:1.8s;font-size:20px;">▪️</div>' +
      '<div class="tp-title">🌌 You are being teleported now... 🌌</div>' +
      '<div class="tp-luck"> Good luck! </div>' +
    '</div>'
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

// ═══════════════════════════════════════════════════════════════════
// E — Comprehension hooks (unchanged)
// ═══════════════════════════════════════════════════════════════════

var num_loops = 0;
var comprehension1 = { type: 'comprehension1' };
var comprehension2 = { type: 'comprehension2' };