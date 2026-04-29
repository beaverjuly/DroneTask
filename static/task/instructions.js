// instructions.js — Revised for current DroneTask visuals and reward/loss practice
//
// Matches current task design:
// - flattened collector plate, no "YOU" label
// - bag drops from top and bursts into fragments
// - reward blocks: green fragments, score range 0 to +10
// - loss blocks: red fragments, score range -10 to 0
// - drone usually stays in place, then jumps
// - memory task after each environment
//
// NOTE:
// To make the practice flow match these instructions, index.html should force
// practice_no === 3 and practice_no === 5 to use valence: 'loss'.
// Otherwise participants will read about red/loss scoring but only practice reward.

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

function mockPlate(leftPct, locked) {
  var bg = locked ? 'rgba(100,100,120,.72)' : 'rgba(255,255,255,.92)';
  var border = locked ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.65)';
  return (
    '<div style="position:absolute;left:' + leftPct + '%;top:72%;transform:translate(-50%,-50%);' +
      'width:112px;height:22px;border-radius:999px;background:' + bg + ';border:2px solid ' + border + ';' +
      'box-shadow:0 3px 10px rgba(0,0,0,.25);"></div>'
  );
}

function mockBagDot(leftPct, valence) {
  var dotBg = valence === 'loss'
    ? 'radial-gradient(circle, hsl(0,65%,55%) 0%, hsl(0,50%,40%) 100%)'
    : 'radial-gradient(circle, hsl(130,60%,55%) 0%, hsl(130,45%,38%) 100%)';

  return (
    '<div style="position:absolute;left:' + leftPct + '%;top:56%;transform:translate(-50%,-50%);' +
      'width:24px;height:24px;border-radius:50%;background:' + dotBg + ';' +
      'border:2px solid rgba(255,255,255,.55);box-shadow:0 0 12px rgba(255,255,255,.2),0 3px 8px rgba(0,0,0,.35);"></div>'
  );
}

function mockFragments(centerPct, valence) {
  var color = valence === 'loss'
    ? 'linear-gradient(180deg, hsl(0,78%,62%), hsl(0,62%,42%))'
    : 'linear-gradient(180deg, hsl(130,75%,62%), hsl(130,62%,42%))';

  var offsets = [-34, -24, -14, -6, 4, 12, 20, 30];
  var tops = [66, 64, 68, 65, 67, 64, 69, 66];

  var html = '';
  for (var i = 0; i < offsets.length; i++) {
    html += (
      '<div style="position:absolute;left:calc(' + centerPct + '% + ' + offsets[i] + 'px);top:' + tops[i] + '%;' +
        'width:7px;height:7px;border-radius:2px;background:' + color + ';' +
        'box-shadow:0 0 4px rgba(0,0,0,.25);transform:translate(-50%,-50%) rotate(' + (i * 17) + 'deg);"></div>'
    );
  }
  return html;
}

function mockItem(leftPct, item) {
  return (
    '<div style="position:absolute;left:' + leftPct + '%;top:20%;transform:translateX(-50%);' +
      'width:94px;height:94px;border-radius:14px;background:rgba(255,255,255,.12);' +
      'border:2px solid rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.3);font-size:52px;line-height:1;">' + item + '</div>'
  );
}

function mockScore(leftPct, score, valence) {
  var color = valence === 'loss'
    ? (score === '0' ? '#FFD700' : '#ff4444')
    : '#39ff14';

  return (
    '<div style="position:absolute;left:' + leftPct + '%;top:38%;transform:translateX(-50%);' +
      'font-size:32px;font-weight:850;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
      'color:' + color + ';text-shadow:0 2px 10px rgba(0,0,0,.45);">' + score + '</div>'
  );
}

function mockDrone(leftPct, visible) {
  if (!visible) return '';
  return (
    '<div style="position:absolute;left:' + leftPct + '%;top:10%;transform:translateX(-50%);' +
      'font-size:34px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4));">&#128760;</div>'
  );
}

function mockRailScene(opts) {
  opts = opts || {};
  var plateLeft = opts.plateLeft || 50;
  var bagLeft = opts.bagLeft || 56;
  var valence = opts.valence || 'reward';
  var locked = !!opts.locked;
  var showBag = !!opts.showBag;
  var showFragments = !!opts.showFragments;
  var score = opts.score || '';
  var item = opts.item || '';
  var showDrone = !!opts.showDrone;
  var droneLeft = opts.droneLeft || bagLeft;

  return mockGameFrame(
    '<div style="height:220px;position:relative;">' +

      '<div style="position:absolute;left:8%;width:84%;height:3px;top:72%;' +
        'transform:translateY(-50%);border-radius:999px;background:rgba(255,255,255,.55);' +
        'box-shadow:0 0 8px rgba(255,255,255,.15);"></div>' +

      mockDrone(droneLeft, showDrone) +

      (showBag ? mockBagDot(bagLeft, valence) : '') +
      (showFragments ? mockFragments(bagLeft, valence) : '') +
      (score ? mockScore(bagLeft, score, valence) : '') +
      (item ? mockItem(bagLeft, item) : '') +

      mockPlate(plateLeft, locked) +

    '</div>'
  );
}

function mockMovableLockedComparison() {
  return (
    '<div style="display:flex;gap:16px;justify-content:center;align-items:stretch;flex-wrap:wrap;margin:12px auto 4px auto;width:84%;">' +

      '<div style="flex:1;min-width:240px;max-width:320px;padding:14px;border-radius:14px;' +
        'background:#f7f8fb;border:1px solid #e3e6ef;box-shadow:0 4px 14px rgba(0,0,0,.06);">' +
        '<div style="font-size:22px;font-weight:800;margin-bottom:10px;color:#1f2937;">White plate</div>' +
        '<div style="display:flex;justify-content:center;align-items:center;height:78px;">' +
          '<div style="width:116px;height:22px;border-radius:999px;background:rgba(255,255,255,.95);' +
            'border:2px solid rgba(180,180,180,.8);box-shadow:0 3px 12px rgba(0,0,0,.12);"></div>' +
        '</div>' +
        '<div style="font-size:18px;line-height:1.5;text-align:center;margin-top:8px;"><strong>Movable</strong></div>' +
      '</div>' +

      '<div style="flex:1;min-width:240px;max-width:320px;padding:14px;border-radius:14px;' +
        'background:#f7f8fb;border:1px solid #e3e6ef;box-shadow:0 4px 14px rgba(0,0,0,.06);">' +
        '<div style="font-size:22px;font-weight:800;margin-bottom:10px;color:#1f2937;">Grey plate</div>' +
        '<div style="display:flex;justify-content:center;align-items:center;height:78px;">' +
          '<div style="width:116px;height:22px;border-radius:999px;background:rgba(100,100,120,.78);' +
            'border:2px solid rgba(140,140,160,.45);box-shadow:0 3px 12px rgba(0,0,0,.12);"></div>' +
        '</div>' +
        '<div style="font-size:18px;line-height:1.5;text-align:center;margin-top:8px;"><strong>Locked</strong></div>' +
      '</div>' +

    '</div>'
  );
}

function mockGainLossComparison() {
  return (
    '<div style="display:flex;gap:18px;justify-content:center;align-items:stretch;flex-wrap:wrap;margin:14px auto 4px auto;width:88%;">' +

      '<div style="flex:1;min-width:250px;max-width:350px;padding:18px;border-radius:14px;' +
        'background:#f7fff8;border:2px solid #d8efdc;box-shadow:0 4px 14px rgba(0,0,0,.06);text-align:center;">' +
        '<div style="font-size:24px;font-weight:800;color:#0a7f2e;margin-bottom:10px;">GREEN = reward</div>' +
        '<div style="font-size:18px;line-height:1.55;color:#1f2937;">' +
          'Best placement: <strong>+10</strong><br>' +
          'Worst placement: <strong>0</strong><br><br>' +
          'Better placement → <strong>gain more points</strong>' +
        '</div>' +
      '</div>' +

      '<div style="flex:1;min-width:250px;max-width:350px;padding:18px;border-radius:14px;' +
        'background:#fff8f8;border:2px solid #f0d7d7;box-shadow:0 4px 14px rgba(0,0,0,.06);text-align:center;">' +
        '<div style="font-size:24px;font-weight:800;color:#b00020;margin-bottom:10px;">RED = loss</div>' +
        '<div style="font-size:18px;line-height:1.55;color:#1f2937;">' +
          'Best placement: <strong>0</strong><br>' +
          'Worst placement: <strong>-10</strong><br><br>' +
          'Better placement → <strong>lose fewer points</strong>' +
        '</div>' +
      '</div>' +

    '</div>'
  );
}

function mockWindExamples() {
  return (
    '<div style="display:flex;gap:12px;justify-content:center;align-items:stretch;flex-wrap:wrap;margin:12px auto 4px auto;width:92%;">' +

      '<div style="flex:1;min-width:190px;max-width:240px;padding:10px;border-radius:12px;background:#f7f8fb;border:1px solid #e3e6ef;text-align:center;">' +
        '<div style="font-size:16px;font-weight:800;margin-bottom:6px;">lands left</div>' +
        mockRailScene({ plateLeft: 48, bagLeft: 42, locked: true, showDrone: true, droneLeft: 50, showBag: true, showFragments: false, valence: 'reward' }) +
      '</div>' +

      '<div style="flex:1;min-width:190px;max-width:240px;padding:10px;border-radius:12px;background:#f7f8fb;border:1px solid #e3e6ef;text-align:center;">' +
        '<div style="font-size:16px;font-weight:800;margin-bottom:6px;">lands near drone</div>' +
        mockRailScene({ plateLeft: 50, bagLeft: 50, locked: true, showDrone: true, droneLeft: 50, showBag: true, showFragments: false, valence: 'reward' }) +
      '</div>' +

      '<div style="flex:1;min-width:190px;max-width:240px;padding:10px;border-radius:12px;background:#f7f8fb;border:1px solid #e3e6ef;text-align:center;">' +
        '<div style="font-size:16px;font-weight:800;margin-bottom:6px;">lands right</div>' +
        mockRailScene({ plateLeft: 52, bagLeft: 59, locked: true, showDrone: true, droneLeft: 50, showBag: true, showFragments: false, valence: 'reward' }) +
      '</div>' +

    '</div>'
  );
}

// ---------------------------------------------------------------------
// Incorrect / summary screens
// ---------------------------------------------------------------------

var inst1_incorrect = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.6; text-align:center;"><br><br>' +
      '<strong style="font-size:24px; color:#b00020;">Some answers were incorrect.</strong><br><br>' +
      'Some instructions will be repeated.<br><strong>Please pay close attention.</strong></div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst_summary = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px; color:#b00020;">You did not answer all questions correctly.</strong><br><br>' +
      'Some key rules will now be repeated.<br><br><strong>Focus on the rules below.</strong></div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:25px;">Goal</strong><br><br>' +
      'Move the <strong>collector plate</strong> to where you think the bag will land.</div>' +
      mockRailScene({ plateLeft: 46, bagLeft: 58, locked: false, showBag: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Move the plate</strong><br><br>' +
      'Use the <strong>left</strong> and <strong>right arrow keys</strong> to move the plate.<br>' +
      'You can also press the <strong>space bar</strong> to continue on block-start screens.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Movable vs. locked</strong><br><br>' +
      '<strong>White plate = movable</strong><br>' +
      '<strong>Grey plate = locked</strong><br><br>' +
      'Once you stop moving, the plate locks and the bag drops.</div>' +
      mockMovableLockedComparison(),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Bag and fragments</strong><br><br>' +
      'The bag drops from the top and bursts into fragments near the rail.<br>' +
      'Place the plate close to the landing position.</div>' +
      mockRailScene({ plateLeft: 52, bagLeft: 55, locked: true, showBag: true, showFragments: true, valence: 'reward' }),

    '<div style="font-size:20px; line-height:1.8; text-align:center;">' +
      '<strong style="font-size:25px;">Reward scoring</strong><br><br>' +
      'In <strong>green environments</strong>, better placement helps you <strong>gain more points</strong>.<br><br>' +
      '<strong style="font-size:24px; color:#0a7f2e;">Best = +10; worst = 0</strong></div>' +
      mockRailScene({ plateLeft: 52, bagLeft: 52, locked: true, showBag: true, showFragments: true, valence: 'reward', score: '+10' }),

    '<div style="font-size:20px; line-height:1.8; text-align:center;">' +
      '<strong style="font-size:25px;">Loss scoring</strong><br><br>' +
      'In <strong>red environments</strong>, better placement helps you <strong>lose fewer points</strong>.<br><br>' +
      '<strong style="font-size:24px; color:#b00020;">Best = 0; worst = -10</strong></div>' +
      mockRailScene({ plateLeft: 52, bagLeft: 52, locked: true, showBag: true, showFragments: true, valence: 'loss', score: '0' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Drone and wind</strong><br><br>' +
      'The bag tends to land near the drone, but wind shifts the exact landing spot.<br>' +
      'The drone usually stays in one place for several turns, then jumps.</div>',

    '<div style="font-size:21px; line-height:1.8; text-align:center;">' +
      '<strong style="font-size:26px;">Best strategy</strong><br><br>' +
      '<strong>Place the plate under where you think the drone currently is.</strong></div>' +
      mockRailScene({ plateLeft: 50, bagLeft: 54, locked: false, showDrone: true, droneLeft: 52, showBag: true, valence: 'reward' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Real game</strong><br><br>' +
      'In the real game, the drone is hidden.<br>' +
      'You must estimate its location from previous bag landings.</div>' +
      mockRailScene({ plateLeft: 44, bagLeft: 57, locked: true, showDrone: false, showBag: true, showFragments: true, valence: 'reward', score: '+6' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Items and memory</strong><br><br>' +
      'Each turn also shows an <strong>item</strong>. Later, you will answer memory questions about the items.</div>' +
      mockRailScene({ plateLeft: 50, bagLeft: 50, locked: true, showBag: true, showFragments: true, valence: 'reward', score: '+10', item: '🧩' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Keep responding</strong><br><br>' +
      'If you stop moving the plate for too many turns, you may be warned and the game may end early.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Next step</strong><br><br>' +
      'You will now answer questions about the game again.<br>' +
      '<strong>You must answer them correctly to continue.</strong></div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst3_incorrect = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;"><br><br>' +
      '<strong style="font-size:24px; color:#b00020;">You did not respond.</strong><br><br>' +
      'We must terminate the game here.</div>'
  ],
  show_clickable_nav: false
};

// ---------------------------------------------------------------------
// Main instruction flow
// ---------------------------------------------------------------------

var inst1 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:25px;">Goal</strong><br><br>' +
      'Move the <strong>collector plate</strong> to where you think the bag will land.</div>' +
      mockRailScene({ plateLeft: 46, bagLeft: 58, locked: false, showBag: false }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">How to move</strong><br><br>' +
      'Use the <strong>left</strong> and <strong>right arrow keys</strong> to move the plate.<br><br>' +
      'On block-start screens, you can press the <strong>space bar</strong> or an arrow key to begin.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Try it now</strong><br><br>' +
      'Press the <strong>left</strong> or <strong>right arrow key</strong> to move the plate.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst2 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Movable vs. locked</strong><br><br>' +
      '<strong>White plate = movable.</strong><br>' +
      '<strong>Grey plate = locked.</strong><br><br>' +
      'Once you stop moving, the plate locks and the bag drops.</div>' +
      mockMovableLockedComparison(),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Bag and fragments</strong><br><br>' +
      'The bag drops from the top of the screen and bursts into small fragments near the rail.<br><br>' +
      'Your score depends on how close the plate is to the landing position.</div>' +
      mockRailScene({ plateLeft: 48, bagLeft: 58, locked: true, showBag: true, showFragments: true, valence: 'reward' }),

    '<div style="font-size:20px; line-height:1.8; text-align:center;">' +
      '<strong style="font-size:25px;">Reward scoring</strong><br><br>' +
      'In <strong>green environments</strong>, better placement helps you <strong>gain more points</strong>.<br><br>' +
      '<strong style="font-size:24px; color:#0a7f2e;">Perfect alignment = +10</strong><br>' +
      '<strong style="font-size:22px; color:#0a7f2e;">Far away = closer to 0</strong></div>' +
      mockRailScene({ plateLeft: 52, bagLeft: 52, locked: true, showBag: true, showFragments: true, valence: 'reward', score: '+10' }) +
      mockRailScene({ plateLeft: 36, bagLeft: 63, locked: true, showBag: true, showFragments: true, valence: 'reward', score: '+3' }),

    '<div style="font-size:20px; line-height:1.8; text-align:center;">' +
      '<strong style="font-size:25px;">Loss scoring</strong><br><br>' +
      'In <strong>red environments</strong>, better placement helps you <strong>lose fewer points</strong>.<br><br>' +
      '<strong style="font-size:24px; color:#b00020;">Perfect alignment = 0</strong><br>' +
      '<strong style="font-size:22px; color:#b00020;">Far away = closer to -10</strong></div>' +
      mockRailScene({ plateLeft: 52, bagLeft: 52, locked: true, showBag: true, showFragments: true, valence: 'loss', score: '0' }) +
      mockRailScene({ plateLeft: 36, bagLeft: 63, locked: true, showBag: true, showFragments: true, valence: 'loss', score: '-7' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Items</strong><br><br>' +
      'Each turn also shows a distinct <strong>item</strong> near the landing position.<br><br>' +
      'Later, you will answer memory questions about these items.</div>' +
      mockRailScene({ plateLeft: 50, bagLeft: 50, locked: true, showBag: true, showFragments: true, valence: 'reward', score: '+10', item: '🎲' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Try reward scoring</strong><br><br>' +
      'Play a few green reward turns.<br><br>' +
      'Move while the plate is white. Once it becomes grey, watch where the bag lands and how many points you gain.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst3 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Try loss scoring</strong><br><br>' +
      'Now play a few red loss turns.<br><br>' +
      'In red environments, better placement helps you lose fewer points.</div>' +
      mockRailScene({ plateLeft: 52, bagLeft: 52, locked: true, showBag: true, showFragments: true, valence: 'loss', score: '0' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Wind makes the landing vary</strong><br><br>' +
      'The bag usually lands near the drone, but wind changes the exact landing spot.<br><br>' +
      'The wind effect can be small in some environments and larger in others.</div>' +
      mockWindExamples(),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">The drone jumps</strong><br><br>' +
      'The drone usually stays in one place for several turns, then jumps to a new location.<br><br>' +
      'Your best guess for where it is now is based on where it has recently been.</div>',

    '<div style="font-size:21px; line-height:1.8; text-align:center;">' +
      '<strong style="font-size:26px;">Best strategy</strong><br><br>' +
      '<strong>Place the plate under where you think the drone currently is.</strong></div>' +
      mockRailScene({ plateLeft: 50, bagLeft: 54, locked: false, showDrone: true, droneLeft: 52, showBag: true, valence: 'reward' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Try it now</strong><br><br>' +
      'Play a few more turns and pay attention to <strong>how the drone jumps</strong> and <strong>where the bag lands</strong>.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst4 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:25px;">Important change for the real game</strong><br><br>' +
      'You will <strong>not</strong> see the drone.<br><br>' +
      'You will only see where the bag lands after each turn.</div>' +
      mockRailScene({ plateLeft: 44, bagLeft: 57, locked: true, showDrone: false, showBag: true, showFragments: true, valence: 'reward', score: '+6' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      'You will still move the plate the same way, but now you must <strong>estimate the drone\'s location</strong> from previous bag landings.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Try hidden-drone loss scoring</strong><br><br>' +
      'In the real game, some hidden-drone environments are red.<br><br>' +
      'Place the plate accurately to lose fewer points.</div>' +
      mockRailScene({ plateLeft: 52, bagLeft: 52, locked: true, showDrone: false, showBag: true, showFragments: true, valence: 'loss', score: '0', item: '🧩' }),

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Try it now</strong><br><br>' +
      'Play a few turns where the drone is <strong>not visible</strong>.<br>' +
      'Also notice the <strong>item</strong> that appears each turn.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst5 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:25px;">The full game</strong><br><br>' +
      'There are <strong>4 environments</strong>.<br><br>' +
      'Each environment combines a different drone-jump pattern, wind pattern, and scoring context.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Two scoring contexts</strong><br><br>' +
      'The full game has both reward and loss environments.</div>' +
      mockGainLossComparison() +
      '<div style="font-size:19px; line-height:1.6; text-align:center; margin-top:10px;">' +
        'In every environment, <strong>place the plate as accurately as possible</strong>.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      'You will be reminded whenever the environment changes.<br><br>' +
      'On each new environment screen, press the <strong>space bar</strong> or an arrow key to begin.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst6 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:25px;">Memory task</strong><br><br>' +
      'After each environment, you will complete a short memory task about the items that appeared.</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      'You may be asked:<br><br>' +
      '<strong>1.</strong> Which item appeared first<br>' +
      '<strong>2.</strong> How many items appeared between two items<br>' +
      '<strong>3.</strong> Where a middle item appeared between two items</div>',

    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      'For the slider question, you will see <strong>two endpoint items</strong> and the <strong>middle item above</strong>.<br>' +
      'Move the slider to show when the middle item appeared relative to the two endpoint items.</div>' +
      '<div style="display:flex;justify-content:center;align-items:flex-end;gap:16px;margin:18px auto 12px auto;width:82%;max-width:700px;">' +
        '<div style="width:84px;height:84px;border-radius:12px;background:rgba(255,255,255,.12);border:2px solid rgba(180,180,180,.35);display:flex;align-items:center;justify-content:center;font-size:42px;">🌲</div>' +
        '<div style="flex:1;text-align:center;">' +
          '<div style="margin-bottom:10px;font-size:42px;">🎤</div>' +
          '<input type="range" min="0" max="100" value="50" style="width:100%;">' +
        '</div>' +
        '<div style="width:84px;height:84px;border-radius:12px;background:rgba(255,255,255,.12);border:2px solid rgba(180,180,180,.35);display:flex;align-items:center;justify-content:center;font-size:42px;">🍤</div>' +
      '</div>',

    '<div style="font-size:20px; line-height:1.8; text-align:center;">' +
      '<strong style="font-size:24px;">Main priority</strong><br><br>' +
      'You should notice the items, but you do <strong>not</strong> need to memorize them perfectly.<br><br>' +
      '<strong>Your main goal is still to maximize your score by placing the plate accurately.</strong></div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var inst7 = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:24px;">Reminder</strong><br><br>' +
      'The memory task will appear <strong>after each environment</strong>.<br><br>' +
      'During the game, focus on placing the plate accurately while also noticing the items.</div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var ready = {
  type: 'instructions',
  pages: [
    '<div style="font-size:21px; line-height:1.8; text-align:center;">' +
      '<strong style="font-size:28px;">The game is starting now.</strong><br><br>' +
      '<strong>Good luck!</strong></div>'
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next"
};

var quiz = {
  type: 'instructions',
  pages: [
    '<div style="font-size:20px; line-height:1.7; text-align:center;">' +
      '<strong style="font-size:25px;">Instruction check</strong><br><br>' +
      'You will now answer questions about the game.<br><br>' +
      '<strong>You must answer all of them correctly to continue.</strong><br><br>' +
      'Good luck!</div>'
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
