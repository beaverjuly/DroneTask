// instructions.js — Revised for skimmability + incremental visual mock-ups

var instructions = [];
const style1 = "font-size:20px";

// ---------------------------------------------------------------------
// Reusable HTML mock-ups styled to resemble the real task
// ---------------------------------------------------------------------

function mockGameFrame(inner, extraStyle) {
  return (
    '<div style="' +
      'width:78%;max-width:760px;margin:18px auto 10px auto;padding:18px 16px 20px 16px;' +
      'border-radius:16px;overflow:hidden;position:relative;' +
      'background:linear-gradient(to bottom,' +
        'hsl(210,38%,18%) 0%,' +
        'hsl(210,38%,28%) 30%,' +
        'hsl(210,38%,42%) 55%,' +
        'hsl(210,44%,58%) 72%,' +
        'hsl(210,48%,72%) 85%,' +
        'hsl(210,46%,80%) 100%);' +
      'box-shadow:0 12px 30px rgba(0,0,0,.28);' +
      'border:2px solid rgba(255,255,255,.08);' +
      (extraStyle || '') +
    '">' +
      '<div style="position:absolute;left:0;right:0;bottom:0;height:22%;' +
        'background:linear-gradient(to bottom,hsl(210,46%,80%) 0%,hsl(210,42%,74%) 100%);' +
        'border-top:1px solid rgba(255,255,255,.2);"></div>' +
      '<div style="position:relative;z-index:2;">' + inner + '</div>' +
    '</div>'
  );
}

function mockRail(boxLeftPct, dotLeftPct, opts) {
  opts = opts || {};

  var boxLocked = !!opts.boxLocked;
  var showRail = (typeof opts.showRail === 'undefined') ? true : !!opts.showRail;
  var showDot = !!opts.showDot;
  var showLine = !!opts.showLine;
  var valence = opts.valence || 'reward';
  var score = opts.score || '';
  var showItem = !!opts.showItem;
  var item = opts.item || '🍤';

  var boxBg = boxLocked ? 'rgba(100,100,120,.72)' : 'rgba(255,255,255,.92)';
  var boxBorder = boxLocked ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.62)';
  var boxText = boxLocked ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)';
  var dotBg = valence === 'loss'
    ? 'radial-gradient(circle, hsl(0,65%,55%) 0%, hsl(0,50%,40%) 100%)'
    : 'radial-gradient(circle, hsl(130,60%,55%) 0%, hsl(130,45%,38%) 100%)';
  var lineColor = valence === 'loss' ? '#ff4444' : '#39ff14';
  var scoreColor = valence === 'loss' ? '#ff4444' : '#39ff14';

  return mockGameFrame(
    '<div style="height:210px;position:relative;">' +

      (showRail ? (
        '<div style="position:absolute;left:8%;width:84%;height:3px;top:72%;' +
          'transform:translateY(-50%);border-radius:999px;background:rgba(255,255,255,.55);' +
          'box-shadow:0 0 8px rgba(255,255,255,.15);"></div>'
      ) : '') +

      (showLine ? (
        '<div style="position:absolute;top:72%;height:2px;transform:translateY(-1px);' +
          'left:' + Math.min(boxLeftPct, dotLeftPct) + '%;width:' + Math.abs(dotLeftPct - boxLeftPct) + '%;' +
          'opacity:.8;background:repeating-linear-gradient(90deg,' + lineColor + ' 0 4px, transparent 4px 8px);"></div>'
      ) : '') +

      (showDot ? (
        '<div style="position:absolute;left:' + dotLeftPct + '%;top:72%;transform:translate(-50%,-50%);' +
          'width:30px;height:30px;border-radius:50%;background:' + dotBg + ';' +
          'border:2px solid rgba(255,255,255,.5);box-shadow:0 0 12px rgba(255,255,255,.2),0 3px 8px rgba(0,0,0,.35);"></div>'
      ) : '') +

      (score ? (
        '<div style="position:absolute;left:' + dotLeftPct + '%;top:48%;transform:translateX(-50%);' +
          'font-size:30px;font-weight:800;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
          'color:' + scoreColor + ';text-shadow:0 2px 10px rgba(0,0,0,.45);">' + score + '</div>'
      ) : '') +

      (showItem ? (
        '<div style="position:absolute;left:' + dotLeftPct + '%;top:22%;transform:translateX(-50%);' +
          'width:94px;height:94px;border-radius:14px;background:rgba(255,255,255,.12);' +
          'border:2px solid rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;' +
          'box-shadow:0 8px 24px rgba(0,0,0,.3);font-size:52px;line-height:1;">' + item + '</div>'
      ) : '') +

      '<div style="position:absolute;left:' + boxLeftPct + '%;top:72%;transform:translate(-50%,-50%);' +
        'width:62px;height:36px;border-radius:7px;background:' + boxBg + ';border:2px solid ' + boxBorder + ';' +
        'box-shadow:0 3px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;">' +
        '<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:' + boxText + ';' +
          'text-transform:uppercase;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">YOU</span>' +
      '</div>' +

    '</div>'
  );
}

function mockBrightDarkComparison() {
  return (
    '<div style="display:flex;gap:16px;justify-content:center;align-items:stretch;flex-wrap:wrap;margin:12px auto 4px auto;width:84%;">' +

      '<div style="flex:1;min-width:240px;max-width:320px;padding:14px;border-radius:14px;' +
        'background:#f7f8fb;border:1px solid #e3e6ef;box-shadow:0 4px 14px rgba(0,0,0,.06);">' +
        '<div style="font-size:22px;font-weight:800;margin-bottom:10px;color:#1f2937;">Bright box</div>' +
        '<div style="display:flex;justify-content:center;align-items:center;height:78px;">' +
          '<div style="width:82px;height:42px;border-radius:8px;background:rgba(255,255,255,.95);' +
            'border:2px solid rgba(180,180,180,.8);display:flex;align-items:center;justify-content:center;' +
            'box-shadow:0 3px 12px rgba(0,0,0,.12);">' +
            '<span style="font-size:10px;font-weight:800;letter-spacing:1px;color:#555;">YOU</span>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:18px;line-height:1.5;text-align:center;margin-top:8px;"><strong>Movable</strong></div>' +
      '</div>' +

      '<div style="flex:1;min-width:240px;max-width:320px;padding:14px;border-radius:14px;' +
        'background:#f7f8fb;border:1px solid #e3e6ef;box-shadow:0 4px 14px rgba(0,0,0,.06);">' +
        '<div style="font-size:22px;font-weight:800;margin-bottom:10px;color:#1f2937;">Dark box</div>' +
        '<div style="display:flex;justify-content:center;align-items:center;height:78px;">' +
          '<div style="width:82px;height:42px;border-radius:8px;background:rgba(100,100,120,.78);' +
            'border:2px solid rgba(140,140,160,.45);display:flex;align-items:center;justify-content:center;' +
            'box-shadow:0 3px 12px rgba(0,0,0,.12);">' +
            '<span style="font-size:10px;font-weight:800;letter-spacing:1px;color:rgba(255,255,255,.45);">YOU</span>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:18px;line-height:1.5;text-align:center;margin-top:8px;"><strong>Locked / frozen</strong></div>' +
      '</div>' +

    '</div>'
  );
}

// ---------------------------------------------------------------------
// Compact GREEN/RED summary card.
// Renders the side-by-side environment comparison only.
// The page that uses this should provide its own intro and closing
// sentences (see inst5 below).
// ---------------------------------------------------------------------
function mockGainLossComparison() {
  return (
    '<div style="display:flex;gap:18px;justify-content:center;align-items:stretch;flex-wrap:wrap;margin:14px auto 4px auto;width:88%;">' +

      // GREEN environment card
      '<div style="flex:1;min-width:240px;max-width:340px;padding:18px;border-radius:14px;' +
        'background:#f7fff8;border:2px solid #d8efdc;box-shadow:0 4px 14px rgba(0,0,0,.06);text-align:center;">' +
        '<div style="font-size:24px;font-weight:800;color:#0a7f2e;margin-bottom:10px;">GREEN = reward</div>' +
        '<div style="font-size:18px;line-height:1.55;color:#1f2937;">' +
          'Better placement<br>→ <strong>gain more points</strong>' +
        '</div>' +
      '</div>' +

      // RED environment card
      '<div style="flex:1;min-width:240px;max-width:340px;padding:18px;border-radius:14px;' +
        'background:#fff8f8;border:2px solid #f0d7d7;box-shadow:0 4px 14px rgba(0,0,0,.06);text-align:center;">' +
        '<div style="font-size:24px;font-weight:800;color:#b00020;margin-bottom:10px;">RED = loss</div>' +
        '<div style="font-size:18px;line-height:1.55;color:#1f2937;">' +
          'Better placement<br>→ <strong>lose fewer points</strong>' +
        '</div>' +
      '</div>' +

    '</div>'
  );
}

var inst1_incorrect = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.6; text-align:center;"><br><br><strong style="font-size:24px; color:#b00020;">Some answers were incorrect.</strong><br><br>Some instructions will be repeated.<br><strong>Please pay close attention.</strong></div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst_summary = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px; color:#b00020;">You did not answer all questions correctly.</strong><br><br>Some instructions will now be repeated.<br><br><strong>Focus on the key rules below.</strong></div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:25px;">Goal</strong><br><br>Move your <strong>box</strong> to catch the falling supplies.</div>' +
      mockRail(45, 58, { boxLocked: false, showDot: false, showLine: false, showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Move the box</strong><br><br>Use the <strong>left</strong> and <strong>right arrow keys</strong> to move the white box labeled <strong>"YOU"</strong>.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">When you can move</strong><br><br><strong>Bright box = movable</strong><br><strong>Darker box = locked</strong></div>' +
      mockBrightDarkComparison(),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Landing location</strong><br><br>A <strong>colored circle</strong> shows where the bag landed.</div>' +
      mockRail(41, 62, { boxLocked: true, showDot: true, showLine: false, valence: 'reward', showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">A <strong>dashed line</strong> shows the distance between your box and the landing location.</div>' +
      mockRail(41, 62, { boxLocked: true, showDot: true, showLine: true, valence: 'reward', showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Your score</strong><br><br>A <strong>number</strong> appears each turn.</div>' +
      mockRail(52, 52, { boxLocked: true, showDot: true, showLine: false, valence: 'reward', score: '+10', showItem: false }),

    '<div style="font-size:20px; line-height:1.8; text-align:center;"><strong style="font-size:25px;">Reward scoring</strong><br><br>In <strong>green environments</strong>, better placement helps you <strong>gain more points</strong>.<br><br><strong style="font-size:24px; color:#0a7f2e;">Perfect alignment = +10</strong><br><br>If you are farther away, you gain fewer points.</div>' +
      mockRail(52, 52, { boxLocked: true, showDot: true, showLine: false, valence: 'reward', score: '+10', showItem: false }) +
      mockRail(36, 63, { boxLocked: true, showDot: true, showLine: true, valence: 'reward', score: '+3', showItem: false }),

    '<div style="font-size:20px; line-height:1.8; text-align:center;"><strong style="font-size:25px;">Loss scoring</strong><br><br>In <strong>red environments</strong>, better placement helps you <strong>lose fewer points</strong>.<br><br><strong style="font-size:24px; color:#b00020;">Perfect alignment = 0</strong><br><br>If you are farther away, you lose more points.</div>' +
      mockRail(52, 52, { boxLocked: true, showDot: true, showLine: false, valence: 'loss', score: '0', showItem: false }) +
      mockRail(36, 63, { boxLocked: true, showDot: true, showLine: true, valence: 'loss', score: '-7', showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Next turn</strong><br><br>When the box becomes <strong>bright</strong> again, the next turn begins.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px; color:#b00020;">Keep responding</strong><br><br>If you stop moving the box for too many turns, you may be warned and the game may end early.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Where the bag falls</strong><br><br>The bag falls <strong>near the drone</strong>, but wind makes the exact landing spot vary.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">The drone also moves</strong><br><br>The best guess for where the drone is now is where it was on the previous turn, but it can move to a new location.</div>',

    '<div style="font-size:21px; line-height:1.8; text-align:center;"><strong style="font-size:26px;">Best strategy</strong><br><br><strong>Put the box directly under where you think the drone is.</strong></div>' +
      mockRail(50, 54, { boxLocked: false, showDot: true, showLine: true, valence: 'reward', score: '', showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Important change in the real game</strong><br><br>You will <strong>not</strong> see the drone.<br>You will only see the <strong>colored circle</strong> showing where the bag landed.</div>' +
      mockRail(44, 57, { boxLocked: true, showDot: true, showLine: true, valence: 'reward', score: '+6', showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">So you still move the box the same way, but you must <strong>estimate the drone\'s location</strong> from where it has been.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Items and memory test</strong><br><br>Each turn, a distinct <strong>item</strong> will appear. Later, there will be a short <strong>memory test</strong> about those items.</div>' +
      mockRail(50, 50, { boxLocked: true, showDot: true, showLine: false, valence: 'reward', score: '+10', showItem: true, item: '🧩' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">4 environments</strong><br><br>The full game has <strong>both types of environments</strong>, with different movement patterns and scoring contexts.</div>' +
      mockGainLossComparison() +
      '<div style="font-size:19px; line-height:1.6; text-align:center; margin-top:10px;">In every environment, <strong>place the box as accurately as possible</strong>.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Next step</strong><br><br>You will now answer questions about the game again.<br><strong>You must answer them correctly to continue.</strong></div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst3_incorrect = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><br><br><strong style="font-size:24px; color:#b00020;">You did not respond.</strong><br><br>We must terminate the game here.</div>'
  ],
  show_clickable_nav: false
};

var inst1 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:25px;">Goal</strong><br><br>Move your <strong>box</strong> to where you think the supplies will land.</div>' +
      mockRail(46, 58, { boxLocked: false, showDot: false, showLine: false, showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">How to move</strong><br><br>Use the <strong>left</strong> and <strong>right arrow keys</strong>.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Try it now</strong><br><br>Press the <strong>left</strong> or <strong>right arrow key</strong> to move the box.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

// ---------------------------------------------------------------------
// inst2: locked box → landing → dashed line → Reward scoring → Loss scoring
//        → next turn → rule → keep responding → try it now
//
// The visual Reward and Loss scoring pages live here, immediately
// after the dashed-line / distance explanation, with updated wording
// that names the GREEN / RED environment colours explicitly.
// ---------------------------------------------------------------------
var inst2 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Locked box</strong><br><br>After you position the box, it becomes <strong>darker</strong>.<br>When it is darker, you <strong>cannot move it</strong>.</div>' +
      mockBrightDarkComparison(),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Landing location</strong><br><br>A <strong>colored circle</strong> shows where the bag landed.</div>' +
      mockRail(42, 60, { boxLocked: true, showDot: true, showLine: false, valence: 'reward', score: '', showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">A <strong>dashed line</strong> shows the distance between your box and the landing location.</div>' +
      mockRail(42, 60, { boxLocked: true, showDot: true, showLine: true, valence: 'reward', score: '', showItem: false }),

    // Reward scoring page (visual)
    '<div style="font-size:20px; line-height:1.8; text-align:center;"><strong style="font-size:25px;">Reward scoring</strong><br><br>In <strong>green environments</strong>, better placement helps you <strong>gain more points</strong>.<br><br><strong style="font-size:24px; color:#0a7f2e;">Perfect alignment = +10</strong><br><br>If you are farther away, you gain fewer points.</div>' +
      mockRail(52, 52, { boxLocked: true, showDot: true, showLine: false, valence: 'reward', score: '+10', showItem: false }) +
      mockRail(36, 63, { boxLocked: true, showDot: true, showLine: true, valence: 'reward', score: '+3', showItem: false }),

    // Loss scoring page (visual)
    '<div style="font-size:20px; line-height:1.8; text-align:center;"><strong style="font-size:25px;">Loss scoring</strong><br><br>In <strong>red environments</strong>, better placement helps you <strong>lose fewer points</strong>.<br><br><strong style="font-size:24px; color:#b00020;">Perfect alignment = 0</strong><br><br>If you are farther away, you lose more points.</div>' +
      mockRail(52, 52, { boxLocked: true, showDot: true, showLine: false, valence: 'loss', score: '0', showItem: false }) +
      mockRail(36, 63, { boxLocked: true, showDot: true, showLine: true, valence: 'loss', score: '-7', showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Start of the next turn</strong><br><br>When the box becomes <strong>bright</strong> again, a new turn begins.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong>Rule to remember:</strong><br><br><strong>Bright box = movable</strong><br><strong>Dark box = frozen</strong></div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px; color:#b00020;">Keep responding</strong><br><br>If you stop moving the box for too many turns, you may be warned and the game may end early.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Try it now</strong><br><br>Notice that you can move the box only when it is <strong>bright</strong>, and your <strong>score</strong> appears after each turn.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst3 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Wind makes the landing vary</strong><br><br>The bag falls <strong>near</strong> the drone, but wind changes the exact landing spot.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">It may land <strong>in front of</strong> the drone,</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">or <strong>directly under</strong> the drone,</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">or <strong>behind</strong> the drone.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">The drone also moves</strong><br><br>The best guess for where it is now is where it was on the previous turn, but it can jump to a new location.</div>',

    '<div style="font-size:21px; line-height:1.8; text-align:center;"><strong style="font-size:26px;">Best strategy</strong><br><br><strong>Place the box directly under where you think the drone is.</strong></div>' +
      mockRail(50, 54, { boxLocked: false, showDot: true, showLine: true, valence: 'reward', score: '', showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Practice again</strong><br><br>Play a few more turns and pay attention to <strong>how the drone moves</strong> and <strong>where the bag lands</strong>.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst4 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:25px;">Important change for the real game</strong><br><br>You will <strong>not</strong> see the drone.<br>You will only see the <strong>colored circle</strong> showing where the bag landed.</div>' +
      mockRail(44, 57, { boxLocked: true, showDot: true, showLine: true, valence: 'reward', score: '+6', showItem: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">You will still move the box the same way, but now you must <strong>estimate where the drone is</strong> from where it has been.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Items will appear too</strong><br><br>Each turn, a distinct <strong>item</strong> will appear where the supplies land.</div>' +
      mockRail(50, 50, { boxLocked: true, showDot: true, showLine: false, valence: 'reward', score: '', showItem: true, item: '🎲' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Try it now</strong><br><br>Play a few turns where the drone is <strong>not visible</strong>.<br>Also notice the <strong>item</strong> that appears each turn.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

// ---------------------------------------------------------------------
// inst5: 4-environments intro → ONE compact summary card → reminder.
//
// The two text-only "In some environments..." / "In other environments..."
// pages have been removed. The summary card is a single page that
// combines the intro, the GREEN/RED comparison, and the closing
// "place accurately" rule.
// ---------------------------------------------------------------------
var inst5 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:25px;">The full game</strong><br><br>There are <strong>4 environments</strong>.<br>Each has a different movement pattern and scoring context.</div>',

    // Compact comparison summary (single page)
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Two types of environments</strong><br><br>The full game has both types of environments.</div>' +
      mockGainLossComparison() +
      '<div style="font-size:19px; line-height:1.6; text-align:center; margin-top:10px;">In every environment, <strong>place the box as accurately as possible</strong>.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">You will be reminded whenever the environment changes.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst6 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:25px;">Memory task</strong><br><br>After each environment, you will complete a short memory task about the items that appeared.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">You may be asked:<br><br><strong>1.</strong> Which item appeared first<br><strong>2.</strong> How many items appeared between two items<br><strong>3.</strong> Where a middle item appeared between two items</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">For the slider question, you will see <strong>two items at the ends</strong> and the <strong>middle item above</strong>.<br>Move the slider to show when the middle item appeared relative to the other two.</div>' +
      '<div style="display:flex;justify-content:center;align-items:flex-end;gap:16px;margin:18px auto 12px auto;width:82%;max-width:700px;">' +
        '<div style="width:84px;height:84px;border-radius:12px;background:rgba(255,255,255,.12);border:2px solid rgba(180,180,180,.35);display:flex;align-items:center;justify-content:center;font-size:42px;">🌲</div>' +
        '<div style="flex:1;text-align:center;">' +
          '<div style="margin-bottom:10px;font-size:42px;">🎤</div>' +
          '<input type="range" min="0" max="100" value="50" style="width:100%;">' +
        '</div>' +
        '<div style="width:84px;height:84px;border-radius:12px;background:rgba(255,255,255,.12);border:2px solid rgba(180,180,180,.35);display:flex;align-items:center;justify-content:center;font-size:42px;">🍤</div>' +
      '</div>',

    '<div style="font-size:20px; line-height:1.8; text-align:center;"><strong style="font-size:24px;">Main priority</strong><br><br>You should notice the items, but you do <strong>not</strong> need to memorize them perfectly.<br><br><strong>Your main goal is still to maximize your score by placing the box accurately.</strong></div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst7 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:24px;">Reminder</strong><br><br>The memory task will appear <strong>after each environment</strong>.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var ready = {
  type: 'instructions',
  pages: [
    '<div style="font-size:21px; line-height:1.8; text-align:center;"><strong style="font-size:28px;">The game is starting now.</strong><br><br><strong>Good luck!</strong></div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var quiz = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><strong style="font-size:25px;">Instruction check</strong><br><br>You will now answer questions about the game.<br><br><strong>You must answer all of them correctly to continue.</strong><br><br>Good luck!</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var num_loops = 0;

var comprehension1 = {
  type: 'comprehension1'
};

var comprehension2 = {
  type: 'comprehension2'
};
