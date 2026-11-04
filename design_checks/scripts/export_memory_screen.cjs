/* Export the executed task configuration, never a Python transcription. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const files = ['static/task/stimuli.js', 'static/task/latin_square.js', 'static/task/preload.js',
  'static/task/memory_screening/memory_screening.js'];
// Read the shared scoring/rendering bounds from the encoding implementation.
// The named object is the renderer contract, rather than two independent clamps.
const trialSource = fs.readFileSync(path.join(root,'static/task/trial.js'),'utf8');
const boundsMatch = trialSource.match(/var\s+LANDING_BOUNDS\s*=\s*\{\s*min:\s*([\d.]+),\s*max:\s*([\d.]+)\s*\}/);
if (!boundsMatch) throw new Error('Cannot locate the shared LANDING_BOUNDS renderer contract.');
const circleBounds=[Number(boundsMatch[1]),Number(boundsMatch[2])];
const fragmentBounds=circleBounds.slice();
if (!trialSource.includes('resolveLandingPosition')) {
  throw new Error('Shared landing position resolver is missing.');
}
function load(shiftReward) {
  const math = Object.create(Math);
  math.random = () => shiftReward ? 0.25 : 0.75;
  const ctx = {Math: math, console: {log(){}, warn(){}}, Set};
  ctx.window = ctx;
  vm.createContext(ctx);
  files.forEach(file => vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'), ctx));
  return ctx;
}
const c = load(false);
const design = c.MemoryScreening.createDesign({seed:'memory-screen-reference'});
// Inspect the actual timeline and saved visibility fields, not just the design.
let initialProperties = {};
c.jsPsych = {plugins:{trial:{},parameterType:{STRING:'string',HTML_STRING:'html',INT:'int'}},
  data:{addProperties(properties){initialProperties=Object.assign(initialProperties,properties);}}};
const built = c.MemoryScreening.buildTimeline({seed:'memory-screen-reference'});
built.timeline[0].on_start();
const summaryTrial = built.timeline[built.timeline.length-1];
summaryTrial.on_start(summaryTrial);
const screenTimeline = {
  entry:{title:built.timeline[0].title,body:built.timeline[0].body},
  encoding:built.timeline.filter(t=>t.type==='trial').map(t=>({
    show_drone:t.show_drone,animate_drone:t.animate_drone,
    screening_drone_visible:t.data.screening_drone_visible,
    screening_drone_step_metric:t.data.screening_drone_step_metric})),
  phase_visibility:built.timeline.map(t=>t.data.screening_drone_visible),
  initial_properties:initialProperties,
  summary_properties:{memory_screening_drone_visible:summaryTrial.data.memory_screening_drone_visible,
    memory_screening_drone_step_metric:summaryTrial.data.memory_screening_drone_step_metric}
};
const main = [false,true].map(shiftReward => {
  const ctx = load(shiftReward);
  return {reward_uses_shifted_sequences:shiftReward,
    condition_label_version:ctx.condition_label_version,
    condition_audit:ctx.validateMainConditionLabels(),
    blocks: ctx.main_drone_position.map((drone,i) => ({
      condition:i+1, condition_id:ctx.getCanonicalConditionId(i), valence:ctx.factors_valence[i],
      vol_param:ctx.factors_vol[i], stc_param:ctx.factors_stc[i],
      drone:drone, landing:ctx.main_bag_position[i]
    }))};
});
const multiSeed = Array.from({length:100},(_,i) =>
  c.MemoryScreening.createDesign({seed:'audit-'+i}));
console.log(JSON.stringify({
  screen:design, screen_timeline:screenTimeline, variants:main,
  renderer:{source:'static/task/trial.js',supply_bounds:circleBounds,
    fragment_bounds:fragmentBounds,extracted_variables:['LANDING_BOUNDS'],
    shared_landing_resolver:'resolveLandingPosition'},
  main_pool:c.STIMULUS_IMAGE_POOL,
  practice:c.PRACTICE_STIMULUS_ITEMS,
  fallback:c.FALLBACK_EMOJI,
  seed_checks:multiSeed.map(d=>({seed:d.seed,drone:d.drone_positions,wind:d.wind_offsets,
    concepts:d.items.map(x=>x.concept),families:d.items.map(x=>x.family),pairs:d.pairs})),
  source_hashes:Object.fromEntries(files.concat(['static/task/trial.js','index.html',
    'design_checks/scripts/export_memory_screen.cjs','design_checks/scripts/memory_screen_checks.py',
    'design_checks/scripts/render_memory_screen_items.py']).map(file=>[file,
    crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]))
}));
